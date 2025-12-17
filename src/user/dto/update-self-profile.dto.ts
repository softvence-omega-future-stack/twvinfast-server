import { IsOptional, IsString, IsEmail, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  // ⚠️ email change optional (চাও তো block করা যাবে)
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  email_signature?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;
}
