#!/usr/bin/env python3
"""
Smart Money Concepts (SMC) Analyzer
Institutional-grade market structure analysis for XAUUSD
"""

import json
from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple, Optional
from datetime import datetime


@dataclass
class LiquidityZone:
    """Liquidity level with type and signal strength"""
    level: float
    zone_type: str  # "HOD", "LOD", "Equal_High", "Equal_Low", "Swing_High", "Swing_Low"
    signal_count: int
    consensus: float  # 0-1
    strength: str  # "WEAK", "MEDIUM", "STRONG"


@dataclass
class OrderBlock:
    """Order block structure"""
    level: float
    type: str  # "DEMAND", "SUPPLY"
    timeframe: str
    confirmed: bool
    break_point: Optional[float]


@dataclass
class FairValueGap:
    """Fair Value Gap (imbalance)"""
    high: float
    low: float
    location: str  # "ABOVE", "BELOW", "CURRENT_PRICE"
    untouched: bool
    confirmation: float  # 0-1


@dataclass
class SMCAnalysis:
    """Complete SMC analysis output"""
    timestamp: str
    current_price: float
    market_structure: Dict
    liquidity_zones: Dict
    sweeps: Dict
    order_blocks: Dict
    fair_value_gaps: Dict
    confluence_score: float
    verdict: str


