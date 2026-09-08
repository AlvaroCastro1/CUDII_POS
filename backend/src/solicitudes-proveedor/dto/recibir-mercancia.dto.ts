import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecibirMercanciaItemDto {
  @IsString()
  productoId: string;

  @IsNumber()
  @Min(0)
  cantidadRecibida: number;

  @IsNumber()
  @Min(0)
  costoUnitarioReal: number;

  @IsString()
  @IsOptional()
  codigoLote?: string;

  @IsString()
  @IsOptional()
  fechaFabricacion?: string;

  @IsString()
  @IsOptional()
  fechaCaducidad?: string;
}

export class RecibirMercanciaSolicitudDto {
  @IsString()
  sucursalId: string;

  @IsString()
  @IsOptional()
  folioFacturaProveedor?: string;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecibirMercanciaItemDto)
  detalles: RecibirMercanciaItemDto[];
}
