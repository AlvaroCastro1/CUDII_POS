import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Sparkles,
  Check,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  X,
  CreditCard,
  ShoppingCart,
  Receipt,
  TrendingUp,
  CheckSquare,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

// ------------------------------------------------------------------
// Tipos de las respuestas de API
// ------------------------------------------------------------------
interface ResumenVentas {
  totalVentas: number;
  numTransacciones: number;
  ticketPromedio: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalOtros: number;
}

interface VentaPorDia {
  fecha: string;
  total: number;
  transacciones: number;
}

interface ResumenReporte {
  rango: { fechaInicio?: string; fechaFin?: string };
  resumen: ResumenVentas;
  porDia: VentaPorDia[];
}

interface TopProducto {
  productoId: string;
  nombre: string;
  codigoBarras: string;
  cantidadVendida: number;
  ingresos: number;
}

// Formateador de moneda MXN
const fmtMoneda = (valor: number): string =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// ==================================================================
// Registro y definición de widgets por rol
// ==================================================================
export type TamanoWidget = 'sm' | 'md' | 'full';

export interface TareaUsuario {
  id: string;
  texto: string;
  hecha: boolean;
}

export interface PrefsDashboard {
  orden: string[];
  ocultos: string[];
  tamanos: Record<string, TamanoWidget>;
  tareas: TareaUsuario[];
}

export interface DefinicionWidget {
  id: string;
  titulo: string;
  icono: React.ElementType;
  roles: string[];
  tamanoPorDefecto: TamanoWidget;
}

const TODOS_LOS_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'GERENTE',
  'CAJERO',
  'CONTADOR',
];

const WIDGETS: DefinicionWidget[] = [
  {
    id: 'kpis',
    titulo: 'Indicadores Principales',
    icono: TrendingUp,
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO'],
    tamanoPorDefecto: 'full',
  },
  {
    id: 'kpis_financieros',
    titulo: 'Resumen Financiero',
    icono: DollarSign,
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTADOR'],
    tamanoPorDefecto: 'full',
  },
  {
    id: 'acciones_cajero',
    titulo: 'Operaciones Rápidas',
    icono: ShoppingCart,
    roles: ['CAJERO', 'ADMIN', 'GERENTE'],
    tamanoPorDefecto: 'full',
  },
  {
    id: 'tendencia',
    titulo: 'Ventas por Día',
    icono: TrendingUp,
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CONTADOR'],
    tamanoPorDefecto: 'md',
  },
  {
    id: 'metodos',
    titulo: 'Desglose Métodos de Pago',
    icono: CreditCard,
    roles: TODOS_LOS_ROLES,
    tamanoPorDefecto: 'sm',
  },
  {
    id: 'top',
    titulo: 'Top 5 Productos Más Vendidos',
    icono: Receipt,
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CONTADOR'],
    tamanoPorDefecto: 'md',
  },
  {
    id: 'tareas',
    titulo: 'Mis Pendientes (Mini TODO)',
    icono: CheckSquare,
    roles: TODOS_LOS_ROLES,
    tamanoPorDefecto: 'sm',
  },
];

// Configuración de orden canónico recomendado según cada Rol
const ORDEN_POR_DEFECTO_POR_ROL: Record<string, string[]> = {
  SUPER_ADMIN: ['kpis', 'tendencia', 'metodos', 'top', 'tareas'],
  ADMIN: ['kpis', 'tendencia', 'metodos', 'top', 'acciones_cajero', 'tareas'],
  GERENTE: ['kpis', 'tendencia', 'top', 'metodos', 'tareas'],
  CAJERO: ['acciones_cajero', 'kpis', 'metodos', 'tareas'],
  CONTADOR: ['kpis_financieros', 'tendencia', 'metodos', 'top', 'tareas'],
};

const TAMANOS_DEFECTO: Record<string, TamanoWidget> = {
  kpis: 'full',
  kpis_financieros: 'full',
  acciones_cajero: 'full',
  tendencia: 'md',
  metodos: 'sm',
  top: 'md',
  tareas: 'sm',
};

