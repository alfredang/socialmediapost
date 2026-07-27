# SocialPost Node.js SDK

```bash
npm install ./sdks/node
```

```js
import { SocialPost } from "socialpost-sdk";

const client = new SocialPost("your-api-key", { baseUrl: "http://localhost:3000" });

await client.uploadVideo({
  video: "./video.mp4",
  title: "Your Video Title 🚀",
  user: "your_profile_user",
  platforms: ["tiktok", "instagram", "youtube"],
});

await client.uploadText({
  title: "Big news! 🎉",
  user: "your_profile_user",
  platforms: ["x", "linkedin"],
  overrides: { x_title: "Short & punchy 🎉" },
  scheduledDate: "2026-08-01T09:00:00+08:00",
});

// LinkedIn document
await client.uploadDocument({
  document: "./deck.pdf",
  title: "Our 2026 roadmap",
  user: "your_profile_user",
  platforms: ["linkedin"],
});

// Queue: inspect slots, then attach a draft to the next one
console.log(await client.nextSlot("your_profile_user"));      // next free slot (ISO)
console.log(await client.previewQueue("your_profile_user"));  // upcoming slots
await client.updateQueueSettings({ user: "your_profile_user", timezone: "Asia/Kuala_Lumpur", slot_times: ["09:00", "18:00"] });
await client.addToQueue("request-id");

// Reschedule / cancel
await client.editScheduled("request-id", "2026-08-02T09:00:00+08:00");

// Analytics + reads
console.log(await client.analytics("your_profile_user"));
console.log(await client.postAnalytics("request-id"));
console.log(await client.platformMetrics());              // public — no key needed
console.log(await client.media({ user: "your_profile_user" }));
console.log(await client.pages("your_profile_user"));     // Facebook Pages you can publish to

// Comments on a published post (Facebook only)
const { comments } = await client.comments("request-id");
if (comments[0]) await client.replyToComment("request-id", comments[0].id, "Thanks! 🙌");

// White-label connect links
const { access_token } = await client.generateJwt("your_profile_user");
console.log(await client.validateJwt(access_token));       // public — no key needed
```

### Webhooks

Set your account webhook URL in the dashboard; SocialPost POSTs a JSON body when
a post finishes. Parse it into a typed event:

```js
import { parseWebhookEvent } from "socialpost-sdk";

// e.g. inside an Express handler: app.post("/hook", (req, res) => { ... })
const evt = parseWebhookEvent(req.body); // or parseWebhookEvent(rawJsonString)
// { event: "post.completed", requestId, status, results }
```
