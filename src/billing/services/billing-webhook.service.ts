import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------
  // Main Event Handler
  // -----------------------------------------------------------
  async handleEvent(event: Stripe.Event) {
    this.logger.log(`Stripe event received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;

      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
        break;
    }
  }

  // -----------------------------------------------------------
  // checkout.session.completed
  // -----------------------------------------------------------
  private async handleCheckoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    const metadata = session.metadata ?? {};
    const businessId = Number(metadata.businessId);
    const planId = Number(metadata.planId);

    if (!businessId || !planId) {
      this.logger.warn('Checkout session missing metadata');
      return;
    }

    this.logger.log(
      `Checkout.session.completed → business:${businessId} plan:${planId}`,
    );
  }

  // -----------------------------------------------------------
  // customer.subscription.created / updated
  // -----------------------------------------------------------
  private async handleSubscriptionUpdated(event: Stripe.Event) {
    const stripeSub = event.data.object as any; // 👈 make it 'any'

    const metadata = stripeSub.metadata ?? {};
    const businessId = Number(metadata.businessId);
    const planId = Number(metadata.planId);

    if (!businessId || !planId) {
      this.logger.warn('Subscription updated missing metadata');
      return;
    }

    const startDate = new Date(stripeSub.current_period_start * 1000);
    const endDate = new Date(stripeSub.current_period_end * 1000);

    await this.prisma.subscription.upsert({
      where: {
        business_id_plan_id: {
          business_id: businessId,
          plan_id: planId,
        },
      },
      create: {
        business_id: businessId,
        plan_id: planId,
        status: stripeSub.status.toUpperCase(),
        start_date: startDate,
        end_date: endDate,
        stripe_subscription_id: stripeSub.id,
        stripe_customer_id:
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : (stripeSub.customer?.id ?? null),
      },
      update: {
        status: stripeSub.status.toUpperCase(),
        end_date: endDate,
        stripe_subscription_id: stripeSub.id,
        stripe_customer_id:
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : (stripeSub.customer?.id ?? null),
      },
    });
  }

  // -----------------------------------------------------------
  // customer.subscription.deleted
  // -----------------------------------------------------------
  private async handleSubscriptionDeleted(event: Stripe.Event) {
    const stripeSub: Stripe.Subscription = event.data.object as any;

    const metadata = stripeSub.metadata ?? {};
    const businessId = Number(metadata.businessId);
    const planId = Number(metadata.planId);

    if (!businessId || !planId) {
      this.logger.warn('Subscription deleted missing metadata');
      return;
    }

    await this.prisma.subscription.updateMany({
      where: {
        business_id: businessId,
        plan_id: planId,
      },
      data: {
        status: 'CANCELED',
      },
    });

    this.logger.log(
      `Subscription canceled → business:${businessId}, plan:${planId}`,
    );
  }

  // -----------------------------------------------------------
  // invoice.payment_succeeded
  // -----------------------------------------------------------
  private async handleInvoicePaymentSucceeded(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoice.metadata ?? {};

    const businessId = Number(metadata.businessId);
    const planId = Number(metadata.planId);

    if (!businessId || !planId) {
      this.logger.warn('Invoice payment succeeded missing metadata');
      return;
    }

    // Stripe does not type payment_intent consistently → safe cast
    const paymentIntentRaw = (invoice as any).payment_intent;
    const paymentIntentId =
      typeof paymentIntentRaw === 'string'
        ? paymentIntentRaw
        : (paymentIntentRaw?.id ?? null);

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        amount: (invoice.amount_paid ?? 0) / 100,
        currency: invoice.currency,
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? '',
        status: 'PAID',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    this.logger.log(
      `Invoice paid → business:${businessId}, plan:${planId}, amount:${invoice.amount_paid}`,
    );
  }

  // -----------------------------------------------------------
  // invoice.payment_failed
  // -----------------------------------------------------------
  private async handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoice.metadata ?? {};

    const businessId = Number(metadata.businessId);
    const planId = Number(metadata.planId);

    if (!businessId || !planId) {
      this.logger.warn('Invoice payment failed missing metadata');
      return;
    }

    const paymentIntentRaw = (invoice as any).payment_intent;
    const paymentIntentId =
      typeof paymentIntentRaw === 'string'
        ? paymentIntentRaw
        : (paymentIntentRaw?.id ?? null);

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        amount: (invoice.amount_due ?? 0) / 100,
        currency: invoice.currency,
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? '',
        status: 'FAILED',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    this.logger.log(
      `Invoice failed → business:${businessId}, plan:${planId}, amount:${invoice.amount_due}`,
    );
  }
}
