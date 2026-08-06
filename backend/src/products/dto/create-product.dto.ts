import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, IsArray } from 'class-validator';

export class CreateProductDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  codigoInterno?: string;

  @IsString()
  codigoBarras: string;

  @IsString()
  @IsOptional()
  unidadMedida?: string;

  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;

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
  precioCompra: number;

  @IsNumber()
  precioVentaBase: number;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  categoriasIds?: string[];
}
