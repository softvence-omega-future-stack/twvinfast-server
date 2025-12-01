// // src/billing/services/billing-webhook.service.ts
// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from 'prisma/prisma.service';
// import { StripeService } from 'src/stripe/stripe.service';
// import Stripe from 'stripe';

// @Injectable()
// export class BillingWebhookService {
//   private readonly logger = new Logger(BillingWebhookService.name);

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly stripeService: StripeService, // ← REQUIRED
//   ) {}

//   // ==============================================================
//   // MAIN ENTRYPOINT
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
//     } catch (error) {
//       this.logger.error(
//         `❌ Error handling ${event.type}: ${error?.message}`,
//         error?.stack,
//       );
//       throw error;
//     }
//   }

//   // ==============================================================
//   // 🔧 HELPERS
//   // ==============================================================
//   private getMetadata(obj: any) {
//     const metadata = obj?.metadata ?? {};
//     return {
//       businessId: metadata.businessId ? Number(metadata.businessId) : null,
//       planId: metadata.planId ? Number(metadata.planId) : null,
//     };
//   }

//   private stripeToDate(unix: number | null | undefined) {
//     return unix ? new Date(unix * 1000) : null;
//   }

//   private async findSubscriptionByStripeId(stripeSubId: string) {
//     return this.prisma.subscription.findFirst({
//       where: { stripe_subscription_id: stripeSubId },
//     });
//   }

//   private async findSubscriptionByCustomer(stripeCustomerId: string) {
//     // If you want to be stricter, you can filter by ACTIVE/INCOMPLETE here
//     return this.prisma.subscription.findFirst({
//       where: { stripe_customer_id: stripeCustomerId },
//       orderBy: { id: 'desc' }, // latest
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
//   // 1) CHECKOUT COMPLETED
//   // ==============================================================
//   private async checkoutCompleted(event: Stripe.Event) {
//     const session = event.data.object as Stripe.Checkout.Session;
//     const { businessId, planId } = this.getMetadata(session);

//     if (!businessId || !planId) {
//       this.logger.warn('⚠️ checkout.session.completed missing metadata');
//       return;
//     }

//     this.logger.log(
//       `✅ Checkout Completed → business=${businessId}, plan=${planId}, session=${session.id}`,
//     );
//   }

//   // ==============================================================
//   // 2) SUBSCRIPTION CREATED/UPDATED
//   // ==============================================================

//   private async subscriptionUpdated(event: Stripe.Event) {
//     const sub: any = event.data.object;
//     console.log('here is a Sub', sub);
//     const { businessId, planId } = this.getMetadata(sub);

//     if (!businessId || !planId) {
//       this.logger.warn('⚠️ Subscription event missing metadata');
//       return;
//     }

//     // const status = String(sub.status).toUpperCase();

//     // // FIX 1: Stripe always sends `start_date`, use it
//     // const startDate = this.stripeToDate(sub.start_date);

//     // // FIX 2: Only populated after first payment → ACTIVE status
//     // const endDate = this.stripeToDate(sub.current_period_end);

//     // created myself
//     const status = String(sub.status).toUpperCase();

//     // Stripe sends different fields depending on subscription state
//     const startDate =
//       this.stripeToDate(sub.current_period_start) ??
//       this.stripeToDate(sub.billing_cycle_anchor) ??
//       this.stripeToDate(sub.start_date);

//     let endDate = this.stripeToDate(sub.current_period_end);

//     // If ACTIVE but no end_date yet → Stripe will send it after payment
//     if (status === 'ACTIVE' && !endDate) {
//       // Webhook invoice.finalized or payment_succeeded will update this later
//       endDate = null;
//     }

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
//         start_date: startDate, // IMPORTANT
//         end_date: endDate,
//         stripe_subscription_id: sub.id,
//       },
//     });

//     this.logger.log(
//       `🔄 Subscription Upserted → business=${businessId}, plan=${planId}, status=${status}, id=${updated.id}`,
//     );
//   }

