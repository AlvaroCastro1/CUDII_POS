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
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
    if (
      modoCorteZ === configuracion?.modoCorteZ &&
      umbralFaltanteCritico === configuracion?.umbralFaltanteCritico &&
      stockMinimoGlobal === configuracion?.stockMinimoGlobal &&
      stockMaximoGlobal === configuracion?.stockMaximoGlobal
    ) {
      toast.info('No hay cambios para guardar');
      return true;
    }

    setIsSaving(true);
    try {
      const res = await api.patch<ConfiguracionEmpresa>('/company-settings', {
        modoCorteZ,
        umbralFaltanteCritico,
        stockMinimoGlobal,
        stockMaximoGlobal,
      });
      setConfiguracion(res.data);
      setModoCorteZ(res.data.modoCorteZ);
      setUmbralFaltanteCritico(res.data.umbralFaltanteCritico);
      setStockMinimoGlobal(res.data.stockMinimoGlobal);
      setStockMaximoGlobal(res.data.stockMaximoGlobal);
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

  const hayCambiosSinGuardar =
    configuracion !== null &&
    (modoCorteZ !== configuracion.modoCorteZ ||
      umbralFaltanteCritico !== configuracion.umbralFaltanteCritico ||
      stockMinimoGlobal !== configuracion.stockMinimoGlobal ||
      stockMaximoGlobal !== configuracion.stockMaximoGlobal);

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
