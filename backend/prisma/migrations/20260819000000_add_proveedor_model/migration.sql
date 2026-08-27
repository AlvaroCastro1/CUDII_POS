-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rfc" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "contacto" TEXT,
    "notas" TEXT,
    "estaActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proveedor_empresaId_idx" ON "Proveedor"("empresaId");

-- CreateIndex
CREATE INDEX "Proveedor_empresaId_estaActivo_idx" ON "Proveedor"("empresaId", "estaActivo");

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: vincular lotes con proveedor
ALTER TABLE "Lote" ADD COLUMN "proveedorId" TEXT;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
