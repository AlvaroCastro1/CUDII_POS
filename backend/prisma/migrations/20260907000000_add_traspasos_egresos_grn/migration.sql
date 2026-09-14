-- CreateEnum
CREATE TYPE "CategoriaEgresoCaja" AS ENUM ('FLETE', 'LIMPIEZA', 'INSUMOS', 'PROPINAS', 'OTROS');

-- CreateEnum
CREATE TYPE "EstadoTraspaso" AS ENUM ('BORRADOR', 'EN_TRANSITO', 'RECIBIDO', 'RECIBIDO_PARCIAL', 'CANCELADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoMovimientoInventario" ADD VALUE 'ENTRADA_COMPRA';
ALTER TYPE "TipoMovimientoInventario" ADD VALUE 'SALIDA_TRASPASO';
ALTER TYPE "TipoMovimientoInventario" ADD VALUE 'ENTRADA_TRASPASO';

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "secuenciaTraspaso" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MovimientoInventario" ALTER COLUMN "stockAnterior" SET DEFAULT 0,
ALTER COLUMN "stockNuevo" SET DEFAULT 0,
ALTER COLUMN "motivo" SET DEFAULT '';

-- AlterTable
ALTER TABLE "RecepcionMercancia" ADD COLUMN     "folioFacturaProveedor" TEXT,
ADD COLUMN     "solicitudProveedorId" TEXT;

-- AlterTable
ALTER TABLE "SesionCaja" ADD COLUMN     "totalEgresos" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CorteX" ADD COLUMN     "totalEgresos" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CorteZ" ADD COLUMN     "totalEgresos" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EgresoCaja" (
    "id" TEXT NOT NULL,
    "sesionCajaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "categoria" "CategoriaEgresoCaja" NOT NULL DEFAULT 'OTROS',
    "concepto" TEXT NOT NULL,
    "comprobanteUrl" TEXT,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EgresoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Traspaso" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sucursalOrigenId" TEXT NOT NULL,
    "sucursalDestinoId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "recibidoPorId" TEXT,
    "folio" TEXT NOT NULL,
    "secuenciaFolio" INTEGER NOT NULL,
    "estado" "EstadoTraspaso" NOT NULL DEFAULT 'BORRADOR',
    "notasEmision" TEXT,
    "notasRecepcion" TEXT,
    "fechaSalida" TIMESTAMP(3),
    "fechaRecepcion" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Traspaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraspasoDetalle" (
    "id" TEXT NOT NULL,
    "traspasoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "loteId" TEXT,
    "nombreProducto" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL DEFAULT 'pieza',
    "cantidadEnviada" DOUBLE PRECISION NOT NULL,
    "cantidadRecibida" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraspasoDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EgresoCaja_sesionCajaId_idx" ON "EgresoCaja"("sesionCajaId");

-- CreateIndex
CREATE INDEX "EgresoCaja_usuarioId_idx" ON "EgresoCaja"("usuarioId");

-- CreateIndex
CREATE INDEX "Traspaso_empresaId_estado_idx" ON "Traspaso"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Traspaso_sucursalOrigenId_idx" ON "Traspaso"("sucursalOrigenId");

-- CreateIndex
CREATE INDEX "Traspaso_sucursalDestinoId_idx" ON "Traspaso"("sucursalDestinoId");

-- CreateIndex
CREATE UNIQUE INDEX "Traspaso_empresaId_folio_key" ON "Traspaso"("empresaId", "folio");

-- CreateIndex
CREATE INDEX "TraspasoDetalle_traspasoId_idx" ON "TraspasoDetalle"("traspasoId");

-- CreateIndex
CREATE INDEX "TraspasoDetalle_productoId_idx" ON "TraspasoDetalle"("productoId");

-- CreateIndex
CREATE INDEX "TraspasoDetalle_loteId_idx" ON "TraspasoDetalle"("loteId");

-- CreateEnum
CREATE TYPE "EstadoSolicitudProveedor" AS ENUM ('BORRADOR', 'ENVIADA', 'PARCIAL', 'COMPLETA', 'CANCELADA');

-- CreateTable
CREATE TABLE "SolicitudProveedor" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "proveedorId" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "estado" "EstadoSolicitudProveedor" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntregaEsperada" TIMESTAMP(3),
    "notas" TEXT,
    "totalEstimado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,
    "eliminadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudProveedorDetalle" (
    "id" TEXT NOT NULL,
    "solicitudProveedorId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL DEFAULT 'pieza',
    "cantidadRequerida" DOUBLE PRECISION NOT NULL,
    "costoUnitarioEstimado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalEstimado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudProveedorDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudProveedor_empresaId_folio_key" ON "SolicitudProveedor"("empresaId", "folio");
CREATE INDEX "SolicitudProveedor_empresaId_creadoEn_idx" ON "SolicitudProveedor"("empresaId", "creadoEn");
CREATE INDEX "SolicitudProveedor_empresaId_estado_idx" ON "SolicitudProveedor"("empresaId", "estado");
CREATE INDEX "SolicitudProveedor_empresaId_estaActivo_idx" ON "SolicitudProveedor"("empresaId", "estaActivo");
CREATE INDEX "SolicitudProveedor_proveedorId_idx" ON "SolicitudProveedor"("proveedorId");

-- CreateIndex
CREATE INDEX "SolicitudProveedorDetalle_solicitudProveedorId_idx" ON "SolicitudProveedorDetalle"("solicitudProveedorId");
CREATE INDEX "SolicitudProveedorDetalle_productoId_idx" ON "SolicitudProveedorDetalle"("productoId");

-- AddForeignKey
ALTER TABLE "SolicitudProveedor" ADD CONSTRAINT "SolicitudProveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitudProveedor" ADD CONSTRAINT "SolicitudProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SolicitudProveedor" ADD CONSTRAINT "SolicitudProveedor_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudProveedorDetalle" ADD CONSTRAINT "SolicitudProveedorDetalle_solicitudProveedorId_fkey" FOREIGN KEY ("solicitudProveedorId") REFERENCES "SolicitudProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SolicitudProveedorDetalle" ADD CONSTRAINT "SolicitudProveedorDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RecepcionMercancia_solicitudProveedorId_idx" ON "RecepcionMercancia"("solicitudProveedorId");

-- AddForeignKey
ALTER TABLE "RecepcionMercancia" ADD CONSTRAINT "RecepcionMercancia_solicitudProveedorId_fkey" FOREIGN KEY ("solicitudProveedorId") REFERENCES "SolicitudProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EgresoCaja" ADD CONSTRAINT "EgresoCaja_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EgresoCaja" ADD CONSTRAINT "EgresoCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traspaso" ADD CONSTRAINT "Traspaso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traspaso" ADD CONSTRAINT "Traspaso_sucursalOrigenId_fkey" FOREIGN KEY ("sucursalOrigenId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traspaso" ADD CONSTRAINT "Traspaso_sucursalDestinoId_fkey" FOREIGN KEY ("sucursalDestinoId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traspaso" ADD CONSTRAINT "Traspaso_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traspaso" ADD CONSTRAINT "Traspaso_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraspasoDetalle" ADD CONSTRAINT "TraspasoDetalle_traspasoId_fkey" FOREIGN KEY ("traspasoId") REFERENCES "Traspaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraspasoDetalle" ADD CONSTRAINT "TraspasoDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraspasoDetalle" ADD CONSTRAINT "TraspasoDetalle_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

