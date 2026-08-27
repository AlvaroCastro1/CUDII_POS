import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';

/** DTO para actualizar un cliente (todos los campos opcionales) */
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  /** Reactivar o desactivar manualmente el cliente */
  @IsOptional()
  @IsBoolean()
  estaActivo?: boolean;
}
