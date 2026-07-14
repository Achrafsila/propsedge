import { typography } from "@/design-system";
import { CARD, SectionLabel, STATE_COLOR, formatPrice, formatSignedPercent } from "./shared";
import type { SupplyDemandResult, SupplyDemandZone } from "@/lib/edge-pulse/engines/supplyDemandEngine";
import { TIMEFRAME_LABEL } from "@/lib/edge-pulse/types";

function ZoneCard({ side, zone }: { side: "Supply" | "Demand"; zone: SupplyDemandZone | null }) {
  if (!zone) {
    return (
      <div className="rounded-lg p-3" style={{ background: "rgba(148,163,184,0.03)" }}>
        <p className="text-[#64748B] uppercase mb-1" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
          {side}
        </p>
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
          —
        </p>
      </div>
    );
  }
  const stateColor = STATE_COLOR[zone.state];
  const distancePercent = (zone.distance / (zone.distance >= 0 ? zone.high : zone.low)) * 100;
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(148,163,184,0.03)" }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
          {side}
        </p>
        <span className="font-semibold capitalize" style={{ fontSize: typography.fontSize.xs, color: stateColor }}>
          {zone.state}
        </span>
      </div>
      <p className="text-[#F8FAFC] font-semibold tabular-nums" style={{ fontSize: typography.fontSize.sm }}>
        {formatPrice(zone.low)} – {formatPrice(zone.high)}
      </p>
      <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
        {formatSignedPercent(distancePercent)}
      </p>
    </div>
  );
}

// Section 4 — SUPPLY & DEMAND. Never more than one Supply + one Demand per
// timeframe — that constraint falls directly out of supplyDemandEngine.ts's
// "nearest unbroken zone" selection rule, not a display-layer cap.
export function SupplyDemandSection({ supplyDemandByTimeframe }: { supplyDemandByTimeframe: SupplyDemandResult[] }) {
  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <SectionLabel>Supply &amp; Demand</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {supplyDemandByTimeframe.map((sd) => (
          <div key={sd.timeframe} className="rounded-xl p-3 space-y-2" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <p className="text-[#94A3B8] font-semibold" style={{ fontSize: typography.fontSize.sm }}>
              {TIMEFRAME_LABEL[sd.timeframe]}
            </p>
            {sd.quality === "unavailable" ? (
              <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
                Unavailable
              </p>
            ) : (
              <>
                <ZoneCard side="Supply" zone={sd.nearestSupply} />
                <ZoneCard side="Demand" zone={sd.nearestDemand} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
