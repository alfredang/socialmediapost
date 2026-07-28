// Slack publishing via an incoming webhook URL — no OAuth. Incoming webhooks are
// text-only (matching the registry's supports: ["text"]) and can't be
// introspected, so the only honest way to validate one is to post to it — we
// send a one-time connection confirmation. A bad webhook fails loudly.

const WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[\w]+/i;

async function postToSlack(webhookUrl: string, text: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  // Slack returns the literal string "ok" on success, or an error token
  // ("invalid_token", "no_service", "channel_not_found", …).
  const body = (await res.text()).trim();
  if (!res.ok || body !== "ok") {
    throw new Error(`Slack rejected the request — ${body || res.status}`);
  }
}

// Validate by sending a one-time connection message (webhooks have no read API).
export async function validateSlackWebhook(url: string): Promise<void> {
  if (!WEBHOOK_RE.test(url)) {
    throw new Error("That doesn't look like a Slack incoming webhook URL (https://hooks.slack.com/services/…)");
  }
  await postToSlack(url, "🔗 SocialPost connected to this channel.");
}

export async function publishToSlack(input: {
  webhookUrl: string;
  text: string;
}): Promise<{ url: string; externalId: string }> {
  await postToSlack(input.webhookUrl, input.text);
  // Incoming webhooks return no message id or permalink.
  return { url: "", externalId: "" };
}
