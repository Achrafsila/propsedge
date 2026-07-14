import assert from "node:assert/strict";
import { computeCatalyst, NO_CATALYST_MESSAGE } from "../src/lib/edge-pulse/engines/catalystEngine";
import { EconomicEvent } from "../src/lib/market/types";

// ============================================================
// Edge Pulse — Catalyst Engine deterministic scenarios
// ============================================================
// No network. Run: npx tsx scripts/catalyst-engine-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

function event(overrides: Partial<EconomicEvent>): EconomicEvent {
  return {
    id: "evt-1",
    title: "Generic Event",
    country: null,
    currency: null,
    scheduledAt: "2026-07-14T12:00:00Z",
    impact: "unknown",
    previous: null,
    estimate: null,
    actual: null,
    source: "finnhub",
    ...overrides,
  };
}

const NOW = new Date("2026-07-14T18:00:00Z"); // Tuesday

scenario("No events at all -> fallback message, both catalysts null", () => {
  const result = computeCatalyst("EURUSD", [], NOW);
  assert.equal(result.todaysCatalyst, null);
  assert.equal(result.weeklyCatalyst, null);
  assert.equal(result.fallbackMessage, NO_CATALYST_MESSAGE);
});

scenario("Relevant FOMC event scheduled today -> Today's Catalyst, source Central Bank", () => {
  const events = [event({ id: "e1", title: "FOMC Rate Decision", currency: "USD", impact: "high", scheduledAt: "2026-07-14T14:00:00Z" })];
  const result = computeCatalyst("XAUUSD", events, NOW);
  assert.ok(result.todaysCatalyst);
  assert.equal(result.todaysCatalyst?.title, "FOMC Rate Decision");
  assert.equal(result.todaysCatalyst?.source, "Central Bank");
  assert.equal(result.fallbackMessage, null);
});

scenario("Irrelevant currency/title for the instrument -> not matched, fallback fires", () => {
  // Deliberately avoids every RELEVANCE_RULES keyword (no "rate decision"/
  // "rate hike"/etc — those are macro-USD keywords that would legitimately
  // match EURUSD regardless of currency) and uses a non-matching currency.
  const events = [event({ id: "e2", title: "Japan Tankan Manufacturing Survey", currency: "JPY", impact: "high" })];
  const result = computeCatalyst("EURUSD", events, NOW);
  assert.equal(result.todaysCatalyst, null);
  assert.equal(result.fallbackMessage, NO_CATALYST_MESSAGE);
});

scenario("Multiple events today, different impact -> highest impact wins", () => {
  const events = [
    event({ id: "low1", title: "US Nonfarm Payrolls", currency: "USD", impact: "low", scheduledAt: "2026-07-14T13:00:00Z" }),
    event({ id: "high1", title: "US CPI Inflation", currency: "USD", impact: "high", scheduledAt: "2026-07-14T15:00:00Z" }),
  ];
  const result = computeCatalyst("US30", events, NOW);
  assert.equal(result.todaysCatalyst?.title, "US CPI Inflation");
  assert.equal(result.todaysCatalyst?.source, "Inflation");
});

scenario("A distinct, later-in-week event (not today) -> Weekly Catalyst, separate from Today's", () => {
  const events = [
    event({ id: "today1", title: "US Nonfarm Payrolls", currency: "USD", impact: "medium", scheduledAt: "2026-07-14T13:00:00Z" }),
    event({ id: "week1", title: "ECB Rate Decision", currency: "EUR", impact: "high", scheduledAt: "2026-07-16T12:00:00Z" }), // Thursday, same ISO week
  ];
  const result = computeCatalyst("EURUSD", events, NOW);
  assert.equal(result.todaysCatalyst?.title, "US Nonfarm Payrolls");
  assert.ok(result.weeklyCatalyst, "a distinct weekly catalyst was found");
  assert.equal(result.weeklyCatalyst?.title, "ECB Rate Decision");
  assert.equal(result.weeklyCatalyst?.source, "Central Bank");
});

scenario("Weekly candidate is the SAME event as Today's -> weeklyCatalyst omitted, never duplicated", () => {
  const events = [event({ id: "solo", title: "US CPI Inflation", currency: "USD", impact: "high", scheduledAt: "2026-07-14T13:00:00Z" })];
  const result = computeCatalyst("XAUUSD", events, NOW);
  assert.ok(result.todaysCatalyst);
  assert.equal(result.weeklyCatalyst, null);
});

scenario("Event outside this ISO week entirely -> excluded from both buckets", () => {
  const events = [event({ id: "faraway", title: "US CPI Inflation", currency: "USD", impact: "high", scheduledAt: "2026-08-01T12:00:00Z" })];
  const result = computeCatalyst("XAUUSD", events, NOW);
  assert.equal(result.todaysCatalyst, null);
  assert.equal(result.weeklyCatalyst, null);
  assert.equal(result.fallbackMessage, NO_CATALYST_MESSAGE);
});

scenario("Source classification: geopolitics keyword -> Geopolitics; unclassified but relevant -> Economic Calendar", () => {
  const geo = computeCatalyst("XAUUSD", [event({ id: "g1", title: "Middle East Conflict Escalation", currency: "USD", impact: "medium" })], NOW);
  assert.equal(geo.todaysCatalyst?.source, "Geopolitics");

  const generic = computeCatalyst("XAUUSD", [event({ id: "gen1", title: "Gold Reserves Report", currency: "USD", impact: "low" })], NOW);
  assert.equal(generic.todaysCatalyst?.source, "Economic Calendar");
});

console.log(`\n${pass} scenario(s) passed.`);
