import React, { useState } from 'react';
import { Lock, DollarSign, ArrowRight } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { usePosStore } from '../../store/usePosStore';

interface OpenCashRegisterModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export const OpenCashRegisterModal: React.FC<OpenCashRegisterModalProps> = ({
  isOpen,
  onSuccess,
}) => {
  const { setActiveSession } = usePosStore();
  const [montoInicial, setMontoInicial] = useState<string>('500.00');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        montoInicial: parseFloat(montoInicial) || 0,
      };

      const res = await api.post('/cash-register/open', payload);
      setActiveSession(res.data);
      onSuccess();
    } catch (err: unknown) {
      console.error('Error al abrir caja:', err);
      setError(errorMessage(err, 'Ocurrió un error al abrir la sesión de caja'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-6 text-on-surface my-auto">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-4 bg-warning/10 text-warning rounded-2xl border border-warning/30">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-primary font-headline-md">
            Apertura de Caja Requerida
          </h2>
          <p className="text-xs text-outline font-body-md">
            Debes iniciar un turno de caja indicando el fondo inicial en efectivo antes de realizar ventas.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-error text-xs font-label-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleOpenRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5 font-label-sm">
              Fondo Inicial en Efectivo ($)
            </label>
            <div className="relative flex items-center">
              <DollarSign className="absolute left-3.5 w-5 h-5 text-warning" />
              <input
                type="number"
                step="0.50"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                placeholder="500.00"
                required
                className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-bold text-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-primary text-on-primary font-bold rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 shadow-lg min-h-[48px] font-headline-md text-base"
          >
            {isLoading ? (
              <span>Abriendo turno...</span>
            ) : (
              <>
                <span>Abrir Caja y Comenzar</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
