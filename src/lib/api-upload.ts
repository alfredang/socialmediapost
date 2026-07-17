import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";
import { authenticateApiKey, checkUploadQuota, logApiRequest } from "./apikey";
import { saveUploadedFile, StoredFile } from "./upload";
import { createPost, publishPost } from "./publish";
import { platformsForType, PostType, PLATFORM_MAP } from "./platforms";
import { generateCopy } from "./ai";

function fields(form: FormData, name: string): string[] {
  // Accept platform[] repeated fields and single comma-separated values
  const values = [...form.getAll(name), ...form.getAll(name.replace("[]", ""))]
    .filter((v): v is string => typeof v === "string")
    .flatMap((v) => v.split(",").map((s) => s.trim()))
    .filter(Boolean);
  return [...new Set(values)];
}

function text(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.replace(/^"|"$/g, "") : "";
}

export function makeUploadHandler(opts: {
  type: PostType;
  fileFields: string[]; // which multipart fields carry media
  requireMedia: boolean;
}) {
  return async function handler(req: NextRequest) {
    const auth = await authenticateApiKey(req);
    if (auth instanceof NextResponse) return auth;
    const { accountId } = auth;

    const respond = async (body: object, status: number) => {
      await logApiRequest(accountId, req, status);
      return NextResponse.json(body, { status });
    };

    const quotaError = await checkUploadQuota(accountId);
    if (quotaError) {
      await logApiRequest(accountId, req, 429);
      return quotaError;
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return respond({ success: false, error: "Expected multipart/form-data body" }, 400);
    }

    const userName = text(form, "user");
    if (!userName) return respond({ success: false, error: "Missing required field: user" }, 400);

    const profile = await db.profile.findUnique({
      where: { accountId_name: { accountId, name: userName } },
      include: { socialAccounts: true },
    });
    if (!profile) {
      return respond(
        { success: false, error: `Profile "${userName}" not found. Create it in User Management first.` },
        404
      );
    }

    const platforms = fields(form, "platform[]");
    if (platforms.length === 0) {
      return respond({ success: false, error: "Provide at least one platform[] field" }, 400);
    }
    const allowed = new Set(platformsForType(opts.type).map((p) => p.id));
    const unknown = platforms.filter((p) => !PLATFORM_MAP[p]);
    if (unknown.length) {
      return respond({ success: false, error: `Unknown platform(s): ${unknown.join(", ")}` }, 400);
    }
    const unsupported = platforms.filter((p) => !allowed.has(p));
    if (unsupported.length) {
      return respond(
        { success: false, error: `${unsupported.join(", ")} do(es) not support ${opts.type} posts` },
        400
      );
    }

    // Save media
    const media: StoredFile[] = [];
    for (const field of opts.fileFields) {
      for (const item of [...form.getAll(field), ...form.getAll(field.replace("[]", ""))]) {
        if (item instanceof File && item.size > 0) media.push(await saveUploadedFile(item));
      }
    }
    if (opts.requireMedia && media.length === 0) {
      return respond(
        { success: false, error: `Missing media. Attach ${opts.fileFields[0]} as a file field.` },
        400
      );
    }

    let title = text(form, "title");
    let description = text(form, "description") || text(form, "caption");
    const firstComment = text(form, "first_comment");

    // autogenerate=true → AI title/description
    if (text(form, "autogenerate") === "true") {
      const copy = await generateCopy({ title: title || media[0]?.name || "New post", description });
      title = title || copy.title;
      description = description || `${copy.description}\n${copy.hashtags.join(" ")}`;
    }
    if (!title && !description) {
      return respond({ success: false, error: "Missing required field: title" }, 400);
    }

    // Per-platform overrides: instagram_title, youtube_description, ...
    const overrides: Record<string, string> = {};
    for (const p of platforms) {
      for (const suffix of ["title", "description"]) {
        const v = text(form, `${p}_${suffix}`);
        if (v) overrides[`${p}_${suffix}`] = v;
      }
    }

    const scheduledRaw = text(form, "scheduled_date") || text(form, "scheduled_at");
    let scheduledAt: Date | null = null;
    if (scheduledRaw) {
      scheduledAt = new Date(scheduledRaw);
      if (isNaN(scheduledAt.getTime())) {
        return respond({ success: false, error: "Invalid scheduled_date. Use ISO-8601 (e.g. 2026-08-01T09:00:00+08:00)" }, 400);
      }
    }

    const { post, deduped } = await createPost({
      profileId: profile.id,
      type: opts.type,
      title,
      description,
      firstComment,
      overrides,
      platforms,
      media,
      scheduledAt,
      source: "api",
      idempotencyKey: req.headers.get("idempotency-key"),
    });

    if (deduped) {
      return respond({ success: true, request_id: post.requestId, deduped: true, message: "Duplicate request (Idempotency-Key already processed)" }, 200);
    }

    if (scheduledAt) {
      return respond(
        {
          success: true,
          request_id: post.requestId,
          status: "scheduled",
          scheduled_date: scheduledAt.toISOString(),
          platforms,
          message: `Post scheduled for ${scheduledAt.toISOString()}`,
        },
        200
      );
    }

    const result = await publishPost(post.id);
    return respond(
      {
        success: result.status !== "failed",
        request_id: post.requestId,
        status: result.status,
        results: Object.fromEntries(
          result.results.map((r) => [
            r.platform,
            r.success ? { success: true, url: r.url } : { success: false, error: r.error },
          ])
        ),
      },
      result.status === "failed" ? 422 : 200
    );
  };
}
