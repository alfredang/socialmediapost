// Real FFmpeg processing.
//
// The API deliberately does NOT accept a raw ffmpeg command string: passing
// caller-supplied text to a shell (or even to ffmpeg's own argv) would let
// anyone read or overwrite arbitrary files via `-i /etc/passwd` and friends.
// Instead callers pick a named operation and typed parameters, and this module
// builds the argv itself. ffmpeg is spawned with execFile — never a shell.

import { execFile } from "child_process";
import { promisify } from "util";
import { stat } from "fs/promises";

const exec = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export class FfmpegUnavailableError extends Error {
  constructor() {
    super(
      "FFmpeg is not installed on this server — install ffmpeg (or set FFMPEG_PATH) to enable processing."
    );
    this.name = "FfmpegUnavailableError";
  }
}

let available: boolean | null = null;

export async function ffmpegAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try {
    await exec(FFMPEG, ["-version"], { timeout: 10_000 });
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export interface VideoProbe {
  width: number;
  height: number;
  duration: number; // seconds; 0 when the container doesn't report one
}

// Reads a video's dimensions and duration. Returns null when ffprobe isn't
// installed or can't read the file — ffmpeg is optional in this app, so callers
// must degrade (skip an optional aspect ratio, skip a length check) rather than
// fail a publish over a missing binary. Never pass a caller-supplied path here:
// keys come from sanitizeStoredMedia, which is basename-only.
export async function probeVideo(absPath: string): Promise<VideoProbe | null> {
  try {
    const { stdout } = await exec(
      FFPROBE,
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration",
        "-of", "json",
        absPath,
      ],
      { timeout: 30_000 }
    );
    const data = JSON.parse(stdout);
    const width = Number(data.streams?.[0]?.width);
    const height = Number(data.streams?.[0]?.height);
    if (!width || !height) return null;
    const duration = Number(data.format?.duration);
    return { width, height, duration: Number.isFinite(duration) ? duration : 0 };
  } catch {
    return null;
  }
}

export const OPERATIONS = [
  "scale",
  "trim",
  "to_vertical",
  "extract_audio",
  "thumbnail",
  "transcode",
] as const;

export type Operation = (typeof OPERATIONS)[number];

export interface JobSpec {
  operation: Operation;
  params: Record<string, unknown>;
}

function num(params: Record<string, unknown>, key: string, min: number, max: number, fallback?: number): number {
  const raw = params[key];
  if (raw === undefined || raw === null || raw === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`"${key}" is required for this operation`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`"${key}" must be a number`);
  if (n < min || n > max) throw new Error(`"${key}" must be between ${min} and ${max}`);
  return n;
}

// Even/positive dimensions — most codecs reject odd ones.
function evenDim(n: number): number {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}

export interface BuiltJob {
  args: (input: string, output: string) => string[];
  outputExt: string;
}

// Maps an operation to its argv template + the extension of the file it emits.
export function buildJob(spec: JobSpec): BuiltJob {
  const p = spec.params ?? {};

  switch (spec.operation) {
    case "scale": {
      const width = evenDim(num(p, "width", 16, 7680));
      const height = evenDim(num(p, "height", 16, 7680));
      const fill = p.mode === "fill";
      // "fit" letterboxes to the exact box; "fill" crops the overflow.
      const vf = fill
        ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
        : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
      return {
        outputExt: "mp4",
        args: (i, o) => ["-i", i, "-vf", vf, "-c:a", "copy", "-y", o],
      };
    }

    case "trim": {
      const start = num(p, "start", 0, 86400, 0);
      const duration = num(p, "duration", 0.1, 86400);
      return {
        outputExt: "mp4",
        args: (i, o) => ["-ss", String(start), "-i", i, "-t", String(duration), "-c", "copy", "-y", o],
      };
    }

    case "to_vertical": {
      // 1080x1920 with the source centred over a blurred fill of itself.
      const vf =
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
      return {
        outputExt: "mp4",
        args: (i, o) => ["-i", i, "-vf", vf, "-c:a", "copy", "-y", o],
      };
    }

    case "extract_audio": {
      const bitrate = num(p, "bitrate_kbps", 32, 320, 192);
      return {
        outputExt: "mp3",
        args: (i, o) => ["-i", i, "-vn", "-b:a", `${Math.round(bitrate)}k`, "-y", o],
      };
    }

    case "thumbnail": {
      const at = num(p, "at", 0, 86400, 0);
      return {
        outputExt: "jpg",
        args: (i, o) => ["-ss", String(at), "-i", i, "-frames:v", "1", "-q:v", "2", "-y", o],
      };
    }

    case "transcode": {
      const format = p.format === "webm" ? "webm" : "mp4";
      return {
        outputExt: format,
        args: (i, o) =>
          format === "webm"
            ? ["-i", i, "-c:v", "libvpx-vp9", "-c:a", "libopus", "-y", o]
            : ["-i", i, "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-y", o],
      };
    }
  }
}

export interface RunResult {
  seconds: number;
  outputBytes: number;
}

// Runs the job. Throws FfmpegUnavailableError when the binary is missing and a
// plain Error carrying ffmpeg's own stderr tail when the encode fails — the
// caller surfaces both rather than reporting a success that never happened.
export async function runJob(
  spec: JobSpec,
  inputPath: string,
  outputPath: string,
  timeoutMs = 10 * 60_000
): Promise<RunResult> {
  if (!(await ffmpegAvailable())) throw new FfmpegUnavailableError();

  const job = buildJob(spec);
  const started = Date.now();
  try {
    await exec(FFMPEG, ["-nostdin", "-hide_banner", ...job.args(inputPath, outputPath)], {
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? "";
    const tail = stderr.trim().split("\n").slice(-4).join(" ").slice(0, 500);
    throw new Error(tail ? `FFmpeg failed: ${tail}` : "FFmpeg failed to process the media");
  }

  const seconds = (Date.now() - started) / 1000;
  const { size } = await stat(outputPath);
  if (size === 0) throw new Error("FFmpeg produced an empty output file");
  return { seconds, outputBytes: size };
}
