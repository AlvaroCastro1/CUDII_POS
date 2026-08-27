import type { BasePuntos } from '@prisma/client';

/**
 * Utilidades del Programa de Lealtad (D10).
 * Todos los cálculos dependen de la configuración editable desde
 * "Configuración del sitio" (modelo ProgramaLealtad), nunca de valores fijos.
 */

/** Forma reducida de la configuración del programa necesaria para los cálculos. */
export interface ConfiguracionLealtad {
  habilitado: boolean;
  puntosPorMonto: number;
  montoMinimoParaPuntos: number;
  basePuntos: BasePuntos;
  permitirCanje: boolean;
  puntosPorPesos: number;
  canjeMinimoPuntos: number;
}

/** Datos mínimos que se necesitan de un nivel de lealtad para operar. */
export interface NivelSimple {
  id: string;
  nombre: string;
  umbralPuntos: number;
  descuentoPct: number;
}

/**
 * Resuelve el nivel de lealtad correspondiente a los puntos históricos.
 * Retorna el nivel con el mayor umbral menor o igual a los puntos,
 * o null si el cliente aún no alcanza ningún nivel.
 */
export function resolverNivel(
  puntosHistoricos: number,
  niveles: NivelSimple[],
): NivelSimple | null {
  const alcanzables = niveles.filter(
    (n) => puntosHistoricos >= n.umbralPuntos,
  );
  if (alcanzables.length === 0) return null;
  return alcanzables.reduce((mayor, actual) =>
    actual.umbralPuntos > mayor.umbralPuntos ? actual : mayor,
  );
}

/**
 * Porcentaje de descuento definido para el nivel indicado.
 * Retorna 0 si no hay nivel o el nivel no tiene descuento.
 */
export function descuentoDeNivel(nivel: NivelSimple | null): number {
  if (!nivel || nivel.descuentoPct <= 0) return 0;
  return nivel.descuentoPct;
}

/**
 * Calcula los puntos ganados por una venta según la configuración.
 * La base de cálculo (con o sin descuento aplicado) la decide la configuración.
 */
export function calcularPuntos(
  totalNetoSinDescuentoLealtad: number,
  totalConDescuentoAplicado: number,
  config: ConfiguracionLealtad,
): number {
  if (!config.habilitado || config.puntosPorMonto <= 0) return 0;
  const base =
    config.basePuntos === 'SIN_DESCUENTO'
      ? totalNetoSinDescuentoLealtad
      : totalConDescuentoAplicado;
  if (base < config.montoMinimoParaPuntos) return 0;
  return Math.floor(base / config.puntosPorMonto);
}

/**
 * Convierte puntos a pesos canjeables según la regla de la configuración.
 * Ej.: con puntosPorPesos=100, 250 puntos equivalen a $2.50.
 */
export function pesosEquivalentesDePuntos(
  puntos: number,
  config: ConfiguracionLealtad,
): number {
  if (config.puntosPorPesos <= 0) return 0;
  return Math.round((puntos / config.puntosPorPesos) * 100) / 100;
}
