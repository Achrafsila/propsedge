"use client";

import { TraderIdentity } from "@/lib/analytics/traderIdentity";
import { TraderHabits } from "@/lib/analytics/traderHabits";
import { TraderEdge } from "@/lib/analytics/traderEdge";
import { TraderBlindSpots } from "@/lib/analytics/traderBlindSpots";
import { TraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { TraderEvolution } from "@/lib/analytics/traderEvolution";
import { TradingIdentityCard } from "@/components/analytics/TradingIdentityCard";
import { SessionPerformanceCard } from "@/components/analytics/SessionPerformanceCard";
import { InstrumentBreakdownCard } from "@/components/analytics/InstrumentBreakdownCard";
import { TradingHabitsCard } from "@/components/analytics/TradingHabitsCard";
import { TradingEdgeCard } from "@/components/analytics/TradingEdgeCard";
import { TradingBlindSpotsCard } from "@/components/analytics/TradingBlindSpotsCard";
import { TradingDisciplineCard } from "@/components/analytics/TradingDisciplineCard";
import { TradingEvolutionCard } from "@/components/analytics/TradingEvolutionCard";

// ── Trader DNA — final page structure ─────────────────────────────────────
// All sections are real, fully computed engines — no thresholds or
// fallback values live in this component, it only renders each engine's
// output (plus tradesByDirection/tradesByInstrument, already computed on
// the page from TraderDNAStats and threaded down here, never recomputed):
// - Trading Identity      (src/lib/analytics/traderIdentity.ts)
// - Session Performance   (src/lib/analytics/traderIdentity.ts — sessionDistribution)
// - Instrument Breakdown  (src/lib/analytics/traderIdentity.ts — topInstruments)
// - Your Habits           (src/lib/analytics/traderHabits.ts)
// - Your Edge             (src/lib/analytics/traderEdge.ts)
// - Blind Spots           (src/lib/analytics/traderBlindSpots.ts)
// - Risk Management       (src/lib/analytics/traderDiscipline.ts)
// - Evolution             (src/lib/analytics/traderEvolution.ts)
export function TraderDNASections({
  identity,
  habits,
  edge,
  blindSpots,
  discipline,
  evolution,
  tradesByDirection,
  tradesByInstrument,
}: {
  identity: TraderIdentity;
  habits: TraderHabits;
  edge: TraderEdge;
  blindSpots: TraderBlindSpots;
  discipline: TraderDiscipline;
  evolution: TraderEvolution;
  tradesByDirection: { long: number; short: number };
  tradesByInstrument: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <TradingIdentityCard
        identity={identity}
        tradesByDirection={tradesByDirection}
        averageHoldingTime={habits.averageHoldingTime}
        averageHoldingTimeExplanation={habits.averageHoldingTimeExplanation}
      />

      <TradingHabitsCard habits={habits} />

      <SessionPerformanceCard identity={identity} />

      <InstrumentBreakdownCard identity={identity} tradesByInstrument={tradesByInstrument} />

      <TradingEdgeCard edge={edge} />

      <TradingBlindSpotsCard blindSpots={blindSpots} />

      <TradingDisciplineCard discipline={discipline} />

      <TradingEvolutionCard evolution={evolution} />
    </div>
  );
}
