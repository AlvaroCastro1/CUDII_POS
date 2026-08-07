import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Eye, EyeOff } from 'lucide-react';

export default function MiPerfilView() {
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

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        nombre: user.nombre,
        email: user.email,
      }));
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const payload: { nombre: string; email: string; password?: string } = {
        nombre: formData.nombre,
        email: formData.email,
      };
      if (formData.password) {
        payload.password = formData.password;
      }
      
      await api.patch('/users/profile/me', payload);
      toast.success('Perfil actualizado correctamente. Los cambios en la sesión se verán al recargar la página.');
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al actualizar el perfil');
      } else {
        toast.error('Error al actualizar el perfil');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-display-lg text-on-background">Mi Perfil</h1>
        <p className="text-on-surface-variant text-sm mt-1">Gestiona tu información personal y credenciales de acceso.</p>
      </div>

      <div className="bg-surface border border-outline/10 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleUpdateProfile} className="space-y-6">
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

          <div className="pt-4 mt-4 border-t border-outline/10">
            <h3 className="font-semibold text-lg mb-4 text-on-background">Cambiar Contraseña</h3>
            <div className="grid gap-4 sm:grid-cols-2">
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

          <div className="pt-6 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
