import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemRecepcionDetalleDto {
  @IsUUID()
  productoId: string;

  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @IsNumber()
  @Min(0)
  costoUnitario: number;

  /** Código de lote del proveedor. Si se omite, el sistema genera uno. */
  @IsOptional()
  @IsString()
  codigoLote?: string;

  @IsOptional()
  @IsDateString()
  fechaFabricacion?: string;

  @IsOptional()
  @IsDateString()
  fechaCaducidad?: string;
}

export class CrearRecepcionDto {
  @IsUUID()
  sucursalId: string;

  @IsOptional()
  @IsString()
  proveedor?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemRecepcionDetalleDto)
  detalles: ItemRecepcionDetalleDto[];
}
