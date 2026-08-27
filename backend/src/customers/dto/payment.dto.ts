import { IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { MetodoPago } from '@prisma/client';

/** DTO para registrar un abono a la deuda de un cliente */
export class PaymentDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
