import React from 'react';
import { X, Printer, Share2, Copy, Check, Building2, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { SolicitudProveedor } from '@/types/solicitudProveedor';
import { obtenerUrlImagen } from '@/lib/api';

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
  const [copiado, setCopiado] = React.useState(false);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-in fade-in-0">
      <div className="bg-surface border border-outline/20 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Barra superior de controles */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface-container-low">
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

        {/* Documento Imprimible Formal */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface-container-high/30 flex justify-center">
          <div
            id="printable-ticket"
            className="printable-voucher bg-white text-black p-8 rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl font-sans text-left space-y-6"
          >
            {/* Cabecera Documental */}
            <div className="flex justify-between items-start border-b border-gray-300 pb-6 flex-wrap gap-4">
              <div>
                {logoEmpresaUrl && (
                  <img
                    src={obtenerUrlImagen(logoEmpresaUrl)}
                    alt="Logo Empresa"
                    className="max-h-12 object-contain mb-2"
                  />
                )}
                <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">{nombreEmpresa}</h1>
                <p className="text-xs text-gray-600">REQUISICIÓN / SOLICITUD DE COMPRA A PROVEEDOR</p>
              </div>

              <div className="text-right border-l-2 border-primary pl-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">FOLIO DE SOLICITUD</div>
                <div className="text-2xl font-black font-mono text-gray-900">{solicitud.folio}</div>
                <div className="text-xs text-gray-600 mt-1">Fecha Emisión: {fmtFecha(solicitud.fechaEmision)}</div>
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

            {/* Tabla de Artículos Solicitados */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-700">Artículos Requeridos</div>
              <table className="w-full text-xs text-left border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-2 border.r border-gray-300">#</th>
                    <th className="p-2 border-r border-gray-300">Producto</th>
                    <th className="p-2 border-r border-gray-300 text-center">Unidad</th>
                    <th className="p-2 border-r border-gray-300 text-center">Cant. Requerida</th>
                    <th className="p-2 border-r border-gray-300 text-right">Costo Est.</th>
                    <th className="p-2 text-right">Subtotal Est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  {solicitud.detalles.map((d, i) => (
                    <tr key={d.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 border-r border-gray-200 text-gray-500 font-sans">{i + 1}</td>
                      <td className="p-2 border-r border-gray-200 font-sans font-semibold text-gray-900">
                        {d.nombreProducto}
                        {d.notas && <span className="block text-[10px] font-normal text-gray-500 italic">Nota: {d.notas}</span>}
                      </td>
                      <td className="p-2 border-r border-gray-200 text-center capitalize">{d.unidadMedida || 'pieza'}</td>
                      <td className="p-2 border-r border-gray-200 text-center font-bold text-gray-900">{d.cantidadRequerida}</td>
                      <td className="p-2 border-r border-gray-200 text-right">{fmtMoneda(d.costoUnitarioEstimado)}</td>
                      <td className="p-2 text-right font-bold">{fmtMoneda(d.subtotalEstimado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total General */}
            <div className="flex justify-between items-center p-4 bg-gray-900 text-white rounded-xl">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-gray-400">TOTAL ESTIMADO DE COMPRA</span>
                <div className="text-[10px] text-gray-400 font-sans">Sujeto a confirmación y facturación por el proveedor.</div>
              </div>
              <div className="text-2xl font-black font-mono">
                {fmtMoneda(solicitud.totalEstimado)}
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
  );
};
