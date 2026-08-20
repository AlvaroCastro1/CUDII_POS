import React, { useCallback, useEffect, useState } from 'react';
import {
  Lock,
  MinusCircle,
  RotateCcw,
  ShoppingBag,
  User,
} from 'lucide-react';
import { api } from '../lib/api';
import { usePosStore } from '../store/usePosStore';
import { ProductSearch } from '../components/pos/ProductSearch';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartItem } from '../components/pos/CartItem';
import { CartSummary } from '../components/pos/CartSummary';
import { CheckoutModal } from '../components/pos/CheckoutModal';
import { VoucherModal } from '../components/pos/VoucherModal';
import { OpenCashRegisterModal } from '../components/pos/OpenCashRegisterModal';
import { CloseRegisterModal } from '../components/pos/CloseRegisterModal';
import { CashWithdrawalModal } from '../components/pos/CashWithdrawalModal';
import { CantidadProductoModal } from '../components/pos/CantidadProductoModal';
import type { PresentacionSeleccion } from '../components/pos/CantidadProductoModal';
import { useNavigate } from 'react-router-dom';
import type { Producto, Venta } from '../types/pos';

export const PosView: React.FC = () => {
  const navigate = useNavigate();
  const cart = usePosStore((s) => s.cart);
  const addToCart = usePosStore((s) => s.addToCart);
  const activeSession = usePosStore((s) => s.activeSession);
  const setActiveSession = usePosStore((s) => s.setActiveSession);

  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string | null>(null);
  const [isOpenCheckout, setIsOpenCheckout] = useState(false);
  const [isOpenOpenRegister, setIsOpenOpenRegister] = useState(false);
  const [isOpenCloseRegister, setIsOpenCloseRegister] = useState(false);
  const [isOpenWithdrawal, setIsOpenWithdrawal] = useState(false);
  const [completedSale, setCompletedSale] = useState<Venta | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cantidadProducto, setCantidadProducto] = useState<Producto | null>(null);

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

  const handleSaleSuccess = useCallback((venta: Venta) => {
    setIsOpenCheckout(false);
    setCompletedSale(venta);
    setRefreshKey((prev) => prev + 1); // Disparar actualización de inventario y catálogo
  }, []);

  const handleCheckout = useCallback(() => setIsOpenCheckout(true), []);

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
          />
          {/* Único Scrollbar Maestro para la variedad de productos */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
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
                  {cart.length} artículos
                </span>
              </div>
              <div className="flex items-center gap-2 text-outline text-xs">
                <User className="w-4 h-4" />
                <span>Cliente: Público General</span>
              </div>
            </div>

            {/* Ítems del Carrito (Scroll limpio sin barra estática innecesaria) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0 scrollbar-none">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-outline text-center space-y-2 py-12">
                  <ShoppingBag className="w-12 h-12 stroke-[1.2] opacity-40" />
                  <p className="text-sm font-medium">El carrito está vacío</p>
                  <p className="text-xs text-outline/60">
                    Selecciona o escanea productos del catálogo
                  </p>
                </div>
              ) : (
                cart.map((item) => <CartItem key={item.productoId} item={item} />)
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

      <CantidadProductoModal
        producto={cantidadProducto}
        onClose={() => setCantidadProducto(null)}
        onConfirm={handleConfirmCantidad}
      />
    </div>
  );
};

export default PosView;
