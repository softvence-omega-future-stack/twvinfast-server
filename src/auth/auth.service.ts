import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { AdminSignupDto } from './dto/create-admin.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ChangePasswordDto, LoginDto } from './dto/registerUser.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ------------------------------------------------------------------
  // GENERATE TOKENS
  // ------------------------------------------------------------------
  async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      business_id: user.business_id ?? null,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET as string,
      expiresIn: '1d',
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

  // ------------------------------------------------------------------
  // 1) ADMIN SIGNUP → BUSINESS AUTO-CREATE
  // ------------------------------------------------------------------
  async adminSignup(dto: AdminSignupDto) {
    const { name, email, password, companyName } = dto;

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email already exists');

    // Create Business
    const business = await this.prisma.business.create({
      data: {
        name: companyName,
        email,
        status: 'ACTIVE',
      },
    });

    // Create Admin User
    const hashed = await bcrypt.hash(password, 10);
    const role = await this.ensureRole('ADMIN');

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password_hash: hashed,
        role_id: role.id,
        business_id: business.id,
      },
      include: { role: true },
    });

    // Tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await this.hashRefreshToken(tokens.refreshToken) },
    });

    return {
      message: 'Admin signup successful',
      business,
      user,
      ...tokens,
    };
  }

  // ------------------------------------------------------------------
  // 2) EMPLOYEE SIGNUP (Admin creates Employees)
  // ------------------------------------------------------------------
  // async createEmployee(adminUserId: number, dto: CreateUserDto) {
  //   const admin = await this.prisma.user.findUnique({
  //     where: { id: adminUserId },
  //   });
  //   //  if (!admin || !admin.business_id)
  //   if (!admin) {
  //     throw new ForbiddenException('Admin authentication required');
  //   }

  //   const exists = await this.prisma.user.findUnique({
  //     where: { email: dto.email },
  //   });

  //   if (exists) throw new ConflictException('Email already exists');

  //   const hashed = await bcrypt.hash(dto.password, 10);
  //   const role = await this.ensureRole('USER');

  //   const user = await this.prisma.user.create({
  //     data: {
  //       name: dto.name,
  //       email: dto.email,
  //       password_hash: hashed,
  //       role_id: role.id,
  //       business_id: admin.business_id, // inherit business
  //     },
  //     include: { role: true },
  //   });

  //   return {
  //     message: 'Employee created',
  //     user,
  //   };
  // }

  // 2) EMPLOYEE SIGNUP (Admin creates Employees)
  async createEmployee(adminUserId: number, dto: CreateUserDto) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin) {
      throw new ForbiddenException('Admin authentication required');
    }

    if (!admin.business_id) {
      throw new BadRequestException(
        'Admin must belong to a business before creating employees.',
      );
    }

    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (exists) {
      throw new ConflictException('Email already exists');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const role = await this.ensureRole('USER');

    // CREATE USER
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password_hash: hashed,
        role_id: role.id,
        phone: dto.phone,
        timezone: dto.timezone,
        email_signature: dto.email_signature,
        business_id: admin.business_id, // inherits business from admin
      },
      include: { role: true },
    });

    // --------------------------------------------------
    // 🚀 CREATE DEFAULT MAILBOX FOR NEWLY CREATED USER
    // --------------------------------------------------
    await this.prisma.mailbox.create({
      data: {
        business_id: admin.business_id, // safe now (never null)
        user_id: user.id,
        provider: 'SMTP',
        email_address: dto.email,
        imap_host: undefined,
        imap_port: undefined,
        smtp_host: undefined,
        smtp_port: undefined,
        is_ssl: true,
      },
    });

    return {
      message: 'Employee created with default mailbox',
      user,
    };
  }

  // ------------------------------------------------------------------
  // LOGIN
  // ------------------------------------------------------------------
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

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
        business_id: user.business_id,
      },
      ...tokens,
    };
  }

  // ------------------------------------------------------------------
  // REFRESH TOKENS
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // CHANGE PASSWORD
  // ------------------------------------------------------------------
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!valid) throw new UnauthorizedException('Current password incorrect');

    if (dto.newPassword !== dto.confirmPassword) {
      throw new UnauthorizedException("Passwords don't match");
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    });

    return { message: 'Password updated successfully' };
  }

  // ------------------------------------------------------------------
  // LOGOUT
  // ------------------------------------------------------------------
  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logged out' };
  }

  // ------------------------------------------------------------------
  // HELPER → Ensure role exists
  // ------------------------------------------------------------------
  private async ensureRole(name: string) {
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) throw new Error(`Role '${name}' not found`);
    return role;
  }
}
