/**
 * Utilidades de paginación estandarizada para todos los endpoints listados.
 *
 * Formato de respuesta:
 * {
 *   data: T[],
 *   meta: { total, page, limit, totalPages, hasNextPage, hasPrevPage }
 * }
 */

export interface MetaPaginacion {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface RespuestaPaginada<T> {
  data: T[];
  meta: MetaPaginacion;
}

/**
 * Normaliza los parámetros de paginación recibidos como query strings.
 * Aplica límites mínimos/máximos para evitar abusos.
 */
export function normalizarPaginacion(
  page?: number | string,
  limit?: number | string,
  defaultLimit = 20,
  maxLimit = 100,
): { page: number; limit: number; skip: number } {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const l = Math.min(maxLimit, Math.max(1, Math.floor(Number(limit) || defaultLimit)));
  return { page: p, limit: l, skip: (p - 1) * l };
}

/**
 * Construye la respuesta paginada estándar a partir de los datos y el total.
 */
export function construirRespuestaPaginada<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): RespuestaPaginada<T> {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
