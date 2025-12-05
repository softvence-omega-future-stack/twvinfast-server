// src/billing/services/billing.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from 'prisma/prisma.service';
import { CreatePortalDto } from '../dto/create-portal.dto';
import { CreatePlanDto } from '../dto/create-plan.dto';

@Injectable()
export class BillingService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as any,
  });

  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------------
  // Create Checkout Session
  // ------------------------------------------------------------
  async createCheckoutSession(adminUserId: number, planId: number) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      include: { business: true },
    });

    if (!admin || !admin.business) {
      throw new ForbiddenException('Admin or business not found');
    }

    const business = admin.business;

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });

    if (!plan || !plan.stripe_price_id) {
      throw new ForbiddenException('Invalid plan or missing Stripe price id');
    }

    let stripeCustomerId = business.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        email: admin.email,
        name: admin.name,
      });

      stripeCustomerId = customer.id;

      await this.prisma.business.update({
        where: { id: business.id },
        data: { stripe_customer_id: stripeCustomerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],

      // 🔥 30-day trial + subscription-level metadata
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          businessId: String(business.id),
          planId: String(plan.id),
        },
      },

      // 🔥 Session-level metadata (used by checkout.session & some invoices)
      metadata: {
        businessId: String(business.id),
        planId: String(plan.id),
      },

      success_url: `${process.env.FRONTEND_URL}/billing/success`,
      cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
    });

    return { url: session.url };
  }

  // ------------------------------------------------------------
  // Billing Portal Session
  // ------------------------------------------------------------
  async createPortal(adminUserId: number, dto: CreatePortalDto) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      include: { business: true },
    });

    if (!admin || !admin.business) {
      throw new ForbiddenException('Admin or business not found');
    }

    if (!admin.business.stripe_customer_id) {
      throw new ForbiddenException('Stripe customer not found for business');
    }

    const portal = await this.stripe.billingPortal.sessions.create({
      customer: admin.business.stripe_customer_id,
      return_url: dto.returnUrl,
    });

    return { url: portal.url };
  }

  // ------------------------------------------------------------
  // Get Subscription for Business
  // ------------------------------------------------------------
  async getBusinessSubscription(businessId: number) {
    return this.prisma.subscription.findMany({
      where: { business_id: businessId },
      include: { plan: true },
    });
  }

  // ------------------------------------------------------------
  // Create Plan
  // ------------------------------------------------------------
  async createPlan(dto: CreatePlanDto) {
    // 1) Create Stripe Product
    const product = await this.stripe.products.create({
      name: `Twvinfast ${dto.name} Plan`,
    });

    // 2) Create Stripe Price
    const price = await this.stripe.prices.create({
      unit_amount: dto.amount * 100,
      currency: 'usd',
      recurring: { interval: dto.interval },
      product: product.id,
    });

    // 3) Save in database
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        price: dto.amount,
        interval: dto.interval,
        email_limit: dto.email_limit,
        ai_credits: dto.ai_credits,
        features: dto.features,
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      },
    });
  }
}
