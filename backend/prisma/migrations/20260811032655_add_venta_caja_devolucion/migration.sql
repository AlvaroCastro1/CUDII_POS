-- CreateEnum
CREATE TYPE "ModoCorteZ" AS ENUM ('ciego', 'abierto');

-- CreateEnum
CREATE TYPE "EstadoSesionCaja" AS ENUM ('abierta', 'cerrada');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('completada', 'cancelada', 'reembolsada');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'voucher', 'credito');

-- CreateEnum
CREATE TYPE "TipoResolucionDevolucion" AS ENUM ('reembolso_efectivo', 'cambio_fisico', 'saldo_favor');

-- CreateEnum
CREATE TYPE "MotivoDevolucion" AS ENUM ('cambio_opinion', 'cambio_talla', 'danado', 'caducado', 'error_cobro');

-- CreateEnum
CREATE TYPE "DestinoDevolucion" AS ENUM ('stock', 'merma');

-- AlterTable
ALTER TABLE "Caja" ADD COLUMN     "secuenciaFolio" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "modoCorteZ" "ModoCorteZ" NOT NULL DEFAULT 'ciego';

-- CreateTable
CREATE TABLE "SesionCaja" (
    "id" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "cajeroId" TEXT NOT NULL,
    "montoInicial" DOUBLE PRECISION NOT NULL,
    "montoFinalEfectivo" DOUBLE PRECISION,
    "montoEsperadoEfectivo" DOUBLE PRECISION,
    "diferenciaEfectivo" DOUBLE PRECISION,
    "modoCorteUsado" "ModoCorteZ" NOT NULL DEFAULT 'ciego',
    "totalVentasEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVentasTarjeta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVentasOtros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRetiros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" "EstadoSesionCaja" NOT NULL DEFAULT 'abierta',
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),

    CONSTRAINT "SesionCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetiroParcial" (
    "id" TEXT NOT NULL,
    "sesionCajaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetiroParcial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorteX" (
    "id" TEXT NOT NULL,
    "sesionCajaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "totalVentasEfectivo" DOUBLE PRECISION NOT NULL,
    "totalVentasTarjeta" DOUBLE PRECISION NOT NULL,
    "montoInicial" DOUBLE PRECISION NOT NULL,
    "montoRetiros" DOUBLE PRECISION NOT NULL,
    "efectivoEnCaja" DOUBLE PRECISION NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorteX_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorteZ" (
    "id" TEXT NOT NULL,
    "sesionCajaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "montoInicial" DOUBLE PRECISION NOT NULL,
    "totalVentasEfectivo" DOUBLE PRECISION NOT NULL,
    "totalVentasTarjeta" DOUBLE PRECISION NOT NULL,
    "totalRetiros" DOUBLE PRECISION NOT NULL,
    "montoEsperado" DOUBLE PRECISION NOT NULL,
    "montoDeclarado" DOUBLE PRECISION NOT NULL,
    "diferencia" DOUBLE PRECISION NOT NULL,
    "modoCorte" "ModoCorteZ" NOT NULL,
    "notas" TEXT,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorteZ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "sesionCajaId" TEXT NOT NULL,
    "cajeroId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "secuenciaFolio" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impuestos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'completada',
    "esDemostracion" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "costoHistorico" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impuestos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DetalleVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "montoRecibido" DOUBLE PRECISION NOT NULL,
    "montoPagado" DOUBLE PRECISION NOT NULL,
    "cambio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "referencia" TEXT,

    CONSTRAINT "PagoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devolucion" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "sesionCajaId" TEXT,
    "folio" TEXT NOT NULL,
    "totalDevuelto" DOUBLE PRECISION NOT NULL,
    "tipoResolucion" "TipoResolucionDevolucion" NOT NULL,
    "motivoGeneral" TEXT,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Devolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucionProducto" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadDevuelta" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "motivo" "MotivoDevolucion" NOT NULL,
    "destino" "DestinoDevolucion" NOT NULL,

    CONSTRAINT "DevolucionProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CorteZ_sesionCajaId_key" ON "CorteZ"("sesionCajaId");

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiroParcial" ADD CONSTRAINT "RetiroParcial_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiroParcial" ADD CONSTRAINT "RetiroParcial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorteX" ADD CONSTRAINT "CorteX_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorteX" ADD CONSTRAINT "CorteX_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorteZ" ADD CONSTRAINT "CorteZ_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorteZ" ADD CONSTRAINT "CorteZ_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoVenta" ADD CONSTRAINT "PagoVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionProducto" ADD CONSTRAINT "DevolucionProducto_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "Devolucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionProducto" ADD CONSTRAINT "DevolucionProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
