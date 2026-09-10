import { PartialType } from '@nestjs/mapped-types';
import { CreateSolicitudProveedorDto } from './create-solicitud-proveedor.dto';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoSolicitudProveedor } from '@prisma/client';

export class UpdateSolicitudProveedorDto extends PartialType(CreateSolicitudProveedorDto) {
  @IsEnum(EstadoSolicitudProveedor)
  @IsOptional()
  estado?: EstadoSolicitudProveedor;

  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;

  @IsString()
  @IsOptional()
  motivoRechazo?: string;
}

