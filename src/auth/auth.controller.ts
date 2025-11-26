import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto, LoginDto } from './dto/registerUser.dto';
import { Roles } from './decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from './decorators/public.decorator';

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
  @Post('refresh')
  refresh(@Req() req) {
    // sub is number (your Prisma id)
    return this.authService.refreshTokens(req.user.sub, req.user.refreshToken);
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
  @Roles(Role.ADMIN)
  @Get('admin-only')
  getAdminData() {
    return 'Only admin can access this.';
  }
}