//   // private async subscriptionUpdated(event: Stripe.Event) {
//   //   const sub: any = event.data.object;
//   //   console.log('here is a Sub', sub);
//   //   const { businessId, planId } = this.getMetadata(sub);

//   //   if (!businessId || !planId) {
//   //     this.logger.warn('⚠️ Subscription event missing metadata');
//   //     return;
//   //   }

//   //   const status = String(sub.status).toUpperCase();
//   //   const startDate = this.stripeToDate(sub.current_period_start);
//   //   const endDate = this.stripeToDate(sub.current_period_end);

//   //   const updated = await this.prisma.subscription.upsert({
//   //     where: {
//   //       business_id_plan_id: { business_id: businessId, plan_id: planId },
//   //     },
//   //     create: {
//   //       business_id: businessId,
//   //       plan_id: planId,
//   //       status,
//   //       start_date: startDate,
//   //       end_date: endDate,
//   //       stripe_subscription_id: sub.id,
//   //       stripe_customer_id:
//   //         typeof sub.customer === 'string'
//   //           ? sub.customer
//   //           : (sub.customer?.id ?? null),
//   //     },
//   //     update: {
//   //       status,
//   //       end_date: endDate,
//   //       stripe_subscription_id: sub.id,
//   //     },
//   //   });

//   //   this.logger.log(
//   //     `🔄 Subscription Upserted → business=${businessId}, plan=${planId}, status=${status}, id=${updated.id}`,
//   //   );
//   // }

//   // ==============================================================
//   // 3) SUBSCRIPTION DELETED
//   // ==============================================================
//   private async subscriptionDeleted(event: Stripe.Event) {
//     const sub: any = event.data.object;
//     const { businessId, planId } = this.getMetadata(sub);

//     if (!businessId || !planId) {
//       this.logger.warn('⚠️ Subscription deletion missing metadata');
//       return;
//     }

//     const result = await this.prisma.subscription.updateMany({
//       where: { business_id: businessId, plan_id: planId },
//       data: { status: 'CANCELED' },
//     });

//     this.logger.log(
//       `❌ Subscription Canceled → business=${businessId}, plan=${planId}, affected=${result.count}`,
//     );
//   }

//   // ==============================================================
//   // 4) INVOICE PAYMENT SUCCEEDED
//   private async invoicePaymentSucceeded(event: Stripe.Event) {
//     const invoice = event.data.object as Stripe.Invoice;

//     let { businessId, planId } = this.getMetadata(invoice);

//     // Fallback: using subscription metadata
//     if (!businessId || !planId) {
//       const rawSub = (invoice as any).subscription;
//       const stripeSubId =
//         typeof rawSub === 'string' ? rawSub : (rawSub?.id ?? null);

//       if (stripeSubId) {
//         const sub = await this.findSubscriptionByStripeId(stripeSubId);
//         if (sub) {
//           businessId = sub.business_id;
//           planId = sub.plan_id;
//           this.logger.log(
//             `♻️ Metadata Recovered via subscription → business=${businessId}, plan=${planId}`,
//           );
//         }
//       }
//     }

//     // Fallback: search latest subscription by customer
//     if (!businessId || !planId) {
//       const rawCustomer = (invoice as any).customer;
//       const stripeCustomerId =
//         typeof rawCustomer === 'string'
//           ? rawCustomer
//           : (rawCustomer?.id ?? null);

//       if (stripeCustomerId) {
//         const sub = await this.findSubscriptionByCustomer(stripeCustomerId);
//         if (sub) {
//           businessId = sub.business_id;
//           planId = sub.plan_id;
//           this.logger.log(
//             `♻️ Metadata Recovered via customer → business=${businessId}, plan=${planId}`,
//           );
//         }
//       }
//     }

//     if (!businessId || !planId) {
//       this.logger.error('❌ Could not determine metadata for payment');
//       return;
//     }

//     // ===============================================
//     //  EXTRACT PAYMENT INTENT (SAFE, NO TS ERRORS)
//     // ===============================================
//     let paymentIntentId: string | null = null;

