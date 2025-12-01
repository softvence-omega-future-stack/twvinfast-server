// // src/billing/services/billing-webhook.service.ts

// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from 'prisma/prisma.service';
// import Stripe from 'stripe';

// @Injectable()
// export class BillingWebhookService {
//   private readonly logger = new Logger(BillingWebhookService.name);

//   constructor(private readonly prisma: PrismaService) {}

//   // ==============================================================
//   // MAIN ENTRY
//   // ==============================================================
//   async handleEvent(event: Stripe.Event) {
//     this.logger.log(`➡️ Stripe Webhook: ${event.type} (${event.id})`);

//     try {
//       switch (event.type) {
//         case 'checkout.session.completed':
//           return this.checkoutCompleted(event);

//         case 'customer.subscription.created':
//         case 'customer.subscription.updated':
//           return this.subscriptionUpdated(event);

//         case 'customer.subscription.deleted':
//           return this.subscriptionDeleted(event);

//         case 'invoice.payment_succeeded':
//           return this.invoicePaymentSucceeded(event);

//         case 'invoice.payment_failed':
//           return this.invoicePaymentFailed(event);

//         default:
//           this.logger.debug(`⚠️ Unhandled event type: ${event.type}`);
//       }
//     } catch (err) {
//       this.logger.error(
//         `❌ Error handling ${event.type}: ${err?.message}`,
//         err?.stack,
//       );
//     }
//   }

//   // ==============================================================
//   // HELPERS
//   // ==============================================================

//   private getMetadata(obj: any) {
//     const m = obj?.metadata ?? {};
//     return {
//       businessId: m.businessId ? Number(m.businessId) : null,
//       planId: m.planId ? Number(m.planId) : null,
//     };
//   }

//   private stripeToDate(unix: number | null | undefined) {
//     return unix ? new Date(unix * 1000) : null;
//   }

//   private async findSubscriptionByStripeId(id: string) {
//     return this.prisma.subscription.findFirst({
//       where: { stripe_subscription_id: id },
//     });
//   }

//   private async findSubscriptionByCustomer(id: string) {
//     return this.prisma.subscription.findFirst({
//       where: { stripe_customer_id: id },
//       orderBy: { id: 'desc' },
//     });
//   }

//   private async findSubscriptionId(businessId: number, planId: number) {
//     const sub = await this.prisma.subscription.findUnique({
//       where: {
//         business_id_plan_id: { business_id: businessId, plan_id: planId },
//       },
//     });
//     return sub?.id ?? null;
//   }

//   // ==============================================================
//   // 1) CHECKOUT SESSION COMPLETE
//   // ==============================================================

//   private async checkoutCompleted(event: Stripe.Event) {
//     const session = event.data.object as Stripe.Checkout.Session;
//     const { businessId, planId } = this.getMetadata(session);

//     if (!businessId || !planId) {
//       this.logger.warn('⚠️ Checkout session missing metadata');
//       return;
//     }

//     this.logger.log(
//       `✅ Checkout Completed → business=${businessId}, plan=${planId}`,
//     );
//   }

//   // ==============================================================
//   // 2) SUBSCRIPTION CREATED/UPDATED
//   // ==============================================================

//   private async subscriptionUpdated(event: Stripe.Event) {
//     const sub = event.data.object as any;

//     const { businessId, planId } = this.getMetadata(sub);
//     if (!businessId || !planId) {
//       this.logger.warn('⚠️ Subscription event missing metadata');
//       return;
//     }

//     const status = String(sub.status).toUpperCase();

//     // Stripe sometimes sends null for start/end BEFORE invoice payment.
//     const startDate = this.stripeToDate(sub.current_period_start);
//     const endDate = this.stripeToDate(sub.current_period_end);

//     const updated = await this.prisma.subscription.upsert({
//       where: {
//         business_id_plan_id: { business_id: businessId, plan_id: planId },
//       },
//       create: {
//         business_id: businessId,
//         plan_id: planId,
//         status,
//         start_date: startDate,
//         end_date: endDate,
//         stripe_subscription_id: sub.id,
//         stripe_customer_id:
//           typeof sub.customer === 'string'
//             ? sub.customer
//             : (sub.customer?.id ?? null),
//       },
//       update: {
//         status,
//         end_date: endDate,
//         stripe_subscription_id: sub.id,
//       },
//     });

