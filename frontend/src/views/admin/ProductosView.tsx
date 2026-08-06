import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2 } from 'lucide-react';

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
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [searchCategoria, setSearchCategoria] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [loading, setLoading] = useState(true);

  // Control del modal multi-paso
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paso, setPaso] = useState(1);

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

  // Filtrado local en tiempo real
  const productosFiltrados = productos.filter((p: any) => {
    const matchesSearch = p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      p.codigoBarras?.includes(search) ||
      (p.codigoInterno ?? '').toLowerCase().includes(search.toLowerCase());
    
    const matchesCategoria = filtroCategoria === '' || 
      (p.categorias && p.categorias.some((c: any) => c.id === filtroCategoria));

    return matchesSearch && matchesCategoria;
  });

  // ----------------------------------------------------------------
  // Cargar lista de productos desde la API
  // ----------------------------------------------------------------
  const fetchProductos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products');
      setProductos(res.data.data || res.data);
    } catch (error: any) {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategorias = async () => {
    try {
      const res = await api.get('/categories');
      setCategorias(res.data.data || res.data);
    } catch (error: any) {
      console.error('Error al cargar categorías', error);
    }
  };

  // ----------------------------------------------------------------
  // Enviar nuevo producto a la API
  // ----------------------------------------------------------------
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/products', {
        nombre: formData.nombre,
        codigoBarras: formData.codigoBarras,
        codigoInterno: formData.codigoInterno || undefined,
        descripcion: formData.descripcion || undefined,
        categoriasIds: formData.categoriasIds.length > 0 ? formData.categoriasIds : undefined,
        unidadMedida: formData.unidadMedida,
        precioVentaBase: parseFloat(formData.precioVentaBase),
        precioCompra: parseFloat(formData.precioCompra) || 0,
        esGranel: esGranelAuto,
      });
      toast.success('Producto registrado exitosamente');
      handleCerrarModal();
      fetchProductos();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al crear producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resetear y cerrar el modal
  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setPaso(1);
    setFormData(initialForm);
  };

  useEffect(() => {
    fetchProductos();
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
            <form onSubmit={handleCreateProduct} className="flex flex-col flex-1 min-h-0">

              {/* ---- Encabezado fijo ---- */}
              <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>Registrar Producto</DialogTitle>
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
                    {isSubmitting ? 'Guardando...' : 'Registrar Producto'}
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
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md w-full"
          />
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="h-11 bg-surface border border-outline/20 rounded-xl px-4 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none appearance-none max-w-[250px] w-full"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
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
              productosFiltrados.map((prod: any) => (
                <TableRow key={prod.id}>
                  <TableCell className="font-medium">{prod.nombre}</TableCell>
                  <TableCell>
                    {prod.categorias && prod.categorias.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {prod.categorias.slice(0, 2).map((c: any) => (
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
                      <Button variant="ghost" size="sm" title="Editar producto" onClick={() => toast.info('La edición de productos se implementará en la siguiente actualización.')}>
                        <Pencil className="w-4 h-4 text-on-surface-variant" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Eliminar producto" onClick={() => toast.error('No se puede eliminar este producto porque afectaría el historial. Próximamente se habilitará la opción de desactivarlo.')}>
                        <Trash2 className="w-4 h-4 text-red-500/70 hover:text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
