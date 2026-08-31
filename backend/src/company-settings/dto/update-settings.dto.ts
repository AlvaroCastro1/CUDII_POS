import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BasePuntos, ModoCorteZ } from '@prisma/client';

/**
 * D10: DTO de un nivel de lealtad dentro de la configuración del programa.
 * Si `id` viene informado se actualiza el nivel existente; si no, se crea uno nuevo.
 * Los niveles ausentes en el arreglo serán eliminados.
 */
export class NivelLealtadDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  /** Nombre visible del nivel (ej. "Bronce", "VIP"). */
  @IsString()
  nombre: string;

  /** Puntos históricos requeridos para alcanzar el nivel. */
  @IsInt()
  @Min(0)
  umbralPuntos: number;

  /** Porcentaje de descuento aplicado a las compras (0-100). */
  @IsNumber()
  @Min(0)
  @Max(100)
  descuentoPct: number;

  /** Color hexadecimal para los badges en la interfaz. */
  @IsOptional()
  @IsString()
  colorHex?: string | null;
}

/**
 * D10: DTO de configuración del Programa de Lealtad.
 * Todos los campos son opcionales: los campos ausentes conservan su valor actual.
 */
export class ProgramaLealtadDto {
  /** Interruptor general del programa. */
  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;

  /** Cada $X de compra equivalen a 1 punto (debe ser mayor a 0). */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  puntosPorMonto?: number;

  /** Monto mínimo ($) de la venta para ganar puntos. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMinimoParaPuntos?: number;

  /** Base de cálculo de puntos: con o sin descuento aplicado. */
  @IsOptional()
  @IsEnum(BasePuntos)
  basePuntos?: BasePuntos;

  /** Habilita el canje (redención) de puntos. */
  @IsOptional()
  @IsBoolean()
  permitirCanje?: boolean;

  /** Cuántos puntos equivalen a $1 canjeable (debe ser mayor a 0). */
  @IsOptional()
  @IsNumber()
  @Min(1)
  puntosPorPesos?: number;

  /** Mínimo de puntos necesarios para poder canjear. */
  @IsOptional()
  @IsInt()
  @Min(0)
  canjeMinimoPuntos?: number;

  /**
   * D11: Meses de vigencia de los puntos ganados (0 = nunca vencen).
   * Cada lote de puntos vence X meses después de la compra que lo generó.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  mesesExpiracionPuntos?: number;

  /**
   * Reemplazo reconciliado de niveles: se actualizan los que traen `id`,
   * se crean los que no y se eliminan los ausentes.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NivelLealtadDto)
  niveles?: NivelLealtadDto[];
}

/**
 * DTO para actualizar la configuración general de la Empresa.
 * Permite modificar el tipo de corte de caja (Corte Z), el umbral
 * de faltante considerado crítico, los límites de stock globales
 * y la configuración del Programa de Lealtad (D10).
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(ModoCorteZ)
  modoCorteZ?: ModoCorteZ;

  @IsOptional()
  @IsNumber()
  @Min(0)
  umbralFaltanteCritico?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimoGlobal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  stockMaximoGlobal?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProgramaLealtadDto)
  programaLealtad?: ProgramaLealtadDto;

  /**
   * D12: Si es true, al vender un presupuesto se conserva el precio congelado
   * (el que se ofreció al crear la cotización); si es false, se recalculan los
   * precios actuales del catálogo.
   */
  @IsOptional()
  @IsBoolean()
  conservarPrecioPresupuesto?: boolean;
}
