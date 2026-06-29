# Liquidity Analysis Module - Usage Guide

## Overview
The Liquidity Analysis module extracts institutional-level insights from retail trading signals by analyzing positioning against real market price behavior.

**Module Location**: `src/liquidity_analyzer.py`
**Runner Script**: `scripts/run_liquidity_analysis.py`
**Test Suite**: `tests/test_liquidity_analyzer.py`

---

## Quick Start

### 1. Run Analysis from CSV
```bash
python3 scripts/run_liquidity_analysis.py \
  --signals data/input/signals.csv \
  --price 2025.50 \
  --high 2032.00 \
  --low 2018.00 \
  --timeframe 1D
```

### 2. Output Results to File
```bash
python3 scripts/run_liquidity_analysis.py \
  --signals data/input/signals.csv \
  --price 2025.50 \
  --high 2032.00 \
  --low 2018.00 \
  --output data/output/analysis_report.txt
```

### 3. Get JSON Output
```bash
python3 scripts/run_liquidity_analysis.py \
  --signals data/input/signals.csv \
  --price 2025.50 \
  --high 2032.00 \
  --low 2018.00 \
  --json > analysis_output.json
```

---

## Input Format

### CSV Signal Format
```csv
direction,entry,sl,tp
BUY,2025.50,2020.00,2035.00
BUY,2025.75,2020.50,2035.50
SELL,2028.00,2033.00,2023.00
```

**Required Columns**:
- `direction`: "BUY" or "SELL"
- `entry`: Entry price (float)
- `sl`: Stop loss price (float)
- `tp`: Take profit price (float)

### Market Context Parameters
```bash
--price     Current market price (float, required)
--high      Intraday high (float, required)
--low       Intraday low (float, required)
--timeframe Timeframe (string, default: "1D")
```

### Advanced Options
```bash
--tolerance Clustering tolerance in price points (default: 10.0)
            Controls how tight SL/TP clusters must be
```

---

## Output Format

### 1. Console Report (Human-Readable)
```
================================================================================
RETAIL POSITIONING & LIQUIDITY ANALYSIS REPORT
================================================================================

1. RETAIL POSITIONING BIAS
   BUY Signals: 8 (80.0%)
   SELL Signals: 2 (20.0%)
   Dominant Bias: BULLISH
   Crowding Level: HIGH
   Interpretation: Retail heavily skewed long...

2. LIQUIDITY ZONE MAPPING
   SL Clusters (2):
     $2020.00 (Range: 2019.00 - 2021.00) - 8 signals
   TP Clusters (2):
     $2035.25 (Range: 2034.50 - 2036.00) - 8 signals

[... continues with complete analysis ...]

7. FINAL INSTITUTIONAL INSIGHT
   💡 Retail trapped bullish, SL cluster at 2020.00 likely to be swept...
```

### 2. JSON Output
```json
{
  "timestamp": "2026-04-12T20:38:12.612886",
  "retail_bias": {
    "buy_count": 8,
    "buy_percent": 80.0,
    "dominant_bias": "BULLISH",
    "crowding_level": "HIGH"
  },
  "liquidity_zones": {
    "sl_clusters": [
      {
        "price_range": "2019.00 - 2021.00",
        "center": 2020.0,
        "signal_count": 8,
        "type": "SL"
      }
    ]
  },
  "positioning_assessment": {
    "status": "TRAPPED",
    "liquidation_probability": "HIGH"
  },
  "trading_zones": {
    "entry_zones": [
      {
        "price": 2020.0,
        "range": "2019.00-2021.00",
        "rationale": "SL cluster - retail trapped, reversal expected...",
        "confidence": "HIGH"
      }
    ]
  },
  "final_insight": "Retail trapped bullish, SL cluster at 2020.00..."
}
```

---

## Analysis Components

### 1. Retail Positioning Analysis
**What it measures**:
- % of BUY vs SELL signals
- Crowding level (how concentrated positioning is)
- Entry price clustering
- Stop loss distance patterns
- Take profit distance patterns
- Risk/reward ratio distribution

**Example Output**:
```
BUY: 8 signals (80%)
SELL: 2 signals (20%)
Dominant Bias: BULLISH (crowding risk)
Avg Entry: $2025.62
Avg SL Distance: $5.05
Avg TP Distance: $9.10
Avg Risk/Reward: 1.8:1
```

