import { CodeBlock } from "@/components/CodeBlock";
import { PLATFORMS } from "@/lib/platforms";
import { PlatformIcon } from "@/components/PlatformIcon";

export const metadata = { title: "API Documentation" };

const NAV = [
  ["#auth", "Authentication"],
  ["#upload", "Upload Video"],
  ["#upload-photos", "Upload Photos"],
  ["#upload-text", "Upload Text"],
  ["#upload-document", "Upload Document"],
  ["#manage", "Status · History · Schedule"],
  ["#queue", "Queue"],
  ["#analytics", "Analytics"],
  ["#users", "User Management & JWT"],
  ["#ffmpeg", "FFmpeg Processing"],
  ["#platforms", "Platform Matrix"],
  ["#sdks", "SDKs"],
  ["#integrations", "Integrations (n8n · Copilot · Claude)"],
];

function Param({ name, required, children }: { name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="py-2.5 pr-4 align-top">
        <code className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{name}</code>
        {required && <span className="ml-2 rounded bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">required</span>}
      </td>
      <td className="py-2.5 text-sm text-slate-500 dark:text-slate-400">{children}</td>
    </tr>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20 p-6">
      <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || "https://your-domain.com";
  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <nav className="lg:sticky lg:top-20 h-fit" aria-label="Docs">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Documentation</p>
        <ul className="mt-3 space-y-1 text-sm">
          {NAV.map(([href, label]) => (
            <li key={href}>
              <a href={href} className="block rounded-lg px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">SocialPost API</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            One API call to post on all platforms. RESTful, multipart-friendly, emoji-safe. Base URL:{" "}
            <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-xs">{`${baseUrl}/api`}</code>
          </p>
        </div>

        <Section id="auth" title="Authentication">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Every request needs an API key from the <a href="/api-keys" className="text-emerald-600 dark:text-emerald-400 underline">API Keys page</a>, sent in the Authorization header:
          </p>
          <CodeBlock code={`Authorization: Apikey your-api-key-here`} />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Optional <code className="font-mono text-xs">Idempotency-Key</code> header prevents duplicate posts on retries. Quotas are enforced per plan (429 when exceeded).
          </p>
        </Section>

        <Section id="upload" title="POST /api/upload — Video">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload one video to any combination of platforms. <code className="font-mono text-xs">/api/upload_video</code> is an alias.
          </p>
          <CodeBlock title="Upload a video everywhere" code={`curl \\
  -H 'Authorization: Apikey your-api-key-here' \\
  -F 'video=@/path/to/your/video.mp4' \\
  -F 'title="Your Awesome Title 🚀"' \\
  -F 'user="test"' \\
  -F 'platform[]=tiktok' \\
  -F 'platform[]=instagram' \\
  -F 'platform[]=youtube' \\
  -X POST ${baseUrl}/api/upload`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <tbody>
                <Param name="video" required>The video file (multipart) to upload.</Param>
                <Param name="title" required>Post title/caption. Emoji and hashtags welcome — content is auto-adapted to each platform&apos;s limits.</Param>
                <Param name="user" required>Profile name created in User Management.</Param>
                <Param name="platform[]" required>Repeat for each target platform.</Param>
                <Param name="description">Longer caption; falls back to title.</Param>
                <Param name="first_comment">Auto-posted first comment (IG, FB, Threads, Bluesky, Reddit, X, YouTube, LinkedIn).</Param>
                <Param name="scheduled_date">ISO-8601 datetime to schedule instead of posting now.</Param>
                <Param name="autogenerate">true → AI-generate title/description.</Param>
                <Param name="&lt;platform&gt;_title / _description">Per-platform overrides, e.g. <code className="font-mono text-xs">instagram_title</code>, <code className="font-mono text-xs">youtube_description</code>.</Param>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="upload-photos" title="POST /api/upload_photos — Photos">
          <CodeBlock code={`curl \\
  -H 'Authorization: Apikey your-api-key-here' \\
  -F 'photos[]=@/path/to/image1.jpg' \\
  -F 'photos[]=@/path/to/image2.png' \\
  -F 'user="test"' \\
  -F 'platform[]=instagram' \\
  -F 'title="My Awesome Photo Album 📸"' \\
  -F 'description="Check out these cool photos!"' \\
  -X POST ${baseUrl}/api/upload_photos`} />
          <p className="text-sm text-slate-500 dark:text-slate-400">Multiple photos become a carousel where supported (Instagram ≤10, LinkedIn ≤9, X ≤4…).</p>
        </Section>

        <Section id="upload-text" title="POST /api/upload_text — Text">
          <CodeBlock code={`curl \\
  -H 'Authorization: Apikey your-api-key-here' \\
  -F 'user="test"' \\
  -F 'platform[]=x' \\
  -F 'title="This is my amazing post! 🎉"' \\
  -F 'caption="Optional: a caption for stats & tracking."' \\
  -X POST ${baseUrl}/api/upload_text`} />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Supports X, LinkedIn, Facebook, Threads, Reddit, Bluesky, Discord, Telegram, Google
            Business, Slack, Mastodon, Nostr, Lemmy, Dev.to, Hashnode, WordPress, Whop and Listmonk.
          </p>
        </Section>

        <Section id="upload-document" title="POST /api/uploadposts/upload-document — Document (LinkedIn)">
          <CodeBlock code={`curl \\
  -H 'Authorization: Apikey your-api-key-here' \\
  -F 'document=@/path/to/deck.pdf' \\
  -F 'title="Our Q3 deck"' \\
  -F 'user="test"' \\
  -F 'platform[]=linkedin' \\
  -X POST ${baseUrl}/api/uploadposts/upload-document`} />
          <p className="text-sm text-slate-500 dark:text-slate-400">PDF, PPT, PPTX, DOC, DOCX — displayed as a native LinkedIn document carousel.</p>
        </Section>

        <Section id="manage" title="Status · History · Schedule">
          <CodeBlock code={`# Track an async/scheduled upload
GET /api/uploadposts/status?request_id=REQ

# Paginated history
GET /api/uploadposts/history?page=1&limit=20

# List scheduled posts
GET /api/uploadposts/schedule

# Reschedule
PATCH /api/uploadposts/schedule
{ "request_id": "REQ", "scheduled_date": "2026-08-01T09:00:00+08:00" }

# Cancel
DELETE /api/uploadposts/schedule?request_id=REQ`} />
        </Section>

        <Section id="queue" title="Queue">
          <CodeBlock code={`# Read queue settings + next slots
GET /api/uploadposts/queue/settings?user=test

# Update settings
PUT /api/uploadposts/queue/settings
{ "user": "test", "timezone": "Asia/Singapore",
  "active_days": ["mon","wed","fri"], "slot_times": ["09:00","17:00"], "max_per_slot": 1 }

# Auto-schedule an existing draft/post to the next free slot
POST /api/uploadposts/add_to_queue
{ "request_id": "REQ" }`} />
        </Section>

        <Section id="analytics" title="Analytics">
          <CodeBlock code={`# Profile metrics (followers, reach, impressions, likes…) with time series
GET /api/analytics/{profile}?platform=instagram&from=2026-06-01&to=2026-07-01

# Per-post live metrics
GET /api/uploadposts/post-analytics/{request_id}

# Which metrics exist per platform (public)
GET /api/uploadposts/platform-metrics

# Recently published media
GET /api/uploadposts/media?user=test&platform=instagram`} />
        </Section>

        <Section id="users" title="User Management & JWT (Whitelabel)">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage profiles programmatically and generate connect-links so <em>your</em> users can
            link their own social accounts under your brand.
          </p>
          <CodeBlock code={`# Validate key + plan info
GET /api/uploadposts/me

# Create / list / delete profiles
POST   /api/uploadposts/users        { "username": "customer_42" }
GET    /api/uploadposts/users
DELETE /api/uploadposts/users?username=customer_42

# Whitelabel connect-link (24h JWT)
POST /api/uploadposts/users/generate-jwt   { "username": "customer_42" }
GET  /api/uploadposts/users/validate-jwt?token=...`} />
        </Section>

        <Section id="ffmpeg" title="FFmpeg Processing">
          <CodeBlock code={`# Submit a processing job — named operation, not a raw ffmpeg command
POST /api/uploadposts/ffmpeg/job
{ "media_url": "https://…/clip.mp4", "operation": "scale",
  "params": { "width": 1080, "height": 1920, "mode": "fill" } }

# …or post the file directly
curl -X POST /api/uploadposts/ffmpeg/job \\
  -H "Authorization: Apikey $KEY" \\
  -F file=@clip.mp4 -F operation=to_vertical

# Operations: scale · trim · to_vertical · extract_audio · thumbnail · transcode
# Returns { output_url, minutes_charged } — quota is billed on real processing time.

# Usage / quota
GET /api/uploadposts/ffmpeg/usage`} />
        </Section>

        <Section id="platforms" title="Platform Matrix">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4">Platform</th>
                  <th className="py-2 pr-4">Video</th>
                  <th className="py-2 pr-4">Photos</th>
                  <th className="py-2 pr-4">Text</th>
                  <th className="py-2 pr-4">Title limit</th>
                  <th className="py-2">First comment</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORMS.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                        <PlatformIcon platform={p.id} size={15} /> {p.name}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{p.supports.includes("video") ? "✅" : "—"}</td>
                    <td className="py-2 pr-4">{p.supports.includes("photos") ? "✅" : "—"}</td>
                    <td className="py-2 pr-4">{p.supports.includes("text") ? "✅" : "—"}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{p.titleMax.toLocaleString()}</td>
                    <td className="py-2">{p.firstComment ? "✅" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="sdks" title="SDKs">
          <p className="text-sm text-slate-500 dark:text-slate-400">First-party SDKs live in the repo under <code className="font-mono text-xs">sdks/</code>.</p>
          <CodeBlock title="Python" code={`pip install -e sdks/python   # local install

from socialpost import SocialPostClient
client = SocialPostClient("your-api-key", base_url="${baseUrl}")
client.upload_text(user="test", platforms=["x"], title="Hello from Python 🐍")`} />
          <CodeBlock title="Node.js" code={`npm install ./sdks/node       # local install

import { SocialPost } from "socialpost-sdk";
const client = new SocialPost("your-api-key", { baseUrl: "${baseUrl}" });
await client.uploadText({ user: "test", platforms: ["x"], title: "Hello from Node ⚡" });`} />
        </Section>

        <Section id="integrations" title="Integrations">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <strong>n8n</strong> — community node in <code className="font-mono text-xs">sdks/n8n</code>: add the
            SocialPost node, paste your API key, and drop &quot;Upload Video/Photos/Text&quot; steps into any workflow.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <strong>GitHub Copilot, Claude &amp; AI agents (MCP)</strong> — run the SocialPost MCP server and your
            AI agent can post to every platform for you:
          </p>
          <CodeBlock title="MCP server (works with Copilot, Claude Desktop, Cursor…)" code={`{
  "mcpServers": {
    "socialpost": {
      "command": "node",
      "args": ["sdks/mcp/server.mjs"],
      "env": {
        "SOCIALPOST_API_KEY": "your-api-key-here",
        "SOCIALPOST_BASE_URL": "${baseUrl}"
      }
    }
  }
}`} />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tools exposed: <code className="font-mono text-xs">upload_video</code>,{" "}
            <code className="font-mono text-xs">upload_photos</code>,{" "}
            <code className="font-mono text-xs">upload_text</code>,{" "}
            <code className="font-mono text-xs">get_analytics</code>,{" "}
            <code className="font-mono text-xs">list_history</code>,{" "}
            <code className="font-mono text-xs">schedule_post</code>. Authorized agents appear on the{" "}
            <a href="/connected-apps" className="text-emerald-600 dark:text-emerald-400 underline">Connected Apps</a> page.
          </p>
        </Section>
      </div>
    </div>
  );
}
