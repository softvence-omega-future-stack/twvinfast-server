// src/billing/services/billing-webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from 'prisma/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';

@Injectable()
export class BillingWebhookService {
  private logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async handleEvent(event: Stripe.Event) {
    this.logger.log(`➡️ ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        return this.checkoutCompleted(event);

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return this.subscriptionUpsert(event);

      case 'customer.subscription.deleted':
        return this.subscriptionDeleted(event);

      case 'invoice.payment_succeeded':
        return this.invoicePaid(event);

      case 'invoice.payment_failed':
        return this.invoiceFailed(event);
    }
  }

  // ---------------------------------------------
  private extractMeta(meta: any) {
    return {
      businessId: Number(meta?.businessId),
      planId: Number(meta?.planId),
    };
  }

  private getDates(sub: any) {
    return {
      start: sub.current_period_start
        ? new Date(sub.current_period_start * 1000)
        : null,
      end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : sub.trial_end
          ? new Date(sub.trial_end * 1000)
          : null,
    };
  }

  // ---------------------------------------------
  private async checkoutCompleted(event: any) {
    const s = event.data.object;
    const { businessId, planId } = this.extractMeta(s.metadata);

    const stripeSub = await this.stripeService.retrieveSubscription(
      s.subscription,
    );

    const { start, end } = this.getDates(stripeSub);

    await this.prisma.subscription.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        stripe_subscription_id: stripeSub.id,
        stripe_customer_id: s.customer,
        status: stripeSub.status.toUpperCase(), // TRIALING
        start_date: start,
        renewal_date: end,
      },
    });
  }

  // ---------------------------------------------
  private async subscriptionUpsert(event: any) {
    const sub = event.data.object;
    const { start, end } = this.getDates(sub);

    await this.prisma.subscription.updateMany({
      where: { stripe_subscription_id: sub.id },
      data: {
        status: sub.status.toUpperCase(), // ONLY place ACTIVE happens
        start_date: start,
        renewal_date: end,
      },
    });
  }

  // ---------------------------------------------
  private async subscriptionDeleted(event: any) {
    await this.prisma.subscription.updateMany({
      where: { stripe_subscription_id: event.data.object.id },
      data: {
        status: 'CANCELED',
        end_date: new Date(),
      },
    });
  }

  // ---------------------------------------------
  // 🔒 CRITICAL FIX: DO NOT ACTIVATE DURING TRIAL
  // ---------------------------------------------
  private async invoicePaid(event: any) {
    const invoice = event.data.object;

    // 🔒 HARD STOP — already recorded
    const alreadyExists = await this.prisma.paymentHistory.findUnique({
      where: { stripe_invoice_id: invoice.id },
    });

    if (alreadyExists) {
      this.logger.warn(`⚠️ Duplicate payment ignored (invoice=${invoice.id})`);
      return;
    }

    const sub = await this.prisma.subscription.findFirst({
      where: { stripe_subscription_id: invoice.subscription },
    });

    if (!sub) return;

    await this.prisma.paymentHistory.create({
      data: {
        business_id: sub.business_id,
        plan_id: sub.plan_id,
        subscription_id: sub.id,
        amount: (invoice.amount_paid ?? 0) / 100,
        currency: invoice.currency ?? 'usd',
        payment_method: 'card',
        status: 'PAID',
        stripe_invoice_id: invoice.id,
        invoice_url: invoice.hosted_invoice_url ?? null,
      },
    });

    // ❗ Trial হলে status change করবেন না
    if (sub.status === 'TRIALING') {
      this.logger.log('🟡 Trial invoice → payment recorded only');
      return;
    }
  }

  // ---------------------------------------------
  private async invoiceFailed(event: any) {
    const sub = await this.prisma.subscription.findFirst({
      where: { stripe_subscription_id: event.data.object.subscription },
    });

    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE' },
    });
  }
}
