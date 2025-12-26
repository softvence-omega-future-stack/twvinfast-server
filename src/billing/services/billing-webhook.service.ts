// src/billing/services/billing-webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from 'prisma/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';
import { MailService } from 'src/mail/services/mail.service';
import { Subscription } from '@prisma/client';

@Injectable()
export class BillingWebhookService {
  private logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly mailService: MailService, // ✅ ADD THIS
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
  private async invoicePaid(event: any) {
    const invoice = event.data.object;

    // 🔒 One invoice = one row (retry safe)
    const alreadyExists = await this.prisma.paymentHistory.findUnique({
      where: { stripe_invoice_id: invoice.id },
    });

    if (alreadyExists) {
      this.logger.warn(`⚠️ Duplicate invoice ignored (${invoice.id})`);
      return;
    }

    // 🔁 Find subscription (race-safe)
    let sub: Subscription | null = null;
    for (let i = 0; i < 5; i++) {
      sub = await this.prisma.subscription.findFirst({
        where: { stripe_subscription_id: invoice.subscription },
      });
      if (sub) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!sub) {
      this.logger.warn(`⏳ Subscription not ready (${invoice.id})`);
      return;
    }

    // 💳 Resolve plan safely
    const line = invoice.lines?.data?.find(
      (l) => l.type === 'subscription' && l.price?.id,
    );

    const priceId = line?.price?.id;

    const planFromInvoice = priceId
      ? await this.prisma.plan.findFirst({
          where: { stripe_price_id: priceId },
        })
      : null;

    // ✅ FINAL TRUTH: PAID vs FREE
    const amount = Number(invoice.amount_paid ?? 0) / 100;
    const status = amount > 0 ? 'PAID' : 'FREE';

    await this.prisma.paymentHistory.create({
      data: {
        business_id: sub.business_id,
        plan_id: planFromInvoice?.id ?? sub.plan_id,
        subscription_id: sub.id,

        amount,
        currency: invoice.currency ?? 'usd',
        payment_method:
          invoice.payment_settings?.payment_method_types?.[0] ?? 'unknown',

        status, // 🔥 THIS IS THE FIX

        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: (invoice.payment_intent as string) ?? null,
        invoice_url: invoice.hosted_invoice_url ?? null,
      },
    });

    this.logger.log(
      `✅ Invoice saved | invoice=${invoice.id} | amount=${amount} | status=${status}`,
    );
  }

  private async getSuperAdminMailbox() {
    const mailbox = await this.prisma.mailbox.findFirst({
      where: {
        user: {
          role: {
            name: 'SUPER_ADMIN',
          },
        },
        smtp_password: {
          not: null,
        },
      },
      select: {
        id: true,
        business_id: true,
        email_address: true,
      },
    });

    if (!mailbox) {
      throw new Error('Super Admin SMTP mailbox not found');
    }

    return mailbox;
  }
  // PAYMENT FAILED → SEND EMAIL (SUPER ADMIN SMTP)gg
  // ---------------------------------------------
  private async invoiceFailed(event: any) {
    const invoice = event.data.object;

    const sub = await this.prisma.subscription.findFirst({
      where: { stripe_subscription_id: invoice.subscription },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!sub) return;

    // 1️⃣ Update subscription status
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE' },
    });

    // 2️⃣ Business email না থাকলে stop
    if (!sub.business?.email) return;

    // 3️⃣ SUPER ADMIN mailbox বের করুন
    const adminMailbox = await this.getSuperAdminMailbox();

    // 4️⃣ Send email using Super Admin SMTP
    await this.mailService.sendSMTPEmail({
      business_id: adminMailbox.business_id ?? sub.business_id,
      mailbox_id: adminMailbox.id, //  SUPER ADMIN SMTP
      to: [sub.business.email],
      subject: '❌ Subscription Payment Failed',
      html: `
      <p>Hello ${sub.business.name},</p>

      <p>We were unable to process your subscription payment.</p>

      <p>
        Please update your payment method to continue using the service.
      </p>

      <p>
        <b>Status:</b> Payment Failed<br/>
        <b>Plan ID:</b> ${sub.plan_id}
      </p>

      <p>— Support Team</p>
    `,
    });
  }
}