//     this.logger.log(
//       `🔄 Subscription Upserted → business=${businessId}, plan=${planId}, status=${status}`,
//     );
//   }

//   // ==============================================================
//   // 3) SUBSCRIPTION DELETED
//   // ==============================================================

//   private async subscriptionDeleted(event: Stripe.Event) {
//     const sub = event.data.object as any;
//     const { businessId, planId } = this.getMetadata(sub);

//     if (!businessId || !planId) return;

//     await this.prisma.subscription.updateMany({
//       where: { business_id: businessId, plan_id: planId },
//       data: { status: 'CANCELED' },
//     });

//     this.logger.log(
//       `❌ Subscription Cancelled → business=${businessId}, plan=${planId}`,
//     );
//   }

//   // ==============================================================
//   // 4) INVOICE PAYMENT SUCCEEDED
//   // ==============================================================

//   private async invoicePaymentSucceeded(event: Stripe.Event) {
//     const invoice = event.data.object as Stripe.Invoice;

//     let { businessId, planId } = this.getMetadata(invoice);

//     // ------------------ METADATA RECOVERY ------------------
//     if (!businessId || !planId) {
//       // ----- Subscription from invoice -----
//       const rawSub: any = (invoice as any).subscription;
//       const stripeSubId =
//         typeof rawSub === 'string' ? rawSub : (rawSub?.id ?? null);

//       if (stripeSubId) {
//         const sub = await this.findSubscriptionByStripeId(stripeSubId);
//         if (sub) {
//           businessId = sub.business_id;
//           planId = sub.plan_id;
//           this.logger.log(`♻ Metadata recovered via subscription`);
//         }
//       }
//     }

//     if (!businessId || !planId) {
//       const rawCustomer = invoice.customer as any;
//       const stripeCustomerId =
//         typeof rawCustomer === 'string' ? rawCustomer : rawCustomer?.id;

//       if (stripeCustomerId) {
//         const sub = await this.findSubscriptionByCustomer(stripeCustomerId);
//         if (sub) {
//           businessId = sub.business_id;
//           planId = sub.plan_id;
//           this.logger.log(`♻ Metadata recovered via customer`);
//         }
//       }
//     }

//     if (!businessId || !planId) {
//       this.logger.error('❌ Could not resolve business/plan from invoice');
//       return;
//     }

//     // ------------------ PAYMENT INTENT FIX ------------------
//     // ----- Payment Intent -----
//     const rawIntent: any = (invoice as any).payment_intent;
//     const paymentIntentId =
//       typeof rawIntent === 'string' ? rawIntent : (rawIntent?.id ?? null);
//     // ------------------ BILLING DATES (ALWAYS AVAILABLE HERE) ------------------
//     const line = invoice.lines?.data?.[0];
//     const startDate = line?.period?.start
//       ? new Date(line.period.start * 1000)
//       : undefined;
//     const endDate = line?.period?.end
//       ? new Date(line.period.end * 1000)
//       : undefined;

//     // ------------------ UPDATE SUBSCRIPTION ------------------
//     await this.prisma.subscription.updateMany({
//       where: { business_id: businessId, plan_id: planId },
//       data: {
//         status: 'ACTIVE',
//         start_date: startDate,
//         end_date: endDate,
//       },
//     });

//     // ------------------ SAVE PAYMENT HISTORY ------------------
//     const subscriptionId = await this.findSubscriptionId(businessId, planId);

//     await this.prisma.paymentHistory.create({
//       data: {
//         business_id: businessId,
//         plan_id: planId,
//         subscription_id: subscriptionId,
//         amount: (invoice.amount_paid ?? 0) / 100,
//         currency: invoice.currency,
//         status: 'PAID',
//         payment_method: 'STRIPE',
//         invoice_url: invoice.hosted_invoice_url ?? '',
//         stripe_invoice_id: invoice.id,
//         stripe_payment_intent_id: paymentIntentId,
//       },
//     });

