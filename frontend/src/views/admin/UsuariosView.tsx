import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import axios from 'axios';
import { toast } from 'sonner';
import { Pencil, PowerOff, Power } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';

import { BuscadorEstandar } from '@/components/ui/BuscadorEstandar';

const ROLES_OPTIONS = [
  { valor: 'CAJERO', nombre: 'Cajero', desc: 'Atención en caja y cobros', icon: 'point_of_sale', colorClass: 'border-primary bg-primary/5', textClass: 'text-primary' },
  { valor: 'ALMACEN', nombre: 'Almacén', desc: 'Gestión de inventario y stock', icon: 'warehouse', colorClass: 'border-orange-500 bg-orange-500/5', textClass: 'text-orange-600' },
  { valor: 'CONTADOR', nombre: 'Contador', desc: 'Acceso a reportes y finanzas', icon: 'calculate', colorClass: 'border-teal-500 bg-teal-500/5', textClass: 'text-teal-600' },
  { valor: 'GERENTE', nombre: 'Gerente', desc: 'Inventario, reportes y catálogo', icon: 'manage_accounts', colorClass: 'border-purple-500 bg-purple-500/5', textClass: 'text-purple-600' },
  { valor: 'ADMIN', nombre: 'Administrador', desc: 'Acceso total a la sucursal', icon: 'admin_panel_settings', colorClass: 'border-error bg-error/5', textClass: 'text-error' },
];

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  estaActivo: boolean;
  creadoEn: string;
}