class SMCAnalyzer:
    """Smart Money Concepts Analysis Engine"""

    def __init__(self, historical_prices: Optional[List[float]] = None):
        """
        Initialize SMC Analyzer

        Args:
            historical_prices: List of price points for structure analysis
        """
        self.historical_prices = historical_prices or []
        self.current_price = None
        self.hod = None
        self.lod = None

    def analyze(
        self,
        current_price: float,
        hod: float,
        lod: float,
        retail_positions: Dict,
        signal_clusters: Dict,
        historical_data: Optional[Dict] = None
    ) -> SMCAnalysis:
        """
        Run complete SMC analysis

        Args:
            current_price: Current XAUUSD price
            hod: High of Day
            lod: Low of Day
            retail_positions: Retail entry/SL/TP clusters
            signal_clusters: Aggregated signal data
            historical_data: Optional historical price data

        Returns:
            Complete SMC analysis with confluence scoring
        """
        self.current_price = current_price
        self.hod = hod
        self.lod = lod

        # Run all analysis components
        market_structure = self.identify_market_structure(retail_positions)
        liquidity_zones = self.map_liquidity_zones(retail_positions, signal_clusters)
        sweeps = self.detect_sweeps(market_structure, retail_positions)
        order_blocks = self.identify_order_blocks(market_structure, retail_positions)
        fvgs = self.detect_fvgs(market_structure)

        # Calculate confluence
        confluence_score = self.combine_smc_confluence(
            market_structure, liquidity_zones, sweeps, order_blocks, fvgs
        )

        # Determine verdict
        verdict = self._determine_verdict(confluence_score, market_structure, sweeps)

        return SMCAnalysis(
            timestamp=datetime.utcnow().isoformat() + "Z",
            current_price=current_price,
            market_structure=market_structure,
            liquidity_zones=liquidity_zones,
            sweeps=sweeps,
            order_blocks=order_blocks,
            fair_value_gaps=fvgs,
            confluence_score=confluence_score,
            verdict=verdict
        )

    def identify_market_structure(self, retail_positions: Dict) -> Dict:
        """
        Identify market structure: BOS, CHoCH, trend direction

        BOS (Break of Structure): Price breaks previous swing high/low
        CHoCH (Change of Character): Pattern/momentum change
        """
        analysis = {
            "trend": "UNKNOWN",
            "bos_status": "NONE",
            "choch_status": "NONE",
            "structure_validity": 0,
            "swing_high": self.hod,
            "swing_low": self.lod,
            "details": {}
        }

        if not self.current_price or not self.hod or not self.lod:
            return analysis

        # Determine trend based on current price position
        price_range = self.hod - self.lod
        price_position = (self.current_price - self.lod) / price_range if price_range > 0 else 0.5

        if price_position > 0.7:
            analysis["trend"] = "BULLISH"
        elif price_position < 0.3:
            analysis["trend"] = "BEARISH"
        else:
            analysis["trend"] = "CONSOLIDATION"

        # Detect BOS (Break of Structure)
        retail_entry = retail_positions.get("entry_cluster", {}).get("zone", [4670, 4675])
        entry_avg = sum(retail_entry) / len(retail_entry) if retail_entry else 4670

        if analysis["trend"] == "BULLISH":
            analysis["bos_status"] = "BOS_CONFIRMED" if self.current_price > entry_avg else "BOS_PENDING"
            analysis["structure_validity"] = 0.9 if self.current_price > entry_avg else 0.6
            analysis["details"]["bos_level"] = entry_avg
        else:
            analysis["bos_status"] = "BOS_PENDING"
            analysis["structure_validity"] = 0.5

        # Detect CHoCH (Change of Character)
        retail_sl = retail_positions.get("stop_loss_cluster", {}).get("level", 4661)
        if self.current_price < retail_sl:
            analysis["choch_status"] = "CHOCH_CONFIRMED"
        elif abs(self.current_price - retail_sl) < 5:
            analysis["choch_status"] = "CHOCH_PENDING"

        return analysis

    def map_liquidity_zones(self, retail_positions: Dict, signal_clusters: Dict) -> Dict:
        """
        Map key liquidity zones: HOD, LOD, equal highs/lows, entry clusters
        """
        zones = {
            "strong_zones": [],
            "weak_zones": [],
            "summary": {}
        }

        # Primary zones
        hod_zone = LiquidityZone(
            level=self.hod,
            zone_type="HOD",
            signal_count=1,
            consensus=1.0,
            strength="STRONG"
        )
        lod_zone = LiquidityZone(
            level=self.lod,
            zone_type="LOD",
            signal_count=1,
            consensus=1.0,
            strength="STRONG"
        )

        # Retail entry cluster
        entry_zone = retail_positions.get("entry_cluster", {})
        if entry_zone:
            retail_entry_level = entry_zone.get("zone", [4670, 4675])
            entry_avg = sum(retail_entry_level) / len(retail_entry_level)
            entry_zone_obj = LiquidityZone(
                level=entry_avg,
                zone_type="Entry_Cluster",
                signal_count=entry_zone.get("signal_count", 10),
                consensus=entry_zone.get("consensus", 0.67),
                strength="STRONG"
            )
            zones["strong_zones"].append(asdict(entry_zone_obj))

        # Retail SL cluster
        sl_level = retail_positions.get("stop_loss_cluster", {}).get("level", 4661)
        sl_zone_obj = LiquidityZone(
            level=sl_level,
            zone_type="SL_Cluster",
            signal_count=retail_positions.get("stop_loss_cluster", {}).get("signal_count", 13),
            consensus=retail_positions.get("stop_loss_cluster", {}).get("consensus", 0.87),
            strength="VERY_STRONG"
        )
        zones["strong_zones"].append(asdict(hod_zone))
        zones["strong_zones"].append(asdict(lod_zone))
        zones["strong_zones"].append(asdict(sl_zone_obj))

        # Summary
        zones["summary"] = {
            "strongest_level": sl_level,
            "strongest_type": "SL_Cluster",
            "total_zones": len(zones["strong_zones"]),
            "liquidity_trapped": "Retail longs at entry cluster" if entry_avg else "Unknown"
        }

        return zones

    def detect_sweeps(self, market_structure: Dict, retail_positions: Dict) -> Dict:
        """
        Detect liquidity sweeps
        - Completed: Already swept (HOD/LOD touched)
        - Pending: Will likely sweep (approaching level)
        - Setup: Sweep to trigger trade
        """
        sweeps = {
            "completed": [],
            "pending": [],
            "setup_sweep": None,
            "sweep_count": 0
        }

        if not self.current_price:
            return sweeps

        # HOD sweep detection
        if self.current_price >= self.hod:
            sweeps["completed"].append({
                "level": self.hod,
                "type": "HOD",
                "distance": 0,
                "status": "COMPLETED"
            })
        elif self.hod - self.current_price < 10:  # Within 10 points
            sweeps["pending"].append({
                "level": self.hod,
                "type": "HOD",
                "distance": round(self.hod - self.current_price, 1),
                "status": "PENDING"
            })

        # Retail SL sweep detection (potential trigger)
        sl_level = retail_positions.get("stop_loss_cluster", {}).get("level", 4661)
        if self.current_price <= sl_level:
            sweeps["completed"].append({
                "level": sl_level,
                "type": "Retail_SL",
                "distance": 0,
                "status": "COMPLETED"
            })
            sweeps["setup_sweep"] = "SL_SWEPT"
        elif sl_level - self.current_price < 10:
            sweeps["pending"].append({
                "level": sl_level,
                "type": "Retail_SL",
                "distance": round(sl_level - self.current_price, 1),
                "status": "PENDING"
            })

        sweeps["sweep_count"] = len(sweeps["completed"]) + len(sweeps["pending"])

        return sweeps

    def identify_order_blocks(self, market_structure: Dict, retail_positions: Dict) -> Dict:
        """
        Identify demand and supply order blocks
        """
        blocks = {
            "demand_blocks": [],
            "supply_blocks": [],
            "active_block": None
        }

        trend = market_structure.get("trend", "UNKNOWN")

        # Demand Order Block (where institutions bought)
        entry_zone = retail_positions.get("entry_cluster", {})
        if entry_zone:
            entry_avg = sum(entry_zone.get("zone", [4670, 4675])) / len(entry_zone.get("zone", [4670, 4675]))
            demand_ob = OrderBlock(
                level=entry_avg,
                type="DEMAND",
                timeframe="INTRADAY",
                confirmed=entry_zone.get("consensus", 0) > 0.6,
                break_point=None
            )
            blocks["demand_blocks"].append(asdict(demand_ob))

            # If price is still within demand block, it's active
            if abs(self.current_price - entry_avg) < 10:
                blocks["active_block"] = {
                    "level": entry_avg,
                    "type": "DEMAND",
                    "reason": "Price within buy cluster"
                }

        # Supply Order Block (resistance)
        tp_cluster = retail_positions.get("take_profit_cluster", {})
        if tp_cluster:
            tp_primary = tp_cluster.get("primary_tp", 4720)
            supply_ob = OrderBlock(
                level=tp_primary,
                type="SUPPLY",
                timeframe="INTRADAY",
                confirmed=tp_cluster.get("signal_count", 0) > 5,
                break_point=None
            )
            blocks["supply_blocks"].append(asdict(supply_ob))

            # If price approaching supply OB, it's active
            if 0 < tp_primary - self.current_price < 20:
                blocks["active_block"] = {
                    "level": tp_primary,
                    "type": "SUPPLY",
                    "reason": "Price approaching resistance OB"
                }

        return blocks

    def detect_fvgs(self, market_structure: Dict) -> Dict:
        """
        Detect Fair Value Gaps (imbalances in price structure)
        """
        gaps = {
            "untouched_gaps": [],
            "filled_gaps": [],
            "active_gap": None
        }

        if not self.historical_prices or len(self.historical_prices) < 3:
            return gaps

        # Detect gaps between recent price movements
        recent = self.historical_prices[-3:] if len(self.historical_prices) >= 3 else self.historical_prices

        if len(recent) >= 3:
            # Check for 3-bar FVG pattern (bull FVG: low of bar 3 > high of bar 1)
            bar1_high = max(recent[0], recent[1]) if isinstance(recent[0], (int, float)) else 4700
            bar3_low = min(recent[2], recent[1]) if isinstance(recent[2], (int, float)) else 4680

            if bar3_low > bar1_high:
                gap = FairValueGap(
                    high=bar3_low,
                    low=bar1_high,
                    location="ABOVE" if self.current_price < bar1_high else "CURRENT_PRICE",
                    untouched=self.current_price < bar1_high,
                    confirmation=0.7
                )
                gaps["untouched_gaps"].append(asdict(gap))

                if self.current_price < bar1_high:
                    gaps["active_gap"] = {
                        "high": bar3_low,
                        "low": bar1_high,
                        "status": "UNTOUCHED",
                        "distance_below": round(bar1_high - self.current_price, 1)
                    }

        return gaps

    def combine_smc_confluence(
        self,
        market_structure: Dict,
        liquidity_zones: Dict,
        sweeps: Dict,
        order_blocks: Dict,
        fvgs: Dict
    ) -> float:
        """
        Combine all SMC components into a single confluence score (0-100)
        """
        score = 0
        max_score = 100

        # Market structure (max 25 points)
        structure_validity = market_structure.get("structure_validity", 0)
        score += structure_validity * 25
        if market_structure.get("bos_status") == "BOS_CONFIRMED":
            score += 5
        if market_structure.get("choch_status") == "CHOCH_PENDING":
            score += 3

        # Liquidity zones (max 25 points)
        strong_zones = liquidity_zones.get("strong_zones", [])
        score += min(len(strong_zones) * 5, 25)

        # Sweeps (max 20 points)
        sweeps_count = sweeps.get("sweep_count", 0)
        score += min(sweeps_count * 3, 15)
        if sweeps.get("setup_sweep"):
            score += 5

        # Order blocks (max 15 points)
        if order_blocks.get("active_block"):
            score += 15

        # FVGs (max 15 points)
        if fvgs.get("active_gap"):
            score += 10
        if fvgs.get("untouched_gaps"):
            score += 5

        return min(score, 100)

    def _determine_verdict(
        self,
        confluence_score: float,
        market_structure: Dict,
        sweeps: Dict
    ) -> str:
        """
        Determine trading verdict based on confluence
        """
        if confluence_score >= 80:
            return "STRONG_CONFLUENCE - SETUP READY"
        elif confluence_score >= 60:
            return "MODERATE_CONFLUENCE - MONITOR"
        elif confluence_score >= 40:
            return "WEAK_CONFLUENCE - WAIT"
        else:
            return "NO_CONFLUENCE - DO_NOT_TRADE"

    def to_json(self, analysis: SMCAnalysis) -> str:
        """Export analysis as JSON"""
        return json.dumps(asdict(analysis), indent=2, default=str)
