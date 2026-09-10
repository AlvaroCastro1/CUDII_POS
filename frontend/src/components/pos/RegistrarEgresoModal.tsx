import React, { useState } from 'react';
import { X, DollarSign, Tag, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface RegistrarEgresoModalProps {
  isOpen: boolean;
  onClose: () => void;
  sesionCajaId: string;
  onSuccess?: () => void;
}

export const RegistrarEgresoModal: React.FC<RegistrarEgresoModalProps> = ({
  isOpen,
  onClose,
  sesionCajaId,
  onSuccess,
}) => {
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<'FLETE' | 'LIMPIEZA' | 'INSUMOS' | 'PROPINAS' | 'OTROS'>('OTROS');
  const [concepto, setConcepto] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valMonto = parseFloat(monto);

    if (isNaN(valMonto) || valMonto <= 0) {
      toast.error('Ingrese un monto válido mayor a 0.');
      return;
    }

    if (!concepto.trim()) {
      toast.error('Debe ingresar el concepto o justificación del egreso.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/cash-register/expenses', {
        sesionCajaId,
        monto: valMonto,
        categoria,
        concepto: concepto.trim(),
      });

      toast.success('Egreso de caja registrado correctamente.');
      setMonto('');
      setConcepto('');
      setCategoria('OTROS');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al registrar el egreso.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface border border-outline/20 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-warning/10 text-warning">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline-md font-bold text-on-surface text-base">Registrar Egreso de Caja</h3>
              <p className="font-body-md text-xs text-on-surface-variant">
                Salida de dinero en efectivo por gasto menor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-outline/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
              Monto a Sacar de Caja ($) *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3.5 top-3 w-4 h-4 text-on-surface-variant" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface border border-outline/20 text-lg font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
              Categoría de Gasto *
            </label>
            <div className="relative">
              <Tag className="absolute left-3.5 top-3 w-4 h-4 text-on-surface-variant" />
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as unknown as typeof categoria)}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface border border-outline/20 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="FLETE">Flete / Transporte / Envío</option>
                <option value="LIMPIEZA">Artículos de Limpieza</option>
                <option value="INSUMOS">Insumos y Papelería de Operación</option>
                <option value="PROPINAS">Propinas o Reparto</option>
                <option value="OTROS">Otros Gastos Operativos</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
              Concepto o Justificación *
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-on-surface-variant" />
              <textarea
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                rows={2}
                placeholder="Ej: Pago de bolsa de hielo y flete express para sucursal..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-outline/20 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-warning/10 border border-warning/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200 font-medium">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Este monto se descontará automáticamente del efectivo esperado en el Corte X y Corte Z de tu turno.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-outline/20 text-on-surface hover:bg-outline/10 font-label-sm text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-warning text-on-warning font-label-sm text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Registrando...' : 'Registrar Egreso'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
