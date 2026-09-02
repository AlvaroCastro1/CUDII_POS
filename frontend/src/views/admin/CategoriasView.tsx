import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Pencil, PowerOff, Power } from 'lucide-react';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { BuscadorEstandar } from '@/components/ui/BuscadorEstandar';
import { Switch } from '@/components/ui/switch';

interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
  colorHex: string;
  icono: string;
  estaActivo?: boolean;
  _count?: {
    productos: number;
  };
}

const ICONOS_COMUNES = [
  'category', 'fastfood', 'local_cafe', 'liquor', 'local_pizza', 
  'bakery_dining', 'set_meal', 'shopping_basket', 'checkroom', 
  'kitchen', 'home', 'pets', 'cleaning_services', 'local_pharmacy', 
  'sports_esports', 'toys'
];

export default function CategoriasView() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(20);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoriaToDelete, setCategoriaToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const initialForm = {
    nombre: '',
    descripcion: '',
    colorHex: '#3b82f6',
    icono: 'category'
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategorias = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/categories?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&incluirInactivos=${incluirInactivos}`);
      setCategorias(res.data.data || res.data);
      if (res.data.meta) setMeta(res.data.meta);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error('Error al cargar categorías');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, setMeta, incluirInactivos]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleOpenEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setFormData({
      nombre: cat.nombre,
      descripcion: cat.descripcion || '',
      colorHex: cat.colorHex || '#3b82f6',
      icono: cat.icono || 'category'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || undefined,
        colorHex: formData.colorHex || undefined,
        icono: formData.icono || undefined
      };

      if (editingId) {
        await api.patch(`/categories/${editingId}`, payload);
        toast.success('Categoría actualizada exitosamente');
      } else {
        await api.post('/categories', payload);
        toast.success('Categoría creada exitosamente');
      }
      handleCerrarModal();
      fetchCategorias();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al guardar la categoría');
      } else {
        toast.error('Error al guardar la categoría');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setCategoriaToDelete(id);
  };

  const confirmDelete = async () => {
    if (!categoriaToDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`/categories/${categoriaToDelete}`);
      toast.success('Categoría eliminada');
      fetchCategorias();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al eliminar. Verifique que no tenga productos asociados.');
      } else {
        toast.error('Error al eliminar. Verifique que no tenga productos asociados.');
      }
    } finally {
      setIsDeleting(false);
      setCategoriaToDelete(null);
    }
  };

  const handleToggleReactivate = async (id: string) => {
    try {
      await api.patch(`/categories/${id}`, { estaActivo: true });
      toast.success('Categoría reactivada exitosamente');
      fetchCategorias();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al reactivar la categoría');
      } else {
        toast.error('Error al reactivar la categoría');
      }
    }
  };

  // La búsqueda ya se filtra en el backend.
  const categoriasFiltradas = categorias;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display-lg text-on-background">Gestión de Categorías</h1>

        <Dialog open={isModalOpen} onOpenChange={(open) => !open ? handleCerrarModal() : setIsModalOpen(true)}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingId(null);
              setFormData(initialForm);
            }}>
              <span className="material-symbols-outlined mr-2 !text-[18px]">add</span>
              Nueva Categoría
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[420px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              
              <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
                </DialogHeader>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                  
                  <div className="grid gap-2">
                    <Label htmlFor="nombre">Nombre de la Categoría <span className="text-error">*</span></Label>
                    <Input 
                      id="nombre" 
                      required 
                      value={formData.nombre} 
                      onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
                      placeholder="Ej. Bebidas, Abarrotes, Limpieza..." 
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input 
                      id="descripcion" 
                      value={formData.descripcion} 
                      onChange={(e) => setFormData({...formData, descripcion: e.target.value})} 
                      placeholder="Breve descripción opcional" 
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="colorHex">Color Distintivo</Label>
                    <div className="flex items-center gap-3 bg-on-surface/5 p-2 rounded-xl border border-outline/10">
                      <input 
                        type="color" 
                        id="colorHex"
                        value={formData.colorHex}
                        onChange={(e) => setFormData({...formData, colorHex: e.target.value})}
                        className="w-10 h-10 p-1 border border-outline/20 rounded-lg cursor-pointer bg-surface shrink-0"
                      />
                      <div className="text-sm">
                        <p className="font-medium text-on-surface">Selecciona un color</p>
                        <p className="font-mono text-on-surface-variant text-xs uppercase">{formData.colorHex}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Ícono Distintivo</Label>
                    <div className="grid grid-cols-8 gap-2 bg-on-surface/5 p-3 rounded-xl border border-outline/10">
                      {ICONOS_COMUNES.map(ico => (
                        <button
                          key={ico}
                          type="button"
                          onClick={() => setFormData({...formData, icono: ico})}
                          className={`flex items-center justify-center p-2 rounded-lg transition-all ${formData.icono === ico ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface'}`}
                          title={ico}
                        >
                          <span className="material-symbols-outlined !text-[22px]">{ico}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              <div className="px-6 py-4 border-t border-outline/10 bg-surface-variant/30 flex justify-end gap-3 flex-shrink-0">
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCerrarModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar')}
                  </Button>
                </DialogFooter>
              </div>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      <BuscadorEstandar
        busqueda={search}
        onBusquedaChange={(val) => {
          setSearch(val);
          reiniciar();
        }}
        placeholder="Buscar por nombre o descripción..."
        switchInactivos={{
          checked: incluirInactivos,
          onCheckedChange: (checked: boolean) => {
            setIncluirInactivos(checked);
            reiniciar();
          },
          label: 'Mostrar ocultos/inactivos',
        }}
        onActualizar={fetchCategorias}
        cargando={loading}
        onLimpiar={() => {
          setSearch('');
          setIncluirInactivos(false);
          reiniciar();
        }}
      />

      <div className="bg-surface rounded-xl border border-on-surface/10 p-4 mb-6">

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Visual</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-center">Productos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                 <TableCell colSpan={4} className="text-center py-6 text-on-surface-variant">
                   Cargando categorías...
                 </TableCell>
               </TableRow>
            ) : categoriasFiltradas.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={4} className="text-center py-6 text-on-surface-variant">
                   {search ? 'Sin resultados para la búsqueda' : 'No hay categorías registradas'}
                 </TableCell>
               </TableRow>
            ) : (
              categoriasFiltradas.map((cat: Categoria) => (
                <TableRow key={cat.id} className={cat.estaActivo === false ? "opacity-50 bg-surface-variant/30" : ""}>
                  <TableCell>
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white opacity-90" 
                      style={{ backgroundColor: cat.colorHex || '#3b82f6' }}
                    >
                      <span className="material-symbols-outlined !text-[20px]">{cat.icono || 'category'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{cat.nombre}</TableCell>
                  <TableCell className="text-on-surface-variant">{cat.descripcion || '-'}</TableCell>
                  <TableCell className="text-center font-medium">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                      {cat._count?.productos || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {cat.estaActivo !== false ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(cat)} title="Editar categoría">
                            <Pencil className="w-4 h-4 text-on-surface-variant" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Ocultar / Desactivar categoría" onClick={() => handleDeleteClick(cat.id)}>
                            <PowerOff className="w-4 h-4 text-warning" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" title="Volver a activar" onClick={() => handleToggleReactivate(cat.id)}>
                          <Power className="w-4 h-4 text-success" />
                        </Button>
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

      <ConfirmDialog
        isOpen={!!categoriaToDelete}
        onClose={() => setCategoriaToDelete(null)}
        onConfirm={confirmDelete}
        title="Ocultar / Desactivar Categoría"
        description="¿Estás seguro de que deseas desactivar esta categoría? No podrá desactivarse si existen productos activos asociados a ella."
        confirmText="Sí, desactivar"
        cancelText="Cancelar"
        variant="warning"
        isLoading={isDeleting}
      />
    </div>
  );
}
