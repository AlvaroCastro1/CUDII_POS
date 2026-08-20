import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import type { EstadoLote, Lote, LoteDetalle, MotivoMerma } from '@/types/pos';

const MOTIVOS_MERMA: { valor: MotivoMerma; label: string; desc: string }[] = [
  { valor: 'caducado', label: 'Caducado', desc: 'Producto vencido (fecha de caducidad pasada)' },
  { valor: 'danado', label: 'Dañado', desc: 'Envase o producto dañado' },
  { valor: 'robo', label: 'Robo / Hurto', desc: 'Sustracción de mercancía' },
  { valor: 'perdida', label: 'Pérdida', desc: 'No localizable o extraviado' },
  { valor: 'error', label: 'Error de captura', desc: 'Corrección tras conteo físico' },
  { valor: 'otro', label: 'Otro', desc: 'Otro motivo documentado en notas' },
];

const getCaducidadBadge = (fecha?: string | null, restante?: number) => {
  if (!fecha) {
    return { clase: 'bg-on-surface/5 text-on-surface-variant', texto: 'Sin caducidad' };
  }
  if (restante !== undefined && restante <= 0) {
    return { clase: 'bg-on-surface/5 text-on-surface-variant', texto: 'Agotado' };
  }
  const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / (24 * 3600 * 1000));
  if (dias < 0) return { clase: 'bg-error/10 text-error', texto: `Vencido (${Math.abs(dias)}d)` };
  if (dias <= 7) return { clase: 'bg-error/10 text-error', texto: `Vence en ${dias}d` };
  if (dias <= 30) return { clase: 'bg-yellow-500/10 text-yellow-600', texto: `Vence en ${dias}d` };
  return { clase: 'bg-on-surface/5 text-on-surface-variant', texto: new Date(fecha).toLocaleDateString() };
};

const ESTADO_BADGE: Record<EstadoLote, { clase: string; texto: string }> = {
  activo: { clase: 'bg-success/10 text-success', texto: 'Activo' },
  agotado: { clase: 'bg-on-surface/10 text-on-surface-variant', texto: 'Agotado' },
  vencido: { clase: 'bg-error/10 text-error', texto: 'Vencido' },
};

