import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import {
  ChangePasswordDto,
  CreateUserDto,
  LoginDto,
} from './dto/registerUser.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ---------- Generate Tokens ----------
  async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async hashRefreshToken(token: string) {
    return bcrypt.hash(token, 10);
  }

  // ---------- Register ----------
  async register(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password_hash: hashedPassword,
        role: { connect: { id: dto.role_id } },
        business: dto.business_id
          ? { connect: { id: dto.business_id } }
          : undefined,
      },
      include: { role: true, business: true },
    });

    const { accessToken, refreshToken } = await this.generateTokens(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await this.hashRefreshToken(refreshToken) },
    });

    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---------- Login ----------
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.password_hash);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await this.hashRefreshToken(tokens.refreshToken) },
    });

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
      ...tokens,
    };
  }

  // ---------- Refresh Tokens ----------
  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Access denied');

    const valid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.generateTokens(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await this.hashRefreshToken(tokens.refreshToken) },
    });

    return tokens;
  }

  // ---------- Change Password ----------
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!match) throw new UnauthorizedException('Current password incorrect');

    const isSame = await bcrypt.compare(dto.newPassword, user.password_hash);
    if (isSame)
      throw new UnauthorizedException(
        'New password must be different than current password',
      );

    if (dto.newPassword !== dto.confirmPassword)
      throw new UnauthorizedException("Passwords don't match");

    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: await bcrypt.hash(dto.newPassword, 10) },
    });

    return { message: 'Password updated successfully' };
  }

  // ---------- Logout ----------
  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logged out' };
  }

  // ---------- Protected route ----------
  getProtected(user: any) {
    return { message: 'Protected', user };
  }
}
