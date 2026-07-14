import type { InstrumentMarketHistory } from "../types";
import {
  detectSwings,
  detectBreakout,
  isCompleteCandle,
  classifyDirection,
  DEFAULT_FRACTAL_WING,
  type CompletedCandle,
} from "./swingDetection";

// ============================================================
// PropEdge — Market Regime Engine (deterministic)
// ============================================================
// Pure function: InstrumentMarketHistory -> MarketRegimeResult. No API
// calls, no React, no Supabase, no localStorage, no AI/LLM, and no
// indicator libraries (RSI/MACD/Bollinger/Ichimoku). Classification is
// price structure only: swing highs/lows (5-bar fractal), their
// HH/HL/LH/LL relationship, breakout/failed-breakout against the nearest
// confirmed swing, and range compression when no directional swing pair
// exists yet.
//
// Hard rule: index 0 of dailyCandles is always the currently-forming
// candle (confirmed empirically against the live TwelveData feed) and is
// NEVER analysed. Only fully-formed OHLC candles at index 1+ are used, and
// only those with all four OHLC fields present as numbers.
//
// Foundation-scope engine: not connected to EdgePilot, the API route, or
// any UI yet. Market Pulse / Market Phase / Conviction / Volatility /
// Opportunity / Breakout Engine / Liquidity Engine are explicitly out of
// scope for this iteration and are not implemented here.

export type MarketRegime = "bullish_trend" | "bearish_trend" | "range" | "transition" | "unknown";
export type MarketRegimeConfidence = "low" | "medium" | "high";

export interface MarketRegimeResult {
  symbol: string;
  regime: MarketRegime;
  confidence: MarketRegimeConfidence;
  evidence: string[];
}

// ── Decision-rule constants (every threshold documented, none arbitrary) ──

// A regime read needs at least this many completed daily candles — below
// this, swing detection has too few candles to reliably find even one
// confirmed pivot pair.
const MIN_COMPLETED_CANDLES = 10;

// 5-bar fractal: a candle is a swing point only if it is the strict,
// unique extreme among itself and 2 candles on each side (classic
// Williams-fractal window — small enough to resolve within the multi-week
// history depth this engine gets, large enough to reject single-candle
// noise). Swing detection itself lives in swingDetection.ts (shared with
// Edge Pulse's multi-timeframe engines); this engine always uses the
// default wing size.
const FRACTAL_WING = DEFAULT_FRACTAL_WING;

// At least 2 confirmed swing highs AND 2 confirmed swing lows are required
// before a "latest vs previous" direction can be compared at all.
const MIN_SWINGS_FOR_DIRECTION = 2;

// 3+ confirmed swings on both sides promotes a trend/range read from
// "medium" to "high" confidence — one confirmation beyond the minimum
// comparison pair.
const SWINGS_FOR_HIGH_CONFIDENCE = 3;

// When there isn't enough swing structure to compare direction, the last
// COMPRESSION_LOOKBACK completed candles are checked for range overlap: if
// most consecutive candle ranges overlap, that is compression (a range),
// not "unknown".
const COMPRESSION_LOOKBACK = 6;
const COMPRESSION_OVERLAP_RATIO = 0.6; // >=60% of consecutive pairs must overlap

// Range-compression fallback: how many consecutive completed-candle ranges
// (high/low) overlap with the one before them, over the last
// COMPRESSION_LOOKBACK candles. Heavy overlap with no directional swing
// pair is classified as a range, not "unknown".
function detectCompression(chrono: CompletedCandle[]): { isCompressed: boolean; detail: string } {
  const recent = chrono.slice(-COMPRESSION_LOOKBACK);
  if (recent.length < 2) return { isCompressed: false, detail: "" };

  let overlapCount = 0;
  for (let i = 1; i < recent.length; i++) {
    const overlapHigh = Math.min(recent[i - 1].high, recent[i].high);
    const overlapLow = Math.max(recent[i - 1].low, recent[i].low);
    if (overlapHigh >= overlapLow) overlapCount++;
  }
  const pairs = recent.length - 1;
  const ratio = pairs > 0 ? overlapCount / pairs : 0;
  return {
    isCompressed: ratio >= COMPRESSION_OVERLAP_RATIO,
    detail: `${overlapCount}/${pairs} consecutive candle range(s) overlapped in the last ${recent.length} completed candles (ratio ${ratio.toFixed(2)}).`,
  };
}

