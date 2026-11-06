import { PrismaClient } from '@prisma/client';
import { SEED_FAMILIES, SEED_HOMES } from '../lib/seedData';

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.deleteMany();
  await prisma.home.deleteMany();
  await prisma.planCache.deleteMany();
  for (const h of SEED_HOMES) await prisma.home.create({ data: h });
  const now = Date.now();
  for (const f of SEED_FAMILIES) {
    const checklist: Record<string, boolean> = {};
    for (const i of f.ticked ?? []) checklist[String(i)] = true;
    await prisma.plan.create({
      data: {
        code: f.code,
        surname: f.surname,
        givenName: f.givenName,
        city: f.city,
        language: f.language,
        profileJson: JSON.stringify(f.profile),
        checklistJson: JSON.stringify(checklist),
        sharedWithStaff: true,
        lastActivity: new Date(now - f.daysSinceActivity * 86400000),
      },
    });
  }
  console.log(`Seeded ${SEED_HOMES.length} homes and ${SEED_FAMILIES.length} families.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
