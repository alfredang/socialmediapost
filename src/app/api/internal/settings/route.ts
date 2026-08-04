import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/internal-auth";
import { applySettingsToEnv, SETTING_KEYS, saveSetting, settingsStatus } from "@/lib/settings";
import { sendMail } from "@/lib/mail";
import { appBaseUrl } from "@/lib/base-url";

// GET — current configuration state. Secret VALUES are never returned; the
// client only learns whether each one is set and where it came from.
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ success: true, settings: await settingsStatus() });
}

// PATCH — save one or more settings. Body: { settings: { KEY: "value" } }.
// An omitted key is left untouched; an empty string clears it.
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const incoming = body?.settings;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ success: false, error: "Expected a settings object" }, { status: 400 });
  }

  const unknown = Object.keys(incoming).filter((k) => !SETTING_KEYS.includes(k));
  if (unknown.length) {
    return NextResponse.json(
      { success: false, error: `Unknown setting(s): ${unknown.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    for (const [key, value] of Object.entries(incoming)) {
      if (typeof value !== "string") continue;
      await saveSetting(key, value, auth);
    }
  } catch (err) {
    // Most likely SESSION_SECRET missing, which makes secrets unstorable.
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Could not save settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, settings: await settingsStatus() });
}

// POST — send a test email to the signed-in admin using the saved SMTP config,
// so a wrong host or password surfaces here instead of silently breaking
// sign-in for real users.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "test-email") {
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ success: false, error: "Enter a valid email address" }, { status: 400 });
  }

  // Pull DB-backed settings into the environment first — mail.ts reads
  // process.env directly.
  await applySettingsToEnv();

  const base = appBaseUrl(req.nextUrl.origin);
  try {
    await sendMail(
      to,
      "SocialPost test email",
      `Your SocialPost SMTP settings are working.\n\nSent from ${base}`,
      `<p>Your SocialPost SMTP settings are working.</p><p>Sent from ${base}</p>`
    );
    return NextResponse.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Send failed" },
      { status: 502 }
    );
  }
}
