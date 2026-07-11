import assert from "node:assert/strict";
import { DailyContract, Trade, TradeStatus } from "../src/types";
import { AccountBriefing, BriefingMode } from "../src/lib/analytics/aiCoach";
import { TraderDiscipline } from "../src/lib/analytics/traderDiscipline";
import { computeDeviations, computeDailyAccountability, Deviation } from "../src/lib/analytics/accountabilityEngine";
import { getAccountDecision } from "../src/lib/analytics/decisionEngine";

// ============================================================
// PropEdge — EdgePilot V2 deterministic scenario checks
// ============================================================
// No test framework exists in this repo — run with `npx tsx
// scripts/edgepilot-scenarios.ts`. Plain node:assert calls, exits non-zero
// on the first failure so it's usable as a CI gate later without adding a
// new dependency. Each scenario builds fixture Trade/DailyContract/
// AccountBriefing data and asserts the real engine functions (never
// reimplemented/mocked) produce the expected violations/decision.

const TODAY = "2026-07-11";

let passCount = 0;

function scenario(name: string, fn: () => void) {
  fn();
  passCount++;
  console.log(`  ok — ${name}`);
}

// ── Fixtures ──────────────────────────────────────────────────────────────

let tradeSeq = 0;
function makeTrade(overrides: Partial<Trade> & { pnl: number }): Trade {
  tradeSeq++;
  const status: TradeStatus = overrides.status ?? (overrides.pnl > 0 ? "win" : overrides.pnl < 0 ? "loss" : "breakeven");
  return {
    id: `t-${tradeSeq}`,
    accountId: "acct-1",
    accountType: "challenge",
    entryDate: TODAY,
    exitDate: TODAY,
    entryTime: "09:00",
    exitTime: "09:05",
    session: "London",
    symbol: "XAUUSD",
    direction: "long",
    entryPrice: 2000,
    exitPrice: 2000,
    quantity: 1,
    ...overrides,
    status,
  };
}

function makeContract(overrides: Partial<DailyContract> = {}): DailyContract {
  return {
    id: "contract-1",
    accountId: "acct-1",
    accountType: "challenge",
    contractDate: TODAY,
    primaryObjective: null,
    maxRiskPerTrade: null,
    maxTrades: null,
    stopAfterLosses: null,
    allowedSessions: [],
    allowedInstruments: [],
    specialRules: null,
    committedAt: `${TODAY}T08:00:00Z`,
    ...overrides,
  };
}

function makeBriefing(overrides: Partial<AccountBriefing> = {}): AccountBriefing {
  return {
    account: {
      id: "acct-1",
      type: "challenge",
      name: "Test Account",
      accountSize: 50000,
      currentProfit: 0,
      maxDrawdown: 2500,
      dailyDrawdown: 1250,
      riskPerTradePercent: null,
    },
    mode: "normal",
    modeLabel: "Normal",
    recommendedRisk: { amount: 100, rationale: "test fixture" },
    maxTrades: 3,
    stopAfterLosses: 2,
    remainingTarget: null,
    healthTier: "healthy",
    healthLabel: "Healthy",
    ...overrides,
  };
}

function emptyInsight(label: string) {
  return { label, value: "Not enough data", metricLabel: "", narrative: "", sampleSize: 0 };
}

