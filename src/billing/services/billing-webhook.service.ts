// import { Injectable, Logger } from '@nestjs/common';
// import Stripe from 'stripe';
// import { PrismaService } from 'prisma/prisma.service';
// import { StripeService } from 'src/stripe/stripe.service';

// @Injectable()
// export class BillingWebhookService {
//   private logger = new Logger(BillingWebhookService.name);

//   constructor(
//     private prisma: PrismaService,
//     private stripe: StripeService,
//   ) {}

//   // ---------------------------
//   // MAIN HANDLER
//   // ---------------------------
//   async handleEvent(event: Stripe.Event) {
//     this.logger.log(`➡️ Event: ${event.type} (${event.id})`);

//     try {
//       switch (event.type) {
//         case 'checkout.session.completed':
//           return this.checkoutCompleted(event);

//         case 'customer.subscription.created':
//         case 'customer.subscription.updated':
//           return this.subscriptionUpsert(event);

//         case 'customer.subscription.deleted':
//           return this.subscriptionDeleted(event);

//         case 'invoice.payment_succeeded':
//           return this.invoicePaid(event);

//         case 'invoice.payment_failed':
//           return this.invoiceFailed(event);

//         case 'invoice.paid':
//           this.logger.debug('Skipping invoice.paid to prevent duplicate');
//           return;

//         default:
//           this.logger.debug(`No handler for event ${event.type}`);
//           return;
//       }
//     } catch (err) {
//       this.logger.error(`❌ Webhook error: ${(err as any).message}`);
//       throw err;
//     }
//   }

//   // ---------------------------
//   // HELPERS
//   // ---------------------------
//   private extractMetadata(metadata: any) {
//     return {
//       businessId: metadata?.businessId
//         ? Number(metadata.businessId)
//         : undefined,
//       planId: metadata?.planId ? Number(metadata.planId) : undefined,
//     };
//   }

//   private ensureMeta(
//     businessId: number | undefined,
//     planId: number | undefined,
//   ) {
//     if (!businessId || !planId) {
//       this.logger.error(
//         `❌ Missing businessId/planId → aborting subscription operation`,
//       );
//       return false;
//     }
//     return true;
//   }

//   private getPeriod(sub: any) {
//     const start = sub.current_period_start
//       ? new Date(sub.current_period_start * 1000)
//       : null;

//     const end = sub.current_period_end
//       ? new Date(sub.current_period_end * 1000)
//       : null;

//     return {
//       startDate: start,
//       renewalDate: end,
//     };
//   }
//   // ---------------------------
//   // CHECKOUT COMPLETED
//   // ---------------------------
//   private async checkoutCompleted(event: any) {
//     const session = event.data.object;

//     const subscriptionId = session.subscription;
//     const customerId = session.customer;
//     const { businessId, planId } = this.extractMetadata(session.metadata);

//     if (!this.ensureMeta(businessId, planId)) return;

//     const sub = await this.stripe.retrieveSubscription(subscriptionId);
//     const { startDate, renewalDate } = this.getPeriod(sub);

//     await this.prisma.subscription.upsert({
//       where: {
//         business_id_plan_id: { business_id: businessId!, plan_id: planId! },
//       },
//       create: {
//         business_id: businessId!,
//         plan_id: planId!,
//         stripe_subscription_id: subscriptionId,
//         stripe_customer_id: customerId,
//         status: 'TRIALING',
//         start_date: startDate,
//         renewal_date: renewalDate,
//       },
//       update: {
//         status: 'TRIALING',
//         start_date: startDate,
//         renewal_date: renewalDate,
//       },
//     });

//     this.logger.log(`✅ Subscription created (TRIAL) business=${businessId}`);
//   }

//   // ---------------------------
//   // SUBSCRIPTION CREATED/UPDATED
//   // ---------------------------
//   private async subscriptionUpsert(event: any) {
//     const sub = event.data.object;

//     const { businessId, planId } = this.extractMetadata(sub.metadata);
//     if (!this.ensureMeta(businessId, planId)) return;

//     const { startDate, renewalDate } = this.getPeriod(sub);

