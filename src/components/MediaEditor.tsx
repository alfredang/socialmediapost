"use client";

import { useRef, useState } from "react";
import type { StoredFile } from "@/lib/upload";

export interface MediaValue {
  media: StoredFile[]; // staged uploaded files
  urls: string; // one public media URL per line
}

// Reusable media picker: upload files (staged via /api/internal/media) and/or
// paste public URLs. Used for base content and per-platform overrides on both
// the Upload page and the pipeline wizard.
export function MediaEditor({
  kind,
  value,
  onChange,
  onError,
}: {
  kind: "photos" | "video";
  value: MediaValue;
  onChange: (v: MediaValue) => void;
  onError?: (msg: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const form = new FormData();
    for (const f of Array.from(files)) form.append("media", f);
    try {
      const res = await fetch("/api/internal/media", { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) onError?.(data.error ?? "Upload failed");
      else onChange({ ...value, media: [...value.media, ...data.media] });
    } catch {
      onError?.("Upload failed — please try again.");
    }
    setUploading(false);
  }

  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {kind === "video" ? "Video" : "Photos"} — upload files or add public URLs
        </span>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="btn-secondary px-2.5 py-1 text-xs"
        >
          {uploading ? "Uploading…" : "+ Upload"}
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          multiple={kind === "photos"}
          accept={kind === "video" ? "video/*" : "image/*"}
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {value.media.length > 0 && (
        <ul className="mt-2 space-y-1">
          {value.media.map((m, mi) => (
            <li key={mi} className="flex items-center justify-between gap-2 rounded bg-white dark:bg-slate-900 px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{m.name}</span>
              <button
                type="button"
                onClick={() => onChange({ ...value, media: value.media.filter((_, k) => k !== mi) })}
                className="shrink-0 text-red-500 cursor-pointer"
                aria-label={`Remove ${m.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        className="input mt-2 min-h-12 font-mono text-xs"
        placeholder={`Public media URL(s), one per line\nhttps://example.com/${kind === "video" ? "clip.mp4" : "photo.jpg"}`}
        value={value.urls}
        onChange={(e) => onChange({ ...value, urls: e.target.value })}
      />
    </div>
  );
}

// Turns a MediaValue into the StoredFile[] the API expects (staged files + one
// URL stub per non-empty line).
export function mediaValueToStored(v: MediaValue): StoredFile[] {
  return [
    ...v.media,
    ...v.urls
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ path: "", name: url, size: 0, mime: "url" })),
  ];
}
