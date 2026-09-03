import React, { useEffect, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { api, obtenerUrlImagen } from '@/lib/api';
import { CONFIG_TICKET_DEFAULT, type ConfigTicketPresupuesto } from '@/types/ticketConfig';

export interface PresupuestoTicketData {
  id: string;
  folio: string;
  subtotal: number;
  descuento?: number;
  descuentoGeneral?: number;
  descuentoNivel?: number;
  descuentoCanje?: number;
  descuentoCupon?: number;
  codigoCupon?: string | null;
  total: number;
  creadoEn: string;
  fechaVencimiento?: string | null;
  diasExpiracionPresupuesto?: number;
  cliente?: { nombre: string; apellidoPaterno?: string | null } | null;
  cajero?: { nombre: string } | null;
  detalles?: {
    nombreProducto: string;
    nombreCombo?: string | null;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    total: number;
  }[];
}

interface PresupuestoTicketModalProps {
  presupuesto: PresupuestoTicketData | null;
  onClose: () => void;
}

const fmtMoneda = (v: number) => `$${v.toFixed(2)}`;
const fmtFecha = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
const fmtHora = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PresupuestoTicketModal: React.FC<PresupuestoTicketModalProps> = ({
  presupuesto,
  onClose,
}) => {
  const [config, setConfig] = useState<ConfigTicketPresupuesto>(CONFIG_TICKET_DEFAULT.presupuesto);

  useEffect(() => {
    let activo = true;
    api.get('/company-settings/ticket').then((res) => {
      if (activo && res.data?.presupuesto) {
        setConfig({ ...CONFIG_TICKET_DEFAULT.presupuesto, ...res.data.presupuesto });
      }
    }).catch(() => {});
    return () => { activo = false; };
  }, []);

  if (!presupuesto) return null;

  const handlePrint = () => {
    window.print();
  };

  const detalles = presupuesto.detalles ?? [];

  const fontClass =
    config.tamanoFuente === 'pequena'
      ? 'text-[10px]'
      : config.tamanoFuente === 'grande'
        ? 'text-sm'
        : 'text-xs';

  const containerWidthClass =
    config.anchoMm === '58mm' ? 'max-w-[260px] mx-auto' : 'w-full';

  const getEstiloClasses = (estilo?: typeof config.estiloEncabezado, defAlign = 'text-center') => {
    if (!estilo) return defAlign;
    const parts: string[] = [];
    if (estilo.negrita) parts.push('font-bold');
    if (estilo.subrayado) parts.push('underline');
    if (estilo.alineacion === 'left') parts.push('text-left');
    else if (estilo.alineacion === 'right') parts.push('text-right');
    else parts.push('text-center');
    return parts.join(' ');
  };

  const tieneContacto = Boolean(
    config.direccion?.trim() ||
      config.telefono?.trim() ||
      config.rfc?.trim() ||
      config.email?.trim(),
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-4 text-on-surface my-auto max-h-[85vh] overflow-y-auto custom-scrollbar">
        {/* Banner Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="p-3.5 bg-primary/10 text-primary rounded-2xl border border-primary/30">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-primary font-headline-md">
            Ticket de Presupuesto
          </h2>
          <div className="px-4 py-1 spatial-glass text-primary border border-outline/20 rounded-full text-xs font-semibold font-mono">
            Folio: {presupuesto.folio}
          </div>
        </div>

        {/* Voucher Imprimible */}
        <div className={`spatial-glass text-on-surface p-5 rounded-2xl border border-outline/20 shadow-inner font-mono text-left space-y-2 max-h-64 overflow-y-auto custom-scrollbar ${fontClass} ${containerWidthClass}`}>
          
          {/* Logo si está activo */}
          {config.mostrarLogo && config.logoUrl?.trim() && (
            <div className="flex justify-center mb-1">
              <img src={obtenerUrlImagen(config.logoUrl)} alt="Logo" className="max-h-12 object-contain" />
            </div>
          )}

          {/* Encabezado */}
          {config.encabezado?.trim() && (
            <div className={`border-b border-outline/20 pb-2 ${getEstiloClasses(config.estiloEncabezado, 'text-center')}`}>
              <p className="text-primary font-headline-md leading-tight">{config.encabezado}</p>
              {config.slogan?.trim() && (
                <p className={`text-[10px] text-on-surface-variant mt-0.5 tracking-normal font-sans ${getEstiloClasses(config.estiloSlogan, 'text-center')}`}>
                  {config.slogan}
                </p>
              )}
            </div>
          )}

          {/* Datos del Negocio */}
          {tieneContacto && (
            <div className={`text-[10px] text-outline border-b border-outline/10 pb-1.5 space-y-0.5 ${getEstiloClasses(config.estiloContacto, 'text-center')}`}>
              {config.direccion?.trim() && <p>{config.direccion}</p>}
              {config.telefono?.trim() && <p>Tel: {config.telefono}</p>}
              {config.rfc?.trim() && <p>RFC: {config.rfc}</p>}
              {config.email?.trim() && <p>{config.email}</p>}
            </div>
          )}

          {/* Folio + Fecha */}
          <div className="flex justify-between text-on-surface-variant text-[11px]">
            <span className="font-semibold">Folio: {presupuesto.folio}</span>
            <span>{fmtFecha(presupuesto.creadoEn)} {fmtHora(presupuesto.creadoEn)}</span>
          </div>

          {/* Cajero */}
          {config.mostrarCajero && presupuesto.cajero?.nombre && (
            <div className="text-on-surface-variant text-[11px]">
              Atendido por: <span className="font-semibold text-on-surface">{presupuesto.cajero.nombre}</span>
            </div>
          )}

          {/* Cliente */}
          {config.mostrarCliente && presupuesto.cliente && (
            <div className="text-on-surface-variant text-[11px]">
              Cliente: <span className="font-semibold text-on-surface">
                {presupuesto.cliente.nombre} {presupuesto.cliente.apellidoPaterno ?? ''}
              </span>
            </div>
          )}

          {/* Vencimiento */}
          {config.mostrarVencimiento && presupuesto.fechaVencimiento && (
            <div className="text-warning text-[11px] font-semibold">
              Vence: {fmtFecha(presupuesto.fechaVencimiento)}
            </div>
          )}

          <div className="border-t border-outline/20" />

          {/* Productos */}
          <div className="space-y-1">
            {detalles.map((det, i) => (
              <div key={i} className="flex justify-between text-on-surface">
                <div className="flex-1 min-w-0 pr-2">
                  {det.nombreCombo && (
                    <span className="text-[10px] text-primary block font-bold">
                      [{det.nombreCombo}]
                    </span>
                  )}
                  <span className="font-medium text-primary line-clamp-1">
                    {det.cantidad}x {det.nombreProducto}
                  </span>
                  <span className="text-outline text-[10px] block">
                    @ {fmtMoneda(det.precioUnitario)}
                  </span>
                </div>
                <span className="font-bold text-primary shrink-0">{fmtMoneda(det.total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-outline/20" />

          {/* Totales */}
          <div className="space-y-0.5 text-[11px] text-on-surface-variant">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{fmtMoneda(presupuesto.subtotal)}</span>
            </div>
            {(presupuesto.descuentoGeneral ?? 0) > 0 && (
              <div className="flex justify-between text-error">
                <span>Descuento general</span>
                <span>−{fmtMoneda(presupuesto.descuentoGeneral!)}</span>
              </div>
            )}
            {(presupuesto.descuentoNivel ?? 0) > 0 && (
              <div className="flex justify-between text-error">
                <span>Dto. nivel cliente</span>
                <span>−{fmtMoneda(presupuesto.descuentoNivel!)}</span>
              </div>
            )}
            {(presupuesto.descuentoCupon ?? 0) > 0 && (
              <div className="flex justify-between text-error">
                <span>Cupón {presupuesto.codigoCupon ?? ''}</span>
                <span>−{fmtMoneda(presupuesto.descuentoCupon!)}</span>
              </div>
            )}
            {(presupuesto.descuentoCanje ?? 0) > 0 && (
              <div className="flex justify-between text-error">
                <span>Canje de puntos</span>
                <span>−{fmtMoneda(presupuesto.descuentoCanje!)}</span>
              </div>
            )}
          </div>

          {/* Total Cotizado */}
          <div className="border-t border-outline/20 pt-1.5">
            <div className="flex justify-between font-bold text-primary text-base">
              <span>TOTAL COTIZADO</span>
              <span>{fmtMoneda(presupuesto.total)}</span>
            </div>
          </div>

          {/* Leyenda */}
          {config.mensajePie?.trim() && (
            <div className={`border-t border-outline/20 pt-2 text-[9px] text-outline leading-tight ${getEstiloClasses(config.estiloPie, 'text-center')}`}>
              {config.mensajePie}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-2xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-95 shadow-lg text-sm font-display-lg"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Ticket</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-3 px-5 border border-outline/30 text-on-surface font-semibold rounded-2xl flex items-center justify-center hover:bg-surface-container-high transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
