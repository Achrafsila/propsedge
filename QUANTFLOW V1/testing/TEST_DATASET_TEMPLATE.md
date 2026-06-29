# Test Dataset Template

## Recommended Test Dataset Structure

### Overall Composition
- **Total Messages**: 200-500 messages for comprehensive testing
- **Source Variety**: 3-5 different Telegram channels
- **Time Period**: 1-2 weeks of realistic activity
- **Message Types**: Mix of text, images, forwarded content

### 5 Categories of Test Messages

## 1. Valid Structured Messages (30-40%)
**Purpose:** Test perfect signal extraction and decision making

**Characteristics:**
- Clear BUY/SELL action
- Explicit GOLD/XAUUSD instrument
- Fixed entry price
- Numeric stop loss and take profit
- No ambiguity or conditional language
- Proper price logic (SL/TP in correct direction)

**Sample Volume:** 60-200 messages
**Expected Outcome:** High ACCEPT rate (70-90%)

**Examples:**
```
"BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00"
"SELL XAUUSD at 2025.00 SL: 2030.00 TP: 2015.00"
"BUY GOLD entry 2025.50 stop 2018.00 target 2035.00"
"SELL GOLD at 2025.50 with SL 2030.00 TP 2015.00"
```

**Sub-categories:**
- **Standard format** (50%): "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00"
- **Alternative format** (30%): "BUY GOLD entry 2025.50 stop 2018.00 target 2035.00"
- **Verbose format** (20%): "Strong BUY signal for GOLD at 2025.50, set stop loss at 2018.00, take profit at 2035.00"

## 2. Valid Semi-Structured Messages (20-30%)
**Purpose:** Test extraction flexibility and conditional handling

**Characteristics:**
- Clear action and instrument
- Entry price ranges or conditional entries
- Complete risk management (SL/TP)
- Some ambiguity in entry conditions
- Generally usable trading ideas

**Sample Volume:** 40-150 messages
**Expected Outcome:** Mixed ACCEPT/REVIEW (30-70% ACCEPT)

**Examples:**
```
"BUY GOLD if price above 2030 SL: 2020.00 TP: 2050.00"
"SELL GOLD between 2025-2030 SL: 2035.00 TP: 2015.00"
"BUY GOLD when price breaks 2030, stop 2020, target 2050"
"Consider selling gold in 2025-2030 range, SL 2035, TP 2015"
```

**Sub-categories:**
- **Conditional entry** (40%): "BUY GOLD if price above 2030"
- **Range entry** (40%): "SELL GOLD between 2025-2030"
- **Semi-verbose** (20%): "Looking to buy gold if we see price above 2030"

## 3. Partial Messages (15-25%)
**Purpose:** Test partial extraction and REVIEW decision logic

**Characteristics:**
- Action and instrument present
- Some critical fields missing (entry, SL, or TP)
- Usable trading idea but incomplete
- Requires human review to complete

**Sample Volume:** 30-125 messages
**Expected Outcome:** Mostly REVIEW (80-95% REVIEW)

**Examples:**
```
"Consider buying gold around 2025, stop around 2018"
"BUY GOLD with SL 2018.00"
"SELL GOLD at 2025.50"
"Gold looks bullish, might buy around 2025"
```

**Sub-categories:**
- **Missing TP** (40%): Entry and SL present, TP missing
- **Missing SL** (30%): Entry and TP present, SL missing
- **Missing Entry** (20%): SL and TP present, entry missing
- **Very partial** (10%): Only action and instrument

## 4. Noise Messages (10-20%)
**Purpose:** Test noise rejection and false positive prevention

**Characteristics:**
- No trading signal content
- General market commentary
- Questions or discussions
- Charts, images without text signals
- Non-trading content

**Sample Volume:** 20-100 messages
**Expected Outcome:** 100% REJECT

**Examples:**
```
"Check out this gold chart!"
"What do you think about gold today?"
"Great analysis, thanks for sharing"
"Anyone trading gold today?"
"Gold is looking interesting"
```

**Sub-categories:**
- **Market commentary** (40%): "Gold is looking strong today"
- **Questions** (30%): "What's your view on gold?"
- **General chat** (20%): "Thanks for the analysis"
- **Images only** (10%): Image posts without text signals

## 5. Contradictory Messages (5-10%)
**Purpose:** Test safety gates and contradiction detection

**Characteristics:**
- Conflicting information
- Price logic errors
- Multiple actions or instruments
- Impossible scenarios
- Dangerous or unsafe signals

**Sample Volume:** 10-50 messages
**Expected Outcome:** 100% REJECT (hard reject)

**Examples:**
```
"BUY and SELL GOLD at 2025.50 SL: 2018.00 TP: 2035.00"
"BUY GOLD at 2025.50 SL: 2030.00 TP: 2035.00"
"BUY GOLD and SILVER at 2025.50"
"BUY GOLD at 2025.50 SL: 2018.00 TP: 2010.00"
"SELL GOLD at 2025.50 SL: 2020.00 TP: 2030.00"
```

