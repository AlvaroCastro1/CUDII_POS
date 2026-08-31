import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { usePaginacion, type PaginacionMeta } from '@/hooks/usePaginacion';
import { useAuthStore } from '@/store/useAuthStore';
import { usePosStore, type LineaPresupuesto } from '@/store/usePosStore';
import { RefreshCw, Search, Eye, MinusCircle, SlidersHorizontal, X } from 'lucide-react';

interface ClienteSnap {
  id: string;
  nombre: string;
  apellidoPaterno: string;
}

interface ResumenPresupuesto {
  id: string;
  folio: string;
  estado: 'abierto' | 'vendido' | 'cancelado';
  subtotal: number;
  descuento: number;
  total: number;
  descuentoNivel: number;
  descuentoCanje: number;
  descuentoCupon: number;
  vendidoEn?: string | null;
  canceladoEn?: string | null;
  creadoEn: string;
  cliente?: ClienteSnap | null;
  cajero?: { id: string; nombre: string } | null;
}

interface LineaDetalle {
  id: string;
  productoId: string;
  comboId?: string | null;
  nombreCombo?: string | null;
  nombreProducto: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  total: number;
  precioCongelado: number;
  precioActual: number;
  precioEfectivo: number;
}

interface DetallePresupuesto {
  id: string;
  folio: string;
  estado: 'abierto' | 'vendido' | 'cancelado';
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  descuentoNivel: number;
  descuentoCanje: number;
  descuentoCupon: number;
  descuentoGeneral: number;
  codigoCupon?: string | null;
  puntosACanjear: number;
  conservarPrecioPresupuesto: boolean;
  creadoEn: string;
  cliente?: ClienteSnap | null;
  cajero?: { id: string; nombre: string } | null;
  detalles: LineaDetalle[];
}