export default function LotesView() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<string>('todos');
  const [porVencer, setPorVencer] = useState(false);
  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(20);

  // Detalle del lote
  const [loteSeleccionado, setLoteSeleccionado] = useState<LoteDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Formulario de merma
  const [mermaCantidad, setMermaCantidad] = useState('');
  const [mermaMotivo, setMermaMotivo] = useState<MotivoMerma>('caducado');
  const [mermaNotas, setMermaNotas] = useState('');
  const [mermaSubmitting, setMermaSubmitting] = useState(false);

  const fetchLotes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/lotes', {
        params: {
          page,
          limit,
          search: search || undefined,
          estado: estado === 'todos' ? undefined : estado,
          porVencer: porVencer || undefined,
        },
      });
      setLotes(res.data.data || []);
      if (res.data.meta) setMeta(res.data.meta);
    } catch {
      toast.error('Error al cargar lotes');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, estado, porVencer, setMeta]);

  useEffect(() => {
    fetchLotes();
  }, [fetchLotes]);

  const openDetalle = async (lote: Lote) => {
    setIsDetailOpen(true);
    setDetalleLoading(true);
    setLoteSeleccionado(null);
    setMermaCantidad('');
    setMermaMotivo('caducado');
    setMermaNotas('');
    try {
      const res = await api.get(`/inventory/lotes/${lote.id}`);
      setLoteSeleccionado(res.data.lote || res.data);
    } catch {
      toast.error('Error al cargar el detalle del lote');
    } finally {
      setDetalleLoading(false);
    }
  };

  const registrarMerma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loteSeleccionado) return;
    const cantidad = parseFloat(mermaCantidad);
    if (!cantidad || cantidad <= 0) {
      toast.error('Ingresa una cantidad válida');
      return;
    }
    try {
      setMermaSubmitting(true);
      await api.post('/merma', {
        sucursalId: loteSeleccionado.sucursalId,
        productoId: loteSeleccionado.productoId,
        cantidad,
        motivo: mermaMotivo,
        loteId: loteSeleccionado.id,
        notas: mermaNotas || undefined,
      });
      toast.success('Merma registrada correctamente');
      setMermaCantidad('');
      setMermaNotas('');
      fetchLotes();
      openDetalle(loteSeleccionado);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(errorMessage(err, 'Error al registrar merma'));
      } else {
        toast.error('Error al registrar merma');
      }
    } finally {
      setMermaSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display-lg text-on-background">Control de Lotes</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Trazabilidad de lotes, caducidades y mermas por producto.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Input
          placeholder="Buscar por producto o código de barras..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            reiniciar();
          }}
          className="w-full sm:max-w-xs bg-surface border border-outline/20"
        />
        <div className="w-40">
          <Select
            value={estado}
            onValueChange={(v) => {
              setEstado(v);
              reiniciar();
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="agotado">Agotados</SelectItem>
              <SelectItem value="vencido">Vencidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="switch-porevencer"
            checked={porVencer}
            onCheckedChange={(checked: boolean) => {
              setPorVencer(checked);
              reiniciar();
            }}
          />
          <Label htmlFor="switch-porevencer" className="text-sm text-on-surface-variant cursor-pointer">
            Por vencer (30 días)
          </Label>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-surface rounded-xl border border-on-surface/10 p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Recepción</TableHead>
              <TableHead>Caducidad</TableHead>
              <TableHead className="text-right">Cant. inicial</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Consumo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-6 text-on-surface-variant">
                  Cargando lotes...
                </TableCell>
              </TableRow>
            ) : lotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-64">
                  <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                    <span className="material-symbols-outlined !text-[64px] mb-4 opacity-30">inventory_2</span>
                    <p className="text-lg font-medium">
                      {search || estado !== 'todos' || porVencer
                        ? 'Sin lotes para los filtros actuales'
                        : 'Sin lotes registrados aún'}
                    </p>
                    <p className="text-sm text-on-surface-variant/60 mt-1">
                      Registra una recepción de mercancía para crear lotes.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              lotes.map((lote) => {
                const cadBadge = getCaducidadBadge(lote.fechaCaducidad, lote.cantidadRestante);
                const estBadge = ESTADO_BADGE[lote.estado] || ESTADO_BADGE.activo;
                const consumoPct = lote.cantidadInicial > 0
                  ? Math.round(((lote.cantidadInicial - lote.cantidadRestante) / lote.cantidadInicial) * 100)
                  : 0;
                const consumoColor = consumoPct < 50 ? 'bg-success' : consumoPct <= 80 ? 'bg-yellow-500' : 'bg-error';
                return (
                  <TableRow key={lote.id}>
                    <TableCell className="font-mono text-sm font-medium">{lote.codigoLote}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium text-on-surface">{lote.producto?.nombre}</span>
                      <span className="block text-[11px] text-on-surface-variant font-mono">
                        {lote.producto?.codigoBarras}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-on-surface-variant">{lote.sucursal?.nombre || '—'}</TableCell>
                    <TableCell className="text-sm text-on-surface-variant">
                      {lote.fechaRecepcion ? new Date(lote.fechaRecepcion).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cadBadge.clase}`}>
                        {cadBadge.texto}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface-variant">{lote.cantidadInicial}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold">
                        {lote.cantidadRestante}
                        {lote.producto?.esGranel ? ` ${lote.producto.unidadMedida?.toLowerCase() || ''}` : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
                          <div className={`h-full rounded-full ${consumoColor}`} style={{ width: `${consumoPct}%` }} />
                        </div>
                        <span className="text-xs text-on-surface-variant">{consumoPct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${estBadge.clase}`}>
                        {estBadge.texto}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-on-surface-variant">{lote.proveedor || '—'}</TableCell>
                    <TableCell className="text-right text-sm text-on-surface-variant">
                      ${lote.costoUnitario.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetalle(lote)} title="Ver detalle">
                        <span className="material-symbols-outlined !text-[18px] text-on-surface-variant">visibility</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
      </div>

      {/* Modal de detalle + merma */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { if (!open) setIsDetailOpen(false); }}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>
              {loteSeleccionado
                ? `Lote ${loteSeleccionado.codigoLote}`
                : 'Detalle del lote'}
            </DialogTitle>
          </DialogHeader>

          {detalleLoading ? (
            <div className="text-center py-8 text-on-surface-variant text-sm">
              Cargando detalle...
            </div>
          ) : loteSeleccionado ? (
            <div className="space-y-4">
              {/* Información del lote */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-surface-variant/40 border border-outline/20">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Producto</p>
                  <p className="text-sm font-semibold text-on-surface mt-0.5">{loteSeleccionado.producto?.nombre}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-variant/40 border border-outline/20">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Sucursal</p>
                  <p className="text-sm font-semibold text-on-surface mt-0.5">{loteSeleccionado.sucursal?.nombre || '—'}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-variant/40 border border-outline/20">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Fecha recepción</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {loteSeleccionado.fechaRecepcion
                      ? new Date(loteSeleccionado.fechaRecepcion).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface-variant/40 border border-outline/20">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Cantidad inicial</p>
                  <p className="text-sm font-bold text-on-surface mt-0.5">{loteSeleccionado.cantidadInicial}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-variant/40 border border-outline/20">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Stock restante</p>
                  <p className="text-sm font-bold text-on-surface mt-0.5">
                    {loteSeleccionado.cantidadRestante}
                    {loteSeleccionado.producto?.esGranel ? ` ${loteSeleccionado.producto.unidadMedida?.toLowerCase() || ''}` : ''}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface-variant/40 border border-outline/20">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Caducidad</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {loteSeleccionado.fechaCaducidad
                      ? new Date(loteSeleccionado.fechaCaducidad).toLocaleDateString()
                      : 'Sin caducidad'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface-variant/40 border border-outline/20">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Proveedor</p>
                  <p className="text-sm font-semibold mt-0.5">{loteSeleccionado.proveedor || '—'}</p>
                </div>
                {loteSeleccionado.creadoPor?.nombre && (
                  <div className="p-3 rounded-xl bg-surface-variant/40 border border-outline/20">
                    <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Creado por</p>
                    <p className="text-sm font-semibold mt-0.5">{loteSeleccionado.creadoPor.nombre}</p>
                  </div>
                )}
              </div>

              {/* Historial de movimientos */}
              <div>
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
                  Historial de movimientos
                </p>
                <div className="rounded-xl border border-outline/20 divide-y divide-outline/10 max-h-40 overflow-y-auto custom-scrollbar">
                  {loteSeleccionado.movimientos && loteSeleccionado.movimientos.length > 0 ? (
                    loteSeleccionado.movimientos.map((mov) => (
                      <div key={mov.id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="font-medium text-on-surface capitalize">{mov.tipo.replaceAll('_', ' ')}</span>
                        <span className="text-on-surface-variant">
                          {new Date(mov.fechaHora).toLocaleString()} • {mov.usuario?.nombre || 'Sistema'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-xs text-on-surface-variant">Sin movimientos</div>
                  )}
                </div>
              </div>

              {/* Formulario de merma */}
              <form onSubmit={registrarMerma} className="space-y-3 rounded-xl border border-error/20 bg-error/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined !text-[18px] text-error">broken_image</span>
                  <p className="text-sm font-semibold text-error">Registrar merma de este lote</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">
                      Cantidad {loteSeleccionado.producto?.esGranel ? '(decimal)' : ''}
                    </Label>
                    <Input
                      type="number"
                      step={loteSeleccionado.producto?.esGranel ? '0.001' : '1'}
                      min="0.001"
                      required
                      value={mermaCantidad}
                      onChange={(e) => setMermaCantidad(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Motivo</Label>
                    <Select value={mermaMotivo} onValueChange={(v) => setMermaMotivo(v as MotivoMerma)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_MERMA.map((m) => (
                          <SelectItem key={m.valor} value={m.valor}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Input
                  value={mermaNotas}
                  onChange={(e) => setMermaNotas(e.target.value)}
                  placeholder="Notas (opcional)"
                />
                <Button
                  type="submit"
                  disabled={mermaSubmitting}
                  variant="destructive"
                  className="w-full"
                >
                  {mermaSubmitting ? 'Registrando...' : 'Registrar Merma'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="text-center py-8 text-on-surface-variant text-sm">No se encontró el lote</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
