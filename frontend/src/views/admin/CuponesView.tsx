import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Percent,
  Banknote,
  BadgePercent,
  RefreshCw,
} from 'lucide-react';
import axios from 'axios';

type TipoDescuento = 'PORCENTAJE' | 'MONTO_FIJO';

interface Cupon {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipoDescuento: TipoDescuento;
  valorDescuento: number;
  montoMinimoCompra?: number | null;
  soloClientesRegistrados: boolean;
  limiteUsosTotal?: number | null;
  limiteUsosPorCliente?: number | null;
  fechaInicio: string;
  fechaFin?: string | null;
  activo: boolean;
  creadoEn: string;
  _count?: { redenciones: number };
}

interface CuponForm {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipoDescuento: TipoDescuento;
  valorDescuento: string;
  montoMinimoCompra: string;
  soloClientesRegistrados: boolean;
  limiteUsosTotal: string;
  limiteUsosPorCliente: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

const VACIO: CuponForm = {
  codigo: '',
  nombre: '',
  descripcion: '',
  tipoDescuento: 'PORCENTAJE',
  valorDescuento: '',
  montoMinimoCompra: '',
  soloClientesRegistrados: false,
  limiteUsosTotal: '',
  limiteUsosPorCliente: '',
  fechaInicio: '',
  fechaFin: '',
  activo: true,
};

const fmtMoneda = (v: number) =>
  v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

function aYYYYMMDD(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function CuponesView() {
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Cupon | null>(null);
  const [form, setForm] = useState<CuponForm>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const fetchCupones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/coupons', {
        params: { search: search || undefined, incluirInactivos: 'true' },
      });
      setCupones(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error('Error al cargar los cupones');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCupones();
  }, [fetchCupones]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(VACIO);
    setModalOpen(true);
  };

  const abrirEditar = (c: Cupon) => {
    setEditando(c);
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      descripcion: c.descripcion || '',
      tipoDescuento: c.tipoDescuento,
      valorDescuento: String(c.valorDescuento),
      montoMinimoCompra: c.montoMinimoCompra != null ? String(c.montoMinimoCompra) : '',
      soloClientesRegistrados: c.soloClientesRegistrados,
      limiteUsosTotal: c.limiteUsosTotal != null ? String(c.limiteUsosTotal) : '',
      limiteUsosPorCliente: c.limiteUsosPorCliente != null ? String(c.limiteUsosPorCliente) : '',
      fechaInicio: aYYYYMMDD(c.fechaInicio),
      fechaFin: aYYYYMMDD(c.fechaFin),
      activo: c.activo,
    });
    setModalOpen(true);
  };

  const set = (k: keyof CuponForm, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        tipoDescuento: form.tipoDescuento,
        valorDescuento: parseFloat(form.valorDescuento) || 0,
        soloClientesRegistrados: form.soloClientesRegistrados,
        activo: form.activo,
      };
      if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim();
      const min = form.montoMinimoCompra
        ? parseFloat(form.montoMinimoCompra)
        : null;
      const limTotal = form.limiteUsosTotal
        ? parseInt(form.limiteUsosTotal, 10)
        : null;
      const limCli = form.limiteUsosPorCliente
        ? parseInt(form.limiteUsosPorCliente, 10)
        : null;
      if (min) payload.montoMinimoCompra = min;
      if (limTotal) payload.limiteUsosTotal = limTotal;
      if (limCli) payload.limiteUsosPorCliente = limCli;
      if (form.fechaInicio) payload.fechaInicio = new Date(form.fechaInicio).toISOString();
      if (form.fechaFin) payload.fechaFin = new Date(form.fechaFin).toISOString();

      if (editando) {
        await api.patch(`/coupons/${editando.id}`, payload);
        toast.success('Cupón actualizado');
      } else {
        await api.post('/coupons', payload);
        toast.success('Cupón creado');
      }
      setModalOpen(false);
      fetchCupones();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const msg = Array.isArray(err.response?.data?.message)
          ? err.response.data.message[0]
          : err.response?.data?.message;
        toast.error(msg || 'Error al guardar el cupón');
      } else {
        toast.error('Error al guardar el cupón');
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (c: Cupon) => {
    setEliminandoId(c.id);
    try {
      await api.delete(`/coupons/${c.id}`);
      toast.success(`Cupón ${c.codigo} desactivado`);
      fetchCupones();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || 'Error al desactivar el cupón',
        );
      } else {
        toast.error('Error al desactivar el cupón');
      }
    } finally {
      setEliminandoId(null);
    }
  };

  const renderValor = (c: Cupon) =>
    c.tipoDescuento === 'PORCENTAJE'
      ? `${c.valorDescuento}%`
      : fmtMoneda(c.valorDescuento);

  const renderUsos = (c: Cupon) => {
    const usados = c._count?.redenciones ?? 0;
    if (c.limiteUsosTotal == null) return `${usados} usados`;
    return `${usados} / ${c.limiteUsosTotal}`;
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display-lg font-bold text-primary">
            Cupones de descuento
          </h1>
          <p className="text-sm text-on-surface-variant font-body-md">
            Crea y administra cupones por porcentaje o monto fijo, con límites de uso y vigencia.
          </p>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="w-4 h-4" />
          Nuevo cupón
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código o nombre..."
          className="max-w-sm"
        />
        <Button variant="outline" onClick={fetchCupones} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-12 text-center text-on-surface-variant font-body-md">
          Cargando cupones...
        </div>
      ) : cupones.length === 0 ? (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-12 text-center text-on-surface-variant font-body-md flex flex-col items-center gap-2">
          <BadgePercent className="w-8 h-8 text-outline" />
          No hay cupones. Crea el primero.
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-on-surface/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-on-surface/10 text-left text-xs uppercase tracking-wider text-outline font-label-sm">
                <th className="px-4 py-3">Cupón</th>
                <th className="px-4 py-3">Descuento</th>
                <th className="px-4 py-3">Condiciones</th>
                <th className="px-4 py-3 text-right">Usos</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cupones.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-on-surface/5 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-primary">
                      <span className="font-mono">{c.codigo}</span>
                    </div>
                    <div className="text-sm text-on-surface">{c.nombre}</div>
                    {c.descripcion && (
                      <div className="text-xs text-on-surface-variant">
                        {c.descripcion}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={c.tipoDescuento === 'PORCENTAJE' ? 'default' : 'secondary'}
                      className="gap-1"
                    >
                      {c.tipoDescuento === 'PORCENTAJE' ? (
                        <Percent className="w-3 h-3" />
                      ) : (
                        <Banknote className="w-3 h-3" />
                      )}
                      {renderValor(c)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {c.montoMinimoCompra != null && (
                      <div>Mínimo {fmtMoneda(c.montoMinimoCompra)}</div>
                    )}
                    {c.soloClientesRegistrados && <div>Solo clientes</div>}
                    {c.limiteUsosPorCliente != null && (
                      <div>{c.limiteUsosPorCliente} por cliente</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {renderUsos(c)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>Desde {aYYYYMMDD(c.fechaInicio) || '—'}</div>
                    {c.fechaFin && <div>Hasta {aYYYYMMDD(c.fechaFin)}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={c.activo ? 'default' : 'destructive'}
                      className="gap-1"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.activo ? 'bg-success' : 'bg-error'
                        }`}
                      />
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirEditar(c)}
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleEliminar(c)}
                        disabled={eliminandoId === c.id}
                      >
                        <Trash2 className="w-4 h-4" />
                        {eliminandoId === c.id ? '...' : ''}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-on-surface/10 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>
                {editando ? 'Editar cupón' : 'Nuevo cupón'}
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleGuardar} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Código *
                  </Label>
                  <Input
                    value={form.codigo}
                    onChange={(e) => set('codigo', e.target.value.toUpperCase())}
                    placeholder="Ej. VERANO2026"
                    required
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Nombre *
                  </Label>
                  <Input
                    value={form.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    placeholder="Ej. Verano 2026"
                    required
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-primary">
                  Descripción
                </Label>
                <Input
                  value={form.descripcion}
                  onChange={(e) => set('descripcion', e.target.value)}
                  placeholder="Opcional"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Tipo de descuento
                  </Label>
                  <select
                    value={form.tipoDescuento}
                    onChange={(e) =>
                      set('tipoDescuento', e.target.value as TipoDescuento)
                    }
                    className="mt-1.5 w-full px-3 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
                  >
                    <option value="PORCENTAJE">Porcentaje (%)</option>
                    <option value="MONTO_FIJO">Monto fijo ($)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    {form.tipoDescuento === 'PORCENTAJE'
                      ? 'Valor (%)'
                      : 'Valor ($)'}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.valorDescuento}
                    onChange={(e) => set('valorDescuento', e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Monto mínimo de compra ($)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.montoMinimoCompra}
                    onChange={(e) => set('montoMinimoCompra', e.target.value)}
                    placeholder="Opcional"
                    className="mt-1.5"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
                    <Switch
                      checked={form.soloClientesRegistrados}
                      onCheckedChange={(v) =>
                        set('soloClientesRegistrados', Boolean(v))
                      }
                    />
                    Solo clientes registrados
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Límite de usos total
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.limiteUsosTotal}
                    onChange={(e) => set('limiteUsosTotal', e.target.value)}
                    placeholder="Ilimitado"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Límite por cliente
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.limiteUsosPorCliente}
                    onChange={(e) => set('limiteUsosPorCliente', e.target.value)}
                    placeholder="Ilimitado"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Fecha de inicio *
                  </Label>
                  <Input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => set('fechaInicio', e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Fecha de fin
                  </Label>
                  <Input
                    type="date"
                    value={form.fechaFin}
                    onChange={(e) => set('fechaFin', e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
                <Switch
                  checked={form.activo}
                  onCheckedChange={(v) => set('activo', Boolean(v))}
                />
                Cupón activo
              </label>
            </div>

            <div className="px-6 py-4 border-t border-on-surface/10 bg-surface-variant/30 flex justify-end gap-3 flex-shrink-0">
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando}>
                  {guardando
                    ? 'Guardando...'
                    : editando
                      ? 'Guardar cambios'
                      : 'Crear cupón'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
