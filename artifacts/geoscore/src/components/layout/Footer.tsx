import { Link } from "wouter";

const linkStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 10,
  fontSize: 14,
  color: "rgba(255,255,255,0.6)",
  textDecoration: "none",
  transition: "color 150ms",
};

const headingStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "rgba(255,255,255,0.4)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 16,
};

function FooterLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "white"),
    onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)"),
  };
  if (external) {
    return <a href={href} style={linkStyle} {...handlers}>{children}</a>;
  }
  return (
    <Link href={href} style={linkStyle} {...handlers}>
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer style={{ background: "#111827", color: "white", padding: "64px 24px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8" style={{ marginBottom: 32 }}>
          <div className="col-span-2 md:col-span-1">
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "white",
                marginBottom: 12,
                letterSpacing: "-0.03em",
              }}
            >
              GeoIQ
            </div>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.6,
                maxWidth: 220,
                margin: 0,
              }}
            >
              The command center for your brand's AI visibility.
            </p>
          </div>

          <div>
            <div style={headingStyle}>Product</div>
            <FooterLink href="/#how-it-works">How it works</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/">Free audit</FooterLink>
            <FooterLink href="/dashboard">Dashboard</FooterLink>
          </div>

          <div>
            <div style={headingStyle}>Resources</div>
            <FooterLink href="/what-is-geo">What is GEO</FooterLink>
            <FooterLink href="/how-to-rank-in-chatgpt">How to rank in ChatGPT</FooterLink>
            <FooterLink href="/geo-tools">GEO Tools 2026</FooterLink>
            <FooterLink href="/blog">Blog</FooterLink>
          </div>

          <div>
            <div style={headingStyle}>Legal</div>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
            <FooterLink href="mailto:hello@geoiqai.com" external>Contact</FooterLink>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 32,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            © 2026 GeoIQ. All rights reserved.
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            Built for founders worldwide.
          </span>
        </div>
      </div>
    </footer>
  );
}
