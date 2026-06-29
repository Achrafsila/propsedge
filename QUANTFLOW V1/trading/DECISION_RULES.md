# Decision Rules Engine

## Decision Outputs

### ACCEPT
**Definition:** Signal is ready for immediate processing
**Criteria:** Passes all hard gates, high weighted score, complete information
**Action:** Process signal, generate alert, log as high-confidence

### REVIEW
**Definition:** Signal needs manual evaluation
**Criteria:** Passes hard gates, medium weighted score, some concerns
**Action:** Flag for manual review, generate low-priority alert

### REJECT
**Definition:** Signal is not usable
**Criteria:** Fails any hard gate OR low weighted score
**Action:** Reject signal, log rejection reason, no alert

## Two-Category Gate System

### Hard Reject Gates (Immediate REJECT if ANY fail)
**Signal is REJECTED immediately if ANY condition met:**

1. **Action Missing**: No BUY/SELL detected
2. **Instrument Missing**: No GOLD/XAUUSD detected
3. **Price Logic Inconsistent**: SL/TP in wrong direction for action
4. **Multiple Instruments**: More than one instrument mentioned
5. **Contradictory Information**: Conflicting prices or actions
6. **No Usable Price Information**: No numeric prices found

### Accept Gates (Must ALL pass for ACCEPT)
**Signal can be ACCEPTED only if ALL conditions met:**

1. **Extraction Status**: Must be VALID
2. **Stop Loss Present**: Numeric SL must be present
3. **Take Profit Present**: Numeric TP must be present
4. **No Hard Reject Gate Triggered**: Must pass all Hard Reject Gates
5. **Score Above Accept Threshold**: Weighted score meets minimum

### Weighted Score (0-100 points)
**Applied to all signals that pass Hard Reject Gates:**

#### 1. Extraction Status (25 points)
- **VALID**: 25 points
- **PARTIAL**: 0 points (but already filtered by hard gates)

#### 2. Entry Confidence (20 points)
- **Fixed entry**: 20 points
- **Entry range**: 15 points
- **Conditional entry**: 10 points
- **Missing entry**: 0 points (but already filtered by hard gates)

#### 3. Structure Score (20 points)
- **All fields present**: 20 points
- **Minor formatting issues**: 15 points
- **Some ambiguity**: 10 points
- **Major clarity issues**: 5 points

#### 4. Risk Management Completeness (20 points)
- **Both SL and TP present**: 20 points
- **Both present but unclear**: 15 points
- **One missing**: 0 points (but already filtered by hard gates)

#### 5. Risk-Reward Estimation (15 points)
- **RR 2.0+**: 15 points
- **RR 1.5-1.9**: 10 points
- **RR < 1.5**: 5 points
- **RR not calculable**: 0 points

## Decision Logic

### ACCEPT Conditions
**ALL must be true:**
1. **Extraction Status = VALID**
2. **SL Present** (numeric)
3. **TP Present** (numeric)
4. **No Hard Reject Gate triggered**
5. **Score 80+ points**

### REVIEW Conditions
**ANY of these paths:**
1. **VALID signal** with score 60-79 points
2. **PARTIAL signal** that passes Hard Reject Gates with score 60+ points
3. **VALID signal** with conditional entry (regardless of score)
4. **VALID signal** with range entry and score <80 points

### REJECT Conditions
**ANY condition met:**
1. **Any Hard Reject Gate triggered**
2. **Score below 60 points**
3. **Critical safety issues**

## Score Thresholds

| Score Range | Extraction Status | Decision |
|-------------|-------------------|----------|
| 80-100 | VALID | ACCEPT |
| 60-79 | VALID | REVIEW |
| 60-79 | PARTIAL | REVIEW |
| Below 60 | Any | REJECT |

## Entry Type Impact

### Fixed Entry
- **VALID + 80+ points**: ACCEPT
- **VALID + 60-79 points**: REVIEW
- **PARTIAL + 60+ points**: REVIEW

### Entry Range
- **VALID + 85+ points**: ACCEPT (higher threshold)
- **VALID + 60-84 points**: REVIEW
- **PARTIAL + 60+ points**: REVIEW

### Conditional Entry
- **VALID + any score**: REVIEW (never ACCEPT)
- **PARTIAL + 60+ points**: REVIEW

## Score Thresholds

| Score Range | Decision | Entry Type Requirements |
|-------------|----------|-------------------------|
| 80-100 | ACCEPT | Fixed entry preferred, range acceptable |
| 60-79 | REVIEW | Range/conditional entry, some concerns |
| Below 60 | REJECT | Any entry type, too many issues |

## Entry Handling Rules

### Fixed Entry
- **Can lead to ACCEPT**: 80+ points with good structure
- **Can lead to REVIEW**: 60-79 points with some issues
- **Examples**: "at 2025.50", "entry 2025"

