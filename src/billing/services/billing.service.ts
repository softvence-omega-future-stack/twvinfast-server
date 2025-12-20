import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import Stripe from 'stripe';
import { StripeService } from 'src/stripe/stripe.service';
import { CreateCheckoutDto } from '../dto/create-portal.dto';
import { CreatePortalDto } from '../dto/create-portal.dto';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {
    this.stripe = this.stripeService.client;
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  private async getBusinessForUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { business: true },
    });

    if (!user?.business_id || !user.business) {
      throw new ForbiddenException('User is not assigned to a business.');
    }

    return { businessId: user.business_id, business: user.business };
  }

  private ensureUrl(url?: string | null, envKey?: string): string {
    if (url && /^https?:\/\//i.test(url)) return url;

    if (envKey && process.env[envKey]) {
      return process.env[envKey]!;
    }

    throw new BadRequestException(`Missing valid URL (${envKey})`);
  }

  private async ensureStripeCustomer(businessId: number) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) throw new ForbiddenException('Business not found');

    if (business.stripe_customer_id) return business.stripe_customer_id;

    const customer = await this.stripe.customers.create({
      name: business.name,
      email: business.email ?? undefined,
      metadata: { businessId: String(businessId) },
    });

    await this.prisma.business.update({
      where: { id: businessId },
      data: { stripe_customer_id: customer.id },
    });

    return customer.id;
  }

  /* =========================================================
     CHECKOUT (30 DAYS TRIAL)
  ========================================================= */

  async createCheckoutSession(userId: number, dto: CreateCheckoutDto) {
    const { businessId } = await this.getBusinessForUser(userId);

    const existing = await this.prisma.subscription.findFirst({
      where: {
        business_id: businessId,
        status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELING'] },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You already have a subscription. Manage it from billing.',
      );
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan || !plan.is_active || !plan.stripe_price_id) {
      throw new BadRequestException('Invalid plan selected');
    }

    const customerId = await this.ensureStripeCustomer(businessId);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: this.ensureUrl(undefined, 'STRIPE_CHECKOUT_SUCCESS_URL'),
      cancel_url: this.ensureUrl(undefined, 'STRIPE_CHECKOUT_CANCEL_URL'),
      subscription_data: {
        trial_period_days: 30,
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

  /* =========================================================
     PORTAL / SUBSCRIPTION INFO
  ========================================================= */

  async createPortal(userId: number, dto: CreatePortalDto) {
    const { businessId } = await this.getBusinessForUser(userId);
    const customerId = await this.ensureStripeCustomer(businessId);

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: this.ensureUrl(dto.returnUrl),
    });

    return { url: session.url };
  }

  async getBusinessSubscription(userId: number) {
    const { businessId } = await this.getBusinessForUser(userId);

    const subscription = await this.prisma.subscription.findFirst({
      where: { business_id: businessId },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    return { subscription };
  }

  /* =========================================================
     SUPER ADMIN
  ========================================================= */

  async createPlan(dto: CreatePlanDto) {
    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        price: dto.amount,
        interval: dto.interval,
        email_limit: dto.email_limit ?? null,
        ai_credits: dto.ai_credits ?? null,
        features: dto.features ?? undefined,
        is_active: true,
      },
    });

    const product = await this.stripe.products.create({
      name: dto.name,
      metadata: { planId: String(plan.id) },
    });

    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(dto.amount * 100),
      currency: 'usd',
      recurring: { interval: dto.interval },
    });

    return this.prisma.plan.update({
      where: { id: plan.id },
      data: {
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      },
    });
  }

  async getAllPlans() {
    return this.prisma.plan.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async getAllSubscriptions() {
    return this.prisma.subscription.findMany({
      include: { plan: true, business: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async getAllActiveAndTrialSubscriptions() {
    return this.prisma.subscription.findMany({
      where: { status: { in: ['TRIALING', 'ACTIVE'] } },
      include: { plan: true, business: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateClientPlan(planId: number, dto: UpdatePlanDto) {
    return this.prisma.plan.update({
      where: { id: planId },
      data: dto,
    });
  }

  async updateUserPlan(userId: number, newPlanId: number) {
    const { businessId } = await this.getBusinessForUser(userId);

    const sub = await this.prisma.subscription.findFirst({
      where: { business_id: businessId },
    });

    if (!sub) throw new NotFoundException('Subscription not found');

    const newPlan = await this.prisma.plan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan?.stripe_price_id) {
      throw new BadRequestException('Invalid plan');
    }

    await this.stripe.subscriptions.update(sub.stripe_subscription_id!, {
      items: [
        {
          id: (
            await this.stripe.subscriptionItems.list({
              subscription: sub.stripe_subscription_id!,
            })
          ).data[0].id,
          price: newPlan.stripe_price_id,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { plan_id: newPlanId },
    });
  }

  async cancelSubscription(businessId: number) {
    const sub = await this.prisma.subscription.findFirst({
      where: { business_id: businessId },
    });

    if (!sub?.stripe_subscription_id) {
      throw new NotFoundException('Subscription not found');
    }

    await this.stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELING' },
    });
  }
}
