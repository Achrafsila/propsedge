#!/usr/bin/env python3
"""
Test script for Price Action Validator
Analyzes XAUUSD chart data for engulfing patterns across H4, M15, M5 timeframes
"""

import json
from datetime import datetime

# Real OHLCV data from XAUUSD chart (April 15, 2026)
h4_candles = [
    # Last 3 candles
    {"time": 1776171600, "open": 4771.475, "high": 4820.34, "low": 4771.185, "close": 4810.075},
    {"time": 1776186000, "open": 4810.12, "high": 4846.37, "low": 4809.54, "close": 4841.76},
    {"time": 1776200400, "open": 4849.155, "high": 4850.88, "low": 4833.195, "close": 4839.565},
]

m15_candles = [
    # Last 3 candles
    {"time": 1776205800, "open": 4840.15, "high": 4843.3, "low": 4837.71, "close": 4840.24},
    {"time": 1776206700, "open": 4840.3, "high": 4840.51, "low": 4833.195, "close": 4835.26},
    {"time": 1776207600, "open": 4835.14, "high": 4844.315, "low": 4833.68, "close": 4839.59},
]

m5_candles = [
    # Last 3 candles
    {"time": 1776207300, "open": 4836.055, "high": 4836.74, "low": 4833.195, "close": 4835.26},
    {"time": 1776207600, "open": 4835.14, "high": 4838.4, "low": 4833.68, "close": 4837.4},
    {"time": 1776207900, "open": 4837.39, "high": 4844.315, "low": 4837.275, "close": 4839.475},
]

def get_candle_body(candle):
    """Calculate candle body size in pips"""
    return abs(candle["close"] - candle["open"])

def get_candle_direction(candle):
    """Return 'BULLISH', 'BEARISH', or 'DOJI'"""
    body = get_candle_body(candle)
    if body < 5:
        return "DOJI"
    elif candle["close"] > candle["open"]:
        return "BULLISH"
    else:
        return "BEARISH"

def detect_bullish_engulfing(candle_n_minus_1, candle_n):
    """
    Detect bullish engulfing pattern
    - N-1 is bearish or neutral
    - N closes ABOVE the OPEN of N-1
    - N body fully engulfs N-1 body
    """
    body_n_minus_1 = get_candle_body(candle_n_minus_1)
    body_n = get_candle_body(candle_n)
    direction_n_minus_1 = get_candle_direction(candle_n_minus_1)

    # N-1 must be bearish or doji
    if direction_n_minus_1 == "BULLISH":
        return False, "N-1 is bullish"

    # N must be bullish
    if get_candle_direction(candle_n) != "BULLISH":
        return False, "N is not bullish"

    # N closes ABOVE the OPEN of N-1
    if candle_n["close"] <= candle_n_minus_1["open"]:
        return False, f"N close ({candle_n['close']}) not above N-1 open ({candle_n_minus_1['open']})"

    # N body fully engulfs N-1 body
    n_minus_1_high = max(candle_n_minus_1["open"], candle_n_minus_1["close"])
    n_minus_1_low = min(candle_n_minus_1["open"], candle_n_minus_1["close"])
    n_high = max(candle_n["open"], candle_n["close"])
    n_low = min(candle_n["open"], candle_n["close"])

    if not (n_high >= n_minus_1_high and n_low <= n_minus_1_low):
        return False, "N does not fully engulf N-1 body"

    # Quality checks
    if body_n < 15:
        return False, f"N body too small: {body_n:.2f} pips (min 15)"

    return True, f"VALID: Body {body_n:.2f} pips, engulfs N-1 ({body_n_minus_1:.2f} pips)"

def detect_bearish_engulfing(candle_n_minus_1, candle_n):
    """
    Detect bearish engulfing pattern
    - N-1 is bullish or neutral
    - N closes BELOW the OPEN of N-1
    - N body fully engulfs N-1 body
    """
    body_n_minus_1 = get_candle_body(candle_n_minus_1)
    body_n = get_candle_body(candle_n)
    direction_n_minus_1 = get_candle_direction(candle_n_minus_1)

    # N-1 must be bullish or doji
    if direction_n_minus_1 == "BEARISH":
        return False, "N-1 is bearish"

    # N must be bearish
    if get_candle_direction(candle_n) != "BEARISH":
        return False, "N is not bearish"

    # N closes BELOW the OPEN of N-1
    if candle_n["close"] >= candle_n_minus_1["open"]:
        return False, f"N close ({candle_n['close']}) not below N-1 open ({candle_n_minus_1['open']})"

    # N body fully engulfs N-1 body
    n_minus_1_high = max(candle_n_minus_1["open"], candle_n_minus_1["close"])
    n_minus_1_low = min(candle_n_minus_1["open"], candle_n_minus_1["close"])
    n_high = max(candle_n["open"], candle_n["close"])
    n_low = min(candle_n["open"], candle_n["close"])

    if not (n_high >= n_minus_1_high and n_low <= n_minus_1_low):
        return False, "N does not fully engulf N-1 body"

    # Quality checks
    if body_n < 15:
        return False, f"N body too small: {body_n:.2f} pips (min 15)"

    return True, f"VALID: Body {body_n:.2f} pips, engulfs N-1 ({body_n_minus_1:.2f} pips)"

def analyze_timeframe(candles, name):
    """Analyze a timeframe for engulfing patterns"""
    print(f"\n{'='*60}")
    print(f"ANALYZING {name}")
    print(f"{'='*60}")

    for i in range(len(candles) - 1):
        candle_n_minus_1 = candles[i]
        candle_n = candles[i + 1]

        print(f"\nCandle pair {i} → {i+1}:")
        print(f"  N-1: O={candle_n_minus_1['open']} H={candle_n_minus_1['high']} " +
              f"L={candle_n_minus_1['low']} C={candle_n_minus_1['close']} " +
              f"({get_candle_direction(candle_n_minus_1)}) | Body: {get_candle_body(candle_n_minus_1):.2f} pips")
        print(f"  N:   O={candle_n['open']} H={candle_n['high']} " +
              f"L={candle_n['low']} C={candle_n['close']} " +
              f"({get_candle_direction(candle_n)}) | Body: {get_candle_body(candle_n):.2f} pips")

        # Test bullish engulfing
        is_bullish, msg_bullish = detect_bullish_engulfing(candle_n_minus_1, candle_n)
        print(f"  ↑ Bullish: {msg_bullish}")

        # Test bearish engulfing
        is_bearish, msg_bearish = detect_bearish_engulfing(candle_n_minus_1, candle_n)
        print(f"  ↓ Bearish: {msg_bearish}")

def main():
    print("\n" + "="*60)
    print("PRICE ACTION VALIDATOR - XAUUSD CHART TEST")
    print("="*60)
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Symbol: XAUUSD (Gold)")
    print(f"Testing for: BULLISH & BEARISH engulfing patterns")

    # Analyze each timeframe
    analyze_timeframe(h4_candles, "H4 (4-Hour)")
    analyze_timeframe(m15_candles, "M15 (15-Minute)")
    analyze_timeframe(m5_candles, "M5 (5-Minute)")

    print(f"\n{'='*60}")
    print("TEST COMPLETE")
    print(f"{'='*60}")
    print("\nNext step: Feed detected engulfings to Price Action Validator")
    print("with confluence zone data for full validation")

if __name__ == "__main__":
    main()
