import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  RefreshCw,
  X,
  Wallet,
  AlertTriangle,
  BadgeCheck,
  History,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { BuscadorEstandar } from '@/components/ui/BuscadorEstandar';

// ------------------------------------------------------------------
// Tipos
// ------------------------------------------------------------------
interface ClienteFiado {
  id: string;
  nombre: string;
  apellidoPaterno?: string | null;
  telefono?: string | null;
  email?: string | null;
  cuentaCredito?: {
    saldoPendiente: number;
    limiteCredito: number;
    estaActivo: boolean;
  } | null;
}

interface AbonoInfo {
  id: string;
  monto: number;
  metodoPago: string;
  fechaHora: string;
  usuario?: { nombre: string } | null;
}

interface VentaCreditoInfo {
  id: string;
  montoTotal: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: 'pendiente' | 'parcialmente_pagada' | 'liquidada' | 'vencida';
  fechaVencimiento: string;
  venta?: { folio: string; creadoEn: string; total: number };
  abonos: AbonoInfo[];
}

interface EstadoCuenta {
  cliente: ClienteFiado;
  cuenta: { limiteCredito: number; saldoPendiente: number; ventasCredito: VentaCreditoInfo[] };
  resumen: {
    limiteCredito: number;
    saldoPendiente: number;
    saldoDisponible: number;
    ventasPendientes: number;
    ventasVencidas: number;
  };
}

const METODOS_PAGO = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'voucher', etiqueta: 'Voucher' },
];

