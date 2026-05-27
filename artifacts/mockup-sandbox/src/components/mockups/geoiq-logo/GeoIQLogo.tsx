interface GeoIQLogoProps {
  size?: number;
  showWordmark?: boolean;
  dark?: boolean;
}

export function GeoIQLogoIcon({ size = 80, dark = true }: { size?: number; dark?: boolean }) {
  const id = `giq-${size}-${dark ? "d" : "l"}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-grad`} x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id={`${id}-node`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      {/* Network satellite lines — thin, faint extensions from terminal nodes */}
      <line x1="80" y1="38" x2="92" y2="24" stroke={`url(#${id}-grad)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <line x1="80" y1="38" x2="94" y2="42" stroke={`url(#${id}-grad)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="54" y1="62" x2="40" y2="52" stroke={`url(#${id}-grad)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <line x1="54" y1="62" x2="42" y2="76" stroke={`url(#${id}-grad)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="80" y1="62" x2="90" y2="76" stroke={`url(#${id}-grad)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />

      {/* Satellite nodes */}
      <circle cx="92" cy="24" r="2.5" fill="#4F46E5" opacity="0.6" />
      <circle cx="94" cy="42" r="2" fill="#06B6D4" opacity="0.5" />
      <circle cx="40" cy="52" r="2.5" fill="#06B6D4" opacity="0.6" />
      <circle cx="42" cy="76" r="2" fill="#4F46E5" opacity="0.5" />
      <circle cx="90" cy="76" r="2" fill="#06B6D4" opacity="0.45" />

      {/* Main G stroke */}
      <path
        d="M 80,38 A 32,32 0 1 0 80,62 L 54,62"
        stroke={`url(#${id}-grad)`}
        strokeWidth="7.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Main junction nodes — where the G meets the network */}
      <circle cx="80" cy="38" r="5" fill={`url(#${id}-grad)`} />
      <circle cx="80" cy="62" r="5" fill={`url(#${id}-grad)`} />
      <circle cx="54" cy="62" r="5" fill={`url(#${id}-grad)`} />
    </svg>
  );
}

export function GeoIQLogoWordmark({ size = 80, dark = true }: GeoIQLogoProps) {
  const textColor = dark ? "#F8FAFC" : "#0F172A";
  const subColor = dark ? "#94A3B8" : "#64748B";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.18 }}>
      <GeoIQLogoIcon size={size} dark={dark} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={{
          fontFamily: "'Syne', 'Inter', sans-serif",
          fontWeight: 800,
          fontSize: size * 0.42,
          letterSpacing: "-0.02em",
          color: textColor,
          lineHeight: 1.05,
        }}>
          GeoIQ
        </span>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 400,
          fontSize: size * 0.155,
          letterSpacing: "0.08em",
          color: subColor,
          textTransform: "uppercase",
          lineHeight: 1.3,
          marginTop: 2,
        }}>
          AI Visibility
        </span>
      </div>
    </div>
  );
}
