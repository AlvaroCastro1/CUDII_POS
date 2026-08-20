import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import axios from 'axios';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, SlidersHorizontal } from 'lucide-react';
import { usePaginacion } from '@/hooks/usePaginacion';
import { PaginacionControles } from '@/components/ui/PaginacionControles';
import { Switch } from '@/components/ui/switch';
import { RecepcionMercanciaModal } from '@/components/admin/RecepcionMercanciaModal';
import type { Lote, VencimientoInfo } from '@/types/pos';

// ============================================================
// Catálogo de motivos de ajuste pre-definidos para el usuario
// ============================================================
const MOTIVOS_ENTRADA = [
  { valor: 'Compra a proveedor', icono: 'local_shipping', desc: 'Mercancía recibida de un proveedor' },
  { valor: 'Devolución de cliente', icono: 'assignment_return', desc: 'Producto devuelto por un cliente' },
  { valor: 'Corrección de inventario', icono: 'rule', desc: 'Corrección tras conteo físico' },
];
const MOTIVOS_SALIDA = [
  { valor: 'Merma o daño', icono: 'broken_image', desc: 'Producto dañado o expirado' },
  { valor: 'Consumo interno', icono: 'coffee', desc: 'Material utilizado por el equipo' },
  { valor: 'Corrección de inventario', icono: 'rule', desc: 'Corrección tras conteo físico' },
  { valor: 'Uso interno', icono: 'storefront', desc: 'Consumido por la empresa internamente' },
];

interface Sucursal {
  id: string;
  nombre: string;
}

interface ProductoBusqueda {
  id: string;
  nombre: string;
  codigoBarras: string;
  codigoInterno?: string;
  unidadMedida: string;
  esGranel: boolean;
  tieneCaducidad?: boolean;
  manejaInventario?: boolean;
  precioCompra?: number;
  estaActivo?: boolean;
}

interface InventarioItem {
  id: string;
  productoId: string;
  sucursalId: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  ultimoMovimiento?: string;
  producto: ProductoBusqueda;
  sucursal: Sucursal;
}

