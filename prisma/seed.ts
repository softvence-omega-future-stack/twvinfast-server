import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ----------------------------------------------------
  // 1️⃣ SEED ROLES
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
  // 2️⃣ SEED BUSINESS
  // ----------------------------------------------------
  const business = await prisma.business.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Default Business',
      email: 'info@business.com',
      website: 'https://example.com',
      status: 'ACTIVE',
    },
  });
  console.log('✔ Business seeded');

  // ----------------------------------------------------
  // 3️⃣ SEED SUPERADMIN USER
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

  console.log('✔ Super Admin created');

  // ----------------------------------------------------
  // 4️⃣ SEED DEFAULT MAILBOX
  // ----------------------------------------------------
  await prisma.mailbox.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      business_id: business.id,
      user_id: superAdmin.id,
      provider: 'SMTP',
      email_address: process.env.SMTP_USER || 'noreply@example.com',
      smtp_host: process.env.SMTP_HOST || 'mail.webador.com',
      smtp_port: Number(process.env.SMTP_PORT) || 587,
      imap_host: process.env.IMAP_HOST || null,
      imap_port: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : null,
      is_ssl: true,
    },
  });

  // ----------------------------------------------------
  // 5️⃣ SEED BILLING PLANS
  // ----------------------------------------------------
  await prisma.plan.createMany({
    data: [
      {
        id: 1,
        name: 'Starter',
        price: 19,
        stripe_price_id:
          process.env.STRIPE_PRICE_STARTER || 'price_starter_xxx',
        email_limit: 500,
        ai_credits: 10000,
        features: {
          inbox_ai: true,
          crm_sync: false,
          multi_mailbox: false,
          priority_ai: false,
        },
      },
      {
        id: 2,
        name: 'Growth',
        price: 49,
        stripe_price_id: process.env.STRIPE_PRICE_GROWTH || 'price_growth_xxx',
        email_limit: 5000,
        ai_credits: 100000,
        features: {
          inbox_ai: true,
          crm_sync: true,
          multi_mailbox: true,
          priority_ai: true,
        },
      },
      {
        id: 3,
        name: 'Scale',
        price: 99,
        stripe_price_id: process.env.STRIPE_PRICE_SCALE || 'price_scale_xxx',
        email_limit: 20000,
        ai_credits: 300000,
        features: {
          inbox_ai: true,
          crm_sync: true,
          multi_mailbox: true,
          priority_ai: true,
          automations: true,
        },
      },
    ],
    skipDuplicates: true,
  });

  console.log('✔ Billing Plans seeded');

  console.log('✔ Default SMTP Mailbox created');

  console.log('🌱 Seed completed successfully!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
