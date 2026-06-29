# TradingView Live Price Integration for QUANTFLOW V1

## Objective
**TradingView is the ONLY source of truth for all prices.**
Every price request MUST fetch directly from TradingView - no defaults, no cache, no approximations.

## Integration Points

### 1. Direct Price Fetch (Use These Tools)

When you need the EXACT price of GOLD/XAUUSD:

```
Use: mcp__tradingview-chart__quote_get(symbol="OANDA:XAUUSD")
Returns: Exact real-time price from TradingView
```

Example:
```python
from src.tradingview_live_price import get_price

# This will internally use: mcp__tradingview-chart__quote_get(symbol="OANDA:XAUUSD")
price_data = get_price("XAUUSD")
# Returns: {
#   "symbol": "XAUUSD",
#   "exact_price": 4670.43,
#   "timestamp": "2026-04-13T12:34:56.789Z",
#   "source": "TradingView"
# }
```

### 2. Comparison Tool

When comparing signal price with TradingView:

```python
from src.tradingview_live_price import compare_price_with_tradingview

result = compare_price_with_tradingview(
    price_value=4691.70,  # From Telegram signal
    symbol="XAUUSD",
    source_label="Telegram Signal"
)
# Returns exact difference from TradingView
```

### 3. Available TradingView Tools

```
mcp__tradingview-chart__quote_get(symbol="OANDA:XAUUSD")
    → Get exact SPOT price for GOLD

mcp__tradingview__yahoo_price(symbol="GC=F")
    → Get Gold Futures price

mcp__tradingview-chart__data_get_ohlcv(count=1)
    → Get current candle (O, H, L, C, V)
```

## Implementation Requirements

### For Every Analysis/Comparison:
1. ✅ Fetch exact price from TradingView
2. ✅ Verify source is TradingView
3. ✅ Check timestamp is recent (< 5 seconds)
4. ✅ Use for ALL calculations
5. ❌ Never use cached/default values

### Example: Proper Price Request

```python
# ❌ WRONG - Using default/cached
price = 2380.50  # Hard-coded, not from TradingView

# ✅ CORRECT - Always fetch from TradingView
price_data = get_price("XAUUSD")
price = price_data["exact_price"]  # Now it's exact
```

## Claude Integration Workflow

When user asks for price or comparison:
1. Call: `mcp__tradingview-chart__quote_get(symbol="OANDA:XAUUSD")`
2. Extract: `exact_price` from response
3. Display: Show exact price with timestamp
4. Compare: If needed, use `compare_price_with_tradingview()`

Example prompt for Claude:
```
"Get the exact current price of GOLD from TradingView 
and compare it with signal price 4691.70"
```

## Symbols Reference

| Asset | TradingView Symbol | Yahoo Finance | Source |
|-------|-------------------|---------------|--------|
| Gold (Spot) | OANDA:XAUUSD | XAUUSD=X | Live/Spot |
| Gold (Futures) | GC=F | GC=F | Futures |
| Bitcoin | BINANCE:BTCUSDT | BTC-USD | Crypto |
| Ethereum | BINANCE:ETHUSDT | ETH-USD | Crypto |

## Validation Rules

Every price must pass these checks:
```
1. Source: Must be "TradingView"
2. Timestamp: Must be < 5 seconds old
3. Value: Must be non-null, non-zero
4. Currency: Must be USD
```

## Error Handling

If TradingView price cannot be fetched:
```
❌ HALT - Do not proceed with approximations
❌ Do not use cached values
❌ Do not use default values
✅ Report error and ask user to retry
```

---

**Remember: TradingView is the ONLY source. Always fetch fresh data.**
