import React, { useEffect, useState } from 'react';
import {
  X,
  Trash2,
  Search,
  Package,
  Building2,
  Calendar,
  FileText,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { SolicitudProveedor } from '@/types/solicitudProveedor';

interface ProveedorOption {
  id: string;
  nombre: string;
  rfc?: string | null;
  contacto?: string | null;
}

interface ProductoOption {
  id: string;
  nombre: string;
  codigoBarras: string;
  unidadMedida?: string;
  precioCompra: number;
}

interface RenglonDetalle {
  productoId: string;
  nombreProducto: string;
  unidadMedida: string;
  cantidadRequerida: number;
  costoUnitarioEstimado: number;
  notas: string;
}

interface NuevaSolicitudProveedorModalProps {
  solicitudAEditar?: SolicitudProveedor | null;
  onClose: () => void;
  onGuardado: () => void;
}

export const NuevaSolicitudProveedorModal: React.FC<NuevaSolicitudProveedorModalProps> = ({
  solicitudAEditar,
  onClose,
  onGuardado,
}) => {
  const [proveedores, setProveedores] = useState<ProveedorOption[]>([]);
  const [proveedorId, setProveedorId] = useState<string>(solicitudAEditar?.proveedorId || '');
  const estado = solicitudAEditar?.estado || 'BORRADOR';
  const [fechaEntregaEsperada, setFechaEntregaEsperada] = useState<string>(
    solicitudAEditar?.fechaEntregaEsperada
      ? new Date(solicitudAEditar.fechaEntregaEsperada).toISOString().split('T')[0]
      : '',
  );
  const [notas, setNotas] = useState<string>(solicitudAEditar?.notas || '');
  const [renglones, setRenglones] = useState<RenglonDetalle[]>(
    solicitudAEditar?.detalles?.map((d) => ({
      productoId: d.productoId,
      nombreProducto: d.nombreProducto,
      unidadMedida: d.unidadMedida || 'pieza',
      cantidadRequerida: d.cantidadRequerida,
      costoUnitarioEstimado: d.costoUnitarioEstimado,
      notas: d.notas || '',
    })) || [],
  );

  // Búsqueda de productos en el catálogo
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [productosBusqueda, setProductosBusqueda] = useState<ProductoOption[]>([]);
  const [isBuscandoProd, setIsBuscandoProd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Cargar proveedores al montar
  useEffect(() => {
    api
      .get<{ data?: ProveedorOption[] } | ProveedorOption[]>('/suppliers')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        setProveedores(list);
      })
      .catch(() => {
        toast.error('Error al cargar la lista de proveedores.');
      });
  }, []);

  // Buscar productos con debounce
  useEffect(() => {
    const q = busquedaProducto.trim();
    if (!q) {
      setProductosBusqueda([]);
      return;
    }

    setIsBuscandoProd(true);
    const timer = setTimeout(() => {
      api
        .get<ProductoOption[]>('/products/search', { params: { q, limit: 10 } })
        .then((res) => {
          setProductosBusqueda(Array.isArray(res.data) ? res.data : []);
        })
        .catch(() => {
          setProductosBusqueda([]);
        })
        .finally(() => {
          setIsBuscandoProd(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [busquedaProducto]);

  // Agregar producto al listado
  const handleAgregarProducto = (p: ProductoOption) => {
    const yaExiste = renglones.some((r) => r.productoId === p.id);
    if (yaExiste) {
      toast.info(`El producto "${p.nombre}" ya está en la lista.`);
      setBusquedaProducto('');
      setProductosBusqueda([]);
      return;
    }

    setRenglones((prev) => [
      ...prev,
      {
        productoId: p.id,
        nombreProducto: p.nombre,
        unidadMedida: p.unidadMedida || 'pieza',
        cantidadRequerida: 1,
        costoUnitarioEstimado: p.precioCompra || 0,
        notas: '',
      },
    ]);
    setBusquedaProducto('');
    setProductosBusqueda([]);
  };

  const handleRemoverRenglon = (index: number) => {
    setRenglones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRenglon = (index: number, campo: keyof RenglonDetalle, valor: any) => {
    setRenglones((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [campo]: valor };
      return copy;
    });
  };

  const totalEstimadoCalculado = renglones.reduce(
    (acc, r) => acc + (r.cantidadRequerida || 0) * (r.costoUnitarioEstimado || 0),
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (renglones.length === 0) {
      toast.error('Debes agregar al menos un producto a la solicitud.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        proveedorId: proveedorId || null,
        estado,
        fechaEntregaEsperada: fechaEntregaEsperada || null,
        notas: notas.trim() || null,
        detalles: renglones.map((r) => ({
          productoId: r.productoId,
          nombreProducto: r.nombreProducto,
          unidadMedida: r.unidadMedida,
          cantidadRequerida: Number(r.cantidadRequerida),
          costoUnitarioEstimado: Number(r.costoUnitarioEstimado),
          notas: r.notas.trim() || null,
        })),
      };

      if (solicitudAEditar) {
        await api.patch(`/solicitudes-proveedor/${solicitudAEditar.id}`, payload);
        toast.success('Solicitud actualizada correctamente.');
      } else {
        await api.post('/solicitudes-proveedor', payload);
        toast.success('Solicitud de producto creada exitosamente.');
      }

      onGuardado();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al guardar la solicitud de producto.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-in fade-in-0">
      <div className="bg-surface border border-outline/20 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface font-headline-md">
                {solicitudAEditar ? `Editar Solicitud ${solicitudAEditar.folio}` : 'Nueva Solicitud a Proveedor'}
              </h2>
              <p className="text-xs text-outline font-label-sm">
                Crea o modifica la requisición de surtido de productos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario principal */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Fila 1: Selección de Proveedor y Estado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                Proveedor Destinatario
              </Label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="w-full h-11 px-3.5 bg-surface-container-low border border-outline/20 rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary/50"
              >
                <option value="">-- Sin proveedor específico (Solicitud Abierta / Requisición Interna) --</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.rfc ? `(${p.rfc})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-outline font-label-sm">
                Puedes seleccionar un proveedor registrado o dejarlo como solicitud abierta.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                Fecha Estimada de Entrega
              </Label>
              <Input
                type="date"
                value={fechaEntregaEsperada}
                onChange={(e) => setFechaEntregaEsperada(e.target.value)}
                className="h-11 bg-surface-container-low border-outline/20 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Buscador dinámico de productos del catálogo */}
          <div className="p-4 rounded-2xl bg-surface-container-low/60 border border-outline/15 space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-outline flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-primary" />
              Agregar Productos del Catálogo
            </Label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <Input
                value={busquedaProducto}
                onChange={(e) => setBusquedaProducto(e.target.value)}
                placeholder="Escribe el nombre, código de barras o SKU del producto..."
                className="pl-10 h-11 bg-surface border-outline/20 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              />
              {isBuscandoProd && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
              )}
            </div>

            {/* Resultados flotantes de búsqueda */}
            {productosBusqueda.length > 0 && (
              <div className="bg-surface border border-outline/20 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar divide-y divide-outline/10">
                {productosBusqueda.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAgregarProducto(p)}
                    className="w-full text-left p-3 hover:bg-primary/10 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-on-surface">{p.nombre}</div>
                      <div className="text-xs text-outline font-mono">
                        {p.codigoBarras} · {p.unidadMedida || 'pieza'}
                      </div>
                    </div>
                    <div className="text-xs font-bold font-mono text-primary">
                      ${Number(p.precioCompra || 0).toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de Renglones / Artículos de la Solicitud */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-on-surface">
                Artículos Solicitados ({renglones.length})
              </span>
              <span className="text-xs font-mono font-bold text-primary">
                Total Estimado: ${totalEstimadoCalculado.toFixed(2)}
              </span>
            </div>

            {renglones.length === 0 ? (
              <div className="p-8 border border-dashed border-outline/20 rounded-2xl text-center text-outline space-y-2">
                <Package className="w-8 h-8 mx-auto text-outline/50" />
                <p className="text-sm font-medium text-on-surface-variant">No hay productos agregados.</p>
                <p className="text-xs text-outline">Utiliza el buscador superior para añadir ítems a la solicitud.</p>
              </div>
            ) : (
              <div className="border border-outline/15 rounded-2xl overflow-hidden divide-y divide-outline/10 bg-surface">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-surface-container-low text-[11px] font-bold text-outline uppercase tracking-wider">
                  <div className="col-span-4">Producto</div>
                  <div className="col-span-2 text-center">Cant. Requerida</div>
                  <div className="col-span-2 text-right">Costo Est.</div>
                  <div className="col-span-3">Notas Renglón</div>
                  <div className="col-span-1 text-center">Acción</div>
                </div>

                {renglones.map((r, i) => (
                  <div key={`${r.productoId}-${i}`} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-xs">
                    <div className="col-span-4 font-semibold text-on-surface truncate" title={r.nombreProducto}>
                      {r.nombreProducto}
                      <span className="block text-[10px] text-outline font-normal capitalize">
                        Unidad: {r.unidadMedida}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0.01}
                        step="any"
                        value={r.cantidadRequerida}
                        onChange={(e) => handleUpdateRenglon(i, 'cantidadRequerida', Math.max(0.01, parseFloat(e.target.value) || 0))}
                        className="h-9 text-center font-mono font-bold text-xs"
                      />
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={r.costoUnitarioEstimado}
                        onChange={(e) => handleUpdateRenglon(i, 'costoUnitarioEstimado', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-9 text-right font-mono text-xs"
                      />
                    </div>

                    <div className="col-span-3">
                      <Input
                        type="text"
                        value={r.notas}
                        placeholder="Nota u observación..."
                        onChange={(e) => handleUpdateRenglon(i, 'notas', e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoverRenglon(i)}
                        className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Quitar artículo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas generales */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" />
              Notas Generales / Instrucciones de Surtido
            </Label>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instrucciones especiales para el proveedor o comentarios internos..."
              className="w-full p-3 bg-surface-container-low border border-outline/20 rounded-xl text-xs focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Pie de Acciones */}
          <div className="flex items-center justify-between pt-4 border-t border-outline/10 flex-wrap gap-3">
            <div className="text-xs text-outline">
              Total Artículos: <strong className="text-on-surface">{renglones.length}</strong>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="font-bold">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {solicitudAEditar ? 'Guardar Cambios' : 'Emitir Solicitud'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
