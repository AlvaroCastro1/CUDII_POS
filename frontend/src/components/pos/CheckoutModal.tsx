import React, { useState } from 'react';
import {
  CreditCard,
  Banknote,
  Receipt,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { usePosStore } from '../../store/usePosStore';
import type { Venta } from '../../types/pos';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (venta: Venta) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const cart = usePosStore((s) => s.cart);
  const clearCart = usePosStore((s) => s.clearCart);
  const descuentoGeneral = usePosStore((s) => s.descuentoGeneral);
  const activeSession = usePosStore((s) => s.activeSession);

  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'mixto'>('efectivo');
  const [montoEfectivo, setMontoEfectivo] = useState<string>('');
  const [montoTarjeta, setMontoTarjeta] = useState<string>('');
  const [referenciaTarjeta, setReferenciaTarjeta] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = cart.reduce(
    (acc, item) => acc + item.cantidad * item.precioUnitario,
    0,
  );
  const totalDescuentos =
    cart.reduce((acc, item) => acc + item.descuento, 0) + descuentoGeneral;
  const total = Math.max(0, subtotal - totalDescuentos);

  const efectivoNum = parseFloat(montoEfectivo) || 0;
  const tarjetaNum = parseFloat(montoTarjeta) || 0;
  const totalPagado = metodoPago === 'efectivo' ? efectivoNum : efectivoNum + tarjetaNum;
  const cambio = Math.max(0, efectivoNum - (total - tarjetaNum));

  const isPagoSuficiente =
    metodoPago === 'efectivo'
      ? efectivoNum >= total
      : metodoPago === 'tarjeta'
      ? true
      : totalPagado >= total;

  const handleQuickCash = (monto: number) => {
    setMontoEfectivo(monto.toString());
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPagoSuficiente && metodoPago !== 'tarjeta') {
      setError('El monto pagado es menor al total a cobrar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const pagos = [];
      if (metodoPago === 'efectivo') {
        pagos.push({
          metodo: 'efectivo',
          montoRecibido: efectivoNum || total,
          montoPagado: total,
          cambio,
        });
      } else if (metodoPago === 'tarjeta') {
        pagos.push({
          metodo: 'tarjeta',
          montoRecibido: total,
          montoPagado: total,
          referencia: referenciaTarjeta || undefined,
        });
      } else {
        if (efectivoNum > 0) {
          pagos.push({
            metodo: 'efectivo',
            montoRecibido: efectivoNum,
            montoPagado: Math.min(efectivoNum, total),
            cambio,
          });
        }
        if (tarjetaNum > 0) {
          pagos.push({
            metodo: 'tarjeta',
            montoRecibido: tarjetaNum,
            montoPagado: Math.min(tarjetaNum, Math.max(0, total - efectivoNum)),
            referencia: referenciaTarjeta || undefined,
          });
        }
      }

      const payload = {
        sesionCajaId: activeSession?.id,
        cajaId: activeSession?.cajaId,
        detalles: cart.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          unidadMedida: item.unidadMedida,
          descuento: item.descuento || 0,
        })),
        pagos,
        descuentoGeneral,
      };

      const res = await api.post('/sales', payload);

      clearCart();
      onSuccess(res.data);
    } catch (err: unknown) {
      console.error('Error al procesar cobro:', err);
      setError(errorMessage(err, 'Ocurrió un error al procesar la venta en la caja'));
    } finally {
      setIsLoading(false);
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

        {/* Total Prominente */}
        <div className="p-4 spatial-glass rounded-2xl text-center space-y-0.5 border border-outline/20 shadow-inner">
          <p className="text-[10px] font-label-sm uppercase tracking-wider text-outline">
            TOTAL A COBRAR
          </p>
          <p className="text-4xl font-black text-primary font-display-lg font-mono">
            ${total.toFixed(2)}
          </p>
        </div>

        {/* Métodos de Pago Tabs */}
        <div className="grid grid-cols-3 gap-2.5">
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
        </div>

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

          <button
            type="submit"
            disabled={isLoading || (!isPagoSuficiente && metodoPago !== 'tarjeta')}
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
      </div>
    </div>
  );
};
