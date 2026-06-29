#!/usr/bin/env python3
"""
LIVE TELEGRAM SEND: Send trading signal to Telegram channel
Using Telethon (client account, not bot)
"""

import sys
from pathlib import Path
from datetime import datetime
import json
import asyncio

sys.path.insert(0, str(Path(__file__).parent / "src"))

from liquidity_analyzer import (
    TradingSignal,
    MarketContext,
    LiquidityAnalyzer
)

from config import API_ID, API_HASH, PHONE, SESSIONS_DIR


class TelegramSignalSender:
    """Send trading signals to Telegram channel"""

    def __init__(self, api_id: str, api_hash: str, phone: str):
        """
        Initialize with Telegram client credentials

        Args:
            api_id: Telegram API ID
            api_hash: Telegram API hash
            phone: Phone number with country code
        """
        self.api_id = int(api_id)
        self.api_hash = api_hash
        self.phone = phone
        self.session_file = str(SESSIONS_DIR / "telegram_session")
        self.client = None
        self.results = []

    async def connect(self):
        """Connect to Telegram"""
        try:
            from telethon import TelegramClient
            from telethon.sessions import StringSession
            import os

            print("📱 Connecting to Telegram...")

            # Try to use existing session, or create new one
            try:
                self.client = TelegramClient(
                    self.session_file,
                    self.api_id,
                    self.api_hash
                )

                # Connect with existing session
                if not await self.client.is_user_authorized():
                    print("⚠️  Session expired, reconnecting...")
                    await self.client.start(phone=self.phone)
                else:
                    await self.client.connect()

            except Exception as e:
                print(f"⚠️  Session issue: {e}")
                print("Creating new session...")

                # Create fresh session
                os.remove(f"{self.session_file}.session") if os.path.exists(f"{self.session_file}.session") else None

                self.client = TelegramClient(
                    self.session_file,
                    self.api_id,
                    self.api_hash
                )

                await self.client.start(phone=self.phone)

            print("✓ Connected to Telegram!")
            return True

        except ImportError:
            print("❌ Telethon not installed")
            print("  Install with: pip install telethon")
            return False
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False

    async def send_signal_to_channel(self, channel_name: str, message: str) -> bool:
        """
        Send signal message to channel

        Args:
            channel_name: Channel name (without @) or channel ID
            message: Message to send

        Returns:
            True if sent successfully
        """
        if not self.client:
            print("❌ Not connected to Telegram")
            return False

        try:
            # Format channel name
            if not channel_name.startswith("@"):
                channel_name = f"@{channel_name}"

            print(f"\n📤 Sending to {channel_name}...")

            # Send message
            result = await self.client.send_message(channel_name, message)

            print(f"✅ Message sent! (ID: {result.id})")
            return True

        except Exception as e:
            print(f"❌ Error sending message: {e}")
            return False

    def get_btc_price(self):
        """Get BTC price (sample data for now)"""
        print("\n📡 Fetching BTC price...")

        btc_data = {
            "symbol": "BTC-USD",
            "current_price": 45234.50,
            "intraday_high": 45800.00,
            "intraday_low": 44900.00,
            "change_percent": 2.34,
            "timestamp": datetime.now().isoformat()
        }

        print(f"✓ BTC: ${btc_data['current_price']:,.2f}")
        return btc_data

    def analyze_signal(self, btc_data):
        """Analyze BTC signal"""
        print("\n🔍 Analyzing BTC signal...")

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

        # Analyze
        analyzer = LiquidityAnalyzer([signal], market, clustering_tolerance=100)
        analysis = analyzer.analyze()

        return signal, analysis

    def format_telegram_message(self, signal, analysis, btc_data) -> str:
        """Format message for Telegram"""

        bias = analysis['retail_bias']
        assess = analysis['positioning_assessment']
        decision = "ACCEPT" if assess['status'] == "CORRECT" else "REVIEW"

        msg = f"""🎯 <b>BTC TRADING SIGNAL</b> - {decision}

<b>📊 Market</b>
Price: <code>${btc_data['current_price']:,.2f}</code>
Change: <code>{btc_data['change_percent']:+.2f}%</code>
Range: <code>${btc_data['intraday_low']:,.2f} - ${btc_data['intraday_high']:,.2f}</code>

<b>📈 Signal Setup</b>
Direction: <code>{signal.direction}</code>
Entry: <code>${signal.entry:,.2f}</code>
Stop Loss: <code>${signal.sl:,.2f}</code>
Take Profit: <code>${signal.tp:,.2f}</code>

<b>💰 Risk/Reward</b>
<code>{abs(signal.tp - signal.entry) / abs(signal.entry - signal.sl):.2f}:1</code>

<b>📌 Liquidity Analysis</b>
Retail: <code>{bias['dominant_bias']}</code>
Crowding: <code>{bias['crowding_level']}</code>
Status: <code>{assess['status']}</code>

⏰ <code>{datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</code>
🤖 QUANTFLOW V1 - Institutional Analysis"""

        return msg

    async def run_complete_test(self, channel_name: str):
        """Run complete test and send to Telegram"""

        print("\n" + "="*70)
        print("🔥 LIVE TELEGRAM SEND - COMPLETE WORKFLOW")
        print("="*70)

        # Connect
        connected = await self.connect()
        if not connected:
            return {"status": "FAILED", "error": "Could not connect to Telegram"}

        # Get price
        btc_data = self.get_btc_price()

        # Analyze
        signal, analysis = self.analyze_signal(btc_data)

        bias = analysis['retail_bias']
        assess = analysis['positioning_assessment']

        print(f"\n✓ Signal Analysis:")
        print(f"  Retail: {bias['dominant_bias']}")
        print(f"  Status: {assess['status']}")
        print(f"  Crowding: {bias['crowding_level']}")

        # Format message
        telegram_msg = self.format_telegram_message(signal, analysis, btc_data)

        # Send
        print("\n" + "-"*70)
        print("Telegram Message Preview:")
        print("-"*70)
        print(telegram_msg)

        sent = await self.send_signal_to_channel(channel_name, telegram_msg)

        # Prepare result
        result = {
            "timestamp": datetime.now().isoformat(),
            "status": "SUCCESS" if sent else "FAILED",
            "btc_price": btc_data['current_price'],
            "signal": {
                "direction": signal.direction,
                "entry": round(signal.entry, 2),
                "sl": round(signal.sl, 2),
                "tp": round(signal.tp, 2)
            },
            "analysis": {
                "retail_bias": bias['dominant_bias'],
                "status": assess['status'],
                "crowding": bias['crowding_level']
            },
            "telegram_sent": sent,
            "channel": channel_name
        }

        self.results.append(result)

        # Summary
        print("\n" + "="*70)
        print("📊 RESULTS")
        print("="*70)
        print(f"Status: {result['status']}")
        print(f"BTC Price: ${result['btc_price']:,.2f}")
        print(f"Signal: {signal.direction} @ ${signal.entry:,.2f}")
        print(f"Analysis: {assess['status']}")
        print(f"Telegram: {'✅ Sent' if sent else '❌ Failed'}")
        print(f"Channel: {channel_name}")
        print("="*70)

        return result

    async def disconnect(self):
        """Disconnect from Telegram"""
        if self.client:
            await self.client.disconnect()
            print("\n👋 Disconnected from Telegram")


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Send BTC signal to Telegram")
    parser.add_argument(
        '--channel',
        default='achraf_trading_signals',
        help='Telegram channel name (without @)'
    )
    args = parser.parse_args()

    print("\n" + "🔥"*35)
    print("QUANTFLOW V1 - LIVE TELEGRAM SIGNAL SENDER")
    print("🔥"*35)

    # Create sender
    sender = TelegramSignalSender(API_ID, API_HASH, PHONE)

    try:
        # Run test
        result = await sender.run_complete_test(args.channel)

        # Save results
        with open("telegram_send_results.json", "w") as f:
            json.dump(sender.results, f, indent=2)

        print("\n✅ Results saved to telegram_send_results.json")

    finally:
        # Cleanup
        await sender.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
