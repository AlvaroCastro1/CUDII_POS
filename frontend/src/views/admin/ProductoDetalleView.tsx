import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================
// Interfaces para la respuesta del backend
// ============================================================
interface UsuarioResumen {
  id: string;
  nombre: string;
  email: string;
}

interface Categoria {
  id: string;
  nombre: string;
  colorHex?: string;
  icono?: string;
}

interface PrecioUnidad {
  id: string;
  unidad: string;
  nombreAlternativo?: string;
  cantidadMinima: number;
  precio: number;
  esDefault: boolean;
}

interface HistorialPrecio {
  id: string;
  tipoPrecio: string;
  precioAnterior: number;
  precioNuevo: number;
  motivo: string;
  fechaHora: string;
  usuario: UsuarioResumen;
}

interface MovimientoInventario {
  id: string;
  tipo: string;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  motivo: string;
  referencia?: string;
  fechaHora: string;
  usuario: UsuarioResumen;
}

interface StockSucursal {
  id: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  ultimoMovimiento: string;
  sucursal: {
    id: string;
    nombre: string;
  };
}

interface ProductoDetalle {
  id: string;
  nombre: string;
  codigoBarras: string;
  codigoInterno?: string;
  descripcion?: string;
  unidadMedida: string;
  esGranel: boolean;
  estaActivo: boolean;
  precioCompra: number;
  precioVentaBase: number;
  tieneCaducidad?: boolean;
  manejaInventario?: boolean;
  metodoRotacion?: 'FIFO' | 'FEFO';
  creadoEn: string;
  actualizadoEn: string;
  categorias: Categoria[];
  preciosPorUnidad: PrecioUnidad[];
  historialPrecios: HistorialPrecio[];
  inventario: StockSucursal[];
  movimientos: MovimientoInventario[];
}

// ============================================================
// Colores de tipos de movimiento
// ============================================================
const COLORES_MOVIMIENTO: Record<string, { bg: string; text: string; label: string }> = {
  venta:             { bg: 'bg-primary/10',   text: 'text-primary',   label: 'Venta' },
  devolucion_venta:  { bg: 'bg-purple-500/10', text: 'text-purple-600', label: 'Devolución' },
  ajuste_positivo:   { bg: 'bg-success/10',  text: 'text-success',  label: 'Entrada' },
  ajuste_negativo:   { bg: 'bg-error/10',    text: 'text-error',    label: 'Salida' },
  traspaso_salida:   { bg: 'bg-warning/10',  text: 'text-warning',  label: 'Traspaso salida' },
  traspaso_entrada:  { bg: 'bg-teal-500/10',   text: 'text-teal-600',   label: 'Traspaso entrada' },
  compra:            { bg: 'bg-success/10', text: 'text-success', label: 'Compra' },
  apertura_inicial:  { bg: 'bg-gray-500/10',   text: 'text-gray-500',   label: 'Inicial' },
};

