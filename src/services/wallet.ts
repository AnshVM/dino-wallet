import prisma from '../db/prisma.js';
import { lockBalances } from '../../generated/prisma/sql/lockBalances.js';

const TREASURY_ID = '00000000-0000-0000-0000-000000000001';

export type TransactionType = 'top_up' | 'bonus' | 'spend';

export interface TransferParams {
  accountId: string;
  assetType: string;
  amount: number;
  type: TransactionType;
  idempotencyKey: string;
  reference?: string;
}

export interface TransferResult {
  transactionId: string;
  type: TransactionType;
  assetType: string;
  amount: number;
  balance: number;
}

export async function executeTransfer(params: TransferParams): Promise<TransferResult> {
  const { accountId, assetType, amount, type, idempotencyKey, reference } = params;

  if (amount <= 0) {
    throw { status: 400, message: 'Amount must be positive' };
  }

  // Check idempotency — if key already used, return 409
  const existing = await prisma.transaction.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    throw { status: 409, message: 'Idempotency key already used', transactionId: existing.id };
  }

  // Determine source (debit) and destination (credit)
  const isSpend = type === 'spend';
  const sourceId = isSpend ? accountId : TREASURY_ID;
  const destId = isSpend ? TREASURY_ID : accountId;

  // Sort IDs for consistent lock ordering to avoid deadlocks
  const [firstId, secondId] = [sourceId, destId].sort();

  return prisma.$transaction(async (tx) => {
    // 1. Lock balance rows in sorted account order
    const lockedBalances = await tx.$queryRawTyped(lockBalances(firstId as string, secondId as string, assetType));

    const sourceBalance = lockedBalances.find((b) => b.account_id === sourceId);
    const destBalance = lockedBalances.find((b) => b.account_id === destId);

    if (!sourceBalance || !destBalance) {
      throw { status: 404, message: 'Balance not found for the given account and asset type' };
    }

    // 2. Validate sufficient balance
    const transferAmount = BigInt(amount);
    if (sourceBalance.amount < transferAmount) {
      throw { status: 422, message: 'Insufficient balance' };
    }

    // 3. Create transaction record
    const txRecord = await tx.transaction.create({
      data: {
        idempotencyKey,
        type,
        status: 'completed',
        reference: reference ?? null,
      },
    });

    // 4. Create double-entry ledger entries (debit source, credit dest)
    await tx.ledgerEntry.createMany({
      data: [
        {
          transactionId: txRecord.id,
          accountId: sourceId,
          assetTypeId: sourceBalance.asset_type_id,
          amount: -transferAmount,
        },
        {
          transactionId: txRecord.id,
          accountId: destId,
          assetTypeId: destBalance.asset_type_id,
          amount: transferAmount,
        },
      ],
    });

    // 5. Update materialized balances
    await tx.balance.update({
      where: { id: sourceBalance.id },
      data: { amount: sourceBalance.amount - transferAmount },
    });
    await tx.balance.update({
      where: { id: destBalance.id },
      data: { amount: destBalance.amount + transferAmount },
    });

    // 6. Return result with the user's new balance
    const userBalance = isSpend
      ? sourceBalance.amount - transferAmount
      : destBalance.amount + transferAmount;

    return {
      transactionId: txRecord.id,
      type,
      assetType,
      amount,
      balance: Number(userBalance),
    };
  });
}
