/**
 * Tipos compartidos del módulo POS / Ventas / Devoluciones.
 * Centralizados aquí para eliminar dependencia de `any` en la capa de UI.
 */

export interface ProductoInventario {
  sucursalId: string;
  stockActual: number;
  stockMinimo?: number | null;
}

export interface Producto {
  id: string;
  codigoBarras: string;
  codigoInterno?: string | null;
  nombre: string;
  descripcion?: string | null;
  unidadMedida?: string | null;
  precioVentaBase: number;
  precioCompra?: number;
  esGranel?: boolean;
  estaActivo?: boolean;
  manejaInventario?: boolean;
  requiereLote?: boolean;
  inventario?: ProductoInventario[];
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string | null;
  colorHex?: string | null;
  icono?: string | null;
  estaActivo?: boolean;
}

export interface VentaPago {
  metodo: string;
  montoRecibido: number;
  montoPagado: number;
  cambio: number;
  referencia?: string | null;
}

export interface VentaDetalle {
  id?: string;
  productoId: string;
  nombreProducto?: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  descuento?: number;
  unidadMedida?: string;
}

export interface VentaDevolucionProducto {
  productoId: string;
  cantidadDevuelta: number;
}

export interface VentaDevolucion {
  id: string;
  folio?: string;
  productos?: VentaDevolucionProducto[];
}

export interface Venta {
  id: string;
  folio: string;
  total: number;
  subtotal?: number;
  descuentoGeneral?: number;
  creadoEn?: string;
  cajero?: { id: string; nombre?: string } | null;
  pagos?: VentaPago[];
  detalles?: VentaDetalle[];
  devoluciones?: VentaDevolucion[];
  metodoPago?: string;
}

export type TipoResolucionDevolucion =
  | 'reembolso_efectivo'
  | 'cambio_fisico'
  | 'saldo_favor';
