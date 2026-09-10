import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Lock,
  MinusCircle,
  RotateCcw,
  ShoppingBag,
  User,
  Gift,
  ChevronDown,
  Receipt,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { usePosStore } from '../store/usePosStore';
import { ProductSearch } from '../components/pos/ProductSearch';
import { ProductGrid } from '../components/pos/ProductGrid';
import { ComboCard } from '../components/pos/ComboCard';
import { ComboDetalleModal } from '../components/pos/ComboDetalleModal';
import { CartItem } from '../components/pos/CartItem';
import { CartComboItem } from '../components/pos/CartComboItem';
import { CartSummary } from '../components/pos/CartSummary';
import { CheckoutModal } from '../components/pos/CheckoutModal';
import { VoucherModal } from '../components/pos/VoucherModal';
import { OpenCashRegisterModal } from '../components/pos/OpenCashRegisterModal';
import { CloseRegisterModal } from '../components/pos/CloseRegisterModal';
import { CashWithdrawalModal } from '../components/pos/CashWithdrawalModal';
import { RegistrarEgresoModal } from '../components/pos/RegistrarEgresoModal';
import { CantidadProductoModal } from '../components/pos/CantidadProductoModal';
import type { PresentacionSeleccion } from '../components/pos/CantidadProductoModal';
import { useNavigate } from 'react-router-dom';
import type { Producto, Venta, ComboConResumen } from '../types/pos';

