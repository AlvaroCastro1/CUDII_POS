import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pencil, PowerOff } from 'lucide-react';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { Switch } from '@/components/ui/switch';

interface Categoria {
  id: string;
  nombre: string;
  icono?: string;
  colorHex?: string;
}

interface Producto {
  id: string;
  nombre: string;
  codigoBarras: string;
  codigoInterno: string;
  descripcion: string;
  precioVentaBase: number;
  precioCompra: number;
  unidadMedida: string;
  esGranel: boolean;
  estaActivo: boolean;
  categorias: Categoria[];
}

// ============================================================
// Catálogo de unidades con descripción contextual para el usuario
// ============================================================
const UNIDADES = [
  {
    valor: 'PIEZA',
    icono: 'package_2',
    titulo: 'Pieza / Unidad',
    desc: 'Se vende de forma individual (1 pieza, 2 piezas).',
    ejemplo: 'Refresco, shampoo, pelota de fútbol',
  },
  {
    valor: 'KILO',
    icono: 'scale',
    titulo: 'Kilogramo (a granel)',
    desc: 'Se vende por peso. Permite cantidades decimales en caja.',
    ejemplo: 'Arroz a granel, jamón deli, queso',
  },
  {
    valor: 'CAJA',
    icono: 'inventory_2',
    titulo: 'Caja / Paquete',
    desc: 'Inventario por cajas, pero se puede vender por pieza. Ideal para mayoreo.',
    ejemplo: 'Caja de 24 refrescos, paquete de servilletas',
  },
  {
    valor: 'LITRO',
    icono: 'water_drop',
    titulo: 'Litro / Volumen',
    desc: 'Se vende por volumen líquido. Permite cantidades decimales en caja.',
    ejemplo: 'Aceite a granel, pintura, gasolina',
  },
  {
    valor: 'METRO',
    icono: 'straighten',
    titulo: 'Metro / Longitud',
    desc: 'Se vende por longitud. Permite cantidades decimales en caja.',
    ejemplo: 'Tela, cable eléctrico, manguera',
  },
];

