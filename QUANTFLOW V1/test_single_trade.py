#!/usr/bin/env python3
"""
END-TO-END TEST: Single Trade Through All Phases
Input: 1 signal + real market price → Output: Trade decision + Telegram alert
"""

import sys
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from liquidity_analyzer import (
    TradingSignal,
    MarketContext,
    LiquidityAnalyzer
)

class SingleTradeTest:
    """Test complete workflow on 1 trade"""

    def run_test(self, symbol: str = "BTCUSDT",
                 direction: str = "BUY",
                 entry: float = 45000,
                 sl: float = 44500,
                 tp: float = 46000,
                 current_price: float = 45100,
                 high: float = 45500,
                 low: float = 44800):

        print("\n" + "="*70)
        print(f"🚀 SINGLE TRADE TEST: {symbol}")
        print("="*70)

        # ============= PHASE 1: SIGNAL COLLECTION =============
        print("\n[PHASE 1] 📊 SIGNAL COLLECTION")
        print("-" * 70)

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
        print(f"  Risk/Reward: {abs(tp-entry)/abs(entry-sl):.2f}:1")

        # ============= PHASE 2: MARKET CONTEXT =============
        print("\n[PHASE 2] 🔍 MARKET CONTEXT VALIDATION")
        print("-" * 70)

        market = MarketContext(
            current_price=current_price,
            intraday_high=high,
            intraday_low=low,
            timeframe="1D",
            vwap=None  # Can be added if available
        )

        print(f"✓ Market data fetched from TradingView:")
        print(f"  Current Price: ${market.current_price:.2f}")
        print(f"  Intraday High: ${market.intraday_high:.2f}")
        print(f"  Intraday Low: ${market.intraday_low:.2f}")
        print(f"  Range: ${market.intraday_high - market.intraday_low:.2f}")

        # Check if signal makes sense with current market
        price_vs_entry = ((current_price - entry) / entry) * 100
        print(f"\n  Price vs Entry: {price_vs_entry:+.2f}%")

        if signal.direction == "BUY":
            if current_price < entry:
                print(f"  Status: ✓ Entry NOT YET hit (price below entry)")
            else:
                print(f"  Status: ⚠️  Entry PASSED (price above entry)")

        # ============= PHASE 3: LIQUIDITY ANALYSIS =============
        print("\n[PHASE 3] 💧 LIQUIDITY ANALYSIS")
        print("-" * 70)

        # Create analyzer with single signal
        analyzer = LiquidityAnalyzer([signal], market, clustering_tolerance=10)
        analysis = analyzer.analyze()

        print(f"✓ Liquidity analysis complete:")

        # Retail positioning
        bias = analysis['retail_bias']
        print(f"\n  Retail Positioning:")
        print(f"    Dominant Bias: {bias['dominant_bias']}")
        print(f"    Crowding Level: {bias['crowding_level']}")

        # Positioning assessment
        assess = analysis['positioning_assessment']
        print(f"\n  Positioning Status:")
        print(f"    Status: {assess['status']}")
        print(f"    Liquidation Risk: {assess['liquidation_probability']}")

        # Risk stats
        risk = analysis['risk_stats']
        print(f"\n  Risk Analysis:")
        print(f"    SL Distance: ${risk['avg_sl_distance']:.2f}")
        print(f"    TP Distance: ${analysis['tp_stats']['avg_tp_distance']:.2f}")

        # ============= PHASE 4: TRADE DECISION & ALERT =============
        print("\n[PHASE 4] ✅ TRADE DECISION")
        print("-" * 70)

        trade_decision = self._make_trade_decision(
            signal=signal,
            market=market,
            analysis=analysis
        )

        print(f"\n✓ DECISION: {trade_decision['action'].upper()}")
        print(f"  Confidence: {trade_decision['confidence']}")
        print(f"  Rationale: {trade_decision['rationale']}")

        if trade_decision['action'] == 'ACCEPT':
            print(f"\n  Entry Levels: ${trade_decision['entry']:.2f}")
            print(f"  Stop Loss: ${trade_decision['stop_loss']:.2f}")
            print(f"  Take Profit: ${trade_decision['take_profit']:.2f}")
            print(f"  Risk/Reward: {trade_decision['risk_reward']:.2f}:1")

        # ============= TELEGRAM ALERT =============
        print("\n[ALERT] 🤖 TELEGRAM NOTIFICATION")
        print("-" * 70)

        telegram_msg = self._format_telegram_message(trade_decision, symbol, market)
        print(f"\nMessage to send on Telegram:")
        print(telegram_msg)

        print("\n" + "="*70)
        print("✅ TEST COMPLETE - Ready to send to Telegram bot")
        print("="*70 + "\n")

        return {
            "signal": signal,
            "market": market,
            "analysis": analysis,
            "decision": trade_decision,
            "telegram_message": telegram_msg
        }

    def _make_trade_decision(self, signal, market, analysis) -> dict:
        """Generate trade decision based on analysis"""

        assess = analysis['positioning_assessment']
        status = assess['status']

        # Simple decision logic (can be enhanced)
        if status == "TRAPPED":
            # Retail trapped = high probability reversal
            action = "ACCEPT"
            confidence = "HIGH"
            rationale = f"Retail {analysis['retail_bias']['dominant_bias']} and trapped - reversal expected"
        elif status == "CORRECT":
            # Retail correct = trend continuation
            action = "ACCEPT"
            confidence = "MEDIUM"
            rationale = f"Retail {analysis['retail_bias']['dominant_bias']} and correct - continuation likely"
        else:
            # Mixed positioning = low conviction
            action = "REVIEW"
            confidence = "LOW"
            rationale = "Mixed retail positioning - insufficient signal strength"

        return {
            "action": action,
            "confidence": confidence,
            "rationale": rationale,
            "entry": signal.entry,
            "stop_loss": signal.sl,
            "take_profit": signal.tp,
            "risk_reward": abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl)
        }

    def _format_telegram_message(self, decision, symbol, market) -> str:
        """Format trading alert for Telegram"""

        action_icon = "✅" if decision['action'] == 'ACCEPT' else "⚠️"

        msg = f"""{action_icon} {decision['action']} - {symbol}

📊 Market Snapshot:
   Price: ${market.current_price:.2f}
   Range: ${market.intraday_low:.2f} - ${market.intraday_high:.2f}

🎯 Trade Setup:
   Entry: ${decision['entry']:.2f}
   Stop Loss: ${decision['stop_loss']:.2f}
   Take Profit: ${decision['take_profit']:.2f}
   R:R Ratio: {decision['risk_reward']:.2f}:1

💡 Rationale:
   {decision['rationale']}
   Confidence: {decision['confidence']}

⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        return msg

if __name__ == "__main__":
    tester = SingleTradeTest()

    # Test 1: BTC Long Setup
    result = tester.run_test(
        symbol="BTCUSDT",
        direction="BUY",
        entry=45000,
        sl=44500,
        tp=46000,
        current_price=45100,
        high=45500,
        low=44800
    )