//     const rawPI = (invoice as any).payment_intent;
//     if (rawPI) {
//       paymentIntentId = typeof rawPI === 'string' ? rawPI : (rawPI?.id ?? null);
//     }

//     // If still missing → extract from charge
//     if (!paymentIntentId) {
//       const rawCharge =
//         (invoice as any).charge ?? (invoice as any).latest_charge;

//       if (rawCharge) {
//         const chargeId =
//           typeof rawCharge === 'string' ? rawCharge : rawCharge?.id;

//         if (chargeId) {
//           try {
//             const charge = await this.stripeService.retrieveCharge(chargeId);

//             const pi = (charge as any).payment_intent;
//             paymentIntentId = typeof pi === 'string' ? pi : (pi?.id ?? null);
//           } catch (e) {
//             this.logger.error(`❌ Failed to retrieve charge=${chargeId}`);
//           }
//         }
//       }
//     }

//     if (!paymentIntentId) {
//       this.logger.warn('⚠️ Could not find payment_intent_id');
//     }

//     // ===============================================
//     //  SAVE PAYMENT HISTORY
//     // ===============================================
//     const subscriptionId = await this.findSubscriptionId(businessId, planId);
//     const amountPaid = (invoice.amount_paid ?? 0) / 100;

//     await this.prisma.paymentHistory.create({
//       data: {
//         business_id: businessId,
//         plan_id: planId,
//         subscription_id: subscriptionId,
//         amount: amountPaid,
//         currency: invoice.currency,
//         payment_method: 'STRIPE',
//         invoice_url: invoice.hosted_invoice_url ?? '',
//         status: 'PAID',
//         stripe_invoice_id: invoice.id,
//         stripe_payment_intent_id: paymentIntentId, // SAFE
//       },
//     });

//     this.logger.log(
//       `💰 Invoice Paid → business=${businessId}, plan=${planId}, paymentIntent=${paymentIntentId}`,
//     );
//   }

//   // ==============================================================
//   // 4) INVOICE PAYMENT SUCCEEDED (FIXED)
//   // ==============================================================

//   // ==============================================================
//   // private async invoicePaymentSucceeded(event: Stripe.Event) {
//   //   const invoice = event.data.object as Stripe.Invoice;
//   //   let { businessId, planId } = this.getMetadata(invoice);

//   //   // --- 1) Try from metadata (ideal for first invoice if you set it) ---
//   //   if (!businessId || !planId) {
//   //     // --- 2) Try from invoice.subscription (normal subscription invoices) ---
//   //     const rawSub = (invoice as any).subscription;
//   //     const stripeSubId =
//   //       typeof rawSub === 'string' ? rawSub : (rawSub?.id ?? null);

//   //     if (stripeSubId) {
//   //       const sub = await this.findSubscriptionByStripeId(stripeSubId);
//   //       if (sub) {
//   //         businessId = sub.business_id;
//   //         planId = sub.plan_id;
//   //         this.logger.log(
//   //           `♻️ Metadata Recovered via subscription → business=${businessId}, plan=${planId}`,
//   //         );
//   //       }
//   //     }
//   //   }

//   //   // --- 3) Final fallback: use customer to find latest subscription ---
//   //   if (!businessId || !planId) {
//   //     const rawCustomer = (invoice as any).customer;
//   //     const stripeCustomerId =
//   //       typeof rawCustomer === 'string'
//   //         ? rawCustomer
//   //         : (rawCustomer?.id ?? null);

//   //     if (!stripeCustomerId) {
//   //       this.logger.error(
//   //         '❌ invoice.payment_succeeded: No subscription or customer to infer metadata',
//   //       );
//   //       return;
//   //     }

//   //     const sub = await this.findSubscriptionByCustomer(stripeCustomerId);
//   //     if (!sub) {
//   //       this.logger.error(
//   //         '❌ invoice.payment_succeeded: No subscription found in DB for customer',
//   //       );
//   //       return;
//   //     }

//   //     businessId = sub.business_id;
//   //     planId = sub.plan_id;

