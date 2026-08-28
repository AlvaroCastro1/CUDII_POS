import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { History, Loader2, RotateCcw, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const ACCIONES = [
  { valor: '', etiqueta: 'Todas las acciones' },
  { valor: 'APERTURA_CAJA', etiqueta: 'Apertura de caja' },
  { valor: 'RETIRO_PARCIAL', etiqueta: 'Retiro parcial' },
  { valor: 'CORTE_X', etiqueta: 'Corte X' },
  { valor: 'CORTE_Z', etiqueta: 'Corte Z' },
  { valor: 'VENTA_COMPLETADA', etiqueta: 'Venta completada' },
  { valor: 'VENTA_CANCELADA', etiqueta: 'Venta cancelada' },
  { valor: 'DEVOLUCION_REGISTRADA', etiqueta: 'Devolución registrada' },
];

const SEVERIDADES = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'info', etiqueta: 'Info' },
  { valor: 'warning', etiqueta: 'Advertencia' },
  { valor: 'critical', etiqueta: 'Crítica' },
];

const SEVERIDAD_STYLE: Record<string, string> = {
  info: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  critical: 'bg-error/10 text-error border-error/20',
};

const ACCION_LABEL: Record<string, string> = {
  APERTURA_CAJA: 'Apertura de caja',
  RETIRO_PARCIAL: 'Retiro parcial',
  CORTE_X: 'Corte X',
  CORTE_Z: 'Corte Z',
  VENTA_COMPLETADA: 'Venta completada',
  VENTA_CANCELADA: 'Venta cancelada',
  DEVOLUCION_REGISTRADA: 'Devolución registrada',
};

// Campos relevantes por acción para resumir los detalles JSON
function resumirDetalles(accion: string, detalles: Record<string, unknown>): string {
  const d = detalles || {};
  switch (accion) {
    case 'CORTE_Z':
      return [
        d.cajaNombre ? `Caja: ${d.cajaNombre}` : '',
        `Esperado: $${Number(d.montoEsperado ?? 0).toFixed(2)}`,
        `Contado: $${Number(d.montoDeclarado ?? 0).toFixed(2)}`,
        d.tipoDiscrepancia ? `Tipo: ${d.tipoDiscrepancia}` : '',
        d.diferencia !== undefined ? `Dif: $${Number(d.diferencia).toFixed(2)}` : '',
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
        d.metodoPago ? `Pago: ${d.metodoPago}` : '',
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
        d.tipoResolucion ? `Resolución: ${d.tipoResolucion}` : '',
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

function detallesFolio(log: LogActividad): string | null {
  const d = log.detalles || {};
  const folio = d.folio;
  return typeof folio === 'string' && folio ? folio : null;
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditoriaView() {
  const [logs, setLogs] = useState<LogActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState('');
  const [severidad, setSeveridad] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(50);
  const navigate = useNavigate();

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (accion) params.set('accion', accion);
      if (severidad) params.set('severidad', severidad);
      if (fechaInicio) params.set('fechaInicio', fechaInicio);
      if (fechaFin) params.set('fechaFin', fechaFin);

      const res = await api.get(`/audit?${params.toString()}`);
      setLogs(res.data?.datos || res.data?.data || []);
      if (res.data?.meta) setMeta(res.data.meta);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al cargar el historial de actividad');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, accion, severidad, fechaInicio, fechaFin, setMeta]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const limpiarFiltros = () => {
    setAccion('');
    setSeveridad('');
    setFechaInicio('');
    setFechaFin('');
    reiniciar();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <History className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display-lg text-on-background">
            Historial de Actividad
          </h1>
          <p className="text-on-surface-variant text-sm mt-0.5">
            Registro de movimientos sensibles: aperturas, retiros, cortes y ventas.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-surface rounded-xl border border-on-surface/10 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-on-surface-variant">Acción</Label>
            <Select value={accion} onValueChange={(v) => { setAccion(v); reiniciar(); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                {ACCIONES.map((a) => (
                  <SelectItem key={a.valor || 'todas'} value={a.valor}>
                    {a.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-on-surface-variant">Severidad</Label>
            <Select value={severidad} onValueChange={(v) => { setSeveridad(v); reiniciar(); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {SEVERIDADES.map((s) => (
                  <SelectItem key={s.valor || 'todas'} value={s.valor}>
                    {s.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-on-surface-variant">Desde</Label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => { setFechaInicio(e.target.value); reiniciar(); }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-on-surface-variant">Hasta</Label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => { setFechaFin(e.target.value); reiniciar(); }}
            />
          </div>

          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={limpiarFiltros}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-surface rounded-xl border border-on-surface/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Severidad</TableHead>
              <TableHead className="w-1/3">Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-on-surface-variant">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando historial...
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-on-surface-variant">
                  No hay registros de actividad con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-on-surface-variant text-sm">
                    {formatearFecha(log.fechaHora)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {ACCION_LABEL[log.accion] || log.accion}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.usuario?.nombre || '—'}
                    <span className="block text-xs text-on-surface-variant">
                      {log.usuario?.rol?.toLowerCase() || ''}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`whitespace-nowrap ${SEVERIDAD_STYLE[log.severidad] || ''}`}
                    >
                      {log.severidad}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-on-surface-variant">
                    {log.accion === 'VENTA_COMPLETADA' && log.entidadId ? (
                      <button
                        onClick={() => navigate(`/admin/ventas/${log.entidadId}`)}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        title={`Ver detalle de venta ${String(detallesFolio(log) ?? '')}`}
                      >
                        {String(detallesFolio(log) ?? '')}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : log.accion === 'DEVOLUCION_REGISTRADA' &&
                      log.detalles?.ventaId ? (
                      <button
                        onClick={() =>
                          navigate(
                            `/admin/ventas/${String(log.detalles?.ventaId)}`,
                          )
                        }
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        title={`Ver venta original de la devolución`}
                      >
                        {String(detallesFolio(log) ?? '')}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      resumirDetalles(log.accion, log.detalles)
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
      </div>
    </div>
  );
}