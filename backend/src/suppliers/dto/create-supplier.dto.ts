import { IsString, IsOptional, IsEmail, IsBoolean } from 'class-validator';

/** DTO para crear un proveedor */
export class CreateSupplierDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  rfc?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
