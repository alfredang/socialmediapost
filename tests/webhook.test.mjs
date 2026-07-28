// Unit test for the Node SDK's webhook parser. Pure function — no server needed.
// Run: node tests/webhook.test.mjs
import { check, section, done, assert } from "./_harness.mjs";
import { parseWebhookEvent } from "../sdks/node/index.mjs";

console.log("\nSocialPost — webhook parser (SDK)");

section("parses the real post.completed payload");
{
  const payload = {
    event: "post.completed",
    request_id: "req_123",
    status: "published",
    results: { tiktok: { success: true, url: "https://tiktok.com/x" } },
  };

  const fromObject = parseWebhookEvent(payload);
  check("object input → typed event", () => {
    assert.strictEqual(fromObject.event, "post.completed");
    assert.strictEqual(fromObject.requestId, "req_123");
    assert.strictEqual(fromObject.status, "published");
    assert.deepStrictEqual(fromObject.results, payload.results);
  });

  const fromString = parseWebhookEvent(JSON.stringify(payload));
  check("raw JSON string input parses identically", () =>
    assert.deepStrictEqual(fromString, fromObject));

  check("missing results defaults to {}", () => {
    const e = parseWebhookEvent({ event: "post.completed", request_id: "r", status: "failed" });
    assert.deepStrictEqual(e.results, {});
  });
}

section("rejects anything that isn't a known event");
{
  check("unknown event throws", () =>
    assert.throws(() => parseWebhookEvent({ event: "post.deleted" }), /Unknown webhook event/));
  check("non-object throws", () =>
    assert.throws(() => parseWebhookEvent(42), /Not a SocialPost webhook payload/));
  check("missing event field throws", () =>
    assert.throws(() => parseWebhookEvent({ request_id: "r" }), /Not a SocialPost webhook payload/));
}

process.exit(done("webhook.test.mjs"));
