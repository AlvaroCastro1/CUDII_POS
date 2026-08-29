-- CreateEnum
CREATE TYPE "TipoDescuentoCupon" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- AlterTable: desglose del descuento por cupón en la venta
ALTER TABLE "Venta" ADD COLUMN     "descuentoCupon" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Cupon" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoDescuento" "TipoDescuentoCupon" NOT NULL,
    "valorDescuento" DOUBLE PRECISION NOT NULL,
    "montoMinimoCompra" DOUBLE PRECISION,
    "soloClientesRegistrados" BOOLEAN NOT NULL DEFAULT false,
    "limiteUsosTotal" INTEGER,
    "limiteUsosPorCliente" INTEGER,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuponRedencion" (
    "id" TEXT NOT NULL,
    "cuponId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "montoDescuento" DOUBLE PRECISION NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuponRedencion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cupon_empresaId_idx" ON "Cupon"("empresaId");

-- CreateIndex
CREATE INDEX "Cupon_empresaId_activo_idx" ON "Cupon"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Cupon_empresaId_codigo_key" ON "Cupon"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CuponRedencion_ventaId_key" ON "CuponRedencion"("ventaId");

-- CreateIndex
CREATE INDEX "CuponRedencion_cuponId_idx" ON "CuponRedencion"("cuponId");

-- CreateIndex
CREATE INDEX "CuponRedencion_cuponId_clienteId_idx" ON "CuponRedencion"("cuponId", "clienteId");

-- AddForeignKey
ALTER TABLE "Cupon" ADD CONSTRAINT "Cupon_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponRedencion" ADD CONSTRAINT "CuponRedencion_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponRedencion" ADD CONSTRAINT "CuponRedencion_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
