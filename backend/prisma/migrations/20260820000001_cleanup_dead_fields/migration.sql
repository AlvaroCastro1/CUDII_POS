-- AlterTable
ALTER TABLE "Caja" DROP COLUMN "codigo";

-- AlterTable
ALTER TABLE "LogActividad" DROP COLUMN "agenteUsuario",
DROP COLUMN "direccionIP";

-- AlterTable
ALTER TABLE "Sucursal" DROP COLUMN "direccion";

-- AlterTable
ALTER TABLE "Venta" DROP COLUMN "notas";

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