// ============================================================
// Vista de Detalle de Producto
// ============================================================
export default function ProductoDetalleView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [producto, setProducto] = useState<ProductoDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga el detalle del producto con historial, movimientos y stock
  useEffect(() => {
    if (!id) return;
    const cargar = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/products/${id}?incluirInactivos=true`);
        setProducto(res.data);
      } catch {
        toast.error('No se pudo cargar el detalle del producto');
        navigate('/admin/productos');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin !text-[40px] text-primary/40">progress_activity</span>
      </div>
    );
  }

  if (!producto) return null;

  // Cálculo de margen principal
  const margen = producto.precioCompra > 0
    ? ((producto.precioVentaBase - producto.precioCompra) / producto.precioCompra) * 100
    : null;

  // Stock total en todas las sucursales
  const stockTotal = producto.inventario.reduce((acc, inv) => acc + inv.stockActual, 0);

  return (
    <div className="p-6 space-y-6">
      {/* ===================== CABECERA ===================== */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/productos')} className="flex-shrink-0 mt-0.5">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-display-lg text-on-background truncate">{producto.nombre}</h1>
            <Badge variant={producto.estaActivo ? 'default' : 'secondary'}>
              {producto.estaActivo ? 'Activo' : 'Inactivo'}
            </Badge>
            {producto.esGranel && <Badge variant="secondary">Granel</Badge>}
            {producto.manejaInventario && (
              <Badge variant="outline" className="border-primary/30 text-primary">
                <span className="material-symbols-outlined !text-[12px] mr-1">inventory_2</span>
                Inventario
              </Badge>
            )}
            {producto.tieneCaducidad && (
              <Badge variant="outline" className="border-warning/40 text-warning">
                <span className="material-symbols-outlined !text-[12px] mr-1">schedule</span>
                Caducidad
              </Badge>
            )}
            {producto.manejaInventario && (
              <Badge variant="outline" className="border-outline/30">
                {producto.metodoRotacion || 'FEFO'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="font-mono text-sm text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-lg">{producto.codigoBarras}</span>
            {producto.codigoInterno && (
              <span className="text-sm text-on-surface-variant">SKU: {producto.codigoInterno}</span>
            )}
            <span className="text-sm text-on-surface-variant">Unidad: <strong>{producto.unidadMedida}</strong></span>
          </div>
          {/* Categorías */}
          {producto.categorias.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {producto.categorias.map(cat => (
                <span key={cat.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: cat.colorHex || '#64748b' }}>
                  <span className="material-symbols-outlined !text-[12px]">{cat.icono || 'category'}</span>
                  {cat.nombre}
                </span>
              ))}
            </div>
          )}
          {producto.descripcion && (
            <p className="text-sm text-on-surface-variant mt-2">{producto.descripcion}</p>
          )}
          <p className="text-xs text-on-surface-variant/60 mt-2">
            Creado: {new Date(producto.creadoEn).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
            {' · '}
            Actualizado: {new Date(producto.actualizadoEn).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
          </p>
        </div>
      </div>

      {/* ===================== TARJETAS DE INDICADORES ===================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stock total */}
        <div className={`rounded-xl p-4 border ${stockTotal <= 0 ? 'bg-error/5 border-error/20' : 'bg-surface border-on-surface/10'}`}>
          <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide font-semibold">Stock Total</p>
          <p className={`text-3xl font-bold font-display-lg ${stockTotal <= 0 ? 'text-error' : 'text-on-surface'}`}>
            {stockTotal.toLocaleString('es-MX')}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">{producto.unidadMedida.toLowerCase()}{stockTotal !== 1 ? 's' : ''} en {producto.inventario.length} sucursal(es)</p>
        </div>
        {/* Precio de Venta */}
        <div className="rounded-xl p-4 border bg-surface border-on-surface/10">
          <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide font-semibold">Precio de Venta</p>
          <p className="text-3xl font-bold font-display-lg text-on-surface">
            ${producto.precioVentaBase.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">por {producto.unidadMedida.toLowerCase()}</p>
        </div>
        {/* Precio de Compra */}
        <div className="rounded-xl p-4 border bg-surface border-on-surface/10">
          <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide font-semibold">Precio de Compra</p>
          <p className="text-3xl font-bold font-display-lg text-on-surface">
            ${producto.precioCompra.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">costo unitario</p>
        </div>
        {/* Margen */}
        <div className={`rounded-xl p-4 border ${margen === null ? 'bg-surface border-on-surface/10' : margen >= 0 ? 'bg-success/5 border-success/20' : 'bg-error/5 border-error/20'}`}>
          <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide font-semibold">Margen</p>
          <p className={`text-3xl font-bold font-display-lg ${margen === null ? 'text-on-surface' : margen >= 0 ? 'text-success' : 'text-error'}`}>
            {margen !== null ? `${margen.toFixed(1)}%` : 'N/A'}
          </p>
          {margen !== null && (
            <div className="mt-1">
              <p className="text-xs text-on-surface-variant">
                ganancia: ${(producto.precioVentaBase - producto.precioCompra).toFixed(2)} / unidad
              </p>
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <span className="cursor-help inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-on-surface-variant/80 border-b border-dashed border-on-surface-variant/40">
                      <span className="material-symbols-outlined !text-[14px]">info</span>
                      ¿Cómo se calcula?
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px] p-3 space-y-2">
                    <p className="font-semibold text-sm">Margen sobre el Costo (Markup)</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Representa qué porcentaje del costo has añadido como ganancia.
                    </p>
                    <div className="bg-surface-variant/30 p-2 rounded text-xs font-mono text-center">
                      ((Venta - Costo) / Costo) × 100
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>

      {/* ===================== CONFIGURACIÓN DE INVENTARIO ===================== */}
      {producto.manejaInventario !== undefined && (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-4">
          <h2 className="text-base font-semibold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined !text-[20px] text-primary">inventory_2</span>
            Configuración de Inventario
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-semibold">Maneja Inventario</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${producto.manejaInventario ? 'bg-success' : 'bg-outline'}`} />
                <p className="text-sm font-medium text-on-surface">{producto.manejaInventario ? 'Sí' : 'No (servicio)'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-semibold">Tiene Caducidad</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${producto.tieneCaducidad ? 'bg-warning' : 'bg-outline'}`} />
                <p className="text-sm font-medium text-on-surface">{producto.tieneCaducidad ? 'Sí — fecha obligatoria al recibir' : 'No — caducidad opcional'}</p>
              </div>
            </div>
            {producto.manejaInventario && (
              <div className="space-y-1">
                <p className="text-xs text-on-surface-variant uppercase tracking-wide font-semibold">Rotación</p>
                <p className="text-sm font-medium text-on-surface">{producto.metodoRotacion || 'FEFO'}</p>
                <p className="text-xs text-on-surface-variant">{producto.metodoRotacion === 'FIFO' ? 'Primero entra, primero se vende' : 'Primero vence, primero se vende'}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-semibold">Tipo de Venta</p>
              <p className="text-sm font-medium text-on-surface">{producto.esGranel ? 'A granel (decimales)' : 'Por pieza (enteros)'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PRECIOS POR UNIDAD ===================== */}
      {producto.preciosPorUnidad.length > 0 && (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-4">
          <h2 className="text-base font-semibold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined !text-[20px] text-primary">sell</span>
            Precios por Volumen
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {producto.preciosPorUnidad.map(pp => {
              const costoTotalPP = producto.precioCompra * pp.cantidadMinima;
              const margenPP = costoTotalPP > 0
                ? ((pp.precio - costoTotalPP) / costoTotalPP) * 100
                : null;
              return (
                <div key={pp.id} className="rounded-xl p-3 border border-on-surface/10 bg-surface-variant/30 space-y-1">
                  <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">{pp.unidad}</p>
                  <p className="text-lg font-bold text-on-surface">${pp.precio.toFixed(2)}</p>
                  {pp.nombreAlternativo && <p className="text-xs text-on-surface-variant">{pp.nombreAlternativo}</p>}
                  <p className="text-xs text-on-surface-variant">Desde {pp.cantidadMinima} unidades</p>
                  {margenPP !== null && (
                    <div className="pt-1 mt-1 border-t border-on-surface/5">
                      <p className={`text-xs font-semibold ${margenPP >= 0 ? 'text-success' : 'text-error'}`}>
                        Margen: {margenPP.toFixed(1)}%
                      </p>
                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <span className="cursor-help inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium text-on-surface-variant/70 border-b border-dashed border-on-surface-variant/30">
                              <span className="material-symbols-outlined !text-[12px]">info</span>
                              Fórmula
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px] p-2 space-y-1.5">
                            <p className="text-xs">
                              Calculado sobre el <strong>Costo Total</strong> del paquete ({pp.cantidadMinima} unidades × Costo Unitario).
                            </p>
                            <div className="bg-surface-variant/30 p-1.5 rounded text-[10px] font-mono text-center">
                              ((Venta - Costo) / Costo) × 100
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== STOCK POR SUCURSAL ===================== */}
      {producto.inventario.length > 0 && (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-4">
          <h2 className="text-base font-semibold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined !text-[20px] text-primary">warehouse</span>
            Stock por Sucursal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {producto.inventario.map(inv => (
              <div key={inv.id} className={`rounded-xl p-3 border space-y-1 ${inv.stockActual <= inv.stockMinimo ? 'border-error/30 bg-error/5' : 'border-on-surface/10 bg-surface-variant/30'}`}>
                <p className="text-sm font-semibold text-on-surface">{inv.sucursal.nombre}</p>
                <p className="text-2xl font-bold text-on-surface">{inv.stockActual}</p>
                <p className="text-xs text-on-surface-variant">Mín: {inv.stockMinimo} | Máx: {inv.stockMaximo}</p>
                {inv.stockActual <= inv.stockMinimo && (
                  <p className="text-xs text-error font-semibold">⚠ Stock bajo</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== HISTORIAL DE PRECIOS ===================== */}
      <div className="bg-surface rounded-xl border border-on-surface/10 p-4">
        <h2 className="text-base font-semibold text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined !text-[20px] text-primary">history</span>
          Historial de Precios
        </h2>
        {producto.historialPrecios.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-4 text-center">Sin registros de cambio de precio aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Precio Anterior</TableHead>
                  <TableHead className="text-right">Precio Nuevo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producto.historialPrecios.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm text-on-surface-variant whitespace-nowrap">
                      {new Date(h.fechaHora).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {h.tipoPrecio === 'precioVentaBase' ? 'Precio Venta' : h.tipoPrecio === 'precioCompra' ? 'Precio Compra' : h.tipoPrecio}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-on-surface-variant">
                      ${h.precioAnterior.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span className={h.precioNuevo > h.precioAnterior ? 'text-success' : h.precioNuevo < h.precioAnterior ? 'text-error' : 'text-on-surface'}>
                        ${h.precioNuevo.toFixed(2)}
                        {h.precioNuevo > h.precioAnterior ? ' ▲' : h.precioNuevo < h.precioAnterior ? ' ▼' : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-on-surface-variant max-w-[200px] truncate">{h.motivo}</TableCell>
                    <TableCell className="text-sm text-on-surface-variant">{h.usuario?.nombre || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ===================== MOVIMIENTOS DE INVENTARIO ===================== */}
      <div className="bg-surface rounded-xl border border-on-surface/10 p-4">
        <h2 className="text-base font-semibold text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined !text-[20px] text-primary">swap_vert</span>
          Movimientos de Inventario
          <span className="text-xs text-on-surface-variant font-normal">(últimos {producto.movimientos.length})</span>
        </h2>
        {producto.movimientos.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-4 text-center">Sin movimientos registrados aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Stock Anterior</TableHead>
                  <TableHead className="text-right">Stock Nuevo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producto.movimientos.map(m => {
                  const col = COLORES_MOVIMIENTO[m.tipo] || { bg: 'bg-gray-500/10', text: 'text-gray-500', label: m.tipo };
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-on-surface-variant whitespace-nowrap">
                        {new Date(m.fechaHora).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${col.bg} ${col.text}`}>
                          {col.label}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${m.tipo.includes('positivo') || m.tipo.includes('entrada') || m.tipo === 'compra' || m.tipo === 'devolucion_venta' || m.tipo === 'apertura_inicial' ? 'text-success' : 'text-error'}`}>
                        {m.tipo.includes('positivo') || m.tipo.includes('entrada') || m.tipo === 'compra' || m.tipo === 'devolucion_venta' || m.tipo === 'apertura_inicial' ? '+' : '-'}{m.cantidad}
                      </TableCell>
                      <TableCell className="text-right text-on-surface-variant">{m.stockAnterior}</TableCell>
                      <TableCell className="text-right font-semibold">{m.stockNuevo}</TableCell>
                      <TableCell className="text-sm text-on-surface-variant max-w-[200px] truncate">{m.motivo}</TableCell>
                      <TableCell className="text-sm text-on-surface-variant font-mono">{m.referencia ? (m.referencia.includes('-') ? m.referencia.slice(0, 8) : m.referencia) : '—'}</TableCell>
                      <TableCell className="text-sm text-on-surface-variant">{m.usuario?.nombre || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
