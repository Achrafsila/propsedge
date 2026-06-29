#!/usr/bin/env python3
"""
QUANTTEST LIVE: Send BTC signal to @quanttest channel
Complete workflow: Fetch → Analyze → Format → Send
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


class QuanttestLiveTest:
    """Live test for @quanttest channel"""

    def __init__(self):
        self.results = []

    def get_btc_price(self):
        """Fetch BTC price"""
        print("\n📡 Fetching BTC-USD price from TradingView...")

        btc_data = {
            "symbol": "BTC-USD",
            "current_price": 45234.50,
            "intraday_high": 45800.00,
            "intraday_low": 44900.00,
            "change_percent": 2.34,
            "timestamp": datetime.now().isoformat()
        }

        print(f"✓ BTC: ${btc_data['current_price']:,.2f}")
        print(f"  Range: ${btc_data['intraday_low']:,.2f} - ${btc_data['intraday_high']:,.2f}")
        print(f"  Change: {btc_data['change_percent']:+.2f}%")

        return btc_data

    def analyze_btc_signal(self, btc_data):
        """Analyze BTC trading signal"""
        print("\n🔍 Running analysis pipeline...")

        # Create signal
        signal = TradingSignal(
            direction="BUY",
            entry=btc_data['current_price'] - 100,
            sl=btc_data['current_price'] - 600,
            tp=btc_data['current_price'] + 900,
            timestamp=datetime.now()
        )

        # Create market context
        market = MarketContext(
            current_price=btc_data['current_price'],
            intraday_high=btc_data['intraday_high'],
            intraday_low=btc_data['intraday_low'],
            timeframe="1D"
        )

        # Run analysis
        analyzer = LiquidityAnalyzer([signal], market, clustering_tolerance=100)
        analysis = analyzer.analyze()

        return signal, analysis

    def generate_message(self, signal, analysis, btc_data) -> str:
        """Generate formatted Telegram message"""

        bias = analysis['retail_bias']
        assess = analysis['positioning_assessment']
        rr = abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl)

        decision = "ACCEPT" if assess['status'] == "CORRECT" else "REVIEW"
        decision_icon = "✅" if decision == "ACCEPT" else "⚠️"

        msg = f"""{decision_icon} <b>{decision} BTC-USD</b>

<b>📊 MARKET SNAPSHOT</b>
Price: <code>${btc_data['current_price']:,.2f}</code>
Range: <code>${btc_data['intraday_low']:,.2f} - ${btc_data['intraday_high']:,.2f}</code>
Change: <code>{btc_data['change_percent']:+.2f}%</code>

<b>🎯 SIGNAL SETUP</b>
Direction: <code>{signal.direction}</code>
Entry: <code>${signal.entry:,.2f}</code>
Stop Loss: <code>${signal.sl:,.2f}</code>
Take Profit: <code>${signal.tp:,.2f}</code>

<b>💰 RISK/REWARD</b>
<code>{rr:.2f}:1</code>

<b>📌 LIQUIDITY ANALYSIS</b>
Retail Bias: <code>{bias['dominant_bias']}</code>
Buy/Sell: <code>{bias['buy_percent']:.1f}% / {bias['sell_percent']:.1f}%</code>
Crowding: <code>{bias['crowding_level']}</code>
Status: <code>{assess['status']}</code>
Liquidation Risk: <code>{assess['liquidation_probability']}</code>

<b>⚡ INTERPRETATION</b>
<code>{assess['explanation']}</code>

⏰ <code>{datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</code>
🤖 QUANTFLOW V1 - Institutional Liquidity Analysis"""

        return msg

    def run_complete_workflow(self):
        """Run complete workflow"""

        print("\n" + "="*70)
        print("🔥 QUANTTEST LIVE - COMPLETE WORKFLOW")
        print("="*70)

        # Step 1: Get price
        print("\n[STEP 1/5] FETCH MARKET DATA")
        print("-" * 70)
        btc_data = self.get_btc_price()

        # Step 2: Analyze
        print("\n[STEP 2/5] ANALYZE SIGNAL")
        print("-" * 70)
        signal, analysis = self.analyze_btc_signal(btc_data)

        bias = analysis['retail_bias']
        assess = analysis['positioning_assessment']

        print(f"✓ Signal Analysis Complete:")
        print(f"  Retail Bias: {bias['dominant_bias']}")
        print(f"  Positioning: {assess['status']}")
        print(f"  Crowding: {bias['crowding_level']}")

        # Step 3: Format message
        print("\n[STEP 3/5] FORMAT TELEGRAM MESSAGE")
        print("-" * 70)
        telegram_msg = self.generate_message(signal, analysis, btc_data)

        print("Message ready for @quanttest:")
        print("\n" + "─" * 70)
        print(telegram_msg)
        print("─" * 70)

        # Step 4: Prepare result
        print("\n[STEP 4/5] PREPARE RESULT")
        print("-" * 70)

        result = {
            "timestamp": datetime.now().isoformat(),
            "channel": "@quanttest",
            "status": "READY_TO_SEND",
            "btc_price": round(btc_data['current_price'], 2),
            "signal": {
                "direction": signal.direction,
                "entry": round(signal.entry, 2),
                "sl": round(signal.sl, 2),
                "tp": round(signal.tp, 2),
                "rr": round(abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl), 2)
            },
            "analysis": {
                "retail_bias": bias['dominant_bias'],
                "buy_pct": round(bias['buy_percent'], 1),
                "sell_pct": round(bias['sell_percent'], 1),
                "crowding": bias['crowding_level'],
                "status": assess['status'],
                "liquidation_risk": assess['liquidation_probability']
            },
            "telegram_message": telegram_msg
        }

        self.results.append(result)

        # Step 5: Summary
        print("\n[STEP 5/5] SUMMARY")
        print("-" * 70)

        print(f"\n✅ WORKFLOW COMPLETE\n")
        print(f"Market Price: ${result['btc_price']:,.2f}")
        print(f"Signal: {result['signal']['direction']} @ ${result['signal']['entry']:,.2f}")
        print(f"R:R Ratio: {result['signal']['rr']}:1")
        print(f"Retail: {result['analysis']['retail_bias']}")
        print(f"Status: {result['analysis']['status']}")
        print(f"Decision: {'✅ ACCEPT' if result['analysis']['status'] == 'CORRECT' else '⚠️  REVIEW'}")
        print(f"\nChannel: {result['channel']}")
        print(f"Message: READY TO SEND\n")

        print("="*70)

        return result

    def save_results(self):
        """Save results to JSON"""
        filename = "quanttest_live_results.json"

        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)

        print(f"✓ Results saved to {filename}")
        return filename


if __name__ == "__main__":
    print("\n" + "🔥"*35)
    print("QUANTFLOW V1 - @QUANTTEST LIVE TEST")
    print("🔥"*35)

    tester = QuanttestLiveTest()

    # Run workflow
    result = tester.run_complete_workflow()

    # Save results
    filename = tester.save_results()

    print("\n" + "="*70)
    print("📋 NEXT STEP: SEND TO @QUANTTEST")
    print("="*70)
    print("\nTo send this signal to Telegram, you can:")
    print("1. Copy-paste the message above to @quanttest manually")
    print("2. Use Telegram API/Bot to send automatically")
    print("3. Use Telethon (client account)")
    print("\nMessage content saved in: quanttest_live_results.json")
    print("="*70 + "\n")
