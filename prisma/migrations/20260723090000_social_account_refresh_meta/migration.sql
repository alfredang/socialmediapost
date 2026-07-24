-- AlterTable: refresh tokens + platform-specific metadata for LinkedIn/Facebook/TikTok OAuth
ALTER TABLE "SocialAccount" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "meta" TEXT;
