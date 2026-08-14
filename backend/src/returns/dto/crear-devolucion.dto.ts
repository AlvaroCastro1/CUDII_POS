import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DestinoDevolucion,
  MotivoDevolucion,
  TipoResolucionDevolucion,
} from '@prisma/client';

export class ItemDevolucionProductoDto {
  @IsUUID()
  productoId: string;

  @IsNumber()
  @Min(0.0001)
  cantidadDevuelta: number;

  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @IsEnum(MotivoDevolucion)
  motivo: MotivoDevolucion;

  @IsEnum(DestinoDevolucion)
  destino: DestinoDevolucion;
}

export class CrearDevolucionDto {
  @IsUUID()
  ventaId: string;

  @IsOptional()
  @IsUUID()
  sesionCajaId?: string;

  @IsEnum(TipoResolucionDevolucion)
  tipoResolucion: TipoResolucionDevolucion;

  @IsOptional()
  @IsString()
  motivoGeneral?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDevolucionProductoDto)
  productos: ItemDevolucionProductoDto[];
}