//   //     this.logger.log(
//   //       `♻️ Metadata Recovered via customer → business=${businessId}, plan=${planId}`,
//   //     );
//   //   }

//   //   const paymentIntentRaw = (invoice as any).payment_intent;
//   //   const paymentIntentId =
//   //     typeof paymentIntentRaw === 'string'
//   //       ? paymentIntentRaw
//   //       : (paymentIntentRaw?.id ?? null);

//   //   const amountPaid = (invoice.amount_paid ?? 0) / 100;
//   //   const subscriptionId = await this.findSubscriptionId(businessId, planId);

//   //   await this.prisma.paymentHistory.create({
//   //     data: {
//   //       business_id: businessId,
//   //       plan_id: planId,
//   //       subscription_id: subscriptionId,
//   //       amount: amountPaid,
//   //       currency: invoice.currency,
//   //       payment_method: 'STRIPE',
//   //       invoice_url: invoice.hosted_invoice_url ?? '',
//   //       status: 'PAID',
//   //       stripe_invoice_id: invoice.id,
//   //       stripe_payment_intent_id: paymentIntentId,
//   //     },
//   //   });

//   //   this.logger.log(
//   //     `💰 Invoice Paid → business=${businessId}, plan=${planId}, amount=${amountPaid}`,
//   //   );
//   // }

//   // ==============================================================
//   // 5) INVOICE PAYMENT FAILED
//   // ==============================================================
//   private async invoicePaymentFailed(event: Stripe.Event) {
//     const invoice = event.data.object as Stripe.Invoice;
//     let { businessId, planId } = this.getMetadata(invoice);

//     if (!businessId || !planId) {
//       const rawSub = (invoice as any).subscription;
//       const stripeSubId =
//         typeof rawSub === 'string' ? rawSub : (rawSub?.id ?? null);

//       if (stripeSubId) {
//         const sub = await this.findSubscriptionByStripeId(stripeSubId);
//         if (sub) {
//           businessId = sub.business_id;
//           planId = sub.plan_id;
//           this.logger.log(
//             `♻️ Metadata Recovered (FAILED) via subscription → business=${businessId}, plan=${planId}`,
//           );
//         }
//       }
//     }

//     if (!businessId || !planId) {
//       const rawCustomer = (invoice as any).customer;
//       const stripeCustomerId =
//         typeof rawCustomer === 'string'
//           ? rawCustomer
//           : (rawCustomer?.id ?? null);

//       if (stripeCustomerId) {
//         const sub = await this.findSubscriptionByCustomer(stripeCustomerId);
//         if (sub) {
//           businessId = sub.business_id;
//           planId = sub.plan_id;
//           this.logger.log(
//             `♻️ Metadata Recovered (FAILED) via customer → business=${businessId}, plan=${planId}`,
//           );
//         }
//       }
//     }

//     if (!businessId || !planId) {
//       this.logger.error(
//         '❌ invoice.payment_failed: Could not resolve business/plan',
//       );
//       return;
//     }

//     const paymentIntentRaw = (invoice as any).payment_intent;
//     const paymentIntentId =
//       typeof paymentIntentRaw === 'string'
//         ? paymentIntentRaw
//         : (paymentIntentRaw?.id ?? null);

//     const amountDue = (invoice.amount_due ?? 0) / 100;
//     const subscriptionId = await this.findSubscriptionId(businessId, planId);

//     await this.prisma.paymentHistory.create({
//       data: {
//         business_id: businessId,
//         plan_id: planId,
//         subscription_id: subscriptionId,
//         amount: amountDue,
//         currency: invoice.currency,
//         invoice_url: invoice.hosted_invoice_url ?? '',
//         payment_method: 'STRIPE',
//         status: 'FAILED',
//         stripe_invoice_id: invoice.id,
//         stripe_payment_intent_id: paymentIntentId,
//       },
//     });

