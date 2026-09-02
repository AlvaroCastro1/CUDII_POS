import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Banknote,
  Receipt,
  X,
  CheckCircle2,
  AlertCircle,
  UserSearch,
  Coins,
  UserCheck,
  Users,
  Wallet,
  Ticket,
  Printer,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { usePosStore } from '../../store/usePosStore';
import type { Venta } from '../../types/pos';
import { PresupuestoTicketModal, type PresupuestoTicketData } from './PresupuestoTicketModal';

/** Nivel de lealtad del cliente (D10) */
interface NivelLealtadPos {
  id: string;
  nombre: string;
  colorHex: string | null;
  descuentoPct: number;
}

/** Cliente reducido para el punto de venta (D10) */
interface ClientePos {
  id: string;
  nombre: string;
  apellidoPaterno?: string | null;
  telefono?: string | null;
  puntosActuales: number;
  puntosHistoricos: number;
  nivelLealtad?: NivelLealtadPos | null;
  cuentaCredito?: {
    limiteCredito: number;
    saldoPendiente: number;
    estaActivo: boolean;
  } | null;
}

/** Configuración del programa de lealtad (D10) */
interface ProgramaLealtadPos {
  habilitado: boolean;
  permitirCanje: boolean;
  puntosPorPesos: number;
  canjeMinimoPuntos: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (venta: Venta) => void;
}

