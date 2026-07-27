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

  async #request(method, endpoint, { form, params, json } = {}) {
    const url = new URL(this.baseUrl + endpoint);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
    const headers = { Authorization: `Apikey ${this.apiKey}` };
    let body = form;
    if (json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    }
    const res = await fetch(url, { method, headers, body });
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

  /** Post a LinkedIn document (PDF/PPT/DOC): { document, title, user, platforms, ... } */
  async uploadDocument(opts) {
    const form = this.#baseForm(opts);
    form.set("document", await this.#fileBlob(opts.document), path.basename(opts.document));
    return this.#request("POST", "/api/uploadposts/upload-document", { form });
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

  /** Reschedule a scheduled post. scheduledDate is an ISO 8601 string. */
  editScheduled(requestId, scheduledDate) {
    return this.#request("PATCH", "/api/uploadposts/schedule", {
      json: { request_id: requestId, scheduled_date: scheduledDate },
    });
  }

  analytics(profile, params = {}) {
    return this.#request("GET", `/api/analytics/${encodeURIComponent(profile)}`, { params });
  }

  postAnalytics(requestId) {
    return this.#request("GET", `/api/uploadposts/post-analytics/${encodeURIComponent(requestId)}`);
  }

  me() {
    return this.#request("GET", "/api/uploadposts/me");
  }

  /** Metrics + constraints available per platform (public — no key required). */
  platformMetrics() {
    return this.#request("GET", "/api/uploadposts/platform-metrics");
  }

  /** Recently published media: { user?, platform? }. */
  media(params = {}) {
    return this.#request("GET", "/api/uploadposts/media", { params });
  }

  /** Facebook Pages the connected account can publish to (Facebook only). */
  pages(user, platform = "facebook") {
    return this.#request("GET", "/api/uploadposts/pages", { params: { user, platform } });
  }

  /** Comments on a published post (Facebook only). */
  comments(requestId, platform = "facebook") {
    return this.#request("GET", "/api/uploadposts/comments", { params: { request_id: requestId, platform } });
  }

  /** Reply to a comment on a published post (Facebook only). */
  replyToComment(requestId, commentId, message, platform = "facebook") {
    return this.#request("POST", "/api/uploadposts/comments", {
      json: { request_id: requestId, comment_id: commentId, message, platform },
    });
  }

  // -- queue ---------------------------------------------------------------

  /** Queue settings + a preview of the next slots for a profile. */
  queueSettings(user) {
    return this.#request("GET", "/api/uploadposts/queue/settings", { params: { user } });
  }

  /** Update queue settings: { user, timezone?, active_days?, slot_times?, max_per_slot? }. */
  updateQueueSettings(opts) {
    return this.#request("PUT", "/api/uploadposts/queue/settings", { json: opts });
  }

  /** Attach an existing draft/scheduled post to the next free queue slot. */
  addToQueue(requestId) {
    return this.#request("POST", "/api/uploadposts/add_to_queue", { json: { request_id: requestId } });
  }

  /** Upcoming queue slots (ISO strings) for a profile. */
  async previewQueue(user) {
    const res = await this.queueSettings(user);
    return res.next_slots ?? [];
  }

  /** The single next free queue slot (ISO string) for a profile, or null. */
  async nextSlot(user) {
    const slots = await this.previewQueue(user);
    return slots[0] ?? null;
  }

  // -- white-label connect JWTs --------------------------------------------

  /** Generate a shareable connect-link token for a profile. */
  generateJwt(username) {
    return this.#request("POST", "/api/uploadposts/users/generate-jwt", { json: { username } });
  }

  /** Validate a connect-link token (public — no key required). */
  validateJwt(token) {
    return this.#request("GET", "/api/uploadposts/users/validate-jwt", { params: { token } });
  }
}

/**
 * Parse a SocialPost webhook payload into a typed event. Set your account's
 * webhook URL in the dashboard; SocialPost then POSTs JSON to it. Currently the
 * only event is `post.completed`:
 *   { event: "post.completed", request_id, status, results }
 * @param {object|string} body - the parsed JSON object, or the raw JSON string
 * @returns {{ event: "post.completed", requestId: string, status: string, results: Record<string, any> }}
 */
export function parseWebhookEvent(body) {
  const payload = typeof body === "string" ? JSON.parse(body) : body;
  if (!payload || typeof payload !== "object" || typeof payload.event !== "string") {
    throw new Error("Not a SocialPost webhook payload");
  }
  if (payload.event !== "post.completed") {
    throw new Error(`Unknown webhook event: ${payload.event}`);
  }
  return {
    event: payload.event,
    requestId: payload.request_id,
    status: payload.status,
    results: payload.results ?? {},
  };
}

export default SocialPost;
