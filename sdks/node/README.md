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

console.log(await client.analytics("your_profile_user"));
```
