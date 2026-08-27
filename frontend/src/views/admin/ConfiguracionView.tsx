import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Save,
  Settings2,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  Store,
  Gift,
  Plus,
  Trash2,
  Coins,
  Sparkles,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/useAuthStore';
import { useBlocker } from 'react-router-dom';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ConfiguracionEmpresa {
  id: string;
  nombre: string;
  modoCorteZ: 'ciego' | 'abierto';
  umbralFaltanteCritico: number;
  stockMinimoGlobal: number;
  stockMaximoGlobal: number;
  programaLealtad?: ProgramaLealtadUI | null;
}

// ─── Tipos del Programa de Lealtad (D10) ─────────────────────────────────────

interface NivelLealtadUI {
  id?: string;
  nombre: string;
  umbralPuntos: number;
  descuentoPct: number;
  colorHex: string | null;
}

interface ProgramaLealtadUI {
  habilitado: boolean;
  puntosPorMonto: number;
  montoMinimoParaPuntos: number;
  basePuntos: 'CON_DESCUENTO' | 'SIN_DESCUENTO';
  permitirCanje: boolean;
  puntosPorPesos: number;
  canjeMinimoPuntos: number;
  /** D11: meses de vigencia de los puntos ganados (0 = nunca vencen). */
  mesesExpiracionPuntos?: number;
  niveles: NivelLealtadUI[];
}

const PROGRAMA_LEALTAD_DEFAULT: ProgramaLealtadUI = {
  habilitado: true,
  puntosPorMonto: 50, // equivalencia interna de 2% de devolución (1 punto = $1)
  montoMinimoParaPuntos: 0,
  basePuntos: 'CON_DESCUENTO',
  permitirCanje: false,
  puntosPorPesos: 1, // fijo: 1 punto = $1 de descuento
  canjeMinimoPuntos: 10,
  mesesExpiracionPuntos: 0,
  niveles: [],
};

// ─── Modelo simplificado: 1 punto = $1 fijo, el usuario configura un % ──────

/** Ticket de ejemplo para los cálculos ilustrativos en pantalla. */
const TICKET_EJEMPLO = 500;

/** Convierte la representación interna (pesos por punto) a % de devolución. */
function pesosPorPuntoAPercent(pesosPorPunto: number): number {
  if (!pesosPorPunto || pesosPorPunto <= 0) return 2;
  const pct = Math.round((100 / pesosPorPunto) * 2) / 2; // redondeo a 0.5
  return Math.min(10, Math.max(0.5, pct));
}

/** Convierte un % de devolución a la representación interna (pesos por punto). */
function percentAPesosPorPunto(pct: number): number {
  return 100 / pct;
}

type SemaforoCanje = 'verde' | 'amarillo' | 'rojo';

/** Evalúa qué tan saludable es la configuración de canje para el negocio. */
function evaluarSemaforoCanje(lealtad: ProgramaLealtadUI): {
  estado: SemaforoCanje;
  mensaje: string;
} {
  const gastoNecesario = lealtad.canjeMinimoPuntos * lealtad.puntosPorMonto;
  const tickets = gastoNecesario / TICKET_EJEMPLO;

  if (lealtad.canjeMinimoPuntos < 5) {
    return {
      estado: 'rojo',
      mensaje: `Con un mínimo de ${lealtad.canjeMinimoPuntos} punto(s), casi cualquier compra genera saldo canjeable de inmediato. El negocio descontará dinero constantemente.`,
    };
  }
  if (tickets <= 5) {
    return {
      estado: 'verde',
      mensaje: `El cliente junta los ${lealtad.canjeMinimoPuntos} puntos del mínimo ($${lealtad.canjeMinimoPuntos} de descuento) con unas ${Math.max(1, Math.ceil(tickets * 10) / 10)} compras de $${TICKET_EJEMPLO}. Beneficio alcanzable y margen protegido.`,
    };
  }
  if (tickets <= 20) {
    return {
      estado: 'amarillo',
      mensaje: `Juntar el mínimo requiere unas ${Math.ceil(tickets)} compras de $${TICKET_EJEMPLO} (gasto acumulado de $${gastoNecesario.toLocaleString()}). El cliente tardará en percibir el beneficio.`,
    };
  }
  return {
    estado: 'rojo',
    mensaje: `Juntar el mínimo exige un gasto acumulado de $${gastoNecesario.toLocaleString()} (${Math.ceil(tickets)} compras de $${TICKET_EJEMPLO}). El canje es prácticamente inalcanzable.`,
  };
}

/** Recolecta advertencias (nunca bloquean el guardado) del programa de lealtad. */
function recolectarAdvertenciasLealtad(lealtad: ProgramaLealtadUI): string[] {
  const advertencias: string[] = [];
  const pct = pesosPorPuntoAPercent(lealtad.puntosPorMonto);

  if (pct > 5) {
    advertencias.push(
      `Devolución del ${pct}%: es generosa, verifica que tu margen la sostenga (lo habitual en retail es 1–3%).`,
    );
  }
  if (lealtad.montoMinimoParaPuntos === 0) {
    advertencias.push(
      'Sin compra mínima: todas las ventas, por pequeñas que sean, generan puntos.',
    );
  }
  if (lealtad.permitirCanje) {
    const semaforo = evaluarSemaforoCanje(lealtad);
    if (semaforo.estado !== 'verde') {
      advertencias.push(`Canje: ${semaforo.mensaje}`);
    }
  }
  return advertencias;
}


type ModoCorteZ = 'ciego' | 'abierto';

