import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Eye,
  EyeOff,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  Package,
  User,
  History,
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface DetalleVenta {
  id: string;
  nombreProducto: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  total: number;
}

interface PagoVenta {
  id: string;
  metodo: string;
  montoPagado: number;
  cambio: number;
}

interface Venta {
  id: string;
  folio: string;
  total: number;
  estado: string;
  creadoEn: string;
  detalles: DetalleVenta[];
  pagos: PagoVenta[];
}

interface LogActividad {
  id: string;
  accion: string;
  entidadTipo: string;
  entidadId: string;
  detalles: Record<string, unknown>;
  severidad: string;
  fechaHora: string;
  usuario: { id: string; nombre: string; rol: string } | null;
}

const ACCION_LABEL: Record<string, string> = {
  INICIO_SESION: 'Inicio de sesión',
  APERTURA_CAJA: 'Apertura de caja',
  RETIRO_PARCIAL: 'Retiro parcial',
  CORTE_X: 'Corte X',
  CORTE_Z: 'Corte Z',
  VENTA_COMPLETADA: 'Venta completada',
  VENTA_CANCELADA: 'Venta cancelada',
  DEVOLUCION_REGISTRADA: 'Devolución registrada',
};

const SEVERIDAD_STYLE: Record<string, string> = {
  info: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  critical: 'bg-error/10 text-error border-error/20',
};

function resumirDetalles(accion: string, detalles: Record<string, unknown>): string {
  const d = detalles || {};
  switch (accion) {
    case 'INICIO_SESION':
      return d.metodo ? `Método: ${d.metodo}` : 'Acceso a la plataforma';
    case 'CORTE_Z':
      return [
        d.cajaNombre ? `Caja: ${d.cajaNombre}` : '',
        `Esperado: $${Number(d.montoEsperado ?? 0).toFixed(2)}`,
        `Contado: $${Number(d.montoDeclarado ?? 0).toFixed(2)}`,
        d.tipoDiscrepancia ? `Tipo: ${d.tipoDiscrepancia}` : '',
      ]
        .filter(Boolean)
        .join(' • ');
    case 'APERTURA_CAJA':
      return [
        d.cajaNombre ? `Caja: ${d.cajaNombre}` : '',
        `Fondo: $${Number(d.montoInicial ?? 0).toFixed(2)}`,
      ]
        .filter(Boolean)
        .join(' • ');
    case 'RETIRO_PARCIAL':
      return [
        `Monto: $${Number(d.monto ?? 0).toFixed(2)}`,
        d.motivo ? `Motivo: ${d.motivo}` : '',
      ]
        .filter(Boolean)
        .join(' • ');
    case 'CORTE_X':
      return [
        d.cajaNombre ? `Caja: ${d.cajaNombre}` : '',
        d.efectivoEnCaja !== undefined
          ? `Efectivo: $${Number(d.efectivoEnCaja).toFixed(2)}`
          : '',
      ]
        .filter(Boolean)
        .join(' • ');
    case 'VENTA_COMPLETADA':
      return [
        d.folio ? `Folio: ${d.folio}` : '',
        d.total !== undefined ? `Total: $${Number(d.total).toFixed(2)}` : '',
        d.esDemostracion ? 'Demostración' : '',
      ]
        .filter(Boolean)
        .join(' • ');
    case 'DEVOLUCION_REGISTRADA':
      return [
        d.folio ? `Folio: ${d.folio}` : '',
        d.totalDevuelto !== undefined
          ? `Devuelto: $${Number(d.totalDevuelto).toFixed(2)}`
          : '',
        d.ventaFolio ? `Venta: ${d.ventaFolio}` : '',
      ]
        .filter(Boolean)
        .join(' • ');
    default:
      return Object.entries(d)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' • ');
  }
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Subcomponente: Fila de Venta con detalle expandible ─────────────────────

