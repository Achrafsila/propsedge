# Signal Filter Rules

## Acceptance Rules

### Strict Validation Formula
```
VALID_SIGNAL = (EXPLICIT_ACTION) AND (NUMERIC_SL) AND (NUMERIC_TP) AND (GOLD_INSTRUMENT) AND (PRICE_LOGIC)
```

### Required Components (ALL mandatory)
1. **Explicit Trading Action**: Must contain exact BUY/SELL/Long/Short
2. **Numeric Stop Loss**: Must contain specific number for SL
3. **Numeric Take Profit**: Must contain specific number for TP
4. **GOLD Instrument**: Must reference GOLD/XAUUSD explicitly
5. **Price Logic**: SL and TP must be different from entry price

## Keyword Variations

### Action Keywords (Strict Match)
- **BUY**: BUY, BUY NOW, ENTER BUY, GO BUY, LONG, ENTER LONG, GO LONG
- **SELL**: SELL, SELL NOW, ENTER SELL, GO SELL, SHORT, ENTER SHORT, GO SHORT
- **Rejected variations**: "maybe buy", "consider buy", "buy if", "could buy"

### Stop Loss Keywords (Must have number)
- **SL formats**: SL:, SL=, STOP LOSS:, STOP:, S/L:, STOPLOSS:
- **Number requirement**: Must be followed by numeric value (e.g., "SL: 2018.00")
- **Rejected**: "SL below", "stop around", "stop near"

### Take Profit Keywords (Must have number)
- **TP formats**: TP:, TP=, TAKE PROFIT:, TARGET:, T/P:, TAKEPROFIT:
- **Number requirement**: Must be followed by numeric value (e.g., "TP: 2035.00")
- **Rejected**: "TP above", "target around", "target near"

### Instrument Keywords (Exact match)
- **GOLD**: GOLD, XAUUSD, XAU/USD, XAU, GOLD/USD
- **Case insensitive**: gold, xauusd, xau/usd, xau, gold/usd
- **Rejected**: "precious metals", "commodities", "metals"

## Rejection Rules

### Automatic Rejection (Zero tolerance)
1. **Missing Required Components**: Any of the 5 required elements missing
2. **Conflicting Actions**: Contains both BUY and SELL keywords
3. **No Numeric Prices**: No specific numbers for SL/TP
4. **Question Format**: Messages ending with "?" or containing "what", "when", "how"
5. **News/Analysis**: Contains "news", "analysis", "report", "forecast" without signal
6. **Educational Content**: Contains "tutorial", "how to", "learn", "education"
7. **Price Logic Errors**: SL = TP, or SL/TP same as entry price
8. **Multiple Instruments**: References GOLD + other instruments (confusing)

### Strict Rejection (High confidence)
1. **Ambiguous Language**: "maybe", "probably", "consider", "might", "could"
2. **Future References**: "next week", "later", "soon", "upcoming"
3. **Conditional Language**: "if", "when", "after", "once", "should"
4. **Excessive Emojis**: More than 2 emojis in message
5. **All Caps**: Entire message in uppercase (spam indicator)
6. **Missing Entry Price**: No clear entry price mentioned
7. **Unrealistic Prices**: SL/TP differences >10% from current price

### Edge Cases Handling

### Multiple Signals in One Message
- **Rule**: Process only the first valid signal
- **Logic**: Ignore subsequent signals to avoid confusion
- **Output**: Single signal object with "multiple_signals": true flag

### Price Ranges Instead of Exact Prices
- **Rule**: Automatically reject - ranges are ambiguous
- **Exception**: Only accept if range <0.2% (very tight range)
- **Output**: REJECTED with "price_range_too_wide" reason

### Currency Confusion
- **Rule**: Reject if multiple currencies mentioned
- **Example**: "GOLD and EURUSD both look good"
- **Output**: REJECTED with "multiple_instruments" reason

## Message Classification

### TYPE_1_STRUCTURED (Perfect Signal)
**Criteria:**
- ALL 5 required components present and explicit
- Clear numeric price levels
- Standard, unambiguous format
- No conditional language
- Price logic correct

**Classification Score:** 90-100

### TYPE_2_SEMI_STRUCTURED (Acceptable Signal)
**Criteria:**
- Action, instrument, and at least 1 price component present
- Some ambiguity in language or format
- Minor missing information but signal is clear
- Slightly non-standard format

**Classification Score:** 60-89

### TYPE_3_NOISE (Reject)
**Criteria:**
- Missing critical components (action or instrument)
- No clear trading signal
- General commentary or questions
- Ambiguous or conditional language

