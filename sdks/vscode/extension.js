// SocialPost VS Code extension — post to 22 social platforms from the editor.
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

function cfg() {
  const c = vscode.workspace.getConfiguration("socialpost");
  return {
    apiKey: c.get("apiKey"),
    baseUrl: String(c.get("baseUrl") || "http://localhost:3000").replace(/\/$/, ""),
    user: c.get("defaultUser"),
    platforms: c.get("defaultPlatforms") || [],
  };
}

async function ensureConfig() {
  const { apiKey, user } = cfg();
  if (!apiKey) {
    vscode.window.showErrorMessage("SocialPost: set socialpost.apiKey in Settings first.");
    return false;
  }
  if (!user) {
    vscode.window.showErrorMessage("SocialPost: set socialpost.defaultUser (your profile name) in Settings.");
    return false;
  }
  return true;
}

async function pickPlatforms(defaults) {
  const ALL = ["tiktok", "instagram", "youtube", "linkedin", "facebook", "x", "threads",
    "pinterest", "reddit", "bluesky", "google_business", "discord", "telegram", "slack",
    "mastodon", "nostr", "lemmy", "devto", "hashnode", "wordpress", "whop", "listmonk"];
  const picked = await vscode.window.showQuickPick(
    ALL.map((p) => ({ label: p, picked: defaults.includes(p) })),
    { canPickMany: true, title: "Post to which platforms?" }
  );
  return picked?.map((p) => p.label) ?? [];
}

async function api(endpoint, form) {
  const { apiKey, baseUrl } = cfg();
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Apikey ${apiKey}` },
    body: form,
  });
  return res.json();
}

function reportResult(data) {
  if (!data.success) {
    vscode.window.showErrorMessage(`SocialPost: ${data.error ?? "upload failed"}`);
    return;
  }
  const lines = Object.entries(data.results ?? {}).map(
    ([p, r]) => `${p}: ${r.success ? "✅ " + r.url : "❌ " + r.error}`
  );
  vscode.window.showInformationMessage(`SocialPost — ${data.status}. ${lines.join(" | ")}`);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("socialpost.postSelection", async () => {
      if (!(await ensureConfig())) return;
      const editor = vscode.window.activeTextEditor;
      const text = editor?.document.getText(editor.selection) || "";
      const title = text.trim() || (await vscode.window.showInputBox({ title: "Post text" }));
      if (!title) return;
      const { user, platforms } = cfg();
      const chosen = await pickPlatforms(platforms);
      if (chosen.length === 0) return;
      const form = new FormData();
      form.set("title", title);
      form.set("user", user);
      for (const p of chosen) form.append("platform[]", p);
      reportResult(await api("/api/upload_text", form));
    }),

    vscode.commands.registerCommand("socialpost.uploadCurrentFile", async () => {
      if (!(await ensureConfig())) return;
      const uris = await vscode.window.showOpenDialog({
        title: "Select a video or image to post",
        filters: { Media: ["mp4", "mov", "webm", "jpg", "jpeg", "png", "gif", "webp"] },
      });
      if (!uris?.length) return;
      const file = uris[0].fsPath;
      const isVideo = /\.(mp4|mov|webm)$/i.test(file);
      const title = await vscode.window.showInputBox({ title: "Post title / caption (emoji ok 🚀)" });
      if (title === undefined) return;
      const { user, platforms } = cfg();
      const chosen = await pickPlatforms(platforms);
      if (chosen.length === 0) return;
      const form = new FormData();
      form.set("title", title || path.basename(file));
      form.set("user", user);
      for (const p of chosen) form.append("platform[]", p);
      const blob = new Blob([fs.readFileSync(file)]);
      if (isVideo) form.set("video", blob, path.basename(file));
      else form.append("photos[]", blob, path.basename(file));
      reportResult(await api(isVideo ? "/api/upload" : "/api/upload_photos", form));
    }),

    vscode.commands.registerCommand("socialpost.showHistory", async () => {
      if (!(await ensureConfig())) return;
      const { apiKey, baseUrl } = cfg();
      const res = await fetch(`${baseUrl}/api/uploadposts/history?limit=15`, {
        headers: { Authorization: `Apikey ${apiKey}` },
      });
      const data = await res.json();
      if (!data.success) return vscode.window.showErrorMessage("SocialPost: could not load history");
      const item = await vscode.window.showQuickPick(
        data.history.map((h) => ({
          label: `${h.status === "published" ? "✅" : h.status === "failed" ? "❌" : "🕐"} ${h.title || "(untitled)"}`,
          description: `${h.platforms.map((p) => p.platform).join(", ")} · ${new Date(h.created_at).toLocaleString()}`,
          url: h.platforms.find((p) => p.url)?.url,
        })),
        { title: "SocialPost upload history" }
      );
      if (item?.url) vscode.env.openExternal(vscode.Uri.parse(item.url));
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