// Catálogo de modos de Corte Z disponibles (tipos posibles)
const TIPOS_CORTE_Z: {
  valor: ModoCorteZ;
  etiqueta: string;
  descripcion: string;
  icono: 'EyeOff' | 'Eye';
}[] = [
  {
    valor: 'ciego',
    etiqueta: 'Corte Ciego',
    descripcion:
      'El cajero ingresa el efectivo contado sin ver el monto esperado por el sistema. El sistema calcula la diferencia internamente.',
    icono: 'EyeOff',
  },
  {
    valor: 'abierto',
    etiqueta: 'Corte Abierto',
    descripcion:
      'El sistema muestra el saldo esperado en pantalla para que el cajero cuadre la caja en tiempo real.',
    icono: 'Eye',
  },
];

// ─── AyudaTooltip ────────────────────────────────────────────────────────────
// Trigger de ayuda con icono "info", consistente con las demás pantallas.

function AyudaTooltip({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="cursor-help inline-flex items-center gap-1 text-[11px] font-medium text-on-surface-variant/80 border-b border-dashed border-on-surface-variant/40">
            <span className="material-symbols-outlined !text-[14px]">info</span>
            {etiqueta}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] p-3 space-y-2">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Vista Principal de Configuración ─────────────────────────────────────────

export default function ConfiguracionView() {
  const { user } = useAuthStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionEmpresa | null>(null);
  const [modoCorteZ, setModoCorteZ] = useState<ModoCorteZ>('ciego');
  const [umbralFaltanteCritico, setUmbralFaltanteCritico] = useState<number>(50);
  const [stockMinimoGlobal, setStockMinimoGlobal] = useState<number>(5);
  const [stockMaximoGlobal, setStockMaximoGlobal] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGuardandoYSalir, setIsGuardandoYSalir] = useState(false);

  // D10: Estado del Programa de Lealtad (configurable) y su instantánea para detectar cambios
  const [lealtad, setLealtad] = useState<ProgramaLealtadUI>(PROGRAMA_LEALTAD_DEFAULT);
  const [lealtadOriginal, setLealtadOriginal] = useState<ProgramaLealtadUI>(
    PROGRAMA_LEALTAD_DEFAULT,
  );

  // Cargar la configuración actual de la empresa
  useEffect(() => {
    const cargarConfiguracion = async () => {
      setIsLoading(true);
      try {
        const res = await api.get<ConfiguracionEmpresa>('/company-settings');
        setConfiguracion(res.data);
        setModoCorteZ(res.data.modoCorteZ);
        setUmbralFaltanteCritico(res.data.umbralFaltanteCritico ?? 50);
        setStockMinimoGlobal(res.data.stockMinimoGlobal ?? 5);
        setStockMaximoGlobal(res.data.stockMaximoGlobal ?? 100);
        const programa = res.data.programaLealtad ?? PROGRAMA_LEALTAD_DEFAULT;
        setLealtad(programa);
        setLealtadOriginal(programa);
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          toast.error(
            error.response?.data?.message || 'Error al cargar la configuración',
          );
        } else {
          toast.error('Error al cargar la configuración');
        }
      } finally {
        setIsLoading(false);
      }
    };

    cargarConfiguracion();
  }, []);

  const guardarCambios = async (): Promise<boolean> => {
    // D10: Validar umbrales de niveles duplicados antes de enviar
    if (lealtad.habilitado && lealtad.niveles.length > 0) {
      const umbrales = lealtad.niveles.map((n) => n.umbralPuntos);
      const duplicados = umbrales.some(
        (u, i) => umbrales.indexOf(u) !== i,
      );
      if (duplicados) {
        toast.error('Hay niveles con el mismo umbral de puntos. Deben ser únicos.');
        return false;
      }
      if (lealtad.niveles.some((n) => !n.nombre.trim())) {
        toast.error('Todos los niveles deben tener un nombre.');
        return false;
      }
    }

    // D10: Advertencias del programa de lealtad — solo avisan, nunca bloquean
    for (const advertencia of recolectarAdvertenciasLealtad(lealtad)) {
      toast.warning(`⚠️ ${advertencia}`);
    }

    const cambiosEmpresa =
      modoCorteZ !== configuracion?.modoCorteZ ||
      umbralFaltanteCritico !== configuracion?.umbralFaltanteCritico ||
      stockMinimoGlobal !== configuracion?.stockMinimoGlobal ||
      stockMaximoGlobal !== configuracion?.stockMaximoGlobal;
    const cambiosLealtad =
      JSON.stringify(lealtad) !== JSON.stringify(lealtadOriginal);

    if (!cambiosEmpresa && !cambiosLealtad) {
      toast.info('No hay cambios para guardar');
      return true;
    }

    setIsSaving(true);
    try {
      const res = await api.patch<ConfiguracionEmpresa>('/company-settings', {
        ...(cambiosEmpresa
          ? {
              modoCorteZ,
              umbralFaltanteCritico,
              stockMinimoGlobal,
              stockMaximoGlobal,
            }
          : {}),
        ...(cambiosLealtad
          ? { programaLealtad: { ...lealtad, puntosPorPesos: 1 } }
          : {}),
      });
      setConfiguracion(res.data);
      setModoCorteZ(res.data.modoCorteZ);
      setUmbralFaltanteCritico(res.data.umbralFaltanteCritico);
      setStockMinimoGlobal(res.data.stockMinimoGlobal);
      setStockMaximoGlobal(res.data.stockMaximoGlobal);
      const programaGuardado = res.data.programaLealtad ?? lealtad;
      setLealtad(programaGuardado);
      setLealtadOriginal(programaGuardado);
      toast.success('Configuración guardada correctamente');
      return true;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(
          error.response?.data?.message || 'Error al guardar la configuración',
        );
      } else {
        toast.error('Error al guardar la configuración');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await guardarCambios();
  };

  // ── Protección de cambios sin guardar ────────────────────────────────
  // Si hay cambios sin guardar y el usuario intenta salir (cambiar de
  // pestaña/navegar o recargar/cerrar), se le recuerda guardar antes.

  const hayCambiosLealtad =
    JSON.stringify(lealtad) !== JSON.stringify(lealtadOriginal);

  const hayCambiosSinGuardar =
    configuracion !== null &&
    (modoCorteZ !== configuracion.modoCorteZ ||
      umbralFaltanteCritico !== configuracion.umbralFaltanteCritico ||
      stockMinimoGlobal !== configuracion.stockMinimoGlobal ||
      stockMaximoGlobal !== configuracion.stockMaximoGlobal ||
      hayCambiosLealtad);

  const blocker = useBlocker(hayCambiosSinGuardar);
  const bloquearSalida = blocker.state === 'blocked';

  useEffect(() => {
    if (!hayCambiosSinGuardar) return;

    const evitarCierre = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', evitarCierre);
    return () => window.removeEventListener('beforeunload', evitarCierre);
  }, [hayCambiosSinGuardar]);

  // Bloquear el scroll del contenedor detrás mientras el diálogo está abierto
  useEffect(() => {
    if (!bloquearSalida) return;

    const contenedor = rootRef.current?.parentElement;
    if (!contenedor) return;

    let scrollable: HTMLElement | null = contenedor;
    while (scrollable) {
      const overflowY = getComputedStyle(scrollable).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        break;
      }
      scrollable = scrollable.parentElement;
    }
    if (!scrollable) return;

    const overflowAnterior = scrollable.style.overflow;
    scrollable.style.overflow = 'hidden';
    return () => {
      scrollable!.style.overflow = overflowAnterior;
    };
  }, [bloquearSalida]);

  const manejarGuardarYSalir = async () => {
    setIsGuardandoYSalir(true);
    const guardado = await guardarCambios();
    setIsGuardandoYSalir(false);
    if (guardado) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  };

  const manejarDescartar = () => blocker.proceed();
  const manejarCancelar = () => blocker.reset();

  const tipoSeleccionado = TIPOS_CORTE_Z.find((t) => t.valor === modoCorteZ);

  // ── D10: Auxiliares del editor de niveles ────────────────────────────

  /** Niveles ordenados por umbral ascendente para su visualización. */
  const nivelesOrdenados = [...lealtad.niveles].sort(
    (a, b) => a.umbralPuntos - b.umbralPuntos,
  );

  /** Actualiza parcialmente un nivel del programa por índice. */
  const actualizarNivel = (index: number, cambios: Partial<NivelLealtadUI>) => {
    setLealtad((prev) => ({
      ...prev,
      niveles: prev.niveles.map((n, i) =>
        i === index ? { ...n, ...cambios } : n,
      ),
    }));
  };

  /** Añade un nivel con valores sugeridos a partir del último nivel existente. */
  const agregarNivel = () => {
    setLealtad((prev) => {
      const ultimo = [...prev.niveles].sort(
        (a, b) => b.umbralPuntos - a.umbralPuntos,
      )[0];
      return {
        ...prev,
        niveles: [
          ...prev.niveles,
          {
            nombre: '',
            umbralPuntos: ultimo ? ultimo.umbralPuntos * 2 : 0,
            descuentoPct: ultimo ? Math.min(ultimo.descuentoPct + 2, 100) : 0,
            colorHex: '#6366F1',
          },
        ],
      };
    });
  };

  /** Elimina un nivel del programa por índice. */
  const eliminarNivel = (index: number) => {
    setLealtad((prev) => ({
      ...prev,
      niveles: prev.niveles.filter((_, i) => i !== index),
    }));
  };

  // ── D10: Valores derivados del modelo simplificado (1 punto = $1) ────────

  /** % de devolución mostrado en la UI (derivado de puntosPorMonto). */
  const pctDevolucion = pesosPorPuntoAPercent(lealtad.puntosPorMonto);

  /** Actualiza la devolución del programa a partir de un porcentaje. */
  const actualizarPctDevolucion = (pct: number) => {
    const pctClamped = Math.min(10, Math.max(0.5, pct));
    setLealtad((prev) => ({
      ...prev,
      puntosPorMonto: percentAPesosPorPunto(pctClamped),
    }));
  };

  /** Puntos que genera el ticket de ejemplo con la configuración actual. */
  const puntosTicketEjemplo =
    lealtad.montoMinimoParaPuntos > TICKET_EJEMPLO
      ? 0
      : Math.floor(TICKET_EJEMPLO / lealtad.puntosPorMonto);

  /** Semáforo de salud del canje y advertencias generales (solo avisan). */
  const semaforoCanje = evaluarSemaforoCanje(lealtad);
  const advertenciasLealtad = recolectarAdvertenciasLealtad(lealtad);

  /** D11: Fecha de ejemplo en que vencerían los puntos ganados hoy. */
  const fechaEjemploVencimiento = (() => {
    const meses = lealtad.mesesExpiracionPuntos ?? 0;
    if (meses <= 0) return null;
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + meses);
    return fecha.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })();

  /** Umbrales para detectar duplicados en el editor de niveles. */
  const umbralesEnUso = lealtad.niveles.map((n) => n.umbralPuntos);