**Classification Score:** 0-59

## JSON Output Format

### VALID Signal Output
```json
{
  "signal_id": "SIGNAL_001",
  "timestamp": "2024-01-15T14:30:00Z",
  "source": "trading_signals_pro",
  "classification": "TYPE_1_STRUCTURED",
  "quality_score": 95,
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": 2025.50,
    "stop_loss": 2018.00,
    "take_profit": 2035.00,
    "risk_reward_ratio": 2.1
  },
  "validation": {
    "all_components_present": true,
    "price_logic_valid": true,
    "no_ambiguity": true
  },
  "raw_message": "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00",
  "processing_time": 0.15
}
```

### REJECTED Signal Output
```json
{
  "signal_id": "REJECTED_001",
  "timestamp": "2024-01-15T14:30:00Z",
  "source": "trading_channel",
  "classification": "TYPE_3_NOISE",
  "quality_score": 15,
  "rejection_reasons": ["MISSING_STOP_LOSS", "MISSING_TAKE_PROFIT", "QUESTION_FORMAT"],
  "validation": {
    "all_components_present": false,
    "price_logic_valid": false,
    "ambiguity_detected": true
  },
  "raw_message": "What do you guys think about gold today?",
  "processing_time": 0.08
}
```

## Real-World Processing Examples

### Example 1: Perfect Valid Signal
**Input:** "BUY XAUUSD at 2025.50 SL: 2018.00 TP: 2035.00"

**Processing:**
- Action: BUY ✓ (explicit)
- Instrument: XAUUSD ✓ (exact match)
- Entry: 2025.50 ✓ (numeric)
- Stop Loss: 2018.00 ✓ (numeric)
- Take Profit: 2035.00 ✓ (numeric)
- Price Logic: ✓ (SL below entry, TP above entry)

**Output:** VALID - TYPE_1_STRUCTURED, Score: 98

### Example 2: Good Valid Signal (Semi-structured)
**Input:** "Long GOLD around 2025.5, stop at 2018, target 2035"

**Processing:**
- Action: LONG ✓ (explicit)
- Instrument: GOLD ✓ (exact match)
- Entry: 2025.5 ✓ (numeric)
- Stop Loss: 2018 ✓ (numeric)
- Take Profit: 2035 ✓ (numeric)
- Price Logic: ✓ (correct)

**Output:** VALID - TYPE_2_SEMI_STRUCTURED, Score: 85

### Example 3: Invalid Signal (Missing Components)
**Input:** "Gold looks bullish today, might be good time to buy"

**Processing:**
- Action: Missing ✗ (no explicit action)
- Instrument: GOLD ✓ (present)
- Entry: Missing ✗ (no price)
- Stop Loss: Missing ✗
- Take Profit: Missing ✗
- Ambiguity: "might be good" ✗

**Output:** REJECTED - TYPE_3_NOISE, Score: 20

### Example 4: Invalid Signal (Question Format)
**Input:** "Should I buy GOLD at 2025? SL 2018 TP 2035?"

**Processing:**
- Action: BUY ✓ (present)
- Instrument: GOLD ✓ (present)
- Entry: 2025 ✓ (present)
- Stop Loss: 2018 ✓ (present)
- Take Profit: 2035 ✓ (present)
- Question Format: "Should I" ✗ (automatic rejection)

**Output:** REJECTED - TYPE_3_NOISE, Score: 25

### Example 5: Invalid Signal (Price Logic Error)
**Input:** "SELL GOLD at 2025.50 SL: 2030.00 TP: 2018.00"

**Processing:**
- Action: SELL ✓ (explicit)
- Instrument: GOLD ✓ (present)
- Entry: 2025.50 ✓ (numeric)
- Stop Loss: 2030.00 ✓ (numeric) - BUT wrong for SELL
- Take Profit: 2018.00 ✓ (numeric) - BUT wrong for SELL
- Price Logic: ✗ (SL above entry for SELL, TP below entry)

**Output:** REJECTED - TYPE_3_NOISE, Score: 30

## Edge Cases Handling

### Multiple Signals in One Message
- Process each signal separately
- Generate multiple output objects
- Link to same source message

### Price Range Instead of Exact Price
- Use midpoint of range
- Mark as approximate in output
- Lower confidence score

### Currency Confusion
- Prioritize GOLD/XAUUSD over other instruments
- If multiple instruments, process all valid ones
- Flag for manual review if ambiguous
