SELECT "empresaId", "folio", COUNT(*) FROM "Venta" GROUP BY "empresaId", "folio" HAVING COUNT(*) > 1;
