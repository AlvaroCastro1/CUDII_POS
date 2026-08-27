import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

// ------------------------------------------------------------------
// Tipos de las respuestas de /reports/*
// ------------------------------------------------------------------
interface ResumenVentas {
  totalVentas: number;
  numTransacciones: number;
  ticketPromedio: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalOtros: number;
}
interface ReporteVentas {
  resumen: ResumenVentas;
  porDia: { fecha: string; total: number; transacciones: number }[];
}
interface TopProducto {
  productoId: string;
  nombre: string;
  codigoBarras: string;
  cantidadVendida: number;
  ingresos: number;
}
interface ItemInventario {
  productoId: string;
  nombre: string;
  codigoBarras: string;
  sucursal: string;
  stockActual: number;
  stockMinimo: number;
  valorInventario: number;
  alertaStockBajo: boolean;
}
interface CorteXInfo {
  id: string;
  fechaHora: string;
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  montoInicial: number;
  montoRetiros: number;
  efectivoEnCaja: number;
  usuario?: { nombre: string } | null;
  sesionCaja?: { caja?: { nombre: string; sucursal?: { nombre: string } } };
}
interface CorteZInfo {
  id: string;
  fechaHora: string;
  montoInicial: number;
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  totalRetiros: number;
  montoEsperado: number;
  montoDeclarado: number;
  diferencia: number;
  tipoDiscrepancia?: string | null;
  notas?: string | null;
  usuario?: { nombre: string } | null;
  sesionCaja?: { caja?: { nombre: string; sucursal?: { nombre: string } } };
}
interface FilaMargen {
  productoId?: string;
  nombre?: string;
  categoria?: string;
  cantidadVendida: number;
  ingresos: number;
  costo: number;
  margen: number;
  margenPct?: number;
}

type TabReporte = 'ventas' | 'top' | 'inventario' | 'caja' | 'margen';

const TABS: { id: TabReporte; etiqueta: string }[] = [
  { id: 'ventas', etiqueta: 'Resumen de Ventas' },
  { id: 'top', etiqueta: 'Top Productos' },
  { id: 'inventario', etiqueta: 'Inventarios' },
  { id: 'caja', etiqueta: 'Cortes de Caja' },
  { id: 'margen', etiqueta: 'Márgenes' },
];

