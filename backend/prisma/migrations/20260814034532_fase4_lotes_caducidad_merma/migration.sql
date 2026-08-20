-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('activo', 'agotado', 'vencido');

-- CreateEnum
CREATE TYPE "MetodoRotacion" AS ENUM ('FIFO', 'FEFO');

-- CreateEnum
CREATE TYPE "MotivoMerma" AS ENUM ('caducado', 'danado', 'robo', 'perdida', 'error', 'otro');

-- AlterEnum
ALTER TYPE "TipoMovimientoInventario" ADD VALUE 'merma';

-- AlterTable
ALTER TABLE "DevolucionProducto" ADD COLUMN     "loteId" TEXT;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "bloquearVentaVencidos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "diasCaducidadPreaviso" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "MovimientoInventario" ADD COLUMN     "loteId" TEXT;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "metodoRotacion" "MetodoRotacion" NOT NULL DEFAULT 'FEFO';

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "codigoLote" TEXT NOT NULL,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFabricacion" TIMESTAMP(3),
    "fechaCaducidad" TIMESTAMP(3),
    "cantidadInicial" DOUBLE PRECISION NOT NULL,
    "cantidadRestante" DOUBLE PRECISION NOT NULL,
    "costoUnitario" DOUBLE PRECISION NOT NULL,
    "proveedor" TEXT,
    "estado" "EstadoLote" NOT NULL DEFAULT 'activo',
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionMercancia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "proveedor" TEXT,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecepcionMercancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionDetalle" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costoUnitario" DOUBLE PRECISION NOT NULL,
    "codigoLote" TEXT,
    "fechaFabricacion" TIMESTAMP(3),
    "fechaCaducidad" TIMESTAMP(3),

    CONSTRAINT "RecepcionDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleVentaLote" (
    "id" TEXT NOT NULL,
    "detalleVentaId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costoUnitario" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DetalleVentaLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merma" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "loteId" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "motivo" "MotivoMerma" NOT NULL,
    "costoUnitario" DOUBLE PRECISION NOT NULL,
    "costoTotal" DOUBLE PRECISION NOT NULL,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lote_sucursalId_productoId_fechaCaducidad_idx" ON "Lote"("sucursalId", "productoId", "fechaCaducidad");

-- CreateIndex
CREATE INDEX "Lote_empresaId_estado_idx" ON "Lote"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "RecepcionMercancia_empresaId_idx" ON "RecepcionMercancia"("empresaId");

-- CreateIndex
CREATE INDEX "RecepcionMercancia_sucursalId_idx" ON "RecepcionMercancia"("sucursalId");

-- CreateIndex
CREATE INDEX "DetalleVentaLote_loteId_idx" ON "DetalleVentaLote"("loteId");

-- CreateIndex
CREATE INDEX "Merma_empresaId_idx" ON "Merma"("empresaId");

-- CreateIndex
CREATE INDEX "Merma_sucursalId_productoId_idx" ON "Merma"("sucursalId", "productoId");

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionMercancia" ADD CONSTRAINT "RecepcionMercancia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionMercancia" ADD CONSTRAINT "RecepcionMercancia_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionMercancia" ADD CONSTRAINT "RecepcionMercancia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionDetalle" ADD CONSTRAINT "RecepcionDetalle_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "RecepcionMercancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionDetalle" ADD CONSTRAINT "RecepcionDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVentaLote" ADD CONSTRAINT "DetalleVentaLote_detalleVentaId_fkey" FOREIGN KEY ("detalleVentaId") REFERENCES "DetalleVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVentaLote" ADD CONSTRAINT "DetalleVentaLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionProducto" ADD CONSTRAINT "DevolucionProducto_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
