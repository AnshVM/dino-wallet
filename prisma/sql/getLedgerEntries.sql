-- @param {String} $1:accountId
-- @param {String} $2:assetType
-- @param {Int} $3:take
-- @param {Int} $4:skip
SELECT
  le.id,
  le.transaction_id,
  t.type as transaction_type,
  at.name as asset_type,
  le.amount,
  le.created_at,
  COUNT(*) OVER() as total
FROM ledger_entries le
JOIN transactions t ON t.id = le.transaction_id
JOIN asset_types at ON at.id = le.asset_type_id
WHERE le.account_id = $1::uuid
  AND ($2 = '' OR at.name = $2)
ORDER BY le.created_at DESC
LIMIT $3
OFFSET $4;
