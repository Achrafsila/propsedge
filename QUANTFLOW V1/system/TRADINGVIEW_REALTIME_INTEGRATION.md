# TradingView Real-Time Price & Market Fetcher Integration

## Overview
Real-time price tracking and historical market data integration with TradingView, providing live price updates and movement history for GOLD/XAUUSD and other trading instruments.

---

## Architecture

### Component Diagram
```
TradingView API
       ↓
┌─────────────────────────────────────┐
│  TradingView Real-Time Connector    │
│  - WebSocket listener               │
│  - Price stream processor           │
│  - Data validator                   │
└─────────────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│  Price & Market Data Hub            │
│  - Live price cache                 │
│  - OHLCV aggregator                 │
│  - Movement detector                │
└─────────────────────────────────────┘
       ↓
       ├→ Signal Processor (Decision Rules)
       ├→ Historical Archive (TimeSeries DB)
       ├→ Real-Time Dashboard
       └→ Google Sheets Live Updates
```

---

## Data Flow

### 1. Real-Time Price Stream
```
TradingView WebSocket
    ↓
Price Tick (Symbol, Price, Time, Volume)
    ↓
Validation (Range check, Data quality)
    ↓
Update Live Cache (Last price, Bid/Ask, Volume)
    ↓
Broadcast to Consumers
```

### 2. OHLCV Aggregation (Multiple Timeframes)
```
1-minute bars → 5-minute → 15-minute → 1-hour → 4-hour → Daily
    ↓
Calculate candle: Open, High, Low, Close, Volume
    ↓
Store in TimeSeries Database
    ↓
Update technical indicators (RSI, MACD, Bollinger Bands)
```

### 3. Movement Detection
```
Live Price Update
    ↓
Compare to Previous
    ↓
Calculate Change %
    ↓
Trigger Alert if:
  - Large spike (>1%)
  - Trend reversal
  - Support/Resistance breach
    ↓
Notify Signal Processor & Dashboard
```

---

## Integration Points

### A. Signal Processing Pipeline
**When a signal arrives:**
1. Extract instrument (GOLD/XAUUSD)
2. Query Real-Time Price Fetcher for current price
3. Verify signal against live market:
   - Is entry price within reasonable range of current price?
   - Is SL/TP logical given current volatility?
4. Attach live market context to signal
5. Send enhanced signal to Decision Rules Engine

**Output:**
```json
{
  "signal_id": "SIGNAL_001",
  "source": "telegram",
  "action": "BUY",
  "entry_price": 2025.50,
  "stop_loss": 2018.00,
  "take_profit": 2035.00,
  "current_market_price": 2024.75,
  "price_distance_to_entry": -0.75,
  "market_volatility": 0.8,
  "timestamp": "2024-01-15T14:30:00Z",
  "signal_viability": "VIABLE"
}
```

### B. Trade Execution Context
Real-time price data allows traders to:
- Execute at optimal moments (price validation)
- Monitor slippage expectations
- Set dynamic stop-loss/take-profit based on volatility
- Avoid stale/outdated signal prices

### C. Performance Analytics
Track signal quality against actual market performance:
- Did entry price materialize?
- How long did it take?
- What was actual slippage?
- Feed learnings back to signal scoring

---

## Data Structure

### Live Price Cache
```python
{
  "GOLD": {
    "current_price": 2025.50,
    "bid": 2025.25,
    "ask": 2025.75,
    "volume": 1250000,
    "last_update": "2024-01-15T14:30:15Z",
    "previous_close": 2023.00,
    "change_percent": 0.12,
    "high_24h": 2032.00,
    "low_24h": 2018.50
  }
}
```

### Historical Tick Data (Stored)
```python
[
  {
    "symbol": "GOLD",
    "timestamp": "2024-01-15T14:30:15.500Z",
    "price": 2025.50,
    "volume": 5000,
    "bid": 2025.25,
    "ask": 2025.75
  },
  {
    "symbol": "GOLD",
    "timestamp": "2024-01-15T14:30:16.250Z",
    "price": 2025.55,
    "volume": 3500,
    "bid": 2025.30,
    "ask": 2025.80
  }
]
```

