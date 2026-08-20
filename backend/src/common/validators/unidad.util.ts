/**
 * Unidades de medida que representan unidades discretas (enteras).
 * Cualquier unidad no listada se considera continua (permite decimales).
 */
const UNIDADES_DISCRETAS = new Set([
  'pieza',
  'piezas',
  'pza',
  'pzas',
  'caja',
  'cajas',
  'docena',
  'docenas',
  'doc',
  'par',
  'pares',
  'media docena',
  'half dozen',
  'docena y media',
  'turno',
  'servicio',
  '-kit',
]);

/**
 * Unidades de medida que representan magnitudes continuas (permite decimales).
 * Solo para documentación — cualquier unidad no discreta se considera continua.
 */
// kilogramo, gramo, litro, mililitro, metro, centimetro, tonelada, galón, onza, lb, etc.

/**
 * Determina si una unidad de medida requiere cantidades enteras.
 * Unidades discretas: pieza, caja, docena, par, etc.
 * Unidades continuas: kilogramo, litro, metro, gramo, etc.
 */
export function isUnidadDiscreta(unidadMedida: string | null | undefined): boolean {
  if (!unidadMedida) return true; // Por defecto, tratar como discreta (seguro)
  return UNIDADES_DISCRETAS.has(unidadMedida.toLowerCase().trim());
}

/**
 * Redondea una cantidad al entero más cercano si la unidad es discreta.
 * Para unidades continuas, retorna el valor sin cambios.
 */
export function redondearSegunUnidad(
  cantidad: number,
  unidadMedida: string | null | undefined,
): number {
  if (isUnidadDiscreta(unidadMedida)) {
    return Math.round(cantidad);
  }
  // Para granel: redondear a 3 decimales máximo (milésimas)
  return Math.round(cantidad * 1000) / 1000;
}

/**
 * Valida que una cantidad sea entera si la unidad es discreta.
 * Lanza BadRequestException si no cumple.
 */
export function validarCantidadSegunUnidad(
  cantidad: number,
  unidadMedida: string | null | undefined,
  contexto: string = 'operación',
): void {
  if (isUnidadDiscreta(unidadMedida)) {
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new (require('@nestjs/common').BadRequestException)(
        `El producto es por ${unidadMedida || 'pieza'}. La cantidad en ${contexto} debe ser un número entero mayor a 0. Valor recibido: ${cantidad}`,
      );
    }
  }
  if (cantidad <= 0) {
    throw new (require('@nestjs/common').BadRequestException)(
      `La cantidad debe ser mayor a 0 en ${contexto}. Valor recibido: ${cantidad}`,
    );
  }
}

/**
 * Distribuye una cantidad total entre N partes de forma proporcional,
 * garantizando que:
 * - Todas las partes sean enteros si la unidad es discreta
 * - La suma de las partes sea exactamente igual al total
 * - Se asigna el redondeo extra a la parte con mayor fracción pendiente
 *
 * Ejemplo (discreta): distribuir 5 entre 2 partes con shares [0.6, 0.4]
 *   → partes crudas: [3.0, 2.0] → enteros: [3, 2] → suma = 5 ✓
 *
 * Ejemplo (discreta): distribuir 5 entre 3 partes con shares [0.333, 0.333, 0.333]
 *   → partes crudas: [1.666, 1.666, 1.666] → floors: [1, 1, 1] → remainder: 2
 *   → asignar 1 extra a las 2 mayores fracciones → [2, 2, 1] → suma = 5 ✓
 */
export function distribuirProporcional(
  total: number,
  shares: number[],
  unidadMedida: string | null | undefined,
): number[] {
  if (shares.length === 0) return [];
  if (shares.length === 1) {
    return [redondearSegunUnidad(total, unidadMedida)];
  }

  const sumaShares = shares.reduce((a, b) => a + b, 0);
  if (sumaShares === 0) return shares.map(() => 0);

  // Calcular partes crudas proporcionalmente
  const partesCrudas = shares.map((s) => (s / sumaShares) * total);

  if (!isUnidadDiscreta(unidadMedida)) {
    // Continuo: redondear a 3 decimales
    return partesCrudas.map((p) => Math.round(p * 1000) / 1000);
  }

  // Discreto: distribuir enteros conservando la suma exacta
  const floors = partesCrudas.map(Math.floor);
  let remainder = Math.round(total - floors.reduce((a, b) => a + b, 0));

  // Asignar el remainder pieza por pieza a las partes con mayor fracción
  const fracciones = partesCrudas.map((p, i) => ({ i, frac: p - floors[i] }));
  fracciones.sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let k = 0; k < remainder && k < fracciones.length; k++) {
    result[fracciones[k].i] += 1;
  }

  return result;
}
