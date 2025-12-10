import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from 'prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

import { BillingModule } from './billing/billing.module';
import { StripeModule } from './stripe/stripe.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ✅ ensures .env loads everywhere
    }),

    PrismaModule,
    UserModule,
    AuthModule,
    StripeModule, // ✅ REQUIRED
    BillingModule, // ✅ REQUIRED
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
