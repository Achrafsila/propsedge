"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAccounts } from "@/context/AccountsContext";
import { typography, gradientText } from "@/design-system";
import {
  DEFAULT_GLOBAL_FILTERS,
  GlobalFilters,
  buildAccountIndex,
  filterGlobalTrades,
  getOrphanedTrades,
} from "@/lib/analytics/globalAnalytics";
import {
  getTradingFrequency,
  getPropFirmConsistency,
  getPreferredSession,
  getPreferredInstrument,
  getTraderDNAStats,
  getExpectancy,
  getProfitFactor,
} from "@/lib/analytics/traderDNA";
import { getTraderIdentity } from "@/lib/analytics/traderIdentity";
import { getTraderHabits } from "@/lib/analytics/traderHabits";
import { getTraderEdge } from "@/lib/analytics/traderEdge";
import { getTraderBlindSpots } from "@/lib/analytics/traderBlindSpots";
import { getTraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { getTraderEvolution } from "@/lib/analytics/traderEvolution";
import { getDataConfidence } from "@/lib/analytics/dataConfidence";
import { GlobalFilterBar } from "@/components/analytics/GlobalFilterBar";
import { GlobalOverview } from "@/components/analytics/GlobalOverview";
import { TraderDNASections } from "@/components/analytics/TraderDNASections";
import { MissingAccountWarning } from "@/components/analytics/MissingAccountWarning";
import { DataConfidenceCard } from "@/components/analytics/DataConfidenceCard";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function GlobalAnalyticsPage() {
  const { challenges, fundedAccounts, trades, challengesLoading, fundedAccountsLoading, tradesLoading } = useAccounts();
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_GLOBAL_FILTERS);

  const isLoading = challengesLoading || fundedAccountsLoading || tradesLoading;

  const patchFilters = (patch: Partial<GlobalFilters>) => setFilters((prev) => ({ ...prev, ...patch }));
  const resetFilters = () => setFilters(DEFAULT_GLOBAL_FILTERS);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_GLOBAL_FILTERS);

  // Smart reset: once trades finish loading with zero rows (e.g. right
  // after "Delete All Trades" in the Journal), snap filters back to
  // default so this page reads exactly like a brand-new account instead
  // of showing a stale date range/account filter over no data. Adjusted
  // directly during render (React's recommended pattern for "reset state
  // when an external value changes") rather than in a useEffect, which
  // this project's lint config flags as a cascading-render risk.
  const tradesEmpty = !tradesLoading && trades.length === 0;
  const [wasTradesEmpty, setWasTradesEmpty] = useState(false);
  if (tradesEmpty !== wasTradesEmpty) {
    setWasTradesEmpty(tradesEmpty);
    if (tradesEmpty) resetFilters();
  }

  // ── Operational View: every trade counts, Step 1 and Step 2 are never
  // collapsed into one root — that collapsing only happens in the Business
  // Metrics engine (src/lib/challenges.ts) used by Dashboard/Challenges.
  const accountIndex = useMemo(() => buildAccountIndex(challenges, fundedAccounts), [challenges, fundedAccounts]);

  const filteredTrades = useMemo(
    () => filterGlobalTrades(trades, filters, accountIndex),
    [trades, filters, accountIndex]
  );

  // ── Trader DNA: behavioural stats only, derived from the same filtered
  // trade set as the rest of this page. See src/lib/analytics/traderDNA.ts
  // for the "no pnl-ranking, no business metrics" boundary.
  const tradingFrequency = useMemo(() => getTradingFrequency(filteredTrades), [filteredTrades]);
  const propFirmConsistency = useMemo(() => getPropFirmConsistency(filteredTrades), [filteredTrades]);
  const preferredSession = useMemo(() => getPreferredSession(filteredTrades), [filteredTrades]);
  const preferredInstrument = useMemo(() => getPreferredInstrument(filteredTrades), [filteredTrades]);
  const expectancy = useMemo(() => getExpectancy(filteredTrades), [filteredTrades]);
  const profitFactor = useMemo(() => getProfitFactor(filteredTrades), [filteredTrades]);

  // Trade counts behind the preferred session/instrument, for the "X of Y
  // trades" KPI subtitles — read-only lookup, doesn't affect the insights
  // above (getPreferredSession/getPreferredInstrument are unchanged).
  const dnaStats = useMemo(() => getTraderDNAStats(filteredTrades), [filteredTrades]);
  const sessionTradeCount = preferredSession.value ? dnaStats.tradesBySession[preferredSession.value] ?? 0 : 0;
  const instrumentTradeCount = preferredInstrument.value
    ? dnaStats.tradesByInstrument[preferredInstrument.value] ?? 0
    : 0;

  // Trading Identity and Trading Habits (Trader DNA V1) — dedicated,
  // independent engines; see src/lib/analytics/traderIdentity.ts and
  // src/lib/analytics/traderHabits.ts. Neither is ever fed pnl/win-rate/
  // challenge data, only the same filtered Trade[] as the rest of this page.
  const identity = useMemo(() => getTraderIdentity(filteredTrades), [filteredTrades]);
  const habits = useMemo(() => getTraderHabits(filteredTrades), [filteredTrades]);

  // Your Edge (Trader DNA V1, Block 3) — see src/lib/analytics/traderEdge.ts.
  // Unlike Identity/Habits, this engine does read pnl, but only to rank
  // sessions/instruments/weekdays/direction by expectancy, never to report
  // raw totals.
  const edge = useMemo(() => getTraderEdge(filteredTrades), [filteredTrades]);

  // Blind Spots (Trader DNA V1, Block 4) — see
  // src/lib/analytics/traderBlindSpots.ts. Like Your Edge, this engine reads
  // pnl, but only to surface weak contexts (lowest expectancy), never to
  // report raw totals.
  const blindSpots = useMemo(() => getTraderBlindSpots(filteredTrades), [filteredTrades]);

  // Discipline (Trader DNA V1, Block 5) — see
  // src/lib/analytics/traderDiscipline.ts. Behavioral only: never reads
  // pnl/win-rate/profit-factor/expectancy, only trade timing and counts.
  const discipline = useMemo(() => getTraderDiscipline(filteredTrades), [filteredTrades]);

  // Evolution (Trader DNA V1, Block 6) — see
  // src/lib/analytics/traderEvolution.ts. Behavioral only: compares recent
  // vs previous 30-day windows on activity/holding-time/focus, never on
  // pnl/win-rate/profit-factor/expectancy.
  const evolution = useMemo(() => getTraderEvolution(filteredTrades), [filteredTrades]);

  // Data Confidence (Trader DNA V2) — see
  // src/lib/analytics/dataConfidence.ts. Purely informational: never blocks
  // or hides any KPI/card above, just labels how much trade history backs
  // them right now.
  const dataConfidence = useMemo(() => getDataConfidence(filteredTrades), [filteredTrades]);

  // Trades whose accountId/accountType no longer resolve to a live account
  // (typically because that account was deleted).
  const orphanedTrades = useMemo(
    () => getOrphanedTrades(filteredTrades, accountIndex),
    [filteredTrades, accountIndex]
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && orphanedTrades.length > 0) {
      console.warn(
        "[GlobalAnalytics] Trades linked to missing accounts:",
        orphanedTrades.map((t) => t.id)
      );
    }
  }, [orphanedTrades]);

  // ── Filter option lists ─────────────────────────────────────────────────
  // Prop firm / account cascade off scope so the pickers never show an
  // account that couldn't possibly match. Instrument/session are drawn from
  // the full trade set so they don't disappear as other filters narrow.
  const scopedAccounts = useMemo(() => {
    const list: { id: string; name: string; propFirmName: string }[] = [];
    if (filters.scope !== "funded") {
      challenges.forEach((c) => list.push({ id: c.id, name: c.accountName, propFirmName: c.propFirmName }));
    }
    if (filters.scope !== "challenge") {
      fundedAccounts.forEach((a) => list.push({ id: a.id, name: a.accountName, propFirmName: a.propFirmName }));
    }
    return list;
  }, [challenges, fundedAccounts, filters.scope]);

  const propFirmOptions = useMemo(
    () => Array.from(new Set(scopedAccounts.map((a) => a.propFirmName))).sort(),
    [scopedAccounts]
  );

  const accountOptions = useMemo(
    () =>
      scopedAccounts
        .filter((a) => !filters.propFirm || a.propFirmName === filters.propFirm)
        .map((a) => ({ id: a.id, name: a.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scopedAccounts, filters.propFirm]
  );

  const instrumentOptions = useMemo(
    () => Array.from(new Set(trades.map((t) => t.symbol).filter(Boolean))).sort(),
    [trades]
  );

  const sessionOptions = ["London", "New York", "Asian", "No Session"];

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#298DFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <GlobalFilterBar
        filters={filters}
        onChange={patchFilters}
        onReset={resetFilters}
        propFirmOptions={propFirmOptions}
        accountOptions={accountOptions}
        instrumentOptions={instrumentOptions}
        sessionOptions={sessionOptions}
        isFiltered={isFiltered}
      />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1
          style={{
            fontSize: typography.fontSize.display,
            fontWeight: typography.fontWeight.extraBold,
            letterSpacing: typography.letterSpacing.display,
            lineHeight: typography.lineHeight.display,
            background: gradientText.premium,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          Trader DNA
        </h1>
        <p className="text-[#94A3B8] mt-2" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>
          Understand how you trade, not just what you earn.
        </p>
      </motion.div>

      <DataConfidenceCard confidence={dataConfidence} />

      {orphanedTrades.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <MissingAccountWarning count={orphanedTrades.length} />
        </motion.div>
      )}

      <motion.div variants={itemVariants} initial="hidden" animate="visible">
        <GlobalOverview
          tradingFrequency={tradingFrequency}
          propFirmConsistency={propFirmConsistency}
          preferredSession={preferredSession}
          sessionTradeCount={sessionTradeCount}
          preferredInstrument={preferredInstrument}
          instrumentTradeCount={instrumentTradeCount}
          expectancy={expectancy}
          profitFactor={profitFactor}
        />
      </motion.div>

      <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.05 }}>
        <TraderDNASections
          identity={identity}
          habits={habits}
          edge={edge}
          blindSpots={blindSpots}
          discipline={discipline}
          evolution={evolution}
        />
      </motion.div>
    </div>
  );
}
