import {
  IsString,
  IsOptional,
  IsEmail,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

/** DTO para crear un cliente */
export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidoPaterno?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(13)
  rfc?: string;
}
