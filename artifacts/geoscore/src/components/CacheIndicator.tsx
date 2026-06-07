import { Clock, RefreshCw } from "lucide-react";

const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

interface CacheIndicatorProps {
  cachedAt: string;
  expiresAt: string;
  onForceRefresh?: () => void;
  refreshing?: boolean;
}

export function CacheIndicator({
  cachedAt,
  expiresAt,
  onForceRefresh,
  refreshing = false,
}: CacheIndicatorProps) {
  const cachedMs = new Date(cachedAt).getTime();
  const expiresMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();

  const hoursAgo = Math.floor((nowMs - cachedMs) / 3_600_000);
  const hoursLeft = Math.max(0, Math.ceil((expiresMs - nowMs) / 3_600_000));

  const freshness =
    hoursAgo < 12 ? "Fresh data" : hoursAgo < 48 ? "Recent data" : "Aging data";

  const color = hoursAgo < 12 ? "#10B981" : hoursAgo < 48 ? "#3B82F6" : "#F59E0B";

  const timeAgoLabel =
    hoursAgo === 0 ? "just now" : hoursAgo === 1 ? "1 hour ago" : `${hoursAgo}h ago`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
        <Clock size={11} color={color} />
        <span style={{ fontWeight: 600, color }}>{freshness}</span>
        <span style={{ color: MUTED }}>
          - Updated {timeAgoLabel} - Refreshes in {hoursLeft}h
        </span>
      </div>

      {onForceRefresh && (
        <button
          onClick={onForceRefresh}
          disabled={refreshing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 10px",
            background: "white",
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            fontSize: 11,
            color: refreshing ? "#A5B4FC" : MUTED,
            cursor: refreshing ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw
            size={10}
            style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}
          />
          {refreshing ? "Scanning..." : "Force refresh"}
        </button>
      )}
    </div>
  );
}
