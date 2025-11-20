export class CreateUserDto {
  name?: string;
  email: string;
  phone?: string;
  password: string;
  role?: any;
  status?: any;
  companyId?: number;
  location?: string;
  twoFA?: boolean;
  emailSignature?: string;
  timeZone?: string;
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
