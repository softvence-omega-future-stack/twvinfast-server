// src/billing/services/billing.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';
import { CreateCheckoutDto } from '../dto/create-checkout.dto';
import { CreatePortalDto } from '../dto/create-portal.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Create a Stripe checkout session for subscription.
   * The Webhook will finalize subscription creation.
   */
  async createCheckout(dto: CreateCheckoutDto) {
    const { businessId, planId, priceId, email } = dto;

    // 1. Validate business
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // 2. Validate plan
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // 3. Get or create Stripe customer
    let stripeCustomerId = business.stripe_customer_id || undefined;

    if (!stripeCustomerId) {
      const customer = await this.stripeService.createCustomer({
        email,
        name: business.name ?? undefined,
      });

      stripeCustomerId = customer.id;

      await this.prisma.business.update({
        where: { id: businessId },
        data: { stripe_customer_id: customer.id },
      });
    }

    // 4. Checkout redirect URLs
    const successUrl = `${process.env.CLIENT_URL}/billing/success?businessId=${businessId}`;
    const cancelUrl = `${process.env.CLIENT_URL}/billing/cancel`;

    // 5. Create checkout session
    const session = await this.stripeService.createCheckoutSession({
      priceId: priceId ?? (plan.stripe_price_id as string),
      customerId: stripeCustomerId,
      successUrl,
      cancelUrl,

      // ✅ subscription-level metadata → will be available on subscription & invoices
      subscription_data: {
        metadata: {
          businessId: String(businessId),
          planId: String(planId),
        },
      },

      // optional checkout-level metadata
      metadata: {
        businessId: String(businessId),
        planId: String(planId),
        email,
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  /**
   * Create a billing portal session for existing customers.
   */
  async createPortal(dto: CreatePortalDto) {
    const session = await this.stripeService.createBillingPortalSession({
      customerId: dto.stripeCustomerId,
      returnUrl: `${process.env.CLIENT_URL}/dashboard/settings/billing`,
    });

    return { url: session.url };
  }

  /**
   * Get current active subscription for UI.
   */
  async getBusinessSubscription(businessId: any) {
    const IntBusinessId = Number(businessId);

    if (!IntBusinessId || isNaN(IntBusinessId)) {
      console.error('❌ Invalid businessId received:', businessId);
      throw new Error('Invalid businessId');
    }

    const subscription = await this.prisma.subscription.findMany({
      where: {
        business_id: IntBusinessId,
        status: {
          in: ['ACTIVE', 'TRIALING', 'INCOMPLETE'],
        },
      },
      include: {
        plan: true,
      },
    });

    return subscription;
  }
}
