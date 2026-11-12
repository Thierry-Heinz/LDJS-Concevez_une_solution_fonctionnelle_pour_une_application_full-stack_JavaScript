import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import { AgencyType } from '../src/generated/prisma/client';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
];

const AGENCY_IDS = {
  central: '7d352956-ec5d-43a5-9ef3-612481435498',
  strasbourg: '94410d0b-8f5f-4fba-8cfb-368bed8db123',
  paris: 'f2e84b9f-ae2f-427d-a9f7-dc4155ed54fd',
  lyon: 'c86e2ac9-03fc-4fc4-b64d-9a298d25e3d5',
} as const;

const agencies = [
  {
    id: AGENCY_IDS.central,
    name: 'Service client central',
    agencyType: AgencyType.CENTRAL,
  },
  {
    id: AGENCY_IDS.strasbourg,
    name: 'Your Car Your Way – Strasbourg Gare',
    agencyType: AgencyType.BRANCH,
  },
  {
    id: AGENCY_IDS.paris,
    name: 'Your Car Your Way – Paris Montparnasse',
    agencyType: AgencyType.BRANCH,
  },
  {
    id: AGENCY_IDS.lyon,
    name: 'Your Car Your Way – Lyon Part-Dieu',
    agencyType: AgencyType.BRANCH,
  },
];

const agents = [
  { email: 'central@ycyw.test', agencyId: AGENCY_IDS.central },
  { email: 'strasbourg@ycyw.test', agencyId: AGENCY_IDS.strasbourg },
  { email: 'paris@ycyw.test', agencyId: AGENCY_IDS.paris },
  { email: 'lyon@ycyw.test', agencyId: AGENCY_IDS.lyon },
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
        update: { name: agency.name, agencyType: agency.agencyType },
        create: agency,
      });
    }

    const agentPasswordHash = await argon2.hash('un_mot_de_passe_long');
    for (const agent of agents) {
      await prisma.user.upsert({
        where: { email: agent.email },
        update: { role: Role.AGENT, agencyId: agent.agencyId },
        create: {
          email: agent.email,
          passwordHash: agentPasswordHash,
          role: Role.AGENT,
          agencyId: agent.agencyId,
        },
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
