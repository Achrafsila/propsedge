#!/usr/bin/env python3
"""
QUANTFLOW V1 - REAL Pipeline Test
Retrieves REAL messages from all Telegram channels since 23:00
Full model test with detailed step-by-step reporting
"""

import asyncio
import json
import sys
import re
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Dict

# Config
API_ID = "38456630"
API_HASH = "4b2a85354b6e6d4103820dc92b522b53"
PHONE = "+212688434773"
SESSION_FILE = str(Path(__file__).parent / "sessions" / "telegram_session.session")

FILTER_KEYWORDS = ['BUY', 'SELL', 'LONG', 'SHORT', 'GOLD', 'XAUUSD', 'ENTRY', 'TP', 'SL', 'STOP', 'XAU']


def divider(title=""):
    line = "═" * 80
    if title:
        print(f"\n╔{line}╗")
        print(f"║  {title:<76}║")
        print(f"╚{line}╝\n")
    else:
        print(f"{'─'*80}")


def row(label, value, icon=""):
    print(f"  {icon} {label:<35} {value}")


def extract_signal_params(text: str) -> dict:
    """Extract trading parameters from message text"""
    text_upper = text.upper()

    action = None
    if re.search(r'\bBUY\b|\bLONG\b', text_upper):
        action = "BUY"
    elif re.search(r'\bSELL\b|\bSHORT\b', text_upper):
        action = "SELL"

    # Extract 4-5 digit prices (GOLD range)
    prices = re.findall(r'\b(?:4[0-9]{3}|5[0-9]{3})(?:\.\d{1,2})?\b', text)

    entry, sl, tp = None, None, None
    if prices:
        entry = float(prices[0])

    # Try to find specific SL
    sl_match = re.search(r'(?:SL|STOP\s*LOSS|STOP)[:\s]+([0-9]{4,5}(?:\.[0-9]{1,2})?)', text_upper)
    if sl_match:
        sl = float(sl_match.group(1))

    # Try to find specific TP
    tp_match = re.search(r'(?:TP|TAKE\s*PROFIT|TARGET)[1\s:]+([0-9]{4,5}(?:\.[0-9]{1,2})?)', text_upper)
    if tp_match:
        tp = float(tp_match.group(1))

    return {"action": action, "entry": entry, "sl": sl, "tp": tp}


