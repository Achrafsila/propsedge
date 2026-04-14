#!/usr/bin/env python3
"""
Historical Telegram Test Mode

Fetches messages from specified Telegram channels for a target date,
saves them to CSV, and processes through existing pipeline.

Usage: python historical_telegram_test.py --api-id ID --api-hash HASH --phone PHONE --channels "Channel1,Channel2" --target-date 2026-04-09
"""

import asyncio
import argparse
import csv
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Try to import configuration
try:
    from config import DATA_DIR, SESSION_FILE, CREDENTIALS_FILE, SPREADSHEET_ID
except ImportError:
    DATA_DIR = "data"
    SESSION_FILE = "telegram_session.session"
    CREDENTIALS_FILE = "credentials.json"
    SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"

# Try to import Telethon
try:
    from telethon import TelegramClient, types
except ImportError:
    print("ERROR: Telethon not installed. Install with: pip3 install telethon")
    exit(1)

# Import existing components
from batch_processor import SignalProcessor
from google_sheets_uploader import GoogleSheetsUploader

class HistoricalTelegramTest:
    """Historical Telegram message fetcher and processor"""
    
    def __init__(self, api_id: str, api_hash: str, phone: str, channels: list, target_date: str):
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.channels = channels
        self.target_date = target_date
        
        # Parse target date
        try:
            self.target_datetime = datetime.strptime(target_date, '%Y-%m-%d')
            # Set timezone to UTC for consistent comparison
            self.target_datetime = self.target_datetime.replace(tzinfo=timezone.utc)
            # Get start and end of target date (full day)
            self.start_time = self.target_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
            self.end_time = self.start_time + timedelta(days=1)
        except ValueError:
            raise ValueError(f"Invalid date format: {target_date}. Use YYYY-MM-DD")
        
        # Components
        self.client = None
        self.processor = SignalProcessor()
        self.uploader = GoogleSheetsUploader(CREDENTIALS_FILE)
        
        # Output file
        self.output_file = Path(DATA_DIR) / f'telegram_messages_{target_date.replace("-", "")}.csv'
        
        print(f"Target date: {target_date}")
        print(f"Time range: {self.start_time} to {self.end_time}")
        print(f"Output file: {self.output_file}")
    
    async def connect(self):
        """Connect to Telegram"""
        try:
            self.client = TelegramClient('telegram_session.session', self.api_id, self.api_hash)
            print("Connecting to Telegram...")
            await self.client.start(phone=self.phone)
            print("Connected successfully!")
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False
    
    async def get_channel_messages(self, channel_name: str):
        """Fetch messages from a specific channel for target date"""
        print(f"\nFetching messages from: {channel_name}")
        
        try:
            # Get channel entity
            entity = await self.client.get_entity(channel_name)
            
            messages = []
            count = 0
            
            # Iterate through messages
            async for message in self.client.iter_messages(entity, limit=1000):
                # Check if message is within target date range
                if message.date and self.start_time <= message.date < self.end_time:
                    if message.text and message.text.strip():  # Only non-empty text messages
                        messages.append({
                            'message_id': f"HIST_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{message.id}",
                            'timestamp': message.date.isoformat(),
                            'source_channel': channel_name,
                            'raw_message': message.text,
                            'message_type': 'TELEGRAM_HISTORICAL',
                            'processing_status': 'PENDING'
                        })
                        count += 1
                
                # Stop if we've gone past our target date
                if message.date and message.date < self.start_time:
                    break
            
            print(f"  Found {count} messages from {self.target_date}")
            return messages
            
        except Exception as e:
            print(f"  Error fetching from {channel_name}: {e}")
            return []
    
    async def fetch_all_messages(self):
        """Fetch messages from all channels"""
        all_messages = []
        
        for channel in self.channels:
            messages = await self.get_channel_messages(channel)
            all_messages.extend(messages)
        
        print(f"\nTotal messages collected: {len(all_messages)}")
        return all_messages
    
    def save_messages_to_csv(self, messages):
        """Save messages to CSV file"""
        if not messages:
            print("No messages to save")
            return
        
        # Create data directory
        self.output_file.parent.mkdir(exist_ok=True)
        
        with open(self.output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['message_id', 'timestamp', 'source_channel', 'raw_message', 'message_type', 'processing_status']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for message in messages:
                writer.writerow(message)
        
        print(f"Saved {len(messages)} messages to {self.output_file}")
    
    async def process_messages(self):
        """Process messages through existing pipeline"""
        print(f"\nProcessing messages through existing pipeline...")
        
        try:
            # Use existing batch processor with date-specific output files
            date_suffix = self.target_date.replace('-', '')
            
            # Create date-specific output files
            signals_file = Path(DATA_DIR) / f'output_signals_{date_suffix}.csv'
            review_file = Path(DATA_DIR) / f'review_queue_{date_suffix}.csv'
            reject_file = Path(DATA_DIR) / f'reject_log_{date_suffix}.csv'
            
            # Also update standard files for compatibility
            success = self.processor.process_csv(str(self.output_file), DATA_DIR)
            
            if success:
                # Copy output files to date-specific names
                import shutil
                try:
                    shutil.copy2(Path(DATA_DIR) / 'output_signals.csv', signals_file)
                    shutil.copy2(Path(DATA_DIR) / 'review_queue.csv', review_file)
                    shutil.copy2(Path(DATA_DIR) / 'reject_log.csv', reject_file)
                    
                    print("Processing completed successfully!")
                    print(f"Local files in {DATA_DIR}/:")
                    print(f"  - {self.output_file.name}")
                    print(f"  - output_signals.csv (and output_signals_{date_suffix}.csv)")
                    print(f"  - review_queue.csv (and review_queue_{date_suffix}.csv)")
                    print(f"  - reject_log.csv (and reject_log_{date_suffix}.csv)")
                except Exception as e:
                    print(f"Warning: Could not create date-specific files: {e}")
                
                return True
            else:
                print("Processing failed!")
                return False
                
        except Exception as e:
            print(f"Processing error: {e}")
            return False
    
    async def upload_to_sheets(self):
        """Upload results to Google Sheets"""
        print(f"\nUploading results to Google Sheets...")
        
        try:
            if not self.uploader.authenticate():
                print("Authentication failed")
                return False
            
            if not self.uploader.open_spreadsheet(SPREADSHEET_ID):
                print("Could not open spreadsheet")
                return False
            
            success = self.uploader.upload_all_results(DATA_DIR)
            
            if success:
                print("Upload completed successfully!")
                return True
            else:
                print("Upload failed!")
                return False
                
        except Exception as e:
            print(f"Upload error: {e}")
            return False
    
    async def run_test(self):
        """Run the complete historical test"""
        print("Historical Telegram Test Mode")
        print("=" * 50)
        
        # Connect to Telegram
        if not await self.connect():
            return False
        
        try:
            # Step 1: Fetch messages
            messages = await self.fetch_all_messages()
            
            if not messages:
                print("No messages found for the target date")
                return False
            
            # Step 2: Save to CSV
            self.save_messages_to_csv(messages)
            
            # Step 3: Process through pipeline
            processing_success = await self.process_messages()
            
            if not processing_success:
                return False
            
            # Step 4: Upload to Google Sheets
            upload_success = await self.upload_to_sheets()
            
            if upload_success:
                print(f"\n{'='*50}")
                print("HISTORICAL TEST COMPLETED SUCCESSFULLY!")
                print(f"{'='*50}")
                print(f"Messages processed: {len(messages)}")
                print(f"Results uploaded to Google Sheets")
                print(f"Local files in {DATA_DIR}/:")
                print(f"  - {self.output_file.name}")
                print(f"  - output_signals.csv")
                print(f"  - review_queue.csv")
                print(f"  - reject_log.csv")
                return True
            else:
                print("Upload failed!")
                return False
                
        except Exception as e:
            print(f"Test error: {e}")
            return False
        
        finally:
            if self.client:
                await self.client.disconnect()
                print("Disconnected from Telegram")

def get_yesterday_date():
    """Get yesterday's date in YYYY-MM-DD format"""
    yesterday = datetime.now() - timedelta(days=1)
    return yesterday.strftime('%Y-%m-%d')

async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Historical Telegram test mode')
    parser.add_argument('--api-id', required=True, help='Telegram API ID')
    parser.add_argument('--api-hash', required=True, help='Telegram API hash')
    parser.add_argument('--phone', required=True, help='Phone number with country code')
    parser.add_argument('--channels', required=True, help='Channel names (comma-separated)')
    parser.add_argument('--target-date', 
                       default=get_yesterday_date(),
                       help='Target date in YYYY-MM-DD format (default: yesterday)')
    
    args = parser.parse_args()
    
    # Validate configuration
    if SPREADSHEET_ID == "YOUR_SPREADSHEET_ID_HERE":
        print("ERROR: Please configure SPREADSHEET_ID in config.py")
        return
    
    # Parse channels
    channels = [ch.strip() for ch in args.channels.split(',')]
    
    # Create and run test
    test = HistoricalTelegramTest(args.api_id, args.api_hash, args.phone, channels, args.target_date)
    
    success = await test.run_test()
    
    if success:
        print("\nTest completed successfully!")
    else:
        print("\nTest failed. Check error messages above.")

if __name__ == '__main__':
    asyncio.run(main())
