import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { usePaginacion, type PaginacionMeta } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { BuscadorEstandar } from '@/components/ui/BuscadorEstandar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Printer,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Loader2,
  FileText,
  Boxes,
} from 'lucide-react';
import type { SolicitudProveedor, EstadoSolicitudProveedor } from '@/types/solicitudProveedor';
import { NuevaSolicitudProveedorModal } from '@/components/admin/NuevaSolicitudProveedorModal';
import { SolicitudProveedorPrintModal } from '@/components/admin/SolicitudProveedorPrintModal';

interface ProveedorOption {
  id: string;
  nombre: string;
}

export default function SolicitudesProveedorView() {
  const { user } = useAuthStore();
  const [solicitudes, setSolicitudes] = useState<SolicitudProveedor[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorOption[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  // Modales
  const [modalNueva, setModalNueva] = useState(false);
  const [solicitudAEditar, setSolicitudAEditar] = useState<SolicitudProveedor | null>(null);
  const [solicitudAImprimir, setSolicitudAImprimir] = useState<SolicitudProveedor | null>(null);

  // Diálogo de confirmación para eliminar
  const [idAEliminar, setIdAEliminar] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Configuración de empresa (Nombre y Logo) para la impresión
  const [nombreEmpresa, setNombreEmpresa] = useState('CUDII POS');
  const [logoEmpresa, setLogoEmpresa] = useState<string | undefined>();

  // Paginación
  const { page, limit, setMeta, paramsPaginacion } = usePaginacion();
  const [metaInfo, setMetaInfo] = useState<PaginacionMeta | null>(null);

  // Cargar configuración de la empresa para logo
  useEffect(() => {
    api
      .get('/company-settings')
      .then((res) => {
        setNombreEmpresa(res.data.nombre || 'CUDII POS');
        const configTicket = res.data.configuracionTicket;
        if (configTicket?.venta?.logoUrl) {
          setLogoEmpresa(configTicket.venta.logoUrl);
        }
      })
      .catch(() => {});
  }, []);

  // Cargar lista de proveedores para el filtro
  useEffect(() => {
    api
      .get<{ data?: ProveedorOption[] } | ProveedorOption[]>('/suppliers')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        setProveedores(list);
      })
      .catch(() => {});
  }, []);

  // Cargar solicitudes con filtros y paginación
  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.get<{ data: SolicitudProveedor[]; meta: PaginacionMeta }>(
        '/solicitudes-proveedor',
        {
          params: {
            ...paramsPaginacion,
            q: busqueda.trim() || undefined,
            proveedorId: filtroProveedor || undefined,
            estado: filtroEstado || undefined,
          },
        },
      );
      setSolicitudes(res.data.data || []);
      setMetaInfo(res.data.meta);
      setMeta(res.data.meta);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al cargar las solicitudes a proveedores.');
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, [paramsPaginacion, busqueda, filtroProveedor, filtroEstado, setMeta]);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const handleLimpiarFiltros = () => {
    setBusqueda('');
    setFiltroProveedor('');
    setFiltroEstado('');
  };

  const handleCambiarEstado = async (id: string, nuevoEstado: EstadoSolicitudProveedor) => {
    try {
      await api.patch(`/solicitudes-proveedor/${id}`, { estado: nuevoEstado });
      toast.success(`Estado de la solicitud actualizado a "${nuevoEstado}".`);
      cargarSolicitudes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al cambiar el estado de la solicitud.');
    }
  };

  const handleEliminar = async () => {
    if (!idAEliminar) return;
    setIsDeleting(true);
    try {
      await api.delete(`/solicitudes-proveedor/${idAEliminar}`);
      toast.success('Solicitud eliminada correctamente.');
      setIdAEliminar(null);
      cargarSolicitudes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al eliminar la solicitud.');
    } finally {
      setIsDeleting(false);
    }
  };

  const fmtMoneda = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);

  const getBadgeEstado = (st: EstadoSolicitudProveedor) => {
    switch (st) {
      case 'BORRADOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-variant text-on-surface-variant text-xs font-semibold font-label-sm border border-outline/20">
            <Clock className="w-3.5 h-3.5 text-outline" />
            Borrador
          </span>
        );
      case 'ENVIADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold font-label-sm border border-primary/30">
            <Package className="w-3.5 h-3.5 text-primary" />
            Enviada
          </span>
        );
      case 'RECIBIDA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 text-success text-xs font-semibold font-label-sm border border-success/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            Recibida
          </span>
        );
      case 'CANCELADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/15 text-error text-xs font-semibold font-label-sm border border-error/30">
            <XCircle className="w-3.5 h-3.5 text-error" />
            Cancelada
          </span>
        );
      default:
        return null;
    }
  };

  // Contadores para las tarjetas Bento
  const countBorradores = solicitudes.filter((s) => s.estado === 'BORRADOR').length;
  const countEnviadas = solicitudes.filter((s) => s.estado === 'ENVIADA').length;
  const countRecibidas = solicitudes.filter((s) => s.estado === 'RECIBIDA').length;

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-outline/10 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm text-primary">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display-lg text-on-background">
              Solicitud de Productos a Proveedores
            </h1>
            <p className="text-on-surface-variant text-sm mt-0.5 font-body-md">
              Crea requisiciones de compra, emite órdenes de surtido e imprime o descarga comprobantes.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => {
            setSolicitudAEditar(null);
            setModalNueva(true);
          }}
          className="shadow-md font-bold text-xs sm:text-sm shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva Solicitud de Compra
        </Button>
      </div>

      {/* Tarjetas Bento de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-outline/15 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-outline font-label-sm">Total Solicitudes</div>
            <div className="text-lg font-bold text-on-surface font-mono">{metaInfo?.total || solicitudes.length}</div>
            <div className="text-[10px] text-outline truncate">Registradas en el sistema</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-outline/15 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0 text-warning">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-outline font-label-sm">En Borrador</div>
            <div className="text-lg font-bold text-on-surface font-mono">{countBorradores}</div>
            <div className="text-[10px] text-outline truncate">En proceso de edición</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-outline/15 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-primary">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-outline font-label-sm">Emitidas / Enviadas</div>
            <div className="text-lg font-bold text-on-surface font-mono">{countEnviadas}</div>
            <div className="text-[10px] text-outline truncate">Listas para impresión/surtido</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-outline/15 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0 text-success">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-outline font-label-sm">Surtidas / Recibidas</div>
            <div className="text-lg font-bold text-on-surface font-mono">{countRecibidas}</div>
            <div className="text-[10px] text-outline truncate">Ingresadas exitosamente</div>
          </div>
        </div>
      </div>

      {/* Buscador Estandarizado CUDII */}
      <BuscadorEstandar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholder="Buscar por folio (ej: SOL-000001), notas o proveedor..."
        onActualizar={cargarSolicitudes}
        cargando={cargando}
        onLimpiar={handleLimpiarFiltros}
        filtrosActivosCount={(filtroProveedor ? 1 : 0) + (filtroEstado ? 1 : 0)}
        filtrosAbiertosInicial={Boolean(filtroProveedor || filtroEstado)}
        filtrosRapidos={
          <div className="flex flex-wrap items-center gap-3 w-full">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant">Proveedor:</span>
              <select
                value={filtroProveedor}
                onChange={(e) => setFiltroProveedor(e.target.value)}
                className="h-9 px-3 bg-surface-container-low border border-outline/20 rounded-xl text-xs text-on-surface focus:outline-none"
              >
                <option value="">-- Todos los Proveedores --</option>
                <option value="sin_proveedor">Sin proveedor específico (Solicitudes Abiertas)</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant">Estado:</span>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="h-9 px-3 bg-surface-container-low border border-outline/20 rounded-xl text-xs text-on-surface focus:outline-none"
              >
                <option value="">-- Todos los Estados --</option>
                <option value="BORRADOR">Borrador</option>
                <option value="ENVIADA">Enviada</option>
                <option value="RECIBIDA">Recibida</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>
          </div>
        }
      />

      {/* Tabla de Solicitudes */}
      <div className="bg-surface border border-outline/10 rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-container-low/60 hover:bg-surface-container-low/60">
              <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider text-outline">Folio</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-outline">Proveedor</TableHead>
              <TableHead className="w-[100px] text-center font-bold text-xs uppercase tracking-wider text-outline">Artículos</TableHead>
              <TableHead className="w-[140px] text-right font-bold text-xs uppercase tracking-wider text-outline">Total Est.</TableHead>
              <TableHead className="w-[130px] text-center font-bold text-xs uppercase tracking-wider text-outline">Estado</TableHead>
              <TableHead className="w-[140px] font-bold text-xs uppercase tracking-wider text-outline">Fecha Emisión</TableHead>
              <TableHead className="w-[140px] text-right font-bold text-xs uppercase tracking-wider text-outline">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={7} className="h-36 text-center text-outline">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span>Cargando solicitudes de compra...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : solicitudes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-36 text-center text-outline">
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <Package className="w-8 h-8 text-outline/40" />
                    <p className="text-sm font-semibold text-on-surface-variant">No se encontraron solicitudes.</p>
                    <p className="text-xs text-outline">Intenta ajustar los filtros de búsqueda o crea una nueva solicitud.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              solicitudes.map((sol) => (
                <TableRow key={sol.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <TableCell className="font-mono font-bold text-sm text-primary">
                    {sol.folio}
                  </TableCell>
                  <TableCell className="font-semibold text-on-surface">
                    {sol.proveedor ? (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-primary shrink-0" />
                        {sol.proveedor.nombre}
                      </span>
                    ) : (
                      <span className="text-outline italic text-xs font-normal">
                        Solicitud Abierta (Sin proveedor)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold">
                    {sol.detalles?.length || 0}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-on-surface">
                    {fmtMoneda(sol.totalEstimado)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getBadgeEstado(sol.estado)}
                  </TableCell>
                  <TableCell className="text-xs text-on-surface-variant">
                    {new Date(sol.fechaEmision).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSolicitudAImprimir(sol)}
                        title="Ver / Imprimir Solicitud"
                        className="h-8 w-8 p-0"
                      >
                        <Printer className="w-4 h-4 text-primary" />
                      </Button>

                      {sol.estado === 'BORRADOR' && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSolicitudAEditar(sol);
                              setModalNueva(true);
                            }}
                            title="Editar Solicitud"
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="w-4 h-4 text-on-surface-variant" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCambiarEstado(sol.id, 'ENVIADA')}
                            title="Marcar como Enviada"
                            className="h-8 w-8 p-0 text-success"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIdAEliminar(sol.id)}
                            title="Eliminar Borrador"
                            className="h-8 w-8 p-0 text-error"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}

                      {sol.estado === 'ENVIADA' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCambiarEstado(sol.id, 'RECIBIDA')}
                          title="Marcar como Recibida"
                          className="h-8 py-1 px-2 text-xs font-semibold text-success hover:bg-success/10"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Recibida
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Paginación */}
        {metaInfo && metaInfo.totalPages > 1 && (
          <div className="p-4 border-t border-outline/10">
            <PaginacionControles meta={metaInfo} />
          </div>
        )}
      </div>

      {/* Modal Nueva / Editar Solicitud */}
      {modalNueva && (
        <NuevaSolicitudProveedorModal
          solicitudAEditar={solicitudAEditar}
          onClose={() => {
            setModalNueva(false);
            setSolicitudAEditar(null);
          }}
          onGuardado={() => {
            setModalNueva(false);
            setSolicitudAEditar(null);
            cargarSolicitudes();
          }}
        />
      )}

      {/* Modal Imprimir / Ver Solicitud */}
      {solicitudAImprimir && (
        <SolicitudProveedorPrintModal
          solicitud={solicitudAImprimir}
          nombreEmpresa={nombreEmpresa}
          logoEmpresaUrl={logoEmpresa}
          onClose={() => setSolicitudAImprimir(null)}
        />
      )}

      {/* Diálogo de confirmación para eliminar borrador */}
      <ConfirmDialog
        open={Boolean(idAEliminar)}
        title="Eliminar borrador de solicitud"
        description="¿Estás seguro de que deseas eliminar este borrador? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleEliminar}
        onCancel={() => setIdAEliminar(null)}
      />
    </div>
  );
}
