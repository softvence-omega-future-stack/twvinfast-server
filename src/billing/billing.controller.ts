import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { Inject } from '@nestjs/common';
import Stripe from 'stripe';

@Controller('billing')
export class BillingController {
  constructor(
    private billingService: BillingService,
    @Inject('STRIPE_CLIENT') private stripe: Stripe,
  ) {}

  // 🔹 Create Checkout Session
  @Post('checkout')
  async createCheckout(@Body() body) {
    const { priceId, userId, email } = body;

    const url = await this.billingService.createCheckout(
      priceId,
      userId,
      email,
    );

    return { url };
  }

  // 🔹 Webhook Handler
  @Post('webhook')
  async handleWebhook(@Req() req) {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET as any,
      );
    } catch (err) {
      throw new BadRequestException(`Webhook error: ${err.message}`);
    }

    await this.billingService.handleWebhook(event);

    return { received: true };
  }

  // 🔹 Billing Portal
  @Post('portal')
  async createPortal(@Body() body) {
    const { customerId } = body;

    const url = await this.billingService.createPortal(customerId);

    return { url };
  }
}
