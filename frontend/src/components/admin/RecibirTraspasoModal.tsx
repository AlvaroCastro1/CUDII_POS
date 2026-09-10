import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, PackageCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface TraspasoDetalle {
  id: string;
  productoId: string;
  nombreProducto: string;
  unidadMedida: string;
  cantidadEnviada: number;
}

interface Traspaso {
  id: string;
  folio: string;
  sucursalOrigen: { nombre: string };
  sucursalDestino: { nombre: string };
  detalles: TraspasoDetalle[];
}

interface RecibirTraspasoModalProps {
  isOpen: boolean;
  onClose: () => void;
  traspaso: Traspaso | null;
  onSuccess: () => void;
}

export const RecibirTraspasoModal: React.FC<RecibirTraspasoModalProps> = ({
  isOpen,
  onClose,
  traspaso,
  onSuccess,
}) => {
  const [notasRecepcion, setNotasRecepcion] = useState('');
  const [itemsRecibidos, setItemsRecibidos] = useState<
    {
      detalleId: string;
      nombreProducto: string;
      unidadMedida: string;
      cantidadEnviada: number;
      cantidadRecibida: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && traspaso) {
      setItemsRecibidos(
        traspaso.detalles.map((d) => ({
          detalleId: d.id,
          nombreProducto: d.nombreProducto,
          unidadMedida: d.unidadMedida || 'pieza',
          cantidadEnviada: d.cantidadEnviada,
          cantidadRecibida: d.cantidadEnviada,
        })),
      );
    }
  }, [isOpen, traspaso]);

  if (!isOpen || !traspaso) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/traspasos/${traspaso.id}/recibir`, {
        notasRecepcion: notasRecepcion.trim() || undefined,
        detalles: itemsRecibidos.map((i) => ({
          detalleId: i.detalleId,
          cantidadRecibida: Number(i.cantidadRecibida),
        })),
      });

      toast.success('Traspaso recibido e ingresado al almacén de destino correctamente.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al recibir el traspaso.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-surface border border-outline/20 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline-md font-bold text-on-surface text-base">
                Confirmar Recepción de Traspaso — {traspaso.folio}
              </h3>
              <p className="font-body-md text-xs text-on-surface-variant">
                Desde: <span className="font-semibold text-primary">{traspaso.sucursalOrigen.nombre}</span> hacia:{' '}
                <span className="font-semibold text-primary">{traspaso.sucursalDestino.nombre}</span>
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
          <div>
            <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
              Notas u Observaciones de Recepción
            </label>
            <input
              type="text"
              value={notasRecepcion}
              onChange={(e) => setNotasRecepcion(e.target.value)}
              placeholder="Ej: Recibido sin novedades / faltante de 1 pieza..."
              className="w-full h-10 px-3 rounded-xl bg-surface border border-outline/20 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-outline/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant font-label-sm uppercase border-b border-outline/10">
                  <th className="p-3">Producto</th>
                  <th className="p-3 text-center">Cant. Enviada</th>
                  <th className="p-3 text-center">Cant. Recibida Físicamente *</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/10 text-on-surface">
                {itemsRecibidos.map((item, idx) => (
                  <tr key={item.detalleId} className="hover:bg-surface-container-low/50">
                    <td className="p-3 font-semibold text-primary font-body-md">
                      {item.nombreProducto}
                      <span className="text-[10px] text-on-surface-variant block font-normal">
                        Unidad: {item.unidadMedida}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-on-surface-variant">
                      {item.cantidadEnviada}
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.cantidadRecibida}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setItemsRecibidos((prev) =>
                            prev.map((i, k) => (k === idx ? { ...i, cantidadRecibida: val } : i)),
                          );
                        }}
                        className="w-28 h-9 mx-auto text-center font-mono font-bold rounded-xl bg-surface border border-outline/30 text-primary focus:outline-none focus:border-primary"
                      />
                    </td>
                  </tr>
                ))}
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
            <span>{loading ? 'Confirmando...' : 'Confirmar e Ingresar a Almacén Destino'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