return (
  <div ref={rootRef} className="p-6 max-w-3xl mx-auto w-full space-y-6">
      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Settings2 className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display-lg text-on-background">
            Configuración del Sitio
          </h1>
          <p className="text-on-surface-variant text-sm mt-0.5">
            {configuracion?.nombre || 'Cargando empresa...'} ·{' '}
            <span className="text-primary font-semibold capitalize">
              {user?.rol?.toLowerCase()}
            </span>
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-outline">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-body-md">Cargando configuración...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* ── Sección: Datos de la Empresa ────────────────────────── */}
          <section className="bg-surface border border-outline/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline/10">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg text-on-background font-headline-md">
                  Datos de la Empresa
                </h2>
                <p className="text-xs text-outline font-label-sm mt-0.5">
                  Información general del negocio.
                </p>
              </div>
              <AyudaTooltip etiqueta="¿Qué es?">
                <p className="font-semibold text-sm">Datos de la Empresa</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Información general con la que opera tu negocio. El nombre se muestra
                  en el encabezado de esta pantalla y en los recibos.
                </p>
              </AyudaTooltip>
            </div>

            <div className="p-6">
              <div className="grid gap-2">
                <Label htmlFor="nombre-empresa">Nombre del negocio</Label>
                <Input
                  id="nombre-empresa"
                  value={configuracion?.nombre ?? ''}
                  disabled
                  className="bg-surface-variant/30 text-on-surface-variant"
                />
                <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                  Nombre registrado de la empresa. Por ahora es de solo lectura.
                </p>
              </div>
            </div>
          </section>

          {/* ── Sección: Caja y Cortes de Caja ──────────────────────── */}
          <section className="bg-surface border border-outline/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline/10">
              <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg text-on-background font-headline-md">
                  Caja y Cortes de Caja
                </h2>
                <p className="text-xs text-outline font-label-sm mt-0.5">
                  Define cómo se realiza el arqueo de caja (Corte Z) en esta empresa.
                </p>
              </div>
              <AyudaTooltip etiqueta="¿Qué es?">
                <p className="font-semibold text-sm">Corte de Caja (Corte Z)</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  El Corte Z es el proceso de arqueo con el que el cajero cierra su turno:
                  declara el efectivo contado y el sistema compara contra lo esperado.
                </p>
              </AyudaTooltip>
            </div>

            <div className="p-6 space-y-5">
              {/* Tipo de Corte Z */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor="modo-corte-z">Tipo de Corte de Caja (Corte Z)</Label>
                  <AyudaTooltip etiqueta="¿Cómo elegir?">
                    <p className="font-semibold text-sm">Modo de Corte</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Elige el flujo que seguirá el cajero al cerrar su turno. Los dos modos
                      calculan la diferencia; cambia solo la forma en que se presenta al cajero.
                    </p>
                  </AyudaTooltip>
                </div>
                <Select value={modoCorteZ} onValueChange={(v) => setModoCorteZ(v as ModoCorteZ)}>
                  <SelectTrigger id="modo-corte-z" className="w-full">
                    <SelectValue placeholder="Selecciona un tipo de corte" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CORTE_Z.map((tipo) => (
                      <SelectItem key={tipo.valor} value={tipo.valor}>
                        <span className="flex items-center gap-2">
                          {tipo.icono === 'Eye' ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                          {tipo.etiqueta}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Descripción del modo seleccionado */}
              {tipoSeleccionado && (
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline/20 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {tipoSeleccionado.icono === 'Eye' ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-on-surface">
                        {tipoSeleccionado.etiqueta}
                      </p>
                      <AyudaTooltip etiqueta="Más detalle">
                        <p className="font-semibold text-sm">{tipoSeleccionado.etiqueta}</p>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {tipoSeleccionado.descripcion}
                        </p>
                      </AyudaTooltip>
                    </div>
                    <p className="text-xs text-on-surface-variant font-label-sm mt-1 leading-relaxed">
                      {tipoSeleccionado.descripcion}
                    </p>
                  </div>
                </div>
              )}

              {/* Aviso sobre turnos abiertos */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3">
                <div className="text-primary shrink-0">ℹ</div>
                <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                  El tipo de corte se aplica a los <strong className="text-on-surface">nuevos turnos de caja</strong>.
                  Los turnos ya abiertos conservan el modo con el que fueron iniciados.
                </p>
              </div>
            </div>
          </section>

          {/* ── Sección: Faltantes y Autorizaciones ─────────────────── */}
          <section className="bg-surface border border-outline/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline/10">
              <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg text-on-background font-headline-md">
                  Faltantes y Autorizaciones
                </h2>
                <p className="text-xs text-outline font-label-sm mt-0.5">
                  Controla cuándo un faltante de caja requiere autorización para cerrar el turno.
                </p>
              </div>
              <AyudaTooltip etiqueta="¿Qué es?">
                <p className="font-semibold text-sm">Faltantes de caja</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Cuando el efectivo declarado es menor al esperado, se registra un faltante.
                  Por encima de este umbral el cierre requiere la autorización de un
                  Administrador o Gerente.
                </p>
              </AyudaTooltip>
            </div>

            <div className="p-6">
              {/* Umbral de faltante crítico */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor="umbral-faltante">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      Umbral de faltante crítico ($)
                    </span>
                  </Label>
                  <AyudaTooltip etiqueta="¿Cómo se calcula?">
                    <p className="font-semibold text-sm">Umbral de faltante crítico</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Es el monto en pesos a partir del cual un faltante se considera crítico.
                      Mientras menor sea el valor, más estricto es el control sobre la caja.
                    </p>
                  </AyudaTooltip>
                </div>
                <div className="relative">
                  <Input
                    id="umbral-faltante"
                    type="number"
                    min={0}
                    step="5"
                    value={umbralFaltanteCritico}
                    onChange={(e) => setUmbralFaltanteCritico(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                  Si el faltante declarado en un Corte Z supera este monto, se considera{' '}
                  <strong className="text-error">crítico</strong> y requerirá la autorización de un
                  Administrador o Gerente para cerrar el turno. Faltantes menores se registran con
                  aviso (warning) y solo requieren una justificación en las notas.
                </p>
              </div>
            </div>
          </section>

          {/* ── Sección: Control de Inventario ────────────────────── */}
          <section className="bg-surface border border-outline/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline/10">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined !text-[20px] text-teal-600">inventory_2</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg text-on-background font-headline-md">
                  Control de Inventario
                </h2>
                <p className="text-xs text-outline font-label-sm mt-0.5">
                  Límites de stock global que se aplican por defecto al crear productos nuevos.
                </p>
              </div>
              <AyudaTooltip etiqueta="¿Qué es?">
                <p className="font-semibold text-sm">Límites de Stock Global</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Son los valores por defecto que se asignan al <strong>stock mínimo</strong> y <strong>stock máximo</strong> de cada producto nuevo que crees. Puedes modificarlos después en el detalle de cada producto.
                </p>
              </AyudaTooltip>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor="stock-minimo-global">Stock Mínimo (default)</Label>
                    <AyudaTooltip etiqueta="¿Cómo se usa?">
                      <p className="font-semibold text-sm">Stock Mínimo Global</p>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Cantidad mínima en inventario. Cuando el stock de un producto llega a este nivel, se activan alertas de reabastecimiento.
                      </p>
                    </AyudaTooltip>
                  </div>
                  <Input
                    id="stock-minimo-global"
                    type="number"
                    min={0}
                    step="1"
                    value={stockMinimoGlobal}
                    onChange={(e) => setStockMinimoGlobal(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                    Se aplica a productos nuevos. Los existentes conservan su valor.
                  </p>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor="stock-maximo-global">Stock Máximo (default)</Label>
                    <AyudaTooltip etiqueta="¿Cómo se usa?">
                      <p className="font-semibold text-sm">Stock Máximo Global</p>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Cantidad máxima en inventario. Ayuda a controlar el espacio de bodega y evitar sobrestock.
                      </p>
                    </AyudaTooltip>
                  </div>
                  <Input
                    id="stock-maximo-global"
                    type="number"
                    min={1}
                    step="1"
                    value={stockMaximoGlobal}
                    onChange={(e) => setStockMaximoGlobal(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                    Se aplica a productos nuevos. Los existentes conservan su valor.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3">
                <div className="text-primary shrink-0">ℹ</div>
                <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                  Estos valores son <strong className="text-on-surface">predeterminados</strong>. Puedes ajustar el stock mínimo y máximo de cada producto individualmente desde su detalle o desde la vista de inventario.
                </p>
              </div>
            </div>
          </section>

          {/* ── Sección: Programa de Lealtad (D10) ─────────────────── */}
          <section className="bg-surface border border-outline/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline/10">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg text-on-background font-headline-md">
                  Programa de Lealtad
                </h2>
                <p className="text-xs text-outline font-label-sm mt-0.5">
                  Puntos, rangos de clientes, descuentos y canje.
                </p>
              </div>
              <AyudaTooltip etiqueta="¿Qué es?">
                <p className="font-semibold text-sm">Programa de Lealtad</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Sistema de recompensas para clientes registrados: acumulan
                  puntos con cada compra, suben de rango y obtienen descuentos
                  automáticos. Todo lo que configures aquí se aplica en el POS.
                </p>
              </AyudaTooltip>
            </div>

            <div className="p-6 space-y-6">
              {/* Interruptor general del programa */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor="lealtad-habilitado">Habilitar programa</Label>
                    <AyudaTooltip etiqueta="¿Qué controla?">
                      <p className="font-semibold text-sm">Interruptor general</p>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Al desactivarlo, las nuevas ventas no acumulan puntos,
                        no aplican descuentos por rango ni permiten canjes.
                        Los puntos ya acumulados se conservan.
                      </p>
                    </AyudaTooltip>
                  </div>
                  <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed mt-1">
                    Activa o desactiva todo el sistema de lealtad para la empresa.
                  </p>
                </div>
                <Switch
                  id="lealtad-habilitado"
                  checked={lealtad.habilitado}
                  onCheckedChange={(v) =>
                    setLealtad((prev) => ({ ...prev, habilitado: v }))
                  }
                />
              </div>

              {lealtad.habilitado && (
                <>
                  {/* Buenas prácticas generales */}
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                      <strong className="text-on-surface">Buenas prácticas:</strong>{' '}
                      devolución de 1–3% · canje alcanzable en 2–3 compras promedio ·
                      mínimo de canje de al menos 10 puntos. Recuerda:{' '}
                      <strong className="text-on-surface">1 punto = $1 de descuento</strong>.
                    </p>
                  </div>

                  {/* 1. Acumulación de puntos */}
                  <div className="rounded-xl border border-outline/20 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">1</span>
                        <h3 className="font-semibold text-sm text-on-surface">Acumulación de puntos</h3>
                      </div>
                      <AyudaTooltip etiqueta="¿Qué % elegir?">
                        <p className="font-semibold text-sm">Devolución recomendada</p>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          Retail y supermercados: 1–3%. Consumo frecuente (cafetería,
                          farmacia, kiosco): 3–5%. Negocios premium: 5–10%.
                          Recuerda que 1 punto equivale a $1 de descuento, así que un
                          3% devuelve $3 por cada $100 gastados.
                        </p>
                      </AyudaTooltip>
                    </div>

                    {/* Devolución por compra */}
                    <div className="rounded-lg bg-surface-container-low p-4 space-y-3">
                      <Label htmlFor="pct-devolucion">Devolución por compra</Label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={0.5}
                          max={10}
                          step={0.5}
                          value={pctDevolucion}
                          onChange={(e) =>
                            actualizarPctDevolucion(parseFloat(e.target.value))
                          }
                          className="flex-1 accent-primary cursor-pointer"
                          aria-label="Porcentaje de devolución"
                        />
                        <div className="relative w-24 shrink-0">
                          <Input
                            id="pct-devolucion"
                            type="number"
                            min={0.5}
                            max={10}
                            step={0.5}
                            value={pctDevolucion}
                            onChange={(e) =>
                              actualizarPctDevolucion(
                                parseFloat(e.target.value) || 0.5,
                              )
                            }
                            className="pr-7 text-right"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-outline pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                        Una compra de{' '}
                        <strong className="text-on-surface">${TICKET_EJEMPLO}</strong>{' '}
                        genera{' '}
                        <strong className="text-primary">
                          {puntosTicketEjemplo} puntos (${puntosTicketEjemplo})
                        </strong>
                        {lealtad.montoMinimoParaPuntos > TICKET_EJEMPLO &&
                          ' — no alcanza la compra mínima configurada'}
                        .
                      </p>
                      {pctDevolucion > 5 && (
                        <p className="text-xs text-amber-600 font-label-sm flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Devolución alta: verifica que tu margen la sostenga.
                        </p>
                      )}
                    </div>

                    {/* Compra mínima */}
                    <div className="rounded-lg bg-surface-container-low p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Label htmlFor="compra-minima">Compra mínima para ganar puntos</Label>
                        <AyudaTooltip etiqueta="¿Para qué sirve?">
                          <p className="font-semibold text-sm">Compra mínima</p>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            Ventas por debajo de este monto no generan puntos. Sirve
                            para evitar gastar puntos en tickets muy pequeños. Con
                            "Sin mínimo" activado, todas las ventas acumulan.
                          </p>
                        </AyudaTooltip>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id="compra-minima-toggle"
                          checked={lealtad.montoMinimoParaPuntos > 0}
                          onCheckedChange={(conMinimo) =>
                            setLealtad((prev) => ({
                              ...prev,
                              montoMinimoParaPuntos: conMinimo ? 100 : 0,
                            }))
                          }
                        />
                        <Label htmlFor="compra-minima-toggle" className="text-xs font-label-sm">
                          Requerir compra mínima para ganar puntos
                        </Label>
                      </div>
                      {lealtad.montoMinimoParaPuntos > 0 && (
                        <div className="relative w-40">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-outline pointer-events-none">
                            $
                          </span>
                          <Input
                            id="compra-minima"
                            type="number"
                            min={0}
                            step="any"
                            value={lealtad.montoMinimoParaPuntos}
                            onChange={(e) =>
                              setLealtad((prev) => ({
                                ...prev,
                                montoMinimoParaPuntos:
                                  parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="pl-7"
                          />
                        </div>
                      )}
                    </div>

                    {/* D11: Vencimiento de puntos */}
                    <div className="rounded-lg bg-surface-container-low p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Label htmlFor="vencimiento-puntos">Vencimiento de puntos</Label>
                        <AyudaTooltip etiqueta="¿Cómo vencen?">
                          <p className="font-semibold text-sm">Caducidad por lote</p>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            Cada compra genera un lote de puntos con su propia fecha
                            de vencimiento: los ganados hoy vencen X meses desde hoy;
                            los del mes pasado, X meses desde entonces. Nunca se
                            resetean todos a la vez. Al canjear se consumen primero
                            los lotes más viejos. Cuando un lote expira también bajan
                            los puntos históricos, así que el nivel puede descender si
                            el cliente deja de comprar.
                          </p>
                          <p className="text-xs text-on-surface-variant leading-relaxed mt-2 pt-2 border-t border-outline/20">
                            <strong className="text-on-surface">Si cambias los meses:</strong>{' '}
                            la nueva duración solo aplica a puntos ganados a partir de
                            ese momento. Los puntos ya generados conservan su fecha de
                            vencimiento original y los puntos ya vencidos no se
                            reactivan ni se restauran, aunque apagues el vencimiento
                            o aumentes los meses después.
                          </p>
                        </AyudaTooltip>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id="vencimiento-toggle"
                          checked={(lealtad.mesesExpiracionPuntos ?? 0) > 0}
                          onCheckedChange={(vencen) =>
                            setLealtad((prev) => ({
                              ...prev,
                              mesesExpiracionPuntos: vencen ? 12 : 0,
                            }))
                          }
                        />
                        <Label htmlFor="vencimiento-toggle" className="text-xs font-label-sm">
                          Los puntos vencen después de un tiempo
                        </Label>
                      </div>
                      {(lealtad.mesesExpiracionPuntos ?? 0) > 0 && (
                        <div className="space-y-2">
                          <div className="relative w-28">
                            <Input
                              id="vencimiento-puntos"
                              type="number"
                              min={1}
                              max={120}
                              step={1}
                              value={lealtad.mesesExpiracionPuntos}
                              onChange={(e) =>
                                setLealtad((prev) => ({
                                  ...prev,
                                  mesesExpiracionPuntos:
                                    parseInt(e.target.value) || 0,
                                }))
                              }
                              className="pr-12"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-outline pointer-events-none">
                              mes
                            </span>
                          </div>
                          {fechaEjemploVencimiento && (
                            <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                              Los puntos de una compra de hoy vencerían el{' '}
                              <strong className="text-on-surface">
                                {fechaEjemploVencimiento}
                              </strong>
                              .
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Base de cálculo de puntos */}
                  <div className="rounded-xl border border-outline/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">2</span>
                        <h3 className="font-semibold text-sm text-on-surface">Base de cálculo de puntos</h3>
                      </div>
                      <AyudaTooltip etiqueta="¿Cuál elegir?">
                        <p className="font-semibold text-sm">Base de puntos</p>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          Ejemplo con nivel Oro (5% off) en una venta de $1.000:
                          "Con descuento" otorga puntos sobre $950;
                          "Sin descuento" los otorga sobre $1.000 — más generoso
                          para el cliente.
                        </p>
                      </AyudaTooltip>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setLealtad((prev) => ({
                            ...prev,
                            basePuntos: 'CON_DESCUENTO',
                          }))
                        }
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          lealtad.basePuntos === 'CON_DESCUENTO'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-outline/20 hover:border-outline/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Gift className="w-5 h-5 text-primary" />
                          {lealtad.basePuntos === 'CON_DESCUENTO' && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <p className="font-semibold text-sm text-on-surface mt-2">
                          Sobre total con descuento
                        </p>
                        <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                          Los puntos se calculan después de aplicar el descuento del
                          nivel. Más fácil de explicar y controla el margen.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLealtad((prev) => ({
                            ...prev,
                            basePuntos: 'SIN_DESCUENTO',
                          }))
                        }
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          lealtad.basePuntos === 'SIN_DESCUENTO'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-outline/20 hover:border-outline/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Coins className="w-5 h-5 text-primary" />
                          {lealtad.basePuntos === 'SIN_DESCUENTO' && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <p className="font-semibold text-sm text-on-surface mt-2">
                          Sobre total sin descuento
                        </p>
                        <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                          Los puntos se calculan sobre el precio original, antes del
                          descuento por nivel. Premia más a tus clientes fieles.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* 3. Canje de puntos */}
                  <div
                    className={`rounded-xl border-2 p-4 space-y-4 transition-colors ${
                      lealtad.permitirCanje
                        ? 'border-green-500/40 bg-green-500/5'
                        : 'border-outline/20 bg-surface-container-low/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">3</span>
                          <h3 className="font-semibold text-sm text-on-surface">Canje de puntos</h3>
                          <AyudaTooltip etiqueta="¿Cómo funciona?">
                            <p className="font-semibold text-sm">Canje en caja</p>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                              En el POS, el cajero ve los puntos disponibles del
                              cliente y puede descontarlos como dinero
                              (1 punto = $1) si el cliente llega al mínimo. Si está
                              desactivado, los puntos solo sirven para subir de rango.
                            </p>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                              <strong className="text-on-surface">
                                Canjear no baja el nivel:
                              </strong>{' '}
                              si un cliente canjea 50 puntos sigue siendo Oro. El
                              rango depende de sus puntos históricos acumulados; el
                              canje solo gasta el saldo disponible. (La excepción es
                              la caducidad: cuando los puntos expiran, los
                              históricos también bajan.)
                            </p>
                          </AyudaTooltip>
                        </div>
                        <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed mt-1">
                          {lealtad.permitirCanje
                            ? 'Activo: caja verde — los puntos valen como dinero.'
                            : 'Inactivo: los puntos solo sirven para subir de rango.'}
                        </p>
                      </div>
                      <Switch
                        id="permitir-canje"
                        checked={lealtad.permitirCanje}
                        onCheckedChange={(v) =>
                          setLealtad((prev) => ({ ...prev, permitirCanje: v }))
                        }
                      />
                    </div>

                    {lealtad.permitirCanje && (
                      <div className="space-y-4">
                        <div className="rounded-lg bg-surface p-3 border border-outline/20">
                          <p className="text-xs text-on-surface-variant font-label-sm">
                            Valor fijo:{' '}
                            <strong className="text-on-surface">
                              1 punto = $1 de descuento
                            </strong>
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="canje-minimo">Mínimo de puntos para canjear</Label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="w-32">
                              <Input
                                id="canje-minimo"
                                type="number"
                                min={1}
                                step={1}
                                value={lealtad.canjeMinimoPuntos}
                                onChange={(e) =>
                                  setLealtad((prev) => ({
                                    ...prev,
                                    canjeMinimoPuntos:
                                      parseInt(e.target.value) || 0,
                                  }))
                                }
                              />
                            </div>
                            {[10, 25, 50].map((sugerido) => (
                              <button
                                key={sugerido}
                                type="button"
                                onClick={() =>
                                  setLealtad((prev) => ({
                                    ...prev,
                                    canjeMinimoPuntos: sugerido,
                                  }))
                                }
                                className={`px-3 py-1.5 rounded-full text-xs font-label-sm border transition-colors ${
                                  lealtad.canjeMinimoPuntos === sugerido
                                    ? 'bg-primary/15 border-primary/40 text-primary'
                                    : 'border-outline/30 text-on-surface-variant hover:border-outline/60'
                                }`}
                              >
                                {sugerido} pts
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Semáforo de salud del canje */}
                        <div
                          className={`p-3 rounded-xl border flex gap-3 ${
                            semaforoCanje.estado === 'verde'
                              ? 'bg-green-500/10 border-green-500/30'
                              : semaforoCanje.estado === 'amarillo'
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-red-500/10 border-red-500/30'
                          }`}
                        >
                          <span
                            className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${
                              semaforoCanje.estado === 'verde'
                                ? 'bg-green-500'
                                : semaforoCanje.estado === 'amarillo'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                          />
                          <p className="text-xs text-on-surface-variant font-label-sm leading-relaxed">
                            {semaforoCanje.mensaje}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Niveles del programa */}
                  <div className="rounded-xl border border-outline/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">4</span>
                        <h3 className="font-semibold text-sm text-on-surface">Niveles del programa</h3>
                        <AyudaTooltip etiqueta="¿Cómo funcionan?">
                          <p className="font-semibold text-sm">Niveles (rangos)</p>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            Un cliente alcanza un nivel cuando sus puntos históricos
                            llegan al umbral; desde entonces goza del descuento
                            definido. Usa umbral 0 para un nivel inicial que aplique
                            a todos. Al guardar, el sistema recalcula el nivel de
                            todos los clientes; eliminar un nivel deja a esos
                            clientes sin rango hasta su siguiente compra.
                          </p>
                        </AyudaTooltip>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={agregarNivel}>
                        <Plus className="w-4 h-4" />
                        Añadir nivel
                      </Button>
                    </div>

                    {nivelesOrdenados.length === 0 ? (
                      <div className="p-4 rounded-xl bg-surface-container-low border border-outline/20 text-center">
                        <p className="text-xs text-on-surface-variant font-label-sm">
                          Sin niveles definidos: los clientes no tendrán rango ni
                          descuento. Añade al menos uno para activar los beneficios.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[72px_1fr_110px_90px_48px_40px] gap-2 px-1 items-center">
                          <span className="text-[11px] font-label-md text-outline">Vista</span>
                          <span className="text-[11px] font-label-md text-outline">Nombre</span>
                          <span className="text-[11px] font-label-md text-outline">Umbral (pts)</span>
                          <span className="text-[11px] font-label-md text-outline">Desc. %</span>
                          <span className="text-[11px] font-label-md text-outline">Color</span>
                          <span />
                        </div>
                        {nivelesOrdenados.map((nivel, posicion) => {
                          const indexReal = lealtad.niveles.indexOf(nivel);
                          const umbralDuplicado =
                            umbralesEnUso.filter(
                              (u) => u === nivel.umbralPuntos,
                            ).length > 1;
                          const descuentoAlto = nivel.descuentoPct >= 20;
                          const colorActual = nivel.colorHex ?? '#6366F1';
                          return (
                            <div key={nivel.id ?? `nuevo-${indexReal}`}>
                              <div className="grid grid-cols-[72px_1fr_110px_90px_48px_40px] gap-2 items-center">
                                <span
                                  className="inline-flex items-center justify-center px-2 py-1 rounded-full text-[11px] font-semibold text-white truncate"
                                  style={{ backgroundColor: colorActual }}
                                >
                                  {nivel.nombre || 'Nivel'}
                                </span>
                                <Input
                                  value={nivel.nombre}
                                  onChange={(e) =>
                                    actualizarNivel(indexReal, {
                                      nombre: e.target.value,
                                    })
                                  }
                                  placeholder={
                                    posicion === 0 ? 'Ej. Bronce' : 'Ej. Diamante'
                                  }
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={nivel.umbralPuntos}
                                  onChange={(e) =>
                                    actualizarNivel(indexReal, {
                                      umbralPuntos:
                                        parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className={
                                    umbralDuplicado
                                      ? 'border-red-500 focus-visible:ring-red-500/30'
                                      : ''
                                  }
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="1"
                                  value={nivel.descuentoPct}
                                  onChange={(e) =>
                                    actualizarNivel(indexReal, {
                                      descuentoPct:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                                <input
                                  type="color"
                                  value={colorActual}
                                  onChange={(e) =>
                                    actualizarNivel(indexReal, {
                                      colorHex: e.target.value,
                                    })
                                  }
                                  className="w-9 h-9 rounded-lg border border-outline/30 cursor-pointer bg-transparent p-0.5"
                                  aria-label={`Color del nivel ${nivel.nombre}`}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => eliminarNivel(indexReal)}
                                  className="text-error hover:bg-error/10"
                                  aria-label={`Eliminar nivel ${nivel.nombre}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              {umbralDuplicado && (
                                <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Este umbral ya existe en otro nivel — deben ser únicos.
                                </p>
                              )}
                              {descuentoAlto && (
                                <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {nivel.descuentoPct}% es un descuento alto — verifica tu margen.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Advertencias generales (nunca bloquean el guardado) */}
                  {advertenciasLealtad.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      {advertenciasLealtad.map((advertencia, i) => (
                        <p
                          key={i}
                          className="text-xs text-on-surface-variant font-label-sm leading-relaxed flex gap-2"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          {advertencia}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}

            </div>
          </section>

          {/* ── Acciones ───────────────────────────────────────────── */}
          <div className="flex justify-end items-center gap-3">
            {hayCambiosSinGuardar && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/30 text-warning text-xs font-label-sm font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Cambios sin guardar
              </span>
            )}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* ── Diálogo: cambios sin guardar al intentar salir ──────────── */}
      {bloquearSalida &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6 animate-in fade-in-0">
          <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-8 shadow-2xl space-y-6 animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-4 rounded-2xl bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
              <h2 className="text-2xl font-bold font-headline-md text-on-background">
                Cambios sin guardar
              </h2>
              <p className="text-xs text-outline font-body-md leading-relaxed max-w-[320px]">
                Tienes cambios sin guardar en la configuración del sitio. Si sales
                ahora, los cambios <strong className="text-error">se perderán</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={manejarGuardarYSalir}
                disabled={isGuardandoYSalir}
                className="w-full py-3.5 bg-primary text-on-primary font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg text-sm disabled:opacity-60"
              >
                {isGuardandoYSalir ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar y salir
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={manejarDescartar}
                disabled={isGuardandoYSalir}
                className="w-full py-3.5 spatial-glass rounded-2xl font-bold text-error hover:bg-error/10 text-sm disabled:opacity-60"
              >
                Descartar cambios y salir
              </button>
              <button
                type="button"
                onClick={manejarCancelar}
                disabled={isGuardandoYSalir}
                className="w-full py-3.5 spatial-glass rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container-high text-sm disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
        ,
        document.body,
      )}
    </div>
  );
}
