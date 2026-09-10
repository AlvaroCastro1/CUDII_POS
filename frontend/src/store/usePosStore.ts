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
  /** D12: línea cargada desde un presupuesto con combo (snapshot del nombre). */
  comboId?: string;
  nombreCombo?: string;
  /** D12: precio congelado al crear el presupuesto (solo en líneas cargadas de uno). */
  precioCongelado?: number;
  /** D12: precio vigente del catálogo al cargar el presupuesto (solo líneas cargadas). */
  precioActual?: number;
  /** D12: si el cargo usa el precio congelado (Empresa.conservarPrecioPresupuesto). */
  conservarPrecio?: boolean;
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
  totalEgresos?: number;
  estado: 'abierta' | 'cerrada';
  caja: {
    id: string;
    nombre: string;
    codigo: string | null;
  };
}

/** Clave estable de una línea del ticket (producto o combo) para rastrear su orden. */
export type ClaveLinea = `p:${string}:${string}` | `c:${string}`;

interface PosStoreState {
  cart: CartItem[];
  combos: CartCombo[];
  activeSession: SesionCajaState | null;
  descuentoGeneral: number;
  /** Orden de adición de las líneas (producto/combo) para atajos tipo "quitar último". */
  ordenAdicion: ClaveLinea[];
  /** D12: ID del presupuesto activo cargado en el ticket (si viene de una cotización). */
  presupuestoActivoId: string | null;

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
  /** Elimina la línea agregada por último (producto o combo). Devuelve true si eliminó algo. */
  quitarUltimaLinea: () => boolean;
  setDescuentoGeneral: (monto: number) => void;
  setActiveSession: (session: SesionCajaState | null) => void;
  addCombo: (combo: Omit<CartCombo, 'cantidad'>, cantidad?: number) => void;
  updateComboQuantity: (comboId: string, cantidad: number) => void;
  removeCombo: (comboId: string) => void;
  aplicarComboSugerido: (combo: ComboConResumen) => void;
  /** D12: registra el presupuesto del que proviene el ticket (o null al limpiar). */
  setPresupuestoActivo: (presupuestoId: string | null) => void;
  /** D12: reemplaza el ticket con las líneas congeladas de un presupuesto. */
  cargarPresupuesto: (lineas: LineaPresupuesto, descuentoGeneral?: number) => void;
}

/** D12: Líneas congeladas de un presupuesto listas para cargarse al ticket del POS. */
export interface LineaPresupuesto {
  productos: (Omit<CartItem, 'comboId' | 'nombreCombo'> & { comboId?: string; nombreCombo?: string })[];
  combos: CartCombo[];
}

export const usePosStore = create<PosStoreState>()(
  persist(
    (set, get) => ({
      cart: [],
      combos: [],
      activeSession: null,
      descuentoGeneral: 0,
      ordenAdicion: [],
      presupuestoActivoId: null,

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
          const clave: ClaveLinea = `p:${producto.id}:${presentacionId || ''}`;
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
            ordenAdicion: [...get().ordenAdicion, clave],
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
        set({
          cart: [],
          combos: [],
          descuentoGeneral: 0,
          ordenAdicion: [],
          presupuestoActivoId: null,
        });
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
            ordenAdicion: [
              ...get().ordenAdicion,
              `c:${combo.comboId}` as ClaveLinea,
            ],
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

      /** Quita la línea agregada por último (producto o combo). Devuelve true si eliminó algo. */
      quitarUltimaLinea: () => {
        const orden = get().ordenAdicion;
        if (orden.length === 0) return false;

        // Buscar la última clave cuya línea todavía exista en el ticket.
        const cart = get().cart;
        const combos = get().combos;
        for (let i = orden.length - 1; i >= 0; i--) {
          const clave = orden[i];
          if (clave.startsWith('p:')) {
            const [_, productoId, presentacionId] = clave.split(':');
            const existe = cart.some(
              (item) =>
                item.productoId === productoId &&
                (item.presentacionId || '') === (presentacionId || ''),
            );
            if (existe) {
              set({
                cart: cart.filter(
                  (item) =>
                    !(
                      item.productoId === productoId &&
                      (item.presentacionId || '') === (presentacionId || '')
                    ),
                ),
                ordenAdicion: orden.filter((_, idx) => idx !== i),
              });
              return true;
            }
          } else {
            const comboId = clave.slice(2);
            if (combos.some((c) => c.comboId === comboId)) {
              set({
                combos: combos.filter((c) => c.comboId !== comboId),
                ordenAdicion: orden.filter((_, idx) => idx !== i),
              });
              return true;
            }
          }
        }
        return false;
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
          ordenAdicion: existe
            ? get().ordenAdicion
            : [...get().ordenAdicion, `c:${combo.id}` as ClaveLinea],
        });
      },

      setDescuentoGeneral: (monto) => {
        set({ descuentoGeneral: monto });
      },

      setActiveSession: (session) => {
        set({ activeSession: session });
      },

      /** D12: registra el presupuesto del que proviene el ticket (o null al limpiar). */
      setPresupuestoActivo: (presupuestoId) => {
        set({ presupuestoActivoId: presupuestoId });
      },

      /**
       * D12: Reemplaza el ticket con las líneas congeladas de un presupuesto.
       * Restaura el descuento general del presupuesto y el orden de adición,
       * para que el POdel mismo flujo de cobro (CheckoutModal) lo cobre por `presupuestoId`.
       */
      cargarPresupuesto: (lineas, descuentoGeneral = 0) => {
        const orden: ClaveLinea[] = [
          ...lineas.productos.map(
            (p) => `p:${p.productoId}:${p.presentacionId || ''}` as ClaveLinea,
          ),
          ...lineas.combos.map((c) => `c:${c.comboId}` as ClaveLinea),
        ];
        set({
          cart: lineas.productos.map((p) => ({ ...p, descuento: p.descuento || 0 })),
          combos: lineas.combos,
          descuentoGeneral,
          ordenAdicion: orden,
        });
      },
    }),
    {
      name: 'cudii_pos_cart_storage',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
