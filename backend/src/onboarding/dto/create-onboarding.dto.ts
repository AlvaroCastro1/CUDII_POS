import { IsString, IsEmail, MinLength, IsNotEmpty } from 'class-validator';

export class CreateOnboardingDto {
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsNotEmpty()
  branchName: string;

  @IsString()
  @IsNotEmpty()
  registerId: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(6)
  adminPass: string;
}
