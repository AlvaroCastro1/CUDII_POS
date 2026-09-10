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
  PowerOff,
  Percent,
  Banknote,
  Gift,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import axios from 'axios';
import type { ComboConResumen, TipoPrecioCombo } from '@/types/pos';
import { BuscadorEstandar } from '@/components/ui/BuscadorEstandar';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';

interface ProductoResultado {
  id: string;
  nombre: string;
  precioVentaBase: number;
  codigoBarras: string;
}

interface LineaComboEdit {
  productoId: string;
  nombre: string;
  precioVentaBase: number;
  cantidad: string;
}

interface ComboForm {
  nombre: string;
  descripcion: string;
  tipoPrecio: TipoPrecioCombo;
  valorPrecio: string;
  activo: boolean;
  fechaInicio: string;
  fechaFin: string;
  productos: LineaComboEdit[];
}

const VACIO: ComboForm = {
  nombre: '',
  descripcion: '',
  tipoPrecio: 'MONTO_FIJO',
  valorPrecio: '',
  activo: true,
  fechaInicio: '',
  fechaFin: '',
  productos: [],
};

const fmtMoneda = (v: number) =>
  v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

function aYYYYMMDD(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function CombosView() {
  const [combos, setCombos] = useState<ComboConResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(20);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<ComboConResumen | null>(null);
  const [form, setForm] = useState<ComboForm>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Búsqueda de productos en el modal
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultadosProductos, setResultadosProductos] = useState<
    { id: string; nombre: string; precioVentaBase: number; codigoBarras: string }[]
  >([]);
  const [buscandoProducto, setBuscandoProducto] = useState(false);

  const fetchCombos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/combos', {
        params: { page, limit, search: search || undefined, incluirInactivos: 'true' },
      });
      setCombos(Array.isArray(res.data?.data) ? res.data.data : []);
      if (res.data?.meta) setMeta(res.data.meta);
    } catch {
      toast.error('Error al cargar los combos');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, setMeta]);

  useEffect(() => {
    fetchCombos();
  }, [fetchCombos]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(VACIO);
    setErrorForm(null);
    setResultadosProductos([]);
    setBusquedaProducto('');
    setModalOpen(true);
  };

  const abrirEditar = (c: ComboConResumen) => {
    setEditando(c);
    setForm({
      nombre: c.nombre,
      descripcion: c.descripcion || '',
      tipoPrecio: c.tipoPrecio,
      valorPrecio: String(c.valorPrecio),
      activo: c.activo,
      fechaInicio: aYYYYMMDD(c.fechaInicio),
      fechaFin: aYYYYMMDD(c.fechaFin),
      productos: c.productos.map((p) => ({
        productoId: p.productoId,
        nombre: p.producto?.nombre ?? '',
        precioVentaBase: p.producto?.precioVentaBase ?? 0,
        cantidad: String(p.cantidad),
      })),
    });
    setErrorForm(null);
    setResultadosProductos([]);
    setBusquedaProducto('');
    setModalOpen(true);
  };

  const set = (k: keyof ComboForm, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Búsqueda de productos para agregar al combo (debounce)
  useEffect(() => {
    if (!modalOpen || busquedaProducto.trim().length < 2) {
      setResultadosProductos([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscandoProducto(true);
      try {
        const res = await api.get('/products/search', {
          params: { q: busquedaProducto.trim() },
        });
        const list =
          Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
              ? res.data.data
              : [];
        setResultadosProductos(
          (list as ProductoResultado[])
            .filter(
              (p: ProductoResultado) =>
                !form.productos.some((linea) => linea.productoId === p.id),
            )
            .slice(0, 8)
            .map((p: ProductoResultado) => ({
              id: p.id,
              nombre: p.nombre,
              precioVentaBase: p.precioVentaBase,
              codigoBarras: p.codigoBarras,
            })),
        );
      } catch {
        setResultadosProductos([]);
      } finally {
        setBuscandoProducto(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busquedaProducto, modalOpen, form.productos]);

  const agregarProducto = (p: {
    id: string;
    nombre: string;
    precioVentaBase: number;
  }) => {
    setForm((f) => ({
      ...f,
      productos: [
        ...f.productos,
        {
          productoId: p.id,
          nombre: p.nombre,
          precioVentaBase: p.precioVentaBase,
          cantidad: '1',
        },
      ],
    }));
    setBusquedaProducto('');
    setResultadosProductos([]);
  };

  const cambiarCantidadLinea = (productoId: string, cantidad: string) => {
    setForm((f) => ({
      ...f,
      productos: f.productos.map((l) =>
        l.productoId === productoId ? { ...l, cantidad } : l,
      ),
    }));
  };

  const quitarLinea = (productoId: string) => {
    setForm((f) => ({
      ...f,
      productos: f.productos.filter((l) => l.productoId !== productoId),
    }));
  };

  const totalOriginalForm = r2(
    form.productos.reduce(
      (acc, l) => acc + (l.precioVentaBase * (parseFloat(l.cantidad) || 0)),
      0,
    ),
  );
  const valorPrecioNum = parseFloat(form.valorPrecio) || 0;
  const precioComboForm = r2(
    form.tipoPrecio === 'MONTO_FIJO'
      ? Math.min(valorPrecioNum, totalOriginalForm || Infinity)
      : totalOriginalForm * (1 - valorPrecioNum / 100),
  );
  const ahorroForm = r2(Math.max(totalOriginalForm - precioComboForm, 0));

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    if (form.productos.length === 0) {
      setErrorForm('El combo debe incluir al menos un producto');
      return;
    }
    if (
      form.productos.some(
        (l) => !l.cantidad || parseFloat(l.cantidad) <= 0,
      )
    ) {
      setErrorForm('La cantidad de cada producto debe ser mayor a cero');
      return;
    }
    if (form.tipoPrecio === 'MONTO_FIJO' && valorPrecioNum >= totalOriginalForm) {
      setErrorForm(
        `El precio del combo debe ser menor a la suma de sus productos (${fmtMoneda(totalOriginalForm)}) para generar un ahorro real`,
      );
      return;
    }
    if (form.tipoPrecio === 'DESCUENTO_PCT' && (valorPrecioNum <= 0 || valorPrecioNum > 90)) {
      setErrorForm('El porcentaje de descuento debe estar entre 1 y 90');
      return;
    }
    if (
      form.fechaInicio &&
      form.fechaFin &&
      new Date(form.fechaFin) < new Date(form.fechaInicio)
    ) {
      setErrorForm('La fecha de fin no puede ser anterior a la de inicio');
      return;
    }

    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        tipoPrecio: form.tipoPrecio,
        valorPrecio: valorPrecioNum,
        activo: form.activo,
        productos: form.productos.map((l) => ({
          productoId: l.productoId,
          cantidad: parseFloat(l.cantidad),
        })),
      };
      if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim();
      if (form.fechaInicio) payload.fechaInicio = new Date(form.fechaInicio).toISOString();
      if (form.fechaFin) payload.fechaFin = new Date(form.fechaFin).toISOString();

      if (editando) {
        await api.patch(`/combos/${editando.id}`, payload);
        toast.success('Combo actualizado');
      } else {
        await api.post('/combos', payload);
        toast.success('Combo creado');
      }
      setModalOpen(false);
      fetchCombos();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const msg = Array.isArray(err.response?.data?.message)
          ? err.response.data.message[0]
          : err.response?.data?.message;
        setErrorForm(msg || 'Error al guardar el combo');
      } else {
        setErrorForm('Error al guardar el combo');
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (c: ComboConResumen) => {
    setEliminandoId(c.id);
    try {
      await api.delete(`/combos/${c.id}`);
      toast.success(`Combo "${c.nombre}" desactivado`);
      fetchCombos();
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || 'Error al desactivar el combo',
        );
      } else {
        toast.error('Error al desactivar el combo');
      }
    } finally {
      setEliminandoId(null);
    }
  };

  const esVigente = (c: ComboConResumen) => {
    const ahora = new Date();
    if (!c.activo) return false;
    if (c.fechaInicio && ahora < new Date(c.fechaInicio)) return false;
    if (c.fechaFin && ahora > new Date(c.fechaFin)) return false;
    return true;
  };

  const renderValor = (c: ComboConResumen) =>
    c.tipoPrecio === 'MONTO_FIJO'
      ? `$${c.valorPrecio.toFixed(2)}`
      : `${c.valorPrecio}% dcto.`;

  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroVigencia, setFiltroVigencia] = useState<string>('todos');

  const combosFiltrados = useCallback(() => {
    let lista = [...combos];
    if (!incluirInactivos) {
      lista = lista.filter((c) => c.activo);
    }

    if (filtroTipo !== 'todos') {
      lista = lista.filter((c) => c.tipoPrecio === filtroTipo);
    }

    if (filtroVigencia === 'vigentes') {
      const hoy = new Date().toISOString().split('T')[0];
      lista = lista.filter((c) => {
        const inicio = aYYYYMMDD(c.fechaInicio);
        const fin = aYYYYMMDD(c.fechaFin);
        if (inicio && inicio > hoy) return false;
        if (fin && fin < hoy) return false;
        return true;
      });
    } else if (filtroVigencia === 'vencidos') {
      const hoy = new Date().toISOString().split('T')[0];
      lista = lista.filter((c) => {
        const fin = aYYYYMMDD(c.fechaFin);
        return fin && fin < hoy;
      });
    }

    return lista;
  }, [combos, incluirInactivos, filtroTipo, filtroVigencia]);

  const listaFinalCombos = combosFiltrados();

  const limpiarFiltros = () => {
    setSearch('');
    setIncluirInactivos(false);
    setFiltroTipo('todos');
    setFiltroVigencia('todos');
    reiniciar();
  };

  const filtrosActivosCount =
    (filtroTipo !== 'todos' ? 1 : 0) + (filtroVigencia !== 'todos' ? 1 : 0);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display-lg font-bold text-primary">
            Combos y paquetes
          </h1>
          <p className="text-sm text-on-surface-variant font-body-md">
            Agrupa productos en promociones de precio fijo o porcentaje de descuento, visibles en el POS.
          </p>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="w-4 h-4" />
          Nuevo combo
        </Button>
      </div>

      <BuscadorEstandar
        busqueda={search}
        onBusquedaChange={(val) => {
          setSearch(val);
          reiniciar();
        }}
        placeholder="Buscar por nombre o descripción..."
        switchInactivos={{
          checked: incluirInactivos,
          onCheckedChange: (checked) => {
            setIncluirInactivos(checked);
            reiniciar();
          },
          label: 'Mostrar inactivos / vencidos',
        }}
        onActualizar={fetchCombos}
        cargando={loading}
        onLimpiar={limpiarFiltros}
        filtrosActivosCount={filtrosActivosCount}
        filtrosRapidos={
          <>
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-on-surface-variant font-medium">Tipo de Precio</span>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="h-9 bg-surface-container-low border border-outline/20 rounded-xl px-3 text-xs focus:border-primary focus:outline-none text-on-surface"
              >
                <option value="todos">Todos los tipos</option>
                <option value="MONTO_FIJO">Monto Fijo ($)</option>
                <option value="DESCUENTO_PCT">Porcentaje (% Dcto)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="text-on-surface-variant font-medium">Vigencia</span>
              <select
                value={filtroVigencia}
                onChange={(e) => setFiltroVigencia(e.target.value)}
                className="h-9 bg-surface-container-low border border-outline/20 rounded-xl px-3 text-xs focus:border-primary focus:outline-none text-on-surface"
              >
                <option value="todos">Todas las vigencias</option>
                <option value="vigentes">Solo vigentes hoy</option>
                <option value="vencidos">Solo vencidos</option>
              </select>
            </div>
          </>
        }
      />

      {loading ? (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-12 text-center text-on-surface-variant font-body-md">
          Cargando combos...
        </div>
      ) : listaFinalCombos.length === 0 ? (
        <div className="bg-surface rounded-xl border border-on-surface/10 p-12 text-center text-on-surface-variant font-body-md flex flex-col items-center gap-2">
          <Gift className="w-8 h-8 text-outline" />
          No hay combos para los filtros seleccionados.
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-on-surface/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-on-surface/10 text-left text-xs uppercase tracking-wider text-outline font-label-sm">
                <th className="px-4 py-3">Combo</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3 text-right">Ahorro</th>
                <th className="px-4 py-3">Contenido</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listaFinalCombos.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-on-surface/5 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                        <Gift className="w-3.5 h-3.5 text-primary" />
                      </span>
                      <div>
                        <div className="font-semibold text-primary">{c.nombre}</div>
                        <div className="text-xs text-on-surface-variant">
                          {c.descripcion || '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-primary">
                      ${c.resumen.precioCombo.toFixed(2)}
                    </div>
                    <div className="text-xs text-on-surface-variant line-through font-mono">
                      ${c.resumen.precioOriginal.toFixed(2)}
                    </div>
                    <Badge
                      variant={c.tipoPrecio === 'MONTO_FIJO' ? 'default' : 'secondary'}
                      className="gap-1 mt-0.5"
                    >
                      {c.tipoPrecio === 'MONTO_FIJO' ? (
                        <Banknote className="w-3 h-3" />
                      ) : (
                        <Percent className="w-3 h-3" />
                      )}
                      {renderValor(c)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-success font-semibold">
                    -${c.resumen.ahorro.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant max-w-[220px]">
                    {c.productos
                      .map(
                        (p) =>
                          `${p.cantidad} × ${p.producto?.nombre ?? ''}`,
                      )
                      .join(' · ')}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>Desde {aYYYYMMDD(c.fechaInicio) || '—'}</div>
                    {c.fechaFin && <div>Hasta {aYYYYMMDD(c.fechaFin)}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-label-sm px-2.5 py-1 rounded-full ${
                      esVigente(c)
                        ? 'bg-success/10 text-success'
                        : c.activo
                          ? 'bg-warning/10 text-warning'
                          : 'bg-error/10 text-error'
                    }`}>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          esVigente(c) ? 'bg-success' : c.activo ? 'bg-warning' : 'bg-error'
                        }`}
                      />
                      {esVigente(c)
                        ? 'Vigente'
                        : c.activo
                          ? 'Fuera de vigencia'
                          : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Editar combo"
                        onClick={() => abrirEditar(c)}
                      >
                        <Pencil className="w-4 h-4 text-on-surface-variant" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Desactivar combo"
                        onClick={() => handleDesactivar(c)}
                        disabled={eliminandoId === c.id}
                      >
                        <PowerOff className="w-4 h-4 text-warning" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-on-surface/10 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>
                {editando ? 'Editar combo' : 'Nuevo combo'}
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleGuardar} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
              {errorForm && (
                <div className="flex items-start gap-2 p-2.5 bg-error/10 border border-error/30 rounded-xl text-error text-xs font-label-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorForm}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Nombre *
                  </Label>
                  <Input
                    value={form.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    placeholder="Ej. Combo Desayuno"
                    required
                    className="mt-1.5"
                  />
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
              </div>

              <div>
                <Label className="text-xs font-semibold text-primary">
                  Productos que incluye *
                </Label>
                <div className="mt-1.5 relative">
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 w-4 h-4 text-outline" />
                    <Input
                      value={busquedaProducto}
                      onChange={(e) => setBusquedaProducto(e.target.value)}
                      placeholder="Buscar producto para agregar al combo..."
                      className="pl-10"
                    />
                  </div>
                  {busquedaProducto.trim().length >= 2 &&
                    (buscandoProducto || resultadosProductos.length > 0) && (
                      <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface border border-outline/20 rounded-xl shadow-xl divide-y divide-outline/20 max-h-52 overflow-y-auto">
                        {buscandoProducto && (
                          <li className="px-3 py-2 text-xs text-on-surface-variant">
                            Buscando...
                          </li>
                        )}
                        {resultadosProductos.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => agregarProducto(p)}
                              className="w-full px-3 py-2 text-left hover:bg-surface-container-high transition-colors flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-on-surface block truncate">
                                  {p.nombre}
                                </span>
                                <span className="text-[11px] text-outline">
                                  {p.codigoBarras}
                                </span>
                              </div>
                              <span className="font-mono text-xs font-semibold text-primary">
                                ${p.precioVentaBase.toFixed(2)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>

                {form.productos.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {form.productos.map((l) => (
                      <div
                        key={l.productoId}
                        className="flex items-center gap-2 p-2.5 bg-surface-container-low border border-outline/10 rounded-xl"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface truncate">
                            {l.nombre}
                          </p>
                          <p className="text-[11px] text-outline font-mono">
                            ${l.precioVentaBase.toFixed(2)} c/u
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            value={l.cantidad}
                            onChange={(e) =>
                              cambiarCantidadLinea(l.productoId, e.target.value)
                            }
                            className="w-20 text-center font-mono"
                            aria-label={`Cantidad de ${l.nombre}`}
                          />
                          <button
                            type="button"
                            onClick={() => quitarLinea(l.productoId)}
                            className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                            aria-label={`Quitar ${l.nombre}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Tipo de precio
                  </Label>
                  <select
                    value={form.tipoPrecio}
                    onChange={(e) =>
                      set('tipoPrecio', e.target.value as TipoPrecioCombo)
                    }
                    className="mt-1.5 w-full px-3 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
                  >
                    <option value="MONTO_FIJO">Precio fijo del paquete ($)</option>
                    <option value="DESCUENTO_PCT">Porcentaje de descuento (%)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    {form.tipoPrecio === 'MONTO_FIJO'
                      ? 'Precio del paquete ($) *'
                      : 'Descuento (%) *'}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max={form.tipoPrecio === 'DESCUENTO_PCT' ? 90 : undefined}
                    step="any"
                    value={form.valorPrecio}
                    onChange={(e) => set('valorPrecio', e.target.value)}
                    required
                    className="mt-1.5 font-mono"
                  />
                </div>
              </div>

              {form.productos.length > 0 && (
                <div className="p-3 rounded-2xl border border-success/30 bg-success/10 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-on-surface-variant font-body-md">
                      Suma individual
                    </div>
                    <div className="font-mono line-through text-on-surface-variant">
                      {fmtMoneda(totalOriginalForm)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-on-surface-variant font-body-md">
                      Pagará el cliente
                    </div>
                    <div className="font-mono font-bold text-primary">
                      {fmtMoneda(precioComboForm)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-success font-label-sm font-semibold">
                      Ahorro
                    </div>
                    <div className="font-mono font-bold text-success">
                      -{fmtMoneda(ahorroForm)}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-primary">
                    Fecha de inicio
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
                Combo activo
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
                      : 'Crear combo'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}