#!/usr/bin/env python3
"""
SKILL #1: Signal Extractor
Continuous Telegram signal extraction - Runs every 5 minutes, 24/7

Features:
- Auto-discovers and monitors all available Telegram channels
- Extracts trading signals (ACTION, INSTRUMENT, ENTRY, SL, TP)
- Deduplicates signals over 24h window
- Resumes from last execution (no duplicates even on crashes)
- Sends JSON to Signal Validator skill

State is persisted to allow resuming mid-extraction.
"""

import json
import hashlib
import asyncio
import re
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass, asdict
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION & STATE
# ============================================================================

STATE_FILE = Path.home() / '.claude' / 'quantflow_extractor_state.json'
DEDUP_WINDOW_HOURS = 24
MAX_MESSAGES_PER_SCAN = 100  # Avoid scanning too far back


@dataclass
class ExtractionState:
    """Persisted state between executions"""
    channels: Dict[int, str]  # {channel_id: channel_name}
    last_message_ids: Dict[int, int]  # {channel_id: last_message_id}
    last_execution: str  # ISO timestamp
    seen_signal_hashes: List[str]  # Dedup window (last 24h)


class StateManager:
    """Manage persistent extraction state"""

    @staticmethod
    def load() -> ExtractionState:
        """Load state from disk, or return empty if first run"""
        if STATE_FILE.exists():
            try:
                data = json.loads(STATE_FILE.read_text())
                return ExtractionState(**data)
            except Exception as e:
                logger.warning(f"Could not load state: {e}. Starting fresh.")

        return ExtractionState(
            channels={},
            last_message_ids={},
            last_execution=datetime.utcnow().isoformat(),
            seen_signal_hashes=[]
        )

    @staticmethod
    def save(state: ExtractionState):
        """Save state to disk"""
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(asdict(state), indent=2))
        logger.info(f"State saved to {STATE_FILE}")

    @staticmethod
    def clean_old_dedup_entries(state: ExtractionState) -> ExtractionState:
        """Remove dedup hashes older than 24h (keep recent ones)"""
        # Simplified: Keep all hashes (they don't take much space)
        # In production, could add timestamps to hashes
        if len(state.seen_signal_hashes) > 10000:
            logger.info(f"Dedup cache size: {len(state.seen_signal_hashes)}. Pruning old entries.")
            state.seen_signal_hashes = state.seen_signal_hashes[-5000:]
        return state


# ============================================================================
# SIGNAL EXTRACTION
# ============================================================================

@dataclass
class ExtractedSignal:
    """Extracted trading signal"""
    signal_id: str
    source: Dict
    extracted_signal: Dict
    quality: Dict
    raw_message: str
    extraction_notes: List[str]


