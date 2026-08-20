import React from 'react';
import { CheckCircle, Printer, PlusCircle } from 'lucide-react';
import type { Venta, VentaDetalle, VentaPago } from '../../types/pos';

interface VoucherModalProps {
  venta: Venta | null;
  onClose: () => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({ venta, onClose }) => {
  if (!venta) return null;

  const handlePrint = () => {
    window.print();
  };

  const pago: VentaPago = venta.pagos?.[0] || {
    cambio: 0,
    montoRecibido: venta.total,
    montoPagado: venta.total,
    metodo: 'EFECTIVO',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-5 text-center text-on-surface my-auto max-h-[85vh] overflow-y-auto custom-scrollbar">
        {/* Banner de Éxito */}
        <div className="flex flex-col items-center gap-2">
          <div className="p-3.5 bg-success/10 text-success rounded-2xl border border-success/30">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-primary font-headline-md">¡Venta Exitosa!</h2>
          <div className="px-4 py-1 spatial-glass text-primary border border-outline/20 rounded-full text-xs font-semibold font-mono">
            Folio: {venta.folio}
          </div>
        </div>

        {/* Resumen del Cambio */}
        {pago.cambio > 0 && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-2xl space-y-0.5">
            <div className="text-[11px] uppercase font-semibold text-success font-label-sm tracking-wider">
              Cambio a Entregar
            </div>
            <div className="text-3xl font-black text-success font-mono">
              ${pago.cambio.toFixed(2)}
            </div>
          </div>
        )}

        {/* Voucher digital imprimible (Diseño Whitelabel Dark/Light Adaptable) */}
        <div className="spatial-glass text-on-surface p-5 rounded-2xl border border-outline/20 shadow-inner font-mono text-xs text-left space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
          <div className="text-center font-bold text-sm text-primary border-b border-outline/20 pb-2 font-headline-md">
            CUDII POS - COMPROBANTE DE VENTA
          </div>
          <div className="flex justify-between text-outline text-[11px]">
            <span>Folio: {venta.folio}</span>
            <span>{new Date(venta.creadoEn || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="border-b border-outline/20 pb-1.5 text-outline text-[11px]">
            Cajero: {venta.cajero?.nombre || 'Cajero'}
          </div>

          <div className="space-y-1.5 py-1">
            {venta.detalles?.map((det: VentaDetalle, i: number) => (
              <div key={i}>
                <div className="flex justify-between text-on-surface">
                  <span className="line-clamp-1 flex-1 font-medium text-primary">
                    {det.cantidad}x {det.nombreProducto}
                  </span>
                  <span className="font-bold ml-2 text-primary">${det.total.toFixed(2)}</span>
                </div>

              </div>
            ))}
          </div>

          <div className="border-t border-outline/20 pt-2 space-y-0.5 text-right font-bold text-sm">
            <div className="text-primary text-base font-black">TOTAL: ${venta.total.toFixed(2)}</div>
            <div className="text-[11px] font-normal text-outline">
              Método: {(pago.metodo || 'EFECTIVO').toUpperCase()}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-3.5 spatial-glass text-primary font-semibold rounded-2xl flex items-center justify-center gap-2 border border-outline/20 hover:bg-surface-container-high transition-colors text-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Ticket</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 bg-primary text-on-primary font-bold rounded-2xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-95 shadow-lg text-sm font-headline-md"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nueva Venta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