//     await this.prisma.subscription.upsert({
//       where: {
//         business_id_plan_id: { business_id: businessId!, plan_id: planId! },
//       },
//       create: {
//         business_id: businessId!,
//         plan_id: planId!,
//         stripe_subscription_id: sub.id,
//         stripe_customer_id: sub.customer,
//         status: sub.status.toUpperCase(),
//         start_date: startDate,
//         renewal_date: renewalDate,
//       },
//       update: {
//         status: sub.status.toUpperCase(),
//         start_date: startDate,
//         end_date: renewalDate,
//         renewal_date: renewalDate,
//       },
//     });

//     this.logger.log(`🔄 Subscription updated business=${businessId}`);
//   }

//   // ---------------------------
//   // SUBSCRIPTION DELETED
//   // ---------------------------
//   private async subscriptionDeleted(event: any) {
//     const sub = event.data.object;
//     const { businessId, planId } = this.extractMetadata(sub.metadata);

//     if (!this.ensureMeta(businessId, planId)) return;

//     await this.prisma.subscription.updateMany({
//       where: { business_id: businessId!, plan_id: planId! },
//       data: {
//         status: 'CANCELED',
//         end_date: new Date(),
//       },
//     });

//     this.logger.log(`🚫 Subscription canceled business=${businessId}`);
//   }

//   // ---------------------------
//   // PAYMENT SUCCEEDED
//   // ---------------------------
//   private async invoicePaid(event: any) {
//     const invoice = event.data.object;

//     // Prevent duplicate billing
//     const dup = await this.prisma.paymentHistory.findFirst({
//       where: { stripe_invoice_id: invoice.id },
//     });
//     if (dup) {
//       this.logger.warn(`Duplicate invoice ignored: ${invoice.id}`);
//       return;
//     }

//     const subscriptionId =
//       invoice.subscription ?? invoice.lines.data[0]?.subscription;

//     const sub = await this.prisma.subscription.findFirst({
//       where: { stripe_subscription_id: subscriptionId },
//     });

//     if (!sub) {
//       this.logger.warn(
//         `⚠️ No subscription found for invoice=${invoice.id} → skipping.`,
//       );
//       return;
//     }

//     const amount = (invoice.amount_paid ?? 0) / 100;

//     await this.prisma.paymentHistory.create({
//       data: {
//         business_id: sub.business_id,
//         plan_id: sub.plan_id,
//         subscription_id: sub.id,
//         amount,
//         currency: invoice.currency ?? 'usd',
//         payment_method: 'card',
//         status: 'PAID',
//         invoice_url: invoice.hosted_invoice_url ?? null,
//         stripe_invoice_id: invoice.id,
//       },
//     });

//     const period = invoice.lines.data[0].period;
//     const renewalDate = new Date(period.end * 1000);

//     await this.prisma.subscription.update({
//       where: { id: sub.id },
//       data: {
//         status: 'ACTIVE',
//         renewal_date: renewalDate,
//       },
//     });

//     this.logger.log(`💰 Payment recorded business=${sub.business_id}`);
//   }

//   // ---------------------------
//   // PAYMENT FAILED
//   // ---------------------------
//   private async invoiceFailed(event: any) {
//     const invoice = event.data.object;

//     const sub = await this.prisma.subscription.findFirst({
//       where: { stripe_subscription_id: invoice.subscription },
//     });

//     if (!sub) return;

//     await this.prisma.paymentHistory.create({
//       data: {
//         business_id: sub.business_id,
//         plan_id: sub.plan_id,
//         subscription_id: sub.id,
//         amount: (invoice.amount_due ?? 0) / 100,
//         currency: invoice.currency ?? 'usd',
//         payment_method: 'card',
//         status: 'FAILED',
//         stripe_invoice_id: invoice.id,
//       },
//     });

//     await this.prisma.subscription.update({
//       where: { id: sub.id },
//       data: { status: 'PAST_DUE' },
//     });

//     this.logger.log(`⚠️ Payment FAILED business=${sub.business_id}`);
//   }
// }

import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from 'prisma/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';

@Injectable()
export class BillingWebhookService {
  private logger = new Logger(BillingWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
  ) {}

