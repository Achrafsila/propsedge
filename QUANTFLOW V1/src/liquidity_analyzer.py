#!/usr/bin/env python3
"""
Retail Positioning & Liquidity Analysis Module

Analyzes trading signals from retail traders to extract institutional-level insights:
- Liquidity zone mapping (SL/TP clustering)
- Stop hunt detection
- Capital flow analysis
- Optimal trading zone identification

Role: Market Structure Analyst (NOT signal generator)
Input: Signals (ENTRY, SL, TP, Direction) + Current Market Data
Output: Institutional insights based on liquidity imbalance
"""

from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
import statistics
from datetime import datetime


@dataclass
class TradingSignal:
    """Structured trading signal"""
    direction: str  # "BUY" or "SELL"
    entry: float
    sl: float
    tp: float
    timestamp: Optional[datetime] = None

    def __post_init__(self):
        self.direction = self.direction.upper()
        if self.direction not in ["BUY", "SELL"]:
            raise ValueError(f"Invalid direction: {self.direction}")


@dataclass
class MarketContext:
    """Current market data for analysis"""
    current_price: float
    intraday_high: float
    intraday_low: float
    timeframe: str = "1D"
    # Session data (optional for enhanced analysis)
    session_high: Optional[float] = None  # Daily high (from session open)
    session_low: Optional[float] = None   # Daily low (from session open)
    vwap: Optional[float] = None          # Volume Weighted Average Price

    def has_session_data(self) -> bool:
        """Check if full session data is available"""
        return all([self.session_high, self.session_low, self.vwap])

    def get_price_to_vwap_distance(self) -> Optional[float]:
        """Get distance from current price to VWAP"""
        if self.vwap is None:
            return None
        return abs(self.current_price - self.vwap)

    def get_vwap_alignment(self) -> str:
        """Determine price position relative to VWAP"""
        if self.vwap is None:
            return "UNKNOWN"
        if self.current_price > self.vwap:
            return "ABOVE_VWAP"
        elif self.current_price < self.vwap:
            return "BELOW_VWAP"
        else:
            return "AT_VWAP"


@dataclass
class LiquidityCluster:
    """Identified liquidity cluster zone"""
    price_low: float
    price_high: float
    signal_count: int
    cluster_type: str  # "SL" or "TP"
    signals: List[TradingSignal] = None

    def __post_init__(self):
        if self.signals is None:
            self.signals = []

    @property
    def center(self) -> float:
        """Center price of the cluster"""
        return (self.price_low + self.price_high) / 2

    @property
    def distance_from_price(self, price: float) -> float:
        """Distance from a given price to cluster center"""
        return abs(self.center - price)


