const LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="180" rx="36" fill="#4F46E5"/>
  <rect x="26" y="118" width="34" height="42" rx="8" fill="white" opacity="0.65"/>
  <rect x="73" y="82" width="34" height="78" rx="8" fill="white" opacity="0.82"/>
  <rect x="120" y="46" width="34" height="114" rx="8" fill="white"/>
  <circle cx="137" cy="28" r="16" fill="#A5B4FC"/>
  <circle cx="137" cy="28" r="9" fill="#4F46E5"/>
</svg>`;

interface SsrPageOptions {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  schemaJson: object[];
  body: string;
  readingTime?: number;
}

function sharedCss(): string {
  return `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;color:#111827}
    body{background:#FAFAFA;min-height:100vh;display:flex;flex-direction:column}
    a{color:#4F46E5;text-decoration:none}
    a:hover{text-decoration:underline}
    .ssr-nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border-bottom:1px solid #F3F4F6}
    .ssr-nav-inner{max-width:1200px;margin:0 auto;padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .ssr-nav-logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:#111827;font-size:18px;font-weight:700;letter-spacing:-0.03em;font-family:'Syne',sans-serif}
    .ssr-nav-links{display:flex;align-items:center;gap:28px}
    .ssr-nav-links a{font-size:14px;font-weight:500;color:#374151;text-decoration:none}
    .ssr-nav-links a:hover{color:#4F46E5}
    .ssr-nav-actions{display:flex;align-items:center;gap:12px}
    .ssr-btn-ghost{font-size:14px;font-weight:500;color:#374151;text-decoration:none;padding:6px 12px}
    .ssr-btn-primary{font-size:14px;font-weight:600;color:white;background:#4F46E5;border-radius:8px;padding:8px 18px;text-decoration:none}
    .ssr-btn-primary:hover{background:#4338CA;text-decoration:none}
    .ssr-main{flex:1;max-width:800px;margin:0 auto;padding:48px 20px 80px;width:100%}
    .ssr-footer{background:#111827;color:white;padding:64px 24px 32px}
    .ssr-footer-inner{max-width:1200px;margin:0 auto}
    .ssr-footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:32px;margin-bottom:32px}
    .ssr-footer-brand{font-size:20px;font-weight:700;color:white;margin-bottom:12px;letter-spacing:-0.03em}
    .ssr-footer-tagline{font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;max-width:220px}
    .ssr-footer-heading{font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px}
    .ssr-footer a{display:block;margin-bottom:10px;font-size:14px;color:rgba(255,255,255,0.6);text-decoration:none}
    .ssr-footer a:hover{color:white;text-decoration:none}
    .ssr-footer-bottom{border-top:1px solid rgba(255,255,255,0.1);padding-top:32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
    .ssr-footer-copy{font-size:13px;color:rgba(255,255,255,0.4)}
    .ssr-footer-social{display:flex;align-items:center;gap:16px}
    .ssr-footer-social a{font-size:13px;color:rgba(255,255,255,0.4);text-decoration:none}
    .ssr-footer-social a:hover{color:white}
    .breadcrumb{display:flex;gap:6px;align-items:center;margin-bottom:28px;font-size:13px;color:#6B7280}
    .breadcrumb a{color:#6B7280;text-decoration:none}
    .breadcrumb a:hover{color:#374151}
    .summary-box{background:#EEF2FF;border-left:4px solid #4F46E5;border-radius:0 12px 12px 0;padding:20px 24px;margin:28px 0 36px}
    .summary-box-label{font-size:12px;font-weight:700;color:#4F46E5;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px}
    .summary-box p{font-size:15px;color:#1E1B4B;line-height:1.7;margin:0}
    .reading-meta{display:flex;align-items:center;gap:16px;font-size:13px;color:#6B7280;margin-bottom:24px;flex-wrap:wrap}
    .reading-meta span{display:flex;align-items:center;gap:4px}
    .tag-pill{display:inline-block;background:#EEF2FF;color:#4F46E5;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin-bottom:16px;letter-spacing:0.04em}
    h1{font-size:32px;font-weight:800;font-family:'Syne',sans-serif;color:#111827;line-height:1.2;margin-bottom:16px}
    h2{font-size:22px;font-weight:700;font-family:'Syne',sans-serif;color:#111827;margin-bottom:14px;margin-top:40px;line-height:1.3}
    h3{font-size:17px;font-weight:700;color:#1E1B4B;margin-bottom:10px;margin-top:24px;font-family:'Syne',sans-serif}
    p{font-size:16px;color:#374151;line-height:1.85;margin-bottom:18px}
    ul,ol{margin-bottom:18px;padding-left:0;list-style:none}
    li{font-size:15px;color:#374151;line-height:1.7;margin-bottom:8px;padding-left:20px;position:relative}
    li::before{content:"";position:absolute;left:0;top:9px;width:6px;height:6px;background:#4F46E5;border-radius:50%}
    .check-list li::before{content:"✓";background:none;color:#10B981;font-weight:700;font-size:14px;top:1px}
    .no-bullet li::before{display:none;padding-left:0}
    .no-bullet li{padding-left:0}
    table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px}
    th{background:#F3F4F6;padding:12px 16px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #E5E7EB}
    td{padding:12px 16px;border-bottom:1px solid #F3F4F6;color:#374151;vertical-align:top}
    tr:nth-child(even) td{background:#FAFAFA}
    .cta-box{background:linear-gradient(135deg,#4F46E5 0%,#0891B2 100%);border-radius:14px;padding:32px 28px;text-align:center;margin:48px 0}
    .cta-box h3{color:white;font-size:20px;font-family:'Syne',sans-serif;margin-bottom:10px;margin-top:0}
    .cta-box p{color:rgba(255,255,255,0.85);font-size:15px;margin-bottom:22px}
    .cta-btn{display:inline-block;background:white;color:#4F46E5;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;font-family:'Syne',sans-serif}
    .cta-btn:hover{background:#F5F3FF;text-decoration:none}
    .faq-item{border-bottom:1px solid #F3F4F6;padding:20px 0}
    .faq-q{font-size:16px;font-weight:600;color:#111827;margin-bottom:10px;line-height:1.4}
    .faq-a{font-size:15px;color:#374151;line-height:1.7}
    .checklist-section{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:24px 28px;margin:24px 0}
    .checklist-section h3{color:#111827;margin-top:0;margin-bottom:16px;font-size:16px}
    .check-item{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:14px;color:#374151;line-height:1.5}
    .check-item::before{content:"";width:16px;height:16px;border:2px solid #D1D5DB;border-radius:4px;flex-shrink:0;margin-top:2px}
    .comparison-table th:first-child{width:40%}
    .yes-cell{color:#10B981;font-weight:600}
    .no-cell{color:#EF4444;font-weight:600}
    .partial-cell{color:#F59E0B;font-weight:600}
    .divider{height:1px;background:#E5E7EB;margin:40px 0}
    .related-links{border-top:1px solid #E5E7EB;padding-top:32px;margin-top:40px}
    .related-links .rel-heading{font-size:14px;font-weight:600;color:#6B7280;margin-bottom:16px;letter-spacing:0.05em}
    .related-links a{display:flex;align-items:center;gap:6px;color:#4F46E5;font-size:15px;text-decoration:none;margin-bottom:10px}
    .related-links a:hover{text-decoration:underline}
    @media(max-width:768px){
      .ssr-nav-links{display:none}
      .ssr-footer-grid{grid-template-columns:1fr 1fr}
      h1{font-size:26px}
      h2{font-size:19px}
      .ssr-main{padding:32px 16px 64px}
    }
  `;
}

function ssrNavbar(): string {
  return `
  <nav class="ssr-nav">
    <div class="ssr-nav-inner">
      <a href="/" class="ssr-nav-logo">
        ${LOGO_SVG}
        GeoIQ
      </a>
      <div class="ssr-nav-links">
        <a href="/#how-it-works">How it works</a>
        <a href="/pricing">Pricing</a>
        <a href="/blog">Blog</a>
        <a href="/what-is-geo">What is GEO</a>
      </div>
      <div class="ssr-nav-actions">
        <a href="/login" class="ssr-btn-ghost">Sign in</a>
        <a href="/" class="ssr-btn-primary">Sign up free</a>
      </div>
    </div>
  </nav>`;
}

function ssrFooter(): string {
  return `
  <footer class="ssr-footer">
    <div class="ssr-footer-inner">
      <div class="ssr-footer-grid">
        <div>
          <div class="ssr-footer-brand">GeoIQ</div>
          <p class="ssr-footer-tagline">The command center for your brand's AI visibility.</p>
        </div>
        <div>
          <div class="ssr-footer-heading">Product</div>
          <a href="/#how-it-works">How it works</a>
          <a href="/pricing">Pricing</a>
          <a href="/">Free audit</a>
          <a href="/dashboard">Dashboard</a>
        </div>
        <div>
          <div class="ssr-footer-heading">Resources</div>
          <a href="/what-is-geo">What is GEO</a>
          <a href="/how-to-rank-in-chatgpt">How to rank in ChatGPT</a>
          <a href="/geo-tools">GEO Tools 2026</a>
          <a href="/blog">Blog</a>
        </div>
        <div>
          <div class="ssr-footer-heading">Legal</div>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/contact">Contact</a>
        </div>
      </div>
      <div class="ssr-footer-bottom">
        <span class="ssr-footer-copy">© 2026 GeoIQ. All rights reserved.</span>
        <div class="ssr-footer-social">
          <a href="https://twitter.com/BeingtauheedTk" target="_blank" rel="noopener noreferrer">Twitter / X</a>
          <a href="https://www.instagram.com/geoiqai" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://www.linkedin.com/company/geoiqai" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </div>
    </div>
  </footer>`;
}

export function ssrHtmlShell(opts: SsrPageOptions): string {
  const { title, description, canonical, ogTitle, ogDescription, schemaJson, body, readingTime } = opts;
  const schemaBlock = schemaJson.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />
  <link rel="canonical" href="${escHtml(canonical)}" />
  <meta property="og:title" content="${escHtml(ogTitle ?? title)}" />
  <meta property="og:description" content="${escHtml(ogDescription ?? description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escHtml(canonical)}" />
  <meta property="og:site_name" content="GeoIQ" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(ogTitle ?? title)}" />
  <meta name="twitter:description" content="${escHtml(ogDescription ?? description)}" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" />
  ${schemaBlock}
  <style>${sharedCss()}</style>
</head>
<body>
  ${ssrNavbar()}
  <main class="ssr-main" role="main">
    ${body}
  </main>
  ${ssrFooter()}
</body>
</html>`;
}

export function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
