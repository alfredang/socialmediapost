// Unit tests for the ingest limits on caller-supplied media URLs.
// Pure — no server, no network. Run: npx tsx tests/media-limits.test.mts
//
// safeFetch decides WHICH hosts may be reached; these cover WHAT they may send
// back: a size ceiling, and a container-signature gate on the one sink that
// feeds ffmpeg.
import { check, section, done, assert } from "./_harness.mjs";
import { sniffMediaKind, readCapped, MAX_MEDIA_BYTES } from "../src/lib/upload";

console.log("\nSocialPost — media ingest limits");

// Minimal but real container headers.
const withHeader = (bytes: number[], len = 32) => {
  const b = Buffer.alloc(len);
  Buffer.from(bytes).copy(b);
  return b;
};
const riff = (form: string) => {
  const b = Buffer.alloc(32);
  b.write("RIFF", 0, "latin1");
  b.write(form, 8, "latin1");
  return b;
};

section("recognises the containers ffmpeg is asked to parse");
{
  const cases: [string, Buffer, string][] = [
    ["JPEG", withHeader([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    ["PNG", withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
    ["GIF", withHeader([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), "image/gif"],
    ["WebP", riff("WEBP"), "image/webp"],
    ["AVI", riff("AVI "), "video/x-msvideo"],
    ["WAV", riff("WAVE"), "audio/wav"],
    ["WebM/Matroska", withHeader([0x1a, 0x45, 0xdf, 0xa3]), "video/webm"],
    ["Ogg", withHeader([0x4f, 0x67, 0x67, 0x53]), "video/ogg"],
    ["MP3 (ID3)", withHeader([0x49, 0x44, 0x33, 0x04]), "audio/mpeg"],
  ];
  for (const [label, buf, expected] of cases) {
    check(`${label} -> ${expected}`, () => assert.strictEqual(sniffMediaKind(buf), expected));
  }

  check("MP4 is detected by the ftyp box at offset 4", () => {
    const b = Buffer.alloc(32);
    b.write("ftyp", 4, "latin1");
    b.write("isom", 8, "latin1");
    assert.strictEqual(sniffMediaKind(b), "video/mp4");
  });
}

section("rejects anything that isn't a media container");
{
  const reject: [string, Buffer][] = [
    ["empty", Buffer.alloc(0)],
    ["too short to classify", Buffer.from([0xff, 0xd8])],
    ["HTML error page", Buffer.from("<!DOCTYPE html><html><body>404".padEnd(32))],
    ["JSON", Buffer.from('{"error":"not found"}'.padEnd(32))],
    ["plain text", Buffer.from("just some text here at all".padEnd(32))],
    ["ELF executable", withHeader([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01])],
    ["Windows PE", withHeader([0x4d, 0x5a, 0x90, 0x00])],
    ["ZIP / Office doc", withHeader([0x50, 0x4b, 0x03, 0x04])],
    ["PDF", Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3".padEnd(32))],
    ["RIFF with unknown form", riff("XXXX")],
  ];
  for (const [label, buf] of reject) {
    check(`${label} -> null`, () => assert.strictEqual(sniffMediaKind(buf), null));
  }

  // The gate is shape-only and does not pretend otherwise: a file that starts
  // with a valid header is accepted whatever follows it.
  check("a valid header with hostile payload still passes (documented limit)", () => {
    const b = Buffer.alloc(64);
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(b);
    Buffer.from("<script>evil</script>").copy(b, 12);
    assert.strictEqual(sniffMediaKind(b), "image/jpeg");
  });
}

section("the size ceiling is sane");
{
  check("cap is a positive finite byte count", () => {
    assert.ok(Number.isFinite(MAX_MEDIA_BYTES) && MAX_MEDIA_BYTES > 0);
  });
  check("cap is large enough for real video, small enough to bound memory", () => {
    assert.ok(MAX_MEDIA_BYTES >= 100 * 1024 * 1024, "should allow a 100MB upload");
    assert.ok(MAX_MEDIA_BYTES <= 512 * 1024 * 1024, "should not allow half a gigabyte");
  });
}

section("the download cap holds against a hostile server");
{
  // A stream that never ends — the case arrayBuffer() would happily buffer
  // until the process died. Synthetic, so no network and no localhost (which
  // safeFetch blocks by design, making a real end-to-end test impossible here).
  const endless = (chunk = 64 * 1024) =>
    new Response(
      new ReadableStream<Uint8Array>({
        pull(c) {
          c.enqueue(new Uint8Array(chunk));
        },
      })
    );

  const fixed = (bytes: number, headers?: Record<string, string>) =>
    new Response(new Uint8Array(bytes), { headers });

  // check() is synchronous: an async callback would resolve AFTER it returns
  // and be recorded as a pass no matter what. So every case is awaited here
  // first, then asserted synchronously below.
  const attempt = async (fn: () => Promise<Buffer>) => {
    try {
      return { ok: true as const, size: (await fn()).byteLength };
    } catch {
      return { ok: false as const, size: -1 };
    }
  };

  const rEndless = await attempt(() => readCapped(endless(), 256 * 1024));
  const rUnder = await attempt(() => readCapped(fixed(1000), 4096));
  const rOver = await attempt(() => readCapped(fixed(8192), 4096));
  const rLying = await attempt(() => readCapped(fixed(8192, { "content-length": "10" }), 4096));
  const rExact = await attempt(() => readCapped(fixed(4096), 4096));
  const rHonest = await attempt(() => readCapped(fixed(8192, { "content-length": "8192" }), 4096));

  check("an endless stream is aborted, not buffered", () => assert.strictEqual(rEndless.ok, false));
  check("a body under the cap reads fully", () => {
    assert.ok(rUnder.ok);
    assert.strictEqual(rUnder.size, 1000);
  });
  check("a body over the cap is rejected", () => assert.strictEqual(rOver.ok, false));
  check("a lying Content-Length can't bypass the cap", () =>
    assert.strictEqual(rLying.ok, false));
  check("an honest oversized Content-Length is rejected", () =>
    assert.strictEqual(rHonest.ok, false));
  check("an exactly-at-cap body is allowed", () => {
    assert.ok(rExact.ok);
    assert.strictEqual(rExact.size, 4096);
  });
}

process.exit(done("media-limits.test.mts"));
