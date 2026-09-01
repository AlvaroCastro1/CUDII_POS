import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';

interface Sucursal {
  id: string;
  nombre: string;
}

interface ProductoBusqueda {
  id: string;
  nombre: string;
  codigoBarras: string;
  codigoInterno?: string | null;
  unidadMedida?: string | null;
  esGranel?: boolean;
  tieneCaducidad?: boolean;
}

interface LineaRecepcion {
  key: string;
  producto: ProductoBusqueda;
  cantidad: string;
  costoUnitario: string;
  codigoLote: string;
  fechaFabricacion: string;
  fechaCaducidad: string;
}

interface RecepcionMercanciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sucursales: Sucursal[];
  sucursalDefaultId?: string;
}

/**
 * Modal de Recepción de Mercancía (GRN).
 * Cada línea crea un lote (con código auto-generado si va en blanco) y
 * suma al inventario agregado de la sucursal.
 */
export function RecepcionMercanciaModal({
  isOpen,
  onClose,
  onSuccess,
  sucursales,
  sucursalDefaultId = '',
}: RecepcionMercanciaModalProps) {
  const [sucursalId, setSucursalId] = useState(sucursalDefaultId);
  const [proveedor, setProveedor] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<LineaRecepcion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSucursalId(sucursalDefaultId);
      setProveedor('');
      setNotas('');
      setLineas([]);
      setBusqueda('');
      setResultados([]);
      setTimeout(() => busquedaRef.current?.focus(), 100);
    }
  }, [isOpen, sucursalDefaultId]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const buscarProductos = async (termino: string) => {
    if (!termino.trim()) {
      setResultados([]);
      return;
    }
    try {
      setBuscando(true);
      const res = await api.get(`/products/search?q=${encodeURIComponent(termino)}&limit=10`);
      const lista = Array.isArray(res.data.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setResultados(lista);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const handleBusqueda = (valor: string) => {
    setBusqueda(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarProductos(valor), 300);
  };

  const agregarProducto = (producto: ProductoBusqueda) => {
    if (lineas.some((l) => l.producto.id === producto.id)) {
      toast.warning('El producto ya está en la recepción');
      return;
    }
    setLineas((prev) => [
      ...prev,
      {
        key: `${producto.id}-${Date.now()}`,
        producto,
        cantidad: '',
        costoUnitario: '',
        codigoLote: '',
        fechaFabricacion: '',
        fechaCaducidad: '',
      },
    ]);
    setBusqueda('');
    setResultados([]);
    busquedaRef.current?.focus();
  };

  const updateLinea = (key: string, campo: keyof Omit<LineaRecepcion, 'key' | 'producto'>, valor: string) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  };

  const quitarLinea = (key: string) => setLineas((prev) => prev.filter((l) => l.key !== key));

  const costoTotal = lineas.reduce((acc, l) => {
    const cant = parseFloat(l.cantidad) || 0;
    const costo = parseFloat(l.costoUnitario) || 0;
    return acc + cant * costo;
  }, 0);

  const validar = (): string | null => {
    if (!sucursalId) return 'Selecciona la sucursal';
    if (lineas.length === 0) return 'Agrega al menos un producto';
    for (const l of lineas) {
      if (!(parseFloat(l.cantidad) > 0)) return `Cantidad inválida para "${l.producto.nombre}"`;
      if (!(parseFloat(l.costoUnitario) >= 0)) return `Costo inválido para "${l.producto.nombre}"`;
      if (l.producto.tieneCaducidad && !l.fechaCaducidad) {
        return `"${l.producto.nombre}" tiene caducidad: captura la fecha de vencimiento`;
      }
      if (l.fechaCaducidad && new Date(l.fechaCaducidad) < new Date(new Date().toDateString())) {
        return `La caducidad de "${l.producto.nombre}" ya está vencida`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validar();
    if (error) {
      toast.error(error);
      return;
    }
    try {
      setIsSubmitting(true);
      await api.post('/inventory/recepciones', {
        sucursalId,
        proveedor: proveedor.trim() || undefined,
        notas: notas.trim() || undefined,
        detalles: lineas.map((l) => ({
          productoId: l.producto.id,
          cantidad: parseFloat(l.cantidad),
          costoUnitario: parseFloat(l.costoUnitario),
          codigoLote: l.codigoLote.trim() || undefined,
          fechaFabricacion: l.fechaFabricacion || undefined,
          fechaCaducidad: l.fechaCaducidad || undefined,
        })),
      });
      toast.success('Recepción registrada correctamente');
      onClose();
      onSuccess();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(errorMessage(err, 'Error al registrar la recepción'));
      } else {
        toast.error('Error al registrar la recepción');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col p-0 gap-0">
        {/* ─── Header fijo ─── */}
        <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
          <DialogHeader className="mb-4">
            <DialogTitle>Recepción de Mercancía</DialogTitle>
            <p className="text-sm text-on-surface-variant">
              Registra la entrada de productos con lote y costo.
            </p>
          </DialogHeader>

          {/* Cabecera: sucursal, proveedor, notas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sucursales.length > 1 ? (
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Sucursal <span className="text-error">*</span></Label>
                <Select value={sucursalId} onValueChange={setSucursalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Sucursal</Label>
                <div className="h-10 rounded-md border border-outline/20 px-3 flex items-center text-sm text-on-surface bg-surface-variant/30">
                  {sucursales[0]?.nombre || '—'}
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium">Proveedor</Label>
              <Input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Opcional"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium">Notas</Label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional"
                className="h-10"
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* ─── Cuerpo scrollable ─── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">

            {/* Búsqueda de producto — PRIORIDAD */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 !text-[18px] text-outline">
                    search
                  </span>
                  <Input
                    ref={busquedaRef}
                    value={busqueda}
                    onChange={(e) => handleBusqueda(e.target.value)}
                    placeholder="Buscar producto por nombre o código de barras..."
                    className="pl-9 h-11 text-sm"
                  />
                </div>
                {buscando && (
                  <span className="text-xs text-on-surface-variant animate-pulse whitespace-nowrap">Buscando...</span>
                )}
              </div>
              {busqueda && !buscando && resultados.length === 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-outline/20 bg-surface shadow-2xl p-3 text-xs text-on-surface-variant">
                  Sin resultados para "{busqueda}"
                </div>
              )}
              {resultados.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-outline/20 bg-surface shadow-2xl overflow-hidden max-h-52 overflow-y-auto custom-scrollbar">
                  {resultados.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => agregarProducto(prod)}
                      className="w-full px-4 py-2.5 flex items-center justify-between border-b border-outline/10 last:border-0 hover:bg-surface-container-high transition-colors text-left gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-on-surface truncate">{prod.nombre}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono">{prod.codigoBarras}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {prod.tieneCaducidad && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                            Caduca
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-outline/30 text-on-surface-variant">
                          {prod.unidadMedida || 'pieza'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Líneas de productos */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                Productos en la recepción ({lineas.length})
              </p>

              {lineas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-outline/30 p-8 text-center space-y-2">
                  <span className="material-symbols-outlined block !text-[36px] text-outline/40">add_box</span>
                  <p className="text-sm text-on-surface-variant">
                    Busca un producto arriba para agregar la primera línea.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => busquedaRef.current?.focus()}
                    className="text-primary text-xs"
                  >
                    <span className="material-symbols-outlined !text-[16px] mr-1">search</span>
                    Buscar producto
                  </Button>
                </div>
              ) : (
                lineas.map((linea) => (
                  <div key={linea.key} className="rounded-xl border border-outline/20 bg-surface-variant/20 overflow-hidden">
                    {/* Fila superior: nombre + badge + quitar */}
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-surface-variant/30 border-b border-outline/10">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-on-surface truncate">{linea.producto.nombre}</p>
                          {linea.producto.tieneCaducidad && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                              <span className="material-symbols-outlined !text-[12px]">schedule</span>
                              Caduca
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-on-surface-variant font-mono">{linea.producto.codigoBarras}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarLinea(linea.key)}
                        className="p-1.5 text-error/60 hover:text-error transition-colors hover:bg-error/10 rounded-lg shrink-0"
                        title="Quitar producto"
                      >
                        <span className="material-symbols-outlined !text-[18px]">close</span>
                      </button>
                    </div>

                    {/* Campos: 2 col mobile, 4 col desktop */}
                    <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-[10px] font-medium text-on-surface-variant">
                          Cantidad {linea.producto.esGranel ? '(kg/L)' : ''}
                        </Label>
                        <Input
                          type="number"
                          step={linea.producto.esGranel ? '0.001' : '1'}
                          min="0.001"
                          value={linea.cantidad}
                          onChange={(e) => updateLinea(linea.key, 'cantidad', e.target.value)}
                          placeholder={linea.producto.esGranel ? '0.500' : '12'}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px] font-medium text-on-surface-variant">Costo unitario ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={linea.costoUnitario}
                          onChange={(e) => updateLinea(linea.key, 'costoUnitario', e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px] font-medium text-on-surface-variant">Código de lote</Label>
                        <Input
                          value={linea.codigoLote}
                          onChange={(e) => updateLinea(linea.key, 'codigoLote', e.target.value)}
                          placeholder="Auto si se omite"
                          className="h-9 text-sm font-mono"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px] font-medium text-on-surface-variant">
                          Caducidad {linea.producto.tieneCaducidad && <span className="text-error">*</span>}
                        </Label>
                        <Input
                          type="date"
                          value={linea.fechaCaducidad}
                          onChange={(e) => updateLinea(linea.key, 'fechaCaducidad', e.target.value)}
                          className="h-9 text-sm"
                        />
                        {linea.fechaCaducidad ? (
                          <p className="text-[10px] text-warning leading-snug">
                            La fecha se guardará al registrar la recepción.
                          </p>
                        ) : (
                          linea.producto.tieneCaducidad && (
                            <p className="text-[10px] text-error/80 leading-snug">
                              Este producto requiere fecha de caducidad para guardar el lote.
                            </p>
                          )
                        )}
                      </div>
                    </div>

                    {/* Costo parcial de la línea */}
                    {linea.cantidad && linea.costoUnitario && (
                      <div className="px-4 py-1.5 border-t border-outline/10 bg-surface-variant/10">
                        <p className="text-[11px] text-on-surface-variant">
                          Subtotal: <span className="font-semibold text-on-surface">
                            ${((parseFloat(linea.cantidad) || 0) * (parseFloat(linea.costoUnitario) || 0)).toFixed(2)}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ─── Footer fijo ─── */}
          <div className="px-6 py-4 border-t border-outline/10 flex items-center gap-3 flex-shrink-0">
            <div className="mr-auto">
              <p className="text-xs text-on-surface-variant">
                {lineas.length > 0 ? (
                  <>
                    <span className="font-semibold text-on-surface">{lineas.length}</span> producto{lineas.length !== 1 ? 's' : ''}
                    {costoTotal > 0 && (
                      <> — costo total: <span className="font-semibold text-on-surface">${costoTotal.toFixed(2)}</span></>
                    )}
                  </>
                ) : (
                  <span className="text-outline">Sin productos</span>
                )}
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || lineas.length === 0}>
              {isSubmitting ? 'Registrando...' : `Registrar Recepción`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
