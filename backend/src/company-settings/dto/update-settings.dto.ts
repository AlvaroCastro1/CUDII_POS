import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { ModoCorteZ } from '@prisma/client';

/**
 * DTO para actualizar la configuración general de la Empresa.
 * Permite modificar el tipo de corte de caja (Corte Z), el umbral
 * de faltante considerado crítico y los límites de stock globales.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(ModoCorteZ)
  modoCorteZ?: ModoCorteZ;

  @IsOptional()
  @IsNumber()
  @Min(0)
  umbralFaltanteCritico?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimoGlobal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  stockMaximoGlobal?: number;
}
