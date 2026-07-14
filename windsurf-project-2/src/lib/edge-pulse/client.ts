import type { InstrumentKey } from "@/lib/market/types";
import type { EdgePulseBrief } from "./composeEdgePulse";

// ============================================================
// Edge Pulse — client fetch (client-safe)
// ============================================================
// Imports ONLY types (no provider modules, no process.env) so it's safe in
// client components. Hits the server route, which owns the API keys.
// Per-instrument, in-memory, session-lifetime cache: switching between
// instruments already loaded this page-load never refetches — the
// multi-timeframe payload is heavier than MarketIntelligence's, so this
// matters more here than it did for the old eager-fetch-everything page.

const cache = new Map<InstrumentKey, EdgePulseBrief>();

function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function isEdgePulseResult(value: unknown): value is { symbol: string; brief: EdgePulseBrief } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.symbol !== "string" || typeof v.brief !== "object" || v.brief === null) return false;
  const brief = v.brief as Record<string, unknown>;
  return (
    typeof brief.overallBias === "string" &&
    typeof brief.structure === "object" &&
    typeof brief.liquidity === "object" &&
    Array.isArray(brief.supplyDemandByTimeframe) &&
    typeof brief.institutionalLevels === "object" &&
    typeof brief.catalyst === "object"
  );
}

// Returns null on any failure (invalid symbol, network error, malformed
// response) — callers render their own "unavailable" state, same
// convention as fetchMarketIntelligence's "always resolves cleanly" rule,
// just with null instead of a synthetic unavailable object (Edge Pulse has
// no single well-formed "everything empty" Brief to fall back to).
export async function fetchEdgePulse(symbol: InstrumentKey, options?: { forceRefresh?: boolean }): Promise<EdgePulseBrief | null> {
  if (!options?.forceRefresh) {
    const cached = cache.get(symbol);
    if (cached) return cached;
  }

  const tz = resolveTimezone();
  try {
    const res = await fetch(`/api/edge-pulse?symbol=${encodeURIComponent(symbol)}&tz=${encodeURIComponent(tz)}`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!isEdgePulseResult(data)) return null;
    cache.set(symbol, data.brief);
    return data.brief;
  } catch {
    return null;
  }
}

export function clearEdgePulseCache(symbol?: InstrumentKey): void {
  if (symbol) cache.delete(symbol);
  else cache.clear();
}
