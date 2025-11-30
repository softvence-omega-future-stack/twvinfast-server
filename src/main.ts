import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  // Optional but recommended for dev
  // app.enableCors({
  //   origin: process.env.CLIENT_URL,
  //   credentials: true,
  // }); // Raw body only for Stripe webhook
  app.use('/billing/webhook', bodyParser.raw({ type: 'application/json' }));

  // JSON parser for rest
  app.use(bodyParser.json());
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
