---
name: Signal Extractor
description: Continuous Telegram signal extraction running every 5 minutes, 24/7. Auto-discovers all accessible channels, extracts trading signals (ACTION, INSTRUMENT, ENTRY, SL, TP), automatically deduplicates over 24h window, and resumes from last execution point if interrupted. Use this skill when you need to monitor Telegram channels for trading signals continuously without gaps or duplicates.
version: 1.0
type: scheduled-task
schedule: "*/5 * * * *"
runtime: python
compatibility: "telethon"
---

# Signal Extractor - Continuous Telegram Signal Collection

## Overview

This skill **runs every 5 minutes, 24/7** to extract trading signals from Telegram channels.

**Key features:**
- ✅ **Auto-discovery**: Automatically finds and monitors all your Telegram channels
- ✅ **Deduplication**: Filters duplicate signals over 24h window
- ✅ **Resumable**: Tracks last message per channel — resumes exactly where it left off
- ✅ **Zero data loss**: Even if skill crashes, next execution continues from the same point
- ✅ **Production-ready**: Handles reconnections, async operations, and edge cases

## How It Works

Each 5-minute execution:

```
1. Load State (channels monitored, last message IDs, dedup cache)
   ↓
2. Scan ALL channels for NEW messages (only since last execution)
   ↓
3. Extract signals:
   - Parse action (BUY/SELL)
   - Identify instrument (GOLD, BTC, EURUSD, etc.)
   - Extract entry price, SL, TP
   ↓
4. Deduplicate:
   - Compute signal hash (action + instrument + entry + SL + TP)
   - Check if seen in last 24 hours
   - Skip if duplicate
   ↓
5. Output:
   - Send JSON to Signal Validator
   - Save to local JSONL file
   ↓
6. Save State (update last message IDs, dedup cache)
   ↓
7. Exit (wait 5 minutes, repeat)
```

## Setup

### 1. Get Telegram API Credentials

Go to https://my.telegram.org/apps:
1. Login with your Telegram account
2. Click "Create new application"
3. Copy **API ID** and **API Hash**

### 2. Create Configuration File

```bash
cat > ~/.claude/quantflow_config.json << 'EOF'
{
  "telegram_api_id": "YOUR_API_ID",
  "telegram_api_hash": "YOUR_API_HASH",
  "telegram_phone": "+1234567890",
  "extraction_config": {
    "instruments": ["GOLD", "XAUUSD", "BTC", "BTCUSD", "ETH", "EURUSD"],
    "deduplication_window_hours": 24,
    "max_messages_per_scan": 100
  }
}
EOF
```

### 3. Install Dependencies

```bash
pip install telethon
```

### 4. First Run - Authorize Telegram

```bash
python skills/signal-extractor/scripts/signal_extractor.py
```

Confirm the login prompt in your Telegram app.

### 5. Schedule on Cowork

Create a **scheduled task** with:
- **Schedule**: `*/5 * * * *` (every 5 minutes)
- **Command**: `python skills/signal-extractor/scripts/signal_extractor.py`

## Outputs

### State File
`~/.claude/quantflow_extractor_state.json` — Persists channels, last message IDs, dedup hashes

### Extracted Signals
`~/.claude/quantflow_extracted_signals.jsonl` — One JSON per line

```json
{
  "signal_id": "TG_20260414_103045_123456789_456",
  "source": {
    "platform": "TELEGRAM",
    "channel": "Trading Signals",
    "channel_id": 123456789,
    "message_id": 456,
    "timestamp": "2026-04-14T10:30:45Z"
  },
  "extracted_signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry": 2385.50,
    "sl": 2380.00,
    "tp": 2395.00,
    "extraction_status": "COMPLETE"
  },
  "quality": {
    "confidence_score": 0.95,
    "completeness_percent": 100,
    "is_duplicate": false
  }
}
```

## Monitoring

```bash
# View signals in real-time
tail -f ~/.claude/quantflow_extracted_signals.jsonl

# Count total signals
wc -l ~/.claude/quantflow_extracted_signals.jsonl

# Check state
cat ~/.claude/quantflow_extractor_state.json | jq
```

## Integration

Output (JSONL) → **Skill #2: Signal Validator**

For full documentation, see `references/SIGNAL_EXTRACTOR_README.md`.
