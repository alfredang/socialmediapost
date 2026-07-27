"use client";

import { useState } from "react";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PLATFORM_MAP } from "@/lib/platforms";

interface PostRow {
  requestId: string;
  platform: string;
  profile: string;
  title: string;
  url: string | null;
  when: string;
}

interface Comment {
  id: string;
  message: string;
  author: string | null;
  created_at: string | null;
  likes: number | null;
}

function relative(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(Math.abs(diff) / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return d === 1 ? "yesterday" : `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${Math.max(1, min)}m ago`;
}

export function CommentsClient({ posts }: { posts: PostRow[] }) {
  const [selected, setSelected] = useState<PostRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; reconnect?: boolean } | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  async function loadComments(post: PostRow) {
    setSelected(post);
    setComments([]);
    setError(null);
    setReplyTo(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/internal/comments?request_id=${encodeURIComponent(post.requestId)}&platform=${post.platform}`
      );
      const data = await res.json();
      if (!data.success) setError({ message: data.error, reconnect: data.reconnect });
      else setComments(data.comments);
    } catch {
      setError({ message: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(commentId: string) {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/internal/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_id: selected.requestId,
          platform: selected.platform,
          comment_id: commentId,
          message: replyText.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError({ message: data.error, reconnect: data.reconnect });
      } else {
        setReplyTo(null);
        setReplyText("");
        await loadComments(selected); // re-read so the new reply shows in context
      }
    } catch {
      setError({ message: "Couldn't send the reply. Try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Comments</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          Read and reply to comments on your published Facebook and Instagram posts. Replies are
          sent live through each platform&apos;s API.
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* Post picker */}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Published posts
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {posts.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-400">
                No published Facebook or Instagram posts yet.
              </p>
            )}
            {posts.map((p) => {
              const active = selected?.requestId === p.requestId && selected?.platform === p.platform;
              return (
                <button
                  key={`${p.requestId}-${p.platform}`}
                  onClick={() => loadComments(p)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3 text-left transition-colors cursor-pointer ${
                    active
                      ? "bg-emerald-50 dark:bg-emerald-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <PlatformIcon platform={p.platform} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                      {p.title || "Untitled post"}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {p.profile} · {relative(p.when)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Comments panel */}
        <div className="card min-h-[24rem] p-0">
          {!selected ? (
            <div className="flex h-full min-h-[24rem] items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
              Select a post to load its comments.
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <PlatformIcon platform={selected.platform} size={18} />
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {PLATFORM_MAP[selected.platform]?.name ?? selected.platform} · {selected.title || "Untitled"}
                  </span>
                </span>
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></svg>
                    View post
                  </a>
                )}
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4">
                {loading && <p className="py-8 text-center text-sm text-slate-400">Loading comments…</p>}

                {error && !loading && (
                  <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                    {error.message}
                    {error.reconnect && (
                      <a href="/users" className="ml-1 font-semibold underline">Reconnect the account</a>
                    )}
                  </div>
                )}

                {!loading && !error && comments.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">No comments on this post yet.</p>
                )}

                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {c.author ?? "Someone"}
                        </span>
                        <span className="flex items-center gap-3 text-xs text-slate-400">
                          {c.likes !== null && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
                              {c.likes}
                            </span>
                          )}
                          <span>{relative(c.created_at)}</span>
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{c.message}</p>

                      {replyTo === c.id ? (
                        <div className="mt-3">
                          <label htmlFor={`reply-${c.id}`} className="sr-only">Your reply</label>
                          <textarea
                            id={`reply-${c.id}`}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={2}
                            placeholder="Write a reply…"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => sendReply(c.id)}
                              disabled={sending || !replyText.trim()}
                              className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {sending ? "Sending…" : "Send reply"}
                            </button>
                            <button
                              onClick={() => { setReplyTo(null); setReplyText(""); }}
                              className="btn-secondary px-3 py-1.5 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setReplyTo(c.id); setReplyText(""); setError(null); }}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17l-5-5 5-5M4 12h11a4 4 0 0 1 4 4v2" /></svg>
                          Reply
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
