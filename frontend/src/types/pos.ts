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
  tieneCaducidad?: boolean;
  metodoRotacion?: 'FIFO' | 'FEFO';
  preciosPorUnidad?: PrecioPorUnidad[];
  inventario?: ProductoInventario[];
}

export interface PrecioPorUnidad {
  id: string;
  unidad: string;
  nombreAlternativo?: string | null;
  cantidadMinima: number;
  precio: number;
  esDefault?: boolean;
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
  lotes?: {
    id: string;
    loteId: string;
    cantidad: number;
    lote?: { id: string; codigoLote: string } | null;
  }[];
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

export type EstadoLote = 'activo' | 'agotado' | 'vencido';
export type MotivoMerma =
  | 'caducado'
  | 'danado'
  | 'robo'
  | 'perdida'
  | 'error'
  | 'otro';

export interface Lote {
  id: string;
  codigoLote: string;
  productoId: string;
  sucursalId: string;
  fechaRecepcion: string;
  fechaFabricacion?: string | null;
  fechaCaducidad?: string | null;
  cantidadInicial: number;
  cantidadRestante: number;
  costoUnitario: number;
  proveedor?: string | null;
  estado: EstadoLote;
  producto?: { id: string; nombre: string; codigoBarras: string; unidadMedida?: string | null; esGranel?: boolean };
  sucursal?: { id: string; nombre: string };
}

export interface LoteMovimiento {
  id: string;
  tipo: string;
  cantidad: number;
  motivo?: string | null;
  fechaHora: string;
  usuario?: { nombre?: string } | null;
}

export interface LoteDetalle extends Lote {
  movimientos?: LoteMovimiento[];
  creadoPor?: { nombre?: string } | null;
}

export interface RecepcionDetalle {
  productoId: string;
  nombreProducto?: string;
  cantidad: number;
  costoUnitario: number;
  loteId?: string;
  lote?: { id: string; codigoLote: string } | null;
  producto?: { id: string; nombre: string; unidadMedida?: string | null; esGranel?: boolean; tieneCaducidad?: boolean };
}

export interface RecepcionMercancia {
  id: string;
  folio: string;
  proveedor?: string | null;
  fechaRecepcion: string;
  notas?: string | null;
  creadoPor?: { nombre?: string } | null;
  detalles?: RecepcionDetalle[];
}

export interface VencimientoInfo {
  diasPreaviso?: number;
  porVencer: { id: string; codigoLote: string; productoId: string; nombreProducto: string; cantidadRestante: number; fechaCaducidad: string; dias: number; costoUnitario: number }[];
  vencidos: { id: string; codigoLote: string; productoId: string; nombreProducto: string; cantidadRestante: number; fechaCaducidad: string; dias: number; costoUnitario: number }[];
  totalPorVencer: number;
  totalVencidos: number;
  valorPorVencer?: number;
  valorVencidos?: number;
}
