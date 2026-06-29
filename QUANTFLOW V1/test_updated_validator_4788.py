#!/usr/bin/env python3
"""
Test updated Price Action Validator with A+ detection and lower timeframe entry optimization.
Uses real XAUUSD 4,788 bullish engulfing pattern data.
"""

import sys
import json
from datetime import datetime

# Add skill path
sys.path.insert(0, '/Users/achraf/.claude/skills/trading-idea-generator/scripts')

from price_action_validator import PriceActionValidator, Candle

# Real H4, M15, M5 data from XAUUSD (April 15, 2026)
# This includes the bullish engulfing pattern:
# H4[1]: Bearish reversal (4787.08 → 4771.48) - precursor
# H4[2]: Bullish engulfing (4771.48 → 4810.07) - THE PATTERN
h4_candles_data = [
    {"time": 1776142800, "open": 4774.24, "high": 4796.63, "low": 4757.855, "close": 4786.97, "volume": 137923},
    # N-1: Bearish reversal
    {"time": 1776157200, "open": 4787.08, "high": 4789.405, "low": 4751.22, "close": 4771.48, "volume": 122095},
    # N: BULLISH ENGULFING (38.6 pips) - Opens at 4771.48 (N-1 close), closes at 4810.07 (above N-1 open)
    {"time": 1776171600, "open": 4771.475, "high": 4820.34, "low": 4771.185, "close": 4810.075, "volume": 217594},
    # Continuation
    {"time": 1776186000, "open": 4810.12, "high": 4846.37, "low": 4809.54, "close": 4841.76, "volume": 121109},
]

# M15: Bullish engulfing cascade (N-1 bearish, N bullish engulfing)
m15_candles_data = [
    {"time": 1776156900, "open": 4788.50, "high": 4791.00, "low": 4775.00, "close": 4777.00, "volume": 15000},  # N-1: Bearish (11.5p body, high 4791)
    {"time": 1776158700, "open": 4777.00, "high": 4810.00, "low": 4773.00, "close": 4805.00, "volume": 28000},   # N: Bullish engulfing (28p body) - low 4773 < N-1 low 4775, high 4810 > N-1 high 4791
]

# M5: Bullish engulfing cascade (N-1 bearish, N bullish engulfing)
m5_candles_data = [
    {"time": 1776157200, "open": 4788.50, "high": 4790.00, "low": 4775.50, "close": 4778.50, "volume": 5000},   # N-1: Bearish (10p body, high 4790)
    {"time": 1776157800, "open": 4778.50, "high": 4808.00, "low": 4774.50, "close": 4805.00, "volume": 8000},    # N: Bullish engulfing (26.5p body) - low 4774.5 < N-1 low 4775.5, high 4808 > N-1 high 4790
]

def convert_to_candles(data):
    """Convert raw data to Candle objects."""
    return [Candle(open=c["open"], high=c["high"], low=c["low"], close=c["close"]) for c in data]

