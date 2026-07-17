-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "passwordHash" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "planInterval" TEXT NOT NULL DEFAULT 'monthly',
    "calendarWeekStart" TEXT NOT NULL DEFAULT 'monday',
    "webhookUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Account" ("calendarWeekStart", "createdAt", "email", "id", "passwordHash", "plan", "planInterval", "webhookUrl") SELECT "calendarWeekStart", "createdAt", "email", "id", "passwordHash", "plan", "planInterval", "webhookUrl" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
