import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { getPlan } from "@/lib/plans";
import { signMediaPath } from "@/lib/media-url";
import {
  OPERATIONS,
  Operation,
  FfmpegUnavailableError,
  buildJob,
  ffmpegAvailable,
  runJob,
} from "@/lib/ffmpeg";
import {
  downloadToUploads,
  newUploadKey,
  saveUploadedFile,
  uploadPath,
} from "@/lib/upload";

// POST /api/uploadposts/ffmpeg/job — runs a real FFmpeg job.
//
// Two ways to send the input:
//   multipart/form-data  file=<binary> operation=<name> params=<json>
//   application/json     { media_url, operation, params }
//
// Quota is charged on measured processing time, so it reflects work actually
// done. A missing ffmpeg binary is a 503, never a fake "completed".
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  if (!(await ffmpegAvailable())) {
    return NextResponse.json(
      { success: false, error: new FfmpegUnavailableError().message },
      { status: 503 }
    );
  }

  // ── Quota check ───────────────────────────────────────────────────────────
  // Runs BEFORE the input is read, because reading a media_url makes the server
  // issue an outbound request on the caller's behalf. With the check after the
  // download, a caller who was already over quota could still drive unlimited
  // fetches — every rejected job was a free request.
  const account = await db.account.findUnique({ where: { id: auth.accountId } });
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found" }, { status: 401 });
  }
  const plan = getPlan(account.plan);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const used = await db.ffmpegJob.aggregate({
    where: { accountId: auth.accountId, createdAt: { gte: monthStart } },
    _sum: { minutes: true },
  });
  const usedMinutes = used._sum.minutes ?? 0;
  if (usedMinutes >= plan.ffmpegMinutes) {
    return NextResponse.json(
      { success: false, error: `FFmpeg quota exceeded (${plan.ffmpegMinutes} min/month on ${plan.name})` },
      { status: 429 }
    );
  }

  // ── Parse the request into { operation, params, inputKey } ────────────────
  let operation: string;
  let params: Record<string, unknown>;
  let inputKey: string;

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: "Attach the media as the \"file\" field" },
          { status: 400 }
        );
      }
      operation = String(form.get("operation") ?? "");
      const rawParams = form.get("params");
      params = rawParams ? JSON.parse(String(rawParams)) : {};
      const stored = await saveUploadedFile(file);
      inputKey = stored.path;
    } else {
      const body = await req.json().catch(() => ({}));
      operation = String(body.operation ?? "");
      params = (body.params ?? {}) as Record<string, unknown>;
      const mediaUrl = String(body.media_url ?? "");
      if (!/^https?:\/\//i.test(mediaUrl)) {
        return NextResponse.json(
          { success: false, error: "Provide media_url (http/https) or post the file as multipart/form-data" },
          { status: 400 }
        );
      }
      const inputExt = path.extname(new URL(mediaUrl).pathname) || ".mp4";
      inputKey = await downloadToUploads(mediaUrl, inputExt);
    }
  } catch (err) {
    // BlockedUrlError messages are safe to return (they name the caller's own
    // URL, never an upstream response); everything else is already generic.
    const message = err instanceof Error ? err.message : "Could not read the request";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  if (!OPERATIONS.includes(operation as Operation)) {
    return NextResponse.json(
      { success: false, error: `Unknown operation "${operation}". Supported: ${OPERATIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate the parameters before charging any quota.
  let outputExt: string;
  try {
    outputExt = buildJob({ operation: operation as Operation, params }).outputExt;
  } catch (err) {
    await unlink(uploadPath(inputKey)).catch(() => {});
    const message = err instanceof Error ? err.message : "Invalid parameters";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  // ── Run it ────────────────────────────────────────────────────────────────
  const outputKey = newUploadKey(outputExt);
  const remainingMs = Math.max(0, plan.ffmpegMinutes - usedMinutes) * 60_000;
  try {
    const { seconds, outputBytes } = await runJob(
      { operation: operation as Operation, params },
      uploadPath(inputKey),
      uploadPath(outputKey),
      Math.min(remainingMs, 10 * 60_000)
    );

    const minutes = Math.max(0.1, Math.round((seconds / 60) * 100) / 100);
    const job = await db.ffmpegJob.create({
      data: {
        accountId: auth.accountId,
        command: `${operation} ${JSON.stringify(params)}`.slice(0, 500),
        minutes,
      },
    });

    return NextResponse.json({
      success: true,
      job_id: job.id,
      status: "completed",
      operation,
      minutes_charged: minutes,
      // Signed: /api/media rejects an unsigned or expired request.
      output_url: `/api/media/${signMediaPath(outputKey)}`,
      output_bytes: outputBytes,
    });
  } catch (err) {
    await unlink(uploadPath(outputKey)).catch(() => {});
    if (err instanceof FfmpegUnavailableError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "FFmpeg processing failed";
    return NextResponse.json({ success: false, status: "failed", error: message }, { status: 422 });
  } finally {
    await unlink(uploadPath(inputKey)).catch(() => {});
  }
}
