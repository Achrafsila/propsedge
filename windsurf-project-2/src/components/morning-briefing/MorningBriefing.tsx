"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useAccounts } from "@/context/AccountsContext";
import { useTodayObjective } from "@/context/TodayObjectiveContext";
import { useDailyContracts } from "@/context/DailyContractsContext";
import { todayDateString } from "@/lib/dateKey";
import { getFirstName } from "@/lib/userDisplay";
import { getTraderIdentity } from "@/lib/analytics/traderIdentity";
import { getTraderHabits } from "@/lib/analytics/traderHabits";
import { getTraderEdge } from "@/lib/analytics/traderEdge";
import { getTraderBlindSpots } from "@/lib/analytics/traderBlindSpots";
import { getTraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { getTraderEvolution } from "@/lib/analytics/traderEvolution";
import { getDataConfidence } from "@/lib/analytics/dataConfidence";
import { getAccountBriefings, getAccountRiskStates } from "@/lib/analytics/aiCoach";
import { buildContractDraft, getAccountInstrumentOptions, validateContractDraft, DailyContractDraft } from "@/lib/analytics/dailyContract";
import { getEdgePilotInsight, getDailyMotivation } from "@/lib/analytics/morningBriefing";
import { STEP_ORDER } from "./types";
import { WelcomeStep } from "./WelcomeStep";
import { ObjectiveStep } from "./ObjectiveStep";
import { TodaysRulesStep } from "./TodaysRulesStep";
import { TradingProtocolStep, accountKey } from "./TradingProtocolStep";
import { AccountHealthStep } from "./AccountHealthStep";
import { InsightStep } from "./InsightStep";
import { MotivationStep } from "./MotivationStep";
import { StartTradingStep } from "./StartTradingStep";

const STORAGE_KEY_PREFIX = "pe_morning_briefing_";

// Only mounted once the daily gate below decides the briefing should show —
// this is what keeps the (fairly heavy — 6 Trader DNA engines + aiCoach)
// computation from re-running on every route navigation for the rest of the
// day; MorningBriefing itself only ever runs the cheap loading-flag checks.
function MorningBriefingContent({ user, onDismiss }: { user: User; onDismiss: () => void }) {
  const { challenges, fundedAccounts, personalAccounts, trades, payouts } = useAccounts();
  const { objective, setObjective } = useTodayObjective();
  const { commitContract } = useDailyContracts();

  const [stepIndex, setStepIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, DailyContractDraft>>({});
  const [committing, setCommitting] = useState(false);

  const identity = useMemo(() => getTraderIdentity(trades), [trades]);
  const habits = useMemo(() => getTraderHabits(trades), [trades]);
  const edge = useMemo(() => getTraderEdge(trades), [trades]);
  const blindSpots = useMemo(() => getTraderBlindSpots(trades), [trades]);
  const discipline = useMemo(() => getTraderDiscipline(trades), [trades]);
  const evolution = useMemo(() => getTraderEvolution(trades), [trades]);
  const dataConfidence = useMemo(() => getDataConfidence(trades), [trades]);

  const briefings = useMemo(
    () =>
      getAccountBriefings(
        {
          trades,
          challenges,
          fundedAccounts,
          personalAccounts,
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
    [trades, challenges, fundedAccounts, personalAccounts, payouts, identity, habits, edge, blindSpots, discipline, evolution, dataConfidence, objective]
  );

  const riskStates = useMemo(
    () => getAccountRiskStates(challenges, fundedAccounts, trades, personalAccounts),
    [challenges, fundedAccounts, trades, personalAccounts]
  );

  const today = todayDateString();

  // Seeds a draft for every active account the first time it's seen —
  // never overwrites an in-progress edit, so switching steps and coming
  // back doesn't lose anything the trader already typed.
  useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const b of briefings) {
        const key = accountKey(b);
        if (!next[key]) {
          next[key] = buildContractDraft(b, today);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [briefings, today]);

  const instrumentOptions = useMemo(
    () =>
      Object.fromEntries(
        briefings.map((b) => [accountKey(b), getAccountInstrumentOptions(trades, b.account.id, b.account.type)])
      ),
    [briefings, trades]
  );

  const updateDraft = (key: string, patch: Partial<DailyContractDraft>) =>
    setDrafts((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], ...patch } } : prev));

  const insight = useMemo(() => getEdgePilotInsight(discipline, edge, evolution), [discipline, edge, evolution]);
  const motivation = useMemo(() => getDailyMotivation(discipline, evolution, todayDateString()), [discipline, evolution]);

  const firstName = getFirstName(user);
  const currentStep = STEP_ORDER[stepIndex];

  const allDraftsValid =
    briefings.length === 0 || briefings.every((b) => validateContractDraft(drafts[accountKey(b)] ?? buildContractDraft(b, today)).valid);

  const canContinue =
    currentStep === "objective" ? objective !== null : currentStep === "trading_protocol" ? allDraftsValid && !committing : true;

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleStart = () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}`, todayDateString());
    onDismiss();
  };

  // "I Commit" persists every account's Daily Contract to Supabase before
  // advancing — this is the one moment in the whole flow that actually
  // writes anything besides the localStorage gate flag.
  const handleContinue = async () => {
    if (currentStep !== "trading_protocol") {
      goNext();
      return;
    }
    setCommitting(true);
    try {
      for (const b of briefings) {
        const draft = drafts[accountKey(b)];
        if (!draft) continue;
        await commitContract({ ...draft, primaryObjective: objective ?? null });
      }
      goNext();
    } catch (error) {
      console.error("[MorningBriefing] Failed to commit today's Trading Contract:", error);
    } finally {
      setCommitting(false);
    }
  };

  const continueLabel =
    currentStep === "welcome" ? "Start Briefing" : currentStep === "trading_protocol" ? (committing ? "Committing…" : "I Commit") : "Continue";

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 overflow-y-auto"
      style={{ background: "#030712" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px]"
        style={{ background: "radial-gradient(80% 60% at 50% -10%, rgba(41,141,255,0.18) 0%, rgba(41,141,255,0) 60%)" }}
      />
      <div className="relative w-full max-w-2xl py-8">
        <div className="flex items-center justify-center gap-1.5 mb-10">
          {STEP_ORDER.map((step, i) => (
            <div
              key={step}
              className="h-1 rounded-full transition-all duration-300"
              style={{ width: i === stepIndex ? 24 : 8, background: i <= stepIndex ? "#298DFF" : "rgba(148,163,184,0.2)" }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {currentStep === "welcome" && <WelcomeStep firstName={firstName} />}
            {currentStep === "account_health" && <AccountHealthStep briefings={briefings} riskStates={riskStates} />}
            {currentStep === "todays_rules" && <TodaysRulesStep briefings={briefings} />}
            {currentStep === "insight" && <InsightStep insight={insight} />}
            {currentStep === "objective" && <ObjectiveStep objective={objective} onSelect={setObjective} />}
            {currentStep === "trading_protocol" && (
              <TradingProtocolStep briefings={briefings} drafts={drafts} onDraftChange={updateDraft} instrumentOptions={instrumentOptions} />
            )}
            {currentStep === "motivation" && <MotivationStep motivation={motivation} />}
            {currentStep === "start_trading" && <StartTradingStep onStart={handleStart} />}
          </motion.div>
        </AnimatePresence>

        {currentStep !== "start_trading" && (
          <div className="flex items-center justify-between mt-10">
            <div>
              {stepIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="border-[rgba(148,163,184,0.2)] text-[#94A3B8] hover:bg-[rgba(148,163,184,0.08)] rounded-xl pointer-events-auto"
                >
                  Back
                </Button>
              )}
            </div>
            <Button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] transition-all duration-300 text-white rounded-xl px-6 pointer-events-auto disabled:opacity-40 disabled:pointer-events-none"
            >
              {continueLabel}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Shows once per calendar day, on first login, before the normal app is
// usable — gated by a localStorage "last completed date" per user (no
// Supabase schema change). Only runs the cheap loading-flag checks itself;
// MorningBriefingContent (the actual 8-step flow, and its Trader DNA/aiCoach
// computation) only mounts once the gate decides to show it.
export function MorningBriefing() {
  const { user } = useAuth();
  const { challengesLoading, fundedAccountsLoading, tradesLoading, payoutsLoading } = useAccounts();

  const [visible, setVisible] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (hasChecked || !user) return;
    if (challengesLoading || fundedAccountsLoading || tradesLoading || payoutsLoading) return;
    setHasChecked(true);
    const lastShown = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
    if (lastShown !== todayDateString()) {
      setVisible(true);
    }
  }, [user, challengesLoading, fundedAccountsLoading, tradesLoading, payoutsLoading, hasChecked]);

  return (
    <AnimatePresence>
      {visible && user && <MorningBriefingContent key="morning-briefing" user={user} onDismiss={() => setVisible(false)} />}
    </AnimatePresence>
  );
}
