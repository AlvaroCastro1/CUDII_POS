import React, { memo, useEffect, useState } from 'react';
import { Package, Scale, Droplet, Ruler, Wrench } from 'lucide-react';
import { api } from '../../lib/api';
import type { Producto } from '../../types/pos';

interface ProductGridProps {
  onSelectProduct: (producto: Producto) => void;
  selectedCategoriaId?: string | null;
  refreshKey?: number;
}

/**
 * Retorna el ícono representativo de la Unidad de Medida exacta:
 * - Litro / Volumen: Droplet (Cyan)
 * - Metro / Longitud: Ruler (Emerald)
 * - Kilo / Pesaje: Scale (Amber)
 * - Servicio / Hora: Wrench (Purple)
 * - Pieza / Paquete: Package (Primary)
 */
const getUnitIcon = (unidadMedida?: string) => {
  const unit = (unidadMedida || '').toLowerCase().trim();

  // 1. Litro / Volumen
  if (/\b(litro|litros|lt|lts|ml|mililitro|mililitros)\b/.test(unit) || unit === 'l') {
    return <Droplet className="w-4 h-4 text-primary" aria-label="Venta por Litro" />;
  }

  // 2. Metro / Longitud
  if (/\b(metro|metros|cm|centimetro|centimetros)\b/.test(unit) || unit === 'm') {
    return <Ruler className="w-4 h-4 text-success" aria-label="Venta por Metro" />;
  }

  // 3. Kilo / Pesaje / Granel
  if (/\b(kilo|kilogramo|kg|gramo|gramos|gr)\b/.test(unit)) {
    return <Scale className="w-4 h-4 text-warning" aria-label="Venta por Kilo / Báscula" />;
  }

  // 4. Servicio / Hora
  if (/\b(servicio|servicios|srv|hora|horas)\b/.test(unit)) {
    return <Wrench className="w-4 h-4 text-purple-400" aria-label="Servicio" />;
  }

  // 5. Por defecto: Pieza / Paquete / Unidad
  return <Package className="w-4 h-4 text-primary/80" aria-label="Venta por Pieza" />;
};

const ProductCard = memo(function ProductCard({
  producto,
  onSelect,
}: {
  producto: Producto;
  onSelect: (producto: Producto) => void;
}) {
  return (
    <div
      onClick={() => onSelect(producto)}
      className="spatial-glass rounded-[28px] overflow-hidden bento-card-hover group cursor-pointer flex flex-col p-5 border border-outline/20 hover:border-outline/50 select-none min-h-[140px] justify-between text-center items-center"
    >
      {/* Fila Superior: Ícono de Unidad de Medida Centrado */}
      <div className="flex items-center justify-center mb-2">
        <div
          className="w-9 h-9 rounded-xl bg-surface-container-high border border-outline/20 flex items-center justify-center transition-transform group-hover:scale-105"
          title={`Unidad: ${producto.unidadMedida || 'pieza'}`}
        >
          {getUnitIcon(producto.unidadMedida)}
        </div>
      </div>

      {/* Nombre del Producto Centrado */}
      <h3 className="font-headline-md text-base text-primary mb-2 line-clamp-2 leading-snug font-semibold text-center">
        {producto.nombre}
      </h3>

      {/* Fila Inferior: Precio Centrado Prominente */}
      <div className="mt-auto w-full flex items-center justify-center pt-2 border-t border-outline/10 text-center">
        <p className="font-label-sm text-xl font-bold text-primary font-mono text-center">
          ${producto.precioVentaBase.toFixed(2)}
        </p>
      </div>
    </div>
  );
});

export const ProductGrid = memo(function ProductGrid({
  onSelectProduct,
  selectedCategoriaId,
  refreshKey = 0,
}: ProductGridProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTopProducts = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/products', {
          params: {
            limit: 24,
            categoriaId: selectedCategoriaId || undefined,
          },
        });
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data?.datos)
          ? res.data.datos
          : [];
        setProductos(list);
      } catch (err) {
        console.error('Error al cargar catálogo de POS:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTopProducts();
  }, [selectedCategoriaId, refreshKey]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-32 spatial-glass rounded-[28px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!productos || productos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 spatial-glass rounded-[28px] p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-primary">No se encontraron productos</p>
        <p className="text-xs text-outline">
          Usa la barra de búsqueda o selecciona otra categoría.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {Array.isArray(productos) &&
        productos.map((producto) => (
          <ProductCard
            key={producto.id}
            producto={producto}
            onSelect={onSelectProduct}
          />
        ))}
    </div>
  );
});
