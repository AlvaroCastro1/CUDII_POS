import React, { useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePaginacion, type PaginacionMeta } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { BuscadorEstandar } from '@/components/ui/BuscadorEstandar';
import { toast } from 'sonner';
import {
  Loader2,
  X,
  Coins,
  CreditCard,
  Wallet,
  Receipt,
  Eye,
  Pencil,
  PowerOff,
  Power,
} from 'lucide-react';

/** Nivel de lealtad tal como lo devuelve el backend (D10) */
interface NivelLealtadInfo {
  id: string;
  nombre: string;
  colorHex: string | null;
  descuentoPct: number;
}

interface Cliente {
  id: string;
  nombre: string;
  apellidoPaterno?: string | null;
  email?: string | null;
  telefono?: string | null;
  rfc?: string | null;
  creadoEn?: string;
  estaActivo: boolean;
  puntosActuales: number;
  puntosHistoricos: number;
  nivelLealtad?: NivelLealtadInfo | null;
  cuentaCredito?: {
    limiteCredito: number;
    saldoPendiente: number;
    estaActivo: boolean;
  } | null;
}

interface VentaResumen {
  id: string;
  folio: string;
  total: number;
  estado: string;
  creadoEn: string;
}

interface DetalleCliente extends Cliente {
  /** Total de ventas del cliente (para paginar "Últimas compras") */
  _count?: { ventas: number };
  ventas?: VentaResumen[];
}

/** D11: Movimiento del ledger de puntos (ganado / canjeado / expirado / ajuste) */
interface MovimientoPuntosInfo {
  id: string;
  tipo: 'GANADO' | 'CANJEADO' | 'EXPIRADO' | 'AJUSTE';
  puntos: number;
  expiraEn: string | null;
  puntosConsumidos: number;
  creadoEn: string;
  ventaId: string | null;
}

/** Configuración del programa de lealtad leída de /company-settings/lealtad */
interface ProgramaConfig {
  habilitado: boolean;
  permitirCanje: boolean;
  puntosPorPesos: number;
}

const initialForm = {
  nombre: '',
  apellidoPaterno: '',
  email: '',
  telefono: '',
  rfc: '',
};

