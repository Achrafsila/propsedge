"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Sparkles } from "lucide-react";
import { EdgePilotAvatar } from "@/components/edgepilot/EdgePilotAvatar";
import { useAccounts } from "@/context/AccountsContext";
import { useTradingMode } from "@/context/TradingModeContext";
import { getTradesForTradingMode } from "@/lib/tradingMode";
import { getAccountOptionLabel } from "@/lib/accountLabels";
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
  getDirectionWinRates,
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
import { RadialGauge } from "@/components/analytics/visualizations/RadialGauge";
import { CountUpNumber } from "@/components/analytics/visualizations/CountUpNumber";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function GlobalAnalyticsPage() {
  const { challenges, fundedAccounts, trades, challengesLoading, fundedAccountsLoading, tradesLoading } = useAccounts();
  const { tradingMode } = useTradingMode();
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_GLOBAL_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isLoading = challengesLoading || fundedAccountsLoading || tradesLoading;

  const patchFilters = (patch: Partial<GlobalFilters>) => setFilters((prev) => ({ ...prev, ...patch }));
  const resetFilters = () => setFilters(DEFAULT_GLOBAL_FILTERS);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_GLOBAL_FILTERS);

  // Trader DNA / Analytics must never mix Prop Firm and Personal Capital
  // trades. Prop Firm mode is a no-op pass-through (identical to before
  // Personal Capital existed); Personal Capital mode filters down to
  // trades that are actually personal — see src/lib/tradingMode.ts. Every
  // computation below reads modeTrades (directly or via filteredTrades),
  // never the raw `trades` from AccountsContext.
  const modeTrades = useMemo(() => getTradesForTradingMode(trades, tradingMode), [trades, tradingMode]);

  // Smart reset: once trades finish loading with zero rows (e.g. right
  // after "Delete All Trades" in the Journal, or after switching into
  // Personal Capital mode with no personal trades yet), snap filters back
  // to default so this page reads exactly like a brand-new account instead
  // of showing a stale date range/account filter over no data. Adjusted
  // directly during render (React's recommended pattern for "reset state
  // when an external value changes") rather than in a useEffect, which
  // this project's lint config flags as a cascading-render risk.
  const tradesEmpty = !tradesLoading && modeTrades.length === 0;
  const [wasTradesEmpty, setWasTradesEmpty] = useState(false);
  if (tradesEmpty !== wasTradesEmpty) {
    setWasTradesEmpty(tradesEmpty);
    if (tradesEmpty) resetFilters();
  }

  // ── Operational View: every trade counts, Step 1 and Step 2 are never
  // collapsed into one root — that collapsing only happens in the Business
  // Metrics engine (src/lib/challenges.ts) used by Dashboard/Challenges.
  const accountIndex = useMemo(
    () => buildAccountIndex(challenges, fundedAccounts, []),
    [challenges, fundedAccounts]
  );

  const filteredTrades = useMemo(
    () => filterGlobalTrades(modeTrades, filters, accountIndex),
    [modeTrades, filters, accountIndex]
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
  const directionWinRates = useMemo(() => getDirectionWinRates(filteredTrades), [filteredTrades]);
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
    const list: { id: string; name: string; propFirmName: string; label: string }[] = [];
    if (filters.scope !== "funded") {
      challenges.forEach((c) =>
        list.push({ id: c.id, name: c.accountName, propFirmName: c.propFirmName, label: getAccountOptionLabel(c, "challenge") })
      );
    }
    if (filters.scope !== "challenge") {
      fundedAccounts.forEach((a) =>
        list.push({ id: a.id, name: a.accountName, propFirmName: a.propFirmName, label: getAccountOptionLabel(a, "funded") })
      );
    }
    return list;
  }, [challenges, fundedAccounts, filters.scope]);

  const propFirmOptions = useMemo(
    () => Array.from(new Set(scopedAccounts.map((a) => a.propFirmName))).sort(),
    [scopedAccounts]
  );

  // Dropdown label uses the shared "Name (Status) — Start: Date" format
  // (same as Trade Journal / Import Trades / Add Trade) — sorted by the
  // underlying account name so ordering stays alphabetical rather than
  // grouping by status/date.
  const accountOptions = useMemo(
    () =>
      scopedAccounts
        .filter((a) => !filters.propFirm || a.propFirmName === filters.propFirm)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ id: a.id, name: a.label })),
    [scopedAccounts, filters.propFirm]
  );

  const instrumentOptions = useMemo(
    () => Array.from(new Set(modeTrades.map((t) => t.symbol).filter(Boolean))).sort(),
    [modeTrades]
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
    <div className="space-y-5">
      <button type="button" onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0E1727] px-4 py-3 text-sm font-medium text-[#C6DBF3]"><span>Filters {isFiltered ? "· Custom selection" : "· All data"}</span><span>{filtersOpen ? "Hide −" : "Configure +"}</span></button>
      {filtersOpen && <GlobalFilterBar
        filters={filters}
        onChange={patchFilters}
        onReset={resetFilters}
        propFirmOptions={propFirmOptions}
        accountOptions={accountOptions}
        instrumentOptions={instrumentOptions}
        sessionOptions={sessionOptions}
        isFiltered={isFiltered}
      />}

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl px-6 py-5 overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
        style={{
          background: "rgba(16,24,40,0.5)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(148,163,184,0.08)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(90% 120% at 15% 0%, rgba(41,141,255,0.20) 0%, rgba(41,141,255,0) 60%)" }}
        />
        <div className="relative">
          <p
            className="uppercase mb-2"
            style={{
              color: "#298DFF",
              fontSize: typography.fontSize.xs,
              fontWeight: typography.fontWeight.bold,
              letterSpacing: "0.2em",
            }}
          >
            Behavioral Trading Intelligence
          </p>
          <h1
            style={{
              fontSize: "clamp(2.2rem, 7vw, 4rem)",
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
          {identity.metadata.lastTrade && (
            <p className="text-[#64748B] mt-3" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.muted }}>
              Last updated {identity.metadata.lastTrade}
            </p>
          )}
        </div>

        <div className="relative flex-shrink-0">
          <RadialGauge
            percent={dataConfidence.score}
            color="#298DFF"
            size={104}
            centerValue={<CountUpNumber value={dataConfidence.score} format={(v) => `${Math.round(v)}%`} />}
            caption={dataConfidence.label}
          />
        </div>
      </motion.div>



      <div className="relative overflow-hidden rounded-2xl border border-[#298DFF]/20 bg-gradient-to-r from-[#112541] via-[#0D1A2B] to-[#0A1220] p-4 sm:p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <EdgePilotAvatar state="reviewing" size={112} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-[#7DBCFF]"/><h2 className="text-base font-bold text-white">Trader DNA Coach</h2><span className="rounded-full border border-[#6FAEFF]/25 px-2 py-0.5 text-[10px] font-semibold text-[#9CCFFF]">Coming soon</span></div>
            <p className="mt-2 max-w-3xl text-sm text-[#C0CFE2]">Explore your trading identity, the sessions where you perform best, your execution habits, and what your history does not yet prove.</p>
            <p className="mt-1 text-xs text-[#8EA5BF]">Personalized coaching will be available soon.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#9DC6F4]"><Sparkles className="h-4 w-4"/> Behavioural intelligence</div>
        </div>
      </div>

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
          directionWinRates={directionWinRates}
          tradesByInstrument={dnaStats.tradesByInstrument}
        />
      </motion.div>

    </div>
  );
}
