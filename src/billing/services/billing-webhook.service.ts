// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from 'prisma/prisma.service';
// import Stripe from 'stripe';

// @Injectable()
// export class BillingWebhookService {
//   private readonly logger = new Logger(BillingWebhookService.name);

//   constructor(private readonly prisma: PrismaService) {}

//   // -----------------------------------------------------------
//   // Main Event Handler
//   // -----------------------------------------------------------
//   async handleEvent(event: Stripe.Event) {
//     this.logger.log(`Stripe event received: ${event.type}`);

//     switch (event.type) {
//       case 'checkout.session.completed':
//         await this.handleCheckoutCompleted(event);
//         break;

//       case 'customer.subscription.created':
//       case 'customer.subscription.updated':
//         await this.handleSubscriptionUpdated(event);
//         break;

//       case 'customer.subscription.deleted':
//         await this.handleSubscriptionDeleted(event);
//         break;

//       case 'invoice.payment_succeeded':
//         await this.handleInvoicePaymentSucceeded(event);
//         break;

//       case 'invoice.payment_failed':
//         await this.handleInvoicePaymentFailed(event);
//         break;

//       default:
//         this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
//         break;
//     }
//   }

//   // -----------------------------------------------------------
//   // checkout.session.completed
//   // -----------------------------------------------------------
//   private async handleCheckoutCompleted(event: Stripe.Event) {
//     const session = event.data.object as Stripe.Checkout.Session;

//     const metadata = session.metadata ?? {};
//     const businessId = Number(metadata.businessId);
//     const planId = Number(metadata.planId);

//     if (!businessId || !planId) {
//       this.logger.warn('Checkout session missing metadata');
//       return;
//     }

//     this.logger.log(
//       `Checkout.session.completed → business:${businessId} plan:${planId}`,
//     );
//   }

//   // -----------------------------------------------------------
//   // customer.subscription.created / updated
//   // -----------------------------------------------------------
//   private async handleSubscriptionUpdated(event: Stripe.Event) {
//     const stripeSub = event.data.object as any; // 👈 make it 'any'
//     console.log('i am from web hook');

//     const metadata = stripeSub.metadata ?? {};
//     const businessId = Number(metadata.businessId);
//     const planId = Number(metadata.planId);

//     if (!businessId || !planId) {
//       this.logger.warn('Subscription updated missing metadata');
//       return;
//     }

//     const startDate = new Date(stripeSub.current_period_start * 1000);
//     const endDate = new Date(stripeSub.current_period_end * 1000);

//     await this.prisma.subscription.upsert({
//       where: {
//         business_id_plan_id: {
//           business_id: businessId,
//           plan_id: planId,
//         },
//       },
//       create: {
//         business_id: businessId,
//         plan_id: planId,
//         status: stripeSub.status.toUpperCase(),
//         start_date: startDate,
//         end_date: endDate,
//         stripe_subscription_id: stripeSub.id,
//         stripe_customer_id:
//           typeof stripeSub.customer === 'string'
//             ? stripeSub.customer
//             : (stripeSub.customer?.id ?? null),
//       },
//       update: {
//         status: stripeSub.status.toUpperCase(),
//         end_date: endDate,
//         stripe_subscription_id: stripeSub.id,
//         stripe_customer_id:
//           typeof stripeSub.customer === 'string'
//             ? stripeSub.customer
//             : (stripeSub.customer?.id ?? null),
//       },
//     });
//   }

//   // -----------------------------------------------------------
//   // customer.subscription.deleted
//   // -----------------------------------------------------------
//   private async handleSubscriptionDeleted(event: Stripe.Event) {
//     const stripeSub: Stripe.Subscription = event.data.object as any;

//     const metadata = stripeSub.metadata ?? {};
//     const businessId = Number(metadata.businessId);
//     const planId = Number(metadata.planId);

//     if (!businessId || !planId) {
//       this.logger.warn('Subscription deleted missing metadata');
//       return;
//     }

//     await this.prisma.subscription.updateMany({
//       where: {
//         business_id: businessId,
//         plan_id: planId,
//       },
//       data: {
//         status: 'CANCELED',
//       },
//     });

//     this.logger.log(
//       `Subscription canceled → business:${businessId}, plan:${planId}`,
//     );
//   }

//   // -----------------------------------------------------------
//   // invoice.payment_succeeded
//   // -----------------------------------------------------------
//   private async handleInvoicePaymentSucceeded(event: Stripe.Event) {
//     const invoice = event.data.object as Stripe.Invoice;
//     const metadata = invoice.metadata ?? {};

