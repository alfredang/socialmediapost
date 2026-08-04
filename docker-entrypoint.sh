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

# Grants the instance-admin role to an existing account, so an operator can
# reach /settings (Google OAuth, SMTP) without a psql session against a database
# that is not publicly reachable. Idempotent and never creates an account.
if [ -n "$ADMIN_EMAIL" ]; then
  echo "[entrypoint] ensuring $ADMIN_EMAIL is an admin..."
  npx tsx prisma/promote-admin.ts || echo "[entrypoint] admin promotion failed — continuing."
fi

echo "[entrypoint] starting Next.js..."
exec npm start
