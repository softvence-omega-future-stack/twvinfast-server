// src/billing/billing.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { BillingService } from './services/billing.service';
import { BillingWebhookService } from './services/billing-webhook.service';
import { StripeService } from 'src/stripe/stripe.service';

import { Public } from 'src/auth/decorators/public.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CreateCheckoutDto, CreatePortalDto } from './dto/create-portal.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingWebhookService: BillingWebhookService,
    private readonly stripeService: StripeService,
  ) {}

  // ------------------------------------------------------------
  // ADMIN → Create Checkout Session
  // ------------------------------------------------------------
  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  @Roles('ADMIN')
  async createCheckout(@Req() req, @Body() dto: CreateCheckoutDto) {
    console.log(req.user.sub);
    return this.billingService.createCheckoutSession(req.user.sub, dto.planId);
  }

  // ------------------------------------------------------------
  // Billing Portal
  // ------------------------------------------------------------
  @Post('portal')
  @UseGuards(AuthGuard('jwt'))
  @Roles('ADMIN')
  async createPortal(@Req() req, @Body() dto: CreatePortalDto) {
    return this.billingService.createPortal(req.user.sub, dto);
  }

  // ------------------------------------------------------------
  // Business Subscription List
  // ------------------------------------------------------------
  @Get('subscription')
  @UseGuards(AuthGuard('jwt'))
  @Roles('ADMIN')
  async getSubscription(@Req() req) {
    return this.billingService.getBusinessSubscription(req.user.business_id);
  }

  // ------------------------------------------------------------
  // Stripe Webhook (Raw Body Required)
  // ------------------------------------------------------------
  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

    const rawBody = req.body as Buffer;

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Webhook body MUST be raw Buffer');
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

  @Post('create-plan')
  @Roles('SUPER_ADMIN')
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }
}
