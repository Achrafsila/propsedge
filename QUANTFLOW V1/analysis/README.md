# Liquidity Analysis Module

## Overview

The Liquidity Analysis module is the **institutional-level market structure interpreter** for QUANTFLOW V1. It transforms raw retail trading signals into actionable insights by analyzing positioning vs real market price behavior.

**Core Value**: Identify where liquidity is, who is trapped, and where price will flow next.

---

## Module Structure

```
analysis/
├── README.md                          # This file
├── RETAIL_POSITIONING_ANALYSIS.md    # Framework documentation
├── USAGE_GUIDE.md                    # Detailed usage instructions
│
src/
├── liquidity_analyzer.py             # Main analysis engine
├── analysis_pipeline.py              # Integration pipeline
│
scripts/
├── run_liquidity_analysis.py         # CLI runner
│
tests/
├── test_liquidity_analyzer.py        # Test suite
│
data/
├── input/
│   └── test_signals_analysis.csv    # Example signals
```

---

## Quick Facts

| Component | Status | Description |
|-----------|--------|-------------|
| **Core Analysis Engine** | ✅ Complete | Analyzes positioning + liquidity clustering + price action |
| **CLI Runner** | ✅ Complete | Command-line interface for executing analyses |
| **Test Suite** | ✅ Passing | 4 test scenarios validating all components |
| **Documentation** | ✅ Complete | Framework guide + Usage guide |
| **Integration** | 🔄 Partial | Pipeline structure ready, connectors need setup |

---

## What It Does

### Input
```json
{
  "signals": [
    {"direction": "BUY", "entry": 2025.50, "sl": 2020.00, "tp": 2035.00},
    {"direction": "BUY", "entry": 2025.75, "sl": 2020.50, "tp": 2035.50}
  ],
  "market": {
    "current_price": 2024.00,
    "intraday_high": 2032.00,
    "intraday_low": 2018.00
  }
}
```

### Processing
1. **Retail Positioning**: % BUY/SELL, crowding assessment, entry/SL/TP statistics
2. **Liquidity Mapping**: Cluster SL and TP zones, identify strongest pools
3. **Price Action**: Detect which clusters were touched, identify stop hunts
4. **Positioning Status**: Retail correct / trapped / mixed
5. **Market Structure**: Intraday bias, move type (continuation/reversal)
6. **Trading Zones**: Generate entry zones based on liquidity imbalance

### Output
```json
{
  "retail_bias": {
    "dominant_bias": "BULLISH",
    "crowding_level": "HIGH",
    "buy_percent": 80.0
  },
  "positioning_assessment": {
    "status": "TRAPPED",
    "liquidation_probability": "HIGH"
  },
  "liquidity_zones": {
    "strongest_pools": [
      {"price": 2020.00, "count": 8, "type": "SL"},
      {"price": 2035.25, "count": 8, "type": "TP"}
    ]
  },
  "trading_zones": {
    "entry_zones": [
      {"price": 2020.00, "confidence": "HIGH"}
    ],
    "target_zones": [
      {"price": 2035.25}
    ]
  },
  "final_insight": "Retail trapped bullish, SL cluster at 2020.00 likely to be swept - expect reversal."
}
```

---

## Running the Module

### Basic Usage
```bash
python3 scripts/run_liquidity_analysis.py \
  --signals data/input/test_signals_analysis.csv \
  --price 2024.00 \
  --high 2032.00 \
  --low 2018.00
```

### With Output File
```bash
python3 scripts/run_liquidity_analysis.py \
  --signals data/input/test_signals_analysis.csv \
  --price 2024.00 \
  --high 2032.00 \
  --low 2018.00 \
  --output analysis_report.txt
```

### JSON Output
```bash
python3 scripts/run_liquidity_analysis.py \
  --signals data/input/test_signals_analysis.csv \
  --price 2024.00 \
  --high 2032.00 \
  --low 2018.00 \
  --json
```

---

## Test Results

All tests passing ✅

```
TEST 1: RETAIL POSITIONING ANALYSIS
  ✓ Computes bias correctly (8 BUY / 2 SELL = 80% bullish)
  ✓ Identifies HIGH crowding level (>65% one side)
  ✓ Calculates entry statistics
  ✓ Analyzes risk-reward distribution

TEST 2: LIQUIDITY MAPPING
  ✓ Finds SL clusters (2 identified)
  ✓ Finds TP clusters (2 identified)
  ✓ Identifies strongest pools (8-signal clusters)

TEST 3: PRICE ACTION ANALYSIS
  ✓ Detects liquidity taken (below: YES at 2018.00)
  ✓ Identifies stop hunt (SELL_STOP_HUNT detected)
  ✓ Finds liquidity sweeps (2 sweeps detected)

TEST 4: COMPLETE ANALYSIS
  ✓ End-to-end analysis successful
  ✓ Generates trading zones
  ✓ Produces final institutional insight
```

---

## Key Classes

