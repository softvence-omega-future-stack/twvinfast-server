import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/registerUser.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register')
  register(@Body() CreateUserDto: CreateUserDto) {
    const result = this.authService.userRegister(CreateUserDto);
    return result;
  }
  @Post('login')
  login() {
    return { message: 'Login endpoint' };
  }
}