// Bypasses recomputing the real Trader DNA algorithm from a fabricated
// trade history — decisionEngine/accountabilityEngine only ever read
// lossDisciplineScore.metricLabel ("NN/100"), so this fixture controls
// exactly that field and leaves every other field in the same
// "Not enough data" shape getTraderDiscipline() itself returns for an
// under-sampled account, keeping the fixture honest about what it does
// and doesn't exercise.
function makeDiscipline(score: number | null): TraderDiscipline {
  return {
    riskConsistency: emptyInsight("Risk Consistency"),
    positionSizeAfterLosses: emptyInsight("Position Size After Losses"),
    lossDisciplineScore:
      score === null
        ? emptyInsight("Loss Discipline Score")
        : { label: "Loss Discipline Score", value: "Needs Attention", metricLabel: `${score}/100`, narrative: "", sampleSize: 20 },
    executiveSummary: "",
    averagePositionSize: [],
    averagePositionSizeNarrative: "",
    positionSizeAfterWins: emptyInsight("Position Size After Wins"),
    lotSizeSweetSpot: [],
    performanceAfterLoss: emptyInsight("Performance After Loss"),
    performanceAfterWin: emptyInsight("Performance After Win"),
    revengeTradingRisk: emptyInsight("Revenge Trading Risk"),
    recoveryRate: emptyInsight("Recovery Rate"),
    revengeTradingScore: emptyInsight("Revenge Trading Score"),
    lossPsychologySummary: "",
    metadata: { sampleSize: 0, tradingDays: 0, firstTrade: null, lastTrade: null },
  };
}

const NEUTRAL_DISCIPLINE = makeDiscipline(null);
const NORMAL_MODE: BriefingMode = "normal";

function findDeviation(deviations: Deviation[], type: Deviation["type"]): Deviation | undefined {
  return deviations.find((d) => d.type === type);
}

// ── Scenarios ────────────────────────────────────────────────────────────

scenario("Max Risk Exceeded — critical when loss > 2x committed risk", () => {
  const contract = makeContract({ maxRiskPerTrade: 25 });
  const trades = [makeTrade({ pnl: -80 })];
  const deviations = computeDeviations(contract, trades, NORMAL_MODE);
  const d = findDeviation(deviations, "max_risk_exceeded");
  assert.ok(d, "expected a max_risk_exceeded violation");
  assert.equal(d!.severity, "critical");
  assert.equal(d!.estimatedCost, 55);
});

scenario("Max Risk Exceeded — high (not critical) just above the ceiling", () => {
  const contract = makeContract({ maxRiskPerTrade: 25 });
  const trades = [makeTrade({ pnl: -30 })];
  const d = findDeviation(computeDeviations(contract, trades, NORMAL_MODE), "max_risk_exceeded");
  assert.ok(d);
  assert.equal(d!.severity, "high");
  assert.equal(d!.estimatedCost, 5);
});

scenario("Trade Count Exceeded — funded account, high severity for a small overage", () => {
  const contract = makeContract({ accountType: "funded", maxTrades: 3 });
  const trades = [1, 2, 3, 4, 5].map((n) => makeTrade({ accountType: "funded", pnl: n === 5 ? -20 : 10, entryTime: `0${n}:00` }));
  const d = findDeviation(computeDeviations(contract, trades, NORMAL_MODE), "trade_count_exceeded");
  assert.ok(d);
  assert.equal(d!.severity, "high"); // overage of 2, below the critical-overage threshold of 3
  assert.equal(d!.estimatedCost, 20);
});

scenario("Trading After Daily Stop — critical, cost is the loss taken past the stop", () => {
  const contract = makeContract({ stopAfterLosses: 2 });
  const trades = [
    makeTrade({ pnl: -30, entryTime: "09:00" }),
    makeTrade({ pnl: -20, entryTime: "10:00" }),
    makeTrade({ pnl: -40, entryTime: "11:00" }), // traded past the stop
  ];
  const d = findDeviation(computeDeviations(contract, trades, NORMAL_MODE), "trading_after_daily_stop");
  assert.ok(d);
  assert.equal(d!.severity, "critical");
  assert.equal(d!.estimatedCost, 40);
});

scenario("Outside Allowed Session — flags a trade outside the committed session", () => {
  const contract = makeContract({ allowedSessions: ["London"] });
  const trades = [makeTrade({ pnl: 15, session: "Asian", entryTime: "03:00" })];
  const d = findDeviation(computeDeviations(contract, trades, NORMAL_MODE), "outside_allowed_session");
  assert.ok(d);
  assert.equal(d!.severity, "medium");
  assert.equal(d!.estimatedCost, 0); // winning trade — no realized cost, still a violation
});

