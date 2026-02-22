#!/bin/bash

BASE="${BASE_URL:-http://localhost:3001}"

ALICE="00000000-0000-0000-0000-000000000002"
BOB="00000000-0000-0000-0000-000000000003"

echo "GET /balance — Alice"
curl -s "$BASE/api/accounts/$ALICE/balance" | jq .

echo "GET /balance — unknown account (expect 404)"
curl -s "$BASE/api/accounts/00000000-0000-0000-0000-000000000099/balance" | jq .

echo "POST /top-up — Alice +100 Gold"
curl -s -X POST "$BASE/api/transactions/top-up" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"accountId":"'"$ALICE"'","assetType":"Gold","amount":100,"reference":"payment_001"}' | jq .

echo "POST /bonus — Bob +50 Diamonds"
curl -s -X POST "$BASE/api/transactions/bonus" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"accountId":"'"$BOB"'","assetType":"Diamonds","amount":50,"reference":"referral_bonus"}' | jq .

echo "POST /spend — Alice -30 Gold"
curl -s -X POST "$BASE/api/transactions/spend" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"accountId":"'"$ALICE"'","assetType":"Gold","amount":30,"reference":"item_purchase"}' | jq .

echo "POST /spend — Bob overspend (expect 422)"
curl -s -X POST "$BASE/api/transactions/spend" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"accountId":"'"$BOB"'","assetType":"Gold","amount":9999999}' | jq .

echo "POST /top-up — missing Idempotency-Key (expect 400)"
curl -s -X POST "$BASE/api/transactions/top-up" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"'"$ALICE"'","assetType":"Gold","amount":10}' | jq .

echo "POST /top-up — amount=0 (expect 400)"
curl -s -X POST "$BASE/api/transactions/top-up" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"accountId":"'"$ALICE"'","assetType":"Gold","amount":0}' | jq .

echo "POST /top-up — unknown asset type (expect 404)"
curl -s -X POST "$BASE/api/transactions/top-up" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"accountId":"'"$ALICE"'","assetType":"Rubies","amount":10}' | jq .

IDEM_KEY=$(uuidgen)
echo "POST /top-up — first request with key $IDEM_KEY"
curl -s -X POST "$BASE/api/transactions/top-up" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"accountId":"'"$ALICE"'","assetType":"Gold","amount":10}' | jq .

echo "POST /top-up — same key again (expect 409)"
curl -s -X POST "$BASE/api/transactions/top-up" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"accountId":"'"$ALICE"'","assetType":"Gold","amount":10}' | jq .

echo "GET /ledger — Alice"
curl -s "$BASE/api/accounts/$ALICE/ledger" | jq .

echo "GET /ledger — Alice, Gold only, limit=3"
curl -s "$BASE/api/accounts/$ALICE/ledger?assetType=Gold&limit=3" | jq .
