"use client";

import { useMemo } from "react";
import { useAccounts } from "@/context/AccountsContext";
import { useTodayObjective } from "@/context/TodayObjectiveContext";
import { useDailyContracts } from "@/context/DailyContractsContext";
import { todayDateString } from "@/lib/dateKey";
import { getTraderIdentity } from "@/lib/analytics/traderIdentity";
import { getTraderHabits } from "@/lib/analytics/traderHabits";
import { getTraderEdge } from "@/lib/analytics/traderEdge";
import { getTraderBlindSpots } from "@/lib/analytics/traderBlindSpots";
import { getTraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { getTraderEvolution } from "@/lib/analytics/traderEvolution";
import { getDataConfidence } from "@/lib/analytics/dataConfidence";
import { getAICoachRecommendation, getAccountRiskStates, getAccountBriefings, AccountBriefing } from "@/lib/analytics/aiCoach";
import { computeDeviations, computeDailyAccountability } from "@/lib/analytics/accountabilityEngine";
import { getAccountDecision, Decision } from "@/lib/analytics/decisionEngine";
import { getAccountHealthState, getBiggestRisk, getBuddyAdvice, getHeroQuote, getKeyTakeaway } from "@/lib/analytics/buddyAdvice";
import { CockpitHero } from "@/components/edgepilot/CockpitHero";
import { ExecutiveCardsRow } from "@/components/edgepilot/ExecutiveCardsRow";
import { DetailedAnalysis } from "@/components/edgepilot/DetailedAnalysis";

// ============================================================
// PropEdge — EdgePilot page (V3: premium executive cockpit)
// ============================================================
// This file's only job is to compute (unchanged from V2 — every useMemo
// below is byte-for-byte the same as before this redesign) and hand the
// results to presentation components. No calculation lives here or in
// CockpitHero/ExecutiveCardsRow/DetailedAnalysis — those three only lay
// out and pick copy for values already produced by aiCoach.ts/
// accountabilityEngine.ts/decisionEngine.ts/buddyAdvice.ts.

const DECISION_RANK: Record<Decision, number> = { STOP: 4, TRADE_REDUCED: 3, OBSERVE_ONLY: 2, TRADE: 1 };

export default function EdgePilotPage() {
  const {
    challenges,
    fundedAccounts,
    trades,
    payouts,
    getDashboardKPIs,
    challengesLoading,
    fundedAccountsLoading,
    tradesLoading,
  } = useAccounts();
  const { objective } = useTodayObjective();
  const { getContract, contractsLoading } = useDailyContracts();

  const isLoading = challengesLoading || fundedAccountsLoading || tradesLoading || contractsLoading;
  const today = todayDateString();

  const identity = useMemo(() => getTraderIdentity(trades), [trades]);
  const habits = useMemo(() => getTraderHabits(trades), [trades]);
  const edge = useMemo(() => getTraderEdge(trades), [trades]);
  const blindSpots = useMemo(() => getTraderBlindSpots(trades), [trades]);
  const discipline = useMemo(() => getTraderDiscipline(trades), [trades]);
  const evolution = useMemo(() => getTraderEvolution(trades), [trades]);
  const dataConfidence = useMemo(() => getDataConfidence(trades), [trades]);
  const dashboardKPIs = getDashboardKPIs();

  const coach = useMemo(
    () =>
      getAICoachRecommendation({
        trades,
        challenges,
        fundedAccounts,
        personalAccounts: [],
        payouts,
        dashboardKPIs,
        traderIdentity: identity,
        traderHabits: habits,
        traderEdge: edge,
        traderBlindSpots: blindSpots,
        traderDiscipline: discipline,
        traderEvolution: evolution,
        dataConfidence,
      }),
    [trades, challenges, fundedAccounts, personalAccounts: [], payouts, dashboardKPIs, identity, habits, edge, blindSpots, discipline, evolution, dataConfidence]
  );

  const riskStates = useMemo(
    () => getAccountRiskStates(challenges, fundedAccounts, trades, []),
    [challenges, fundedAccounts, trades]
  );

  const briefings: AccountBriefing[] = useMemo(
    () =>
      getAccountBriefings(
        {
          trades,
          challenges,
          fundedAccounts,
          personalAccounts: [],
          payouts,
          traderIdentity: identity,
          traderHabits: habits,
          traderEdge: edge,
          traderBlindSpots: blindSpots,
          traderDiscipline: discipline,
          traderEvolution: evolution,
          dataConfidence,
        },
        objective ?? undefined
      ),
    [trades, challenges, fundedAccounts, personalAccounts: [], payouts, identity, habits, edge, blindSpots, discipline, evolution, dataConfidence, objective]
  );

  // One Decision Engine + Accountability Engine pass per active account —
  // the reused `discipline` behaviour score is portfolio-wide (same
  // convention aiCoach.ts's classifyBriefingMode already applies to every
  // account), only the trades/contract/deviations are account-scoped.
  const accountEvaluations = useMemo(
    () =>
      briefings.map((briefing) => {
        const accountTrades = trades.filter((t) => t.accountId === briefing.account.id && t.accountType === briefing.account.type);
        const contract = getContract(briefing.account.type, briefing.account.id, today);
        const deviations = computeDeviations(contract, accountTrades, briefing.mode);
        const accountability = computeDailyAccountability(contract, accountTrades, briefing.mode, discipline);
        const decision = getAccountDecision(briefing, contract, deviations, discipline);
        return { briefing, contract, decision, accountability };
      }),
    [briefings, trades, getContract, today, discipline]
  );

  const worstDecision: Decision | null = useMemo(() => {
    if (accountEvaluations.length === 0) return null;
    return [...accountEvaluations].sort((a, b) => DECISION_RANK[b.decision.decision] - DECISION_RANK[a.decision.decision])[0].decision
      .decision;
  }, [accountEvaluations]);

  const allDeviationsToday = useMemo(() => accountEvaluations.flatMap((e) => e.accountability.deviations), [accountEvaluations]);

  // ── Presentation-only selection (V3 cockpit) ──────────────────────────
  // Everything below just picks among the values already computed above —
  // no new calculation. The "primary" account reuses the exact same
  // "worst decision wins" account V2's hero already used.
  const primaryEvaluation = accountEvaluations.find((e) => e.decision.decision === worstDecision) ?? accountEvaluations[0] ?? null;
  const primaryRiskState = primaryEvaluation
    ? riskStates.find((s) => s.account.type === primaryEvaluation.briefing.account.type && s.account.id === primaryEvaluation.briefing.account.id) ?? null
    : null;
  const healthState = primaryEvaluation ? getAccountHealthState(primaryEvaluation.briefing.mode) : null;
  const biggestRisk = getBiggestRisk(primaryEvaluation?.accountability.deviations ?? [], discipline);
  const buddyAdvice = primaryEvaluation
    ? getBuddyAdvice(primaryEvaluation.decision.decision, primaryEvaluation.briefing.mode, biggestRisk)
    : "Add an account to get today's briefing.";
  const heroQuote = getHeroQuote(today);
  const keyTakeaway = getKeyTakeaway(biggestRisk, today);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#298DFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CockpitHero
        primaryEvaluation={primaryEvaluation}
        recommendedRisk={coach.recommendedRisk}
        nextBestAction={coach.nextBestAction}
        buddyAdvice={buddyAdvice}
        heroQuote={heroQuote}
        healthState={healthState}
      />

      <ExecutiveCardsRow
        primaryEvaluation={primaryEvaluation}
        healthState={healthState}
        riskState={primaryRiskState}
        recommendedRisk={coach.recommendedRisk}
        biggestRisk={biggestRisk}
        keyTakeaway={keyTakeaway}
      />

      <DetailedAnalysis
        accountEvaluations={accountEvaluations}
        riskStates={riskStates}
        coach={coach}
        challenges={challenges}
        fundedAccounts={fundedAccounts}
        personalAccounts={[]}
        trades={trades}
        discipline={discipline}
        edge={edge}
        allDeviationsToday={allDeviationsToday}
      />
    </div>
  );
}
