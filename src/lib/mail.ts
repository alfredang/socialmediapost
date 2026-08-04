import nodemailer from "nodemailer";

// Auth email delivery. Providers, in priority order:
//   1. Brevo HTTP API  — set BREVO_API_KEY (+ MAIL_FROM with a verified sender)
//   2. SMTP            — set SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS,
//                        SMTP_SECURE ("true" for 465)
//   3. Neither set     — dev mode: request-otp returns the code in the response.
// MAIL_FROM (or legacy SMTP_FROM) formats the sender: `Name <email@domain>`.

export function emailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY || process.env.SMTP_HOST);
}

function sender(): { name: string; email: string } {
  const raw = process.env.MAIL_FROM || process.env.SMTP_FROM || "";
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || "SocialPost", email: m[2].trim() };
  if (raw.includes("@")) return { name: "SocialPost", email: raw.trim() };
  return { name: "SocialPost", email: process.env.SMTP_USER ?? "no-reply@socialpost.local" };
}

function otpTemplate(code: string, magicLink: string) {
  return {
    subject: `${code} is your SocialPost sign-in code`,
    text: [
      `Your SocialPost sign-in code is: ${code}`,
      "",
      `Or sign in with one click: ${magicLink}`,
      "",
      "The code and link expire in 10 minutes. If you didn't request this, you can ignore this email.",
    ].join("\n"),
    html: `
<div style="margin:0 auto;max-width:480px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;padding:32px 24px">
  <div style="text-align:center;margin-bottom:24px">
    <span style="display:inline-block;background:#059669;color:#fff;font-weight:800;font-size:18px;border-radius:12px;padding:10px 16px">SocialPost</span>
  </div>
  <h1 style="font-size:20px;text-align:center;margin:0 0 8px">Your sign-in code</h1>
  <p style="font-size:14px;color:#475569;text-align:center;margin:0 0 24px">
    Enter this code on the sign-in page. It expires in 10 minutes.
  </p>
  <div style="text-align:center;margin-bottom:24px">
    <span style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 28px;font-size:32px;font-weight:800;letter-spacing:0.35em;color:#059669">${code}</span>
  </div>
  <div style="text-align:center;margin-bottom:24px">
    <a href="${magicLink}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;padding:12px 24px">Or sign in with one click</a>
  </div>
  <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">
    If you didn't request this, you can safely ignore this email.
  </p>
</div>`,
  };
}

async function sendViaBrevo(to: string, subject: string, text: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Brevo: ${data.message ?? res.statusText}`);
  }
}

async function sendViaSmtp(to: string, subject: string, text: string, html: string) {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const from = sender();
  await nodemailer
    .createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
    .sendMail({ from: `"${from.name}" <${from.email}>`, to, subject, text, html });
}

export async function sendOtpEmail(to: string, code: string, magicLink: string) {
  const { subject, text, html } = otpTemplate(code, magicLink);
  return sendMail(to, subject, text, html);
}

// Generic send over whichever transport is configured, same priority as above.
// Used by the admin settings page to verify SMTP credentials before real
// sign-in traffic depends on them.
export async function sendMail(to: string, subject: string, text: string, html: string) {
  if (!emailConfigured()) {
    throw new Error("No email transport configured — set SMTP_HOST or BREVO_API_KEY");
  }
  if (process.env.BREVO_API_KEY) return sendViaBrevo(to, subject, text, html);
  return sendViaSmtp(to, subject, text, html);
}
