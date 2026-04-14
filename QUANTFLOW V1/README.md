# AI Trading Signal Intelligence

## Project Purpose

AI-powered system for extracting and processing trading signals from Telegram channels. The system automatically identifies trading signals, extracts key parameters, and uploads structured results to Google Sheets for analysis.

## Folder Structure

```
AI Trading Signal Intelligence/
README.md
requirements.txt
src/                    # Core processing logic
  batch_processor.py    # Signal extraction and classification
  google_sheets_uploader.py  # Google Sheets integration
  historical_telegram_test.py  # Historical message fetching
  telegram_listener.py  # Real-time message monitoring
  config.py            # Configuration settings
scripts/                # Utility and runner scripts
  run_pipeline.py      # Main pipeline runner
  run_historical_test.py  # Historical test runner
  run_telegram_test.py  # Telegram connection test
  clear_google_sheets.py  # Clear Google Sheets data
  (other utility scripts)
docs/                   # Documentation
  (all .md files)
data/                   # Data files
  input/               # Raw Telegram messages (CSV)
  output/              # Processed signals (CSV)
  archive/             # Historical data archive
  credentials.json     # Google Sheets credentials
sessions/              # Telegram session files
  telegram_session.session
tests/                  # Test files
```

## Main Scripts

### Core Pipeline
- **`scripts/run_pipeline.py`** - Run complete signal processing pipeline
- **`scripts/run_historical_test.py`** - Fetch and process historical Telegram messages

### Utilities
- **`scripts/run_telegram_test.py`** - Test Telegram connection
- **`scripts/clear_google_sheets.py`** - Clear Google Sheets data

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Up Credentials
- Place `credentials.json` in `data/` folder (Google Sheets service account)
- Telegram session will be created automatically in `sessions/`

### 3. Run Pipeline
```bash
# Process existing data
cd scripts
python run_pipeline.py

# Run historical test
python run_historical_test.py
```

## Signal Processing Pipeline

1. **Filter Engine** - Identifies potential trading signals
2. **Extraction Engine** - Extracts trading parameters (action, instrument, entry, SL, TP)
3. **Decision Engine** - Classifies as ACCEPT/REVIEW/REJECT

### Supported Signal Formats

- **BUY XAUUSD 2350 / SL 2340 / TP 2375**
- **SELL GOLD 2365 / SL 2375 / TP 2345**
- **ENTRY 2350 / SL 2340 / TP 2375**
- **BUY at 2350 / SL 2340 / TP 2375**
- **XAUUSD BUY 2350 / SL 2340 / TP 2375**
- **BUY 2350 XAUUSD / SL 2340 / TP 2375**
- **BUY LIMIT 2350 / SL 2340 / TP 2375**

### Classification Rules

**ACCEPT**: All 4 conditions present
- Trade direction (BUY/SELL)
- Instrument (GOLD/XAUUSD)
- Stop Loss (SL/STOP LOSS)
- Take Profit (TP/TARGET)

**REVIEW**: Partial signals (missing 1+ conditions)
**REJECT**: Non-trading content

## Output Files

- **`data/output/output_signals.csv`** - Valid trading signals
- **`data/output/review_queue.csv`** - Signals needing manual review
- **`data/output/reject_log.csv`** - Rejected messages

## Google Sheets Integration

Results are automatically uploaded to Google Sheets with 4 tabs:
- **ACCEPT_SIGNALS** - Valid trading signals
- **REVIEW_QUEUE** - Signals for manual review
- **REJECT_LOG** - Rejected messages
- **STATS** - Processing metrics

## Configuration

Edit `src/config.py` for:
- Telegram API credentials
- Google Sheets settings
- Processing parameters

## MVP Features

- Boolean-based signal classification
- Multi-format entry price extraction
- Historical Telegram message fetching
- Automatic Google Sheets upload
- Channel performance analytics

## Development Notes

- Built with Python 3.13
- Uses Telethon for Telegram API
- Google Sheets integration via gspread
- MVP-focused, maintainable codebase
