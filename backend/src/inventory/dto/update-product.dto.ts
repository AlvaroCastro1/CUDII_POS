import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

// Instalaremos mapped-types luego si no está (aunque suele venir o usaremos swagger PartialType).
// Por ahora definimos la clase de forma compatible:
export class UpdateProductDto extends PartialType(CreateProductDto) {}
