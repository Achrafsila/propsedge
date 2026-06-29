# VWAP & Session Analysis

## Overview

The VWAP & Session Analysis module provides **institutional-level price context** by analyzing:
- **VWAP** (Volume Weighted Average Price): Fair value price calculated from volume
- **Session High/Low**: Daily range from open to current time
- **Price Position**: Where current price sits relative to these key levels

---

## What is VWAP?

VWAP is the average price paid for all shares during the trading day, weighted by volume.

**Key Characteristics**:
- Calculated from open to current time (continuously updated)
- Heavily weighted by volume concentration
- Acts as "fair value" level
- Used by institutional traders as benchmark
- Changes direction when large volume prints occur

**Significance**:
- Price ABOVE VWAP = Bullish (buying interest)
- Price BELOW VWAP = Bearish (selling pressure)
- Price AT VWAP = Equilibrium (fair value)

---

## VWAP as Support/Resistance

VWAP acts differently than traditional S/R:

### VWAP as Dynamic Support
```
If price > VWAP:
  VWAP becomes SUPPORT below price
  Traders buy dips to VWAP
  Strong buying conviction when price returns to VWAP
```

### VWAP as Dynamic Resistance
```
If price < VWAP:
  VWAP becomes RESISTANCE above price
  Traders sell rallies to VWAP
  Strong selling conviction when price returns to VWAP
```

### VWAP as Pivot
```
If price = VWAP:
  Breakout equilibrium point
  Next move will establish new bias
  High volatility often follows
```

---

## Session Levels Explained

### Session High
- **Definition**: Highest price from session open to current time
- **Significance**: Represents bullish strength
- **Use**: Price near session high = trend strength

### Session Low
- **Definition**: Lowest price from session open to current time
- **Significance**: Represents bearish pressure
- **Use**: Price near session low = weakness

### Session Range
- **Calculation**: Session High - Session Low
- **Significance**: Larger range = more volatile, more institutional participation
- **Position**: Where is current price in this range?

---

## Price Position in Session Range

The module calculates WHERE price sits in the daily range:

```
Session Range: $2019.00 - $2031.50 (Range = $12.50)

UPPER QUARTILE (75-100%):    $2028.63 - $2031.50
UPPER HALF (50-75%):         $2025.13 - $2028.63
LOWER HALF (25-50%):         $2021.63 - $2025.13
LOWER QUARTILE (0-25%):      $2019.00 - $2021.63

If Current Price = $2024.00:
  Position = 40.0% (LOWER_HALF)
  Interpretation: Bearish bias, near session lows
```

### Interpretation by Position

| Position | Bullish Score | Interpretation |
|----------|---------------|-----------------|
| Upper Quartile | 5/5 | Extreme bullish, near session highs |
| Upper Half | 4/5 | Moderate bullish bias |
| Lower Half | 2/5 | Moderate bearish bias |
| Lower Quartile | 1/5 | Extreme bearish, near session lows |

---

## VWAP Strength Assessment

The module evaluates how strong VWAP is as a level based on retail concentration:

### STRONG VWAP
```
Many retail entries within $5 of VWAP
→ Heavy institutional participation expected at VWAP
→ High probability of bounce/reversal at level
→ Use as confirmation for support/resistance
```

### MODERATE VWAP
```
Some retail entries within $15 of VWAP
→ Moderate institutional participation
→ Mid-range probability at VWAP
→ Use as secondary confirmation
```

### WEAK VWAP
```
Few retail entries near VWAP
→ Low probability of institutional reaction
→ Low confidence at VWAP level
→ Use only with other confluence
```

---

## VWAP Alignment Scenarios

### Scenario 1: Price & Entries Above VWAP
```
Price: $2024.00 (ABOVE VWAP $2022.50)
Retail Entries: $2025.00 avg (ABOVE VWAP)

Interpretation:
→ Retail correct - positioned with price
→ Trend continuation likely
→ VWAP acts as support
→ Entry: Dips to VWAP ($2022.50)
→ Target: VWAP + (VWAP - SL)
```

