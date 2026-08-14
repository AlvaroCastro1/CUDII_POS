import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/**
 * DTO para el cierre de turno (Corte Z).
 * Incluye campo opcional autorizadoPorId para faltantes que superan
 * el umbral crítico configurado en la empresa.
 */
export class CorteZDto {
  @IsUUID()
  sesionCajaId: string;

  @IsNumber()
  @Min(0)
  montoDeclarado: number;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsUUID()
  autorizadoPorId?: string;
}
