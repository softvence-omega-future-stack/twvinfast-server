// src/billing/billing.module.ts

import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';

import { BillingService } from './services/billing.service'; // ✅ Correct new location
import { BillingWebhookService } from './services/billing-webhook.service';

import { StripeModule } from 'src/stripe/stripe.module';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  imports: [StripeModule], // StripeService lives here
  controllers: [BillingController],
  providers: [
    BillingService, // <-- MUST BE REGISTERED HERE
    BillingWebhookService,
    PrismaService,
  ],
  exports: [BillingService], // Optional but recommended
})
export class BillingModule {}