export default function ClientesView() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  /** false = solo activos · true = incluye inactivos (soft delete) */
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [filtroCredito, setFiltroCredito] = useState<string>('todos');
  const [ordenClientes, setOrdenClientes] = useState<string>('nombre');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  /** Cliente en modo edición (null = modal en modo creación) */
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);

  // D10: Configuración del programa de lealtad (para mostrar u ocultar columnas)
  const [programa, setPrograma] = useState<ProgramaConfig | null>(null);

  // D10: Detalle del cliente seleccionado
  const [detalle, setDetalle] = useState<DetalleCliente | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  /** Paginación de "Últimas compras" dentro del detalle */
  const [ventasPage, setVentasPage] = useState(1);
  const [ventasMeta, setVentasMeta] = useState<PaginacionMeta | null>(null);
  const VENTAS_POR_PAGINA = 5;

  // D11: Historial de movimientos de puntos del cliente en detalle
  const [movimientosPuntos, setMovimientosPuntos] = useState<
    MovimientoPuntosInfo[] | null
  >(null);

  // D10: Formularios de Crédito y abonos dentro del detalle
  const [creditoForm, setCreditoForm] = useState({
    limiteCredito: 2000,
    diasMaximoVencimiento: 30,
  });
  const [abonoForm, setAbonoForm] = useState({
    monto: 0,
    metodoPago: 'efectivo',
  });
  const [procesandoCredito, setProcesandoCredito] = useState(false);
  const [procesandoAbono, setProcesandoAbono] = useState(false);

  const { page, limit, meta, setMeta, irAPagina, reiniciar } =
    usePaginacion(20);

  /** Carga la configuración del programa de lealtad (accesible a todos los roles) */
  useEffect(() => {
    const cargarPrograma = async () => {
      try {
        const res = await api.get<ProgramaConfig>('/company-settings/lealtad');
        setPrograma(res.data);
      } catch {
        // Si falla, se asume deshabilitado y se ocultan las columnas de lealtad
        setPrograma({ habilitado: false, permitirCanje: false, puntosPorPesos: 100 });
      }
    };
    cargarPrograma();
  }, []);

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&incluirInactivos=${mostrarInactivos}`,
      );
      setClientes(
        Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [],
      );
      if (res.data?.meta) setMeta(res.data.meta);
    } catch (err: unknown) {
      console.error('Error al cargar clientes:', err);
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message;
        toast.error(
          Array.isArray(msg) ? msg[0] : msg || 'Error al cargar clientes',
        );
      } else {
        toast.error('Error al cargar clientes');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, mostrarInactivos, setMeta]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setFormData(initialForm);
    setClienteEditando(null);
  };

  /** Abre el modal en modo edición con los datos del cliente precargados */
  const abrirEdicion = (c: Cliente) => {
    setClienteEditando(c);
    setFormData({
      nombre: c.nombre,
      apellidoPaterno: c.apellidoPaterno ?? '',
      email: c.email ?? '',
      telefono: c.telefono ?? '',
      rfc: c.rfc ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (clienteEditando) {
        await api.patch(`/customers/${clienteEditando.id}`, formData);
        toast.success('Cliente actualizado exitosamente');
      } else {
        await api.post('/customers', formData);
        toast.success('Cliente creado exitosamente');
      }
      handleCerrarModal();
      fetchClientes();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || 'Error al guardar el cliente',
        );
      } else {
        toast.error('Error al guardar el cliente');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const [clienteADesactivar, setClienteADesactivar] = useState<Cliente | null>(null);
  const [isDesactivando, setIsDesactivando] = useState(false);

  /** Soft delete: abre modal para confirmar desactivación del cliente */
  const handleDesactivar = (c: Cliente) => {
    setClienteADesactivar(c);
  };

  const confirmDesactivarCliente = async () => {
    if (!clienteADesactivar) return;
    try {
      setIsDesactivando(true);
      await api.delete(`/customers/${clienteADesactivar.id}`);
      toast.success(`Cliente ${clienteADesactivar.nombre} desactivado`);
      setClienteADesactivar(null);
      fetchClientes();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || 'Error al desactivar el cliente',
        );
      } else {
        toast.error('Error al desactivar el cliente');
      }
    } finally {
      setIsDesactivando(false);
    }
  };

  /** Reactiva un cliente previamente desactivado */
  const handleReactivar = async (c: Cliente) => {
    try {
      await api.patch(`/customers/${c.id}`, { estaActivo: true });
      toast.success(`Cliente ${c.nombre} reactivado`);
      fetchClientes();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || 'Error al reactivar el cliente',
        );
      } else {
        toast.error('Error al reactivar el cliente');
      }
    }
  };

  /** Abre el panel de detalle con la información completa del cliente */
  const abrirDetalle = async (id: string, paginaVentas = 1) => {
    try {
      setLoadingDetalle(true);
      const res = await api.get<DetalleCliente>(
        `/customers/${id}?ventasPage=${paginaVentas}&ventasLimit=${VENTAS_POR_PAGINA}`,
      );
      setDetalle(res.data);
      setVentasPage(paginaVentas);
      const totalVentas = res.data._count?.ventas ?? 0;
      setVentasMeta({
        total: totalVentas,
        page: paginaVentas,
        limit: VENTAS_POR_PAGINA,
        totalPages: Math.max(1, Math.ceil(totalVentas / VENTAS_POR_PAGINA)),
        hasNextPage: paginaVentas * VENTAS_POR_PAGINA < totalVentas,
        hasPrevPage: paginaVentas > 1,
      });
      setCreditoForm({
        limiteCredito: res.data.cuentaCredito?.limiteCredito ?? 2000,
        diasMaximoVencimiento: 30,
      });
      setAbonoForm({ monto: 0, metodoPago: 'efectivo' });
      setMovimientosPuntos(null);
      // D11: historial de puntos (best-effort; no bloquea el detalle)
      try {
        const hist = await api.get<{
          movimientos: MovimientoPuntosInfo[];
        }>(`/customers/${id}/points-history`);
        setMovimientosPuntos(hist.data.movimientos ?? []);
      } catch {
        setMovimientosPuntos(null);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || 'No se pudo cargar el detalle',
        );
      } else {
        toast.error('No se pudo cargar el detalle');
      }
    } finally {
      setLoadingDetalle(false);
    }
  };

  /** Cambia la página de "Últimas compras" recargando el detalle */
  const cambiarPaginaVentas = (nueva: number) => {
    if (!detalle) return;
    abrirDetalle(detalle.id, nueva);
  };

  /** Abre (o reactiva) la cuenta de Crédito del cliente */
  const handleAbrirCredito = async () => {
    if (!detalle) return;
    try {
      setProcesandoCredito(true);
      await api.post(`/customers/${detalle.id}/credit-account`, creditoForm);
      toast.success('Cuenta de Crédito abierta correctamente');
      await abrirDetalle(detalle.id);
      fetchClientes();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || 'Error al abrir la cuenta de Crédito',
        );
      } else {
        toast.error('Error al abrir la cuenta de Crédito');
      }
    } finally {
      setProcesandoCredito(false);
    }
  };

  /** Registra un abono aplicado FIFO sobre las deudas pendientes */
  const handleRegistrarAbono = async () => {
    if (!detalle) return;
    if (!abonoForm.monto || abonoForm.monto <= 0) {
      toast.error('Ingresa un monto válido para el abono');
      return;
    }
    try {
      setProcesandoAbono(true);
      await api.post(`/customers/${detalle.id}/payment`, {
        monto: abonoForm.monto,
        metodoPago: abonoForm.metodoPago,
      });
      toast.success('Abono registrado exitosamente');
      await abrirDetalle(detalle.id);
      fetchClientes();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || 'Error al registrar el abono',
        );
      } else {
        toast.error('Error al registrar el abono');
      }
    } finally {
      setProcesandoAbono(false);
    }
  };

  /** Badge de color para el nivel de lealtad del cliente */
  const BadgeNivel = ({ nivel }: { nivel: NivelLealtadInfo }) => (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: `${nivel.colorHex ?? '#6366F1'}22`,
        color: nivel.colorHex ?? '#6366F1',
        border: `1px solid ${nivel.colorHex ?? '#6366F1'}55`,
      }}
    >
      {nivel.nombre}
    </span>
  );

  const lealtadVisible = programa?.habilitado === true;

  const clientesFiltrados = React.useMemo(() => {
    let lista = [...clientes];
    if (filtroCredito === 'con_credito') {
      lista = lista.filter((c) => c.cuentaCredito && c.cuentaCredito.estaActivo);
    } else if (filtroCredito === 'con_deuda') {
      lista = lista.filter((c) => (c.cuentaCredito?.saldoPendiente ?? 0) > 0);
    } else if (filtroCredito === 'sin_credito') {
      lista = lista.filter((c) => !c.cuentaCredito || !c.cuentaCredito.estaActivo);
    }

    if (ordenClientes === 'saldo_desc') {
      lista.sort(
        (a, b) =>
          (b.cuentaCredito?.saldoPendiente ?? 0) -
          (a.cuentaCredito?.saldoPendiente ?? 0),
      );
    } else if (ordenClientes === 'puntos_desc') {
      lista.sort((a, b) => (b.puntosActuales ?? 0) - (a.puntosActuales ?? 0));
    }
    return lista;
  }, [clientes, filtroCredito, ordenClientes]);

  const limpiarFiltros = () => {
    setSearch('');
    setMostrarInactivos(false);
    setFiltroCredito('todos');
    setOrdenClientes('nombre');
    reiniciar();
  };

  const filtrosActivosCount =
    (filtroCredito !== 'todos' ? 1 : 0) + (ordenClientes !== 'nombre' ? 1 : 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-on-background">
          Gestión de Clientes
        </h1>
        <Button variant="outline" onClick={() => setIsModalOpen(true)}>
          Nuevo Cliente
        </Button>
      </div>

      <BuscadorEstandar
        busqueda={search}
        onBusquedaChange={(val) => {
          setSearch(val);
          reiniciar();
        }}
        placeholder="Buscar por nombre, email, teléfono o RFC..."
        switchInactivos={{
          checked: mostrarInactivos,
          onCheckedChange: (checked: boolean) => {
            setMostrarInactivos(checked);
            reiniciar();
          },
          label: 'Mostrar inactivos',
        }}
        onActualizar={fetchClientes}
        cargando={loading}
        onLimpiar={limpiarFiltros}
        filtrosActivosCount={filtrosActivosCount}
        filtrosRapidos={
          <>
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-on-surface-variant font-medium">
                Estado de Crédito
              </span>
              <select
                value={filtroCredito}
                onChange={(e) => setFiltroCredito(e.target.value)}
                className="h-9 bg-surface-container-low border border-outline/20 rounded-xl px-3 text-xs focus:border-primary focus:outline-none text-on-surface"
              >
                <option value="todos">Todos los clientes</option>
                <option value="con_credito">Con cuenta de crédito</option>
                <option value="con_deuda">Con saldo pendiente (Deuda)</option>
                <option value="sin_credito">Sin crédito activo</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="text-on-surface-variant font-medium">
                Ordenar por
              </span>
              <select
                value={ordenClientes}
                onChange={(e) => setOrdenClientes(e.target.value)}
                className="h-9 bg-surface-container-low border border-outline/20 rounded-xl px-3 text-xs focus:border-primary focus:outline-none text-on-surface"
              >
                <option value="nombre">Nombre (A-Z)</option>
                <option value="saldo_desc">Mayor Saldo Pendiente</option>
                <option value="puntos_desc">Más Puntos de Lealtad</option>
              </select>
            </div>
          </>
        }
      />

      {/* Modal crear / editar cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col border border-outline/20 overflow-hidden">
            <h2 className="text-xl font-bold text-on-background px-6 pt-6 pb-4 border-b border-outline/20 shrink-0">
              {clienteEditando
                ? `Editar Cliente — ${clienteEditando.nombre}`
                : 'Nuevo Cliente'}
            </h2>
            <form
              onSubmit={handleSubmitCliente}
              className="flex-1 min-h-0 flex flex-col"
            >
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    Nombre <span className="text-error">*</span>
                  </Label>
                  <Input
                    required
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <Label>Apellido Paterno</Label>
                  <Input
                    value={formData.apellidoPaterno}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        apellidoPaterno: e.target.value,
                      })
                    }
                    placeholder="Apellido paterno"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                    placeholder="10 dígitos"
                  />
                </div>
                <div>
                  <Label>RFC</Label>
                  <Input
                    value={formData.rfc}
                    onChange={(e) =>
                      setFormData({ ...formData, rfc: e.target.value })
                    }
                    placeholder="Opcional"
                  />
                </div>
              </div>
              </div>
              <div className="px-6 py-4 border-t border-outline/20 bg-surface shrink-0 flex items-center justify-end gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Guardando...'
                    : clienteEditando
                      ? 'Guardar cambios'
                      : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCerrarModal}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detalle del cliente (D10) */}
      {(loadingDetalle || detalle) && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6 sm:p-10">
          <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[72vh] flex flex-col border border-outline/20 overflow-hidden">
            {loadingDetalle || !detalle ? (
              <div className="flex items-center justify-center py-12 gap-3 text-on-surface-variant">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Cargando detalle...</span>
              </div>
            ) : (
              <>
                {/* Header fijo (no hace scroll) */}
                <div className="px-6 pt-6 pb-4 border-b border-outline/20 shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-on-background">
                        {detalle.nombre} {detalle.apellidoPaterno ?? ''}
                      </h2>
                      <p className="text-sm text-on-surface-variant mt-0.5">
                        {detalle.email ?? 'Sin email'} ·{' '}
                        {detalle.telefono ?? 'Sin teléfono'}
                        {detalle.rfc ? ` · RFC ${detalle.rfc}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDetalle(null);
                          abrirEdicion(detalle);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                        Editar datos
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDetalle(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Cuerpo con scroll */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">

                {/* Lealtad */}
                {lealtadVisible && (
                  <section className="rounded-xl border border-outline/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Coins className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-on-background">
                        Programa de Lealtad
                      </h3>
                      {detalle.nivelLealtad && (
                        <BadgeNivel nivel={detalle.nivelLealtad} />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-on-surface-variant font-label-md">
                          Puntos disponibles
                        </p>
                        <p className="font-bold text-lg text-on-surface">
                          {detalle.puntosActuales}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant font-label-md">
                          Puntos históricos
                        </p>
                        <p className="font-bold text-lg text-on-surface">
                          {detalle.puntosHistoricos}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant font-label-md">
                          Descuento actual
                        </p>
                        <p className="font-bold text-lg text-success">
                          {detalle.nivelLealtad?.descuentoPct ?? 0}%
                        </p>
                      </div>
                    </div>

                    {/* D11: Historial de movimientos de puntos */}
                    {movimientosPuntos && movimientosPuntos.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-outline/10">
                        <p className="text-xs font-semibold text-on-surface-variant font-label-md mb-2">
                          Movimientos recientes
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {movimientosPuntos.map((mov) => {
                            const esGanado = mov.puntos > 0;
                            const variablePoints =
                              mov.tipo === 'GANADO'
                                ? 'GANADO'
                                : mov.tipo === 'CANJEADO'
                                  ? 'CANJEADO'
                                  : mov.tipo === 'AJUSTE'
                                    ? 'AJUSTE'
                                    : 'EXPIRADO';
                            const colorTipo =
                              variablePoints === 'GANADO'
                                ? 'bg-success/10 text-success'
                                : variablePoints === 'CANJEADO'
                                  ? 'bg-primary/10 text-primary'
                                  : variablePoints === 'AJUSTE'
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-outline/10 text-on-surface-variant';
                            const etiquetaTipo: Record<string, string> = {
                              GANADO: 'Ganados',
                              CANJEADO: 'Canjeados',
                              EXPIRADO: 'Expirados',
                              AJUSTE: 'Ajuste (devolución)',
                            };
                            return (
                              <div
                                key={mov.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full font-label-sm font-medium ${colorTipo}`}
                                  >
                                    {etiquetaTipo[mov.tipo] || mov.tipo}
                                  </span>
                                  <span className="text-on-surface-variant truncate">
                                    {new Date(mov.creadoEn).toLocaleDateString('es-MX', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                    {mov.expiraEn && mov.puntos > (mov.puntosConsumidos ?? 0)
                                      ? ` · vence ${new Date(mov.expiraEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
                                      : ''}
                                  </span>
                                </div>
                                <span
                                  className={`font-bold shrink-0 ${
                                    esGanado ? 'text-success' : 'text-error'
                                  }`}
                                >
                                  {esGanado ? '+' : ''}
                                  {mov.puntos}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Crédito */}
                <section className="rounded-xl border border-outline/20 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-on-background">
                      Cuenta de Crédito
                    </h3>
                  </div>

                  {detalle.cuentaCredito?.estaActivo ? (
                    <>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-on-surface-variant font-label-md">
                            Límite
                          </p>
                          <p className="font-bold text-lg">
                            ${detalle.cuentaCredito.limiteCredito.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-on-surface-variant font-label-md">
                            Saldo pendiente
                          </p>
                          <p className="font-bold text-lg text-error">
                            ${detalle.cuentaCredito.saldoPendiente.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-on-surface-variant font-label-md">
                            Disponible
                          </p>
                          <p className="font-bold text-lg text-success">
                            $
                            {(
                              detalle.cuentaCredito.limiteCredito -
                              detalle.cuentaCredito.saldoPendiente
                            ).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Registrar abono */}
                      <div className="rounded-lg bg-surface-container-low p-3 grid grid-cols-[1fr_140px_auto_auto] gap-2 items-end">
                        <div className="grid gap-1">
                          <Label htmlFor="abono-monto">Monto del abono</Label>
                          <Input
                            id="abono-monto"
                            type="number"
                            min={0.01}
                            step="10"
                            value={abonoForm.monto || ''}
                            onChange={(e) =>
                              setAbonoForm((prev) => ({
                                ...prev,
                                monto: parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="abono-metodo">Método</Label>
                          <Select
                            value={abonoForm.metodoPago}
                            onValueChange={(v) =>
                              setAbonoForm((prev) => ({ ...prev, metodoPago: v }))
                            }
                          >
                            <SelectTrigger id="abono-metodo">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="efectivo">Efectivo</SelectItem>
                              <SelectItem value="tarjeta">Tarjeta</SelectItem>
                              <SelectItem value="transferencia">Transferencia</SelectItem>
                              <SelectItem value="voucher">Voucher</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          onClick={handleRegistrarAbono}
                          disabled={procesandoAbono}
                        >
                          {procesandoAbono ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wallet className="w-4 h-4" />
                          )}
                          Abonar
                        </Button>
                      </div>
                    </>
                  ) : (
                    /* Abrir cuenta de Crédito */
                    <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
                      <div className="grid gap-1">
                        <Label htmlFor="credito-limite">Límite de Crédito ($)</Label>
                        <Input
                          id="credito-limite"
                          type="number"
                          min={1}
                          step="100"
                          value={creditoForm.limiteCredito}
                          onChange={(e) =>
                            setCreditoForm((prev) => ({
                              ...prev,
                              limiteCredito: parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="credito-dias">Días de vencimiento</Label>
                        <Input
                          id="credito-dias"
                          type="number"
                          min={1}
                          step="5"
                          value={creditoForm.diasMaximoVencimiento}
                          onChange={(e) =>
                            setCreditoForm((prev) => ({
                              ...prev,
                              diasMaximoVencimiento:
                                parseInt(e.target.value) || 30,
                            }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleAbrirCredito}
                        disabled={procesandoCredito}
                      >
                        {procesandoCredito ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        Abrir Crédito
                      </Button>
                    </div>
                  )}
                </section>

                {/* Últimas compras */}
                <section className="rounded-xl border border-outline/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-on-background">
                      Últimas compras
                    </h3>
                  </div>
                  {!detalle.ventas || detalle.ventas.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">
                      Este cliente aún no tiene compras registradas.
                    </p>
                  ) : (
                    <>
                      <ul className="divide-y divide-outline/20">
                        {detalle.ventas.map((v) => (
                          <li
                            key={v.id}
                            className="py-2 flex items-center justify-between gap-4 text-sm"
                          >
                            <Link
                              to={`/admin/ventas/${v.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline"
                              title={`Ver detalle de la venta ${v.folio} (pestaña nueva)`}
                            >
                              {v.folio}
                            </Link>
                            <span className="text-on-surface-variant">
                              {new Date(v.creadoEn).toLocaleDateString()}
                            </span>
                            <span className="font-bold">
                              ${v.total.toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {ventasMeta && ventasMeta.total > VENTAS_POR_PAGINA && (
                        <PaginacionControles
                          meta={ventasMeta}
                          onPageChange={cambiarPaginaVentas}
                        />
                      )}
                    </>
                  )}
                </section>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      <div className="bg-surface rounded-xl border border-on-surface/10 p-4 mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Apellido Paterno</TableHead>
              {lealtadVisible && <TableHead>Nivel</TableHead>}
              {lealtadVisible && <TableHead className="text-right">Puntos</TableHead>}
              {lealtadVisible && <TableHead className="text-right">Desc.</TableHead>}
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={lealtadVisible ? 9 : 6}
                  className="text-center py-6 text-on-surface-variant"
                >
                  Cargando clientes...
                </TableCell>
              </TableRow>
            ) : clientesFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={lealtadVisible ? 9 : 6} className="h-64">
                  <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                    <span className="material-symbols-outlined text-3xl mb-2">
                      person
                    </span>
                    <p>No hay clientes registrados</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              clientesFiltrados.map((c) => (
                <TableRow
                  key={c.id}
                  className={!c.estaActivo ? 'opacity-50 bg-surface-variant/30' : ''}
                >
                  <TableCell className="font-semibold">{c.nombre}</TableCell>
                  <TableCell>{c.apellidoPaterno || '-'}</TableCell>
                  {lealtadVisible && (
                    <TableCell>
                      {c.nivelLealtad ? (
                        <BadgeNivel nivel={c.nivelLealtad} />
                      ) : (
                        <span className="text-on-surface-variant text-xs">—</span>
                      )}
                    </TableCell>
                  )}
                  {lealtadVisible && (
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium">{c.puntosActuales}</span>
                      <span className="text-on-surface-variant text-xs">
                        {' '}
                        / {c.puntosHistoricos}
                      </span>
                    </TableCell>
                  )}
                  {lealtadVisible && (
                    <TableCell className="text-right tabular-nums">
                      {c.nivelLealtad?.descuentoPct ?? 0}%
                    </TableCell>
                  )}
                  <TableCell>{c.email || '-'}</TableCell>
                  <TableCell>{c.telefono || '-'}</TableCell>
                  <TableCell className="text-center">
                    {c.estaActivo ? (
                      <span className="bg-success/10 text-success px-2 py-1 rounded-full text-xs">
                        Activo
                      </span>
                    ) : (
                      <span className="bg-error/10 text-error px-2 py-1 rounded-full text-xs">
                        Inactivo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirDetalle(c.id)}
                      disabled={loadingDetalle}
                      title={`Ver detalle de ${c.nombre}`}
                    >
                      <Eye className="w-4 h-4 text-on-surface-variant" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirEdicion(c)}
                      title={`Editar datos de ${c.nombre}`}
                    >
                      <Pencil className="w-4 h-4 text-on-surface-variant" />
                    </Button>
                    {c.estaActivo ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDesactivar(c)}
                        title={`Desactivar a ${c.nombre}`}
                      >
                        <PowerOff className="w-4 h-4 text-warning" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReactivar(c)}
                        title={`Reactivar a ${c.nombre}`}
                      >
                        <Power className="w-4 h-4 text-success" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
      </div>

      <ConfirmDialog
        isOpen={!!clienteADesactivar}
        onClose={() => setClienteADesactivar(null)}
        onConfirm={confirmDesactivarCliente}
        title={`¿Desactivar a ${clienteADesactivar?.nombre}?`}
        description="Conservará su historial, pero no aparecerá en el punto de venta ni podrá acumular puntos hasta reactivarlo."
        confirmText="Sí, desactivar"
        cancelText="Cancelar"
        variant="warning"
        isLoading={isDesactivando}
      />
    </div>
  );
}
