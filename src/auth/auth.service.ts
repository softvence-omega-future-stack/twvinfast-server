import { Injectable, ConflictException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from './dto/registerUser.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
  ) {}

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
      password: hashedPassword,
    });
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    console.log(token);

    return {
      message: 'User registered successfully',
      user,
      token,
    };
  }
}