### `LiquidityAnalyzer` (Main Orchestrator)
```python
analyzer = LiquidityAnalyzer(signals, market_context)
results = analyzer.analyze()
```
**Responsibility**: Coordinates all sub-analyzers and produces final report

### `RetailPositioningAnalyzer`
Computes retail bias, crowding level, entry/SL/TP statistics

### `LiquidityMapper`
Clusters SL and TP zones, identifies strongest liquidity pools

### `PriceActionAnalyzer`
Analyzes price movement vs liquidity, detects stop hunts and sweeps

### `PositioningAssessment`
Classifies retail status: CORRECT / TRAPPED / MIXED

### `MarketStructureAnalyzer`
Determines intraday bias and move type

---

## Integration with QUANTFLOW

### Current Flow
```
Telegram Bot → Google Sheets (ACCEPT_SIGNALS)
    ↓
[INTEGRATION POINT] 
    ↓
Liquidity Analyzer ← TradingView (Price + Intraday Range)
    ↓
Analysis Results → Google Sheets (ANALYSIS sheet)
    ↓
Real-Time Dashboard / Trader Briefing
```

### How to Integrate

**1. Load signals from Google Sheets**
```python
from src.google_sheets_uploader import GoogleSheetsUploader

sheets = GoogleSheetsUploader()
signals_data = sheets.read_accept_signals()
signals = [TradingSignal(**s) for s in signals_data]
```

**2. Get market data from TradingView**
```python
from src.market_watcher import MarketWatcher

watcher = MarketWatcher('GOLD')
market_data = watcher.get_intraday()
market = MarketContext(
    current_price=market_data['price'],
    intraday_high=market_data['high'],
    intraday_low=market_data['low']
)
```

**3. Run analysis**
```python
analyzer = LiquidityAnalyzer(signals, market)
results = analyzer.analyze()
```

**4. Export results**
```python
sheets.write_analysis_results(results)
sheets.write_trader_briefing(results)
```

---

## Interpreting Results

### Quick Reference

**Q: Is retail correct or trapped?**
```
A: Check positioning_assessment['status']
   - CORRECT → Trend continuation likely
   - TRAPPED → Reversal likely after SL sweep
   - MIXED → Range-bound behavior
```

**Q: Where will price go?**
```
A: Check trading_zones['entry_zones'] and ['target_zones']
   Based on liquidity imbalance and positioning
```

**Q: Is there danger of stop hunt?**
```
A: Check price_action['stop_hunt_detected']
   If TRUE: SL clusters will likely be swept
```

**Q: What's the institutional view?**
```
A: Read final_insight
   One-line summary of capital flow direction
```

---

## Advanced Configuration

### Clustering Tolerance
Control how tight SL/TP clusters must be:
- `tolerance=5.0` → Tight clustering (strong conviction)
- `tolerance=10.0` → Default (balanced)
- `tolerance=15.0` → Loose clustering (broader zones)

### Minimum Signal Count
Clustering reliability:
- <5 signals → Weak signal, high noise
- 5-15 signals → Moderate reliability
- 15+ signals → Strong signal, low noise

---

## Roadmap

### Phase 1: Foundation (✅ COMPLETE)
- Core analysis engine
- CLI runner
- Test suite
- Documentation

### Phase 2: Integration (🔄 IN PROGRESS)
- Google Sheets connector
- TradingView market watcher
- Daily analysis pipeline
- Results export

### Phase 3: Enhancement (📋 PLANNED)
- Real-time dashboard updates
- Trader briefing generation
- Risk assessment reports
- Performance tracking (prediction vs actuals)

### Phase 4: Intelligence (🎯 FUTURE)
- Machine learning integration
- Pattern recognition from historical data
- Predictive liquidity modeling
- Automated alert system

---

## Files Created

| File | Purpose | Status |
|------|---------|--------|
| `src/liquidity_analyzer.py` | Core analysis engine | ✅ Complete |
| `src/analysis_pipeline.py` | Integration pipeline | ✅ Complete |
| `scripts/run_liquidity_analysis.py` | CLI runner | ✅ Complete |
| `tests/test_liquidity_analyzer.py` | Test suite | ✅ Passing |
| `analysis/RETAIL_POSITIONING_ANALYSIS.md` | Framework guide | ✅ Complete |
| `analysis/USAGE_GUIDE.md` | Usage instructions | ✅ Complete |
| `data/input/test_signals_analysis.csv` | Test data | ✅ Complete |

---

## Next Steps

1. **Immediate**: Test with live Google Sheets data
2. **This Week**: Set up TradingView connector
3. **This Month**: Automate daily analysis pipeline
4. **Next Month**: Deploy real-time dashboard

---

## Support

For questions or issues:
1. Check `USAGE_GUIDE.md` for detailed instructions
2. Review test cases in `test_liquidity_analyzer.py`
3. Examine example data in `data/input/test_signals_analysis.csv`
4. Read framework documentation in `RETAIL_POSITIONING_ANALYSIS.md`

---

## License & Attribution

QUANTFLOW V1 - Retail Positioning & Liquidity Analysis Module
Built with institutional-grade market structure analysis framework.
