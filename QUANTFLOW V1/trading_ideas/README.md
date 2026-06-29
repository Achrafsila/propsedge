# Trading Idea Engine

## Overview

**Institutional-Grade Trading Idea Generator** operating on pure liquidity dynamics and price action.

Not a signal generator. Not a trade executor. A pure **ideation system** that generates trade opportunities only when structural conditions are decidedly favorable.

---

## Core Philosophy

```
Price = Function of Liquidity Access
Retail Orders = Liquidity Pools (Resting Liquidity)
Market Moves = Institutional Capital Accessing Retail Liquidity
Stop Hunts = Deliberate SL Cluster Sweeps
Reversals = Post-Liquidation Reversal to Opposing Liquidity
```

---

## Operational Framework

### Input
- Retail positioning data (% BUY/SELL, entries)
- Liquidity clusters (SL/TP zones)
- Price action context (intraday structure)
- VWAP & Session levels

### Processing: 5-Stage Validation

```
1. Positioning Decisiveness
   ✓ Retail crowded? (>65% one side)
   ✓ Status clear? (TRAPPED or CORRECT)

2. Liquidity Definition
   ✓ SL cluster exists? (3+ signals)
   ✓ TP cluster exists? (3+ signals)

3. Structure Validity
   ✓ Stop hunt detected?
   ✓ Clear intraday bias?

4. Risk/Reward Asymmetry
   ✓ Minimum 2:1 risk/reward?

5. Confidence Threshold
   ✓ Confidence ≥ 70%?
```

If ANY stage fails → **NO TRADE** (valid decision)

### Output
```json
{
  "status": "QUALIFIED_IDEA",
  "side": "LONG",
  "entry_zone": {
    "low": 2019.50,
    "high": 2020.50,
    "pips": 10
  },
  "stop_loss": 2018.00,
  "targets": [
    {
      "level": 2025.75,
      "type": "VWAP_RETEST"
    },
    {
      "level": 2035.25,
      "type": "TP_CLUSTER"
    }
  ],
  "risk_pips": 5,
  "reward_pips": 15,
  "risk_reward_ratio": 3.0,
  "confidence": 0.85,
  "conviction": "HIGH",
  "institutional_thesis": "..."
}
```

---

## Trade Idea Anatomy

### Entry Zone (OTE: Optimal Trade Entry)
- **Width**: 5-15 pips (institutional precision)
- **Location**: SL cluster (after sweep)
- **Rationale**: Retail liquidation zone
- **Logic**: Post-SL-sweep reversal = optimal entry

### Stop Loss
- **Placement**: Beyond meaningful liquidity
- **Logic**: Structural invalidation zone
- **For LONG**: Below session low + buffer
- **For SHORT**: Above session high + buffer

### Profit Targets (Multi-Stage)
1. **Target 1 (50% position)**: VWAP level
   - Institutional fair value
   - Profit-taking zone
   - Often contested

2. **Target 2 (50% position)**: TP cluster
   - Opposing liquidity pool
   - Final liquidation zone
   - Where institutions exit

### Invalidation Level
- **Logic**: If price closes beyond this, idea structurally broken
- **For LONG**: Close above SL cluster = reversal failed
- **For SHORT**: Close below SL cluster = bounce failed

---

## Qualification Criteria

### Minimum Requirements
| Criterion | Requirement | Why |
|-----------|-------------|-----|
| Positioning Bias | >65% one side | Crowding = vulnerable |
| Status | TRAPPED or CORRECT | Clear direction |
| SL Cluster | 3+ signals | Meaningful liquidity |
| TP Cluster | 3+ signals | Clear target zone |
| Risk/Reward | ≥2.0:1 | Asymmetric opportunity |
| Confidence | ≥70% | Structural alignment |
| Invalidation | Clear level | Exit condition known |

### Rejection Reasons
```
❌ INSUFFICIENT_POSITIONING
   - Retail not decisively biased
   - Mixed positioning without conviction

❌ INSUFFICIENT_LIQUIDITY
   - No clear SL or TP clustering
   - Insufficient signal concentration

❌ UNFAVORABLE_STRUCTURE
   - No clear intraday bias
   - No stop hunt pattern

❌ POOR_RISK_REWARD
   - Risk/reward below 2:1
   - Too much risk for too little reward

❌ NO_CLEAR_INVALIDATION
   - Cannot define structural break
   - Ambiguous exit condition

❌ NO_ASYMMETRY
   - Confidence below 70%
   - Insufficient conviction
```

---

## Example Scenarios

