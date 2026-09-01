import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Pencil, PowerOff, Power, Eye } from 'lucide-react';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ProductoModalForm,
} from '@/components/admin/ProductoModalForm';
import type {
  Producto,
  Categoria,
} from '@/components/admin/ProductoModalForm';

// ============================================================
// Vista principal: Catálogo de Productos
// ============================================================
export default function ProductosView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const terminoInicial = searchParams.get('q') ?? '';
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState(terminoInicial);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [loading, setLoading] = useState(true);
  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(20);

  // Control del modal aislado
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);

  // Toggle inactivo/activo
  const [productToToggle, setProductToToggle] = useState<Producto | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // ----------------------------------------------------------------
  // Cargar lista de productos desde la API (paginado)
  // ----------------------------------------------------------------
  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/products?page=${page}&limit=${limit}&search=${encodeURIComponent(
          search
        )}&categoriaId=${filtroCategoria}&incluirInactivos=${incluirInactivos}`
      );
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

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await api.get('/categories?limit=100');
      setCategorias(res.data.data || res.data);
    } catch (error: unknown) {
      console.error('Error al cargar categorías', error);
    }
  }, []);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  // Sincronizar con el buscador global (?q=...) sin pisar lo que escribe el usuario
  const terminoUrl = searchParams.get('q') ?? '';
  useEffect(() => {
    setSearch(terminoUrl);
  }, [terminoUrl]);

  const handleOpenNuevo = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prod: Producto) => {
    setEditingProduct(prod);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSuccessModal = () => {
    handleCloseModal();
    fetchProductos();
  };

  const handleToggleClick = (prod: Producto) => {
    setProductToToggle(prod);
  };

  const confirmToggle = async () => {
    if (!productToToggle) return;
    try {
      setIsToggling(true);
      if (productToToggle.estaActivo) {
        await api.delete(`/products/${productToToggle.id}`);
        toast.success('Producto ocultado exitosamente');
      } else {
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

  return (
    <div className="p-6">
      {/* ===================== ENCABEZADO DE LA VISTA ===================== */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display-lg text-on-background">Catálogo de Productos</h1>

        <Button onClick={handleOpenNuevo}>
          <span className="material-symbols-outlined mr-2 !text-[18px]">add</span>
          Nuevo Producto
        </Button>
      </div>

      {/* Modal Aislado (No re-renderiza la tabla mientras escribes) */}
      <ProductoModalForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccessModal}
        editingProduct={editingProduct}
        categorias={categorias}
      />

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
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
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
            ) : productos.length === 0 ? (
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
              productos.map((prod: Producto) => (
                <TableRow key={prod.id} className={!prod.estaActivo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    {prod.nombre}
                    {!prod.estaActivo && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Inactivo
                      </Badge>
                    )}
                    {prod.manejaInventario && (
                      <Badge variant="outline" className="ml-2 text-[10px] border-success/60 text-success">
                        INV
                      </Badge>
                    )}
                    {prod.tieneCaducidad && (
                      <Badge variant="outline" className="ml-1 text-[10px] border-warning/60 text-warning">
                        CAD
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {prod.categorias && prod.categorias.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {prod.categorias.slice(0, 2).map((c: Categoria) => (
                          <span
                            key={c.id}
                            className="px-2 py-1 bg-surface-variant text-on-surface text-xs rounded-lg font-medium border border-outline/10 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined !text-[12px]">
                              {c.icono || 'category'}
                            </span>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ver detalle del producto"
                        onClick={() => navigate(`/admin/productos/${prod.id}`)}
                      >
                        <Eye className="w-4 h-4 text-on-surface-variant" />
                      </Button>
                      {prod.estaActivo ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Editar producto"
                            onClick={() => handleOpenEdit(prod)}
                          >
                            <Pencil className="w-4 h-4 text-on-surface-variant" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ocultar / Desactivar producto"
                            onClick={() => handleToggleClick(prod)}
                          >
                            <PowerOff className="w-4 h-4 text-warning" />
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant font-medium">Oculto</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reactivar producto"
                            onClick={() => handleToggleClick(prod)}
                          >
                            <Power className="w-4 h-4 text-success" />
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
        title={productToToggle?.estaActivo ? 'Ocultar / Desactivar Producto' : 'Reactivar Producto'}
        description={
          productToToggle?.estaActivo
            ? '¿Estás seguro de que deseas desactivar este producto? Ya no aparecerá en el punto de venta ni en búsquedas predeterminadas. Tu historial y reportes no se verán afectados.'
            : '¿Estás seguro de que deseas reactivar este producto? Volverá a estar disponible para la venta.'
        }
        confirmText={productToToggle?.estaActivo ? 'Sí, desactivar' : 'Sí, activar'}
        cancelText="Cancelar"
        variant={productToToggle?.estaActivo ? 'warning' : 'info'}
        isLoading={isToggling}
      />
    </div>
  );
}