class RetailPositioningAnalyzer:
    """Analyze retail trader positioning from signal data"""

    def __init__(self, signals: List[TradingSignal]):
        self.signals = signals
        self.buy_signals = [s for s in signals if s.direction == "BUY"]
        self.sell_signals = [s for s in signals if s.direction == "SELL"]

    def compute_bias(self) -> Dict:
        """Calculate retail trader bias (% BUY vs SELL)"""
        total = len(self.signals)
        if total == 0:
            return {
                "buy_count": 0,
                "sell_count": 0,
                "buy_percent": 0.0,
                "sell_percent": 0.0,
                "dominant_bias": "NEUTRAL",
                "crowding_level": "LOW",
                "interpretation": "No signals to analyze"
            }

        buy_count = len(self.buy_signals)
        sell_count = len(self.sell_signals)
        buy_percent = (buy_count / total) * 100
        sell_percent = (sell_count / total) * 100

        # Determine dominant bias
        if buy_percent > 65:
            dominant_bias = "BULLISH"
            crowding_level = "EXTREME" if buy_percent > 80 else "HIGH"
        elif sell_percent > 65:
            dominant_bias = "BEARISH"
            crowding_level = "EXTREME" if sell_percent > 80 else "HIGH"
        else:
            dominant_bias = "NEUTRAL"
            crowding_level = "LOW"

        interpretation = self._interpret_bias(buy_percent, dominant_bias)

        return {
            "buy_count": buy_count,
            "sell_count": sell_count,
            "buy_percent": round(buy_percent, 2),
            "sell_percent": round(sell_percent, 2),
            "dominant_bias": dominant_bias,
            "crowding_level": crowding_level,
            "interpretation": interpretation
        }

    def _interpret_bias(self, buy_percent: float, dominant_bias: str) -> str:
        """Generate interpretation of bias"""
        if dominant_bias == "BULLISH":
            return f"Retail heavily skewed long ({buy_percent:.1f}% BUY). High crowding risk - vulnerable to stop hunt."
        elif dominant_bias == "BEARISH":
            return f"Retail heavily skewed short ({100-buy_percent:.1f}% SELL). High crowding risk - vulnerable to reversal."
        else:
            return f"Retail positioning is mixed ({buy_percent:.1f}% BUY). No clear directional bias - range-bound tendency."

    def compute_entry_stats(self) -> Dict:
        """Calculate entry price statistics"""
        if not self.signals:
            return {}

        entries = [s.entry for s in self.signals]

        return {
            "avg_entry": round(statistics.mean(entries), 2),
            "median_entry": round(statistics.median(entries), 2),
            "min_entry": round(min(entries), 2),
            "max_entry": round(max(entries), 2),
            "entry_range": round(max(entries) - min(entries), 2),
            "stdev_entry": round(statistics.stdev(entries), 2) if len(entries) > 1 else 0.0
        }

    def compute_risk_stats(self) -> Dict:
        """Calculate stop loss distance statistics"""
        if not self.signals:
            return {}

        sl_distances = []
        for signal in self.signals:
            distance = abs(signal.entry - signal.sl)
            sl_distances.append(distance)

        return {
            "avg_sl_distance": round(statistics.mean(sl_distances), 2),
            "median_sl_distance": round(statistics.median(sl_distances), 2),
            "min_sl_distance": round(min(sl_distances), 2),
            "max_sl_distance": round(max(sl_distances), 2),
            "aggressive_stops": len([d for d in sl_distances if d < 5]),  # SL < $5
            "conservative_stops": len([d for d in sl_distances if d >= 10])  # SL >= $10
        }

    def compute_profit_target_stats(self) -> Dict:
        """Calculate take profit distance statistics"""
        if not self.signals:
            return {}

        tp_distances = []
        rr_ratios = []

        for signal in self.signals:
            tp_distance = abs(signal.tp - signal.entry)
            tp_distances.append(tp_distance)

            sl_distance = abs(signal.entry - signal.sl)
            if sl_distance > 0:
                rr_ratio = tp_distance / sl_distance
                rr_ratios.append(rr_ratio)

        return {
            "avg_tp_distance": round(statistics.mean(tp_distances), 2),
            "median_tp_distance": round(statistics.median(tp_distances), 2),
            "min_tp_distance": round(min(tp_distances), 2),
            "max_tp_distance": round(max(tp_distances), 2),
            "avg_risk_reward": round(statistics.mean(rr_ratios), 2) if rr_ratios else 0.0,
            "poor_rr_count": len([r for r in rr_ratios if r < 1.0]),  # RR < 1:1
            "good_rr_count": len([r for r in rr_ratios if r >= 1.5])  # RR >= 1.5:1
        }


