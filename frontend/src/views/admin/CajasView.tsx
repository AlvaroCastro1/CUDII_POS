import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Eye,
  Lock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Banknote,
  Clock,
} from 'lucide-react';
import axios from 'axios';

interface SesionAbierta {
  id: string;
  caja: {
    id: string;
    nombre: string;
    sucursal: { id: string; nombre: string };
  };
  cajero: { id: string; nombre: string; rol: string } | null;
  modoCorteUsado: string;
  montoInicial: number;
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  totalVentasOtros: number;
  totalRetiros: number;
  efectivoEsperado: number;
  fechaApertura: string;
  minutosAbierta: number;
}

interface PreviewCorte {
  sesionCajaId: string;
  caja: {
    id: string;
    nombre: string;
    sucursal: { id: string; nombre: string };
  };
  cajero: { id: string; nombre: string; rol: string } | null;
  modoCorteUsado: string;
  fechaApertura: string;
  montoInicial: number;
  ventas: { efectivo: number; tarjeta: number; otros: number; total: number };
  retiros: { id: string; monto: number; motivo: string }[];
  totalRetiros: number;
  efectivoEsperado: number;
}

interface Autorizador {
  id: string;
  nombre: string;
  rol: string;
}

const ROL_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  CAJERO: 'Cajero',
  ALMACEN: 'Almacén',
  CONTADOR: 'Contador',
};

const UMBRAL_ALERTA_HORAS = 8;
const fmtMoneda = (v: number) =>
  v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

