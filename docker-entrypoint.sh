#!/bin/sh
set -e

echo "[entrypoint] syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss

echo "[entrypoint] seeding (idempotent upserts)..."
npx tsx prisma/seed.ts || echo "[entrypoint] seed skipped/failed (non-fatal)"

echo "[entrypoint] starting Next.js..."
exec npm start
