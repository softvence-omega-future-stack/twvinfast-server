import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.role.createMany({
    data: [
      {
        id: 1,
        name: 'SUPERADMIN',
        scope: 'PLATFORM',
        description: 'Super Admin',
      },
      {
        id: 2,
        name: 'ADMIN',
        scope: 'BUSINESS',
        description: 'Business Admin',
      },
      { id: 3, name: 'USER', scope: 'BUSINESS', description: 'Regular User' },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => console.log('Seed completed'))
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
