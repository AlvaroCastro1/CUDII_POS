import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartItem {
  productoId: string;
  codigoBarras: string;
  nombre: string;
  unidadMedida: string;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
  descuento: number;
  esGranel: boolean;
}

export interface SesionCajaState {
  id: string;
  cajaId: string;
  cajeroId: string;
  montoInicial: number;
  modoCorteUsado: 'ciego' | 'abierto';
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  totalRetiros: number;
  estado: 'abierta' | 'cerrada';
  caja: {
    id: string;
    nombre: string;
    codigo: string | null;
  };
}

interface PosStoreState {
  cart: CartItem[];
  activeSession: SesionCajaState | null;
  selectedCajaId: string | null;
  descuentoGeneral: number;
  
  // Acciones
  addToCart: (producto: {
    id: string;
    codigoBarras: string;
    nombre: string;
    unidadMedida?: string | null;
    precioVentaBase: number;
    stockDisponible?: number;
    esGranel?: boolean;
  }, cantidad?: number) => void;
  updateQuantity: (productoId: string, cantidad: number) => void;
  removeFromCart: (productoId: string) => void;
  clearCart: () => void;
  setDescuentoGeneral: (monto: number) => void;
  setActiveSession: (session: SesionCajaState | null) => void;
  setSelectedCajaId: (cajaId: string | null) => void;
}

export const usePosStore = create<PosStoreState>()(
  persist(
    (set, get) => ({
      cart: [],
      activeSession: null,
      selectedCajaId: null,
      descuentoGeneral: 0,

      addToCart: (producto, cantidad = 1) => {
        const currentCart = get().cart;
        const existingIndex = currentCart.findIndex(
          (item) => item.productoId === producto.id,
        );

        const stockDisp = producto.stockDisponible ?? 9999;

        if (existingIndex >= 0) {
          const updatedCart = [...currentCart];
          const newQty = updatedCart[existingIndex].cantidad + cantidad;
          updatedCart[existingIndex] = {
            ...updatedCart[existingIndex],
            cantidad: newQty,
          };
          set({ cart: updatedCart });
        } else {
          set({
            cart: [
              ...currentCart,
              {
                productoId: producto.id,
                codigoBarras: producto.codigoBarras,
                nombre: producto.nombre,
                unidadMedida: producto.unidadMedida || 'pieza',
                precioUnitario: producto.precioVentaBase,
                cantidad,
                stockDisponible: stockDisp,
                descuento: 0,
                esGranel: producto.esGranel || false,
              },
            ],
          });
        }
      },

      updateQuantity: (productoId, cantidad) => {
        if (cantidad <= 0) {
          get().removeFromCart(productoId);
          return;
        }
        set({
          cart: get().cart.map((item) =>
            item.productoId === productoId ? { ...item, cantidad } : item,
          ),
        });
      },

      removeFromCart: (productoId) => {
        set({
          cart: get().cart.filter((item) => item.productoId !== productoId),
        });
      },

      clearCart: () => {
        set({ cart: [], descuentoGeneral: 0 });
      },

      setDescuentoGeneral: (monto) => {
        set({ descuentoGeneral: monto });
      },

      setActiveSession: (session) => {
        set({ activeSession: session });
      },

      setSelectedCajaId: (cajaId) => {
        set({ selectedCajaId: cajaId });
      },
    }),
    {
      name: 'cudii_pos_cart_storage',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
