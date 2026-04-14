#!/usr/bin/env python3
"""
Trading Idea Engine - Institutional-Grade Idea Generation

Generates trading ideas based on liquidity engineering principles.
NOT a signal generator. NOT a trade executor.
A pure ideation system operating on price action, liquidity dynamics, and positioning.

Core thesis: Price is driven by the need to access liquidity, trigger orders, and
rebalance inefficiencies. Retail positioning represents resting liquidity pools.
Institutional capital moves price to access these pools.

Only generates ideas when:
1. Retail positioning is DECISIVE (clear BUY/SELL bias)
2. Liquidity is DEFINED (clear SL/TP clusters)
3. Structure is VALID (expansion/retracement/imbalance recognized)
4. Asymmetric opportunity EXISTS (minimum 2:1 risk/reward)
5. Invalidation is CLEAR (exit condition structural)

Output: Trading ideas with entry zones, stops, targets, and institutional reasoning.
Absence of idea = valid and optimal decision (DISCIPLINE).
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import statistics
from datetime import datetime


class IdeaStatus(Enum):
    """Qualification status of an idea"""
    QUALIFIED = "QUALIFIED_IDEA"
    INSUFFICIENT_POSITIONING = "INSUFFICIENT_POSITIONING"
    INSUFFICIENT_LIQUIDITY = "INSUFFICIENT_LIQUIDITY"
    UNFAVORABLE_STRUCTURE = "UNFAVORABLE_STRUCTURE"
    POOR_RISK_REWARD = "POOR_RISK_REWARD"
    NO_CLEAR_INVALIDATION = "NO_CLEAR_INVALIDATION"
    NO_ASYMMETRY = "NO_ASYMMETRY"


class TradeSide(Enum):
    """Trade direction"""
    LONG = "LONG"
    SHORT = "SHORT"


class TargetType(Enum):
    """Classification of profit targets"""
    VWAP_RETEST = "VWAP_RETEST"
    TP_CLUSTER = "TP_CLUSTER"
    SL_CLUSTER_OPPOSITE = "SL_CLUSTER_OPPOSITE"
    SESSION_HIGH_LOW = "SESSION_HIGH_LOW"
    RESISTANCE = "RESISTANCE"
    SUPPORT = "SUPPORT"


@dataclass
class EntryZone:
    """Optimal Trade Entry (OTE) zone"""
    low: float
    high: float
    type: str  # "SL_CLUSTER", "PULLBACK", "BREAKOUT", etc.
    rationale: str = ""

    @property
    def center(self) -> float:
        return (self.low + self.high) / 2

    @property
    def width(self) -> float:
        return abs(self.high - self.low)

    def is_valid_ote(self) -> bool:
        """Check if entry zone meets OTE criteria (5-15 pips)"""
        return 5 <= self.width <= 15


@dataclass
class ProfitTarget:
    """Staged profit target"""
    level: float
    type: TargetType
    rationale: str = ""
    position_size: float = 0.5  # % of position to close at this level


@dataclass
class TradingIdea:
    """Complete trading idea with execution parameters"""
    idea_id: str
    timestamp: str
    status: IdeaStatus
    side: Optional[TradeSide] = None
    entry_zone: Optional[EntryZone] = None
    stop_loss: Optional[float] = None
    targets: List[ProfitTarget] = field(default_factory=list)
    risk_pips: Optional[float] = None
    reward_pips: Optional[float] = None
    risk_reward_ratio: Optional[float] = None
    confidence: Optional[float] = None  # 0.0 to 1.0
    conviction: str = ""  # "HIGH", "MEDIUM", "LOW"
    institutional_thesis: str = ""
    invalidation_level: Optional[float] = None
    invalidation_reason: str = ""
    criteria_met: List[str] = field(default_factory=list)
    criteria_failed: List[str] = field(default_factory=list)
    source_context: Dict = field(default_factory=dict)  # Original analysis context

    def is_qualified(self) -> bool:
        """Check if idea is qualified for consideration"""
        return self.status == IdeaStatus.QUALIFIED

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "idea_id": self.idea_id,
            "timestamp": self.timestamp,
            "status": self.status.value,
            "setup": {
                "side": self.side.value if self.side else None,
                "context": self.institutional_thesis
            } if self.side else None,
            "execution": {
                "entry_zone": {
                    "low": round(self.entry_zone.low, 2),
                    "high": round(self.entry_zone.high, 2),
                    "pips": round(self.entry_zone.width, 2),
                    "type": self.entry_zone.type
                },
                "stop_loss": round(self.stop_loss, 2),
                "targets": [
                    {
                        "level": round(t.level, 2),
                        "type": t.type.value,
                        "rationale": t.rationale,
                        "position_size": t.position_size
                    }
                    for t in self.targets
                ]
            } if self.entry_zone else None,
            "metrics": {
                "risk_pips": round(self.risk_pips, 2) if self.risk_pips else None,
                "reward_pips": round(self.reward_pips, 2) if self.reward_pips else None,
                "risk_reward_ratio": round(self.risk_reward_ratio, 2) if self.risk_reward_ratio else None,
                "confidence": round(self.confidence, 2) if self.confidence else None,
                "conviction": self.conviction
            },
            "validation": {
                "criteria_met": self.criteria_met,
                "criteria_failed": self.criteria_failed,
                "invalidation_level": round(self.invalidation_level, 2) if self.invalidation_level else None,
                "invalidation_reason": self.invalidation_reason
            },
            "institutional_thesis": self.institutional_thesis
        }


class TradingIdeaEngine:
    """
    Institutional-grade trading idea generator operating on STRICT RULES.

    Core thesis: Retail = liquidity provider. Market = mechanism to access that liquidity.
    Price moves where orders are clustered. Only act when this becomes CLEAR.

    Uses ONLY: Price, Liquidity, Positioning (NO indicators, sentiment, or heuristics)

    HARD FILTERS (any triggered = NO TRADE):
    - RR to TP2 < 1:2
    - Score < 70
    - No clear liquidity zones
    - Price in mid-range
    - No clear structure
    - Entry zone > 15 pips
    - Conflicting bias
    """

    def __init__(self):
        self.idea_counter = 0

        # HARD FILTER CONSTRAINTS (IMMUTABLE RULES)
        self.min_rr_to_tp2 = 2.0          # RR to TP2 must be ≥ 1:2
        self.min_score = 70               # Score floor (out of 100)
        self.max_entry_width = 15         # Entry zone ≤ 15 pips
        self.min_crowding = 0.65          # ≥65% one side = crowded
        self.crowding_threshold = 0.65    # Threshold for decisive positioning
        self.min_confidence = 0.70        # Confidence threshold (for backward compat)
        self.min_risk_reward = 2.0        # Minimum risk/reward ratio (for backward compat)

        # SCORING COMPONENTS (25 points each = 100 total)
        self.liquidity_clarity_max = 25
        self.structure_alignment_max = 25
        self.risk_reward_potential_max = 25
        self.entry_precision_max = 25

    def _score_idea(self, analysis: Dict, entry_zone: Optional[EntryZone] = None,
                   stop_loss: Optional[float] = None, targets: Optional[List[ProfitTarget]] = None) -> Dict:
        """
        Calculate 4-component score (0-100 total).

        Components:
        - Liquidity Clarity (0-25): How defined are SL/TP clusters?
        - Structure Alignment (0-25): Is structure clear + stop hunt + aligned?
        - Risk/Reward Potential (0-25): RR to TP2 magnitude and asymmetry?
        - Entry Precision (0-25): Entry zone width, location, OTE quality?
        """
        score_breakdown = {
            "liquidity_clarity": 0,
            "structure_alignment": 0,
            "risk_reward_potential": 0,
            "entry_precision": 0,
            "total": 0
        }

        # COMPONENT 1: LIQUIDITY CLARITY (0-25)
        liquidity = analysis.get('liquidity_zones', {})
        sl_clusters = liquidity.get('sl_clusters', [])
        tp_clusters = liquidity.get('tp_clusters', [])

        clarity_score = 0
        if sl_clusters:
            strongest_sl = max(sl_clusters, key=lambda x: x.get('signal_count', 0))
            sl_signals = strongest_sl.get('signal_count', 0)
            # 3+ signals = 12 pts, 4+ = 15, 5+ = 18, 6+ = 20, 8+ = 25
            if sl_signals >= 8:
                clarity_score += 25
            elif sl_signals >= 6:
                clarity_score += 20
            elif sl_signals >= 5:
                clarity_score += 18
            elif sl_signals >= 4:
                clarity_score += 15
            elif sl_signals >= 3:
                clarity_score += 12
            else:
                clarity_score += 5

        if tp_clusters:
            strongest_tp = max(tp_clusters, key=lambda x: x.get('signal_count', 0))
            tp_signals = strongest_tp.get('signal_count', 0)
            # Same scale for TP
            if tp_signals >= 8:
                clarity_score += 12  # Max combined with SL = 25 for this component
            elif tp_signals >= 6:
                clarity_score += 10
            elif tp_signals >= 5:
                clarity_score += 9
            elif tp_signals >= 4:
                clarity_score += 7
            elif tp_signals >= 3:
                clarity_score += 5
            else:
                clarity_score += 2

        score_breakdown["liquidity_clarity"] = min(clarity_score, 25)

        # COMPONENT 2: STRUCTURE ALIGNMENT (0-25)
        structure_score = 0
        structure = analysis.get('market_structure', {})
        price_action = analysis.get('price_action', {})

        # Intraday bias clarity
        bias = structure.get('intraday_bias', 'NEUTRAL')
        if bias != 'NEUTRAL':
            structure_score += 10
        else:
            structure_score += 0

        # Stop hunt detection (strong signal)
        stop_hunt = price_action.get('stop_hunt_detected', {})
        if stop_hunt.get('detected'):
            structure_score += 12
        else:
            structure_score += 4

        # Move type clarity
        move_type = structure.get('move_type', '')
        if move_type in ['EXPANSION', 'DIRECTIONAL']:
            structure_score += 3
        elif move_type in ['RETRACEMENT', 'CONSOLIDATION']:
            structure_score += 1

        score_breakdown["structure_alignment"] = min(structure_score, 25)

        # COMPONENT 3: RISK/REWARD POTENTIAL (0-25)
        rr_score = 0
        if entry_zone and stop_loss and targets:
            entry_center = entry_zone.center
            risk_pips = abs(entry_center - stop_loss)

            # Find TP2 (usually the 2nd target or strongest TP cluster)
            if len(targets) >= 2:
                tp2_level = targets[1].level
            elif targets:
                tp2_level = targets[0].level
            else:
                tp2_level = entry_center

            reward_to_tp2 = abs(tp2_level - entry_center)

            if risk_pips > 0:
                rr_to_tp2 = reward_to_tp2 / risk_pips
            else:
                rr_to_tp2 = 0

            # Scoring based on RR to TP2
            if rr_to_tp2 >= 5.0:
                rr_score = 25
            elif rr_to_tp2 >= 4.0:
                rr_score = 23
            elif rr_to_tp2 >= 3.0:
                rr_score = 21
            elif rr_to_tp2 >= 2.5:
                rr_score = 19
            elif rr_to_tp2 >= 2.0:
                rr_score = 17
            elif rr_to_tp2 >= 1.5:
                rr_score = 10
            elif rr_to_tp2 >= 1.0:
                rr_score = 5
            else:
                rr_score = 0

        score_breakdown["risk_reward_potential"] = min(rr_score, 25)

        # COMPONENT 4: ENTRY PRECISION (0-25)
        entry_score = 0
        if entry_zone:
            entry_width = entry_zone.width
            # Optimal is 10 pips (institutional precision)
            if 5 <= entry_width <= 10:
                entry_score = 25
            elif 10 < entry_width <= 12:
                entry_score = 20
            elif 12 < entry_width <= 15:
                entry_score = 15
            elif entry_width < 5:
                entry_score = 10  # Too tight
            else:  # > 15
                entry_score = 0

        score_breakdown["entry_precision"] = min(entry_score, 25)

        # TOTAL SCORE
        total_score = (score_breakdown["liquidity_clarity"] +
                       score_breakdown["structure_alignment"] +
                       score_breakdown["risk_reward_potential"] +
                       score_breakdown["entry_precision"])

        score_breakdown["total"] = min(total_score, 100)

        return score_breakdown

    def _apply_hard_filters(self, analysis: Dict, entry_zone: Optional[EntryZone] = None,
                           stop_loss: Optional[float] = None, targets: Optional[List[ProfitTarget]] = None,
                           score: int = 0) -> Dict:
        """
        Apply 7 HARD FILTERS that automatically reject trades.
        Any filter triggered = NO TRADE.

        Returns: {"pass": bool, "failed_filters": [list of failures], "rejection_reason": str, "market_state": str}
        """
        failed_filters = []
        market_state = self._assess_market_state(analysis)

        # FILTER 1: Score < 70
        if score < self.min_score:
            failed_filters.append(f"SCORE_TOO_LOW ({score}/100 < {self.min_score})")

        # FILTER 2: RR to TP2 < 1:2
        if entry_zone and stop_loss and targets:
            entry_center = entry_zone.center
            risk_pips = abs(entry_center - stop_loss)

            if len(targets) >= 2:
                tp2_level = targets[1].level
            elif targets:
                tp2_level = targets[0].level
            else:
                tp2_level = entry_center

            reward_to_tp2 = abs(tp2_level - entry_center)

            if risk_pips > 0:
                rr_to_tp2 = reward_to_tp2 / risk_pips
            else:
                rr_to_tp2 = 0

            if rr_to_tp2 < self.min_rr_to_tp2:
                failed_filters.append(f"POOR_RR_TO_TP2 (1:{rr_to_tp2:.1f} < 1:{self.min_rr_to_tp2})")

        # FILTER 3: No clear liquidity zones
        liquidity = analysis.get('liquidity_zones', {})
        sl_clusters = liquidity.get('sl_clusters', [])
        tp_clusters = liquidity.get('tp_clusters', [])

        strong_sl = [c for c in sl_clusters if c.get('signal_count', 0) >= 3]
        strong_tp = [c for c in tp_clusters if c.get('signal_count', 0) >= 3]

        if not strong_sl or not strong_tp:
            failed_filters.append("NO_CLEAR_LIQUIDITY (SL/TP clusters undefined)")

        # FILTER 4: Price in mid-range (50-75% of session)
        market = analysis.get('market_structure', {})
        session = analysis.get('vwap_analysis', {}).get('session', {})
        current_price = analysis.get('market_context', {}).get('current_price')
        session_low = session.get('session_low')
        session_high = session.get('session_high')

        if current_price and session_low and session_high:
            range_size = session_high - session_low
            if range_size > 0:
                price_position = (current_price - session_low) / range_size
                if 0.50 <= price_position <= 0.75:
                    failed_filters.append(f"MID_RANGE_PRICE ({price_position:.0%} of session range)")

        # FILTER 5: No clear structure
        structure = analysis.get('market_structure', {})
        bias = structure.get('intraday_bias', 'NEUTRAL')

        if bias == 'NEUTRAL':
            failed_filters.append("NO_CLEAR_STRUCTURE (ambiguous intraday bias)")

        # FILTER 6: Entry zone > 15 pips
        if entry_zone and entry_zone.width > self.max_entry_width:
            failed_filters.append(f"ENTRY_TOO_WIDE ({entry_zone.width:.1f} pips > {self.max_entry_width})")

        # FILTER 7: Conflicting bias
        retail_bias = analysis.get('retail_bias', {})
        positioning = analysis.get('positioning_assessment', {})

        buy_pct = retail_bias.get('buy_percent', 50)
        dominant_bias = retail_bias.get('dominant_bias', '')
        status = positioning.get('status', '')

        if buy_pct < self.min_crowding * 100 and buy_pct > (1 - self.min_crowding) * 100:
            # Positioning is mixed, not decisive
            failed_filters.append(f"CONFLICTING_BIAS (mixed positioning: {buy_pct:.0f}% BUY)")

        # Determine pass/fail
        passed = len(failed_filters) == 0

        if not passed:
            rejection_reason = " | ".join(failed_filters[:2])  # Top 2 reasons
        else:
            rejection_reason = ""

        return {
            "pass": passed,
            "failed_filters": failed_filters,
            "rejection_reason": rejection_reason,
            "market_state": market_state
        }

    def _assess_market_state(self, analysis: Dict) -> str:
        """
        Assess current market state to provide context for rejections.
        Returns: "RANGE", "CHOPPY", "LOW_LIQUIDITY", "UNCLEAR", or "DIRECTIONAL"
        """
        structure = analysis.get('market_structure', {})
        liquidity = analysis.get('liquidity_zones', {})

        move_type = structure.get('move_type', 'CONSOLIDATION')
        intraday_bias = structure.get('intraday_bias', 'NEUTRAL')

        sl_clusters = liquidity.get('sl_clusters', [])
        tp_clusters = liquidity.get('tp_clusters', [])

        strong_sl = len([c for c in sl_clusters if c.get('signal_count', 0) >= 3])
        strong_tp = len([c for c in tp_clusters if c.get('signal_count', 0) >= 3])

        # Determine state
        if move_type == 'CONSOLIDATION':
            return "RANGE"
        elif move_type == 'RETRACEMENT' and intraday_bias == 'NEUTRAL':
            return "CHOPPY"
        elif strong_sl == 0 or strong_tp == 0:
            return "LOW_LIQUIDITY"
        elif intraday_bias == 'NEUTRAL':
            return "UNCLEAR"
        else:
            return "DIRECTIONAL"

    def generate_idea(self, analysis: Dict) -> TradingIdea:
        """
        Generate trading idea from liquidity analysis using RULES-based framework.

        RULES: Strict institutional discipline with 4-component scoring and 7 hard filters.
        Only operates on: Price, Liquidity, Positioning (NO indicators, sentiment, heuristics)

        Flow:
        1. Basic validation (positioning, liquidity, structure)
        2. Define execution parameters (entry, stop, targets)
        3. Calculate 4-component score (Liquidity Clarity, Structure Alignment, R/R Potential, Entry Precision)
        4. Apply 7 hard filters (any trigger = NO TRADE)
        5. Return QUALIFIED or NO TRADE with reason + market state + next condition

        Args:
            analysis: Complete output from LiquidityAnalyzer.analyze()

        Returns:
            TradingIdea object (QUALIFIED_IDEA or detailed rejection)
        """
        self.idea_counter += 1
        idea_id = f"IDEA_{self.idea_counter:04d}"
        timestamp = datetime.now().isoformat()

        # ===== STAGE 1: BASIC VALIDATION =====
        # Check: Can we even build a trade setup?

        positioning_check = self._check_positioning_decisive(analysis)
        if not positioning_check["valid"]:
            return TradingIdea(
                idea_id=idea_id,
                timestamp=timestamp,
                status=IdeaStatus.INSUFFICIENT_POSITIONING,
                criteria_failed=positioning_check["reasons"]
            )

        liquidity_check = self._check_liquidity_defined(analysis)
        if not liquidity_check["valid"]:
            return TradingIdea(
                idea_id=idea_id,
                timestamp=timestamp,
                status=IdeaStatus.INSUFFICIENT_LIQUIDITY,
                criteria_failed=liquidity_check["reasons"]
            )

        structure_check = self._check_structure_valid(analysis)
        if not structure_check["valid"]:
            return TradingIdea(
                idea_id=idea_id,
                timestamp=timestamp,
                status=IdeaStatus.UNFAVORABLE_STRUCTURE,
                criteria_failed=structure_check["reasons"]
            )

        # ===== STAGE 2: BUILD EXECUTION PARAMETERS =====
        # Define: Entry, Stop, Targets

        side = self._determine_trade_side(analysis, positioning_check)
        entry_zone = self._define_entry_zone(analysis, side)
        stop_loss = self._define_stop_loss(analysis, side, entry_zone)
        targets = self._define_targets(analysis, side, entry_zone)

        # ===== STAGE 3: CALCULATE SCORE (4 COMPONENTS) =====
        score_breakdown = self._score_idea(analysis, entry_zone, stop_loss, targets)
        total_score = score_breakdown["total"]

        # ===== STAGE 4: APPLY HARD FILTERS =====
        # Risk/Reward is calculated to TP2 (critical hard filter)
        risk_pips, reward_pips, rr_ratio = self._calculate_risk_reward(
            entry_zone, stop_loss, targets
        )

        filters_result = self._apply_hard_filters(
            analysis, entry_zone, stop_loss, targets, total_score
        )

        if not filters_result["pass"]:
            # NO TRADE: Return with reason, market state, and next condition
            next_condition = self._determine_next_condition(
                analysis, filters_result, side
            )

            return TradingIdea(
                idea_id=idea_id,
                timestamp=timestamp,
                status=IdeaStatus.INSUFFICIENT_POSITIONING,  # Generic rejection status
                criteria_failed=filters_result["failed_filters"] + [f"Market State: {filters_result['market_state']}"],
                source_context=analysis
            )

        # ===== STAGE 5: GENERATE FINAL IDEA =====
        # All checks passed - QUALIFIED

        invalidation = self._define_invalidation(analysis, side, entry_zone, stop_loss)
        thesis = self._generate_thesis(analysis, side, positioning_check)
        conviction = self._determine_conviction(score_breakdown)

        return TradingIdea(
            idea_id=idea_id,
            timestamp=timestamp,
            status=IdeaStatus.QUALIFIED,
            side=side,
            entry_zone=entry_zone,
            stop_loss=stop_loss,
            targets=targets,
            risk_pips=risk_pips,
            reward_pips=reward_pips,
            risk_reward_ratio=rr_ratio,
            confidence=total_score / 100.0,  # Convert score to confidence 0-1
            conviction=conviction,
            institutional_thesis=thesis,
            invalidation_level=invalidation["level"],
            invalidation_reason=invalidation["reason"],
            criteria_met=[
                f"✓ Decisive Positioning ({positioning_check['passed'][0] if positioning_check['passed'] else 'valid'})",
                f"✓ Liquidity Defined ({liquidity_check['passed'][0] if liquidity_check['passed'] else 'valid'})",
                f"✓ Structure Valid ({structure_check['passed'][0] if structure_check['passed'] else 'valid'})",
                f"✓ Score: {total_score}/100",
                f"✓ RR to TP2: 1:{rr_ratio:.2f}",
                f"✓ Entry Width: {entry_zone.width:.1f} pips"
            ],
            criteria_failed=[],
            source_context=analysis
        )

    def _determine_next_condition(self, analysis: Dict, filters_result: Dict,
                                 side: Optional[TradeSide]) -> str:
        """
        Determine what market condition would make this trade eligible.
        Provides actionable guidance for traders waiting for setup.
        """
        failed = filters_result.get("failed_filters", [])
        market_state = filters_result.get("market_state", "UNCLEAR")

        # Parse top failure reason
        if not failed:
            return "UNKNOWN"

        top_failure = failed[0]

        if "SCORE_TOO_LOW" in top_failure:
            return "Wait for stronger liquidity clustering or clearer structure alignment"
        elif "POOR_RR_TO_TP2" in top_failure:
            return "Wait for price to move closer to TP clusters for better reward potential"
        elif "NO_CLEAR_LIQUIDITY" in top_failure:
            return "Wait for retail to cluster around entry/target levels (3+ signals min)"
        elif "MID_RANGE_PRICE" in top_failure:
            return "Wait for price to reach session extremes (upper/lower quartiles) for better structure"
        elif "NO_CLEAR_STRUCTURE" in top_failure:
            return "Wait for bias to shift from neutral to directional (BULLISH/BEARISH)"
        elif "ENTRY_TOO_WIDE" in top_failure:
            return "Wait for tighter SL clustering to define precise entry zone (≤15 pips)"
        elif "CONFLICTING_BIAS" in top_failure:
            return "Wait for retail positioning to become more decisive (≥65% one side)"
        else:
            return "Wait for market conditions to improve before reconsidering"

    def _check_positioning_decisive(self, analysis: Dict) -> Dict:
        """Check if retail positioning is decisively biased"""
        bias = analysis['retail_bias']
        buy_pct = bias['buy_percent']
        sell_pct = bias['sell_percent']

        passed = []
        reasons = []

        # Check for crowding (>65% one side)
        if buy_pct > self.crowding_threshold or sell_pct > self.crowding_threshold:
            passed.append(f"✓ Crowded positioning ({max(buy_pct, sell_pct):.1f}% one side)")
        else:
            reasons.append(f"No crowding - positioning mixed ({buy_pct:.1f}% BUY)")
            return {"valid": False, "reasons": reasons, "passed": passed}

        # Check for trapped vs correct status
        status = analysis['positioning_assessment']['status']
        if status in ['TRAPPED', 'CORRECT']:
            passed.append(f"✓ Positioning status: {status}")
        else:
            reasons.append(f"Positioning ambiguous: {status}")
            return {"valid": False, "reasons": reasons, "passed": passed}

        return {"valid": True, "reasons": reasons, "passed": passed}

    def _check_liquidity_defined(self, analysis: Dict) -> Dict:
        """Check if liquidity clusters are clearly defined"""
        liquidity = analysis['liquidity_zones']
        sl_clusters = liquidity['sl_clusters']
        tp_clusters = liquidity['tp_clusters']

        passed = []
        reasons = []

        # Need clear SL cluster
        strong_sl = [c for c in sl_clusters if c['signal_count'] >= 3]
        if strong_sl:
            passed.append(f"✓ Clear SL cluster ({strong_sl[0]['signal_count']} signals)")
        else:
            reasons.append("No significant SL clustering")
            return {"valid": False, "reasons": reasons, "passed": passed}

        # Need clear TP cluster
        strong_tp = [c for c in tp_clusters if c['signal_count'] >= 3]
        if strong_tp:
            passed.append(f"✓ Clear TP cluster ({strong_tp[0]['signal_count']} signals)")
        else:
            reasons.append("No significant TP clustering")
            return {"valid": False, "reasons": reasons, "passed": passed}

        return {"valid": True, "reasons": reasons, "passed": passed}

    def _check_structure_valid(self, analysis: Dict) -> Dict:
        """Check if market structure is valid"""
        passed = []
        reasons = []

        # Check for stop hunt detection
        price_action = analysis['price_action']
        if price_action['stop_hunt_detected'].get('detected'):
            passed.append("✓ Stop hunt detected (liquidity event confirmed)")
        else:
            passed.append("⚠ No stop hunt (but other structure valid)")

        # Check for clear bias
        structure = analysis['market_structure']
        bias = structure['intraday_bias']
        if bias != 'NEUTRAL':
            passed.append(f"✓ Clear intraday bias: {bias}")
        else:
            reasons.append("No clear intraday bias")
            return {"valid": False, "reasons": reasons, "passed": passed}

        return {"valid": True, "reasons": reasons, "passed": passed}

    def _determine_trade_side(self, analysis: Dict, positioning_check: Dict) -> TradeSide:
        """Determine if trade should be LONG or SHORT"""
        bias = analysis['retail_bias']['dominant_bias']
        status = analysis['positioning_assessment']['status']

        # If retail is TRAPPED (positioned against move), trade the opposite
        if status == 'TRAPPED':
            if bias == 'BULLISH':
                return TradeSide.SHORT  # Retail long, expect down
            else:
                return TradeSide.LONG   # Retail short, expect up

        # If retail is CORRECT (positioned with move), trade same direction
        elif status == 'CORRECT':
            if bias == 'BULLISH':
                return TradeSide.LONG
            else:
                return TradeSide.SHORT

        # Default fallback
        return TradeSide.LONG

    def _define_entry_zone(self, analysis: Dict, side: TradeSide) -> EntryZone:
        """
        Define Optimal Trade Entry (OTE) zone.

        For LONG: Entry at or near SL cluster (support after sweep)
        For SHORT: Entry at or near SL cluster (resistance after sweep)
        """
        liquidity = analysis['liquidity_zones']
        sl_clusters = liquidity['sl_clusters']

        # Find strongest SL cluster
        strongest_sl = max(sl_clusters, key=lambda x: x['signal_count'])

        # Create 10-pip entry zone around cluster center
        center = (strongest_sl['center'])
        width = 10  # 10 pips (5 each side)

        return EntryZone(
            low=center - (width / 2),
            high=center + (width / 2),
            type="SL_CLUSTER_SUPPORT" if side == TradeSide.LONG else "SL_CLUSTER_RESISTANCE",
            rationale=f"Strong SL cluster at ${strongest_sl['center']:.2f} "
                      f"({strongest_sl['signal_count']} signals). "
                      f"Entry after cluster sweep."
        )

    def _define_stop_loss(self, analysis: Dict, side: TradeSide,
                         entry_zone: EntryZone) -> float:
        """Define stop loss BEYOND meaningful liquidity"""
        market = analysis.get('market_structure', {}).get('structure', {})
        session = analysis.get('vwap_analysis', {}).get('session', {})

        if side == TradeSide.LONG:
            # For LONG: Stop below intraday low or session low
            session_low = session.get('session_low')
            intraday_low = market.get('intraday_low')

            sl = min(session_low or intraday_low, intraday_low or session_low) - 2
            return sl
        else:
            # For SHORT: Stop above intraday high or session high
            session_high = session.get('session_high')
            intraday_high = market.get('intraday_high')

            sl = max(session_high or intraday_high, intraday_high or session_high) + 2
            return sl

    def _define_targets(self, analysis: Dict, side: TradeSide,
                       entry_zone: EntryZone) -> List[ProfitTarget]:
        """
        Define multi-stage profit targets.

        Stage 1: VWAP retest (50% position)
        Stage 2: TP cluster (remaining position)
        """
        targets = []
        liquidity = analysis['liquidity_zones']
        tp_clusters = liquidity['tp_clusters']
        vwap_data = analysis.get('vwap_analysis', {}).get('vwap', {})

        # Target 1: VWAP level
        if vwap_data.get('available'):
            vwap_level = vwap_data['vwap_level']
            targets.append(ProfitTarget(
                level=vwap_level,
                type=TargetType.VWAP_RETEST,
                rationale=f"VWAP at ${vwap_level:.2f} - institutional fair value, "
                         f"profit-taking zone",
                position_size=0.5
            ))

        # Target 2: TP Cluster
        if tp_clusters:
            strongest_tp = max(tp_clusters, key=lambda x: x['signal_count'])
            targets.append(ProfitTarget(
                level=strongest_tp['center'],
                type=TargetType.TP_CLUSTER,
                rationale=f"TP cluster at ${strongest_tp['center']:.2f} "
                         f"({strongest_tp['signal_count']} signals) - "
                         f"significant profit-taking zone",
                position_size=0.5
            ))

        return targets

    def _calculate_risk_reward(self, entry: EntryZone, stop: float,
                             targets: List[ProfitTarget]) -> Tuple[float, float, float]:
        """
        Calculate risk and reward in pips.

        CRITICAL: RR ratio is calculated to TP2 (2nd target), not TP1.
        This enforces minimum 1:2 asymmetry for qualified ideas.
        """
        entry_center = entry.center
        risk_pips = abs(entry_center - stop)

        # Reward is from entry to TP2 (2nd target if exists, otherwise TP1)
        if len(targets) >= 2:
            # Use TP2 as the primary profit target for RR calculation
            reward_pips = abs(targets[1].level - entry_center)
        elif targets:
            # Fallback to TP1 if TP2 doesn't exist
            reward_pips = abs(targets[0].level - entry_center)
        else:
            reward_pips = 0

        rr_ratio = reward_pips / risk_pips if risk_pips > 0 else 0

        return risk_pips, reward_pips, rr_ratio

    def _define_invalidation(self, analysis: Dict, side: TradeSide,
                           entry_zone: EntryZone, stop: float) -> Dict:
        """Define structural invalidation level"""
        liquidity = analysis['liquidity_zones']
        sl_clusters = liquidity['sl_clusters']

        if not sl_clusters:
            return {"valid": False, "reasons": ["Cannot determine invalidation"],
                   "level": None, "reason": ""}

        # Invalidation is above SL cluster (for LONG) or below (for SHORT)
        strongest_sl = max(sl_clusters, key=lambda x: x['signal_count'])
        sl_center = strongest_sl['center']

        if side == TradeSide.LONG:
            # For LONG: Invalidation above SL cluster (reversal failed)
            invalidation_level = sl_center + 3  # 3 pips above cluster center
            reason = f"Price closes above SL cluster (${sl_center:.2f}) = structure broken"
        else:
            # For SHORT: Invalidation below SL cluster (bounce failed)
            invalidation_level = sl_center - 3  # 3 pips below cluster center
            reason = f"Price closes below SL cluster (${sl_center:.2f}) = structure broken"

        return {
            "valid": True,
            "reasons": [],
            "level": invalidation_level,
            "reason": reason
        }

    def _calculate_confidence(self, positioning_check: Dict, liquidity_check: Dict,
                            structure_check: Dict, rr_ratio: float) -> float:
        """Calculate confidence score 0.0-1.0"""
        # Base: 0.5
        confidence = 0.5

        # Positioning clarity: +0.15
        if positioning_check["valid"]:
            confidence += 0.15

        # Liquidity definition: +0.15
        if liquidity_check["valid"]:
            confidence += 0.15

        # Structure validity: +0.10
        if structure_check["valid"]:
            confidence += 0.10

        # Risk/reward bonus: +0.10 (per additional 1:1 above minimum 2:1)
        rr_bonus = min((rr_ratio - 2.0) * 0.05, 0.10)
        confidence += rr_bonus

        return min(confidence, 1.0)

    def _generate_thesis(self, analysis: Dict, side: TradeSide,
                        positioning_check: Dict) -> str:
        """Generate institutional reasoning for the idea"""
        bias = analysis['retail_bias']
        status = analysis['positioning_assessment']
        liquidity = analysis['liquidity_zones']

        sl_clusters = liquidity['sl_clusters']
        tp_clusters = liquidity['tp_clusters']

        strongest_sl = max(sl_clusters, key=lambda x: x['signal_count']) if sl_clusters else None
        strongest_tp = max(tp_clusters, key=lambda x: x['signal_count']) if tp_clusters else None

        if status['status'] == 'TRAPPED':
            thesis = (
                f"Retail positioned {bias['dominant_bias'].lower()} "
                f"({bias['buy_percent']:.0f}% BUY) but trapped. "
                f"SL cluster at ${strongest_sl['center']:.2f} "
                f"({strongest_sl['signal_count']} signals) vulnerable to sweep. "
                f"Post-liquidation {"reversal to" if side == TradeSide.LONG else "extension to"} "
                f"${strongest_tp['center']:.2f} (TP cluster) expected. "
                f"Capital flows from trapped longs/shorts into opposing liquidity."
            )
        else:
            thesis = (
                f"Retail positioned {bias['dominant_bias'].lower()} "
                f"({bias['buy_percent']:.0f}% BUY) and correct. "
                f"Price aligned with positioning. "
                f"TP cluster at ${strongest_tp['center']:.2f} "
                f"({strongest_tp['signal_count']} signals) represents next institutional target. "
                f"Continuation of move likely."
            )

        return thesis

    def _determine_conviction(self, score_breakdown: Dict) -> str:
        """
        Determine conviction level based on score breakdown.
        Conviction = certainty of the setup, not just total score.
        """
        total = score_breakdown.get("total", 0)
        liquidity = score_breakdown.get("liquidity_clarity", 0)
        structure = score_breakdown.get("structure_alignment", 0)

        # High conviction: High score + Strong liquidity + Strong structure
        if total >= 85 and liquidity >= 20 and structure >= 18:
            return "HIGH"
        # Medium conviction: Solid score + Balanced components
        elif total >= 75 and liquidity >= 15 and structure >= 12:
            return "MEDIUM"
        # Low conviction: Passes but weaker components
        else:
            return "LOW"
