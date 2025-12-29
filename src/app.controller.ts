import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('api/v1/hello')
  getHello2(): string {
    return 'Hello from controller. Hello world';
  }

  @Public()
  @Get('api/v1')
  getHelloApi(): string {
    return 'Hello from API';
  }
}