**Sub-categories:**
- **Multiple actions** (30%): "BUY and SELL GOLD"
- **Price logic errors** (30%): SL above entry for BUY
- **Multiple instruments** (20%): "BUY GOLD and SILVER"
- **Impossible RR** (20%): TP closer than SL

## Source Distribution

### Recommended Source Mix
- **High-quality source** (40%): Professional signals, mostly valid
- **Medium-quality source** (35%): Mixed quality, some partial signals
- **Low-quality source** (25%): Mostly noise and contradictory

### Source Examples
- **GoldSignalsPro**: Professional, mostly TYPE_1 structured
- **GoldTradingExperts**: Mixed, some TYPE_2 semi-structured
- **CasualGoldChat**: Mostly noise and discussion
- **GoldAnalysisGroup**: Analysis with occasional signals
- **GoldTipsDaily**: Variable quality, some contradictions

## Time Distribution

### Realistic Timing
- **Market hours** (70%): Messages during active trading
- **After hours** (20%): Messages outside market hours
- **Weekend** (10%): Weekend messages and analysis

### Message Frequency
- **Peak hours** (40%): 8AM-12PM EST
- **Normal hours** (40%): 12PM-4PM EST
- **Quiet hours** (20%): 4PM-8PM EST

## Quality Metrics

### Expected Distribution
```
Valid Structured:    35%  (70-200 messages)
Valid Semi-Structured: 25%  (50-125 messages)
Partial:             20%  (40-100 messages)
Noise:               15%  (30-75 messages)
Contradictory:        5%  (10-25 messages)
```

### Success Criteria
- **Extraction accuracy**: 90%+ for valid messages
- **Noise rejection**: 95%+ for noise messages
- **Safety rejection**: 100% for contradictory messages
- **Partial detection**: 85%+ for partial messages

## Dataset Creation Process

### Step 1: Source Selection
1. Choose 3-5 representative Telegram channels
2. Collect 1-2 weeks of message history
3. Ensure mix of quality levels

### Step 2: Message Classification
1. Manually classify each message into 5 categories
2. Verify classification accuracy
3. Remove duplicates and spam

### Step 3: Quality Assurance
1. Check message completeness
2. Verify timestamp accuracy
3. Ensure source consistency
4. Validate formatting

### Step 4: Dataset Assembly
1. Combine messages from all sources
2. Ensure proper distribution
3. Add metadata and annotations
4. Create final input files

## Testing Scenarios

### Scenario 1: Ideal Conditions
- **Focus**: Valid structured messages only
- **Purpose**: Test perfect extraction and decision making
- **Size**: 50-100 messages
- **Expected**: High ACCEPT rate, low processing time

### Scenario 2: Realistic Conditions
- **Focus**: Full message distribution
- **Purpose**: Test complete system performance
- **Size**: 200-500 messages
- **Expected**: Mixed decisions, realistic performance

### Scenario 3: Stress Testing
- **Focus**: Difficult and edge cases
- **Purpose**: Test system limits
- **Size**: 100-200 messages
- **Expected**: High REVIEW/REJECT rate, thorough testing

### Scenario 4: Source Testing
- **Focus**: Single source performance
- **Purpose**: Test source-specific handling
- **Size**: 50-100 messages per source
- **Expected**: Consistent performance across sources

## Data Quality Checklist

### Content Quality
- [ ] Realistic message content
- [ ] Proper language and grammar
- [ ] Appropriate technical terminology
- [ ] No artificial or generated content

### Classification Accuracy
- [ ] Correct category assignment
- [ ] Consistent classification criteria
- [ ] Edge cases properly identified
- [ ] No ambiguous classifications

### Metadata Completeness
- [ ] All required fields present
- [ ] Accurate timestamp information
- [ ] Correct source identification
- [ ] Proper author attribution

### Distribution Balance
- [ ] Appropriate category ratios
- [ ] Source variety maintained
- [ ] Time distribution realistic
- [ ] Message types varied

## Common Pitfalls to Avoid

### Dataset Issues
- **Overfitting**: Too many similar messages
- **Bias**: Skewed toward one source or type
- **Unrealistic**: Messages don't reflect real patterns
- **Incomplete**: Missing important edge cases

### Classification Issues
- **Inconsistent**: Different criteria for similar messages
- **Too strict**: Valid messages classified as noise
- **Too lenient**: Noise classified as signals
- **Edge cases**: Missing important boundary conditions

### Quality Issues
- **Duplicates**: Same message repeated multiple times
- **Inaccurate**: Incorrect timestamps or sources
- **Incomplete**: Missing required fields
- **Inconsistent**: Variable formatting or naming
