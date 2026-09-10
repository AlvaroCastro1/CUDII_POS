export type EstadoSolicitudProveedor =
  | 'BORRADOR'
  | 'ENVIADA'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'RECIBIDA'
  | 'CANCELADA';

export interface SolicitudProveedorDetalle {
  id?: string;
  solicitudProveedorId?: string;
  productoId: string;
  nombreProducto: string;
  unidadMedida?: string;
  cantidadRequerida: number;
  costoUnitarioEstimado: number;
  subtotalEstimado: number;
  notas?: string | null;
  producto?: {
    id: string;
    nombre: string;
    codigoBarras: string;
    unidadMedida?: string;
    precioCompra?: number;
    tieneCaducidad?: boolean;
  };
}

export interface SolicitudProveedor {
  id: string;
  empresaId: string;
  proveedorId?: string | null;
  proveedor?: {
    id: string;
    nombre: string;
    rfc?: string | null;
    email?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    contacto?: string | null;
  } | null;
  creadoPorId: string;
  creadoPor?: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
  };
  folio: string;
  estado: EstadoSolicitudProveedor;
  fechaEmision: string;
  fechaEntregaEsperada?: string | null;
  notas?: string | null;
  totalEstimado: number;
  estaActivo?: boolean;
  eliminadoEn?: string | null;
  creadoEn: string;
  actualizadoEn: string;
  detalles: SolicitudProveedorDetalle[];
}
