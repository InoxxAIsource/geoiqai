import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const APP_URL = process.env.APP_URL ?? "https://geoscore.app";
const FROM = "GeoIQ <hello@geoscore.app>";

export async function sendWelcomeEmail(email: string): Promise<void> {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Welcome to GeoIQ - your AI visibility audit is ready",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
          <div style="background:#4F46E5;padding:24px 32px;border-radius:10px 10px 0 0;">
            <span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.5px;">GeoIQ</span>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
            <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">You're in.</h1>
            <p style="color:#374151;line-height:1.6;margin:0 0 16px;">
              Your account is ready. You get 5 free AI visibility checks to start - use them on your own brand, a competitor, or anything you're curious about.
            </p>
            <p style="color:#374151;line-height:1.6;margin:0 0 24px;">
              GeoIQ checks how ChatGPT, Gemini, Perplexity, Claude, and Grok see your brand right now - both from their training data and from the live web.
            </p>
            <a href="${APP_URL}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
              Run your first audit
            </a>
            <p style="color:#9ca3af;font-size:12px;margin-top:32px;line-height:1.6;">
              If you did not create this account, ignore this email.<br>
              GeoIQ, helping founders track AI visibility.
            </p>
          </div>
        </div>
      `,
    });
  } catch {
    // Email failures are non-fatal - audit still works
  }
}

export async function sendAuditCompleteEmail(email: string, domain: string, score: number, auditId: string): Promise<void> {
  if (!resend) return;
  const scoreColor = score < 34 ? "#ef4444" : score < 67 ? "#f59e0b" : "#10b981";
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `GeoIQ audit ready: ${domain} scored ${score}/100`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
          <div style="background:#4F46E5;padding:24px 32px;border-radius:10px 10px 0 0;">
            <span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.5px;">GeoIQ</span>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
            <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">Audit complete: ${domain}</h1>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
              <div style="font-size:48px;font-weight:800;color:${scoreColor};line-height:1;">${score}</div>
              <div style="font-size:13px;color:#6b7280;margin-top:4px;">GEO IQ Score out of 100</div>
            </div>
            <p style="color:#374151;line-height:1.6;margin:0 0 24px;">
              Your full report including AI engine breakdown, competitor analysis, and a prioritized action plan is ready to view.
            </p>
            <a href="${APP_URL}/audit?id=${auditId}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
              View full report
            </a>
          </div>
        </div>
      `,
    });
  } catch {
    // Non-fatal
  }
}
