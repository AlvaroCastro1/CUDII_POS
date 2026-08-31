import { useState } from 'react';
import { BadgePercent, Crown, Gift, Minus, Plus, X } from 'lucide-react';
import type { ComboConResumen } from '../../types/pos';

interface ComboDetalleModalProps {
  combo: ComboConResumen | null;
  onClose: () => void;
  onAdd: (combo: ComboConResumen, cantidad: number) => void;
}

export const ComboDetalleModal: React.FC<ComboDetalleModalProps> = ({
  combo,
  onClose,
  onAdd,
}) => {
  const [cantidad, setCantidad] = useState(1);

  if (!combo) return null;

  const esPorcentaje = combo.tipoPrecio === 'DESCUENTO_PCT';
  const totalProductos = combo.productos.reduce(
    (acc, p) => acc + p.cantidad,
    0,
  );

  const handleAdd = () => {
    onAdd(combo, cantidad);
    setCantidad(1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-4 relative max-h-[82vh] overflow-y-auto custom-scrollbar text-on-surface my-auto">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 border-b border-outline/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center shrink-0 shadow-lg">
              <Gift className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-primary font-headline-md leading-snug">
                {combo.nombre}
              </h2>
              <p className="text-[11px] text-outline font-body-md">
                Paquete promocional · {totalProductos} artículos
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

        {combo.descripcion && (
          <p className="text-xs text-on-surface-variant font-body-md">
            {combo.descripcion}
          </p>
        )}

        {/* Contenido del paquete */}
        <div className="rounded-2xl border border-outline/20 overflow-hidden">
          <p className="px-3.5 py-2 text-[10px] font-label-sm font-semibold uppercase tracking-wider text-outline bg-surface-container-low border-b border-outline/10">
            Incluye
          </p>
          <ul className="divide-y divide-outline/10">
            {combo.productos.map((p) => (
              <li
                key={p.productoId}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {p.cantidad} × {p.producto?.nombre}
                  </p>
                  <p className="text-[11px] text-outline font-label-sm">
                    ${((p.producto?.precioVentaBase ?? 0) * p.cantidad).toFixed(2)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Beneficio */}
        <div className="p-3.5 rounded-2xl space-y-1.5 border border-success/30 bg-success/10">
          <div className="flex justify-between text-xs">
            <span className="text-on-surface-variant font-body-md">
              Precio si compras por separado
            </span>
            <span className="font-label-sm font-semibold text-on-surface font-mono">
              ${combo.resumen.precioOriginal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-on-surface-variant font-body-md">
              {esPorcentaje ? (
                <span className="inline-flex items-center gap-1">
                  <BadgePercent className="w-3.5 h-3.5" /> Descuento {combo.valorPrecio}%
                </span>
              ) : (
                'Precio del paquete'
              )}
            </span>
            <span className="font-label-sm font-semibold text-primary font-mono">
              ${combo.resumen.precioCombo.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-xs pt-1 border-t border-success/20">
            <span className="inline-flex items-center gap-1 text-success font-label-sm font-semibold">
              <Crown className="w-3.5 h-3.5" />
              Ahorro
            </span>
            <span className="font-label-sm font-bold text-success font-mono">
              -${combo.resumen.ahorro.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Cantidad + Agregar */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="w-9 h-9 rounded-full bg-surface-container-high border border-outline/20 flex items-center justify-center text-primary active:scale-95 transition-all"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-primary font-label-sm text-lg font-bold min-w-[28px] text-center">
              {cantidad}
            </span>
            <button
              onClick={() => setCantidad((c) => c + 1)}
              className="w-9 h-9 rounded-full bg-surface-container-high border border-outline/20 flex items-center justify-center text-primary active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 max-w-[220px] py-3 rounded-2xl bg-primary text-on-primary font-bold font-display-lg text-sm hover:scale-[1.01] active:scale-95 transition-all shadow-lg"
          >
            Agregar al ticket (+${(combo.resumen.precioCombo * cantidad).toFixed(2)})
          </button>
        </div>
      </div>
    </div>
  );
};