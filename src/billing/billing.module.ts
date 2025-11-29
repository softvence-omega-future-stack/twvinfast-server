import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaModule } from 'prisma/prisma.module';
import { StripeModule } from 'src/stripe/stripe.module';

@Module({
  controllers: [BillingController],
  providers: [BillingService],
  imports: [PrismaModule, StripeModule],
})
export class BillingModule {}
