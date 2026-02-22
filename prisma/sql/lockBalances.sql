-- @param {String} $1:accountId1
-- @param {String} $2:accountId2
-- @param {String} $3:assetTypeName
SELECT b.id, b.account_id, b.asset_type_id, b.amount
FROM balances b
JOIN asset_types at ON at.id = b.asset_type_id
WHERE b.account_id IN ($1::uuid, $2::uuid)
  AND at.name = $3
ORDER BY b.account_id
FOR UPDATE;
