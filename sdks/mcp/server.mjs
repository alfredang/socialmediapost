#!/usr/bin/env node
// SocialPost MCP server — lets GitHub Copilot, Claude, Cursor and other
// MCP-compatible AI agents post to every social platform through SocialPost.
//
// Config (Copilot / Claude Desktop / Cursor):
// { "mcpServers": { "socialpost": { "command": "node", "args": ["sdks/mcp/server.mjs"],
//   "env": { "SOCIALPOST_API_KEY": "...", "SOCIALPOST_BASE_URL": "http://localhost:3000" } } } }
//
// Zero-dependency implementation of MCP over stdio (JSON-RPC 2.0, line-delimited).

import { readFile } from "fs/promises";
import path from "path";
import readline from "readline";

const BASE = (process.env.SOCIALPOST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.SOCIALPOST_API_KEY ?? "";

const TOOLS = [
  {
    name: "upload_video",
    description: "Post a video file to one or more social platforms (TikTok, Instagram, YouTube, LinkedIn, X, …) in one call.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { type: "string", description: "Local path to the video file" },
        title: { type: "string" },
        user: { type: "string", description: "SocialPost profile name" },
        platforms: { type: "array", items: { type: "string" } },
        scheduled_date: { type: "string", description: "Optional ISO-8601 datetime" },
      },
      required: ["video_path", "title", "user", "platforms"],
    },
  },
  {
    name: "upload_photos",
    description: "Post one or more photos (carousel where supported) to social platforms.",
    inputSchema: {
      type: "object",
      properties: {
        photo_paths: { type: "array", items: { type: "string" } },
        title: { type: "string" },
        description: { type: "string" },
        user: { type: "string" },
        platforms: { type: "array", items: { type: "string" } },
        scheduled_date: { type: "string" },
      },
      required: ["photo_paths", "title", "user", "platforms"],
    },
  },
  {
    name: "upload_text",
    description: "Post a text-only update (X, LinkedIn, Threads, Mastodon, Dev.to, …). Emoji supported.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The post text" },
        caption: { type: "string" },
        user: { type: "string" },
        platforms: { type: "array", items: { type: "string" } },
        scheduled_date: { type: "string" },
      },
      required: ["title", "user", "platforms"],
    },
  },
  {
    name: "get_analytics",
    description: "Get follower/reach/impressions analytics for a profile, optionally filtered by platform and date range.",
    inputSchema: {
      type: "object",
      properties: {
        user: { type: "string" },
        platform: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["user"],
    },
  },
  {
    name: "list_history",
    description: "List recent uploads with their per-platform status and URLs.",
    inputSchema: {
      type: "object",
      properties: { page: { type: "number" }, limit: { type: "number" } },
    },
  },
  {
    name: "schedule_post",
    description: "List scheduled posts, or cancel one by request_id.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "cancel"] },
        request_id: { type: "string" },
      },
      required: ["action"],
    },
  },
];

async function api(method, endpoint, { form, params } = {}) {
  const url = new URL(BASE + endpoint);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Apikey ${KEY}` },
    body: form,
  });
  return res.json();
}

function baseForm(args) {
  const form = new FormData();
  form.set("title", args.title ?? "");
  form.set("user", args.user);
  for (const p of args.platforms ?? []) form.append("platform[]", p);
  if (args.description ?? args.caption) form.set("description", args.description ?? args.caption);
  if (args.scheduled_date) form.set("scheduled_date", args.scheduled_date);
  return form;
}

async function fileBlob(p) {
  return new Blob([await readFile(p)]);
}

async function callTool(name, args) {
  switch (name) {
    case "upload_video": {
      const form = baseForm(args);
      form.set("video", await fileBlob(args.video_path), path.basename(args.video_path));
      return api("POST", "/api/upload", { form });
    }
    case "upload_photos": {
      const form = baseForm(args);
      for (const p of args.photo_paths) form.append("photos[]", await fileBlob(p), path.basename(p));
      return api("POST", "/api/upload_photos", { form });
    }
    case "upload_text":
      return api("POST", "/api/upload_text", { form: baseForm(args) });
    case "get_analytics": {
      const { user, ...params } = args;
      return api("GET", `/api/analytics/${encodeURIComponent(user)}`, { params });
    }
    case "list_history":
      return api("GET", "/api/uploadposts/history", { params: args });
    case "schedule_post":
      if (args.action === "cancel") {
        return api("DELETE", "/api/uploadposts/schedule", { params: { request_id: args.request_id } });
      }
      return api("GET", "/api/uploadposts/schedule");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- MCP stdio loop ---
const rl = readline.createInterface({ input: process.stdin });
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

rl.on("line", async (line) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = req;
  try {
    if (method === "initialize") {
      send({
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: params?.protocolVersion ?? "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "socialpost-mcp", version: "1.0.0" },
        },
      });
    } else if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    } else if (method === "tools/call") {
      const result = await callTool(params.name, params.arguments ?? {});
      send({
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
      });
    } else if (id !== undefined) {
      send({ jsonrpc: "2.0", id, result: {} });
    }
  } catch (err) {
    if (id !== undefined) {
      send({ jsonrpc: "2.0", id, error: { code: -32000, message: String(err?.message ?? err) } });
    }
  }
});
