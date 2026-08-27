import { IsNumber, IsOptional, IsInt, Min, Max } from 'class-validator';

/** DTO para abrir una cuenta de crédito a un cliente */
export class CreditAccountDto {
  @IsNumber()
  @Min(1)
  limiteCredito: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  diasMaximoVencimiento?: number;
}
