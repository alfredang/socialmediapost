// SocialPost Node.js SDK — zero-dependency (uses global fetch/FormData, Node ≥18).
import { readFile } from "fs/promises";
import path from "path";

export class SocialPost {
  /**
   * @param {string} apiKey
   * @param {{ baseUrl?: string }} [opts]
   */
  constructor(apiKey, opts = {}) {
    this.apiKey = apiKey;
    this.baseUrl = (opts.baseUrl ?? "http://localhost:3000").replace(/\/$/, "");
  }

  async #request(method, endpoint, { form, params } = {}) {
    const url = new URL(this.baseUrl + endpoint);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Apikey ${this.apiKey}` },
      body: form,
    });
    return res.json();
  }

  async #fileBlob(filePath) {
    const buf = await readFile(filePath);
    return new Blob([buf]);
  }

  #baseForm({ title, user, platforms, description, caption, firstComment, scheduledDate, overrides }) {
    const form = new FormData();
    if (title) form.set("title", title);
    form.set("user", user);
    for (const p of platforms) form.append("platform[]", p);
    if (description ?? caption) form.set("description", description ?? caption);
    if (firstComment) form.set("first_comment", firstComment);
    if (scheduledDate) form.set("scheduled_date", scheduledDate);
    for (const [k, v] of Object.entries(overrides ?? {})) form.set(k, v);
    return form;
  }

  /** Post a video: { video, title, user, platforms, ... } */
  async uploadVideo(opts) {
    const form = this.#baseForm(opts);
    form.set("video", await this.#fileBlob(opts.video), path.basename(opts.video));
    return this.#request("POST", "/api/upload", { form });
  }

  /** Post photos: { photos: string[], title, user, platforms, ... } */
  async uploadPhotos(opts) {
    const form = this.#baseForm(opts);
    for (const p of opts.photos) form.append("photos[]", await this.#fileBlob(p), path.basename(p));
    return this.#request("POST", "/api/upload_photos", { form });
  }

  /** Post text: { title, user, platforms, caption?, ... } */
  async uploadText(opts) {
    return this.#request("POST", "/api/upload_text", { form: this.#baseForm(opts) });
  }

  status(requestId) {
    return this.#request("GET", "/api/uploadposts/status", { params: { request_id: requestId } });
  }

  history(params = {}) {
    return this.#request("GET", "/api/uploadposts/history", { params });
  }

  scheduled() {
    return this.#request("GET", "/api/uploadposts/schedule");
  }

  cancelScheduled(requestId) {
    return this.#request("DELETE", "/api/uploadposts/schedule", { params: { request_id: requestId } });
  }

  analytics(profile, params = {}) {
    return this.#request("GET", `/api/analytics/${encodeURIComponent(profile)}`, { params });
  }

  me() {
    return this.#request("GET", "/api/uploadposts/me");
  }
}

export default SocialPost;
