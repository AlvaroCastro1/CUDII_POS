import { memo } from 'react';
import { CreditCard, Trash2 } from 'lucide-react';
import { usePosStore } from '../../store/usePosStore';

interface CartSummaryProps {
  onCheckout: () => void;
}

export const CartSummary = memo(function CartSummary({
  onCheckout,
}: CartSummaryProps) {
  const cart = usePosStore((s) => s.cart);
  const combos = usePosStore((s) => s.combos);
  const clearCart = usePosStore((s) => s.clearCart);
  const descuentoGeneral = usePosStore((s) => s.descuentoGeneral);

  const subtotal =
    cart.reduce(
      (acc, item) => acc + item.cantidad * item.precioUnitario,
      0,
    ) + combos.reduce((acc, c) => acc + c.cantidad * c.precioUnitario, 0);
  const totalDescuentos =
    cart.reduce((acc, item) => acc + item.descuento, 0) + descuentoGeneral;
  const total = Math.max(0, subtotal - totalDescuentos);

  const tieneDescuentos = totalDescuentos > 0;

  return (
    <div className="p-6 bg-surface-container-highest/60 border-t border-outline/20 space-y-4">
      <div className="space-y-2">
        {/* Mostrar Subtotal y Descuentos ÚNICAMENTE cuando existan promociones/descuentos aplicados */}
        {tieneDescuentos && (
          <div className="space-y-1.5 pb-2 border-b border-outline/10">
            <div className="flex justify-between text-outline text-xs">
              <span className="font-body-md">Subtotal</span>
              <span className="font-label-sm font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-success text-xs">
              <span className="font-body-md">Descuento Aplicado</span>
              <span className="font-label-sm">-${totalDescuentos.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-end pt-1">
          <p className="text-primary font-headline-md text-xl font-bold">Total</p>
          <p className="text-primary font-display-lg text-4xl font-black font-mono">
            ${total.toFixed(2)}
          </p>
        </div>
      </div>

      <button
        disabled={cart.length === 0 && combos.length === 0}
        onClick={onCheckout}
        className={`w-full h-16 rounded-2xl font-display-lg text-xl font-bold flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] ${
          cart.length === 0 && combos.length === 0
            ? 'bg-surface-container-high text-outline cursor-not-allowed'
            : 'bg-primary text-on-primary shadow-lg'
        }`}
      >
        <CreditCard className="w-6 h-6" />
        <span>COBRAR</span>
      </button>

      {cart.length > 0 || combos.length > 0 ? (
        <div className="flex justify-end pt-1">
          <button
            onClick={clearCart}
            className="text-xs font-label-sm text-error hover:underline flex items-center gap-1 opacity-80 hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vaciar Carrito</span>
          </button>
        </div>
      ) : null}
    </div>
  );
});
