-- AlterTable: Reemplazar requiereLote por tieneCaducidad
-- 1. Agregar columna tieneCaducidad
ALTER TABLE "Producto" ADD COLUMN "tieneCaducidad" BOOLEAN NOT NULL DEFAULT false;

-- 2. Migrar datos: requiereLote=true -> tieneCaducidad=true
UPDATE "Producto" SET "tieneCaducidad" = true WHERE "requiereLote" = true;

-- 3. Eliminar columna requiereLote
ALTER TABLE "Producto" DROP COLUMN "requiereLote";
