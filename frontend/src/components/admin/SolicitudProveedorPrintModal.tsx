import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { SolicitudProveedor } from '@/types/solicitudProveedor';
import { api, obtenerUrlImagen } from '@/lib/api';

interface ConfigTicketData {
  logoUrl?: string;
  mostrarLogo?: boolean;
  encabezado?: string;
  slogan?: string;
  rfc?: string;
  telefono?: string;
  direccion?: string;
  email?: string;
}

interface SolicitudProveedorPrintModalProps {
  solicitud: SolicitudProveedor;
  nombreEmpresa?: string;
  logoEmpresaUrl?: string;
  onClose: () => void;
}

export const SolicitudProveedorPrintModal: React.FC<SolicitudProveedorPrintModalProps> = ({
  solicitud,
  nombreEmpresa = 'CUDII POS',
  logoEmpresaUrl,
  onClose,
}) => {
  const [copiado, setCopiado] = useState(false);
  const [logoTicket, setLogoTicket] = useState<string | undefined>(logoEmpresaUrl);
  const [ticketConfig, setTicketConfig] = useState<ConfigTicketData | null>(null);
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);

  // Determinar elemento de montaje del portal (preferir tab-modal-portal para no cubrir sidebar ni header)
  useEffect(() => {
    const portal = document.getElementById('tab-modal-portal');
    setTargetEl(portal || document.body);
  }, []);

  // Bloquear el scroll de la vista mientras el modal esté abierto
  useEffect(() => {
    const scrollable = document.querySelector('.overflow-y-auto') as HTMLElement | null;
    if (scrollable) {
      const prev = scrollable.style.overflow;
      scrollable.style.overflow = 'hidden';
      return () => {
        scrollable.style.overflow = prev;
      };
    }
  }, []);

  // Cargar la configuración exacta del ticket para usar el mismo logo configurado y encabezado
  useEffect(() => {
    let activo = true;
    api
      .get('/company-settings/ticket')
      .then((res) => {
        if (activo && res.data) {
          const cfg = (res.data.venta || res.data.presupuesto) as ConfigTicketData;
          if (cfg) {
            setTicketConfig(cfg);
            const logo = cfg.logoUrl || res.data.venta?.logoUrl || res.data.presupuesto?.logoUrl;
            if (logo) {
              setLogoTicket(logo);
            }
          }
        }
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  const debeMostrarLogo = ticketConfig?.mostrarLogo !== false;
  const logoFinal = debeMostrarLogo ? (logoTicket || logoEmpresaUrl) : undefined;

  const fmtMoneda = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  const fmtFecha = (f?: string | null) => {
    if (!f) return 'N/A';
    try {
      return new Date(f).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return f;
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleCopiarTexto = () => {
    const proveedorNombre = solicitud.proveedor?.nombre || 'Solicitud Abierta (Sin proveedor)';
    let texto = `📋 *SOLICITUD DE PRODUCTOS / ORDEN DE COMPRA*\n`;
    texto += `Folio: *${solicitud.folio}*\n`;
    texto += `Fecha: ${fmtFecha(solicitud.fechaEmision)}\n`;
    texto += `Proveedor: *${proveedorNombre}*\n`;
    if (solicitud.fechaEntregaEsperada) {
      texto += `Entrega Esperada: ${fmtFecha(solicitud.fechaEntregaEsperada)}\n`;
    }
    texto += `------------------------------------\n`;
    texto += `*ARTÍCULOS SOLICITADOS:*\n`;

    solicitud.detalles.forEach((d, i) => {
      texto += `${i + 1}. *${d.nombreProducto}* x ${d.cantidadRequerida} ${d.unidadMedida || 'pieza'}`;
      if (d.costoUnitarioEstimado > 0) {
        texto += ` (@ ${fmtMoneda(d.costoUnitarioEstimado)} = ${fmtMoneda(d.subtotalEstimado)})`;
      }
      if (d.notas) texto += ` [Nota: ${d.notas}]`;
      texto += `\n`;
    });

    if (solicitud.totalEstimado > 0) {
      texto += `------------------------------------\n`;
      texto += `*TOTAL ESTIMADO: ${fmtMoneda(solicitud.totalEstimado)}*\n`;
    }

    if (solicitud.notas) {
      texto += `\nNotas: ${solicitud.notas}\n`;
    }

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    toast.success('Resumen de la solicitud copiado al portapapeles.');
    setTimeout(() => setCopiado(false), 2500);
  };

  if (!targetEl) return null;

  const esPortalTab = targetEl.id === 'tab-modal-portal';

  const modalJSX = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={
        esPortalTab
          ? 'pointer-events-auto absolute inset-0 bg-black/60 flex items-center justify-center p-4 sm:p-6 animate-in fade-in-0 z-40'
          : 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-6 my-auto animate-in fade-in-0'
      }
    >
      <div className="bg-surface border border-outline/20 rounded-3xl max-w-3xl w-full max-h-[calc(100%-2.5rem)] my-auto flex flex-col shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Barra superior de controles fija en el modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm text-on-surface font-headline-md">
              Vista Previa de Solicitud ({solicitud.folio})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCopiarTexto} className="text-xs">
              {copiado ? <Check className="w-4 h-4 mr-1 text-success" /> : <Copy className="w-4 h-4 mr-1" />}
              {copiado ? '¡Copiado!' : 'Copiar para WhatsApp'}
            </Button>
            <Button type="button" size="sm" onClick={handleImprimir} className="font-bold text-xs shadow-sm">
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir Documento
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenedor desplazable con padding inferior para que el documento nunca toque el borde */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-surface-container-high/30">
          <div className="w-full max-w-2xl mx-auto pb-8">
            <div
              id="printable-document"
              className="printable-document bg-white text-black p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 w-full font-sans text-left space-y-6"
            >
              {/* Cabecera Documental con Logo Idéntico al Ticket de Venta */}
              <div className="flex items-center justify-between border-b border-gray-300 pb-5 gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {logoFinal && (
                    <img
                      src={obtenerUrlImagen(logoFinal)}
                      alt={nombreEmpresa}
                      className="max-h-14 w-auto max-w-[160px] object-contain shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <h1 className="text-lg font-black uppercase tracking-wider text-gray-900 leading-tight">
                      {ticketConfig?.encabezado?.trim() || nombreEmpresa}
                    </h1>
                    <p className="text-[10px] font-semibold text-gray-500 tracking-wide mt-0.5">
                      REQUISICIÓN / SOLICITUD DE COMPRA A PROVEEDOR
                    </p>
                    {(ticketConfig?.rfc || ticketConfig?.telefono || ticketConfig?.direccion) && (
                      <div className="text-[10px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {ticketConfig.rfc && <span>RFC: {ticketConfig.rfc}</span>}
                        {ticketConfig.telefono && <span>Tel: {ticketConfig.telefono}</span>}
                        {ticketConfig.direccion && <span>{ticketConfig.direccion}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right border-l-2 border-primary pl-4 shrink-0">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    FOLIO DE SOLICITUD
                  </div>
                  <div className="text-xl font-black font-mono text-gray-900 tracking-tight">
                    {solicitud.folio}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Fecha Emisión: {fmtFecha(solicitud.fechaEmision)}
                  </div>
                  {solicitud.fechaEntregaEsperada && (
                    <div className="text-xs font-semibold text-gray-700">
                      Entrega Esperada: {fmtFecha(solicitud.fechaEntregaEsperada)}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila de Datos: Proveedor vs Datos Generales */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                <div>
                  <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1">PROVEEDOR DESTINATARIO</span>
                  {solicitud.proveedor ? (
                    <>
                      <div className="font-bold text-gray-900 text-sm">{solicitud.proveedor.nombre}</div>
                      {solicitud.proveedor.rfc && <div>RFC: {solicitud.proveedor.rfc}</div>}
                      {solicitud.proveedor.contacto && <div>Contacto: {solicitud.proveedor.contacto}</div>}
                      {solicitud.proveedor.telefono && <div>Teléfono: {solicitud.proveedor.telefono}</div>}
                      {solicitud.proveedor.email && <div>Email: {solicitud.proveedor.email}</div>}
                    </>
                  ) : (
                    <div className="font-bold text-gray-700 italic">-- Solicitud Abierta / Requisición Interna --</div>
                  )}
                </div>

                <div>
                  <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1">DETALLES DE EMISIÓN</span>
                  <div>Emitido por: {solicitud.creadoPor?.nombre || 'Administración'}</div>
                  <div>Rol: {solicitud.creadoPor?.rol || 'Administrador'}</div>
                  <div>Estado: <strong className="uppercase">{solicitud.estado}</strong></div>
                </div>
              </div>

              {/* Tabla de Artículos Solicitados con Footer de Total Integrado y Alineado */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center justify-between">
                  <span>Artículos Requeridos</span>
                  <span className="text-[11px] text-gray-500 font-normal">
                    {solicitud.detalles.length} {solicitud.detalles.length === 1 ? 'artículo' : 'artículos'}
                  </span>
                </div>

                <div className="rounded-xl border border-gray-300 overflow-hidden shadow-2xs w-full">
                  <table className="w-full text-xs text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-2.5 border-r border-gray-300 w-10 text-center">#</th>
                        <th className="p-2.5 border-r border-gray-300">Producto</th>
                        <th className="p-2.5 border-r border-gray-300 text-center w-20">Unidad</th>
                        <th className="p-2.5 border-r border-gray-300 text-center w-24">Cant. Requerida</th>
                        <th className="p-2.5 border-r border-gray-300 text-right w-24">Costo Est.</th>
                        <th className="p-2.5 text-right w-28">Subtotal Est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 font-mono">
                      {solicitud.detalles.map((d, i) => (
                        <tr key={d.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                          <td className="p-2.5 border-r border-gray-200 text-gray-500 font-sans text-center">{i + 1}</td>
                          <td className="p-2.5 border-r border-gray-200 font-sans">
                            <span className="font-semibold text-gray-900 block">{d.nombreProducto}</span>
                            {d.notas && (
                              <span className="block text-[10px] font-normal text-gray-500 italic mt-0.5">
                                Nota: {d.notas}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 border-r border-gray-200 text-center capitalize font-sans">{d.unidadMedida || 'pieza'}</td>
                          <td className="p-2.5 border-r border-gray-200 text-center font-bold text-gray-900">{d.cantidadRequerida}</td>
                          <td className="p-2.5 border-r border-gray-200 text-right text-gray-700">{fmtMoneda(d.costoUnitarioEstimado)}</td>
                          <td className="p-2.5 text-right font-bold text-gray-950">{fmtMoneda(d.subtotalEstimado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Footer de Total General: 100% integrado al contenedor del inventario */}
                  <div className="flex justify-between items-center px-4 py-3.5 bg-gray-900 text-white border-t border-gray-900">
                    <div>
                      <span className="text-xs uppercase font-bold tracking-wider text-gray-300 block">
                        TOTAL ESTIMADO DE COMPRA
                      </span>
                      <div className="text-[10px] text-gray-400 font-sans">
                        Sujeto a confirmación y facturación por el proveedor.
                      </div>
                    </div>
                    <div className="text-2xl font-black font-mono text-white tracking-tight">
                      {fmtMoneda(solicitud.totalEstimado)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notas generales */}
              {solicitud.notas && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <span className="font-bold text-gray-700 block mb-0.5">Observaciones / Instrucciones:</span>
                  <p className="text-gray-600 font-sans">{solicitud.notas}</p>
                </div>
              )}

              {/* Líneas de Firma */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-center text-xs">
                <div>
                  <div className="border-t border-gray-400 w-3/4 mx-auto pt-1 font-bold text-gray-800">
                    Firma Solicitante / Almacén
                  </div>
                  <div className="text-[10px] text-gray-500">{solicitud.creadoPor?.nombre || 'CUDII POS'}</div>
                </div>
                <div>
                  <div className="border-t border-gray-400 w-3/4 mx-auto pt-1 font-bold text-gray-800">
                    Firma Recibido / Proveedor
                  </div>
                  <div className="text-[10px] text-gray-500">Conformidad de Recepción</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalJSX, targetEl);
};
