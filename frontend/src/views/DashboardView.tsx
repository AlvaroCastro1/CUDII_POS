import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useNavigate } from 'react-router-dom';
import { LogOut, MonitorSmartphone, Moon, Sun } from 'lucide-react';

export default function DashboardView() {
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <header className="flex justify-between items-center mb-8 bg-[var(--surface)] p-4 rounded-xl shadow-sm">
        <h1 className="text-3xl text-[var(--text-primary)]">Dashboard Administrativo</h1>
        
        <div className="flex items-center gap-4">
          <span className="text-[var(--text-secondary)] font-medium">Hola, {user?.nombre}</span>
          
          <button 
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-[var(--background)] text-[var(--text-secondary)]"
            title="Alternar Tema"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Placeholder Tarjetas */}
        <div className="bg-[var(--surface)] p-6 rounded-xl shadow-sm border border-[var(--background)]">
          <h2 className="text-xl text-[var(--text-primary)] mb-2">Resumen de Hoy</h2>
          <p className="text-[var(--text-secondary)]">Ventas, devoluciones y tickets se mostrarán aquí.</p>
        </div>

        <div className="bg-[var(--surface)] p-6 rounded-xl shadow-sm border border-[var(--background)] flex flex-col justify-between">
          <div>
            <h2 className="text-xl text-[var(--text-primary)] mb-2">Acceso a Caja</h2>
            <p className="text-[var(--text-secondary)]">Ir a la interfaz del punto de venta.</p>
          </div>
          <button 
            onClick={() => navigate('/pos')}
            className="mt-4 flex items-center justify-center gap-2 bg-[var(--primary)] text-white py-2 rounded-lg hover:opacity-90 transition-opacity w-full"
          >
            <MonitorSmartphone size={20} /> Abrir POS
          </button>
        </div>
      </div>
    </div>
  );
}
