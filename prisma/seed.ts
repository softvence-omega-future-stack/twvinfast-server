import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';

const prisma = new PrismaClient();

// Optional: Stripe client (for auto-creating products/prices if ENV not set)
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// Small helper to read env safely
function env(name: string, fallback?: string) {
  const val = process.env[name];
  if (!val && fallback !== undefined) return fallback;
  return val;
}

// Helper to seed a plan and link with Stripe
async function seedPlan(options: {
  id: number;
  name: 'Starter' | 'Growth' | 'Scale' | string;
  description?: string;
  amount: number; // in USD
  interval: 'month' | 'year';
  email_limit?: number;
  ai_credits?: number;
  features: Record<string, any>;
}) {
  const {
    id,
    name,
    description,
    amount,
    interval,
    email_limit,
    ai_credits,
    features,
  } = options;

  // ENV variable naming: STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_SCALE
  const envKey = `STRIPE_PRICE_${name.toUpperCase()}`;
  const envPriceId = process.env[envKey];

  // Case 1: Explicit Stripe Price ID is provided in ENV
  if (envPriceId) {
    console.log(`✔ Using existing Stripe price for ${name}: ${envPriceId}`);

    return prisma.plan.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        description: description ?? `${name} plan`,
        price: amount,
        interval,
        currency: 'usd',
        email_limit,
        ai_credits,
        features,
        is_active: true,
        stripe_price_id: envPriceId,
        // stripe_product_id left null because we don't know it from ENV
      },
    });
  }

  // Case 2: No ENV price, but STRIPE_SECRET_KEY exists → create Product + Price
  if (stripe) {
    console.log(`→ Creating Stripe Product + Price for plan: ${name}`);

    const product = await stripe.products.create({
      name: `Twvinfast ${name} Plan`,
      description: description ?? `${name} plan for Twvinfast`,
    });

    const price = await stripe.prices.create({
      unit_amount: amount * 100,
      currency: 'usd',
      recurring: { interval },
      product: product.id,
    });

    console.log(
      `✔ Created Stripe product=${product.id}, price=${price.id} for ${name}`,
    );

    return prisma.plan.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        description: description ?? `${name} plan`,
        price: amount,
        interval,
        currency: 'usd',
        email_limit,
        ai_credits,
        features,
        is_active: true,
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      },
    });
  }

  // Case 3: No Stripe at all → seed plan WITHOUT Stripe link
  console.warn(
    `⚠ No Stripe price ID and no STRIPE_SECRET_KEY for ${name}. Seeding plan WITHOUT Stripe linkage.`,
  );

  return prisma.plan.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name,
      description: description ?? `${name} plan`,
      price: amount,
      interval,
      currency: 'usd',
      email_limit,
      ai_credits,
      features,
      is_active: true,
      stripe_product_id: null,
      stripe_price_id: null,
    },
  });
}

async function main() {
  console.log('🌱 Starting seed...');

  // ----------------------------------------------------
  // 1️⃣ ROLES
  // ----------------------------------------------------
  await prisma.role.createMany({
    data: [
      { id: 1, name: 'SUPERADMIN', description: 'Platform Super Admin' },
      { id: 2, name: 'ADMIN', description: 'Business Admin' },
      { id: 3, name: 'USER', description: 'Regular User' },
    ],
    skipDuplicates: true,
  });
  console.log('✔ Roles seeded');

  // ----------------------------------------------------
  // 2️⃣ BUSINESS
  // ----------------------------------------------------
  const business = await prisma.business.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Default Business',
      email: 'info@business.com',
      website: 'https://example.com',
      status: 'ACTIVE',
      stripe_customer_id: null, // will be set when first checkout happens
    },
  });
  console.log('✔ Business seeded (id=1)');

  // ----------------------------------------------------
  // 3️⃣ SUPERADMIN USER
  // ----------------------------------------------------
  const hashed = await bcrypt.hash('Admin@123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@system.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@system.com',
      password_hash: hashed,
      role_id: 1, // SUPERADMIN
      business_id: business.id,
      status: 'ACTIVE',
    },
  });
  console.log('✔ Super Admin user created');

  // ----------------------------------------------------
  // 4️⃣ DEFAULT MAILBOX
  // ----------------------------------------------------
  await prisma.mailbox.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      business_id: business.id,
      user_id: superAdmin.id,
      provider: 'SMTP',
      email_address: env('SMTP_USER', 'noreply@example.com')!,
      smtp_host: env('SMTP_HOST', 'mail.webador.com'),
      smtp_port: Number(env('SMTP_PORT', '587')),
      imap_host: env('IMAP_HOST') || null,
      imap_port: env('IMAP_PORT') ? Number(env('IMAP_PORT')) : null,
      is_ssl: true,
    },
  });
  console.log('✔ Default SMTP Mailbox created');

  // ----------------------------------------------------
  // 5️⃣ BILLING PLANS (Starter / Growth / Scale)
  // ----------------------------------------------------
  console.log('→ Seeding billing plans...');

  await seedPlan({
    id: 1,
    name: 'Starter',
    description: 'Starter plan for small teams',
    amount: 19,
    interval: 'month',
    email_limit: 500,
    ai_credits: 10000,
    features: {
      inbox_ai: true,
      crm_sync: false,
      multi_mailbox: false,
      priority_ai: false,
    },
  });

  await seedPlan({
    id: 2,
    name: 'Growth',
    description: 'Growth plan for scaling teams',
    amount: 49,
    interval: 'month',
    email_limit: 5000,
    ai_credits: 100000,
    features: {
      inbox_ai: true,
      crm_sync: true,
      multi_mailbox: true,
      priority_ai: true,
    },
  });

  await seedPlan({
    id: 3,
    name: 'Scale',
    description: 'Scale plan for large teams and agencies',
    amount: 99,
    interval: 'month',
    email_limit: 20000,
    ai_credits: 300000,
    features: {
      inbox_ai: true,
      crm_sync: true,
      multi_mailbox: true,
      priority_ai: true,
      automations: true,
    },
  });

  console.log('✔ Billing plans seeded & linked to Stripe (if configured)');

  console.log('🌱 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
