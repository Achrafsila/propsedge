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
- ✅ **Deduplication**: Filters duplicate signals over 24h window (exact match: action + instrument + entry + SL + TP)
- ✅ **Resumable**: Tracks last message per channel — if interrupted, resumes exactly where it left off
- ✅ **Zero data loss**: Even if skill crashes, next execution continues from the same point
- ✅ **Production-ready**: Handles reconnections, async operations, and edge cases

## How It Works

Each 5-minute execution:

```
1. Load State (channels monitored, last message IDs, dedup cache)
   ↓
2. Scan ALL channels for NEW messages (only since last execution)
   ↓
3. Extract signals from new messages:
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
   - Send JSON to Signal Validator (next skill)
   - Save to local JSONL file
   ↓
6. Save State (update last message IDs, dedup cache)
   ↓
7. Exit (wait 5 minutes, repeat)
```

## Configuration

Create `~/.claude/quantflow_config.json` with your Telegram credentials:

```bash
cat > ~/.claude/quantflow_config.json << 'EOF'
{
  "telegram_api_id": "YOUR_API_ID",
  "telegram_api_hash": "YOUR_API_HASH",
  "telegram_phone": "+1234567890",
  "extraction_config": {
    "instruments": ["GOLD", "XAUUSD", "BTC", "BTCUSD", "ETH", "EURUSD", "GBPUSD"],
    "deduplication_window_hours": 24,
    "max_messages_per_scan": 100
  },
  "logging": {
    "level": "INFO"
  }
}
EOF
```

### Getting Telegram API Credentials

1. Go to https://my.telegram.org/apps
2. Login with your Telegram account
3. Click "Create new application"
4. Fill the form (any app name works)
5. Copy **API ID** and **API Hash**

## Setup

### 1. Install Dependencies

```bash
pip install telethon
```

### 2. Create Config File

See **Configuration** section above.

### 3. First Run - Authorize Telegram

Run manually once to authorize:

```bash
python skills/signal-extractor/scripts/signal_extractor.py
```

This will:
- Prompt you to confirm login in Telegram app
- Scan all your channels
- Save session state locally
- Extract signals found

### 4. Schedule on Cowork

Create a **scheduled task**:
- **Schedule**: `*/5 * * * *` (every 5 minutes)
- **Command**: `python skills/signal-extractor/scripts/signal_extractor.py`
- **Runtime**: Python
- **Enabled**: Yes

## Outputs

### State File
`~/.claude/quantflow_extractor_state.json`
- Tracks: channels monitored, last message ID per channel, dedup hashes
- Allows resuming without losing data
- Automatically updated after each execution

### Extracted Signals
`~/.claude/quantflow_extracted_signals.jsonl`
- One JSON object per line (JSONL format)
- Consumed by Signal Validator skill
- Contains: signal_id, action, instrument, entry, SL, TP, quality metrics

**Example signal:**
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
  },
  "raw_message": "GOLD BUY AT 2385.50 SL 2380.00 TP 2395.00"
}
```

## Supported Message Formats

The extractor recognizes these common trading signal formats:

```
"GOLD BUY AT 2385.50 SL 2380.00 TP 2395.00"
"BUY GOLD 2385.50, SL 2380, TP 2395"
"XAUUSD SELL NOW 4785 Stop Loss 4790 Take Profit 4775"
"Entry: 2385.50, SL: 2380.00, TP: 2395.00 BUY"
"BTCUSD Long at 45000 with SL 44500 and TP 46000"
"EURUSD 1.0950 SELL - SL: 1.0960 TP: 1.0930"
```

## Monitoring

### View Extracted Signals (Real-time)
```bash
tail -f ~/.claude/quantflow_extracted_signals.jsonl
```

### Count Signals
```bash
wc -l ~/.claude/quantflow_extracted_signals.jsonl
```

### Check Current State
```bash
cat ~/.claude/quantflow_extractor_state.json | jq '.'
```

### View Logs (Cowork)
Check the scheduled task's output logs in Cowork dashboard.

## Integration

This skill outputs to a file consumed by **Skill #2: Signal Validator**.

```
┌─ Signal Extractor (this skill)
│  └─ Output: ~/.claude/quantflow_extracted_signals.jsonl
│
└─ Signal Validator (next skill)
   └─ Validates, scores, filters signals
```

You can chain these skills in your Cowork workflow.

## Troubleshooting

### "Config file not found"
Create `~/.claude/quantflow_config.json` with your Telegram credentials.

### "Failed to connect to Telegram"
- Verify API ID and API Hash are correct
- Check phone number format: `+countrycode_number`
- Telegram API must be accessible

### "No signals extracted" (first run)
This is normal! First run scans historical messages, subsequent runs only process new messages. Come back after a few 5-minute cycles once signals are posted to the channels.

### State file corrupted
```bash
rm ~/.claude/quantflow_extractor_state.json
# Skill will recreate on next run
```

This will rescан all channels, but state is not lost.

## Performance

- **Execution time**: ~20-30 seconds per run
- **Memory**: ~50-100 MB
- **State file**: ~100 KB (grows slowly)
- **Channel capacity**: Tested up to 500 channels
- **Dedup window**: 24 hours of signal hashes (~10k entries)

## Security Notes

- Telegram session stored locally: `signal_extractor_session`
- API credentials in config file — keep secure
- No data sent to external services
- All processing is local

## For Detailed Documentation

See:
- `references/SIGNAL_EXTRACTOR_README.md` — Full documentation
- `scripts/test_signal_extractor.py` — Test suite

