-- AlterTable: Añade configuración de días de expiración para presupuestos.
ALTER TABLE "Empresa" ADD COLUMN "diasExpiracionPresupuesto" INTEGER NOT NULL DEFAULT 0;

-- AlterEnum: Añade el estado "vencido" para presupuestos expirados.
ALTER TYPE "EstadoPresupuesto" ADD VALUE 'vencido';
