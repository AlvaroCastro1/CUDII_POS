import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../lib/api';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

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
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="max-w-md w-full bg-[var(--surface)] p-8 rounded-xl shadow-lg border border-[var(--background)]">
        <div className="text-center mb-8">
          <h1 className="text-4xl text-[var(--primary)] mb-2">CUDII POS</h1>
          <p className="text-[var(--text-secondary)]">Ingresa tus credenciales para acceder</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--background)] border-transparent rounded-lg focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all text-[var(--text-primary)]"
              placeholder="admin@cudii.mx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--background)] border-transparent rounded-lg focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all text-[var(--text-primary)]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--primary)] text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
