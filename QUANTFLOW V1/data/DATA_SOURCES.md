# Data Sources Framework

## Source Selection Criteria

### Primary Focus: Telegram Trading Channels
- **Accessibility**: Public or semi-public trading signal groups
- **Activity Level**: Minimum 5-10 GOLD signals per day
- **Signal Quality**: History of providing actionable trading signals
- **Specialization**: Focus on GOLD/XAUUSD signals required
- **Reliability**: Consistent posting schedule and format

### MVP Source Limit: Maximum 7 Channels
- **Phase 1**: 3 high-quality channels (Week 1-2)
- **Phase 2**: Add 2 additional channels (Week 3-4)
- **Phase 3**: Add 2 experimental channels (Week 5-6)
- **Total Cap**: 7 channels maximum for MVP

## Source Scoring System (0-100)

### Scoring Components
1. **Signal Quality (40 points)**
   - Completeness: 15 points (all required fields)
   - Clarity: 15 points (unambiguous format)
   - Accuracy: 10 points (historical success rate)

2. **Consistency (25 points)**
   - Format consistency: 10 points
   - Posting frequency: 10 points
   - Timing reliability: 5 points

3. **Reliability (20 points)**
   - Historical performance: 10 points
   - Source credibility: 5 points
   - Community trust: 5 points

4. **Activity Level (15 points)**
   - Daily signal count: 10 points
   - Community engagement: 5 points

### Quality Tiers
- **90-100**: Premium (immediate inclusion)
- **75-89**: High Quality (priority inclusion)
- **60-74**: Acceptable (consider for MVP)
- **Below 60**: Reject (not suitable for MVP)

## What Makes a High-Quality Telegram Group?

### Essential Requirements
1. **Clear Signal Format**: Consistent, structured signal posting
2. **Complete Information**: All required fields (action, SL, TP, entry)
3. **GOLD Focus**: Primary focus on GOLD/XAUUSD trading
4. **Regular Activity**: Minimum 5 signals per day
5. **Professional Presentation**: Clean, spam-free communication

### Quality Indicators
- **Structured Format**: "BUY GOLD at price SL: price TP: price"
- **No Ambiguity**: Clear, direct language without "maybe", "consider"
- **Price Logic**: Correct SL/TP placement for BUY/SELL
- **Timeliness**: Signals posted during market hours
- **Community**: Active, engaged followers
- **Transparency**: Open about wins and losses

### Professional Standards
- **No Spam**: Limited promotional content
- **Educational Value**: Some market analysis included
- **Risk Management**: Consistent SL/TP ratios
- **Realistic Claims**: No guaranteed profit promises
- **Verification**: Track record or performance history

## Red Flags (Low Quality Sources)

### Automatic Rejection Criteria
1. **Excessive Spam**: >30% promotional content
2. **Guaranteed Profits**: Claims of 100% success rate
3. **No Clear Format**: Inconsistent signal structure
4. **Missing Information**: Regularly missing SL/TP
5. **Question Format**: Signals posted as questions
6. **Multiple Instruments**: Confusing mix of different assets

### Quality Warning Signs
- **Inconsistent Timing**: Random posting schedule
- **Vague Language**: "around", "near", "about" prices
- **No Risk Management**: Missing or inconsistent SL
- **Over-promising**: Unrealistic profit claims
- **Low Engagement**: No community interaction
- **Copy-Paste**: Identical signals across channels

### Performance Red Flags
- **High Failure Rate**: <40% signal success rate
- **Poor Risk-Reward**: Consistently bad RR ratios
- **Delayed Signals**: Posted after price movement
- **No Accountability**: Deleting losing signals
- **Inflated Results**: Misleading performance claims

## Signal Types Classification

### TYPE_1_STRUCTURED
**Characteristics:**
- Complete trading information
- Standard format
- All required fields present
- Clear action and parameters

**Example:**
```
BUY GOLD at 2025.50
SL: 2018.00
TP: 2035.00
```

### TYPE_2_SEMI_STRUCTURED
**Characteristics:**
- Partial trading information
- Mixed format
- Some required fields missing
- Action clear but parameters incomplete

**Example:**
```
Gold looks bullish, buy around 2025
Stop around 2018
```

### TYPE_3_NOISE
**Characteristics:**
- No trading signal
- General market commentary
- Questions or discussions
- News or analysis without specific trade

