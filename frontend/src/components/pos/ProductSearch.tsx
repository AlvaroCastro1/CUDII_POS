import React, { memo, useState, useEffect, useRef } from 'react';
import { Search, X, Package, Scale, Droplet, Ruler, Wrench } from 'lucide-react';
import { api } from '../../lib/api';
import type { Categoria, Producto, ProductoInventario } from '../../types/pos';

interface ProductSearchProps {
  onSelectProduct: (producto: Producto) => void;
  selectedCategoriaId?: string | null;
  onSelectCategory?: (categoriaId: string | null) => void;
  refreshKey?: number;
}

const getUnitIcon = (unidadMedida?: string) => {
  const unit = (unidadMedida || '').toLowerCase().trim();
  if (/\b(litro|litros|lt|lts|ml|mililitro|mililitros)\b/.test(unit) || unit === 'l') {
    return <Droplet className="w-4 h-4 text-primary" />;
  }
  if (/\b(metro|metros|cm|centimetro|centimetros)\b/.test(unit) || unit === 'm') {
    return <Ruler className="w-4 h-4 text-success" />;
  }
  if (/\b(kilo|kilogramo|kg|gramo|gramos|gr)\b/.test(unit)) {
    return <Scale className="w-4 h-4 text-warning" />;
  }
  if (/\b(servicio|servicios|srv|hora|horas)\b/.test(unit)) {
    return <Wrench className="w-4 h-4 text-purple-400" />;
  }
  return <Package className="w-4 h-4 text-primary/80" />;
};

export const ProductSearch = memo(function ProductSearch({
  onSelectProduct,
  selectedCategoriaId = null,
  onSelectCategory,
}: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar Categorías
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
        setCategorias(list);
      } catch (err) {
        console.error('Error al cargar categorías en POS:', err);
      }
    };
    fetchCategories();
  }, []);

  // Búsqueda Asíncrona con Debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsOpenDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/products/search', {
          params: {
            q: searchTerm,
            categoriaId: selectedCategoriaId || undefined,
          },
        });

        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];

        setResults(list);
        setIsOpenDropdown(true);

        // Auto-seleccionar si es código exacto único
        if (list.length === 1 && list[0].codigoBarras === searchTerm.trim()) {
          handleSelect(list[0]);
        }
      } catch (err) {
        console.error('Error en búsqueda de productos:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategoriaId]);

  const handleSelectCategory = (catId: string | null) => {
    if (onSelectCategory) {
      onSelectCategory(catId);
    }
  };

  const handleSelect = (producto: Producto) => {
    onSelectProduct(producto);
    setSearchTerm('');
    setIsOpenDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full space-y-3">
      {/* Input de Búsqueda Redondeado (Estilo code.html & MD3) */}
      <div className="relative flex items-center w-full group">
        <Search className="absolute left-4 w-4 h-4 text-outline group-focus-within:text-primary transition-colors pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Escanear código de barras o buscar producto..."
          className="w-full h-12 bg-surface-container-high border border-outline/20 rounded-full py-2.5 pl-11 pr-10 text-sm text-primary placeholder:text-outline/60 focus:outline-none focus:ring-0 focus:border-outline/50 focus:bg-surface-container-high transition-all duration-200"
          autoFocus
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setIsOpenDropdown(false);
            }}
            className="absolute right-3.5 p-1 text-outline hover:text-primary transition-colors rounded-full hover:bg-surface-container-high"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Categorías (Filter Chips Píldora - Estilo code.html) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
        <button
          type="button"
          onClick={() => handleSelectCategory(null)}
          className={`px-5 py-2 rounded-full font-label-sm text-xs font-bold whitespace-nowrap transition-all ${
            selectedCategoriaId === null
              ? 'bg-primary text-on-primary shadow-md scale-[1.02]'
              : 'spatial-glass text-on-surface-variant hover:bg-surface-container-high border border-outline/20'
          }`}
        >
          Todo
        </button>
        {Array.isArray(categorias) &&
          categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() =>
                handleSelectCategory(
                  selectedCategoriaId === cat.id ? null : cat.id,
                )
              }
              className={`px-5 py-2 rounded-full font-label-sm text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategoriaId === cat.id
                  ? 'bg-primary text-on-primary shadow-md scale-[1.02]'
                  : 'spatial-glass text-on-surface-variant hover:bg-surface-container-high border border-outline/20'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
      </div>

      {/* Dropdown Desplegable de Resultados */}
      {isOpenDropdown && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-surface-container-low/95 border border-outline/20 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-4 text-center text-outline text-xs font-label-sm">
              Buscando en catálogo...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-outline text-xs font-label-sm">
              No se encontraron coincidencias para "{searchTerm}"
            </div>
          ) : (
            results.map((producto) => {
              const stock = Array.isArray(producto.inventario) && producto.inventario.length > 0
                ? producto.inventario.reduce((acc: number, inv: ProductoInventario) => acc + (inv.stockActual ?? 0), 0)
                : (producto.inventario?.[0]?.stockActual ?? 0);
              return (
                <button
                  key={producto.id}
                  onClick={() => handleSelect(producto)}
                  className="w-full p-3.5 flex items-center justify-between border-b border-outline/10 hover:bg-surface-container-high transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-surface-container-high border border-outline/20 rounded-xl flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                      {getUnitIcon(producto.unidadMedida)}
                    </div>
                    <div>
                      <div className="font-bold text-primary text-sm font-headline-md">
                        {producto.nombre}
                      </div>
                      <div className="text-[11px] text-outline font-label-sm">
                        Cód: {producto.codigoBarras}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary text-base font-mono">
                      ${producto.precioVentaBase.toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] font-label-sm font-semibold ${
                        stock <= 0 ? 'text-warning' : 'text-success'
                      }`}
                    >
                      {stock <= 0 ? `STK: ${stock} (Permisivo)` : `STK: ${stock}`}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});