### OHLCV Aggregated Data (Multiple Timeframes)
```python
{
  "symbol": "GOLD",
  "timeframe": "1m",
  "timestamp": "2024-01-15T14:30:00Z",
  "open": 2025.00,
  "high": 2025.75,
  "low": 2024.85,
  "close": 2025.50,
  "volume": 125000,
  "indicators": {
    "sma_20": 2024.50,
    "rsi_14": 65.4,
    "macd": 0.15,
    "bollinger_upper": 2026.20,
    "bollinger_lower": 2023.80
  }
}
```

---

## Real-Time Features

### 1. Live Price Updates (Sub-second)
- **Update Frequency**: Every tick (1-100ms depending on volume)
- **Latency**: < 500ms from TradingView to system
- **Accuracy**: Bid/Ask spread tracking
- **Continuity**: Handle connection drops gracefully

### 2. Movement History
**Automatic recording of:**
- Every price tick (raw data)
- Aggregated OHLCV per timeframe
- Support/Resistance breaches
- Volume spikes
- Trend reversals

**Storage Duration:**
- Ticks: 7 days (real-time accuracy)
- OHLCV 1m: 30 days
- OHLCV 5m-4h: 1 year
- OHLCV Daily: Unlimited
- Archive: Cold storage (S3/Database)

### 3. Technical Indicator Updates
Automatic calculation on every candle close:
- **Trend**: EMA 20/50/200
- **Momentum**: RSI, MACD, Stochastic
- **Volatility**: Bollinger Bands, ATR
- **Volume**: OBV, Volume Profile
- **Support/Resistance**: Pivot points, Fibonacci

### 4. Alert Generation
Trigger notifications when:
- Price crosses key levels
- Volatility exceeds thresholds
- Support/Resistance breaches
- Trend reversals detected
- Volume anomalies

---

## Integration with Signal Processing

### Enhanced Decision Logic

**Before:** Signal processed in isolation
```
Signal: "BUY GOLD at 2025.50 SL 2018.00 TP 2035.00"
Decision: ACCEPT (based on signal structure only)
```

**After:** Signal processed with live market context
```
Signal: "BUY GOLD at 2025.50 SL 2018.00 TP 2035.00"
Live Price: 2024.75 (0.75 below entry)
Volatility: 0.8% (normal)
Trend: Uptrend (EMA aligned)
Support Below: 2023.00
Resistance Above: 2027.50

Enhanced Decision: ACCEPT
Viability Score: 95/100
Recommendation: Entry valid, good risk/reward, wait for uptrend confirmation
```

### Score Adjustment Based on Market Conditions
```
Base Signal Score: 85 pts
+ Market Trend Alignment: +5 pts (if uptrend for BUY)
- Overbought Condition: -5 pts (if RSI > 80)
+ Good Entry Distance: +3 pts (if price gap creates better RR)
= Final Score: 88 pts
```

---

## Database Schema

### TimeSeries Table: tick_data
```sql
CREATE TABLE tick_data (
  id BIGINT PRIMARY KEY,
  symbol VARCHAR(10),
  timestamp TIMESTAMP,
  price DECIMAL(10,2),
  volume INT,
  bid DECIMAL(10,2),
  ask DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_symbol_timestamp (symbol, timestamp)
);
```

### TimeSeries Table: ohlcv_data
```sql
CREATE TABLE ohlcv_data (
  id BIGINT PRIMARY KEY,
  symbol VARCHAR(10),
  timeframe VARCHAR(5), -- "1m", "5m", "15m", "1h", "4h", "1d"
  timestamp TIMESTAMP,
  open DECIMAL(10,2),
  high DECIMAL(10,2),
  low DECIMAL(10,2),
  close DECIMAL(10,2),
  volume INT,
  indicators JSON, -- {sma_20, rsi_14, macd, ...}
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE KEY unique_symbol_timeframe_timestamp (symbol, timeframe, timestamp),
  INDEX idx_symbol_timeframe_timestamp (symbol, timeframe, timestamp DESC)
);
```

