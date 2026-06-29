# SKILL #1: Signal Extractor

**Continuous Telegram signal extraction with auto-discovery of new channels.**

## Overview

This skill runs every 5 minutes, 24/7, to:
- ✅ Auto-discover all accessible Telegram channels
- ✅ Extract trading signals (ACTION, INSTRUMENT, ENTRY, SL, TP)
- ✅ Deduplicate signals over 24h window
- ✅ Resume from last execution (no data loss on crashes)
- ✅ Send extracted signals as JSON to Signal Validator skill

## Prerequisites

1. **Telegram Account**
   - Your phone number with country code (e.g., +1234567890)
   - Telegram API credentials (API ID & API Hash)

2. **How to get Telegram API credentials:**
   - Go to https://my.telegram.org/apps
   - Login with your Telegram account
   - Click "Create new application"
   - Fill in the form (app name, short name, etc.)
   - Copy the **API ID** and **API Hash**

## Installation & Setup

### Step 1: Create Configuration File

Create `~/.claude/quantflow_config.json` with your Telegram credentials:

```bash
cat > ~/.claude/quantflow_config.json << 'EOF'
{
  "telegram_api_id": "YOUR_API_ID_HERE",
  "telegram_api_hash": "YOUR_API_HASH_HERE",
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

### Step 2: Install Telethon (if not already installed)

```bash
pip install telethon
```

### Step 3: First Run - Authorize Telegram

Run the skill manually once to authorize with Telegram:

```bash
python skills/signal_extractor.py
```

This will:
1. Prompt you to confirm login (check your Telegram app)
2. Scan all your channels
3. Save state to `~/.claude/quantflow_extractor_state.json`
4. Extract any signals found

### Step 4: Setup Cowork Schedule (Every 5 minutes, 24/7)

On Cowork, create a new **scheduled task** with:

```
Cron: */5 * * * *    (every 5 minutes)
Command: python skills/signal_extractor.py
```

Or use the anthropic-skills:schedule if available.

## Output

### State File
`~/.claude/quantflow_extractor_state.json`
```json
{
  "channels": {
    "123456789": "Trading Signals",
    "987654321": "Gold Analysis"
  },
  "last_message_ids": {
    "123456789": 45678,
    "987654321": 23456
  },
  "last_execution": "2026-04-14T12:30:45.123456Z",
  "seen_signal_hashes": ["abc123...", "def456..."]
}
```

### Extracted Signals
`~/.claude/quantflow_extracted_signals.jsonl` (one JSON per line)

```json
{
  "signal_id": "TG_20260414_123456_123456789_45678",
  "source": {
    "platform": "TELEGRAM",
    "channel": "Trading Signals",
    "channel_id": 123456789,
    "message_id": 45678,
    "timestamp": "2026-04-14T12:30:45Z"
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
  "raw_message": "GOLD BUY AT 2385.50 SL 2380.00 TP 2395.00",
  "extraction_notes": []
}
```

## Key Features

### Auto-Discovery
- Scans all accessible Telegram channels
- Automatically adds new channels when you join
- Keeps track in persistent state file

### Deduplication
- 24-hour deduplication window
- Exact hash match: action + instrument + entry + SL + TP
- Prevents duplicate signals in downstream processing

### Resumable Execution
- Tracks last message ID per channel
- Each 5-min execution only processes new messages
- Even if skill crashes, it knows exactly where it left off
- No data loss, no duplicates

### Signal Extraction Patterns

Supports these message formats:

```
"GOLD BUY AT 2385.50 SL 2380.00 TP 2395.00"
"BUY GOLD 2385.50, SL 2380, TP 2395"
"XAUUSD SELL NOW 2385 Stop Loss 2390 Take Profit 2375"
"Entry: 2385.50, SL: 2380.00, TP: 2395.00 BUY"
```

## Monitoring & Logs

Check the skill's progress with:

```bash
# View latest extracted signals
tail -f ~/.claude/quantflow_extracted_signals.jsonl

# View current state
cat ~/.claude/quantflow_extractor_state.json | jq

# Count extracted signals
wc -l ~/.claude/quantflow_extracted_signals.jsonl
```

## Troubleshooting

### "Config file not found"
Create the config file at `~/.claude/quantflow_config.json` with your Telegram API credentials.

### "Failed to connect to Telegram"
- Check your API ID and API Hash are correct
- Make sure your phone number format is correct (+country_code)
- The Telegram app may be open on another device - that's OK

### "No new messages" (even though messages were sent)
This is normal! The skill only processes messages AFTER it was first run.
- First run: Scans existing channels, extracts signals
- Subsequent runs: Only processes new messages

## Integration with Next Skills

Output (JSONL file) is consumed by:
- **Skill #2: Signal Validator** - Validates and scores signals
- **Skill #3: Google Sheets Logger** - Logs to Google Sheets

You can connect these skills in the Cowork workflow.

## Performance Notes

- Each 5-minute execution takes ~30 seconds
- Scanning 100 channels = ~1 second
- Extracting 50 signals = ~5 seconds
- Network latency = ~10-15 seconds
- Total time: 20-30 seconds per run

- Memory usage: ~50-100 MB
- State file size: ~100 KB (scales slowly with 24h dedup window)

## Future Enhancements

- [ ] Configure signal patterns per channel
- [ ] Weighted scoring by channel reliability
- [ ] Webhook integration to Google Sheets
- [ ] Error recovery and alerting
- [ ] Multi-account support
- [ ] Signal filtering by time-of-day

