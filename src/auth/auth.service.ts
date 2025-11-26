import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { CreateUserDto, LoginDto } from './dto/registerUser.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // =========================================================
  // 🔥 GENERATE ACCESS + REFRESH TOKENS
  // =========================================================
  async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'access_secret_fallback',
      expiresIn: process.env.JWT_ACCESS_EXPIRES as unknown as number,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'refresh_secret_fallback',
      expiresIn: process.env.JWT_REFRESH_EXPIRES as unknown as number,
    });

    return { accessToken, refreshToken };
  }

  async hashRefreshToken(token: string) {
    return bcrypt.hash(token, 10);
  }

  // =========================================================
  // 🔥 REGISTER
  // =========================================================
  async userRegister(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role || 'USER',
        status: dto.status || 'ACTIVE',
        // other fields get defaults
      },
    });

    const { accessToken, refreshToken } = await this.generateTokens(user);

    const hashedRefresh = await this.hashRefreshToken(refreshToken);
    await this.prisma.user.update({
      where: { id: user.id }, // 👈 Int id
      data: { refreshToken: hashedRefresh },
    });

    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  // =========================================================
  // 🔥 LOGIN
  // =========================================================
  async userLogin(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user);

    const hashedRefresh = await this.hashRefreshToken(refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  // =========================================================
  // 🔥 REFRESH TOKEN
  // =========================================================
  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, // 👈 Int id
    });
    console.log(refreshToken);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }
    // console.log(user);

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user);

    const hashed = await this.hashRefreshToken(tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashed },
    });

    return tokens;
  }

  // =========================================================
  // 🔥 LOGOUT
  // =========================================================
  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId }, // 👈 Int id
      data: { refreshToken: null },
    });

    return { message: 'Logged out successfully' };
  }

  // =========================================================
  // 🔒 PROTECTED RESOURCE
  // =========================================================
  getProtectedResource(req: any) {
    const user = req.user;
    return { message: 'This is a protected resource', user };
  }
}
