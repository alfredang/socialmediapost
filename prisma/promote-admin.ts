// Promotes an existing account to the instance admin role.
//
// Instance settings (/settings — Google OAuth, SMTP) are admin-only, and
// Account.role defaults to "user", so a fresh deployment has nobody who can
// reach that page. Rather than require a psql session against a database that
// is deliberately not publicly reachable, the operator sets ADMIN_EMAIL and the
// entrypoint runs this on boot.
//
// Idempotent: re-running is a no-op once the role is already "admin", so it is
// safe to leave the variable set across restarts. It never CREATES an account —
// promoting a non-existent email would let anyone who later registers that
// address inherit admin.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log("[promote-admin] ADMIN_EMAIL is not set — nothing to do.");
    return;
  }

  const account = await db.account.findUnique({ where: { email } });
  if (!account) {
    console.log(
      `[promote-admin] No account for ${email} — register that address first, then restart. Not creating one.`
    );
    return;
  }

  if (account.role === "admin") {
    console.log(`[promote-admin] ${email} is already an admin.`);
    return;
  }

  await db.account.update({ where: { email }, data: { role: "admin" } });
  console.log(`[promote-admin] ${email} promoted to admin.`);
}

main()
  .catch((err) => {
    // Never block startup: a failure here leaves the app running and simply
    // means /settings stays unreachable.
    console.error("[promote-admin] failed:", err instanceof Error ? err.message : err);
  })
  .finally(() => db.$disconnect());