// ============================================================
// Vista principal: Control de Inventario
// ============================================================
export default function InventarioView() {
  const navigate = useNavigate();
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const { page, limit, meta, setMeta, irAPagina, reiniciar } = usePaginacion(20);

  // Recepción de mercancía (GRN)
  const [isRecepcionOpen, setIsRecepcionOpen] = useState(false);

  // Widget de lotes por vencer
  const [vencimientos, setVencimientos] = useState<VencimientoInfo | null>(null);

  // Control del modal de ajuste
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState<'entrada' | 'salida' | ''>('');
  const [paso, setPaso] = useState(1);

  // Estado de búsqueda del modal — lazy, no carga todo el catálogo
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ProductoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Formulario del modal
  const initialForm = {
    productoId: '',
    sucursalId: '',
    cantidad: '',
    motivo: '',
    motivoPersonalizado: '',
    loteId: '',
    esMerma: false,
    motivoMerma: 'otro' as string,
    costoUnitario: '',
    fechaCaducidad: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lotes activos del producto seleccionado (para salidas con lote)
  const [lotesProducto, setLotesProducto] = useState<Lote[]>([]);

  // Derivados
  const productoSeleccionado = resultadosBusqueda.find((p: ProductoBusqueda) => p.id === formData.productoId) 
    || inventario.find((inv: InventarioItem) => inv.productoId === formData.productoId)?.producto;
  
  const stockActual = inventario.find(
    (inv: InventarioItem) => inv.productoId === formData.productoId && inv.sucursalId === formData.sucursalId
  )?.stockActual ?? 0;
  
  const cantidadNum = parseFloat(formData.cantidad) || 0;
  const stockProyectado = tipoAjuste === 'entrada' ? stockActual + cantidadNum : stockActual - cantidadNum;

  // ----------------------------------------------------------------
  // Búsqueda debounced — llama al servidor 300ms después de que
  // el usuario deja de escribir. Máximo 10 resultados.
  // ----------------------------------------------------------------
  const buscarProductos = useCallback(async (termino: string) => {
    try {
      setBuscando(true);
      const res = await api.get(`/products/search?q=${encodeURIComponent(termino)}&limit=10`);
      setResultadosBusqueda(res.data.data || res.data);
    } catch {
      setResultadosBusqueda([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  // Dispara la búsqueda con debounce al cambiar el texto
  const handleBusquedaChange = (valor: string) => {
    setBusquedaProducto(valor);
    // Auto-selección por código de barras exacto
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      buscarProductos(valor);
    }, 300);
  };

  // Limpiar timer al desmontar
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Filtrado local no necesario ya que se hace en backend
  const inventarioFiltrado = inventario;

  // ----------------------------------------------------------------
  // Carga de datos iniciales (solo inventario, NO el catálogo completo)
  // ----------------------------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const resInv = await api.get(`/inventory/stock/all?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&incluirInactivos=${incluirInactivos}`);
      setInventario(resInv.data.data || resInv.data);
      if (resInv.data.meta) setMeta(resInv.data.meta);

      // Intentar cargar sucursales (puede fallar si el endpoint no existe aún)
      try {
        const resSuc = await api.get('/companies/my/sucursales');
        setSucursales(resSuc.data.data || resSuc.data || []);
      } catch {
        setSucursales([]);
      }
    } catch {
      toast.error('Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, setMeta]);

  // ----------------------------------------------------------------
  // Enviar ajuste de stock a la API
  // ----------------------------------------------------------------
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const motivoFinal = formData.motivo === 'otro' ? formData.motivoPersonalizado : formData.motivo;
    if (!motivoFinal) {
      toast.error('Debes especificar el motivo del ajuste');
      return;
    }
    try {
      setIsSubmitting(true);
      const cantidadFinal = tipoAjuste === 'entrada' ? cantidadNum : -cantidadNum;

      await api.post('/inventory/adjust', {
        productoId: formData.productoId,
        sucursalId: formData.sucursalId || '',
        cantidad: cantidadFinal,
        motivo: motivoFinal,
        loteId: formData.loteId || undefined,
        esMerma: tipoAjuste === 'salida' ? formData.esMerma : undefined,
        motivoMerma: formData.esMerma ? formData.motivoMerma : undefined,
        costoUnitario: tipoAjuste === 'entrada' && formData.costoUnitario ? parseFloat(formData.costoUnitario) : undefined,
        fechaCaducidad: tipoAjuste === 'entrada' && formData.fechaCaducidad ? formData.fechaCaducidad : undefined,
      });
      toast.success(`Stock ${tipoAjuste === 'entrada' ? 'ingresado' : 'retirado'} exitosamente`);
      handleCerrarModal();
      fetchData();
      fetchVencimientos();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al registrar ajuste');
      } else {
        toast.error('Error al registrar ajuste');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal preseleccionando un producto/sucursal desde la tabla
  const openAdjustModal = (inv?: InventarioItem) => {
    if (inv) {
      setFormData({ ...initialForm, productoId: inv.productoId, sucursalId: inv.sucursalId });
      // Si viene preseleccionado, no necesitamos resultados de búsqueda
    } else {
      setFormData(initialForm);
    }
    setTipoAjuste('');
    setPaso(1);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
    setIsModalOpen(true);
  };

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setPaso(1);
    setTipoAjuste('');
    setBusquedaProducto('');
    setResultadosBusqueda([]);
    setFormData(initialForm);
  };

  // ----------------------------------------------------------------
  // Widget de vencimientos
  // ----------------------------------------------------------------
  const fetchVencimientos = useCallback(async () => {
    try {
      const res = await api.get('/inventory/vencimientos');
      setVencimientos(res.data);
    } catch {
      setVencimientos(null);
    }
  }, []);

  // Cargar lotes activos cuando se selecciona un producto para salida
  useEffect(() => {
    if (tipoAjuste !== 'salida' || !formData.productoId) {
      setLotesProducto([]);
      return;
    }
    let activo = true;
    const sucursalResuelta =
      formData.sucursalId || sucursales[0]?.id || '';
    api
      .get('/inventory/lotes', {
        params: {
          productoId: formData.productoId,
          estado: 'activo',
          sucursalId: sucursalResuelta || undefined,
          limit: 50,
        },
      })
      .then((res) => {
        if (!activo) return;
        setLotesProducto((res.data.data || []).filter((l: Lote) => l.cantidadRestante > 0));
      })
      .catch(() => {
        if (activo) setLotesProducto([]);
      });
    return () => {
      activo = false;
    };
  }, [tipoAjuste, formData.productoId, formData.sucursalId, sucursales]);

  useEffect(() => {
    fetchData();
    fetchVencimientos();
  }, [fetchData, fetchVencimientos]);

  const motivosActuales = tipoAjuste === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;

  return (
    <div className="p-6">

      {/* ===================== ENCABEZADO ===================== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display-lg text-on-background">Stock por Producto</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Consulta el inventario actual, recepciones y ajustes de stock.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsRecepcionOpen(true)}>
            <span className="material-symbols-outlined mr-2 !text-[18px]">move_to_inbox</span>
            Recepción de Mercancía
          </Button>
          <Button onClick={() => openAdjustModal()}>
            <SlidersHorizontal className="mr-2 w-4 h-4" />
            Ajuste de Stock
          </Button>
        </div>
      </div>

      {/* ===================== WIDGET LOTES POR VENCER ===================== */}
      {(vencimientos && (vencimientos.porVencer.length > 0 || vencimientos.vencidos.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/lotes')}
            className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3 text-left hover:bg-yellow-500/10 transition-colors"
          >
            <span className="material-symbols-outlined !text-[28px] text-yellow-600">schedule</span>
            <div>
              <p className="text-sm font-bold text-on-surface">
                {vencimientos.porVencer.length} lote{vencimientos.porVencer.length !== 1 ? 's' : ''} por vencer
              </p>
              <p className="text-xs text-on-surface-variant">
                En los próximos {vencimientos.diasPreaviso || 30} días
              </p>
            </div>
            <span className="ml-auto font-bold text-sm text-yellow-600">
              ${(vencimientos.valorPorVencer || 0).toFixed(2)}
            </span>
          </button>
          {vencimientos.vencidos.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/admin/lotes')}
              className="rounded-xl border border-error/30 bg-error/5 p-4 flex items-center gap-3 text-left hover:bg-error/10 transition-colors"
            >
              <span className="material-symbols-outlined !text-[28px] text-error">warning</span>
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {vencimientos.vencidos.length} lote{vencimientos.vencidos.length !== 1 ? 's' : ''} vencido{vencimientos.vencidos.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Registra la merma correspondiente
                </p>
              </div>
              <span className="ml-auto font-bold text-sm text-error">
                ${(vencimientos.valorVencidos || 0).toFixed(2)}
              </span>
            </button>
          )}
        </div>
      )}

      <RecepcionMercanciaModal
        isOpen={isRecepcionOpen}
        onClose={() => setIsRecepcionOpen(false)}
        onSuccess={() => {
          fetchData();
          fetchVencimientos();
        }}
        sucursales={sucursales}
        sucursalDefaultId={sucursales[0]?.id || ''}
      />

      {/* ===================== MODAL DE AJUSTE ===================== */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleCerrarModal(); }}>
        <DialogContent className="sm:max-w-[520px]">
          <form onSubmit={handleAdjustStock} className="flex flex-col flex-1 min-h-0">

            {/* ---- Encabezado fijo (no hace scroll) ---- */}
            <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
              <DialogHeader>
                <DialogTitle>Ajuste de Stock</DialogTitle>
                <p className="text-sm text-on-surface-variant mt-1">
                  Paso {paso} de 3 —{' '}
                  {paso === 1 ? 'Tipo de movimiento' : paso === 2 ? 'Selección de producto' : 'Cantidad y motivo'}
                </p>
                <div className="flex gap-2 mt-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        n <= paso
                          ? tipoAjuste === 'entrada'
                            ? 'bg-success'
                            : tipoAjuste === 'salida'
                            ? 'bg-error'
                            : 'bg-primary'
                          : 'bg-on-surface/10'
                      }`}
                    />
                  ))}
                </div>
              </DialogHeader>
            </div>

            {/* ---- Cuerpo con scroll ---- */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">

              {/* =================== PASO 1: TIPO DE MOVIMIENTO =================== */}
              {paso === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    ¿Qué tipo de movimiento de inventario quieres registrar?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTipoAjuste('entrada')}
                      className={`p-5 rounded-2xl border-2 text-left transition-all duration-150 flex flex-col gap-2 ${
                        tipoAjuste === 'entrada'
                          ? 'border-success bg-success/5'
                          : 'border-outline/30 hover:border-success/50 hover:bg-success/5'
                      }`}
                    >
                      <TrendingUp className={`w-8 h-8 ${tipoAjuste === 'entrada' ? 'text-success' : 'text-on-surface-variant'}`} />
                      <p className={`font-bold text-base ${tipoAjuste === 'entrada' ? 'text-success' : 'text-on-surface'}`}>Entrada</p>
                      <p className="text-xs text-on-surface-variant">Aumenta el stock. Ej: compra de mercancía, devolución.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoAjuste('salida')}
                      className={`p-5 rounded-2xl border-2 text-left transition-all duration-150 flex flex-col gap-2 ${
                        tipoAjuste === 'salida'
                          ? 'border-error bg-error/5'
                          : 'border-outline/30 hover:border-error/50 hover:bg-error/5'
                      }`}
                    >
                      <TrendingDown className={`w-8 h-8 ${tipoAjuste === 'salida' ? 'text-error' : 'text-on-surface-variant'}`} />
                      <p className={`font-bold text-base ${tipoAjuste === 'salida' ? 'text-error' : 'text-on-surface'}`}>Salida</p>
                      <p className="text-xs text-on-surface-variant">Reduce el stock. Ej: merma, robo, corrección.</p>
                    </button>
                  </div>
                </div>
              )}

              {/* =================== PASO 2: PRODUCTO =================== */}
              {paso === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-on-surface-variant">
                    ¿A qué producto le aplicarás este ajuste de{' '}
                    <span className={`font-semibold ${tipoAjuste === 'entrada' ? 'text-success' : 'text-error'}`}>
                      {tipoAjuste}
                    </span>
                    ?
                  </p>

                  {/* Búsqueda por nombre o código de barras */}
                  <div className="grid gap-2">
                    <Label>Buscar producto</Label>
                    <div className="relative">
                      <Input
                        autoFocus
                        value={busquedaProducto}
                        onChange={(e) => handleBusquedaChange(e.target.value)}
                        placeholder="Nombre, SKU o código de barras..."
                      />
                      {buscando && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant animate-pulse">
                          Buscando...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      Escáner de código de barras compatible — se selecciona automáticamente.
                    </p>
                  </div>

                  {/* Lista de resultados del servidor */}
                  <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
                    {!busquedaProducto && !buscando ? (
                      <p className="text-sm text-on-surface-variant text-center py-6">
                        <span className="material-symbols-outlined block !text-[32px] opacity-30 mb-1">search</span>
                        Escribe para buscar un producto
                      </p>
                    ) : buscando ? (
                      <div className="space-y-2 py-2">
                        {[1,2,3].map(n => (
                          <div key={n} className="h-14 rounded-xl bg-on-surface/5 animate-pulse" />
                        ))}
                      </div>
                    ) : resultadosBusqueda.length > 0 ? (
                      resultadosBusqueda.map((prod: ProductoBusqueda) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, productoId: prod.id })}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-center justify-between ${
                            formData.productoId === prod.id
                              ? tipoAjuste === 'entrada'
                                ? 'border-success bg-success/5'
                                : 'border-error bg-error/5'
                              : 'border-outline/30 hover:border-outline hover:bg-surface-variant/50'
                          }`}
                        >
                          <div>
                            <p className={`font-semibold text-sm ${formData.productoId === prod.id ? (tipoAjuste === 'entrada' ? 'text-success' : 'text-error') : 'text-on-surface'}`}>
                              {prod.nombre}
                            </p>
                            <p className="text-xs text-on-surface-variant font-mono">{prod.codigoBarras}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${formData.productoId === prod.id ? (tipoAjuste === 'entrada' ? 'border-success text-success' : 'border-error text-error') : 'border-outline/30 text-on-surface-variant'}`}>
                            {prod.unidadMedida}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-on-surface-variant text-center py-4">Sin resultados</p>
                    )}
                  </div>

                  {/* Si hay varias sucursales, mostrar selector */}
                  {sucursales.length > 1 && (
                    <div className="grid gap-2">
                      <Label>Sucursal <span className="text-error">*</span></Label>
                      <Select
                        value={formData.sucursalId}
                        onValueChange={(v) => setFormData({ ...formData, sucursalId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona la sucursal..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sucursales.map((suc: Sucursal) => (
                            <SelectItem key={suc.id} value={suc.id}>{suc.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Resumen del producto seleccionado */}
                  {productoSeleccionado && (
                    <div className="bg-surface-variant/40 border border-outline/20 rounded-xl p-3 space-y-1">
                      <p className="text-sm font-semibold text-on-surface">{productoSeleccionado.nombre}</p>
                      <p className="text-xs text-on-surface-variant">
                        Unidad: <span className="font-medium">{productoSeleccionado.unidadMedida}</span>
                        {productoSeleccionado.esGranel && <span className="ml-2 text-primary">• A granel</span>}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Stock actual:{' '}
                        <span className="font-bold text-on-surface">{stockActual} {productoSeleccionado.unidadMedida.toLowerCase()}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* =================== PASO 3: CANTIDAD Y MOTIVO =================== */}
              {paso === 3 && (
                <div className="space-y-4">

                  {/* Indicador visual antes/después */}
                  {productoSeleccionado && formData.cantidad && (
                    <div className={`rounded-xl p-4 border flex items-center justify-between ${
                      tipoAjuste === 'entrada'
                        ? 'bg-success/5 border-success/20'
                        : stockProyectado < 0
                        ? 'bg-error/10 border-error/30'
                        : 'bg-error/5 border-error/20'
                    }`}>
                      <div className="text-center">
                        <p className="text-xs text-on-surface-variant">Stock actual</p>
                        <p className="text-2xl font-display-lg font-bold text-on-surface">{stockActual}</p>
                      </div>
                      <span className="material-symbols-outlined !text-[28px] text-on-surface-variant">arrow_forward</span>
                      <div className="text-center">
                        <p className="text-xs text-on-surface-variant">Stock resultante</p>
                        <p className={`text-2xl font-display-lg font-bold ${
                          stockProyectado < 0 ? 'text-error' : tipoAjuste === 'entrada' ? 'text-success' : 'text-orange-500'
                        }`}>
                          {stockProyectado}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="cantidad">
                      Cantidad a {tipoAjuste === 'entrada' ? 'ingresar' : 'retirar'}{' '}
                      {productoSeleccionado && (
                        <span className="text-on-surface-variant font-normal">
                          ({productoSeleccionado.unidadMedida.toLowerCase()})
                        </span>
                      )}
                      <span className="text-error ml-1">*</span>
                    </Label>
                    <Input
                      id="cantidad"
                      type="number"
                      step={productoSeleccionado?.esGranel ? '0.001' : '1'}
                      min={productoSeleccionado?.esGranel ? '0.001' : '1'}
                      required
                      autoFocus
                      value={formData.cantidad}
                      onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                      placeholder={productoSeleccionado?.esGranel ? 'Ej. 2.500' : 'Ej. 12'}
                    />
                    {productoSeleccionado?.esGranel && (
                      <p className="text-xs text-primary">
                        Este producto es a granel — puedes ingresar decimales (ej. 0.350 kg).
                      </p>
                    )}
                  </div>

                  {/* Campos para entradas con trazabilidad */}
                  {tipoAjuste === 'entrada' && productoSeleccionado?.manejaInventario && (
                    <div className="space-y-3 rounded-xl border border-outline/20 p-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined !text-[18px] text-primary">inventory_2</span>
                        <p className="text-sm font-semibold text-primary">Trazabilidad del lote</p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="costoUnitario">Costo unitario</Label>
                        <Input
                          id="costoUnitario"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.costoUnitario}
                          onChange={(e) => setFormData({ ...formData, costoUnitario: e.target.value })}
                          placeholder={productoSeleccionado?.precioCompra?.toString() || '0'}
                        />
                        <p className="text-xs text-on-surface-variant">
                          Se usara el precio de compra del producto si se omite.
                        </p>
                      </div>
                      {productoSeleccionado?.tieneCaducidad && (
                        <div className="grid gap-2">
                          <Label htmlFor="fechaCaducidadEntrada">
                            Fecha de caducidad <span className="text-error">*</span>
                          </Label>
                          <Input
                            id="fechaCaducidadEntrada"
                            type="date"
                            value={formData.fechaCaducidad}
                            onChange={(e) => setFormData({ ...formData, fechaCaducidad: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lote y merma para salidas */}
                  {tipoAjuste === 'salida' && productoSeleccionado?.manejaInventario && (
                    <div className="space-y-3 rounded-xl border border-outline/20 p-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined !text-[18px] text-primary">inventory_2</span>
                        <p className="text-sm font-semibold text-primary">Control por lote</p>
                      </div>
                      <div className="grid gap-2">
                        <Label>Lote a descontar</Label>
                        <Select
                          value={formData.loteId}
                          onValueChange={(v) => setFormData({ ...formData, loteId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={lotesProducto.length > 0 ? 'Selecciona el lote (o FEFO automático)' : 'Sin lotes activos disponibles'} />
                          </SelectTrigger>
                          <SelectContent>
                            {lotesProducto.map((lote) => (
                              <SelectItem key={lote.id} value={lote.id}>
                                {lote.codigoLote} — {lote.cantidadRestante} disp.
                                {lote.fechaCaducidad ? ` · vence ${new Date(lote.fechaCaducidad).toLocaleDateString()}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-on-surface-variant">
                          Si no eliges lote, el sistema usa la rotación del producto (FEFO/FIFO).
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-on-surface">Registrar como merma</p>
                          <p className="text-xs text-on-surface-variant">
                            Marca esta opción para caducidad, daño, robo o pérdida.
                          </p>
                        </div>
                        <Switch
                          checked={formData.esMerma}
                          onCheckedChange={(checked: boolean) =>
                            setFormData({ ...formData, esMerma: checked })
                          }
                        />
                      </div>
                      {formData.esMerma && (
                        <div className="grid gap-2">
                          <Label className="text-xs">Motivo de la merma</Label>
                          <Select
                            value={formData.motivoMerma}
                            onValueChange={(v) => setFormData({ ...formData, motivoMerma: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="caducado">Caducado</SelectItem>
                              <SelectItem value="danado">Dañado</SelectItem>
                              <SelectItem value="robo">Robo / Hurto</SelectItem>
                              <SelectItem value="perdida">Pérdida</SelectItem>
                              <SelectItem value="error">Error de captura</SelectItem>
                              <SelectItem value="otro">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Motivo del ajuste <span className="text-error">*</span></Label>
                    <p className="text-xs text-on-surface-variant -mt-1">
                      Queda registrado en el historial de movimientos.
                    </p>
                    <div className="grid gap-2">
                      {motivosActuales.map((m) => (
                        <button
                          key={m.valor}
                          type="button"
                          onClick={() => setFormData({ ...formData, motivo: m.valor, motivoPersonalizado: '' })}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-center gap-3 ${
                            formData.motivo === m.valor
                              ? tipoAjuste === 'entrada'
                                ? 'border-success bg-success/5'
                                : 'border-error bg-error/5'
                              : 'border-outline/30 hover:border-outline hover:bg-surface-variant/50'
                          }`}
                        >
                          <span className={`material-symbols-outlined !text-[20px] flex-shrink-0 ${
                            formData.motivo === m.valor
                              ? tipoAjuste === 'entrada' ? 'text-success' : 'text-error'
                              : 'text-on-surface-variant'
                          }`}>{m.icono}</span>
                          <div>
                            <p className={`text-sm font-semibold ${
                              formData.motivo === m.valor
                                ? tipoAjuste === 'entrada' ? 'text-success' : 'text-error'
                                : 'text-on-surface'
                            }`}>
                              {m.valor}
                            </p>
                            <p className="text-xs text-on-surface-variant">{m.desc}</p>
                          </div>
                        </button>
                      ))}
                      {/* Motivo personalizado */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, motivo: 'otro' })}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-center gap-3 ${
                          formData.motivo === 'otro'
                            ? 'border-outline bg-surface-variant/50'
                            : 'border-outline/30 hover:border-outline hover:bg-surface-variant/50'
                        }`}
                      >
                        <span className="material-symbols-outlined !text-[20px] text-on-surface-variant flex-shrink-0">edit</span>
                        <p className="text-sm font-semibold text-on-surface">Otro motivo...</p>
                      </button>
                    </div>
                    {formData.motivo === 'otro' && (
                      <Input
                        value={formData.motivoPersonalizado}
                        onChange={(e) => setFormData({ ...formData, motivoPersonalizado: e.target.value })}
                        placeholder="Describe el motivo del ajuste..."
                        className="mt-1"
                      />
                    )}
                  </div>

                  {stockProyectado < 0 && (
                    <div className="flex items-start gap-2 bg-error/5 border border-error/20 rounded-xl px-3 py-2">
                      <span className="material-symbols-outlined !text-[18px] text-error mt-0.5">warning</span>
                      <p className="text-xs text-error font-medium">
                        Advertencia: El stock resultante sería negativo ({stockProyectado}). Verifica la cantidad antes de continuar.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ---- Pie fijo (no hace scroll) ---- */}
            <div className="px-6 py-4 border-t border-outline/10 flex items-center gap-2 flex-shrink-0">
              <Button type="button" variant="ghost" onClick={handleCerrarModal} className="mr-auto">
                Cancelar
              </Button>
              {paso > 1 && (
                <Button type="button" variant="outline" onClick={() => setPaso(paso - 1)}>
                  ← Atrás
                </Button>
              )}
              {paso < 3 ? (
                <Button
                  type="button"
                  disabled={
                    (paso === 1 && !tipoAjuste) ||
                    (paso === 2 && !formData.productoId)
                  }
                  onClick={() => setPaso(paso + 1)}
                  className={tipoAjuste === 'salida' ? 'bg-error hover:bg-error text-white' : ''}
                >
                  Siguiente →
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.cantidad || !formData.motivo}
                  className={tipoAjuste === 'salida' ? 'bg-error hover:bg-error text-white' : ''}
                >
                  {isSubmitting
                    ? 'Guardando...'
                    : tipoAjuste === 'entrada'
                    ? 'Registrar Entrada'
                    : 'Registrar Salida'}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================== TABLA DE INVENTARIO ===================== */}
      <div className="bg-surface rounded-xl border border-on-surface/10 p-4 mb-6">
        <div className="flex gap-4 mb-4">
          <Input
            placeholder="Buscar producto por nombre, código de barras o SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reiniciar();
            }}
            className="w-full sm:max-w-xs bg-surface border border-outline/20"
          />
          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id="switch-inactivos"
              checked={incluirInactivos}
              onCheckedChange={(checked: boolean) => {
                setIncluirInactivos(checked);
                reiniciar();
              }}
            />
            <Label htmlFor="switch-inactivos" className="text-sm text-on-surface-variant cursor-pointer">
              Mostrar ocultos/inactivos
            </Label>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Código / SKU</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock Actual</TableHead>
              <TableHead className="text-right">Mín</TableHead>
              <TableHead className="text-right">Máx</TableHead>
              <TableHead>Último movimiento</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-on-surface-variant">
                  Cargando inventario...
                </TableCell>
              </TableRow>
            ) : inventarioFiltrado.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-64">
                  <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                    <span className="material-symbols-outlined !text-[64px] mb-4 opacity-30">inventory</span>
                    <p className="text-lg font-medium">
                      {search ? 'Sin resultados para tu búsqueda' : 'Sin movimientos de inventario aún'}
                    </p>
                    {!search && (
                      <p className="text-sm text-on-surface-variant/60 mt-1">
                        Registra el primer ajuste de stock para comenzar.
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              inventarioFiltrado.map((inv: InventarioItem) => {
                const stockBajo = inv.stockActual > 0 && inv.stockActual <= inv.stockMinimo;
                const sinStock = inv.stockActual === 0;
                const porDebajoMinimo = inv.stockActual <= inv.stockMinimo;
                return (
                  <TableRow key={inv.id} className={inv.producto && !inv.producto.estaActivo ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {inv.producto?.nombre}
                      {inv.producto && !inv.producto.estaActivo && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-md bg-secondary/20 text-on-secondary-container text-[10px] font-semibold tracking-wide uppercase">Inactivo</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-on-surface-variant">
                      {inv.producto?.codigoBarras || inv.producto?.codigoInterno || '—'}
                    </TableCell>
                    <TableCell className="text-on-surface-variant text-sm">
                      {inv.producto?.unidadMedida}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`inline-flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-full text-sm ${
                        sinStock
                          ? 'bg-error/10 text-error'
                          : stockBajo
                          ? 'bg-yellow-500/10 text-yellow-600'
                          : 'text-on-surface'
                      }`}>
                        {porDebajoMinimo && (
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sinStock ? 'bg-error' : 'bg-yellow-500'}`} />
                        )}
                        {inv.stockActual}
                        {sinStock && <span className="ml-1 text-xs font-normal">Sin stock</span>}
                        {stockBajo && <span className="ml-1 text-xs font-normal">Stock bajo</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface-variant">
                      {inv.stockMinimo}
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface-variant">
                      {inv.stockMaximo}
                    </TableCell>
                    <TableCell className="text-sm text-on-surface-variant">
                      {inv.ultimoMovimiento
                        ? new Date(inv.ultimoMovimiento).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.producto && inv.producto.estaActivo ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAdjustModal(inv)}
                          title="Ajustar stock"
                        >
                          <SlidersHorizontal className="w-4 h-4 text-on-surface-variant" />
                        </Button>
                      ) : (
                        <span className="text-xs text-on-surface-variant font-medium">Oculto</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
      </div>
    </div>
  );
}
