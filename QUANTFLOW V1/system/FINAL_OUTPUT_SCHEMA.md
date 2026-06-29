# Final Output Schema

## Unified JSON Schema

### Required Fields (All Outputs)
```json
{
  "signal_id": "string",           // Unique signal identifier
  "message_id": "string",          // Original message ID
  "source": "string",              // Telegram channel name
  "timestamp": "string",           // Message timestamp (ISO 8601)
  "decision": "string",            // ACCEPT | REVIEW | REJECT
  "priority": "string",            // HIGH | MEDIUM | LOW
  "signal": {                      // Extracted signal data
    "action": "string",            // BUY | SELL
    "instrument": "string",        // GOLD | XAUUSD
    "entry_price": "number|string", // Numeric or conditional
    "stop_loss": "number",         // Numeric stop loss
    "take_profit": "number"        // Numeric take profit
  },
  "metadata": {                    // Processing metadata
    "extraction_confidence": "number", // 0.0-1.0
    "decision_score": "number",     // 0-100
    "processing_time_ms": "number"  // Total processing time
  }
}
```

### Optional Fields (Context-Dependent)
```json
{
  "action": "string",              // Recommended action
  "concerns": ["string"],          // List of concerns (REVIEW only)
  "rejection_reasons": ["string"], // List of rejection reasons (REJECT only)
  "review_context": {              // Additional context for REVIEW
    "extraction_status": "string", // VALID | PARTIAL
    "source_history": {
      "accuracy_last_30_days": "number",
      "total_signals": "number"
    }
  },
  "hard_gates": "string",          // PASSED | FAILED
  "reasoning": {                   // Decision breakdown (ACCEPT/REVIEW)
    "extraction_status": "number",
    "entry_confidence": "number",
    "structure_score": "number",
    "risk_management": "number",
    "rr_estimation": "number"
  }
}
```

## ACCEPT Output Schema

### Complete ACCEPT Example
```json
{
  "signal_id": "SIGNAL_001",
  "message_id": "123456",
  "source": "GoldSignalsPro",
  "timestamp": "2026-04-10T14:30:00Z",
  "decision": "ACCEPT",
  "priority": "HIGH",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": 2025.50,
    "stop_loss": 2018.00,
    "take_profit": 2035.00
  },
  "metadata": {
    "extraction_confidence": 0.95,
    "decision_score": 95,
    "processing_time_ms": 1200
  },
  "action": "Process immediately",
  "hard_gates": "PASSED",
  "reasoning": {
    "extraction_status": 25,
    "entry_confidence": 20,
    "structure_score": 20,
    "risk_management": 20,
    "rr_estimation": 10
  }
}
```

### ACCEPT Range Entry Example
```json
{
  "signal_id": "SIGNAL_002",
  "message_id": "123457",
  "source": "GoldTradingExperts",
  "timestamp": "2026-04-10T14:31:00Z",
  "decision": "ACCEPT",
  "priority": "HIGH",
  "signal": {
    "action": "SELL",
    "instrument": "GOLD",
    "entry_price": "2025-2030",
    "stop_loss": 2035.00,
    "take_profit": 2015.00
  },
  "metadata": {
    "extraction_confidence": 0.92,
    "decision_score": 88,
    "processing_time_ms": 1400
  },
  "action": "Process immediately",
  "hard_gates": "PASSED",
  "reasoning": {
    "extraction_status": 25,
    "entry_confidence": 15,
    "structure_score": 20,
    "risk_management": 20,
    "rr_estimation": 8
  }
}
```

## REVIEW Output Schema

### REVIEW Conditional Entry Example
```json
{
  "signal_id": "SIGNAL_003",
  "message_id": "123458",
  "source": "GoldSignalsPro",
  "timestamp": "2026-04-10T14:32:00Z",
  "decision": "REVIEW",
  "priority": "MEDIUM",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": "above 2030",
    "stop_loss": 2020.00,
    "take_profit": 2050.00
  },
  "metadata": {
    "extraction_confidence": 0.88,
    "decision_score": 72,
    "processing_time_ms": 1500
  },
  "action": "Manual review required",
  "concerns": ["conditional_entry", "moderate_score"],
  "hard_gates": "PASSED",
  "reasoning": {
    "extraction_status": 25,
    "entry_confidence": 10,
    "structure_score": 20,
    "risk_management": 20,
    "rr_estimation": 7
  },
  "review_context": {
    "extraction_status": "VALID",
    "source_history": {
      "accuracy_last_30_days": 0.82,
      "total_signals": 67
    }
  }
}
```

### REVIEW PARTIAL Signal Example
```json
{
  "signal_id": "SIGNAL_004",
  "message_id": "123459",
  "source": "GoldTradingExperts",
  "timestamp": "2026-04-10T14:33:00Z",
  "decision": "REVIEW",
  "priority": "MEDIUM",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": 2025.50,
    "stop_loss": 2018.00,
    "take_profit": null
  },
  "metadata": {
    "extraction_confidence": 0.75,
    "decision_score": 65,
    "processing_time_ms": 1300
  },
  "action": "Manual review required",
  "concerns": ["missing_take_profit", "partial_extraction"],
  "hard_gates": "PASSED",
  "reasoning": {
    "extraction_status": 0,
    "entry_confidence": 20,
    "structure_score": 15,
    "risk_management": 10,
    "rr_estimation": 0
  },
  "review_context": {
    "extraction_status": "PARTIAL",
    "source_history": {
      "accuracy_last_30_days": 0.79,
      "total_signals": 52
    }
  }
}
```

