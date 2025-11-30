import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  constructor(@Inject('STRIPE_CLIENT') private readonly stripe: Stripe) {}

  get client() {
    return this.stripe;
  }

  async createCustomer(params: { email: string; name?: string }) {
    return this.stripe.customers.create({
      email: params.email,
      name: params.name,
    });
  }

  async createCheckoutSession(params: {
    priceId: string;
    customerId?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    return this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      customer: params.customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      subscription_data: {
        metadata: params.metadata,
      },
    });
  }

  async createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }) {
    return this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