scenario("Outside Allowed Session — session derived from entryTime when not recorded", () => {
  const contract = makeContract({ allowedSessions: ["New York"] });
  const trades = [makeTrade({ pnl: -10, session: undefined, entryTime: "03:00" })]; // falls in the Asian window
  const d = findDeviation(computeDeviations(contract, trades, NORMAL_MODE), "outside_allowed_session");
  assert.ok(d, "expected detectSession() fallback to catch this");
  assert.equal(d!.estimatedCost, 10);
});

scenario("Unauthorized Instrument — flags a symbol outside the committed list", () => {
  const contract = makeContract({ allowedInstruments: ["XAUUSD"] });
  const trades = [makeTrade({ pnl: -12, symbol: "EURUSD" })];
  const d = findDeviation(computeDeviations(contract, trades, NORMAL_MODE), "unauthorized_instrument");
  assert.ok(d);
  assert.equal(d!.severity, "high"); // losing trade
});

scenario("Multiple instruments allowed (empty allowedInstruments) — no false positives", () => {
  const contract = makeContract({ allowedInstruments: [] });
  const trades = [
    makeTrade({ pnl: 10, symbol: "XAUUSD", entryTime: "09:00" }),
    makeTrade({ pnl: -10, symbol: "EURUSD", entryTime: "10:00" }),
    makeTrade({ pnl: 5, symbol: "NDX100", entryTime: "11:00" }),
  ];
  const deviations = computeDeviations(contract, trades, NORMAL_MODE);
  assert.equal(findDeviation(deviations, "unauthorized_instrument"), undefined);
});

scenario("Position Size Escalation — needs 10+ prior trades on the same symbol, Moderate confidence", () => {
  const contract = makeContract();
  const priorTrades = Array.from({ length: 10 }, (_, i) =>
    makeTrade({ pnl: 5, quantity: 1, entryDate: "2026-07-01", exitDate: "2026-07-01", entryTime: `0${i % 9}:00` })
  );
  const todaysTrade = makeTrade({ pnl: -50, quantity: 2 }); // 2x median of 1.0
  const deviations = computeDeviations(contract, [...priorTrades, todaysTrade], NORMAL_MODE);
  const d = findDeviation(deviations, "position_size_escalation");
  assert.ok(d);
  assert.equal(d!.confidence, "Moderate");
});

scenario("Position Size Escalation — High confidence once history reaches the reliable sample size", () => {
  const contract = makeContract();
  const priorTrades = Array.from({ length: 30 }, (_, i) =>
    makeTrade({ pnl: 5, quantity: 1, entryDate: "2026-06-01", exitDate: "2026-06-01", entryTime: `0${i % 9}:00`, id: `prior-${i}` })
  );
  const todaysTrade = makeTrade({ pnl: -50, quantity: 2 });
  const d = findDeviation(computeDeviations(contract, [...priorTrades, todaysTrade], NORMAL_MODE), "position_size_escalation");
  assert.ok(d);
  assert.equal(d!.confidence, "High");
});

scenario("Position Size Escalation — under the sample floor, never flagged (no guessing)", () => {
  const contract = makeContract();
  const priorTrades = Array.from({ length: 5 }, () => makeTrade({ pnl: 5, quantity: 1, entryDate: "2026-07-01" }));
  const todaysTrade = makeTrade({ pnl: -50, quantity: 5 });
  const deviations = computeDeviations(contract, [...priorTrades, todaysTrade], NORMAL_MODE);
  assert.equal(findDeviation(deviations, "position_size_escalation"), undefined);
});

