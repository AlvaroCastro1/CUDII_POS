import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoDescuentoCupon } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @MaxLength(50)
  codigo: string;

  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsEnum(TipoDescuentoCupon)
  tipoDescuento: TipoDescuentoCupon;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  valorDescuento: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  montoMinimoCompra?: number;

  @IsOptional()
  @IsBoolean()
  soloClientesRegistrados?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limiteUsosTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limiteUsosPorCliente?: number;

  @IsDateString()
  fechaInicio: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
