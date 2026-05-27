import { GeoIQLogoWordmark, GeoIQLogoIcon } from "./GeoIQLogo";

export default function Wordmark() {
  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      background: "#0F172A",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 52,
      padding: 48,
      fontFamily: "'Inter', sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Hero wordmark */}
      <GeoIQLogoWordmark size={96} dark={true} />

      <div style={{ width: "100%", maxWidth: 600, height: 1, background: "#1E293B" }} />

      {/* Size variants */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "flex-start", width: "100%", maxWidth: 600 }}>
        <div style={{ color: "#475569", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Scale variations
        </div>
        <GeoIQLogoWordmark size={64} dark={true} />
        <GeoIQLogoWordmark size={44} dark={true} />
        <GeoIQLogoWordmark size={28} dark={true} />
      </div>

      <div style={{ width: "100%", maxWidth: 600, height: 1, background: "#1E293B" }} />

      {/* Icon only */}
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ color: "#475569", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>Icon only</div>
        <GeoIQLogoIcon size={72} dark={true} />
        <GeoIQLogoIcon size={48} dark={true} />
        <GeoIQLogoIcon size={32} dark={true} />
        <GeoIQLogoIcon size={20} dark={true} />
      </div>
    </div>
  );
}
