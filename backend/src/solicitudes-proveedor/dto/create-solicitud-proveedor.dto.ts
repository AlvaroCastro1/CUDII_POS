import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoSolicitudProveedor } from '@prisma/client';

export class DetalleSolicitudProveedorDto {
  @IsString()
  productoId: string;

  @IsString()
  nombreProducto: string;

  @IsString()
  @IsOptional()
  unidadMedida?: string;

  @IsNumber()
  @Min(0.001)
  cantidadRequerida: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  costoUnitarioEstimado?: number;

  @IsString()
  @IsOptional()
  notas?: string;
}

export class CreateSolicitudProveedorDto {
  @IsString()
  @IsOptional()
  proveedorId?: string | null;

  @IsEnum(EstadoSolicitudProveedor)
  @IsOptional()
  estado?: EstadoSolicitudProveedor;

  @IsString()
  @IsOptional()
  fechaEntregaEsperada?: string;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleSolicitudProveedorDto)
  detalles: DetalleSolicitudProveedorDto[];
}
