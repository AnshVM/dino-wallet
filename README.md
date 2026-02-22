# Dino Wallet

A high-integrity internal wallet service for managing virtual credits (Gold, Diamonds) in a gaming/loyalty platform. Supports top-ups, bonuses, and spending with full auditability, idempotency, and safe concurrent access.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js + TypeScript | Type safety end-to-end; strong ecosystem for HTTP services |
| Framework | Express 5 | Minimal, well-understood; native async error handling in v5 |
| Database | PostgreSQL | ACID transactions, row-level locking (`SELECT FOR UPDATE`), mature and battle-tested |
| ORM | Prisma 7 + TypedSQL | Type-safe queries; TypedSQL keeps raw SQL in `.sql` files separate from business logic |
| Driver | `@prisma/adapter-pg` | Required by Prisma 7's new `prisma-client` provider |

---

## Quick Start (Docker)

Spins up Postgres, runs migrations, seeds data, and starts the API — all in one command.

```bash
docker compose up --build
```

The API will be available at `http://localhost:3001`.

To reset and reseed:

```bash
docker compose down -v   # removes the postgres volume
docker compose up --build
```

---

## Local Development

**Prerequisites:** Node.js 22+, PostgreSQL running on port 5432.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env   # then edit DATABASE_URL if needed

# 3. Run migrations
npm run db:migrate

# 4. Seed the database
npm run db:seed

# 5. Start the dev server (hot reload)
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with tsx watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client + TypedSQL types |
| `npm run db:seed` | Seed asset types, accounts, and initial balances |

---

## Seed Data

Running `npm run db:seed` creates:

| Account | Type | ID |
|---------|------|----|
| Treasury | system | `00000000-0000-0000-0000-000000000001` |
| Alice | user | `00000000-0000-0000-0000-000000000002` |
| Bob | user | `00000000-0000-0000-0000-000000000003` |

Initial balances: Treasury (1M Gold, 1M Diamonds), Alice (500 Gold, 100 Diamonds), Bob (300 Gold, 50 Diamonds).

---

## API Reference

### **You can also look at test-api.sh for curl examples.**

All transaction endpoints require an `Idempotency-Key` header.

### Transactions

#### Top-up
```
POST /api/transactions/top-up
Idempotency-Key: <uuid>

{ "accountId": "...", "assetType": "Gold", "amount": 100, "reference": "optional" }
```

#### Bonus
```
POST /api/transactions/bonus
Idempotency-Key: <uuid>

{ "accountId": "...", "assetType": "Diamonds", "amount": 50 }
```

#### Spend
```
POST /api/transactions/spend
Idempotency-Key: <uuid>

{ "accountId": "...", "assetType": "Gold", "amount": 30 }
```

**Response (all three):**
```json
{ "transactionId": "uuid", "type": "top_up", "assetType": "Gold", "amount": 100, "balance": 600 }
```

### Queries

#### Check Balance
```
GET /api/accounts/:id/balance
```
```json
{ "accountId": "...", "balances": [{ "assetType": "Gold", "amount": 600 }] }
```

#### Audit Ledger
```
GET /api/accounts/:id/ledger?assetType=Gold&limit=50&offset=0
```
```json
{
  "accountId": "...",
  "entries": [{ "id": 1, "transactionId": "...", "transactionType": "top_up", "assetType": "Gold", "amount": 100, "createdAt": "..." }],
  "total": 1
}
```

### Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Missing/invalid fields, non-positive amount |
| 404 | Account or asset type not found |
| 409 | Idempotency key already used (returns original `transactionId`) |
| 422 | Insufficient balance |

---

## Concurrency Strategy

### Pessimistic Locking

Every write transaction uses `SELECT ... FOR UPDATE` to lock the relevant `balances` rows before reading or modifying them. This prevents two concurrent requests from reading the same balance and both succeeding when only one should.

### Deadlock Avoidance

Every transaction that touches two accounts (Treasury + User) locks their balance rows **in ascending `account_id` order**. Since all concurrent transactions follow the same ordering, circular wait is impossible and deadlocks cannot occur.

```
Transaction flow (top-up / bonus / spend):
  1. BEGIN
  2. SELECT balances FOR UPDATE WHERE account_id IN (...) ORDER BY account_id
  3. Validate source balance ≥ amount
  4. INSERT transaction record
  5. INSERT two ledger entries (debit source, credit destination)
  6. UPDATE both balance rows
  7. COMMIT
```

### Idempotency

Every mutation requires an `Idempotency-Key` header (client-generated UUID). The key is stored in the `transactions` table with a `UNIQUE` constraint. If the same key is received again, the service returns HTTP 409 with the original transaction ID — no double-processing occurs. A race between two simultaneous requests with the same key is resolved by the database unique constraint: one inserts, the other gets a unique violation and is rolled back.

---

## Double-Entry Ledger

Every transaction creates exactly **two ledger entries** that sum to zero:

| Flow | Debit (−) | Credit (+) |
|------|-----------|-----------|
| Top-up | Treasury | User |
| Bonus | Treasury | User |
| Spend | User | Treasury |

This provides full auditability and allows integrity verification:
- `SUM(amount)` across all ledger entries = 0
- `SUM(amount) GROUP BY account_id` matches each `balances.amount`
