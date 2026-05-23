import { useState } from "react";
import { Copy, X } from "lucide-react";

interface Brand {
  id: string;
  domain: string;
  brandName: string | null;
  category: string | null;
}

type GeneratorType = "tweet" | "blog" | "faq" | "pitch" | null;

const BLOG_ANGLES = [
  { key: "Trust", label: "Trust", tip: "Build credibility with data and case studies" },
  { key: "Best", label: "Best of", tip: "Position as the top solution in category" },
  { key: "Solution", label: "Solution", tip: "Solve a specific reader problem" },
  { key: "Struggle", label: "Struggle", tip: "Empathize with pain before offering help" },
  { key: "How", label: "How to", tip: "Step-by-step actionable guide" },
  { key: "What", label: "What is", tip: "Definitional content AI loves to cite" },
  { key: "Why", label: "Why", tip: "Persuasive take on a common belief" },
];

const TWEET_TONES = ["Professional", "Story", "Educational"];

async function callGenerate(type: GeneratorType, brandId: string, params: Record<string, string>): Promise<string> {
  const token = localStorage.getItem("geoscore_token");
  const res = await fetch("/api/agent/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, brandId, params }),
  });
  if (!res.ok) throw new Error("Generate failed");
  const data = (await res.json()) as { result: string };
  return data.result;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 540, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2 }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      style={{ display: "flex", alignItems: "center", gap: 5, background: copied ? "#ECFDF5" : "transparent", border: `0.5px solid ${copied ? "#10b981" : "#e5e7eb"}`, borderRadius: 5, padding: "4px 10px", fontSize: 11, color: copied ? "#059669" : "#6b7280", cursor: "pointer", fontWeight: copied ? 500 : 400 }}
    >
      <Copy size={10} />
      {copied ? "Copied!" : (label ?? "Copy")}
    </button>
  );
}

function ResultBox({ content }: { content: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ background: "#F9FAFB", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#111827", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto" }}>
        {content}
      </div>
      <div style={{ marginTop: 8 }}>
        <CopyButton text={content} label="Copy all" />
      </div>
    </div>
  );
}

function TweetModal({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const [tone, setTone] = useState("Professional");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await callGenerate("tweet", brand.id, { tone });
      setResult(r);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Generate tweets for ${brand.brandName ?? brand.domain}`} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Tone</div>
        <div style={{ display: "flex", gap: 6 }}>
          {TWEET_TONES.map(t => (
            <button
              key={t}
              onClick={() => setTone(t)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                background: tone === t ? "#4F46E5" : "white",
                color: tone === t ? "white" : "#6B7280",
                boxShadow: tone === t ? "none" : "0 0 0 1px #E5E7EB inset",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={generate}
        disabled={loading}
        style={{ width: "100%", background: loading ? "#c7d2fe" : "#4F46E5", color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Generating..." : "Generate 3 tweets"}
      </button>
      {error && <div style={{ marginTop: 10, fontSize: 12, color: "#DC2626" }}>{error}</div>}
      {result && <ResultBox content={result} />}
    </Modal>
  );
}

function BlogModal({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const [angle, setAngle] = useState("How");
  const [keyword, setKeyword] = useState(brand.brandName ?? brand.domain);
  const [wordCount, setWordCount] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await callGenerate("blog", brand.id, { angle, keyword, wordCount });
      setResult(r);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Choose your content angle" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Content angle</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {BLOG_ANGLES.map(a => (
            <button
              key={a.key}
              onClick={() => setAngle(a.key)}
              title={a.tip}
              style={{
                padding: "7px 6px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                background: angle === a.key ? "#4F46E5" : "white",
                color: angle === a.key ? "white" : "#6B7280",
                boxShadow: angle === a.key ? "none" : "0 0 0 1px #E5E7EB inset",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Target keyword</div>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#4F46E5")}
          onBlur={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Word count</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["500", "1000", "2000"].map(w => (
            <button
              key={w}
              onClick={() => setWordCount(w)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                background: wordCount === w ? "#4F46E5" : "white",
                color: wordCount === w ? "white" : "#6B7280",
                boxShadow: wordCount === w ? "none" : "0 0 0 1px #E5E7EB inset",
              }}
            >
              {w} words
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        style={{ width: "100%", background: loading ? "#c7d2fe" : "#4F46E5", color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Writing..." : "Generate blog post"}
      </button>
      {error && <div style={{ marginTop: 10, fontSize: 12, color: "#DC2626" }}>{error}</div>}
      {result && <ResultBox content={result} />}
    </Modal>
  );
}

function FaqModal({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await callGenerate("faq", brand.id, {});
      setResult(r);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Generate FAQs" onClose={onClose}>
      <div style={{ background: "#F9FAFB", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
        Generating 20 FAQs for <strong>{brand.brandName ?? brand.domain}</strong> in the{" "}
        <strong>{brand.category ?? "startup"}</strong> category. These are formatted for AI retrieval - questions people actually type into ChatGPT and Perplexity.
      </div>
      <button
        onClick={generate}
        disabled={loading}
        style={{ width: "100%", background: loading ? "#c7d2fe" : "#4F46E5", color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Generating 20 FAQs..." : "Generate FAQs"}
      </button>
      {error && <div style={{ marginTop: 10, fontSize: 12, color: "#DC2626" }}>{error}</div>}
      {result && <ResultBox content={result} />}
    </Modal>
  );
}

function PitchModal({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const [publication, setPublication] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    if (!publication.trim()) return;
    setLoading(true);
    setError("");
    try {
      const r = await callGenerate("pitch", brand.id, { publication });
      setResult(r);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Write pitch email" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Newsletter or blog name</div>
        <input
          value={publication}
          onChange={e => setPublication(e.target.value)}
          placeholder="e.g. TLDR AI, The Ken, Hacker News"
          style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#4F46E5")}
          onBlur={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
          onKeyDown={e => { if (e.key === "Enter") generate(); }}
        />
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
          Your pitch will be specific to {brand.brandName ?? brand.domain} and optimized for that publication's audience.
        </div>
      </div>
      <button
        onClick={generate}
        disabled={loading || !publication.trim()}
        style={{ width: "100%", background: loading || !publication.trim() ? "#c7d2fe" : "#4F46E5", color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: loading || !publication.trim() ? "not-allowed" : "pointer" }}
      >
        {loading ? "Writing pitch..." : "Generate pitch"}
      </button>
      {error && <div style={{ marginTop: 10, fontSize: 12, color: "#DC2626" }}>{error}</div>}
      {result && <ResultBox content={result} />}
    </Modal>
  );
}

export function ContentGenerators({ brand }: { brand: Brand }) {
  const [active, setActive] = useState<GeneratorType>(null);

  const buttons: { type: GeneratorType; label: string }[] = [
    { type: "tweet", label: "Write tweet" },
    { type: "blog", label: "Write blog post" },
    { type: "faq", label: "Generate FAQs" },
    { type: "pitch", label: "Write pitch email" },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {buttons.map(b => (
          <button
            key={b.type}
            onClick={() => setActive(b.type)}
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
              color: "#374151",
              background: "white",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 150ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#4F46E5"; e.currentTarget.style.color = "#4F46E5"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {active === "tweet" && <TweetModal brand={brand} onClose={() => setActive(null)} />}
      {active === "blog" && <BlogModal brand={brand} onClose={() => setActive(null)} />}
      {active === "faq" && <FaqModal brand={brand} onClose={() => setActive(null)} />}
      {active === "pitch" && <PitchModal brand={brand} onClose={() => setActive(null)} />}
    </>
  );
}
