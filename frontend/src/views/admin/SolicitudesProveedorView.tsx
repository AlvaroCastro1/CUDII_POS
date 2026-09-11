import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';

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
  CheckCheck,
  ShoppingBag,
  RotateCcw,
  X,
} from 'lucide-react';
import type { SolicitudProveedor, EstadoSolicitudProveedor } from '@/types/solicitudProveedor';
import { NuevaSolicitudProveedorModal } from '@/components/admin/NuevaSolicitudProveedorModal';
import { SolicitudProveedorPrintModal } from '@/components/admin/SolicitudProveedorPrintModal';
import { RecibirSolicitudProveedorModal } from '@/components/admin/RecibirSolicitudProveedorModal';

interface ProveedorOption {
  id: string;
  nombre: string;
}

export default function SolicitudesProveedorView() {
  const [solicitudes, setSolicitudes] = useState<SolicitudProveedor[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorOption[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  // Modales
  const [modalNueva, setModalNueva] = useState(false);
  const [solicitudAEditar, setSolicitudAEditar] = useState<SolicitudProveedor | null>(null);
  const [solicitudAImprimir, setSolicitudAImprimir] = useState<SolicitudProveedor | null>(null);
  const [solicitudARecibir, setSolicitudARecibir] = useState<SolicitudProveedor | null>(null);

  // Confirmación de envío (advierte que ya no se podrá editar)
  const [solicitudAEnviar, setSolicitudAEnviar] = useState<SolicitudProveedor | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Confirmación de reactivación (soft delete revert)
  const [solicitudAReactivar, setSolicitudAReactivar] = useState<SolicitudProveedor | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  // Rechazo de solicitud con justificación/comentario
  const [solicitudARechazar, setSolicitudARechazar] = useState<SolicitudProveedor | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Diálogo de confirmación para desactivar (soft delete)
  const [idAEliminar, setIdAEliminar] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Configuración de empresa (Nombre y Logo) para la impresión
  const [nombreEmpresa, setNombreEmpresa] = useState('CUDII POS');
  const [logoEmpresa, setLogoEmpresa] = useState<string | undefined>();

  // Paginación
  const { page, limit, setMeta, irAPagina } = usePaginacion();
  const [metaInfo, setMetaInfo] = useState<PaginacionMeta | null>(null);

  // Cargar configuración de la empresa para logo
  useEffect(() => {
    api
      .get('/company-settings')
      .then((res) => {
        setNombreEmpresa(res.data.nombre || 'CUDII POS');
        const configTicket = res.data.configuracionTicket;
        const logo =
          configTicket?.venta?.logoUrl ||
          configTicket?.presupuesto?.logoUrl ||
          res.data.logoUrl ||
          res.data.logo;
        if (logo) {
          setLogoEmpresa(logo);
        }
      })
      .catch(() => {
        // Fallback a /company-settings/ticket si el rol no tiene acceso a /company-settings
        api
          .get('/company-settings/ticket')
          .then((res) => {
            const config = res.data;
            const logo = config?.venta?.logoUrl || config?.presupuesto?.logoUrl;
            if (logo) {
              setLogoEmpresa(logo);
            }
          })
          .catch(() => { });
      });
  }, []);

  // Cargar lista de proveedores para el filtro
  useEffect(() => {
    api
      .get<{ data?: ProveedorOption[] } | ProveedorOption[]>('/suppliers')
      .then((res) => {
        const list = Array.isArray(res.data)
          ? res.data
          : (res.data as { data?: ProveedorOption[] })?.data || [];
        setProveedores(list);
      })
      .catch(() => { });
  }, []);

  // Cargar solicitudes con filtros y paginación
  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.get<{ data: SolicitudProveedor[]; meta: PaginacionMeta }>(
        '/solicitudes-proveedor',
        {
          params: {
            page,
            limit,
            q: busqueda.trim() || undefined,
            proveedorId: filtroProveedor || undefined,
            estado: filtroEstado || undefined,
            incluirInactivos: mostrarInactivos ? true : undefined,
          },
        },
      );
      setSolicitudes(res.data.data || []);
      setMetaInfo(res.data.meta);
      setMeta(res.data.meta);
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Error al cargar las solicitudes a proveedores.'));
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, [page, limit, busqueda, filtroProveedor, filtroEstado, mostrarInactivos, setMeta]);

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
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Error al cambiar el estado de la solicitud.'));
    }
  };

  const handleConfirmarEnviar = async () => {
    if (!solicitudAEnviar) return;
    setIsSending(true);
    try {
      await api.patch(`/solicitudes-proveedor/${solicitudAEnviar.id}`, { estado: 'ENVIADA' });
      toast.success(`Solicitud ${solicitudAEnviar.folio} marcada como enviada.`);
      setSolicitudAEnviar(null);
      cargarSolicitudes();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Error al enviar la solicitud.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleReactivar = async () => {
    if (!solicitudAReactivar) return;
    setIsReactivating(true);
    try {
      await api.patch(`/solicitudes-proveedor/${solicitudAReactivar.id}/reactivar`);
      toast.success(`Solicitud ${solicitudAReactivar.folio} reactivada correctamente.`);
      setSolicitudAReactivar(null);
      cargarSolicitudes();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Error al reactivar la solicitud.'));
    } finally {
      setIsReactivating(false);
    }
  };

  const handleConfirmarRechazo = async () => {
    if (!solicitudARechazar) return;
    if (!motivoRechazo.trim()) {
      toast.error('Debe ingresar el motivo del rechazo.');
      return;
    }
    setIsRejecting(true);
    try {
      await api.patch(`/solicitudes-proveedor/${solicitudARechazar.id}`, {
        estado: 'RECHAZADA',
        motivoRechazo: motivoRechazo.trim(),
      });
      toast.success(`Solicitud ${solicitudARechazar.folio} ha sido rechazada.`);
      setSolicitudARechazar(null);
      setMotivoRechazo('');
      cargarSolicitudes();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Error al rechazar la solicitud.'));
    } finally {
      setIsRejecting(false);
    }
  };

  const handleEliminar = async () => {
    if (!idAEliminar) return;
    setIsDeleting(true);
    try {
      await api.delete(`/solicitudes-proveedor/${idAEliminar}`);
      toast.success('Solicitud desactivada (eliminación lógica) correctamente.');
      setIdAEliminar(null);
      cargarSolicitudes();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Error al eliminar la solicitud.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const fmtMoneda = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);

  const getBadgeEstado = (st: EstadoSolicitudProveedor, estaActivo: boolean = true) => {
    if (!estaActivo) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 text-error text-xs font-semibold font-label-sm border border-error/20">
          <Trash2 className="w-3.5 h-3.5 text-error" />
          Desactivada
        </span>
      );
    }

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
      case 'APROBADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold font-label-sm border border-emerald-500/30">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Aprobada
          </span>
        );
      case 'RECHAZADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-semibold font-label-sm border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Rechazada
          </span>
        );
      case 'RECIBIDA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 text-success text-xs font-semibold font-label-sm border border-success/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            Recibida / Compra
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
  const countAprobadas = solicitudes.filter((s) => s.estado === 'APROBADA').length;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
            <div className="text-[10px] text-outline truncate">Listas para visto bueno/surtido</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-outline/15 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
            <CheckCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-outline font-label-sm">Aprobadas</div>
            <div className="text-lg font-bold text-on-surface font-mono">{countAprobadas}</div>
            <div className="text-[10px] text-outline truncate">Autorizadas para compra</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-outline/15 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0 text-success">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-outline font-label-sm">Surtidas / Recibidas</div>
            <div className="text-lg font-bold text-on-surface font-mono">{countRecibidas}</div>
            <div className="text-[10px] text-outline truncate">Convertidas en compra</div>
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
        switchInactivos={{
          checked: mostrarInactivos,
          onCheckedChange: setMostrarInactivos,
          label: 'Mostrar desactivadas',
        }}
        filtrosActivosCount={(filtroProveedor ? 1 : 0) + (filtroEstado ? 1 : 0) + (mostrarInactivos ? 1 : 0)}
        filtrosAbiertosInicial={Boolean(filtroProveedor || filtroEstado || mostrarInactivos)}
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
                <option value="APROBADA">Aprobada</option>
                <option value="RECHAZADA">Rechazada</option>
                <option value="RECIBIDA">Recibida / Compra</option>
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
              <TableHead className="w-[140px] text-center font-bold text-xs uppercase tracking-wider text-outline">Estado</TableHead>
              <TableHead className="w-[130px] font-bold text-xs uppercase tracking-wider text-outline">Fecha Emisión</TableHead>
              <TableHead className="w-[220px] text-right font-bold text-xs uppercase tracking-wider text-outline">Acciones</TableHead>
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
                <TableRow
                  key={sol.id}
                  className={`hover:bg-surface-container-low/50 transition-colors ${sol.estaActivo === false ? 'opacity-60 bg-error/5' : ''
                    }`}
                >
                  <TableCell className="font-mono font-bold text-sm text-primary">
                    <div className="flex flex-col">
                      <span>{sol.folio}</span>
                      {sol.estaActivo === false && (
                        <span className="text-[10px] text-error font-semibold uppercase tracking-wider">
                          Eliminada
                        </span>
                      )}
                    </div>
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
                    {getBadgeEstado(sol.estado, sol.estaActivo)}
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

                      {sol.estado === 'BORRADOR' && sol.estaActivo !== false && (
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
                            onClick={() => setSolicitudAEnviar(sol)}
                            title="Marcar como Enviada"
                            className="h-8 w-8 p-0 text-success hover:bg-success/10"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIdAEliminar(sol.id)}
                            title="Desactivar Borrador (Soft Delete)"
                            className="h-8 w-8 p-0 text-error hover:bg-error/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}

                      {sol.estado === 'ENVIADA' && sol.estaActivo !== false && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCambiarEstado(sol.id, 'APROBADA')}
                            title="Aprobar Solicitud"
                            className="h-8 py-1 px-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                          >
                            <CheckCheck className="w-3.5 h-3.5 mr-1" />
                            Aprobar
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSolicitudARechazar(sol);
                              setMotivoRechazo('');
                            }}
                            title="Rechazar Solicitud"
                            className="h-8 py-1 px-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 rounded-lg"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Rechazar
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSolicitudARecibir(sol)}
                            title="Convertir Solicitud a Compra (Recepción)"
                            className="h-8 py-1 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 border border-primary/30 rounded-lg shadow-2xs"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 mr-1 text-primary" />
                            Convertir a Compra
                          </Button>
                        </>
                      )}

                      {sol.estado === 'APROBADA' && sol.estaActivo !== false && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSolicitudARecibir(sol)}
                            title="Convertir Solicitud Aprobada a Compra"
                            className="h-8 py-1 px-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 rounded-lg shadow-2xs"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 mr-1" />
                            Convertir a Compra
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSolicitudARechazar(sol);
                              setMotivoRechazo('');
                            }}
                            title="Rechazar Solicitud"
                            className="h-8 py-1 px-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 rounded-lg"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Rechazar
                          </Button>
                        </>
                      )}

                      {sol.estaActivo === false && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSolicitudAReactivar(sol)}
                          title="Reactivar Solicitud"
                          className="h-8 py-1 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 border border-primary/30 rounded-lg shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Reactivar
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
            <PaginacionControles meta={metaInfo} onPageChange={irAPagina} />
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

      {/* Modal Convertir Solicitud a Compra (Recepción de Mercancía) */}
      {solicitudARecibir && (
        <RecibirSolicitudProveedorModal
          isOpen={Boolean(solicitudARecibir)}
          solicitud={solicitudARecibir}
          onClose={() => setSolicitudARecibir(null)}
          onSuccess={() => {
            setSolicitudARecibir(null);
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
          onConvertirCompra={(sol) => {
            setSolicitudARecibir(sol);
          }}
          onClose={() => setSolicitudAImprimir(null)}
        />
      )}

      {/* Diálogo de advertencia antes de marcar como enviada */}
      <ConfirmDialog
        isOpen={Boolean(solicitudAEnviar)}
        title="Enviar Solicitud a Proveedor"
        description={`¿Estás seguro de marcar la solicitud "${solicitudAEnviar?.folio}" como Enviada? Ten en cuenta que una vez enviada a tu proveedor, no podrás modificar sus artículos, cantidades ni precios.`}
        confirmText="Confirmar y Enviar"
        cancelText="Cancelar"
        variant="info"
        isLoading={isSending}
        onConfirm={handleConfirmarEnviar}
        onClose={() => setSolicitudAEnviar(null)}
      />

      {/* Diálogo de confirmación para reactivar solicitud */}
      <ConfirmDialog
        isOpen={Boolean(solicitudAReactivar)}
        title="Reactivar Solicitud de Compra"
        description={`¿Deseas reactivar la solicitud "${solicitudAReactivar?.folio}"? Volverá a estar activa en el sistema con su estado original.`}
        confirmText="Reactivar"
        cancelText="Cancelar"
        variant="info"
        isLoading={isReactivating}
        onConfirm={handleReactivar}
        onClose={() => setSolicitudAReactivar(null)}
      />

      {/* Modal para ingresar comentario/motivo al rechazar solicitud */}
      {solicitudARechazar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-surface-container-high border border-outline/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-error/10 text-error flex items-center justify-center font-bold">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Rechazar Solicitud</h3>
                  <p className="text-xs text-on-surface-variant">Folio: {solicitudARechazar.folio}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSolicitudARechazar(null);
                  setMotivoRechazo('');
                }}
                disabled={isRejecting}
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-on-surface-variant">
              Por favor, ingresa el motivo o comentario por el cual se rechaza esta solicitud de compra. Este comentario quedará registrado en las notas y auditoría de la solicitud.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">
                Motivo / Comentario del rechazo <span className="text-error">*</span>
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Ej. Precios cotizados fuera de presupuesto, proveedor sin existencias, etc."
                rows={4}
                className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline/20 rounded-2xl text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-error/40 resize-none"
                disabled={isRejecting}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-outline/10">
              <button
                type="button"
                onClick={() => {
                  setSolicitudARechazar(null);
                  setMotivoRechazo('');
                }}
                disabled={isRejecting}
                className="px-4 py-2.5 rounded-xl border border-outline/20 text-on-surface hover:bg-surface-container font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRechazo}
                disabled={isRejecting || !motivoRechazo.trim()}
                className="px-5 py-2.5 rounded-xl bg-error hover:bg-error/90 text-white font-medium text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRejecting ? 'Rechazando...' : 'Rechazar Solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de confirmación para soft delete de borrador */}
      <ConfirmDialog
        isOpen={Boolean(idAEliminar)}
        title="Desactivar Borrador de Solicitud"
        description="¿Estás seguro de que deseas desactivar este borrador?"
        confirmText="Desactivar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleEliminar}
        onClose={() => setIdAEliminar(null)}
      />
    </div>
  );
}

