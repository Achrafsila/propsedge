# End-to-End MVP Workflow

## Complete Functional Flow

```
Telegram Source
    |
    v
Message Intake
    |
    v
Signal Filter
    |
    v
Signal Extraction
    |
    v
Decision Engine
    |
    v
Final Output
    |
    v
Storage / Tracking
    |
    v
Manual Review Loop
```

## Step-by-Step Workflow

### Step 1: Telegram Source
**Purpose:** Capture raw trading signals from Telegram channels
**Input:** Telegram messages (text, images, forwarded content)
**Output:** Raw message data with metadata
**Decision Point:** Is this a trading signal message?
**Owner/Module:** Data Source Manager

**Process:**
- Connect to approved Telegram channels
- Monitor new messages in real-time
- Capture message content, timestamp, source info
- Forward all messages to intake system

### Step 2: Message Intake
**Purpose:** Standardize and prepare messages for processing
**Input:** Raw Telegram messages
**Output:** Standardized message objects
**Decision Point:** Is message worth processing?
**Owner/Module:** Message Processor

**Process:**
- Clean and normalize message content
- Extract basic metadata (timestamp, source, message ID)
- Remove duplicates and spam
- Route to Signal Filter

### Step 3: Signal Filter
**Purpose:** Separate trading signals from noise
**Input:** Standardized message objects
**Output:** Filtered signals (TYPE_1, TYPE_2, TYPE_3)
**Decision Point:** Is this a valid trading signal?
**Owner/Module:** Signal Filter

**Process:**
- Apply filtering rules (see SIGNAL_FILTER_RULES.md)
- Classify messages:
  - TYPE_1_STRUCTURED: Clear trading signals
  - TYPE_2_SEMI_STRUCTURED: Partial signals
  - TYPE_3_NOISE: Non-trading content
- Reject TYPE_3 messages
- Forward TYPE_1 and TYPE_2 to extraction

### Step 4: Signal Extraction
**Purpose:** Extract and normalize trading parameters
**Input:** TYPE_1 and TYPE_2 signals
**Output:** Structured signal data (VALID/PARTIAL/REJECTED)
**Decision Point:** Can we extract usable trading data?
**Owner/Module:** Signal Extraction Engine

**Process:**
- Apply extraction patterns (see SIGNAL_EXTRACTION_ENGINE.md)
- Extract critical fields: action, instrument, entry, SL, TP
- Normalize numbers and formats
- Classify extraction results:
  - VALID: All critical fields present
  - PARTIAL: Some fields missing but usable
  - REJECTED: Cannot extract usable data
- Forward VALID and PARTIAL to Decision Engine

### Step 5: Decision Engine
**Purpose:** Evaluate signal quality and safety
**Input:** VALID and PARTIAL extracted signals
**Output:** Decision results (ACCEPT/REVIEW/REJECT)
**Decision Point:** Is this signal safe and valuable?
**Owner/Module:** Decision Rules Engine

**Process:**
- Apply Hard Reject Gates (safety checks)
- Apply Accept Gates (quality checks)
- Calculate weighted score (0-100)
- Make final decision:
  - ACCEPT: High quality, safe, ready for trading
  - REVIEW: Usable but needs human evaluation
  - REJECT: Unsafe or low quality
- Route to appropriate output

### Step 6: Final Output
**Purpose:** Generate unified, actionable signal data
**Input:** Decision results from Decision Engine
**Output:** Standardized JSON outputs
**Decision Point:** How should this signal be handled?
**Owner/Module:** Output Generator

**Process:**
- Create unified JSON schema (see FINAL_OUTPUT_SCHEMA.md)
- Include all relevant metadata and reasoning
- Generate three output types:
  - ACCEPT: Ready for immediate processing
  - REVIEW: Ready for manual evaluation
  - REJECT: Logged and archived
- Route to appropriate storage/tracking

