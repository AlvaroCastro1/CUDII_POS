import { memo } from 'react';
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { usePosStore, type CartItem as CartItemType } from '../../store/usePosStore';

interface CartItemProps {
  item: CartItemType;
}

export const CartItem = memo(function CartItem({ item }: CartItemProps) {
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const removeFromCart = usePosStore((s) => s.removeFromCart);
  const total = item.cantidad * item.precioUnitario - item.descuento;
  const isStockExceeded = item.cantidad > item.stockDisponible;
  const unidad = (item.unidadMedida || 'pieza').toLowerCase();
  const step = item.esGranel ? 0.001 : 1;

  const handleQtyInput = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      updateQuantity(item.productoId, num, item.presentacionId);
    }
  };

  return (
    <div className="flex flex-col p-3 rounded-2xl bg-surface-container-high border border-outline/10 space-y-2 group hover:border-outline/40 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-primary font-body-md text-sm font-semibold truncate">
            {item.nombre}
          </h4>
          {item.presentacionNombre && (
            <span className="inline-block mt-0.5 text-[10px] font-label-sm font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
              {item.presentacionNombre}
            </span>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {item.esGranel ? (
              <>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={step}
                    step={step}
                    value={item.cantidad}
                    onChange={(e) => handleQtyInput(e.target.value)}
                    className="w-20 h-8 rounded-lg bg-surface-container-low border border-outline/20 text-primary font-label-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Cantidad"
                  />
                  <span className="text-outline text-[10px] font-label-sm">
                    {unidad}
                  </span>
                </div>
                <span className="text-outline text-[10px] font-label-sm ml-1">
                  (${item.precioUnitario.toFixed(2)} {unidad})
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={() => updateQuantity(item.productoId, item.cantidad - 1, item.presentacionId)}
                  className="w-7 h-7 rounded-full bg-surface-container-high border border-outline/20 flex items-center justify-center hover:bg-surface-container-high transition-colors text-primary active:scale-95"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-primary font-label-sm text-sm font-bold min-w-[20px] text-center">
                  {item.cantidad}
                </span>
                <button
                  onClick={() => updateQuantity(item.productoId, item.cantidad + 1, item.presentacionId)}
                  className="w-7 h-7 rounded-full bg-surface-container-high border border-outline/20 flex items-center justify-center hover:bg-surface-container-high transition-colors text-primary active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <span className="text-outline text-[10px] font-label-sm ml-1">
                  (${item.precioUnitario.toFixed(2)} c/u)
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-right flex items-center gap-3">
          <div>
            <p className="text-primary font-label-sm text-base font-bold">
              ${total.toFixed(2)}
            </p>
          </div>
          <button
            onClick={() => removeFromCart(item.productoId, item.presentacionId)}
            className="text-error opacity-60 hover:opacity-100 transition-opacity p-1.5 hover:bg-error/10 rounded-lg"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isStockExceeded && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-warning/10 border border-warning/30 rounded-lg text-warning text-xs font-label-sm">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Stock insuficiente ({item.stockDisponible}). Se registrará negativo.</span>
        </div>
      )}
    </div>
  );
});
