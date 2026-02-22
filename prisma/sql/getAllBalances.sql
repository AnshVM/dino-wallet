-- @param {String} $1:accountId
SELECT b.amount, at.name as asset_type
FROM balances b
JOIN asset_types at ON at.id = b.asset_type_id
WHERE b.account_id = $1::uuid
ORDER BY at.name;
