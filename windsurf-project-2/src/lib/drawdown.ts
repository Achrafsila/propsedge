// maxDrawdown may be stored as a percentage (e.g. 10 = 10%) or as a raw
// dollar amount (this app's "Max Drawdown ($)" field commonly holds values
// like 2000). No prop firm draws down more than 100% of an account, so any
// value above 100 can only be a dollar figure.
export function resolveDrawdownDollars(maxDrawdown: number, accountSize: number): number {
  const raw = Number(maxDrawdown) || 0;
  return raw <= 100 ? (accountSize * raw) / 100 : raw;
}

export interface DrawdownBreakdown {
  maxDrawdownDollars: number;
  maxDrawdownPercent: number;
  usedDrawdownDollars: number;
  usedDrawdownPercent: number;
  remainingDrawdownDollars: number;
  remainingDrawdownPercent: number;
}

// Drawdown only ever grows from realized losses — a break-even or profitable
// account has used none of its allowed drawdown, regardless of what an
// account row's own persisted remainingDrawdown field says.
export function computeDrawdown(
  maxDrawdown: number,
  accountSize: number,
  currentProfit: number
): DrawdownBreakdown {
  const maxDrawdownDollars = resolveDrawdownDollars(maxDrawdown, accountSize);
  const maxDrawdownPercent = accountSize > 0 ? (maxDrawdownDollars / accountSize) * 100 : 0;
  const usedDrawdownDollars = currentProfit < 0 ? Math.abs(currentProfit) : 0;
  const usedDrawdownPercent = accountSize > 0 ? (usedDrawdownDollars / accountSize) * 100 : 0;
  const remainingDrawdownDollars = Math.max(0, maxDrawdownDollars - usedDrawdownDollars);
  const remainingDrawdownPercent = accountSize > 0 ? (remainingDrawdownDollars / accountSize) * 100 : 0;

  return {
    maxDrawdownDollars,
    maxDrawdownPercent,
    usedDrawdownDollars,
    usedDrawdownPercent,
    remainingDrawdownDollars,
    remainingDrawdownPercent,
  };
}