export const PosView: React.FC = () => {
  const navigate = useNavigate();
  const cart = usePosStore((s) => s.cart);
  const combosEnTicket = usePosStore((s) => s.combos);
  const addToCart = usePosStore((s) => s.addToCart);
  const addCombo = usePosStore((s) => s.addCombo);
  const aplicarComboSugerido = usePosStore((s) => s.aplicarComboSugerido);
  const activeSession = usePosStore((s) => s.activeSession);
  const setActiveSession = usePosStore((s) => s.setActiveSession);
  const quitarUltimaLinea = usePosStore((s) => s.quitarUltimaLinea);
  const presupuestoActivoId = usePosStore((s) => s.presupuestoActivoId);

  // Ref del buscador de productos, expuesta para atajos de teclado (Ctrl+F).
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string | null>(null);
  const [isOpenCheckout, setIsOpenCheckout] = useState(false);
  const [isOpenOpenRegister, setIsOpenOpenRegister] = useState(false);
  const [isOpenCloseRegister, setIsOpenCloseRegister] = useState(false);
  const [isOpenWithdrawal, setIsOpenWithdrawal] = useState(false);
  const [isOpenEgreso, setIsOpenEgreso] = useState(false);
  const [completedSale, setCompletedSale] = useState<Venta | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cantidadProducto, setCantidadProducto] = useState<Producto | null>(null);

  // D11: catálogo de combos vigentes para la tarjeta POS
  const [combosDisponibles, setCombosDisponibles] = useState<ComboConResumen[]>([]);
  const [comboSeleccionado, setComboSeleccionado] = useState<ComboConResumen | null>(null);

  // D12: define qué grupos de combo (cargados de un presupuesto) están expandidos.
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({});

  // D12: agrupa las líneas del carrito que provienen de los productos de un combo
  // del presupuesto, para mostrarlas como un grupo expandible (cabecera + productos).
  const comboGrupos = useMemo(() => {
    const grupos = new Map<string, typeof cart>();
    for (const item of cart) {
      if (!item.comboId) continue;
      const lista = grupos.get(item.comboId) ?? [];
      lista.push(item);
      grupos.set(item.comboId, lista);
    }
    return Array.from(grupos.entries()).map(([comboId, lineas]) => ({
      comboId,
      nombreCombo: lineas[0].nombreCombo ?? 'Combo',
      lineas,
    }));
  }, [cart]);

  // Líneas sueltas (productos sin combo) del carrito.
  const lineasSueltas = useMemo(
    () => cart.filter((item) => !item.comboId),
    [cart],
  );

  // D11: cargar combos vigentes de la empresa
  useEffect(() => {
    let vigente = true;
    api
      .get('/combos', { params: { soloVigentes: 'true', limit: 24 } })
      .then((res) => {
        if (vigente) {
          setCombosDisponibles(
            Array.isArray(res.data?.data) ? res.data.data : [],
          );
        }
      })
      .catch((err) => console.error('Error al cargar combos en POS:', err));
    return () => {
      vigente = false;
    };
  }, [refreshKey]);

  // D11: auto-aplicación de combos. Si los productos sueltos del carrito cubren
  // por completo el contenido de un combo vigente (y aún no está en el ticket),
  // se aplica automáticamente reemplazando esas líneas por el paquete.
  useEffect(() => {
    // D12: si el ticket vino de un presupuesto, NO auto-aplicar combos: las
    // líneas congeladas ya están en el carrito y re-aplicar el paquete duplicaría
    // el cargo. El usuario decide qué ajustar manualmente.
    if (presupuestoActivoId || combosDisponibles.length === 0 || cart.length === 0) return;
    const mapa = new Map<string, number>();
    for (const item of cart) {
      mapa.set(item.productoId, (mapa.get(item.productoId) ?? 0) + item.cantidad);
    }
    const yaAplicado = new Set(combosEnTicket.map((c) => c.comboId));
    const cubiertos = combosDisponibles
      .filter((c) => !yaAplicado.has(c.id))
      .filter((c) =>
        c.productos.every((p) => (mapa.get(p.productoId) ?? 0) >= p.cantidad),
      )
      .sort((a, b) => b.resumen.ahorro - a.resumen.ahorro);
    const mejor = cubiertos[0];
    if (!mejor) return;
    aplicarComboSugerido(mejor);
    toast.success(
      `Combo "${mejor.nombre}" aplicado · Ahorras $${mejor.resumen.ahorro.toFixed(2)}`,
    );
  }, [cart, combosEnTicket, combosDisponibles, aplicarComboSugerido, presupuestoActivoId]);

  // Verificar sesión de caja activa al entrar a la POS
  useEffect(() => {
    const checkActiveSession = async () => {
      setIsLoadingSession(true);
      try {
        const res = await api.get('/cash-register/current');

        if (res.data) {
          setActiveSession(res.data);
          setIsOpenOpenRegister(false);
        } else {
          setActiveSession(null);
          setIsOpenOpenRegister(true);
        }
      } catch (err) {
        console.error('Error al verificar sesión de caja:', err);
        setIsOpenOpenRegister(true);
      } finally {
        setIsLoadingSession(false);
      }
    };

    checkActiveSession();
  }, []);

  const handleSelectProduct = useCallback(
    (producto: Producto) => {
      setCantidadProducto(producto);
    },
    [],
  );

  const handleConfirmCantidad = useCallback(
    (
      producto: Producto,
      cantidad: number,
      presentacion: PresentacionSeleccion | null,
    ) => {
      addToCart(producto, cantidad, presentacion ?? undefined);
      setCantidadProducto(null);
    },
    [addToCart],
  );

  /** Agrega un combo del catálogo al ticket actual con la cantidad indicada */
  const handleAddCombo = useCallback(
    (combo: ComboConResumen, cantidad: number) => {
      addCombo(
        {
          comboId: combo.id,
          nombre: combo.nombre,
          precioUnitario: combo.resumen.precioCombo,
          precioOriginal: combo.resumen.precioOriginal,
          ahorro: combo.resumen.ahorro,
          productos: combo.productos.map((p) => ({
            nombre: p.producto?.nombre ?? '',
            cantidad: p.cantidad,
          })),
        },
        cantidad,
      );
      setComboSeleccionado(null);
    },
    [addCombo],
  );

  const handleSaleSuccess = useCallback((venta: Venta) => {
    setIsOpenCheckout(false);
    setCompletedSale(venta);
    setRefreshKey((prev) => prev + 1); // Disparar actualización de inventario y catálogo
  }, []);

  const handleCheckout = useCallback(() => setIsOpenCheckout(true), []);

  // Atajos de teclado del POS para mejorar la velocidad del cajero:
  // - Ctrl+F  → enfocar el buscador de productos.
  // - Supr/Retroceso → quitar la última línea agregada al ticket.
  // - Ctrl+Enter (o Enter sin foco en un input) → abrir el cobro si hay ticket.
  useEffect(() => {
    const esEditable = (el: EventTarget | null) => {
      const target = el as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      );
    };

    const hayModalAbierto =
      isOpenCheckout ||
      isOpenOpenRegister ||
      isOpenCloseRegister ||
      isOpenWithdrawal ||
      cantidadProducto !== null ||
      comboSeleccionado !== null;

    const handler = (e: KeyboardEvent) => {
      // Ctrl+F: enfocar la búsqueda y seleccionar el texto actual.
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        const input = searchInputRef.current;
        if (input) {
          input.focus();
          input.select();
        }
        return;
      }

      if (hayModalAbierto) return;

      // No interceptar teclas mientras se escribe en un campo editable.
      if (esEditable(e.target)) return;

      // Supr / Retroceso: quitar la última línea del ticket (ventaja: sin mouse).
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        quitarUltimaLinea();
        return;
      }

      // Ctrl+Enter o Enter: abrir el cobro si el ticket no está vacío.
      const esCtrlEnter =
        e.ctrlKey && (e.key === 'Enter' || e.code === 'NumpadEnter');
      const esEnterPlan =
        (e.key === 'Enter' || e.code === 'NumpadEnter') && !e.ctrlKey && !e.altKey;

      if (esCtrlEnter || esEnterPlan) {
        const tieneTicket = cart.length > 0 || combosEnTicket.length > 0;
        if (!tieneTicket) return;

        // Para Enter "plano" solo se intercepta cuando el foco no está sobre un
        // elemento interactivo (botón, enlace...), así no se duplica su acción
        // (p. ej. un botón de categoría enfocado). Ctrl+Enter siempre aplica.
        if (esEnterPlan) {
          const el = document.activeElement as HTMLElement | null;
          if (el && el !== document.body && el.tagName !== 'BODY') {
            const tag = el.tagName;
            if (tag === 'BUTTON' || tag === 'A' || tag === 'LABEL') return;
            if (el.closest('button, a[href]')) return;
          }
        }

        e.preventDefault();
        setIsOpenCheckout(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    isOpenCheckout,
    isOpenOpenRegister,
    isOpenCloseRegister,
    isOpenWithdrawal,
    cantidadProducto,
    comboSeleccionado,
    cart.length,
    combosEnTicket.length,
    quitarUltimaLinea,
  ]);

  const totalArticulos =
    cart.length +
    combosEnTicket.reduce((acc, c) => acc + c.cantidad, 0);

  if (isLoadingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-outline">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-on-surface">Verificando estado de caja...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background text-on-surface overflow-hidden">
      {/* Top Header Bar de Acciones de Caja */}
      <div className="h-16 border-b border-outline/20 px-6 flex items-center justify-between shrink-0 glass-panel z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-display-lg text-lg text-primary leading-tight font-bold">
              Terminal POS
            </h1>
            <p className="text-[11px] font-label-sm text-outline">
              Caja: {activeSession?.caja?.nombre || 'Caja 01'} • <span className="text-success font-semibold">Turno Activo</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/devoluciones')}
            className="px-4 py-2 spatial-glass rounded-full text-xs font-label-sm font-semibold text-primary hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 text-primary" />
            <span>Devoluciones</span>
          </button>

          <button
            onClick={() => setIsOpenWithdrawal(true)}
            className="px-4 py-2 spatial-glass rounded-full text-xs font-label-sm font-semibold text-primary hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
          >
            <MinusCircle className="w-4 h-4 text-warning" />
            <span>Retiro Parcial</span>
          </button>

          <button
            onClick={() => setIsOpenEgreso(true)}
            className="px-4 py-2 spatial-glass rounded-full text-xs font-label-sm font-semibold text-primary hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
          >
            <Receipt className="w-4 h-4 text-error" />
            <span>Registrar Egreso</span>
          </button>

          <button
            onClick={() => setIsOpenCloseRegister(true)}
            className="px-4 py-2 spatial-glass rounded-full text-xs font-label-sm font-bold text-error border border-error/30 hover:bg-error/10 transition-colors flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4" />
            <span>Cerrar Turno</span>
          </button>
        </div>
      </div>

      {/* Main POS Canvas (Catálogo 60% / Panel de Ticket 40%) */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden min-h-0">
        {/* PANEL IZQUIERDO: Buscador + Grilla Bento */}
        <section className="flex-1 flex flex-col min-w-0 space-y-4">
          <ProductSearch
            onSelectProduct={handleSelectProduct}
            selectedCategoriaId={selectedCategoriaId}
            onSelectCategory={setSelectedCategoriaId}
            refreshKey={refreshKey}
            searchInputRef={searchInputRef}
          />
          {/* Único Scrollbar Maestro para la variedad de productos + combos */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
            {combosDisponibles.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="font-headline-md text-sm text-primary font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined !text-base shrink-0">redeem</span>
                    Combos y Paquetes
                  </h2>
                  <span className="text-[10px] text-outline font-label-sm">
                    {combosDisponibles.length} disponibles
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {combosDisponibles.map((combo) => (
                    <ComboCard
                      key={combo.id}
                      combo={combo}
                      onSelect={setComboSeleccionado}
                    />
                  ))}
                </div>
              </div>
            )}
            <ProductGrid
              onSelectProduct={handleSelectProduct}
              selectedCategoriaId={selectedCategoriaId}
              refreshKey={refreshKey}
            />
          </div>
        </section>

        {/* PANEL DERECHO: Ticket Actual (liquid-glass) */}
        <aside className="w-full md:w-[420px] flex flex-col h-full shrink-0 overflow-hidden">
          <div className="liquid-glass rounded-[32px] h-full flex flex-col shadow-2xl relative overflow-hidden">
            {/* Header del Ticket */}
            <div className="p-6 border-b border-outline/20 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-headline-md text-2xl text-primary font-bold">
                  Ticket Actual
                </h2>
                <span className="font-label-sm px-3 py-1 bg-surface-container-high rounded-full text-outline text-xs">
                  {totalArticulos} artículos
                </span>
              </div>
              <div className="flex items-center gap-2 text-outline text-xs">
                <User className="w-4 h-4" />
                <span>Cliente: Público General</span>
              </div>
            </div>

            {/* Ítems del Carrito (Scroll limpio sin barra estática innecesaria) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0 scrollbar-none">
              {cart.length === 0 && combosEnTicket.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-outline text-center space-y-2 py-12">
                  <ShoppingBag className="w-12 h-12 stroke-[1.2] opacity-40" />
                  <p className="text-sm font-medium">El carrito está vacío</p>
                  <p className="text-xs text-outline/60">
                    Selecciona o escanea productos del catálogo
                  </p>
                </div>
              ) : (
                <>
                  {combosEnTicket.map((combo) => (
                    <CartComboItem key={combo.comboId} item={combo} />
                  ))}

                  {/* D12: grupos de combo cargados desde un presupuesto (expandibles) */}
                  {comboGrupos.map((grupo) => {
                    const expandido = gruposExpandidos[grupo.comboId] ?? true;
                    const subtotalGrupo = grupo.lineas.reduce(
                      (acc, l) =>
                        acc + (l.cantidad * l.precioUnitario - (l.descuento || 0)),
                      0,
                    );
                    return (
                      <div
                        key={grupo.comboId}
                        className="flex flex-col rounded-2xl bg-primary/10 border border-primary/30 overflow-hidden group"
                      >
                        <button
                          onClick={() =>
                            setGruposExpandidos((prev) => ({
                              ...prev,
                              [grupo.comboId]: !expandido,
                            }))
                          }
                          className="flex items-center justify-between gap-2 p-3 text-left hover:bg-primary/15 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                              <Gift className="w-3.5 h-3.5 text-primary" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-primary font-body-md text-sm font-semibold truncate">
                                {grupo.nombreCombo}
                              </p>
                              <p className="text-[10px] text-outline font-label-sm">
                                {grupo.lineas.length} producto
                                {grupo.lineas.length !== 1 ? 's' : ''} · desde
                                presupuesto
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-primary text-sm">
                              ${subtotalGrupo.toFixed(2)}
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 text-primary transition-transform ${
                                expandido ? '' : '-rotate-90'
                              }`}
                            />
                          </div>
                        </button>
                        {expandido && (
                          <div className="px-2 pb-2 space-y-2">
                            {grupo.lineas.map((linea) => (
                              <CartItem
                                key={`${grupo.comboId}-${linea.productoId}`}
                                item={linea}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Líneas sueltas del carrito */}
                  {lineasSueltas.map((item) => (
                    <CartItem key={item.productoId} item={item} />
                  ))}
                </>
              )}
            </div>

            {/* Resumen y Botón de Cobro Prominente */}
            <div className="shrink-0">
              <CartSummary onCheckout={handleCheckout} />
            </div>
          </div>
        </aside>
      </div>

      {/* Modales POS */}
      <CheckoutModal
        isOpen={isOpenCheckout}
        onClose={() => setIsOpenCheckout(false)}
        onSuccess={handleSaleSuccess}
      />

      <VoucherModal
        venta={completedSale}
        onClose={() => setCompletedSale(null)}
      />

      <OpenCashRegisterModal
        isOpen={isOpenOpenRegister}
        onSuccess={() => setIsOpenOpenRegister(false)}
      />

      <CloseRegisterModal
        isOpen={isOpenCloseRegister}
        onClose={() => setIsOpenCloseRegister(false)}
        onSessionClosed={() => {
          setIsOpenCloseRegister(false);
          setIsOpenOpenRegister(true);
        }}
      />

      <CashWithdrawalModal
        isOpen={isOpenWithdrawal}
        onClose={() => setIsOpenWithdrawal(false)}
        onSuccess={() => {}}
      />

      <RegistrarEgresoModal
        isOpen={isOpenEgreso}
        sesionCajaId={activeSession?.id || ''}
        onClose={() => setIsOpenEgreso(false)}
        onSuccess={() => {
          setIsOpenEgreso(false);
          setRefreshKey((prev) => prev + 1);
        }}
      />

      <CantidadProductoModal
        producto={cantidadProducto}
        onClose={() => setCantidadProducto(null)}
        onConfirm={handleConfirmCantidad}
      />

      <ComboDetalleModal
        combo={comboSeleccionado}
        onClose={() => setComboSeleccionado(null)}
        onAdd={handleAddCombo}
      />
    </div>
  );
};

export default PosView;
