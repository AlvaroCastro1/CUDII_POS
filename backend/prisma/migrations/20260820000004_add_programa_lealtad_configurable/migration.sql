-- ============================================================
-- D10: Programa de Lealtad Configurable
-- - Crea ProgramaLealtad (config por empresa) y NivelLealtad (rangos dinámicos)
-- - Siembra 4 niveles default por empresa existente
-- - Mapea el tier actual de cada cliente a su nuevo nivel
-- - Elimina la columna "tier" y el enum "TierLealtad"
-- ============================================================

-- 1. Nuevo enum para la base de cálculo de puntos
CREATE TYPE "BasePuntos" AS ENUM ('CON_DESCUENTO', 'SIN_DESCUENTO');

-- 2. Tabla de configuración del programa (1-a-1 con Empresa)
CREATE TABLE "ProgramaLealtad" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "puntosPorMonto" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "montoMinimoParaPuntos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basePuntos" "BasePuntos" NOT NULL DEFAULT 'CON_DESCUENTO',
    "permitirCanje" BOOLEAN NOT NULL DEFAULT false,
    "puntosPorPesos" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "canjeMinimoPuntos" INTEGER NOT NULL DEFAULT 100,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramaLealtad_pkey" PRIMARY KEY ("id")
);

-- 3. Tabla de niveles dinámicos del programa
CREATE TABLE "NivelLealtad" (
    "id" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "umbralPuntos" INTEGER NOT NULL,
    "descuentoPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "colorHex" TEXT,

    CONSTRAINT "NivelLealtad_pkey" PRIMARY KEY ("id")
);

-- 4. Nueva columna de nivel en Cliente (aún sin FK para poder mapear)
ALTER TABLE "Cliente" ADD COLUMN "nivelLealtadId" TEXT;

-- 5. Siembran configuración y niveles default por cada empresa existente
INSERT INTO "ProgramaLealtad" ("id", "empresaId", "actualizadoEn")
SELECT gen_random_uuid()::text, e."id", CURRENT_TIMESTAMP
FROM "Empresa" e;

INSERT INTO "NivelLealtad" ("id", "programaId", "nombre", "umbralPuntos", "descuentoPct", "colorHex")
SELECT
    gen_random_uuid()::text,
    p."id",
    n.nombre,
    n.umbral,
    n.descuento,
    n.color
FROM "ProgramaLealtad" p
CROSS JOIN (VALUES
    ('Bronce',  100,  0.0, '#CD7F32'),
    ('Plata',   500,  3.0, '#9CA3AF'),
    ('Oro',    1500,  5.0, '#F59E0B'),
    ('Platino', 5000, 10.0, '#06B6D4')
) AS n(nombre, umbral, descuento, color);

-- 6. Mapear clientes existentes a su nuevo nivel según su tier anterior
UPDATE "Cliente" c
SET "nivelLealtadId" = nl."id"
FROM "NivelLealtad" nl
JOIN "ProgramaLealtad" p ON p."id" = nl."programaId"
WHERE c."empresaId" = p."empresaId"
  AND (
       (c."tier" = 'bronce'  AND nl."nombre" = 'Bronce')
    OR (c."tier" = 'plata'   AND nl."nombre" = 'Plata')
    OR (c."tier" = 'oro'     AND nl."nombre" = 'Oro')
    OR (c."tier" = 'platino' AND nl."nombre" = 'Platino')
  );

-- 7. Índices y llaves foráneas
CREATE UNIQUE INDEX "ProgramaLealtad_empresaId_key" ON "ProgramaLealtad"("empresaId");
CREATE INDEX "ProgramaLealtad_empresaId_idx" ON "ProgramaLealtad"("empresaId");
CREATE INDEX "NivelLealtad_programaId_idx" ON "NivelLealtad"("programaId");
CREATE INDEX "Cliente_nivelLealtadId_idx" ON "Cliente"("nivelLealtadId");

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_nivelLealtadId_fkey" FOREIGN KEY ("nivelLealtadId") REFERENCES "NivelLealtad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramaLealtad" ADD CONSTRAINT "ProgramaLealtad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NivelLealtad" ADD CONSTRAINT "NivelLealtad_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaLealtad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Eliminar columna y enum antiguos (ya mapeados)
ALTER TABLE "Cliente" DROP COLUMN "tier";
DROP TYPE "TierLealtad";