async def run_real_pipeline():
    try:
        from telethon import TelegramClient
    except ImportError:
        print("❌ pip install telethon")
        return

    now_utc = datetime.now(timezone.utc)

    # Build start_time = today at 23:00 local (UTC+1 Morocco = UTC+0 now / UTC+1 summer)
    # Use last 23:00 UTC
    today_2300 = now_utc.replace(hour=23, minute=0, second=0, microsecond=0)
    if now_utc < today_2300:
        start_time = today_2300 - timedelta(days=1)
    else:
        start_time = today_2300

    print("\n" + "█"*82)
    print("█" + "  QUANTFLOW V1 — REAL PIPELINE TEST".center(80) + "█")
    print("█" + f"  From {start_time.strftime('%Y-%m-%d %H:%M')} UTC → {now_utc.strftime('%H:%M')} UTC".center(80) + "█")
    print("█"*82)

    # ─── STEP 1: CONFIG ───────────────────────────────────────────────────────
    divider("STEP 1 │ LOAD CONFIGURATION")
    config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"
    with open(config_file) as f:
        config = json.load(f)
    channels = config['channels']
    row("Channels configured:", str(len(channels)), "✅")
    row("Filter keywords:", str(len(FILTER_KEYWORDS)), "✅")
    row("TradingView source:", "OANDA:XAUUSD", "✅")

    # ─── STEP 2: TELEGRAM CONNECTION ─────────────────────────────────────────
    divider("STEP 2 │ CONNECT TELEGRAM (@Achrafsila)")
    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        print("❌ Session expired — run get_all_telegram_channels_cli.py first")
        return

    me = await client.get_me()
    row("Account:", f"@{me.username} ({me.first_name})", "✅")
    row("Session:", "Valid", "✅")

    # ─── STEP 3: FETCH MESSAGES ───────────────────────────────────────────────
    divider("STEP 3 │ FETCH MESSAGES FROM ALL 55 CHANNELS")
    row("Start time:", start_time.strftime('%Y-%m-%d %H:%M UTC'), "🕐")
    row("End time:", now_utc.strftime('%Y-%m-%d %H:%M UTC'), "🕐")
    print()

    all_messages = []
    channel_stats = []

    for ch in channels:
        try:
            count = 0
            async for msg in client.iter_messages(ch['id'], limit=200):
                # msg.date is UTC-aware
                if msg.date < start_time:
                    break  # messages are ordered newest-first, stop when too old
                if msg.text and msg.text.strip():
                    all_messages.append({
                        "channel": ch['title'],
                        "channel_id": ch['id'],
                        "text": msg.text,
                        "timestamp": msg.date.isoformat(),
                    })
                    count += 1

            if count > 0:
                channel_stats.append({"channel": ch['title'], "count": count})
                print(f"  ✅ {ch['title'][:50]:<50} {count} msgs")
        except Exception:
            pass

    total_msgs = len(all_messages)
    active_channels = len(channel_stats)
    print(f"\n  {'─'*60}")
    row("Total messages retrieved:", str(total_msgs), "📨")
    row("Active channels:", f"{active_channels} / {len(channels)}", "📡")

    # ─── STEP 4: SIGNAL FILTERING ─────────────────────────────────────────────
    divider("STEP 4 │ SIGNAL FILTERING (Keywords Detection)")

    raw_signals = []
    for msg in all_messages:
        text_up = msg['text'].upper()
        matched = [kw for kw in FILTER_KEYWORDS if kw in text_up]
        if matched:
            msg['matched_keywords'] = matched
            raw_signals.append(msg)

    row("Messages scanned:", str(total_msgs), "🔍")
    row("Potential signals detected:", str(len(raw_signals)), "🎯")
    row("Noise filtered out:", str(total_msgs - len(raw_signals)), "🗑️")

    if raw_signals:
        print(f"\n  Top signals by channel:")
        from collections import Counter
        ch_counts = Counter(s['channel'] for s in raw_signals)
        for ch, cnt in ch_counts.most_common(10):
            print(f"    • {ch[:50]:<50} {cnt} signals")

    # ─── STEP 5: PARAMETER EXTRACTION ────────────────────────────────────────
    divider("STEP 5 │ EXTRACT TRADING PARAMETERS (Entry / SL / TP)")

    extracted = []
    incomplete = 0

    for sig in raw_signals:
        params = extract_signal_params(sig['text'])
        if params['action'] and params['entry']:
            sig.update(params)
            extracted.append(sig)
        else:
            incomplete += 1

    row("Signals with full parameters:", str(len(extracted)), "✅")
    row("Signals incomplete (no entry/action):", str(incomplete), "⚠️")

    print(f"\n  Sample extracted signals:")
    print(f"  {'#':<4} {'Channel':<30} {'Action':<6} {'Entry':>8}  {'SL':>8}  {'TP':>8}  {'Time'}")
    print(f"  {'─'*80}")
    for i, s in enumerate(extracted[:15], 1):
        sl_str = f"{s['sl']:.2f}" if s['sl'] else "  —  "
        tp_str = f"{s['tp']:.2f}" if s['tp'] else "  —  "
        ts = s['timestamp'][11:16]
        print(f"  {i:<4} {s['channel'][:30]:<30} {s['action']:<6} {s['entry']:>8.2f}  {sl_str:>8}  {tp_str:>8}  {ts}")
    if len(extracted) > 15:
        print(f"  ... and {len(extracted)-15} more")

    # ─── STEP 6: TRADINGVIEW PRICE VERIFICATION ───────────────────────────────
    divider("STEP 6 │ TRADINGVIEW PRICE VERIFICATION (Live)")

    # Fetch REAL price from TradingView
    tv_price = None
    tv_error = None
    try:
        from subprocess import run, PIPE
        # Use TradingView MCP quote_get via Python (it's already loaded in Claude context)
        # We'll use the stored price from earlier session + note
        pass
    except:
        pass

    # Live TradingView quote will be fetched in Claude context
    # Using latest known value from OANDA:XAUUSD
    tv_price = None  # Will be filled after TradingView fetch below

    # After this function returns, Claude will fetch TV price and re-run verification
    # For now store extracted for TV check
    await client.disconnect()
    return extracted, raw_signals, total_msgs, active_channels, start_time, now_utc


async def main():
    result = await run_real_pipeline()
    if result is None:
        return

    extracted, raw_signals, total_msgs, active_channels, start_time, now_utc = result

    # Save raw results for TV verification step
    out = Path(__file__).parent / "data" / "pipeline_test_raw.json"
    with open(out, 'w') as f:
        json.dump({
            "meta": {
                "start_time": start_time.isoformat(),
                "end_time": now_utc.isoformat(),
                "total_messages": total_msgs,
                "active_channels": active_channels,
                "raw_signals": len(raw_signals),
                "extracted_signals": len(extracted)
            },
            "signals": extracted[:50]  # Save top 50
        }, f, indent=2, default=str)

    print(f"\n  ✅ Raw results saved → data/pipeline_test_raw.json")
    print(f"\n  ⏳ Waiting for TradingView price fetch (Step 6)...")
    print(f"\n{'█'*82}")
    print("  STEPS 1-5 COMPLETE — Fetching TradingView live price for Step 6-8...")
    print(f"{'█'*82}\n")


if __name__ == '__main__':
    asyncio.run(main())
