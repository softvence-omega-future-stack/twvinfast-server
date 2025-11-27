import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ChangePasswordDto,
  CreateUserDto,
  LoginDto,
} from './dto/registerUser.dto';
import { Roles } from './decorators/roles.decorator';
import { Public } from './decorators/public.decorator';
import { AppRole } from './enums/role.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Public()
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.userRegister(dto);
  }
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.userLogin(dto);
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Public()
  @Post('refresh')
  refresh(@Req() req) {
    // sub is number (your Prisma id)
    return this.authService.refreshTokens(req.user.sub, req.user.refreshToken);
  }
  @Public()
  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto);
  }

  // @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  logout(@Req() req) {
    return this.authService.logout(req.user.sub);
  }

  @Get('protected')
  protected(@Req() req) {
    return this.authService.getProtectedResource(req);
  }
  @Roles(AppRole.ADMIN)
  @Get('admin-only')
  getAdminData() {
    return 'Only admin can access this.';
  }
  @Roles(AppRole.SUPERADMIN)
  @Get('superadmin-only')
  getSuperAdminData() {
    return 'Only superAdmin can access this.';
  }
}
