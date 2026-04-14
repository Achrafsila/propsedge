#!/usr/bin/env python3
"""
Improved Telegram Pipeline with Batching

Features:
- Message buffering (store temporarily)
- Batch processing (every 5 messages OR 30 seconds)
- Duplicate protection (using message.id)
- Efficient Google Sheets uploads

Usage: python improved_telegram_pipeline.py --api-id ID --api-hash HASH --phone PHONE
"""

import asyncio
import argparse
import csv
import time
from datetime import datetime
from pathlib import Path
from collections import deque

# Try to import Telethon
try:
    from telethon import TelegramClient, events
except ImportError:
    print("❌ Telethon not installed. Install with: pip3 install telethon")
    exit(1)

# Import existing components
from batch_processor import SignalProcessor
from google_sheets_uploader import GoogleSheetsUploader
from config import SPREADSHEET_ID, CREDENTIALS_FILE, DATA_DIR

class ImprovedTelegramPipeline:
    """Improved Telegram pipeline with batching"""
    
    def __init__(self, api_id: str, api_hash: str, phone: str, channels: list):
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.channels = channels
        
        # Message buffering
        self.message_buffer = deque(maxlen=100)  # Store up to 100 messages
        self.processed_message_ids = set()  # Track processed message IDs
        self.last_batch_time = time.time()
        
        # Components
        self.client = None
        self.processor = SignalProcessor()
        self.uploader = GoogleSheetsUploader(CREDENTIALS_FILE)
        
        # Configuration
        self.batch_size = 5  # Process every 5 messages
        self.batch_interval = 30  # Or every 30 seconds
        
        # File paths
        self.telegram_file = Path(DATA_DIR) / 'telegram_messages.csv'
        self.processed_file = Path(DATA_DIR) / 'processed_message_ids.txt'
        
        # Load previously processed message IDs
        self.load_processed_ids()
        self.process_count = 0
    
    def load_processed_ids(self):
        """Load previously processed message IDs to prevent duplicates"""
        try:
            if self.processed_file.exists():
                with open(self.processed_file, 'r') as f:
                    for line in f:
                        self.processed_message_ids.add(line.strip())
                print(f"📋 Loaded {len(self.processed_message_ids)} processed message IDs")
        except Exception as e:
            print(f"⚠️ Could not load processed IDs: {e}")
    
    def save_processed_id(self, message_id: str):
        """Save a processed message ID"""
        try:
            with open(self.processed_file, 'a') as f:
                f.write(f"{message_id}\n")
            self.processed_message_ids.add(message_id)
        except Exception as e:
            print(f"⚠️ Could not save processed ID: {e}")
    
    def is_duplicate(self, message_id: str) -> bool:
        """Check if message ID has been processed"""
        return message_id in self.processed_message_ids
    
    async def connect(self):
        """Connect to Telegram"""
        try:
            self.client = TelegramClient('telegram_session.session', self.api_id, self.api_hash)
            print("🔐 Connecting to Telegram...")
            await self.client.start(phone=self.phone)
            print("✅ Connected successfully!")
            return True
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    async def handle_message(self, event):
        """Handle incoming message with buffering"""
        try:
            message = event.message
            
            # Skip empty messages
            if not message.text:
                return
            
            # Check if from monitored channel
            channel_name = getattr(message.chat, 'title', '')
            if not any(monitored_channel.lower() in channel_name.lower() for monitored_channel in self.channels):
                return
            
            # Create unique message ID
            unique_id = str(message.id)
            
            # Skip duplicates
            if self.is_duplicate(unique_id):
                return
            
            # Create message record
            record = {
                'message_id': f"TG_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{unique_id}",
                'timestamp': datetime.now().isoformat(),
                'source_channel': channel_name,
                'raw_message': message.text,
                'message_type': 'TELEGRAM',
                'processing_status': 'PENDING',
                'telegram_id': unique_id  # Store for later processing
            }
            
            # Add to buffer
            self.message_buffer.append(record)
            
            print(f"📨 {channel_name}: {message.text[:60]}... (Buffer: {len(self.message_buffer)})")
            
            # Check if we should process batch
            await self.check_batch_processing()
            
        except Exception as e:
            print(f"❌ Error handling message: {e}")
    
    async def check_batch_processing(self):
        """Check if batch processing should run"""
        current_time = time.time()
        buffer_size = len(self.message_buffer)
        
        # Process if buffer is full OR time interval passed
        if buffer_size >= self.batch_size or (current_time - self.last_batch_time) >= self.batch_interval:
            if buffer_size > 0:
                await self.process_batch()
    
    async def process_batch(self):
        """Process buffered messages"""
        if not self.message_buffer:
            return
        
        print(f"=== BATCH {self.process_count + 1} ===")
        print(f"Processing {len(self.message_buffer)} messages...")
        
        # Create a copy of messages to process
        messages_to_process = list(self.message_buffer)
        
        # Save buffered messages to CSV
        await self.save_buffer_to_csv(messages_to_process)
        
        # Run batch processor
        processing_success = await self.run_batch_processing()
        
        if not processing_success:
            print("Batch processing failed - keeping messages in buffer")
            return False
        
        print("Batch processing complete")
        
        # Upload to Google Sheets with retry
        upload_success = await self.upload_to_sheets_with_retry()
        
        if not upload_success:
            print("Google Sheets upload failed - keeping messages in buffer")
            return False
        
        # SUCCESS: Mark messages as processed and clear buffer
        print("SUCCESS: Batch processing and upload complete!")
        
        # Mark messages as processed
        for record in messages_to_process:
            self.save_processed_id(record['telegram_id'])
        
        # Clear buffer and update time
        self.message_buffer.clear()
        self.last_batch_time = time.time()
        self.process_count += 1
        
        # Clear CSV file for next batch
        await self.clear_csv_file()
        
        print(f"Batch {self.process_count} completed successfully!")
        return True
    
    async def save_buffer_to_csv(self, messages_to_process):
        """Save buffered messages to CSV"""
        if not messages_to_process:
            return
        
        # Create data directory
        self.telegram_file.parent.mkdir(exist_ok=True)
        
        # Check if file exists for headers
        file_exists = self.telegram_file.exists()
        
        with open(self.telegram_file, 'a', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['message_id', 'timestamp', 'source_channel', 'raw_message', 'message_type', 'processing_status']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            if not file_exists:
                writer.writeheader()
            
            # Write messages (exclude telegram_id from CSV)
            for record in messages_to_process:
                csv_record = {k: v for k, v in record.items() if k != 'telegram_id'}
                writer.writerow(csv_record)
    
    async def upload_to_sheets(self):
        """Upload processed results to Google Sheets"""
        try:
            if self.uploader.authenticate():
                if self.uploader.open_spreadsheet(SPREADSHEET_ID):
                    success = self.uploader.upload_all_results(DATA_DIR)
                    if success:
                        print("✅ Uploaded to Google Sheets")
                    else:
                        print("⚠️ Google Sheets upload failed")
        except Exception as e:
            print(f"❌ Upload error: {e}")
    
    async def upload_to_sheets_with_retry(self):
        """Upload to Google Sheets with 3 retry attempts"""
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                print(f"Google Sheets upload attempt {attempt + 1}/{max_retries}...")
                
                if self.uploader.authenticate():
                    if self.uploader.open_spreadsheet(SPREADSHEET_ID):
                        success = self.uploader.upload_all_results(DATA_DIR)
                        if success:
                            print("Google Sheets upload successful!")
                            return True
                        else:
                            print(f"Upload failed on attempt {attempt + 1}")
                    else:
                        print(f"Could not open spreadsheet on attempt {attempt + 1}")
                else:
                    print(f"Authentication failed on attempt {attempt + 1}")
                
                if attempt < max_retries - 1:
                    print(f"Retrying in 2 seconds...")
                    await asyncio.sleep(2)
                
            except Exception as e:
                print(f"Upload error on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    print(f"Retrying in 2 seconds...")
                    await asyncio.sleep(2)
        
        print("All upload attempts failed")
        return False
    
    async def run_batch_processing(self):
        """Run the batch processor and return success status"""
        try:
            import subprocess
            result = subprocess.run([
                'python3', 'batch_processor.py',
                '--input-file', str(self.telegram_file),
                '--output-dir', DATA_DIR
            ], capture_output=True, text=True, cwd=Path(__file__).parent)
            
            return result.returncode == 0
        except Exception as e:
            print(f"Batch processing error: {e}")
            return False
    
    async def clear_csv_file(self):
        """Clear the telegram_messages.csv file for next batch"""
        try:
            if self.telegram_file.exists():
                self.telegram_file.unlink()
                print("Cleared CSV file for next batch")
        except Exception as e:
            print(f"Warning: Could not clear CSV file: {e}")
    
    async def start_monitoring(self):
        """Start monitoring channels"""
        print(f"📡 Monitoring {len(self.channels)} channels:")
        for channel in self.channels:
            print(f"  - {channel}")
        
        print(f"\n⚙️ Batch settings:")
        print(f"  - Process every {self.batch_size} messages")
        print(f"  - Or every {self.batch_interval} seconds")
        print(f"  - Buffer size: {len(self.message_buffer)}")
        
        print("\n🎧 Improved pipeline active...")
        print("⏹️ Press Ctrl+C to stop")
        
        # Setup message handler
        @self.client.on(events.NewMessage)
        async def handle_new_message(event):
            await self.handle_message(event)
        
        # Keep running
        await self.client.run_until_disconnected()
    
    async def run(self):
        """Run the complete improved pipeline"""
        print("🚀 Improved Telegram Pipeline")
        print("="*50)
        
        if not await self.connect():
            return
        
        try:
            await self.start_monitoring()
        except KeyboardInterrupt:
            print("\n👋 Stopping pipeline...")
            
            # Process remaining messages in buffer
            if self.message_buffer:
                print(f"🔄 Processing remaining {len(self.message_buffer)} messages...")
                await self.process_batch()
        
        finally:
            if self.client:
                await self.client.disconnect()
                print("✅ Disconnected from Telegram")

async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Improved Telegram pipeline with batching')
    parser.add_argument('--api-id', required=True, help='Telegram API ID')
    parser.add_argument('--api-hash', required=True, help='Telegram API hash')
    parser.add_argument('--phone', required=True, help='Phone number with country code')
    parser.add_argument('--channels',
                       default='Trading Signals,Gold Analysis',
                       help='Channel names to monitor (comma-separated)')
    parser.add_argument('--batch-size',
                       type=int,
                       default=5,
                       help='Process every N messages (default: 5)')
    parser.add_argument('--batch-interval',
                       type=int,
                       default=30,
                       help='Process every N seconds (default: 30)')
    
    args = parser.parse_args()
    
    # Validate configuration
    if SPREADSHEET_ID == "YOUR_SPREADSHEET_ID_HERE":
        print("❌ Please configure SPREADSHEET_ID in config.py")
        return
    
    # Parse channels
    channels = [ch.strip() for ch in args.channels.split(',')]
    
    # Create and run pipeline
    pipeline = ImprovedTelegramPipeline(args.api_id, args.api_hash, args.phone, channels)
    pipeline.batch_size = args.batch_size
    pipeline.batch_interval = args.batch_interval
    
    await pipeline.run()

if __name__ == '__main__':
    asyncio.run(main())
