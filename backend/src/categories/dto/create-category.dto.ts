import { IsString, IsOptional, IsHexColor, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsHexColor()
  @IsOptional()
  colorHex?: string;

  @IsString()
  @IsOptional()
  icono?: string;

  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;
}
