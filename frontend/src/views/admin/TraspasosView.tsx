import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Clock,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { BuscadorEstandar } from '../../components/ui/BuscadorEstandar';
import { NuevoTraspasoModal } from '../../components/admin/NuevoTraspasoModal';
import { RecibirTraspasoModal } from '../../components/admin/RecibirTraspasoModal';
import { toast } from 'sonner';

interface Sucursal {
  id: string;
  nombre: string;
}

interface TraspasoDetalle {
  id: string;
  productoId: string;
  nombreProducto: string;
  unidadMedida: string;
  cantidadEnviada: number;
  cantidadRecibida: number;
}

interface Traspaso {
  id: string;
  folio: string;
  estado: 'BORRADOR' | 'EN_TRANSITO' | 'RECIBIDO' | 'RECIBIDO_PARCIAL' | 'CANCELADO';
  sucursalOrigen: Sucursal;
  sucursalDestino: Sucursal;
  creadoPor: { nombre: string };
  recibidoPor?: { nombre: string } | null;
  notasEmision?: string | null;
  notasRecepcion?: string | null;
  fechaSalida?: string | null;
  fechaRecepcion?: string | null;
  creadoEn: string;
  detalles: TraspasoDetalle[];
}

export const TraspasosView: React.FC = () => {
  const [traspasos, setTraspasos] = useState<Traspaso[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [q, setQ] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('');
  const [sucursalOrigenFiltro, setSucursalOrigenFiltro] = useState<string>('');

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [isNuevoModalOpen, setIsNuevoModalOpen] = useState(false);
  const [traspasoARecibir, setTraspasoARecibir] = useState<Traspaso | null>(null);
  const [traspasoDetalleVer, setTraspasoDetalleVer] = useState<Traspaso | null>(null);

  const fetchSucursales = async () => {
    try {
      const res = await api.get('/companies/my/sucursales');
      setSucursales(Array.isArray(res.data) ? res.data : []);
    } catch {
      // error
    }
  };

  const fetchTraspasos = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (q) params.q = q;
      if (estadoFiltro) params.estado = estadoFiltro;
      if (sucursalOrigenFiltro) params.sucursalOrigenId = sucursalOrigenFiltro;

      const res = await api.get('/traspasos', { params });
      const data = res.data?.data || [];
      const meta = res.data?.meta || { totalPages: 1 };

      setTraspasos(data);
      setTotalPages(meta.totalPages || 1);
    } catch (err) {
      console.error('Error al cargar traspasos:', err);
      toast.error('Error al cargar lista de traspasos.');
    } finally {
      setLoading(false);
    }
  }, [page, q, estadoFiltro, sucursalOrigenFiltro]);

  useEffect(() => {
    fetchSucursales();
  }, []);

  useEffect(() => {
    fetchTraspasos();
  }, [fetchTraspasos]);

  const getEstadoBadge = (estado: Traspaso['estado']) => {
    switch (estado) {
      case 'EN_TRANSITO':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-label-sm font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5 w-fit">
            <Truck className="w-3.5 h-3.5" /> En Tránsito
          </span>
        );
      case 'RECIBIDO':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-label-sm font-bold bg-success/10 text-success border border-success/20 flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" /> Recibido
          </span>
        );
      case 'RECIBIDO_PARCIAL':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-label-sm font-bold bg-warning/10 text-warning border border-warning/20 flex items-center gap-1.5 w-fit">
            <AlertTriangle className="w-3.5 h-3.5" /> Recibido Parcial
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-label-sm font-bold bg-outline/10 text-on-surface-variant border border-outline/20 flex items-center gap-1.5 w-fit">
            <Clock className="w-3.5 h-3.5" /> {estado}
          </span>
        );
    }
  };

  const enTransitoCount = traspasos.filter((t) => t.estado === 'EN_TRANSITO').length;
  const recibidosCount = traspasos.filter((t) => t.estado === 'RECIBIDO' || t.estado === 'RECIBIDO_PARCIAL').length;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Encabezado y Acción */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md font-bold text-2xl text-on-surface flex items-center gap-3">
            <ArrowRightLeft className="w-7 h-7 text-primary" />
            <span>Traspasos de Inventario entre Sucursales</span>
          </h1>
          <p className="font-body-md text-sm text-on-surface-variant">
            Control integral de envíos y recepción de productos en tránsito entre almacenes
          </p>
        </div>

        <button
          onClick={() => setIsNuevoModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-primary text-on-primary font-label-sm text-sm font-bold shadow-lg hover:opacity-90 transition-all flex items-center gap-2.5 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Traspaso</span>
        </button>
      </div>

      {/* Tarjetas Bento de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-surface border border-outline/20 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-primary/10 text-primary">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label-sm text-xs font-semibold text-on-surface-variant uppercase">
              En Tránsito
            </p>
            <p className="font-mono font-bold text-2xl text-on-surface">{enTransitoCount}</p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-outline/20 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label-sm text-xs font-semibold text-on-surface-variant uppercase">
              Recibidos
            </p>
            <p className="font-mono font-bold text-2xl text-on-surface">{recibidosCount}</p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-outline/20 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-500">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label-sm text-xs font-semibold text-on-surface-variant uppercase">
              Sucursales Activas
            </p>
            <p className="font-mono font-bold text-2xl text-on-surface">{sucursales.length}</p>
          </div>
        </div>
      </div>

      {/* Buscador Estandarizado */}
      <BuscadorEstandar
        busqueda={q}
        onBusquedaChange={setQ}
        placeholder="Buscar por folio de traspaso, notas u origen..."
        filtrosExtra={
          <div className="flex items-center gap-3">
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface border border-outline/20 text-xs font-body-md text-on-surface focus:outline-none"
            >
              <option value="">Todos los Estados</option>
              <option value="EN_TRANSITO">En Tránsito</option>
              <option value="RECIBIDO">Recibido</option>
              <option value="RECIBIDO_PARCIAL">Recibido Parcial</option>
            </select>

            <select
              value={sucursalOrigenFiltro}
              onChange={(e) => setSucursalOrigenFiltro(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface border border-outline/20 text-xs font-body-md text-on-surface focus:outline-none"
            >
              <option value="">Todas las Sucursales Origen</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        }
        onLimpiar={() => {
          setQ('');
          setEstadoFiltro('');
          setSucursalOrigenFiltro('');
        }}
        onRefresh={fetchTraspasos}
      />

      {/* Tabla Principal */}
      <div className="bg-surface rounded-3xl border border-outline/20 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-on-surface-variant font-label-sm text-xs uppercase border-b border-outline/10">
                <th className="p-4">Folio</th>
                <th className="p-4">Sucursal Origen</th>
                <th className="p-4">Sucursal Destino</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Emitido Por</th>
                <th className="p-4">Fecha</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/10 text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-on-surface-variant font-body-md">
                    Cargando traspasos...
                  </td>
                </tr>
              ) : traspasos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-on-surface-variant font-body-md">
                    No se encontraron traspasos registrados.
                  </td>
                </tr>
              ) : (
                traspasos.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-primary">{t.folio}</td>
                    <td className="p-4 font-semibold">{t.sucursalOrigen?.nombre}</td>
                    <td className="p-4 font-semibold">{t.sucursalDestino?.nombre}</td>
                    <td className="p-4">{getEstadoBadge(t.estado)}</td>
                    <td className="p-4 text-xs font-body-md text-on-surface-variant">
                      {t.creadoPor?.nombre}
                    </td>
                    <td className="p-4 font-mono text-xs text-on-surface-variant">
                      {new Date(t.creadoEn).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setTraspasoDetalleVer(t)}
                          className="p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {t.estado === 'EN_TRANSITO' && (
                          <button
                            onClick={() => setTraspasoARecibir(t)}
                            className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-label-sm font-bold transition-colors flex items-center gap-1"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>Recibir</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      <NuevoTraspasoModal
        isOpen={isNuevoModalOpen}
        onClose={() => setIsNuevoModalOpen(false)}
        onSuccess={fetchTraspasos}
      />

      <RecibirTraspasoModal
        isOpen={!!traspasoARecibir}
        onClose={() => setTraspasoARecibir(null)}
        traspaso={traspasoARecibir}
        onSuccess={fetchTraspasos}
      />

      {/* Modal de Detalle */}
      {traspasoDetalleVer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-surface border border-outline/20 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface/50">
              <div>
                <h3 className="font-headline-md font-bold text-on-surface text-lg">
                  Detalle del Traspaso — {traspasoDetalleVer.folio}
                </h3>
                <p className="font-body-md text-xs text-on-surface-variant">
                  {traspasoDetalleVer.sucursalOrigen?.nombre} ➔ {traspasoDetalleVer.sucursalDestino?.nombre}
                </p>
              </div>
              <button
                onClick={() => setTraspasoDetalleVer(null)}
                className="p-2 rounded-xl text-on-surface-variant hover:bg-outline/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>{getEstadoBadge(traspasoDetalleVer.estado)}</div>
                <p className="font-mono text-xs text-on-surface-variant">
                  Fecha: {new Date(traspasoDetalleVer.creadoEn).toLocaleString()}
                </p>
              </div>

              {traspasoDetalleVer.notasEmision && (
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline/10 text-xs text-on-surface">
                  <span className="font-bold block text-on-surface-variant mb-1">Notas de Emisión:</span>
                  {traspasoDetalleVer.notasEmision}
                </div>
              )}

              {traspasoDetalleVer.notasRecepcion && (
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline/10 text-xs text-on-surface">
                  <span className="font-bold block text-on-surface-variant mb-1">Notas de Recepción:</span>
                  {traspasoDetalleVer.notasRecepcion}
                </div>
              )}

              <div className="rounded-2xl border border-outline/20 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-high text-on-surface-variant font-label-sm uppercase">
                    <tr>
                      <th className="p-3">Producto</th>
                      <th className="p-3 text-center">Enviado</th>
                      <th className="p-3 text-center">Recibido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/10 text-on-surface font-body-md">
                    {traspasoDetalleVer.detalles.map((d) => (
                      <tr key={d.id}>
                        <td className="p-3 font-semibold text-primary">{d.nombreProducto}</td>
                        <td className="p-3 text-center font-mono font-bold">{d.cantidadEnviada}</td>
                        <td className="p-3 text-center font-mono font-bold text-success">{d.cantidadRecibida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-outline/10 bg-surface/50 text-right">
              <button
                onClick={() => setTraspasoDetalleVer(null)}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
