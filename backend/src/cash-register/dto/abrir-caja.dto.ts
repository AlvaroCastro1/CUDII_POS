import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AbrirCajaDto {
  @IsOptional()
  @IsUUID()
  cajaId?: string;

  @IsNumber()
  @Min(0)
  montoInicial: number;

  @IsOptional()
  @IsString()
  notas?: string;
}