const nuevoIdTarea = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function DashboardView() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const rol = user?.rol ?? 'CAJERO';

  // Widgets permitidos para el rol activo
  const widgetsDisponibles = useMemo(
    () => WIDGETS.filter((w) => w.roles.includes(rol)),
    [rol],
  );

  const [dias, setDias] = useState<7 | 30>(7);
  const [resumen, setResumen] = useState<ResumenReporte | null>(null);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado de personalización
  const [prefs, setPrefs] = useState<PrefsDashboard | null>(null);
  const [personalizando, setPersonalizando] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState('');
  const guardadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [estadoGuardado, setEstadoGuardado] = useState<'idle' | 'guardando' | 'guardado'>('idle');

  // Rango de fechas
  const construirRango = (nDias: number): { fechaInicio: string; fechaFin: string } => {
    const fin = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - (nDias - 1));
    const aIso = (d: Date) => d.toISOString().slice(0, 10);
    return { fechaInicio: aIso(inicio), fechaFin: aIso(fin) };
  };

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const rango = construirRango(dias);
      const res = await api.get('/reports/sales-summary', { params: rango });
      setResumen(res.data);

      if (widgetsDisponibles.some((w) => w.id === 'top')) {
        try {
          const resTop = await api.get('/reports/top-products', {
            params: { ...rango, limit: 5 },
          });
          setTopProductos(resTop.data ?? []);
        } catch {
          setTopProductos([]);
        }
      }
    } catch {
      setResumen(null);
    } finally {
      setLoading(false);
    }
  }, [dias, widgetsDisponibles]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  /** Generar preferencias por defecto específicas para el ROL */
  const prefsPorDefecto = useCallback((): PrefsDashboard => {
    const ordenRecomendado = ORDEN_POR_DEFECTO_POR_ROL[rol] ?? ORDEN_POR_DEFECTO_POR_ROL.SUPER_ADMIN;
    const idsValidos = new Set(widgetsDisponibles.map((w) => w.id));

    const orden = ordenRecomendado.filter((id) => idsValidos.has(id));
    for (const w of widgetsDisponibles) {
      if (!orden.includes(w.id)) {
        orden.push(w.id);
      }
    }

    return {
      orden,
      ocultos: [],
      tamanos: { ...TAMANOS_DEFECTO },
      tareas: [],
    };
  }, [rol, widgetsDisponibles]);

  /** Cargar preferencias desde el API */
  useEffect(() => {
    let vigente = true;
    api
      .get('/users/profile/dashboard')
      .then((res) => {
        if (!vigente) return;
        const guardadas = (res.data?.preferencias ?? null) as Partial<PrefsDashboard> | null;
        const defecto = prefsPorDefecto();
        const idsValidos = new Set(widgetsDisponibles.map((w) => w.id));

        const ocultasGuardadas = Array.isArray(guardadas?.ocultos)
          ? guardadas!.ocultos.filter((id) => idsValidos.has(id))
          : [];

        let orden = Array.isArray(guardadas?.orden)
          ? guardadas!.orden.filter((id) => idsValidos.has(id))
          : [];

        for (const w of widgetsDisponibles) {
          if (!orden.includes(w.id) && !ocultasGuardadas.includes(w.id)) {
            orden.push(w.id);
          }
        }

        if (orden.length === 0) {
          orden = defecto.orden;
        }

        const tamanosCombinados = { ...defecto.tamanos, ...(guardadas?.tamanos ?? {}) };

        setPrefs({
          orden,
          ocultos: ocultasGuardadas,
          tamanos: tamanosCombinados,
          tareas: Array.isArray(guardadas?.tareas)
            ? guardadas!.tareas.slice(0, 20).map((t) => ({
                id: String(t.id ?? nuevoIdTarea()),
                texto: String(t.texto ?? '').slice(0, 140),
                hecha: Boolean(t.hecha),
              }))
            : [],
        });
      })
      .catch(() => {
        if (vigente) setPrefs(prefsPorDefecto());
      });

    return () => {
      vigente = false;
    };
  }, [widgetsDisponibles, prefsPorDefecto]);

  /** Guardado automático con retardo */
  useEffect(() => {
    if (!prefs) return;
    if (guardadoTimer.current) clearTimeout(guardadoTimer.current);
    setEstadoGuardado('guardando');
    guardadoTimer.current = setTimeout(() => {
      api
        .patch('/users/profile/dashboard', { preferencias: prefs })
        .then(() => setEstadoGuardado('guardado'))
        .catch(() => setEstadoGuardado('idle'));
    }, 700);

    return () => {
      if (guardadoTimer.current) clearTimeout(guardadoTimer.current);
    };
  }, [prefs]);

  // ── Operaciones de Personalización ────────────────────────────────
  const tamanoDe = (id: string): TamanoWidget => prefs?.tamanos[id] ?? TAMANOS_DEFECTO[id] ?? 'sm';

  const moverWidget = (index: number, direccion: 'arriba' | 'abajo') => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const nuevoOrden = [...prev.orden];
      const targetIndex = direccion === 'arriba' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= nuevoOrden.length) return prev;
      const temp = nuevoOrden[index];
      nuevoOrden[index] = nuevoOrden[targetIndex];
      nuevoOrden[targetIndex] = temp;
      return { ...prev, orden: nuevoOrden };
    });
  };

  const cambiarTamanoWidget = (id: string, nuevo: TamanoWidget) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tamanos: { ...prev.tamanos, [id]: nuevo },
      };
    });
  };

  const ocultarWidget = (id: string) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      return { ...prev, ocultos: [...prev.ocultos, id] };
    });
  };

  const mostrarWidget = (id: string) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const orden = prev.orden.includes(id) ? prev.orden : [...prev.orden, id];
      return {
        ...prev,
        orden,
        ocultos: prev.ocultos.filter((o) => o !== id),
      };
    });
  };

  const restaurarPorRol = () => {
    const defecto = prefsPorDefecto();
    setPrefs(defecto);
    setEstadoGuardado('guardando');
    api
      .patch('/users/profile/dashboard', { preferencias: defecto })
      .then(() => setEstadoGuardado('guardado'))
      .catch(() => setEstadoGuardado('idle'));
  };

  // ── Operaciones de Tareas (Mini TODO) ──────────────────────────────
  const agregarTarea = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = nuevaTarea.trim();
    if (!texto || !prefs) return;
    setPrefs((prev) =>
      prev
        ? {
            ...prev,
            tareas: [
              ...prev.tareas,
              { id: nuevoIdTarea(), texto: texto.slice(0, 140), hecha: false },
            ].slice(-20),
          }
        : prev,
    );
    setNuevaTarea('');
  };

  const alternarTarea = (id: string) => {
    setPrefs((prev) =>
      prev
        ? {
            ...prev,
            tareas: prev.tareas.map((t) =>
              t.id === id ? { ...t, hecha: !t.hecha } : t,
            ),
          }
        : prev,
    );
  };

  const eliminarTarea = (id: string) => {
    setPrefs((prev) =>
      prev ? { ...prev, tareas: prev.tareas.filter((t) => t.id !== id) } : prev,
    );
  };

  // Prepara datos de gráficas
  const datosGrafica = (resumen?.porDia ?? []).map((d) => ({
    ...d,
    etiqueta: d.fecha.slice(8, 10) + '/' + d.fecha.slice(5, 7),
  }));

  const metodosPago = resumen
    ? [
        { nombre: 'Efectivo', total: resumen.resumen.totalEfectivo, color: 'var(--success)' },
        { nombre: 'Tarjeta', total: resumen.resumen.totalTarjeta, color: 'var(--primary)' },
        { nombre: 'Otros', total: resumen.resumen.totalOtros, color: 'var(--warning)' },
      ].filter((m) => m.total > 0)
    : [];

  const widgetsVisibles = prefs
    ? prefs.orden.filter((id) => !prefs.ocultos.includes(id))
    : [];
  const pendientesCount = prefs?.tareas.filter((t) => !t.hecha).length ?? 0;

  // ── Renderizado del Contenido Interno de cada Widget ────────────────
  const renderContenidoWidget = (id: string) => {
    if (!resumen) return null;
    switch (id) {
      case 'kpis':
        const pctEfectivo = resumen.resumen.totalVentas > 0
          ? Math.round((resumen.resumen.totalEfectivo / resumen.resumen.totalVentas) * 100)
          : 0;
        const pctTarjeta = resumen.resumen.totalVentas > 0
          ? Math.round((resumen.resumen.totalTarjeta / resumen.resumen.totalVentas) * 100)
          : 0;
        const pctOtros = Math.max(0, 100 - pctEfectivo - pctTarjeta);
        const promedioDiario = dias > 0 ? resumen.resumen.totalVentas / dias : 0;
        const txsPorDia = dias > 0 ? (resumen.resumen.numTransacciones / dias).toFixed(1) : '0';

        return (
          <div className="flex flex-col justify-between space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-primary text-on-primary p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-label-sm uppercase tracking-widest opacity-80 font-bold">
                    Ventas Totales
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-display-lg mt-1 font-mono">
                    {fmtMoneda(resumen.resumen.totalVentas)}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-on-primary/15 flex items-center justify-between text-[11px] opacity-90 font-medium">
                  <span>Promedio/día:</span>
                  <span className="font-bold font-mono">{fmtMoneda(promedioDiario)}</span>
                </div>
              </div>

              <div className="rounded-xl bg-surface-container-low border border-outline/20 p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-label-sm uppercase tracking-widest text-on-surface-variant font-bold">
                    Transacciones
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-display-lg mt-1 text-on-surface font-mono">
                    {resumen.resumen.numTransacciones.toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-outline/10 flex items-center justify-between text-[11px] text-on-surface-variant font-medium">
                  <span>Frecuencia:</span>
                  <span className="font-bold text-on-surface">{txsPorDia} / día</span>
                </div>
              </div>

              <div className="rounded-xl bg-surface-container-low border border-outline/20 p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-label-sm uppercase tracking-widest text-on-surface-variant font-bold">
                    Ticket Promedio
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-display-lg mt-1 text-on-surface font-mono">
                    {fmtMoneda(resumen.resumen.ticketPromedio)}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-outline/10 flex items-center justify-between text-[11px] text-on-surface-variant font-medium">
                  <span>Estado:</span>
                  <span className="font-bold text-success">● Saludable</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-low p-3.5 border border-outline/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                <span>Cobros por Método de Pago en Vivo:</span>
                <span className="text-[11px] text-on-surface-variant font-normal">
                  Efectivo ({pctEfectivo}%) · Tarjeta ({pctTarjeta}%)
                </span>
              </div>

              <div className="h-3 w-full rounded-full bg-surface-container-high overflow-hidden flex">
                <div
                  style={{ width: `${pctEfectivo}%` }}
                  className="bg-success h-full transition-all duration-500"
                  title={`Efectivo: ${fmtMoneda(resumen.resumen.totalEfectivo)}`}
                />
                <div
                  style={{ width: `${pctTarjeta}%` }}
                  className="bg-primary h-full transition-all duration-500"
                  title={`Tarjeta: ${fmtMoneda(resumen.resumen.totalTarjeta)}`}
                />
                <div
                  style={{ width: `${pctOtros}%` }}
                  className="bg-warning h-full transition-all duration-500"
                  title={`Otros: ${fmtMoneda(resumen.resumen.totalOtros)}`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 text-on-surface-variant">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-success inline-block" />
                    Efectivo: <b className="text-on-surface">{fmtMoneda(resumen.resumen.totalEfectivo)}</b>
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                    Tarjeta: <b className="text-on-surface">{fmtMoneda(resumen.resumen.totalTarjeta)}</b>
                  </span>
                </div>
                {resumen.resumen.totalOtros > 0 && (
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-warning inline-block" />
                    Otros: <b className="text-on-surface">{fmtMoneda(resumen.resumen.totalOtros)}</b>
                  </span>
                )}
              </div>
            </div>
          </div>
        );

      case 'kpis_financieros':
        const ivaEstimado = resumen.resumen.totalVentas * 0.16;
        const ventasNetas = resumen.resumen.totalVentas - ivaEstimado;
        const pctIva = resumen.resumen.totalVentas > 0
          ? Math.round((ivaEstimado / resumen.resumen.totalVentas) * 100)
          : 0;

        return (
          <div className="flex flex-col justify-between space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface-container-low border border-outline/20 p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-label-sm uppercase tracking-widest text-on-surface-variant font-bold">
                    Ventas Netas (sin IVA)
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-display-lg mt-1 text-on-surface font-mono">
                    {fmtMoneda(ventasNetas)}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-outline/10 text-[11px] text-on-surface-variant">
                  <span>Base Gravable Estimada</span>
                </div>
              </div>

              <div className="rounded-xl bg-surface-container-low border border-outline/20 p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-label-sm uppercase tracking-widest text-on-surface-variant font-bold">
                    IVA Estimado (16%)
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-display-lg mt-1 text-warning font-mono">
                    {fmtMoneda(ivaEstimado)}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-outline/10 text-[11px] text-on-surface-variant">
                  <span>Impuesto por Declarar</span>
                </div>
              </div>

              <div className="rounded-xl bg-primary text-on-primary p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-label-sm uppercase tracking-widest opacity-80 font-bold">
                    Ingreso Bruto Total
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-display-lg mt-1 font-mono">
                    {fmtMoneda(resumen.resumen.totalVentas)}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-on-primary/15 text-[11px] opacity-90 font-medium">
                  <span>100% Facturación Cobrada</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-low p-3.5 border border-outline/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                <span>Composición del Ingreso Bruto:</span>
                <span className="text-[11px] text-on-surface-variant font-normal">
                  Neto (84%) · IVA ({pctIva}%)
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-surface-container-high overflow-hidden flex">
                <div style={{ width: '84%' }} className="bg-primary h-full" title="Ventas Netas" />
                <div style={{ width: '16%' }} className="bg-warning h-full" title="IVA 16%" />
              </div>
              <p className="text-[11px] text-outline pt-0.5">
                * Estimación calculada aplicando la tasa general del 16% de IVA sobre las ventas registradas.
              </p>
            </div>
          </div>
        );

      case 'acciones_cajero':
        return (
          <div className="flex flex-col justify-between space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => navigate('/pos')}
                className="p-4 rounded-xl bg-primary text-on-primary hover:bg-primary/90 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
              >
                <ShoppingCart className="w-5 h-5" /> Ir a Terminal POS
              </button>
              <button
                type="button"
                onClick={() => navigate('/pos')}
                className="p-4 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-outline/20 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Receipt className="w-5 h-5 text-primary" /> Realizar Arqueo / Corte
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/devoluciones')}
                className="p-4 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-outline/20 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <RotateCcw className="w-5 h-5 text-warning" /> Devoluciones
              </button>
            </div>
          </div>
        );

      case 'tendencia':
        return (
          <div className="flex flex-col justify-between space-y-3">
            {datosGrafica.length === 0 ? (
              <p className="text-center py-12 text-on-surface-variant">
                No hay ventas registradas en este periodo
              </p>
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={datosGrafica} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                    <XAxis
                      dataKey="etiqueta"
                      tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--outline-variant)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={65}
                      tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(valor) => [fmtMoneda(Number(valor)), 'Total']}
                      labelFormatter={(etiqueta) => `Día ${etiqueta}`}
                      contentStyle={{
                        backgroundColor: 'var(--surface-container-lowest)',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: 12,
                        color: 'var(--on-surface)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#gradVentas)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );

      case 'metodos':
        return (
          <div className="flex flex-col justify-between space-y-3">
            {metodosPago.length === 0 ? (
              <p className="text-center py-12 text-on-surface-variant">Sin pagos registrados</p>
            ) : (
              <>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metodosPago} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                      <XAxis
                        dataKey="nombre"
                        tick={{ fill: 'var(--on-surface-variant)', fontSize: 12 }}
                        axisLine={{ stroke: 'var(--outline-variant)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={65}
                        tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                      />
                      <Tooltip
                        formatter={(valor) => [fmtMoneda(Number(valor)), 'Total']}
                        cursor={{ fill: 'var(--surface-container-high)' }}
                        contentStyle={{
                          backgroundColor: 'var(--surface-container-lowest)',
                          border: '1px solid var(--outline-variant)',
                          borderRadius: 12,
                          color: 'var(--on-surface)',
                        }}
                      />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 pt-2 border-t border-outline/10">
                  {metodosPago.map((m) => (
                    <div key={m.nombre} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                      {m.nombre}: <span className="font-semibold text-on-surface">{fmtMoneda(m.total)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );

      case 'top':
        return (
          <div className="flex flex-col space-y-3">
            {topProductos.length === 0 ? (
              <p className="text-center py-12 text-on-surface-variant">
                Aún no hay ventas de productos
              </p>
            ) : (
              <ul className="space-y-2.5 flex-1 overflow-y-auto max-h-56 custom-scrollbar pr-1">
                {topProductos.map((prod, idx) => (
                  <li
                    key={prod.productoId}
                    className="flex items-center gap-3 rounded-xl bg-surface-container-low px-3.5 py-2.5 border border-outline/10 hover:border-outline/30 transition-all"
                  >
                    <span className="w-6 h-6 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate text-on-surface">{prod.nombre}</p>
                      <p className="text-[11px] text-outline font-mono">{prod.codigoBarras}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-on-surface">{fmtMoneda(prod.ingresos)}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {prod.cantidadVendida} vendido{prod.cantidadVendida !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      case 'tareas':
        return (
          <div className="flex flex-col justify-between flex-1 min-w-0 space-y-3">
            <ul className="space-y-2 flex-1 overflow-y-auto max-h-48 custom-scrollbar pr-1">
              {(prefs?.tareas ?? []).length === 0 && (
                <li className="text-sm text-on-surface-variant py-6 text-center">
                  ✨ No tienes tareas pendientes. ¡Añade una abajo!
                </li>
              )}
              {(prefs?.tareas ?? []).map((t) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-2.5 rounded-xl px-3 py-2 bg-surface-container-low hover:bg-surface-container transition-colors border border-outline/10"
                >
                  <button
                    type="button"
                    onClick={() => alternarTarea(t.id)}
                    aria-label={t.hecha ? 'Marcar pendiente' : 'Marcar hecha'}
                    className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-all ${
                      t.hecha
                        ? 'bg-success border-success text-on-primary'
                        : 'border-outline/40 hover:border-primary bg-surface'
                    }`}
                  >
                    {t.hecha && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                  <span
                    className={`flex-1 text-sm truncate ${
                      t.hecha ? 'line-through text-outline' : 'text-on-surface font-medium'
                    }`}
                  >
                    {t.texto}
                  </span>
                  <button
                    type="button"
                    onClick={() => eliminarTarea(t.id)}
                    aria-label="Eliminar pendiente"
                    className="opacity-0 group-hover:opacity-100 text-outline hover:text-error transition-all p-1 rounded hover:bg-error/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={agregarTarea} className="flex gap-2 pt-2 border-t border-outline/10 shrink-0">
              <input
                type="text"
                value={nuevaTarea}
                onChange={(e) => setNuevaTarea(e.target.value)}
                placeholder="Nuevo pendiente..."
                maxLength={140}
                className="flex-1 min-w-0 px-3.5 py-2 bg-surface-container-low border border-outline/20 rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!nuevaTarea.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all flex items-center gap-1 shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" /> Añadir
              </button>
            </form>
          </div>
        );

      default:
        return null;
    }
  };

  // Obtener Badge del Encabezado Normal según el Widget
  const obtenerBadgeHeader = (id: string) => {
    switch (id) {
      case 'kpis':
        return (
          <span className="text-xs text-on-surface-variant font-medium">
            Últimos {dias} días
          </span>
        );
      case 'kpis_financieros':
        return (
          <span className="text-xs text-on-surface-variant font-medium">
            Estimación Fiscal
          </span>
        );
      case 'acciones_cajero':
        return (
          <span className="px-3 py-0.5 rounded-full bg-success/15 text-success text-xs font-bold flex items-center gap-1">
            ● Turno Activo
          </span>
        );
      case 'tendencia':
        return (
          <span className="text-xs text-on-surface-variant font-medium">
            Últimos {dias} días
          </span>
        );
      case 'tareas':
        return pendientesCount > 0 ? (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30">
            {pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-success/20 text-success border border-success/30">
            ✓ Todo al día
          </span>
        );
      default:
        return null;
    }
  };

  // Clasificación de widgets para el Layout de 2 Columnas Apiladas (Masonry Continuo sin huecos)
  const widgetsFullTop = useMemo(
    () => widgetsVisibles.filter((id) => tamanoDe(id) === 'full'),
    [widgetsVisibles, prefs],
  );

  const widgetsColumnaIzquierda = useMemo(
    () => widgetsVisibles.filter((id) => tamanoDe(id) === 'md'),
    [widgetsVisibles, prefs],
  );

  const widgetsColumnaDerecha = useMemo(
    () => widgetsVisibles.filter((id) => tamanoDe(id) === 'sm'),
    [widgetsVisibles, prefs],
  );

  return (
    <div className="dashboard-view-container p-4 sm:p-6 space-y-6">
      {/* ===================== ENCABEZADO ===================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold font-display-lg text-on-background">
              Dashboard
            </h1>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              Rol: {rol}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Panorama operativo adaptado a tus permisos y necesidades
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {([7, 30] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDias(n)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                dias === n
                  ? 'bg-primary text-on-primary border-primary shadow-sm'
                  : 'bg-surface text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
              }`}
            >
              Últimos {n} días
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPersonalizando((p) => !p)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
              personalizando
                ? 'bg-warning text-on-warning border-warning shadow-md'
                : 'bg-surface text-on-surface-variant border-outline/20 hover:bg-surface-container-high'
            }`}
          >
            {personalizando ? (
              <>
                <Check className="w-4 h-4" /> Guardar Vista
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-warning" /> Personalizar
              </>
            )}
          </button>
        </div>
      </div>

      {/* ===================== BARRA DE PERSONALIZACIÓN ===================== */}
      {personalizando && prefs && (
        <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 sm:p-5 space-y-4 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm font-medium text-on-surface">
                Usa ⬆ ⬇ para mover · cambia el ancho (`1/3` Chica, `2/3` Mediana, `Full` Ancho Completo) · oculta con ✕.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {estadoGuardado === 'guardando' && (
                <span className="text-xs text-on-surface-variant animate-pulse font-medium">
                  Guardando preferencias…
                </span>
              )}
              {estadoGuardado === 'guardado' && (
                <span className="text-xs text-success font-bold flex items-center gap-1">
                  ✓ Preferencias Guardadas
                </span>
              )}

              <button
                type="button"
                onClick={restaurarPorRol}
                className="px-3.5 py-1.5 rounded-xl bg-surface border border-outline/30 text-xs font-bold text-on-surface hover:border-error hover:text-error transition-all flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restablecer por mi Rol ({rol})
              </button>
            </div>
          </div>

          {/* Lista de widgets ocultos */}
          {prefs.ocultos.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-outline/10">
              <span className="text-xs text-on-surface-variant font-bold">Widgets Ocultos:</span>
              {prefs.ocultos.map((id) => {
                const def = widgetsDisponibles.find((w) => w.id === id);
                if (!def) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => mostrarWidget(id)}
                    className="px-3 py-1 rounded-full bg-surface border border-outline/30 text-xs font-semibold text-on-surface hover:border-primary hover:text-primary transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" /> {def.titulo}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== ESTADOS DE CARGA Y ERROR ===================== */}
      {loading && !resumen ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
      ) : !resumen ? (
        <div className="rounded-2xl border border-error/30 bg-error/5 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-error mx-auto mb-2" />
          <p className="font-bold text-lg text-on-surface">No se pudo cargar el resumen de ventas</p>
          <p className="text-sm text-on-surface-variant mt-1">
            Verifica tu conexión con el servidor POS e intenta nuevamente.
          </p>
        </div>
      ) : widgetsVisibles.length === 0 ? (
        <div className="rounded-2xl border border-outline/20 bg-surface p-12 text-center space-y-4 shadow-sm">
          <Sparkles className="w-10 h-10 text-on-surface-variant mx-auto" />
          <p className="font-bold text-xl text-on-surface">Todos los widgets están ocultos</p>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto">
            Puedes activar widgets individuales desde el panel de personalización o restablecer el diseño recomendado para tu rol.
          </p>
          <button
            type="button"
            onClick={restaurarPorRol}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-md hover:bg-primary/90 transition-all inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Restablecer Dashboard para {rol}
          </button>
        </div>
      ) : (
        /* ===================== CONTENEDOR CONTINUO MASONRY (0 HUECOS VERTICALES) ===================== */
        <div className="space-y-6">
          {/* 1. Widgets de Ancho Completo (Full Width) en la parte superior */}
          {widgetsFullTop.map((id) => {
            const index = widgetsVisibles.indexOf(id);
            const def = widgetsDisponibles.find((w) => w.id === id);
            const tamano = tamanoDe(id);
            return (
              <WidgetCardItem
                key={id}
                id={id}
                index={index}
                def={def}
                tamano={tamano}
                personalizando={personalizando}
                esPrimero={index === 0}
                esUltimo={index === widgetsVisibles.length - 1}
                moverWidget={moverWidget}
                cambiarTamanoWidget={cambiarTamanoWidget}
                ocultarWidget={ocultarWidget}
                badgeHeader={obtenerBadgeHeader(id)}
              >
                {renderContenidoWidget(id)}
              </WidgetCardItem>
            );
          })}

          {/* 2. Rejilla de 2 Columnas Continuas (Left 2/3 + Right 1/3) sin huecos de filas */}
          {(widgetsColumnaIzquierda.length > 0 || widgetsColumnaDerecha.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Columna Izquierda (Medianas / 2/3 ancho - 8 columnas) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                {widgetsColumnaIzquierda.map((id) => {
                  const index = widgetsVisibles.indexOf(id);
                  const def = widgetsDisponibles.find((w) => w.id === id);
                  const tamano = tamanoDe(id);
                  return (
                    <WidgetCardItem
                      key={id}
                      id={id}
                      index={index}
                      def={def}
                      tamano={tamano}
                      personalizando={personalizando}
                      esPrimero={index === 0}
                      esUltimo={index === widgetsVisibles.length - 1}
                      moverWidget={moverWidget}
                      cambiarTamanoWidget={cambiarTamanoWidget}
                      ocultarWidget={ocultarWidget}
                      badgeHeader={obtenerBadgeHeader(id)}
                    >
                      {renderContenidoWidget(id)}
                    </WidgetCardItem>
                  );
                })}
              </div>

              {/* Columna Derecha (Chicas / 1/3 ancho - 4 columnas) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                {widgetsColumnaDerecha.map((id) => {
                  const index = widgetsVisibles.indexOf(id);
                  const def = widgetsDisponibles.find((w) => w.id === id);
                  const tamano = tamanoDe(id);
                  return (
                    <WidgetCardItem
                      key={id}
                      id={id}
                      index={index}
                      def={def}
                      tamano={tamano}
                      personalizando={personalizando}
                      esPrimero={index === 0}
                      esUltimo={index === widgetsVisibles.length - 1}
                      moverWidget={moverWidget}
                      cambiarTamanoWidget={cambiarTamanoWidget}
                      ocultarWidget={ocultarWidget}
                      badgeHeader={obtenerBadgeHeader(id)}
                    >
                      {renderContenidoWidget(id)}
                    </WidgetCardItem>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Subcomponente Unificado de Tarjeta (WidgetCardItem)
// ------------------------------------------------------------------
function WidgetCardItem({
  id,
  index,
  def,
  tamano,
  personalizando,
  esPrimero,
  esUltimo,
  moverWidget,
  cambiarTamanoWidget,
  ocultarWidget,
  badgeHeader,
  children,
}: {
  id: string;
  index: number;
  def?: DefinicionWidget;
  tamano: TamanoWidget;
  personalizando: boolean;
  esPrimero: boolean;
  esUltimo: boolean;
  moverWidget: (idx: number, dir: 'arriba' | 'abajo') => void;
  cambiarTamanoWidget: (id: string, nuevo: TamanoWidget) => void;
  ocultarWidget: (id: string) => void;
  badgeHeader?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full widget-card-transition">
      <div
        className={`rounded-2xl bg-surface border border-outline/20 overflow-hidden shadow-sm flex flex-col transition-all ${
          personalizando ? 'ring-2 ring-primary/40 shadow-md' : ''
        }`}
      >
        {/* Encabezado Único e Integrado de la Tarjeta */}
        <div className="flex items-center justify-between gap-2 bg-surface-container-low px-4 py-3 border-b border-outline/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {def?.icono && <def.icono className="w-4 h-4 text-primary shrink-0" />}
            <h3 className="font-semibold text-sm sm:text-base text-on-surface truncate">
              {def?.titulo ?? id}
            </h3>
          </div>

          {personalizando ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={esPrimero}
                onClick={() => moverWidget(index, 'arriba')}
                title="Mover arriba"
                className="p-1 rounded hover:bg-surface text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={esUltimo}
                onClick={() => moverWidget(index, 'abajo')}
                title="Mover abajo"
                className="p-1 rounded hover:bg-surface text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-outline/20 mx-1" />

              {(['sm', 'md', 'full'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => cambiarTamanoWidget(id, t)}
                  title={t === 'sm' ? 'Chica (1/3)' : t === 'md' ? 'Mediana (2/3)' : 'Ancho Completo (3/3)'}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    tamano === t
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface hover:bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {t === 'sm' ? '1/3' : t === 'md' ? '2/3' : 'Full'}
                </button>
              ))}

              <div className="h-4 w-px bg-outline/20 mx-1" />

              <button
                type="button"
                onClick={() => ocultarWidget(id)}
                title="Ocultar widget"
                className="p-1 rounded text-error hover:bg-error/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            badgeHeader && <div className="shrink-0">{badgeHeader}</div>
          )}
        </div>

        {/* Cuerpo de la Tarjeta */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
