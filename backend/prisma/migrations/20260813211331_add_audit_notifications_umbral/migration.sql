-- AlterTable
ALTER TABLE "CorteZ" ADD COLUMN     "autorizadoPorId" TEXT,
ADD COLUMN     "tipoDiscrepancia" TEXT;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "umbralFaltanteCritico" DOUBLE PRECISION NOT NULL DEFAULT 50.0;

-- CreateTable
CREATE TABLE "LogActividad" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "detalles" JSONB NOT NULL,
    "severidad" TEXT NOT NULL DEFAULT 'info',
    "direccionIP" TEXT,
    "agenteUsuario" TEXT,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "entidadTipo" TEXT,
    "entidadId" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogActividad_empresaId_idx" ON "LogActividad"("empresaId");

-- CreateIndex
CREATE INDEX "LogActividad_usuarioId_idx" ON "LogActividad"("usuarioId");

-- CreateIndex
CREATE INDEX "LogActividad_entidadTipo_entidadId_idx" ON "LogActividad"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "LogActividad_fechaHora_idx" ON "LogActividad"("fechaHora");

-- CreateIndex
CREATE INDEX "Notificacion_destinatarioId_leida_idx" ON "Notificacion"("destinatarioId", "leida");

-- CreateIndex
CREATE INDEX "Notificacion_empresaId_idx" ON "Notificacion"("empresaId");

-- CreateIndex
CREATE INDEX "Notificacion_fechaHora_idx" ON "Notificacion"("fechaHora");

-- AddForeignKey
ALTER TABLE "CorteZ" ADD CONSTRAINT "CorteZ_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogActividad" ADD CONSTRAINT "LogActividad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogActividad" ADD CONSTRAINT "LogActividad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