function formatoAntiguedad(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `${h} h ${m} min`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

export default function CajasView() {
  const [sesiones, setSesiones] = useState<SesionAbierta[]>([]);
  const [loading, setLoading] = useState(true);

  const [preview, setPreview] = useState<PreviewCorte | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);

  const [cerrarTarget, setCerrarTarget] = useState<SesionAbierta | null>(null);
  const [montoDeclarado, setMontoDeclarado] = useState('');
  const [notas, setNotas] = useState('');
  const [autorizadores, setAutorizadores] = useState<Autorizador[]>([]);
  const [autorizadoPorId, setAutorizadoPorId] = useState('');
  const [cargandoAutorizadores, setCargandoAutorizadores] = useState(false);
  const [isCerrando, setIsCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);

  const fetchSesiones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/cash-register/open-sessions');
      setSesiones(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Error al cargar las cajas abiertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSesiones();
  }, [fetchSesiones]);

  const abrirPreview = async (id: string) => {
    setCargandoPreview(true);
    setPreview(null);
    try {
      const res = await api.get(`/cash-register/sessions/${id}/preview`);
      if (res.data) setPreview(res.data);
      else toast.error('La sesión ya no está abierta');
    } catch {
      toast.error('Error al obtener la vista previa del corte');
    } finally {
      setCargandoPreview(false);
    }
  };

  const abrirCierre = (s: SesionAbierta) => {
    setCerrarTarget(s);
    setMontoDeclarado('');
    setNotas('');
    setAutorizadoPorId('');
    setErrorCierre(null);
    setAutorizadores([]);
    cargarAutorizadores();
  };

  const cargarAutorizadores = async () => {
    if (cargandoAutorizadores || autorizadores.length > 0) return;
    setCargandoAutorizadores(true);
    try {
      const res = await api.get('/users/authorizers');
      setAutorizadores(Array.isArray(res.data) ? res.data : []);
    } catch {
      console.error('Error al cargar autorizadores');
    } finally {
      setCargandoAutorizadores(false);
    }
  };

  const handleCerrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cerrarTarget) return;
    const monto = parseFloat(montoDeclarado) || 0;
    setIsCerrando(true);
    setErrorCierre(null);
    try {
      const payload: Record<string, unknown> = {
        sesionCajaId: cerrarTarget.id,
        montoDeclarado: monto,
      };
      if (notas.trim()) payload.notas = notas.trim();
      if (autorizadoPorId) payload.autorizadoPorId = autorizadoPorId;

      await api.post('/cash-register/close-z', payload);
      toast.success('Caja cerrada correctamente');
      setCerrarTarget(null);
      fetchSesiones();
    } catch (err: unknown) {
      console.error('Error al cerrar caja:', err);
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setErrorCierre(
          'El faltante declarado supera el umbral. Se requiere autorización de un Administrador o Gerente.',
        );
        cargarAutorizadores();
      } else if (
        axios.isAxiosError(err) &&
        err.response?.status === 400
      ) {
        setErrorCierre(
          err.response.data?.message ||
            'Hay una diferencia en el corte. Revisa los datos e inténtalo de nuevo.',
        );
      } else {
        setErrorCierre('Ocurrió un error al cerrar la caja. Inténtalo de nuevo.');
      }
    } finally {
      setIsCerrando(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display-lg font-bold text-primary">
            Cajas Abiertas
          </h1>
          <p className="text-sm text-on-surface-variant font-body-md">
            Monitoreo y cierre de sesiones de caja en todas las sucursales.
          </p>
        </div>
        <Button variant="outline" onClick={fetchSesiones} disabled={loading}>
          <Banknote className="w-4 h-4" />
          {loading ? 'Cargando...' : 'Actualizar'}
        </Button>
      </div>

      {loading ? (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-12 text-center text-on-surface-variant font-body-md">
          Cargando cajas abiertas...
        </div>
      ) : sesiones.length === 0 ? (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-12 text-center text-on-surface-variant font-body-md flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-success" />
          No hay cajas abiertas en este momento.
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-on-surface/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-on-surface/10 text-left text-xs uppercase tracking-wider text-outline font-label-sm">
                <th className="px-4 py-3">Caja / Sucursal</th>
                <th className="px-4 py-3">Cajero</th>
                <th className="px-4 py-3 text-right">Ventas efectivo</th>
                <th className="px-4 py-3 text-right">Tarjeta / Otros</th>
                <th className="px-4 py-3 text-right">Retiros</th>
                <th className="px-4 py-3 text-right">Efectivo esperado</th>
                <th className="px-4 py-3">Antigüedad</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sesiones.map((s) => {
                const alerta = s.minutosAbierta >= UMBRAL_ALERTA_HORAS * 60;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-on-surface/5 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-primary">
                        {s.caja.nombre}
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        {s.caja.sucursal.nombre}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-on-surface">
                        {s.cajero?.nombre || '—'}
                      </div>
                      <div className="text-xs text-outline uppercase">
                        {s.cajero ? ROL_LABEL[s.cajero.rol] || s.cajero.rol : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmtMoneda(s.totalVentasEfectivo)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmtMoneda(s.totalVentasTarjeta + s.totalVentasOtros)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmtMoneda(s.totalRetiros)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                      {fmtMoneda(s.efectivoEsperado)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-label-sm px-2.5 py-1 rounded-full ${
                          alerta
                            ? 'bg-error/10 text-error border border-error/30'
                            : 'bg-surface-container-high text-on-surface-variant border border-on-surface/10'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {formatoAntiguedad(s.minutosAbierta)}
                      </span>
                      {alerta && (
                        <div className="mt-1 text-[11px] text-error font-label-sm flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Lleva mucho rato abierta
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirPreview(s.id)}
                          disabled={cargandoPreview}
                        >
                          <Eye className="w-4 h-4" />
                          Vista previa
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => abrirCierre(s)}
                        >
                          <Lock className="w-4 h-4" />
                          Cerrar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Vista previa del corte */}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-on-surface/10 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>Vista previa del corte</DialogTitle>
            </DialogHeader>
          </div>
          {preview && (
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
              <div className="text-sm text-on-surface-variant mb-4">
                {preview.caja.nombre} · {preview.caja.sucursal.nombre} —
                Cajero: {preview.cajero?.nombre || '—'}
                <span className="ml-1 text-outline uppercase">
                  ({preview.modoCorteUsado === 'abierto' ? 'abierto' : 'ciego'})
                </span>
              </div>
              <div className="rounded-xl border border-on-surface/10 overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-on-surface/5 text-sm">
                  <div className="bg-surface-container-low px-4 py-3">
                    <div className="text-xs text-outline font-label-sm">
                      Fondo inicial
                    </div>
                    <div className="font-mono font-bold">
                      {fmtMoneda(preview.montoInicial)}
                    </div>
                  </div>
                  <div className="bg-surface-container-low px-4 py-3">
                    <div className="text-xs text-outline font-label-sm">
                      Ventas efectivo
                    </div>
                    <div className="font-mono font-bold">
                      {fmtMoneda(preview.ventas.efectivo)}
                    </div>
                  </div>
                  <div className="bg-surface-container-low px-4 py-3">
                    <div className="text-xs text-outline font-label-sm">
                      Ventas tarjeta
                    </div>
                    <div className="font-mono font-bold">
                      {fmtMoneda(preview.ventas.tarjeta)}
                    </div>
                  </div>
                  <div className="bg-surface-container-low px-4 py-3">
                    <div className="text-xs text-outline font-label-sm">
                      Ventas otros
                    </div>
                    <div className="font-mono font-bold">
                      {fmtMoneda(preview.ventas.otros)}
                    </div>
                  </div>
                  <div className="bg-surface-container-low px-4 py-3 col-span-2">
                    <div className="text-xs text-outline font-label-sm">
                      Retiros ({preview.retiros.length})
                    </div>
                    {preview.retiros.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {preview.retiros.map((r) => (
                          <div key={r.id} className="flex justify-between text-sm">
                            <span className="truncate pr-2">
                              {r.motivo || 'Retiro'}
                            </span>
                            <span className="font-mono shrink-0">
                              {fmtMoneda(r.monto)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-mono font-bold">
                        {fmtMoneda(0)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                <span className="font-semibold text-primary font-label-sm">
                  Efectivo esperado en cajón
                </span>
                <span className="font-mono font-black text-lg text-primary">
                  {fmtMoneda(preview.efectivoEsperado)}
                </span>
              </div>
            </div>
          )}
          <div className="px-6 py-4 border-t border-on-surface/10 bg-surface-variant/30 flex justify-end gap-3 flex-shrink-0">
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Cerrar caja */}
      <Dialog
        open={cerrarTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCerrarTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-on-surface/10 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>Cerrar caja a distancia</DialogTitle>
            </DialogHeader>
          </div>
          {cerrarTarget && (
            <form onSubmit={handleCerrar} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
                <div className="text-sm text-on-surface-variant">
                  Cerrando{' '}
                  <strong className="text-on-surface">
                    {cerrarTarget.caja.nombre}
                  </strong>{' '}
                  ({cerrarTarget.caja.sucursal.nombre}) —{' '}
                  <span className="uppercase">
                    modo {cerrarTarget.modoCorteUsado === 'abierto' ? 'abierto' : 'ciego'}
                  </span>
                </div>

                {errorCierre && (
                  <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-error text-xs font-label-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorCierre}</span>
                  </div>
                )}

                <div>
                  <Label htmlFor="monto" className="text-xs font-semibold text-primary">
                    Efectivo contado en cajón ($)
                  </Label>
                  <input
                    id="monto"
                    type="number"
                    step="0.50"
                    value={montoDeclarado}
                    onChange={(e) => setMontoDeclarado(e.target.value)}
                    placeholder="0.00"
                    required
                    className="mt-1.5 w-full px-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-primary font-bold text-xl focus:outline-none focus:ring-2 focus:ring-primary font-label-sm"
                  />
                  {cerrarTarget.modoCorteUsado !== 'abierto' && (
                    <p className="mt-1.5 text-[11px] text-on-surface-variant font-label-sm">
                      Modo ciego: ingresa el efectivo contado sin consultar el esperado.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="notas" className="text-xs font-semibold text-outline">
                    Notas / Observaciones (se solicitan si hay diferencia)
                  </Label>
                  <textarea
                    id="notas"
                    rows={2}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="mt-1.5 w-full px-4 py-2.5 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
                  />
                </div>

                {cargandoAutorizadores ? (
                  <p className="text-xs text-on-surface-variant">
                    Cargando autorizadores...
                  </p>
                ) : autorizadores.length > 0 ? (
                  <div>
                    <Label className="text-xs font-semibold text-outline">
                      Autorizador (si hay faltante crítico)
                    </Label>
                    <select
                      value={autorizadoPorId}
                      onChange={(e) => setAutorizadoPorId(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2.5 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-error font-body-md"
                    >
                      <option value="">Sin autorización</option>
                      {autorizadores.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} — {ROL_LABEL[a.rol] || a.rol}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">
                    No hay Administradores o Gerentes disponibles para autorizar.
                  </p>
                )}

                {autorizadoPorId !== '' && (
                  <div className="p-3 rounded-xl bg-success/5 border border-success/30 text-xs text-success font-label-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Autorización registrada: el autorizador asume la responsabilidad del faltante.
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-on-surface/10 bg-surface-variant/30 flex justify-end gap-3 flex-shrink-0">
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCerrarTarget(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isCerrando}
                  >
                    <Lock className="w-4 h-4" />
                    {isCerrando ? 'Cerrando...' : 'Cerrar caja'}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