class LiquidityMapper:
    """Map liquidity zones from signal clustering"""

    def __init__(self, signals: List[TradingSignal], clustering_tolerance: float = 10.0):
        """
        Initialize liquidity mapper

        Args:
            signals: List of trading signals
            clustering_tolerance: Price range for clustering (e.g., $10 = 10 pips)
        """
        self.signals = signals
        self.tolerance = clustering_tolerance

    def find_sl_clusters(self) -> List[LiquidityCluster]:
        """Identify stop loss clusters"""
        return self._cluster_prices([s.sl for s in self.signals], "SL")

    def find_tp_clusters(self) -> List[LiquidityCluster]:
        """Identify take profit clusters"""
        return self._cluster_prices([s.tp for s in self.signals], "TP")

    def _cluster_prices(self, prices: List[float], cluster_type: str) -> List[LiquidityCluster]:
        """
        Group prices into clusters within tolerance range

        Algorithm:
        1. Sort prices
        2. Group prices within tolerance distance
        3. Return clusters with signal counts
        """
        if not prices:
            return []

        sorted_prices = sorted(prices)
        clusters = []
        current_cluster = [sorted_prices[0]]

        for price in sorted_prices[1:]:
            if price - current_cluster[0] <= self.tolerance:
                current_cluster.append(price)
            else:
                # Finalize current cluster
                clusters.append(self._create_cluster(current_cluster, cluster_type))
                current_cluster = [price]

        # Add final cluster
        if current_cluster:
            clusters.append(self._create_cluster(current_cluster, cluster_type))

        # Filter clusters with only 1 signal (noise)
        return [c for c in clusters if c.signal_count > 1]

    def _create_cluster(self, prices: List[float], cluster_type: str) -> LiquidityCluster:
        """Create a liquidity cluster from price group"""
        return LiquidityCluster(
            price_low=min(prices),
            price_high=max(prices),
            signal_count=len(prices),
            cluster_type=cluster_type
        )

    def get_clusters_above_price(self, current_price: float,
                                 sl_clusters: List[LiquidityCluster],
                                 tp_clusters: List[LiquidityCluster]) -> List[LiquidityCluster]:
        """Get liquidity clusters above current price"""
        all_clusters = sl_clusters + tp_clusters
        return [c for c in all_clusters if c.center > current_price]

    def get_clusters_below_price(self, current_price: float,
                                 sl_clusters: List[LiquidityCluster],
                                 tp_clusters: List[LiquidityCluster]) -> List[LiquidityCluster]:
        """Get liquidity clusters below current price"""
        all_clusters = sl_clusters + tp_clusters
        return [c for c in all_clusters if c.center < current_price]

    def identify_strongest_pools(self, sl_clusters: List[LiquidityCluster],
                                tp_clusters: List[LiquidityCluster],
                                top_n: int = 3) -> List[Tuple[LiquidityCluster, str]]:
        """Identify strongest liquidity pools by signal concentration"""
        all_clusters = [(c, "SL") for c in sl_clusters] + [(c, "TP") for c in tp_clusters]
        # Sort by signal count (descending)
        sorted_clusters = sorted(all_clusters, key=lambda x: x[0].signal_count, reverse=True)
        return sorted_clusters[:top_n]


