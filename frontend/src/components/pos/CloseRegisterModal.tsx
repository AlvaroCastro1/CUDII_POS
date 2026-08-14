import React, { useCallback, useEffect, useState } from 'react';
import {
  Lock,
  DollarSign,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import axios from 'axios';
import { api, errorMessage } from '../../lib/api';
import { usePosStore } from '../../store/usePosStore';

interface CloseRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionClosed: () => void;
}

interface Autorizador {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

interface CorteZResultado {
  id: string;
  tipoDiscrepancia?: string;
  diferencia: number;
  montoEsperado: number;
  montoDeclarado: number;
  notas?: string;
  autorizadoPorId?: string;
}

const ROL_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
};

export const CloseRegisterModal: React.FC<CloseRegisterModalProps> = ({
  isOpen,
  onClose,
  onSessionClosed,
}) => {
  const activeSession = usePosStore((s) => s.activeSession);
  const setActiveSession = usePosStore((s) => s.setActiveSession);
  const [montoDeclarado, setMontoDeclarado] = useState<string>('');
  const [notas, setNotas] = useState<string>('');
  const [umbralFaltanteCritico, setUmbralFaltanteCritico] = useState(50);
  const [autorizadores, setAutorizadores] = useState<Autorizador[]>([]);
  const [autorizadoPorId, setAutorizadoPorId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCargandoDatos, setIsCargandoDatos] = useState(false);
  const [isCargandoAutorizadores, setIsCargandoAutorizadores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CorteZResultado | null>(null);
  const [requiereAutorizacion, setRequiereAutorizacion] = useState(false);

  // Derivados (guardados para poder usarlos en effects y handlers)
  const esModoAbierto = activeSession?.modoCorteUsado === 'abierto';
  const montoDeclaradoNum = parseFloat(montoDeclarado) || 0;
  const montoEsperado = activeSession
    ? (activeSession.montoInicial || 0) +
      (activeSession.totalVentasEfectivo || 0) -
      (activeSession.totalRetiros || 0)
    : 0;

  // En modo ciego la diferencia NO se calcula ni se muestra al cajero:
  // el sistema la resuelve al confirmar para evitar adivinar el esperado.
  const diferencia = esModoAbierto ? montoDeclaradoNum - montoEsperado : 0;
  const hayDiscrepancia = esModoAbierto ? diferencia !== 0 : false;
  const esFaltanteCritico = esModoAbierto
    ? diferencia < 0 && Math.abs(diferencia) > umbralFaltanteCritico
    : false;

  // Limpiar el estado del formulario al abrir el modal
  useEffect(() => {
    if (!isOpen) return;
    setMontoDeclarado('');
    setNotas('');
    setAutorizadoPorId('');
    setError(null);
    setResultado(null);
    setRequiereAutorizacion(false);
  }, [isOpen]);

  // Solo en modo abierto: cargar el umbral para validar en vivo.
  // En modo ciego no se hace ninguna petición al abrir (cero bloqueo de red).
  useEffect(() => {
    if (!isOpen || !esModoAbierto || !activeSession) return;

    let activo = true;
    setIsCargandoDatos(true);
    api
      .get('/cash-register/settings')
      .then((res) => {
        if (activo) {
          setUmbralFaltanteCritico(res.data?.umbralFaltanteCritico ?? 50);
        }
      })
      .catch((err) =>
        console.error('Error al cargar configuración de corte:', err),
      )
      .finally(() => {
        if (activo) setIsCargandoDatos(false);
      });
    return () => {
      activo = false;
    };
  }, [isOpen, esModoAbierto, activeSession]);

  // Autorizadores: se cargan solo cuando se necesitan (faltante crítico en vivo
  // o rechazo del servidor en modo ciego), nunca al abrir el modal.
  const cargarAutorizadores = useCallback(async () => {
    if (isCargandoAutorizadores || autorizadores.length > 0) return;
    setIsCargandoAutorizadores(true);
    try {
      const res = await api.get('/users/authorizers');
      setAutorizadores(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error al cargar autorizadores:', err);
    } finally {
      setIsCargandoAutorizadores(false);
    }
  }, [isCargandoAutorizadores, autorizadores.length]);

  useEffect(() => {
    if (!isOpen || !esFaltanteCritico) return;
    cargarAutorizadores();
  }, [isOpen, esFaltanteCritico, cargarAutorizadores]);

  // Solo retornar null al cerrar el modal. El resultado se muestra aunque la
  // sesión ya se haya limpiado (setActiveSession(null) tras el Corte Z).
  if (!isOpen) return null;
  const tipoDiscrepancia =
    diferencia === 0 ? 'cuadre' : diferencia > 0 ? 'sobrante' : 'faltante';

  const autorizadorSeleccionado = autorizadores.find(
    (a) => a.id === autorizadoPorId,
  );

  const handleCloseSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validaciones en vivo solo en modo abierto. En modo ciego el servidor
    // valida notas y autorizaciones al confirmar, sin revelar la diferencia.
    if (esModoAbierto && hayDiscrepancia && notas.trim() === '') {
      setError(
        'Se requiere una justificación (notas) cuando hay diferencia en el corte.',
      );
      setIsLoading(false);
      return;
    }

    // Validación de autorización para faltantes críticos (solo modo abierto)
    if (esModoAbierto && esFaltanteCritico && !autorizadoPorId) {
      setError(
        `El faltante de $${Math.abs(diferencia).toFixed(2)} supera el umbral de $${umbralFaltanteCritico.toFixed(2)}. Se requiere la autorización de un Administrador o Gerente para cerrar el turno.`,
      );
      setIsLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        sesionCajaId: activeSession.id,
        montoDeclarado: montoDeclaradoNum,
      };
      if (notas.trim()) payload.notas = notas.trim();
      if (autorizadoPorId) payload.autorizadoPorId = autorizadoPorId;

      const res = await api.post('/cash-register/close-z', payload);

      setActiveSession(null);
      setResultado(res.data?.corteZ || null);
    } catch (err: unknown) {
      console.error('Error al realizar Corte Z:', err);
      if (!esModoAbierto && axios.isAxiosError(err) && err.response?.status === 403) {
        // Modo ciego: no revelar montos, solo pedir la autorización requerida
        setError(
          'El faltante declarado supera el umbral establecido. Se requiere la autorización de un Administrador o Gerente para cerrar el turno.',
        );
        setRequiereAutorizacion(true);
        cargarAutorizadores();
      } else if (!esModoAbierto && axios.isAxiosError(err) && err.response?.status === 400) {
        setError(
          'Hay una diferencia en el corte. Registra una justificación en las notas para continuar.',
        );
      } else {
        setError(errorMessage(err, 'Ocurrió un error al cerrar el turno de caja'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pantalla de resultado ──────────────────────────────────────────────
  if (resultado) {
    const tipo = resultado.tipoDiscrepancia || 'cuadre';
    const esSobrante = tipo === 'sobrante';
    const esFaltante = tipo === 'faltante';
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 animate-in fade-in-0">
        <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-8 shadow-2xl space-y-6 animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center space-y-2">
            <div
              className={`p-4 rounded-2xl border ${
                tipo === 'cuadre'
                  ? 'bg-success/10 text-success border-success/30'
                  : esSobrante
                    ? 'bg-warning/10 text-warning border-warning/30'
                    : 'bg-error/10 text-error border-error/30'
              }`}
            >
              {tipo === 'cuadre' ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : (
                <ShieldAlert className="w-8 h-8" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-primary font-headline-md">
              {tipo === 'cuadre'
                ? 'Corte Z cuadrado'
                : esSobrante
                  ? 'Corte Z con sobrante'
                  : 'Corte Z con faltante'}
            </h2>
            <p className="text-xs text-outline font-body-md">
              El turno de caja fue cerrado correctamente.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline/20 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant font-label-sm">Esperado</span>
              <span className="font-mono font-bold text-primary">${resultado.montoEsperado.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant font-label-sm">Contado</span>
              <span className="font-mono font-bold text-primary">${resultado.montoDeclarado.toFixed(2)}</span>
            </div>
            <div className="h-px bg-surface-container-high" />
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant font-label-sm">Diferencia</span>
              <span
                className={`font-mono font-black ${
                  tipo === 'cuadre'
                    ? 'text-success'
                    : esSobrante
                      ? 'text-warning'
                      : 'text-error'
                }`}
              >
                {esFaltante ? '−' : esSobrante ? '+' : ''}${Math.abs(resultado.diferencia).toFixed(2)}
              </span>
            </div>
            {tipo !== 'cuadre' && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-on-surface-variant font-label-sm">Justificación</span>
                <span className="text-right text-on-surface font-label-sm">{resultado.notas || '—'}</span>
              </div>
            )}
            {tipo === 'faltante' && resultado.autorizadoPorId && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-on-surface-variant font-label-sm">Autorizado por</span>
                <span className="text-right text-success font-label-sm">
                  <ShieldCheck className="inline w-3.5 h-3.5 mr-1" />
                  {autorizadorSeleccionado?.nombre || 'Administrador/Gerente'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onSessionClosed}
            className="w-full py-3.5 bg-error text-on-error font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg text-sm"
          >
            Finalizar
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario principal ───────────────────────────────────────────────
  if (!activeSession) return null;

  return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 animate-in fade-in-0">
      <div className="bg-surface border border-outline/20 rounded-[28px] max-w-md w-full p-8 shadow-2xl space-y-6 max-h-[80vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-4 bg-error/10 text-error rounded-2xl border border-error/30">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-primary font-headline-md">
            Cierre de Turno
          </h2>
          <p className="text-xs text-outline font-body-md">
            Ingresa el efectivo contado físicamente en el cajón para cerrar el turno.
          </p>
        </div>

        {/* Modo de corte de la sesión: abierto muestra el esperado, ciego no */}
        {esModoAbierto ? (
          <div className="p-4 rounded-2xl bg-success/10 border border-success/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface font-label-sm flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-success" />
                Efectivo Esperado en Cajón
              </span>
              <span className="font-mono font-black text-lg text-success">
                ${montoEsperado.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant font-label-sm">
              Modo de corte <strong className="text-on-surface">abierto</strong>: el sistema muestra
              el saldo esperado para cuadrar en tiempo real.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-surface-container-high border border-outline/20 text-[11px] text-on-surface-variant font-label-sm flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-outline shrink-0" />
            Modo de corte <strong className="text-on-surface">ciego</strong>: ingresa el efectivo
            contado sin consultar el monto esperado. La diferencia se valida al confirmar.
          </div>
        )}

        {error && (
          <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-error text-xs font-label-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCloseSessionSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5 font-label-sm">
              Efectivo Contado en Cajón ($)
            </label>
            <div className="relative flex items-center">
              <DollarSign className="absolute left-3.5 w-5 h-5 text-error" />
              <input
                type="number"
                step="0.50"
                value={montoDeclarado}
                onChange={(e) => setMontoDeclarado(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-bold text-xl focus:outline-none focus:ring-2 focus:ring-error font-label-sm"
              />
            </div>
          </div>

          {/* Diferencia en vivo (solo modo abierto; en ciego se oculta para no revelar el esperado) */}
          {esModoAbierto && montoDeclarado !== '' && (
            <div
              className={`p-3 rounded-xl border text-xs font-label-sm space-y-1 ${
                tipoDiscrepancia === 'cuadre'
                  ? 'bg-success/10 border-success/30 text-success'
                  : esFaltanteCritico
                    ? 'bg-error/10 border-error/40 text-error'
                    : 'bg-warning/10 border-warning/30 text-warning'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {tipoDiscrepancia === 'cuadre'
                    ? 'Caja cuadrada'
                    : tipoDiscrepancia === 'sobrante'
                      ? `Sobrante de $${Math.abs(diferencia).toFixed(2)}`
                      : esFaltanteCritico
                        ? `Faltante CRÍTICO de $${Math.abs(diferencia).toFixed(2)}`
                        : `Faltante de $${Math.abs(diferencia).toFixed(2)}`}
                </span>
                {tipoDiscrepancia !== 'cuadre' && (
                  <span className="font-mono font-black">
                    {tipoDiscrepancia === 'sobrante' ? '+' : '−'}
                    {Math.abs(diferencia).toFixed(2)}
                  </span>
                )}
              </div>
              {tipoDiscrepancia !== 'cuadre' && (
                <p className="text-[11px] opacity-90">
                  {esFaltanteCritico
                    ? `Supera el umbral de $${umbralFaltanteCritico.toFixed(2)}. Se requiere autorización de un Administrador o Gerente.`
                    : 'Se requiere una justificación en las notas del cierre.'}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-outline mb-1.5 font-label-sm">
              Notas / Observaciones del Cierre{' '}
              {esModoAbierto && hayDiscrepancia && (
                <span className="text-error">(Obligatoria)</span>
              )}
              {esModoAbierto && !hayDiscrepancia && (
                <span className="text-on-surface-variant">(Opcional)</span>
              )}
              {!esModoAbierto && (
                <span className="text-on-surface-variant">
                  (Se solicita si hay diferencia)
                </span>
              )}
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. Sobran $5.00 por cambio o notas de descuadre..."
              className={`w-full px-4 py-2.5 bg-surface-container-low border rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary font-body-md ${
                hayDiscrepancia && notas.trim() === ''
                  ? 'border-error/50'
                  : 'border-outline/20'
              }`}
            />
          </div>

          {/* Selector de autorizador para faltantes críticos */}
          {(esFaltanteCritico || requiereAutorizacion) && (
            <div className="p-3 rounded-xl bg-error/5 border border-error/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-error">
                <ShieldCheck className="w-4 h-4" />
                Autorización requerida
              </div>
              {isCargandoAutorizadores ? (
                <p className="text-xs text-on-surface-variant">Cargando autorizadores...</p>
              ) : autorizadores.length === 0 ? (
                <p className="text-xs text-on-surface-variant">
                  No hay Administradores o Gerentes disponibles para autorizar.
                  Contacta al administrador antes de cerrar.
                </p>
              ) : (
                <select
                  value={autorizadoPorId}
                  onChange={(e) => setAutorizadoPorId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-error font-body-md"
                >
                  <option value="">Selecciona un autorizador...</option>
                  {autorizadores.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} — {ROL_LABEL[a.rol] || a.rol}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-on-surface-variant font-label-sm">
                {esModoAbierto
                  ? `El autorizador asume la responsabilidad del faltante de $${Math.abs(diferencia).toFixed(2)}.`
                  : 'El autorizador asume la responsabilidad del faltante detectado.'}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 spatial-glass rounded-2xl font-bold text-primary hover:bg-surface-container-high text-sm"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                isLoading ||
                isCargandoDatos ||
                ((esFaltanteCritico || requiereAutorizacion) &&
                  isCargandoAutorizadores)
              }
              className="flex-1 py-3.5 bg-error text-on-error font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg text-sm"
            >
              {isLoading ? 'Cerrando turno...' : 'Cerrar Turno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};