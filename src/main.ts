// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { ValidationPipe } from '@nestjs/common';
// import * as bodyParser from 'body-parser';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule, {
//     bodyParser: false,
//   });

//   // !🔥 Stripe Webhook — MUST receive raw body BEFORE any JSON parser
//   // app.use('/billing/webhook', bodyParser.raw({ type: 'application/json' }));

//   // // Normal routes
//   // app.use(bodyParser.json());
//   // app.use(bodyParser.urlencoded({ extended: true }));

//   app.use('/billing/webhook', bodyParser.raw({ type: '*/*' }));
//   app.use(bodyParser.json());
//   app.use(bodyParser.urlencoded({ extended: true }));

//   app.useGlobalPipes(new ValidationPipe());

//   await app.listen(process.env.PORT || 4000);
//   console.log('🚀 Server running');
// }
// bootstrap();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // 🔥 Stripe webhook — RAW body only
  app.use('/billing/webhook', bodyParser.raw({ type: '*/*' }));

  // ✅ Normal routes
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // ✅ Serve uploaded files (DigitalOcean server)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT || 4000);
  console.log('🚀 Server running');
}
bootstrap();