const fmtMoneda = (valor: number): string =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export default function ReportesView() {
  const user = useAuthStore((state) => state.user);
  const puedeVerTopYMargelesYcaja = ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CONTADOR'].includes(
    user?.rol ?? '',
  );

  // Rango de fechas por defecto: último mes
  const hoyIso = new Date().toISOString().slice(0, 10);
  const hace30Iso = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState(hace30Iso);
  const [fechaFin, setFechaFin] = useState(hoyIso);

  const [tabActiva, setTabActiva] = useState<TabReporte>('ventas');
  const [loading, setLoading] = useState(false);

  // Datos por reporte
  const [ventas, setVentas] = useState<ReporteVentas | null>(null);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);
  const [inventario, setInventario] = useState<ItemInventario[]>([]);
  const [cortesX, setCortesX] = useState<CorteXInfo[]>([]);
  const [cortesZ, setCortesZ] = useState<CorteZInfo[]>([]);
  const [agruparMargen, setAgruparMargen] = useState<'producto' | 'categoria'>('producto');
  const [margenes, setMargenes] = useState<FilaMargen[]>([]);

  // ----------------------------------------------------------------
  // Carga del reporte activo
  // ----------------------------------------------------------------
  const cargarReporte = useCallback(async () => {
    const rango = { fechaInicio, fechaFin };
    try {
      setLoading(true);
      switch (tabActiva) {
        case 'ventas': {
          const res = await api.get('/reports/sales-summary', { params: rango });
          setVentas(res.data);
          break;
        }
        case 'top': {
          const res = await api.get('/reports/top-products', { params: { ...rango, limit: 25 } });
          setTopProductos(res.data ?? []);
          break;
        }
        case 'inventario': {
          const res = await api.get('/reports/inventory');
          setInventario(res.data.items ?? []);
          break;
        }
        case 'caja': {
          const res = await api.get('/reports/cash-register', { params: rango });
          setCortesX(res.data.cortesX ?? []);
          setCortesZ(res.data.cortesZ ?? []);
          break;
        }
        case 'margen': {
          const res = await api.get('/reports/margin', {
            params: { ...rango, agruparPor: agruparMargen },
          });
          setMargenes(res.data ?? []);
          break;
        }
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Error al generar el reporte'));
    } finally {
      setLoading(false);
    }
  }, [tabActiva, fechaInicio, fechaFin, agruparMargen]);

  // Recarga al cambiar de pestaña o rango
  useEffect(() => {
    cargarReporte();
  }, [cargarReporte]);

  // ----------------------------------------------------------------
  // Exportación CSV: descarga el mismo endpoint con format=csv
  // ----------------------------------------------------------------
  const exportarCsv = async () => {
    const rango = { fechaInicio, fechaFin };
    const urls: Record<TabReporte, string> = {
      ventas: '/reports/sales-summary',
      top: '/reports/top-products',
      inventario: '/reports/inventory',
      caja: '', // El backend aún no expone CSV para cortes
      margen: '/reports/margin',
    };
    const url = urls[tabActiva];
    if (!url) {
      toast.info('Este reporte no tiene exportación CSV disponible');
      return;
    }
    try {
      const params: Record<string, string> = { ...rango, format: 'csv' };
      if (tabActiva === 'margen') params.agruparPor = agruparMargen;
      if (tabActiva === 'top') params.limit = '25';

      const res = await api.get(url, { params, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data as Blob);
      const enlace = document.createElement('a');
      enlace.href = blobUrl;
      const nombres: Record<string, string> = {
        ventas: 'ventas_resumen',
        top: 'top_productos',
        inventario: 'inventario',
        margen: 'margenes',
      };
      enlace.download = `${nombres[tabActiva]}_${hoyIso}.csv`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success('Reporte CSV descargado');
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo descargar el CSV'));
    }
  };

  // Encabezados comunes de la sección
  const mostrarFiltros = tabActiva !== 'inventario';
  const hayCsv = tabActiva !== 'caja';

  return (
    <div className="p-6 space-y-6">
      {/* ===================== ENCABEZADO ===================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display-lg text-on-background flex items-center gap-2">
            <FileText className="w-7 h-7" />
            Reportes
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Análisis del negocio con exportación a Excel/CSV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mostrarFiltros && (
            <>
              <label className="text-xs text-outline">Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface border border-outline/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <label className="text-xs text-outline">Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface border border-outline/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </>
          )}
          <button
            type="button"
            onClick={cargarReporte}
            disabled={loading}
            className="p-2.5 rounded-xl border border-outline/20 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {hayCsv && (
            <button
              type="button"
              onClick={exportarCsv}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* ===================== PESTAÑAS ===================== */}
      <div className="flex flex-wrap gap-2">
        {TABS.filter((t) =>
          t.id === 'ventas' ? true : t.id === 'inventario' ? true : puedeVerTopYMargelesYcaja,
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTabActiva(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              tabActiva === t.id
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
            }`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {/* ===================== CONTENIDO ===================== */}
      <div className="bg-surface rounded-xl border border-on-surface/10 p-5 min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Generando reporte...
          </div>
        ) : (
          <>
            {/* ---------- VENTAS ---------- */}
            {tabActiva === 'ventas' && ventas && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { titulo: 'Total ventas', valor: fmtMoneda(ventas.resumen.totalVentas) },
                    { titulo: 'Transacciones', valor: String(ventas.resumen.numTransacciones) },
                    { titulo: 'Ticket promedio', valor: fmtMoneda(ventas.resumen.ticketPromedio) },
                    { titulo: 'Efectivo', valor: fmtMoneda(ventas.resumen.totalEfectivo) },
                    { titulo: 'Tarjeta', valor: fmtMoneda(ventas.resumen.totalTarjeta) },
                    { titulo: 'Otros métodos', valor: fmtMoneda(ventas.resumen.totalOtros) },
                  ].map((kpi) => (
                    <div key={kpi.titulo} className="rounded-xl bg-surface-container-low border border-outline/20 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-outline">{kpi.titulo}</p>
                      <p className="font-bold font-mono text-sm mt-1">{kpi.valor}</p>
                    </div>
                  ))}
                </div>

                {ventas.porDia.length === 0 ? (
                  <p className="text-center py-10 text-on-surface-variant">
                    Sin ventas en el rango seleccionado
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-outline/20 text-left text-[11px] uppercase tracking-wider text-outline">
                          <th className="py-2.5 px-2">Fecha</th>
                          <th className="py-2.5 px-2 text-right">Transacciones</th>
                          <th className="py-2.5 px-2 text-right">Total vendido</th>
                          <th className="py-2.5 px-2 text-right">Ticket promedio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventas.porDia.map((d) => (
                          <tr key={d.fecha} className="border-b border-outline/10">
                            <td className="py-2.5 px-2">{new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-MX')}</td>
                            <td className="py-2.5 px-2 text-right font-mono">{d.transacciones}</td>
                            <td className="py-2.5 px-2 text-right font-mono font-semibold">{fmtMoneda(d.total)}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-on-surface-variant">
                              {fmtMoneda(d.transacciones > 0 ? d.total / d.transacciones : 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ---------- TOP PRODUCTOS ---------- */}
            {tabActiva === 'top' && (
              <TablaGenerica
                vacio="Sin ventas de productos en el rango seleccionado"
                columnas={['#', 'Producto', 'Código', 'Cantidad Vendida', 'Ingresos']}
                filas={topProductos.map((p, i) => [
                  String(i + 1),
                  p.nombre,
                  <span key="cb" className="font-mono text-xs text-outline">{p.codigoBarras || '—'}</span>,
                  String(p.cantidadVendida),
                  <span key="ing" className="font-mono font-semibold">{fmtMoneda(p.ingresos)}</span>,
                ])}
                vacias={topProductos.length === 0}
              />
            )}

            {/* ---------- INVENTARIO ---------- */}
            {tabActiva === 'inventario' && (
              <TablaGenerica
                vacio="No hay inventario registrado"
                columnas={['Producto', 'Sucursal', 'Stock Actual', 'Mínimo', 'Valor Inventario', 'Alerta']}
                filas={inventario.map((it) => [
                  it.nombre,
                  it.sucursal,
                  <span key="st" className={`font-mono font-semibold ${it.alertaStockBajo ? 'text-error' : ''}`}>
                    {it.stockActual}
                  </span>,
                  String(it.stockMinimo),
                  fmtMoneda(it.valorInventario),
                  it.alertaStockBajo ? (
                    <span key="al" className="px-2 py-0.5 rounded-full bg-error/10 text-error text-[11px] font-bold">STOCK BAJO</span>
                  ) : (
                    <span key="ok" className="text-success text-xs">OK</span>
                  ),
                ])}
                vacias={inventario.length === 0}
              />
            )}

            {/* ---------- CORTES DE CAJA ---------- */}
            {tabActiva === 'caja' && (
              <div className="space-y-8">
                <section>
                  <h3 className="font-headline-md font-semibold mb-3">Cortes X (parciales)</h3>
                  {cortesX.length === 0 ? (
                    <p className="text-sm text-on-surface-variant py-4">Sin cortes X en el rango</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-outline/20 text-left text-[11px] uppercase tracking-wider text-outline">
                            <th className="py-2.5 px-2">Fecha</th>
                            <th className="py-2.5 px-2">Caja / Sucursal</th>
                            <th className="py-2.5 px-2">Registró</th>
                            <th className="py-2.5 px-2 text-right">Venta Efectivo</th>
                            <th className="py-2.5 px-2 text-right">Venta Tarjeta</th>
                            <th className="py-2.5 px-2 text-right">Retiros</th>
                            <th className="py-2.5 px-2 text-right">Efectivo en Caja</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cortesX.map((cx) => (
                            <tr key={cx.id} className="border-b border-outline/10">
                              <td className="py-2.5 px-2 whitespace-nowrap">{new Date(cx.fechaHora).toLocaleString('es-MX')}</td>
                              <td className="py-2.5 px-2">
                                {cx.sesionCaja?.caja?.nombre ?? '—'}
                                {cx.sesionCaja?.caja?.sucursal?.nombre && (
                                  <span className="text-outline text-xs block">{cx.sesionCaja.caja.sucursal.nombre}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-on-surface-variant">{cx.usuario?.nombre ?? '—'}</td>
                              <td className="py-2.5 px-2 text-right font-mono">{fmtMoneda(cx.totalVentasEfectivo)}</td>
                              <td className="py-2.5 px-2 text-right font-mono">{fmtMoneda(cx.totalVentasTarjeta)}</td>
                              <td className="py-2.5 px-2 text-right font-mono">{fmtMoneda(cx.montoRetiros)}</td>
                              <td className="py-2.5 px-2 text-right font-mono font-semibold">{fmtMoneda(cx.efectivoEnCaja)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="font-headline-md font-semibold mb-3">Cortes Z (cierre de caja)</h3>
                  {cortesZ.length === 0 ? (
                    <p className="text-sm text-on-surface-variant py-4">Sin cortes Z en el rango</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-outline/20 text-left text-[11px] uppercase tracking-wider text-outline">
                            <th className="py-2.5 px-2">Fecha</th>
                            <th className="py-2.5 px-2">Caja</th>
                            <th className="py-2.5 px-2 text-right">Esperado</th>
                            <th className="py-2.5 px-2 text-right">Declarado</th>
                            <th className="py-2.5 px-2 text-right">Diferencia</th>
                            <th className="py-2.5 px-2">Tipo</th>
                            <th className="py-2.5 px-2">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cortesZ.map((cz) => (
                            <tr key={cz.id} className="border-b border-outline/10">
                              <td className="py-2.5 px-2 whitespace-nowrap">{new Date(cz.fechaHora).toLocaleString('es-MX')}</td>
                              <td className="py-2.5 px-2">{cz.sesionCaja?.caja?.nombre ?? '—'}</td>
                              <td className="py-2.5 px-2 text-right font-mono">{fmtMoneda(cz.montoEsperado)}</td>
                              <td className="py-2.5 px-2 text-right font-mono">{fmtMoneda(cz.montoDeclarado)}</td>
                              <td className={`py-2.5 px-2 text-right font-mono font-semibold ${
                                cz.diferencia === 0 ? 'text-success' : cz.diferencia > 0 ? 'text-warning' : 'text-error'
                              }`}>
                                {cz.diferencia > 0 ? '+' : ''}
                                {cz.diferencia.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-2 capitalize">{cz.tipoDiscrepancia ?? '—'}</td>
                              <td className="py-2.5 px-2 text-on-surface-variant text-xs max-w-[180px] truncate" title={cz.notas ?? ''}>
                                {cz.notas ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ---------- MÁRGENES ---------- */}
            {tabActiva === 'margen' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-outline">Agrupar por:</label>
                  <select
                    value={agruparMargen}
                    onChange={(e) => setAgruparMargen(e.target.value as 'producto' | 'categoria')}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="producto">Producto</option>
                    <option value="categoria">Categoría</option>
                  </select>
                </div>
                <TablaGenerica
                  vacio="Sin ventas en el rango seleccionado"
                  columnas={['Concepto', 'Cantidad', 'Ingresos', 'Costo', 'Margen', 'Margen %']}
                  filas={margenes.map((f) => [
                    f.nombre ?? f.categoria ?? '—',
                    String(f.cantidadVendida),
                    fmtMoneda(f.ingresos),
                    fmtMoneda(f.costo),
                    <span key="mg" className={`font-mono font-semibold ${f.margen >= 0 ? 'text-success' : 'text-error'}`}>
                      {fmtMoneda(f.margen)}
                    </span>,
                    f.margenPct != null ? `${f.margenPct.toFixed(1)}%` : '—',
                  ])}
                  vacias={margenes.length === 0}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Tabla genérica simple para los reportes tabulados
// ------------------------------------------------------------------
function TablaGenerica({
  columnas,
  filas,
  vacias,
  vacio,
}: {
  columnas: string[];
  filas: React.ReactNode[][];
  vacias: boolean;
  vacio: string;
}) {
  if (vacias) {
    return <p className="text-center py-12 text-on-surface-variant">{vacio}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline/20 text-left text-[11px] uppercase tracking-wider text-outline">
            {columnas.map((col, i) => (
              <th key={i} className={`py-2.5 px-2 ${i > 1 ? 'text-right' : ''}`}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-outline/10 hover:bg-surface-container-low/60">
              {fila.map((celda, j) => (
                <td key={j} className={`py-2.5 px-2 ${j > 1 ? 'text-right' : ''}`}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
