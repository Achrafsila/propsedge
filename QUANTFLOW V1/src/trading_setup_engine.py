#!/usr/bin/env python3
"""
QUANTFLOW V1 — Trading Setup Engine
Evaluates real-time market conditions against defined setup criteria
to generate institutional-grade trading ideas with full context.
"""

import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SetupCriterion:
    name: str
    met: bool
    weight: int
    score_earned: int
    detail: str


@dataclass
class RiskLevels:
    entry: float
    stop_loss: float
    tp1: float
    tp2: float
    tp3: float
    rr_tp1: float
    rr_tp2: float
    rr_tp3: float
    sl_distance_pts: float
    tp1_distance_pts: float


@dataclass
class TradingIdea:
    """Complete institutional trading idea output"""
    timestamp: str
    instrument: str
    direction: str                    # "LONG" / "SHORT" / "NO_TRADE"
    setup_type: str                   # e.g. "SHORT_SWEEP_AND_REVERSE"
    confluence_score: float           # 0–100
    verdict: str                      # "HIGH_PROBABILITY" / "MODERATE" / "WAIT" / "NO_TRADE"
    risk: RiskLevels
    criteria_met: List[SetupCriterion]
    market_context: Dict
    invalidation: str                 # exact price that cancels the setup
    execution_note: str               # what the trader must see before entering
    no_trade_reasons: List[str]       # populated when direction == NO_TRADE


# ─────────────────────────────────────────────────────────────────────────────
# Engine
# ─────────────────────────────────────────────────────────────────────────────