export default function FiadosView() {
  const user = useAuthStore((state) => state.user);
  const esGerencia = ['SUPER_ADMIN', 'ADMIN', 'GERENTE'].includes(user?.rol ?? '');

  const [clientes, setClientes] = useState<ClienteFiado[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Estado de cuenta modal
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuenta | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // Formulario de abono
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoAbono, setMetodoAbono] = useState('efectivo');
  const [registrandoAbono, setRegistrandoAbono] = useState(false);

  // ----------------------------------------------------------------
  // Carga la lista de clientes y conserva solo los que tienen deuda
  // ----------------------------------------------------------------
  const cargarClientes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get(`/customers?${params.toString()}`);
      const lista: ClienteFiado[] = res.data.data ?? res.data ?? [];
      setClientes(
        lista.filter(
          (c) => c.cuentaCredito && c.cuentaCredito.estaActivo && c.cuentaCredito.saldoPendiente > 0,
        ),
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Error al cargar los clientes con crédito'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Debounce simple para la búsqueda
  useEffect(() => {
    const t = setTimeout(cargarClientes, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [cargarClientes, search]);

  // ----------------------------------------------------------------
  // Detalle / estado de cuenta (solo gerencia puede consultar)
  // ----------------------------------------------------------------
  const abrirDetalle = async (clienteId: string) => {
    try {
      setCargandoDetalle(true);
      const res = await api.get(`/customers/${clienteId}/statement`);
      setEstadoCuenta(res.data);
      setMontoAbono('');
      setMetodoAbono('efectivo');
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo cargar el estado de cuenta'));
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ----------------------------------------------------------------
  // Registrar abono (aplica FIFO en el backend)
  // ----------------------------------------------------------------
  const registrarAbono = async () => {
    if (!estadoCuenta) return;
    const monto = parseFloat(montoAbono);
    if (!monto || monto <= 0) {
      toast.error('Ingresa un monto de abono válido');
      return;
    }
    try {
      setRegistrandoAbono(true);
      await api.post(`/customers/${estadoCuenta.cliente.id}/payment`, {
        monto,
        metodoPago: metodoAbono,
      });
      toast.success(`Abono de $${monto.toFixed(2)} registrado correctamente`);
      // Recarga el estado de cuenta y la lista principal
      await abrirDetalle(estadoCuenta.cliente.id);
      cargarClientes();
    } catch (err) {
      toast.error(errorMessage(err, 'Error al registrar el abono'));
    } finally {
      setRegistrandoAbono(false);
    }
  };

  const formatearFecha = (iso: string): string =>
    new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  const etiquetaEstado = (estado: VentaCreditoInfo['estado']): string =>
    ({
      pendiente: 'Pendiente',
      parcialmente_pagada: 'Parcial',
      liquidada: 'Liquidada',
      vencida: 'Vencida',
    })[estado];

  const claseEstado = (vc: VentaCreditoInfo): string => {
    if (vc.estado === 'liquidada') return 'bg-success/10 text-success border-success/30';
    if (vc.estado === 'vencida') return 'bg-error/10 text-error border-error/30';
    return 'bg-warning/10 text-warning border-warning/30';
  };

  const [rangoDeuda, setRangoDeuda] = useState<string>('todas');
  const [ordenDeuda, setOrdenDeuda] = useState<string>('deuda_desc');
  const [soloSobregirados, setSoloSobregirados] = useState<boolean>(false);

  const clientesFiltrados = useCallback(() => {
    let lista = [...clientes];
    if (soloSobregirados) {
      lista = lista.filter((c) => {
        const disp = (c.cuentaCredito?.limiteCredito ?? 0) - (c.cuentaCredito?.saldoPendiente ?? 0);
        return disp <= 0;
      });
    }

    if (rangoDeuda === 'mayor_500') {
      lista = lista.filter((c) => (c.cuentaCredito?.saldoPendiente ?? 0) >= 500);
    } else if (rangoDeuda === 'mayor_1000') {
      lista = lista.filter((c) => (c.cuentaCredito?.saldoPendiente ?? 0) >= 1000);
    } else if (rangoDeuda === 'mayor_5000') {
      lista = lista.filter((c) => (c.cuentaCredito?.saldoPendiente ?? 0) >= 5000);
    }

    if (ordenDeuda === 'deuda_desc') {
      lista.sort((a, b) => (b.cuentaCredito?.saldoPendiente ?? 0) - (a.cuentaCredito?.saldoPendiente ?? 0));
    } else if (ordenDeuda === 'deuda_asc') {
      lista.sort((a, b) => (a.cuentaCredito?.saldoPendiente ?? 0) - (b.cuentaCredito?.saldoPendiente ?? 0));
    } else if (ordenDeuda === 'nombre') {
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return lista;
  }, [clientes, soloSobregirados, rangoDeuda, ordenDeuda]);

  const listaFinal = clientesFiltrados();

  const limpiarFiltros = () => {
    setSearch('');
    setRangoDeuda('todas');
    setOrdenDeuda('deuda_desc');
    setSoloSobregirados(false);
  };

  const filtrosActivosCount = (rangoDeuda !== 'todas' ? 1 : 0) + (ordenDeuda !== 'deuda_desc' ? 1 : 0);

  return (
    <div className="p-6 space-y-6">
      {/* ===================== ENCABEZADO ===================== */}
      <div>
        <h1 className="text-2xl font-bold font-display-lg text-on-background flex items-center gap-2">
          <CreditCard className="w-7 h-7" />
          Fiados (Crédito)
        </h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Clientes con saldo pendiente. Los abonos se aplican a la deuda más antigua primero.
        </p>
      </div>

      <BuscadorEstandar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholder="Buscar por cliente o teléfono..."
        switchInactivos={{
          checked: soloSobregirados,
          onCheckedChange: setSoloSobregirados,
          label: 'Solo sin crédito disponible',
        }}
        onActualizar={cargarClientes}
        cargando={loading}
        onLimpiar={limpiarFiltros}
        filtrosActivosCount={filtrosActivosCount}
        filtrosRapidos={
          <>
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-on-surface-variant font-medium">Monto de Deuda</span>
              <select
                value={rangoDeuda}
                onChange={(e) => setRangoDeuda(e.target.value)}
                className="h-9 bg-surface-container-low border border-outline/20 rounded-xl px-3 text-xs focus:border-primary focus:outline-none text-on-surface"
              >
                <option value="todas">Todas las deudas</option>
                <option value="mayor_500">Deuda ≥ $500.00</option>
                <option value="mayor_1000">Deuda ≥ $1,000.00</option>
                <option value="mayor_5000">Deuda ≥ $5,000.00</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="text-on-surface-variant font-medium">Ordenar por</span>
              <select
                value={ordenDeuda}
                onChange={(e) => setOrdenDeuda(e.target.value)}
                className="h-9 bg-surface-container-low border border-outline/20 rounded-xl px-3 text-xs focus:border-primary focus:outline-none text-on-surface"
              >
                <option value="deuda_desc">Mayor Deuda Primero</option>
                <option value="deuda_asc">Menor Deuda Primero</option>
                <option value="nombre">Nombre Cliente (A-Z)</option>
              </select>
            </div>
          </>
        }
      />

      {/* ===================== TABLA DE FIADOS ===================== */}
      <div className="bg-surface rounded-xl border border-on-surface/10 p-4">
        {loading && clientes.length === 0 ? (
          <div className="flex items-center justify-center py-12 gap-3 text-on-surface-variant">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Cargando clientes con deuda...
          </div>
        ) : listaFinal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-on-surface-variant">
            <BadgeCheck className="w-14 h-14 mb-3 opacity-30" />
            <p className="font-medium">No hay clientes para los filtros aplicados</p>
            <p className="text-sm mt-1">Prueba cambiando los filtros o la búsqueda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline/20 text-left text-[11px] uppercase tracking-wider text-outline">
                  <th className="py-3 px-2">Cliente</th>
                  <th className="py-3 px-2">Teléfono</th>
                  <th className="py-3 px-2 text-right">Saldo Pendiente</th>
                  <th className="py-3 px-2 text-right">Límite</th>
                  <th className="py-3 px-2 text-right">Disponible</th>
                  <th className="py-3 px-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaFinal.map((c) => {
                  const disponible =
                    (c.cuentaCredito?.limiteCredito ?? 0) - (c.cuentaCredito?.saldoPendiente ?? 0);
                  const sinDisponible = disponible <= 0;
                  return (
                    <tr key={c.id} className="border-b border-outline/10 hover:bg-surface-container-low/60">
                      <td className="py-3 px-2 font-medium">
                        {c.nombre} {c.apellidoPaterno}
                      </td>
                      <td className="py-3 px-2 text-on-surface-variant">{c.telefono || '—'}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-error">
                        ${(c.cuentaCredito?.saldoPendiente ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-on-surface-variant">
                        ${(c.cuentaCredito?.limiteCredito ?? 0).toFixed(2)}
                      </td>
                      <td className={`py-3 px-2 text-right font-mono font-semibold ${sinDisponible ? 'text-warning' : 'text-success'}`}>
                        ${disponible.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => abrirDetalle(c.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          <Eye className="w-4 h-4" />
                          Estado de Cuenta
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================== MODAL ESTADO DE CUENTA ===================== */}
      {(cargandoDetalle || estadoCuenta) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-surface rounded-2xl border border-outline/20 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Cabecera fija */}
            <div className="px-6 pt-6 pb-4 border-b border-outline/10 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-headline-md font-bold text-lg">
                    Estado de Cuenta —{' '}
                    {estadoCuenta
                      ? `${estadoCuenta.cliente.nombre} ${estadoCuenta.cliente.apellidoPaterno ?? ''}`
                      : '...'}
                  </h2>
                  {estadoCuenta?.cliente.telefono && (
                    <p className="text-xs text-outline mt-0.5">{estadoCuenta.cliente.telefono}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEstadoCuenta(null)}
                  className="p-2 rounded-full hover:bg-on-surface/5 text-on-surface-variant"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {estadoCuenta && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="rounded-xl bg-error/5 border border-error/20 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Saldo</p>
                    <p className="font-bold font-mono text-error">
                      ${estadoCuenta.resumen.saldoPendiente.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-success/5 border border-success/20 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Disponible</p>
                    <p className="font-bold font-mono text-success">
                      ${estadoCuenta.resumen.saldoDisponible.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-container-low border border-outline/20 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Pendientes</p>
                    <p className="font-bold font-mono">{estadoCuenta.resumen.ventasPendientes}</p>
                  </div>
                  <div className="rounded-xl bg-surface-container-low border border-outline/20 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant flex items-center justify-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-warning" /> Vencidas
                    </p>
                    <p className="font-bold font-mono text-warning">
                      {estadoCuenta.resumen.ventasVencidas}
                    </p>
                  </div>
                </div>
              )}

              {/* Formulario de abono — visible para todos los roles autorizados */}
              {estadoCuenta && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 mt-4">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-outline mb-1">
                      Monto del abono
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={montoAbono}
                      onChange={(e) => setMontoAbono(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline/20 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="sm:w-44">
                    <label className="block text-[11px] font-semibold text-outline mb-1">
                      Método de pago
                    </label>
                    <select
                      value={metodoAbono}
                      onChange={(e) => setMetodoAbono(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {METODOS_PAGO.map((m) => (
                        <option key={m.valor} value={m.valor}>
                          {m.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={registrarAbono}
                    disabled={registrandoAbono || !montoAbono}
                    className="px-5 py-2 rounded-xl bg-primary text-on-primary font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[38px]"
                  >
                    <Wallet className="w-4 h-4" />
                    {registrandoAbono ? 'Registrando...' : 'Registrar Abono'}
                  </button>
                </div>
              )}
            </div>

            {/* Listado de ventas a crédito */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
              {!esGerencia && (
                <p className="text-xs text-on-surface-variant italic">
                  Solo gerencia puede consultar el detalle completo del estado de cuenta.
                </p>
              )}
              {estadoCuenta &&
                (estadoCuenta.cuenta.ventasCredito.length === 0 ? (
                  <p className="text-center py-8 text-on-surface-variant">
                    Sin ventas a crédito registradas
                  </p>
                ) : (
                  estadoCuenta.cuenta.ventasCredito.map((vc) => (
                    <div key={vc.id} className="rounded-xl border border-outline/20 bg-surface-container-low p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-mono font-bold text-sm">
                            {vc.venta?.folio ?? 'Venta'}
                            <span className="ml-2 font-body-md font-normal text-outline">
                              {vc.venta?.creadoEn ? formatearFecha(vc.venta.creadoEn) : ''}
                            </span>
                          </p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Vence: {formatearFecha(vc.fechaVencimiento)}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${claseEstado(vc)}`}>
                          {etiquetaEstado(vc.estado)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                        <div>
                          <span className="text-outline block">Total</span>
                          <span className="font-mono font-semibold">${vc.montoTotal.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-outline block">Abonado</span>
                          <span className="font-mono font-semibold text-success">
                            ${vc.montoPagado.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-outline block">Resta</span>
                          <span className="font-mono font-semibold text-error">
                            ${vc.saldoPendiente.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {vc.abonos.length > 0 && (
                        <details>
                          <summary className="text-xs text-primary cursor-pointer select-none flex items-center gap-1.5 hover:underline">
                            <History className="w-3.5 h-3.5" />
                            Ver {vc.abonos.length} abono{vc.abonos.length !== 1 ? 's' : ''}
                          </summary>
                          <ul className="mt-2 space-y-1 border-l border-outline/20 pl-3">
                            {vc.abonos.map((ab) => (
                              <li key={ab.id} className="text-xs text-on-surface-variant flex justify-between gap-3">
                                <span>
                                  {new Date(ab.fechaHora).toLocaleString('es-MX')}
                                  {ab.usuario?.nombre ? ` • ${ab.usuario.nombre}` : ''} •{' '}
                                  <span className="capitalize">{ab.metodoPago}</span>
                                </span>
                                <span className="font-mono font-semibold text-success shrink-0">
                                  +${ab.monto.toFixed(2)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
