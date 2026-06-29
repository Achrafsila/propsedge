#!/usr/bin/env python3
"""
List ALL Telegram channels from account achrafsila
Uses Telethon to connect to your Telegram account and retrieve all channels
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

# Configuration from src/config.py
API_ID = "38456630"
API_HASH = "4b2a85354b6e6d4103820dc92b522b53"
PHONE = "+212688434773"
SESSION_FILE = str(Path(__file__).parent / "sessions" / "telegram_session.session")


async def get_all_telegram_channels():
    """Retrieve ALL channels from Telegram account"""
    try:
        from telethon import TelegramClient
        from telethon.tl.types import Channel, Chat, User, ChatPhoto, ChannelFull
    except ImportError:
        print("❌ Telethon not installed. Install with: pip install telethon")
        return None

    print("\n" + "="*70)
    print("🔐 CONNECTING TO TELEGRAM ACCOUNT")
    print("="*70)
    print(f"Phone: {PHONE}")
    print(f"Session File: {SESSION_FILE}")
    print()

    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)

    try:
        # Connect to Telegram
        print("⏳ Connecting...")
        await client.connect()

        # Check if authorized
        if not await client.is_user_authorized():
            print("\n⚠️  Account not authorized. Starting authentication...")
            await client.send_code_request(PHONE)
            code = input("📱 Enter the code you received (or press Enter to skip): ").strip()

            if not code:
                print("❌ Authentication skipped")
                await client.disconnect()
                return None

            try:
                await client.sign_in(PHONE, code)
                print("✅ Authentication successful!")
            except Exception as auth_error:
                print(f"❌ Authentication failed: {auth_error}")
                await client.disconnect()
                return None

        print("✅ Connected to Telegram")

        # Get user info
        me = await client.get_me()
        print(f"✅ Logged in as: {me.first_name} (@{me.username})")

        # Retrieve all dialogs (channels, groups, chats)
        print("\n" + "="*70)
        print("📡 RETRIEVING ALL CHANNELS & GROUPS")
        print("="*70 + "\n")

        channels = []
        groups = []
        chats = []
        users = []

        # Iterate through all dialogs
        async for dialog in client.iter_dialogs():
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

            # Try to get participants count for channels/groups
            try:
                if isinstance(entity, (Channel, Chat)):
                    full_entity = await client.get_entity(entity.id)
                    if hasattr(full_entity, 'participants_count'):
                        dialog_info["participants"] = full_entity.participants_count
            except:
                pass

        # Display results
        print(f"📊 TOTAL: {len(channels) + len(groups) + len(users)} dialogs found\n")

        if channels:
            print("="*70)
            print(f"📢 CHANNELS ({len(channels)})")
            print("="*70)
            for i, ch in enumerate(channels, 1):
                print(f"\n[{i}] {ch['name']}")
                print(f"    ID: {ch['id']}")
                print(f"    Username: @{ch['username']}")
                print(f"    Participants: {ch['participants']}")
                print(f"    Unread: {ch['unread_count']}")
                if ch['is_pinned']:
                    print(f"    📌 Pinned")

        if groups:
            print("\n" + "="*70)
            print(f"👥 GROUPS ({len(groups)})")
            print("="*70)
            for i, gr in enumerate(groups, 1):
                print(f"\n[{i}] {gr['name']}")
                print(f"    ID: {gr['id']}")
                print(f"    Type: {gr['type']}")
                print(f"    Participants: {gr['participants']}")
                print(f"    Unread: {gr['unread_count']}")
                if gr['is_pinned']:
                    print(f"    📌 Pinned")

        if users:
            print("\n" + "="*70)
            print(f"👤 DIRECT MESSAGES ({len(users)})")
            print("="*70)
            for i, usr in enumerate(users[:10], 1):  # Show first 10
                print(f"\n[{i}] {usr['name']}")
                print(f"    ID: {usr['id']}")
                print(f"    Username: @{usr['username']}")
                print(f"    Unread: {usr['unread_count']}")

            if len(users) > 10:
                print(f"\n... and {len(users) - 10} more")

        # Save to file
        all_dialogs = {
            "timestamp": datetime.now().isoformat(),
            "account": me.username,
            "total": len(channels) + len(groups) + len(users),
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

        await client.disconnect()
        return all_dialogs

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        await client.disconnect()
        return None


async def main():
    """Main entry point"""
    print("\n" + "█"*70)
    print("█" + " "*68 + "█")
    print("█" + "  TELEGRAM ACCOUNT - ALL CHANNELS LISTER".center(68) + "█")
    print("█" + " "*68 + "█")
    print("█"*70)

    result = await get_all_telegram_channels()

    if result:
        print("\n✅ Successfully retrieved all channels!")
        print(f"\n📊 Summary:")
        print(f"   Channels: {len(result['channels'])}")
        print(f"   Groups: {len(result['groups'])}")
        print(f"   DMs: {len(result['users'])}")
    else:
        print("\n❌ Failed to retrieve channels")
        return 1

    return 0


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
