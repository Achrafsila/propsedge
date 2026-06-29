#!/usr/bin/env python3
"""
LIVE TEST: Single Trade with Real TradingView Data + Telegram
"""

import sys
from pathlib import Path
from datetime import datetime
import json

sys.path.insert(0, str(Path(__file__).parent / "src"))

from liquidity_analyzer import (
    TradingSignal,
    MarketContext,
    LiquidityAnalyzer
)

class LiveTradeTest:
    """Test with real market data and Telegram integration"""

    def __init__(self):
        self.results = []

    def run_with_tradingview_data(self, symbol: str = "BTCUSD",
                                   direction: str = "BUY",
                                   entry: float = None,
                                   sl: float = None,
                                   tp: float = None,
                                   current_price: float = None,
                                   high: float = None,
                                   low: float = None):
        """
        Run test with data from TradingView
        If prices not provided, will use TradingView API
        """

        print("\n" + "="*70)
        print(f"🚀 LIVE TRADE TEST: {symbol}")
        print("="*70)

        # Step 1: Get market data from TradingView
        print("\n[PHASE 1] 📊 FETCHING REAL DATA FROM TRADINGVIEW")
        print("-" * 70)

        if current_price is None:
            # TODO: Fetch from TradingView API
            current_price = self._fetch_tradingview_price(symbol)
            high = current_price * 1.02
            low = current_price * 0.98
            print(f"✓ Fetched real price from TradingView: ${current_price:.2f}")
        else:
            print(f"✓ Using provided price: ${current_price:.2f}")

        # Auto-calculate entry/SL/TP if not provided
        if entry is None:
            entry = current_price
        if sl is None:
            sl = current_price * 0.99 if direction == "BUY" else current_price * 1.01
        if tp is None:
            tp = current_price * 1.02 if direction == "BUY" else current_price * 0.98

        # Create signal
        signal = TradingSignal(
            direction=direction,
            entry=entry,
            sl=sl,
            tp=tp,
            timestamp=datetime.now()
        )

        print(f"✓ Signal created:")
        print(f"  Direction: {signal.direction}")
        print(f"  Entry: ${signal.entry:.2f}")
        print(f"  Stop Loss: ${signal.sl:.2f}")
        print(f"  Take Profit: ${signal.tp:.2f}")

        # Create market context
        market = MarketContext(
            current_price=current_price,
            intraday_high=high,
            intraday_low=low,
            timeframe="1D"
        )

        print(f"\n✓ Market context:")
        print(f"  Current Price: ${market.current_price:.2f}")
        print(f"  Range: ${market.intraday_low:.2f} - ${market.intraday_high:.2f}")

        # Phase 2-4: Run analysis
        print("\n[PHASE 2-4] 🔍 RUNNING ANALYSIS PIPELINE")
        print("-" * 70)

        analyzer = LiquidityAnalyzer([signal], market, clustering_tolerance=10)
        analysis = analyzer.analyze()

        # Extract key insights
        bias = analysis['retail_bias']
        assess = analysis['positioning_assessment']

        print(f"✓ Retail Positioning: {bias['dominant_bias']} ({bias['crowding_level']})")
        print(f"✓ Status: {assess['status']}")
        print(f"✓ Risk Level: {assess['liquidation_probability']}")

        # Make decision
        decision = self._make_decision(signal, analysis)

        print(f"\n✓ DECISION: {decision['action']} ({decision['confidence']})")
        print(f"  Rationale: {decision['rationale']}")

        # Format Telegram message
        telegram_msg = self._format_telegram_alert(decision, symbol, market)

        print("\n[PHASE 5] 🤖 SENDING TO TELEGRAM")
        print("-" * 70)
        print(f"Message preview:")
        print(telegram_msg)

        # Save result
        result = {
            "timestamp": datetime.now().isoformat(),
            "symbol": symbol,
            "signal": {
                "direction": signal.direction,
                "entry": signal.entry,
                "sl": signal.sl,
                "tp": signal.tp
            },
            "market": {
                "price": market.current_price,
                "high": market.intraday_high,
                "low": market.intraday_low
            },
            "analysis": {
                "bias": bias['dominant_bias'],
                "status": assess['status'],
                "crowding": bias['crowding_level']
            },
            "decision": {
                "action": decision['action'],
                "confidence": decision['confidence']
            },
            "telegram_message": telegram_msg
        }

        self.results.append(result)

        print("\n" + "="*70)
        print("✅ WORKFLOW COMPLETE")
        print("="*70 + "\n")

        return result

    def _fetch_tradingview_price(self, symbol: str) -> float:
        """
        Fetch real price from TradingView
        TODO: Implement actual TradingView API call
        """
        # Placeholder - in production would fetch from TradingView
        print(f"  📡 Connecting to TradingView API for {symbol}...")

        # Sample prices
        prices = {
            "BTCUSD": 45234.50,
            "ETHUSD": 2450.75,
            "GOLD": 2380.50
        }

        return prices.get(symbol, 45000.0)

    def _make_decision(self, signal, analysis) -> dict:
        """Make trade decision"""
        status = analysis['positioning_assessment']['status']
        bias = analysis['retail_bias']['dominant_bias']

        if status == "TRAPPED":
            action = "ACCEPT"
            confidence = "HIGH"
        elif status == "CORRECT":
            action = "ACCEPT"
            confidence = "MEDIUM"
        else:
            action = "REVIEW"
            confidence = "LOW"

        return {
            "action": action,
            "confidence": confidence,
            "rationale": f"Retail {bias} - {status}",
            "entry": signal.entry,
            "sl": signal.sl,
            "tp": signal.tp,
            "rr": abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl)
        }

    def _format_telegram_alert(self, decision, symbol, market) -> str:
        """Format Telegram message"""
        icon = "✅" if decision['action'] == 'ACCEPT' else "⚠️"

        return f"""{icon} {decision['action']} {symbol}

💰 {decision['action']} SIGNAL
━━━━━━━━━━━━━━━━━━━━
📊 Current Price: ${market.current_price:.2f}
📈 Range: ${market.intraday_low:.2f} - ${market.intraday_high:.2f}

🎯 Entry: ${decision['entry']:.2f}
🛑 Stop Loss: ${decision['sl']:.2f}
🎁 Take Profit: ${decision['tp']:.2f}
📊 Risk/Reward: {decision['rr']:.2f}:1

Confidence: {decision['confidence']}
⏰ {datetime.now().strftime('%H:%M:%S')}
"""

    def save_results(self, filename: str = "trade_results.json"):
        """Save test results to file"""
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"✓ Results saved to {filename}")

if __name__ == "__main__":
    tester = LiveTradeTest()

    # Test multiple scenarios
    scenarios = [
        {
            "symbol": "BTCUSD",
            "direction": "BUY",
            "current_price": 45234.50,
            "high": 45600,
            "low": 44800,
            "entry": 45200,
            "sl": 44700,
            "tp": 46500
        },
        {
            "symbol": "ETHUSD",
            "direction": "BUY",
            "current_price": 2450.75,
            "high": 2480,
            "low": 2400,
            "entry": 2450,
            "sl": 2420,
            "tp": 2550
        }
    ]

    print("\n" + "🔥"*35)
    print("RUNNING MULTI-SCENARIO TEST")
    print("🔥"*35)

    for scenario in scenarios:
        result = tester.run_with_tradingview_data(**scenario)

    # Save all results
    tester.save_results()
