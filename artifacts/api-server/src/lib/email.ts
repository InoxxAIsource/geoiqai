import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const APP_URL = process.env.APP_URL ?? "https://geoscore.app";
const FROM = "GeoIQ <hello@geoscore.app>";

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch {
    // Email failures are non-fatal
  }
}

function header() {
  return `<div style="background:#4F46E5;padding:24px 32px;border-radius:10px 10px 0 0;"><span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.5px;">GeoIQ</span></div>`;
}

function wrap(inner: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111827;">${header()}<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">${inner}<p style="color:#9ca3af;font-size:12px;margin-top:32px;line-height:1.6;">GeoIQ - AI Visibility Platform</p></div></div>`;
}

export async function sendWelcomeEmail(email: string): Promise<void> {
  await send(email, "Welcome to GeoIQ - your AI visibility audit is ready", wrap(`
    <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">You're in.</h1>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px;">
      Your account is ready. Check how ChatGPT, Gemini, Perplexity, Claude, and Grok see your brand right now.
    </p>
    <a href="${APP_URL}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Run your first audit
    </a>
  `));
}

export async function sendMagicLinkEmail(email: string, magicUrl: string): Promise<void> {
  await send(email, "Your GeoIQ login link", wrap(`
    <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">Sign in to GeoIQ</h1>
    <p style="color:#374151;line-height:1.6;margin:0 0 8px;">
      Click the button below to sign in. This link expires in 15 minutes and can only be used once.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:0 0 24px;">If you did not request this, ignore this email.</p>
    <a href="${magicUrl}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Sign in to dashboard
    </a>
  `));
}

export async function sendSubscriberReport(email: string, domain: string, score: number, auditId: string, recommendations: Record<string, unknown>[]): Promise<void> {
  const scoreColor = score < 34 ? "#ef4444" : score < 67 ? "#f59e0b" : "#10b981";
  const firstRec = recommendations[0];
  const recHtml = firstRec
    ? `<div style="background:#f0f4ff;border:0.5px solid #c7d2fe;border-radius:8px;padding:16px;margin-top:20px;"><div style="font-size:11px;font-weight:700;color:#4F46E5;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Top recommendation</div><div style="font-size:13px;color:#111827;line-height:1.5;">${String(firstRec.action ?? "")}</div></div>`
    : "";
  await send(email, `Your GeoIQ report: ${domain} scored ${score}/100`, wrap(`
    <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">Your AI visibility report: ${domain}</h1>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;text-align:center;">
      <div style="font-size:48px;font-weight:800;color:${scoreColor};line-height:1;">${score}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">GEO IQ Score out of 100</div>
    </div>
    ${recHtml}
    <p style="color:#374151;line-height:1.6;margin-top:20px;">Your full report with AI engine breakdown and action plan is ready to view online.</p>
    <a href="${APP_URL}/audit?id=${auditId}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px;">
      View full report
    </a>
  `));
}

export async function sendAuditCompleteEmail(email: string, domain: string, score: number, auditId: string): Promise<void> {
  await sendSubscriberReport(email, domain, score, auditId, []);
}
