import { typography } from "@/design-system";
import { CARD, SectionLabel } from "./shared";
import type { CatalystItem, CatalystResult } from "@/lib/edge-pulse/engines/catalystEngine";

const IMPACT_COLOR: Record<string, string> = { high: "#EF4444", medium: "#F59E0B", low: "#298DFF", unknown: "#64748B" };

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function CatalystCard({ label, item }: { label: string; item: CatalystItem | null }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
      <p className="text-[#64748B] uppercase mb-2" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
        {label}
      </p>
      {item ? (
        <>
          <p className="text-[#F8FAFC] font-semibold mb-1" style={{ fontSize: typography.fontSize.base }}>
            {item.title}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-medium capitalize" style={{ fontSize: typography.fontSize.xs, color: IMPACT_COLOR[item.impact] }}>
              {item.impact} impact
            </span>
            <span className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
              · {item.source} · {formatScheduledAt(item.scheduledAt)}
            </span>
          </div>
        </>
      ) : (
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          —
        </p>
      )}
    </div>
  );
}

// Section 6 — MARKET CATALYST. Never fabricates an event — when nothing
// verified is found, catalyst.fallbackMessage is the exact spec sentence,
// shown as-is.
export function MarketCatalystSection({ catalyst }: { catalyst: CatalystResult }) {
  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <SectionLabel>Market Catalyst</SectionLabel>
      {catalyst.fallbackMessage ? (
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          {catalyst.fallbackMessage}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CatalystCard label="Today's Catalyst" item={catalyst.todaysCatalyst} />
          <CatalystCard label="Weekly Catalyst" item={catalyst.weeklyCatalyst} />
        </div>
      )}
    </div>
  );
}
