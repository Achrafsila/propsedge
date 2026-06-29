# Signal Extraction Engine

## Overview
Extracts and normalizes trading data from Telegram messages without inventing missing values. Only extracts what is explicitly present in the text.

## Critical Field Definitions

### Required for VALID Status
1. **Action**: BUY or SELL (explicitly stated)
2. **Instrument**: GOLD or XAUUSD (explicitly stated)
3. **Entry Price**: Fixed price, range, or conditional (clearly stated)
4. **Stop Loss**: Numeric price (explicitly stated)
5. **Take Profit**: Numeric price (explicitly stated)

### Optional Fields
- **Entry Condition**: "above/below", "if", "when" conditions
- **Timeframe**: Any time references
- **Reasoning**: Market analysis or rationale

## Extraction Methods

### Method 1: Pattern Extraction (Primary)
**Use for:** Standard format signals
**Patterns:**
- `BUY|SELL|LONG|SHORT (GOLD|XAUUSD) (at|@) (\d+\.\d+)`
- `SL[:\s=](\d+\.\d+)`
- `TP[:\s=](\d+\.\d+)`
- `TARGET[:\s=](\d+\.\d+)`
- `STOP[:\s=](\d+\.\d+)`

**Example:**
```
Input: "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00"
Extracted: action=BUY, instrument=GOLD, entry=2025.50, sl=2018.00, tp=2035.00
```

### Method 2: Context Extraction (Secondary)
**Use for:** Semi-structured messages
**Logic:**
1. Find action keywords (BUY/SELL/LONG/SHORT)
2. Find instrument (GOLD/XAUUSD)
3. Extract numbers with context labels
4. Assign based on explicit text references

**Example:**
```
Input: "Long gold around 2025, stop at 2018, target 2035"
Extracted: action=LONG, instrument=GOLD, entry=2025, sl=2018, tp=2035
```

## Allowed Entry Formats

### 1. Fixed Entry
**Format:** Single specific price
**Examples:**
- "at 2025.50"
- "entry 2025"
- "@2025.50"

### 2. Entry Range
**Format:** Price range with clear boundaries
**Examples:**
- "between 2025-2030"
- "2025 to 2030"
- "around 2025-2030"
**Note:** Extract as range, do not calculate midpoint

### 3. Conditional Entry
**Format:** Entry based on price condition
**Examples:**
- "if price above 2030"
- "when below 2015"
- "above 2030 buy"
- "below 2015 sell"

## Normalization Rules

### Number Normalization
1. **Decimal Format**: Convert to 2 decimal places
2. **Comma Removal**: Remove commas (2,025.50 -> 2025.50)
3. **Currency Symbols**: Remove $ and other symbols
4. **Range Preservation**: Keep ranges as-is (do not calculate midpoint)

### Action Normalization
- **BUY**: BUY, BUY NOW, ENTER BUY, GO BUY, LONG, ENTER LONG, GO LONG
- **SELL**: SELL, SELL NOW, ENTER SELL, GO SELL, SHORT, ENTER SHORT, GO SHORT
- **Output**: Standardize to "BUY" or "SELL"

### Instrument Normalization
- **GOLD**: GOLD, XAUUSD, XAU/USD, XAU, GOLD/USD
- **Output**: Standardize to "GOLD"

## Classification System

### VALID
**Criteria:**
- ALL 5 critical fields present and explicit
- No ambiguity or conditional language
- Clear price logic (SL/TP in correct direction)
- No contradictions

### PARTIAL
**Criteria:**
- Contains trading idea but missing 1+ critical fields
- Some ambiguity in price levels
- Conditional language present
- Missing but inferable information

### REJECTED
**Criteria:**
- Missing action or instrument
- No price information
- Contradictory information
- Too vague or ambiguous
- Questions or non-trading content

## Output Schemas

### VALID Signal Output
```json
{
  "signal_id": "SIGNAL_001",
  "status": "VALID",
  "extraction_method": "PATTERN_BASED",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": 2025.50,
    "stop_loss": 2018.00,
    "take_profit": 2035.00
  },
  "extraction_details": {
    "entry_source": "explicit",
    "sl_source": "explicit",
    "tp_source": "explicit",
    "all_critical_fields_present": true
  },
  "validation": {
    "price_logic_valid": true,
    "no_ambiguity": true,
    "no_contradictions": true
  }
}
```

### PARTIAL Signal Output
```json
{
  "signal_id": "SIGNAL_002",
  "status": "PARTIAL",
  "extraction_method": "CONTEXT_BASED",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": 2025.50,
    "stop_loss": 2018.00,
    "take_profit": null
  },
  "missing_fields": ["take_profit"],
  "extraction_details": {
    "entry_source": "explicit",
    "sl_source": "explicit",
    "tp_source": "missing",
    "usable_trading_idea": true
  },
  "issues": ["missing_take_profit"]
}
```

### REJECTED Signal Output
```json
{
  "signal_id": "SIGNAL_003",
  "status": "REJECTED",
  "extraction_method": "FAILED",
  "rejection_reasons": ["missing_action", "no_price_information"],
  "extraction_details": {
    "action_source": "missing",
    "instrument_source": "present",
    "price_information": "none",
    "usable_trading_idea": false
  }
}
```

## Clear Rejection Criteria

