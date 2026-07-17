// n8n community node: SocialPost — post to 22 social platforms in one step.
class SocialPost {
  constructor() {
    this.description = {
      displayName: "SocialPost",
      name: "socialPost",
      icon: "fa:paper-plane",
      group: ["output"],
      version: 1,
      subtitle: '={{$parameter["operation"]}}',
      description: "Post videos, photos and text to all social platforms with one API call",
      defaults: { name: "SocialPost" },
      inputs: ["main"],
      outputs: ["main"],
      credentials: [{ name: "socialPostApi", required: true }],
      properties: [
        {
          displayName: "Operation",
          name: "operation",
          type: "options",
          options: [
            { name: "Upload Text", value: "uploadText" },
            { name: "Upload Photos (URLs)", value: "uploadPhotos" },
            { name: "Upload Video (URL)", value: "uploadVideo" },
            { name: "Get Analytics", value: "analytics" },
            { name: "Get History", value: "history" },
          ],
          default: "uploadText",
        },
        { displayName: "Profile (user)", name: "user", type: "string", default: "" },
        {
          displayName: "Platforms",
          name: "platforms",
          type: "string",
          default: "linkedin,facebook",
          description: "Comma-separated platform ids (tiktok, instagram, youtube, linkedin, facebook, x, …)",
        },
        { displayName: "Title", name: "title", type: "string", default: "" },
        { displayName: "Description / Caption", name: "description", type: "string", default: "" },
        { displayName: "Scheduled Date (ISO-8601)", name: "scheduledDate", type: "string", default: "" },
      ],
    };
  }

  async execute() {
    const items = this.getInputData();
    const out = [];
    const creds = await this.getCredentials("socialPostApi");
    const base = String(creds.baseUrl).replace(/\/$/, "");

    for (let i = 0; i < items.length; i++) {
      const op = this.getNodeParameter("operation", i);
      const user = this.getNodeParameter("user", i);
      const platforms = String(this.getNodeParameter("platforms", i))
        .split(",").map((s) => s.trim()).filter(Boolean);

      let result;
      if (op === "analytics") {
        result = await this.helpers.httpRequest({
          url: `${base}/api/analytics/${encodeURIComponent(user)}`,
          headers: { Authorization: `Apikey ${creds.apiKey}` },
          json: true,
        });
      } else if (op === "history") {
        result = await this.helpers.httpRequest({
          url: `${base}/api/uploadposts/history`,
          headers: { Authorization: `Apikey ${creds.apiKey}` },
          json: true,
        });
      } else {
        const endpoint = op === "uploadText" ? "upload_text" : op === "uploadPhotos" ? "upload_photos" : "upload";
        const body = new URLSearchParams();
        body.set("title", this.getNodeParameter("title", i));
        body.set("user", user);
        const desc = this.getNodeParameter("description", i);
        if (desc) body.set("description", desc);
        const sched = this.getNodeParameter("scheduledDate", i);
        if (sched) body.set("scheduled_date", sched);
        for (const p of platforms) body.append("platform[]", p);
        result = await this.helpers.httpRequest({
          method: "POST",
          url: `${base}/api/${endpoint}`,
          headers: { Authorization: `Apikey ${creds.apiKey}` },
          body,
          json: true,
        });
      }
      out.push({ json: result });
    }
    return [out];
  }
}
module.exports = { SocialPost };
