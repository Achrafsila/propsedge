import { MarketIntelligence, buildUnavailableIntelligence, isMarketIntelligence } from "./types";

// ============================================================
// PropEdge — Market Intelligence client fetch (client-safe)
// ============================================================
// Imports ONLY types (no provider modules, no process.env) so it's safe in
// client components. Hits the server route, which owns the API keys. Always
// resolves to a well-formed MarketIntelligence — on any failure it returns a
// clean "unavailable" object, so callers never need their own error state.

function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export async function fetchMarketIntelligence(): Promise<MarketIntelligence> {
  const tz = resolveTimezone();
  try {
    const res = await fetch(`/api/market-intelligence?tz=${encodeURIComponent(tz)}`);
    if (!res.ok) return buildUnavailableIntelligence(tz);
    const data: unknown = await res.json();
    return isMarketIntelligence(data) ? data : buildUnavailableIntelligence(tz);
  } catch {
    return buildUnavailableIntelligence(tz);
  }
}

export function buildInitialIntelligence(): MarketIntelligence {
  return buildUnavailableIntelligence(resolveTimezone());
}
