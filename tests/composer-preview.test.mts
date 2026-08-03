// Unit test for the upload composer's side-panel derivation. Pure function —
// no server, no DOM. Run: npx tsx tests/composer-preview.test.mts
//
// This exists because the panel kept disagreeing with the post being sent: the
// worst case was a text-only post that still displayed the previously-selected
// image AND still uploaded it. Every rule the panel relies on is pinned here.
import { check, section, done, assert } from "./_harness.mjs";
import { derivePreview } from "../src/lib/composer-preview";

const img = (name = "a.jpg") => ({ name, type: "image/jpeg" });
const vid = (name = "a.mp4") => ({ name, type: "video/mp4" });
const st = (o: Partial<Parameters<typeof derivePreview>[0]> = {}) =>
  derivePreview({ method: "file", files: [], mediaUrls: "", ...o });

console.log("\nSocialPost — composer side panel");

section("text mode ignores any file selection (the reported bug)");
{
  // The exact scenario: pick an image, then switch the type to text.
  const p = st({ method: "text", files: [img()] });
  check("no media box is rendered", () => assert.strictEqual(p.showMediaBox, false));
  check("no thumbnail is derived", () => assert.strictEqual(p.thumbnailIndex, null));
  check("summary says Text-only", () => assert.strictEqual(p.mediaSummary, "Text-only"));
  check("post carries no media", () => assert.strictEqual(p.hasMedia, false));
  check("postType is text", () => assert.strictEqual(p.postType, "text"));
  check("label is Post, not Photos", () => assert.strictEqual(p.typeLabel, "Post"));
  check("submit is not blocked", () => assert.strictEqual(p.mediaMissing, false));
  check("badge reads Ready", () => assert.strictEqual(p.ready, true));

  check("stale media URLs are ignored too", () => {
    const q = st({ method: "text", files: [vid()], mediaUrls: "https://x.com/a.mp4" });
    assert.strictEqual(q.hasMedia, false);
    assert.strictEqual(q.postType, "text");
  });
}

section("summary never claims media that isn't there");
{
  check("no files → 'No media yet', not 'Attached File'", () =>
    assert.strictEqual(st().mediaSummary, "No media yet"));
  check("one file is singular", () =>
    assert.strictEqual(st({ files: [img()] }).mediaSummary, "1 attached file"));
  check("many files are plural", () =>
    assert.strictEqual(st({ files: [img("a"), img("b")] }).mediaSummary, "2 attached files"));
  check("url mode counts URLs", () =>
    assert.strictEqual(
      st({ method: "url", mediaUrls: "https://a.com/1.jpg\nhttps://a.com/2.jpg" }).mediaSummary,
      "2 media URLs"
    ));
  check("blank lines in the URL box don't inflate the count", () =>
    assert.strictEqual(
      st({ method: "url", mediaUrls: "\n  \nhttps://a.com/1.jpg\n\n" }).mediaSummary,
      "1 media URL"
    ));
}

section("post type follows the actual media");
{
  check("image file → photos", () => assert.strictEqual(st({ files: [img()] }).postType, "photos"));
  check("video file → video", () => assert.strictEqual(st({ files: [vid()] }).postType, "video"));
  check("any video among images → video", () =>
    assert.strictEqual(st({ files: [img(), vid()] }).postType, "video"));
  check("video URL → video", () =>
    assert.strictEqual(st({ method: "url", mediaUrls: "https://a.com/clip.mp4" }).postType, "video"));
  check("video URL with a query string still → video", () =>
    assert.strictEqual(
      st({ method: "url", mediaUrls: "https://a.com/clip.mp4?token=1" }).postType,
      "video"
    ));
  check("image URL → photos", () =>
    assert.strictEqual(st({ method: "url", mediaUrls: "https://a.com/p.jpg" }).postType, "photos"));
  check("empty stays video (default posture)", () => assert.strictEqual(st().postType, "video"));
  check("a .mp4 in file mode's URL box is ignored", () =>
    // mediaUrls only counts in url mode; file mode must not read it.
    assert.strictEqual(st({ method: "file", mediaUrls: "https://a.com/c.mp4" }).hasMedia, false));
}

section("thumbnail picks the first image, never a video");
{
  check("first image is chosen", () =>
    assert.strictEqual(st({ files: [img("a"), img("b")] }).thumbnailIndex, 0));
  check("skips a leading video", () =>
    assert.strictEqual(st({ files: [vid(), img()] }).thumbnailIndex, 1));
  check("video-only has no thumbnail", () =>
    assert.strictEqual(st({ files: [vid()] }).thumbnailIndex, null));
  check("URL media has no local thumbnail", () =>
    assert.strictEqual(st({ method: "url", mediaUrls: "https://a.com/p.jpg" }).thumbnailIndex, null));
}

section("submit gating agrees with the badge");
{
  check("media post with no media is blocked", () => {
    const p = st();
    assert.strictEqual(p.mediaMissing, true);
    assert.strictEqual(p.ready, false);
  });
  check("media post with a file is allowed", () => {
    const p = st({ files: [img()] });
    assert.strictEqual(p.mediaMissing, false);
    assert.strictEqual(p.ready, true);
  });
  check("url mode with only whitespace is still blocked", () =>
    assert.strictEqual(st({ method: "url", mediaUrls: "   \n  " }).mediaMissing, true));
  check("mediaMissing is always the inverse of ready", () => {
    for (const s of [
      st(),
      st({ files: [img()] }),
      st({ method: "url", mediaUrls: "https://a.com/p.jpg" }),
      st({ method: "url", mediaUrls: "" }),
    ]) {
      assert.strictEqual(s.mediaMissing, !s.ready);
    }
  });
}

section("invariants that must hold for every reachable state");
{
  check("a media box is shown iff the post can carry media", () => {
    for (const method of ["file", "url", "text"] as const) {
      for (const files of [[], [img()], [vid()], [img(), vid()]]) {
        for (const mediaUrls of ["", "https://a.com/p.jpg", "https://a.com/c.mp4"]) {
          const p = derivePreview({ method, files, mediaUrls });
          assert.strictEqual(p.showMediaBox, method !== "text", `${method}/${files.length}`);
          // A text post must never surface media in any form.
          if (method === "text") {
            assert.strictEqual(p.hasMedia, false);
            assert.strictEqual(p.thumbnailIndex, null);
          }
          // A thumbnail may only point at a real image in the array.
          if (p.thumbnailIndex !== null) {
            assert.ok(files[p.thumbnailIndex].type.startsWith("image"));
          }
        }
      }
    }
  });
}

process.exit(done("composer-preview.test.mts"));
