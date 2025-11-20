import { Injectable, ConflictException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from './dto/registerUser.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  async userRegister(dto: CreateUserDto) {
    // Check if email already exists
    const existing: any = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.userService.createUser({
      ...dto,
      password: hashedPassword, // replace with hashed password
    });

    return {
      message: 'User registered successfully',
      user,
    };
  }
}