class PriceActionAnalyzer:
    """Analyze price action vs liquidity positioning"""

    def __init__(self, market: MarketContext, signals: List[TradingSignal]):
        self.market = market
        self.signals = signals

    def has_liquidity_been_taken(self, clusters: List[LiquidityCluster]) -> Dict:
        """
        Determine if liquidity pools have been touched/swept

        Returns:
            {
                "above": {"taken": bool, "price": float},
                "below": {"taken": bool, "price": float}
            }
        """
        above_clusters = [c for c in clusters if c.center > self.market.current_price]
        below_clusters = [c for c in clusters if c.center < self.market.current_price]

        # Check if intraday high touched above clusters
        above_taken = any(
            self.market.intraday_high >= c.price_low
            for c in above_clusters
        )

        # Check if intraday low touched below clusters
        below_taken = any(
            self.market.intraday_low <= c.price_high
            for c in below_clusters
        )

        above_touch = max([c.price_low for c in above_clusters]) if above_clusters else None
        below_touch = min([c.price_high for c in below_clusters]) if below_clusters else None

        return {
            "above": {
                "taken": above_taken,
                "price": above_touch
            },
            "below": {
                "taken": below_taken,
                "price": below_touch
            }
        }

    def detect_stop_hunt(self, sl_clusters: List[LiquidityCluster],
                        positioning_bias: str) -> Dict:
        """
        Detect stop hunt pattern:
        - Price touches SL cluster
        - Reversal occurs
        - Retail got liquidated at worst prices
        """
        if positioning_bias == "BULLISH":
            # Looking for SELL (reverse) stop hunt - price down to SL then up
            for cluster in sl_clusters:
                if (self.market.intraday_low <= cluster.price_high and
                    self.market.current_price > cluster.center):
                    return {
                        "detected": True,
                        "type": "SELL_STOP_HUNT",
                        "cluster_price": cluster.center,
                        "touched_at": self.market.intraday_low,
                        "reversal": "UP",
                        "description": "SL cluster touched on downside, price reversed higher - retail longs liquidated"
                    }

        elif positioning_bias == "BEARISH":
            # Looking for BUY stop hunt - price up to SL then down
            for cluster in sl_clusters:
                if (self.market.intraday_high >= cluster.price_low and
                    self.market.current_price < cluster.center):
                    return {
                        "detected": True,
                        "type": "BUY_STOP_HUNT",
                        "cluster_price": cluster.center,
                        "touched_at": self.market.intraday_high,
                        "reversal": "DOWN",
                        "description": "SL cluster touched on upside, price reversed lower - retail shorts liquidated"
                    }

        return {"detected": False}

    def detect_liquidity_sweeps(self, all_clusters: List[LiquidityCluster]) -> List[Dict]:
        """
        Detect liquidity sweep: Price runs through cluster without reversing
        = Liquidity already taken at lower prices = Momentum zone
        """
        sweeps = []

        for cluster in all_clusters:
            # Check if price passed through cluster
            cluster_passed = (
                (self.market.intraday_low < cluster.price_low and self.market.current_price > cluster.price_high) or
                (self.market.intraday_high > cluster.price_high and self.market.current_price < cluster.price_low)
            )

            if cluster_passed:
                sweeps.append({
                    "cluster_price": cluster.center,
                    "cluster_type": cluster.cluster_type,
                    "direction": "UP" if self.market.current_price > cluster.center else "DOWN",
                    "range_swept": f"{cluster.price_low:.2f} - {cluster.price_high:.2f}",
                    "description": f"Price swept through {cluster.cluster_type} cluster at {cluster.center:.2f} - no stopping power"
                })

        return sweeps

    def detect_inefficiencies(self, signals: List[TradingSignal]) -> Dict:
        """
        Detect price imbalances where price moved far from entry without hitting SL/TP
        """
        avg_entry = statistics.mean([s.entry for s in signals])
        entry_distance = abs(self.market.current_price - avg_entry)
        intraday_range = self.market.intraday_high - self.market.intraday_low

        return {
            "avg_entry": round(avg_entry, 2),
            "current_distance_from_entry": round(entry_distance, 2),
            "intraday_range": round(intraday_range, 2),
            "move_factor": round(entry_distance / intraday_range, 2) if intraday_range > 0 else 0,
            "imbalance_level": "HIGH" if entry_distance > intraday_range * 0.5 else "NORMAL"
        }


