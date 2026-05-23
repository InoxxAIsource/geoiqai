const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = "GeoIQ <hello@geoiqai.com>";
const APP_URL = process.env.APP_URL ?? "https://geoiqai.com";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

export async function sendWelcomeEmail(email: string, domain: string): Promise<void> {
  const html = `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h2 style="color:#534AB7;font-size:22px;font-weight:500;margin-bottom:8px">Welcome to GeoIQ</h2>
  <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px">
    We are now monitoring <strong>${domain}</strong> across ChatGPT, Gemini, Perplexity, and Bing Copilot every day.
  </p>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px">
    <p style="font-size:13px;color:#374151;margin:0 0 12px"><strong>What happens next:</strong></p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px">&#x2713; First full audit runs tonight</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px">&#x2713; Your weekly digest arrives every Monday morning</p>
    <p style="font-size:13px;color:#6b7280;margin:0">&#x2713; Instant alerts if a competitor appears in a new AI system</p>
  </div>
  <a href="${APP_URL}/dashboard" style="display:block;background:#534AB7;color:white;text-decoration:none;text-align:center;padding:14px;border-radius:8px;font-size:14px;font-weight:500">
    Go to your dashboard →
  </a>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px;text-align:center">GeoIQ · Built for founders in India</p>
</div>`;

  await sendEmail(email, "Welcome to GeoIQ — let's boost your score", html);
}

export async function sendWeeklyDigest(
  email: string,
  domain: string,
  currentScore: number,
  lastScore: number,
  aiStatus: { chatgpt: boolean; gemini: boolean; perplexity: boolean },
  topRecommendations: Array<{ action: string }>,
): Promise<void> {
  const scoreChange = currentScore - lastScore;
  const changeText = scoreChange >= 0 ? `↑ ${scoreChange} points` : `↓ ${Math.abs(scoreChange)} points`;
  const changeColor = scoreChange >= 0 ? "#1D9E75" : "#E24B4A";
  const week = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const recoHtml = topRecommendations
    .slice(0, 3)
    .map(
      (r, i) => `
    <div style="padding:10px 0;border-bottom:0.5px solid #e5e7eb">
      <span style="font-size:11px;color:#6b7280">#${i + 1}</span>
      <p style="font-size:13px;color:#374151;margin:4px 0 0">${r.action}</p>
    </div>`,
    )
    .join("");

  const html = `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;color:#6b7280;margin-bottom:4px">Weekly report for</p>
  <h2 style="font-size:20px;font-weight:500;margin-bottom:24px">${domain}</h2>
  <div style="background:#f9fafb;border-radius:12px;padding:16px;text-align:center;margin-bottom:24px">
    <p style="font-size:11px;color:#6b7280;margin-bottom:8px">Week of ${week}</p>
    <p style="font-size:32px;font-weight:500;color:#1a1a1a;margin:0">${currentScore}</p>
    <p style="font-size:12px;color:${changeColor};margin-top:4px">${changeText}</p>
  </div>
  <p style="font-size:13px;font-weight:500;margin-bottom:12px">AI system status</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="font-size:13px;margin:0 0 8px">ChatGPT: ${aiStatus.chatgpt ? "&#x2713; Visible" : "&#x2717; Invisible"}</p>
    <p style="font-size:13px;margin:0 0 8px">Gemini: ${aiStatus.gemini ? "&#x2713; Visible" : "&#x2717; Invisible"}</p>
    <p style="font-size:13px;margin:0">Perplexity: ${aiStatus.perplexity ? "&#x2713; Visible" : "&#x2717; Invisible"}</p>
  </div>
  <p style="font-size:13px;font-weight:500;margin-bottom:12px">Top fix actions this week</p>
  ${recoHtml}
  <a href="${APP_URL}/dashboard" style="display:block;background:#534AB7;color:white;text-decoration:none;text-align:center;padding:14px;border-radius:8px;font-size:14px;margin-top:24px">
    View full dashboard →
  </a>
  <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:24px">
    <a href="${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#9ca3af">Unsubscribe</a>
  </p>
</div>`;

  await sendEmail(
    email,
    `Your GEO IQ report — ${domain}`,
    html,
  );
}

export async function sendSubscribeConfirmation(email: string, domain?: string): Promise<void> {
  const html = `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h2 style="font-size:20px;font-weight:500;margin-bottom:8px">You are on the list</h2>
  <p style="color:#6b7280;font-size:14px;line-height:1.6;margin-bottom:24px">
    Your free weekly AI visibility digest${domain ? ` for <strong>${domain}</strong>` : ""} will arrive every Monday.
    We will track ChatGPT, Gemini, and Perplexity and send you the score changes each week.
  </p>
  <a href="${APP_URL}/pricing" style="display:block;background:#534AB7;color:white;text-decoration:none;text-align:center;padding:14px;border-radius:8px;font-size:14px;font-weight:500">
    Upgrade for daily monitoring →
  </a>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px;text-align:center">GeoIQ · Built for founders in India</p>
</div>`;

  await sendEmail(email, `Your GeoIQ report for ${domain ?? "your domain"} — check your score inside`, html);
}
