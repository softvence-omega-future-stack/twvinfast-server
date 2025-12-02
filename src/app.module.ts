import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from './mail/mail.module';
import { CompanyModule } from './company/company.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { StripeModule } from './stripe/stripe.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/strategies/jwt-auth.guard';
import { RolesGuard } from './auth/strategies/roles.guard';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    UserModule,
    MailModule,
    CompanyModule,
    ConfigModule.forRoot({ isGlobal: true }),
    BillingModule,
    StripeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
