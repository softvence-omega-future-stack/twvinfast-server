import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==============================================================
  // MAIN STRIPE WEBHOOK HANDLER
  // ==============================================================
  async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`➡️ Stripe Webhook: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.checkoutSessionCompleted(event);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.subscriptionUpsert(event);
          break;

        case 'customer.subscription.deleted':
          await this.subscriptionDeleted(event);
          break;

        case 'invoice.payment_succeeded':
          await this.invoicePaymentSucceeded(event);
          break;

        case 'invoice.payment_failed':
          await this.invoicePaymentFailed(event);
          break;

        default:
          this.logger.log(`ℹ️ Unhandled webhook: ${event.type}`);
      }
    } catch (err: any) {
      this.logger.error(
        `❌ Error processing event=${event.type}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ==============================================================
  // HELPERS
  // ==============================================================
  private getMetadata(obj: any) {
    const md = obj?.metadata ?? {};
    return {
      businessId: md.businessId ? Number(md.businessId) : undefined,
      planId: md.planId ? Number(md.planId) : undefined,
    };
  }

  private safeDate(ts?: number | null): Date | undefined {
    return ts ? new Date(ts * 1000) : undefined;
  }

  private async findSubscriptionByStripeId(id: string) {
    if (!id) return null;
    return this.prisma.subscription.findFirst({
      where: { stripe_subscription_id: id },
    });
  }

  private async findSubscriptionByCustomer(customerId: string) {
    return this.prisma.subscription.findFirst({
      where: { stripe_customer_id: customerId },
      orderBy: { id: 'desc' },
    });
  }

  private getStripeCustomerId(obj: any): string | undefined {
    const raw = obj?.customer;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && 'id' in raw) return raw.id;
    return undefined;
  }

  private getStripeSubscriptionId(invoice: Stripe.Invoice): string | undefined {
    const raw: any = (invoice as any).subscription;
    if (!raw) return undefined;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && 'id' in raw) return raw.id;
    return undefined;
  }

  // ==============================================================
  // 1) CHECKOUT SESSION COMPLETED
  // ==============================================================
  private async checkoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    const { businessId, planId } = this.getMetadata(session);

    this.logger.log(
      `✅ Checkout Completed → business=${businessId}, plan=${planId}`,
    );

    const rawCustomer = session.customer;
    const stripeCustomerId =
      typeof rawCustomer === 'string'
        ? rawCustomer
        : rawCustomer && 'id' in rawCustomer
          ? (rawCustomer as any).id
          : undefined;

    if (businessId && stripeCustomerId) {
      await this.prisma.business.update({
        where: { id: businessId },
        data: { stripe_customer_id: stripeCustomerId },
      });

      this.logger.log(
        `🏷️ Saved stripe_customer_id=${stripeCustomerId} to business=${businessId}`,
      );
    }
  }

  // ==============================================================
  // 2) SUBSCRIPTION CREATED / UPDATED
  // ==============================================================
  private async subscriptionUpsert(event: Stripe.Event) {
    const sub = event.data.object as Stripe.Subscription;
    let { businessId, planId } = this.getMetadata(sub);

    // fallback from DB
    if (!businessId || !planId) {
      const existing = await this.findSubscriptionByStripeId(sub.id);
      if (existing) {
        businessId = businessId ?? existing.business_id;
        planId = planId ?? existing.plan_id;
      }
    }

    // resolve plan by price
    if (!planId && sub.items?.data?.length) {
      const priceId = sub.items.data[0]?.price?.id;
      if (priceId) {
        const plan = await this.prisma.plan.findFirst({
          where: { stripe_price_id: priceId },
        });
        if (plan) planId = plan.id;
      }
    }

    if (!businessId || !planId) {
      this.logger.warn(
        `⚠️ Unable to resolve business/plan for subscription=${sub.id}`,
      );
      return;
    }

    const raw: any = sub;
    const startDate = this.safeDate(raw.current_period_start);
    const endDate = this.safeDate(raw.current_period_end);

    const stripeCustomerId = this.getStripeCustomerId(sub);

    await this.prisma.subscription.upsert({
      where: {
        business_id_plan_id: { business_id: businessId, plan_id: planId },
      },
      create: {
        business_id: businessId,
        plan_id: planId,
        status: (sub.status ?? 'active').toUpperCase(),
        start_date: startDate,
        end_date: endDate,
        renewal_date: endDate,
        stripe_subscription_id: sub.id,
        stripe_customer_id: stripeCustomerId,
      },
      update: {
        status: (sub.status ?? 'active').toUpperCase(),
        start_date: startDate ?? undefined,
        end_date: endDate ?? undefined,
        renewal_date: endDate ?? undefined,
        stripe_subscription_id: sub.id,
        stripe_customer_id: stripeCustomerId ?? undefined,
      },
    });

    this.logger.log(
      `🔄 Subscription Updated → business=${businessId}, plan=${planId}`,
    );
  }

  // ==============================================================
  // 3) SUBSCRIPTION DELETED
  // ==============================================================
  private async subscriptionDeleted(event: Stripe.Event) {
    const sub = event.data.object as Stripe.Subscription;

    let { businessId, planId } = this.getMetadata(sub);

    if (!businessId || !planId) {
      const existing = await this.findSubscriptionByStripeId(sub.id);
      if (existing) {
        businessId = existing.business_id;
        planId = existing.plan_id;
      }
    }

    if (!businessId || !planId) {
      this.logger.warn(`⚠️ subscription.deleted missing business/plan`);
      return;
    }

    await this.prisma.subscription.updateMany({
      where: { business_id: businessId, plan_id: planId },
      data: {
        status: 'CANCELLED',
        end_date: new Date(),
      },
    });

    this.logger.log(
      `❌ Subscription cancelled → business=${businessId}, plan=${planId}`,
    );
  }

  // ==============================================================
  // 4) INVOICE PAYMENT SUCCEEDED
  // ==============================================================
  private async invoicePaymentSucceeded(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;

    let { businessId, planId } = this.getMetadata(invoice);
    const stripeSubId = this.getStripeSubscriptionId(invoice);

    // fallback
    if (!businessId || !planId) {
      if (stripeSubId) {
        const found = await this.findSubscriptionByStripeId(stripeSubId);
        if (found) {
          businessId = found.business_id;
          planId = found.plan_id;
        }
      }
    }

    if (!businessId || !planId) {
      this.logger.warn(`⚠️ invoice.payment_succeeded missing metadata`);
      return;
    }

    const amount = (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100;
    const currency = invoice.currency?.toUpperCase() ?? 'USD';

    const line = invoice.lines?.data?.[0];
    const startDate = line?.period?.start
      ? new Date(line.period.start * 1000)
      : undefined;
    const endDate = line?.period?.end
      ? new Date(line.period.end * 1000)
      : undefined;

    await this.prisma.subscription.updateMany({
      where: { business_id: businessId, plan_id: planId },
      data: {
        status: 'ACTIVE',
        start_date: startDate ?? undefined,
        end_date: endDate ?? undefined,
        renewal_date: endDate ?? undefined,
        stripe_customer_id: this.getStripeCustomerId(invoice),
      },
    });

    const subscriptionDb = await this.prisma.subscription.findFirst({
      where: { business_id: businessId, plan_id: planId },
    });

    const raw: any = invoice;
    const paymentIntentId =
      typeof raw.payment_intent === 'string'
        ? raw.payment_intent
        : raw.payment_intent?.id;

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        subscription_id: subscriptionDb?.id,
        amount,
        currency,
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? undefined,
        status: 'PAID',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    this.logger.log(
      `💰 Invoice Paid → business=${businessId}, plan=${planId}, amount=${amount}`,
    );
  }

  // ==============================================================
  // 5) INVOICE PAYMENT FAILED
  // ==============================================================
  private async invoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;

    let { businessId, planId } = this.getMetadata(invoice);
    const stripeSubId = this.getStripeSubscriptionId(invoice);

    if (!businessId || !planId) {
      const found = await this.findSubscriptionByStripeId(stripeSubId as any);
      if (found) {
        businessId = found.business_id;
        planId = found.plan_id;
      }
    }

    if (!businessId || !planId) {
      this.logger.warn(`⚠️ invoice.payment_failed missing metadata`);
      return;
    }

    const amount = (invoice.amount_due ?? 0) / 100;
    const currency = invoice.currency?.toUpperCase() ?? 'USD';

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        amount,
        currency,
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? undefined,
        status: 'FAILED',
        stripe_invoice_id: invoice.id,
      },
    });

    await this.prisma.subscription.updateMany({
      where: { business_id: businessId, plan_id: planId },
      data: { status: 'PAST_DUE' },
    });

    this.logger.log(
      `⚠️ Invoice FAILED → business=${businessId}, plan=${planId}`,
    );
  }
}
