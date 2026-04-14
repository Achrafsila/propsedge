#!/usr/bin/env python3
"""
Professional Report Formatter
Generates institutional-grade QuantFLOW output
"""

import json
from datetime import datetime
from typing import Dict, Optional, List


class ReportFormatter:
    """Format analysis output in professional QuantFLOW style"""

    def __init__(self):
        self.timestamp = datetime.utcnow().isoformat() + "Z"

    def format_full_report(
        self,
        smc_analysis: Dict,
        trigger_monitor: Dict,
        market_data: Dict,
        include_html: bool = False
    ) -> Dict:
        """
        Generate complete professional report

        Returns:
            Dict with console_output, json_report, and optional html_report
        """
        console_output = self._format_console_output(smc_analysis, trigger_monitor, market_data)
        json_report = self._format_json_report(smc_analysis, trigger_monitor, market_data)

        report = {
            "timestamp": self.timestamp,
            "console_output": console_output,
            "json_report": json_report,
            "status": "SUCCESS"
        }

        if include_html:
            report["html_report"] = self._format_html_report(smc_analysis, trigger_monitor, market_data)

        return report

    def _format_console_output(self, smc: Dict, trigger: Dict, market: Dict) -> str:
        """Format console-friendly report"""
        output = []
        output.append("\n" + "="*90)
        output.append("QUANTFLOW V1 - INSTITUTIONAL MARKET ANALYSIS".center(90))
        output.append("="*90 + "\n")

        # Header
        current_price = market.get("current_price", "N/A")
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        output.append(f"📊 XAUUSD ANALYSIS | {timestamp}")
        output.append(f"💰 Current Price: {current_price} | HOD: {market.get('hod')} | LOD: {market.get('lod')}\n")

        # Market Structure
        market_structure = smc.get("market_structure", {})
        output.append("─" * 90)
        output.append("MARKET STRUCTURE ANALYSIS")
        output.append("─" * 90)
        output.append(f"Trend:        {market_structure.get('trend', 'N/A')}")
        output.append(f"BOS Status:   {market_structure.get('bos_status', 'N/A')}")
        output.append(f"CHoCH Status: {market_structure.get('choch_status', 'N/A')}")
        output.append(f"Structure Validity: {int(market_structure.get('structure_validity', 0) * 100)}%\n")

        # Liquidity Zones
        liquidity = smc.get("liquidity_zones", {})
        output.append("─" * 90)
        output.append("LIQUIDITY ZONES & CLUSTERING")
        output.append("─" * 90)

        zones = liquidity.get("strong_zones", [])
        if zones:
            output.append(f"{'Level':<12} {'Type':<20} {'Signals':<10} {'Consensus':<15}")
            output.append("─" * 60)
            for zone in zones:
                output.append(
                    f"{zone.get('level', 0):<12.2f} "
                    f"{zone.get('zone_type', 'N/A'):<20} "
                    f"{zone.get('signal_count', 0):<10} "
                    f"{zone.get('consensus', 0)*100:<14.0f}%"
                )
        output.append("")

        # Retail Positioning
        retail = market.get("retail_positioning", {})
        output.append("─" * 90)
        output.append("RETAIL POSITIONING (LIQUIDITY TRAP DETECTION)")
        output.append("─" * 90)
        output.append(f"Retail Bias: {retail.get('retail_bias', 'N/A')}")
        entry = retail.get("entry_cluster", {})
        output.append(f"Entry Cluster: {entry.get('zone', [])}")
        output.append(f"Entry Consensus: {entry.get('consensus', 0)*100:.0f}%")
        sl = retail.get("stop_loss_cluster", {})
        output.append(f"SL Level: {sl.get('level', 'N/A')} ({sl.get('consensus', 0)*100:.0f}% consensus)")
        output.append("")

        # Order Blocks
        obs = smc.get("order_blocks", {})
        output.append("─" * 90)
        output.append("ORDER BLOCKS & SMART MONEY ACTIVITY")
        output.append("─" * 90)
        if obs.get("active_block"):
            active = obs.get("active_block", {})
            output.append(f"🎯 ACTIVE BLOCK: {active.get('type')} at {active.get('level')}")
            output.append(f"   Reason: {active.get('reason', 'N/A')}")
        output.append("")

        # Sweeps
        sweeps = smc.get("sweeps", {})
        output.append("─" * 90)
        output.append("LIQUIDITY SWEEP ANALYSIS")
        output.append("─" * 90)
        output.append(f"Completed Sweeps: {len(sweeps.get('completed', []))}")
        output.append(f"Pending Sweeps: {len(sweeps.get('pending', []))}")
        if sweeps.get("pending"):
            output.append("Pending sweeps to monitor:")
            for sweep in sweeps.get("pending", []):
                output.append(f"  • {sweep.get('type')} at {sweep.get('level')} ({sweep.get('distance'):.1f}p away)")
        output.append("")

        # SMC Confluence Score
        output.append("─" * 90)
        output.append("SMC CONFLUENCE ANALYSIS")
        output.append("─" * 90)
        confluence = smc.get("confluence_score", 0)
        output.append(f"Confluence Score: {confluence:.0f}/100")
        output.append(f"Verdict: {smc.get('verdict', 'N/A')}\n")

        # Active Setups
        setups = trigger.get("active_setups", [])
        output.append("─" * 90)
        output.append("SETUP DETECTION & TRIGGERS")
        output.append("─" * 90)

        if not setups:
            output.append("⏳ Status: WAITING FOR CONFLUENCE")
            output.append(f"   Monitor 4720 ± 5 points for setup triggers")
            output.append(f"   • SHORT setup: IF 4720 rejection + volume spike")
            output.append(f"   • LONG setup: IF 4720 breakout + momentum confirmation\n")
        else:
            for i, setup in enumerate(setups, 1):
                output.append(f"\n✅ SETUP #{i}: {setup.get('setup_type')} ({setup.get('status')})")
                output.append(f"   Entry:       {setup.get('entry')}")
                output.append(f"   Stop Loss:   {setup.get('stop_loss')}")
                output.append(f"   Take Profits: {setup.get('take_profits')}")
                output.append(f"   Confidence:  {setup.get('confidence'):.0f}%")
                output.append(f"   R/R Ratio:   {setup.get('rr_ratio'):.1f}:1")
                output.append(f"   Reason:      {setup.get('reason')}")

        # Next Action
        output.append("\n" + "─" * 90)
        output.append("NEXT ACTION")
        output.append("─" * 90)
        next_action = trigger.get("next_action", {})
        output.append(f"Action: {next_action.get('action', 'WAITING')}")
        output.append(f"Reason: {next_action.get('reason', 'N/A')}")
        if next_action.get("distance_points"):
            output.append(f"Distance to 4720: {next_action.get('distance_points'):.1f} points")

        output.append("\n" + "="*90)
        output.append("Generated by QuantFLOW V1 | Smart Money Concepts Analysis Engine".center(90))
        output.append("="*90 + "\n")

        return "\n".join(output)

    def _format_json_report(self, smc: Dict, trigger: Dict, market: Dict) -> Dict:
        """Format as machine-readable JSON"""
        return {
            "timestamp": self.timestamp,
            "market_snapshot": {
                "current_price": market.get("current_price"),
                "hod": market.get("hod"),
                "lod": market.get("lod"),
                "range": market.get("hod", 0) - market.get("lod", 0) if market.get("hod") and market.get("lod") else 0
            },
            "smc_analysis": {
                "market_structure": smc.get("market_structure"),
                "liquidity_zones": smc.get("liquidity_zones"),
                "sweeps": smc.get("sweeps"),
                "order_blocks": smc.get("order_blocks"),
                "confluence_score": smc.get("confluence_score"),
                "verdict": smc.get("verdict")
            },
            "trigger_analysis": {
                "active_setups": trigger.get("active_setups", []),
                "triggered_alerts": trigger.get("triggered_alerts", []),
                "next_action": trigger.get("next_action", {})
            },
            "retail_positioning": market.get("retail_positioning", {}),
            "confluence_factors": {
                "bullish": self._get_bullish_factors(smc),
                "bearish": self._get_bearish_factors(smc)
            }
        }

    def _format_html_report(self, smc: Dict, trigger: Dict, market: Dict) -> str:
        """Format as HTML dashboard (optional)"""
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>QuantFLOW V1 - XAUUSD Analysis</title>
            <style>
                body { font-family: 'Courier New', monospace; background: #1a1a1a; color: #0f0; padding: 20px; }
                .container { max-width: 1200px; margin: 0 auto; }
                .header { text-align: center; border: 2px solid #0f0; padding: 20px; margin-bottom: 20px; }
                .section { border: 1px solid #0f0; padding: 15px; margin: 15px 0; }
                .metric { display: inline-block; width: 23%; margin: 1%; }
                .value { font-size: 24px; font-weight: bold; color: #0f0; }
                .label { font-size: 12px; color: #888; }
                .setup { border-left: 3px solid #ff0; padding-left: 10px; margin: 10px 0; }
                .bullish { color: #0f0; }
                .bearish { color: #f00; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>QuantFLOW V1 Analysis Report</h1>
                    <p>Smart Money Concepts Framework</p>
        """

        current_price = market.get("current_price", "N/A")
        html += f"<p>XAUUSD: {current_price} | {self.timestamp}</p></div>"

        # Market metrics
        html += '<div class="section"><h2>Market Snapshot</h2>'
        html += f'<div class="metric"><div class="label">Current Price</div><div class="value">{current_price}</div></div>'
        html += f'<div class="metric"><div class="label">HOD</div><div class="value">{market.get("hod")}</div></div>'
        html += f'<div class="metric"><div class="label">LOD</div><div class="value">{market.get("lod")}</div></div>'

        confluence = smc.get("confluence_score", 0)
        color = "#0f0" if confluence >= 60 else "#ff0" if confluence >= 40 else "#f00"
        html += f'<div class="metric"><div class="label">Confluence Score</div><div class="value" style="color: {color}">{confluence:.0f}/100</div></div>'
        html += '</div>'

        # Setups
        setups = trigger.get("active_setups", [])
        html += '<div class="section"><h2>Active Setups</h2>'
        if setups:
            for setup in setups:
                setup_type = setup.get("setup_type")
                color = "#0f0" if setup_type == "LONG" else "#f00"
                html += f'<div class="setup"><strong style="color: {color}">{setup_type}</strong>'
                html += f'<br>Entry: {setup.get("entry")} | SL: {setup.get("stop_loss")} | Confidence: {setup.get("confidence"):.0f}%'
                html += '</div>'
        else:
            html += '<p>⏳ Waiting for confluence...</p>'
        html += '</div>'

        html += '</div></body></html>'
        return html

    def _get_bullish_factors(self, smc: Dict) -> List[str]:
        """Extract bullish confluence factors"""
        factors = []
        market_structure = smc.get("market_structure", {})

        if market_structure.get("trend") == "BULLISH":
            factors.append("Bullish trend confirmed")
        if market_structure.get("bos_status") == "BOS_CONFIRMED":
            factors.append("Break of Structure above demand zone")

        confluence = smc.get("confluence_score", 0)
        if confluence > 70:
            factors.append("High SMC confluence (70%+)")

        return factors

    def _get_bearish_factors(self, smc: Dict) -> List[str]:
        """Extract bearish confluence factors"""
        factors = []
        market_structure = smc.get("market_structure", {})

        if market_structure.get("trend") == "BEARISH":
            factors.append("Bearish trend confirmed")
        if market_structure.get("choch_status") == "CHOCH_CONFIRMED":
            factors.append("Change of Character to bearish")

        return factors

    def format_alert(self, event_type: str, trigger_event: Dict) -> str:
        """Format a specific alert message"""
        current_price = trigger_event.get("current_price", "N/A")
        level = trigger_event.get("level", "N/A")

        if event_type == "ALERT":
            return f"🔔 PRICE ALERT: {current_price} touched {level}"
        elif event_type == "SETUP_TRIGGERED":
            setup = trigger_event.get("setup_signal", {})
            setup_type = setup.get("setup_type", "UNKNOWN")
            confidence = setup.get("confidence", 0)
            return f"⚠️  SETUP TRIGGERED: {setup_type} | Confidence: {confidence:.0f}%"
        else:
            return f"📊 Event: {event_type} at {current_price}"