function VentaRow({ venta }: { venta: Venta }) {
  const [isOpen, setIsOpen] = useState(false);

  const metodoIcono = (metodo: string) => {
    if (metodo === 'tarjeta') return <CreditCard className="w-3.5 h-3.5 text-primary" />;
    return <Banknote className="w-3.5 h-3.5 text-success" />;
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'completada': return 'text-success bg-success/10 border-success/30';
      case 'cancelada': return 'text-error bg-error/10 border-error/30';
      default: return 'text-outline bg-surface-container-high border-outline/20';
    }
  };

  return (
    <div className="border border-outline/20 rounded-2xl overflow-hidden transition-all">
      {/* Fila Resumen */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-surface-container-high transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-mono font-bold text-sm text-primary truncate">{venta.folio}</div>
            <div className="text-[11px] text-outline font-label-sm">
              {new Date(venta.creadoEn).toLocaleString('es-MX', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border font-label-sm ${estadoColor(venta.estado)}`}>
            {venta.estado}
          </span>
          <div className="text-right">
            <div className="font-mono font-black text-base text-primary">${venta.total.toFixed(2)}</div>
            <div className="text-[10px] text-outline font-label-sm">{venta.detalles?.length || 0} productos</div>
          </div>
          {isOpen
            ? <ChevronUp className="w-4 h-4 text-outline" />
            : <ChevronDown className="w-4 h-4 text-outline" />
          }
        </div>
      </button>

      {/* Detalle expandido */}
      {isOpen && (
        <div className="border-t border-outline/20 bg-surface-container-low px-4 py-4 space-y-4">
          {/* Productos */}
          <div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 font-label-sm flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Productos
            </div>
            <div className="space-y-2">
              {venta.detalles?.map((det) => (
                <div key={det.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 font-mono">
                      {det.cantidad}
                    </span>
                    <span className="text-on-surface truncate font-body-md">{det.nombreProducto}</span>
                    <span className="text-outline text-[11px] font-label-sm shrink-0">{det.unidadMedida}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-mono font-bold text-primary text-sm">${det.total.toFixed(2)}</div>
                    {det.descuento > 0 && (
                      <div className="text-[10px] text-success">- ${det.descuento.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagos */}
          <div className="border-t border-outline/20 pt-3">
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 font-label-sm">
              Forma de Pago
            </div>
            <div className="space-y-1.5">
              {venta.pagos?.map((pago) => (
                <div key={pago.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-on-surface font-body-md capitalize">
                    {metodoIcono(pago.metodo)}
                    {pago.metodo}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-sm">
                    <span className="text-primary font-bold">${pago.montoPagado.toFixed(2)}</span>
                    {pago.cambio > 0 && (
                      <span className="text-[11px] text-outline">Cambio: ${pago.cambio.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total resumen */}
          <div className="border-t border-outline/20 pt-3 flex justify-between items-center">
            <span className="text-sm text-outline font-label-sm">Total de Venta</span>
            <span className="text-xl font-black text-primary font-mono">${venta.total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vista Principal Mi Perfil ────────────────────────────────────────────────

export default function MiPerfilView() {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estado del log de ventas
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [isLoadingVentas, setIsLoadingVentas] = useState(true);
  const [totalVentas, setTotalVentas] = useState(0);

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        nombre: user.nombre,
        email: user.email,
      }));
    }
  }, [user]);

  // Cargar historial de ventas del usuario actual
  useEffect(() => {
    const cargarVentas = async () => {
      if (!user?.id) return;
      setIsLoadingVentas(true);
      try {
        const res = await api.get('/sales', {
          params: { cajeroId: user.id, limit: 50 },
        });
        // Soportar respuesta { data, meta } o array directo
        const lista = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        const total = res.data?.meta?.total ?? lista.length;
        setVentas(lista);
        setTotalVentas(total);
      } catch (err) {
        console.error('Error al cargar historial de ventas del usuario:', err);
      } finally {
        setIsLoadingVentas(false);
      }
    };
    cargarVentas();
  }, [user?.id]);

  // Cargar historial de actividad del usuario actual (inicios de sesión,
  // ventas, cortes, devoluciones, etc.)
  const [actividad, setActividad] = useState<LogActividad[]>([]);
  const [isLoadingActividad, setIsLoadingActividad] = useState(true);

  useEffect(() => {
    const cargarActividad = async () => {
      if (!user?.id) return;
      setIsLoadingActividad(true);
      try {
        const res = await api.get('/audit/me', {
          params: { limit: 30 },
        });
        const lista = Array.isArray(res.data)
          ? res.data
          : res.data?.data || [];
        setActividad(lista);
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.error(
            'Error al cargar historial de actividad:',
            error.response?.data?.message || error.message,
          );
        } else {
          console.error('Error al cargar historial de actividad:', error);
        }
      } finally {
        setIsLoadingActividad(false);
      }
    };
    cargarActividad();
  }, [user?.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: { nombre: string; email: string; password?: string } = {
        nombre: formData.nombre,
        email: formData.email,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      await api.patch('/users/profile/me', payload);
      toast.success('Perfil actualizado correctamente. Los cambios en la sesión se verán al recargar la página.');
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al actualizar el perfil');
      } else {
        toast.error('Error al actualizar el perfil');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calcular estadísticas rápidas del cajero
  const montoTotalVendido = ventas.reduce((acc, v) => acc + v.total, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto w-full space-y-8">

      {/* ── Encabezado de Perfil ─────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <User className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display-lg text-on-background">{user?.nombre || 'Mi Perfil'}</h1>
          <p className="text-on-surface-variant text-sm mt-0.5">{user?.email} · <span className="text-primary font-semibold capitalize">{user?.rol?.toLowerCase()}</span></p>
        </div>
      </div>

      {/* ── Estadísticas Rápidas del Cajero ─────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-outline/10 rounded-2xl p-4 flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 text-primary shrink-0" />
          <div>
            <div className="text-2xl font-black font-mono text-primary">{totalVentas}</div>
            <div className="text-xs text-outline font-label-sm">Ventas Realizadas</div>
          </div>
        </div>
        <div className="bg-surface border border-outline/10 rounded-2xl p-4 flex items-center gap-3">
          <Banknote className="w-8 h-8 text-success shrink-0" />
          <div>
            <div className="text-2xl font-black font-mono text-primary">${montoTotalVendido.toFixed(2)}</div>
            <div className="text-xs text-outline font-label-sm">Monto Total Vendido</div>
          </div>
        </div>
      </div>

      {/* ── Datos Personales ─────────────────────────────────────── */}
      <div className="bg-surface border border-outline/10 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-lg text-on-background mb-5 font-headline-md">Datos Personales</h2>
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="perfil-nombre">Nombre completo</Label>
            <Input
              id="perfil-nombre"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="perfil-email">Correo Electrónico</Label>
            <Input
              id="perfil-email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="pt-4 mt-4 border-t border-outline/10">
            <h3 className="font-semibold text-base mb-4 text-on-background">Cambiar Contraseña</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="perfil-password" className="text-xs text-on-surface-variant">Nueva Contraseña (opcional)</Label>
                <div className="relative">
                  <Input
                    id="perfil-password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Dejar en blanco para no cambiar"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="perfil-confirmPassword" className="text-xs text-on-surface-variant">Confirmar Contraseña</Label>
                <div className="relative">
                  <Input
                    id="perfil-confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required={formData.password.length > 0}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Repite la nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Log de Ventas del Usuario ─────────────────────────────── */}
      <div className="bg-surface border border-outline/10 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-lg text-on-background font-headline-md flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Mis Ventas Realizadas
            </h2>
            <p className="text-xs text-outline font-label-sm mt-0.5">
              Historial de las últimas 50 transacciones procesadas
            </p>
          </div>
          {!isLoadingVentas && (
            <span className="text-xs font-bold text-outline spatial-glass px-3 py-1 rounded-full border border-outline/20 font-label-sm">
              {ventas.length} registros
            </span>
          )}
        </div>

        {isLoadingVentas ? (
          <div className="flex items-center justify-center py-12 gap-3 text-outline">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-body-md">Cargando historial de ventas...</span>
          </div>
        ) : ventas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-outline gap-3">
            <ShoppingBag className="w-12 h-12 opacity-30" />
            <p className="text-sm font-body-md">Aún no has procesado ninguna venta en el sistema.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ventas.map((venta) => (
              <VentaRow key={venta.id} venta={venta} />
            ))}
          </div>
        )}
      </div>

      {/* ── Historial de Actividad del Usuario ─────────────────────── */}
      <div className="bg-surface border border-outline/10 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-lg text-on-background font-headline-md flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Historial de Actividad
            </h2>
            <p className="text-xs text-outline font-label-sm mt-0.5">
              Inicios de sesión, ventas, cortes y otras acciones clave en la plataforma
            </p>
          </div>
          {!isLoadingActividad && (
            <span className="text-xs font-bold text-outline spatial-glass px-3 py-1 rounded-full border border-outline/20 font-label-sm">
              {actividad.length} registros
            </span>
          )}
        </div>

        {isLoadingActividad ? (
          <div className="flex items-center justify-center py-12 gap-3 text-outline">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-body-md">Cargando actividad...</span>
          </div>
        ) : actividad.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-outline gap-3">
            <History className="w-12 h-12 opacity-30" />
            <p className="text-sm font-body-md">Aún no hay actividad registrada para tu cuenta.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actividad.map((log) => {
              const etiqueta = ACCION_LABEL[log.accion] || log.accion;
              const estiloSeveridad =
                SEVERIDAD_STYLE[log.severidad] || 'bg-outline/10 text-on-surface-variant border-outline/20';
              return (
                <div
                  key={log.id}
                  className="border border-outline/20 rounded-2xl px-4 py-3 flex items-start justify-between gap-4 bg-surface-container-low"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border font-label-sm shrink-0 ${estiloSeveridad}`}>
                      {log.severidad === 'warning'
                        ? 'Advertencia'
                        : log.severidad === 'critical'
                          ? 'Crítico'
                          : 'Info'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-on-surface">{etiqueta}</div>
                      <div className="text-[11px] text-outline font-label-sm truncate">
                        {resumirDetalles(log.accion, log.detalles)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-outline font-label-sm shrink-0 text-right">
                    {formatearFecha(log.fechaHora)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