### Step 7: Storage / Tracking
**Purpose:** Store results and track performance
**Input:** Final JSON outputs
**Output:** Stored records and analytics data
**Decision Point:** How should we organize this data?
**Owner/Module:** Data Manager

**Process:**
- Store all signals in database
- Track source performance over time
- Maintain audit trail of all decisions
- Generate performance metrics
- Route REVIEW signals to manual review queue

### Step 8: Manual Review Loop
**Purpose:** Human evaluation of REVIEW signals
**Input:** REVIEW signals from storage
**Output:** Updated decisions and feedback
**Decision Point:** Should this signal be accepted or rejected?
**Owner/Module:** Human Reviewer

**Process:**
- Present REVIEW signals to human reviewer
- Provide all relevant context and reasoning
- Allow reviewer to override decisions
- Capture feedback for system learning
- Update final signal status
- Return to storage with final decision

## Decision Paths

### ACCEPT Path
```
Telegram Source
    |
    v
Message Intake (PASS)
    |
    v
Signal Filter (TYPE_1 or TYPE_2)
    |
    v
Signal Extraction (VALID)
    |
    v
Decision Engine (Hard Reject: PASS, Accept Gates: PASS, Score: 80+)
    |
    v
Final Output (ACCEPT)
    |
    v
Storage (Ready for Trading)
```

### REVIEW Path
```
Telegram Source
    |
    v
Message Intake (PASS)
    |
    v
Signal Filter (TYPE_1 or TYPE_2)
    |
    v
Signal Extraction (VALID or PARTIAL)
    |
    v
Decision Engine (Hard Reject: PASS, Score: 60-79 OR PARTIAL with 60+)
    |
    v
Final Output (REVIEW)
    |
    v
Storage (Manual Review Queue)
    |
    v
Manual Review Loop (Human Decision)
```

### REJECT Path
```
Telegram Source
    |
    v
Message Intake (PASS)
    |
    v
Signal Filter (TYPE_3 OR Hard Reject)
    |
    v
Signal Extraction (REJECTED OR Hard Reject)
    |
    v
Decision Engine (Hard Reject: FAIL OR Score: <60)
    |
    v
Final Output (REJECT)
    |
    v
Storage (Archive)
```

## Module Sequence

1. **Data Source Manager** (Telegram Source)
2. **Message Processor** (Message Intake)
3. **Signal Filter** (Signal Filter)
4. **Signal Extraction Engine** (Signal Extraction)
5. **Decision Rules Engine** (Decision Engine)
6. **Output Generator** (Final Output)
7. **Data Manager** (Storage/Tracking)
8. **Human Reviewer** (Manual Review Loop)

## Key Decision Points

| Step | Decision | Impact | Next Step |
|------|----------|--------|-----------|
| Message Intake | Process or ignore? | Filter spam | Signal Filter or Archive |
| Signal Filter | Trading signal or noise? | Route to extraction | Extraction or Archive |
| Signal Extraction | Extractable data? | Route to decision | Decision Engine or Archive |
| Decision Engine | Safe and valuable? | Final decision | Output or Archive |
| Manual Review | Accept or reject? | Final status | Storage with decision |

## Performance Metrics

### Filter Metrics
- Signal detection rate
- False positive rate
- Noise rejection rate

### Extraction Metrics
- Extraction success rate
- Field completeness rate
- Normalization accuracy

### Decision Metrics
- Accept rate
- Review rate
- Reject rate
- Decision accuracy

### Overall Metrics
- End-to-end processing time
- Source quality scores
- Human review efficiency

## MVP Success Criteria

### Functional Requirements
- Process 100+ signals per day
- <5 second processing time per signal
- 95%+ signal classification accuracy
- Complete audit trail for all decisions

### Quality Requirements
- Zero dangerous signals accepted
- <10% false positive rate
- Clear decision reasoning for all outputs
- Human review queue <24 hours backlog

### Operational Requirements
- 24/7 automated processing
- Real-time signal alerts for ACCEPT signals
- Daily performance reports
- Manual review interface with all context
