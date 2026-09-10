import React, { useState, useEffect } from 'react';
import { X, Printer, Search, Trash2, Tag } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface ProductoItem {
  id: string;
  nombre: string;
  codigoBarras: string;
  precioVentaBase: number;
  unidadMedida?: string;
  cantidadEtiquetas: number;
}

interface ImpresionEtiquetasModalProps {
  isOpen: boolean;
  onClose: () => void;
  productosIniciales?: { id: string; nombre: string; codigoBarras: string; precioVentaBase: number }[];
}

export const ImpresionEtiquetasModal: React.FC<ImpresionEtiquetasModalProps> = ({
  isOpen,
  onClose,
  productosIniciales = [],
}) => {
  const [items, setItems] = useState<ProductoItem[]>([]);
  const [q, setQ] = useState('');
  const [busquedaResultados, setBusquedaResultados] = useState<ProductoItem[]>([]);
  const [tamano, setTamano] = useState<'58mm' | '80mm' | 'A4_STICKERS'>('58mm');
  const [mostrarNombre, setMostrarNombre] = useState(true);
  const [mostrarPrecio, setMostrarPrecio] = useState(true);
  const [mostrarCodigo, setMostrarCodigo] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (productosIniciales.length > 0) {
        setItems(
          productosIniciales.map((p) => ({
            ...p,
            cantidadEtiquetas: 1,
          })),
        );
      }
    }
  }, [isOpen, productosIniciales]);

  useEffect(() => {
    if (!q.trim()) {
      setBusquedaResultados([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/products/search', { params: { q } });
        const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
        setBusquedaResultados(
          list.map((p: { id: string; nombre: string; codigoBarras: string; precioVentaBase: number }) => ({
            id: p.id,
            nombre: p.nombre,
            codigoBarras: p.codigoBarras,
            precioVentaBase: p.precioVentaBase,
            cantidadEtiquetas: 1,
          })),
        );
      } catch {
        // error
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  if (!isOpen) return null;

  const agregarProducto = (prod: ProductoItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === prod.id);
      if (idx >= 0) {
        return prev.map((item, k) => (k === idx ? { ...item, cantidadEtiquetas: item.cantidadEtiquetas + 1 } : item));
      }
      return [...prev, { ...prod, cantidadEtiquetas: 1 }];
    });
    setQ('');
    setBusquedaResultados([]);
  };

  const removerProducto = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handlePrint = () => {
    if (items.length === 0) {
      toast.error('Agregue al menos un producto para imprimir etiquetas.');
      return;
    }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200 print:p-0 print:static print:bg-white">
      {/* Container principal - Oculto en print solo se imprime la vista de etiquetas */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-surface border border-outline/20 shadow-2xl flex flex-col print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline-md font-bold text-on-surface text-base">
                Impresión Masiva de Etiquetas y Códigos de Barras
              </h3>
              <p className="font-body-md text-xs text-on-surface-variant">
                Diseña y genera stickers para anaquel o producto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-outline/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Controles de Configuración */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline/10">
            <div>
              <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
                Formato de Papel / Impresora
              </label>
              <select
                value={tamano}
                onChange={(e) => setTamano(e.target.value as typeof tamano)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline/20 text-xs font-body-md text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="58mm">Térmica 58mm (Sticker pequeño)</option>
                <option value="80mm">Térmica 80mm (Sticker mediano)</option>
                <option value="A4_STICKERS">Plancha A4 (Stickers 3x1.5 cm)</option>
              </select>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-body-md text-on-surface">
                <input
                  type="checkbox"
                  checked={mostrarNombre}
                  onChange={(e) => setMostrarNombre(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Mostrar Nombre</span>
              </label>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-body-md text-on-surface">
                <input
                  type="checkbox"
                  checked={mostrarPrecio}
                  onChange={(e) => setMostrarPrecio(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Mostrar Precio de Venta</span>
              </label>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-body-md text-on-surface">
                <input
                  type="checkbox"
                  checked={mostrarCodigo}
                  onChange={(e) => setMostrarCodigo(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Mostrar Código de Barras</span>
              </label>
            </div>
          </div>

          {/* Buscador para agregar productos */}
          <div className="relative">
            <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
              Buscar Productos para Agregar a la Lista de Impresión
            </label>
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Escribe el nombre o código de barras..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-outline/20 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            {busquedaResultados.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-surface border border-outline/20 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-outline/10">
                {busquedaResultados.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => agregarProducto(prod)}
                    className="w-full p-3 flex items-center justify-between hover:bg-surface-container-high text-left transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs text-primary">{prod.nombre}</p>
                      <p className="font-mono text-[10px] text-on-surface-variant">Cód: {prod.codigoBarras}</p>
                    </div>
                    <span className="font-mono font-bold text-xs text-on-surface">${prod.precioVentaBase.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de Productos Seleccionados */}
          <div className="overflow-x-auto rounded-2xl border border-outline/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant font-label-sm uppercase border-b border-outline/10">
                  <th className="p-3">Producto</th>
                  <th className="p-3">Código de Barras</th>
                  <th className="p-3 text-right">Precio</th>
                  <th className="p-3 text-center">N° Copias Etiquetas</th>
                  <th className="p-3 text-center font-bold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/10 text-on-surface">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-on-surface-variant text-xs">
                      No se han seleccionado productos para imprimir. Busca y agrega productos arriba.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low/50">
                      <td className="p-3 font-semibold text-primary font-body-md">{item.nombre}</td>
                      <td className="p-3 font-mono font-bold text-on-surface-variant">{item.codigoBarras}</td>
                      <td className="p-3 text-right font-mono font-bold">${item.precioVentaBase.toFixed(2)}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={item.cantidadEtiquetas}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setItems((prev) =>
                              prev.map((i) => (i.id === item.id ? { ...i, cantidadEtiquetas: val } : i)),
                            );
                          }}
                          className="w-20 h-8 mx-auto text-center font-mono font-bold rounded-lg bg-surface border border-outline/30 text-primary focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => removerProducto(item.id)}
                          className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-outline/10 bg-surface/50">
          <p className="text-xs text-on-surface-variant font-body-md">
            Total de etiquetas a imprimir:{' '}
            <span className="font-bold text-primary font-mono">
              {items.reduce((acc, i) => acc + i.cantidadEtiquetas, 0)}
            </span>
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-outline/20 text-on-surface hover:bg-outline/10 font-label-sm text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={items.length === 0}
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Etiquetas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Vista limpia exclusiva para Imprimir (@media print) */}
      <div className="hidden print:block w-full text-black bg-white">
        <style>{`
          @media print {
            body { background: white !important; color: black !important; margin: 0; }
            .print\\:hidden { display: none !important; }
            .print\\:block { display: block !important; }
          }
        `}</style>
        <div className={`grid gap-2 p-2 ${tamano === 'A4_STICKERS' ? 'grid-cols-4' : tamano === '80mm' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {items.flatMap((item) =>
            Array.from({ length: item.cantidadEtiquetas }).map((_, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="border border-black p-2 rounded text-center font-sans break-inside-avoid flex flex-col items-center justify-center min-h-[90px]"
              >
                {mostrarNombre && (
                  <p className="font-bold text-xs uppercase leading-tight line-clamp-2">{item.nombre}</p>
                )}
                {mostrarCodigo && (
                  <div className="my-1 flex flex-col items-center">
                    <p className="font-mono text-sm tracking-widest font-bold">||| | |||| | ||| |||</p>
                    <p className="font-mono text-[10px]">{item.codigoBarras}</p>
                  </div>
                )}
                {mostrarPrecio && (
                  <p className="font-bold text-sm font-mono mt-0.5">${item.precioVentaBase.toFixed(2)}</p>
                )}
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
};