### Scenario 1: QUALIFIED LONG
```
Retail: 80% BUY at 2025.50
Price: 2024.00 (BELOW entries = TRAPPED)
SL Cluster: 2020.00 (8 signals)
TP Cluster: 2035.25 (8 signals)
VWAP: 2025.75

IDEA: BUY at SL cluster
Entry: 2019.50-2020.50
Stop: 2018.00 (2 pips below session low)
Target 1: 2025.75 (VWAP) - 5 pips reward
Target 2: 2035.25 (TP) - 15 pips reward
Risk: 1.5 pips
Risk/Reward: 1:10 ✓ ASYMMETRIC
Confidence: 85% ✓ HIGH
Status: QUALIFIED ✅
```

### Scenario 2: REJECTED (No Crowding)
```
Retail: 55% BUY / 45% SELL
Status: MIXED positioning

REASON: Not decisively crowded
No clear directional conviction
Skip trade ✓ DISCIPLINE
```

### Scenario 3: REJECTED (Poor RR)
```
Retail: 75% BUY at 2030
Price: 2027 (TRAPPED)
SL Cluster: 2025 (risk = 4 pips)
TP Cluster: 2031 (reward = 4 pips)
Risk/Reward: 1:1 ✗ Below 2:1

Status: REJECTED (POOR_RISK_REWARD)
Skip trade ✓ DISCIPLINE
```

---

## Integration Points

### Input Source
```
LiquidityAnalyzer Output
    ↓
TradingIdeaEngine
    ↓
Trading Idea (qualified or rejected)
```

### Output Destinations
- **Google Sheets**: Idea logging & tracking
- **Dashboard**: Real-time qualified ideas
- **Telegram**: Alert on new qualified ideas
- **Backtest Engine**: Historical validation
- **Performance Analytics**: Win rate & accuracy

---

## Discipline Rules

### Core Rule 1: Only Trade Qualified Ideas
- Idea must pass ALL 5 validation stages
- Single failure = rejection
- Absence of trade = valid decision

### Core Rule 2: No Discretion on Parameters
- Entry zone: Fixed (SL cluster ± 5 pips)
- Stop: Fixed (beyond session low/high)
- Targets: Fixed (VWAP + TP cluster)
- Risk/Reward: Fixed minimum (2:1)

### Core Rule 3: Mechanical Filtering
- System rejects, not human judgment
- No "what if I just take 1:1 instead"
- No "this looks good even though it's mixed"
- Rules are absolute

### Core Rule 4: Invalidation is Sacred
- If invalidation level breached = exit
- No "let me wait for reversal"
- No "structure is actually still intact"
- Clear stop = clear exit

---

## Key Metrics

| Metric | Calculation | Interpretation |
|--------|-----------|-----------------|
| **Risk (pips)** | Entry - Stop | Capital at risk per share |
| **Reward (pips)** | Target - Entry | Maximum profit per share |
| **Risk/Reward** | Reward / Risk | Asymmetry ratio (min 2.0) |
| **Confidence** | Composite score | Likelihood of qualification |
| **Conviction** | Confidence level | Certainty of the setup |

---

## Output Files

### Text Report
```
$ python3 run_trading_idea_engine.py --analysis analysis.json

Creates formatted report with:
- Idea ID & status
- Entry/stop/targets with commentary
- Risk/reward analysis
- Institutional thesis
- Invalidation logic
- Criteria validation
```

### JSON Output
```
$ python3 run_trading_idea_engine.py --analysis analysis.json --json

Machine-readable format for:
- Database storage
- Backtest systems
- API feeds
- Dashboard integration
```

---

## Limitations & Strengths

### What Trading Ideas CANNOT Tell You
❌ Exact timing of move
❌ How far price will run
❌ When reversal will start
❌ Probability of success (qualitative only)

### What Trading Ideas CAN Tell You
✅ WHERE optimal entry should be
✅ WHERE stop should be (structural)
✅ WHERE targets are (liquidity-based)
✅ IF setup is worthy of trading (discipline)
✅ WHETHER conditions are asymmetric

---

## Operational Philosophy

> **"A trade not taken is a trade not lost."**

The system operates with precision and selectivity. It generates ideas ONLY when conditions are decidedly favorable. The majority of sessions will produce NO ideas. This is not a failure—it is the system working correctly.

Discipline > Frequency
Asymmetry > Activity
Structural > Opportunistic
Selective > Reactive

---

## Next Steps

1. **Backtest Accuracy**: Compare ideas vs actual price behavior
2. **Win Rate Tracking**: Monitor qualified ideas' outcomes
3. **Performance Analytics**: Identify best setup types
4. **Continuous Refinement**: Adjust confidence thresholds based on data
5. **Real-Time Integration**: Stream qualified ideas to traders

---

## Files

| File | Purpose |
|------|---------|
| `src/trading_idea_engine.py` | Core engine (850+ lines) |
| `scripts/run_trading_idea_engine.py` | CLI runner |
| `trading_ideas/README.md` | This file |

---

## Status

✅ **PRODUCTION READY**
- Fully tested logic
- Comprehensive validation
- Institutional framework
- Disciplined filtering
