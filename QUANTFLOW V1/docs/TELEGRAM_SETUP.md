# Telegram Integration Setup - Quick Guide

## 1. Get Telegram API Credentials

1. Go to [my.telegram.org](https://my.telegram.org)
2. Sign in with your phone number
3. Create a new application:
   - **App title**: Trading Signal Processor
   - **Short name**: trading_signals
   - **Platform**: Desktop
4. Save your **API ID** and **API Hash**

## 2. Install Dependencies

```bash
pip3 install -r requirements.txt
```

## 3. Run Telegram Listener

### Option A: Monitor Specific Channels
```bash
python3 telegram_listener.py \
  --api-id YOUR_API_ID \
  --api-hash YOUR_API_HASH \
  --phone YOUR_PHONE_NUMBER \
  --channels "Trading Signals,Gold Analysis"
```

### Option B: List Available Channels
```bash
python3 telegram_listener.py \
  --api-id YOUR_API_ID \
  --api-hash YOUR_API_HASH \
  --phone YOUR_PHONE_NUMBER \
  --list-channels
```

### Option C: Complete Pipeline (Recommended)
```bash
python3 run_telegram_pipeline.py \
  --api-id YOUR_API_ID \
  --api-hash YOUR_API_HASH \
  --phone YOUR_PHONE_NUMBER \
  --channels "Trading Signals,Gold Analysis"
```

## 4. What It Does

1. **Connects** to your Telegram account
2. **Listens** to specified channels
3. **Extracts** messages in real-time
4. **Processes** through existing signal pipeline
5. **Saves** to `data/telegram_messages.csv`
6. **Routes** to ACCEPT/REVIEW/REJECT
7. **Uploads** to Google Sheets (if configured)

## 5. Channel Names

Use exact channel names as they appear in Telegram:
- `"Trading Signals"` - for channel named "Trading Signals"
- `"Gold Analysis"` - for channel named "Gold Analysis"
- `"-100123456789"` - for channel by ID

## 6. Real-time Processing

The system processes messages as they arrive:
- ✅ **Valid signals** → ACCEPT → Google Sheets
- ⚠️  **Partial signals** → REVIEW → Google Sheets  
- ❌ **Invalid messages** → REJECT → Google Sheets

## 7. Files Created

- `telegram_session.session` - Telegram session file
- `data/telegram_messages.csv` - Raw Telegram messages
- `data/output_signals.csv` - Accepted signals
- `data/review_queue.csv` - Signals for review
- `data/reject_log.csv` - Rejected messages

## 8. Security Notes

- **Session file**: Contains your Telegram session, keep it secure
- **API credentials**: Never share your API ID/Hash
- **Phone number**: Used only for initial authentication

## 9. Troubleshooting

**"Invalid phone number"**: Use country code (e.g., +1234567890)

**"Channel not found"**: Use exact channel name or ID from --list-channels

**"Permission denied"**: Make sure you're a member of the channels

**"Session file error"**: Delete `telegram_session.session` and re-authenticate

## 10. Stop Listening

Press `Ctrl+C` to stop the listener safely.

## Example Output

```
🚀 Starting Telegram Trading Signal Pipeline
==================================================
✅ Connected to Telegram successfully!
📡 Monitoring 2 channels:
  - Trading Signals
  - Gold Analysis

🎧 Listening for trading signals...
📊 Processing and uploading to Google Sheets in real-time
⏹️ Press Ctrl+C to stop

📨 New message from Trading Signals: BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00...
🎯 Signal detected: ACCEPT - VALID_SIGNAL
```
