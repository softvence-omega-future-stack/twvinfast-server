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
import { AuthGuard } from '@nestjs/passport';

import { BillingService } from './services/billing.service';
import { BillingWebhookService } from './services/billing-webhook.service';
import { StripeService } from 'src/stripe/stripe.service';

import { CreatePortalDto, CreateCheckoutDto } from './dto/create-portal.dto';
import { CreatePlanDto } from './dto/create-plan.dto';

import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/strategies/roles.guard';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingWebhookService: BillingWebhookService,
    private readonly stripeService: StripeService,
  ) {}

  // -------------------------------------------------------------------------
  // ADMIN → Create Billing Portal Session
  // -------------------------------------------------------------------------
  @Post('portal')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async createPortal(@Req() req, @Body() dto: CreatePortalDto) {
    return this.billingService.createPortal(req.user.sub, dto);
  }

  // -------------------------------------------------------------------------
  // ADMIN → Get Business Subscription
  // -------------------------------------------------------------------------
  @Get('subscription')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async getSubscription(@Req() req) {
    return this.billingService.getBusinessSubscription(req.user.sub);
  }

  // -------------------------------------------------------------------------
  // ADMIN → Create Checkout Session (Trial / Monthly / Annual)
  // -------------------------------------------------------------------------
  @Post('checkout')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async createCheckout(@Req() req, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckoutSession(req.user.sub, dto);
  }

  // -------------------------------------------------------------------------
  // SUPER_ADMIN → Create Plan
  // -------------------------------------------------------------------------
  @Post('create-plan')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN')
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }

  // -------------------------------------------------------------------------
  // STRIPE WEBHOOK (Public Route)
  //
  // 🔥 IMPORTANT:
  // main.ts এ এই রুটের জন্য raw body enable থাকতে হবে:
  //
  // app.use('/billing/webhook', bodyParser.raw({ type: '*/*' }));
  //
  // -------------------------------------------------------------------------
  @Post('webhook')
  @Public()
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    // 🔥 DO NOT modify, stringify, JSON.parse etc.
    const rawBody = req.body;

    const event = this.stripeService.constructEventFromPayload(
      signature,
      rawBody,
    );

    await this.billingWebhookService.handleEvent(event);

    return { received: true };
  }
}
