-- CreateEnum
CREATE TYPE "TipoMovimientoPuntos" AS ENUM ('GANADO', 'CANJEADO', 'EXPIRADO', 'AJUSTE');

-- CreateTable
CREATE TABLE "MovimientoPuntos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "ventaId" TEXT,
    "tipo" "TipoMovimientoPuntos" NOT NULL,
    "puntos" INTEGER NOT NULL,
    "expiraEn" TIMESTAMP(3),
    "puntosConsumidos" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimientoPuntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimientoPuntos_clienteId_creadoEn_idx" ON "MovimientoPuntos"("clienteId", "creadoEn");
CREATE INDEX "MovimientoPuntos_tipo_expiraEn_idx" ON "MovimientoPuntos"("tipo", "expiraEn");

-- AddForeignKey
ALTER TABLE "MovimientoPuntos" ADD CONSTRAINT "MovimientoPuntos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovimientoPuntos" ADD CONSTRAINT "MovimientoPuntos_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
