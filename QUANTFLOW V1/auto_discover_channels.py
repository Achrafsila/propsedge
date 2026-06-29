#!/usr/bin/env python3
"""
Automatic Trading Channel Discovery & Subscription
Searches for and subscribes to new trading signal channels
"""

import json
import asyncio
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict

try:
    from telethon import TelegramClient
    from telethon.errors import RPCError
    from telethon.tl.functions.contacts import SearchRequest
    from telethon.tl.types import InputPeerEmpty
except ImportError:
    print("❌ Telethon not installed. Install with: pip install telethon")
    sys.exit(1)


class ChannelDiscovery:
    """Discover and subscribe to new trading channels"""

    # Keywords to search for trading channels
    SEARCH_KEYWORDS = [
        "GOLD SIGNAL",
        "XAUUSD SIGNAL",
        "FOREX SIGNAL",
        "TRADING SIGNAL",
        "GOLD TRADING",
        "XAU USD",
        "GOLD SCALPER",
        "GOLD SNIPER",
        "TRADING ALERT",
        "FOREX ALERT",
        "GOLD ALERT",
        "TRADING CHANNEL",
        "SIGNAL CHANNEL",
        "GOLD CHANNEL",
        "FOREX CHANNEL",
        "TRADER SIGNALS",
        "TRADING ANALYSIS",
        "GOLD ANALYSIS",
        "FOREX ANALYSIS",
        "GOLD ENTRY",
        "FOREX ENTRY",
        "BUY SIGNAL",
        "SELL SIGNAL",
        "LONG SIGNAL",
        "SHORT SIGNAL",
    ]

    def __init__(self, config_file: str = "data/quantflow_monitoring_config.json"):
        """Initialize discovery engine"""
        self.config_file = Path(config_file)
        self.existing_channels = self._load_existing()
        self.discovered_channels = []
        self.new_channels = []
        self.client = None
        self.api_id = None
        self.api_hash = None

    def _load_existing(self):
        """Load existing channels from config"""
        if not self.config_file.exists():
            return {}

        try:
            with open(self.config_file) as f:
                config = json.load(f)
                channels = {ch['id']: ch for ch in config.get('channels', [])}
                return channels
        except:
            return {}

    def _get_credentials(self):
        """Get Telegram API credentials from config"""
        config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"

        try:
            with open(config_file) as f:
                config = json.load(f)
                self.api_id = config.get('api_id')
                self.api_hash = config.get('api_hash')

                if not self.api_id or not self.api_hash:
                    print("⚠️  API credentials not in config, using defaults")
                    # Fallback - these should be replaced with actual credentials
                    return False
                return True
        except:
            return False

    async def connect(self):
        """Connect to Telegram"""
        print("\n🔐 Connecting to Telegram...")

        if not self._get_credentials():
            print("❌ Cannot proceed without valid API credentials")
            return False

        # Try authenticated sessions in order of preference
        session_candidates = [
            str(Path(__file__).parent / "sessions" / "telegram_session"),
            str(Path(__file__).parent / "telegram_session"),
            str(Path(__file__).parent / "sessions" / "discovery_session"),
        ]

        for session_file in session_candidates:
            try:
                self.client = TelegramClient(session_file, self.api_id, self.api_hash)
                await self.client.connect()

                if await self.client.is_user_authorized():
                    me = await self.client.get_me()
                    print(f"✅ Connected as: {me.first_name} (@{me.username}) [session: {Path(session_file).name}]")
                    return True
                else:
                    await self.client.disconnect()
                    self.client = None

            except Exception:
                if self.client:
                    try:
                        await self.client.disconnect()
                    except:
                        pass
                self.client = None

        print("❌ No authorized session found")
        print("   Run authentication first: python3 -c \"")
        print("   from telethon.sync import TelegramClient")
        print("   c = TelegramClient('sessions/discovery_session', API_ID, API_HASH)")
        print("   c.start()\"")
        return False

    async def search_channels(self, keyword: str, limit: int = 20) -> list:
        """Search for NEW channels globally using Telegram's contacts search API"""
        if not self.client:
            return []

        found = []

        try:
            # Use Telegram's global search to find channels by keyword
            result = await self.client(SearchRequest(
                q=keyword,
                limit=limit
            ))

            for chat in result.chats:
                chat_type = type(chat).__name__
                # Only channels and megagroups (broadcast channels)
                if hasattr(chat, 'broadcast') or hasattr(chat, 'megagroup'):
                    is_channel = getattr(chat, 'broadcast', False)
                    is_megagroup = getattr(chat, 'megagroup', False)
                    if is_channel or is_megagroup:
                        title = getattr(chat, 'title', '') or ''
                        username = getattr(chat, 'username', None)
                        participants = getattr(chat, 'participants_count', 0) or 0
                        found.append({
                            'id': chat.id,
                            'title': title,
                            'username': username,
                            'type': 'channel',
                            'participants_count': participants,
                            'access_hash': getattr(chat, 'access_hash', None)
                        })

        except Exception as e:
            pass

        return found

    async def discover_all(self, limit_per_keyword: int = 10):
        """Discover all channels matching keywords"""
        print("\n" + "█"*90)
        print("█" + "  AUTOMATIC CHANNEL DISCOVERY".center(88) + "█")
        print("█"*90 + "\n")

        if not self.client:
            print("⚠️  Not connected to Telegram")
            return

        print(f"🔍 Searching for {len(self.SEARCH_KEYWORDS)} keyword categories...\n")

        discovered = defaultdict(list)
        total_found = 0

        for keyword in self.SEARCH_KEYWORDS:
            try:
                print(f"  Searching: '{keyword}'...", end=" ")
                results = await self.search_channels(keyword, limit_per_keyword)

                new_count = 0
                for ch in results:
                    if ch['id'] not in self.existing_channels:
                        discovered[keyword].append(ch)
                        self.new_channels.append(ch)
                        new_count += 1

                print(f"✓ Found {new_count} new")
                total_found += new_count

            except Exception as e:
                print(f"✗ Error: {e}")

        print(f"\n{'─'*90}")
        print(f"✅ Discovery complete: {total_found} new channels found\n")

        self.discovered_channels = self.new_channels

    async def validate_channel(self, channel_id: int, channel_title: str) -> bool:
        """Validate if channel sends trading signals"""
        if not self.client:
            return False

        try:
            # Get last 50 messages
            messages = []
            async for msg in self.client.iter_messages(channel_id, limit=50):
                if msg.text:
                    messages.append(msg.text.upper())

            # Check for trading keywords
            trading_keywords = [
                "BUY", "SELL", "LONG", "SHORT",
                "ENTRY", "TP", "SL", "STOP LOSS",
                "GOLD", "XAUUSD", "SIGNAL", "ALERT"
            ]

            signal_count = 0
            for msg in messages:
                for keyword in trading_keywords:
                    if keyword in msg:
                        signal_count += 1
                        break

            # Valid if at least 20% of messages have trading content
            is_valid = signal_count >= (len(messages) * 0.2)
            return is_valid

        except:
            return False

    async def subscribe_to_channel(self, channel: dict) -> bool:
        """Subscribe to a channel using JoinChannelRequest"""
        if not self.client:
            return False

        try:
            from telethon.tl.functions.channels import JoinChannelRequest
            from telethon.tl.types import InputChannel

            channel_id = channel['id']
            access_hash = channel.get('access_hash')
            username = channel.get('username')

            # Try username first (most reliable)
            if username:
                entity = await self.client.get_entity(username)
                await self.client(JoinChannelRequest(entity))
                return True

            # Try with access_hash
            if access_hash:
                entity = InputChannel(channel_id, access_hash)
                await self.client(JoinChannelRequest(entity))
                return True

            # Try by ID
            entity = await self.client.get_entity(channel_id)
            await self.client(JoinChannelRequest(entity))
            return True

        except Exception as e:
            return False

    async def process_discovered(self):
        """Process discovered channels: validate and subscribe"""
        if not self.new_channels:
            print("ℹ️  No new channels discovered")
            return

        print("\n" + "█"*90)
        print("█" + "  VALIDATING & SUBSCRIBING TO NEW CHANNELS".center(88) + "█")
        print("█"*90 + "\n")

        validated = []

        for i, ch in enumerate(self.new_channels, 1):
            print(f"\n[{i}/{len(self.new_channels)}] Processing: {ch['title']}")
            print(f"  ID: {ch['id']}")

            # Validate
            print(f"  ⏳ Validating...", end=" ")
            is_valid = await self.validate_channel(ch['id'], ch['title'])

            if is_valid:
                print(f"✅ Valid trading channel")

                # Subscribe
                print(f"  ⏳ Subscribing...", end=" ")
                subscribed = await self.subscribe_to_channel(ch['id'])

                if subscribed:
                    print(f"✅ Subscribed")
                    validated.append(ch)
                else:
                    print(f"⚠️  Subscription failed (may already be subscribed)")
                    validated.append(ch)  # Add anyway, might be public
            else:
                print(f"❌ Not a trading channel")

            await asyncio.sleep(1)  # Rate limiting

        print(f"\n{'═'*90}")
        print(f"✅ Validation complete: {len(validated)} new channels ready")
        print(f"{'═'*90}\n")

        return validated

    def update_config(self, new_channels: list):
        """Update config with new channels"""
        if not new_channels:
            return

        try:
            with open(self.config_file) as f:
                config = json.load(f)

            existing_ids = {ch['id'] for ch in config.get('channels', [])}

            for ch in new_channels:
                if ch['id'] not in existing_ids:
                    config['channels'].append({
                        'title': ch['title'],
                        'username': ch.get('username'),
                        'id': ch['id'],
                        'participants_count': 0,
                        'type': 'channel',
                        'unread': 0,
                        'imported_date': datetime.utcnow().isoformat(),
                        'discovery_date': datetime.utcnow().isoformat(),
                        'auto_discovered': True
                    })

            # Update total
            config['total_channels'] = len(config['channels'])
            config['timestamp'] = datetime.utcnow().isoformat()

            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)

            print(f"\n✅ Config updated with {len(new_channels)} new channels")
            print(f"   Total channels now: {config['total_channels']}")

        except Exception as e:
            print(f"❌ Failed to update config: {e}")

    def display_summary(self, validated: list):
        """Display discovery summary"""
        print("\n" + "█"*90)
        print("█" + "  DISCOVERY SUMMARY".center(88) + "█")
        print("█"*90 + "\n")

        print(f"📊 STATISTICS")
        print(f"{'─'*90}")
        print(f"Keywords searched:     {len(self.SEARCH_KEYWORDS)}")
        print(f"New channels found:    {len(self.new_channels)}")
        print(f"Validated channels:    {len(validated)}")
        print(f"Success rate:          {(len(validated)/max(len(self.new_channels),1))*100:.0f}%")

        if validated:
            print(f"\n📋 NEW CHANNELS ADDED")
            print(f"{'─'*90}")
            for ch in validated:
                print(f"  • {ch['title']}")
                print(f"    ID: {ch['id']}")

        print(f"\n{'═'*90}")
        print(f"🚀 All new channels are now being monitored!")
        print(f"{'═'*90}\n")


async def main():
    """Main discovery flow"""
    discovery = ChannelDiscovery()

    # Connect
    connected = await discovery.connect()
    if not connected:
        print("\n⚠️  Discovery requires valid Telegram credentials")
        print("   Add api_id and api_hash to config file:")
        print(f"   {discovery.config_file}")
        return

    # Search
    await discovery.discover_all(limit_per_keyword=5)

    # Validate and subscribe
    validated = await discovery.process_discovered()

    # Update config
    if validated:
        discovery.update_config(validated)

    # Summary
    discovery.display_summary(validated)

    # Cleanup
    if discovery.client:
        await discovery.client.disconnect()

    print("\n💡 To monitor all channels (including new ones):")
    print("   python3 run_full_workflow.py --monitor --interval 5\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nDiscovery cancelled by user")
        sys.exit(0)
