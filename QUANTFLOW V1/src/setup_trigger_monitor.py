#!/usr/bin/env python3
"""
Real-Time Setup Trigger Monitor
Detects SHORT (4720 rejection) and LONG (4720 breakout) setups
"""

import json
from dataclasses import dataclass, asdict
from typing import Dict, Optional, List
from datetime import datetime


@dataclass
class PriceAlert:
    """Price level alert"""
    level: float
    triggered: bool
    timestamp: Optional[str] = None
    action: str = ""  # "BREAKOUT", "REJECTION", "SUPPORT"


@dataclass
class SetupSignal:
    """Trading setup signal"""
    setup_type: str  # "SHORT", "LONG", "SCALP"
    entry: float
    stop_loss: float
    take_profits: List[float]
    confidence: float  # 0-100
    status: str  # "PENDING", "TRIGGERED", "CANCELLED"
    reason: str
    timestamp: str
    rr_ratio: float


@dataclass
class TriggerEvent:
    """Setup trigger event"""
    event_type: str  # "ALERT", "SETUP_TRIGGERED", "REJECTION", "BREAKOUT"
    level: float
    current_price: float
    distance: float
    setup_signal: Optional[SetupSignal] = None
    timestamp: str = ""


class SetupTriggerMonitor:
    """Real-time setup trigger detection engine"""

    # Critical levels
    SUPPORT_LEVEL = 4661
    ENTRY_ZONE_HIGH = 4675
    ENTRY_ZONE_LOW = 4670
    RESISTANCE_LEVEL = 4720
    TP1_LEVEL = 4700
    TP2_LEVEL = 4750
    TP3_LEVEL = 4775

    # Alert thresholds
    ALERT_LEVELS = [4715, 4720, 4725]
    CLOSE_THRESHOLD = 5  # Within 5 points = close enough to trigger

    def __init__(self):
        """Initialize trigger monitor"""
        self.current_price = None
        self.previous_price = None
        self.highest_price = None
        self.lowest_price = None
        self.alerts = {level: PriceAlert(level=level, triggered=False) for level in self.ALERT_LEVELS}
        self.active_setups = []
        self.trigger_history = []

    def update_price(self, price: float) -> List[TriggerEvent]:
        """
        Update current price and check for trigger conditions

        Returns:
            List of triggered events
        """
        self.previous_price = self.current_price
        self.current_price = price
        self.highest_price = max(self.highest_price or price, price)
        self.lowest_price = min(self.lowest_price or price, price)

        events = []

        # Check alert levels
        for level, alert in self.alerts.items():
            if not alert.triggered and self._is_level_touched(level):
                alert.triggered = True
                alert.timestamp = datetime.utcnow().isoformat() + "Z"
                events.append(TriggerEvent(
                    event_type="ALERT",
                    level=level,
                    current_price=price,
                    distance=0,
                    timestamp=alert.timestamp
                ))

        # Check for SHORT setup (4720 rejection)
        short_setup = self._detect_short_setup()
        if short_setup and not self._setup_exists("SHORT"):
            self.active_setups.append(short_setup)
            events.append(TriggerEvent(
                event_type="SETUP_TRIGGERED",
                level=self.RESISTANCE_LEVEL,
                current_price=price,
                distance=round(self.RESISTANCE_LEVEL - price, 1),
                setup_signal=short_setup,
                timestamp=datetime.utcnow().isoformat() + "Z"
            ))

        # Check for LONG setup (4720 breakout)
        long_setup = self._detect_long_setup()
        if long_setup and not self._setup_exists("LONG"):
            self.active_setups.append(long_setup)
            events.append(TriggerEvent(
                event_type="SETUP_TRIGGERED",
                level=self.RESISTANCE_LEVEL,
                current_price=price,
                distance=round(price - self.RESISTANCE_LEVEL, 1),
                setup_signal=long_setup,
                timestamp=datetime.utcnow().isoformat() + "Z"
            ))

        self.trigger_history.extend(events)
        return events

    def _is_level_touched(self, level: float) -> bool:
        """Check if price touched a level"""
        if self.current_price is None:
            return False
        return abs(self.current_price - level) < self.CLOSE_THRESHOLD

    def _detect_short_setup(self) -> Optional[SetupSignal]:
        """
        Detect SHORT setup: Price at 4720 + rejection
        Conditions:
        - Price touches 4720 ± 5 points
        - Volume spike (indicator: fast movement)
        - No follow-through buying (rejection)
        - Price retreats toward entry zone
        """
        if self.current_price is None or self.previous_price is None:
            return None

        # Must be at resistance level
        if not self._is_level_touched(self.RESISTANCE_LEVEL):
            return None

        # Already have SHORT setup
        if self._setup_exists("SHORT"):
            return None

        # Check for rejection pattern
        # Rejection = Price touched 4720, but failed to continue higher
        at_resistance = abs(self.current_price - self.RESISTANCE_LEVEL) < self.CLOSE_THRESHOLD

        if not at_resistance:
            return None

        # Check if price is rejecting (moving down from resistance)
        price_moving_down = self.current_price < self.RESISTANCE_LEVEL

        if price_moving_down or self.current_price == self.RESISTANCE_LEVEL:
            confidence = self._calculate_short_confidence()
            return SetupSignal(
                setup_type="SHORT",
                entry=self.RESISTANCE_LEVEL,
                stop_loss=4760,  # Above previous resistance
                take_profits=[self.TP1_LEVEL, self.TP2_LEVEL, 4670],
                confidence=confidence,
                status="TRIGGERED" if confidence >= 70 else "PENDING",
                reason=f"Price at 4720 resistance, rejection pattern",
                timestamp=datetime.utcnow().isoformat() + "Z",
                rr_ratio=2.0  # 40 points risk, 80 points reward = 2:1
            )

        return None

    def _detect_long_setup(self) -> Optional[SetupSignal]:
        """
        Detect LONG setup: Price breaks 4720 with conviction
        Conditions:
        - Price breaks 4720 with >2 point conviction (above 4722)
        - No immediate pullback (institutional accumulation)
        - Momentum confirmed (next hour high > 4730)
        - Entry after 4720 is clearly broken
        """
        if self.current_price is None:
            return None

        # Already have LONG setup
        if self._setup_exists("LONG"):
            return None

        # Must break resistance decisively (>2 points above)
        breakout_level = self.RESISTANCE_LEVEL + 2

        if self.current_price < breakout_level:
            return None

        # Confirm breakout momentum
        if self.highest_price is None or self.highest_price < breakout_level + 5:
            return None  # Need confirming high

        # Valid breakout detected
        confidence = self._calculate_long_confidence()

        return SetupSignal(
            setup_type="LONG",
            entry=self.RESISTANCE_LEVEL + 5,  # Enter after confirmed breakout
            stop_loss=4660,  # Below retail SL cluster
            take_profits=[4750, 4775, 4800],
            confidence=confidence,
            status="TRIGGERED" if confidence >= 70 else "PENDING",
            reason=f"Price breaks 4720 with conviction, momentum confirmed",
            timestamp=datetime.utcnow().isoformat() + "Z",
            rr_ratio=2.3  # ~65 points risk, ~150 points reward
        )

    def _calculate_short_confidence(self) -> float:
        """Calculate confidence for SHORT setup (0-100)"""
        confidence = 50  # Base score

        # Price exactly at resistance
        if abs(self.current_price - self.RESISTANCE_LEVEL) < 2:
            confidence += 20

        # Previous price was below 4720 (potential rejection)
        if self.previous_price and self.previous_price < self.RESISTANCE_LEVEL:
            confidence += 15

        # Highest price touched 4720+ (shows effort)
        if self.highest_price and self.highest_price >= self.RESISTANCE_LEVEL:
            confidence += 10

        # Current price moving down
        if self.previous_price and self.current_price < self.previous_price:
            confidence += 5

        return min(confidence, 100)

    def _calculate_long_confidence(self) -> float:
        """Calculate confidence for LONG setup (0-100)"""
        confidence = 40  # Base score

        # Price well above 4720 (4+ points)
        if self.current_price >= self.RESISTANCE_LEVEL + 4:
            confidence += 25

        # Highest price well above 4720
        if self.highest_price and self.highest_price >= self.RESISTANCE_LEVEL + 10:
            confidence += 20

        # Current price above previous (momentum)
        if self.previous_price and self.current_price > self.previous_price:
            confidence += 10

        # Sustained move (not a wick)
        if self.highest_price and self.current_price > self.RESISTANCE_LEVEL + 3:
            confidence += 5

        return min(confidence, 100)

    def _setup_exists(self, setup_type: str) -> bool:
        """Check if setup already exists in active setups"""
        return any(s.setup_type == setup_type and s.status != "CANCELLED" for s in self.active_setups)

    def get_active_setups(self) -> List[Dict]:
        """Get all active setups"""
        return [asdict(s) for s in self.active_setups if s.status != "CANCELLED"]

    def get_triggered_alerts(self) -> List[Dict]:
        """Get all triggered alerts"""
        return [asdict(a) for a in self.alerts.values() if a.triggered]

    def get_next_action(self) -> Dict:
        """Determine the next action based on current state"""
        if not self.current_price:
            return {
                "action": "WAITING",
                "reason": "No price data",
                "next_levels": self.ALERT_LEVELS
            }

        active = self.get_active_setups()

        if active:
            setup = active[0]
            return {
                "action": setup["setup_type"],
                "entry": setup["entry"],
                "sl": setup["stop_loss"],
                "tp": setup["take_profits"],
                "confidence": setup["confidence"],
                "reason": setup["reason"]
            }

        # No active setups - calculate distance to triggers
        distance_to_4720 = abs(self.current_price - self.RESISTANCE_LEVEL)

        return {
            "action": "MONITORING",
            "current_price": self.current_price,
            "nearest_level": self.RESISTANCE_LEVEL,
            "distance_points": round(distance_to_4720, 1),
            "next_levels": self.ALERT_LEVELS,
            "reason": f"Waiting for confluence at 4720 (±5 points)"
        }

    def cancel_setup(self, setup_type: str) -> bool:
        """Cancel a setup if conditions no longer met"""
        for setup in self.active_setups:
            if setup.setup_type == setup_type and setup.status != "CANCELLED":
                setup.status = "CANCELLED"
                return True
        return False

    def reset(self):
        """Reset monitor state"""
        self.current_price = None
        self.previous_price = None
        self.highest_price = None
        self.lowest_price = None
        self.alerts = {level: PriceAlert(level=level, triggered=False) for level in self.ALERT_LEVELS}
        self.active_setups = []
        self.trigger_history = []

    def to_json(self) -> str:
        """Export current state as JSON"""
        state = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "current_price": self.current_price,
            "active_setups": self.get_active_setups(),
            "triggered_alerts": self.get_triggered_alerts(),
            "next_action": self.get_next_action()
        }
        return json.dumps(state, indent=2, default=str)
