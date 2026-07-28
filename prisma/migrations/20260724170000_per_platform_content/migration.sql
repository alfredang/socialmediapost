-- Per-platform content overrides.
-- A post target may carry its own type + media, so one post can publish
-- different content to each platform (e.g. video to TikTok, photos to Instagram).
-- NULL means "use the post's base type/mediaFiles" — existing rows are unchanged.
ALTER TABLE "PostTarget" ADD COLUMN "type" TEXT;
ALTER TABLE "PostTarget" ADD COLUMN "mediaFiles" TEXT;

-- Pipeline items store per-platform content as JSON { platform: { type, media } }.
ALTER TABLE "PipelineItem" ADD COLUMN "perPlatform" TEXT NOT NULL DEFAULT '{}';
