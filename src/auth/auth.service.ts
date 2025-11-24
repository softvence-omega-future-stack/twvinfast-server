import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { CreateUserDto, LoginDto } from './dto/registerUser.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
  ) {}
// registration
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
  // login
   async userLogin(dto: LoginDto) {
    
    // 1️⃣ Check if user exists in Prisma
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2️⃣ Compare password with bcrypt
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3️⃣ Prepare JWT token payload
    const payload = { sub: user.id, email: user.email };

    // 4️⃣ Generate token
    const token = await this.jwtService.signAsync(payload);

    // 5️⃣ Return sanitized user
    return {
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    };
  }
}