### Table: price_events
```sql
CREATE TABLE price_events (
  id BIGINT PRIMARY KEY,
  symbol VARCHAR(10),
  event_type VARCHAR(50), -- "support_breach", "resistance_breach", "volume_spike", etc.
  level DECIMAL(10,2),
  timestamp TIMESTAMP,
  price_at_event DECIMAL(10,2),
  severity VARCHAR(10), -- "LOW", "MEDIUM", "HIGH"
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_symbol_timestamp (symbol, timestamp)
);
```

---

## Real-Time Dashboard Integration

### Live Market View
```
GOLD/XAUUSD | LIVE | 2025.50 ↑0.15% | Volume: 1.2M
├─ Trend: Uptrend (EMA 20 > 50 > 200)
├─ Momentum: RSI 65.4 (strong but not overbought)
├─ Support: 2023.00 | Resistance: 2027.50
├─ 24h High: 2032.00 | 24h Low: 2018.50
└─ Next Level: 2027.50 (resistance)

Recent Price Movement:
  14:30 - 2025.50 (↑0.15)
  14:29 - 2025.35 (↓0.10)
  14:28 - 2025.45 (↑0.20)
  14:27 - 2025.25 (stable)
```

### Signal Processing with Market Context
```
New Signal Received: BUY GOLD at 2025.50
├─ Status: Validating against live market...
├─ Current Price: 2024.75 ✓ (Valid entry zone)
├─ Trend: Uptrend ✓ (Aligned)
├─ Risk Level: Normal ✓ (Volatility 0.8%)
└─ Decision: ACCEPT [Score: 88/100] - Ready for execution

Trader Recommendation:
⚠️  Price 0.75 below entry - Wait for pullback to 2025.50
    or execute at market (2024.75) with adjusted SL to 2017.75
```

---

## Implementation Roadmap

### Phase 1: Live Price Stream (Week 1-2)
- [ ] WebSocket connection to TradingView
- [ ] Real-time price cache
- [ ] Basic tick recording
- [ ] Alert system for price movements

### Phase 2: OHLCV Aggregation (Week 2-3)
- [ ] Multi-timeframe aggregator
- [ ] Candle formation logic
- [ ] Technical indicator calculation
- [ ] Historical storage

### Phase 3: Integration (Week 3-4)
- [ ] Enhanced signal scoring with market context
- [ ] Live dashboard implementation
- [ ] Google Sheets live updates
- [ ] Performance analytics

### Phase 4: Optimization (Week 4+)
- [ ] ML-based volatility forecasting
- [ ] Predictive alert system
- [ ] Advanced support/resistance detection
- [ ] Backtesting engine integration

---

## API Endpoints (Proposed)

### Real-Time Data
```
GET /api/market/price/:symbol
  → Current price, bid/ask, volume, change%

GET /api/market/ohlcv/:symbol/:timeframe
  → Latest candle with indicators

WS /api/market/stream/:symbol
  → WebSocket stream of live price ticks

GET /api/market/history/:symbol
  ?timeframe=1m&start=2024-01-15T00:00:00Z&end=2024-01-15T23:59:59Z
  → Historical tick data with pagination
```

### Integrated Signal Processing
```
POST /api/signals/validate
{
  "signal": {...},
  "symbol": "GOLD",
  "include_market_context": true
}
  → Enhanced signal with market viability score
```

---

## Success Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| **Price Update Latency** | < 500ms | Timely decision-making |
| **Data Accuracy** | 99.9% | Trust in system |
| **Uptime** | 99.5% | 24/7 reliability |
| **Storage Efficiency** | < 1GB/day | Cost-effective |
| **Signal Quality Improvement** | +15% | Better trade decisions |
| **False Signal Reduction** | -20% | Fewer bad trades |

---

## Error Handling & Resilience

### Connection Loss
- Automatic reconnection with exponential backoff
- Queue unprocessed ticks during downtime
- Batch update on reconnection

### Data Quality Issues
- Validation: Price within reasonable range
- Outlier detection: Ignore obvious data spikes
- Fallback: Use previous known good price

### Storage Failure
- Write to backup queue
- Retry periodically
- Alert on persistent failures

---

## Notes
- TradingView integration may use official API, MCP connector, or web scraping depending on availability
- Real-time vs. delayed data depends on TradingView subscription tier
- Adjust storage duration based on disk/database constraints
- Consider data privacy and archival policies for compliance
