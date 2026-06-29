#!/usr/bin/env python3
"""
Liquidity Analysis Runner

Executes retail positioning and liquidity analysis on signal data.

Usage:
    python run_liquidity_analysis.py --signals signals.csv --price 2025.50 --high 2032.00 --low 2018.50
    python run_liquidity_analysis.py --from-sheets  # Load from Google Sheets
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import List

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from liquidity_analyzer import (
    TradingSignal,
    MarketContext,
    LiquidityAnalyzer
)


def load_signals_from_csv(filepath: str) -> List[TradingSignal]:
    """Load trading signals from CSV file"""
    import csv

    signals = []
    try:
        with open(filepath, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    signal = TradingSignal(
                        direction=row['direction'].upper(),
                        entry=float(row['entry']),
                        sl=float(row['sl']),
                        tp=float(row['tp']),
                    )
                    signals.append(signal)
                except (ValueError, KeyError) as e:
                    print(f"Warning: Skipping malformed row: {row} - {e}")
                    continue

        print(f"✓ Loaded {len(signals)} signals from {filepath}")
        return signals

    except FileNotFoundError:
        print(f"✗ File not found: {filepath}")
        sys.exit(1)


def load_signals_from_google_sheets() -> List[TradingSignal]:
    """Load signals from Google Sheets (placeholder - requires gspread setup)"""
    print("Google Sheets integration not yet implemented")
    print("Please provide signals via CSV file instead")
    sys.exit(1)


def generate_report(analysis: dict, output_file: str = None) -> str:
    """Generate formatted analysis report"""

    report = []
    report.append("=" * 80)
    report.append("RETAIL POSITIONING & LIQUIDITY ANALYSIS REPORT")
    report.append("=" * 80)
    report.append(f"\nAnalysis Timestamp: {analysis['timestamp']}")
    report.append("")

    # 1. RETAIL BIAS
    report.append("1. RETAIL POSITIONING BIAS")
    report.append("-" * 40)
    bias = analysis['retail_bias']
    report.append(f"BUY Signals: {bias['buy_count']} ({bias['buy_percent']}%)")
    report.append(f"SELL Signals: {bias['sell_count']} ({bias['sell_percent']}%)")
    report.append(f"Dominant Bias: {bias['dominant_bias']}")
    report.append(f"Crowding Level: {bias['crowding_level']}")
    report.append(f"Interpretation: {bias['interpretation']}")
    report.append("")

    # Entry Statistics
    entry_stats = analysis['entry_stats']
    if entry_stats:
        report.append("Entry Price Statistics:")
        report.append(f"  Average: ${entry_stats['avg_entry']}")
        report.append(f"  Median: ${entry_stats['median_entry']}")
        report.append(f"  Range: ${entry_stats['min_entry']} - ${entry_stats['max_entry']}")
        report.append("")

    # Risk Statistics
    risk_stats = analysis['risk_stats']
    if risk_stats:
        report.append("Stop Loss Statistics:")
        report.append(f"  Average SL Distance: ${risk_stats['avg_sl_distance']}")
        report.append(f"  Aggressive Stops (<$5): {risk_stats['aggressive_stops']}")
        report.append(f"  Conservative Stops (≥$10): {risk_stats['conservative_stops']}")
        report.append("")

    # TP Statistics
    tp_stats = analysis['tp_stats']
    if tp_stats:
        report.append("Take Profit Statistics:")
        report.append(f"  Average TP Distance: ${tp_stats['avg_tp_distance']}")
        report.append(f"  Average Risk/Reward: {tp_stats['avg_risk_reward']}:1")
        report.append(f"  Poor RR (<1:1): {tp_stats['poor_rr_count']}")
        report.append(f"  Good RR (≥1.5:1): {tp_stats['good_rr_count']}")
        report.append("")

    # 2. LIQUIDITY ZONES
    report.append("2. LIQUIDITY ZONE MAPPING")
    report.append("-" * 40)

    liquidity = analysis['liquidity_zones']
    sl_clusters = liquidity['sl_clusters']
    tp_clusters = liquidity['tp_clusters']

    if sl_clusters:
        report.append(f"SL Clusters ({len(sl_clusters)}):")
        for cluster in sorted(sl_clusters, key=lambda x: x['center']):
            report.append(f"  ${cluster['center']:.2f} (Range: {cluster['price_range']}) - {cluster['signal_count']} signals")
        report.append("")

    if tp_clusters:
        report.append(f"TP Clusters ({len(tp_clusters)}):")
        for cluster in sorted(tp_clusters, key=lambda x: x['center']):
            report.append(f"  ${cluster['center']:.2f} (Range: {cluster['price_range']}) - {cluster['signal_count']} signals")
        report.append("")

    if liquidity['strongest_pools']:
        report.append("Strongest Liquidity Pools:")
        for pool in liquidity['strongest_pools']:
            report.append(f"  ${pool['price']:.2f} ({pool['type']}) - {pool['count']} signals")
        report.append("")

    # 3. PRICE ACTION
    report.append("3. PRICE ACTION ANALYSIS")
    report.append("-" * 40)

    price = analysis['price_action']
    report.append(f"Liquidity Taken Above Price: {price['liquidity_taken']['above']['taken']}")
    if price['liquidity_taken']['above']['price']:
        report.append(f"  → At: ${price['liquidity_taken']['above']['price']:.2f}")

    report.append(f"Liquidity Taken Below Price: {price['liquidity_taken']['below']['taken']}")
    if price['liquidity_taken']['below']['price']:
        report.append(f"  → At: ${price['liquidity_taken']['below']['price']:.2f}")

    if price['stop_hunt_detected'].get('detected'):
        sh = price['stop_hunt_detected']
        report.append(f"\n🎯 STOP HUNT DETECTED: {sh['type']}")
        report.append(f"   Cluster: ${sh['cluster_price']:.2f}")
        report.append(f"   Touched At: ${sh['touched_at']:.2f}")
        report.append(f"   Direction: {sh['reversal']}")
        report.append(f"   {sh['description']}")

    if price['liquidity_sweeps']:
        report.append(f"\n🚀 LIQUIDITY SWEEPS ({len(price['liquidity_sweeps'])}):")
        for sweep in price['liquidity_sweeps']:
            report.append(f"   {sweep['direction']} through {sweep['cluster_type']} at ${sweep['cluster_price']:.2f}")
            report.append(f"   {sweep['description']}")

    report.append("")

    # 4. MARKET STRUCTURE
    report.append("4. MARKET STRUCTURE")
    report.append("-" * 40)

    structure = analysis['market_structure']
    report.append(f"Intraday Bias: {structure['intraday_bias']}")
    report.append(f"Move Type: {structure['move_type']}")
    report.append(f"Current Price: ${structure['structure']['current_price']:.2f}")
    report.append(f"Avg Retail Entry: ${structure['structure']['avg_retail_entry']:.2f}")
    report.append(f"Intraday Range: ${structure['structure']['intraday_low']:.2f} - ${structure['structure']['intraday_high']:.2f}")
    report.append(f"Range Size: ${structure['structure']['range_size']:.2f}")
    report.append("")

    # 4B. VWAP & SESSION ANALYSIS
    vwap_section = analysis.get('vwap_analysis', {})
    if vwap_section.get('vwap', {}).get('available'):
        report.append("4B. VWAP & SESSION ANALYSIS")
        report.append("-" * 40)

        vwap = vwap_section['vwap']
        report.append(f"VWAP Level: ${vwap['vwap_level']:.2f}")
        report.append(f"Current Price: ${vwap['current_price']:.2f}")
        report.append(f"Distance to VWAP: ${vwap['distance_to_vwap']:.2f}")
        report.append(f"Price Position: {vwap['price_alignment']}")
        report.append(f"Retail Entry Position: {vwap['avg_entry_alignment']}")
        report.append(f"Interpretation: {vwap['interpretation']}")

        if vwap_section.get('vwap_as_level'):
            vwap_level = vwap_section['vwap_as_level']
            report.append(f"\nVWAP as Level:")
            report.append(f"  Role: {vwap_level.get('vwap_role', 'N/A')}")
            report.append(f"  Strength: {vwap_level.get('vwap_strength', 'N/A')}")
            report.append(f"  Touched Intraday: {'YES' if vwap_level.get('vwap_touched_intraday') else 'NO'}")

        if vwap_section.get('session', {}).get('available'):
            session = vwap_section['session']
            report.append(f"\nSession Levels:")
            report.append(f"  Session Range: ${session['session_low']:.2f} - ${session['session_high']:.2f}")
            report.append(f"  Range Size: ${session['session_range']:.2f}")
            report.append(f"  Price Position in Range: {session['position']} ({session['price_in_range_percent']:.1f}%)")
            report.append(f"  Interpretation: {session['interpretation']}")

        report.append("")

    # 5. POSITIONING INSIGHT
    report.append("5. POSITIONING ASSESSMENT")
    report.append("-" * 40)

    positioning = analysis['positioning_assessment']
    report.append(f"Status: {positioning['status']}")
    report.append(f"Liquidation Probability: {positioning['liquidation_probability']}")
    report.append(f"{positioning['explanation']}")
    report.append("")

    # 6. TRADING ZONES
    report.append("6. OPTIMAL TRADING ZONES")
    report.append("-" * 40)

    zones = analysis['trading_zones']
    if zones['entry_zones']:
        report.append("ENTRY ZONES:")
        for zone in zones['entry_zones']:
            report.append(f"  Zone: ${zone['price']:.2f}")
            if 'range' in zone:
                report.append(f"    Range: {zone['range']}")
            report.append(f"    Rationale: {zone['rationale']}")
            if 'confidence' in zone:
                report.append(f"    Confidence: {zone['confidence']}")
        report.append("")

    if zones['target_zones']:
        report.append("TARGET ZONES:")
        for zone in zones['target_zones']:
            report.append(f"  ${zone['price']:.2f} - {zone['rationale']}")
        report.append("")

    # 7. FINAL INSIGHT
    report.append("7. FINAL INSTITUTIONAL INSIGHT")
    report.append("-" * 40)
    report.append(f"\n💡 {analysis['final_insight']}")
    report.append("")

    report.append("=" * 80)

    report_str = "\n".join(report)

    # Save to file if requested
    if output_file:
        with open(output_file, 'w') as f:
            f.write(report_str)
        print(f"\n✓ Report saved to: {output_file}")

    return report_str


def main():
    parser = argparse.ArgumentParser(
        description="Liquidity Analysis - Retail Positioning vs Market Price"
    )

    # Input options
    input_group = parser.add_argument_group('Input Options')
    input_group.add_argument('--signals', type=str, help='Path to signals CSV file')
    input_group.add_argument('--from-sheets', action='store_true', help='Load signals from Google Sheets')

    # Market context options
    market_group = parser.add_argument_group('Market Context')
    market_group.add_argument('--price', type=float, required=True, help='Current price')
    market_group.add_argument('--high', type=float, required=True, help='Intraday high')
    market_group.add_argument('--low', type=float, required=True, help='Intraday low')
    market_group.add_argument('--timeframe', type=str, default='1D', help='Timeframe (default: 1D)')

    # Session data options
    session_group = parser.add_argument_group('Session Data (Optional)')
    session_group.add_argument('--session-high', type=float, help='Session high (daily open to now)')
    session_group.add_argument('--session-low', type=float, help='Session low (daily open to now)')
    session_group.add_argument('--vwap', type=float, help='Volume Weighted Average Price')

    # Analysis options
    analysis_group = parser.add_argument_group('Analysis Options')
    analysis_group.add_argument('--tolerance', type=float, default=10.0,
                               help='Clustering tolerance in price points (default: $10)')

    # Output options
    output_group = parser.add_argument_group('Output Options')
    output_group.add_argument('--output', type=str, help='Save report to file')
    output_group.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    # Validate inputs
    if not args.signals and not args.from_sheets:
        print("✗ Error: Please provide either --signals or --from-sheets")
        parser.print_help()
        sys.exit(1)

    # Load signals
    if args.signals:
        signals = load_signals_from_csv(args.signals)
    else:
        signals = load_signals_from_google_sheets()

    if not signals:
        print("✗ No signals loaded")
        sys.exit(1)

    # Create market context
    market = MarketContext(
        current_price=args.price,
        intraday_high=args.high,
        intraday_low=args.low,
        timeframe=args.timeframe,
        session_high=args.session_high,
        session_low=args.session_low,
        vwap=args.vwap
    )

    print(f"\n📊 MARKET CONTEXT")
    print(f"   Current Price: ${market.current_price:.2f}")
    print(f"   Intraday Range: ${market.intraday_low:.2f} - ${market.intraday_high:.2f}")
    print(f"   Timeframe: {market.timeframe}")

    if market.has_session_data():
        print(f"\n📊 SESSION DATA")
        print(f"   Session Range: ${market.session_low:.2f} - ${market.session_high:.2f}")
        print(f"   VWAP: ${market.vwap:.2f}")
        print(f"   Price vs VWAP: {market.get_vwap_alignment()} ({market.get_price_to_vwap_distance():.2f} away)")

    # Run analysis
    print(f"\n⏳ Running analysis on {len(signals)} signals...")
    analyzer = LiquidityAnalyzer(signals, market, args.tolerance)
    analysis = analyzer.analyze()

    # Output results
    if args.json:
        print(json.dumps(analysis, indent=2))
    else:
        report = generate_report(analysis, args.output)
        print(report)


if __name__ == "__main__":
    main()