class VWAPAnalyzer:
    """Analyze price action relative to VWAP and session levels"""

    def __init__(self, market: MarketContext, signals: List[TradingSignal]):
        self.market = market
        self.signals = signals

    def analyze_vwap_context(self) -> Dict:
        """Generate VWAP analysis if data available"""
        if not self.market.vwap:
            return {"available": False}

        distance_to_vwap = self.market.get_price_to_vwap_distance()
        alignment = self.market.get_vwap_alignment()

        # Analyze retail entries relative to VWAP
        avg_entry = statistics.mean([s.entry for s in self.signals])
        entry_vs_vwap = "ABOVE_VWAP" if avg_entry > self.market.vwap else "BELOW_VWAP"

        return {
            "available": True,
            "vwap_level": round(self.market.vwap, 2),
            "current_price": round(self.market.current_price, 2),
            "distance_to_vwap": round(distance_to_vwap, 2),
            "price_alignment": alignment,
            "avg_entry_alignment": entry_vs_vwap,
            "interpretation": self._interpret_vwap_alignment(alignment, entry_vs_vwap)
        }

    def _interpret_vwap_alignment(self, price_alignment: str, entry_alignment: str) -> str:
        """Interpret VWAP alignment significance"""
        if price_alignment == "ABOVE_VWAP":
            if entry_alignment == "BELOW_VWAP":
                return "Price above VWAP while entries below = Uptrend, retail chasing rally"
            else:
                return "Price and entries both above VWAP = Confirmed uptrend"
        elif price_alignment == "BELOW_VWAP":
            if entry_alignment == "ABOVE_VWAP":
                return "Price below VWAP while entries above = Downtrend, retail overextended"
            else:
                return "Price and entries both below VWAP = Confirmed downtrend"
        else:
            return "Price at VWAP = Balanced market, fair value level"

    def identify_vwap_as_level(self) -> Dict:
        """Assess VWAP as support/resistance level"""
        if not self.market.vwap:
            return {}

        # Check if price touched VWAP during intraday
        vwap_touched = (
            self.market.intraday_low <= self.market.vwap <= self.market.intraday_high
        )

        return {
            "vwap_touched_intraday": vwap_touched,
            "vwap_role": self._determine_vwap_role(),
            "vwap_strength": self._estimate_vwap_strength()
        }

    def _determine_vwap_role(self) -> str:
        """Determine if VWAP is acting as support or resistance"""
        if self.market.current_price > self.market.vwap:
            return "SUPPORT"  # VWAP below price = support
        elif self.market.current_price < self.market.vwap:
            return "RESISTANCE"  # VWAP above price = resistance
        else:
            return "PIVOT"  # Price at VWAP = pivot point

    def _estimate_vwap_strength(self) -> str:
        """Estimate how strong VWAP level is"""
        # Check if retail entries are near VWAP
        retail_entries = [s.entry for s in self.signals]
        distance_from_vwap = [abs(e - self.market.vwap) for e in retail_entries]
        avg_distance = statistics.mean(distance_from_vwap)

        # If many retail entries near VWAP = strong level
        if avg_distance < 5.0:  # Less than $5 away
            return "STRONG"  # Many retail entries at/near VWAP
        elif avg_distance < 15.0:
            return "MODERATE"
        else:
            return "WEAK"

    def analyze_session_levels(self) -> Dict:
        """Analyze price relative to session high/low"""
        if not self.market.session_high or not self.market.session_low:
            return {"available": False}

        session_range = self.market.session_high - self.market.session_low
        price_in_range = self.market.current_price - self.market.session_low
        range_percent = (price_in_range / session_range * 100) if session_range > 0 else 0

        return {
            "available": True,
            "session_high": round(self.market.session_high, 2),
            "session_low": round(self.market.session_low, 2),
            "session_range": round(session_range, 2),
            "price_in_range_percent": round(range_percent, 1),
            "position": self._determine_session_position(range_percent),
            "interpretation": self._interpret_session_position(range_percent)
        }

    def _determine_session_position(self, range_percent: float) -> str:
        """Determine where price is in session range"""
        if range_percent > 75:
            return "UPPER_QUARTILE"  # Top 25% of session range
        elif range_percent > 50:
            return "UPPER_HALF"
        elif range_percent > 25:
            return "LOWER_HALF"
        else:
            return "LOWER_QUARTILE"  # Bottom 25% of session range

    def _interpret_session_position(self, range_percent: float) -> str:
        """Interpret session position significance"""
        if range_percent > 75:
            return "Price in upper range - strong bullish bias, near session highs"
        elif range_percent > 50:
            return "Price in upper half - moderate bullish bias"
        elif range_percent > 25:
            return "Price in lower half - moderate bearish bias"
        else:
            return "Price in lower range - strong bearish bias, near session lows"


