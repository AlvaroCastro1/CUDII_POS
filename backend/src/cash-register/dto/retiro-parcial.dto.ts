import { IsNumber, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class RetiroParcialDto {
  @IsUUID()
  sesionCajaId: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsString()
  @MinLength(3)
  motivo: string;
}
