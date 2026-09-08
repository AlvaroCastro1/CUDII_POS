import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Search, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface Sucursal {
  id: string;
  nombre: string;
}

interface ProductoItem {
  id: string;
  nombre: string;
  codigoBarras: string;
  unidadMedida?: string;
}

interface TraspasoDetalleForm {
  productoId: string;
  nombreProducto: string;
  unidadMedida: string;
  cantidadEnviada: number;
}

interface NuevoTraspasoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NuevoTraspasoModal: React.FC<NuevoTraspasoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalOrigenId, setSucursalOrigenId] = useState('');
  const [sucursalDestinoId, setSucursalDestinoId] = useState('');
  const [notasEmision, setNotasEmision] = useState('');
  const [detalles, setDetalles] = useState<TraspasoDetalleForm[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [busquedaResultados, setBusquedaResultados] = useState<ProductoItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchSucursales();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!q.trim()) {
      setBusquedaResultados([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/products/search', { params: { q } });
        const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
        setBusquedaResultados(list);
      } catch {
        // error
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const fetchSucursales = async () => {
    try {
      const res = await api.get('/companies/my/sucursales');
      const list = Array.isArray(res.data) ? res.data : [];
      setSucursales(list);
      if (list.length >= 2) {
        setSucursalOrigenId(list[0].id);
        setSucursalDestinoId(list[1].id);
      } else if (list.length === 1) {
        setSucursalOrigenId(list[0].id);
      }
    } catch {
      // error
    }
  };

  if (!isOpen) return null;

  const agregarProducto = (prod: ProductoItem) => {
    if (detalles.some((d) => d.productoId === prod.id)) {
      toast.error('El producto ya está agregado al traspaso.');
      return;
    }
    setDetalles((prev) => [
      ...prev,
      {
        productoId: prod.id,
        nombreProducto: prod.nombre,
        unidadMedida: prod.unidadMedida || 'pieza',
        cantidadEnviada: 1,
      },
    ]);
    setQ('');
    setBusquedaResultados([]);
  };

  const removerDetalle = (productoId: string) => {
    setDetalles((prev) => prev.filter((d) => d.productoId !== productoId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sucursalOrigenId || !sucursalDestinoId) {
      toast.error('Debe seleccionar la sucursal de origen y destino.');
      return;
    }

    if (sucursalOrigenId === sucursalDestinoId) {
      toast.error('La sucursal de origen y destino no pueden ser la misma.');
      return;
    }

    if (detalles.length === 0) {
      toast.error('Agregue al menos un producto al traspaso.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/traspasos', {
        sucursalOrigenId,
        sucursalDestinoId,
        notasEmision: notasEmision.trim() || undefined,
        detalles,
      });

      toast.success('Traspaso emitido correctamente y puesto en tránsito.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al emitir el traspaso.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-surface border border-outline/20 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline-md font-bold text-on-surface text-base">Nuevo Traspaso entre Sucursales</h3>
              <p className="font-body-md text-xs text-on-surface-variant">
                Moviliza mercancía de un almacén a otro con trazabilidad en tránsito
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Sucursales Origen y Destino */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline/10">
            <div>
              <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
                Sucursal Origen (Sale mercancía) *
              </label>
              <select
                value={sucursalOrigenId}
                onChange={(e) => setSucursalOrigenId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline/20 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary"
                required
              >
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
                Sucursal Destino (Recibe mercancía) *
              </label>
              <select
                value={sucursalDestinoId}
                onChange={(e) => setSucursalDestinoId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline/20 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary"
                required
              >
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
                Notas u Observaciones del Envío
              </label>
              <input
                type="text"
                value={notasEmision}
                onChange={(e) => setNotasEmision(e.target.value)}
                placeholder="Ej: Envío urgente por reabastecimiento fin de semana..."
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline/20 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Buscador de Productos */}
          <div className="relative">
            <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
              Buscar Producto para Traspasar
            </label>
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Escribe el nombre o código del producto..."
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
                    <Plus className="w-4 h-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de Productos a Enviar */}
          <div className="overflow-x-auto rounded-2xl border border-outline/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant font-label-sm uppercase border-b border-outline/10">
                  <th className="p-3">Producto</th>
                  <th className="p-3 text-center">Unidad</th>
                  <th className="p-3 text-center">Cantidad Enviada *</th>
                  <th className="p-3 text-center font-bold">Quitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/10 text-on-surface">
                {detalles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-on-surface-variant text-xs">
                      No hay productos agregados. Usa la búsqueda arriba para incorporar productos al traspaso.
                    </td>
                  </tr>
                ) : (
                  detalles.map((d, idx) => (
                    <tr key={d.productoId} className="hover:bg-surface-container-low/50">
                      <td className="p-3 font-semibold text-primary font-body-md">{d.nombreProducto}</td>
                      <td className="p-3 text-center text-on-surface-variant font-mono">{d.unidadMedida}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={d.cantidadEnviada}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setDetalles((prev) =>
                              prev.map((item, k) => (k === idx ? { ...item, cantidadEnviada: val } : item)),
                            );
                          }}
                          className="w-24 h-9 mx-auto text-center font-mono font-bold rounded-xl bg-surface border border-outline/30 text-primary focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => removerDetalle(d.productoId)}
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
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline/10 bg-surface/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-outline/20 text-on-surface hover:bg-outline/10 font-label-sm text-xs font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Emitiendo...' : 'Emitir Traspaso (En Tránsito)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
