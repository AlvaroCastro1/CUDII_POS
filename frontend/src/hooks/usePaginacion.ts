import { useState, useCallback } from 'react';

/**
 * Metadata de paginación retornada por los endpoints paginados de CUDII.
 */
export interface PaginacionMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Hook centralizado para manejar el estado de paginación.
 * Úsalo en cualquier vista que tenga una tabla paginada.
 *
 * @param limitInicial - Registros por página (default: 20)
 */
export function usePaginacion(limitInicial = 20) {
  const [page, setPage] = useState(1);
  const [limit] = useState(limitInicial);
  const [meta, setMeta] = useState<PaginacionMeta | null>(null);

  /** Navega a una página específica */
  const irAPagina = useCallback((nuevaPagina: number) => {
    setPage(nuevaPagina);
  }, []);

  /** Reinicia a la primera página (usar al cambiar el buscador) */
  const reiniciar = useCallback(() => {
    setPage(1);
  }, []);

  return { page, limit, meta, setMeta, irAPagina, reiniciar };
}