export function computeMarketRegime(history: InstrumentMarketHistory): MarketRegimeResult {
  const symbol = history?.symbol ?? "unknown";
  const evidence: string[] = [];

  if (!history || !Array.isArray(history.dailyCandles) || history.dailyCandles.length === 0) {
    return { symbol, regime: "unknown", confidence: "low", evidence: ["No daily candle history provided."] };
  }

  // Rule: index 0 is always the currently-forming candle — never analysed.
  const candidateSlots = history.dailyCandles.slice(1);
  const completed = candidateSlots.filter(isCompleteCandle);

  if (completed.length < candidateSlots.length) {
    evidence.push(
      `${candidateSlots.length - completed.length} of ${candidateSlots.length} completed-slot candle(s) excluded for missing/malformed OHLC fields.`
    );
  }

  if (completed.length < MIN_COMPLETED_CANDLES) {
    evidence.push(`Only ${completed.length} usable completed candle(s); at least ${MIN_COMPLETED_CANDLES} are required to classify market structure.`);
    return { symbol, regime: "unknown", confidence: "low", evidence };
  }

  // dailyCandles is newest-first; swing detection reasons chronologically.
  const chrono = [...completed].reverse();
  const swings = detectSwings(chrono);
  const swingHighs = swings.filter((s) => s.type === "high");
  const swingLows = swings.filter((s) => s.type === "low");

  evidence.push(
    `${swingHighs.length} confirmed swing high(s) and ${swingLows.length} confirmed swing low(s) found across ${chrono.length} completed candles (5-bar fractal, ${FRACTAL_WING} bars each side).`
  );

  const breakout = detectBreakout(chrono, swingHighs, swingLows);
  evidence.push(breakout.detail);

  if (swingHighs.length < MIN_SWINGS_FOR_DIRECTION || swingLows.length < MIN_SWINGS_FOR_DIRECTION) {
    const compression = detectCompression(chrono);
    if (compression.detail) evidence.push(compression.detail);
    if (compression.isCompressed) {
      evidence.push("No confirmed directional swing pair, but recent candle ranges overlap heavily — classified as range (compression).");
      return { symbol, regime: "range", confidence: "low", evidence };
    }
    evidence.push("Insufficient confirmed swing structure and no clear compression — regime cannot be determined.");
    return { symbol, regime: "unknown", confidence: "low", evidence };
  }

  const lastTwoHighs = swingHighs.slice(-2);
  const lastTwoLows = swingLows.slice(-2);
  const highDir = classifyDirection(lastTwoHighs[0].price, lastTwoHighs[1].price);
  const lowDir = classifyDirection(lastTwoLows[0].price, lastTwoLows[1].price);

  evidence.push(
    `Latest two swing highs: ${lastTwoHighs[0].price} (${lastTwoHighs[0].datetime}) -> ${lastTwoHighs[1].price} (${lastTwoHighs[1].datetime}) = ${highDir}.`
  );
  evidence.push(
    `Latest two swing lows: ${lastTwoLows[0].price} (${lastTwoLows[0].datetime}) -> ${lastTwoLows[1].price} (${lastTwoLows[1].datetime}) = ${lowDir}.`
  );

  // ── Base classification: HH/HL, LH/LL, equal/equal, or narrowing ──
  let regime: MarketRegime;
  if (highDir === "higher" && lowDir === "higher") {
    regime = "bullish_trend";
    evidence.push("Higher high and higher low confirmed — bullish trend structure.");
  } else if (highDir === "lower" && lowDir === "lower") {
    regime = "bearish_trend";
    evidence.push("Lower high and lower low confirmed — bearish trend structure.");
  } else if (highDir === "equal" && lowDir === "equal") {
    regime = "range";
    evidence.push("Equal swing highs and equal swing lows — price is oscillating between two fixed levels (range).");
  } else if (highDir === "lower" && lowDir === "higher") {
    regime = "range";
    evidence.push("Lower high and higher low — swing structure is narrowing (compression) inside the prior range.");
  } else {
    regime = "transition";
    evidence.push(`Swing highs and lows disagree (${highDir} highs, ${lowDir} lows) — structure is transitioning, not yet confirmed as trend or range.`);
  }

  // ── Breakout override ──
  // A fresh, still-unconfirmed break of the opposing/boundary level on the
  // very latest completed candle can only ever downgrade toward
  // "transition" — one candle never promotes a new trend on its own; that
  // takes a second confirming swing, which by definition needs at least
  // two more completed candles to exist.
  if (breakout.direction === "bullish" && regime !== "bullish_trend") {
    regime = "transition";
    evidence.push(
      "The latest completed candle broke above the prior swing high — treated as an unconfirmed transition, not yet a bullish trend (needs a second confirming higher low)."
    );
  } else if (breakout.direction === "bearish" && regime !== "bearish_trend") {
    regime = "transition";
    evidence.push(
      "The latest completed candle broke below the prior swing low — treated as an unconfirmed transition, not yet a bearish trend (needs a second confirming lower high)."
    );
  } else if (breakout.failed) {
    evidence.push("The breakout attempt failed to hold by close — supports the range/transition classification over a new trend.");
  }

  // ── Confidence: derived only from deterministic evidence, never a percentage ──
  const swingPairDepth = Math.min(swingHighs.length, swingLows.length);
  let confidence: MarketRegimeConfidence;
  if (regime === "bullish_trend" || regime === "bearish_trend") {
    confidence = swingPairDepth >= SWINGS_FOR_HIGH_CONFIDENCE && !breakout.failed ? "high" : "medium";
  } else if (regime === "range") {
    confidence = highDir === "equal" && lowDir === "equal" ? "medium" : "low";
    if (confidence === "medium" && swingPairDepth >= SWINGS_FOR_HIGH_CONFIDENCE) confidence = "high";
  } else {
    // transition is always low confidence — by construction it means the
    // structure has not yet resolved into a trend or a range.
    confidence = "low";
  }

  evidence.push(`Confidence set to "${confidence}" from ${swingPairDepth} confirmed swing pair depth${breakout.failed ? " and a failed breakout" : ""}.`);

  return { symbol, regime, confidence, evidence };
}
