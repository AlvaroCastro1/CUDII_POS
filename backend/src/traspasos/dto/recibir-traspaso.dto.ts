import { IsString, IsOptional, IsArray, ValidateNested, Min, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class DetalleRecibirTraspasoItemDto {
  @IsString()
  detalleId: string;

  @IsNumber()
  @Min(0)
  cantidadRecibida: number;
}

export class RecibirTraspasoDto {
  @IsString()
  @IsOptional()
  notasRecepcion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleRecibirTraspasoItemDto)
  detalles: DetalleRecibirTraspasoItemDto[];
}