### Entry Range
- **Can lead to ACCEPT**: 85+ points with exceptional quality
- **Usually leads to REVIEW**: 60-84 points
- **Examples**: "between 2025-2030", "2025 to 2030"

### Conditional Entry
- **Usually leads to REVIEW**: 60-79 points even with good structure
- **Can lead to ACCEPT**: 90+ points only if everything else perfect
- **Examples**: "if price above 2030", "when below 2015"

## Final Processing Examples

### Example 1: VALID Strong Signal (ACCEPT)
**Input:** "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00"

**Hard Reject Gates:** All PASS
**Accept Gates:**
- Extraction Status: VALID = PASS
- SL Present: 2018.00 = PASS
- TP Present: 2035.00 = PASS
- No Hard Reject: PASS
- Score: 100 points = PASS

**Output:** ACCEPT (Process immediately, HIGH priority)

### Example 2: VALID Range Signal (ACCEPT)
**Input:** "SELL GOLD between 2025-2030 SL: 2035.00 TP: 2015.00"

**Hard Reject Gates:** All PASS
**Accept Gates:**
- Extraction Status: VALID = PASS
- SL Present: 2035.00 = PASS
- TP Present: 2015.00 = PASS
- No Hard Reject: PASS
- Score: 90 points = PASS

**Output:** ACCEPT (Process immediately, HIGH priority)

### Example 3: VALID Conditional Signal (REVIEW)
**Input:** "BUY GOLD if price above 2030 SL: 2020.00 TP: 2050.00"

**Hard Reject Gates:** All PASS
**Accept Gates:**
- Extraction Status: VALID = PASS
- SL Present: 2020.00 = PASS
- TP Present: 2050.00 = PASS
- No Hard Reject: PASS
- Score: 85 points = PASS
- **BUT**: Conditional entry = auto REVIEW

**Output:** REVIEW (Manual review required, MEDIUM priority)

### Example 4: PARTIAL But Meaningful Signal (REVIEW)
**Input:** "Consider buying gold around 2025, stop around 2018"

**Extraction Output:** PARTIAL (missing TP)
**Hard Reject Gates:** All PASS
**Accept Gates:**
- Extraction Status: PARTIAL = FAIL (cannot ACCEPT)
- Score: 65 points = PASS for REVIEW

**Output:** REVIEW (Manual review required, MEDIUM priority)

### Example 5: PARTIAL Weak Signal (REJECT)
**Input:** "Gold might move up, maybe around 2025"

**Extraction Output:** PARTIAL (missing SL, TP, clear action)
**Hard Reject Gates:** All PASS
**Score:** 35 points = FAIL

**Output:** REJECT (Score too low)

### Example 6: Missing Action (REJECT)
**Input:** "Gold at 2025.50 SL: 2018.00 TP: 2035.00"

**Hard Reject Gates:**
- Action Missing: No BUY/SELL = FAIL

**Output:** REJECT (Hard Reject Gate triggered)

### Example 7: Invalid Price Logic (REJECT)
**Input:** "BUY GOLD at 2025.50 SL: 2030.00 TP: 2035.00"

**Hard Reject Gates:**
- Price Logic Inconsistent: SL above entry for BUY = FAIL

**Output:** REJECT (Hard Reject Gate triggered)

### Example 8: Contradictory Message (REJECT)
**Input:** "BUY and SELL GOLD at 2025.50 SL: 2018.00 TP: 2035.00"

**Hard Reject Gates:**
- Contradictory Information: Both BUY and SELL = FAIL

**Output:** REJECT (Hard Reject Gate triggered)

## Quick Reference

### Hard Reject Gates (Immediate REJECT if ANY fail)
1. Action Missing
2. Instrument Missing
3. Price Logic Inconsistent
4. Multiple Instruments
5. Contradictory Information
6. No Usable Price Information

### Accept Gates (Must ALL pass for ACCEPT)
1. Extraction Status = VALID
2. SL Present
3. TP Present
4. No Hard Reject Gate triggered
5. Score 80+ points

### Decision Summary
- **ACCEPT**: VALID + SL + TP + 80+ points + no hard rejects
- **REVIEW**: VALID with 60-79 points OR PARTIAL with 60+ points
- **REJECT**: Any hard reject OR score below 60

### Entry Type Impact
- **Fixed Entry**: VALID + 80+ = ACCEPT, VALID + 60-79 = REVIEW
- **Range Entry**: VALID + 85+ = ACCEPT, VALID + 60-84 = REVIEW
- **Conditional Entry**: Always REVIEW (never ACCEPT)
- **PARTIAL Signals**: Can go to REVIEW if 60+ points and meaningful
