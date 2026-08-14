import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  empresaId: string;

  @IsString()
  @IsNotEmpty()
  codigoBarras: string;

  @IsString()
  @IsOptional()
  codigoInterno?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  unidadMedida?: string;

  @IsBoolean()
  @IsOptional()
  esGranel?: boolean;

  @IsBoolean()
  @IsOptional()
  requiereLote?: boolean;

  @IsBoolean()
  @IsOptional()
  manejaInventario?: boolean;

  @IsNumber()
  @IsOptional()
  precioCompra?: number;

  @IsNumber()
  @IsOptional()
  precioVentaBase?: number;
}
