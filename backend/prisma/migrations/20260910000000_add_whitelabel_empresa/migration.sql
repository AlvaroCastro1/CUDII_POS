-- Whitelabel: agregar campo de configuración visual por empresa/tenant
-- Este campo persiste el objeto TemaWhitelabelContext completo (colores, tipografía, logos, UI)
ALTER TABLE "Empresa" ADD COLUMN "configuracionWhitelabel" JSONB;
