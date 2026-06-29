# Telegram Integration - MVP Setup

## Quick Start (3 Steps)

### Step 1: Get Telegram API Credentials
1. Go to [my.telegram.org](https://my.telegram.org)
2. Sign in with your phone number
3. Create app → Get **API ID** and **API Hash**

### Step 2: Install Dependencies
```bash
pip3 install telethon
```

### Step 3: Run Telegram Pipeline

**Option A: Complete Pipeline (Recommended)**
```bash
python3 telegram_to_sheets.py \
  --api-id YOUR_API_ID \
  --api-hash YOUR_API_HASH \
  --phone YOUR_PHONE_NUMBER \
  --channels "Trading Signals,Gold Analysis"
```

**Option B: Simple Listener Only**
```bash
python3 simple_telegram.py \
  --api-id YOUR_API_ID \
  --api-hash YOUR_API_HASH \
  --phone YOUR_PHONE_NUMBER \
  --channels "Trading Signals,Gold Analysis"
```

## What It Does

1. **Connects** to your Telegram account
2. **Listens** to specified channels in real-time
3. **Saves** messages to `data/telegram_messages.csv`
4. **Processes** through existing signal pipeline
5. **Uploads** results to Google Sheets automatically

## Real-time Processing

```
🚀 Telegram to Google Sheets Pipeline
==================================================
🔐 Connecting to Telegram...
✅ Connected successfully!
📡 Monitoring 2 channels:
  - Trading Signals
  - Gold Analysis

🔄 Real-time pipeline active:
   Telegram → Processing → Google Sheets
⏹️ Press Ctrl+C to stop

📨 Trading Signals: BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00...
🔄 Processing messages...
✅ Processing complete
📤 Uploading to Google Sheets...
✅ Uploaded to Google Sheets
```

## Channel Names

Use exact channel names:
- `"Trading Signals"` - monitors channels with "Trading Signals" in name
- `"Gold Analysis"` - monitors channels with "Gold Analysis" in name
- Partial matches work (case-insensitive)

## Files Created

- `telegram_session.session` - Your Telegram session
- `data/telegram_messages.csv` - Raw Telegram messages
- `data/output_signals.csv` - Processed accepted signals
- `data/review_queue.csv` - Signals for review
- `data/reject_log.csv` - Rejected messages

## Security

- **Keep session file secure** - contains your Telegram session
- **Don't share API credentials** - keep API ID and hash private
- **Phone number** - only used for initial authentication

## Troubleshooting

**"Connection failed"**: Check API ID/Hash and phone number format

**"Channel not found"**: Use exact channel names or partial matches

**"Permission denied"**: Make sure you're member of the channels

**"Google Sheets failed"**: Check credentials.json and spreadsheet sharing

## Stop Listening

Press `Ctrl+C` to stop safely.

## Requirements

- Python 3.7+
- Telethon library
- Valid Telegram API credentials
- Member of target channels
- Google Sheets setup (for complete pipeline)

That's it! Your Telegram trading signals will now be processed in real-time.
