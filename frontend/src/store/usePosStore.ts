import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ComboConResumen } from '../types/pos';

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
  presentacionId?: string;
  presentacionNombre?: string;
}

export interface PresentacionCart {
  id?: string;
  nombre?: string;
  precio: number;
  cantidadMinima: number;
}

/** D11: Combo/paquete agregado al ticket (el backend lo expande en líneas) */
export interface CartCombo {
  comboId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioOriginal: number;
  ahorro: number;
  productos: { nombre: string; cantidad: number }[];
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
  combos: CartCombo[];
  activeSession: SesionCajaState | null;
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
  }, cantidad?: number, presentacion?: PresentacionCart) => void;
  updateQuantity: (productoId: string, cantidad: number, presentacionId?: string) => void;
  removeFromCart: (productoId: string, presentacionId?: string) => void;
  clearCart: () => void;
  setDescuentoGeneral: (monto: number) => void;
  setActiveSession: (session: SesionCajaState | null) => void;
  addCombo: (combo: Omit<CartCombo, 'cantidad'>, cantidad?: number) => void;
  updateComboQuantity: (comboId: string, cantidad: number) => void;
  removeCombo: (comboId: string) => void;
  aplicarComboSugerido: (combo: ComboConResumen) => void;
}

export const usePosStore = create<PosStoreState>()(
  persist(
    (set, get) => ({
      cart: [],
      combos: [],
      activeSession: null,
      descuentoGeneral: 0,

      addToCart: (producto, cantidad = 1, presentacion) => {
        const currentCart = get().cart;
        const presentacionId = presentacion?.id;
        const existingIndex = currentCart.findIndex(
          (item) =>
            item.productoId === producto.id &&
            (item.presentacionId || undefined) === (presentacionId || undefined),
        );

        const stockDisp = producto.stockDisponible ?? 9999;
        const esGranel = producto.esGranel || false;
        const precioUnitario = presentacion?.precio ?? producto.precioVentaBase;
        const cantidadLinea = presentacion ? presentacion.cantidadMinima : cantidad;

        if (existingIndex >= 0) {
          const updatedCart = [...currentCart];
          const newQty = updatedCart[existingIndex].cantidad + cantidadLinea;
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
                precioUnitario,
                cantidad: cantidadLinea,
                stockDisponible: stockDisp,
                descuento: 0,
                esGranel,
                presentacionId,
                presentacionNombre: presentacion?.nombre,
              },
            ],
          });
        }
      },

      updateQuantity: (productoId, cantidad, presentacionId) => {
        if (cantidad <= 0) {
          get().removeFromCart(productoId, presentacionId);
          return;
        }
        set({
          cart: get().cart.map((item) =>
            item.productoId === productoId &&
            (item.presentacionId || undefined) === (presentacionId || undefined)
              ? { ...item, cantidad }
              : item,
          ),
        });
      },

      removeFromCart: (productoId, presentacionId) => {
        set({
          cart: get().cart.filter(
            (item) =>
              !(
                item.productoId === productoId &&
                (item.presentacionId || undefined) === (presentacionId || undefined)
              ),
          ),
        });
      },

      clearCart: () => {
        set({ cart: [], combos: [], descuentoGeneral: 0 });
      },

      addCombo: (combo, cantidad = 1) => {
        const combosActuales = get().combos;
        const existente = combosActuales.find((c) => c.comboId === combo.comboId);
        if (existente) {
          set({
            combos: combosActuales.map((c) =>
              c.comboId === combo.comboId
                ? { ...c, cantidad: c.cantidad + cantidad }
                : c,
            ),
          });
        } else {
          set({
            combos: [...combosActuales, { ...combo, cantidad }],
          });
        }
      },

      updateComboQuantity: (comboId, cantidad) => {
        if (cantidad <= 0) {
          get().removeCombo(comboId);
          return;
        }
        set({
          combos: get().combos.map((c) =>
            c.comboId === comboId ? { ...c, cantidad } : c,
          ),
        });
      },

      removeCombo: (comboId) => {
        set({ combos: get().combos.filter((c) => c.comboId !== comboId) });
      },

      aplicarComboSugerido: (combo) => {
        const aReducir = new Map(
          combo.productos.map((p) => [p.productoId, p.cantidad]),
        );
        const cartFinal = get().cart.filter((item) => {
          const pendiente = aReducir.get(item.productoId) ?? 0;
          if (pendiente <= 0) return true;
          const quitar = Math.min(pendiente, item.cantidad);
          aReducir.set(item.productoId, pendiente - quitar);
          return item.cantidad - quitar > 0;
        });
        const comboCart: CartCombo = {
          comboId: combo.id,
          nombre: combo.nombre,
          cantidad: 1,
          precioUnitario: combo.resumen.precioCombo,
          precioOriginal: combo.resumen.precioOriginal,
          ahorro: combo.resumen.ahorro,
          productos: combo.productos.map((p) => ({
            nombre: p.producto?.nombre ?? '',
            cantidad: p.cantidad,
          })),
        };
        const existe = get().combos.some((c) => c.comboId === combo.id);
        set({
          cart: cartFinal,
          combos: existe
            ? get().combos.map((c) =>
                c.comboId === combo.id ? { ...c, cantidad: c.cantidad + 1 } : c,
              )
            : [...get().combos, comboCart],
        });
      },

      setDescuentoGeneral: (monto) => {
        set({ descuentoGeneral: monto });
      },

      setActiveSession: (session) => {
        set({ activeSession: session });
      },
    }),
    {
      name: 'cudii_pos_cart_storage',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
