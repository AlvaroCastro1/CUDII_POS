-- AlterTable: Agregar timestamps faltantes para auditoría
-- CreadoEn (creación) y actualizadoEn (última modificación)

-- Sucursal: agregar actualizadoEn
ALTER TABLE "Sucursal" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Caja: agregar ambos timestamps
ALTER TABLE "Caja" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Caja" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- InventarioSucursal: agregar ambos timestamps
ALTER TABLE "InventarioSucursal" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "InventarioSucursal" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DetalleVenta: agregar creadoEn
ALTER TABLE "DetalleVenta" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- PagoVenta: agregar creadoEn
ALTER TABLE "PagoVenta" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DetalleVentaLote: agregar creadoEn
ALTER TABLE "DetalleVentaLote" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- SesionCaja: agregar actualizadoEn
ALTER TABLE "SesionCaja" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CorteZ: agregar actualizadoEn
ALTER TABLE "CorteZ" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Devolucion: agregar actualizadoEn
ALTER TABLE "Devolucion" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DevolucionProducto: agregar creadoEn
ALTER TABLE "DevolucionProducto" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- NivelLealtad: agregar ambos timestamps
ALTER TABLE "NivelLealtad" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "NivelLealtad" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- MovimientoPuntos: agregar actualizadoEn
ALTER TABLE "MovimientoPuntos" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CuentaCreditoCliente: agregar actualizadoEn
ALTER TABLE "CuentaCreditoCliente" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AbonoCredito: agregar actualizadoEn
ALTER TABLE "AbonoCredito" ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
