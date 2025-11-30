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

  @Public()
  @Post('portal')
  async createPortal(@Body() dto: CreatePortalDto) {
    return this.billingService.createPortal(dto);
  }

  @Public()
  @Get('subscription')
  async getSubscription(@Query('businessId') businessId: string) {
    return this.billingService.getBusinessSubscription(Number(businessId));
  }

  // 🔥 Correct Stripe Webhook

  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    console.log('Hit Stripe webhook');

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    // 🔥 express.raw() put the raw bytes here:
    const rawBody = req.body as unknown as Buffer;

    console.log(
      'Webhook body type:',
      typeof rawBody,
      'isBuffer=',
      Buffer.isBuffer(rawBody),
    );

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException(
        'Stripe webhook body is not a Buffer (check express.raw setup)',
      );
    }

    let event;
    try {
      event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      console.error('Stripe constructWebhookEvent error:', err);
      throw new BadRequestException(
        `Webhook signature verification failed: ${err.message}`,
      );
    }

    await this.billingWebhookService.handleEvent(event);

    return { received: true };
  }
}