export default function UsuariosView() {
  const { user: currentUser } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(20);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '', confirmPassword: '', rol: 'CAJERO' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [filtroRol, setFiltroRol] = useState<string>('todos');
  const [userToToggle, setUserToToggle] = useState<Usuario | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Helper para calcular fuerza de contraseña
  const calcularFuerza = (pass: string) => {
    let strength = 0;
    if (pass.length >= 8) strength += 1;
    if (pass.length >= 12) strength += 1;
    if (/[A-Z]/.test(pass)) strength += 1;
    if (/[0-9]/.test(pass)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
    return strength;
  };
  const fuerzaPassword = calcularFuerza(formData.password);

  const getFuerzaColor = () => {
    if (formData.password.length === 0) return 'bg-outline/20';
    if (fuerzaPassword <= 2) return 'bg-error';
    if (fuerzaPassword <= 3) return 'bg-warning';
    return 'bg-success';
  };

  const getFuerzaTexto = () => {
    if (formData.password.length === 0) return '';
    if (fuerzaPassword <= 2) return 'Débil';
    if (fuerzaPassword <= 3) return 'Buena';
    return 'Fuerte';
  };

  const handleGeneratePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let newPassword = "";
    // Asegurar que haya al menos uno de cada tipo
    newPassword += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    newPassword += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    newPassword += "0123456789"[Math.floor(Math.random() * 10)];
    newPassword += "!@#$%^&*"[Math.floor(Math.random() * 8)];
    
    // Rellenar hasta 12 caracteres
    for (let i = 0; i < 8; i++) {
      newPassword += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Mezclar
    newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');
    
    setFormData({ ...formData, password: newPassword, confirmPassword: newPassword });
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const fetchUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&incluirInactivos=${incluirInactivos}`);
      setUsuarios(res.data.data || res.data);
      if (res.data.meta) setMeta(res.data.meta);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error('Error al cargar los usuarios');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, incluirInactivos, setMeta]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si hay password escrito, validar confirmación y fuerza
    if (formData.password || !editingUserId) {
      if (formData.password !== formData.confirmPassword) {
        toast.error('Las contraseñas no coinciden');
        return;
      }
      if (fuerzaPassword < 3) {
        toast.error('La contraseña debe ser más fuerte (mínimo 8 caracteres, incluir números y símbolos)');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload: { nombre: string; email: string; rol: string; password?: string } = {
        nombre: formData.nombre,
        email: formData.email,
        rol: formData.rol,
      };
      
      // Añadir la contraseña solo si se proporciona (en creación siempre se provee, en edición es opcional)
      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUserId) {
        await api.patch(`/users/${editingUserId}`, payload);
        toast.success('Usuario actualizado exitosamente');
      } else {
        await api.post('/users', payload);
        toast.success('Usuario creado exitosamente');
      }
      
      handleCerrarModal();
      fetchUsuarios();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || (editingUserId ? 'Error al actualizar usuario' : 'Error al crear usuario'));
      } else {
        toast.error(editingUserId ? 'Error al actualizar usuario' : 'Error al crear usuario');
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleOpenEdit = (user: Usuario) => {
    setEditingUserId(user.id);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      password: '', // En blanco para no sobreescribir a menos que escriban
      confirmPassword: '',
      rol: user.rol,
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsModalOpen(true);
  };

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setFormData({ nombre: '', email: '', password: '', confirmPassword: '', rol: 'CAJERO' });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleToggleClick = (user: Usuario) => {
    setUserToToggle(user);
  };

  const confirmToggleStatus = async () => {
    if (!userToToggle) return;
    try {
      setIsToggling(true);
      await api.patch(`/users/${userToToggle.id}`, { estaActivo: !userToToggle.estaActivo });
      toast.success(`Usuario ${userToToggle.estaActivo ? 'desactivado' : 'activado'} correctamente`);
      fetchUsuarios();
    } catch (error: unknown) {
      toast.error('Error al cambiar el estado del usuario');
    } finally {
      setIsToggling(false);
      setUserToToggle(null);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display-lg text-on-background">Gestión de Usuarios</h1>
        {['ADMIN', 'SUPER_ADMIN'].includes(currentUser?.rol || '') && (
          <Dialog open={isModalOpen} onOpenChange={(open) => !open ? handleCerrarModal() : setIsModalOpen(true)}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingUserId(null);
                setFormData({ nombre: '', email: '', password: '', confirmPassword: '', rol: 'CAJERO' });
              }}>
                <span className="material-symbols-outlined mr-2 !text-[18px]">person_add</span>
                Nuevo Usuario
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <form onSubmit={handleCreateUser} className="flex flex-col flex-1 min-h-0">
              
              {/* ---- Encabezado fijo ---- */}
              <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>{editingUserId ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}</DialogTitle>
                </DialogHeader>
              </div>

              {/* ---- Cuerpo con scroll ---- */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                <div className="space-y-5">
                  
                  <div className="grid gap-2">
                    <Label htmlFor="nombre">Nombre completo</Label>
                    <Input id="nombre" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} placeholder="Ej. Juan Pérez" />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="correo@empresa.com" />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>Rol del Usuario</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {ROLES_OPTIONS.map((r) => {
                        const isSelected = formData.rol === r.valor;
                        return (
                          <button
                            key={r.valor}
                            type="button"
                            onClick={() => setFormData({ ...formData, rol: r.valor })}
                            className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all duration-150 text-left ${
                              isSelected 
                                ? r.colorClass 
                                : 'border-outline/30 hover:border-outline hover:bg-surface-variant/50'
                            }`}
                          >
                            <span className={`material-symbols-outlined mb-1.5 !text-[24px] ${isSelected ? r.textClass : 'text-on-surface-variant'}`}>
                              {r.icon}
                            </span>
                            <span className={`font-semibold text-sm ${isSelected ? r.textClass : 'text-on-surface'}`}>
                              {r.nombre}
                            </span>
                            <span className="text-xs text-on-surface-variant mt-0.5 leading-tight">
                              {r.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Credenciales de Acceso</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleGeneratePassword} className="h-8 text-xs">
                        <span className="material-symbols-outlined mr-1.5 !text-[14px]">key</span>
                        Generar Segura
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="password" className="text-xs text-on-surface-variant">
                          {editingUserId ? 'Nueva contraseña (opcional)' : 'Contraseña temporal'}
                        </Label>
                        <div className="relative">
                          <Input 
                            id="password" 
                            type={showPassword ? 'text' : 'password'} 
                            required={!editingUserId}
                            value={formData.password} 
                            onChange={(e) => setFormData({...formData, password: e.target.value})} 
                            placeholder={editingUserId ? "Dejar en blanco para mantener" : "Mínimo 8 caracteres"}
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="confirmPassword" className="text-xs text-on-surface-variant">Confirmar Contraseña</Label>
                        <div className="relative">
                          <Input 
                            id="confirmPassword" 
                            type={showConfirmPassword ? 'text' : 'password'} 
                            required={formData.password.length > 0} 
                            value={formData.confirmPassword} 
                            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
                            placeholder="Repite la contraseña" 
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Indicador de Fuerza a todo lo ancho */}
                    {formData.password.length > 0 && (
                      <div className="mt-2 bg-surface-variant/30 p-3 rounded-lg border border-outline/10">
                        <div className="flex gap-1.5 h-1.5 w-full bg-outline/10 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${fuerzaPassword >= 1 ? getFuerzaColor() : 'bg-transparent'}`} style={{ width: '25%' }} />
                          <div className={`h-full transition-all duration-300 ${fuerzaPassword >= 2 ? getFuerzaColor() : 'bg-transparent'}`} style={{ width: '25%' }} />
                          <div className={`h-full transition-all duration-300 ${fuerzaPassword >= 3 ? getFuerzaColor() : 'bg-transparent'}`} style={{ width: '25%' }} />
                          <div className={`h-full transition-all duration-300 ${fuerzaPassword >= 4 ? getFuerzaColor() : 'bg-transparent'}`} style={{ width: '25%' }} />
                        </div>
                        <div className="flex items-start justify-between mt-2 text-xs">
                          <span className={`font-medium ${getFuerzaColor().replace('bg-', 'text-')}`}>
                            Fuerza: {getFuerzaTexto()}
                          </span>
                          {fuerzaPassword < 3 && (
                            <span className="text-on-surface-variant text-right">
                              Usa mayúsculas, números y símbolos
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* ---- Footer fijo ---- */}
              <div className="px-6 py-4 border-t border-outline/10 bg-surface-variant/30 flex justify-end gap-3 flex-shrink-0">
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCerrarModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : (editingUserId ? 'Actualizar Usuario' : 'Guardar Usuario')}
                  </Button>
                </DialogFooter>
              </div>

            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <BuscadorEstandar
        busqueda={search}
        onBusquedaChange={(val) => {
          setSearch(val);
          reiniciar();
        }}
        placeholder="Buscar por nombre o email..."
        switchInactivos={{
          checked: incluirInactivos,
          onCheckedChange: (checked: boolean) => {
            setIncluirInactivos(checked);
            reiniciar();
          },
          label: 'Mostrar inactivos',
        }}
        onActualizar={fetchUsuarios}
        cargando={loading}
        onLimpiar={() => {
          setSearch('');
          setFiltroRol('todos');
          setIncluirInactivos(false);
          reiniciar();
        }}
        filtrosActivosCount={filtroRol !== 'todos' ? 1 : 0}
        filtrosRapidos={
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-on-surface-variant font-medium">Rol de Usuario</span>
            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              className="h-9 bg-surface-container-low border border-outline/20 rounded-xl px-3 text-xs focus:border-primary focus:outline-none text-on-surface"
            >
              <option value="todos">Todos los roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Administrador</option>
              <option value="GERENTE">Gerente</option>
              <option value="CAJERO">Cajero</option>
              <option value="ALMACEN">Almacén</option>
              <option value="CONTADOR">Contador</option>
            </select>
          </div>
        }
      />

      <div className="bg-surface rounded-xl border border-on-surface/10 p-4 mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              {['ADMIN', 'SUPER_ADMIN'].includes(currentUser?.rol || '') && (
                <TableHead className="text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-on-surface-variant">
                  Cargando usuarios...
                </TableCell>
              </TableRow>
            ) : (() => {
              const usuariosFiltrados = usuarios.filter(
                (u) => filtroRol === 'todos' || u.rol === filtroRol
              );

              if (usuariosFiltrados.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-on-surface-variant">
                      No hay usuarios para los filtros seleccionados
                    </TableCell>
                  </TableRow>
                );
              }

              return usuariosFiltrados.map((user: Usuario) => (
                <TableRow key={user.id} className={!user.estaActivo ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{user.nombre}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.rol}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.estaActivo ? (
                      <Badge className="bg-success/10 text-success hover:bg-success/20 border-success/20">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  {['ADMIN', 'SUPER_ADMIN'].includes(currentUser?.rol || '') && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {currentUser?.id !== user.id && (
                          <Button variant="ghost" size="sm" title="Editar" onClick={() => handleOpenEdit(user)}>
                            <Pencil className="w-4 h-4 text-on-surface-variant" />
                          </Button>
                        )}
                        {currentUser?.id !== user.id && (
                          <Button variant="ghost" size="sm" title={user.estaActivo ? "Desactivar" : "Activar"} onClick={() => handleToggleClick(user)}>
                            {user.estaActivo ? (
                              <PowerOff className="w-4 h-4 text-warning" />
                            ) : (
                              <Power className="w-4 h-4 text-success" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ));
            })()}
          </TableBody>
        </Table>
        {meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
      </div>

      <ConfirmDialog
        isOpen={!!userToToggle}
        onClose={() => setUserToToggle(null)}
        onConfirm={confirmToggleStatus}
        title={userToToggle?.estaActivo ? "Desactivar Usuario" : "Activar Usuario"}
        description={userToToggle?.estaActivo 
          ? "¿Estás seguro de que deseas desactivar a este usuario? Ya no podrá iniciar sesión en el sistema." 
          : "¿Estás seguro de que deseas reactivar a este usuario? Podrá volver a acceder al sistema."}
        confirmText={userToToggle?.estaActivo ? "Sí, desactivar" : "Sí, activar"}
        cancelText="Cancelar"
        variant={userToToggle?.estaActivo ? "warning" : "info"}
        isLoading={isToggling}
      />
    </div>
  );
}
