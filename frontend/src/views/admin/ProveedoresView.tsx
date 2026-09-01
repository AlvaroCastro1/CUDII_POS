import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Pencil, PowerOff, Power, Truck } from 'lucide-react';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { Switch } from '@/components/ui/switch';

interface Proveedor {
  id: string;
  nombre: string;
  rfc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  contacto: string | null;
  notas: string | null;
  estaActivo: boolean;
  _count?: { lotes: number };
}

const initialForm = {
  nombre: '',
  rfc: '',
  telefono: '',
  email: '',
  direccion: '',
  contacto: '',
  notas: '',
};

export default function ProveedoresView() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const { page, limit, meta, setMeta, irAPagina, reiniciar } =
    usePaginacion(20);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState(initialForm);

  const fetchProveedores = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/suppliers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&incluirInactivos=${incluirInactivos}`,
      );
      setProveedores(res.data.data || res.data);
      if (res.data.meta) setMeta(res.data.meta);
    } catch {
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, setMeta, incluirInactivos]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleOpenEdit = (p: Proveedor) => {
    setEditingId(p.id);
    setFormData({
      nombre: p.nombre,
      rfc: p.rfc || '',
      telefono: p.telefono || '',
      email: p.email || '',
      direccion: p.direccion || '',
      contacto: p.contacto || '',
      notas: p.notas || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        nombre: formData.nombre,
        rfc: formData.rfc || undefined,
        telefono: formData.telefono || undefined,
        email: formData.email || undefined,
        direccion: formData.direccion || undefined,
        contacto: formData.contacto || undefined,
        notas: formData.notas || undefined,
      };

      if (editingId) {
        await api.patch(`/suppliers/${editingId}`, payload);
        toast.success('Proveedor actualizado');
      } else {
        await api.post('/suppliers', payload);
        toast.success('Proveedor creado');
      }
      handleCerrarModal();
      fetchProveedores();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(
          error.response?.data?.message || 'Error al guardar el proveedor',
        );
      } else {
        toast.error('Error al guardar el proveedor');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await api.delete(`/suppliers/${deleteTarget}`);
      toast.success('Proveedor desactivado');
      fetchProveedores();
    } catch {
      toast.error('Error al desactivar proveedor');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await api.patch(`/suppliers/${id}/reactivate-status`);
      toast.success('Proveedor reactivado');
      fetchProveedores();
    } catch {
      toast.error('Error al reactivar proveedor');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display-lg text-on-background">
          Gestión de Proveedores
        </h1>

        <Dialog
          open={isModalOpen}
          onOpenChange={(open) =>
            !open ? handleCerrarModal() : setIsModalOpen(true)
          }
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData(initialForm);
              }}
            >
              <Truck className="w-4 h-4 mr-2" />
              Nuevo Proveedor
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>
                      Nombre <span className="text-error">*</span>
                    </Label>
                    <Input
                      required
                      value={formData.nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                      placeholder="Nombre del proveedor"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>RFC</Label>
                      <Input
                        value={formData.rfc}
                        onChange={(e) =>
                          setFormData({ ...formData, rfc: e.target.value })
                        }
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Contacto</Label>
                      <Input
                        value={formData.contacto}
                        onChange={(e) =>
                          setFormData({ ...formData, contacto: e.target.value })
                        }
                        placeholder="Nombre del contacto"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Teléfono</Label>
                      <Input
                        value={formData.telefono}
                        onChange={(e) =>
                          setFormData({ ...formData, telefono: e.target.value })
                        }
                        placeholder="10 dígitos"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Dirección</Label>
                    <Input
                      value={formData.direccion}
                      onChange={(e) =>
                        setFormData({ ...formData, direccion: e.target.value })
                      }
                      placeholder="Dirección completa"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Notas</Label>
                    <Input
                      value={formData.notas}
                      onChange={(e) =>
                        setFormData({ ...formData, notas: e.target.value })
                      }
                      placeholder="Notas internas (opcional)"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-outline/10 bg-surface-variant/30 flex justify-end gap-3 flex-shrink-0">
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCerrarModal}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Guardando...'
                      : editingId
                        ? 'Actualizar'
                        : 'Guardar'}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-surface rounded-xl border border-on-surface/10 p-4 mb-6">
        <div className="flex gap-4 mb-4 justify-between items-center">
          <Input
            placeholder="Buscar por nombre, RFC o contacto..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reiniciar();
            }}
            className="max-w-md w-full"
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={incluirInactivos}
              onCheckedChange={(checked: boolean) => {
                setIncluirInactivos(checked);
                reiniciar();
              }}
              id="switch-inactivos"
            />
            <Label
              htmlFor="switch-inactivos"
              className="text-sm text-on-surface-variant cursor-pointer"
            >
              Mostrar inactivos
            </Label>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>RFC</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Lotes</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-6 text-on-surface-variant"
                >
                  Cargando proveedores...
                </TableCell>
              </TableRow>
            ) : proveedores.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-6 text-on-surface-variant"
                >
                  {search
                    ? 'Sin resultados para la búsqueda'
                    : 'No hay proveedores registrados'}
                </TableCell>
              </TableRow>
            ) : (
              proveedores.map((p) => (
                <TableRow
                  key={p.id}
                  className={
                    !p.estaActivo ? 'opacity-50 bg-surface-variant/30' : ''
                  }
                >
                  <TableCell className="font-semibold">{p.nombre}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {p.rfc || '-'}
                  </TableCell>
                  <TableCell>{p.contacto || '-'}</TableCell>
                  <TableCell>{p.telefono || '-'}</TableCell>
                  <TableCell>{p.email || '-'}</TableCell>
                  <TableCell className="text-center">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                      {p._count?.lotes || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.estaActivo ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(p)}
                            title="Editar proveedor"
                          >
                            <Pencil className="w-4 h-4 text-on-surface-variant" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Desactivar"
                            onClick={() => setDeleteTarget(p.id)}
                          >
                            <PowerOff className="w-4 h-4 text-warning" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Reactivar"
                          onClick={() => handleReactivate(p.id)}
                        >
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
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Desactivar Proveedor"
        description="¿Estás seguro? El proveedor será desactivado y no aparecerá en las listas principales."
        confirmText="Sí, desactivar"
        cancelText="Cancelar"
        variant="warning"
        isLoading={isDeleting}
      />
    </div>
  );
}