//     this.logger.log(
//       `⚠️ Invoice FAILED → business=${businessId}, plan=${planId}, amount=${amountDue}`,
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

  // ==============================================================
  // MAIN ENTRY
  // ==============================================================
  async handleEvent(event: Stripe.Event) {
    this.logger.log(`➡️ Stripe Webhook: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          return this.checkoutCompleted(event);

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          return this.subscriptionUpdated(event);

        case 'customer.subscription.deleted':
          return this.subscriptionDeleted(event);

        case 'invoice.payment_succeeded':
          return this.invoicePaymentSucceeded(event);

        case 'invoice.payment_failed':
          return this.invoicePaymentFailed(event);

        default:
          this.logger.debug(`⚠️ Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(
        `❌ Error handling ${event.type}: ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ==============================================================
  // HELPERS
  // ==============================================================

  private getMetadata(obj: any) {
    const m = obj?.metadata ?? {};
    return {
      businessId: m.businessId ? Number(m.businessId) : null,
      planId: m.planId ? Number(m.planId) : null,
    };
  }

  private stripeToDate(unix: number | null | undefined) {
    return unix ? new Date(unix * 1000) : null;
  }

  private async findSubscriptionByStripeId(id: string) {
    return this.prisma.subscription.findFirst({
      where: { stripe_subscription_id: id },
    });
  }

  private async findSubscriptionByCustomer(id: string) {
    return this.prisma.subscription.findFirst({
      where: { stripe_customer_id: id },
      orderBy: { id: 'desc' },
    });
  }

  private async findSubscriptionId(businessId: number, planId: number) {
    const sub = await this.prisma.subscription.findUnique({
      where: {
        business_id_plan_id: { business_id: businessId, plan_id: planId },
      },
    });
    return sub?.id ?? null;
  }

  // ==============================================================
  // 1) CHECKOUT SESSION COMPLETE
  // ==============================================================

  private async checkoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    const { businessId, planId } = this.getMetadata(session);

    if (!businessId || !planId) {
      this.logger.warn('⚠️ Checkout session missing metadata');
      return;
    }

    this.logger.log(
      `✅ Checkout Completed → business=${businessId}, plan=${planId}`,
    );
  }

  // ==============================================================
  // 2) SUBSCRIPTION CREATED/UPDATED
  // ==============================================================

  private async subscriptionUpdated(event: Stripe.Event) {
    const sub = event.data.object as any;

    const { businessId, planId } = this.getMetadata(sub);
    if (!businessId || !planId) {
      this.logger.warn('⚠️ Subscription event missing metadata');
      return;
    }

    const status = String(sub.status).toUpperCase();

    // Stripe sometimes sends null for start/end BEFORE invoice payment.
    const startDate = this.stripeToDate(sub.current_period_start);
    const endDate = this.stripeToDate(sub.current_period_end);

    const updated = await this.prisma.subscription.upsert({
      where: {
        business_id_plan_id: { business_id: businessId, plan_id: planId },
      },
      create: {
        business_id: businessId,
        plan_id: planId,
        status,
        start_date: startDate,
        end_date: endDate,
        stripe_subscription_id: sub.id,
        stripe_customer_id:
          typeof sub.customer === 'string'
            ? sub.customer
            : (sub.customer?.id ?? null),
      },
      update: {
        status,
        end_date: endDate,
        stripe_subscription_id: sub.id,
      },
    });

    this.logger.log(
      `🔄 Subscription Upserted → business=${businessId}, plan=${planId}, status=${status}`,
    );
  }

  // ==============================================================
  // 3) SUBSCRIPTION DELETED
  // ==============================================================

  private async subscriptionDeleted(event: Stripe.Event) {
    const sub = event.data.object as any;
    const { businessId, planId } = this.getMetadata(sub);

    if (!businessId || !planId) return;

    await this.prisma.subscription.updateMany({
      where: { business_id: businessId, plan_id: planId },
      data: { status: 'CANCELED' },
    });

    this.logger.log(
      `❌ Subscription Cancelled → business=${businessId}, plan=${planId}`,
    );
  }

  // ==============================================================
  // 4) INVOICE PAYMENT SUCCEEDED
  // ==============================================================

  private async invoicePaymentSucceeded(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;

    let { businessId, planId } = this.getMetadata(invoice);

    // ------------------ METADATA RECOVERY ------------------
    if (!businessId || !planId) {
      // ----- Subscription from invoice -----
      const rawSub: any = (invoice as any).subscription;
      const stripeSubId =
        typeof rawSub === 'string' ? rawSub : (rawSub?.id ?? null);

      if (stripeSubId) {
        const sub = await this.findSubscriptionByStripeId(stripeSubId);
        if (sub) {
          businessId = sub.business_id;
          planId = sub.plan_id;
          this.logger.log(`♻ Metadata recovered via subscription`);
        }
      }
    }

    if (!businessId || !planId) {
      const rawCustomer = invoice.customer as any;
      const stripeCustomerId =
        typeof rawCustomer === 'string' ? rawCustomer : rawCustomer?.id;

      if (stripeCustomerId) {
        const sub = await this.findSubscriptionByCustomer(stripeCustomerId);
        if (sub) {
          businessId = sub.business_id;
          planId = sub.plan_id;
          this.logger.log(`♻ Metadata recovered via customer`);
        }
      }
    }

    if (!businessId || !planId) {
      this.logger.error('❌ Could not resolve business/plan from invoice');
      return;
    }

    // ------------------ PAYMENT INTENT FIX ------------------
    // ----- Payment Intent -----
    const rawIntent: any = (invoice as any).payment_intent;
    const paymentIntentId =
      typeof rawIntent === 'string' ? rawIntent : (rawIntent?.id ?? null);
    // ------------------ BILLING DATES (ALWAYS AVAILABLE HERE) ------------------
    const line = invoice.lines?.data?.[0];
    const startDate = line?.period?.start
      ? new Date(line.period.start * 1000)
      : undefined;
    const endDate = line?.period?.end
      ? new Date(line.period.end * 1000)
      : undefined;

    // ------------------ UPDATE SUBSCRIPTION ------------------
    await this.prisma.subscription.updateMany({
      where: { business_id: businessId, plan_id: planId },
      data: {
        status: 'ACTIVE',
        start_date: startDate,
        end_date: endDate,
      },
    });

    // ------------------ SAVE PAYMENT HISTORY ------------------
    const subscriptionId = await this.findSubscriptionId(businessId, planId);

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        subscription_id: subscriptionId,
        amount: (invoice.amount_paid ?? 0) / 100,
        currency: invoice.currency,
        status: 'PAID',
        payment_method: 'STRIPE',
        invoice_url: invoice.hosted_invoice_url ?? '',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    this.logger.log(`💰 Invoice PAID → business=${businessId}, plan=${planId}`);
  }

  // ==============================================================
  // 5) PAYMENT FAILED
  // ==============================================================

  private async invoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;

    let { businessId, planId } = this.getMetadata(invoice);

    if (!businessId || !planId) {
      const rawSub: any = (invoice as any).subscription;
      const id = typeof rawSub === 'string' ? rawSub : (rawSub?.id ?? null);

      if (id) {
        const sub = await this.findSubscriptionByStripeId(id);
        if (sub) {
          businessId = sub.business_id;
          planId = sub.plan_id;
        }
      }
    }

    if (!businessId || !planId) return;

    const rawIntent: any = (invoice as any).payment_intent;
    const paymentIntentId =
      typeof rawIntent === 'string' ? rawIntent : (rawIntent?.id ?? null);

    const subscriptionId = await this.findSubscriptionId(businessId, planId);

    await this.prisma.paymentHistory.create({
      data: {
        business_id: businessId,
        plan_id: planId,
        subscription_id: subscriptionId,
        amount: (invoice.amount_due ?? 0) / 100,
        currency: invoice.currency,
        invoice_url: invoice.hosted_invoice_url ?? '',
        status: 'FAILED',
        payment_method: 'STRIPE',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    this.logger.log(
      `⚠ Invoice FAILED → business=${businessId}, plan=${planId}`,
    );
  }
}
