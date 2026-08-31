import { memo } from 'react';
import { BadgePercent, Gift, PackageCheck } from 'lucide-react';
import type { ComboConResumen } from '../../types/pos';

interface ComboCardProps {
  combo: ComboConResumen;
  onSelect: (combo: ComboConResumen) => void;
}

export const ComboCard = memo(function ComboCard({
  combo,
  onSelect,
}: ComboCardProps) {
  const totalProductos = combo.productos.reduce(
    (acc, p) => acc + p.cantidad,
    0,
  );
  const esPorcentaje = combo.tipoPrecio === 'DESCUENTO_PCT';

  return (
    <div
      onClick={() => onSelect(combo)}
      className="spatial-glass rounded-[28px] overflow-hidden bento-card-hover group cursor-pointer flex flex-col p-5 border border-primary/40 hover:border-primary/80 select-none min-h-[140px] justify-between"
    >
      {/* Fila Superior: Ícono + Ahorro */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center transition-transform group-hover:scale-105"
          title="Combo / Paquete promocional"
        >
          <Gift className="w-4 h-4 text-primary" />
        </div>
        <span className="px-2 py-0.5 rounded-full bg-success/15 border border-success/30 text-success text-[10px] font-label-sm font-bold flex items-center gap-1">
          {esPorcentaje ? (
            <>
              <BadgePercent className="w-3 h-3" />
              AHORRA {combo.valorPrecio}%
            </>
          ) : (
            <>
              <PackageCheck className="w-3 h-3" />
              Ahorra ${combo.resumen.ahorro.toFixed(2)}
            </>
          )}
        </span>
      </div>

      {/* Nombre + descripción */}
      <h3 className="font-headline-md text-base text-primary mb-1 line-clamp-1 leading-snug font-semibold text-left">
        {combo.nombre}
      </h3>
      <p className="text-[11px] text-outline font-label-sm line-clamp-1 mb-2">
        {combo.descripcion || `${totalProductos} producto(s) incluidos`}
      </p>

      {/* Precio Prominente */}
      <div className="mt-auto w-full flex items-end justify-between gap-2 pt-2 border-t border-outline/10 text-center">
        <div className="text-left leading-none">
          <p className="font-label-sm text-xl font-bold text-primary font-mono">
            ${combo.resumen.precioCombo.toFixed(2)}
          </p>
          <p className="text-[10px] text-outline font-label-sm line-through">
            ${combo.resumen.precioOriginal.toFixed(2)}
          </p>
        </div>
        <span className="text-[10px] font-label-sm font-semibold text-success">
          {totalProductos} art.
        </span>
      </div>
    </div>
  );
});