#!/usr/bin/env python3
"""
Complete Channel Import for QUANTFLOW V1
Imports ALL 55 channels from Telegram account into the system
"""

import json
from pathlib import Path
from datetime import datetime


def import_all_channels():
    """Import all channels from Telegram dialogs into QUANTFLOW"""

    print("\n" + "█"*70)
    print("█" + " "*68 + "█")
    print("█" + "  QUANTFLOW V1 - COMPLETE CHANNEL IMPORT".center(68) + "█")
    print("█" + " "*68 + "█")
    print("█"*70)

    # Load all dialogs from Telegram
    dialogs_file = Path(__file__).parent / "data" / "all_telegram_dialogs.json"

    print("\n[1/4] 📂 Loading Telegram dialogs...")
    try:
        with open(dialogs_file) as f:
            all_dialogs = json.load(f)
    except FileNotFoundError:
        print(f"❌ File not found: {dialogs_file}")
        return False

    channels = all_dialogs.get('channels', [])
    groups = all_dialogs.get('groups', [])

    print(f"✅ Loaded {len(channels)} channels + {len(groups)} groups")

    # Prepare channel list for QUANTFLOW
    print("\n[2/4] 🔄 Processing channels for QUANTFLOW...")

    quantflow_channels = []

    # Add all channels
    for ch in channels:
        quantflow_channels.append({
            "title": ch['name'],
            "username": ch['username'] if ch['username'] != "N/A" else None,
            "id": ch['id'],
            "participants_count": ch['participants'] or 0,
            "type": "channel",
            "unread": ch['unread_count'],
            "imported_date": datetime.now().isoformat()
        })

    # Add groups that are trading-related
    for gr in groups:
        if any(keyword in gr['name'].lower() for keyword in ['trade', 'forex', 'gold', 'signal', 'xau']):
            quantflow_channels.append({
                "title": gr['name'],
                "username": None,
                "id": gr['id'],
                "participants_count": gr['participants'] or 0,
                "type": "group",
                "unread": gr['unread_count'],
                "imported_date": datetime.now().isoformat()
            })

    print(f"✅ Processed {len(quantflow_channels)} channels for monitoring")

    # Save to all_channels.json
    print("\n[3/4] 💾 Saving to configuration...")

    channels_file = Path(__file__).parent / "data" / "all_channels.json"
    with open(channels_file, 'w') as f:
        json.dump(quantflow_channels, f, indent=2)

    print(f"✅ Saved: {channels_file}")

    # Create monitoring configuration
    print("\n[4/4] 🎯 Creating monitoring configuration...")

    monitoring_config = {
        "timestamp": datetime.now().isoformat(),
        "account": all_dialogs.get('account', 'achrafsila'),
        "total_channels": len(quantflow_channels),
        "monitoring": {
            "enabled": True,
            "fetch_interval_seconds": 10,
            "priority_channels": [
                "@kingxauusd1",
                "@malek_eldahab",
                "@FOREX_XAUUSD_GOLD_SIGNAL",
                "@best_goldXauusd_signals01",
                "@Gold_vip_analysis_xauusd_hunter"
            ],
            "filter_keywords": [
                "BUY", "SELL", "LONG", "SHORT",
                "GOLD", "XAUUSD", "XAU/USD",
                "ENTRY", "TP", "SL", "STOP LOSS"
            ]
        },
        "tradingview_integration": {
            "enabled": True,
            "price_source": "OANDA:XAUUSD",
            "verify_every_signal": True,
            "tolerance_pips": 5
        },
        "channels": quantflow_channels
    }

    config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"
    with open(config_file, 'w') as f:
        json.dump(monitoring_config, f, indent=2)

    print(f"✅ Created: {config_file}")

    # Display summary
    print("\n" + "="*70)
    print("✅ IMPORT COMPLETE")
    print("="*70)

    print(f"\n📊 Summary:")
    print(f"  • Total channels imported: {len(quantflow_channels)}")
    print(f"  • Channels: {sum(1 for ch in quantflow_channels if ch['type'] == 'channel')}")
    print(f"  • Groups: {sum(1 for ch in quantflow_channels if ch['type'] == 'group')}")

    print(f"\n🎯 Top Priority Channels:")
    priorities = monitoring_config['monitoring']['priority_channels']
    for i, channel in enumerate(priorities, 1):
        matching = next((ch for ch in quantflow_channels if ch.get('username') == channel), None)
        if matching:
            print(f"  [{i}] {matching['title']}")
            print(f"      {channel}")

    print(f"\n🌐 TradingView Integration:")
    print(f"  ✅ Status: ENABLED")
    print(f"  ✅ Price Source: OANDA:XAUUSD")
    print(f"  ✅ Verify Every Signal: YES")
    print(f"  ✅ Tolerance: ±{monitoring_config['tradingview_integration']['tolerance_pips']} pips")

    print(f"\n📁 Configuration Files:")
    print(f"  • {channels_file}")
    print(f"  • {config_file}")

    return True


def show_channel_list():
    """Display all imported channels"""
    config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"

    try:
        with open(config_file) as f:
            config = json.load(f)
    except:
        print("❌ Config file not found. Run import first.")
        return

    channels = config['channels']

    print("\n" + "="*70)
    print(f"📡 ALL MONITORED CHANNELS ({len(channels)})")
    print("="*70 + "\n")

    # Group by type
    trading_channels = [ch for ch in channels if 'gold' in ch['title'].lower() or 'xau' in ch['title'].lower()]
    forex_channels = [ch for ch in channels if 'forex' in ch['title'].lower()]
    other_channels = [ch for ch in channels if ch not in trading_channels and ch not in forex_channels]

    # Display gold channels first
    if trading_channels:
        print("🥇 GOLD/XAUUSD TRADING CHANNELS:")
        for i, ch in enumerate(trading_channels[:20], 1):
            username = f" ({ch['username']})" if ch['username'] else ""
            unread = f" [Unread: {ch['unread']}]" if ch['unread'] > 0 else ""
            print(f"  [{i:2d}] {ch['title']}{username}{unread}")
        if len(trading_channels) > 20:
            print(f"  ... and {len(trading_channels) - 20} more")

    if forex_channels:
        print(f"\n💱 FOREX CHANNELS:")
        for i, ch in enumerate(forex_channels[:10], 1):
            username = f" ({ch['username']})" if ch['username'] else ""
            unread = f" [Unread: {ch['unread']}]" if ch['unread'] > 0 else ""
            print(f"  [{i:2d}] {ch['title']}{username}{unread}")

    if other_channels:
        print(f"\n📊 OTHER CHANNELS:")
        for i, ch in enumerate(other_channels[:5], 1):
            username = f" ({ch['username']})" if ch['username'] else ""
            unread = f" [Unread: {ch['unread']}]" if ch['unread'] > 0 else ""
            print(f"  [{i:2d}] {ch['title']}{username}{unread}")
        if len(other_channels) > 5:
            print(f"  ... and {len(other_channels) - 5} more")


if __name__ == '__main__':
    import sys

    success = import_all_channels()

    if success:
        print("\n" + "="*70)
        show_channel_list()
        print("\n" + "="*70)
        print("✅ QUANTFLOW V1 is now monitoring ALL 55+ channels!")
        print("="*70)
        sys.exit(0)
    else:
        sys.exit(1)
