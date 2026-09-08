import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Truck, FileText, PackageCheck, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface SolicitudDetalle {
  id: string;
  productoId: string;
  nombreProducto: string;
  unidadMedida: string;
  cantidadRequerida: number;
  costoUnitarioEstimado: number;
}

interface SolicitudProveedor {
  id: string;
  folio: string;
  proveedorId?: string | null;
  proveedor?: { nombre: string } | null;
  detalles: SolicitudDetalle[];
}

interface RecibirSolicitudProveedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitud: SolicitudProveedor | null;
  onSuccess: () => void;
}

interface SucursalOption {
  id: string;
  nombre: string;
}

export const RecibirSolicitudProveedorModal: React.FC<RecibirSolicitudProveedorModalProps> = ({
  isOpen,
  onClose,
  solicitud,
  onSuccess,
}) => {
  const [sucursales, setSucursales] = useState<SucursalOption[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [folioFactura, setFolioFactura] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const [itemsRecibidos, setItemsRecibidos] = useState<
    {
      productoId: string;
      nombreProducto: string;
      unidadMedida: string;
      cantidadRequerida: number;
      cantidadRecibida: number;
      costoUnitarioReal: number;
      codigoLote: string;
      fechaCaducidad: string;
    }[]
  >([]);

  useEffect(() => {
    if (isOpen && solicitud) {
      fetchSucursales();
      setItemsRecibidos(
        solicitud.detalles.map((d) => ({
          productoId: d.productoId,
          nombreProducto: d.nombreProducto,
          unidadMedida: d.unidadMedida || 'pieza',
          cantidadRequerida: d.cantidadRequerida,
          cantidadRecibida: d.cantidadRequerida,
          costoUnitarioReal: d.costoUnitarioEstimado || 0,
          codigoLote: '',
          fechaCaducidad: '',
        })),
      );
    }
  }, [isOpen, solicitud]);

  const fetchSucursales = async () => {
    try {
      const res = await api.get('/companies/my/sucursales');
      const list = Array.isArray(res.data) ? res.data : [];
      setSucursales(list);
      if (list.length > 0) {
        setSucursalId(list[0].id);
      }
    } catch {
      // fallback
    }
  };

  if (!isOpen || !solicitud) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sucursalId) {
      toast.error('Debe seleccionar la sucursal de destino.');
      return;
    }

    const itemsAProcesar = itemsRecibidos.filter((i) => i.cantidadRecibida > 0);
    if (itemsAProcesar.length === 0) {
      toast.error('Debe ingresar al menos una cantidad recibida mayor a cero.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/solicitudes-proveedor/${solicitud.id}/recibir`, {
        sucursalId,
        folioFacturaProveedor: folioFactura.trim() || undefined,
        notas: notas.trim() || undefined,
        detalles: itemsAProcesar.map((i) => ({
          productoId: i.productoId,
          cantidadRecibida: Number(i.cantidadRecibida),
          costoUnitarioReal: Number(i.costoUnitarioReal),
          codigoLote: i.codigoLote.trim() || undefined,
          fechaCaducidad: i.fechaCaducidad || undefined,
        })),
      });

      toast.success('Mercancía recibida e ingresada al inventario correctamente.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al procesar la recepción.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-surface border border-outline/20 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline-md font-bold text-on-surface text-lg">
                Recepción de Mercancía (GRN) — {solicitud.folio}
              </h3>
              <p className="font-body-md text-xs text-on-surface-variant">
                Proveedor: <span className="font-semibold text-primary">{solicitud.proveedor?.nombre || 'Solicitud Abierta'}</span>
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
          {/* Metadata section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline/10">
            <div>
              <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
                Sucursal Almacén Destino *
              </label>
              <select
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
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
                Folio Factura / Remisión
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  value={folioFactura}
                  onChange={(e) => setFolioFactura(e.target.value)}
                  placeholder="Ej: FAC-98721"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface border border-outline/20 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
                Notas u Observaciones
              </label>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones de entrega..."
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline/20 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Tabla de Productos Recibidos */}
          <div>
            <h4 className="font-headline-md font-bold text-on-surface text-sm mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              <span>Desglose de Ítems a Ingresar</span>
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-outline/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant font-label-sm uppercase border-b border-outline/10">
                    <th className="p-3">Producto</th>
                    <th className="p-3 text-center">Sol.</th>
                    <th className="p-3 text-center">Cant. Recibida *</th>
                    <th className="p-3 text-right">Costo Real *</th>
                    <th className="p-3">Cód. Lote</th>
                    <th className="p-3">Caducidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10 text-on-surface">
                  {itemsRecibidos.map((item, idx) => (
                    <tr key={item.productoId} className="hover:bg-surface-container-low/50">
                      <td className="p-3 font-semibold text-primary font-body-md">
                        {item.nombreProducto}
                        <span className="text-[10px] text-on-surface-variant block font-normal">
                          Unidad: {item.unidadMedida}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-on-surface-variant">
                        {item.cantidadRequerida}
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
                          className="w-24 h-9 text-center font-mono font-bold rounded-xl bg-surface border border-outline/30 text-primary focus:outline-none focus:border-primary"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costoUnitarioReal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setItemsRecibidos((prev) =>
                              prev.map((i, k) => (k === idx ? { ...i, costoUnitarioReal: val } : i)),
                            );
                          }}
                          className="w-24 h-9 text-right font-mono font-bold rounded-xl bg-surface border border-outline/30 text-primary focus:outline-none focus:border-primary ml-auto"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.codigoLote}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemsRecibidos((prev) =>
                              prev.map((i, k) => (k === idx ? { ...i, codigoLote: val } : i)),
                            );
                          }}
                          placeholder="Auto..."
                          className="w-28 h-9 px-2 text-xs font-mono rounded-xl bg-surface border border-outline/30 text-on-surface focus:outline-none focus:border-primary"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="date"
                          value={item.fechaCaducidad}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemsRecibidos((prev) =>
                              prev.map((i, k) => (k === idx ? { ...i, fechaCaducidad: val } : i)),
                            );
                          }}
                          className="w-32 h-9 px-2 text-xs font-mono rounded-xl bg-surface border border-outline/30 text-on-surface focus:outline-none focus:border-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-outline/10 bg-surface/50">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-body-md">
            <AlertCircle className="w-4 h-4 text-primary" />
            <span>Al confirmar, el stock incrementará atómicamente en el almacén.</span>
          </div>

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
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Procesando...' : 'Confirmar e Ingresar Stock'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
