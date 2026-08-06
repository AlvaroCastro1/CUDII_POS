import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, SlidersHorizontal } from 'lucide-react';

// ============================================================
// Catálogo de motivos de ajuste pre-definidos para el usuario
// ============================================================
const MOTIVOS_ENTRADA = [
  { valor: 'Compra a proveedor', icono: 'local_shipping', desc: 'Mercancía recibida de un proveedor' },
  { valor: 'Devolución de cliente', icono: 'assignment_return', desc: 'Producto devuelto por un cliente' },
  { valor: 'Corrección de inventario', icono: 'rule', desc: 'Corrección tras conteo físico' },
];
const MOTIVOS_SALIDA = [
  { valor: 'Merma o caducidad', icono: 'delete_forever', desc: 'Producto dañado, vencido o inutilizable' },
  { valor: 'Robo o pérdida', icono: 'report', desc: 'Mercancía faltante sin explicación' },
  { valor: 'Corrección de inventario', icono: 'rule', desc: 'Corrección tras conteo físico' },
  { valor: 'Uso interno', icono: 'storefront', desc: 'Consumido por la empresa internamente' },
];

// ============================================================
// Vista principal: Control de Inventario
// ============================================================
export default function InventarioView() {
  const [inventario, setInventario] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Control del modal de ajuste
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState<'entrada' | 'salida' | ''>('');
  const [paso, setPaso] = useState(1);

  // Estado de búsqueda del modal — lazy, no carga todo el catálogo
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Formulario del modal
  const initialForm = {
    productoId: '',
    sucursalId: '',
    cantidad: '',
    motivo: '',
    motivoPersonalizado: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derivados
  const productoSeleccionado = resultadosBusqueda.find((p: any) => p.id === formData.productoId)
    // Si viene preseleccionado desde la tabla, buscarlo en el inventario
    || inventario.find((inv: any) => inv.productoId === formData.productoId)?.producto;
  const registroActual = inventario.find(
    (inv: any) => inv.productoId === formData.productoId
  );
  const stockActual = registroActual?.stockActual ?? 0;
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

  // Filtrado local de la tabla de inventario
  const inventarioFiltrado = inventario.filter((inv: any) =>
    inv.producto?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    inv.producto?.codigoBarras?.includes(search) ||
    (inv.producto?.codigoInterno ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ----------------------------------------------------------------
  // Carga de datos iniciales (solo inventario, NO el catálogo completo)
  // ----------------------------------------------------------------
  const fetchData = async () => {
    try {
      setLoading(true);
      const resInv = await api.get('/inventory/stock/all');
      setInventario(resInv.data.data || resInv.data);

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
  };

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
        sucursalId: formData.sucursalId || '', // El backend resuelve si viene vacío
        cantidad: cantidadFinal,
        motivo: motivoFinal,
      });
      toast.success(`Stock ${tipoAjuste === 'entrada' ? 'ingresado' : 'retirado'} exitosamente`);
      handleCerrarModal();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al registrar ajuste');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal preseleccionando un producto/sucursal desde la tabla
  const openAdjustModal = (inv?: any) => {
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

  useEffect(() => {
    fetchData();
  }, []);

  const motivosActuales = tipoAjuste === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;

  return (
    <div className="p-6">

      {/* ===================== ENCABEZADO ===================== */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display-lg text-on-background">Control de Inventario</h1>
        <Button onClick={() => openAdjustModal()}>
          <SlidersHorizontal className="mr-2 w-4 h-4" />
          Ajuste de Stock
        </Button>
      </div>

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
                            ? 'bg-green-500'
                            : tipoAjuste === 'salida'
                            ? 'bg-red-500'
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
                          ? 'border-green-500 bg-green-500/5'
                          : 'border-outline/30 hover:border-green-500/50 hover:bg-green-500/5'
                      }`}
                    >
                      <TrendingUp className={`w-8 h-8 ${tipoAjuste === 'entrada' ? 'text-green-600' : 'text-on-surface-variant'}`} />
                      <p className={`font-bold text-base ${tipoAjuste === 'entrada' ? 'text-green-600' : 'text-on-surface'}`}>Entrada</p>
                      <p className="text-xs text-on-surface-variant">Aumenta el stock. Ej: compra de mercancía, devolución.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoAjuste('salida')}
                      className={`p-5 rounded-2xl border-2 text-left transition-all duration-150 flex flex-col gap-2 ${
                        tipoAjuste === 'salida'
                          ? 'border-red-500 bg-red-500/5'
                          : 'border-outline/30 hover:border-red-500/50 hover:bg-red-500/5'
                      }`}
                    >
                      <TrendingDown className={`w-8 h-8 ${tipoAjuste === 'salida' ? 'text-red-500' : 'text-on-surface-variant'}`} />
                      <p className={`font-bold text-base ${tipoAjuste === 'salida' ? 'text-red-500' : 'text-on-surface'}`}>Salida</p>
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
                    <span className={`font-semibold ${tipoAjuste === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
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
                    ) : resultadosBusqueda.length === 0 ? (
                      <p className="text-sm text-on-surface-variant text-center py-4">Sin resultados</p>
                    ) : (
                      resultadosBusqueda.map((prod: any) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, productoId: prod.id })}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-center justify-between ${
                            formData.productoId === prod.id
                              ? tipoAjuste === 'entrada'
                                ? 'border-green-500 bg-green-500/5'
                                : 'border-red-500 bg-red-500/5'
                              : 'border-outline/30 hover:border-outline hover:bg-surface-variant/50'
                          }`}
                        >
                          <div>
                            <p className={`font-semibold text-sm ${formData.productoId === prod.id ? (tipoAjuste === 'entrada' ? 'text-green-600' : 'text-red-500') : 'text-on-surface'}`}>
                              {prod.nombre}
                            </p>
                            <p className="text-xs text-on-surface-variant font-mono">{prod.codigoBarras}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${formData.productoId === prod.id ? (tipoAjuste === 'entrada' ? 'border-green-500 text-green-600' : 'border-red-500 text-red-500') : 'border-outline/30 text-on-surface-variant'}`}>
                            {prod.unidadMedida}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Si hay varias sucursales, mostrar selector */}
                  {sucursales.length > 1 && (
                    <div className="grid gap-2">
                      <Label>Sucursal <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.sucursalId}
                        onValueChange={(v) => setFormData({ ...formData, sucursalId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona la sucursal..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sucursales.map((suc: any) => (
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
                        {productoSeleccionado.esGranel && <span className="ml-2 text-blue-500">• A granel</span>}
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
                        ? 'bg-green-500/5 border-green-500/20'
                        : stockProyectado < 0
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}>
                      <div className="text-center">
                        <p className="text-xs text-on-surface-variant">Stock actual</p>
                        <p className="text-2xl font-display-lg font-bold text-on-surface">{stockActual}</p>
                      </div>
                      <span className="material-symbols-outlined !text-[28px] text-on-surface-variant">arrow_forward</span>
                      <div className="text-center">
                        <p className="text-xs text-on-surface-variant">Stock resultante</p>
                        <p className={`text-2xl font-display-lg font-bold ${
                          stockProyectado < 0 ? 'text-red-600' : tipoAjuste === 'entrada' ? 'text-green-600' : 'text-orange-500'
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
                      <span className="text-red-500 ml-1">*</span>
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
                      <p className="text-xs text-blue-600">
                        Este producto es a granel — puedes ingresar decimales (ej. 0.350 kg).
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label>Motivo del ajuste <span className="text-red-500">*</span></Label>
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
                                ? 'border-green-500 bg-green-500/5'
                                : 'border-red-500 bg-red-500/5'
                              : 'border-outline/30 hover:border-outline hover:bg-surface-variant/50'
                          }`}
                        >
                          <span className={`material-symbols-outlined !text-[20px] flex-shrink-0 ${
                            formData.motivo === m.valor
                              ? tipoAjuste === 'entrada' ? 'text-green-600' : 'text-red-500'
                              : 'text-on-surface-variant'
                          }`}>{m.icono}</span>
                          <div>
                            <p className={`text-sm font-semibold ${
                              formData.motivo === m.valor
                                ? tipoAjuste === 'entrada' ? 'text-green-600' : 'text-red-500'
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
                    <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2">
                      <span className="material-symbols-outlined !text-[18px] text-red-500 mt-0.5">warning</span>
                      <p className="text-xs text-red-600 font-medium">
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
                  className={tipoAjuste === 'salida' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}
                >
                  Siguiente →
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.cantidad || !formData.motivo}
                  className={tipoAjuste === 'salida' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}
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
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Código / SKU</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock Actual</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-on-surface-variant">
                  Cargando inventario...
                </TableCell>
              </TableRow>
            ) : inventarioFiltrado.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64">
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
              inventarioFiltrado.map((inv: any) => {
                const stockBajo = inv.stockActual > 0 && inv.stockActual <= 5;
                const sinStock = inv.stockActual === 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.producto?.nombre}</TableCell>
                    <TableCell className="font-mono text-sm text-on-surface-variant">
                      {inv.producto?.codigoBarras || inv.producto?.codigoInterno || '—'}
                    </TableCell>
                    <TableCell className="text-on-surface-variant text-sm">
                      {inv.producto?.unidadMedida}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold px-2 py-0.5 rounded-full text-sm ${
                        sinStock
                          ? 'bg-red-500/10 text-red-600'
                          : stockBajo
                          ? 'bg-yellow-500/10 text-yellow-600'
                          : 'text-on-surface'
                      }`}>
                        {inv.stockActual}
                        {sinStock && <span className="ml-1 text-xs font-normal">Sin stock</span>}
                        {stockBajo && <span className="ml-1 text-xs font-normal">Stock bajo</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAdjustModal(inv)}
                        title="Ajustar stock"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-on-surface-variant" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