  // ------------------------------------------
  // MAIN WEBHOOK ROUTER
  // ------------------------------------------
  async handleEvent(event: Stripe.Event) {
    this.logger.log(`➡️ Event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        // Checkout events
        case 'checkout.session.completed':
          return this.checkoutCompleted(event);

        case 'checkout.session.expired':
          return this.checkoutExpired(event);

        case 'checkout.session.async_payment_failed':
          return this.checkoutFailed(event);

        // Subscription lifecycle
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          return this.subscriptionUpsert(event);

        case 'customer.subscription.deleted':
          return this.subscriptionDeleted(event);

        // Invoice events
        case 'invoice.payment_succeeded':
          return this.invoicePaid(event);

        case 'invoice.payment_failed':
          return this.invoiceFailed(event);

        case 'invoice.paid':
          this.logger.debug('Skipping invoice.paid (duplicate event)');
          return;

        default:
          this.logger.debug(`No handler for event ${event.type}`);
          return;
      }
    } catch (err) {
      this.logger.error(`❌ Webhook error: ${(err as any).message}`);
      throw err;
    }
  }

  // ------------------------------------------
  // HELPERS
  // ------------------------------------------

  private extractMetadata(metadata: any) {
    return {
      businessId: metadata?.businessId
        ? Number(metadata.businessId)
        : undefined,
      planId: metadata?.planId ? Number(metadata.planId) : undefined,
    };
  }

  private ensureMeta(
    businessId: number | undefined,
    planId: number | undefined,
  ) {
    if (!businessId || !planId) {
      this.logger.error(`❌ Missing businessId/planId → aborting`);
      return false;
    }
    return true;
  }

  private getPeriod(sub: any) {
    const start = sub.current_period_start
      ? new Date(sub.current_period_start * 1000)
      : null;

    const end = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null;

    return {
      startDate: start,
      renewalDate: end,
    };
  }

  // ------------------------------------------
  // CHECKOUT COMPLETED → TRIAL / FIRST PAYMENT
  // ------------------------------------------
  private async checkoutCompleted(event: any) {
    const session = event.data.object;

    const subscriptionId = session.subscription;
    const customerId = session.customer;

    const { businessId, planId } = this.extractMetadata(session.metadata);
    if (!this.ensureMeta(businessId, planId)) return;

    const stripeSub = await this.stripe.retrieveSubscription(subscriptionId);
    const { startDate, renewalDate } = this.getPeriod(stripeSub);

    // Create subscription as TRIALING first
    await this.prisma.subscription.upsert({
      where: {
        business_id_plan_id: { business_id: businessId!, plan_id: planId! },
      },
      create: {
        business_id: businessId!,
        plan_id: planId!,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status: stripeSub.status.toUpperCase(), // likely TRIALING
        start_date: startDate,
        renewal_date: renewalDate,
      },
      update: {
        status: stripeSub.status.toUpperCase(),
        start_date: startDate,
        renewal_date: renewalDate,
      },
    });

    this.logger.log(
      `✅ Checkout completed → Subscription created for business=${businessId}`,
    );
  }

  // ------------------------------------------
  // CHECKOUT EXPIRED (User canceled on payment page)
  // ------------------------------------------
  private async checkoutExpired(event: any) {
    const session = event.data.object;

    const { businessId, planId } = this.extractMetadata(session.metadata);
    if (!this.ensureMeta(businessId, planId)) return;

    await this.prisma.subscription.updateMany({
      where: { business_id: businessId!, plan_id: planId! },
      data: {
        status: 'CANCELED',
        end_date: new Date(),
      },
    });

    this.logger.warn(
      `❌ Checkout expired → Subscription canceled for business=${businessId}`,
    );
  }

  // ------------------------------------------
  // CHECKOUT PAYMENT FAILED
  // ------------------------------------------
  private async checkoutFailed(event: any) {
    const session = event.data.object;

    const { businessId, planId } = this.extractMetadata(session.metadata);
    if (!this.ensureMeta(businessId, planId)) return;

    await this.prisma.subscription.updateMany({
      where: { business_id: businessId!, plan_id: planId! },
      data: {
        status: 'CANCELED',
        end_date: new Date(),
      },
    });

    this.logger.warn(
      `❌ Checkout payment failed → Subscription canceled for business=${businessId}`,
    );
  }

  // ------------------------------------------
  // SUBSCRIPTION CREATED / UPDATED
  // ------------------------------------------
  private async subscriptionUpsert(event: any) {
    const sub = event.data.object;

    const { businessId, planId } = this.extractMetadata(sub.metadata);
    if (!this.ensureMeta(businessId, planId)) return;

    const { startDate, renewalDate } = this.getPeriod(sub);

    await this.prisma.subscription.upsert({
      where: {
        business_id_plan_id: { business_id: businessId!, plan_id: planId! },
      },
      create: {
        business_id: businessId!,
        plan_id: planId!,
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer,
        status: sub.status.toUpperCase(),
        start_date: startDate,
        renewal_date: renewalDate,
      },
      update: {
        status: sub.status.toUpperCase(),
        start_date: startDate,
        end_date: renewalDate,
        renewal_date: renewalDate,
      },
    });

    this.logger.log(
      `🔄 Subscription updated (status=${sub.status}) for business=${businessId}`,
    );
  }

  // ------------------------------------------
  // SUBSCRIPTION DELETED (Canceled from Stripe portal)
  // ------------------------------------------
  private async subscriptionDeleted(event: any) {
    const sub = event.data.object;

    const { businessId, planId } = this.extractMetadata(sub.metadata);
    if (!this.ensureMeta(businessId, planId)) return;

    await this.prisma.subscription.updateMany({
      where: { business_id: businessId!, plan_id: planId! },
      data: {
        status: 'CANCELED',
        end_date: new Date(),
      },
    });

    this.logger.log(`🚫 Subscription deleted → business=${businessId}`);
  }

  // ------------------------------------------
  // PAYMENT SUCCEEDED
  // ------------------------------------------
  private async invoicePaid(event: any) {
    const invoice = event.data.object;

    // Prevent duplicates
    const dup = await this.prisma.paymentHistory.findFirst({
      where: { stripe_invoice_id: invoice.id },
    });
    if (dup) {
      this.logger.warn(`Duplicate invoice ignored: ${invoice.id}`);
      return;
    }

    const subscriptionId =
      invoice.subscription ?? invoice.lines.data[0]?.subscription;

    const sub = await this.prisma.subscription.findFirst({
      where: { stripe_subscription_id: subscriptionId },
    });

    if (!sub) {
      this.logger.warn(
        `⚠️ No subscription record found for invoice=${invoice.id}`,
      );
      return;
    }

    const amount = (invoice.amount_paid ?? 0) / 100;

    // Record payment history
    await this.prisma.paymentHistory.create({
      data: {
        business_id: sub.business_id,
        plan_id: sub.plan_id,
        subscription_id: sub.id,
        amount,
        currency: invoice.currency ?? 'usd',
        payment_method: 'card',
        status: 'PAID',
        invoice_url: invoice.hosted_invoice_url ?? null,
        stripe_invoice_id: invoice.id,
      },
    });

    // Update subscription to ACTIVE
    const period = invoice.lines.data[0].period;
    const renewalDate = new Date(period.end * 1000);

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        renewal_date: renewalDate,
      },
    });

    this.logger.log(
      `💰 Payment success → Subscription ACTIVE (business=${sub.business_id})`,
    );
  }

  // ------------------------------------------
  // PAYMENT FAILED
  // ------------------------------------------
  private async invoiceFailed(event: any) {
    const invoice = event.data.object;

    const sub = await this.prisma.subscription.findFirst({
      where: { stripe_subscription_id: invoice.subscription },
    });

    if (!sub) return;

    await this.prisma.paymentHistory.create({
      data: {
        business_id: sub.business_id,
        plan_id: sub.plan_id,
        subscription_id: sub.id,
        amount: (invoice.amount_due ?? 0) / 100,
        currency: invoice.currency ?? 'usd',
        payment_method: 'card',
        status: 'FAILED',
        stripe_invoice_id: invoice.id,
      },
    });

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE' },
    });

    this.logger.warn(`⚠️ Payment failed → business=${sub.business_id}`);
  }
}
