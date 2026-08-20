import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MotivoMerma } from '@prisma/client';

export class CrearMermaDto {
  @IsUUID()
  sucursalId: string;

  @IsUUID()
  productoId: string;

  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @IsEnum(MotivoMerma)
  motivo: MotivoMerma;

  /** Lote del cual se da de baja. Si se omite, el sistema usa rotación FEFO. */
  @IsOptional()
  @IsUUID()
  loteId?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
