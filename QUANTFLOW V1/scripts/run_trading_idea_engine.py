#!/usr/bin/env python3
"""
Trading Idea Engine Runner

Generates institutional-grade trading ideas from liquidity analysis.

Usage:
    python3 run_trading_idea_engine.py --analysis analysis.json
    python3 run_trading_idea_engine.py --from-analyzer
"""

import sys
import json
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from trading_idea_engine import TradingIdeaEngine, IdeaStatus


def load_analysis_from_json(filepath: str) -> dict:
    """Load analysis results from JSON file"""
    try:
        with open(filepath, 'r') as f:
            analysis = json.load(f)
        print(f"✓ Loaded analysis from {filepath}")
        return analysis
    except FileNotFoundError:
        print(f"✗ File not found: {filepath}")
        sys.exit(1)


def generate_report(idea) -> str:
    """Generate formatted report for trading idea"""
    report = []

    report.append("\n" + "=" * 80)
    report.append("TRADING IDEA")
    report.append("=" * 80)

    report.append(f"\n📋 Idea ID: {idea.idea_id}")
    report.append(f"Status: {idea.status.value}")
    report.append(f"Timestamp: {idea.timestamp}")

    if not idea.is_qualified():
        report.append("\n⚠️ NOT QUALIFIED FOR EXECUTION")
        report.append("Reasons:")
        for reason in idea.criteria_failed:
            report.append(f"  ✗ {reason}")
        report.append("")
        return "\n".join(report)

    # QUALIFIED IDEA
    report.append("\n✅ QUALIFIED FOR EXECUTION")

    report.append(f"\n🎯 SETUP")
    report.append(f"Direction: {idea.side.value}")
    report.append(f"Conviction: {idea.conviction}")
    report.append(f"Confidence: {idea.confidence:.2%}")

    report.append(f"\n📍 ENTRY")
    report.append(f"Zone: ${idea.entry_zone.low:.2f} - ${idea.entry_zone.high:.2f}")
    report.append(f"Center: ${idea.entry_zone.center:.2f}")
    report.append(f"Width: {idea.entry_zone.width:.2f} pips")
    report.append(f"Type: {idea.entry_zone.type}")
    report.append(f"Rationale: {idea.entry_zone.rationale}")

    report.append(f"\n🛑 STOP LOSS")
    report.append(f"Level: ${idea.stop_loss:.2f}")
    report.append(f"Distance: {idea.risk_pips:.2f} pips")

    report.append(f"\n🎁 TARGETS")
    for i, target in enumerate(idea.targets, 1):
        report.append(f"\nTarget {i}:")
        report.append(f"  Level: ${target.level:.2f}")
        report.append(f"  Type: {target.type.value}")
        report.append(f"  Position Size: {target.position_size:.0%}")
        report.append(f"  Reward: {abs(target.level - idea.entry_zone.center):.2f} pips")
        report.append(f"  Rationale: {target.rationale}")

    report.append(f"\n📊 RISK/REWARD")
    report.append(f"Risk: {idea.risk_pips:.2f} pips")
    report.append(f"Reward: {idea.reward_pips:.2f} pips")
    report.append(f"Risk/Reward Ratio: 1:{idea.risk_reward_ratio:.2f}")

    report.append(f"\n🔴 INVALIDATION")
    report.append(f"Level: ${idea.invalidation_level:.2f}")
    report.append(f"Reason: {idea.invalidation_reason}")

    report.append(f"\n💡 INSTITUTIONAL THESIS")
    report.append(idea.institutional_thesis)

    report.append(f"\n✓ CRITERIA MET")
    for criterion in idea.criteria_met:
        report.append(f"  {criterion}")

    report.append("\n" + "=" * 80 + "\n")

    return "\n".join(report)


def main():
    parser = argparse.ArgumentParser(
        description="Trading Idea Engine - Generate institutional-grade ideas"
    )

    parser.add_argument('--analysis', type=str, help='Path to analysis JSON file')
    parser.add_argument('--output', type=str, help='Save report to file')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    if not args.analysis:
        print("✗ Please provide analysis file with --analysis")
        parser.print_help()
        sys.exit(1)

    # Load analysis
    analysis = load_analysis_from_json(args.analysis)

    # Generate idea
    print("\n⏳ Generating trading idea...")
    engine = TradingIdeaEngine()
    idea = engine.generate_idea(analysis)

    # Output
    if args.json:
        print(json.dumps(idea.to_dict(), indent=2))
    else:
        report = generate_report(idea)
        print(report)

        if args.output:
            with open(args.output, 'w') as f:
                f.write(report)
            print(f"✓ Report saved to: {args.output}")


if __name__ == "__main__":
    main()