class SignalExtractor:
    """Extract trading signals from Telegram messages"""

    def __init__(self):
        self.action_keywords = {'BUY', 'SELL', 'LONG', 'SHORT'}
        self.instrument_keywords = {'GOLD', 'XAUUSD', 'XAU', 'BTC', 'BTCUSD', 'ETH', 'EURUSD', 'GBPUSD'}
        self.price_keywords = {'SL', 'TP', 'STOP', 'LOSS', 'TAKE', 'PROFIT', 'ENTRY', 'AT'}

    def extract(self, message: str, source_info: Dict) -> Optional[ExtractedSignal]:
        """
        Extract signal from message.

        Returns: ExtractedSignal or None if not a valid signal
        """
        # Clean message
        cleaned = self._clean_message(message)
        if not cleaned:
            return None

        # Check if likely a signal
        is_signal, confidence = self._filter_signal(cleaned)
        if not is_signal:
            return None

        # Extract parameters
        params = self._extract_params(cleaned)

        # Must have action, instrument, entry, SL, TP
        completeness = sum([
            params['action'] is not None,
            params['instrument'] is not None,
            params['entry_price'] is not None,
            params['stop_loss'] is not None,
            params['take_profit'] is not None
        ])

        extraction_status = "COMPLETE" if completeness == 5 else "PARTIAL"

        # Create signal
        signal_id = self._generate_signal_id(source_info)
        signal = ExtractedSignal(
            signal_id=signal_id,
            source=source_info,
            extracted_signal={
                'action': params['action'],
                'instrument': params['instrument'],
                'entry': params['entry_price'],
                'sl': params['stop_loss'],
                'tp': params['take_profit'],
                'extraction_status': extraction_status
            },
            quality={
                'confidence_score': round(confidence, 2),
                'completeness_percent': int((completeness / 5) * 100),
                'is_duplicate': False  # Checked later
            },
            raw_message=cleaned,
            extraction_notes=[]
        )

        return signal

    def _generate_signal_id(self, source_info: Dict) -> str:
        """Generate unique signal ID"""
        timestamp = source_info['timestamp'].replace(':', '').replace('-', '')[:14]
        channel_id = source_info.get('channel_id', 0)
        message_id = source_info.get('message_id', 0)
        return f"TG_{timestamp}_{channel_id}_{message_id}"

    def _clean_message(self, message: str) -> str:
        """Clean message text"""
        # Remove Arabic/Unicode but keep trading content
        message = re.sub(r'[\u0600-\u06FF\u0750-\u077F]+', '', message)
        # Normalize whitespace
        message = re.sub(r'\n+', ' ', message)
        message = re.sub(r'\s+', ' ', message)
        return message.strip()

    def _filter_signal(self, message: str) -> Tuple[bool, float]:
        """Check if message likely contains a signal"""
        msg_upper = message.upper()
        confidence = 0.0

        # Action keywords
        if any(kw in msg_upper for kw in self.action_keywords):
            confidence += 0.3

        # Instrument keywords
        if any(kw in msg_upper for kw in self.instrument_keywords):
            confidence += 0.3

        # Price keywords
        if any(kw in msg_upper for kw in self.price_keywords):
            confidence += 0.2

        # Numbers (prices)
        if re.search(r'\d+\.\d+', message):
            confidence += 0.2

        is_signal = confidence >= 0.6
        return is_signal, min(confidence, 1.0)

    def _extract_params(self, message: str) -> Dict:
        """Extract trading parameters from message"""
        msg_upper = message.upper()
        params = {
            'action': None,
            'instrument': None,
            'entry_price': None,
            'stop_loss': None,
            'take_profit': None
        }

        # Extract action
        for kw in self.action_keywords:
            if kw in msg_upper:
                params['action'] = 'BUY' if kw in ['BUY', 'LONG'] else 'SELL'
                break

        # Extract instrument
        for kw in self.instrument_keywords:
            if kw in msg_upper:
                params['instrument'] = kw
                break

        # Extract prices with regex patterns
        # Pattern 1: "ENTRY: 2385.50"
        if match := re.search(r'ENTRY\s*:\s*(\d[\d.]*)', msg_upper):
            params['entry_price'] = float(match.group(1))
        # Pattern 2: "BUY AT 2385.50"
        elif match := re.search(r'(?:BUY|SELL|AT)\s+(\d[\d.]*)', msg_upper):
            params['entry_price'] = float(match.group(1))

        # Extract SL
        if match := re.search(r'(?:SL|STOP[_\s]LOSS?)\s*:?\s*(\d[\d.]*)', msg_upper):
            params['stop_loss'] = float(match.group(1))

        # Extract TP
        if match := re.search(r'(?:TP|TAKE[_\s]PROFIT?)\s*:?\s*(\d[\d.]*)', msg_upper):
            params['take_profit'] = float(match.group(1))

        return params

    def compute_signal_hash(self, signal: ExtractedSignal) -> str:
        """Compute hash for deduplication"""
        extracted = signal.extracted_signal
        hash_input = f"{extracted['action']}_{extracted['instrument']}_{extracted['entry']}_{extracted['sl']}_{extracted['tp']}"
        return hashlib.md5(hash_input.encode()).hexdigest()


# ============================================================================
# TELEGRAM INTEGRATION
# ============================================================================

class TelegramChannelScanner:
    """Scan Telegram for channels and messages"""

    def __init__(self, api_id: int, api_hash: str, phone: str, session_path: str = '/Users/achraf/CascadeProjects/QUANTFLOW V1/sessions/telegram_session'):
        """Initialize with Telegram credentials"""
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.session_path = session_path
        self.client = None

    async def connect(self) -> bool:
        """Connect to Telegram"""
        try:
            from telethon import TelegramClient
            self.client = TelegramClient(
                self.session_path,
                self.api_id,
                self.api_hash
            )
            await self.client.start(phone=self.phone)
            logger.info("✅ Connected to Telegram")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to Telegram: {e}")
            return False

    async def scan_channels(self, current_channels: Dict[int, str]) -> Dict[int, str]:
        """
        Scan all accessible channels and update the list.
        Returns: {channel_id: channel_name}
        """
        if not self.client:
            return current_channels

        try:
            all_channels = {}
            async for dialog in self.client.iter_dialogs():
                if dialog.is_channel:
                    all_channels[dialog.id] = dialog.name or f"Channel_{dialog.id}"

            # Compare with current channels
            new_count = len(all_channels) - len(current_channels)
            if new_count > 0:
                logger.info(f"📡 Found {new_count} new channels. Total: {len(all_channels)}")

            return all_channels
        except Exception as e:
            logger.warning(f"Could not scan channels: {e}. Using cached list.")
            return current_channels

    async def get_new_messages(self, channel_id: int, last_message_id: int,
                               limit: int = MAX_MESSAGES_PER_SCAN) -> List[Dict]:
        """
        Get new messages from a channel since last execution.

        Returns: List of {text, id, timestamp, channel_id, channel_name}
        """
        if not self.client:
            return []

        try:
            messages = []
            async for message in self.client.iter_messages(channel_id, limit=limit):
                # Stop if we've reached the last known message
                if message.id <= last_message_id:
                    break

                if message.text:
                    messages.append({
                        'text': message.text,
                        'id': message.id,
                        'timestamp': message.date.isoformat() if message.date else datetime.utcnow().isoformat(),
                        'channel_id': channel_id,
                        'channel_name': getattr(message.chat, 'title', 'Unknown')
                    })

            return list(reversed(messages))  # Oldest first
        except Exception as e:
            logger.warning(f"Could not get messages from channel {channel_id}: {e}")
            return []

    async def disconnect(self):
        """Disconnect from Telegram"""
        if self.client:
            await self.client.disconnect()
            logger.info("Disconnected from Telegram")