## REJECT Output Schema

### REJECT Hard Reject Example
```json
{
  "signal_id": "SIGNAL_005",
  "message_id": "123460",
  "source": "GoldSignalsPro",
  "timestamp": "2026-04-10T14:34:00Z",
  "decision": "REJECT",
  "priority": "LOW",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": 2025.50,
    "stop_loss": 2030.00,
    "take_profit": 2035.00
  },
  "metadata": {
    "extraction_confidence": 0.90,
    "decision_score": 0,
    "processing_time_ms": 800
  },
  "action": "Reject signal",
  "rejection_reasons": ["price_logic_error"],
  "hard_gates": "FAILED"
}
```

### REJECT Low Score Example
```json
{
  "signal_id": "SIGNAL_006",
  "message_id": "123461",
  "source": "GoldTradingExperts",
  "timestamp": "2026-04-10T14:35:00Z",
  "decision": "REJECT",
  "priority": "LOW",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": null,
    "stop_loss": 2018.00,
    "take_profit": null
  },
  "metadata": {
    "extraction_confidence": 0.35,
    "decision_score": 25,
    "processing_time_ms": 600
  },
  "action": "Reject signal",
  "rejection_reasons": ["missing_entry", "missing_take_profit", "low_confidence"],
  "hard_gates": "PASSED"
}
```

### REJECT Type 3 Noise Example
```json
{
  "signal_id": "SIGNAL_007",
  "message_id": "123462",
  "source": "GoldSignalsPro",
  "timestamp": "2026-04-10T14:36:00Z",
  "decision": "REJECT",
  "priority": "LOW",
  "signal": {
    "action": null,
    "instrument": null,
    "entry_price": null,
    "stop_loss": null,
    "take_profit": null
  },
  "metadata": {
    "extraction_confidence": 0.10,
    "decision_score": 0,
    "processing_time_ms": 400
  },
  "action": "Reject signal",
  "rejection_reasons": ["no_trading_signal", "type_3_noise"],
  "hard_gates": "FAILED"
}
```

## Field Definitions

### Signal ID
- **Format**: "SIGNAL_" + 8-digit sequential number
- **Purpose**: Unique identifier for tracking
- **Example**: "SIGNAL_00012345"

### Message ID
- **Format**: Original Telegram message ID
- **Purpose**: Link back to source message
- **Example**: "123456"

### Source
- **Format**: Channel name as configured
- **Purpose**: Identify signal source
- **Example**: "GoldSignalsPro"

### Timestamp
- **Format**: ISO 8601 UTC
- **Purpose**: Message creation time
- **Example**: "2026-04-10T14:30:00Z"

### Decision
- **Values**: "ACCEPT", "REVIEW", "REJECT"
- **Purpose**: Final system decision
- **Criteria**: Based on Decision Rules Engine

### Priority
- **Values**: "HIGH", "MEDIUM", "LOW"
- **Purpose**: Processing urgency
- **Mapping**: ACCEPT=HIGH, REVIEW=MEDIUM, REJECT=LOW

### Action Field
- **ACCEPT**: "Process immediately"
- **REVIEW**: "Manual review required"
- **REJECT**: "Reject signal"

### Concerns (REVIEW only)
- **Purpose**: List issues requiring human attention
- **Examples**: ["conditional_entry", "missing_take_profit", "low_score"]

### Rejection Reasons (REJECT only)
- **Purpose**: Explain why signal was rejected
- **Examples**: ["price_logic_error", "missing_action", "type_3_noise"]

### Hard Gates
- **Values**: "PASSED", "FAILED"
- **Purpose**: Indicate if safety gates passed
- **Note**: "FAILED" always results in REJECT

### Reasoning (ACCEPT/REVIEW only)
- **Purpose**: Breakdown of decision score
- **Components**: Extraction, Entry, Structure, Risk, RR
- **Total**: Should equal decision_score

## Data Validation Rules

### Required Field Validation
- All required fields must be present
- signal_id must be unique
- timestamp must be valid ISO 8601
- decision must be valid value
- priority must match decision

### Signal Data Validation
- action must be "BUY" or "SELL" (if present)
- instrument must be "GOLD" or "XAUUSD" (if present)
- entry_price can be number or string (conditional)
- stop_loss and take_profit must be numbers (if present)

### Metadata Validation
- extraction_confidence must be 0.0-1.0
- decision_score must be 0-100
- processing_time_ms must be positive integer

### Conditional Field Validation
- concerns only allowed for REVIEW
- rejection_reasons only allowed for REJECT
- reasoning only allowed for ACCEPT/REVIEW
- review_context only allowed for REVIEW

## Usage Guidelines

### For Trading Systems
- Use ACCEPT signals immediately
- Process REVIEW signals manually
- Ignore REJECT signals

### For Analytics
- Track decision distribution by source
- Monitor processing times
- Analyze rejection reasons
- Measure extraction confidence

### For Human Reviewers
- Focus on REVIEW signals
- Use review_context for decision
- Update decisions based on analysis
- Provide feedback for system improvement