//     this.logger.log(`💰 Invoice PAID → business=${businessId}, plan=${planId}`);
//   }

//   // ==============================================================
//   // 5) PAYMENT FAILED
//   // ==============================================================

//   private async invoicePaymentFailed(event: Stripe.Event) {
//     const invoice = event.data.object as Stripe.Invoice;

//     let { businessId, planId } = this.getMetadata(invoice);

//     if (!businessId || !planId) {
//       const rawSub: any = (invoice as any).subscription;
//       const id = typeof rawSub === 'string' ? rawSub : (rawSub?.id ?? null);

//       if (id) {
//         const sub = await this.findSubscriptionByStripeId(id);
//         if (sub) {
//           businessId = sub.business_id;
//           planId = sub.plan_id;
//         }
//       }
//     }

//     if (!businessId || !planId) return;

//     const rawIntent: any = (invoice as any).payment_intent;
//     const paymentIntentId =
//       typeof rawIntent === 'string' ? rawIntent : (rawIntent?.id ?? null);

//     const subscriptionId = await this.findSubscriptionId(businessId, planId);

//     await this.prisma.paymentHistory.create({
//       data: {
//         business_id: businessId,
//         plan_id: planId,
//         subscription_id: subscriptionId,
//         amount: (invoice.amount_due ?? 0) / 100,
//         currency: invoice.currency,
//         invoice_url: invoice.hosted_invoice_url ?? '',
//         status: 'FAILED',
//         payment_method: 'STRIPE',
//         stripe_invoice_id: invoice.id,
//         stripe_payment_intent_id: paymentIntentId,
//       },
//     });

