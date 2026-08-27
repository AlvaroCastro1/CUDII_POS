import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class AbrirCajaDto {
  @IsOptional()
  @IsUUID()
  cajaId?: string;

  @IsNumber()
  @Min(0)
  montoInicial: number;
}
