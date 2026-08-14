import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { ModoCorteZ } from '@prisma/client';

/**
 * DTO para actualizar la configuración general de la Empresa.
 * Permite modificar el tipo de corte de caja (Corte Z) y el umbral
 * de faltante considerado crítico (requiere autorización).
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(ModoCorteZ)
  modoCorteZ?: ModoCorteZ;

  @IsOptional()
  @IsNumber()
  @Min(0)
  umbralFaltanteCritico?: number;
}
