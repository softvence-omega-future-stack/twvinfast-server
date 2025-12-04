import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';

const prisma = new PrismaClient();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

function env(name: string, fallback?: string) {
  return process.env[name] ?? fallback;
}

// Helper for plans
async function seedPlan(options: {
  id: number;
  name: string;
  description?: string;
  amount: number;
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

  const envKey = `STRIPE_PRICE_${name.toUpperCase()}`;
  const priceId = process.env[envKey];

  if (priceId) {
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
        stripe_price_id: priceId,
      },
    });
  }

  if (stripe) {
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

  // ---------------------------------------------------------
  // 1️⃣ ROLES
  // ---------------------------------------------------------
  await prisma.role.createMany({
    data: [
      { id: 1, name: 'SUPER_ADMIN', description: 'Platform Super Admin' },
      { id: 2, name: 'ADMIN', description: 'Business Admin' },
      { id: 3, name: 'USER', description: 'Regular User' },
    ],
    skipDuplicates: true,
  });
  console.log('✔ Roles seeded');

  // ---------------------------------------------------------
  // 2️⃣ SUPERADMIN (NO BUSINESS)
  // ---------------------------------------------------------
  const hashed = await bcrypt.hash('Admin@123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@system.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@system.com',
      password_hash: hashed,
      role_id: 1,
      business_id: null, // ❗ superadmin has no business
      status: 'ACTIVE',
    },
  });

  console.log('✔ Super admin created');

  // ---------------------------------------------------------
  // 3️⃣ DEFAULT BUSINESS (id=1)
  // ---------------------------------------------------------
  const business = await prisma.business.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Default Business',
      email: 'info@business.com',
      website: 'https://example.com',
      status: 'ACTIVE',
      stripe_customer_id: null,
    },
  });

  console.log('✔ Business created: id=1');

  // ---------------------------------------------------------
  // 4️⃣ DEFAULT MAILBOX (belongs to business + superadmin)
  // ---------------------------------------------------------
  await prisma.mailbox.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      business_id: business.id,
      user_id: superAdmin.id, // can assign superadmin mailbox
      provider: 'SMTP',
      email_address: env('SMTP_USER', 'noreply@example.com')!,
      smtp_host: env('SMTP_HOST', 'mail.webador.com'),
      smtp_port: Number(env('SMTP_PORT', '587')),
      imap_host: env('IMAP_HOST') || null,
      imap_port: env('IMAP_PORT') ? Number(env('IMAP_PORT')) : null,
      is_ssl: true,
    },
  });

  console.log('✔ Default Mailbox created');

  // ---------------------------------------------------------
  // 5️⃣ PLANS (Starter/Growth/Scale)
  // ---------------------------------------------------------
  console.log('→ Seeding Plans...');

  await seedPlan({
    id: 1,
    name: 'Starter',
    amount: 19,
    interval: 'month',
    email_limit: 500,
    ai_credits: 10000,
    features: { inbox_ai: true, crm_sync: false, multi_mailbox: false },
  });

  await seedPlan({
    id: 2,
    name: 'Growth',
    amount: 49,
    interval: 'month',
    email_limit: 5000,
    ai_credits: 100000,
    features: { inbox_ai: true, crm_sync: true, multi_mailbox: true },
  });

  await seedPlan({
    id: 3,
    name: 'Scale',
    amount: 99,
    interval: 'month',
    email_limit: 20000,
    ai_credits: 300000,
    features: {
      inbox_ai: true,
      crm_sync: true,
      multi_mailbox: true,
      automations: true,
    },
  });

  console.log('✔ Plans created');

  console.log('🌱 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ SEED ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