class PositioningAssessment:
    """Assess whether retail positioning is correct, trapped, or mixed"""

    def __init__(self, signals: List[TradingSignal], market: MarketContext,
                 positioning_bias: Dict):
        self.signals = signals
        self.market = market
        self.bias = positioning_bias

    def classify_status(self) -> Dict:
        """Classify retail positioning status"""
        if self.bias["dominant_bias"] == "NEUTRAL":
            return {
                "status": "MIXED",
                "explanation": "Retail is split across BUY/SELL - no clear directional conviction",
                "liquidation_probability": "LOW"
            }

        avg_entry = statistics.mean([s.entry for s in self.signals])

        if self.bias["dominant_bias"] == "BULLISH":
            # Retail is mostly long
            if self.market.current_price > avg_entry:
                # Price moved in retail's favor
                return {
                    "status": "CORRECT",
                    "explanation": f"Retail is positioned long at {avg_entry:.2f}, price moved up to {self.market.current_price:.2f}. Trend continuation likely.",
                    "liquidation_probability": "LOW"
                }
            else:
                # Price moved against retail
                return {
                    "status": "TRAPPED",
                    "explanation": f"Retail is positioned long at {avg_entry:.2f}, but price dropped to {self.market.current_price:.2f}. Reversal likely after SL sweep.",
                    "liquidation_probability": "HIGH"
                }

        else:  # BEARISH
            # Retail is mostly short
            if self.market.current_price < avg_entry:
                # Price moved in retail's favor
                return {
                    "status": "CORRECT",
                    "explanation": f"Retail is positioned short at {avg_entry:.2f}, price moved down to {self.market.current_price:.2f}. Trend continuation likely.",
                    "liquidation_probability": "LOW"
                }
            else:
                # Price moved against retail
                return {
                    "status": "TRAPPED",
                    "explanation": f"Retail is positioned short at {avg_entry:.2f}, but price rose to {self.market.current_price:.2f}. Reversal likely after SL sweep.",
                    "liquidation_probability": "HIGH"
                }


class MarketStructureAnalyzer:
    """Analyze overall market structure and move type"""

    def __init__(self, market: MarketContext, signals: List[TradingSignal],
                 sl_clusters: List[LiquidityCluster],
                 tp_clusters: List[LiquidityCluster]):
        self.market = market
        self.signals = signals
        self.sl_clusters = sl_clusters
        self.tp_clusters = tp_clusters

    def determine_intraday_bias(self) -> str:
        """Determine if intraday structure is bullish, bearish, or neutral"""
        avg_entry = statistics.mean([s.entry for s in self.signals])

        if self.market.current_price > avg_entry:
            return "BULLISH"
        elif self.market.current_price < avg_entry:
            return "BEARISH"
        else:
            return "NEUTRAL"

    def classify_move_type(self, positioning_status: str) -> str:
        """
        Classify type of price move:
        - CONTINUATION: Price and positioning aligned
        - REVERSAL: Price and positioning misaligned (trapped)
        - LIQUIDITY_GRAB: Price touches key levels then reverses
        """
        if positioning_status == "CORRECT":
            return "CONTINUATION"
        elif positioning_status == "TRAPPED":
            return "REVERSAL"
        else:
            return "RANGE_BOUND"

    def analyze_structure(self) -> Dict:
        """Generate complete structure analysis"""
        intraday_bias = self.determine_intraday_bias()

        # Check retail entry vs current price relationship
        avg_entry = statistics.mean([s.entry for s in self.signals])

        return {
            "intraday_bias": intraday_bias,
            "current_price": self.market.current_price,
            "avg_retail_entry": round(avg_entry, 2),
            "price_above_entries": self.market.current_price > avg_entry,
            "intraday_high": self.market.intraday_high,
            "intraday_low": self.market.intraday_low,
            "range_size": round(self.market.intraday_high - self.market.intraday_low, 2),
            "sl_clusters_above": len([c for c in self.sl_clusters if c.center > self.market.current_price]),
            "sl_clusters_below": len([c for c in self.sl_clusters if c.center < self.market.current_price]),
            "tp_clusters_above": len([c for c in self.tp_clusters if c.center > self.market.current_price]),
            "tp_clusters_below": len([c for c in self.tp_clusters if c.center < self.market.current_price])
        }


