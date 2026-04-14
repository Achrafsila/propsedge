#!/usr/bin/env python3
"""
Analysis Pipeline - Complete integration of:
1. Signal collection from Google Sheets
2. Market data from TradingView
3. Liquidity analysis
4. Results export back to Google Sheets
"""

from datetime import datetime
from typing import List, Dict, Optional
import sys
from pathlib import Path

# Add to path if needed
sys.path.insert(0, str(Path(__file__).parent))

from liquidity_analyzer import (
    TradingSignal,
    MarketContext,
    LiquidityAnalyzer
)
from smc_analyzer import SMCAnalyzer
from setup_trigger_monitor import SetupTriggerMonitor
from report_formatter import ReportFormatter


class AnalysisPipeline:
    """Complete pipeline for signal analysis and insights generation"""

    def __init__(self, google_sheets_connector=None, market_watcher=None):
        """
        Initialize pipeline with optional external connectors

        Args:
            google_sheets_connector: Interface to Google Sheets (optional)
            market_watcher: Interface to TradingView market data (optional)
        """
        self.sheets = google_sheets_connector
        self.market = market_watcher
        self.last_analysis = None

    def run_daily_analysis(self, instrument: str = "GOLD") -> Dict:
        """
        Run complete daily analysis workflow

        Steps:
        1. Load signals from Google Sheets (ACCEPT_SIGNALS sheet)
        2. Get current market data from TradingView
        3. Run liquidity analysis
        4. Export results back to Google Sheets
        5. Return analysis results

        Args:
            instrument: Trading instrument (default: "GOLD")

        Returns:
            Complete analysis results dictionary
        """

        print(f"\n{'='*60}")
        print(f"STARTING DAILY ANALYSIS - {instrument}")
        print(f"{'='*60}")

        # Step 1: Load signals
        print(f"\n[1/5] Loading signals from Google Sheets...")
        signals = self._load_signals_from_sheets(instrument)
        if not signals:
            print(f"⚠️  No signals found for {instrument}")
            return {"status": "NO_SIGNALS", "timestamp": datetime.now().isoformat()}

        print(f"✓ Loaded {len(signals)} signals")

        # Step 2: Get market data
        print(f"\n[2/5] Fetching market data from TradingView...")
        market_context = self._get_market_context(instrument)
        if not market_context:
            print(f"✗ Failed to get market data")
            return {"status": "NO_MARKET_DATA", "timestamp": datetime.now().isoformat()}

        print(f"✓ Current Price: ${market_context.current_price:.2f}")
        print(f"✓ Intraday Range: ${market_context.intraday_low:.2f} - ${market_context.intraday_high:.2f}")

        # Step 3: Run analysis
        print(f"\n[3/5] Running liquidity analysis...")
        analyzer = LiquidityAnalyzer(signals, market_context)
        analysis = analyzer.analyze()
        self.last_analysis = analysis

        print(f"✓ Analysis complete")
        print(f"  Retail Bias: {analysis['retail_bias']['dominant_bias']}")
        print(f"  Status: {analysis['positioning_assessment']['status']}")

        # Step 4: Export results
        print(f"\n[4/5] Exporting results to Google Sheets...")
        if self.sheets:
            try:
                self._export_analysis_to_sheets(analysis, instrument)
                print(f"✓ Results exported")
            except Exception as e:
                print(f"⚠️  Export failed: {e}")

        # Step 5: Generate summary
        print(f"\n[5/5] Generating summary...")
        summary = self._generate_summary(analysis)
        print(summary)

        return {
            "status": "SUCCESS",
            "timestamp": datetime.now().isoformat(),
            "instrument": instrument,
            "signals_analyzed": len(signals),
            "analysis": analysis,
            "summary": summary
        }

    def run_smc_analysis(
        self,
        current_price: float,
        hod: float,
        lod: float,
        retail_positions: Dict,
        signal_clusters: Dict,
        update_trigger_price: bool = True
    ) -> Dict:
        """
        Run complete SMC analysis with trigger detection

        Args:
            current_price: Current XAUUSD price
            hod: High of Day
            lod: Low of Day
            retail_positions: Retail entry/SL/TP clustering
            signal_clusters: Aggregated signal data
            update_trigger_price: Whether to update trigger monitor with price

        Returns:
            Complete analysis with SMC + triggers + formatted report
        """
        print(f"\n{'='*90}")
        print("QUANTFLOW V1 - FULL SMC ANALYSIS & TRIGGER DETECTION")
        print(f"{'='*90}")

        # Step 1: Run SMC Analysis
        print(f"\n[1/3] Running SMC Analysis...")
        smc_analyzer = SMCAnalyzer()
        smc_analysis = smc_analyzer.analyze(
            current_price=current_price,
            hod=hod,
            lod=lod,
            retail_positions=retail_positions,
            signal_clusters=signal_clusters
        )
        print(f"✓ SMC Analysis complete")
        print(f"  Confluence Score: {smc_analysis.confluence_score:.0f}/100")
        print(f"  Verdict: {smc_analysis.verdict}")

        # Step 2: Check Setup Triggers
        print(f"\n[2/3] Checking Setup Triggers...")
        trigger_monitor = SetupTriggerMonitor()
        if update_trigger_price:
            trigger_monitor.update_price(current_price)
        trigger_state = {
            "active_setups": trigger_monitor.get_active_setups(),
            "triggered_alerts": trigger_monitor.get_triggered_alerts(),
            "next_action": trigger_monitor.get_next_action()
        }
        print(f"✓ Trigger check complete")
        print(f"  Active Setups: {len(trigger_state['active_setups'])}")
        print(f"  Next Action: {trigger_state['next_action'].get('action')}")

        # Step 3: Generate Professional Report
        print(f"\n[3/3] Generating Professional Report...")
        market_data = {
            "current_price": current_price,
            "hod": hod,
            "lod": lod,
            "retail_positioning": retail_positions
        }
        formatter = ReportFormatter()
        report = formatter.format_full_report(
            smc_analysis=smc_analysis.__dict__,
            trigger_monitor=trigger_state,
            market_data=market_data
        )
        print(f"✓ Report generated")

        # Output formatted console report
        print("\n" + report["console_output"])

        # Compile complete result
        result = {
            "status": "SUCCESS",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "smc_analysis": smc_analysis.__dict__,
            "trigger_analysis": trigger_state,
            "report": report,
            "action_summary": {
                "confluence_score": smc_analysis.confluence_score,
                "setup_status": trigger_state["next_action"].get("action"),
                "verdict": smc_analysis.verdict
            }
        }

        self.last_analysis = result
        return result

    def _load_signals_from_sheets(self, instrument: str) -> List[TradingSignal]:
        """Load ACCEPT_SIGNALS from Google Sheets"""
        if not self.sheets:
            print("⚠️  Google Sheets connector not configured")
            return []

        try:
            # Placeholder - requires gspread setup
            # signals_data = self.sheets.get_worksheet("ACCEPT_SIGNALS").get_all_records()

            # For now, return empty list
            return []

        except Exception as e:
            print(f"Error loading from sheets: {e}")
            return []

    def _get_market_context(self, instrument: str) -> Optional[MarketContext]:
        """Get current market data for instrument"""
        if not self.market:
            print("⚠️  Market watcher not configured")
            return None

        try:
            # Placeholder - requires TradingView connector
            # data = self.market.get_intraday_data(symbol)

            # For now, return None
            return None

        except Exception as e:
            print(f"Error getting market data: {e}")
            return None

    def _export_analysis_to_sheets(self, analysis: Dict, instrument: str) -> None:
        """Export analysis results to Google Sheets"""
        if not self.sheets:
            return

        try:
            # Create/update ANALYSIS sheet with results
            # Include:
            # - Retail bias (% BUY/SELL)
            # - Strongest liquidity pools
            # - Positioning assessment
            # - Trading zones
            # - Final insight
            # - Timestamp

            pass

        except Exception as e:
            print(f"Error exporting to sheets: {e}")

    def _generate_summary(self, analysis: Dict) -> str:
        """Generate human-readable summary"""
        bias = analysis['retail_bias']
        assessment = analysis['positioning_assessment']
        insight = analysis['final_insight']

        summary = []
        summary.append("\n" + "="*60)
        summary.append("ANALYSIS SUMMARY")
        summary.append("="*60)
        summary.append(f"\nRetail Positioning:")
        summary.append(f"  • {bias['buy_percent']:.1f}% BUY | {bias['sell_percent']:.1f}% SELL")
        summary.append(f"  • Bias: {bias['dominant_bias']} ({bias['crowding_level']} crowding)")

        summary.append(f"\nStatus:")
        summary.append(f"  • {assessment['status']}")
        summary.append(f"  • Liquidation Probability: {assessment['liquidation_probability']}")

        summary.append(f"\nLiquidity Pools:")
        pools = analysis['liquidity_zones']['strongest_pools']
        for pool in pools[:3]:
            summary.append(f"  • ${pool['price']:.2f} ({pool['type']}) - {pool['count']} signals")

        summary.append(f"\nKey Insight:")
        summary.append(f"  💡 {insight}")

        summary.append("\n" + "="*60 + "\n")

        return "\n".join(summary)


