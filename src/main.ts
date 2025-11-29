import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // 👈 THIS is important for Stripe webhooks
  });
  app.useGlobalPipes(new ValidationPipe());
  // Optional but recommended for dev
  // app.enableCors({
  //   origin: process.env.CLIENT_URL,
  //   credentials: true,
  // });
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
