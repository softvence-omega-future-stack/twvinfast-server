import { IsOptional, IsString, IsEmail, IsUrl } from 'class-validator';

export class BusinessUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
