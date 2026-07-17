"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/CodeBlock";

const TABS: { key: string; label: string; code: string }[] = [
  {
    key: "video",
    label: "🎬 Video",
    code: `curl \\
  -H 'Authorization: Apikey your-api-key-here' \\
  -F 'video=@/path/to/your/video.mp4' \\
  -F 'title="Your Video Title 🚀"' \\
  -F 'user="your_profile_user"' \\
  -F 'platform[]=tiktok' \\
  -F 'platform[]=instagram' \\
  -F 'platform[]=youtube' \\
  -X POST https://your-domain.com/api/upload`,
  },
  {
    key: "photos",
    label: "📸 Photos",
    code: `curl \\
  -H 'Authorization: Apikey your-api-key-here' \\
  -F 'photos[]=@/path/to/image1.jpg' \\
  -F 'photos[]=@/path/to/image2.png' \\
  -F 'user="your_profile_user"' \\
  -F 'platform[]=instagram' \\
  -F 'title="My Awesome Photo Album 📸"' \\
  -F 'description="Check out these cool photos!"' \\
  -X POST https://your-domain.com/api/upload_photos`,
  },
  {
    key: "text",
    label: "✍️ Text",
    code: `curl \\
  -H 'Authorization: Apikey your-api-key-here' \\
  -F 'user="your_profile_user"' \\
  -F 'platform[]=x' \\
  -F 'title="This is my amazing post! 🎉"' \\
  -F 'caption="Optional: a caption for stats & tracking."' \\
  -X POST https://your-domain.com/api/upload_text`,
  },
];

export function CurlTabs() {
  const [tab, setTab] = useState("video");
  const active = TABS.find((t) => t.key === tab)!;
  return (
    <div>
      <div className="flex justify-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1 w-fit mx-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <CodeBlock title={`POST /api/${tab === "video" ? "upload" : `upload_${tab}`}`} code={active.code} />
      </div>
      <p className="mt-3 text-center text-sm text-slate-400">
        That&apos;s the whole integration. Per-platform adaptation, retries, scheduling and analytics included.
      </p>
    </div>
  );
}
