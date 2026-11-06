import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
];

const agencies = [
  {
    id: '94410d0b-8f5f-4fba-8cfb-368bed8db123',
    name: 'Your Car Your Way – Strasbourg Gare',
  },
  {
    id: 'f2e84b9f-ae2f-427d-a9f7-dc4155ed54fd',
    name: 'Your Car Your Way – Paris Montparnasse',
  },
  {
    id: 'c86e2ac9-03fc-4fc4-b64d-9a298d25e3d5',
    name: 'Your Car Your Way – Lyon Part-Dieu',
  },
];

async function main() {
  try {
    for (const language of languages) {
      await prisma.language.upsert({
        where: { code: language.code },
        update: {},
        create: language,
      });
    }

    for (const agency of agencies) {
      await prisma.agency.upsert({
        where: { id: agency.id },
        update: { name: agency.name },
        create: agency,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
