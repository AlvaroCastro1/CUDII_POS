import React, { useState, useCallback } from 'react';
import {
  RotateCcw,
  Search,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Ban,
  PackageCheck,
  History,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, errorMessage } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import type {
  TipoResolucionDevolucion,
  Venta,
  VentaDetalle,
  VentaDevolucion,
  VentaDevolucionProducto,
} from '../types/pos';

// Forma de una devolución del endpoint GET /returns
interface DevolucionHistorial {
  id: string;
  folio: string;
  totalDevuelto: number;
  tipoResolucion: TipoResolucionDevolucion;
  motivoGeneral?: string | null;
  fechaHora: string;
  venta?: { id: string; folio: string } | null;
  usuario?: { id: string; nombre: string } | null;
  productos?: {
    id: string;
    cantidadDevuelta: number;
    producto?: { nombre: string } | null;
  }[];
}

const ETIQUETAS_RESOLUCION: Record<TipoResolucionDevolucion, string> = {
  reembolso_efectivo: 'Reembolso en Efectivo',
  cambio_fisico: 'Cambio Físico',
  saldo_favor: 'Saldo a Favor',
};

export const DevolucionesView: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const puedeVerHistorial = ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CONTADOR'].includes(
    user?.rol ?? '',
  );

  // Pestaña activa: registro manual o historial general
  const [tabActiva, setTabActiva] = useState<'nueva' | 'historial'>('nueva');
  const [historial, setHistorial] = useState<DevolucionHistorial[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const [searchFolio, setSearchFolio] = useState('');
  const [venta, setVenta] = useState<Venta | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estado de ítems seleccionados para devolución
  const [selectedItems, setSelectedItems] = useState<{
    [productoId: string]: {
      cantidad: number;
      motivo: string;
      destino: 'stock' | 'merma';
    };
  }>({});

  const [tipoResolucion, setTipoResolucion] = useState<TipoResolucionDevolucion>(
    'reembolso_efectivo',
  );

  /**
   * Calcula cuántas unidades de un productoId ya fueron devueltas en devoluciones anteriores.
   * Recorre todas las devoluciones de la venta y acumula cantidadDevuelta.
   */
  const calcularYaDevuelto = (productoId: string): number => {
    if (!venta?.devoluciones?.length) return 0;
    return venta.devoluciones.reduce((total: number, dev: VentaDevolucion) => {
      const itemDev = dev.productos?.find(
        (p: VentaDevolucionProducto) => p.productoId === productoId,
      );
      return total + (itemDev?.cantidadDevuelta ?? 0);
    }, 0);
  };

  const handleSearchVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchFolio.trim()) return;

    setIsSearching(true);
    setError(null);
    setSuccessMsg(null);
    setVenta(null);
    setSelectedItems({});

    try {
      const res = await api.get(`/sales/${searchFolio.trim()}`);
      setVenta(res.data);
    } catch (err: unknown) {
      console.error('Error al buscar ticket para devolución:', err);
      setError(
        errorMessage(err, 'No se encontró ninguna venta con el folio ingresado'),
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Carga el historial completo de devoluciones de la empresa
  const cargarHistorial = useCallback(async () => {
    try {
      setCargandoHistorial(true);
      const res = await api.get('/returns');
      setHistorial(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch (err: unknown) {
      console.error('Error al cargar historial de devoluciones:', err);
      toast.error(errorMessage(err, 'Error al cargar el historial de devoluciones'));
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  // Carga perezosa: solo se consulta la API al abrir la pestaña por primera vez
  const cambiarTab = (tab: 'nueva' | 'historial') => {
    setTabActiva(tab);
    if (tab === 'historial' && historial.length === 0) {
      cargarHistorial();
    }
  };

  const toggleItemSelection = (det: VentaDetalle, disponible: number) => {
    // No permitir selección si no queda nada por devolver
    if (disponible <= 0) return;

    if (selectedItems[det.productoId]) {
      const newMap = { ...selectedItems };
      delete newMap[det.productoId];
      setSelectedItems(newMap);
    } else {
      setSelectedItems({
        ...selectedItems,
        [det.productoId]: {
          cantidad: 1,
          motivo: 'cambio_opinion',
          destino: 'stock',
        },
      });
    }
  };

  const handleItemChange = (productoId: string, field: string, value: string) => {
    if (!selectedItems[productoId]) return;
    setSelectedItems({
      ...selectedItems,
      [productoId]: {
        ...selectedItems[productoId],
        [field]: field === 'cantidad' ? Number(value) : value,
      },
    });
  };

  const handleProcessReturn = async () => {
    const keys = Object.keys(selectedItems);
    if (keys.length === 0) {
      setError('Selecciona al menos un producto para devolver');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const productosPayload = keys.map((pId) => {
        const item = selectedItems[pId];
        const det = venta.detalles.find((d: VentaDetalle) => d.productoId === pId);
        return {
          productoId: pId,
          cantidadDevuelta: Number(item.cantidad),
          precioUnitario: det.precioUnitario,
          motivo: item.motivo,
          destino: item.destino,
        };
      });

      const payload = {
        ventaId: venta.id,
        tipoResolucion,
        productos: productosPayload,
      };

      const res = await api.post('/returns', payload);

      setSuccessMsg(`Devolución procesada exitosamente con Folio: ${res.data.folio}`);
      setVenta(null);
      setSelectedItems({});
      setSearchFolio('');
    } catch (err: unknown) {
      console.error('Error al procesar devolución:', err);
      setError(errorMessage(err, 'Ocurrió un error al registrar la devolución'));
    } finally {
      setIsProcessing(false);
    }
  };

  // ¿Todos los productos de la venta están completamente devueltos?
  const todosAgotados =
    venta?.detalles?.length > 0 &&
    venta.detalles.every((det: VentaDetalle) => calcularYaDevuelto(det.productoId) >= det.cantidad);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-on-surface">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="p-2.5 spatial-glass rounded-2xl text-primary hover:bg-surface-container-high transition-colors border border-outline/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary font-headline-md flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-primary" />
              Devoluciones de Venta
            </h1>
            <p className="text-xs text-outline font-body-md">
              Busca el ticket por folio para procesar reembolsos a stock o merma
            </p>
          </div>
        </div>
      </div>

      {/* Pestañas: Nueva Devolución / Historial */}
      {puedeVerHistorial && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cambiarTab('nueva')}
            className={`px-5 py-2.5 rounded-2xl font-semibold text-sm transition-colors border ${
              tabActiva === 'nueva'
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-low text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
            }`}
          >
            <RotateCcw className="w-4 h-4 inline mr-2 -mt-0.5" />
            Nueva Devolución
          </button>
          <button
            type="button"
            onClick={() => cambiarTab('historial')}
            className={`px-5 py-2.5 rounded-2xl font-semibold text-sm transition-colors border ${
              tabActiva === 'historial'
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-low text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
            }`}
          >
            <History className="w-4 h-4 inline mr-2 -mt-0.5" />
            Historial
          </button>
        </div>
      )}

      {tabActiva === 'historial' && puedeVerHistorial ? (
        /* ===================== HISTORIAL DE DEVOLUCIONES ===================== */
        <div className="liquid-glass border border-outline/20 rounded-[28px] p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-primary font-headline-md">
                Devoluciones Registradas
              </h3>
              <p className="text-xs text-outline font-body-md mt-0.5">
                Todas las devoluciones de la empresa, de la más reciente a la más antigua
              </p>
            </div>
            <button
              type="button"
              onClick={cargarHistorial}
              disabled={cargandoHistorial}
              className="px-4 py-2 rounded-xl border border-outline/20 text-on-surface-variant hover:bg-surface-container-high text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {cargandoHistorial ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          {cargandoHistorial && historial.length === 0 ? (
            <div className="flex items-center justify-center py-12 gap-3 text-outline">
              <RotateCcw className="w-5 h-5 animate-spin" />
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-outline">
              <PackageCheck className="w-14 h-14 mb-3 opacity-30" />
              <p className="font-medium">Aún no hay devoluciones registradas</p>
              <p className="text-sm mt-1">Las devoluciones procesadas aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline/20 text-left text-[11px] uppercase tracking-wider text-outline">
                    <th className="py-3 px-2">Folio</th>
                    <th className="py-3 px-2">Fecha</th>
                    <th className="py-3 px-2">Ticket Original</th>
                    <th className="py-3 px-2">Productos</th>
                    <th className="py-3 px-2">Resolución</th>
                    <th className="py-3 px-2">Registró</th>
                    <th className="py-3 px-2 text-right">Total Devuelto</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((dev) => (
                    <tr key={dev.id} className="border-b border-outline/10 hover:bg-surface-container-low/60">
                      <td className="py-3 px-2 font-mono font-bold text-primary">{dev.folio}</td>
                      <td className="py-3 px-2 text-outline whitespace-nowrap">
                        {new Date(dev.fechaHora).toLocaleString('es-MX')}
                      </td>
                      <td className="py-3 px-2 font-mono">{dev.venta?.folio ?? '—'}</td>
                      <td className="py-3 px-2 text-outline">
                        {dev.productos?.length ?? 0}{' '}
                        {(dev.productos?.length ?? 0) === 1 ? 'producto' : 'productos'}
                      </td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-high border border-outline/20 text-[11px] font-semibold">
                          {ETIQUETAS_RESOLUCION[dev.tipoResolucion]}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-outline">{dev.usuario?.nombre ?? '—'}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-error">
                        -${dev.totalDevuelto.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
      {successMsg && (
        <div className="p-4 bg-success/10 border border-success/30 rounded-2xl text-success flex items-center gap-3 text-sm font-semibold">
          <CheckCircle className="w-6 h-6 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-2xl text-error flex items-center gap-3 text-sm font-semibold">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Buscador de Ticket */}
      <div className="liquid-glass border border-outline/20 rounded-[28px] p-6 shadow-2xl space-y-4">
        <form onSubmit={handleSearchVenta} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-outline" />
            <input
              type="text"
              value={searchFolio}
              onChange={(e) => setSearchFolio(e.target.value)}
              placeholder="Ingresa el folio del ticket (ej: CJ6AF8-000002)..."
              className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-outline/20 rounded-2xl text-primary font-bold focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-3 bg-primary text-on-primary font-bold rounded-2xl transition-transform hover:scale-[1.01] active:scale-95 shadow-lg font-headline-md"
          >
            {isSearching ? 'Buscando...' : 'Buscar Ticket'}
          </button>
        </form>
      </div>

      {/* Detalle del Ticket Encontrado */}
      {venta && (
        <div className="liquid-glass border border-outline/20 rounded-[28px] p-6 shadow-2xl space-y-6">
          {/* Cabecera del ticket */}
          <div className="flex items-center justify-between border-b border-outline/20 pb-4">
            <div>
              <div className="text-xl font-bold text-primary font-mono">Ticket: {venta.folio}</div>
              <div className="text-xs text-outline font-body-md mt-0.5">
                Fecha: {new Date(venta.creadoEn).toLocaleString()} • Cajero: {venta.cajero?.nombre || 'Cajero'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-outline font-label-sm uppercase tracking-wider">Total Original</div>
              <div className="text-3xl font-black text-primary font-mono">${venta.total.toFixed(2)}</div>
            </div>
          </div>

          {/* Banner si todos los productos ya fueron devueltos */}
          {todosAgotados && (
            <div className="p-4 bg-warning/10 border border-warning/30 rounded-2xl flex items-center gap-3">
              <Ban className="w-5 h-5 text-warning shrink-0" />
              <div>
                <div className="text-sm font-bold text-warning font-headline-md">Devolución ya Completada</div>
                <div className="text-xs text-outline font-body-md">Todos los productos de este ticket ya fueron devueltos en su totalidad.</div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-primary font-headline-md">
              Selecciona los productos a devolver:
            </h3>

            {venta.detalles?.map((det: VentaDetalle) => {
              const yaDevuelto = calcularYaDevuelto(det.productoId);
              const disponible = det.cantidad - yaDevuelto;
              const agotado = disponible <= 0;
              const isSelected = !!selectedItems[det.productoId];

              return (
                <div
                  key={det.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    agotado
                      ? 'bg-surface-container-low border-outline/10 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'spatial-glass border-primary/40 bg-surface-container-high'
                      : 'bg-surface-container-low border-outline/20 hover:border-outline/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <label
                      className={`flex items-center gap-3 select-none ${agotado ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {/* Checkbox — deshabilitado si agotado */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={agotado}
                        onChange={() => toggleItemSelection(det, disponible)}
                        className="w-5 h-5 rounded border-outline/40 text-primary focus:ring-primary bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <div>
                        <div className="font-semibold text-primary text-sm font-headline-md">
                          {det.nombreProducto}
                        </div>
                        <div className="text-xs text-outline font-label-sm mt-0.5">
                          Comprado: {det.cantidad} {det.unidadMedida} • ${det.precioUnitario.toFixed(2)} c/u
                        </div>
                      </div>
                    </label>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Indicador de devoluciones previas */}
                      {yaDevuelto > 0 && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border font-label-sm ${
                          agotado
                            ? 'text-error bg-error/10 border-error/30'
                            : 'text-warning bg-warning/10 border-warning/30'
                        }`}>
                          {agotado
                            ? <><Ban className="w-3 h-3" /> Devuelto</>
                            : <><PackageCheck className="w-3 h-3" /> {yaDevuelto} devuelta{yaDevuelto > 1 ? 's' : ''}</>
                          }
                        </div>
                      )}

                      {/* Disponibles a devolver */}
                      {!agotado && (
                        <div className="text-right">
                          <div className="font-mono font-bold text-primary text-base">${det.total.toFixed(2)}</div>
                          <div className="text-[10px] text-outline font-label-sm">
                            {disponible} disponible{disponible !== 1 ? 's' : ''} a devolver
                          </div>
                        </div>
                      )}

                      {agotado && (
                        <div className="font-mono font-bold text-outline/50 text-base line-through">${det.total.toFixed(2)}</div>
                      )}
                    </div>
                  </div>

                  {/* Controles de devolución — solo si está seleccionado y no agotado */}
                  {isSelected && !agotado && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-3 border-t border-outline/20 text-xs">
                      <div>
                        <label className="block text-outline mb-1 font-semibold font-label-sm">
                          Cantidad a Devolver (máx. {disponible}):
                        </label>
                        <input
                          type="number"
                          max={disponible}
                          min={1}
                          step={1}
                          value={selectedItems[det.productoId].cantidad}
                          onChange={(e) =>
                            handleItemChange(
                              det.productoId,
                              'cantidad',
                              Math.min(disponible, Math.max(1, parseInt(e.target.value) || 1)),
                            )
                          }
                          className="w-full p-2.5 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-bold font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-outline mb-1 font-semibold font-label-sm">
                          Motivo de Devolución:
                        </label>
                        <select
                          value={selectedItems[det.productoId].motivo}
                          onChange={(e) => handleItemChange(det.productoId, 'motivo', e.target.value)}
                          className="w-full p-2.5 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-medium"
                        >
                          <option value="cambio_opinion">Cambio de Opinión</option>
                          <option value="cambio_talla">Cambio de Empaque/Presentación</option>
                          <option value="danado">Producto Dañado / Defectuoso</option>
                          <option value="caducado">Producto Caducado</option>
                          <option value="error_cobro">Error de Cobro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-outline mb-1 font-semibold font-label-sm">
                          Destino del Producto:
                        </label>
                        <select
                          value={selectedItems[det.productoId].destino}
                          onChange={(e) =>
                            handleItemChange(det.productoId, 'destino', e.target.value)
                          }
                          className="w-full p-2.5 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-medium"
                        >
                          <option value="stock">📦 Regresar a Stock (Vendible)</option>
                          <option value="merma">🗑️ Enviar a Merma (Dañado)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer de resolución y acción — oculto si todo está agotado */}
          {!todosAgotados && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline/20">
              <div>
                <label className="block text-xs font-semibold text-outline mb-1 font-label-sm">
                  Tipo de Resolución al Cliente:
                </label>
                <select
                  value={tipoResolucion}
                  onChange={(e) =>
                    setTipoResolucion(e.target.value as TipoResolucionDevolucion)
                  }
                  className="p-3 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm font-semibold"
                >
                  <option value="reembolso_efectivo">💵 Reembolso en Efectivo</option>
                  <option value="cambio_fisico">🔄 Cambio Físico por Producto</option>
                  <option value="saldo_favor">💳 Saldo a Favor del Cliente</option>
                </select>
              </div>

              <button
                type="button"
                disabled={isProcessing || Object.keys(selectedItems).length === 0}
                onClick={handleProcessReturn}
                className="px-8 py-4 bg-primary text-on-primary font-bold rounded-2xl transition-transform hover:scale-[1.01] active:scale-95 shadow-lg font-headline-md text-base min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isProcessing ? 'Procesando devolución...' : 'PROCESAR DEVOLUCIÓN'}
              </button>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default DevolucionesView;