/** Redondeo a centavos (#4): evita artefactos de punto flotante en montos cobrables */
const r2 = (n: number) => Math.round(n * 100) / 100;

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const cart = usePosStore((s) => s.cart);
  const combos = usePosStore((s) => s.combos);
  const clearCart = usePosStore((s) => s.clearCart);
  const descuentoGeneral = usePosStore((s) => s.descuentoGeneral);
  const activeSession = usePosStore((s) => s.activeSession);
  const presupuestoActivoId = usePosStore((s) => s.presupuestoActivoId);

  const [metodoPago, setMetodoPago] = useState<
    'efectivo' | 'tarjeta' | 'mixto' | 'credito'
  >('efectivo');
  const [montoEfectivo, setMontoEfectivo] = useState<string>('');
  const [montoTarjeta, setMontoTarjeta] = useState<string>('');
  const [referenciaTarjeta, setReferenciaTarjeta] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── D10: Selector de cliente y lealtad ────────────────────────────────
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [resultados, setResultados] = useState<ClientePos[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [cliente, setCliente] = useState<ClientePos | null>(null);
  const [programa, setPrograma] = useState<ProgramaLealtadPos | null>(null);
  const [puntosACanjearInput, setPuntosACanjearInput] = useState<string>('');
  // #1: cobro de deuda pendiente al seleccionar cliente con crédito
  const [cobrarDeuda, setCobrarDeuda] = useState(false);

  // ── D12: Cupón de descuento ───────────────────────────────────────────
  const [codigoCuponInput, setCodigoCuponInput] = useState('');
  const [cuponAplicado, setCuponAplicado] = useState<{
    id: string;
    codigo: string;
    nombre: string;
    tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO';
    valorDescuento: number;
    montoMinimoCompra: number | null;
  } | null>(null);
  // Leyenda que explica por qué un cupón ya no es aplicable tras cambios en el carrito
  const [cuponInvalido, setCuponInvalido] = useState<string | null>(null);
  const [cuponValidando, setCuponValidando] = useState(false);
  const [cuponError, setCuponError] = useState<string | null>(null);

  // ── D12: Guardar como presupuesto (cotización) ─────────────────────────
  const [guardandoPresupuesto, setGuardandoPresupuesto] = useState(false);
  const [presupuestoGuardado, setPresupuestoGuardado] = useState<PresupuestoTicketData | null>(null);
  const [presupuestoParaTicket, setPresupuestoParaTicket] = useState<PresupuestoTicketData | null>(null);

  /** Carga la configuración del programa al abrir el modal */
  useEffect(() => {
    if (!isOpen) return;
    let vigente = true;
    api
      .get<ProgramaLealtadPos>('/company-settings/lealtad')
      .then((res) => {
        if (vigente) setPrograma(res.data);
      })
      .catch(() => {
        if (vigente)
          setPrograma({
            habilitado: false,
            permitirCanje: false,
            puntosPorPesos: 100,
            canjeMinimoPuntos: 100,
          });
      });
    return () => {
      vigente = false;
    };
  }, [isOpen]);

  /** Búsqueda con retardo de clientes activos para el selector */
  useEffect(() => {
    if (!isOpen || !mostrarResultados || busquedaCliente.trim().length < 2) {
      setResultados([]);
      return;
    }
    let vigente = true;
    setBuscandoCliente(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get(
          `/customers?page=1&limit=6&search=${encodeURIComponent(busquedaCliente)}`,
        );
        if (vigente) setResultados(res.data.data ?? []);
      } catch {
        if (vigente) setResultados([]);
      } finally {
        if (vigente) setBuscandoCliente(false);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [busquedaCliente, mostrarResultados, isOpen]);

  // #8: si se estaba cobrando a crédito y se quita el cliente o la cuenta, volver a efectivo
  // (el chequeo exacto contra el total se valida al enviar)
  useEffect(() => {
    if (metodoPago !== 'credito') return;
    if (!cliente?.cuentaCredito?.estaActivo) {
      setMetodoPago('efectivo');
    }
  }, [metodoPago, cliente]);

  // #1: al cambiar de cliente, resetear la selección de cobro de deuda
  useEffect(() => {
    setCobrarDeuda(false);
  }, [cliente]);

  // D12: al cambiar de cliente, re-validar el cupón si estaba aplicado
  // (puede dejar de aplicar si exige cliente registrado o límite por cliente)
  useEffect(() => {
    if (cliente) {
      setCuponAplicado(null);
      setCuponInvalido(null);
    }
  }, [cliente]);

  // D12: re-validar el cupón cuando cambia el carrito (subtotal/descuentos).
  // Si un cupón aplicado deja de cumplir las condiciones (p. ej. montos mínimos),
  // se quita y se muestra una leyenda con la razón.
  const baseActiva =
    cart.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0) +
    combos.reduce((acc, c) => acc + c.cantidad * c.precioUnitario, 0) -
    (cart.reduce((acc, item) => acc + item.descuento, 0) + descuentoGeneral);
  useEffect(() => {
    if (!cuponAplicado) return;
    const base = Math.max(0, baseActiva);
    const razon = cuponAplicado.montoMinimoCompra
      ? base < cuponAplicado.montoMinimoCompra
        ? `requiere una compra mínima de $${cuponAplicado.montoMinimoCompra.toFixed(2)}`
        : null
      : null;
    if (razon) {
      setCuponError(null);
      setCuponInvalido(
        `El cupón ${cuponAplicado.codigo} no pudo aplicarse por ${razon}`,
      );
      setCuponAplicado(null);
    }
  }, [baseActiva]);

  if (!isOpen) return null;

  // #1: deuda pendiente del cliente
  const deudaPendiente =
    cobrarDeuda && cliente?.cuentaCredito?.estaActivo
      ? Math.max(0, Number(cliente.cuentaCredito.saldoPendiente) || 0)
      : 0;

  // ── Totales (el backend recalcula el descuento de lealtad de forma autoritativa) ──
  const subtotal = r2(
    cart.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0) +
      combos.reduce((acc, c) => acc + c.cantidad * c.precioUnitario, 0),
  );
  const totalDescuentos = r2(
    cart.reduce((acc, item) => acc + item.descuento, 0) + descuentoGeneral,
  );

  // D10: Descuento por nivel del cliente seleccionado
  const pctNivel = cliente?.nivelLealtad?.descuentoPct ?? 0;
  const netoTrasDescuentos = r2(Math.max(0, subtotal - totalDescuentos));
  const descuentoLealtad =
    programa?.habilitado && pctNivel > 0
      ? Math.round(netoTrasDescuentos * pctNivel) / 100
      : 0;

  // D12: Descuento del cupón aplicado (sobre la base, antes de nivel y canje)
  const descuentoCupon = cuponAplicado
    ? cuponAplicado.tipoDescuento === 'PORCENTAJE'
      ? r2(netoTrasDescuentos * (cuponAplicado.valorDescuento / 100))
      : Math.min(cuponAplicado.valorDescuento, netoTrasDescuentos)
    : 0;

  // D10: Canje de puntos (limitado por saldo, mínimo configurado y total restante)
  const puntosACanjear = parseInt(puntosACanjearInput, 10) || 0;
  const canjeHabilitado =
    programa?.habilitado === true &&
    programa.permitirCanje === true &&
    cliente !== null &&
    puntosACanjear >= (programa.canjeMinimoPuntos ?? 0) &&
    puntosACanjear <= (cliente.puntosActuales ?? 0);
  const montoCanjeBruto =
    canjeHabilitado && programa && programa.puntosPorPesos > 0
      ? Math.round((puntosACanjear / programa.puntosPorPesos) * 100) / 100
      : 0;
  const montoCanje = Math.min(
    montoCanjeBruto,
    netoTrasDescuentos - descuentoLealtad - descuentoCupon,
  );

  // Techo inteligente de puntos: no más de los disponibles ni más que el resto a pagar
  const restanteParaCanje = Math.max(
    0,
    netoTrasDescuentos - descuentoLealtad - descuentoCupon,
  );
  const maxPuntosCanjeables =
    programa && programa.puntosPorPesos > 0
      ? Math.floor(
          Math.min(
            cliente?.puntosActuales ?? 0,
            restanteParaCanje * programa.puntosPorPesos,
          ),
        )
      : 0;

  const totalVenta = r2(
    Math.max(0, netoTrasDescuentos - descuentoLealtad - descuentoCupon - montoCanje),
  );
  const total = r2(totalVenta + deudaPendiente);

  // ── #8: Crédito (fiar) — disponible según la cuenta del cliente ──
  const creditoDisponible =
    cliente?.cuentaCredito?.estaActivo === true
      ? r2(
          Math.max(
            0,
            cliente.cuentaCredito.limiteCredito -
              cliente.cuentaCredito.saldoPendiente,
          ),
        )
      : null;
  const creditoSuficiente =
    creditoDisponible !== null && creditoDisponible >= total;

  const efectivoNum = parseFloat(montoEfectivo) || 0;
  const tarjetaNum = parseFloat(montoTarjeta) || 0;
  const totalPagado = metodoPago === 'efectivo' ? efectivoNum : efectivoNum + tarjetaNum;
  const cambio = r2(Math.max(0, efectivoNum - (total - tarjetaNum)));

  const isPagoSuficiente =
    metodoPago === 'efectivo'
      ? efectivoNum >= total
      : metodoPago === 'tarjeta' || metodoPago === 'credito'
      ? true
      : totalPagado >= total;

  const handleQuickCash = (monto: number) => {
    setMontoEfectivo(monto.toString());
  };

  /** Selecciona un cliente del buscador y muestra su chip */
  const seleccionarCliente = (c: ClientePos) => {
    setCliente(c);
    setBusquedaCliente('');
    setResultados([]);
    setMostrarResultados(false);
    setPuntosACanjearInput('');
  };

  /** D12: Valida y aplica un cupón de descuento por código */
  const aplicarCupon = async () => {
    const codigo = codigoCuponInput.trim().toUpperCase();
    if (!codigo) return;
    setCuponValidando(true);
    setCuponError(null);
    try {
      const res = await api.get('/coupons/validar', {
        params: {
          codigo,
          ...(cliente ? { clienteId: cliente.id } : {}),
          ...(netoTrasDescuentos > 0 ? { subtotalBase: netoTrasDescuentos } : {}),
        },
      });
      setCuponAplicado({
        id: res.data.id,
        codigo: res.data.codigo,
        nombre: res.data.nombre,
        tipoDescuento: res.data.tipoDescuento,
        valorDescuento: res.data.valorDescuento,
        montoMinimoCompra: res.data.montoMinimoCompra ?? null,
      });
      setCuponError(null);
      setCuponInvalido(null);
    } catch (err: unknown) {
      setCuponAplicado(null);
      const msg = errorMessage(err, 'El cupón no es válido');
      setCuponError(msg);
    } finally {
      setCuponValidando(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPagoSuficiente && metodoPago !== 'tarjeta' && metodoPago !== 'credito') {
      setError('El monto pagado es menor al total a cobrar');
      return;
    }
    if (metodoPago === 'credito') {
      if (!cliente) {
        setError('Selecciona un cliente para poder fiar la venta');
        return;
      }
      if (!cliente.cuentaCredito?.estaActivo) {
        setError('El cliente no tiene una cuenta de crédito activa');
        return;
      }
      if (!creditoSuficiente) {
        setError(
          `Crédito disponible insuficiente ($${(creditoDisponible ?? 0).toFixed(2)}) para fiar $${total.toFixed(2)}`,
        );
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const pagos = [];
      // #1: nota de deuda para referencia en el pago
      const notaDeuda =
        cobrarDeuda && deudaPendiente > 0
          ? ` · Deuda $${deudaPendiente.toFixed(2)}`
          : '';

      if (metodoPago === 'efectivo') {
        pagos.push({
          metodo: 'efectivo',
          montoRecibido: efectivoNum || total,
          montoPagado: total,
          cambio,
          ...(notaDeuda ? { referencia: `Venta $${totalVenta.toFixed(2)}${notaDeuda}` } : {}),
        });
      } else if (metodoPago === 'tarjeta') {
        pagos.push({
          metodo: 'tarjeta',
          montoRecibido: total,
          montoPagado: total,
          referencia: [referenciaTarjeta, notaDeuda ? `Venta $${totalVenta.toFixed(2)}${notaDeuda}` : null]
            .filter(Boolean)
            .join(' · ') || undefined,
        });
      } else if (metodoPago === 'credito') {
        pagos.push({
          metodo: 'credito',
          montoRecibido: total,
          montoPagado: total,
        });
      } else {
        if (efectivoNum > 0) {
          pagos.push({
            metodo: 'efectivo',
            montoRecibido: efectivoNum,
            montoPagado: Math.min(efectivoNum, total),
            cambio,
            ...(notaDeuda && efectivoNum >= total
              ? { referencia: `Venta $${totalVenta.toFixed(2)}${notaDeuda}` }
              : {}),
          });
        }
        if (tarjetaNum > 0) {
          pagos.push({
            metodo: 'tarjeta',
            montoRecibido: tarjetaNum,
            montoPagado: Math.min(tarjetaNum, Math.max(0, total - efectivoNum)),
            referencia: [
              referenciaTarjeta || null,
              notaDeuda && efectivoNum + tarjetaNum >= total
                ? `Venta $${totalVenta.toFixed(2)}${notaDeuda}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
          });
        }
      }

      const payload: Record<string, unknown> = {
        sesionCajaId: activeSession?.id,
        cajaId: activeSession?.cajaId,
        detalles: cart.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          unidadMedida: item.unidadMedida,
          descuento: item.descuento || 0,
          // D12: líneas cargadas desde un presupuesto conservan el marco del combo.
          ...(item.comboId
            ? { comboId: item.comboId, nombreCombo: item.nombreCombo ?? null }
            : {}),
        })),
        combos: combos.map((c) => ({
          comboId: c.comboId,
          cantidad: c.cantidad,
        })),
        pagos,
        descuentoGeneral,
      };
      if (cliente) payload.clienteId = cliente.id;
      if (canjeHabilitado) payload.puntosACanjear = puntosACanjear;
      if (cuponAplicado) payload.codigoCupon = cuponAplicado.codigo;
      // D12: si el ticket proviene de un presupuesto, se cobra por su ID.
      if (presupuestoActivoId) payload.presupuestoId = presupuestoActivoId;

      const res = await api.post('/sales', payload);

      // #1: registrar abono de deuda (CRITICAL: incluir metodoPago y referencia)
      if (cobrarDeuda && deudaPendiente > 0 && cliente?.id) {
        try {
          await api.post(`/customers/${cliente.id}/payment`, {
            monto: deudaPendiente,
            metodoPago: metodoPago === 'tarjeta' ? 'tarjeta' : 'efectivo',
            referencia: `Abono a deuda — Venta ${res.data.folio ?? ''}`.trim(),
          });
        } catch (err) {
          console.error('Error al registrar abono de deuda:', err);
        }
      }

      clearCart();
      onSuccess(res.data);
      // Reiniciar el estado de lealtad y de pago tras la venta
      setCliente(null);
      setPuntosACanjearInput('');
      setMetodoPago('efectivo');
      setMontoEfectivo('');
      setMontoTarjeta('');
      setReferenciaTarjeta('');
      setCobrarDeuda(false);
      setCodigoCuponInput('');
      setCuponAplicado(null);
      setCuponError(null);
      setCuponInvalido(null);
    } catch (err: unknown) {
      console.error('Error al procesar cobro:', err);
      setError(errorMessage(err, 'Ocurrió un error al procesar la venta en la caja'));
    } finally {
      setIsLoading(false);
    }
  };

  /** D12: Guarda el ticket actual como presupuesto (cotización) sin cobrar. */
  const guardarComoPresupuesto = async () => {
    if (cart.length === 0 && combos.length === 0) return;
    setGuardandoPresupuesto(true);
    setError(null);
    setPresupuestoGuardado(null);
    try {
      const body: Record<string, unknown> = {
        detalles: cart.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          unidadMedida: item.unidadMedida,
        })),
        combos: combos.map((c) => ({ comboId: c.comboId, cantidad: c.cantidad })),
        descuentoGeneral,
      };
      if (cliente) body.clienteId = cliente.id;
      if (canjeHabilitado) body.puntosACanjear = puntosACanjear;
      if (cuponAplicado) body.codigoCupon = cuponAplicado.codigo;

      const res = await api.post<PresupuestoTicketData>('/presupuestos', body);
      setPresupuestoGuardado(res.data);
      setPresupuestoParaTicket(res.data);
    } catch (err: unknown) {
      console.error('Error al guardar presupuesto:', err);
      setError(
        errorMessage(err, 'Ocurrió un error al guardar el presupuesto'),
      );
    } finally {
      setGuardandoPresupuesto(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div className="bg-surface border border-outline/20 rounded-[28px] max-w-lg w-full p-6 shadow-2xl space-y-4 relative max-h-[82vh] overflow-y-auto custom-scrollbar text-on-surface my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold shadow-lg">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary font-headline-md leading-snug">
                Cobrar Ticket
              </h2>
              <p className="text-[11px] text-outline font-body-md">
                Selecciona la forma de pago para finalizar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-outline hover:text-primary transition-colors rounded-full hover:bg-surface-container-high"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-error/10 border border-error/30 rounded-xl text-error text-xs font-label-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── #2: Estado del cliente a simple vista ───────────────────────── */}
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border ${
            cliente
              ? 'bg-success/10 border-success/40'
              : 'bg-surface-container-low border-outline/20'
          }`}
          role="status"
          aria-live="polite"
        >
          {cliente ? (
            <>
              <span className="w-8 h-8 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface truncate">
                  Cliente: {cliente.nombre} {cliente.apellidoPaterno ?? ''}
                </p>
                <p className="text-[11px] text-outline">
                  {cliente.telefono ?? 'Sin teléfono'} · {cliente.puntosActuales} pts disponibles
                </p>
              </div>
              {cliente.nivelLealtad && (
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                  style={{
                    backgroundColor: `${cliente.nivelLealtad.colorHex ?? '#6366F1'}22`,
                    color: cliente.nivelLealtad.colorHex ?? '#6366F1',
                    border: `1px solid ${cliente.nivelLealtad.colorHex ?? '#6366F1'}55`,
                  }}
                >
                  {cliente.nivelLealtad.nombre}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="w-8 h-8 rounded-full bg-surface-container-high text-outline flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </span>
              <p className="text-sm font-semibold text-on-surface-variant">
                Venta a público general (sin cliente)
              </p>
            </>
          )}
        </div>

        {/* #1: Alerta de deuda pendiente del cliente (solo si hay saldo > 0) */}
        {cliente?.cuentaCredito?.estaActivo &&
          Number(cliente.cuentaCredito.saldoPendiente) > 0 && (
            <div
              className={`rounded-2xl border p-3 space-y-2 ${
                cobrarDeuda
                  ? 'bg-warning/10 border-warning/40'
                  : 'bg-error/10 border-error/30'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs ${
                    cobrarDeuda
                      ? 'bg-warning/20 text-warning'
                      : 'bg-error/20 text-error'
                  }`}
                >
                  !
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-on-surface leading-snug">
                    Este cliente tiene{' '}
                    <strong className="text-error">
                      ${cliente.cuentaCredito.saldoPendiente.toFixed(2)}
                    </strong>{' '}
                    de deuda pendiente.
                  </p>
                  {!cobrarDeuda && (
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      Si deseas cobrarla ahora, se agregará como un pago
                      adicional dentro de esta venta.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCobrarDeuda(true)}
                  disabled={cobrarDeuda}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors ${
                    cobrarDeuda
                      ? 'bg-warning/20 text-warning border-warning/40 cursor-default'
                      : 'bg-surface text-on-surface border-outline/30 hover:bg-surface-container-high'
                  }`}
                >
                  {cobrarDeuda ? '✓ Cobrando deuda' : `Cobrar deuda (${cliente.cuentaCredito.saldoPendiente.toFixed(2)})`}
                </button>
                {cobrarDeuda && (
                  <button
                    type="button"
                    onClick={() => setCobrarDeuda(false)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-outline/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    Omitir
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Total Prominente */}
        <div className="p-4 spatial-glass rounded-2xl text-center space-y-0.5 border border-outline/20 shadow-inner">
          <p className="text-[10px] font-label-sm uppercase tracking-wider text-outline">
            TOTAL A COBRAR
          </p>
          <p className="text-4xl font-black text-primary font-display-lg font-mono">
            ${total.toFixed(2)}
          </p>
          {(descuentoLealtad > 0 || montoCanje > 0 || descuentoCupon > 0 || deudaPendiente > 0) && (
            <div className="space-y-0.5">
              {deudaPendiente > 0 && (
                <p className="text-[11px] font-label-sm text-error">
                  Venta: ${totalVenta.toFixed(2)} + Deuda: ${deudaPendiente.toFixed(2)}
                </p>
              )}
              {descuentoLealtad > 0 && (
                <p className="text-[11px] font-label-sm text-success">
                  Descuento {cliente?.nivelLealtad?.nombre}: -${descuentoLealtad.toFixed(2)}
                </p>
              )}
              {descuentoCupon > 0 && (
                <p className="text-[11px] font-label-sm text-success">
                  Cupón {cuponAplicado?.codigo}: -${descuentoCupon.toFixed(2)}
                </p>
              )}
              {montoCanje > 0 && (
                <p className="text-[11px] font-label-sm text-success">
                  Canje: -${montoCanje.toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── D12: Cupón de descuento ─────────────────────────────────────── */}
        <div className="rounded-2xl border border-outline/20 p-3 space-y-2.5">
          {!cuponAplicado ? (
            <>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-primary font-label-sm">
                <Ticket className="w-3.5 h-3.5" />
                Cupón de descuento (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codigoCuponInput}
                  onChange={(e) => setCodigoCuponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      aplicarCupon();
                    }
                  }}
                  placeholder="Ingresa el código del cupón"
                  className="flex-1 px-3 py-2 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
                />
                <button
                  type="button"
                  onClick={aplicarCupon}
                  disabled={cuponValidando || !codigoCuponInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold font-label-sm bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {cuponValidando ? 'Validando...' : 'Aplicar'}
                </button>
              </div>
              {cuponError && (
                <p className="text-[11px] font-label-sm text-error flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {cuponError}
                </p>
              )}
              {cuponInvalido && (
                <p className="text-[11px] font-label-sm text-warning flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{cuponInvalido}</span>
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface truncate">
                  Cupón {cuponAplicado.codigo}
                </p>
                <p className="text-[11px] text-outline truncate">
                  {cuponAplicado.nombre} ·{' '}
                  {cuponAplicado.tipoDescuento === 'PORCENTAJE'
                    ? `${cuponAplicado.valorDescuento}%`
                    : `$${cuponAplicado.valorDescuento.toFixed(2)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCuponAplicado(null);
                  setCuponError(null);
                  setCuponInvalido(null);
                }}
                className="p-1 text-outline hover:text-error transition-colors"
                aria-label="Quitar cupón"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── D10/#8: Selector de cliente (siempre disponible) y canje ─────── */}
        <div className="rounded-2xl border border-outline/20 p-3 space-y-2.5 relative">
          {!cliente ? (
            <>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-primary font-label-sm">
                <UserSearch className="w-3.5 h-3.5" />
                Cliente (opcional)
              </label>
              <input
                type="text"
                value={busquedaCliente}
                onChange={(e) => {
                  setBusquedaCliente(e.target.value);
                  setMostrarResultados(true);
                }}
                onFocus={() => setMostrarResultados(true)}
                placeholder="Buscar por nombre, teléfono o email..."
                className="w-full px-3 py-2 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
              />
              {mostrarResultados && (buscandoCliente || resultados.length > 0) && (
                <ul className="absolute left-3 right-3 top-full mt-1 z-10 bg-surface border border-outline/20 rounded-xl shadow-xl divide-y divide-outline/20 max-h-52 overflow-y-auto">
                  {buscandoCliente && (
                    <li className="px-3 py-2 text-xs text-on-surface-variant">
                      Buscando...
                    </li>
                  )}
                  {resultados.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => seleccionarCliente(r)}
                        className="w-full px-3 py-2 text-left hover:bg-surface-container-high transition-colors"
                      >
                        <span className="text-sm font-medium text-on-surface">
                          {r.nombre} {r.apellidoPaterno ?? ''}
                        </span>
                        <span className="block text-[11px] text-outline">
                          {r.telefono ?? 'Sin teléfono'}
                          {r.nivelLealtad ? ` · ${r.nivelLealtad.nombre}` : ''} ·{' '}
                          {r.puntosActuales} pts
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-outline truncate">
                  ¿Venta equivocada? Quitar cliente:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCliente(null);
                    setPuntosACanjearInput('');
                  }}
                  className="p-1 text-outline hover:text-error transition-colors"
                  aria-label="Quitar cliente de la venta"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Canje de puntos */}
              {programa?.habilitado &&
                programa.permitirCanje &&
                maxPuntosCanjeables >= (programa.canjeMinimoPuntos ?? 0) && (
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 bg-surface-container-low rounded-xl p-2">
                    <Coins className="w-4 h-4 text-primary shrink-0" />
                    <input
                      type="number"
                      min={0}
                      step={50}
                      max={maxPuntosCanjeables}
                      value={puntosACanjearInput}
                      onChange={(e) => setPuntosACanjearInput(e.target.value)}
                      placeholder={`Canjear puntos (máx. ${maxPuntosCanjeables})`}
                      className="w-full px-2 py-1.5 bg-surface border border-outline/20 rounded-lg text-primary text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPuntosACanjearInput(String(maxPuntosCanjeables))
                      }
                      className="text-[11px] font-semibold text-primary underline underline-offset-2 shrink-0"
                    >
                      Usar todo
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Métodos de Pago Tabs — #8: se muestra "Fiar" si el cliente tiene crédito */}
        <div
          className={`grid gap-2.5 ${
            cliente?.cuentaCredito?.estaActivo ? 'grid-cols-4' : 'grid-cols-3'
          }`}
        >
          <button
            type="button"
            onClick={() => setMetodoPago('efectivo')}
            className={`p-3 rounded-2xl border font-label-sm text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
              metodoPago === 'efectivo'
                ? 'bg-primary text-on-primary border-primary shadow-lg scale-[1.02]'
                : 'spatial-glass text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
            }`}
          >
            <Banknote className="w-5 h-5" />
            <span>Efectivo</span>
          </button>

          <button
            type="button"
            onClick={() => setMetodoPago('tarjeta')}
            className={`p-3 rounded-2xl border font-label-sm text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
              metodoPago === 'tarjeta'
                ? 'bg-primary text-on-primary border-primary shadow-lg scale-[1.02]'
                : 'spatial-glass text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span>Tarjeta / TPAL</span>
          </button>

          <button
            type="button"
            onClick={() => setMetodoPago('mixto')}
            className={`p-3 rounded-2xl border font-label-sm text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
              metodoPago === 'mixto'
                ? 'bg-primary text-on-primary border-primary shadow-lg scale-[1.02]'
                : 'spatial-glass text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span>Pago Mixto</span>
          </button>

          {cliente?.cuentaCredito?.estaActivo && (
            <button
              type="button"
              disabled={!creditoSuficiente}
              onClick={() => setMetodoPago('credito')}
              title={
                creditoSuficiente
                  ? `Fiá hasta $${(creditoDisponible ?? 0).toFixed(2)}`
                  : `Crédito disponible insuficiente ($${(creditoDisponible ?? 0).toFixed(2)})`
              }
              className={`p-3 rounded-2xl border font-label-sm text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                metodoPago === 'credito'
                  ? 'bg-primary text-on-primary border-primary shadow-lg scale-[1.02]'
                  : creditoSuficiente
                  ? 'spatial-glass text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
                  : 'opacity-40 cursor-not-allowed spatial-glass text-outline border-outline/20'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span>Fiar</span>
            </button>
          )}
        </div>

        {/* Aviso de crédito (#8) */}
        {metodoPago === 'credito' && (
          <div className="p-2.5 bg-warning/10 border border-warning/30 rounded-xl text-xs text-on-surface-variant font-label-sm">
            Se registrará una deuda de <strong>${total.toFixed(2)}</strong> a nombre de{' '}
            <strong>
              {cliente?.nombre} {cliente?.apellidoPaterno ?? ''}
            </strong>
            . Crédito disponible después de esta venta:{' '}
            <strong>${r2((creditoDisponible ?? 0) - total).toFixed(2)}</strong>.
          </div>
        )}

        {/* Formulario según Método */}
        <form onSubmit={handleCheckoutSubmit} className="space-y-3.5">
          {(metodoPago === 'efectivo' || metodoPago === 'mixto') && (
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-primary font-label-sm">
                Monto Recibido en Efectivo ($)
              </label>
              <input
                type="number"
                step="0.50"
                value={montoEfectivo}
                onChange={(e) => setMontoEfectivo(e.target.value)}
                placeholder={total.toFixed(2)}
                required={metodoPago === 'efectivo'}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-bold text-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />

              {/* Botones de Efectivo Rápido */}
              <div className="flex gap-1.5">
                {[total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, 200, 500].map(
                  (monto, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickCash(monto)}
                      className="flex-1 py-2 spatial-glass rounded-xl text-xs font-label-sm font-semibold text-primary hover:bg-surface-container-high border border-outline/20 active:scale-95 transition-all"
                    >
                      ${monto}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {(metodoPago === 'tarjeta' || metodoPago === 'mixto') && (
            <div className="space-y-2.5">
              {metodoPago === 'mixto' && (
                <div>
                  <label className="block text-xs font-semibold text-primary font-label-sm mb-1">
                    Monto a Cobrar en Tarjeta ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={montoTarjeta}
                    onChange={(e) => setMontoTarjeta(e.target.value)}
                    placeholder={(total - efectivoNum).toFixed(2)}
                    required
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-bold text-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-outline font-label-sm mb-1">
                  Referencia / Folio de Vouché (Opcional)
                </label>
                <input
                  type="text"
                  value={referenciaTarjeta}
                  onChange={(e) => setReferenciaTarjeta(e.target.value)}
                  placeholder="Ej. Auth 492810"
                  className="w-full px-4 py-2 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
                />
              </div>
            </div>
          )}

          {/* Desglose de Cambio */}
          {metodoPago !== 'tarjeta' && efectivoNum > 0 && (
            <div className="p-3.5 spatial-glass rounded-2xl border border-outline/20 flex items-center justify-between">
              <span className="text-xs font-semibold text-outline font-body-md">
                CAMBIO A ENTREGAR:
              </span>
              <span
                className={`text-2xl font-bold font-mono ${
                  isPagoSuficiente ? 'text-success' : 'text-error'
                }`}
              >
                ${cambio.toFixed(2)}
              </span>
            </div>
          )}

          {presupuestoGuardado && (
            <div className="p-3.5 rounded-2xl border border-success/30 bg-success/10 space-y-2.5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="text-xs text-on-surface font-body-md leading-snug">
                  <span className="font-bold">Presupuesto guardado:</span>{' '}
                  {presupuestoGuardado.folio}. Puedes cobrarlo después desde la
                  lista de presupuestos.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPresupuestoParaTicket(presupuestoGuardado)}
                className="w-full py-2 bg-primary text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm hover:scale-[1.01] transition-transform font-display-lg"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ticket de Presupuesto</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={guardarComoPresupuesto}
            disabled={guardandoPresupuesto || (cart.length === 0 && combos.length === 0)}
            className="w-full py-3 rounded-2xl border border-outline/30 text-primary font-bold font-display-lg text-sm flex items-center justify-center gap-2 transition-all hover:bg-surface-container-low min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardandoPresupuesto ? (
              <span>Guardando presupuesto...</span>
            ) : (
              <>
                <Receipt className="w-4 h-4" />
                <span>Guardar como presupuesto</span>
              </>
            )}
          </button>

          <button
            type="submit"
            disabled={
              isLoading ||
              (!isPagoSuficiente && metodoPago !== 'tarjeta' && metodoPago !== 'credito')
            }
            className={`w-full py-3.5 rounded-2xl font-bold font-display-lg text-lg flex items-center justify-center gap-2.5 transition-all min-h-[48px] ${
              isPagoSuficiente || metodoPago === 'tarjeta'
                ? 'bg-primary text-on-primary shadow-lg hover:scale-[1.01] active:scale-95'
                : 'bg-surface-container-high text-outline cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <span>Procesando venta...</span>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>CONFIRMAR Y FINALIZAR ($ {total.toFixed(2)})</span>
              </>
            )}
          </button>
        </form>

        <PresupuestoTicketModal
          presupuesto={presupuestoParaTicket}
          onClose={() => setPresupuestoParaTicket(null)}
        />
      </div>
    </div>
  );
};
