import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface SwitchInactivosConfig {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export interface BuscadorEstandarProps {
  /** Texto actual de la barra de búsqueda */
  busqueda: string;
  /** Callback al escribir en la barra de búsqueda */
  onBusquedaChange: (value: string) => void;
  /** Texto indicativo dentro de la barra de búsqueda */
  placeholder?: string;

  /** Configuración del interruptor de elementos inactivos / deshabilitados / soft-delete */
  switchInactivos?: SwitchInactivosConfig;

  /** Callback al presionar el botón de recarga */
  onActualizar?: () => void;
  /** Estado visual de carga */
  cargando?: boolean;

  /** Callback para resetear búsqueda y filtros rápidos */
  onLimpiar?: () => void;

  /** Contenido renderizable de los filtros rápidos (selects, switches, botones, etc.) */
  filtrosRapidos?: React.ReactNode;
  /** Número de filtros actualmente aplicados/activos (para mostrar badge en el botón de Filtros) */
  filtrosActivosCount?: number;

  /** Permite forzar la apertura inicial del panel de filtros */
  filtrosAbiertosInicial?: boolean;

  /** Deshabilita los controles del buscador */
  disabled?: boolean;

  /** Clases CSS adicionales para el contenedor principal */
  className?: string;
}

/**
 * Componente Estandarizado de Búsqueda y Filtros Rápidos CUDII POS.
 * Mantiene la consistencia visual y funcional en todas las pestañas del sistema.
 */
export const BuscadorEstandar: React.FC<BuscadorEstandarProps> = ({
  busqueda,
  onBusquedaChange,
  placeholder = 'Buscar...',
  switchInactivos,
  onActualizar,
  cargando = false,
  onLimpiar,
  filtrosRapidos,
  filtrosActivosCount = 0,
  filtrosAbiertosInicial = false,
  disabled = false,
  className,
}) => {
  const [mostrarFiltros, setMostrarFiltros] = useState(filtrosAbiertosInicial);

  const tieneFiltrosActivos = filtrosActivosCount > 0;

  return (
    <div
      className={cn(
        'bg-surface border border-outline/20 rounded-2xl p-3.5 mb-6 shadow-sm flex flex-col gap-3 transition-all duration-200',
        className,
      )}
    >
      {/* Fila Principal de Búsqueda y Acciones */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
        {/* Lado Izquierdo: Input de Búsqueda + Switch Inactivos */}
        <div className="flex flex-1 items-center gap-3 min-w-[240px] flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/70 pointer-events-none" />
            <Input
              value={busqueda}
              onChange={(e) => onBusquedaChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className="pl-10 pr-9 h-11 bg-surface-container-low/60 border-outline/20 rounded-xl text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline/70"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => onBusquedaChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1 rounded-md transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {switchInactivos && (
            <div className="flex items-center gap-2.5 shrink-0 pl-1">
              <Switch
                id={switchInactivos.id || 'switch-inactivos'}
                checked={switchInactivos.checked}
                onCheckedChange={switchInactivos.onCheckedChange}
                disabled={disabled}
              />
              <Label
                htmlFor={switchInactivos.id || 'switch-inactivos'}
                className="text-xs sm:text-sm font-medium text-on-surface-variant cursor-pointer select-none whitespace-nowrap"
              >
                {switchInactivos.label || 'Mostrar inactivos'}
              </Label>
            </div>
          )}
        </div>

        {/* Lado Derecho: Botones de Acción (Filtros, Limpiar, Actualizar) */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {filtrosRapidos && (
            <Button
              type="button"
              variant={mostrarFiltros || tieneFiltrosActivos ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setMostrarFiltros((prev) => !prev)}
              disabled={disabled}
              className={cn(
                'h-11 px-3.5 rounded-xl border border-outline/20 text-xs sm:text-sm font-semibold transition-all duration-200',
                mostrarFiltros || tieneFiltrosActivos
                  ? 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25'
                  : 'hover:bg-surface-container-high text-on-surface-variant',
              )}
              title="Mostrar u ocultar filtros rápidos"
            >
              <SlidersHorizontal className="w-4 h-4 mr-1.5" />
              <span>Filtros</span>
              {tieneFiltrosActivos ? (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold leading-none">
                  {filtrosActivosCount}
                </span>
              ) : null}
            </Button>
          )}

          {onLimpiar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLimpiar}
              disabled={disabled}
              className="h-11 px-3.5 rounded-xl border border-outline/20 text-xs sm:text-sm font-semibold hover:bg-surface-container-high text-on-surface-variant transition-all duration-200"
              title="Limpiar búsqueda y filtros"
            >
              <X className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </Button>
          )}

          {onActualizar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onActualizar}
              disabled={disabled || cargando}
              className="h-11 w-11 p-0 rounded-xl border border-outline/20 text-on-surface-variant hover:bg-surface-container-high transition-all duration-200 shrink-0"
              title="Actualizar información"
            >
              <RefreshCw className={cn('w-4 h-4', cargando && 'animate-spin text-primary')} />
            </Button>
          )}
        </div>
      </div>

      {/* Renglón Inferior Expandible: Filtros Rápidos Específicos */}
      {filtrosRapidos && mostrarFiltros && (
        <div className="pt-3 border-t border-outline/10 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {filtrosRapidos}
        </div>
      )}
    </div>
  );
};

export default BuscadorEstandar;
