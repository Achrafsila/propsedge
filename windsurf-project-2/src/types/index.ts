export type ChallengeStatus = "active" | "failed" | "passed" | "refunded" | "step1_completed";
export type FundedAccountStatus = "active" | "breached" | "closed";
export type PayoutStatus = "pending" | "paid" | "rejected";
export type TradeStatus = "win" | "loss" | "breakeven";
export type PersonalAccountStatus = "active" | "inactive" | "archived";

export interface ChallengeType {
  id: string;
  propFirmName: string;
  planName: string;
  accountSize: number;
  purchaseCost: number;
  challengeType: '1-step' | '2-step' | 'instant';
  profitTarget: number;
  step1ProfitTarget?: number; // Percentage for 2-step challenges
  step2ProfitTarget?: number; // Percentage for 2-step challenges
  maxDrawdown: number;
  drawdownMode: 'EOD' | 'Daily' | 'Trailing';
  dailyDrawdown: number | null;
  maxContracts: number;
  minTradingDays: number | null;
  consistencyRule: string | null;
  newsTrading: string;
  payoutDays: number | null;
  minPayout: number | null;
  maxPayoutRequest: number | null;
  payoutSplit: number | null;
  notes: string;
}

export interface Challenge {
  id: string;
  propFirmName: string;
  accountName: string;
  accountSize: number;
  challengeType: string;
  challengeKind?: '1-step' | '2-step' | 'instant'; // Structure of the challenge
  challengeStep?: '1' | '2' | 'instant'; // Current step for 2-step challenges
  step1ProfitTarget?: number; // Profit target for step 1 (2-step)
  step2ProfitTarget?: number; // Profit target for step 2 (2-step)
  purchaseCost: number;
  purchaseDate: string;
  profitTarget: number;
  currentProfit: number;
  maxDrawdown: number;
  remainingDrawdown: number;
  deadline?: string;
  status: ChallengeStatus;
  convertedToFunded?: boolean;
  convertedToFundedAt?: string; // Timestamp the challenge became funded (funding date for KPI math)
  fundedAccountId?: string;
  parentChallengeId?: string;
  createdAt?: string; // DB row creation timestamp — lifecycle-start fallback when purchaseDate is missing
  updatedAt?: string; // DB row update timestamp — funded-date fallback for legacy rows
  // Additional rule fields from presets
  presetId?: string;
  drawdownMode?: 'EOD' | 'Daily' | 'Trailing';
  dailyDrawdown?: number | null;
  maxContracts?: number;
  minTradingDays?: number | null;
  consistencyRule?: string | null;
  newsTrading?: string;
  payoutDays?: number | null;
  minPayout?: number | null;
  maxPayoutRequest?: number | null;
  payoutSplit?: number | null;
  notes?: string;
}

export interface FundedAccount {
  id: string;
  propFirmName: string;
  accountName: string;
  sourceChallengeId?: string;
  accountSize: number;
  planType?: string;
  fundingDate: string;
  initialBalance: number;
  currentBalance: number;
  currentProfit: number;
  maxDrawdown: number;
  remainingDrawdown: number;
  status: FundedAccountStatus;
}

// A bring-your-own-capital account with NO prop firm rules — no challenge
// phase, profit target, payout eligibility, min trading days, or mandatory
// consistency rule. Every guardrail (daily loss, max drawdown, risk per
// trade, consistency) is OPTIONAL and only ever enforced if the user
// explicitly defines it. Persisted client-side only (see
// PersonalAccountsContext) — no Supabase table backs this today, by
// explicit product decision.
// TODO(migration): this is a temporary shape until Personal Accounts move
// to Supabase (see the TODO block atop PersonalAccountsContext.tsx) — at
// that point this becomes a first-class DB-backed entity like Challenge/
// FundedAccount, syncing across devices instead of living in localStorage.
export interface PersonalAccount {
  id: string;
  accountName: string;
  broker?: string;
  initialCapital: number;
  currentEquity: number;
  currency: string;
  createdAt: string;
  dailyLossLimit?: number | null; // percent of initialCapital; null/undefined = no rule
  maxDrawdownLimit?: number | null; // percent of initialCapital; null/undefined = no rule
  riskPerTradePercent?: number | null; // percent of initialCapital per trade; null/undefined = no rule
  personalObjective?: string | null;
  status: PersonalAccountStatus;
}

export interface Payout {
  id: string;
  fundedAccountId: string;
  payoutDate: string;
  generatedProfit: number;
  requestedPayoutAmount: number;
  receivedPayoutAmount: number;
  propFirmSplitPercentage: number;
  status: PayoutStatus;
  notes?: string;
}

export interface Trade {
  id: string;
  accountId: string;
  accountType: "challenge" | "funded" | "personal";
  entryDate: string;
  exitDate: string;
  entryTime?: string;
  exitTime?: string;
  session?: "London" | "New York" | "Asian";
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  status: TradeStatus;
  notes?: string;
  picture?: string;
}

// The daily objective enum a trader picks each morning (mirrors
// TodaysObjective in src/lib/analytics/aiCoach.ts — duplicated here rather
// than imported, since types/index.ts is the base layer every lib/
// analytics file imports FROM, never the reverse).
export type DailyContractObjective =
  | "pass_challenge"
  | "protect_funded"
  | "prepare_payout"
  | "build_consistency"
  | "focus_discipline"
  | "recover_losses";

// EdgePilot V2 — the plan a trader commits to each morning for one account
// on one trading day (see Morning Briefing's Trading Protocol step). Persisted
// to Supabase (supabase/migrations/009_daily_contracts.sql) so the
// Accountability Engine can audit actual trades against it, including for
// Personal Accounts even though PersonalAccount itself is localStorage-only
// — accountId here is just an app-level string, no FK.
export interface DailyContract {
  id: string;
  accountId: string;
  accountType: "challenge" | "funded" | "personal";
  contractDate: string; // "YYYY-MM-DD"
  primaryObjective: DailyContractObjective | null;
  maxRiskPerTrade: number | null;
  maxTrades: number | null;
  stopAfterLosses: number | null;
  allowedSessions: ("London" | "New York" | "Asian")[]; // [] = no restriction
  allowedInstruments: string[]; // [] = no restriction
  specialRules: string | null;
  committedAt: string;
}

export interface FundingRateStats {
  totalChallengesPurchased: number;
  activeChallenges: number;
  failedChallenges: number;
  passedChallenges: number;
  convertedToFunded: number;
  fundingRatePercentage: number;
  totalChallengeCost: number;
}

export interface ROIStats {
  totalChallengeCosts: number;
  totalPayoutsReceived: number;
  netProfit: number;
  roiPercentage: number;
}

export interface DashboardKPIs {
  totalChallengeCosts: number;
  totalPayoutsReceived: number;
  netROI: number;
  roiPercentage: number;
  fundingRate: number;
  totalFundedCapital: number;
  activeFundedAccounts: number;
  breachedFundedAccounts: number;
  activeChallengeAccounts: number;
  averageTimeToFundedDays: number | null;
  timeToFundedSampleSize: number;
}