scenario("Revenge Trading Sequence — fast same-size re-entry after a loss", () => {
  const contract = makeContract();
  const trades = [
    makeTrade({ pnl: -40, quantity: 1, entryTime: "10:00", exitTime: "10:05" }),
    makeTrade({ pnl: -20, quantity: 1, entryTime: "10:10", exitTime: "10:15" }), // 5 min later, same size
  ];
  const d = findDeviation(computeDeviations(contract, trades, NORMAL_MODE), "revenge_trading_sequence");
  assert.ok(d);
  assert.equal(d!.severity, "high");
  assert.equal(d!.estimatedCost, 20);
});

scenario("Revenge Trading Sequence — sizing down after a loss is not flagged", () => {
  const contract = makeContract();
  const trades = [
    makeTrade({ pnl: -40, quantity: 2, entryTime: "10:00", exitTime: "10:05" }),
    makeTrade({ pnl: -20, quantity: 1, entryTime: "10:10", exitTime: "10:15" }), // smaller size — disciplined, not revenge
  ];
  const deviations = computeDeviations(contract, trades, NORMAL_MODE);
  assert.equal(findDeviation(deviations, "revenge_trading_sequence"), undefined);
});

scenario("Payout-mode severity escalation — bumps severity and annotates evidence", () => {
  const contract = makeContract({ maxRiskPerTrade: 25 });
  const trades = [makeTrade({ pnl: -30 })]; // normally "high" (not >2x)
  const d = findDeviation(computeDeviations(contract, trades, "payout_protection"), "max_risk_exceeded");
  assert.ok(d);
  assert.equal(d!.severity, "critical");
  assert.ok(d!.evidence.includes("Payout Protection"));
});

scenario("Accountability — grade ignores profitability, weighs rule compliance + behaviour only", () => {
  const contract = makeContract({ maxRiskPerTrade: 25, maxTrades: 10 });
  // A large winning day with zero rule violations should still grade purely
  // off compliance/behaviour, never off the $ profit itself.
  const trades = [makeTrade({ pnl: 5000 })];
  const accountability = computeDailyAccountability(contract, trades, NORMAL_MODE, NEUTRAL_DISCIPLINE);
  assert.equal(accountability.ruleCompliancePercent, 100);
  assert.equal(accountability.grade, "A");
  assert.equal(accountability.estimatedCostOfDeviations, 0);
});

scenario("Accountability — critical + high violations drag compliance and grade down", () => {
  const contract = makeContract({ maxRiskPerTrade: 25, stopAfterLosses: 1 });
  const trades = [
    makeTrade({ pnl: -80, entryTime: "09:00" }), // max risk exceeded, critical (>2x)
    makeTrade({ pnl: -10, entryTime: "10:00" }), // trading after daily stop, critical
  ];
  const accountability = computeDailyAccountability(contract, trades, NORMAL_MODE, NEUTRAL_DISCIPLINE);
  assert.ok(accountability.ruleCompliancePercent <= 20); // two criticals: 100 - 40 - 40
  assert.equal(accountability.grade, "F");
  assert.ok(accountability.biggestDeviation);
});

scenario("Decision Engine — no committed contract forces OBSERVE_ONLY with a clear blocker", () => {
  const briefing = makeBriefing({ mode: "normal" });
  const decision = getAccountDecision(briefing, null, [], NEUTRAL_DISCIPLINE);
  assert.equal(decision.decision, "OBSERVE_ONLY");
  assert.ok(decision.blockers.includes("No Daily Contract committed for today"));
  assert.ok(decision.unlockConditions.includes("Complete Morning Briefing commitment"));
});

scenario("Decision Engine — near-breach mode forces STOP even with zero violations", () => {
  const briefing = makeBriefing({ mode: "near_breach" });
  const contract = makeContract();
  const decision = getAccountDecision(briefing, contract, [], NEUTRAL_DISCIPLINE);
  assert.equal(decision.decision, "STOP");
});