### 2. Liquidity Zone Mapping
**What it identifies**:
- SL clusters (where stops are concentrated)
- TP clusters (where profits are concentrated)
- Strongest liquidity pools (by signal count)
- Clusters above/below current price

**Example Output**:
```
SL Clusters:
  $2020.00 ← 8 signals (STRONG SUPPORT POOL)
  $2032.75 ← 2 signals

TP Clusters:
  $2022.75 ← 2 signals
  $2035.25 ← 8 signals (STRONG RESISTANCE POOL)
```

### 3. Price Action Analysis
**What it detects**:
- Liquidity taken (which clusters were touched by price)
- Stop hunts (SL cluster touched, then reversal)
- Liquidity sweeps (price runs through clusters without reversing)
- Inefficiencies (large price moves creating imbalance)

**Example Output**:
```
Liquidity Taken Below: YES at $2018.00

STOP HUNT DETECTED:
  Type: SELL_STOP_HUNT
  Cluster: $2020.00
  Touched at: $2018.00
  Direction: UP (price reversed)
  → Retail longs were liquidated

LIQUIDITY SWEEPS:
  UP through SL at $2020.00 (no stopping power)
  UP through TP at $2022.75 (no stopping power)
```

### 4. Positioning Assessment
**Classification**:
- **CORRECT**: Retail positioned with price movement (continuation likely)
- **TRAPPED**: Retail positioned against price movement (reversal likely)
- **MIXED**: Retail split, no clear bias (range-bound behavior)

**Example Output**:
```
Status: TRAPPED
Liquidation Probability: HIGH
Explanation: Retail positioned long at $2025.62, 
but price dropped to $2024.00. Reversal likely after SL sweep.
```

### 5. Market Structure
**What it analyzes**:
- Intraday bias (BULLISH/BEARISH/NEUTRAL)
- Move type (CONTINUATION/REVERSAL/RANGE_BOUND)
- Price position relative to retail entries
- Cluster distribution above/below price

**Example Output**:
```
Intraday Bias: BEARISH
Move Type: REVERSAL
Current Price: $2024.00
Avg Retail Entry: $2025.62
SL Clusters Below Price: 1
TP Clusters Above Price: 1
```

### 6. Trading Zones
**Generated entry zones** based on:
- SL clusters (if retail trapped → entry after sweep)
- TP clusters (if retail correct → target zones)
- Liquidity imbalances (where price likely goes)

**Example Output**:
```
ENTRY ZONES:
  Zone: $2020.00
    Range: 2019.00-2021.00
    Rationale: SL cluster - retail trapped, reversal expected
    Confidence: HIGH

TARGET ZONES:
  $2035.25 - TP cluster - profit taking zone
```

### 7. Final Institutional Insight
**One-line conclusion** summarizing:
- Retail positioning status
- Key liquidity levels
- Expected price direction

**Example**:
```
💡 Retail trapped bullish, SL cluster at 2020.00 likely to be swept 
   - expect reversal.
```

---

## Integration with QUANTFLOW System

### Step 1: Load Signals from Google Sheets
```python
# Get signals from ACCEPT_SIGNALS sheet
# Save to CSV or load directly (requires gspread setup)
```

### Step 2: Get Current Market Data from TradingView
```python
from src.market_watcher import MarketWatcher

watcher = MarketWatcher('GOLD')
market_data = watcher.get_intraday_data()
# Returns: current_price, intraday_high, intraday_low
```

### Step 3: Run Liquidity Analysis
```python
from src.liquidity_analyzer import (
    TradingSignal, 
    MarketContext, 
    LiquidityAnalyzer
)

# Create signals from data
signals = [
    TradingSignal(direction='BUY', entry=2025.50, sl=2020.00, tp=2035.00),
    # ... more signals
]

# Create market context
market = MarketContext(
    current_price=market_data['price'],
    intraday_high=market_data['high'],
    intraday_low=market_data['low'],
    timeframe='1D'
)

# Run analysis
analyzer = LiquidityAnalyzer(signals, market)
results = analyzer.analyze()
```

### Step 4: Export to Google Sheets
```python
# Create new sheet with analysis results
# Write institutional insights, trading zones, positioning assessment
```

### Step 5: Update Real-Time Dashboard
```python
# Display key metrics:
# - Retail bias percentage
# - Strongest liquidity pools
# - Positioning assessment
# - Recommended entry zones
# - Final insight
```

---

## Advanced Usage

### Custom Clustering Tolerance
Adjust how tight SL/TP clusters must be:

```bash
# Loose clustering (groups prices within $15 range)
python3 scripts/run_liquidity_analysis.py \
  --signals signals.csv \
  --price 2025.50 --high 2032.00 --low 2018.00 \
  --tolerance 15.0

# Tight clustering (groups prices within $5 range)
python3 scripts/run_liquidity_analysis.py \
  --signals signals.csv \
  --price 2025.50 --high 2032.00 --low 2018.00 \
  --tolerance 5.0
```

### Programmatic Integration
```python
import json
from src.liquidity_analyzer import LiquidityAnalyzer, TradingSignal, MarketContext

# Load signals
signals = [
    TradingSignal(direction='BUY', entry=2025.50, sl=2020.00, tp=2035.00),
    TradingSignal(direction='BUY', entry=2025.75, sl=2020.50, tp=2035.50),
]

# Define market
market = MarketContext(
    current_price=2024.00,
    intraday_high=2032.00,
    intraday_low=2018.00
)

# Analyze
analyzer = LiquidityAnalyzer(signals, market, clustering_tolerance=10.0)
analysis = analyzer.analyze()

# Extract key insights
print(f"Retail Bias: {analysis['retail_bias']['dominant_bias']}")
print(f"Status: {analysis['positioning_assessment']['status']}")
print(f"Entry Zones: {analysis['trading_zones']['entry_zones']}")

# Export as JSON
with open('analysis.json', 'w') as f:
    json.dump(analysis, f, indent=2)
```

---

## Interpretation Guide

### Reading the Report

**Question**: Is retail positioned correctly or trapped?
- **Answer**: Check "POSITIONING ASSESSMENT" → Status field
  - CORRECT = Trend likely to continue
  - TRAPPED = Reversal likely after SL sweep
  - MIXED = Range-bound behavior expected

**Question**: Where are the key liquidity pools?
- **Answer**: Check "LIQUIDITY ZONE MAPPING"
  - SL Clusters = Support (retail stops)
  - TP Clusters = Resistance (profit taking)

**Question**: Has price already hit key levels?
- **Answer**: Check "PRICE ACTION ANALYSIS" → Liquidity Taken
  - "Above: YES" = TP cluster was touched
  - "Below: YES" = SL cluster was touched

**Question**: Where should I enter?
- **Answer**: Check "OPTIMAL TRADING ZONES" → Entry Zones
  - Based on positioning status and liquidity

**Question**: What's the institutional edge here?
- **Answer**: Check "FINAL INSTITUTIONAL INSIGHT"
  - One-line summary of capital flow direction

---

## Error Handling

### Insufficient Signals
```
Warning: Less than 3 signals - clustering may be unreliable
→ Add more signals before trusting results
```

### No Clusters Found
```
Result: Signals too dispersed to form clusters
→ Reduce clustering tolerance (--tolerance)
→ Or collect more signals in tighter price range
```

### Invalid Data
```
Warning: Skipping malformed row
→ Check CSV format (direction, entry, sl, tp)
→ Ensure all values are numeric (float)
```

---

## Best Practices

1. **Minimum Signal Count**: Use 5+ signals for reliable clustering
2. **Fresh Data**: Analysis is most relevant with today's signals
3. **Market Context**: Ensure price/high/low match actual market (not stale)
4. **Clustering Tolerance**: Start with $10, adjust based on instrument volatility
5. **Interpretation**: Always read positioning assessment + price action together
6. **Validation**: Compare predicted zones with actual price behavior next day

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No clusters found" | Reduce `--tolerance` value |
| "Signals too sparse" | Increase number of signals or adjust tolerance |
| "Command not found" | Use `python3` instead of `python` |
| "Import error" | Ensure you're in QUANTFLOW V1 directory |
| "No high/low provided" | Check --high and --low parameters are set |

---

## Next Steps

1. **Automate Daily Analysis**:
   - Schedule script to run after market close
   - Pull signals from Google Sheets
   - Get TradingView data programmatically
   - Generate daily insight report

2. **Real-Time Dashboard**:
   - Display current retail positioning
   - Update liquidity zones as price moves
   - Show entry zones and invalidation levels
   - Stream to telegram/web interface

3. **Backtesting**:
   - Compare daily predictions to actual price movements
   - Measure accuracy of positioning assessment
   - Validate liquidity zone predictions
   - Improve model over time

4. **Machine Learning**:
   - Feed historical positioning data to ML model
   - Predict price targets with confidence intervals
   - Learn trader patterns over time
   - Identify regime changes