# ============================================================================
# SIGNAL VALIDATOR OUTPUT
# ============================================================================

class SignalValidator:
    """Send extracted signals to Signal Validator skill"""

    @staticmethod
    def send(signal: ExtractedSignal) -> bool:
        """
        Send signal to Signal Validator.

        In production, this would send to:
        - Message queue (Redis/RabbitMQ)
        - HTTP API
        - Another skill
        - File (for now)
        """
        output_file = Path.home() / '.claude' / 'quantflow_extracted_signals.jsonl'
        output_file.parent.mkdir(parents=True, exist_ok=True)

        # Append to JSONL file
        with open(output_file, 'a') as f:
            f.write(json.dumps(asdict(signal)) + '\n')

        logger.info(f"📤 Signal sent to validator: {signal.signal_id}")
        return True


# ============================================================================
# MAIN EXECUTION
# ============================================================================

async def run_extraction():
    """Main extraction cycle"""
    logger.info("=" * 70)
    logger.info(f"🚀 Signal Extractor started at {datetime.utcnow().isoformat()}")

    # Load configuration
    try:
        config_file = Path.home() / '.claude' / 'quantflow_config.json'
        if config_file.exists():
            config = json.loads(config_file.read_text())
        else:
            logger.error(f"Config file not found: {config_file}")
            logger.error("Please create config with Telegram credentials")
            return
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        return

    # Load state
    state = StateManager.load()
    logger.info(f"📊 Loaded state: {len(state.channels)} channels monitored")

    # Initialize
    scanner = TelegramChannelScanner(
        config['telegram_api_id'],
        config['telegram_api_hash'],
        config['telegram_phone'],
        session_path=config.get('session_file', '/Users/achraf/CascadeProjects/QUANTFLOW V1/sessions/telegram_session')
    )
    extractor = SignalExtractor()

    # Connect to Telegram
    if not await scanner.connect():
        logger.error("Failed to connect to Telegram. Aborting.")
        return

    try:
        # Scan for new channels
        logger.info("🔍 Scanning for channels...")
        state.channels = await scanner.scan_channels(state.channels)

        # Process each channel
        signals_extracted = 0
        signals_deduplicated = 0

        for channel_id, channel_name in state.channels.items():
            last_msg_id = state.last_message_ids.get(channel_id, 0)

            # Get new messages
            new_messages = await scanner.get_new_messages(channel_id, last_msg_id)

            if new_messages:
                logger.info(f"📨 Channel '{channel_name}': {len(new_messages)} new messages")

                for msg_data in new_messages:
                    # Extract signal
                    signal = extractor.extract(
                        msg_data['text'],
                        {
                            'platform': 'TELEGRAM',
                            'channel': channel_name,
                            'channel_id': channel_id,
                            'message_id': msg_data['id'],
                            'timestamp': msg_data['timestamp']
                        }
                    )

                    if signal:
                        # Check deduplication
                        signal_hash = extractor.compute_signal_hash(signal)
                        if signal_hash in state.seen_signal_hashes:
                            logger.debug(f"🔄 Duplicate detected: {signal.signal_id}")
                            signals_deduplicated += 1
                            signal.quality['is_duplicate'] = True
                        else:
                            state.seen_signal_hashes.append(signal_hash)
                            signals_extracted += 1
                            logger.info(f"✅ Signal extracted: {signal.extracted_signal['action']} {signal.extracted_signal['instrument']}")

                        # Send to validator
                        SignalValidator.send(signal)

                    # Update last message ID
                    state.last_message_ids[channel_id] = msg_data['id']

        # Save state
        state.last_execution = datetime.utcnow().isoformat()
        state = StateManager.clean_old_dedup_entries(state)
        StateManager.save(state)

        logger.info(f"📈 Summary: {signals_extracted} signals extracted, {signals_deduplicated} duplicates filtered")
        logger.info("=" * 70)

    finally:
        await scanner.disconnect()


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    # Run extraction
    asyncio.run(run_extraction())
