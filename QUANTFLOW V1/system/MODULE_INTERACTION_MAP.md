# Module Interaction Map

## All Modules Overview

### 1. Data Source Manager
**Purpose:** Connect to Telegram and capture messages
**Input:** Telegram channels
**Output:** Raw message data

### 2. Message Processor
**Purpose:** Standardize incoming messages
**Input:** Raw message data
**Output:** Standardized message objects

### 3. Signal Filter
**Purpose:** Separate signals from noise
**Input:** Standardized messages
**Output:** Classified signals (TYPE_1, TYPE_2, TYPE_3)

### 4. Signal Extraction Engine
**Purpose:** Extract trading parameters
**Input:** TYPE_1 and TYPE_2 signals
**Output:** Structured signal data (VALID/PARTIAL/REJECTED)

### 5. Decision Rules Engine
**Purpose:** Evaluate signal quality and safety
**Input:** VALID and PARTIAL signals
**Output:** Decision results (ACCEPT/REVIEW/REJECT)

### 6. Output Generator
**Purpose:** Create unified JSON outputs
**Input:** Decision results
**Output:** Standardized JSON objects

### 7. Data Manager
**Purpose:** Store and track all data
**Input:** JSON outputs
**Output:** Stored records and analytics

### 8. Human Reviewer
**Purpose:** Evaluate REVIEW signals
**Input:** REVIEW signals
**Output:** Updated decisions

## Module-to-Module Data Flow

### Data Source Manager
**Sends to:** Message Processor
**Data package:**
```json
{
  "source": "telegram_channel_name",
  "message_id": "123456",
  "timestamp": "2026-04-10T14:30:00Z",
  "content": "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00",
  "author": "signal_provider",
  "media_type": "text"
}
```

**Dependencies:**
- Telegram API access
- Approved channel list
- Connection monitoring

---

### Message Processor
**Sends to:** Signal Filter
**Data package:**
```json
{
  "message_id": "123456",
  "source": "telegram_channel_name",
  "timestamp": "2026-04-10T14:30:00Z",
  "content": "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00",
  "author": "signal_provider",
  "processed_at": "2026-04-10T14:30:01Z",
  "content_type": "trading_signal_candidate"
}
```

**Dependencies:**
- Input from Data Source Manager
- Content normalization rules
- Duplicate detection system

---

### Signal Filter
**Sends to:** Signal Extraction Engine (for TYPE_1, TYPE_2)
**Sends to:** Data Manager (for TYPE_3)

**Data package (TYPE_1/TYPE_2):**
```json
{
  "message_id": "123456",
  "source": "telegram_channel_name",
  "timestamp": "2026-04-10T14:30:00Z",
  "content": "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00",
  "signal_type": "TYPE_1_STRUCTURED",
  "confidence": 0.95,
  "filter_reasoning": "Clear BUY signal with all required elements"
}
```

**Data package (TYPE_3):**
```json
{
  "message_id": "123456",
  "source": "telegram_channel_name",
  "timestamp": "2026-04-10T14:30:00Z",
  "content": "Check out this chart!",
  "signal_type": "TYPE_3_NOISE",
  "confidence": 0.98,
  "filter_reasoning": "No trading signal detected"
}
```

**Dependencies:**
- Input from Message Processor
- SIGNAL_FILTER_RULES.md rules
- Signal classification logic

---

### Signal Extraction Engine
**Sends to:** Decision Rules Engine (for VALID, PARTIAL)
**Sends to:** Data Manager (for REJECTED)

**Data package (VALID/PARTIAL):**
```json
{
  "message_id": "123456",
  "source": "telegram_channel_name",
  "timestamp": "2026-04-10T14:30:00Z",
  "extraction_status": "VALID",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": 2025.50,
    "stop_loss": 2018.00,
    "take_profit": 2035.00
  },
  "extraction_method": "pattern_matching",
  "confidence": 0.92,
  "missing_fields": []
}
```

**Data package (REJECTED):**
```json
{
  "message_id": "123456",
  "source": "telegram_channel_name",
  "timestamp": "2026-04-10T14:30:00Z",
  "extraction_status": "REJECTED",
  "rejection_reasons": ["no_action_detected", "no_price_information"],
  "extraction_method": "none",
  "confidence": 0.15
}
```

**Dependencies:**
- Input from Signal Filter
- SIGNAL_EXTRACTION_ENGINE.md rules
- Pattern matching and context extraction

---

### Decision Rules Engine
**Sends to:** Output Generator (for ACCEPT, REVIEW, REJECT)

