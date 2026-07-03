"use client";

import { TraderIdentity } from "@/lib/analytics/traderIdentity";
import { TraderHabits } from "@/lib/analytics/traderHabits";
import { TraderEdge } from "@/lib/analytics/traderEdge";
import { TraderBlindSpots } from "@/lib/analytics/traderBlindSpots";
import { TraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { TraderEvolution } from "@/lib/analytics/traderEvolution";
import { TradingIdentityCard } from "@/components/analytics/TradingIdentityCard";
import { TradingHabitsCard } from "@/components/analytics/TradingHabitsCard";
import { TradingEdgeCard } from "@/components/analytics/TradingEdgeCard";
import { TradingBlindSpotsCard } from "@/components/analytics/TradingBlindSpotsCard";
import { TradingDisciplineCard } from "@/components/analytics/TradingDisciplineCard";
import { TradingEvolutionCard } from "@/components/analytics/TradingEvolutionCard";

// ── Trader DNA — final page structure ─────────────────────────────────────
// All six V1 sections are real, fully computed engines — no thresholds or
// fallback values live in this component, it only renders each engine's
// output:
// - Trading Identity  (src/lib/analytics/traderIdentity.ts)
// - Your Habits       (src/lib/analytics/traderHabits.ts)
// - Your Edge         (src/lib/analytics/traderEdge.ts)
// - Blind Spots       (src/lib/analytics/traderBlindSpots.ts)
// - Discipline        (src/lib/analytics/traderDiscipline.ts)
// - Evolution         (src/lib/analytics/traderEvolution.ts)
export function TraderDNASections({
  identity,
  habits,
  edge,
  blindSpots,
  discipline,
  evolution,
}: {
  identity: TraderIdentity;
  habits: TraderHabits;
  edge: TraderEdge;
  blindSpots: TraderBlindSpots;
  discipline: TraderDiscipline;
  evolution: TraderEvolution;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <TradingIdentityCard identity={identity} />

      <TradingHabitsCard habits={habits} />

      <TradingEdgeCard edge={edge} />

      <TradingBlindSpotsCard blindSpots={blindSpots} />

      <TradingDisciplineCard discipline={discipline} />

      <TradingEvolutionCard evolution={evolution} />
    </div>
  );
}
