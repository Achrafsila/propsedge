#!/usr/bin/env python3
"""
List ALL Telegram channels from account achrafsila (CLI version)
Usage: python3 get_all_telegram_channels_cli.py [--code CODE] [--skip-auth]
"""

import asyncio
import json
import sys
import argparse
from pathlib import Path
from datetime import datetime

# Configuration
API_ID = "38456630"
API_HASH = "4b2a85354b6e6d4103820dc92b522b53"
PHONE = "+212688434773"
SESSION_FILE = str(Path(__file__).parent / "sessions" / "telegram_session.session")


async def get_all_telegram_channels(auth_code=None):
    """Retrieve ALL channels from Telegram account"""
    try:
        from telethon import TelegramClient
        from telethon.tl.types import Channel, Chat, User
    except ImportError:
        print("❌ Telethon not installed. Install with: pip install telethon")
        return None

    print("\n" + "="*70)
    print("🔐 CONNECTING TO TELEGRAM ACCOUNT")
    print("="*70)
    print(f"Phone: {PHONE}")
    print(f"Session: {Path(SESSION_FILE).name}")
    print()

    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)

    try:
        # Connect to Telegram
        print("⏳ Connecting to Telegram...")
        await client.connect()

        # Check if authorized
        is_authorized = await client.is_user_authorized()

        if not is_authorized:
            print("⚠️  Account not authorized. Need authentication.")
            print(f"📱 Sending code to {PHONE}...")

            await client.send_code_request(PHONE)

            if auth_code:
                print(f"📝 Using provided code...")
                code = auth_code
            else:
                print("\n⚠️  No code provided!")
                print("Provide code with: python3 get_all_telegram_channels_cli.py --code YOUR_CODE")
                print("\nAlternatively, check your Telegram app for the code.")
                await client.disconnect()
                return None

            try:
                print(f"🔓 Authenticating with code...")
                await client.sign_in(PHONE, code)
                print("✅ Authentication successful!")
            except Exception as auth_error:
                print(f"❌ Authentication failed: {auth_error}")
                print("   Check the code and try again")
                await client.disconnect()
                return None
        else:
            print("✅ Session valid - Already authenticated")

        # Get user info
        me = await client.get_me()
        print(f"✅ Logged in as: {me.first_name} (@{me.username})")

        # Retrieve all dialogs
        print("\n" + "="*70)
        print("📡 RETRIEVING ALL CHANNELS & GROUPS")
        print("="*70 + "\n")

        channels = []
        groups = []
        chats = []
        users = []

        dialog_count = 0

        # Iterate through all dialogs
        async for dialog in client.iter_dialogs():
            dialog_count += 1
            entity = dialog.entity
            dialog_info = {
                "name": dialog.name or "Unknown",
                "id": entity.id,
                "type": None,
                "username": None,
                "participants": 0,
                "unread_count": dialog.unread_count,
                "is_pinned": dialog.pinned
            }

            # Check entity type
            if isinstance(entity, Channel):
                if entity.megagroup:
                    dialog_info["type"] = "Supergroup"
                    groups.append(dialog_info)
                else:
                    dialog_info["type"] = "Channel"
                    dialog_info["username"] = entity.username or "N/A"
                    channels.append(dialog_info)

            elif isinstance(entity, Chat):
                dialog_info["type"] = "Group"
                groups.append(dialog_info)

            elif isinstance(entity, User):
                dialog_info["type"] = "User"
                dialog_info["username"] = entity.username or "N/A"
                users.append(dialog_info)

            # Try to get participants count
            try:
                if isinstance(entity, (Channel, Chat)):
                    full_entity = await client.get_entity(entity.id)
                    if hasattr(full_entity, 'participants_count'):
                        dialog_info["participants"] = full_entity.participants_count
            except:
                pass

        print(f"✅ Retrieved {dialog_count} dialogs\n")
        print(f"📊 TOTAL: {len(channels) + len(groups) + len(users)} items found\n")

        if channels:
            print("="*70)
            print(f"📢 CHANNELS ({len(channels)})")
            print("="*70)
            for i, ch in enumerate(channels, 1):
                print(f"\n[{i}] {ch['name']}")
                print(f"    ID: {ch['id']}")
                print(f"    Username: @{ch['username']}")
                print(f"    Participants: {ch['participants']}")
                if ch['unread_count'] > 0:
                    print(f"    Unread: {ch['unread_count']}")

        if groups:
            print("\n" + "="*70)
            print(f"👥 GROUPS ({len(groups)})")
            print("="*70)
            for i, gr in enumerate(groups, 1):
                print(f"\n[{i}] {gr['name']}")
                print(f"    ID: {gr['id']}")
                print(f"    Type: {gr['type']}")
                print(f"    Participants: {gr['participants']}")
                if gr['unread_count'] > 0:
                    print(f"    Unread: {gr['unread_count']}")

        if users:
            print("\n" + "="*70)
            print(f"👤 DIRECT MESSAGES ({len(users)})")
            print("="*70)
            for i, usr in enumerate(users[:10], 1):
                print(f"\n[{i}] {usr['name']}")
                if usr['username'] != "N/A":
                    print(f"    Username: @{usr['username']}")

            if len(users) > 10:
                print(f"\n... and {len(users) - 10} more")

        # Save to file
        all_dialogs = {
            "timestamp": datetime.now().isoformat(),
            "account": me.username or me.first_name,
            "phone": PHONE,
            "total": len(channels) + len(groups) + len(users),
            "summary": {
                "channels": len(channels),
                "groups": len(groups),
                "direct_messages": len(users)
            },
            "channels": channels,
            "groups": groups,
            "users": users
        }

        output_file = Path(__file__).parent / "data" / "all_telegram_dialogs.json"
        with open(output_file, 'w') as f:
            json.dump(all_dialogs, f, indent=2)

        print("\n" + "="*70)
        print(f"✅ SAVED TO: {output_file}")
        print("="*70)

        # Also update all_channels.json with discovered channels
        trading_channels = [
            {
                "title": ch['name'],
                "username": ch['username'],
                "id": ch['id'],
                "participants_count": ch['participants']
            }
            for ch in channels
        ]

        if trading_channels:
            channels_file = Path(__file__).parent / "data" / "all_channels.json"
            with open(channels_file, 'w') as f:
                json.dump(trading_channels, f, indent=2)
            print(f"✅ Updated: {channels_file}")
            print(f"   Found {len(trading_channels)} channels to monitor")

        await client.disconnect()
        return all_dialogs

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        try:
            await client.disconnect()
        except:
            pass
        return None


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Retrieve all Telegram channels')
    parser.add_argument('--code', help='Authentication code from Telegram')
    parser.add_argument('--skip-auth', action='store_true', help='Skip auth (use existing session)')
    args = parser.parse_args()

    print("\n" + "█"*70)
    print("█" + " "*68 + "█")
    print("█" + "  TELEGRAM ACCOUNT - ALL CHANNELS LISTER".center(68) + "█")
    print("█" + " "*68 + "█")
    print("█"*70)

    result = await get_all_telegram_channels(auth_code=args.code)

    if result:
        print("\n✅ Successfully retrieved all channels!")
        print(f"\n📊 Summary:")
        print(f"   Channels: {result['summary']['channels']}")
        print(f"   Groups: {result['summary']['groups']}")
        print(f"   DMs: {result['summary']['direct_messages']}")
        return 0
    else:
        print("\n❌ Failed to retrieve channels")
        return 1


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
