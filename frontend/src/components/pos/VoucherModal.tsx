import React, { useEffect, useState } from 'react';
import { CheckCircle, Printer, PlusCircle } from 'lucide-react';
import type { Venta, VentaDetalle, VentaPago } from '../../types/pos';
import { api, obtenerUrlImagen } from '../../lib/api';
import { CONFIG_TICKET_DEFAULT, type ConfigTicketVenta } from '../../types/ticketConfig';

interface VoucherModalProps {
  venta: Venta | null;
  onClose: () => void;
}

const fmtMoneda = (v: number) => `$${v.toFixed(2)}`;
const fmtFecha = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
const fmtHora = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const VoucherModal: React.FC<VoucherModalProps> = ({ venta, onClose }) => {
  const [config, setConfig] = useState<ConfigTicketVenta>(CONFIG_TICKET_DEFAULT.venta);

  useEffect(() => {
    let activo = true;
    api.get('/company-settings/ticket').then((res) => {
      if (activo && res.data?.venta) {
        setConfig({ ...CONFIG_TICKET_DEFAULT.venta, ...res.data.venta });
      }
    }).catch(() => {});
    return () => { activo = false; };
  }, []);

  if (!venta) return null;

  const handlePrint = () => window.print();

  const pagos = venta.pagos ?? [];
  const totalPagos = pagos.reduce((acc, p) => acc + p.montoPagado, 0);
  const cambioTotal = pagos.reduce((acc, p) => acc + p.cambio, 0);

  // Desglose de descuentos
  const descProductos =
    Math.round(
      ((venta.descuento ?? 0) -
        (venta.descuentoNivel ?? 0) -
        (venta.descuentoCanje ?? 0) -
        (venta.descuentoCupon ?? 0)) *
        100,
    ) / 100;

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
        {/* Banner de Éxito */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="p-3.5 bg-success/10 text-success rounded-2xl border border-success/30">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-primary font-headline-md">¡Venta Exitosa!</h2>
          <div className="px-4 py-1 spatial-glass text-primary border border-outline/20 rounded-full text-xs font-semibold font-mono">
            Folio: {venta.folio}
          </div>
        </div>

        {/* Resumen del Cambio */}
        {cambioTotal > 0 && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-2xl text-center space-y-0.5">
            <div className="text-[11px] uppercase font-semibold text-success font-label-sm tracking-wider">
              Cambio a Entregar
            </div>
            <div className="text-3xl font-black text-success font-mono">
              {fmtMoneda(cambioTotal)}
            </div>
          </div>
        )}

        {/* Voucher digital imprimible */}
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

          {/* Datos del Negocio (Solo se imprime si al menos un campo tiene texto) */}
          {tieneContacto && (
            <div className={`text-[10px] text-outline border-b border-outline/10 pb-1.5 space-y-0.5 ${getEstiloClasses(config.estiloContacto, 'text-center')}`}>
              {config.direccion?.trim() && <p>{config.direccion}</p>}
              {config.telefono?.trim() && <p>Tel: {config.telefono}</p>}
              {config.rfc?.trim() && <p>RFC: {config.rfc}</p>}
              {config.email?.trim() && <p>{config.email}</p>}
            </div>
          )}

          {/* Folio + Fecha y hora */}
          <div className="flex justify-between text-on-surface-variant text-[11px]">
            <span className="font-semibold">Folio: {venta.folio}</span>
            {config.mostrarFechaHora && (
              <span>{fmtFecha(venta.creadoEn)} {fmtHora(venta.creadoEn)}</span>
            )}
          </div>

          {/* Cajero */}
          {config.mostrarCajero && (
            <div className="text-on-surface-variant text-[11px]">
              Cajero: <span className="font-semibold text-on-surface">{venta.cajero?.nombre || 'Cajero'}</span>
            </div>
          )}

          {/* Cliente */}
          {config.mostrarCliente && venta.cliente && (
            <div className="text-on-surface-variant text-[11px]">
              Cliente: <span className="font-semibold text-on-surface">
                {venta.cliente.nombre} {venta.cliente.apellidoPaterno ?? ''}
              </span>
            </div>
          )}

          {/* Línea separadora */}
          <div className="border-t border-outline/20" />

          {/* Productos */}
          <div className="space-y-1">
            {(venta.detalles ?? []).map((det: VentaDetalle, i: number) => (
              <div key={i} className="flex justify-between text-on-surface">
                <div className="flex-1 min-w-0 pr-2">
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

          {/* Línea separadora */}
          <div className="border-t border-outline/20" />

          {/* Subtotal + Descuentos */}
          {venta.subtotal !== undefined && (
            <div className="space-y-0.5">
              <div className="flex justify-between text-on-surface-variant text-[11px]">
                <span>Subtotal</span>
                <span>{fmtMoneda(venta.subtotal)}</span>
              </div>
              {(venta.descuento ?? 0) > 0 && (
                <>
                  {descProductos > 0 && (
                    <div className="flex justify-between text-success text-[11px]">
                      <span>Descuento</span>
                      <span>-{fmtMoneda(descProductos)}</span>
                    </div>
                  )}
                  {(venta.descuentoNivel ?? 0) > 0 && (
                    <div className="flex justify-between text-success text-[11px]">
                      <span>Dto. nivel cliente</span>
                      <span>-{fmtMoneda(venta.descuentoNivel!)}</span>
                    </div>
                  )}
                  {(venta.descuentoCanje ?? 0) > 0 && (
                    <div className="flex justify-between text-success text-[11px]">
                      <span>Canje puntos</span>
                      <span>-{fmtMoneda(venta.descuentoCanje!)}</span>
                    </div>
                  )}
                  {(venta.descuentoCupon ?? 0) > 0 && (
                    <div className="flex justify-between text-success text-[11px]">
                      <span>
                        Cupón {venta.cuponRedencion?.cupon?.codigo ?? ''}
                      </span>
                      <span>-{fmtMoneda(venta.descuentoCupon!)}</span>
                    </div>
                  )}
                </>
              )}
              {config.mostrarImpuestos && (venta.impuestos ?? 0) > 0 && (
                <div className="flex justify-between text-on-surface-variant text-[11px]">
                  <span>Impuestos</span>
                  <span>{fmtMoneda(venta.impuestos!)}</span>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="border-t border-outline/20 pt-1.5">
            <div className="flex justify-between font-bold text-primary text-base font-black">
              <span>TOTAL</span>
              <span>{fmtMoneda(venta.total)}</span>
            </div>
          </div>

          {/* Métodos de pago */}
          {config.mostrarDesglosePagos && (
            <div className="border-t border-outline/20 pt-1.5 space-y-1">
              {pagos.map((p: VentaPago, i: number) => (
                <div key={i} className="flex justify-between text-[11px] text-on-surface-variant">
                  <span className="capitalize">
                    {p.metodo}
                    {p.referencia ? ` (${p.referencia})` : ''}
                  </span>
                  <span className="font-medium text-on-surface">
                    {fmtMoneda(p.montoPagado)}
                    {p.cambio > 0 && (
                      <span className="text-outline"> → Recibido {fmtMoneda(p.montoRecibido)}, cambio {fmtMoneda(p.cambio)}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pie */}
          {config.mensajePie?.trim() && (
            <div className={`border-t border-outline/20 pt-2 text-[10px] text-outline ${getEstiloClasses(config.estiloPie, 'text-center')}`}>
              {config.mensajePie}
            </div>
          )}
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
