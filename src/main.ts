import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔥 Stripe Webhook — must receive RAW BODY (Buffer in req.body)
  app.use('/billing/webhook', express.raw({ type: 'application/json' }));

  // All normal routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