class LiquidityAnalyzer:
    """Main orchestrator for complete liquidity analysis"""

    def __init__(self, signals: List[TradingSignal], market: MarketContext,
                 clustering_tolerance: float = 10.0):
        """
        Initialize analyzer

        Args:
            signals: List of TradingSignal objects
            market: MarketContext with current price and intraday range
            clustering_tolerance: Price range for grouping (default $10)
        """
        self.signals = signals
        self.market = market

        # Initialize sub-analyzers
        self.positioning = RetailPositioningAnalyzer(signals)
        self.liquidity_mapper = LiquidityMapper(signals, clustering_tolerance)

    def analyze(self) -> Dict:
        """Run complete analysis and return institutional insights"""

        # 1. RETAIL POSITIONING
        positioning_bias = self.positioning.compute_bias()
        entry_stats = self.positioning.compute_entry_stats()
        risk_stats = self.positioning.compute_risk_stats()
        tp_stats = self.positioning.compute_profit_target_stats()

        # 2. LIQUIDITY MAPPING
        sl_clusters = self.liquidity_mapper.find_sl_clusters()
        tp_clusters = self.liquidity_mapper.find_tp_clusters()
        all_clusters = sl_clusters + tp_clusters

        strongest_pools = self.liquidity_mapper.identify_strongest_pools(
            sl_clusters, tp_clusters, top_n=3
        )

        # 3. PRICE ACTION ANALYSIS
        price_action = PriceActionAnalyzer(self.market, self.signals)
        liquidity_taken = price_action.has_liquidity_been_taken(all_clusters)
        stop_hunt = price_action.detect_stop_hunt(sl_clusters, positioning_bias["dominant_bias"])
        liquidity_sweeps = price_action.detect_liquidity_sweeps(all_clusters)
        inefficiencies = price_action.detect_inefficiencies(self.signals)

        # 4. POSITIONING ASSESSMENT
        positioning_assess = PositioningAssessment(self.signals, self.market, positioning_bias)
        positioning_status = positioning_assess.classify_status()

        # 5. MARKET STRUCTURE
        structure = MarketStructureAnalyzer(self.market, self.signals, sl_clusters, tp_clusters)
        move_type = structure.classify_move_type(positioning_status["status"])
        structure_analysis = structure.analyze_structure()

        # 5B. VWAP & SESSION ANALYSIS (NEW)
        vwap_analyzer = VWAPAnalyzer(self.market, self.signals)
        vwap_analysis = vwap_analyzer.analyze_vwap_context()
        vwap_as_level = vwap_analyzer.identify_vwap_as_level()
        session_analysis = vwap_analyzer.analyze_session_levels()

        # 6. GENERATE TRADING ZONES
        trading_zones = self._generate_trading_zones(
            positioning_status, sl_clusters, tp_clusters, structure_analysis
        )

        # 7. FINAL INSIGHT
        final_insight = self._generate_final_insight(
            positioning_status, stop_hunt, positioning_bias, structure_analysis
        )

        return {
            "timestamp": datetime.now().isoformat(),
            "retail_bias": positioning_bias,
            "entry_stats": entry_stats,
            "risk_stats": risk_stats,
            "tp_stats": tp_stats,
            "liquidity_zones": {
                "sl_clusters": self._serialize_clusters(sl_clusters),
                "tp_clusters": self._serialize_clusters(tp_clusters),
                "strongest_pools": [
                    {"price": round(c.center, 2), "count": c.signal_count, "type": t}
                    for c, t in strongest_pools
                ]
            },
            "price_action": {
                "liquidity_taken": liquidity_taken,
                "stop_hunt_detected": stop_hunt,
                "liquidity_sweeps": liquidity_sweeps,
                "inefficiencies": inefficiencies
            },
            "positioning_assessment": positioning_status,
            "market_structure": {
                "intraday_bias": structure_analysis["intraday_bias"],
                "move_type": move_type,
                "structure": structure_analysis
            },
            "vwap_analysis": {
                "vwap": vwap_analysis,
                "vwap_as_level": vwap_as_level,
                "session": session_analysis
            },
            "trading_zones": trading_zones,
            "final_insight": final_insight
        }

    def _serialize_clusters(self, clusters: List[LiquidityCluster]) -> List[Dict]:
        """Convert clusters to serializable format"""
        return [
            {
                "price_range": f"{c.price_low:.2f} - {c.price_high:.2f}",
                "center": round(c.center, 2),
                "signal_count": c.signal_count,
                "type": c.cluster_type
            }
            for c in clusters
        ]

    def _generate_trading_zones(self, positioning_status: Dict,
                               sl_clusters: List[LiquidityCluster],
                               tp_clusters: List[LiquidityCluster],
                               structure: Dict) -> Dict:
        """Generate high-probability trading zones based on liquidity"""

        entry_zones = []
        target_zones = []
        invalidation_level = None

        # Logic depends on positioning status
        if positioning_status["status"] == "TRAPPED":
            # Retail is trapped - expect reversal
            # Entry zones: Near SL clusters (after sweep)
            for cluster in sl_clusters:
                if cluster.center < self.market.current_price:
                    entry_zones.append({
                        "price": round(cluster.center, 2),
                        "range": f"{cluster.price_low:.2f}-{cluster.price_high:.2f}",
                        "rationale": f"SL cluster - retail trapped, reversal expected after liquidation",
                        "confidence": "HIGH" if cluster.signal_count >= 3 else "MEDIUM"
                    })

            # Target zones: TP clusters or entry clusters in opposite direction
            for cluster in tp_clusters:
                if cluster.center > self.market.current_price:
                    target_zones.append({
                        "price": round(cluster.center, 2),
                        "rationale": f"TP cluster - profit taking zone"
                    })

        elif positioning_status["status"] == "CORRECT":
            # Retail is correct - trend continuation
            # Entry zones: Near current price / pullback zones
            for cluster in tp_clusters:
                if cluster.center > self.market.current_price:
                    entry_zones.append({
                        "price": round(cluster.center, 2),
                        "range": f"{cluster.price_low:.2f}-{cluster.price_high:.2f}",
                        "rationale": f"TP cluster ahead - continuation target",
                        "confidence": "HIGH" if cluster.signal_count >= 3 else "MEDIUM"
                    })

        return {
            "entry_zones": entry_zones,
            "target_zones": target_zones if target_zones else [{"price": "TBD", "rationale": "Insufficient data"}],
            "invalidation_level": invalidation_level
        }

    def _generate_final_insight(self, positioning_status: Dict, stop_hunt: Dict,
                               positioning_bias: Dict, structure: Dict) -> str:
        """Generate one-line institutional conclusion"""

        if positioning_status["status"] == "TRAPPED":
            if stop_hunt.get("detected"):
                return f"Retail trapped {positioning_bias['dominant_bias'].lower()}, SL cluster at {stop_hunt['cluster_price']:.2f} likely to be swept - expect reversal."
            else:
                return f"Retail positioned {positioning_bias['dominant_bias'].lower()} but trapped - capital flow reversing into SL zones."

        elif positioning_status["status"] == "CORRECT":
            return f"Retail correct with {positioning_bias['dominant_bias'].lower()} bias - trend continuation likely into TP clusters."

        else:
            return f"Mixed retail positioning creating range - expect oscillation between entry and SL/TP zones."
