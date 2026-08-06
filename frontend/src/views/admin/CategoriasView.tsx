import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2 } from 'lucide-react';

const ICONOS_COMUNES = [
  'category', 'fastfood', 'local_cafe', 'liquor', 'local_pizza', 
  'bakery_dining', 'set_meal', 'shopping_basket', 'checkroom', 
  'kitchen', 'home', 'pets', 'cleaning_services', 'local_pharmacy', 
  'sports_esports', 'toys'
];

export default function CategoriasView() {
  const [categorias, setCategorias] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialForm = {
    nombre: '',
    descripcion: '',
    colorHex: '#3b82f6',
    icono: 'category'
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategorias = async () => {
    try {
      setLoading(true);
      const res = await api.get('/categories');
      setCategorias(res.data.data || res.data);
    } catch (error: any) {
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleOpenEdit = (cat: any) => {
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
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al guardar la categoría');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría? Si tiene productos asociados podría fallar.')) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Categoría eliminada');
      fetchCategorias();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al eliminar. Verifique que no tenga productos asociados.');
    }
  };

  const categoriasFiltradas = categorias.filter((c: any) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) || 
    (c.descripcion || '').toLowerCase().includes(search.toLowerCase())
  );

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
                    <Label htmlFor="nombre">Nombre de la Categoría <span className="text-red-500">*</span></Label>
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

      <div className="bg-surface rounded-xl border border-on-surface/10 p-4 mb-6">
        <div className="flex gap-4 mb-4">
          <Input 
            placeholder="Buscar categoría..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Visual</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
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
              categoriasFiltradas.map((cat: any) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white" 
                      style={{ backgroundColor: cat.colorHex || '#3b82f6' }}
                    >
                      <span className="material-symbols-outlined !text-[20px]">{cat.icono || 'category'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{cat.nombre}</TableCell>
                  <TableCell className="text-on-surface-variant">{cat.descripcion || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" title="Editar" onClick={() => handleOpenEdit(cat)}>
                        <Pencil className="w-4 h-4 text-on-surface-variant" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Eliminar" onClick={() => handleDelete(cat.id)}>
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
