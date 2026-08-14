import React, { useState } from 'react';
import { MinusCircle, DollarSign, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { usePosStore } from '../../store/usePosStore';

interface CashWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CashWithdrawalModal: React.FC<CashWithdrawalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeSession } = usePosStore();
  const [monto, setMonto] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !activeSession) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        sesionCajaId: activeSession.id,
        monto: parseFloat(monto),
        motivo,
      };

      await api.post('/cash-register/withdrawal', payload);

      setMonto('');
      setMotivo('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error al realizar retiro:', err);
      setError(errorMessage(err, 'Ocurrió un error al registrar el retiro de caja'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-6 text-on-surface my-auto">
        <div className="flex items-center justify-between border-b border-outline/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-warning/10 text-warning rounded-2xl border border-warning/30">
              <MinusCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary font-headline-md">
                Retiro Parcial de Efectivo
              </h2>
              <p className="text-xs text-outline font-body-md">
                Registra la salida de efectivo para resguardo o gastos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-outline hover:text-primary transition-colors rounded-full hover:bg-surface-container-high"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-error text-xs font-label-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5 font-label-sm">
              Monto a Retirar ($)
            </label>
            <div className="relative flex items-center">
              <DollarSign className="absolute left-3.5 w-5 h-5 text-warning" />
              <input
                type="number"
                step="1.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="1000.00"
                required
                className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-bold text-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-outline mb-1.5 font-label-sm">
              Motivo del Retiro
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Resguardo de efectivo por caja llena"
              required
              className="w-full px-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-primary text-on-primary font-bold rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 shadow-lg text-base font-headline-md min-h-[48px]"
          >
            {isLoading ? 'Registrando retiro...' : 'Confirmar Retiro Parcial'}
          </button>
        </form>
      </div>
    </div>
  );
};
