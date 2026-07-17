// AI copy assistant. Uses the Claude API when ANTHROPIC_API_KEY is set,
// otherwise falls back to a local heuristic generator so the app works offline.

const HOOKS = [
  "🚀", "🔥", "✨", "💡", "🎯", "📈",
];

const TEMPLATES = [
  (t: string) => `${pick(HOOKS)} ${t} — here's what you need to know.`,
  (t: string) => `${pick(HOOKS)} New drop: ${t}. Don't miss it!`,
  (t: string) => `${t} 👇 Everything we learned, in one post.`,
  (t: string) => `${pick(HOOKS)} ${t} (save this for later)`,
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function keywords(text: string): string[] {
  return [...new Set(
    text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/)
      .filter((w) => w.length > 3)
  )].slice(0, 5);
}

export async function generateCopy(input: {
  title: string;
  description?: string;
  tone?: string;
}): Promise<{ title: string; description: string; hashtags: string[] }> {
  const base = input.title || input.description || "Our latest update";

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `Write social media copy for this post. Tone: ${input.tone ?? "engaging"}. Topic: "${base}". ${input.description ? `Details: ${input.description}` : ""}\nReply with JSON only: {"title": "<catchy title with 1-2 emoji, <100 chars>", "description": "<2-3 sentence caption>", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]}`,
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text ?? "";
        const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        if (json.title) return json;
      }
    } catch {
      // fall through to heuristic
    }
  }

  const kws = keywords(base + " " + (input.description ?? ""));
  return {
    title: pick(TEMPLATES)(base),
    description: `${base}. ${input.description || "Check out the full story — link in bio!"} ${pick(HOOKS)}`,
    hashtags: kws.map((k) => `#${k}`).concat(["#socialmedia"]).slice(0, 5),
  };
}
