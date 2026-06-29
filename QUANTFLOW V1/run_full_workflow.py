#!/usr/bin/env python3
"""
QuantFLOW V1 - Full End-to-End Workflow
Chat-based execution of complete market analysis
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import re
from typing import List, Dict

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from analysis_pipeline import AnalysisPipeline


# Import signal functions from existing implementations
import importlib.util
spec = importlib.util.spec_from_file_location("scraper", Path(__file__).parent / "scraper_no_filter.py")
scraper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scraper)

extract_signal = scraper.extract_signal
classify_signal = scraper.classify_signal


class QuantFLOWWorkflow:
    """Complete QuantFLOW workflow orchestrator"""

    # Static market levels from validated backtest
    SUPPORT_LEVEL = 4661
    ENTRY_ZONE = [4670, 4675]
    RESISTANCE_LEVEL = 4720
    TP_CLUSTER = [4700, 4750, 4775]

    def __init__(self):
        """Initialize workflow"""
        self.pipeline = AnalysisPipeline()
        self.last_run = None
        self.tv_price = None
        self.telegram_messages = []

    async def get_telegram_messages(self, limit: int = 50) -> List[Dict]:
        """
        Fetch recent messages from Telegram channels

        Returns:
            List of message dictionaries with channel, text, timestamp
        """
        try:
            from telethon import TelegramClient
        except:
            print("❌ Telethon not available - using mock data")
            return self._get_mock_messages()

        config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"
        if not config_file.exists():
            return self._get_mock_messages()

        with open(config_file) as f:
            config = json.load(f)

        channels = config.get("channels", [])
        if not channels:
            return self._get_mock_messages()

        messages = []
        api_id = config.get("api_id", "")
        api_hash = config.get("api_hash", "")
        session_file = str(Path(__file__).parent / "sessions" / "telegram_session.session")

        if not api_id or not api_hash:
            return self._get_mock_messages()

        try:
            client = TelegramClient(session_file, api_id, api_hash)
            await client.connect()

            if not await client.is_user_authorized():
                print("⚠️  Not authorized with Telegram")
                return self._get_mock_messages()

            for ch in channels[:10]:  # Limit to 10 channels for speed
                try:
                    async for msg in client.iter_messages(ch.get("id"), limit=limit):
                        if msg.text and msg.text.strip():
                            messages.append({
                                "channel": ch.get("title", "Unknown"),
                                "text": msg.text,
                                "timestamp": msg.date.isoformat()
                            })
                            if len(messages) >= limit:
                                break
                except:
                    pass

            await client.disconnect()

        except Exception as e:
            print(f"⚠️  Telegram error: {e}")
            return self._get_mock_messages()

        self.telegram_messages = messages
        return messages

    def _get_mock_messages(self) -> List[Dict]:
        """Return mock messages for testing"""
        return [
            {
                "channel": "KING EL GOLD 👑",
                "text": "**XAUUSD BUY NOW 4670 ****✅****\nSl : 4661 ( 90 pip )\nTp : 4685\nTp : 4720\nTp : 4750\nTp : 4800\nTp : open",
                "timestamp": datetime.utcnow().isoformat()
            },
            {
                "channel": "WOLF TRADING",
                "text": "XAUUSD BUY NOW 4675\nSl 4630\nTp 4775\nهدفك 1000نقطة",
                "timestamp": datetime.utcnow().isoformat()
            }
        ]

    def extract_and_classify_signals(self, messages: List[Dict], tv_price: float) -> Dict:
        """
        Extract trading signals from messages and classify them

        Returns:
            Dictionary with accept/review/reject classifications
        """
        results = {
            "accept": [],
            "review": [],
            "reject": [],
            "total": len(messages)
        }

        for msg in messages:
            params = extract_signal(msg.get("text", ""))
            if not params.get("action"):
                results["reject"].append(msg)
                continue

            # Calculate metrics
            signal = {
                **msg,
                **params,
                "diff_pips": round(abs(params.get("entry", tv_price) - tv_price), 1),
                "price_moved": round(tv_price - params.get("entry", tv_price), 1)
            }

            # Classify
            classification = classify_signal(signal, tv_price)
            signal["classification"] = classification

            if classification == "ACCEPT":
                results["accept"].append(signal)
            elif classification == "REVIEW":
                results["review"].append(signal)
            else:
                results["reject"].append(signal)

        return results

    def analyze_signal_clustering(self, signals_by_class: Dict) -> Dict:
        """
        Analyze ACCEPT signals for entry/SL/TP clustering

        Returns:
            Dictionary with clustering analysis
        """
        accept_signals = signals_by_class.get("accept", [])
        if not accept_signals:
            return self._get_mock_clustering()

        clustering = {
            "entry_cluster": self._cluster_levels([s.get("entry") for s in accept_signals]),
            "sl_cluster": self._cluster_levels([s.get("sl") for s in accept_signals]),
            "tp_cluster": self._cluster_levels([s.get("tp") for s in accept_signals]),
            "total_signals": len(accept_signals)
        }

        return clustering

    def _cluster_levels(self, levels: List[float]) -> Dict:
        """Cluster similar price levels"""
        if not levels:
            return {"zone": [], "signal_count": 0, "consensus": 0}

        # Group levels within 5 points
        clusters = defaultdict(list)
        sorted_levels = sorted([l for l in levels if l])

        for level in sorted_levels:
            found = False
            for cluster_key in clusters:
                if abs(level - cluster_key) <= 5:
                    clusters[cluster_key].append(level)
                    found = True
                    break
            if not found:
                clusters[level] = [level]

        # Find strongest cluster
        strongest = max(clusters.items(), key=lambda x: len(x[1])) if clusters else (None, [])
        cluster_level = strongest[0]
        cluster_signals = strongest[1]

        return {
            "zone": [cluster_level - 2.5, cluster_level + 2.5] if cluster_level else [],
            "signal_count": len(cluster_signals),
            "consensus": len(cluster_signals) / len(sorted_levels) if sorted_levels else 0,
            "level": cluster_level
        }

    def _get_mock_clustering(self) -> Dict:
        """Return mock clustering for testing"""
        return {
            "entry_cluster": {
                "zone": [4670, 4675],
                "signal_count": 10,
                "consensus": 0.67,
                "level": 4672.5
            },
            "sl_cluster": {
                "zone": [4659, 4663],
                "signal_count": 13,
                "consensus": 0.87,
                "level": 4661
            },
            "tp_cluster": {
                "zone": [4698, 4752],
                "signal_count": 8,
                "consensus": 0.53,
                "level": 4725
            },
            "total_signals": 15
        }

    def get_market_data(self, tv_price: float) -> Dict:
        """
        Compile market data from all sources

        Returns:
            Dictionary with price, HOD, LOD, retail positioning
        """
        # In real scenario, would fetch from TradingView
        # For now, use provided price
        hod = tv_price  # Assume current price is at HOD for now
        lod = tv_price - 50  # Assume LOD is ~50 points down

        return {
            "current_price": tv_price,
            "hod": hod,
            "lod": lod,
            "range": hod - lod
        }

    async def run_analysis(
        self,
        tv_price: float,
        fetch_telegram: bool = True,
        verbose: bool = True
    ) -> Dict:
        """
        Run complete workflow

        Args:
            tv_price: Current XAUUSD price
            fetch_telegram: Whether to fetch Telegram messages
            verbose: Whether to print detailed output

        Returns:
            Complete analysis result
        """
        self.tv_price = tv_price

        if verbose:
            print("\n" + "█"*90)
            print("█" + "  QUANTFLOW V1 - FULL WORKFLOW INITIALIZATION".center(88) + "█")
            print("█"*90)
            print(f"\n🚀 Starting full workflow at {datetime.utcnow().isoformat()}Z")
            print(f"📊 TV Price Input: {tv_price}")

        # Phase 1: Fetch Telegram messages
        if verbose:
            print(f"\n[Phase 1/5] Fetching Telegram messages...")

        if fetch_telegram:
            messages = await self.get_telegram_messages(limit=50)
        else:
            messages = self._get_mock_messages()

        if verbose:
            print(f"✓ Fetched {len(messages)} messages")

        # Phase 2: Extract and classify signals
        if verbose:
            print(f"\n[Phase 2/5] Extracting and classifying signals...")

        signals_by_class = self.extract_and_classify_signals(messages, tv_price)

        if verbose:
            print(f"✓ {signals_by_class['total']} total signals analyzed")
            print(f"  • ACCEPT: {len(signals_by_class['accept'])}")
            print(f"  • REVIEW: {len(signals_by_class['review'])}")
            print(f"  • REJECT: {len(signals_by_class['reject'])}")

        # Phase 3: Analyze clustering
        if verbose:
            print(f"\n[Phase 3/5] Analyzing signal clustering...")

        clustering = self.analyze_signal_clustering(signals_by_class)

        if verbose:
            entry = clustering.get("entry_cluster", {})
            sl = clustering.get("sl_cluster", {})
            print(f"✓ Clustering analysis complete")
            print(f"  • Entry Zone: {entry.get('zone')} ({entry.get('consensus')*100:.0f}%)")
            print(f"  • SL Level: {sl.get('level')} ({sl.get('consensus')*100:.0f}%)")

        # Phase 4: Get market data
        if verbose:
            print(f"\n[Phase 4/5] Compiling market data...")

        market_data = self.get_market_data(tv_price)

        if verbose:
            print(f"✓ Market data compiled")
            print(f"  • Current: {market_data['current_price']}")
            print(f"  • HOD: {market_data['hod']}")
            print(f"  • LOD: {market_data['lod']}")
            print(f"  • Range: {market_data['range']:.0f}p")

        # Phase 5: Run SMC analysis & trigger detection
        if verbose:
            print(f"\n[Phase 5/5] Running SMC analysis & trigger detection...")

        retail_positions = {
            "retail_bias": "100% LONG",
            "entry_cluster": clustering.get("entry_cluster"),
            "stop_loss_cluster": clustering.get("sl_cluster"),
            "take_profit_cluster": clustering.get("tp_cluster")
        }

        signal_clusters = {
            "total_accept": len(signals_by_class["accept"]),
            "total_review": len(signals_by_class["review"]),
            "total_signals": signals_by_class["total"]
        }

        analysis_result = self.pipeline.run_smc_analysis(
            current_price=tv_price,
            hod=market_data["hod"],
            lod=market_data["lod"],
            retail_positions=retail_positions,
            signal_clusters=signal_clusters
        )

        self.last_run = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "price": tv_price,
            "messages": len(messages),
            "signals": signals_by_class,
            "clustering": clustering,
            "analysis": analysis_result
        }

        return self.last_run

    async def run_monitoring_loop(self, interval: int = 5, max_iterations: int = None):
        """
        Run continuous monitoring loop

        Args:
            interval: Seconds between checks
            max_iterations: Max number of iterations (None = infinite)
        """
        iteration = 0
        while True:
            iteration += 1
            if max_iterations and iteration > max_iterations:
                break

            print(f"\n{'='*90}")
            print(f"Monitoring Cycle #{iteration} - {datetime.utcnow().isoformat()}Z")
            print(f"{'='*90}")

            try:
                # In real scenario, would fetch live price
                # For now, use mock price
                tv_price = 4711.90

                await self.run_analysis(tv_price, fetch_telegram=False)

                print(f"\n✓ Cycle complete. Next check in {interval}s...\n")
                await asyncio.sleep(interval)

            except KeyboardInterrupt:
                print("\n\nMonitoring stopped by user")
                break
            except Exception as e:
                print(f"❌ Error in monitoring loop: {e}")
                await asyncio.sleep(interval)


async def main():
    """Main entry point"""
    workflow = QuantFLOWWorkflow()

    # Check for command-line arguments
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "--analyze":
            # Single analysis
            price = float(sys.argv[2]) if len(sys.argv) > 2 else 4711.90
            await workflow.run_analysis(price, fetch_telegram=False)

        elif command == "--monitor":
            # Continuous monitoring
            interval = int(sys.argv[2]) if len(sys.argv) > 2 else 5
            await workflow.run_monitoring_loop(interval=interval)

        elif command == "--test":
            # Quick test
            print("\n🧪 Running quick test...")
            result = await workflow.run_analysis(4711.90, fetch_telegram=False)
            print("\n✅ Test complete")
            print(f"Result status: {result['analysis']['status']}")

    else:
        # Default: single analysis at current price
        await workflow.run_analysis(4711.90, fetch_telegram=False)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nWorkflow interrupted by user")
        sys.exit(0)
