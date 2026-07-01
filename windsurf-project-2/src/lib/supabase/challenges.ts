import { createClient } from "@/lib/supabase/client";
import { Challenge, ChallengeStatus } from "@/types";

// ─── DB row shape ──────────────────────────────────────────────────────────────
interface ChallengeRow {
  id: string;
  user_id: string;
  prop_firm: string;
  account_name: string;
  account_size: number;
  plan_type: string | null;
  challenge_kind: string | null;
  challenge_step: string | null;
  step1_profit_target: number | null;
  step2_profit_target: number | null;
  purchase_cost: number;
  purchase_date: string;
  profit_target: number;
  current_profit: number;
  max_drawdown: number;
  remaining_drawdown: number;
  deadline: string | null;
  status: string;
  converted_to_funded: boolean;
  funded_account_id: string | null;
  preset_id: string | null;
  drawdown_mode: string | null;
  daily_drawdown: number | null;
  max_contracts: number | null;
  min_trading_days: number | null;
  consistency_rule: string | null;
  news_trading: string | null;
  payout_days: number | null;
  min_payout: number | null;
  max_payout_request: number | null;
  payout_split: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── DB → TypeScript ──────────────────────────────────────────────────────────
function rowToChallenge(row: ChallengeRow): Challenge {
  return {
    id:                 row.id,
    propFirmName:       row.prop_firm,
    accountName:        row.account_name,
    accountSize:        row.account_size,
    challengeType:      row.plan_type ?? "",
    challengeKind:      (row.challenge_kind as Challenge["challengeKind"]) ?? undefined,
    challengeStep:      (row.challenge_step as Challenge["challengeStep"]) ?? undefined,
    step1ProfitTarget:  row.step1_profit_target ?? undefined,
    step2ProfitTarget:  row.step2_profit_target ?? undefined,
    purchaseCost:       row.purchase_cost,
    purchaseDate:       row.purchase_date,
    profitTarget:       row.profit_target,
    currentProfit:      row.current_profit,
    maxDrawdown:        row.max_drawdown,
    remainingDrawdown:  row.remaining_drawdown,
    deadline:           row.deadline ?? undefined,
    status:             row.status as ChallengeStatus,
    convertedToFunded:  row.converted_to_funded,
    fundedAccountId:    row.funded_account_id ?? undefined,
    presetId:           row.preset_id ?? undefined,
    drawdownMode:       (row.drawdown_mode as Challenge["drawdownMode"]) ?? undefined,
    dailyDrawdown:      row.daily_drawdown,
    maxContracts:       row.max_contracts ?? undefined,
    minTradingDays:     row.min_trading_days,
    consistencyRule:    row.consistency_rule,
    newsTrading:        row.news_trading ?? undefined,
    payoutDays:         row.payout_days,
    minPayout:          row.min_payout,
    maxPayoutRequest:   row.max_payout_request,
    payoutSplit:        row.payout_split,
    notes:              row.notes ?? undefined,
  };
}

// ─── TypeScript (full) → DB insert row ───────────────────────────────────────
function challengeToInsertRow(challenge: Omit<Challenge, "id">, userId: string) {
  return {
    user_id:             userId,
    prop_firm:           challenge.propFirmName,
    account_name:        challenge.accountName,
    account_size:        challenge.accountSize,
    plan_type:           challenge.challengeType || null,
    challenge_kind:      challenge.challengeKind ?? null,
    challenge_step:      challenge.challengeStep ?? null,
    step1_profit_target: challenge.step1ProfitTarget ?? null,
    step2_profit_target: challenge.step2ProfitTarget ?? null,
    purchase_cost:       challenge.purchaseCost,
    purchase_date:       challenge.purchaseDate,
    profit_target:       challenge.profitTarget,
    current_profit:      challenge.currentProfit,
    max_drawdown:        challenge.maxDrawdown,
    remaining_drawdown:  challenge.remainingDrawdown,
    deadline:            challenge.deadline ?? null,
    status:              challenge.status,
    converted_to_funded: challenge.convertedToFunded ?? false,
    funded_account_id:   challenge.fundedAccountId ?? null,
    preset_id:           challenge.presetId ?? null,
    drawdown_mode:       challenge.drawdownMode ?? null,
    daily_drawdown:      challenge.dailyDrawdown ?? null,
    max_contracts:       challenge.maxContracts ?? null,
    min_trading_days:    challenge.minTradingDays ?? null,
    consistency_rule:    challenge.consistencyRule ?? null,
    news_trading:        challenge.newsTrading ?? null,
    payout_days:         challenge.payoutDays ?? null,
    min_payout:          challenge.minPayout ?? null,
    max_payout_request:  challenge.maxPayoutRequest ?? null,
    payout_split:        challenge.payoutSplit ?? null,
    notes:               challenge.notes ?? null,
  };
}

// ─── TypeScript (partial) → DB update row ────────────────────────────────────
function challengeToUpdateRow(updates: Partial<Challenge>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.propFirmName      !== undefined) row.prop_firm            = updates.propFirmName;
  if (updates.accountName       !== undefined) row.account_name         = updates.accountName;
  if (updates.accountSize       !== undefined) row.account_size         = updates.accountSize;
  if (updates.challengeType     !== undefined) row.plan_type            = updates.challengeType || null;
  if (updates.challengeKind     !== undefined) row.challenge_kind       = updates.challengeKind ?? null;
  if (updates.challengeStep     !== undefined) row.challenge_step       = updates.challengeStep ?? null;
  if (updates.step1ProfitTarget !== undefined) row.step1_profit_target  = updates.step1ProfitTarget ?? null;
  if (updates.step2ProfitTarget !== undefined) row.step2_profit_target  = updates.step2ProfitTarget ?? null;
  if (updates.purchaseCost      !== undefined) row.purchase_cost        = updates.purchaseCost;
  if (updates.purchaseDate      !== undefined) row.purchase_date        = updates.purchaseDate;
  if (updates.profitTarget      !== undefined) row.profit_target        = updates.profitTarget;
  if (updates.currentProfit     !== undefined) row.current_profit       = updates.currentProfit;
  if (updates.maxDrawdown       !== undefined) row.max_drawdown         = updates.maxDrawdown;
  if (updates.remainingDrawdown !== undefined) row.remaining_drawdown   = updates.remainingDrawdown;
  if (updates.deadline          !== undefined) row.deadline             = updates.deadline ?? null;
  if (updates.status            !== undefined) row.status               = updates.status;
  if (updates.convertedToFunded !== undefined) row.converted_to_funded  = updates.convertedToFunded;
  if (updates.fundedAccountId   !== undefined) row.funded_account_id    = updates.fundedAccountId ?? null;
  if (updates.presetId          !== undefined) row.preset_id            = updates.presetId ?? null;
  if (updates.drawdownMode      !== undefined) row.drawdown_mode        = updates.drawdownMode ?? null;
  if (updates.dailyDrawdown     !== undefined) row.daily_drawdown       = updates.dailyDrawdown ?? null;
  if (updates.maxContracts      !== undefined) row.max_contracts        = updates.maxContracts ?? null;
  if (updates.minTradingDays    !== undefined) row.min_trading_days     = updates.minTradingDays ?? null;
  if (updates.consistencyRule   !== undefined) row.consistency_rule     = updates.consistencyRule ?? null;
  if (updates.newsTrading       !== undefined) row.news_trading         = updates.newsTrading ?? null;
  if (updates.payoutDays        !== undefined) row.payout_days          = updates.payoutDays ?? null;
  if (updates.minPayout         !== undefined) row.min_payout           = updates.minPayout ?? null;
  if (updates.maxPayoutRequest  !== undefined) row.max_payout_request   = updates.maxPayoutRequest ?? null;
  if (updates.payoutSplit       !== undefined) row.payout_split         = updates.payoutSplit ?? null;
  if (updates.notes             !== undefined) row.notes                = updates.notes ?? null;

  return row;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchChallenges(userId: string): Promise<Challenge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("challenge_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ChallengeRow[]).map(rowToChallenge);
}

export async function insertChallenge(
  userId: string,
  challenge: Omit<Challenge, "id">
): Promise<Challenge> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("challenge_accounts")
    .insert(challengeToInsertRow(challenge, userId))
    .select()
    .single();

  if (error) throw error;
  return rowToChallenge(data as ChallengeRow);
}

export async function updateChallengeDb(
  id: string,
  updates: Partial<Challenge>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("challenge_accounts")
    .update(challengeToUpdateRow(updates))
    .eq("id", id);

  if (error) throw error;
}

export async function deleteChallengeDb(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("challenge_accounts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
