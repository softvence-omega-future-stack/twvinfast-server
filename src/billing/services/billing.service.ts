// src/billing/services/billing.service.ts
import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from 'prisma/prisma.service';
import { CreatePortalDto, CreateCheckoutDto } from '../dto/create-portal.dto';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { StripeService } from 'src/stripe/stripe.service';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {
    // ✅ single source of truth for Stripe client
    this.stripe = this.stripeService.client;
  }

  // ------------------------------------------------------------
  // Helper: get business for user
  // ------------------------------------------------------------
  private async getBusinessForUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        business_id: true,
        business: {
          select: {
            id: true,
            name: true,
            email: true,
            stripe_customer_id: true,
          },
        },
      },
    });

    if (!user || !user.business_id || !user.business) {
      throw new ForbiddenException('User is not assigned to a business.');
    }

    return {
      businessId: user.business_id,
      business: user.business,
    };
  }

  // ------------------------------------------------------------
  // Helper: Ensure URL is valid
  // ------------------------------------------------------------
  private ensureUrl(url?: string | null, fallbackEnvKey?: string): string {
    if (url && /^https?:\/\//i.test(url)) return url;

    if (!url && fallbackEnvKey) {
      const envUrl = process.env[fallbackEnvKey];
      if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl;
    }

    throw new BadRequestException(
      `URL must start with http:// or https:// (${fallbackEnvKey})`,
    );
  }

  // ------------------------------------------------------------
  // Create Stripe Customer if missing
  // ------------------------------------------------------------
  private async ensureStripeCustomer(businessId: number) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) throw new ForbiddenException('Business not found.');

    if (business.stripe_customer_id) {
      return business.stripe_customer_id;
    }

    const customer = await this.stripe.customers.create({
      name: business.name,
      email: business.email ?? undefined,
      metadata: {
        businessId: String(businessId),
      },
    });

    await this.prisma.business.update({
      where: { id: businessId },
      data: { stripe_customer_id: customer.id },
    });

    return customer.id;
  }

  // ------------------------------------------------------------
  // Billing Portal
  // ------------------------------------------------------------
  async createPortal(userId: number, dto: CreatePortalDto) {
    const { businessId } = await this.getBusinessForUser(userId);
    const stripeCustomerId = await this.ensureStripeCustomer(businessId);

    const returnUrl = this.ensureUrl(dto.returnUrl);

    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  // ------------------------------------------------------------
  // Get Business Subscription
  // ------------------------------------------------------------
  async getBusinessSubscription(userId: number) {
    const { businessId } = await this.getBusinessForUser(userId);

    const subscription = await this.prisma.subscription.findFirst({
      where: { business_id: businessId },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    return { subscription };
  }

  // ------------------------------------------------------------
  // Create Checkout Session (Monthly / Annual / Trial)
  // ------------------------------------------------------------
  async createCheckoutSession(userId: number, dto: CreateCheckoutDto) {
    const { businessId } = await this.getBusinessForUser(userId);

    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan || !plan.is_active) {
      throw new BadRequestException('Selected plan is not active.');
    }

    if (!plan.stripe_price_id) {
      throw new BadRequestException('This plan has no Stripe price.');
    }

    const stripeCustomerId = await this.ensureStripeCustomer(businessId);

    const successUrl = this.ensureUrl(
      process.env.STRIPE_CHECKOUT_SUCCESS_URL,
      'STRIPE_CHECKOUT_SUCCESS_URL',
    );

    const cancelUrl = this.ensureUrl(
      process.env.STRIPE_CHECKOUT_CANCEL_URL,
      'STRIPE_CHECKOUT_CANCEL_URL',
    );

    // 🔥 Main Checkout creation
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          businessId: String(businessId),
          planId: String(plan.id),
        },
      },
      metadata: {
        businessId: String(businessId),
        planId: String(plan.id),
      },
    });

    return { url: session.url };
  }

  // ------------------------------------------------------------
  // SUPER ADMIN – Create Plan
  // ------------------------------------------------------------
  async createPlan(dto: CreatePlanDto) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0.');
    }

    if (!['month', 'year'].includes(dto.interval)) {
      throw new BadRequestException('Interval must be month or year.');
    }

    // Create product
    const product = await this.stripe.products.create({
      name: dto.name,
    });

    // Create price
    const price = await this.stripe.prices.create({
      unit_amount: Math.round(dto.amount * 100),
      currency: 'usd',
      recurring: {
        interval: dto.interval,
      },
      product: product.id,
    });

    // Save in DB
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        price: dto.amount,
        interval: dto.interval,
        email_limit: dto.email_limit ?? null,
        ai_credits: dto.ai_credits ?? null,
        features: dto.features ?? undefined,
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      },
    });
  }
  async getAllSubscriptions() {
    const subscriptions = await this.prisma.subscription.findMany({
      include: {
        plan: true,
        business: true, // owner নেই, তাই শুধু business
      },
      orderBy: {
        created_at: 'desc', // MUST use created_at
      },
    });

    return {
      count: subscriptions.length,
      subscriptions,
    };
  }

  // ------------------------------------------------------------
  // USER — Change Current Plan (Upgrade/Downgrade)
  // ------------------------------------------------------------
  async updateUserPlan(userId: number, newPlanId: number) {
    // Get business

    const { businessId } = await this.getBusinessForUser(userId);

    // Get current subscription from DB
    const sub = await this.prisma.subscription.findFirst({
      where: { business_id: businessId },
    });

    if (!sub) throw new NotFoundException('Subscription not found');

    // Load new plan info
    const newPlan = await this.prisma.plan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan || !newPlan.is_active) {
      throw new BadRequestException('Selected plan is not active');
    }

    if (!newPlan.stripe_price_id) {
      throw new BadRequestException('Selected plan has no Stripe price');
    }

    // STEP 1 — Update plan in Stripe
    const updatedStripeSub = await this.stripe.subscriptions.update(
      sub.stripe_subscription_id as any,
      {
        items: [
          {
            id: (
              await this.stripe.subscriptionItems.list({
                subscription: sub.stripe_subscription_id as any,
              })
            ).data[0].id,
            price: newPlan.stripe_price_id, // NEW PLAN
          },
        ],
        proration_behavior: 'create_prorations',
      },
    );

    // STEP 2 — Update DB with new plan
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        plan_id: newPlanId,
        // renewal_date: new Date(updatedStripeSub.current_period_end * 1000),
      },
    });

    return {
      success: true,
      message: 'Subscription plan updated successfully',
      plan: newPlan.name,
      // next_billing: new Date(updatedStripeSub.current_period_end * 1000),
    };
  }

  // -------------------------------------------------------
  // -------------------------------------------------------
  // CANCEL SUBSCRIPTION API (OPTION 1 - cancel at period end)
  // -------------------------------------------------------
  async cancelSubscription(businessId: number) {
    // 1) Find subscription
    const sub = await this.prisma.subscription.findFirst({
      where: { business_id: businessId },
    });

    if (!sub) {
      throw new NotFoundException('Subscription not found for this business');
    }

    if (!sub.stripe_subscription_id) {
      throw new NotFoundException('Stripe subscription not found');
    }

    // 2) Cancel subscription at the end of current billing cycle
    const stripeCancel = await this.stripe.subscriptions.update(
      sub.stripe_subscription_id,
      {
        cancel_at_period_end: true, // ← OPTION 1 (BEST)
      },
    );

    // ❗ DO NOT set status = CANCELED in DB now
    // User should still have access until period ends.
    // Stripe webhook "customer.subscription.deleted" will send final cancel event.
    // We can optionally mark "cancel_requested" if needed.

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'CANCELING', // ← Optional: showing user that cancel is scheduled
      },
    });

    return {
      success: true,
      message: 'Subscription will be canceled at period end.',
      stripeStatus: stripeCancel.status,
      cancel_at_period_end: stripeCancel.cancel_at_period_end,
      // current_period_end: new Date(stripeCancel.current_period_end * 1000),
    };
  }
}
