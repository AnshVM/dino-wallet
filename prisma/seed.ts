import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TREASURY_ID = '00000000-0000-0000-0000-000000000001';
const ALICE_ID = '00000000-0000-0000-0000-000000000002';
const BOB_ID = '00000000-0000-0000-0000-000000000003';

async function main() {
  // Asset types
  const gold = await prisma.assetType.upsert({
    where: { name: 'Gold' },
    update: {},
    create: { name: 'Gold' },
  });
  const diamonds = await prisma.assetType.upsert({
    where: { name: 'Diamonds' },
    update: {},
    create: { name: 'Diamonds' },
  });

  // Accounts
  const accounts = [
    { id: TREASURY_ID, type: 'treasury', name: 'Treasury' },
    { id: ALICE_ID, type: 'user', name: 'Alice' },
    { id: BOB_ID, type: 'user', name: 'Bob' },
  ];

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { id: acc.id },
      update: {},
      create: acc,
    });
  }

  // Balances
  const balances = [
    { accountId: TREASURY_ID, assetTypeId: gold.id, amount: BigInt(1_000_000) },
    { accountId: TREASURY_ID, assetTypeId: diamonds.id, amount: BigInt(1_000_000) },
    { accountId: ALICE_ID, assetTypeId: gold.id, amount: BigInt(500) },
    { accountId: ALICE_ID, assetTypeId: diamonds.id, amount: BigInt(100) },
    { accountId: BOB_ID, assetTypeId: gold.id, amount: BigInt(300) },
    { accountId: BOB_ID, assetTypeId: diamonds.id, amount: BigInt(50) },
  ];

  for (const b of balances) {
    await prisma.balance.upsert({
      where: {
        accountId_assetTypeId: {
          accountId: b.accountId,
          assetTypeId: b.assetTypeId,
        },
      },
      update: {},
      create: b,
    });
  }

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