### Scenario 2: Price & Entries Below VWAP
```
Price: $2024.00 (BELOW VWAP $2025.75)
Retail Entries: $2025.62 avg (BELOW VWAP)

Interpretation:
→ Retail correct - positioned with price
→ Trend downward likely
→ VWAP acts as resistance
→ Entry: Rallies to VWAP ($2025.75)
→ Target: TP clusters
```

### Scenario 3: Price Above, Entries Below VWAP
```
Price: $2026.00 (ABOVE VWAP $2023.00)
Retail Entries: $2021.00 avg (BELOW VWAP)

Interpretation:
→ Price running away from retail
→ Retail left behind (gap fill possible)
→ Retail entries now stale
→ Reversal to fill gap likely
→ Entry: Pullback to retail entry zone
```

### Scenario 4: Price Below, Entries Above VWAP
```
Price: $2020.00 (BELOW VWAP $2023.50)
Retail Entries: $2025.00 avg (ABOVE VWAP)

Interpretation:
→ Retail trapped - positioned above price
→ Liquidation likely (SL sweep)
→ After SL sweep, reversal to VWAP
→ Entry: After SL cluster is touched
→ Target: VWAP first, then TP cluster
```

---

## Integration with Liquidity Analysis

### How VWAP Enhances Liquidity Analysis

**Before**: Identify liquidity clusters, determine retail status
**After**: Add VWAP context to confirm or question the setup

```
Example:
Retail positioned BUY around 2025.50
SL cluster at 2020.00
VWAP at 2025.75

Analysis:
- Retail entries NEAR VWAP (high confidence level)
- If SL swept, reversal to VWAP likely
- VWAP acts as short-term support
- Target: TP cluster at 2035.00
```

### VWAP as Confluence Factor

VWAP confluence with other factors:

```
STRONG SETUP:
✓ Retail positioned with price
✓ Price near VWAP (< $2 away)
✓ VWAP alignment with trend
✓ SL clusters intact below (for BUY) / above (for SELL)
→ HIGH CONFIDENCE - wait for SL test

WEAK SETUP:
✗ Retail far from VWAP (> $10 away)
✗ Price moved sharply away from VWAP
✗ VWAP against retail positioning
→ LOW CONFIDENCE - wait for pullback to VWAP
```

---

## Usage Examples

### Example 1: Using VWAP with CLI

```bash
python3 scripts/run_liquidity_analysis.py \
  --signals data/input/signals.csv \
  --price 2024.00 \
  --high 2032.00 \
  --low 2018.00 \
  --session-high 2031.50 \
  --session-low 2019.00 \
  --vwap 2025.75
```

Output includes:
```
VWAP Level: $2025.75
Current Price: $2024.00
Distance to VWAP: $1.75
Price Position: BELOW_VWAP
Interpretation: Price and entries both below VWAP = Confirmed downtrend
```

### Example 2: Programmatic Usage

```python
from src.liquidity_analyzer import MarketContext, VWAPAnalyzer

# Create market context with VWAP
market = MarketContext(
    current_price=2024.00,
    intraday_high=2032.00,
    intraday_low=2018.00,
    session_high=2031.50,
    session_low=2019.00,
    vwap=2025.75
)

# Analyze VWAP context
analyzer = VWAPAnalyzer(signals, market)
vwap_context = analyzer.analyze_vwap_context()
session_analysis = analyzer.analyze_session_levels()

print(f"VWAP: ${vwap_context['vwap_level']}")
print(f"Alignment: {vwap_context['price_alignment']}")
print(f"Session Position: {session_analysis['position']}")
```

### Example 3: Finding VWAP in JSON

```python
import json

analysis = analyzer.analyze()

# VWAP data is in:
vwap_data = analysis['vwap_analysis']['vwap']
session_data = analysis['vwap_analysis']['session']

print(f"VWAP: {vwap_data['vwap_level']}")
print(f"Session Range: {session_data['session_low']}-{session_data['session_high']}")
```

---

## How to Get VWAP Data

### From TradingView
```
VWAP is built-in standard indicator
Path: Indicators → Overlay → VWAP
Read value from chart or API
```

### From Data Connectors
```python
from src.market_watcher import MarketWatcher

watcher = MarketWatcher('GOLD')
data = watcher.get_intraday_data()

vwap = data['vwap']
session_high = data['session_high']
session_low = data['session_low']
```

