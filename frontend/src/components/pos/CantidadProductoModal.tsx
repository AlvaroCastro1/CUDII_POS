import React, { useEffect, useMemo, useState } from 'react';
import { X, Scale, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import type { Producto, PrecioPorUnidad } from '../../types/pos';

const UNIDADES_DISCRETAS = new Set([
  'pieza', 'piezas', 'pza', 'pzas', 'caja', 'cajas',
  'docena', 'docenas', 'doc', 'par', 'pares',
  'media docena', 'servicio', 'kit',
]);

function isUnidadDiscreta(unidad: string): boolean {
  return UNIDADES_DISCRETAS.has(unidad.toLowerCase().trim());
}

export interface PresentacionSeleccion {
  id: string;
  nombre: string;
  precio: number;
  cantidadMinima: number;
}

interface CantidadProductoModalProps {
  producto: Producto | null;
  onClose: () => void;
  onConfirm: (
    producto: Producto,
    cantidad: number,
    presentacion: PresentacionSeleccion | null,
  ) => void;
}

/**
 * Modal de cantidad para productos:
 * - A granel (KILO/LITRO/METRO): entrada decimal con paso 0.001 (ej. 0.350 kg).
 * - Con presentaciones (caja, paquete, medio kilo...): selector que fija
 *   cantidad mínima y precio de la presentación.
 * - Producto normal sin presentaciones: confirma cantidad 1 al instante.
 */
export const CantidadProductoModal: React.FC<CantidadProductoModalProps> = ({
  producto,
  onClose,
  onConfirm,
}) => {
  const [precios, setPrecios] = useState<PrecioPorUnidad[]>([]);
  const [cantidad, setCantidad] = useState('1');
  const [presentacionId, setPresentacionId] = useState<string | null>(null);

  const esGranel = producto?.esGranel || false;
  const unidad = (producto?.unidadMedida || 'pieza').toLowerCase();

  // Cargar presentaciones del producto al abrir (la lista POS no las incluye)
  useEffect(() => {
    if (!producto) return;
    setPrecios([]);
    setCantidad('1');
    setPresentacionId(null);

    let activo = true;
    const cargar = async () => {
      try {
        const res = await api.get(`/products/${producto.id}`);
        const detalle = res.data?.producto || res.data;
        const lista: PrecioPorUnidad[] = Array.isArray(detalle?.preciosPorUnidad)
          ? detalle.preciosPorUnidad
          : [];
        if (!activo) return;
        setPrecios(lista);
        if (!esGranel && lista.length === 0) {
          onConfirm(producto, 1, null);
        }
      } catch {
        if (activo && !esGranel) {
          onConfirm(producto, 1, null);
        }
      }
    };
    cargar();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto?.id, esGranel]);

  const presentaciones = useMemo(() => {
    if (!esGranel) {
      return (precios || []).filter((p) => p.unidad !== 'MAYOREO');
    }
    return (precios || []).filter(
      (p) => p.unidad === 'MEDIO' || p.unidad === 'CAJA' || p.unidad === 'PERSONALIZADO',
    );
  }, [precios, esGranel]);

  const presentacionSeleccionada = presentaciones.find(
    (p) => p.id === presentacionId,
  );

  const precioUnitario = presentacionSeleccionada
    ? presentacionSeleccionada.precio
    : producto?.precioVentaBase ?? 0;

  const cantidadNum = parseFloat(cantidad) || 0;
  const total = cantidadNum * precioUnitario;

  const esDiscreta = !esGranel && isUnidadDiscreta(unidad);
  const tieneDecimal = cantidad.includes('.') && parseFloat(cantidad) % 1 !== 0;
  const errorCantidad = esDiscreta && cantidadNum > 0 && tieneDecimal
    ? `Este producto es por ${unidad}. La cantidad debe ser un número entero (ej. 1, 2, 3).`
    : '';

  const puedeConfirmar = cantidadNum > 0 && !errorCantidad;

  const handleConfirm = () => {
    if (!producto || !puedeConfirmar) return;
    const presentacion: PresentacionSeleccion | null = presentacionSeleccionada
      ? {
          id: presentacionSeleccionada.id,
          nombre:
            presentacionSeleccionada.nombreAlternativo ||
            `${presentacionSeleccionada.unidad} (${presentacionSeleccionada.cantidadMinima})`,
          precio: presentacionSeleccionada.precio,
          cantidadMinima: presentacionSeleccionada.cantidadMinima,
        }
      : null;
    onConfirm(producto, cantidadNum, presentacion);
  };

  if (!producto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 overflow-y-auto">
      <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-4 text-on-surface my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold shadow-lg">
              <Scale className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-primary font-headline-md leading-snug truncate">
                {producto.nombre}
              </h2>
              <p className="text-[11px] text-outline font-body-md">
                {esGranel
                  ? `Se vende a granel (${unidad})`
                  : 'Elige presentación o cantidad'}
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

        {/* Selector de presentación */}
        {presentaciones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {!esGranel && (
              <button
                type="button"
                onClick={() => setPresentacionId(null)}
                className={`px-3 py-2 rounded-full border text-xs font-semibold transition-all ${
                  presentacionId === null
                    ? 'bg-primary text-on-primary border-primary'
                    : 'spatial-glass text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
                }`}
              >
                {unidad} suelta
              </button>
            )}
            {presentaciones.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPresentacionId(p.id);
                  setCantidad(p.cantidadMinima.toString());
                }}
                className={`px-3 py-2 rounded-full border text-xs font-semibold transition-all ${
                  presentacionId === p.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'spatial-glass text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
                }`}
              >
                {p.nombreAlternativo || `${p.unidad} (${p.cantidadMinima})`}
                <span className="opacity-80 ml-1">${p.precio.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Cantidad */}
        <div className="grid gap-1.5">
          <label className="block text-xs font-semibold text-primary font-label-sm">
            Cantidad ({unidad})
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={esGranel ? 0.001 : 1}
              step={esGranel ? 0.001 : 1}
              autoFocus
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={`w-full px-4 py-2.5 bg-surface-container-low border rounded-xl text-primary font-bold text-xl focus:outline-none focus:ring-2 font-mono ${
                errorCantidad
                  ? 'border-error focus:ring-error'
                  : 'border-outline/20 focus:ring-primary'
              }`}
            />
            <span className="text-outline text-sm font-label-sm shrink-0">{unidad}</span>
          </div>
          {errorCantidad && (
            <div className="flex items-center gap-1.5 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-error shrink-0" />
              <p className="text-[11px] text-error font-medium">{errorCantidad}</p>
            </div>
          )}
          {esGranel && !errorCantidad && (
            <p className="text-[11px] text-primary">
              Producto a granel — puedes ingresar decimales (ej. 0.350).
            </p>
          )}
          {esDiscreta && !errorCantidad && (
            <p className="text-[11px] text-primary">
              Producto por {unidad} — solo cantidades enteras.
            </p>
          )}
        </div>

        {/* Resumen */}
        <div className="p-3.5 spatial-glass rounded-2xl border border-outline/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-label-sm uppercase tracking-wider text-outline">
              TOTAL
            </p>
            <p className="text-lg font-black text-primary font-mono">
              ${total.toFixed(2)}
            </p>
          </div>
          {presentacionSeleccionada ? (
            <span className="text-[11px] text-on-surface-variant text-right max-w-[150px]">
              {presentacionSeleccionada.nombreAlternativo ||
                presentacionSeleccionada.unidad}{' '}
              a ${presentacionSeleccionada.precio.toFixed(2)}
            </span>
          ) : (
            <span className="text-[11px] text-on-surface-variant text-right max-w-[150px]">
              {cantidadNum.toFixed(esGranel ? 3 : 0)} {unidad} a ${precioUnitario.toFixed(2)}
            </span>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 spatial-glass text-on-surface-variant font-semibold rounded-2xl border border-outline/20 hover:bg-surface-container-high transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!puedeConfirmar}
            onClick={handleConfirm}
            className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-2xl transition-transform hover:scale-[1.02] active:scale-95 shadow-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Agregar al Ticket
          </button>
        </div>
      </div>
    </div>
  );
};