const fmtMoneda = (v: number) =>
  v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtFecha = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ESTADOS: Record<ResumenPresupuesto['estado'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  abierto: { label: 'Abierto', variant: 'default' },
  vendido: { label: 'Vendido', variant: 'secondary' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

export default function PresupuestosView() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const cargarPresupuesto = usePosStore((state) => state.cargarPresupuesto);
  const setPresupuestoActivo = usePosStore((state) => state.setPresupuestoActivo);

  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(15);
  const [presupuestos, setPresupuestos] = useState<ResumenPresupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [detalle, setDetalle] = useState<DetallePresupuesto | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [cancelarObjetivo, setCancelarObjetivo] = useState<ResumenPresupuesto | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const [vendiendoId, setVendiendoId] = useState<string | null>(null);

  const puedeGestionar =
    user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN' || user?.rol === 'GERENTE';

  const fetchLista = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
      };
      if (search.trim()) params.busqueda = search.trim();
      if (filtroEstado) params.estado = filtroEstado;
      const res = await api.get<{ data: ResumenPresupuesto[]; meta?: PaginacionMeta }>(
        '/presupuestos',
        { params },
      );
      const lista = Array.isArray(res.data?.data) ? res.data.data : [];
      setPresupuestos(lista);
      if (res.data?.meta) setMeta(res.data.meta);
    } catch {
      toast.error('Error al cargar los presupuestos');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filtroEstado, setMeta]);

  useEffect(() => {
    fetchLista();
  }, [fetchLista]);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    reiniciar();
    setFiltroEstado(filtroEstado || '');
    fetchLista();
  };

  const limpiar = () => {
    setSearch('');
    setFiltroEstado('');
    reiniciar();
  };

  const abrirDetalle = async (p: ResumenPresupuesto) => {
    setDetalle(null);
    setDetalleAbierto(true);
    setCargandoDetalle(true);
    try {
      const res = await api.get<DetallePresupuesto>(`/presupuestos/${p.id}`);
      setDetalle(res.data);
    } catch {
      toast.error('Error al cargar el detalle del presupuesto');
      setDetalleAbierto(false);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const vender = async (p: ResumenPresupuesto) => {
    setVendiendoId(p.id);
    try {
      const res = await api.get<DetallePresupuesto>(`/presupuestos/${p.id}`);
      const d = res.data;
      const lineas: LineaPresupuesto = {
        productos: d.detalles.map((linea) => ({
          productoId: linea.productoId,
          codigoBarras: '',
          nombre: linea.nombreCombo
            ? `${linea.nombreCombo} · ${linea.nombreProducto}`
            : linea.nombreProducto,
          unidadMedida: linea.unidadMedida,
          precioUnitario: linea.precioEfectivo,
          cantidad: linea.cantidad,
          stockDisponible: 9999,
          descuento: linea.descuento,
          esGranel: linea.unidadMedida === 'KILOGRAMOS' || linea.unidadMedida === 'LITROS',
          comboId: linea.comboId ?? undefined,
          nombreCombo: linea.nombreCombo ?? undefined,
        })),
        combos: [],
      };
      cargarPresupuesto(lineas, d.descuentoGeneral);
      setPresupuestoActivo(d.id);
      toast.success(`Presupuesto ${d.folio} cargado al ticket`);
      navigate('/pos');
    } catch {
      toast.error('No se pudo cargar el presupuesto al ticket');
    } finally {
      setVendiendoId(null);
    }
  };

  const confirmarCancelar = async () => {
    if (!cancelarObjetivo) return;
    setCancelando(true);
    try {
      await api.patch(`/presupuestos/${cancelarObjetivo.id}/cancelar`);
      toast.success(`Presupuesto ${cancelarObjetivo.folio} cancelado`);
      setCancelarObjetivo(null);
      fetchLista();
    } catch {
      toast.error('Error al cancelar el presupuesto');
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display-lg text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined !text-2xl">format_list_numbered</span>
            Presupuestos
          </h1>
          <p className="text-sm text-on-surface-variant font-body-md">
            Cotizaciones guardadas sin cobrar. Cárgalas al ticket y véndelas cuando quieras.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {meta ? `${meta.total} registro${meta.total !== 1 ? 's' : ''}` : '—'}
        </Badge>
      </div>

      <div className="spatial-glass rounded-2xl border border-outline/20 p-3 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <form onSubmit={buscar} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por folio o cliente..."
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="icon" title="Buscar">
              <Search className="w-4 h-4" />
            </Button>
          </form>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMostrarFiltros((v) => !v)}
              title="Filtros por estado"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filtros</span>
            </Button>
            <Button variant="outline" size="sm" onClick={limpiar} title="Limpiar">
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Limpiar</span>
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLista} title="Actualizar">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {mostrarFiltros && (
          <div className="flex flex-wrap gap-2">
            {(['abierto', 'vendido', 'cancelado'] as const).map((estado) => (
              <button
                key={estado}
                onClick={() => {
                  setFiltroEstado((prev) => (prev === estado ? '' : estado));
                  reiniciar();
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  filtroEstado === estado
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low border-outline/20 text-on-surface-variant hover:bg-on-surface/5'
                }`}
              >
                {ESTADOS[estado].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="spatial-glass rounded-2xl border border-outline/20 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-on-surface-variant font-body-md">
            Cargando presupuestos...
          </div>
        ) : presupuestos.length === 0 ? (
          <div className="p-10 text-center text-on-surface-variant font-body-md">
            No hay presupuestos. Guarda un ticket como presupuesto desde el POS.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-outline border-b border-outline/10">
                  <th className="px-4 py-3 font-semibold">Folio</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {presupuestos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-outline/5 hover:bg-on-surface/5 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-primary">
                      {p.folio}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{fmtFecha(p.creadoEn)}</td>
                    <td className="px-4 py-3">
                      {p.cliente
                        ? `${p.cliente.nombre} ${p.cliente.apellidoPaterno ?? ''}`.trim()
                        : 'Consumidor final'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {fmtMoneda(p.total)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ESTADOS[p.estado].variant}>{ESTADOS[p.estado].label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirDetalle(p)}
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {p.estado === 'abierto' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => vender(p)}
                            disabled={vendiendoId === p.id}
                            title="Cargar al ticket para vender"
                          >
                            {vendiendoId === p.id ? 'Cargando...' : 'Vender'}
                          </Button>
                        )}
                        {p.estado === 'abierto' && puedeGestionar && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelarObjetivo(p)}
                            title="Cancelar presupuesto"
                          >
                            <MinusCircle className="w-4 h-4 text-error" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
      </div>

      <Dialog open={detalleAbierto} onOpenChange={setDetalleAbierto}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-symbols-outlined !text-xl text-primary">description</span>
              Detalle del presupuesto
            </DialogTitle>
          </DialogHeader>
          {cargandoDetalle ? (
            <div className="p-8 text-center text-on-surface-variant font-body-md">
              Cargando detalle...
            </div>
          ) : detalle ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-bold text-primary">{detalle.folio}</p>
                  <p className="text-xs text-on-surface-variant">{fmtFecha(detalle.creadoEn)}</p>
                </div>
                <Badge variant={ESTADOS[detalle.estado].variant}>
                  {ESTADOS[detalle.estado].label}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-on-surface-variant">
                <span>
                  Cliente:{' '}
                  <span className="font-medium text-on-surface">
                    {detalle.cliente
                      ? `${detalle.cliente.nombre} ${detalle.cliente.apellidoPaterno ?? ''}`.trim()
                      : 'Consumidor final'}
                  </span>
                </span>
                {detalle.cajero && (
                  <span>
                    Cajero: <span className="font-medium text-on-surface">{detalle.cajero.nombre}</span>
                  </span>
                )}
              </div>
              <div className="border-t border-outline/10 pt-3 space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
                {detalle.detalles.map((linea) => (
                  <div key={linea.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-on-surface">
                        {linea.nombreCombo ? `${linea.nombreCombo} · ` : ''}
                        {linea.nombreProducto}
                      </p>
                      <p className="text-xs text-outline">
                        {linea.cantidad} × {fmtMoneda(linea.precioUnitario)}
                        {linea.descuento > 0 && (
                          <span className="text-error"> (−{fmtMoneda(linea.descuento)})</span>
                        )}
                      </p>
                    </div>
                    <span className="font-mono font-medium">{fmtMoneda(linea.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-outline/10 pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Subtotal</span>
                  <span className="font-mono">{fmtMoneda(detalle.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Descuento general</span>
                  <span className="font-mono text-error">
                    {detalle.descuentoGeneral > 0 ? `−${fmtMoneda(detalle.descuentoGeneral)}` : '—'}
                  </span>
                </div>
                {detalle.descuentoNivel > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Descuento por nivel</span>
                    <span className="font-mono text-error">−{fmtMoneda(detalle.descuentoNivel)}</span>
                  </div>
                )}
                {detalle.descuentoCupon > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Cupón {detalle.codigoCupon ?? ''}</span>
                    <span className="font-mono text-error">−{fmtMoneda(detalle.descuentoCupon)}</span>
                  </div>
                )}
                {detalle.descuentoCanje > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Canje de puntos</span>
                    <span className="font-mono text-error">−{fmtMoneda(detalle.descuentoCanje)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t border-outline/10">
                  <span className="text-on-surface">Total</span>
                  <span className="font-mono text-primary">{fmtMoneda(detalle.total)}</span>
                </div>
              </div>
              {detalle.estado === 'abierto' && (
                <div className="flex justify-end">
                  <Button onClick={() => {
                    setDetalleAbierto(false);
                    vender({ ...detalle, descuento: 0 } as ResumenPresupuesto);
                  }}>
                    Vender ahora
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-on-surface-variant">Sin información.</div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!cancelarObjetivo}
        onClose={() => setCancelarObjetivo(null)}
        onConfirm={confirmarCancelar}
        title="Cancelar presupuesto"
        description={
          cancelarObjetivo
            ? `¿Cancelar el presupuesto ${cancelarObjetivo.folio}? Ya no podrás venderlo desde la lista.`
            : ''
        }
        confirmText="Cancelar presupuesto"
        variant="warning"
        isLoading={cancelando}
      />
    </div>
  );
}