**Data package:**
```json
{
  "message_id": "123456",
  "source": "telegram_channel_name",
  "timestamp": "2026-04-10T14:30:00Z",
  "decision": "ACCEPT",
  "score": 95,
  "extraction_status": "VALID",
  "hard_gates": "PASSED",
  "reasoning": {
    "extraction_status": 25,
    "entry_confidence": 20,
    "structure_score": 20,
    "risk_management": 20,
    "rr_estimation": 10
  },
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": 2025.50,
    "stop_loss": 2018.00,
    "take_profit": 2035.00
  }
}
```

**Dependencies:**
- Input from Signal Extraction Engine
- DECISION_RULES.md rules
- Hard Reject Gates and Accept Gates

---

### Output Generator
**Sends to:** Data Manager

**Data package (ACCEPT):**
```json
{
  "signal_id": "SIGNAL_001",
  "message_id": "123456",
  "source": "telegram_channel_name",
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
    "extraction_confidence": 0.92,
    "decision_score": 95,
    "processing_time_ms": 1200
  },
  "action": "Process immediately"
}
```

**Data package (REVIEW):**
```json
{
  "signal_id": "SIGNAL_002",
  "message_id": "123457",
  "source": "telegram_channel_name",
  "timestamp": "2026-04-10T14:31:00Z",
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
    "extraction_confidence": 0.85,
    "decision_score": 72,
    "processing_time_ms": 1500
  },
  "concerns": ["conditional_entry", "moderate_score"],
  "action": "Manual review required"
}
```

**Dependencies:**
- Input from Decision Rules Engine
- FINAL_OUTPUT_SCHEMA.md format
- JSON generation logic

---

### Data Manager
**Sends to:** Human Reviewer (for REVIEW signals)

**Data package for Review Queue:**
```json
{
  "signal_id": "SIGNAL_002",
  "message_id": "123457",
  "source": "telegram_channel_name",
  "timestamp": "2026-04-10T14:31:00Z",
  "decision": "REVIEW",
  "priority": "MEDIUM",
  "signal": {
    "action": "BUY",
    "instrument": "GOLD",
    "entry_price": "above 2030",
    "stop_loss": 2020.00,
    "take_profit": 2050.00
  },
  "review_context": {
    "extraction_status": "VALID",
    "decision_score": 72,
    "concerns": ["conditional_entry"],
    "source_history": {
      "accuracy_last_30_days": 0.78,
      "total_signals": 45
    }
  }
}
```

**Dependencies:**
- Input from Output Generator
- Input from Signal Filter (TYPE_3)
- Input from Signal Extraction Engine (REJECTED)
- Database storage system
- Analytics tracking

---

### Human Reviewer
**Sends to:** Data Manager (updated decision)

**Data package (Updated Decision):**
```json
{
  "signal_id": "SIGNAL_002",
  "original_decision": "REVIEW",
  "final_decision": "ACCEPT",
  "reviewer_id": "human_reviewer_01",
  "review_timestamp": "2026-04-10T14:35:00Z",
  "review_reasoning": "Conditional entry acceptable given source quality",
  "updated_metadata": {
    "human_override": true,
    "review_time_minutes": 4
  }
}
```

**Dependencies:**
- Input from Data Manager
- Review interface
- Decision override capability

## Simple Interaction Map

```
Data Source Manager
        |
        v
Message Processor
        |
        v
Signal Filter
   /         \
  v           v
Extraction    Data Manager (TYPE_3, REJECTED)
Engine
        |
        v
Decision Engine
        |
        v
Output Generator
        |
        v
Data Manager
        |
        v
Human Reviewer (REVIEW only)
        |
        v
Data Manager (updated)
```

## Key Dependencies

### Critical Dependencies
- **Data Source Manager** requires Telegram API access
- **Signal Filter** requires up-to-date filtering rules
- **Extraction Engine** requires pattern definitions
- **Decision Engine** requires current decision rules
- **Data Manager** requires database connectivity

### Data Flow Dependencies
- Each module requires complete input from previous module
- No module can skip the previous step
- All modules must maintain data integrity
- Error handling must pass through the chain

### Performance Dependencies
- Processing time accumulates across modules
- Database I/O affects Data Manager performance
- Human review creates bottleneck for REVIEW signals
- Source quality affects downstream processing efficiency

## Failure Handling

### Module Failure Recovery
- **Data Source Manager**: Reconnect to Telegram
- **Message Processor**: Queue messages for retry
- **Signal Filter**: Default to TYPE_3 (safe)
- **Extraction Engine**: Default to REJECTED (safe)
- **Decision Engine**: Default to REJECT (safe)
- **Output Generator**: Log error and notify
- **Data Manager**: Queue for retry
- **Human Reviewer**: Escalate to backup reviewer

### Data Loss Prevention
- All modules log all inputs and outputs
- Critical data stored before processing
- Rollback capability for failed decisions
- Audit trail maintained for all operations
