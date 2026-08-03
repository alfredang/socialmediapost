// Unit tests for the pure logic inside the credential-platform adapters.
// No server, no network, no credentials. Run: npx tsx tests/platform-adapters.test.mts
//
// These are the parts that can be verified without an API key. Everything else
// in those adapters needs a live handshake and is deliberately not faked here.
import { check, section, done, assert } from "./_harness.mjs";
import { normalizeExternalBaseUrl } from "../src/lib/base-url";
import { devtoTags } from "../src/lib/devto";

console.log("\nSocialPost — credential platform adapters");

section("user-supplied base URLs normalise consistently");
{
  const n = (s: string) => normalizeExternalBaseUrl(s, "test URL");

  check("adds https when the scheme is missing", () =>
    assert.strictEqual(n("mastodon.social"), "https://mastodon.social"));
  check("keeps an explicit http scheme", () =>
    assert.strictEqual(n("http://localhost.test"), "http://localhost.test"));
  check("strips a trailing slash", () =>
    assert.strictEqual(n("https://mastodon.social/"), "https://mastodon.social"));
  check("strips query and fragment", () =>
    assert.strictEqual(n("https://a.com/?x=1#y"), "https://a.com"));
  check("preserves a subdirectory install", () =>
    assert.strictEqual(n("https://a.com/blog"), "https://a.com/blog"));
  check("trims surrounding whitespace", () =>
    assert.strictEqual(n("  https://a.com  "), "https://a.com"));
  check("empty input is rejected by name", () =>
    assert.throws(() => n("   "), /Enter your test URL/));
  check("garbage is rejected by name", () =>
    assert.throws(() => n("http://"), /isn't a valid test URL/));

  check("normalising twice changes nothing", () => {
    for (const raw of ["a.com", "https://a.com/", "https://a.com/blog?x=1"]) {
      assert.strictEqual(n(n(raw)), n(raw));
    }
  });

  // The result is fed to safeFetch, so it must stay a parseable absolute URL
  // with an http(s) scheme — never a relative or scheme-less string.
  check("always yields an absolute http(s) URL", () => {
    for (const raw of ["a.com", "https://a.com/x/", "http://b.io?q=1"]) {
      const u = new URL(n(raw));
      assert.ok(u.protocol === "http:" || u.protocol === "https:");
      assert.ok(u.host.length > 0);
    }
  });
}

section("Dev.to tag derivation");
{
  check("no hashtags → no tags", () => assert.deepStrictEqual(devtoTags("plain text"), []));
  check("lowercases", () => assert.deepStrictEqual(devtoTags("#WebDev"), ["webdev"]));
  check("strips non-alphanumerics Dev.to would reject", () =>
    assert.deepStrictEqual(devtoTags("#node_js #c++"), ["nodejs", "c"]));
  check("dedupes case-insensitively", () =>
    assert.deepStrictEqual(devtoTags("#react #React #REACT"), ["react"]));
  check("caps at Dev.to's limit of 4", () =>
    assert.deepStrictEqual(devtoTags("#a #b #c #d #e #f"), ["a", "b", "c", "d"]));
  check("ignores a mid-word hash", () => assert.deepStrictEqual(devtoTags("no#tag"), []));
  check("a URL fragment is not a tag", () =>
    assert.deepStrictEqual(devtoTags("see https://x.com/docs#install for setup"), []));
  check("a hashtag at the very start still counts", () =>
    assert.deepStrictEqual(devtoTags("#opening word"), ["opening"]));
  check("every tag is API-safe", () => {
    for (const t of devtoTags("#Hello-World #ünïcode #123 #a")) {
      assert.match(t, /^[a-z0-9]+$/, `"${t}" is not lowercase alphanumeric`);
    }
  });
}

process.exit(done("platform-adapters.test.mts"));
