-- CreateEnum
CREATE TYPE "TipoPrecioCombo" AS ENUM ('MONTO_FIJO', 'DESCUENTO_PCT');

-- AlterTable
ALTER TABLE "DetalleVenta" ADD COLUMN     "comboId" TEXT,
ADD COLUMN     "nombreCombo" TEXT;

-- CreateTable
CREATE TABLE "Combo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoPrecio" "TipoPrecioCombo" NOT NULL DEFAULT 'MONTO_FIJO',
    "valorPrecio" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Combo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboProducto" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ComboProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Combo_empresaId_activo_idx" ON "Combo"("empresaId", "activo");

-- CreateIndex
CREATE INDEX "Combo_empresaId_fechaInicio_fechaFin_idx" ON "Combo"("empresaId", "fechaInicio", "fechaFin");

-- CreateIndex
CREATE UNIQUE INDEX "ComboProducto_comboId_productoId_key" ON "ComboProducto"("comboId", "productoId");

-- CreateIndex
CREATE INDEX "DetalleVenta_comboId_idx" ON "DetalleVenta"("comboId");

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Combo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combo" ADD CONSTRAINT "Combo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combo" ADD CONSTRAINT "Combo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboProducto" ADD CONSTRAINT "ComboProducto_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Combo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboProducto" ADD CONSTRAINT "ComboProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;