import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name?: string;
  @IsEmail()
  email: string;
  phone?: string;
  @IsString()
  password: string;
  role?: any;
  status?: any;
  companyId?: number;
  location?: string;
  twoFA?: boolean;
  emailSignature?: string;
  timeZone?: string;
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
