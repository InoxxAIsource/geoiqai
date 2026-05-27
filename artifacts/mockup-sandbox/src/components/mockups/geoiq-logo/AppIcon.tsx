import { GeoIQLogoIcon } from "./GeoIQLogo";

function AppIconContainer({ size, radius }: { size: number; radius: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: radius,
      background: "#0F172A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      <GeoIQLogoIcon size={size * 0.72} dark={true} />
    </div>
  );
}

function FaviconRow({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{
        width: size,
        height: size,
        background: "#0F172A",
        borderRadius: Math.round(size * 0.2),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <GeoIQLogoIcon size={size * 0.78} dark={true} />
      </div>
      <span style={{ color: "#64748B", fontSize: 12, fontFamily: "monospace" }}>{size}px</span>
    </div>
  );
}

export function AppIcon() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0F1C",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 52,
      padding: 48,
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ color: "#475569", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        App store icon
      </div>

      {/* Large app store icons */}
      <div style={{ display: "flex", gap: 32, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <AppIconContainer size={180} radius={40} />
          <span style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>180px iOS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <AppIconContainer size={152} radius={24} />
          <span style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>152px Android</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <AppIconContainer size={120} radius={26} />
          <span style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>120px</span>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 480, height: 1, background: "#1E293B" }} />

      {/* Favicon sizes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, width: "100%", maxWidth: 280 }}>
        <div style={{ color: "#475569", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
          Favicon sizes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[64, 48, 32, 16].map(s => <FaviconRow key={s} size={s} />)}
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 480, height: 1, background: "#1E293B" }} />

      {/* Browser tab simulation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", width: "100%", maxWidth: 380 }}>
        <div style={{ color: "#475569", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          Browser tab preview
        </div>
        <div style={{
          background: "#1E293B",
          borderRadius: "8px 8px 0 0",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: 220,
          border: "1px solid #334155",
          borderBottom: "none",
        }}>
          <div style={{
            width: 16,
            height: 16,
            background: "#0F172A",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <GeoIQLogoIcon size={12} dark={true} />
          </div>
          <span style={{ color: "#94A3B8", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            GeoIQ - AI Visibility Platform
          </span>
        </div>
        <div style={{
          background: "#0F172A",
          borderRadius: "0 0 6px 6px",
          padding: "6px 12px",
          width: 220,
          border: "1px solid #334155",
        }}>
          <span style={{ color: "#4F46E5", fontSize: 11 }}>geoiqai.com</span>
        </div>
      </div>
    </div>
  );
}