//     const businessId = Number(metadata.businessId);
//     const planId = Number(metadata.planId);

//     if (!businessId || !planId) {
//       this.logger.warn('Invoice payment succeeded missing metadata');
//       return;
//     }

//     // Stripe does not type payment_intent consistently → safe cast
//     const paymentIntentRaw = (invoice as any).payment_intent;
//     const paymentIntentId =
//       typeof paymentIntentRaw === 'string'
//         ? paymentIntentRaw
//         : (paymentIntentRaw?.id ?? null);

//     await this.prisma.paymentHistory.create({
//       data: {
//         business_id: businessId,
//         plan_id: planId,
//         amount: (invoice.amount_paid ?? 0) / 100,
//         currency: invoice.currency,
//         payment_method: 'STRIPE',
//         invoice_url: invoice.hosted_invoice_url ?? '',
//         status: 'PAID',
//         stripe_invoice_id: invoice.id,
//         stripe_payment_intent_id: paymentIntentId,
//       },
//     });

//     this.logger.log(
//       `Invoice paid → business:${businessId}, plan:${planId}, amount:${invoice.amount_paid}`,
//     );
//   }

//   // -----------------------------------------------------------
//   // invoice.payment_failed
//   // -----------------------------------------------------------
//   private async handleInvoicePaymentFailed(event: Stripe.Event) {
//     const invoice = event.data.object as Stripe.Invoice;
//     const metadata = invoice.metadata ?? {};

//     const businessId = Number(metadata.businessId);
//     const planId = Number(metadata.planId);

//     if (!businessId || !planId) {
//       this.logger.warn('Invoice payment failed missing metadata');
//       return;
//     }

//     const paymentIntentRaw = (invoice as any).payment_intent;
//     const paymentIntentId =
//       typeof paymentIntentRaw === 'string'
//         ? paymentIntentRaw
//         : (paymentIntentRaw?.id ?? null);

//     await this.prisma.paymentHistory.create({
//       data: {
//         business_id: businessId,
//         plan_id: planId,
//         amount: (invoice.amount_due ?? 0) / 100,
//         currency: invoice.currency,
//         payment_method: 'STRIPE',
//         invoice_url: invoice.hosted_invoice_url ?? '',
//         status: 'FAILED',
//         stripe_invoice_id: invoice.id,
//         stripe_payment_intent_id: paymentIntentId,
//       },
//     });

