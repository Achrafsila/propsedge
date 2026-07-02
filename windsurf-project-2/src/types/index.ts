export type ChallengeStatus = "active" | "failed" | "passed" | "refunded" | "step1_completed";
export type FundedAccountStatus = "active" | "breached" | "closed";
export type PayoutStatus = "pending" | "paid" | "rejected";
export type TradeStatus = "win" | "loss" | "breakeven";

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
  fundedAccountId?: string;
  parentChallengeId?: string;
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
  accountType: "challenge" | "funded";
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
}
