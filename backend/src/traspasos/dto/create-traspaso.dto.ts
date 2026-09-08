import { IsString, IsOptional, IsArray, ValidateNested, Min, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoTraspaso } from '@prisma/client';

export class DetalleTraspasoItemDto {
  @IsString()
  productoId: string;

  @IsString()
  @IsOptional()
  loteId?: string;

  @IsString()
  nombreProducto: string;

  @IsString()
  @IsOptional()
  unidadMedida?: string;

  @IsNumber()
  @Min(0.001)
  cantidadEnviada: number;
}

export class CreateTraspasoDto {
  @IsString()
  sucursalOrigenId: string;

  @IsString()
  sucursalDestinoId: string;

  @IsEnum(EstadoTraspaso)
  @IsOptional()
  estado?: EstadoTraspaso;

  @IsString()
  @IsOptional()
  notasEmision?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleTraspasoItemDto)
  detalles: DetalleTraspasoItemDto[];
}
