// src/stripe/stripe.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      this.logger.error(
        'STRIPE_SECRET_KEY is not set in environment variables',
      );
      throw new Error('Missing STRIPE_SECRET_KEY');
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as any,
    });
  }

  get client() {
    return this.stripe;
  }
  // ADD THESE METHODS ↓↓↓
  // ================================
  async retrieveCharge(chargeId: string) {
    return this.stripe.charges.retrieve(chargeId);
  }

  // ------------------------------------------------
  // 1) CUSTOMER
  // ------------------------------------------------
  async createCustomer(params: {
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }) {
    return this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });
  }

  // ------------------------------------------------
  // 2) SUBSCRIPTION CHECKOUT SESSION
  // ------------------------------------------------
  async createCheckoutSession(params: {
    priceId: string;
    customerId?: string;
    successUrl: string;
    cancelUrl: string;
    // checkout-level metadata
    metadata?: Record<string, string>;
    // subscription-level metadata
    subscription_data?: {
      metadata?: Record<string, string>;
    };
  }) {
    return this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: params.customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      // 🔥 attaches metadata to subscription → used later in webhooks
      subscription_data: params.subscription_data,
      // checkout session metadata
      metadata: params.metadata,
    });
  }

  // ------------------------------------------------
  // 3) BILLING PORTAL
  // ------------------------------------------------
  async createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }) {
    return this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  // ------------------------------------------------
  // 4) WEBHOOK SIGNATURE VERIFY
  // ------------------------------------------------
  constructWebhookEvent(rawBody: Buffer, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  // (optional helpers)
  async retrieveSubscription(subscriptionId: string) {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string) {
    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async cancelSubscriptionImmediately(subscriptionId: string) {
    return this.stripe.subscriptions.cancel(subscriptionId);
  }
}
