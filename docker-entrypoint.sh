#!/bin/sh
set -e

echo "[entrypoint] syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss

# Bootstrap account creation is opt-in. Without SEED_DEMO_DATA=true the seed
# never runs, so production never gets accounts nobody asked for.
if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "[entrypoint] seeding bootstrap account..."
  npx tsx prisma/seed.ts
else
  echo "[entrypoint] SEED_DEMO_DATA is not \"true\" — skipping seed."
fi

echo "[entrypoint] starting Next.js..."
exec npm start
