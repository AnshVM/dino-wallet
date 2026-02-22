import { Router } from 'express';
import prisma from '../db/prisma.js';
import { getAllBalances } from '../../generated/prisma/sql/getAllBalances.js';
import { getLedgerEntries } from '../../generated/prisma/sql/getLedgerEntries.js';

const router = Router();

// GET /api/accounts/:id/balance
router.get('/:id/balance', async (req: any, res: any) => {
  const { id } = req.params;

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const rows = await prisma.$queryRawTyped(getAllBalances(id));

  res.json({
    accountId: id,
    balances: rows.map((r) => ({
      assetType: r.asset_type,
      amount: Number(r.amount),
    })),
  });
});

// GET /api/accounts/:id/ledger
router.get('/:id/ledger', async (req: any, res: any) => {
  const { id } = req.params;
  const assetType = (req.query['assetType'] as string) ?? '';
  const limit = Math.min(Number(req.query['limit']) || 50, 100);
  const offset = Number(req.query['offset']) || 0;

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const rows = await prisma.$queryRawTyped(getLedgerEntries(id, assetType, limit, offset));

  const total = rows.length > 0 ? Number(rows[0]!.total) : 0;

  res.json({
    accountId: id,
    entries: rows.map((r) => ({
      id: r.id,
      transactionId: r.transaction_id,
      transactionType: r.transaction_type,
      assetType: r.asset_type,
      amount: Number(r.amount),
      createdAt: r.created_at,
    })),
    total,
  });
});

export default router;
