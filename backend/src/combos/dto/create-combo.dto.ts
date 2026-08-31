import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoPrecioCombo } from '@prisma/client';

export class ProductoComboDto {
  @IsUUID()
  productoId: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  cantidad: number;
}

export class CreateComboDto {
  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsEnum(TipoPrecioCombo)
  tipoPrecio: TipoPrecioCombo;

  /**
   * $ fijo del paquete cuando tipoPrecio = MONTO_FIJO (debe ser < suma individual).
   * % de descuento (0-90) cuando tipoPrecio = DESCUENTO_PCT.
   */
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  valorPrecio: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductoComboDto)
  productos?: ProductoComboDto[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}