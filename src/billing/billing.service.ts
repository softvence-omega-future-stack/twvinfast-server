import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  constructor(
    @Inject('STRIPE_CLIENT') private stripe: Stripe,
    private prisma: PrismaService,
  ) {}

  // -----------------------------
  // CREATE CHECKOUT SESSION
  // -----------------------------
  async createCheckout(priceId: string, userId: string, email: string) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/billing/cancel`,
      metadata: {
        userId,
      },
    });

    return session.url;
  }

  // -----------------------------
  // HANDLE STRIPE WEBHOOK
  // -----------------------------
  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        const session: any = event.data.object;

        await this.prisma.user.update({
          where: { id: session.metadata.userId },
          data: {
            subscription_status: 'active',
            subscription_id: session.subscription,
            stripe_customer_id: session.customer,
          },
        });
        break;

      case 'invoice.payment_failed':
        const failed: any = event.data.object;

        await this.prisma.user.updateMany({
          where: { subscription_id: failed.subscription },
          data: { subscription_status: 'past_due' },
        });
        break;

      case 'customer.subscription.deleted':
        const canceled: any = event.data.object;

        await this.prisma.user.updateMany({
          where: { subscription_id: canceled.id },
          data: { subscription_status: 'canceled' },
        });
        break;

      default:
        break;
    }
  }

  // -----------------------------
  // BILLING PORTAL
  // -----------------------------
  async createPortal(customerId: string) {
    const portal = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.CLIENT_URL}/dashboard`,
    });

    return portal.url;
  }
}
