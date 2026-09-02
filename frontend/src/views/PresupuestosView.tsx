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
import { RefreshCw, Eye, XCircle, SlidersHorizontal, X, AlertTriangle, Power, PowerOff } from 'lucide-react';
import { BuscadorEstandar } from '@/components/ui/BuscadorEstandar';

interface ClienteSnap {
  id: string;
  nombre: string;
  apellidoPaterno: string;
}

interface ResumenPresupuesto {
  id: string;
  folio: string;
  estado: 'abierto' | 'vendido' | 'cancelado' | 'vencido';
  subtotal: number;
  descuento: number;
  total: number;
  descuentoNivel: number;
  descuentoCanje: number;
  descuentoCupon: number;
  vendidoEn?: string | null;
  canceladoEn?: string | null;
  creadoEn: string;
  diasExpiracionPresupuesto?: number;
  fechaVencimiento?: string | null;
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
  estado: 'abierto' | 'vendido' | 'cancelado' | 'vencido';
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
  diasExpiracionPresupuesto?: number;
  fechaVencimiento?: string | null;
  precioVencido?: boolean;
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

const ESTADOS: Record<ResumenPresupuesto['estado'], { label: string; clase: string; dot: string }> = {
  abierto: { label: 'Abierto', clase: 'bg-success/10 text-success border-success/30', dot: 'bg-success' },
  vendido: { label: 'Vendido', clase: 'bg-surface-variant/60 text-on-surface-variant border-on-surface/15', dot: 'bg-on-surface-variant' },
  cancelado: { label: 'Cancelado', clase: 'bg-error/10 text-error border-error/30', dot: 'bg-error' },
  vencido: { label: 'Vencido', clase: 'bg-warning/10 text-warning border-warning/30', dot: 'bg-warning' },
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

  const [incluirCancelados, setIncluirCancelados] = useState(false);
  const [cancelarObjetivo, setCancelarObjetivo] = useState<ResumenPresupuesto | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const [descancelarObjetivo, setDescancelarObjetivo] = useState<ResumenPresupuesto | null>(null);
  const [descancelando, setDescancelando] = useState(false);

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
      if (incluirCancelados) params.incluirCancelados = 'true';
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
  }, [page, limit, search, filtroEstado, incluirCancelados, setMeta]);

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
    setIncluirCancelados(false);
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
          nombre: linea.nombreProducto,
          unidadMedida: linea.unidadMedida,
          precioUnitario: linea.precioEfectivo,
          cantidad: linea.cantidad,
          stockDisponible: 9999,
          descuento: linea.descuento,
          esGranel: linea.unidadMedida === 'KILOGRAMOS' || linea.unidadMedida === 'LITROS',
          comboId: linea.comboId ?? undefined,
          nombreCombo: linea.nombreCombo ?? undefined,
          precioCongelado: linea.precioCongelado,
          precioActual: linea.precioActual,
          conservarPrecio: d.precioVencido ? false : d.conservarPrecioPresupuesto,
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

  const confirmarDescancelar = async () => {
    if (!descancelarObjetivo) return;
    setDescancelando(true);
    try {
      await api.patch(`/presupuestos/${descancelarObjetivo.id}/descancelar`);
      toast.success(`Presupuesto ${descancelarObjetivo.folio} reactivado`);
      setDescancelarObjetivo(null);
      fetchLista();
    } catch {
      toast.error('Error al reactivar el presupuesto');
    } finally {
      setDescancelando(false);
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

      <BuscadorEstandar
        busqueda={search}
        onBusquedaChange={(v) => {
          setSearch(v);
          reiniciar();
        }}
        placeholder="Buscar por folio o cliente..."
        switchInactivos={{
          checked: incluirCancelados,
          onCheckedChange: (checked) => {
            setIncluirCancelados(checked);
            reiniciar();
          },
          label: 'Mostrar presupuestos cancelados',
        }}
        onActualizar={fetchLista}
        cargando={loading}
        onLimpiar={limpiar}
        filtrosActivosCount={filtroEstado ? 1 : 0}
        filtrosRapidos={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-on-surface-variant mr-1">
              Estado:
            </span>
            {(['abierto', 'vendido', 'cancelado', 'vencido'] as const).map((estado) => (
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
        }
      />

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
                    <td className="px-4 py-3 text-on-surface-variant">
                      <div>{fmtFecha(p.creadoEn)}</div>
                      {p.diasExpiracionPresupuesto &&
                        p.diasExpiracionPresupuesto > 0 &&
                        p.fechaVencimiento && (
                          <div
                            className={`text-[11px] mt-0.5 ${
                              p.estado === 'vencido'
                                ? 'text-warning font-semibold'
                                : 'text-outline'
                            }`}
                          >
                            {p.estado === 'vencido' ? 'Vencía el ' : 'Vence: '}
                            {fmtFecha(p.fechaVencimiento)}
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      {p.cliente
                        ? `${p.cliente.nombre} ${p.cliente.apellidoPaterno ?? ''}`.trim()
                        : 'Consumidor final'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {fmtMoneda(p.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-label-sm px-2.5 py-1 rounded-full border ${ESTADOS[p.estado].clase}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ESTADOS[p.estado].dot}`} />
                        {ESTADOS[p.estado].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirDetalle(p)}
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4 text-on-surface-variant" />
                        </Button>
                        {(p.estado === 'abierto' || p.estado === 'vencido') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => vender(p)}
                            disabled={vendiendoId === p.id}
                            title="Cargar al ticket para vender"
                          >
                            <span className="material-symbols-outlined !text-lg text-primary">point_of_sale</span>
                          </Button>
                        )}
                        {(p.estado === 'abierto' || p.estado === 'vencido') &&
                          puedeGestionar && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelarObjetivo(p)}
                            title="Cancelar presupuesto"
                          >
                            <PowerOff className="w-4 h-4 text-warning" />
                          </Button>
                        )}
                        {p.estado === 'cancelado' && puedeGestionar && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDescancelarObjetivo(p)}
                            title="Reactivar presupuesto"
                          >
                            <Power className="w-4 h-4 text-success" />
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
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
          <div className="flex flex-col max-h-[82vh]">
            <DialogHeader className="px-6 pt-5 pb-4 pr-14 border-b border-outline/10 bg-surface-container-low/50">
              <DialogTitle className="flex items-center gap-2.5 text-base">
                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined !text-xl">description</span>
                </span>
                <span className="font-headline-md">Detalle del presupuesto</span>
              </DialogTitle>
              {detalle && (
                <span className={`mt-1 w-fit inline-flex items-center gap-1.5 text-xs font-label-sm px-2.5 py-1 rounded-full border ${ESTADOS[detalle.estado].clase}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ESTADOS[detalle.estado].dot}`} />
                  {ESTADOS[detalle.estado].label}
                </span>
              )}
            </DialogHeader>

            {cargandoDetalle ? (
              <div className="p-10 text-center text-on-surface-variant font-body-md">
                Cargando detalle...
              </div>
            ) : detalle ? (
              <>
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
                  {/* Encabezado tipo documento */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-outline font-label-sm">
                        Folio
                      </p>
                      <p className="font-mono font-bold text-2xl text-primary leading-tight">
                        {detalle.folio}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-widest text-outline font-label-sm">
                        Emitido el
                      </p>
                      <p className="text-sm font-medium text-on-surface">{fmtFecha(detalle.creadoEn)}</p>
                    </div>
                  </div>

                  {/* D12: aviso cuando el presupuesto venció y el precio se recalculará */}
                  {detalle.precioVencido && (
                    <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-warning/10 border border-warning/30 rounded-xl text-warning text-xs font-label-sm leading-relaxed">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                      <span>
                        Este presupuesto venció. Al venderlo se recalculan los
                        precios con el catálogo vigente
                        {detalle.diasExpiracionPresupuesto
                          ? ` (validez de ${detalle.diasExpiracionPresupuesto} días)`
                          : ''}.
                      </span>
                    </div>
                  )}

                  {/* Metadatos */}
                  <div className="rounded-xl border border-outline/15 bg-surface-container-low/40 p-4 space-y-2.5 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-on-surface-variant shrink-0">Cliente</span>
                      <span className="text-right font-medium text-on-surface">
                        {detalle.cliente
                          ? `${detalle.cliente.nombre} ${detalle.cliente.apellidoPaterno ?? ''}`.trim()
                          : 'Consumidor final'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-on-surface-variant shrink-0">Cajero</span>
                      <span className="text-right font-medium text-on-surface">
                        {detalle.cajero?.nombre ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-on-surface-variant shrink-0">Precios al vender</span>
                      <span className="text-right font-medium text-on-surface">
                        {detalle.conservarPrecioPresupuesto
                          ? 'Conservar los de la cotización'
                          : 'Los vigentes del catálogo'}
                      </span>
                    </div>
                    {detalle.diasExpiracionPresupuesto &&
                      detalle.diasExpiracionPresupuesto > 0 && (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-on-surface-variant shrink-0">
                            Vence
                          </span>
                          <span className="text-right font-medium text-on-surface">
                            {detalle.precioVencido ? (
                              <span className="text-warning font-semibold">
                                Vencido el {fmtFecha(detalle.fechaVencimiento)}
                              </span>
                            ) : (
                              fmtFecha(detalle.fechaVencimiento)
                            )}
                          </span>
                        </div>
                      )}
                    {detalle.puntosACanjear > 0 && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-on-surface-variant shrink-0">Puntos a canjear</span>
                        <span className="text-right font-medium text-on-surface">
                          {detalle.puntosACanjear} pts
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Líneas del presupuesto */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-outline">
                        Productos ({detalle.detalles.length})
                      </h3>
                    </div>
                    <div className="divide-y divide-outline/10 border-t border-b border-outline/10">
                      {detalle.detalles.map((linea) => (
                        <div key={linea.id} className="py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                {linea.comboId ? (
                                  <span className="material-symbols-outlined !text-[18px] text-primary shrink-0 mt-px">redeem</span>
                                ) : (
                                  <span className="material-symbols-outlined !text-[18px] text-outline shrink-0 mt-px">inventory_2</span>
                                )}
                                <div className="min-w-0">
                                  {linea.nombreCombo && (
                                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">
                                      {linea.nombreCombo}
                                    </p>
                                  )}
                                  <p className="text-sm font-medium text-on-surface leading-snug">
                                    {linea.nombreProducto}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs text-outline mt-0.5 ml-7">
                                {linea.cantidad} × {fmtMoneda(linea.precioUnitario)}
                                {linea.descuento > 0 && (
                                  <span className="text-error"> · desc. −{fmtMoneda(linea.descuento)}</span>
                                )}
                              </p>
                            </div>
                            <span className="font-mono font-semibold text-on-surface shrink-0">
                              {fmtMoneda(linea.total)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totales */}
                  <div className="rounded-xl bg-surface-container-low/40 border border-outline/15 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Subtotal</span>
                      <span className="font-mono text-on-surface">{fmtMoneda(detalle.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Descuento general</span>
                      <span className={`font-mono ${detalle.descuentoGeneral > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
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
                    <div className="flex justify-between items-center pt-2.5 mt-0.5 border-t border-outline/10">
                      <span className="font-semibold text-on-surface">Total a cobrar</span>
                      <span className="font-mono font-bold text-lg text-primary">
                        {fmtMoneda(detalle.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pie de acciones */}
                {(detalle.estado === 'abierto' || detalle.estado === 'vencido') && (
                  <div className="px-6 py-4 border-t border-outline/10 bg-surface-container-low/50 flex justify-end">
                    <Button
                      onClick={() => {
                        setDetalleAbierto(false);
                        vender({ ...detalle, descuento: 0 } as ResumenPresupuesto);
                      }}
                      className="min-h-[48px]"
                    >
                      <span className="material-symbols-outlined !text-lg mr-1.5">point_of_sale</span>
                      Cargar al ticket y vender
                    </Button>
                  </div>
                )}
                {detalle.estado === 'cancelado' && puedeGestionar && (
                  <div className="px-6 py-4 border-t border-outline/10 bg-surface-container-low/50 flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDescancelarObjetivo({ ...detalle, descuento: 0 } as ResumenPresupuesto)
                      }
                      className="min-h-[48px]"
                    >
                            <Power className="w-4 h-4 mr-1.5 text-success" />
                      Reactivar
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-10 text-center text-on-surface-variant">Sin información.</div>
            )}
          </div>
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

      <ConfirmDialog
        isOpen={!!descancelarObjetivo}
        onClose={() => setDescancelarObjetivo(null)}
        onConfirm={confirmarDescancelar}
        title="Reactivar presupuesto"
        description={
          descancelarObjetivo
            ? `¿Reactivar el presupuesto ${descancelarObjetivo.folio}? Volverá a estar abierto`
            : ''
        }
        confirmText="Reactivar"
        variant="info"
        isLoading={descancelando}
      />
    </div>
  );
}
