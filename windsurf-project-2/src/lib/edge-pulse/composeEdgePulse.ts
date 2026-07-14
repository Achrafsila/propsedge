import type { KeyLevels, EconomicEvent, InstrumentKey } from "@/lib/market/types";
import type { MarketPulse } from "@/lib/market/marketPulse";
import { computeStructure, StructureResult } from "./engines/structureEngine";
import { computeLiquidity, LiquidityResult } from "./engines/liquidityEngine";
import { computeSupplyDemand, SupplyDemandResult } from "./engines/supplyDemandEngine";
import { computeInstitutionalLevels, InstitutionalLevelsResult } from "./engines/institutionalLevelsEngine";
import { computeCatalyst, CatalystResult } from "./engines/catalystEngine";
import { MultiTimeframeHistory, STRUCTURE_TIMEFRAMES } from "./types";
import {
  deriveOverallBias,
  buildOutlookNarrative,
  buildExecutionPosture,
  buildMarketContext,
  buildSessionPlaybook,
  buildMarketQuality,
  buildWarnings,
  OverallBiasLabel,
  MarketQuality,
} from "./copy";

// ============================================================
// Edge Pulse — composition layer (deterministic)
// ============================================================
// Pure function: assembles the UNMODIFIED computeMarketPulse output
// (reused verbatim, never recomputed or second-guessed) with the 5 new
// Edge Pulse engines into one EdgePulseBrief — the single object the UI
// renders. No AI, no LLM, no network, no new analysis of its own; every
// field here is either read straight from an engine or built by a
// template function in copy.ts from already-computed fields.

export interface EdgePulseBrief {
  symbol: string;
  generatedAt: string;
  currentPrice: number | null;

  overallBias: OverallBiasLabel;
  outlookNarrative: string[];
  executionPosture: string | null;

  structure: StructureResult;
  liquidity: LiquidityResult; // Daily timeframe — the spec's Liquidity Map is one flat section, not per-timeframe
  supplyDemandByTimeframe: SupplyDemandResult[]; // one per STRUCTURE_TIMEFRAMES, in that order
  institutionalLevels: InstitutionalLevelsResult;
  catalyst: CatalystResult;

  marketContext: string[]; // max 5
  sessionPlaybook: string[]; // max 4
  marketQuality: MarketQuality;
  warnings: string[]; // max 3

  // Section 11 — collapsed by default in the UI, never shown up-front.
  technicalReasoning: {
    marketPulseEvidence: MarketPulse["evidence"];
    regimeEvidence: string[];
    phaseEvidence: string[];
  };
}

export function composeEdgePulse(
  symbol: InstrumentKey,
  currentPrice: number | null,
  marketPulse: MarketPulse,
  keyLevels: KeyLevels | null,
  history: MultiTimeframeHistory,
  economicEvents: EconomicEvent[],
  now: Date
): EdgePulseBrief {
  const structure = computeStructure(symbol, history);
  const liquidity = computeLiquidity(symbol, history.daily, currentPrice);
  const supplyDemandByTimeframe = STRUCTURE_TIMEFRAMES.map((tf) => computeSupplyDemand(symbol, history[tf], currentPrice));
  const institutionalLevels = computeInstitutionalLevels(symbol, currentPrice, keyLevels, history.daily.candles, liquidity);
  const catalyst = computeCatalyst(symbol, economicEvents, now);

  return {
    symbol,
    generatedAt: now.toISOString(),
    currentPrice,
    overallBias: deriveOverallBias(marketPulse),
    outlookNarrative: buildOutlookNarrative(structure),
    executionPosture: buildExecutionPosture(structure),
    structure,
    liquidity,
    supplyDemandByTimeframe,
    institutionalLevels,
    catalyst,
    marketContext: buildMarketContext(structure, liquidity, supplyDemandByTimeframe),
    sessionPlaybook: buildSessionPlaybook(structure, supplyDemandByTimeframe),
    marketQuality: buildMarketQuality(marketPulse, liquidity, structure),
    warnings: buildWarnings(structure, supplyDemandByTimeframe, institutionalLevels, catalyst, marketPulse, now),
    technicalReasoning: {
      marketPulseEvidence: marketPulse.evidence,
      regimeEvidence: marketPulse.regime.evidence,
      phaseEvidence: marketPulse.phase.evidence,
    },
  };
}