class TradingSetupEngine:
    """
    Evaluates market conditions against setup_criteria.json and
    produces a fully scored TradingIdea.

    Usage:
        engine = TradingSetupEngine()
        idea   = engine.evaluate(market_snapshot)
        print(engine.format_idea(idea))
    """

    CRITERIA_FILE = Path(__file__).parent.parent / "data" / "setup_criteria.json"

    def __init__(self):
        self.criteria = self._load_criteria()

    # ── public API ────────────────────────────────────────────────────────────

    def evaluate(self, snapshot: Dict) -> TradingIdea:
        """
        Main entry point.

        snapshot keys (all optional; engine degrades gracefully):
            current_price   float   live XAUUSD price
            hod             float   high of day
            lod             float   low of day
            trend_htf       str     "BULLISH" / "BEARISH" / "CONSOLIDATION"
            bos_confirmed   bool
            choch_detected  bool
            swept_high      bool    today's/session high already swept
            swept_low       bool    today's/session low already swept
            at_order_block  bool    price is at a fresh OB
            ob_type         str     "DEMAND" / "SUPPLY"
            ob_level        float   exact OB price
            fvg_present     bool
            fvg_high        float
            fvg_low         float
            retail_bias     str     "MAJORITY_LONG" / "MAJORITY_SHORT" / "NEUTRAL"
            retail_pct_long float   0–100
            session         str     "LONDON" / "NY" / "ASIA" / "OVERLAP"
            spread_pts      float
            news_imminent   bool
            signal_data     dict    from batch_processor / scraper
        """
        price        = float(snapshot.get("current_price", 0))
        hod          = float(snapshot.get("hod", 0))
        lod          = float(snapshot.get("lod", 0))
        trend_htf    = snapshot.get("trend_htf", "UNKNOWN").upper()
        bos          = bool(snapshot.get("bos_confirmed", False))
        swept_high   = bool(snapshot.get("swept_high", False))
        swept_low    = bool(snapshot.get("swept_low", False))
        at_ob        = bool(snapshot.get("at_order_block", False))
        ob_type      = snapshot.get("ob_type", "UNKNOWN").upper()
        ob_level     = float(snapshot.get("ob_level", 0))
        fvg          = bool(snapshot.get("fvg_present", False))
        fvg_high     = float(snapshot.get("fvg_high", 0))
        fvg_low      = float(snapshot.get("fvg_low", 0))
        retail_bias  = snapshot.get("retail_bias", "NEUTRAL").upper()
        retail_long  = float(snapshot.get("retail_pct_long", 50))
        session      = snapshot.get("session", "UNKNOWN").upper()
        spread       = float(snapshot.get("spread_pts", 0))
        news         = bool(snapshot.get("news_imminent", False))

        # ── 1. hard no-trade filters ─────────────────────────────────────────
        no_trade_reasons = self._hard_filters(spread, news, price, hod, lod)

        # ── 2. determine most likely setup direction ─────────────────────────
        direction, setup_type = self._classify_setup(
            trend_htf, swept_high, swept_low, at_ob, ob_type,
            bos, retail_bias, price, hod, lod
        )

        # ── 3. score criteria ────────────────────────────────────────────────
        criteria_met = self._score_criteria(
            direction, trend_htf, swept_high, swept_low,
            at_ob, ob_type, bos, fvg, retail_bias, retail_long, session
        )
        confluence_score = sum(c.score_earned for c in criteria_met)

        # ── 4. check minimum score ───────────────────────────────────────────
        min_score = self.criteria["minimum_requirements"]["min_confluence_score"]
        if confluence_score < min_score:
            no_trade_reasons.append(
                f"Confluence {confluence_score}/100 < minimum {min_score}"
            )

        # ── 5. compute risk levels ───────────────────────────────────────────
        risk = self._compute_risk(direction, price, hod, lod, ob_level, fvg_high, fvg_low)

        # ── 6. validate R:R ─────────────────────────────────────────────────
        min_rr = self.criteria["minimum_requirements"]["min_rr_tp1"]
        if risk and risk.rr_tp1 < min_rr:
            no_trade_reasons.append(
                f"R:R {risk.rr_tp1:.1f}:1 on TP1 < minimum {min_rr}:1"
            )

        # ── 7. determine final verdict ───────────────────────────────────────
        if no_trade_reasons or direction == "NO_TRADE":
            verdict    = "NO_TRADE"
            direction  = "NO_TRADE"
        else:
            verdict = self._verdict(confluence_score)

        # ── 8. build invalidation and execution note ─────────────────────────
        invalidation   = self._invalidation_level(direction, risk)
        execution_note = self._execution_note(direction, setup_type, at_ob, fvg, bos)

        # ── 9. market context ────────────────────────────────────────────────
        market_context = {
            "price":       price,
            "hod":         hod,
            "lod":         lod,
            "range_pts":   round(hod - lod, 1) if hod and lod else None,
            "trend_htf":   trend_htf,
            "bos":         bos,
            "swept_high":  swept_high,
            "swept_low":   swept_low,
            "at_ob":       at_ob,
            "ob_type":     ob_type,
            "ob_level":    ob_level,
            "fvg":         fvg,
            "retail_bias": retail_bias,
            "retail_long": retail_long,
            "session":     session,
        }

        return TradingIdea(
            timestamp       = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            instrument      = "XAUUSD",
            direction       = direction,
            setup_type      = setup_type,
            confluence_score= confluence_score,
            verdict         = verdict,
            risk            = risk,
            criteria_met    = criteria_met,
            market_context  = market_context,
            invalidation    = invalidation,
            execution_note  = execution_note,
            no_trade_reasons= no_trade_reasons,
        )

    def format_idea(self, idea: TradingIdea) -> str:
        """
        Render a TradingIdea as institutional-grade console output.
        """
        W = 90
        line = "═" * W
        thin = "─" * W
        out  = []

        # Header
        out.append(line)
        out.append(f"  QUANTFLOW V1  │  XAUUSD TRADING IDEA  │  {idea.timestamp}")
        out.append(line)

        # Verdict banner
        banners = {
            "HIGH_PROBABILITY_SETUP": "🟢  HIGH PROBABILITY SETUP",
            "MODERATE_SETUP":         "🟡  MODERATE SETUP — MONITOR",
            "WAIT":                   "🟠  WEAK SETUP — WAIT",
            "NO_TRADE":               "🔴  NO TRADE",
        }
        out.append(f"  {banners.get(idea.verdict, idea.verdict)}")
        out.append(thin)

        if idea.direction == "NO_TRADE":
            out.append(f"  REASON(S):")
            for r in idea.no_trade_reasons:
                out.append(f"    ✗  {r}")
            out.append(line)
            return "\n".join(out)

        # Setup identity
        arrow = "▲" if idea.direction == "LONG" else "▼"
        out.append(f"  {arrow}  {idea.direction}  │  {idea.setup_type.replace('_', ' ')}")
        out.append(f"  Confluence Score: {idea.confluence_score:.0f}/100")
        out.append(thin)

        # Market Context
        ctx = idea.market_context
        out.append("  MARKET CONTEXT")
        out.append(thin)
        out.append(f"  Price      :  {ctx['price']}")
        out.append(f"  HOD / LOD  :  {ctx['hod']} / {ctx['lod']}  ({ctx.get('range_pts','?')} pts range)")
        out.append(f"  HTF Trend  :  {ctx['trend_htf']}")
        out.append(f"  BOS        :  {'✅ Confirmed' if ctx['bos'] else '⏳ Pending'}")
        out.append(f"  Swept High :  {'✅ Yes' if ctx['swept_high'] else '❌ No'}")
        out.append(f"  Swept Low  :  {'✅ Yes' if ctx['swept_low'] else '❌ No'}")
        out.append(f"  Order Block:  {'✅ ' + ctx['ob_type'] + ' OB @ ' + str(ctx['ob_level']) if ctx['at_ob'] else '❌ Not at OB'}")
        out.append(f"  FVG        :  {'✅ Present' if ctx['fvg'] else '❌ None detected'}")
        out.append(f"  Retail     :  {ctx['retail_bias']}  ({ctx['retail_long']:.0f}% long)")
        out.append(f"  Session    :  {ctx['session']}")
        out.append(thin)

        # Confluence scorecard
        out.append("  CONFLUENCE SCORECARD")
        out.append(thin)
        for c in idea.criteria_met:
            mark = "✅" if c.met else "❌"
            pts  = f"+{c.score_earned:2d}" if c.met else f"  0"
            out.append(f"  {mark}  {pts}pts  {c.name:<35}  {c.detail}")
        out.append(f"  {'─'*40}")
        out.append(f"       {idea.confluence_score:.0f}/100  total")
        out.append(thin)

        # Trade levels
        r = idea.risk
        if r:
            out.append("  TRADE LEVELS")
            out.append(thin)
            out.append(f"  Entry       :  {r.entry}")
            out.append(f"  Stop Loss   :  {r.stop_loss}  ({r.sl_distance_pts:.0f} pts risk)")
            out.append(f"  TP1  (50%)  :  {r.tp1}  →  R:R {r.rr_tp1:.1f}:1  ✅" if r.rr_tp1 >= 2 else f"  TP1  (50%)  :  {r.tp1}  →  R:R {r.rr_tp1:.1f}:1  ⚠️")
            out.append(f"  TP2  (30%)  :  {r.tp2}  →  R:R {r.rr_tp2:.1f}:1")
            out.append(f"  TP3  (20%)  :  {r.tp3}  →  R:R {r.rr_tp3:.1f}:1")
            out.append(thin)

        # Execution & invalidation
        out.append("  EXECUTION")
        out.append(thin)
        out.append(f"  Trigger     :  {idea.execution_note}")
        out.append(f"  Invalidated :  {idea.invalidation}")
        out.append(line)

        return "\n".join(out)

    # ── private helpers ───────────────────────────────────────────────────────

    def _load_criteria(self) -> Dict:
        try:
            with open(self.CRITERIA_FILE) as f:
                return json.load(f)
        except Exception:
            return {}

    def _hard_filters(self, spread: float, news: bool,
                      price: float, hod: float, lod: float) -> List[str]:
        reasons = []
        max_spread = 3.0
        if spread > max_spread:
            reasons.append(f"Spread {spread} pts > max {max_spread} pts")
        if news:
            reasons.append("High-impact news event imminent (≤30 min)")
        if price <= 0:
            reasons.append("No valid price data")
        if hod and lod and (hod - lod) < 10:
            reasons.append(f"Daily range too narrow ({hod - lod:.1f} pts) — no opportunity")
        return reasons

    def _classify_setup(
        self, trend_htf: str, swept_high: bool, swept_low: bool,
        at_ob: bool, ob_type: str, bos: bool, retail_bias: str,
        price: float, hod: float, lod: float
    ) -> Tuple[str, str]:
        """Return (direction, setup_type)"""

        # LONG: bearish sweep of lows + bullish OB + bullish bias
        if swept_low and at_ob and ob_type == "DEMAND":
            if trend_htf in ("BULLISH", "CONSOLIDATION"):
                return "LONG", "LONG_SWEEP_AND_REVERSE"
            if trend_htf == "BEARISH" and bos:
                return "LONG", "LONG_BOS_PULLBACK"

        # SHORT: bullish sweep of highs + bearish OB + bearish bias
        if swept_high and at_ob and ob_type == "SUPPLY":
            if trend_htf in ("BEARISH", "CONSOLIDATION"):
                return "SHORT", "SHORT_SWEEP_AND_REVERSE"
            if trend_htf == "BULLISH" and bos:
                return "SHORT", "SHORT_BOS_PULLBACK"

        # BOS pullback (no sweep yet but BOS confirmed)
        if bos and at_ob:
            if trend_htf == "BULLISH" and ob_type == "DEMAND":
                return "LONG", "LONG_BOS_PULLBACK"
            if trend_htf == "BEARISH" and ob_type == "SUPPLY":
                return "SHORT", "SHORT_BOS_PULLBACK"

        # Inducement / fake breakout pattern
        if hod and lod and price:
            near_hod = abs(price - hod) < 8
            near_lod = abs(price - lod) < 8
            if near_hod and retail_bias == "MAJORITY_LONG":
                return "SHORT", "INDUCEMENT_TRAP"
            if near_lod and retail_bias == "MAJORITY_SHORT":
                return "LONG", "INDUCEMENT_TRAP"

        return "NO_TRADE", "NO_SETUP"

    def _score_criteria(
        self, direction: str, trend_htf: str,
        swept_high: bool, swept_low: bool,
        at_ob: bool, ob_type: str, bos: bool, fvg: bool,
        retail_bias: str, retail_long: float, session: str
    ) -> List[SetupCriterion]:

        scoring_cfg = self.criteria.get("confluence_scoring", {}).get("factors", {})

        def W(key: str) -> int:
            return scoring_cfg.get(key, {}).get("weight", 10)

        results = []

        # 1. HTF trend aligned (20 pts)
        if direction == "LONG":
            trend_ok = trend_htf in ("BULLISH", "CONSOLIDATION")
            detail = f"HTF is {trend_htf} — {'aligned' if trend_ok else 'opposing'}"
        elif direction == "SHORT":
            trend_ok = trend_htf in ("BEARISH", "CONSOLIDATION")
            detail = f"HTF is {trend_htf} — {'aligned' if trend_ok else 'opposing'}"
        else:
            trend_ok = False
            detail = "Direction unclear"
        w = W("htf_trend_aligned")
        results.append(SetupCriterion("HTF Trend Aligned", trend_ok, w,
                                      w if trend_ok else 0, detail))

        # 2. Liquidity swept (20 pts)
        if direction == "LONG":
            swept = swept_low
            detail = "Lows swept ✓" if swept else "Lows NOT swept — setup not ready"
        elif direction == "SHORT":
            swept = swept_high
            detail = "Highs swept ✓" if swept else "Highs NOT swept — setup not ready"
        else:
            swept = False
            detail = "N/A"
        w = W("liquidity_swept")
        results.append(SetupCriterion("Liquidity Swept", swept, w,
                                      w if swept else 0, detail))

        # 3. Price at Order Block (20 pts)
        ob_aligned = at_ob and (
            (direction == "LONG"  and ob_type == "DEMAND") or
            (direction == "SHORT" and ob_type == "SUPPLY")
        )
        detail = f"At {'DEMAND' if direction=='LONG' else 'SUPPLY'} OB ✓" if ob_aligned else "Not at aligned OB"
        w = W("price_at_order_block")
        results.append(SetupCriterion("Price at Order Block", ob_aligned, w,
                                      w if ob_aligned else 0, detail))

        # 4. BOS confirmed (15 pts)
        w = W("bos_confirmed")
        detail = "Break of Structure confirmed on entry TF" if bos else "BOS not yet confirmed"
        results.append(SetupCriterion("BOS Confirmed", bos, w,
                                      w if bos else 0, detail))

        # 5. FVG present (10 pts)
        w = W("fvg_present")
        detail = "FVG imbalance between entry and TP" if fvg else "No FVG detected"
        results.append(SetupCriterion("FVG Present", fvg, w,
                                      w if fvg else 0, detail))

        # 6. Retail positioning opposite (10 pts)
        retail_against = (
            (direction == "LONG"  and retail_long >= 60) or   # retail majority long = potential long squeeze
            (direction == "SHORT" and retail_long <= 40)       # retail majority short = potential short squeeze
        )
        # Actually for SMC: we want retail AGAINST us so institutions go opposite
        retail_opposite = (
            (direction == "LONG"  and retail_long >= 65) or   # retail heavily long → institutions may push higher after sweep
            (direction == "SHORT" and retail_long <= 35)
        )
        w = W("retail_positioning_opposite")
        detail = f"Retail {retail_long:.0f}% long — {'aligned for squeeze' if retail_opposite else 'not extreme enough'}"
        results.append(SetupCriterion("Retail Positioning Extreme", retail_opposite, w,
                                      w if retail_opposite else 0, detail))

        # 7. Session timing (5 pts)
        good_session = session in ("LONDON", "NY", "OVERLAP", "LONDON_OPEN", "NY_OPEN")
        w = W("session_timing_optimal")
        detail = f"{session} session — {'optimal' if good_session else 'sub-optimal'}"
        results.append(SetupCriterion("Optimal Session", good_session, w,
                                      w if good_session else 0, detail))

        return results

    def _compute_risk(
        self, direction: str, price: float,
        hod: float, lod: float, ob_level: float,
        fvg_high: float, fvg_low: float
    ) -> Optional[RiskLevels]:
        if direction == "NO_TRADE" or not price:
            return None

        buf = self.criteria.get("risk_management", {}).get("stop_loss", {}).get("buffer_points", 5)
        max_sl = self.criteria.get("minimum_requirements", {}).get("max_sl_points", 60)

        if direction == "LONG":
            entry  = round(ob_level if ob_level > 0 else price, 1)
            sl_raw = round(lod - buf if lod else price - 30, 1)
            sl     = max(sl_raw, entry - max_sl)        # never more than max_sl from entry
            sl_dist = round(entry - sl, 1)

            tp1 = round(entry + 2.0 * sl_dist, 1)       # min 2:1
            tp2 = round(entry + 3.0 * sl_dist, 1)
            tp3 = round(hod if hod > tp2 else entry + 5.0 * sl_dist, 1)

        else:  # SHORT
            entry  = round(ob_level if ob_level > 0 else price, 1)
            sl_raw = round(hod + buf if hod else price + 30, 1)
            sl     = min(sl_raw, entry + max_sl)
            sl_dist = round(sl - entry, 1)

            tp1 = round(entry - 2.0 * sl_dist, 1)
            tp2 = round(entry - 3.0 * sl_dist, 1)
            tp3 = round(lod if lod < tp2 else entry - 5.0 * sl_dist, 1)

        def rr(tp: float) -> float:
            if sl_dist == 0:
                return 0.0
            return round(abs(tp - entry) / sl_dist, 2)

        return RiskLevels(
            entry         = entry,
            stop_loss     = sl,
            tp1           = tp1,
            tp2           = tp2,
            tp3           = tp3,
            rr_tp1        = rr(tp1),
            rr_tp2        = rr(tp2),
            rr_tp3        = rr(tp3),
            sl_distance_pts = sl_dist,
            tp1_distance_pts = round(abs(tp1 - entry), 1),
        )

    def _verdict(self, score: float) -> str:
        thresholds = self.criteria.get("confluence_scoring", {}).get("thresholds", {})
        if score >= 80:
            return "HIGH_PROBABILITY_SETUP"
        elif score >= 65:
            return "MODERATE_SETUP"
        elif score >= 50:
            return "WAIT"
        return "NO_TRADE"

    def _invalidation_level(self, direction: str, risk: Optional[RiskLevels]) -> str:
        if not risk or direction == "NO_TRADE":
            return "N/A"
        if direction == "LONG":
            return f"Close below {risk.stop_loss} cancels setup"
        return f"Close above {risk.stop_loss} cancels setup"

    def _execution_note(
        self, direction: str, setup_type: str,
        at_ob: bool, fvg: bool, bos: bool
    ) -> str:
        if direction == "NO_TRADE":
            return "Do not enter — criteria not met"

        notes = []
        if not bos:
            notes.append("Wait for BOS confirmation candle")
        if not at_ob:
            notes.append("Wait for pullback to OB")
        if fvg:
            notes.append("FVG fill entry accepted if OB not reached")

        base = {
            "LONG_SWEEP_AND_REVERSE":  "Enter on bullish displacement candle closing above sweep low",
            "SHORT_SWEEP_AND_REVERSE": "Enter on bearish displacement candle closing below sweep high",
            "LONG_BOS_PULLBACK":       "Enter on M15 bullish structure shift at OB after BOS",
            "SHORT_BOS_PULLBACK":      "Enter on M15 bearish structure shift at OB after BOS",
            "INDUCEMENT_TRAP":         "Enter only after close back inside range — not on wick",
        }.get(setup_type, "Wait for entry confirmation signal")

        if notes:
            return base + "  |  " + " — ".join(notes)
        return base


# ─────────────────────────────────────────────────────────────────────────────
# Quick standalone test
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    engine = TradingSetupEngine()

    # Example: SHORT setup at HOD with high retail long bias
    test_snapshot = {
        "current_price": 3321.50,
        "hod":           3327.00,
        "lod":           3290.00,
        "trend_htf":     "BEARISH",
        "bos_confirmed": True,
        "swept_high":    True,
        "swept_low":     False,
        "at_order_block": True,
        "ob_type":       "SUPPLY",
        "ob_level":      3325.00,
        "fvg_present":   True,
        "fvg_high":      3315.00,
        "fvg_low":       3308.00,
        "retail_bias":   "MAJORITY_LONG",
        "retail_pct_long": 72.0,
        "session":       "LONDON",
        "spread_pts":    1.5,
        "news_imminent": False,
    }

    idea = engine.evaluate(test_snapshot)
    print(engine.format_idea(idea))

    print("\n\n--- JSON export ---\n")
    import json as _json
    from dataclasses import asdict
    print(_json.dumps(asdict(idea), indent=2, default=str))
