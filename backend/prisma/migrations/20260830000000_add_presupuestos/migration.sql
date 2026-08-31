-- CreateEnum
CREATE TYPE "EstadoPresupuesto" AS ENUM ('abierto', 'vendido', 'cancelado');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "conservarPrecioPresupuesto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "secuenciaPresupuesto" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "cajeroId" TEXT NOT NULL,
    "clienteId" TEXT,
    "folio" TEXT NOT NULL,
    "secuenciaFolio" INTEGER NOT NULL,
    "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'abierto',
    "subtotal" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impuestos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "descuentoNivel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoCanje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoCupon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoGeneral" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "codigoCupon" TEXT,
    "puntosACanjear" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoDetalle" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "comboId" TEXT,
    "nombreCombo" TEXT,
    "nombreProducto" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresupuestoDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Presupuesto_empresaId_creadoEn_idx" ON "Presupuesto"("empresaId", "creadoEn");

-- CreateIndex
CREATE INDEX "Presupuesto_empresaId_estado_idx" ON "Presupuesto"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Presupuesto_clienteId_idx" ON "Presupuesto"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Presupuesto_empresaId_folio_key" ON "Presupuesto"("empresaId", "folio");

-- CreateIndex
CREATE INDEX "PresupuestoDetalle_presupuestoId_idx" ON "PresupuestoDetalle"("presupuestoId");

-- CreateIndex
CREATE INDEX "PresupuestoDetalle_productoId_idx" ON "PresupuestoDetalle"("productoId");

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoDetalle" ADD CONSTRAINT "PresupuestoDetalle_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoDetalle" ADD CONSTRAINT "PresupuestoDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoDetalle" ADD CONSTRAINT "PresupuestoDetalle_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Combo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
