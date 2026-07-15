import type { KeyLevels, EconomicEvent, InstrumentKey } from "@/lib/market/types";
import type { MarketPulse } from "@/lib/market/marketPulse";
import { computeStructure, StructureResult } from "./engines/structureEngine";
import { computeLiquidity, LiquidityResult } from "./engines/liquidityEngine";
import { computeSupplyDemand, SupplyDemandResult } from "./engines/supplyDemandEngine";
import { computeInstitutionalLevels, InstitutionalLevelsResult } from "./engines/institutionalLevelsEngine";
import { computeCatalyst, CatalystResult } from "./engines/catalystEngine";
import { composeStructureInterpretation, StructureInterpretationResult } from "./engines/structureInterpretationEngine";
import { MultiTimeframeHistory, STRUCTURE_TIMEFRAMES } from "./types";
import {
  deriveOverallBias,
  buildOutlookNarrative,
  buildExecutionPosture,
  buildStructureNarrative,
  buildSessionPosture,
  buildMarketContext,
  buildSessionPlaybook,
  buildMarketQuality,
  buildWarnings,
  buildTechnicalReasoningFacts,
  OverallBiasLabel,
  MarketQuality,
  TechnicalReasoningTimeframeFacts,
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

  overallBias: OverallBiasLabel; // legacy, kept for payload backward compatibility — no longer the UI's primary headline
  outlookNarrative: string[]; // legacy, kept for payload backward compatibility
  executionPosture: string | null; // legacy, kept for payload backward compatibility

  // Sprint 2 / Phase 4 — the CALIBRATED Market Outlook, sourced from the
  // multi-timeframe sequence/BOS/CHoCH/reversal read (structureInterpretationEngine.ts)
  // instead of the single-timeframe MarketPulse regime/conviction above.
  // This is what MarketOutlookHero actually renders as the primary headline.
  structureInterpretation: StructureInterpretationResult;
  structureNarrative: string[]; // exactly 3 sentences
  structureSessionPosture: string | null;

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
  // Sprint 2 / Phase 5 — `calibratedFacts` (sequence trend, phase, latest
  // BOS/CHoCH/false break, reversal, latest swing high/low) is the default
  // visible content once expanded; `legacyDiagnostics` holds the old
  // MarketPulse/regime/phase evidence dump, demoted to its own nested,
  // separately-collapsed sub-block that is never shown just because the
  // outer section is opened.
  technicalReasoning: {
    calibratedFacts: TechnicalReasoningTimeframeFacts[];
    legacyDiagnostics: {
      marketPulseEvidence: MarketPulse["evidence"];
      regimeEvidence: string[];
      phaseEvidence: string[];
    };
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
  const structureInterpretation = composeStructureInterpretation(structure);

  return {
    symbol,
    generatedAt: now.toISOString(),
    currentPrice,
    overallBias: deriveOverallBias(marketPulse),
    outlookNarrative: buildOutlookNarrative(structure),
    executionPosture: buildExecutionPosture(structure),
    structureInterpretation,
    structureNarrative: buildStructureNarrative(structureInterpretation),
    structureSessionPosture: buildSessionPosture(structure, structureInterpretation),
    structure,
    liquidity,
    supplyDemandByTimeframe,
    institutionalLevels,
    catalyst,
    marketContext: buildMarketContext(structure, structureInterpretation, liquidity, supplyDemandByTimeframe),
    sessionPlaybook: buildSessionPlaybook(structure, supplyDemandByTimeframe),
    marketQuality: buildMarketQuality(marketPulse, liquidity, structureInterpretation),
    warnings: buildWarnings(structure, structureInterpretation, supplyDemandByTimeframe, institutionalLevels, catalyst, now),
    technicalReasoning: {
      calibratedFacts: buildTechnicalReasoningFacts(structure),
      legacyDiagnostics: {
        marketPulseEvidence: marketPulse.evidence,
        regimeEvidence: marketPulse.regime.evidence,
        phaseEvidence: marketPulse.phase.evidence,
      },
    },
  };
}