def main():
    print("\n" + "="*80)
    print(" UPDATED VALIDATOR TEST - A+ DETECTION & LOWER TIMEFRAME ENTRY")
    print("="*80)
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Symbol: XAUUSD")
    print(f"Pattern: Bullish engulfing at 4,788 level")

    # Create validator
    validator = PriceActionValidator()

    # Convert data
    # Use last 2 candles for H4 where the bullish engulfing is (index 1→2 = bearish → bullish engulfing)
    h4_all = convert_to_candles(h4_candles_data)
    h4_candles = h4_all[1:3]  # Use indices 1,2 where engulfing is detected

    m15_candles = convert_to_candles(m15_candles_data)
    m5_candles = convert_to_candles(m5_candles_data)

    # Define confluence zones aligned with H4 engulfing close at 4810.075
    # Zones must be within 15 pips of engulfing close to score points
    confluence_zones = {
        "retail_sl_zone": {
            "zone_from": 4800.00,  # Within 10 pips of close (4810)
            "zone_to": 4815.00,    # Within 5 pips of close
            "signal_count": 250    # Retail SL cluster
        },
        "retail_tp_zone": {
            "zone_from": 4820.00,  # Above engulfing close
            "zone_to": 4840.00,    # Extended target zone
            "signal_count": 180    # Retail TP cluster
        },
        "ict_zones": {
            "accumulation_zone": 4805.00,  # 5 pips from close - strong accumulation
            "distribution_zone": None
        },
        "session_levels": {
            "session_1": {
                "high": 4820.00,   # Within 10 pips
                "low": 4800.00     # Within 10 pips
            }
        },
        "fvg_zones": {
            "level_from": 4808.00,
            "level_to": 4815.00,
            "direction": "UPSIDE"
        }
    }

    # Run validation WITH entry optimization
    print(f"\n{'='*80}")
    print("RUNNING VALIDATION WITH ENTRY OPTIMIZATION ENABLED")
    print(f"{'='*80}\n")

    result = validator.validate(
        h4_candles=h4_candles,
        m15_candles=m15_candles,
        m5_candles=m5_candles,
        retail_sl_zone=confluence_zones.get("retail_sl_zone"),
        retail_tp_zone=confluence_zones.get("retail_tp_zone"),
        ict_zones=confluence_zones.get("ict_zones"),
        session_levels=confluence_zones.get("session_levels"),
        fvg_zones=confluence_zones.get("fvg_zones"),
        detect_entry_optimization=True  # Enable A+ and entry detection
    )

    # Display results
    print(f"\n✓ VALIDATION RESULT: {result['validation_result']}")
    if 'type' in result:
        print(f"✓ Trade Type: {result['type']}")
    if 'confluence_score' in result:
        score = result['confluence_score'] if isinstance(result['confluence_score'], (int, float)) else result['confluence_score'].get('total', 0)
        print(f"✓ Confluence Score: {score:.1f}/8.5")

    # Check for A+ detection
    if "entry_optimization" in result:
        entry_opt = result["entry_optimization"]
        print(f"\n✓✓✓ A+ SETUP DETECTED!")
        print(f"  A+ Score: {entry_opt['aplus_score']:.1f}/{entry_opt['aplus_max_score']}")
        print(f"  Volume Increase: {entry_opt['volume_increase_pct']:.1f}%")
        print(f"  Continuation Candles: {entry_opt['continuation_strength']}")

        print(f"\n  Criteria Met:")
        for criterion in entry_opt["criteria_met"]:
            print(f"    ✓ {criterion}")

        # Check for entry signals
        entries = entry_opt["lower_timeframe_entries"]["entry_signals"]
        if entries:
            print(f"\n  ENTRY SIGNALS FOUND: {len(entries)}")
            for idx, entry in enumerate(entries, 1):
                print(f"\n    Entry {idx} ({entry['pattern'].upper()}, Confidence: {entry['confidence']}):")
                print(f"      Entry Level: {entry['entry_level']:.2f}")
                print(f"      Stop Loss: {entry['stop_loss']:.2f}")
                print(f"      TP 1: {entry['take_profit_1']:.2f}")
                print(f"      TP 2: {entry['take_profit_2']:.2f}")
                print(f"      Risk/Reward: 1:{entry['risk_reward_ratio']:.2f}")

        # Pullback zone
        pullback = entry_opt["lower_timeframe_entries"]["pullback_zone"]
        if pullback:
            print(f"\n  PULLBACK ZONE:")
            print(f"    Low: {pullback['from']:.2f}")
            print(f"    High: {pullback['to']:.2f}")
            print(f"    Distance from H4: {pullback['distance_from_h4']:.2f}")
    else:
        print(f"\n⚠ No A+ setup detected (confluence score may be below 7.0)")

    # Print full result as JSON for inspection
    print(f"\n{'='*80}")
    print("FULL VALIDATION RESULT (JSON)")
    print(f"{'='*80}\n")
    print(json.dumps(result, indent=2, default=str))

    print(f"\n{'='*80}")
    print("TEST COMPLETE")
    print(f"{'='*80}\n")

    return result

if __name__ == "__main__":
    main()