// ============================================================
// Vista principal: Catálogo de Productos
// ============================================================
export default function ProductosView() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState('');
  const [searchCategoria, setSearchCategoria] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [loading, setLoading] = useState(true);
  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(20);

  // Control del modal multi-paso
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paso, setPaso] = useState(1);
  // Estado para saber si estamos editando un producto existente
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const initialForm = {
    nombre: '',
    codigoBarras: '',
    codigoInterno: '',
    descripcion: '',
    categoriasIds: [] as string[],
    unidadMedida: '',
    precioCompra: '',
    precioVentaBase: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derivados del formulario
  const unidadSeleccionada = UNIDADES.find((u) => u.valor === formData.unidadMedida);
  const esGranelAuto = ['KILO', 'LITRO', 'METRO'].includes(formData.unidadMedida);

  // La búsqueda y filtro de categoría se envían al backend — no se filtra localmente
  // Los productos ya vienen paginados y filtrados desde el servidor
  const productosFiltrados = productos;

  // ----------------------------------------------------------------
  // Cargar lista de productos desde la API (paginado)
  // ----------------------------------------------------------------
  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&categoriaId=${filtroCategoria}&incluirInactivos=${incluirInactivos}`);
      const body = res.data;
      setProductos(body.data || []);
      if (body.meta) setMeta(body.meta);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error('Error al cargar productos');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filtroCategoria, incluirInactivos, setMeta]);

  const fetchCategorias = async () => {
    try {
      // Cargamos todas las categorias para el selector (sin paginación porque suelen ser pocas)
      const res = await api.get('/categories?limit=100');
      setCategorias(res.data.data || res.data);
    } catch (error: unknown) {
      console.error('Error al cargar categorías', error);
    }
  };

  // ----------------------------------------------------------------
  // Enviar producto a la API (crear o editar)
  // ----------------------------------------------------------------
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        nombre: formData.nombre,
        codigoBarras: formData.codigoBarras,
        codigoInterno: formData.codigoInterno || undefined,
        descripcion: formData.descripcion || undefined,
        categoriasIds: formData.categoriasIds.length > 0 ? formData.categoriasIds : undefined,
        unidadMedida: formData.unidadMedida,
        precioVentaBase: parseFloat(formData.precioVentaBase),
        precioCompra: parseFloat(formData.precioCompra) || 0,
        esGranel: esGranelAuto,
      };

      if (editingProductId) {
        // Al editar, no enviamos unidadMedida ni esGranel (bloqueados)
        const editPayload: Record<string, unknown> = { ...payload };
        delete editPayload.unidadMedida;
        delete editPayload.esGranel;
        await api.patch(`/products/${editingProductId}`, editPayload);
        toast.success('¡Producto actualizado exitosamente!');
      } else {
        await api.post('/products', payload);
        toast.success('Producto registrado exitosamente');
      }

      handleCerrarModal();
      fetchProductos();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al guardar producto');
      } else {
        toast.error('Error al guardar producto');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const [productToToggle, setProductToToggle] = useState<Producto | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleClick = (prod: Producto) => {
    setProductToToggle(prod);
  };

  const confirmToggle = async () => {
    if (!productToToggle) return;
    
    try {
      setIsToggling(true);
      if (productToToggle.estaActivo) {
        // Desactivar usando el endpoint DELETE (que internamente hace soft-delete)
        await api.delete(`/products/${productToToggle.id}`);
        toast.success('Producto ocultado exitosamente');
      } else {
        // Reactivar usando PATCH
        await api.patch(`/products/${productToToggle.id}`, { estaActivo: true });
        toast.success('Producto reactivado exitosamente');
      }
      fetchProductos();
    } catch (error: unknown) {
      toast.error('Error al cambiar el estado del producto');
    } finally {
      setIsToggling(false);
      setProductToToggle(null);
    }
  };

  // Abrir modal en modo edición pre-llenando el formulario
  const handleOpenEdit = (prod: Producto) => {
    setEditingProductId(prod.id);
    setFormData({
      nombre: prod.nombre || '',
      codigoBarras: prod.codigoBarras || '',
      codigoInterno: prod.codigoInterno || '',
      descripcion: prod.descripcion || '',
      categoriasIds: prod.categorias?.map((c: Categoria) => c.id) || [],
      unidadMedida: prod.unidadMedida || '',
      precioCompra: prod.precioCompra?.toString() || '',
      precioVentaBase: prod.precioVentaBase?.toString() || '',
    });
    // En edición vamos directo al paso 2 (identificación), paso 1 es solo-lectura
    setPaso(1);
    setIsModalOpen(true);
  };

  // Resetear y cerrar el modal
  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setPaso(1);
    setEditingProductId(null);
    setFormData(initialForm);
  };

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  useEffect(() => {
    fetchCategorias();
  }, []);

  // Calcular margen en porcentaje
  const calcularMargen = () => {
    const compra = parseFloat(formData.precioCompra);
    const venta = parseFloat(formData.precioVentaBase);
    if (!compra || compra <= 0 || !venta) return null;
    return ((venta - compra) / compra) * 100;
  };
  const margen = calcularMargen();

  return (
    <div className="p-6">

      {/* ===================== ENCABEZADO DE LA VISTA ===================== */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display-lg text-on-background">Catálogo de Productos</h1>

        <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleCerrarModal(); else setIsModalOpen(true); }}>
          <DialogTrigger asChild>
            <Button>
              <span className="material-symbols-outlined mr-2 !text-[18px]">add</span>
              Nuevo Producto
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[520px]">
            <form onSubmit={handleSubmitProduct} className="flex flex-col flex-1 min-h-0">

              {/* ---- Encabezado fijo ---- */}
              <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>
                    {editingProductId ? (
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined !text-[20px] text-primary">edit</span>
                        Editar Producto
                      </span>
                    ) : 'Registrar Producto'}
                  </DialogTitle>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Paso {paso} de 3 —{' '}
                    {paso === 1 ? 'Tipo de venta' : paso === 2 ? 'Identificación' : 'Precios'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          n <= paso ? 'bg-primary' : 'bg-on-surface/10'
                        }`}
                      />
                    ))}
                  </div>
                </DialogHeader>
              </div>

              {/* ---- Cuerpo con scroll ---- */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">

              {/* =================== PASO 1: TIPO DE UNIDAD =================== */}
              {paso === 1 && (
                <div className="py-4 space-y-3">
                  {editingProductId ? (
                    // En modo edición: mostrar unidad actual bloqueada con explicación
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                        <span className="material-symbols-outlined !text-[22px] text-amber-500 flex-shrink-0 mt-0.5">info</span>
                        <div>
                          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">La unidad de medida no puede cambiarse</p>
                          <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-1">
                            Modificar la unidad de un producto con inventario existente generaría inconsistencias en el historial de ventas y stock.
                            Si necesitas un cambio de unidad, desactiva este producto y crea uno nuevo.
                          </p>
                        </div>
                      </div>
                      {(() => {
                        const u = UNIDADES.find(u => u.valor === formData.unidadMedida);
                        return u ? (
                          <div className="p-3 rounded-xl border-2 border-primary bg-primary/5 flex items-start gap-3">
                            <span className="material-symbols-outlined !text-[22px] mt-0.5 flex-shrink-0 text-primary">{u.icono}</span>
                            <div>
                              <p className="font-semibold text-sm text-primary">{u.titulo}</p>
                              <p className="text-xs text-on-surface-variant mt-0.5">{u.desc}</p>
                            </div>
                            <span className="ml-auto flex items-center gap-1 text-xs font-medium text-on-surface-variant bg-surface-variant px-2 py-1 rounded-lg">
                              <span className="material-symbols-outlined !text-[14px]">lock</span>
                              Bloqueado
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    // En modo creación: selector normal de unidades
                    <>
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        ¿Cómo se{' '}
                        <span className="font-semibold text-on-surface">mide y se cobra</span> este
                        producto? Esto determina cómo CUDII controlará tu inventario y permitirá el
                        cobro en caja.
                      </p>
                      <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
                        {UNIDADES.map((u) => (
                          <button
                            key={u.valor}
                            type="button"
                            onClick={() => setFormData({ ...formData, unidadMedida: u.valor })}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-start gap-3 ${
                              formData.unidadMedida === u.valor
                                ? 'border-primary bg-primary/5'
                                : 'border-outline/30 hover:border-outline hover:bg-surface-variant/50'
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined !text-[22px] mt-0.5 flex-shrink-0 ${
                                formData.unidadMedida === u.valor
                                  ? 'text-primary'
                                  : 'text-on-surface-variant'
                              }`}
                            >
                              {u.icono}
                            </span>
                            <div>
                              <p
                                className={`font-semibold text-sm ${
                                  formData.unidadMedida === u.valor ? 'text-primary' : 'text-on-surface'
                                }`}
                              >
                                {u.titulo}
                              </p>
                              <p className="text-xs text-on-surface-variant mt-0.5">{u.desc}</p>
                              <p className="text-xs text-on-surface/50 mt-1">Ej: {u.ejemplo}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* =================== PASO 2: IDENTIFICACIÓN =================== */}
              {paso === 2 && (
                <div className="py-4 space-y-4">
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Datos que identifican al producto en el sistema y en tu escáner de barras.
                  </p>

                  <div className="grid gap-2">
                    <Label htmlFor="nombre">
                      Nombre del producto <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="nombre"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej. Coca Cola 600ml"
                    />
                    <p className="text-xs text-on-surface-variant">
                      Convención recomendada: Marca + Producto + Presentación.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="codigoBarras">
                        Código de Barras <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="codigoBarras"
                        required
                        value={formData.codigoBarras}
                        onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
                        placeholder="7501055365470"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="codigoInterno">SKU Interno</Label>
                      <Input
                        id="codigoInterno"
                        value={formData.codigoInterno}
                        onChange={(e) =>
                          setFormData({ ...formData, codigoInterno: e.target.value })
                        }
                        placeholder="PROD-001"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input
                      id="descripcion"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="Notas adicionales (opcional)"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Categorías (Opcional - Puedes seleccionar varias)</Label>
                    <Input 
                      placeholder="Buscar categoría..." 
                      value={searchCategoria} 
                      onChange={(e) => setSearchCategoria(e.target.value)} 
                      className="h-9 mb-1" 
                    />
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1 scrollbar-thin">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, categoriasIds: [] })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all animate-hover animate-press ${
                          formData.categoriasIds.length === 0 
                            ? 'bg-surface-variant border-outline text-on-surface shadow-sm font-medium' 
                            : 'bg-transparent border-outline/20 hover:border-outline/50 text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined !text-[16px]">do_not_disturb_on</span>
                        Sin Categoría
                      </button>
                      {categorias
                        .filter(c => c.nombre.toLowerCase().includes(searchCategoria.toLowerCase()))
                        .map(cat => {
                        const isSelected = formData.categoriasIds.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              const newIds = isSelected 
                                ? formData.categoriasIds.filter((id: string) => id !== cat.id) 
                                : [...formData.categoriasIds, cat.id];
                              setFormData({ ...formData, categoriasIds: newIds });
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all animate-hover animate-press ${
                              isSelected 
                                ? 'border-transparent text-white shadow-md font-medium' 
                                : 'bg-transparent border-outline/20 hover:border-outline/50 text-on-surface-variant'
                            }`}
                            style={isSelected ? { backgroundColor: cat.colorHex || '#3b82f6' } : {}}
                          >
                            <span className="material-symbols-outlined !text-[16px]">{cat.icono || 'category'}</span>
                            {cat.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recordatorio de unidad elegida */}
                  {unidadSeleccionada && (
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                      <span className="material-symbols-outlined !text-[18px] text-primary">
                        {unidadSeleccionada.icono}
                      </span>
                      <p className="text-sm text-primary font-medium">
                        Unidad seleccionada: {unidadSeleccionada.titulo}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* =================== PASO 3: PRECIOS =================== */}
              {paso === 3 && (
                <div className="py-4 space-y-4">
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Define los precios{' '}
                    {unidadSeleccionada
                      ? `por ${unidadSeleccionada.titulo.toLowerCase()}`
                      : 'por unidad'}
                    .
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="precioCompra">Precio de Compra</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                          $
                        </span>
                        <Input
                          id="precioCompra"
                          type="number"
                          step="0.50"
                          min="0"
                          value={formData.precioCompra}
                          onChange={(e) =>
                            setFormData({ ...formData, precioCompra: e.target.value })
                          }
                          placeholder="0.00"
                          className="pl-7"
                        />
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Lo que te cuesta (para calcular margen).
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="precioVentaBase">
                        Precio de Venta <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                          $
                        </span>
                        <Input
                          id="precioVentaBase"
                          type="number"
                          step="0.50"
                          min="0"
                          required
                          value={formData.precioVentaBase}
                          onChange={(e) =>
                            setFormData({ ...formData, precioVentaBase: e.target.value })
                          }
                          placeholder="0.00"
                          className="pl-7"
                        />
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Lo que cobra al cliente por unidad.
                      </p>
                    </div>
                  </div>

                  {/* Margen en tiempo real */}
                  {margen !== null && (
                    <div
                      className={`rounded-xl px-4 py-3 border ${
                        margen >= 0
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-red-500/5 border-red-500/20'
                      }`}
                    >
                      <p className="text-sm font-semibold text-on-surface">Margen estimado</p>
                      <p
                        className={`text-2xl font-display-lg font-bold mt-1 ${
                          margen >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {margen.toFixed(1)}%
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Ganancia de $
                        {(
                          parseFloat(formData.precioVentaBase) - parseFloat(formData.precioCompra)
                        ).toFixed(2)}{' '}
                        por {unidadSeleccionada?.titulo.toLowerCase() || 'unidad'}.
                      </p>
                    </div>
                  )}

                  {/* Aviso automático de granel */}
                  {esGranelAuto && (
                    <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
                      <span className="material-symbols-outlined !text-[18px] text-blue-500 mt-0.5">
                        info
                      </span>
                      <p className="text-xs text-blue-600">
                        Este producto se marcará como <strong>granel</strong> automáticamente. En
                        caja podrás ingresar cantidades decimales (ej. 0.350 kg).
                      </p>
                    </div>
                  )}
                </div>
              )}

              </div>

              {/* ---- Pie fijo ---- */}
              <div className="px-6 py-4 border-t border-outline/10 flex items-center gap-2 flex-shrink-0">
                <Button type="button" variant="ghost" onClick={handleCerrarModal} className="mr-auto">
                  Cancelar
                </Button>
                {paso > 1 && (
                  <Button type="button" variant="outline" onClick={() => setPaso(paso - 1)}>
                    ← Atrás
                  </Button>
                )}
                {paso < 3 ? (
                  <Button
                    type="button"
                    disabled={paso === 1 && !formData.unidadMedida}
                    onClick={() => setPaso(paso + 1)}
                  >
                    Siguiente →
                  </Button>
                                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : editingProductId ? 'Actualizar Producto' : 'Registrar Producto'}
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ===================== TABLA DE PRODUCTOS ===================== */}
      <div className="bg-surface rounded-xl border border-on-surface/10 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Input
            placeholder="Buscar por nombre, código de barras o SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reiniciar();
            }}
            className="max-w-md w-full"
          />
          <select
            value={filtroCategoria}
            onChange={(e) => {
              setFiltroCategoria(e.target.value);
              reiniciar();
            }}
            className="h-11 bg-surface border border-outline/20 rounded-xl px-4 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none appearance-none max-w-[250px] w-full"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Switch
              id="switch-inactivos"
              checked={incluirInactivos}
              onCheckedChange={(checked: boolean) => {
                setIncluirInactivos(checked);
                reiniciar();
              }}
            />
            <Label htmlFor="switch-inactivos" className="text-sm text-on-surface-variant cursor-pointer">
              Mostrar ocultos/inactivos
            </Label>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Código de Barras</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">P. Compra</TableHead>
              <TableHead className="text-right">P. Venta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-on-surface-variant">
                  Cargando productos...
                </TableCell>
              </TableRow>
            ) : productosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64">
                  <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                    <span className="material-symbols-outlined !text-[64px] mb-4 opacity-30">
                      inventory_2
                    </span>
                    <p className="text-lg font-medium">
                      {search
                        ? 'Sin resultados para tu búsqueda'
                        : 'No hay productos registrados. ¡Agrega el primero!'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              productosFiltrados.map((prod: Producto) => (
                <TableRow key={prod.id} className={!prod.estaActivo ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {prod.nombre}
                    {!prod.estaActivo && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {prod.categorias && prod.categorias.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {prod.categorias.slice(0, 2).map((c: Categoria) => (
                          <span key={c.id} className="px-2 py-1 bg-surface-variant text-on-surface text-xs rounded-lg font-medium border border-outline/10 flex items-center gap-1">
                            <span className="material-symbols-outlined !text-[12px]">{c.icono || 'category'}</span>
                            {c.nombre}
                          </span>
                        ))}
                        {prod.categorias.length > 2 && (
                          <span className="px-2 py-1 bg-surface-variant text-on-surface text-xs rounded-lg font-medium border border-outline/10">
                            +{prod.categorias.length - 2} más
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-on-surface-variant/50 text-xs italic">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-on-surface-variant">
                    {prod.codigoBarras}
                  </TableCell>
                  <TableCell>{prod.unidadMedida}</TableCell>
                  <TableCell className="text-right text-on-surface-variant">
                    ${prod.precioCompra?.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${prod.precioVentaBase?.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {prod.estaActivo ? (
                        <>
                          <Button variant="ghost" size="sm" title="Editar producto" onClick={() => handleOpenEdit(prod)}>
                            <Pencil className="w-4 h-4 text-on-surface-variant" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Ocultar / Desactivar producto" onClick={() => handleToggleClick(prod)}>
                            <PowerOff className="w-4 h-4 text-amber-500/70 hover:text-amber-600" />
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant font-medium">Oculto</span>
                          <Button variant="ghost" size="sm" title="Reactivar producto" onClick={() => handleToggleClick(prod)}>
                            <span className="material-symbols-outlined !text-[18px] text-blue-500/70 hover:text-blue-600">settings_backup_restore</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
      </div>

      {/* Modal de confirmación para Desactivar / Reactivar producto */}
      <ConfirmDialog
        isOpen={!!productToToggle}
        onClose={() => setProductToToggle(null)}
        onConfirm={confirmToggle}
        title={productToToggle?.estaActivo ? "Ocultar / Desactivar Producto" : "Reactivar Producto"}
        description={
          productToToggle?.estaActivo
            ? "¿Estás seguro de que deseas desactivar este producto? Ya no aparecerá en el punto de venta ni en búsquedas predeterminadas. Tu historial y reportes no se verán afectados."
            : "¿Estás seguro de que deseas reactivar este producto? Volverá a estar disponible para la venta."
        }
        confirmText={productToToggle?.estaActivo ? "Sí, desactivar" : "Sí, activar"}
        cancelText="Cancelar"
        variant={productToToggle?.estaActivo ? "warning" : "info"}
        isLoading={isToggling}
      />
    </div>
  );
}
