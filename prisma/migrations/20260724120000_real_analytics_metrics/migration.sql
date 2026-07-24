-- Analytics metrics become nullable: NULL now means "the platform does not
-- expose this number", which the previous NOT NULL DEFAULT 0 could not express.
ALTER TABLE "AnalyticsSnapshot" ALTER COLUMN "followers" DROP NOT NULL,
                                ALTER COLUMN "followers" DROP DEFAULT,
                                ALTER COLUMN "reach" DROP NOT NULL,
                                ALTER COLUMN "reach" DROP DEFAULT,
                                ALTER COLUMN "impressions" DROP NOT NULL,
                                ALTER COLUMN "impressions" DROP DEFAULT,
                                ALTER COLUMN "views" DROP NOT NULL,
                                ALTER COLUMN "views" DROP DEFAULT,
                                ALTER COLUMN "likes" DROP NOT NULL,
                                ALTER COLUMN "likes" DROP DEFAULT,
                                ALTER COLUMN "comments" DROP NOT NULL,
                                ALTER COLUMN "comments" DROP DEFAULT,
                                ALTER COLUMN "shares" DROP NOT NULL,
                                ALTER COLUMN "shares" DROP DEFAULT;

-- Records when the sync last touched the row.
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