class ReportGenerator:
    """Generate formatted reports for stakeholders"""

    @staticmethod
    def generate_trader_report(analysis: Dict) -> str:
        """Generate report for traders"""
        report = []
        report.append("\n" + "="*60)
        report.append("TRADER BRIEFING - LIQUIDITY ANALYSIS")
        report.append("="*60)

        # Key metrics
        bias = analysis['retail_bias']
        assessment = analysis['positioning_assessment']
        zones = analysis['trading_zones']

        report.append(f"\n🎯 POSITIONING STATUS")
        report.append(f"Retail: {assessment['status']}")
        report.append(f"Bias: {bias['dominant_bias']} ({bias['buy_percent']:.1f}% BUY)")
        report.append(f"Liquidation Risk: {assessment['liquidation_probability']}")

        report.append(f"\n💡 ENTRY ZONES")
        if zones['entry_zones']:
            for zone in zones['entry_zones']:
                report.append(f"  ${zone['price']:.2f} - {zone['rationale']}")
        else:
            report.append("  No clear entry zones identified")

        report.append(f"\n🎁 TARGET ZONES")
        if zones['target_zones']:
            for zone in zones['target_zones']:
                report.append(f"  ${zone['price']:.2f} - {zone['rationale']}")

        report.append(f"\n📊 LIQUIDITY POOLS")
        pools = analysis['liquidity_zones']['strongest_pools']
        for pool in pools:
            report.append(f"  ${pool['price']:.2f} ({pool['type']}) - {pool['count']} signals")

        report.append(f"\n⚡ FINAL INSIGHT")
        report.append(f"  {analysis['final_insight']}")

        report.append("\n" + "="*60 + "\n")

        return "\n".join(report)

    @staticmethod
    def generate_risk_report(analysis: Dict) -> str:
        """Generate risk assessment report"""
        report = []
        report.append("\n" + "="*60)
        report.append("RISK ASSESSMENT REPORT")
        report.append("="*60)

        assessment = analysis['positioning_assessment']
        price_action = analysis['price_action']
        structure = analysis['market_structure']

        report.append(f"\n⚠️  RISK FACTORS")
        report.append(f"Crowding Level: {analysis['retail_bias']['crowding_level']}")
        report.append(f"Liquidation Probability: {assessment['liquidation_probability']}")

        report.append(f"\n🎯 STOP HUNT RISK")
        if price_action['stop_hunt_detected'].get('detected'):
            sh = price_action['stop_hunt_detected']
            report.append(f"HIGH RISK - {sh['type']}")
            report.append(f"Cluster at: ${sh['cluster_price']:.2f}")
        else:
            report.append("LOW RISK - No stop hunt pattern detected")

        report.append(f"\n📈 MOVE TYPE")
        report.append(f"Structure: {structure['move_type']}")
        report.append(f"Trend: {structure['intraday_bias']}")

        report.append(f"\n💰 CAPITAL FLOW")
        if assessment['status'] == "TRAPPED":
            report.append("NEGATIVE - Retail positioned against price")
        elif assessment['status'] == "CORRECT":
            report.append("POSITIVE - Retail positioned with price")
        else:
            report.append("NEUTRAL - Mixed positioning")

        report.append("\n" + "="*60 + "\n")

        return "\n".join(report)


def create_example_pipeline():
    """Create example pipeline for demonstration"""
    print("\n" + "="*60)
    print("EXAMPLE: Creating Analysis Pipeline")
    print("="*60)

    # Create pipeline (without external connectors for now)
    pipeline = AnalysisPipeline()

    print("\n✓ Pipeline created")
    print("\nTo run full analysis, you would:")
    print("1. Configure Google Sheets connector")
    print("2. Configure TradingView market watcher")
    print("3. Call: pipeline.run_daily_analysis('GOLD')")

    return pipeline


if __name__ == "__main__":
    # Create and demonstrate pipeline
    pipeline = create_example_pipeline()

    print("\n" + "="*60)
    print("INTEGRATION READY")
    print("="*60)
    print("\nWhen ready, the pipeline will:")
    print("  1. Load ACCEPT_SIGNALS from Google Sheets")
    print("  2. Fetch intraday price data from TradingView")
    print("  3. Run complete liquidity analysis")
    print("  4. Export results back to Google Sheets")
    print("  5. Generate trader briefing & risk reports")
