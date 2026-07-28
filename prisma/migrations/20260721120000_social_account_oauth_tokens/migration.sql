-- AlterTable: OAuth token storage for real platform connections (e.g. Instagram)
ALTER TABLE "SocialAccount" ADD COLUMN "externalUserId" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);
