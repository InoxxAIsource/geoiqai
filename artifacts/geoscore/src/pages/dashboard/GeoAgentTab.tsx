import { useState, useEffect, useRef } from "react";
import { Send, Bot, Copy } from "lucide-react";

interface Brand {
  id: string;
  domain: string;
  brandName: string | null;
  category: string | null;
  latestScore: number | null;
  latestScoreChatgpt: number | null;
  latestScoreGemini: number | null;
  latestScorePerplexity: number | null;
}

interface Message {
  role: "user" | "agent";
  content: string;
  isLoading?: boolean;
}

const DEFAULT_CHIPS = [
  "Why is my score low?",
  "Write a tweet about my brand",
  "Plan my content this week",
  "Generate 10 FAQs for me",
];

const STARTER_LIMIT = 50;

export function GeoAgentTab({
  brand,
  plan,
}: {
  brand: Brand;
  plan: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefingDone, setBriefingDone] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(plan === "starter" ? STARTER_LIMIT : null);
  const [limitReached, setLimitReached] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (briefingDone || messages.length > 0) return;

    const fetchBriefing = async () => {
      setMessages([{ role: "agent", content: "", isLoading: true }]);
      try {
        const token = localStorage.getItem("geoscore_token");
        const res = await fetch("/api/agent/briefing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ brandId: brand.id }),
        });

        if (!res.ok) throw new Error("Failed to load briefing");
        const data = (await res.json()) as { briefing: string };
        setMessages([{ role: "agent", content: data.briefing }]);
        setBriefingDone(true);
      } catch {
        setMessages([
          {
            role: "agent",
            content: `Hey - I'm your GEO Agent for ${brand.brandName ?? brand.domain}. Your current score is ${brand.latestScore ?? 0}/100 across ChatGPT, Gemini, and Perplexity. Ask me anything about your AI visibility, or use the chips below to get started.`,
          },
        ]);
        setBriefingDone(true);
      }
    };

    fetchBriefing();
  }, [brand.id, briefingDone, messages.length]);

  const sendMessage = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading || limitReached) return;

    const userMessage: Message = { role: "user", content: msg };
    const history = messages.map(m => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content }));

    setMessages(prev => [...prev, userMessage, { role: "agent", content: "", isLoading: true }]);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("geoscore_token");
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msg, history: history.slice(-10), brandId: brand.id }),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { message: string };
        setMessages(prev => [...prev.slice(0, -1), { role: "agent", content: data.message }]);
        setLimitReached(true);
        setRemaining(0);
        return;
      }

      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { reply: string; remaining: number | null };

      setMessages(prev => [...prev.slice(0, -1), { role: "agent", content: data.reply }]);

      if (data.remaining !== null) {
        setRemaining(data.remaining);
        if (data.remaining <= 0) setLimitReached(true);
      }
    } catch {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "agent", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleCopy = (idx: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", minHeight: 500, maxHeight: 750 }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>GEO Agent</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Knows your brand, scores, and competitors
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {plan === "starter" && remaining !== null && (
            <div style={{ fontSize: 11, color: remaining <= 5 ? "#DC2626" : "#9ca3af" }}>
              {remaining} of {STARTER_LIMIT} messages left
            </div>
          )}
          {plan === "agency" && (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Unlimited messages</div>
          )}
          <button
            onClick={() => {
              setMessages([]);
              setBriefingDone(false);
              setLimitReached(false);
            }}
            style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}
          >
            Clear chat
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          background: "#F9FAFB",
          borderRadius: 10,
          border: "0.5px solid #e5e7eb",
          padding: "14px 14px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginBottom: 10,
        }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-start" }}>
            {msg.role === "agent" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <Bot size={14} color="white" />
              </div>
            )}
            <div style={{ maxWidth: msg.role === "user" ? "70%" : "80%" }}>
              <div
                style={{
                  background: msg.role === "user" ? "#4F46E5" : "white",
                  color: msg.role === "user" ? "white" : "#111827",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  padding: "10px 14px",
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  border: msg.role === "agent" ? "1px solid #E5E7EB" : "none",
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.isLoading ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        style={{
                          width: 6, height: 6, borderRadius: "50%", background: "#9ca3af",
                          animation: "bounce 1.2s infinite",
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                    <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1.2);opacity:1} }`}</style>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "agent" && !msg.isLoading && msg.content && (
                <button
                  onClick={() => handleCopy(i, msg.content)}
                  style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: copiedIdx === i ? "#059669" : "#9ca3af", padding: "2px 4px" }}
                >
                  <Copy size={10} />
                  {copiedIdx === i ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Upgrade prompt if limit reached */}
      {limitReached && (
        <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#7F1D1D" }}>
            You have used your 50 GeoIQ Agent messages this month.
          </div>
          <a href="/pricing" style={{ background: "#DC2626", color: "white", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>
            Upgrade to Agency
          </a>
        </div>
      )}

      {/* Suggestion chips */}
      {messages.length <= 1 && !loading && (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 8, paddingBottom: 2 }}>
          {DEFAULT_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => sendMessage(chip)}
              style={{
                flexShrink: 0,
                background: "white",
                border: "0.5px solid #e5e7eb",
                borderRadius: 9999,
                padding: "5px 12px",
                fontSize: 12,
                color: "#374151",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "border-color 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#4F46E5")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask your GEO agent anything..."
          disabled={loading || limitReached}
          style={{
            flex: 1,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            outline: "none",
            color: "#111827",
            background: limitReached ? "#F9FAFB" : "white",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#4F46E5")}
          onBlur={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || limitReached}
          style={{
            background: loading || !input.trim() || limitReached ? "#c7d2fe" : "#4F46E5",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: loading || !input.trim() || limitReached ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Send size={13} />
          Send
        </button>
      </form>
    </div>
  );
}
