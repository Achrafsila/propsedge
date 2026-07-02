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
  globalTradeStats,
  globalEquityCurve,
  calendarData,
  performanceByAccount,
  performanceByPropFirm,
  performanceByInstrument,
  performanceBySession,
  tradeDistribution,
} from "@/lib/analytics/globalAnalytics";
import { GlobalFilterBar } from "@/components/analytics/GlobalFilterBar";
import { GlobalOverview } from "@/components/analytics/GlobalOverview";
import { GlobalEquityCurve } from "@/components/analytics/GlobalEquityCurve";
import { GlobalCalendar } from "@/components/analytics/GlobalCalendar";
import { PerformanceBreakdown } from "@/components/analytics/PerformanceBreakdown";
import { TradeDistribution } from "@/components/analytics/TradeDistribution";
import { MissingAccountWarning } from "@/components/analytics/MissingAccountWarning";

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

  // ── Operational View: every trade counts, Step 1 and Step 2 are never
  // collapsed into one root — that collapsing only happens in the Business
  // Metrics engine (src/lib/challenges.ts) used by Dashboard/Challenges.
  const accountIndex = useMemo(() => buildAccountIndex(challenges, fundedAccounts), [challenges, fundedAccounts]);

  const filteredTrades = useMemo(
    () => filterGlobalTrades(trades, filters, accountIndex),
    [trades, filters, accountIndex]
  );

  const stats = useMemo(() => globalTradeStats(filteredTrades), [filteredTrades]);
  const equityPoints = useMemo(() => globalEquityCurve(filteredTrades), [filteredTrades]);
  const dailyPnL = useMemo(() => calendarData(filteredTrades), [filteredTrades]);
  const byAccount = useMemo(() => performanceByAccount(filteredTrades, accountIndex), [filteredTrades, accountIndex]);
  const byPropFirm = useMemo(() => performanceByPropFirm(filteredTrades, accountIndex), [filteredTrades, accountIndex]);
  const byInstrument = useMemo(() => performanceByInstrument(filteredTrades), [filteredTrades]);
  const bySession = useMemo(() => performanceBySession(filteredTrades), [filteredTrades]);
  const distribution = useMemo(() => tradeDistribution(filteredTrades), [filteredTrades]);

  // Trades whose accountId/accountType no longer resolve to a live account
  // (typically because that account was deleted). Still counted in the
  // stats/equity/calendar above; only excluded from the account/firm charts.
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

      {orphanedTrades.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <MissingAccountWarning count={orphanedTrades.length} />
        </motion.div>
      )}

      <motion.div variants={itemVariants} initial="hidden" animate="visible">
        <GlobalOverview stats={stats} />
      </motion.div>

      <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.05 }}>
        <GlobalEquityCurve points={equityPoints} netPnL={stats.netPnL} />
      </motion.div>

      <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
        <GlobalCalendar dailyPnL={dailyPnL} />
      </motion.div>

      <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.15 }}>
        <h2 className="text-[#F8FAFC] font-bold mb-4" style={{ fontSize: typography.fontSize.section }}>
          Performance Breakdown
        </h2>
        <PerformanceBreakdown
          byAccount={byAccount}
          byPropFirm={byPropFirm}
          byInstrument={byInstrument}
          bySession={bySession}
          activeAccountId={filters.accountId}
          activePropFirm={filters.propFirm}
          activeInstrument={filters.instrument}
          activeSession={filters.session}
          onSelectAccount={(key) => patchFilters({ accountId: key })}
          onSelectPropFirm={(key) => patchFilters({ propFirm: key })}
          onSelectInstrument={(key) => patchFilters({ instrument: key })}
          onSelectSession={(key) => patchFilters({ session: key })}
        />
      </motion.div>

      <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
        <h2 className="text-[#F8FAFC] font-bold mb-4" style={{ fontSize: typography.fontSize.section }}>
          Trading Distribution
        </h2>
        <TradeDistribution winLoss={distribution.winLoss} bySession={distribution.bySession} />
      </motion.div>
    </div>
  );
}
