import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function PosView() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      {/* Header Caja */}
      <header className="h-16 bg-[var(--secondary)] text-white flex items-center justify-between px-4 shadow-md z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Volver al Dashboard"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-dongle tracking-wider">CUDII POS - CAJA 01</h1>
        </div>
        
        <div className="text-sm font-medium">
          Cajero: {user?.nombre}
        </div>
      </header>

      {/* Main Grid: Catálogo y Ticket */}
      <div className="flex-1 flex overflow-hidden">
        {/* Catálogo */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-xl text-[var(--text-primary)] mb-4">Catálogo de Productos (Fase Próxima)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Placeholder de Producto */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[var(--surface)] p-4 rounded-xl shadow-sm border border-transparent hover:border-[var(--primary)] cursor-pointer transition-all aspect-square flex flex-col justify-between items-center text-center">
                <div className="w-16 h-16 bg-[var(--background)] rounded-full mb-2"></div>
                <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">Producto Demo {i}</p>
                <p className="text-[var(--primary)] font-bold">$15.00</p>
              </div>
            ))}
          </div>
        </div>

        {/* Panel Derecho: Ticket de Venta */}
        <div className="w-96 bg-[var(--surface)] shadow-xl flex flex-col border-l border-[var(--background)]">
          <div className="p-4 border-b border-[var(--background)]">
            <h2 className="text-xl text-[var(--text-primary)]">Ticket Actual</h2>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center">
            <p className="text-[var(--text-secondary)] text-center">El carrito está vacío.<br/>Selecciona un producto para comenzar.</p>
          </div>

          {/* Totales y Cobro */}
          <div className="p-4 bg-[var(--background)]/50 border-t border-[var(--background)]">
            <div className="flex justify-between text-lg font-bold text-[var(--text-primary)] mb-4">
              <span>Total:</span>
              <span className="text-[var(--primary)] text-3xl font-dongle tracking-wider">$0.00</span>
            </div>
            
            <button className="w-full bg-[var(--success)] text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-sm">
              COBRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
