import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { api } from '../lib/api';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const toggleDarkMode = useThemeStore((state) => state.toggleDarkMode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      
      const { access_token, user } = response.data;
      login(access_token, user);
      
      toast.success(`¡Bienvenido ${user.nombre}!`);
      
      // Si es un CAJERO mandarlo directo a /pos, si es ADMIN al Dashboard
      if (user.rol === 'CAJERO') {
        navigate('/pos');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || 'Error al iniciar sesión, verifica tus credenciales'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-4 sm:p-8 font-body-md selection:bg-primary selection:text-on-primary relative">
      
      {/* Botón de Cambio de Tema (Flotante) */}
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-50">
        <button
          onClick={toggleDarkMode}
          className="relative w-16 h-8 rounded-full bg-on-surface/5 border border-on-surface/10 overflow-hidden flex items-center px-1 animate-hover animate-press"
          style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <div
            className="absolute left-1 w-6 h-6 rounded-full bg-on-surface flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.2)] z-10"
            style={{
              transform: isDarkMode ? 'translateX(32px)' : 'translateX(0)',
              transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <span className="material-symbols-outlined !text-[14px] text-surface">
              {isDarkMode ? 'dark_mode' : 'light_mode'}
            </span>
          </div>
          <div className="w-full flex justify-between px-1.5 opacity-40 z-0">
            <span className="material-symbols-outlined !text-[12px] text-on-surface">light_mode</span>
            <span className="material-symbols-outlined !text-[12px] text-on-surface">dark_mode</span>
          </div>
        </button>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500 ease-out">
        
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary text-on-primary flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined !text-4xl">auto_awesome</span>
          </div>
          <h1 className="font-display-lg text-4xl mb-2 tracking-tight text-center text-on-surface">Cudii</h1>
          <p className="text-on-surface-variant text-center max-w-xs text-sm">
            Ingresa a tu cuenta para gestionar tu punto de venta.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-surface border border-on-surface/10 rounded-3xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Campo Email */}
            <div className="space-y-2">
              <label className="text-xs font-label-sm font-semibold text-on-surface uppercase tracking-wider">
                Correo Electrónico
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                  mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-on-surface/10 rounded-2xl py-3.5 pl-12 pr-4 text-on-surface placeholder:text-outline/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="admin@cudii.mx"
                />
              </div>
            </div>

            {/* Campo Password */}
            <div className="space-y-2">
              <label className="text-xs font-label-sm font-semibold text-on-surface uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-on-surface/10 rounded-2xl py-3.5 pl-12 pr-12 text-on-surface placeholder:text-outline/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors p-1 rounded-full hover:bg-on-surface/5"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined !text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-on-primary rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed animate-hover animate-press"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <>
                  <span>Ingresar</span>
                  <span className="material-symbols-outlined !text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-outline text-xs">
          <p>© {new Date().getFullYear()} Cudii POS. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}