scenario("Decision Engine — a critical deviation forces STOP regardless of mode", () => {
  const briefing = makeBriefing({ mode: "normal" });
  const contract = makeContract({ maxRiskPerTrade: 25 });
  const deviations = computeDeviations(contract, [makeTrade({ pnl: -80 })], briefing.mode);
  const decision = getAccountDecision(briefing, contract, deviations, NEUTRAL_DISCIPLINE);
  assert.equal(decision.decision, "STOP");
  assert.ok(decision.unlockConditions.includes("Complete two disciplined sessions"));
});

scenario("Decision Engine — protection mode with no violations yields TRADE_REDUCED", () => {
  const briefing = makeBriefing({ mode: "protection" });
  const contract = makeContract();
  const decision = getAccountDecision(briefing, contract, [], NEUTRAL_DISCIPLINE);
  assert.equal(decision.decision, "TRADE_REDUCED");
});

scenario("Decision Engine — low Loss Discipline Score alone triggers TRADE_REDUCED and a named blocker", () => {
  const briefing = makeBriefing({ mode: "normal" });
  const contract = makeContract();
  const discipline = makeDiscipline(35);
  const decision = getAccountDecision(briefing, contract, [], discipline);
  assert.equal(decision.decision, "TRADE_REDUCED");
  assert.ok(decision.blockers.includes("Loss Discipline 35"));
});

scenario("Decision Engine — sizing/revenge deviations map to the spec's short blocker phrasing", () => {
  const briefing = makeBriefing({ mode: "normal" });
  const contract = makeContract();
  const priorTrades = Array.from({ length: 10 }, () => makeTrade({ pnl: 5, quantity: 1, entryDate: "2026-07-01" }));
  const sizingTrade = makeTrade({ pnl: -10, quantity: 2 });
  const deviations = computeDeviations(contract, [...priorTrades, sizingTrade], briefing.mode);
  const decision = getAccountDecision(briefing, contract, deviations, NEUTRAL_DISCIPLINE);
  assert.ok(decision.blockers.includes("Sizing instability"));
});

scenario("Decision Engine — clean session on a healthy account yields TRADE with hard rules listed", () => {
  const briefing = makeBriefing({ mode: "growth" });
  const contract = makeContract({ maxRiskPerTrade: 100, maxTrades: 4, stopAfterLosses: 2 });
  const trades = [makeTrade({ pnl: 40 }), makeTrade({ pnl: -30, entryTime: "10:00" })];
  const deviations = computeDeviations(contract, trades, briefing.mode);
  const decision = getAccountDecision(briefing, contract, deviations, NEUTRAL_DISCIPLINE);
  assert.equal(decision.decision, "TRADE");
  assert.equal(decision.unlockConditions.length, 0);
  assert.ok(decision.hardRules.some((r) => r.includes("$100")));
});

scenario("Personal account — full flow (contract, deviations, decision) works identically to challenge/funded", () => {
  const briefing = makeBriefing({
    mode: "normal",
    account: { id: "personal-1", type: "personal", name: "My Capital", accountSize: 10000, currentProfit: 0, maxDrawdown: null, dailyDrawdown: null, riskPerTradePercent: 1 },
  });
  const contract = makeContract({ accountId: "personal-1", accountType: "personal", maxRiskPerTrade: 50, maxTrades: 2 });
  const trades = [
    makeTrade({ accountId: "personal-1", accountType: "personal", pnl: -10, entryTime: "09:00" }),
    makeTrade({ accountId: "personal-1", accountType: "personal", pnl: -15, entryTime: "10:00" }),
    makeTrade({ accountId: "personal-1", accountType: "personal", pnl: -5, entryTime: "11:00" }), // 3rd trade, cap was 2
  ];
  const deviations = computeDeviations(contract, trades, briefing.mode);
  assert.ok(findDeviation(deviations, "trade_count_exceeded"));
  const decision = getAccountDecision(briefing, contract, deviations, NEUTRAL_DISCIPLINE);
  assert.equal(decision.decision, "TRADE_REDUCED");
});

console.log(`\n${passCount} scenario(s) passed.`);
