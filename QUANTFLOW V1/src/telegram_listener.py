#!/usr/bin/env python3
"""
Telegram Message Listener for Trading Signals

Uses Telethon to:
1. Connect to Telegram account
2. Listen to specific channels
3. Extract messages
4. Send to existing batch processing pipeline

Usage: python telegram_listener.py [--channels channel1,channel2]
"""

import asyncio
import csv
import argparse
from datetime import datetime
from pathlib import Path
from typing import List, Set

try:
    from telethon import TelegramClient, events
    from telethon.tl.types import Message
except ImportError:
    print("Error: Telethon not installed. Install with: pip3 install telethon")
    exit(1)

# Import existing pipeline
from batch_processor import SignalProcessor
from config import DATA_DIR

class TelegramListener:
    """Telegram message listener and processor"""
    
    def __init__(self, api_id: int, api_hash: str, phone: str):
        """
        Initialize Telegram client
        
        Args:
            api_id: Telegram API ID
            api_hash: Telegram API hash
            phone: Your phone number with country code
        """
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.client = None
        self.monitored_channels: Set[str] = set()
        self.processor = SignalProcessor()
        self.session_file = "telegram_session.session"
        
    async def connect(self) -> bool:
        """Connect to Telegram"""
        try:
            self.client = TelegramClient(
                self.session_file,
                self.api_id,
                self.api_hash
            )
            
            print("Connecting to Telegram...")
            await self.client.start(phone=self.phone)
            print("✅ Connected to Telegram successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Failed to connect to Telegram: {e}")
            return False
    
    def setup_message_handlers(self):
        """Setup event handlers for new messages"""
        
        @self.client.on(events.NewMessage(chats=list(self.monitored_channels)))
        async def handle_new_message(event):
            await self.process_message(event.message)
    
    async def process_message(self, message: Message):
        """Process a single Telegram message"""
        try:
            # Extract message data
            message_data = {
                'message_id': f"TG_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{message.id}",
                'timestamp': datetime.now().isoformat(),
                'source_channel': getattr(message.chat, 'title', 'Unknown'),
                'raw_message': message.text or '',
                'message_type': 'TELEGRAM',
                'processing_status': 'PENDING'
            }
            
            # Skip empty messages
            if not message_data['raw_message'].strip():
                return
            
            print(f"📨 New message from {message_data['source_channel']}: {message_data['raw_message'][:100]}...")
            
            # Process through existing pipeline
            result = self.processor.process_row(message_data)
            
            # Save to input CSV for batch processing
            await self.save_to_input_csv(message_data)
            
            # Process immediately if needed
            if result['decision'] in ['ACCEPT', 'REVIEW']:
                print(f"🎯 Signal detected: {result['decision']} - {result['reason']}")
            
        except Exception as e:
            print(f"❌ Error processing message: {e}")
    
    async def save_to_input_csv(self, message_data: dict):
        """Save message to input CSV for batch processing"""
        input_file = Path(DATA_DIR) / 'telegram_messages.csv'
        
        # Create file with headers if it doesn't exist
        file_exists = input_file.exists()
        
        with open(input_file, 'a', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['message_id', 'timestamp', 'source_channel', 'raw_message', 'message_type', 'processing_status']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            if not file_exists:
                writer.writeheader()
            
            writer.writerow(message_data)
    
    async def start_listening(self, channels: List[str]):
        """Start listening to specified channels"""
        self.monitored_channels = set(channels)
        self.setup_message_handlers()
        
        print(f"📡 Monitoring {len(self.monitored_channels)} channels:")
        for channel in self.monitored_channels:
            print(f"  - {channel}")
        
        print("\n🎧 Listening for messages... (Press Ctrl+C to stop)")
        
        # Keep the client running
        await self.client.run_until_disconnected()
    
    async def get_channel_list(self) -> List[str]:
        """Get list of all channels/dialogs"""
        print("📋 Getting your channel list...")
        
        async for dialog in self.client.iter_dialogs():
            if dialog.is_channel:
                print(f"  - {dialog.name} (ID: {dialog.id})")
        
        print("\nUse these channel names or IDs with --channels parameter")
        return []

async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Telegram message listener for trading signals')
    parser.add_argument('--api-id', required=True, help='Telegram API ID')
    parser.add_argument('--api-hash', required=True, help='Telegram API hash')
    parser.add_argument('--phone', required=True, help='Your phone number with country code')
    parser.add_argument('--channels', help='Comma-separated list of channel names/IDs to monitor')
    parser.add_argument('--list-channels', action='store_true', help='List all available channels')
    
    args = parser.parse_args()
    
    # Create listener
    listener = TelegramListener(args.api_id, args.api_hash, args.phone)
    
    # Connect to Telegram
    if not await listener.connect():
        return
    
    try:
        if args.list_channels:
            await listener.get_channel_list()
        elif args.channels:
            channels = [ch.strip() for ch in args.channels.split(',')]
            await listener.start_listening(channels)
        else:
            print("Please specify channels to monitor with --channels or use --list-channels to see available channels")
            print("Example: python telegram_listener.py --channels 'Trading Signals','Gold Analysis'")
    
    except KeyboardInterrupt:
        print("\n👋 Stopping listener...")
    
    finally:
        if listener.client:
            await listener.client.disconnect()
            print("✅ Disconnected from Telegram")

if __name__ == '__main__':
    asyncio.run(main())
