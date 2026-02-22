import { Router } from 'express';
import { requireIdempotencyKey } from '../middleware/idempotency.js';
import { executeTransfer } from '../services/wallet.js';
import type { TransactionType } from '../services/wallet.js';

const router = Router();

router.use(requireIdempotencyKey);

function createTransactionHandler(type: TransactionType) {
  return async (req: any, res: any) => {
    const { accountId, assetType, amount, reference } = req.body;

    if (!accountId || !assetType || amount == null) {
      res.status(400).json({ error: 'accountId, assetType, and amount are required' });
      return;
    }

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    const idempotencyKey = res.locals['idempotencyKey'] as string;

    try {
      const result = await executeTransfer({
        accountId,
        assetType,
        amount,
        type,
        idempotencyKey,
        reference,
      });
      res.json(result);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message, transactionId: err.transactionId });
        return;
      }
      throw err;
    }
  };
}

router.post('/top-up', createTransactionHandler('top_up'));
router.post('/bonus', createTransactionHandler('bonus'));
router.post('/spend', createTransactionHandler('spend'));

export default router;
