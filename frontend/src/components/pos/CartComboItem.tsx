import { memo } from 'react';
import { Gift, Minus, Plus, Trash2 } from 'lucide-react';
import { usePosStore, type CartCombo } from '../../store/usePosStore';

interface CartComboItemProps {
  item: CartCombo;
}

export const CartComboItem = memo(function CartComboItem({
  item,
}: CartComboItemProps) {
  const updateComboQuantity = usePosStore((s) => s.updateComboQuantity);
  const removeCombo = usePosStore((s) => s.removeCombo);
  const total = item.cantidad * item.precioUnitario;

  return (
    <div className="flex flex-col p-3 rounded-2xl bg-primary/10 border border-primary/30 space-y-2 group hover:border-primary/60 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Gift className="w-3.5 h-3.5 text-primary" />
            </span>
            <h4 className="text-primary font-body-md text-sm font-semibold truncate">
              {item.nombre}
            </h4>
          </div>
          <span className="inline-block mt-1 text-[10px] font-label-sm font-semibold text-success bg-success/10 border border-success/30 rounded-full px-2 py-0.5">
            Combo · ahorras ${item.ahorro.toFixed(2)}
          </span>
          <p className="text-[10px] text-outline font-label-sm mt-1">
            {item.productos.map((p) => `${p.cantidad} ${p.nombre}`).join(', ')}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => updateComboQuantity(item.comboId, item.cantidad - 1)}
              className="w-7 h-7 rounded-full bg-surface-container-high border border-outline/20 flex items-center justify-center hover:bg-surface-container-high transition-colors text-primary active:scale-95"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-primary font-label-sm text-sm font-bold min-w-[20px] text-center">
              {item.cantidad}
            </span>
            <button
              onClick={() => updateComboQuantity(item.comboId, item.cantidad + 1)}
              className="w-7 h-7 rounded-full bg-surface-container-high border border-outline/20 flex items-center justify-center hover:bg-surface-container-high transition-colors text-primary active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-outline text-[10px] font-label-sm ml-1">
              (${item.precioUnitario.toFixed(2)} c/u)
            </span>
          </div>
        </div>

        <div className="text-right flex items-center gap-3">
          <div>
            <p className="text-primary font-label-sm text-base font-bold">
              ${total.toFixed(2)}
            </p>
            {item.ahorro > 0 && (
              <p className="text-[10px] text-success font-label-sm font-semibold">
                -${item.ahorro.toFixed(2)}
              </p>
            )}
          </div>
          <button
            onClick={() => removeCombo(item.comboId)}
            className="text-error opacity-60 hover:opacity-100 transition-opacity p-1.5 hover:bg-error/10 rounded-lg"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});