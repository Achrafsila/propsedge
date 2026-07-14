import { typography } from "@/design-system";
import { CARD, SectionLabel, formatPrice, formatSignedPercent } from "./shared";
import type { LiquidityResult } from "@/lib/edge-pulse/engines/liquidityEngine";

function LevelCard({ label, price, distancePercent }: { label: string; price: number; distancePercent: number }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
      <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
        {label}
      </p>
      <p className="text-[#F8FAFC] font-semibold tabular-nums" style={{ fontSize: typography.fontSize.lg }}>
        {formatPrice(price)}
      </p>
      <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
        {formatSignedPercent(distancePercent)}
      </p>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
      <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
        {label}
      </p>
      <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
        —
      </p>
    </div>
  );
}

// Section 3 — LIQUIDITY MAP. Every level here is a mechanical derivation
// of confirmed swing points (see liquidityEngine.ts) — no AI, no invented
// levels. Buy-side Liquidity and Liquidity Resting Above are the SAME
// pool (same for Sell-side/Resting Below) — surfaced twice because the
// spec lists them as separate bullets, never recomputed twice.
export function LiquidityMapSection({ liquidity }: { liquidity: LiquidityResult }) {
  if (liquidity.quality === "unavailable") {
    return (
      <div className="rounded-2xl p-6" style={CARD}>
        <SectionLabel>Liquidity Map</SectionLabel>
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          Liquidity is currently unavailable for this instrument.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <SectionLabel>Liquidity Map</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {liquidity.buySideLiquidity ? (
          <LevelCard label="Buy-side Liquidity" price={liquidity.buySideLiquidity.price} distancePercent={liquidity.buySideLiquidity.distancePercent} />
        ) : (
          <EmptyCard label="Buy-side Liquidity" />
        )}
        {liquidity.sellSideLiquidity ? (
          <LevelCard label="Sell-side Liquidity" price={liquidity.sellSideLiquidity.price} distancePercent={liquidity.sellSideLiquidity.distancePercent} />
        ) : (
          <EmptyCard label="Sell-side Liquidity" />
        )}
        {liquidity.liquidityRestingAbove ? (
          <LevelCard label="Liquidity Resting Above" price={liquidity.liquidityRestingAbove.price} distancePercent={liquidity.liquidityRestingAbove.distancePercent} />
        ) : (
          <EmptyCard label="Liquidity Resting Above" />
        )}
        {liquidity.liquidityRestingBelow ? (
          <LevelCard label="Liquidity Resting Below" price={liquidity.liquidityRestingBelow.price} distancePercent={liquidity.liquidityRestingBelow.distancePercent} />
        ) : (
          <EmptyCard label="Liquidity Resting Below" />
        )}
        {liquidity.equalHighs ? (
          <LevelCard label={`Equal Highs (${liquidity.equalHighs.count})`} price={liquidity.equalHighs.price} distancePercent={liquidity.equalHighs.distancePercent} />
        ) : (
          <EmptyCard label="Equal Highs" />
        )}
        {liquidity.equalLows ? (
          <LevelCard label={`Equal Lows (${liquidity.equalLows.count})`} price={liquidity.equalLows.price} distancePercent={liquidity.equalLows.distancePercent} />
        ) : (
          <EmptyCard label="Equal Lows" />
        )}
        {liquidity.externalLiquidity.length > 0 ? (
          <div className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
              External Liquidity
            </p>
            {liquidity.externalLiquidity.map((l, i) => (
              <p key={i} className="text-[#F8FAFC] font-semibold tabular-nums" style={{ fontSize: typography.fontSize.sm }}>
                {formatPrice(l.price)}
              </p>
            ))}
          </div>
        ) : (
          <EmptyCard label="External Liquidity" />
        )}
        {liquidity.internalLiquidity.length > 0 ? (
          <div className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
              Internal Liquidity
            </p>
            {liquidity.internalLiquidity.map((l, i) => (
              <p key={i} className="text-[#F8FAFC] font-semibold tabular-nums" style={{ fontSize: typography.fontSize.sm }}>
                {formatPrice(l.price)}
              </p>
            ))}
          </div>
        ) : (
          <EmptyCard label="Internal Liquidity" />
        )}
        {liquidity.nearestSweep ? (
          <LevelCard
            label={`Nearest Liquidity Sweep (${liquidity.nearestSweep.side})`}
            price={liquidity.nearestSweep.sweptPrice}
            distancePercent={(liquidity.nearestSweep.distance / liquidity.nearestSweep.sweptPrice) * 100}
          />
        ) : (
          <EmptyCard label="Nearest Liquidity Sweep" />
        )}
      </div>
    </div>
  );
}
