import { Button } from '@/components/ui/button';
import type { PaginacionMeta } from '@/hooks/usePaginacion';

interface PaginacionControlesProps {
  meta: PaginacionMeta;
  onPageChange: (page: number) => void;
}

/**
 * Componente de controles de paginación reutilizable para todas las tablas de CUDII.
 * Muestra: "Mostrando X-Y de Z registros" + botones de anterior/siguiente + indicador de página.
 *
 * @param meta - Metadata de paginación devuelta por la API
 * @param onPageChange - Callback que recibe el número de página seleccionada
 */
export function PaginacionControles({ meta, onPageChange }: PaginacionControlesProps) {
  const inicio = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const fin = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex items-center justify-between px-2 py-3 border-t border-outline/10 mt-2">
      <p className="text-sm text-on-surface-variant">
        Mostrando{' '}
        <span className="font-medium text-on-surface">{inicio}–{fin}</span>
        {' '}de{' '}
        <span className="font-medium text-on-surface">{meta.total}</span>{' '}
        registro{meta.total !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={!meta.hasPrevPage}
          title="Página anterior"
        >
          <span className="material-symbols-outlined !text-[18px]">chevron_left</span>
        </Button>
        <span className="text-sm font-medium text-on-surface min-w-[90px] text-center">
          Pág. {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={!meta.hasNextPage}
          title="Siguiente página"
        >
          <span className="material-symbols-outlined !text-[18px]">chevron_right</span>
        </Button>
      </div>
    </div>
  );
}
