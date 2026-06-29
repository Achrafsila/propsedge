#!/usr/bin/env python3
"""
Configure Telegram Channels for QUANTFLOW V1
Manually add/remove channels to monitor
"""

import json
from pathlib import Path
from datetime import datetime


def load_channels():
    """Load current channels config"""
    file = Path(__file__).parent / "data" / "all_channels.json"
    try:
        with open(file) as f:
            return json.load(f)
    except:
        return []


def save_channels(channels):
    """Save channels config"""
    file = Path(__file__).parent / "data" / "all_channels.json"
    with open(file, 'w') as f:
        json.dump(channels, f, indent=2)
    print(f"✅ Saved to {file}")


def display_channels(channels):
    """Display all configured channels"""
    print("\n" + "="*70)
    print("📡 CONFIGURED CHANNELS")
    print("="*70)

    if not channels:
        print("\n⚠️  No channels configured")
        return

    for i, ch in enumerate(channels, 1):
        print(f"\n[{i}] {ch.get('title', 'Unknown')}")
        print(f"    Username: {ch.get('username', 'N/A')}")
        print(f"    ID: {ch.get('id', 'N/A')}")
        print(f"    Participants: {ch.get('participants_count', 0)}")


def add_channel_interactive():
    """Add a channel interactively"""
    print("\n" + "="*70)
    print("➕ ADD NEW CHANNEL")
    print("="*70)

    title = input("\nChannel Name (e.g., 'Trading Signals Gold'): ").strip()
    if not title:
        print("❌ Channel name required")
        return None

    username = input("Channel Username (e.g., '@xauusd_trading'): ").strip()
    if not username.startswith('@'):
        username = '@' + username

    channel_id = input("Channel ID (numeric, optional - press Enter to skip): ").strip()
    if not channel_id:
        channel_id = None
    else:
        try:
            channel_id = int(channel_id)
        except:
            print("❌ Invalid ID format")
            return None

    participants = input("Approximate Participants (optional): ").strip()
    try:
        participants = int(participants) if participants else 0
    except:
        participants = 0

    return {
        "title": title,
        "username": username,
        "id": channel_id,
        "participants_count": participants,
        "added_date": datetime.now().isoformat()
    }


def main():
    """Main menu"""
    print("\n" + "█"*70)
    print("█" + " "*68 + "█")
    print("█" + "  QUANTFLOW V1 - CHANNEL CONFIGURATOR".center(68) + "█")
    print("█" + " "*68 + "█")
    print("█"*70)

    while True:
        channels = load_channels()

        print(f"\n\n📊 Current: {len(channels)} channel(s) configured")
        print("\nOptions:")
        print("  [1] View all channels")
        print("  [2] Add channel")
        print("  [3] Remove channel")
        print("  [4] Import from TradingView")
        print("  [5] Export current config")
        print("  [6] Exit")

        choice = input("\nSelect option (1-6): ").strip()

        if choice == '1':
            display_channels(channels)

        elif choice == '2':
            new_channel = add_channel_interactive()
            if new_channel:
                channels.append(new_channel)
                save_channels(channels)
                print(f"\n✅ Channel added: {new_channel['title']}")

        elif choice == '3':
            display_channels(channels)
            if channels:
                try:
                    idx = int(input("\nEnter channel number to remove: ")) - 1
                    if 0 <= idx < len(channels):
                        removed = channels.pop(idx)
                        save_channels(channels)
                        print(f"\n✅ Removed: {removed['title']}")
                    else:
                        print("❌ Invalid number")
                except ValueError:
                    print("❌ Invalid input")

        elif choice == '4':
            print("\n⏳ To import channels from TradingView:")
            print("   1. Run: python3 get_all_telegram_channels.py")
            print("   2. Complete the Telegram authentication")
            print("   3. Channels will be auto-imported")

        elif choice == '5':
            file = Path(__file__).parent / "data" / "all_channels.json"
            print(f"\n✅ Config file: {file}")
            print("\nCurrent config:")
            print(json.dumps(channels, indent=2))

        elif choice == '6':
            print("\n✅ Goodbye!")
            break

        else:
            print("❌ Invalid option")


if __name__ == '__main__':
    main()
