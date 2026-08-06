import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Eye, EyeOff } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const payload: any = {
        nombre: formData.nombre,
        email: formData.email,
      };
      if (formData.password) {
        payload.password = formData.password;
      }
      
      await api.patch('/users/profile/me', payload);
      toast.success('Perfil actualizado correctamente. Los cambios se verán al recargar o volver a iniciar sesión.');
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar el perfil');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1 min-h-0">
          
          <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>Mi Perfil</DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="perfil-nombre">Nombre completo</Label>
                <Input 
                  id="perfil-nombre" 
                  required 
                  value={formData.nombre} 
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="perfil-email">Correo Electrónico</Label>
                <Input 
                  id="perfil-email" 
                  type="email" 
                  required 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="grid gap-2">
                  <Label htmlFor="perfil-password" className="text-xs text-on-surface-variant">Nueva Contraseña (opcional)</Label>
                  <div className="relative">
                    <Input 
                      id="perfil-password" 
                      type={showPassword ? 'text' : 'password'} 
                      value={formData.password} 
                      onChange={(e) => setFormData({...formData, password: e.target.value})} 
                      placeholder="Dejar en blanco para no cambiar" 
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
                  <Label htmlFor="perfil-confirmPassword" className="text-xs text-on-surface-variant">Confirmar Contraseña</Label>
                  <div className="relative">
                    <Input 
                      id="perfil-confirmPassword" 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      required={formData.password.length > 0}
                      value={formData.confirmPassword} 
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
                      placeholder="Repite la nueva contraseña" 
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
            </div>
          </div>

          <div className="px-6 py-4 border-t border-outline/10 bg-surface-variant/30 flex justify-end gap-3 flex-shrink-0">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
