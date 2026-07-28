-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('venta', 'devolucion_venta', 'ajuste_positivo', 'ajuste_negativo', 'traspaso_salida', 'traspaso_entrada', 'compra', 'apertura_inicial');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rfc" TEXT,
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caja" (
    "id" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CAJERO',
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "codigoBarras" TEXT NOT NULL,
    "codigoInterno" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadMedida" TEXT NOT NULL DEFAULT 'pieza',
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,
    "esGranel" BOOLEAN NOT NULL DEFAULT false,
    "requiereLote" BOOLEAN NOT NULL DEFAULT false,
    "manejaInventario" BOOLEAN NOT NULL DEFAULT true,
    "precioCompra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioVentaBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioPorUnidad" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "nombreAlternativo" TEXT,
    "cantidadMinima" DOUBLE PRECISION NOT NULL,
    "cantidadMaxima" DOUBLE PRECISION,
    "precio" DOUBLE PRECISION NOT NULL,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PrecioPorUnidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventarioSucursal" (
    "id" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "stockActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMaximo" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "ultimoMovimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventarioSucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "stockAnterior" DOUBLE PRECISION NOT NULL,
    "stockNuevo" DOUBLE PRECISION NOT NULL,
    "referencia" TEXT,
    "motivo" TEXT,
    "usuarioId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InventarioSucursal_sucursalId_productoId_key" ON "InventarioSucursal"("sucursalId", "productoId");

-- AddForeignKey
ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioPorUnidad" ADD CONSTRAINT "PrecioPorUnidad_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioSucursal" ADD CONSTRAINT "InventarioSucursal_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioSucursal" ADD CONSTRAINT "InventarioSucursal_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