//     this.logger.log(
//       `⚠ Invoice FAILED → business=${businessId}, plan=${planId}`,
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

  // ==========================================================================
  // MAIN STRIPE EVENT HANDLER
  // ==========================================================================
  async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`➡️ Stripe Webhook: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.checkoutCompleted(event);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.subscriptionUpdated(event);
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
          this.logger.debug(`⚠️ No handler for event: ${event.type}`);
      }
    } catch (err: any) {
      this.logger.error(
        `❌ Error processing ${event.type}: ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  private getMetadata(obj: any) {
    const md = obj?.metadata ?? {};
    return {
      businessId: md.businessId ? Number(md.businessId) : null,
      planId: md.planId ? Number(md.planId) : null,
    };
  }

  private stripeToDate(unix: number | null | undefined): Date | null {
    return unix ? new Date(unix * 1000) : null;
  }

  private async findSubscriptionByStripeId(id: string) {
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

  private async findSubscriptionId(businessId: number, planId: number) {
    const found = await this.prisma.subscription.findUnique({
      where: {
        business_id_plan_id: { business_id: businessId, plan_id: planId },
      },
    });
    return found?.id ?? null;
  }

  // ==========================================================================
  // 1) CHECKOUT SESSION COMPLETED
  // ==========================================================================
  private async checkoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    const { businessId, planId } = this.getMetadata(session);
    if (!businessId || !planId) {
      this.logger.warn(`⚠️ Checkout missing metadata`);
      return;
    }

    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : ((session.customer as any)?.id ?? null);

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : ((session.subscription as any)?.id ?? null);

    if (!stripeCustomerId || !stripeSubscriptionId) {
      this.logger.warn(`⚠️ Missing customer or subscription ID`);
      return;
    }

    await this.prisma.business.update({
      where: { id: businessId },
      data: { stripe_customer_id: stripeCustomerId },
    });

    const now = new Date();

    await this.prisma.subscription.upsert({
      where: {
        business_id_plan_id: { business_id: businessId, plan_id: planId },
      },
      create: {
        business_id: businessId,
        plan_id: planId,
        status: 'ACTIVE',
        start_date: now,
        end_date: null,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
      },
      update: {
        status: 'ACTIVE',
        start_date: now,
        end_date: null,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
      },
    });

    this.logger.log(
      `✅ Checkout Completed → business=${businessId}, plan=${planId}`,
    );
  }

  // ==========================================================================
  // 2) SUBSCRIPTION UPDATED (includes cancel / undo cancel)
  // ==========================================================================
  private async subscriptionUpdated(event: Stripe.Event) {
    const sub = event.data.object as Stripe.Subscription & {
      current_period_start?: number;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      cancel_at?: number | null;
      ended_at?: number | null;
      customer?: string | { id: string };
      items?: any;
    };

    let { businessId, planId } = this.getMetadata(sub);

    // fallback: find in DB by stripe subscription id
    let existing = await this.findSubscriptionByStripeId(sub.id);
    if (existing) {
      businessId = businessId ?? existing.business_id;
      planId = planId ?? existing.plan_id;
    }

    // fallback: resolve plan from line_items
    if (!planId && sub.items?.data?.length) {
      const priceId = sub.items.data[0].price?.id;
      if (priceId) {
        const plan = await this.prisma.plan.findFirst({
          where: { stripe_price_id: priceId },
        });
        if (plan) planId = plan.id;
      }
    }

    // fallback: resolve business from stripe customer
    if (!businessId && sub.customer) {
      const stripeCustomerId =
        typeof sub.customer === 'string'
          ? sub.customer
          : ((sub.customer as any)?.id ?? null);
      if (stripeCustomerId) {
        const found =
          existing ?? (await this.findSubscriptionByCustomer(stripeCustomerId));
        if (found) businessId = found.business_id;
      }
    }

    if (!businessId || !planId) {
      this.logger.warn(`⚠️ Cannot resolve business/plan from subscription`);
      return;
    }

    const stripeCustomerId =
      typeof sub.customer === 'string'
        ? sub.customer
        : ((sub.customer as any)?.id ?? null);

    const status = (sub.status ?? 'active').toUpperCase();

    const startDate = this.stripeToDate(sub.current_period_start);
    const renewalDate = this.stripeToDate(sub.current_period_end);

    // cancel / undo cancel logic
    let endDate: Date | null = null;

    if (sub.cancel_at_period_end && sub.current_period_end) {
      endDate = this.stripeToDate(sub.current_period_end); // scheduled cancel
    } else if (status === 'CANCELED' && sub.ended_at) {
      endDate = this.stripeToDate(sub.ended_at); // immediate cancel
    } else {
      endDate = null; // UNDO CANCEL
    }

    await this.prisma.subscription.upsert({
      where: {
        business_id_plan_id: { business_id: businessId, plan_id: planId },
      },
      create: {
        business_id: businessId,
        plan_id: planId,
        status,
        start_date: startDate,
        end_date: endDate,
        renewal_date: renewalDate,
        stripe_subscription_id: sub.id,
        stripe_customer_id: stripeCustomerId,
      },
      update: {
        status,
        start_date: startDate ?? undefined,
        end_date: endDate,
        renewal_date: renewalDate,
        stripe_subscription_id: sub.id,
        stripe_customer_id: stripeCustomerId ?? undefined,
      },
    });

    this.logger.log(
      `🔄 Subscription Updated → business=${businessId}, plan=${planId}, status=${status}, endDate=${endDate}`,
    );
  }

  // ==========================================================================
  // 3) SUBSCRIPTION DELETED
  // ==========================================================================
  private async subscriptionDeleted(event: Stripe.Event) {
    const sub = event.data.object as Stripe.Subscription & {
      ended_at?: number | null;
      cancel_at?: number | null;
    };

    const existing = await this.findSubscriptionByStripeId(sub.id);
    if (!existing) return;

    const endDate =
      this.stripeToDate(sub.ended_at) ??
      this.stripeToDate(sub.cancel_at) ??
      new Date();

    await this.prisma.subscription.update({
      where: {
        business_id_plan_id: {
          business_id: existing.business_id,
          plan_id: existing.plan_id,
        },
      },
      data: {
        status: 'CANCELED',
        end_date: endDate,
        renewal_date: null,
      },
    });

    this.logger.log(
      `❌ Subscription Deleted → business=${existing.business_id}, plan=${existing.plan_id}`,
    );
  }

  // ==========================================================================
  // 4) INVOICE PAID
  // ==========================================================================
  private async invoicePaymentSucceeded(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | { id: string };
      payment_intent?: string | { id: string };
      customer?: string | { id: string };
    };

    let { businessId, planId } = this.getMetadata(invoice);

    // fallback 1: subscription
    if (!businessId || !planId) {
      const rawSub = invoice.subscription;
      const subId = typeof rawSub === 'string' ? rawSub : rawSub?.id;
      if (subId) {
        const found = await this.findSubscriptionByStripeId(subId);
        if (found) {
          businessId = businessId ?? found.business_id;
          planId = planId ?? found.plan_id;
        }
      }
    }

    // fallback 2: customer
    if (!businessId || !planId) {
      const rawCust = invoice.customer;
      const custId = typeof rawCust === 'string' ? rawCust : rawCust?.id;
      if (custId) {
        const found = await this.findSubscriptionByCustomer(custId);
        if (found) {
          businessId = businessId ?? found.business_id;
          planId = planId ?? found.plan_id;
        }
      }
    }

    if (!businessId || !planId) {
      this.logger.error(`❌ invoice.payment_succeeded missing metadata`);
      return;
    }

    const rawPI = invoice.payment_intent;
    const paymentIntentId =
      typeof rawPI === 'string' ? rawPI : (rawPI?.id ?? null);

    const amount = (invoice.amount_paid ?? 0) / 100;
    const currency = invoice.currency ?? 'usd';

    // Update subscription billing dates
    const line = invoice.lines?.data?.[0];
    const startDate = line?.period?.start
      ? new Date(line.period.start * 1000)
      : null;
    const endDate = line?.period?.end ? new Date(line.period.end * 1000) : null;

    await this.prisma.subscription.updateMany({
      where: { business_id: businessId, plan_id: planId },
      data: {
        status: 'ACTIVE',
        start_date: startDate ?? undefined,
        end_date: endDate ?? undefined,
      },
    });

    const subscriptionId = await this.findSubscriptionId(businessId, planId);

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        subscription_id: subscriptionId ?? undefined,
        amount,
        currency,
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? '',
        status: 'PAID',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId ?? undefined,
      },
    });

    this.logger.log(
      `💰 Invoice PAID → business=${businessId}, plan=${planId}, amount=${amount}`,
    );
  }

  // ==========================================================================
  // 5) INVOICE FAILED
  // ==========================================================================
  private async invoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | { id: string };
      payment_intent?: string | { id: string };
      customer?: string | { id: string };
    };

    let { businessId, planId } = this.getMetadata(invoice);

    // fallback subscription
    if (!businessId || !planId) {
      const rawSub = invoice.subscription;
      const subId = typeof rawSub === 'string' ? rawSub : rawSub?.id;
      if (subId) {
        const found = await this.findSubscriptionByStripeId(subId);
        if (found) {
          businessId = found.business_id;
          planId = found.plan_id;
        }
      }
    }

    // fallback customer
    if (!businessId || !planId) {
      const rawCust = invoice.customer;
      const custId = typeof rawCust === 'string' ? rawCust : rawCust?.id;
      if (custId) {
        const found = await this.findSubscriptionByCustomer(custId);
        if (found) {
          businessId = found.business_id;
          planId = found.plan_id;
        }
      }
    }

    if (!businessId || !planId) {
      this.logger.error(`❌ invoice.payment_failed missing metadata`);
      return;
    }

    const rawPI = invoice.payment_intent;
    const paymentIntentId =
      typeof rawPI === 'string' ? rawPI : (rawPI?.id ?? null);

    const amount = (invoice.amount_due ?? 0) / 100;
    const currency = invoice.currency ?? 'usd';

    const subscriptionId = await this.findSubscriptionId(businessId, planId);

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        subscription_id: subscriptionId ?? undefined,
        amount,
        currency,
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? '',
        status: 'FAILED',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId ?? undefined,
      },
    });

    this.logger.log(
      `⚠️ Invoice FAILED → business=${businessId}, plan=${planId}`,
    );
  }
}
