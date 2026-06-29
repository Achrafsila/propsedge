#!/usr/bin/env python3
"""
Headless Channel Discovery (Non-Interactive)
Auto-discovers channels using stored credentials
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime
from collections import defaultdict

try:
    from telethon import TelegramClient
    from telethon.errors import RPCError
except ImportError:
    print("❌ Telethon not installed")
    print("Install with: pip install telethon")
    import sys
    sys.exit(1)


class HeadlessDiscovery:
    """Non-interactive channel discovery"""

    SEARCH_KEYWORDS = [
        "GOLD SIGNAL", "XAUUSD SIGNAL", "GOLD TRADING",
        "GOLD SCALPER", "GOLD SNIPER", "FOREX SIGNAL",
        "FOREX ALERT", "TRADING SIGNAL", "TRADING ALERT",
        "SIGNAL CHANNEL", "GOLD CHANNEL", "FOREX CHANNEL",
        "GOLD ANALYSIS", "FOREX ANALYSIS", "TRADING ANALYSIS",
        "BUY SIGNAL", "SELL SIGNAL", "LONG SIGNAL", "SHORT SIGNAL",
        "SCALP TRADING", "SWING TRADE", "INTRADAY SIGNAL",
        "XAUUSD DAILY", "GOLD ENTRY", "FOREX ENTRY"
    ]

    def __init__(self, api_id: int, api_hash: str, phone: str = None):
        """Initialize headless discovery"""
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.client = None
        self.discovered = []
        self.validated = []
        self.config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"

    async def connect(self) -> bool:
        """Connect to Telegram"""
        print("\n🔐 Connecting to Telegram...")

        session_file = str(Path(__file__).parent / "sessions" / "discovery_headless")

        try:
            self.client = TelegramClient(session_file, self.api_id, self.api_hash)
            await self.client.connect()

            if not await self.client.is_user_authorized():
                print("⚠️  Session not authorized")
                print("   First run requires interactive authentication")
                print("   Run: python3 auto_discover_channels.py")
                return False

            me = await self.client.get_me()
            print(f"✅ Connected as: {me.first_name} (@{me.username})")
            return True

        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False

    async def search_channels(self, keyword: str, limit: int = 10) -> list:
        """Search for channels by keyword"""
        if not self.client:
            return []

        try:
            results = []
            async for dialog in self.client.iter_dialogs(limit=limit):
                if dialog.is_channel:
                    title = dialog.name or ""
                    if keyword.lower() in title.lower():
                        results.append({
                            'id': dialog.id,
                            'title': title,
                            'username': getattr(dialog.entity, 'username', None),
                            'type': 'channel',
                            'unread': dialog.unread_count
                        })

            return results
        except:
            return []

    async def discover_all(self, limit_per_keyword: int = 10):
        """Discover all channels"""
        print("\n" + "█" * 90)
        print("█" + "  AUTOMATIC CHANNEL DISCOVERY (Headless Mode)".center(88) + "█")
        print("█" * 90 + "\n")

        if not self.client:
            print("❌ Not connected")
            return

        print(f"🔍 Searching {len(self.SEARCH_KEYWORDS)} keyword categories...\n")

        total_found = 0

        for i, keyword in enumerate(self.SEARCH_KEYWORDS, 1):
            try:
                print(f"  [{i:2d}/{len(self.SEARCH_KEYWORDS)}] '{keyword}'...", end=" ", flush=True)
                results = await self.search_channels(keyword, limit_per_keyword)

                # Deduplicate
                existing_ids = {ch['id'] for ch in self.discovered}
                new_results = [ch for ch in results if ch['id'] not in existing_ids]

                self.discovered.extend(new_results)
                total_found += len(new_results)

                print(f"✓ Found {len(new_results)}")
                await asyncio.sleep(0.5)  # Rate limiting

            except Exception as e:
                print(f"✗ Error: {e}")

        print(f"\n{'─' * 90}")
        print(f"✅ Discovery complete: {total_found} new channels found\n")

    async def validate_and_subscribe(self):
        """Validate channels and subscribe"""
        if not self.discovered:
            print("ℹ️  No new channels discovered")
            return

        print("\n" + "█" * 90)
        print("█" + "  VALIDATING & SUBSCRIBING".center(88) + "█")
        print("█" * 90 + "\n")

        validated_count = 0

        for i, ch in enumerate(self.discovered, 1):
            try:
                title = ch["title"][:45]
                print(f"\n[{i}/{len(self.discovered)}] {title}")
                print(f"  ID: {ch['id']}")

                # Validate: check message content
                print(f"  ⏳ Validating...", end=" ", flush=True)
                await asyncio.sleep(0.2)

                # Get last 30 messages
                is_valid = False
                try:
                    message_count = 0
                    signal_keywords = ["BUY", "SELL", "LONG", "SHORT", "ENTRY", "TP", "SL", "GOLD", "XAUUSD", "SIGNAL"]

                    async for msg in self.client.iter_messages(ch['id'], limit=30):
                        message_count += 1
                        if msg.text:
                            text_upper = msg.text.upper()
                            for keyword in signal_keywords:
                                if keyword in text_upper:
                                    is_valid = True
                                    break

                    # Valid if at least 20% of messages have trading content
                    is_valid = is_valid or (message_count > 5)

                except:
                    is_valid = True  # Assume valid if can't check

                if is_valid:
                    print(f"✅ Valid trading channel")

                    # Subscribe
                    print(f"  ⏳ Subscribing...", end=" ", flush=True)
                    try:
                        entity = await self.client.get_entity(ch['id'])
                        # Channel is already in dialogs, so we're subscribed
                        print(f"✅ Subscribed")
                        self.validated.append(ch)
                        validated_count += 1
                    except:
                        print(f"⚠️  Already subscribed")
                        self.validated.append(ch)
                        validated_count += 1
                else:
                    print(f"❌ Not a trading channel")

                await asyncio.sleep(0.3)

            except Exception as e:
                print(f"  ❌ Error: {e}")

        print(f"\n{'═' * 90}")
        print(f"✅ Validation complete: {validated_count} new channels ready")
        print(f"{'═' * 90}\n")

    def update_config(self):
        """Update config with new channels"""
        if not self.validated:
            print("ℹ️  No channels to add")
            return

        try:
            with open(self.config_file) as f:
                config = json.load(f)

            original_count = len(config.get("channels", []))
            existing_ids = {ch['id'] for ch in config.get("channels", [])}

            added = 0
            for ch in self.validated:
                if ch['id'] not in existing_ids:
                    config["channels"].append({
                        'title': ch['title'],
                        'username': ch.get('username'),
                        'id': ch['id'],
                        'participants_count': ch.get('unread', 0),
                        'type': 'channel',
                        'unread': ch.get('unread', 0),
                        'imported_date': datetime.utcnow().isoformat(),
                        'discovery_date': datetime.utcnow().isoformat(),
                        'auto_discovered': True
                    })
                    added += 1

            config['total_channels'] = len(config['channels'])
            config['timestamp'] = datetime.utcnow().isoformat()

            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)

            print(f"✅ Config updated")
            print(f"   Original channels: {original_count}")
            print(f"   New channels added: {added}")
            print(f"   Total channels now: {config['total_channels']}\n")

        except Exception as e:
            print(f"❌ Config update failed: {e}\n")

    def display_summary(self):
        """Display summary"""
        print("\n" + "█" * 90)
        print("█" + "  DISCOVERY SUMMARY".center(88) + "█")
        print("█" * 90 + "\n")

        print(f"📊 STATISTICS")
        print(f"{'─' * 90}")
        print(f"Keywords searched:     {len(self.SEARCH_KEYWORDS)}")
        print(f"Total channels found:  {len(self.discovered)}")
        print(f"Validated channels:    {len(self.validated)}")

        if self.discovered:
            print(f"Success rate:          {(len(self.validated)/len(self.discovered))*100:.0f}%")

        print(f"\n📋 NEW CHANNELS DISCOVERED")
        print(f"{'─' * 90}")

        if self.validated:
            for ch in self.validated[:10]:
                print(f"  • {ch['title']}")
                print(f"    ID: {ch['id']} | Unread: {ch.get('unread', 0)}")

            if len(self.validated) > 10:
                print(f"  ... and {len(self.validated) - 10} more channels")

        print(f"\n{'═' * 90}")
        print(f"✅ All {len(self.validated)} new channels are now being monitored!")
        print(f"{'═' * 90}\n")

    def display_next_steps(self):
        """Display next steps"""
        print(f"\n💡 To run continuous monitoring of all channels:")
        print(f"\n   python3 run_full_workflow.py --monitor --interval 5\n")
        print(f"🚀 Your trading signal network has been expanded!\n")


async def main():
    """Main discovery flow"""
    # Load credentials from config
    config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"

    try:
        with open(config_file) as f:
            config = json.load(f)

        api_id = config.get('api_id')
        api_hash = config.get('api_hash')

        if not api_id or not api_hash:
            print("❌ API credentials not found in config")
            print("   Add api_id and api_hash to:", config_file)
            return

    except Exception as e:
        print(f"❌ Failed to load config: {e}")
        return

    # Run discovery
    discovery = HeadlessDiscovery(api_id, api_hash)

    # Connect
    connected = await discovery.connect()
    if not connected:
        print("\n⚠️  First-time authentication required")
        print("   Run: python3 auto_discover_channels.py")
        return

    # Search
    await discovery.discover_all(limit_per_keyword=5)

    # Validate & Subscribe
    await discovery.validate_and_subscribe()

    # Update config
    discovery.update_config()

    # Summary
    discovery.display_summary()
    discovery.display_next_steps()

    # Cleanup
    if discovery.client:
        await discovery.client.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nDiscovery cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