//     this.logger.log(
//       `Invoice failed → business:${businessId}, plan:${planId}, amount:${invoice.amount_due}`,
//     );
//   }
// }
// src/billing/services/billing-webhook.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Main entrypoint – called from your controller
  async handleEvent(event: Stripe.Event) {
    this.logger.log(`Stripe webhook: ${event.type} (${event.id})`);

    try {
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
      }
    } catch (err) {
      this.logger.error(
        `Error handling Stripe event ${event.type} (${event.id}): ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }

  // ------------------------------------------------------------------
  // 1) checkout.session.completed  (just logging / sanity check)
  // ------------------------------------------------------------------
  private async handleCheckoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    const metadata = session.metadata ?? {};
    const businessId = metadata.businessId ? Number(metadata.businessId) : null;
    const planId = metadata.planId ? Number(metadata.planId) : null;

    if (!businessId || !planId) {
      this.logger.warn(
        'checkout.session.completed received without businessId/planId metadata',
      );
      return;
    }

    this.logger.log(
      `Checkout completed for business=${businessId}, plan=${planId}, session=${session.id}`,
    );
    // Subscription creation itself is handled by customer.subscription.created/updated
  }

  // ------------------------------------------------------------------
  // 2) customer.subscription.created / updated
  //    → Upsert Subscription row in DB
  // ------------------------------------------------------------------
  private async handleSubscriptionUpdated(event: Stripe.Event) {
    // Use "any" so TS doesn't complain about current_period_start / end
    const stripeSub: any = event.data.object as any;
    const metadata = stripeSub.metadata ?? {};

    const businessId = metadata.businessId ? Number(metadata.businessId) : null;
    const planId = metadata.planId ? Number(metadata.planId) : null;

    if (!businessId || !planId) {
      this.logger.warn(
        'customer.subscription.* missing metadata businessId/planId',
      );
      return;
    }

    // Convert Stripe timestamp (seconds) → JS Date (ms)
    // const startDate = new Date(stripeSub.current_period_start * 1000);
    // const endDate = new Date(stripeSub.current_period_end * 1000);
    const startDate = stripeSub.current_period_start
      ? new Date(stripeSub.current_period_start * 1000)
      : new Date();

    const endDate = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000)
      : null;

    const status: string = String(stripeSub.status || '').toUpperCase(); // ACTIVE, TRIALING, PAST_DUE, CANCELED, etc.

    // ⚠️ Requires this in Prisma:
    // @@unique([business_id, plan_id], name: "business_id_plan_id")
    const subscription = await this.prisma.subscription.upsert({
      where: {
        business_id_plan_id: {
          business_id: businessId,
          plan_id: planId,
        },
      },
      create: {
        business_id: businessId,
        plan_id: planId,
        status,
        start_date: startDate,
        end_date: endDate,
        stripe_subscription_id: stripeSub.id,
        stripe_customer_id:
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : (stripeSub.customer?.id ?? null),
      },
      update: {
        status,
        end_date: endDate,
        stripe_subscription_id: stripeSub.id,
        stripe_customer_id:
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : (stripeSub.customer?.id ?? null),
      },
    });

    this.logger.log(
      `Subscription upserted: business=${businessId}, plan=${planId}, status=${status}, subId=${subscription.id}`,
    );
  }

  // ------------------------------------------------------------------
  // 3) customer.subscription.deleted
  //    → Mark subscription as CANCELED in DB
  // ------------------------------------------------------------------
  private async handleSubscriptionDeleted(event: Stripe.Event) {
    // const stripeSub: any = event.data.object as any;
    const stripeSub: any = event.data.object as any;

    const metadata = stripeSub.metadata ?? {};

    const businessId = metadata.businessId ? Number(metadata.businessId) : null;
    const planId = metadata.planId ? Number(metadata.planId) : null;

    if (!businessId || !planId) {
      this.logger.warn(
        'customer.subscription.deleted missing metadata businessId/planId',
      );
      return;
    }

    const result = await this.prisma.subscription.updateMany({
      where: {
        business_id: businessId,
        plan_id: planId,
      },
      data: {
        status: 'CANCELED',
      },
    });

    this.logger.log(
      `Subscription canceled in DB: business=${businessId}, plan=${planId}, affected=${result.count}`,
    );
  }

  // ------------------------------------------------------------------
  // 4) invoice.payment_succeeded
  //    → Create PaymentHistory row (status = PAID)
  // ------------------------------------------------------------------
  private async handleInvoicePaymentSucceeded(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoice.metadata ?? {};

    let businessId = metadata.businessId ? Number(metadata.businessId) : null;
    let planId = metadata.planId ? Number(metadata.planId) : null;

    if (!businessId || !planId) {
      this.logger.warn(
        'invoice.payment_succeeded missing businessId/planId metadata',
      );
      return;
    }

    // Stripe typings for payment_intent are messy → use any
    const paymentIntentRaw = (invoice as any).payment_intent as
      | string
      | Stripe.PaymentIntent
      | null
      | undefined;

    const paymentIntentId =
      typeof paymentIntentRaw === 'string'
        ? paymentIntentRaw
        : (paymentIntentRaw?.id ?? null);

    const amountPaid = (invoice.amount_paid ?? 0) / 100;

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        // subscription_id: can be set if you want, using lookup
        amount: amountPaid,
        currency: invoice.currency,
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? '',
        status: 'PAID',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    this.logger.log(
      `Invoice payment succeeded: business=${businessId}, plan=${planId}, amount=${amountPaid}, invoice=${invoice.id}`,
    );
  }

  // ------------------------------------------------------------------
  // 5) invoice.payment_failed
  //    → Create PaymentHistory row (status = FAILED)
  // ------------------------------------------------------------------
  private async handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoice.metadata ?? {};

    const businessId = metadata.businessId ? Number(metadata.businessId) : null;
    const planId = metadata.planId ? Number(metadata.planId) : null;

    if (!businessId || !planId) {
      this.logger.warn(
        'invoice.payment_failed missing businessId/planId metadata',
      );
      return;
    }

    const paymentIntentRaw = (invoice as any).payment_intent as
      | string
      | Stripe.PaymentIntent
      | null
      | undefined;

    const paymentIntentId =
      typeof paymentIntentRaw === 'string'
        ? paymentIntentRaw
        : (paymentIntentRaw?.id ?? null);

    const amountDue = (invoice.amount_due ?? 0) / 100;

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        amount: amountDue,
        currency: invoice.currency,
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? '',
        status: 'FAILED',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    this.logger.log(
      `Invoice payment failed: business=${businessId}, plan=${planId}, amount=${amountDue}, invoice=${invoice.id}`,
    );
  }
}
