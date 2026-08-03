// Unit tests for the pure logic inside the credential-platform adapters.
// No server, no network, no credentials. Run: npx tsx tests/platform-adapters.test.mts
//
// These are the parts that can be verified without an API key. Everything else
// in those adapters needs a live handshake and is deliberately not faked here.
import { check, section, done, assert } from "./_harness.mjs";
import { normalizeExternalBaseUrl } from "../src/lib/base-url";
import { devtoTags } from "../src/lib/devto";
import { extractHashtags, stripHashtags, adaptContent, PLATFORM_MAP } from "../src/lib/platforms";
import { CREDENTIAL_VALIDATORS } from "../src/lib/credential-connect";
import { REAL_PUBLISHERS } from "../src/lib/publishers";

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

section("hashtags require a word boundary — a URL fragment is not a tag");
{
  check("plain hashtags extract", () =>
    assert.deepStrictEqual(extractHashtags("a #one and #two"), ["one", "two"]));
  check("leading hashtag extracts", () =>
    assert.deepStrictEqual(extractHashtags("#first thing"), ["first"]));
  check("mid-word hash is not a tag", () =>
    assert.deepStrictEqual(extractHashtags("no#tag"), []));
  check("URL fragment is not a tag", () =>
    assert.deepStrictEqual(extractHashtags("see https://x.com/docs#install now"), []));

  check("stripping removes tags and the space before them", () =>
    assert.strictEqual(stripHashtags("hello #a world #b"), "hello world"));
  check("stripping leaves a URL fragment intact", () =>
    assert.strictEqual(
      stripHashtags("read https://x.com/docs#install today"),
      "read https://x.com/docs#install today"
    ));

  // Instagram moves hashtags to the first comment and strips them from the
  // caption. Before the shared rule, that strip cut "#install" out of the
  // middle of a link and published a broken URL.
  const adapted = adaptContent("instagram", {
    type: "photos",
    title: "Guide",
    description: "docs at https://x.com/docs#install #launch",
    overrides: {},
  });
  check("Instagram keeps the link whole", () =>
    assert.ok(
      adapted.body.includes("https://x.com/docs#install"),
      `link was mangled: ${adapted.body}`
    ));
  check("Instagram still moves the real hashtag", () =>
    assert.strictEqual(adapted.firstComment, "#launch"));
  check("the real hashtag left the caption", () =>
    assert.ok(!adapted.body.includes("#launch"), adapted.body));
}

section("platform registries can't be indexed through Object.prototype");
{
  // These are all indexed by a platform id that reaches the process from a
  // request body or the database. On a plain object literal, "constructor"
  // resolves to the Object constructor — truthy AND callable, so it passes a
  // `if (!x)` guard and then `await Object(body)` returns the raw request as
  // if it were a validated result. Null prototypes make the lookup miss.
  const INHERITED = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

  for (const [name, registry] of [
    ["CREDENTIAL_VALIDATORS", CREDENTIAL_VALIDATORS as Record<string, unknown>],
    ["REAL_PUBLISHERS", REAL_PUBLISHERS as Record<string, unknown>],
    ["PLATFORM_MAP", PLATFORM_MAP as Record<string, unknown>],
  ] as const) {
    check(`${name} misses inherited keys`, () => {
      for (const key of INHERITED) {
        assert.strictEqual(registry[key], undefined, `${name}["${key}"] was not undefined`);
      }
    });
  }

  check("real platforms still resolve", () => {
    assert.ok(typeof CREDENTIAL_VALIDATORS.discord === "function");
    assert.ok(typeof REAL_PUBLISHERS.instagram === "function");
    assert.strictEqual(PLATFORM_MAP.bluesky?.name, "Bluesky");
  });

  check("an unknown platform is still just a miss", () => {
    assert.strictEqual(CREDENTIAL_VALIDATORS["not-a-platform"], undefined);
    assert.strictEqual(REAL_PUBLISHERS["not-a-platform"], undefined);
  });
}

process.exit(done("platform-adapters.test.mts"));
