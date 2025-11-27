import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  // Optional confirm password field
  @IsOptional()
  @MinLength(6)
  private _confirmPassword?: string | undefined;
  public get confirmPassword(): string | undefined {
    return this._confirmPassword;
  }
  public set confirmPassword(value: string | undefined) {
    this._confirmPassword = value;
  }

  @IsInt()
  role_id: number;

  @IsOptional()
  @IsInt()
  business_id?: number;
  @IsOptional()
  @IsString()
  status?: string;
}
export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UpdateUserDto {
  name?: string;
  phone?: string;
  role?: string;
  status?: string;
  companyId?: number;
  location?: string;
  twoFA?: boolean;
  emailSignature?: string;
  timeZone?: string;
  lastLogin?: Date;
}
export class UserResponseDto {
  id: number;
  name?: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  companyId?: number;
  location?: string;
  twoFA: boolean;
  emailSignature?: string;
  timeZone?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
export class ChangePasswordDto {
  @IsNotEmpty()
  currentPassword: string;

  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;

  @IsNotEmpty()
  @MinLength(6)
  confirmPassword: string;
}
