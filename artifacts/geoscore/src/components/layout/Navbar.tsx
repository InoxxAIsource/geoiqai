import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthGuard } from "@/hooks/use-auth-guard";

const NAV_LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "What is GEO", href: "/what-is-geo" },
];

export function Navbar() {
  const { isAuthenticated } = useAuthGuard();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleStartFree = () => {
    const input = document.getElementById("hero-input") as HTMLInputElement | null;
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => input.focus(), 500);
    } else {
      setLocation("/");
    }
    setMobileOpen(false);
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #F3F4F6",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#4F46E5",
            letterSpacing: "-0.03em",
            textDecoration: "none",
          }}
        >
          GeoIQ
        </Link>

        <div className="hidden md:flex" style={{ alignItems: "center", gap: 32 }}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              style={{
                fontSize: 14,
                color: "#4B5563",
                textDecoration: "none",
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4B5563")}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex" style={{ alignItems: "center" }}>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "white",
                background: "#4F46E5",
                padding: "8px 16px",
                borderRadius: 9999,
                textDecoration: "none",
              }}
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  fontSize: 14,
                  color: "#4B5563",
                  marginRight: 12,
                  textDecoration: "none",
                  transition: "color 150ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4B5563")}
              >
                Sign in
              </Link>
              <button
                onClick={handleStartFree}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "white",
                  background: "#4F46E5",
                  padding: "8px 16px",
                  borderRadius: 9999,
                  border: "none",
                  cursor: "pointer",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#4338CA")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#4F46E5")}
              >
                Start free
              </button>
            </>
          )}
        </div>

        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            color: "#374151",
          }}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div
          style={{
            background: "white",
            borderTop: "1px solid #F3F4F6",
            padding: "12px 24px 20px",
          }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: "block",
                padding: "11px 0",
                fontSize: 15,
                color: "#374151",
                textDecoration: "none",
                borderBottom: "1px solid #F9FAFB",
              }}
            >
              {link.label}
            </Link>
          ))}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                style={{
                  textAlign: "center",
                  padding: 10,
                  background: "#4F46E5",
                  color: "white",
                  borderRadius: 9999,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    textAlign: "center",
                    padding: 10,
                    border: "1px solid #E5E7EB",
                    borderRadius: 9999,
                    color: "#374151",
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                >
                  Sign in
                </Link>
                <button
                  onClick={handleStartFree}
                  style={{
                    padding: 10,
                    background: "#4F46E5",
                    color: "white",
                    borderRadius: 9999,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Start free
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
