import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import {
  ChangePasswordDto,
  CreateUserDto,
  LoginDto,
} from './dto/registerUser.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Public()
  @Post('refresh')
  refresh(@Req() req) {
    return this.auth.refreshTokens(req.user.sub, req.user.refreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.sub, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  logout(@Req() req) {
    return this.auth.logout(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('protected')
  protected(@Req() req) {
    return this.auth.getProtected(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Roles('ADMIN')
  @Get('admin')
  adminRoute() {
    return 'Admin Access Granted';
  }
  @UseGuards(AuthGuard('jwt'))
  @Roles('SUPERADMIN')
  @Get('super-admin')
  superAdminRoute() {
    return 'Super Admin Access Granted';
  }
}
