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
import { BuscadorEstandar } from '@/components/ui/BuscadorEstandar';
import { useAuthStore } from '@/store/useAuthStore';
import type { EstadoLote, Lote, LoteDetalle, MotivoMerma } from '@/types/pos';
import { Eye } from 'lucide-react';

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
  if (dias <= 30) return { clase: 'bg-warning/10 text-warning', texto: `Vence en ${dias}d` };
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
  const [verificando, setVerificando] = useState(false);

  // #9: edición de la fecha de caducidad del lote
  const { user } = useAuthStore();
  const puedeEditarCaducidad = ['ADMIN', 'GERENTE', 'ALMACEN'].includes(
    user?.rol || '',
  );
  const [editandoCaducidad, setEditandoCaducidad] = useState(false);
  const [fechaCaducidadEdit, setFechaCaducidadEdit] = useState('');
  const [guardandoCaducidad, setGuardandoCaducidad] = useState(false);

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
    setEditandoCaducidad(false);
    try {
      const res = await api.get(`/inventory/lotes/${lote.id}`);
      setLoteSeleccionado(res.data.lote || res.data);
    } catch {
      toast.error('Error al cargar el detalle del lote');
    } finally {
      setDetalleLoading(false);
    }
  };

  /** #9: guarda la nueva fecha de caducidad del lote */
  const guardarCaducidad = async () => {
    if (!loteSeleccionado) return;
    try {
      setGuardandoCaducidad(true);
      await api.patch(
        `/inventory/lotes/${loteSeleccionado.id}/fecha-caducidad`,
        { fechaCaducidad: fechaCaducidadEdit || null },
      );
      toast.success('Fecha de caducidad guardada correctamente');
      setEditandoCaducidad(false);
      fetchLotes();
      openDetalle(loteSeleccionado);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(errorMessage(err, 'Error al guardar la fecha de caducidad'));
      } else {
        toast.error('Error al guardar la fecha de caducidad');
      }
    } finally {
      setGuardandoCaducidad(false);
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display-lg text-on-background">Control de Lotes</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Trazabilidad de lotes, caducidades y mermas por producto.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={verificando}
          onClick={async () => {
            try {
              setVerificando(true);
              const res = await api.post('/inventory/vencimientos/verificar');
              toast.success(
                `${res.data?.revisados ?? 0} lote(s) revisados. Se notificó a administración si hay alertas.`,
              );
              fetchLotes();
            } catch (err) {
              toast.error(errorMessage(err, 'Error al verificar vencimientos'));
            } finally {
              setVerificando(false);
            }
          }}
        >
          {verificando ? 'Verificando...' : 'Verificar vencidos'}
        </Button>
      </div>

      <BuscadorEstandar
        busqueda={search}
        onBusquedaChange={(val) => {
          setSearch(val);
          reiniciar();
        }}
        placeholder="Buscar por lote, producto o código de barras..."
        switchInactivos={{
          checked: porVencer,
          onCheckedChange: (checked: boolean) => {
            setPorVencer(checked);
            reiniciar();
          },
          label: 'Mostrar solo lotes por vencer / vencidos',
        }}
        onActualizar={fetchLotes}
        cargando={loading}
        onLimpiar={() => {
          setSearch('');
          setEstado('todos');
          setPorVencer(false);
          reiniciar();
        }}
        filtrosActivosCount={estado !== 'todos' ? 1 : 0}
        filtrosRapidos={
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-on-surface-variant font-medium">Estado de Lote</span>
            <select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value);
                reiniciar();
              }}
              className="h-9 bg-surface-container-low border border-outline/20 rounded-xl px-3 text-xs focus:border-primary focus:outline-none text-on-surface"
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="agotado">Agotado</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
        }
      />

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
                const consumoColor = consumoPct < 50 ? 'bg-success' : consumoPct <= 80 ? 'bg-warning' : 'bg-error';
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
                        <Eye className="w-4 h-4 text-on-surface-variant" />
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
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-on-surface/10 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold font-display-lg text-primary flex items-center gap-2">
                <span className="material-symbols-outlined !text-[22px]">inventory_2</span>
                {loteSeleccionado
                  ? `Lote: ${loteSeleccionado.codigoLote}`
                  : 'Detalle del lote'}
              </DialogTitle>
            </DialogHeader>
          </div>

          {detalleLoading ? (
            <div className="text-center py-12 text-on-surface-variant text-sm flex flex-col items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-primary !text-[28px]">progress_activity</span>
              Cargando detalle del lote...
            </div>
          ) : loteSeleccionado ? (
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5 custom-scrollbar">
              {/* Banner de Producto Resumen */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline/10 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-bold text-on-surface font-display-lg">
                    {loteSeleccionado.producto?.nombre}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-lg">
                      {loteSeleccionado.producto?.codigoBarras}
                    </span>
                    {loteSeleccionado.sucursal?.nombre && (
                      <span className="text-xs text-on-surface-variant">
                        Sucursal: <strong>{loteSeleccionado.sucursal.nombre}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const est = ESTADO_BADGE[loteSeleccionado.estado];
                    const cad = getCaducidadBadge(loteSeleccionado.fechaCaducidad, loteSeleccionado.cantidadRestante);
                    return (
                      <>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${est.clase}`}>
                          {est.texto}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cad.clase}`}>
                          {cad.texto}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Grid de métricas clave */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-surface border border-outline/10 space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Cantidad Inicial</p>
                  <p className="text-lg font-bold text-on-surface">
                    {loteSeleccionado.cantidadInicial}
                    <span className="text-xs font-normal text-on-surface-variant ml-1">
                      {loteSeleccionado.producto?.unidadMedida?.toLowerCase() || 'ud'}
                    </span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline/10 space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Stock Restante</p>
                  <p className="text-lg font-bold text-primary">
                    {loteSeleccionado.cantidadRestante}
                    <span className="text-xs font-normal text-on-surface-variant ml-1">
                      {loteSeleccionado.producto?.unidadMedida?.toLowerCase() || 'ud'}
                    </span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline/10 space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Costo Unitario</p>
                  <p className="text-lg font-bold text-on-surface">
                    ${loteSeleccionado.costoUnitario.toFixed(2)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline/10 space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Fecha Recepción</p>
                  <p className="text-sm font-semibold text-on-surface">
                    {loteSeleccionado.fechaRecepcion
                      ? new Date(loteSeleccionado.fechaRecepcion).toLocaleDateString('es-MX', { dateStyle: 'medium' })
                      : '—'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline/10 space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Proveedor</p>
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {loteSeleccionado.proveedor || '—'}
                  </p>
                </div>

                {loteSeleccionado.creadoPor?.nombre && (
                  <div className="p-3 rounded-xl bg-surface border border-outline/10 space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Creado Por</p>
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {loteSeleccionado.creadoPor.nombre}
                    </p>
                  </div>
                )}
              </div>

              {/* Bloque de Fecha de Caducidad */}
              <div className="p-3.5 rounded-xl bg-surface border border-outline/10 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide flex items-center gap-1.5">
                    <span className="material-symbols-outlined !text-[16px] text-warning">event</span>
                    Fecha de Caducidad
                  </p>
                  {!editandoCaducidad && puedeEditarCaducidad && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-primary font-medium flex items-center gap-1"
                      onClick={() => {
                        setFechaCaducidadEdit(
                          loteSeleccionado.fechaCaducidad
                            ? new Date(loteSeleccionado.fechaCaducidad).toISOString().slice(0, 10)
                            : '',
                        );
                        setEditandoCaducidad(true);
                      }}
                    >
                      <span className="material-symbols-outlined !text-[14px]">edit</span>
                      Editar
                    </Button>
                  )}
                </div>

                {editandoCaducidad ? (
                  <div className="space-y-2 pt-1 border-t border-outline/10">
                    <div className="flex items-center gap-3">
                      <Input
                        type="date"
                        value={fechaCaducidadEdit}
                        onChange={(e) => setFechaCaducidadEdit(e.target.value)}
                        className="text-sm h-9 flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={guardandoCaducidad}
                        onClick={guardarCaducidad}
                        className="h-9"
                      >
                        {guardandoCaducidad ? 'Guardando...' : 'Guardar'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={guardandoCaducidad}
                        onClick={() => setEditandoCaducidad(false)}
                        className="h-9"
                      >
                        Cancelar
                      </Button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                      Confirma la fecha para actualizar el control de caducidades en el POS.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-on-surface">
                    {loteSeleccionado.fechaCaducidad
                      ? new Date(loteSeleccionado.fechaCaducidad).toLocaleDateString('es-MX', { dateStyle: 'long' })
                      : 'Sin fecha de caducidad asignada'}
                  </p>
                )}
              </div>

              {/* Historial de movimientos */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined !text-[16px] text-primary">swap_vert</span>
                  Historial de Movimientos
                </p>
                <div className="rounded-xl border border-outline/10 divide-y divide-outline/10 max-h-36 overflow-y-auto custom-scrollbar bg-surface">
                  {loteSeleccionado.movimientos && loteSeleccionado.movimientos.length > 0 ? (
                    loteSeleccionado.movimientos.map((mov) => (
                      <div key={mov.id} className="flex items-center justify-between px-3.5 py-2 text-xs">
                        <span className="font-semibold text-on-surface capitalize">
                          {mov.tipo.replaceAll('_', ' ')}
                        </span>
                        <span className="text-on-surface-variant">
                          {new Date(mov.fechaHora).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })} • {mov.usuario?.nombre || 'Sistema'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3.5 py-4 text-xs text-center text-on-surface-variant">
                      Sin movimientos registrados para este lote.
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario de merma */}
              <form onSubmit={registrarMerma} className="space-y-3 rounded-xl border border-error/20 bg-error/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined !text-[20px] text-error">warning</span>
                  <div>
                    <p className="text-sm font-bold text-error">Registrar Merma de este Lote</p>
                    <p className="text-xs text-on-surface-variant">Descuenta stock por daño, caducidad o merma.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
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
                      className="bg-surface"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Motivo</Label>
                    <Select value={mermaMotivo} onValueChange={(v) => setMermaMotivo(v as MotivoMerma)}>
                      <SelectTrigger className="bg-surface">
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
                  placeholder="Notas adicionales (opcional)..."
                  className="bg-surface text-xs"
                />
                <Button
                  type="submit"
                  disabled={mermaSubmitting}
                  variant="destructive"
                  className="w-full font-semibold"
                >
                  {mermaSubmitting ? 'Registrando Merma...' : 'Registrar Merma'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="text-center py-12 text-on-surface-variant text-sm">
              No se encontró información para el lote seleccionado.
            </div>
          )}

          <div className="px-6 py-3 bg-surface-container-low border-t border-on-surface/10 flex justify-end flex-shrink-0">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
