# Automatic Channel Discovery & Subscription Guide

## 🔍 Overview

QuantFLOW V1 can automatically discover and subscribe to new trading signal channels on Telegram based on keywords and signal validation.

---

## 📡 What It Does

### 1. **Automatic Search**
- Searches 25+ trading-related keywords
- Examples: "GOLD SIGNAL", "XAUUSD SIGNAL", "FOREX SIGNAL", "TRADING ALERT", etc.
- Scans public Telegram channels

### 2. **Validation**
- Analyzes last 50 messages in each discovered channel
- Checks for trading signal keywords (BUY, SELL, TP, SL, ENTRY, etc.)
- Confirms channel sends actual trading signals (≥20% trading content)

### 3. **Auto-Subscribe**
- Automatically joins validated channels
- Adds to monitoring configuration
- Begins real-time signal extraction

### 4. **Integration**
- New channels immediately added to monitoring
- Included in multi-channel analysis
- Signals classified and scored alongside existing channels

---

## 🚀 Setup

### Step 1: Get Telegram API Credentials

1. Go to https://my.telegram.org/apps
2. Login with your Telegram account
3. Create a new application
4. Get your **api_id** and **api_hash**

### Step 2: Update Configuration

Edit `data/quantflow_monitoring_config.json`:

```json
{
  "api_id": "YOUR_API_ID",
  "api_hash": "YOUR_API_HASH",
  "account": "YourTelegramUsername",
  ...
}
```

### Step 3: Run Discovery

```bash
python3 auto_discover_channels.py
```

---

## 🔑 Authentication

First run will require Telegram authentication:

```
🔐 Connecting to Telegram...
Phone number: +1234567890
Code: 12345
✅ Connected to Telegram
```

---

## 🔍 Search Keywords

The system searches for 25+ keywords:

**Gold Trading:**
- GOLD SIGNAL
- XAUUSD SIGNAL
- GOLD TRADING
- GOLD SCALPER
- GOLD SNIPER
- GOLD CHANNEL
- GOLD ANALYSIS
- GOLD ENTRY
- GOLD ALERT

**Forex Trading:**
- FOREX SIGNAL
- FOREX ALERT
- FOREX CHANNEL
- FOREX ANALYSIS
- FOREX ENTRY

**General Trading:**
- TRADING SIGNAL
- TRADING ALERT
- TRADING CHANNEL
- TRADING ANALYSIS
- TRADER SIGNALS

**Signal Types:**
- BUY SIGNAL
- SELL SIGNAL
- LONG SIGNAL
- SHORT SIGNAL
- SIGNAL CHANNEL

---

## 📊 Discovery Process

```
🔍 Searching for 25 keyword categories...

  Searching: 'GOLD SIGNAL'...        ✓ Found 3 new
  Searching: 'XAUUSD SIGNAL'...      ✓ Found 2 new
  Searching: 'FOREX SIGNAL'...       ✓ Found 5 new
  Searching: 'TRADING SIGNAL'...     ✓ Found 4 new
  ...

──────────────────────────────────────
✅ Discovery complete: 47 new channels found

VALIDATING & SUBSCRIBING TO NEW CHANNELS

[1/47] Processing: Gold King Signals
  ID: 1234567890
  ⏳ Validating...✅ Valid trading channel
  ⏳ Subscribing...✅ Subscribed

[2/47] Processing: Forex Master Trading
  ID: 1234567891
  ⏳ Validating...✅ Valid trading channel
  ⏳ Subscribing...✅ Subscribed

[3/47] Processing: Random Chat Channel
  ID: 1234567892
  ⏳ Validating...❌ Not a trading channel

...

═══════════════════════════════════════
✅ Validation complete: 42 new channels ready
═══════════════════════════════════════

✅ Config updated with 42 new channels
   Total channels now: 97
```

---

## ✅ Validation Criteria

A channel is considered valid for trading if:

1. **Signal Keywords Present**: ≥20% of messages contain trading keywords
2. **Trading Keywords**: BUY, SELL, LONG, SHORT, ENTRY, TP, SL, GOLD, XAUUSD, etc.
3. **Regular Updates**: Recent activity and frequent signals
4. **Not Spam**: Filters out pump-and-dump or spam channels

---

## 📈 Results

After discovery and subscription:

```
📊 STATISTICS
──────────────────────────────
Keywords searched:     25
New channels found:    47
Validated channels:    42
Success rate:          89%

📋 NEW CHANNELS ADDED
──────────────────────────────
  • Gold King Signals
    ID: 1234567890
  
  • Forex Master Trading
    ID: 1234567891
  
  • XAUUSD Daily Analysis
    ID: 1234567892
  
  ... (42 total)

═══════════════════════════════════════
🚀 All new channels are now being monitored!
═══════════════════════════════════════
```

---

## 🔄 Continuous Monitoring

After discovery, monitor all channels (old + new):

```bash
python3 run_full_workflow.py --monitor --interval 5
```

System will:
- ✅ Monitor all channels (original + discovered)
- ✅ Extract signals from all sources
- ✅ Classify by quality (ACCEPT/REVIEW/REJECT)
- ✅ Run SMC analysis
- ✅ Detect setup triggers
- ✅ Generate alerts

---

## 💾 Config Management

### Before Discovery
```
Total channels: 55
├─ Tier 1 (Critical): 5
├─ Tier 2 (Important): 5
└─ Tier 3 (Standard): 45
```

### After Discovery
```
Total channels: 97+
├─ Tier 1 (Critical): 5 (original)
├─ Tier 2 (Important): 5 (original)
├─ Tier 3 (Standard): 45 (original)
└─ Tier 4 (Auto-discovered): 42+ (new)
```

---

## 🎯 Scheduling Periodic Discovery

Run discovery on a schedule:

```bash
# Every 24 hours
python3 loop 24h auto_discover_channels.py

# Every 6 hours
python3 loop 6h auto_discover_channels.py

# Every hour
python3 loop 1h auto_discover_channels.py
```

---

## 📊 Expected Coverage Growth

| Phase | Channels | Coverage |
|-------|----------|----------|
| Initial | 55 | 100% GOLD |
| After 1st discovery | 97 | 176% (Forex + Crypto added) |
| After 2nd discovery | 150+ | 270%+ (Multi-asset) |
| After 3rd discovery | 200+ | 360%+ (Global coverage) |

---

## 🚨 Important Notes

1. **API Credentials**: Keep api_id and api_hash confidential
2. **Rate Limiting**: System includes 1-second delays between validations
3. **Deduplication**: New channels not added if already subscribed
4. **Validation**: Only valid trading channels are added
5. **Auto-Update**: Config updates automatically after discovery

---

## 🔧 Troubleshooting

### Connection Issues
```
❌ Connection failed
→ Check internet connection
→ Verify API credentials
→ Check Telegram servers
```

### Authentication Failed
```
⚠️  Please authenticate
→ Phone number must include country code (+1, +44, etc.)
→ Confirm code within 5 minutes
→ If 2FA enabled, enter password after code
```

### No New Channels Found
```
ℹ️  No new channels discovered
→ Keywords may already be covered
→ Try searching different keywords
→ Some channels may be private
```

### Subscription Failed
```
❌ Subscription failed
→ Channel may be private
→ May already be subscribed
→ Admin may have restricted access
```

---

## 📝 File Locations

- **Config**: `data/quantflow_monitoring_config.json`
- **Discovery Script**: `auto_discover_channels.py`
- **Session File**: `sessions/discovery_session`
- **Workflow**: `run_full_workflow.py`
- **Monitor All Channels**: `monitor_all_channels.py`

---

## 🎓 Example Workflow

```python
# 1. Initialize discovery
python3 auto_discover_channels.py

# 2. Wait for validation (5-10 minutes for 50+ channels)

# 3. Check config update
cat data/quantflow_monitoring_config.json | grep total_channels

# 4. Start monitoring all channels
python3 run_full_workflow.py --monitor --interval 5

# 5. Watch real-time signal extraction from all sources
```

---

## ✨ Features

✅ Automatic keyword-based search  
✅ Signal validation (20% content check)  
✅ Auto-subscription to valid channels  
✅ Config auto-update  
✅ Deduplication  
✅ Rate limiting  
✅ Comprehensive logging  
✅ Easy scheduling  
✅ Multi-language support  
✅ 24/7 monitoring  

---

**Status**: Channel Discovery System Ready ✅

Run `python3 auto_discover_channels.py` to expand your channel coverage!
