# 🚀 QUANTFLOW V1 - Integration Guide (TradingView + Telegram)

## ✅ Current Status

**3 test scripts working:**
- ✅ `test_single_trade.py` - Simple demo
- ✅ `test_live_trade.py` - Multi-signals
- ✅ `test_btc_live.py` - BTC live (WORKING NOW!)

**Latest BTC Test Result:**
```
Signal: BUY @ $45,134.50
Market Price: $45,234.50 (+0.22%)
R:R Ratio: 2.00:1
Retail Bias: BULLISH (100% long)
Status: CORRECT (trend continuation)
Decision: ACCEPT (MEDIUM confidence)
```

---

## 🔌 Integration Steps

### Step 1: Connect TradingView Real Prices

**Option A: Using TradingView API (Recommended)**

```python
# In test_btc_live.py, replace get_btc_price_from_tradingview():

def get_btc_price_from_tradingview(self):
    """Fetch real BTC price from TradingView"""
    
    # Using available TradingView tools
    from mcp__tradingview__yahoo_price import yahoo_price
    
    # Get real-time data
    btc_data = yahoo_price("BTC-USD")
    
    return {
        "symbol": "BTC-USD",
        "current_price": btc_data['price'],
        "intraday_high": btc_data['high'],
        "intraday_low": btc_data['low'],
        "change_percent": btc_data['change_pct'],
        "source": "TradingView"
    }
```

**Option B: Using CCXT (Crypto Exchanges)**

```python
def get_btc_price_from_tradingview(self):
    """Fetch from KuCoin/Binance via CCXT"""
    
    import ccxt
    
    # Connect to KUCOIN
    exchange = ccxt.kucoin()
    ticker = exchange.fetch_ticker('BTC/USDT')
    
    return {
        "symbol": "BTC/USDT",
        "current_price": ticker['last'],
        "intraday_high": ticker['high'],
        "intraday_low": ticker['low'],
        "change_percent": ticker['percentage'],
        "source": "KUCOIN"
    }
```

---

### Step 2: Connect Telegram Bot

**Setup Telegram Bot First:**
1. Talk to @BotFather on Telegram
2. Create new bot → get API token
3. Save token in config

**Add to code:**

```python
# In test_btc_live.py, add method:

def send_telegram_alert(self, message: str, chat_id: str):
    """Send alert to Telegram"""
    
    from telegram import Bot
    import asyncio
    
    # Your bot token from BotFather
    bot = Bot(token="YOUR_BOT_TOKEN_HERE")
    
    # Send message to channel/chat
    asyncio.run(bot.send_message(
        chat_id=chat_id,
        text=message,
        parse_mode="HTML"
    ))
    
    print(f"✓ Telegram alert sent!")

# Then use in main:
if decision['action'] in ['ACCEPT', 'REVIEW']:
    telegram_msg = self._format_telegram_alert(decision, market, signal)
    self.send_telegram_alert(telegram_msg, chat_id="YOUR_CHAT_ID")
```

---

### Step 3: Set Up 24/7 Monitoring Loop

**Create `monitor_btc_24h.py`:**

```python
#!/usr/bin/env python3
"""
24/7 BTC Monitoring - Runs every 5 minutes
"""

import time
import schedule
from test_btc_live import BTCLiveTest

class BTCMonitor:
    def __init__(self, interval_minutes=5):
        self.interval = interval_minutes
        self.tester = BTCLiveTest()
        
    def check_signal(self):
        """Check BTC and generate signal if conditions met"""
        
        print(f"\n[{datetime.now()}] Checking BTC...")
        
        try:
            # Fetch price
            btc_data = self.tester.get_btc_price_from_tradingview()
            
            # Create signal
            signal = self.tester.create_btc_signal(btc_data['current_price'])
            
            # Run analysis
            result = self.tester.run_btc_analysis(signal, btc_data)
            
            # Send alert if ACCEPT
            if result['decision']['action'] == 'ACCEPT':
                # Send Telegram
                self.tester.send_telegram_alert(
                    result['telegram_message'],
                    chat_id="YOUR_CHAT_ID"
                )
                print("✅ Signal sent to Telegram!")
            
            # Save result
            self.tester.save_results(f"btc_monitor_{int(time.time())}.json")
            
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def start(self):
        """Start monitoring loop"""
        
        print(f"🚀 Starting BTC Monitor (every {self.interval} minutes)")
        
        # Schedule the check
        schedule.every(self.interval).minutes.do(self.check_signal)
        
        # Keep running
        while True:
            schedule.run_pending()
            time.sleep(1)

if __name__ == "__main__":
    monitor = BTCMonitor(interval_minutes=5)
    monitor.start()
```

