import { GeoIQLogoWordmark, GeoIQLogoIcon } from "./GeoIQLogo";

export function LightDark() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Dark panel */}
      <div style={{
        flex: 1,
        background: "#0F172A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        padding: 40,
      }}>
        <div style={{ color: "#334155", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>Dark background</div>
        <GeoIQLogoWordmark size={80} dark={true} />

        {/* Nav bar mockup */}
        <div style={{
          width: "100%",
          maxWidth: 360,
          background: "#1E293B",
          borderRadius: 10,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          border: "1px solid #334155",
        }}>
          <GeoIQLogoIcon size={28} dark={true} />
          <span style={{ color: "#F1F5F9", fontWeight: 700, fontSize: 15, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.01em" }}>GeoIQ</span>
        </div>

        {/* App icon */}
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[72, 48, 32].map(s => (
            <div key={s} style={{
              background: "#1E293B",
              borderRadius: s * 0.22,
              padding: s * 0.12,
              border: "1px solid #334155",
            }}>
              <GeoIQLogoIcon size={s} dark={true} />
            </div>
          ))}
        </div>
      </div>

      {/* Light panel */}
      <div style={{
        flex: 1,
        background: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        padding: 40,
        borderLeft: "1px solid #E2E8F0",
      }}>
        <div style={{ color: "#94A3B8", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>Light background</div>
        <GeoIQLogoWordmark size={80} dark={false} />

        {/* Nav bar mockup light */}
        <div style={{
          width: "100%",
          maxWidth: 360,
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        }}>
          <GeoIQLogoIcon size={28} dark={false} />
          <span style={{ color: "#0F172A", fontWeight: 700, fontSize: 15, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.01em" }}>GeoIQ</span>
        </div>

        {/* App icon light */}
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[72, 48, 32].map(s => (
            <div key={s} style={{
              background: "#FFFFFF",
              borderRadius: s * 0.22,
              padding: s * 0.12,
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}>
              <GeoIQLogoIcon size={s} dark={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
