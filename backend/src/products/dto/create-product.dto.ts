import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para un precio adicional por unidad de venta.
 * Permite definir precios escalonados (pieza, caja, paquete, etc.)
 * con márgenes distintos por nivel de venta.
 */
export class CrearPrecioPorUnidadDto {
  @IsString()
  unidad: string; // 'CAJA', 'PAQUETE', 'MAYOREO', etc.

  @IsString()
  @IsOptional()
  nombreAlternativo?: string; // Nombre visible en caja, ej: 'Caja de 24'

  @IsNumber()
  @Min(0)
  cantidadMinima: number; // Cuántas unidades base representa este precio

  @IsNumber()
  @Min(0)
  @IsOptional()
  cantidadMaxima?: number;

  @IsNumber()
  @Min(0)
  precio: number;

  @IsBoolean()
  @IsOptional()
  esDefault?: boolean;
}

export class CreateProductDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  codigoInterno?: string;

  @IsString()
  codigoBarras: string;

  @IsString()
  @IsOptional()
  unidadMedida?: string;

  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;

  @IsBoolean()
  @IsOptional()
  esGranel?: boolean;

  @IsBoolean()
  @IsOptional()
  tieneCaducidad?: boolean;

  @IsBoolean()
  @IsOptional()
  manejaInventario?: boolean;

  @IsNumber()
  @Min(0)
  precioCompra: number;

  @IsNumber()
  @Min(0)
  precioVentaBase: number;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  categoriasIds?: string[];

  /** Precios escalonados adicionales por volumen (opcional) */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearPrecioPorUnidadDto)
  @IsOptional()
  preciosAdicionales?: CrearPrecioPorUnidadDto[];
}
