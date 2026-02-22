#!/bin/sh
set -e

echo "Running migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npm run db:seed

echo "Starting server..."
exec node dist/index.js
