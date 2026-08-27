-- CreateEnum
CREATE TYPE "TierLealtad" AS ENUM ('sin_tier', 'bronce', 'plata', 'oro', 'platino');

-- CreateEnum
CREATE TYPE "EstadoCredito" AS ENUM ('pendiente', 'parcialmente_pagada', 'liquidada', 'vencida');

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "clienteId" TEXT;

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "rfc" TEXT,
    "puntosActuales" INTEGER NOT NULL DEFAULT 0,
    "puntosHistoricos" INTEGER NOT NULL DEFAULT 0,
    "tier" "TierLealtad" NOT NULL DEFAULT 'sin_tier',
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaCreditoCliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "limiteCredito" DOUBLE PRECISION NOT NULL,
    "saldoPendiente" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diasMaximoVencimiento" INTEGER NOT NULL DEFAULT 30,
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuentaCreditoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaCredito" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "montoPagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldoPendiente" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoCredito" NOT NULL DEFAULT 'pendiente',
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "fechaLiquidacion" TIMESTAMP(3),
    "cuentaCreditoClienteId" TEXT,

    CONSTRAINT "VentaCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbonoCredito" (
    "id" TEXT NOT NULL,
    "ventaCreditoId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'efectivo',
    "referencia" TEXT,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbonoCredito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cliente_empresaId_idx" ON "Cliente"("empresaId");

-- CreateIndex
CREATE INDEX "Cliente_empresaId_estaActivo_idx" ON "Cliente"("empresaId", "estaActivo");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaCreditoCliente_clienteId_key" ON "CuentaCreditoCliente"("clienteId");

-- CreateIndex
CREATE INDEX "CuentaCreditoCliente_clienteId_idx" ON "CuentaCreditoCliente"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "VentaCredito_ventaId_key" ON "VentaCredito"("ventaId");

-- CreateIndex
CREATE INDEX "VentaCredito_clienteId_idx" ON "VentaCredito"("clienteId");

-- CreateIndex
CREATE INDEX "VentaCredito_estado_idx" ON "VentaCredito"("estado");

-- CreateIndex
CREATE INDEX "VentaCredito_fechaVencimiento_idx" ON "VentaCredito"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "AbonoCredito_ventaCreditoId_idx" ON "AbonoCredito"("ventaCreditoId");

-- CreateIndex
CREATE INDEX "Venta_clienteId_idx" ON "Venta"("clienteId");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCreditoCliente" ADD CONSTRAINT "CuentaCreditoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaCredito" ADD CONSTRAINT "VentaCredito_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaCredito" ADD CONSTRAINT "VentaCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaCredito" ADD CONSTRAINT "VentaCredito_cuentaCreditoClienteId_fkey" FOREIGN KEY ("cuentaCreditoClienteId") REFERENCES "CuentaCreditoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonoCredito" ADD CONSTRAINT "AbonoCredito_ventaCreditoId_fkey" FOREIGN KEY ("ventaCreditoId") REFERENCES "VentaCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonoCredito" ADD CONSTRAINT "AbonoCredito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

