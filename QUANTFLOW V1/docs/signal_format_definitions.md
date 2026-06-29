# Telegram Signal Format Definitions

## Supported Signal Categories

### 1. Structured Signals
**Format**: Complete signals with all required fields
```
BUY GOLD at 1975.5 SL 1970.0 TP 1980.0
SELL XAUUSD at 1980.0 SL 1985.0 TP 1975.0
```
**Characteristics**: Action + Instrument + Entry Price + Stop Loss + Take Profit

### 2. Inline Signals
**Format**: Compact signals on single line
```
BUY GOLD@1975.5 SL:1970 TP:1980
SELL XAUUSD 1980.0 SL 1985.0 TP 1975.0
```
**Characteristics**: All parameters present but condensed format

### 3. Entry-Based Signals
**Format**: Signals with only entry price (missing SL/TP)
```
BUY GOLD at 1975.5
SELL XAUUSD at 1980.0
```
**Characteristics**: Action + Instrument + Entry Price only

### 4. Emoji Signals
**Format**: Signals with trading emojis
```
BUY GOLD at 1975.5 SL 1970.0 TP 1980.0
SELL XAUUSD at 1980.0 SL 1985.0 TP 1975.0
```
**Characteristics**: Contains trading emojis (e.g., )

### 5. Multi-TP Signals
**Format**: Signals with multiple take profit levels
```
BUY GOLD at 1975.5 SL 1970.0 TP1 1980.0 TP2 1985.0
SELL XAUUSD at 1980.0 SL 1985.0 TP1 1975.0 TP2 1970.0
```
**Characteristics**: Multiple TP levels, single SL

### 6. Multi-Signal Messages
**Format**: Multiple signals in one message
```
BUY GOLD at 1975.5 SL 1970.0 TP 1980.0
SELL XAUUSD at 1980.0 SL 1985.0 TP 1975.0
```
**Characteristics**: Two or more complete signals in same message

### 7. Incomplete Signals
**Format**: Missing critical information
```
BUY GOLD (no price)
SELL at 1975.5 (no instrument)
GOLD at 1975.5 (no action)
```
**Characteristics**: Missing action, instrument, or entry price

### 8. Recap Messages
**Format**: Status updates on existing signals
```
GOLD BUY TP HIT at 1980.0
XAUUSD SELL SL Hit at 1985.0
```
**Characteristics**: Updates on closed/modified positions

### 9. Noise Messages
**Format**: Non-trading content
```
Good morning everyone!
Market analysis coming soon
Check your risk management
```
**Characteristics**: No trading signals, general chat

## Extraction Logic Rules

### Current Implementation
- **Action Keywords**: BUY, SELL, LONG, SHORT
- **Instrument Keywords**: GOLD, XAUUSD, XAU/USD
- **Price Keywords**: SL, TP, STOP, LOSS, TAKE, PROFIT

### Proposed Enhancement
**Target**: Improve entry price extraction for "BUY/SELL + XAUUSD/GOLD + number" format

**Current Pattern**: `(?:ENTRY|AT|ENTER|@|at)\s*([\d.]+)`

**Enhanced Pattern**: Add support for direct number after action/instrument:
```python
# New pattern for "BUY GOLD 1975.5" format
(r'(BUY|SELL|LONG|SHORT)\s+(?:GOLD|XAUUSD|XAU/USD)\s+([\d.]+)', 'entry_price'),
(r'(?:GOLD|XAUUSD|XAU/USD)\s+(BUY|SELL|LONG|SHORT)\s+([\d.]+)', 'entry_price')
```

### Validation Rules
- **Complete Signal**: Action + Instrument + Entry Price + SL + TP
- **Partial Signal**: Action + Instrument + Entry Price (missing SL/TP)
- **Invalid Signal**: Missing any critical component
- **Price Logic**: SL/TP must make sense for action direction

### Decision Logic
- **ACCEPT**: Complete, valid, logical signals
- **REVIEW**: Partial signals or ambiguous formatting
- **REJECT**: Non-trading content or invalid signals

## Implementation Notes

### Do Not Change
- Core signal validation logic
- Price logic validation
- Minimum confidence thresholds
- Global signal filtering criteria

### Update Only
- Entry price extraction patterns for "BUY/SELL + XAUUSD/GOLD + number"
- Keep existing patterns intact
- Add new patterns without removing current ones
