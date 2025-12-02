// src/billing/services/billing.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from 'prisma/prisma.service';
import { CreatePortalDto } from '../dto/create-portal.dto';

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
      metadata: {
        businessId: business.id,
        planId: plan.id,
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
}
