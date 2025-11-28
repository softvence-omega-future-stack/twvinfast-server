import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log(' Starting seed...');

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

  await prisma.user.upsert({
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

  console.log('🌱 Seed completed successfully!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
