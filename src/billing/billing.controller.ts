// src/billing/billing.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './services/billing.service';
import { BillingWebhookService } from './services/billing-webhook.service';
import { StripeService } from 'src/stripe/stripe.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CreatePortalDto } from './dto/create-portal.dto';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingWebhookService: BillingWebhookService,
    private readonly stripeService: StripeService,
  ) {}
  @Public()
  @Post('checkout')
  async createCheckout(@Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckout(dto);
  }

  @Post('portal')
  async createPortal(@Body() dto: CreatePortalDto) {
    return this.billingService.createPortal(dto);
  }

  // For UI: /billing/subscription?businessId=1
  @Get('subscription')
  async getSubscription(@Query('businessId') businessId: string) {
    return this.billingService.getBusinessSubscription(Number(businessId));
  }

  // Stripe webhook (must be PUBLIC)
  @Public()
  @Post('webhook')
  async webhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    console.log("Hit web hook")
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing rawBody for Stripe webhook');
    }

    let event;
    try {
      event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err.message}`,
      );
    }

    await this.billingWebhookService.handleEvent(event);

    return { received: true };
  }
}