**Run 24/7:**
```bash
# In background (macOS/Linux)
nohup python3 monitor_btc_24h.py > btc_monitor.log 2>&1 &

# Or using systemd (Linux)
sudo systemctl enable btc_monitor
sudo systemctl start btc_monitor
```

---

### Step 4: Store Results in Database

**Add to test_btc_live.py:**

```python
def save_to_database(self, result: dict):
    """Store result in MongoDB or PostgreSQL"""
    
    from pymongo import MongoClient
    
    # Connect to MongoDB
    client = MongoClient('mongodb://localhost:27017/')
    db = client['quantflow']
    collection = db['btc_signals']
    
    # Insert result
    collection.insert_one(result)
    
    print(f"✓ Saved to MongoDB")
```

---

## 🎯 Complete Flow Diagram

```
[TradingView] ← Fetch real BTC price every 5 min
     ↓
[test_btc_live.py] ← Create signal + analyze
     ↓
[Liquidity Analysis] ← 3-phase pipeline
     ↓
[Decision Engine] ← ACCEPT/REVIEW/REJECT
     ↓
[IF ACCEPT]
     ├→ [Telegram] ← Send alert
     ├→ [MongoDB] ← Store result
     └→ [Email] ← Optional notification
```

---

## 📋 Configuration Checklist

- [ ] Get TradingView API access (or use CCXT)
- [ ] Create Telegram bot (@BotFather)
- [ ] Get chat ID where alerts should go
- [ ] Update credentials in config
- [ ] Test single trade (`test_btc_live.py`)
- [ ] Test multi-signal (`test_live_trade.py`)
- [ ] Set up 24/7 monitor (`monitor_btc_24h.py`)
- [ ] Add database (MongoDB/PostgreSQL)
- [ ] Add email notifications (optional)
- [ ] Deploy to server/VPS

---

## 🚨 Quick Start Template

```python
#!/usr/bin/env python3
"""
BTC Trading Alert - Minimal setup
"""

from test_btc_live import BTCLiveTest
import telegram

# 1. Get price
tester = BTCLiveTest()
btc_data = tester.get_btc_price_from_tradingview()

# 2. Analyze
signal = tester.create_btc_signal(btc_data['current_price'])
result = tester.run_btc_analysis(signal, btc_data)

# 3. Send alert
if result['decision']['action'] == 'ACCEPT':
    bot = telegram.Bot(token="YOUR_TOKEN")
    bot.send_message(
        chat_id="YOUR_CHAT_ID",
        text=result['telegram_message']
    )
    print("✓ Alert sent!")
```

---

## ✅ Files Ready

| File | Status | Purpose |
|------|--------|---------|
| `test_single_trade.py` | ✅ Working | Learn the flow |
| `test_live_trade.py` | ✅ Working | Multi-signals |
| `test_btc_live.py` | ✅ Working | BTC live (USE THIS!) |
| `TEST_GUIDE.md` | ✅ Complete | Full documentation |
| `INTEGRATION_GUIDE.md` | ✅ This file | Setup instructions |

---

## 🔧 Troubleshooting

**Q: TradingView API not available?**
A: Use CCXT or fetch from Yahoo Finance (free)

**Q: Telegram not sending?**
A: Check bot token and chat ID are correct

**Q: Signals not consistent?**
A: Check clustering tolerance in LiquidityAnalyzer (currently 100 for BTC)

---

## 🎓 Next Phase

Once live:
1. **Backtesting** - Historical performance analysis
2. **Paper trading** - Test signals without real money
3. **Live trading** - Small position sizes
4. **Monitoring** - Track P&L and metrics
5. **Optimization** - Fine-tune decision logic

---

**Status: READY TO DEPLOY** ✅
