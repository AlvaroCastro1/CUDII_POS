import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierDto } from './create-supplier.dto';

/** DTO para actualizar un proveedor (todos los campos opcionales) */
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
