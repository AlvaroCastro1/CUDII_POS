import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Notificacion {
  id: string;
  empresaId: string;
  destinatarioId: string;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'warning' | 'critical';
  evento: string;
  entidadTipo?: string | null;
  entidadId?: string | null;
  leida: boolean;
  fechaHora: string;
}

interface Paginacion {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const ICONO_POR_TIPO = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
} as const;

const COLOR_POR_TIPO = {
  info: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  critical: 'bg-error/10 text-error',
} as const;

const LIMITE_POR_PAGINA = 20;

function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  const hoy = new Date();
  const diffDias = Math.floor((hoy.getTime() - d.getTime()) / 86_400_000);
  if (diffDias === 0) {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 7) {
    return d.toLocaleDateString('es-MX', { weekday: 'long' });
  }
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// ─── Campana de Notificaciones ───────────────────────────────────────────────

export default function NotificationBell() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [soloNoLeidas, setSoloNoLeidas] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCargandoMas, setIsCargandoMas] = useState(false);

  const cargarConteo = useCallback(async () => {
    try {
      const res = await api.get<{ noLeidas: number }>('/notifications/count');
      setNoLeidas(res.data.noLeidas);
    } catch {
      // Polling silencioso: no se interrumpe al usuario.
    }
  }, []);

  const cargarLista = useCallback(
    async (pag: number, solo: boolean) => {
      setIsLoading(true);
      try {
        const res = await api.get<{ data: Notificacion[]; meta: Paginacion }>(
          '/notifications',
          { params: { soloNoLeidas: solo, limit: LIMITE_POR_PAGINA, page: pag } },
        );
        setNotificaciones((prev) =>
          pag === 1 ? res.data.data : [...prev, ...res.data.data],
        );
        setPagina(res.data.meta.page);
        setTotalPaginas(res.data.meta.totalPages);
      } catch {
        setNotificaciones([]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Conteo inicial + polling cada 60s para el badge
  useEffect(() => {
    cargarConteo();
    const intervalo = setInterval(cargarConteo, 60_000);
    return () => clearInterval(intervalo);
  }, [cargarConteo]);

  // Cerrar el dropdown al navegar
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const abrirCampana = () => {
    setIsOpen(true);
    cargarConteo();
    cargarLista(1, soloNoLeidas);
  };

  const cambiarFiltro = (solo: boolean) => {
    setSoloNoLeidas(solo);
    cargarLista(1, solo);
  };

  const marcarLeida = async (id: string) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    );
    setNoLeidas((c) => Math.max(0, c - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // Silencioso: la actualización local ya aplicó.
    }
  };

  const marcarTodasLeidas = async () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    setNoLeidas(0);
    try {
      await api.patch('/notifications/mark-all-read');
    } catch {
      // Silencioso.
    }
  };

  const cargarMas = async () => {
    if (isCargandoMas || pagina >= totalPaginas) return;
    setIsCargandoMas(true);
    try {
      const res = await api.get<{ data: Notificacion[]; meta: Paginacion }>(
        '/notifications',
        { params: { soloNoLeidas, limit: LIMITE_POR_PAGINA, page: pagina + 1 } },
      );
      setNotificaciones((prev) => [...prev, ...res.data.data]);
      setPagina(res.data.meta.page);
      setTotalPaginas(res.data.meta.totalPages);
    } catch {
      // Silencioso.
    } finally {
      setIsCargandoMas(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => (isOpen ? setIsOpen(false) : abrirCampana())}
        className="p-2.5 rounded-full hover:bg-on-surface/5 text-outline transition-colors relative animate-hover animate-press"
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ''}`}
        aria-expanded={isOpen}
      >
        <span className="material-symbols-outlined">notifications</span>
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center border-2 border-background">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop para cerrar al hacer clic fuera */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-[min(380px,calc(100vw-32px))] bg-surface border border-outline/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Encabezado */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline/10">
              <div className="min-w-0">
                <h3 className="font-bold text-on-surface text-sm font-headline-md">
                  Notificaciones
                </h3>
                <p className="text-[11px] text-outline mt-0.5 font-label-sm">
                  {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
                </p>
              </div>
              <button
                onClick={marcarTodasLeidas}
                disabled={noLeidas === 0}
                className="text-[11px] font-label-sm font-semibold text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                Marcar todas como leídas
              </button>
            </div>

            {/* Filtro */}
            <div className="flex gap-1 px-3 pt-3 pb-2">
              <button
                onClick={() => cambiarFiltro(true)}
                className={`px-3 py-1.5 rounded-full text-xs font-label-sm font-semibold transition-colors ${
                  soloNoLeidas
                    ? 'bg-primary/10 text-primary'
                    : 'text-outline hover:bg-on-surface/5'
                }`}
              >
                No leídas
              </button>
              <button
                onClick={() => cambiarFiltro(false)}
                className={`px-3 py-1.5 rounded-full text-xs font-label-sm font-semibold transition-colors ${
                  !soloNoLeidas
                    ? 'bg-primary/10 text-primary'
                    : 'text-outline hover:bg-on-surface/5'
                }`}
              >
                Todas
              </button>
            </div>

            {/* Lista */}
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-outline">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-label-sm">Cargando...</span>
                </div>
              ) : notificaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-outline px-6 text-center">
                  <span className="material-symbols-outlined !text-3xl">
                    notifications_off
                  </span>
                  <p className="text-xs font-headline-md font-semibold text-on-surface-variant">
                    Sin notificaciones
                  </p>
                  <p className="text-[11px] font-label-sm text-outline">
                    {soloNoLeidas
                      ? 'No tienes notificaciones sin leer.'
                      : 'Aún no hay notificaciones.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-outline/5">
                  {notificaciones.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => marcarLeida(n.id)}
                        className={`w-full text-left flex gap-3 px-4 py-3 transition-colors hover:bg-on-surface/5 ${
                          n.leida ? '' : 'bg-primary/5'
                        }`}
                      >
                        <span
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${COLOR_POR_TIPO[n.tipo]}`}
                        >
                          <span className="material-symbols-outlined !text-lg">
                            {ICONO_POR_TIPO[n.tipo]}
                          </span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                          <span
                            className={`text-sm font-headline-md font-semibold truncate ${
                              n.leida
                                ? 'text-on-surface-variant'
                                : 'text-on-surface'
                            }`}
                          >
                            {n.titulo}
                          </span>
                            {!n.leida && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                          </span>
                          <span className="block text-xs font-body-md text-on-surface-variant/80 leading-relaxed mt-0.5 line-clamp-2">
                            {n.mensaje}
                          </span>
                          <span className="block text-[10px] text-outline mt-1 font-label-sm">
                            {formatearFecha(n.fechaHora)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Cargar más */}
            {!isLoading && notificaciones.length > 0 && pagina < totalPaginas && (
              <div className="border-t border-outline/10 p-2">
                <button
                  onClick={cargarMas}
                  disabled={isCargandoMas}
                  className="w-full py-2 rounded-xl text-xs font-label-sm font-semibold text-primary hover:bg-on-surface/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCargandoMas && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Cargar más
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
