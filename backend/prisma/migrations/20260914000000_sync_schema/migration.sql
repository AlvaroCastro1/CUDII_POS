-- AlterEnum
BEGIN;
CREATE TYPE "EstadoSolicitudProveedor_new" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'RECIBIDA', 'CANCELADA');
ALTER TABLE "SolicitudProveedor" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "SolicitudProveedor" ALTER COLUMN "estado" TYPE "EstadoSolicitudProveedor_new" USING ("estado"::text::"EstadoSolicitudProveedor_new");
ALTER TYPE "EstadoSolicitudProveedor" RENAME TO "EstadoSolicitudProveedor_old";
ALTER TYPE "EstadoSolicitudProveedor_new" RENAME TO "EstadoSolicitudProveedor";
DROP TYPE "EstadoSolicitudProveedor_old";
ALTER TABLE "SolicitudProveedor" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';
COMMIT;

-- AlterTable
ALTER TABLE "AbonoCredito" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Caja" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CorteZ" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CuentaCreditoCliente" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Devolucion" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "configuracionTicket" JSONB,
ADD COLUMN     "secuenciaSolicitudProveedor" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventarioSucursal" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NivelLealtad" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProgramaLealtad" ADD COLUMN     "mesesExpiracionPuntos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SesionCaja" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Sucursal" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "preferenciasDashboard" JSONB;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "descuentoCanje" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "descuentoNivel" DOUBLE PRECISION NOT NULL DEFAULT 0;

