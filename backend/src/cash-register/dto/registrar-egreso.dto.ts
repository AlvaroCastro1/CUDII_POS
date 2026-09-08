import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { CategoriaEgresoCaja } from '@prisma/client';

export class RegistrarEgresoDto {
  @IsString()
  sesionCajaId: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsEnum(CategoriaEgresoCaja)
  @IsOptional()
  categoria?: CategoriaEgresoCaja;

  @IsString()
  concepto: string;

  @IsString()
  @IsOptional()
  comprobanteUrl?: string;
}
