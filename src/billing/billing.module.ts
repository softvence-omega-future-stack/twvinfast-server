// src/billing/billing.module.ts
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';

import { BillingService } from './services/billing.service';
import { BillingWebhookService } from './services/billing-webhook.service';

import { StripeModule } from 'src/stripe/stripe.module';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  imports: [StripeModule],
  controllers: [BillingController],
  providers: [BillingService, BillingWebhookService, PrismaService],
  exports: [BillingService],
})
export class BillingModule {}
