import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const PRIMARY = "#4F46E5";

type FormState = "idle" | "loading" | "success" | "error";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const resp = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (resp.ok) {
        setStatus("success");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        const data = await resp.json().catch(() => ({}));
        setErrorMsg((data as { error?: string }).error ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Could not send your message. Check your connection and try again.");
      setStatus("error");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    color: "#111827",
    outline: "none",
    background: "white",
    boxSizing: "border-box",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: 640, margin: "0 auto", padding: "64px 24px", width: "100%" }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: "'Syne', sans-serif" }}>
            Get in touch
          </h1>
          <p style={{ fontSize: 15, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
            Have a question about GeoIQ, need help with your account, or want to talk about enterprise pricing? We read every message and reply within 24 hours.
          </p>
        </div>

        {status === "success" ? (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto", display: "block" }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#15803D", margin: "0 0 8px" }}>Message sent</h2>
            <p style={{ fontSize: 14, color: "#16A34A", margin: "0 0 20px" }}>
              We got it. You will hear back from us within 24 hours.
            </p>
            <button
              onClick={() => setStatus("idle")}
              style={{ background: "none", border: "1px solid #16A34A", borderRadius: 8, padding: "8px 20px", fontSize: 13, color: "#16A34A", cursor: "pointer", fontWeight: 500 }}
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 32 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                  Your name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Arjun Mehta"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                  Your email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@startup.com"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Question about pricing, account issue, general feedback..."
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Message
              </label>
              <textarea
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what is on your mind..."
                rows={6}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              />
            </div>

            {status === "error" && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991B1B" }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                width: "100%",
                background: status === "loading" ? "#818CF8" : PRIMARY,
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 600,
                cursor: status === "loading" ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {status === "loading" ? "Sending..." : "Send message"}
            </button>

            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 14, textAlign: "center" }}>
              We typically reply within 24 hours on business days.
            </p>
          </form>
        )}
      </main>

      <Footer />
    </div>
  );
}