### Automatic Rejection
1. **Missing Critical Fields**: Action or instrument not present
2. **No Price Information**: No numeric prices found
3. **Price Logic Errors**: SL/TP in wrong direction for action
4. **Contradictory Information**: Conflicting prices or actions
5. **Question Format**: Message ends with "?" or contains "what/when/how"
6. **Multiple Instruments**: References to non-GOLD instruments
7. **Educational Content**: Contains "tutorial/how to/learn"
8. **News/Analysis**: Pure market commentary without signal

### Conditional Rejection
1. **Excessive Ambiguity**: "around", "near", "about" without specific numbers
2. **Conditional Language**: "if", "when", "maybe", "consider"
3. **Future References**: "next week", "later", "soon"
4. **Vague Price References**: No specific numbers mentioned

## Processing Examples

### Example 1: Valid Structured
**Input:** "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00"

**Processing:**
- Action: BUY (explicit)
- Instrument: GOLD (explicit)
- Entry: 2025.50 (explicit)
- SL: 2018.00 (explicit)
- TP: 2035.00 (explicit)
- Price Logic: SL below entry, TP above entry (correct)

**Output:** VALID

### Example 2: Valid Semi-Structured
**Input:** "Long gold around 2025, stop at 2018, target 2035"

**Processing:**
- Action: LONG (explicit)
- Instrument: GOLD (explicit)
- Entry: 2025 (explicit)
- SL: 2018 (explicit)
- TP: 2035 (explicit)
- Price Logic: Correct direction

**Output:** VALID

### Example 3: Valid Conditional Entry
**Input:** "BUY GOLD if price above 2030 SL: 2020 TP: 2050"

**Processing:**
- Action: BUY (explicit)
- Instrument: GOLD (explicit)
- Entry: above 2030 (conditional)
- SL: 2020 (explicit)
- TP: 2050 (explicit)
- Price Logic: Correct direction

**Output:** VALID

### Example 4: Partial (Missing TP)
**Input:** "SELL GOLD at 2025.50 SL: 2035.00"

**Processing:**
- Action: SELL (explicit)
- Instrument: GOLD (explicit)
- Entry: 2025.50 (explicit)
- SL: 2035.00 (explicit)
- TP: Missing
- Usable Idea: Yes (clear direction and risk)

**Output:** PARTIAL (missing_take_profit)

### Example 5: Partial (Ambiguous Entry)
**Input:** "Consider buying gold around 2025-2030, stop around 2018"

**Processing:**
- Action: "buying" (ambiguous)
- Instrument: GOLD (explicit)
- Entry: 2025-2030 (range)
- SL: 2018 (explicit)
- TP: Missing
- Usable Idea: Yes (trading concept present)

**Output:** PARTIAL (ambiguous_action, missing_take_profit)

### Example 6: Rejected (Missing Action)
**Input:** "Gold looks strong at 2025.50, support at 2018, resistance 2035"

**Processing:**
- Action: Missing (no explicit BUY/SELL)
- Instrument: GOLD (explicit)
- Entry: 2025.50 (explicit)
- SL: 2018 (context)
- TP: 2035 (context)
- Usable Idea: No (no trading action)

**Output:** REJECTED (missing_action)

### Example 7: Rejected (Price Logic Error)
**Input:** "BUY GOLD at 2025.50 SL: 2030.00 TP: 2035.00"

**Processing:**
- Action: BUY (explicit)
- Instrument: GOLD (explicit)
- Entry: 2025.50 (explicit)
- SL: 2030.00 (explicit) - WRONG for BUY
- TP: 2035.00 (explicit)
- Price Logic: SL above entry for BUY (invalid)

**Output:** REJECTED (price_logic_error)

### Example 8: Rejected (Question Format)
**Input:** "Should I buy GOLD at 2025.50? SL 2018 TP 2035"

**Processing:**
- Action: BUY (present)
- Instrument: GOLD (explicit)
- Entry: 2025.50 (explicit)
- SL: 2018 (explicit)
- TP: 2035 (explicit)
- Format: Question (automatic reject)

**Output:** REJECTED (question_format)

## Processing Pipeline

### Step 1: Preprocessing
- Convert to lowercase
- Remove extra whitespace
- Standardize abbreviations

### Step 2: Pattern Extraction
- Try standard patterns first
- Extract labeled components
- Check for completeness

### Step 3: Context Extraction
- If pattern fails, use context
- Find action and instrument
- Extract numbers with context

### Step 4: Validation
- Check price logic (SL/TP direction)
- Validate all critical fields
- Apply rejection criteria

### Step 5: Classification
- VALID: All critical fields present
- PARTIAL: Missing some fields but usable idea
- REJECTED: Missing critical fields or errors

### Step 6: Output Generation
- Create structured JSON
- Include extraction details
- Log classification and method

## Error Handling

### Extraction Failures
- **No pattern match**: Continue to context extraction
- **No context match**: Classify as REJECTED
- **Missing critical fields**: Classify as PARTIAL or REJECTED

### Validation Failures
- **Price logic error**: Classify as REJECTED
- **Contradictory information**: Classify as REJECTED
- **Ambiguous content**: Classify as PARTIAL or REJECTED

### Logging
- Log extraction method used
- Log classification decision
- Log rejection reasons
- Track extraction success rates by method