### Manual Calculation
```python
# If you have OHLCV data with volume:
# VWAP = Σ(Price × Volume) / Σ(Volume)
# 
# Price = (High + Low + Close) / 3
# Cumulative Typical Price × Volume = Sum
# Cumulative Volume = Sum
# VWAP = Cumulative TPV / Cumulative Volume
```

---

## Key Insights from VWAP

### Pattern 1: VWAP Rejection
```
Price approaches VWAP + strong reversal
→ Institutions rejecting that price level
→ Trend change likely
→ Opposite direction more probable
```

### Pattern 2: VWAP Confirmation
```
Price holds at VWAP + reverses from it
→ Institutions accepting that price level
→ Trend continuation likely
→ Same direction more probable
```

### Pattern 3: VWAP Cross-Over
```
Price crosses above/below VWAP + holds
→ Bias change from bearish to bullish (or vice versa)
→ New trend likely establishing
→ Early entry signal
```

### Pattern 4: VWAP Walk-Away
```
Price runs far from VWAP without touching
→ One-way move (extreme bias)
→ Imbalance created
→ Pullback to VWAP highly probable
```

---

## Trading Implications

### If Using VWAP

**For Trend Trades**:
1. Price > VWAP = LONG (entries on dips to VWAP)
2. Price < VWAP = SHORT (entries on rallies to VWAP)
3. Price ≈ VWAP = Wait for breakout direction

**For Mean-Reversion Trades**:
1. Price far above VWAP = SHORT to VWAP
2. Price far below VWAP = LONG to VWAP
3. Strongest when retail trapped at cluster

**For Entry Confirmation**:
- Price near VWAP + retail cluster nearby = HIGH confidence
- Price far from VWAP + retail far away = LOW confidence

---

## Limitations

❌ **VWAP Doesn't Tell You**:
- Which direction price will move next
- When the move will happen
- How long trends will last
- Where the next support/resistance is

✅ **VWAP Does Tell You**:
- Fair value price for the session
- Price bias (above/below equilibrium)
- Institutional acceptance/rejection points
- Confluence with retail positioning

---

## Best Practices

1. **Always Use with Liquidity Analysis**
   - VWAP + SL/TP clusters together
   - Don't use VWAP in isolation

2. **Confirm with Multiple Factors**
   - VWAP + retail positioning + price action
   - Stronger signals with all three aligned

3. **Watch for VWAP Rejections**
   - Price touches VWAP + reverses = Institutional rejection
   - Strong opposite move likely

4. **Use Session Range Position**
   - Price in upper quartile = Bullish exhaustion risk
   - Price in lower quartile = Bearish exhaustion risk

5. **Account for Volume**
   - High volume at VWAP = Stronger level
   - Low volume at VWAP = Weaker level
   - Check volume context

---

## Parameters Required

| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| current_price | float | Yes | 2024.00 |
| intraday_high | float | Yes | 2032.00 |
| intraday_low | float | Yes | 2018.00 |
| session_high | float | Optional | 2031.50 |
| session_low | float | Optional | 2019.00 |
| vwap | float | Optional | 2025.75 |
| timeframe | string | Optional | "1D" |

---

## Next Steps

1. **Get VWAP Feed**: Connect to TradingView VWAP data stream
2. **Store History**: Save daily VWAP values for analysis
3. **Track Accuracy**: Compare VWAP predictions vs actual moves
4. **Optimize Thresholds**: Fine-tune entry/exit based on VWAP distance
5. **Combine with ML**: Use VWAP + positioning data for predictive models

---

## Example Report Output

```
4B. VWAP & SESSION ANALYSIS
----------------------------------------
VWAP Level: $2025.75
Current Price: $2024.00
Distance to VWAP: $1.75
Price Position: BELOW_VWAP
Retail Entry Position: BELOW_VWAP
Interpretation: Price and entries both below VWAP = Confirmed downtrend

VWAP as Level:
  Role: RESISTANCE
  Strength: STRONG
  Touched Intraday: YES

Session Levels:
  Session Range: $2019.00 - $2031.50
  Range Size: $12.50
  Price Position in Range: LOWER_HALF (40.0%)
  Interpretation: Price in lower half - moderate bearish bias
```