**Example:**
```
Gold is looking strong today
What do you guys think?
```

## Quality Scoring Approach

### Scoring Factors (0-100 scale)

#### Completeness Score (40 points)
- Action (BUY/SELL): 10 points
- Instrument (GOLD/XAUUSD): 10 points
- Stop Loss: 10 points
- Take Profit: 10 points

#### Clarity Score (30 points)
- Clear price levels: 15 points
- Unambiguous language: 15 points

#### Format Score (20 points)
- Structured format: 10 points
- Consistent with channel style: 10 points

#### Source Reliability (10 points)
- Based on historical performance
- Channel tier rating

### Quality Tiers
- **90-100**: Premium quality signals
- **70-89**: Good quality signals
- **50-69**: Acceptable quality signals
- **Below 50**: Low quality, likely noise

## Source Evaluation Template

### Channel Evaluation Scorecard

| Criteria | Score (0-100) | Weight | Weighted Score | Notes |
|----------|---------------|---------|----------------|-------|
| **Signal Quality** | | 40% | | |
| - Completeness | | 15% | | All required fields present |
| - Clarity | | 15% | | Clear, unambiguous format |
| - Accuracy | | 10% | | Historical success rate |
| **Consistency** | | 25% | | |
| - Format | | 10% | | Consistent signal structure |
| - Frequency | | 10% | | Regular posting schedule |
| - Timing | | 5% | | Posted during market hours |
| **Reliability** | | 20% | | |
| - Performance | | 10% | | Historical win rate |
| - Credibility | | 5% | | Professional reputation |
| - Trust | | 5% | | Community feedback |
| **Activity** | | 15% | | |
| - Signal Count | | 10% | | Daily signal volume |
| - Engagement | | 5% | | Community interaction |
| **TOTAL SCORE** | | 100% | | |

### Evaluation Process

#### Step 1: Initial Screening (Day 1-3)
- Monitor channel for 72 hours
- Count total GOLD signals posted
- Check format consistency
- Identify red flags

#### Step 2: Quality Assessment (Day 4-7)
- Analyze signal completeness
- Verify price logic correctness
- Check for spam/promotional content
- Evaluate community engagement

#### Step 3: Performance Review (Week 2-4)
- Track signal success rate
- Monitor risk-reward ratios
- Assess timing reliability
- Compare with other sources

#### Step 4: Final Scoring (End of Week 4)
- Calculate weighted score
- Compare against minimum threshold (60)
- Make inclusion/exclusion decision
- Document reasoning

## Data Collection Strategy

### MVP Channel Selection Timeline

#### Phase 1: Foundation (Week 1-2)
**Target**: 3 Premium/High-Quality Channels
- **Selection Criteria**: Score 75+
- **Focus**: Proven track record, consistent format
- **Monitoring**: Full-time monitoring
- **Evaluation**: Real-time quality assessment

#### Phase 2: Expansion (Week 3-4)
**Target**: Add 2 Additional Channels
- **Selection Criteria**: Score 60-74
- **Focus**: Emerging quality sources
- **Monitoring**: Part-time monitoring
- **Evaluation**: Compare performance with Phase 1

#### Phase 3: Experimentation (Week 5-6)
**Target**: Add 2 Experimental Channels
- **Selection Criteria**: Score 50-59 with potential
- **Focus**: New channels with improvement potential
- **Monitoring**: Limited monitoring
- **Evaluation**: Improvement tracking

### Monitoring Schedule
- **Real-time**: Continuous monitoring during market hours (8 AM - 8 PM EST)
- **Batch Processing**: Historical data analysis every 24 hours
- **Quality Review**: Weekly performance assessment
- **Monthly Review**: Channel re-evaluation and potential replacement

### Data Storage Strategy
- **Raw Messages**: Archived for 30 days (for analysis)
- **Processed Signals**: Stored indefinitely (for backtesting)
- **Source Metrics**: Tracked continuously (performance monitoring)
- **Rejection Logs**: Stored for 90 days (quality improvement)
- **Channel Performance**: Monthly reports (decision making)

### Channel Replacement Policy
- **Performance Drop**: Score falls below 50 for 2 consecutive weeks
- **Quality Degradation**: Consistent format issues or spam increase
- **Activity Decline**: Signal count drops below 3/day for 1 week
- **Replacement Process**: 1 week overlap, then switch
