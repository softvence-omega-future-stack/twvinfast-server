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
  providers: [AppService],
})
export class AppModule {}
