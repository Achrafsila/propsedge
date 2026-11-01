import type { Trade } from "@/types";

// Only use trades with both complete entry and exit timestamps.
// Missing/identical timestamps cannot establish a reliable holding duration.
export function getHoldingMinutes(trade: Trade): number | null {
  if (!trade.entryDate || !trade.exitDate || !trade.entryTime || !trade.exitTime) return null;
  const parse = (date: string, time: string): number | null => {
    const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match || +match[1] > 23 || +match[2] > 59 || +(match[3] || 0) > 59) return null;
    const ts = Date.parse(`${date}T${match[1].padStart(2, "0")}:${match[2]}:${match[3] || "00"}`);
    return Number.isFinite(ts) ? ts : null;
  };
  const start = parse(trade.entryDate, trade.entryTime);
  const end = parse(trade.exitDate, trade.exitTime);
  if (start === null || end === null || end <= start) return null;
  return (end - start) / 60000;
}

export function formatHoldingDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} seconds`;
  if (minutes < 60) return `${Math.round(minutes)} minutes`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hours`;
  return `${(minutes / 1440).toFixed(1)} days`;
}
