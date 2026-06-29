#!/usr/bin/env python3
"""
QUANTFLOW V1 - Advanced Scraper (NO STRICT FILTER)
Scrapes ALL signals from channels, then classifies as ACCEPT/REVIEW/REJECT
Only processes ACCEPT signals + strategic REVIEW signals
"""

import asyncio
import json
import re
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Dict

API_ID = "38456630"
API_HASH = "4b2a85354b6e6d4103820dc92b522b53"
PHONE = "+212688434773"
SESSION_FILE = str(Path(__file__).parent / "sessions" / "telegram_session.session")

# TradingView Live Price
TV_PRICE = 4680.92
TV_SYMBOL = "OANDA:XAUUSD"


def divider(title=""):
    line = "═" * 82
    if title:
        print(f"\n╔{line}╗")
        print(f"║  {title:<80}║")
        print(f"╚{line}╝\n")
    else:
        print(f"{'─'*82}")


def extract_signal(text: str) -> dict:
    """Extract ALL possible trading parameters from text"""
    text_upper = text.upper()

    # Action
    action = None
    if re.search(r'\b(BUY|LONG)\b', text_upper):
        action = "BUY"
    elif re.search(r'\b(SELL|SHORT)\b', text_upper):
        action = "SELL"

    # Prices (4-5 digits for GOLD range)
    prices = re.findall(r'\b(?:4[0-9]{3}|5[0-9]{3})(?:\.\d{1,2})?\b', text)

    entry, sl, tp = None, None, None
    if prices:
        entry = float(prices[0])
        if len(prices) > 1:
            sl = float(prices[1])
        if len(prices) > 2:
            tp = float(prices[2])

    # Try to extract specific SL
    sl_match = re.search(r'(?:SL|STOP)[:\s]+([0-9]{4,5}(?:\.[0-9]{1,2})?)', text_upper)
    if sl_match:
        sl = float(sl_match.group(1))

    # Try to extract specific TP
    tp_match = re.search(r'(?:TP|TAKE|TARGET)[1:\s]+([0-9]{4,5}(?:\.[0-9]{1,2})?)', text_upper)
    if tp_match:
        tp = float(tp_match.group(1))

    return {
        "action": action,
        "entry": entry,
        "sl": sl,
        "tp": tp,
        "has_entry": entry is not None,
        "has_sl": sl is not None,
        "has_tp": tp is not None,
        "completeness": sum([entry is not None, sl is not None, tp is not None])
    }


def classify_signal(signal: dict, tv_price: float = TV_PRICE) -> str:
    """
    Classify signal as ACCEPT / REVIEW / REJECT

    ACCEPT criteria:
    - Has entry AND (SL or TP)
    - Price variance ≤ 15 pips (VALID)
    - R/R ≥ 1.5 (if both SL and TP)
    - Running (not trapped)

    REVIEW criteria:
    - Has entry + some parameters
    - Price within 25 pips
    - Interesting R/R (1.0-1.5)
    - Price momentum positive

    REJECT criteria:
    - No entry, or
    - Stale (>25 pips), or
    - Bad R/R (<1.0)
    """

    if not signal['entry']:
        return "REJECT"

    diff = abs(signal['entry'] - tv_price)
    price_moved = tv_price - signal['entry']

    # Calculate R/R if possible
    rr = None
    if signal['sl'] and signal['tp'] and signal['entry']:
        risk = abs(signal['entry'] - signal['sl'])
        reward = abs(signal['tp'] - signal['entry'])
        rr = reward / risk if risk > 0 else None

    # Check if position is running or trapped
    if signal['action'] == 'BUY':
        is_running = price_moved > 5  # Price went up
    else:  # SELL
        is_running = price_moved < -5  # Price went down

    # ─── ACCEPT CRITERIA ───
    if diff <= 15 and signal['has_sl'] and signal['has_tp']:
        if rr and rr >= 1.5 and is_running:
            return "ACCEPT"

    # ─── REVIEW CRITERIA ───
    if diff <= 25 and signal['completeness'] >= 2:
        if rr and 1.0 <= rr < 1.5 and is_running:
            return "REVIEW"

    if diff <= 20 and signal['has_entry'] and is_running:
        if not rr or rr >= 1.0:
            return "REVIEW"

    # ─── REJECT ───
    return "REJECT"


async def scrape_all_signals():
    """Scrape ALL signals without strict filtering"""

    try:
        from telethon import TelegramClient
    except ImportError:
        print("❌ Telethon not installed")
        return

    divider("QUANTFLOW V1 - SCRAPE ALL SIGNALS (NO FILTER)")

    # Load config
    config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"
    with open(config_file) as f:
        config = json.load(f)
    channels = config['channels']

    # Time window
    now_utc = datetime.now(timezone.utc)
    start_time = now_utc - timedelta(hours=1)  # Last 1 hour

    print(f"  📡 Channels: {len(channels)}")
    print(f"  🕐 Time: {start_time.strftime('%H:%M')} → {now_utc.strftime('%H:%M')} UTC")
    print(f"  💰 TradingView: ${TV_PRICE} (OANDA:XAUUSD)\n")

    # Connect
    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        print("❌ Not authorized")
        return

    # Scrape ALL messages
    divider("PHASE 1: SCRAPE ALL MESSAGES")

    all_messages = []
    for ch in channels:
        try:
            count = 0
            async for msg in client.iter_messages(ch['id'], limit=200):
                if msg.date < start_time:
                    break
                if msg.text and msg.text.strip():
                    all_messages.append({
                        "channel": ch['title'],
                        "channel_id": ch['id'],
                        "text": msg.text,
                        "timestamp": msg.date.isoformat(),
                    })
                    count += 1

            if count > 0:
                print(f"  ✅ {ch['title'][:50]:<50} {count:>3} msgs")
        except:
            pass

    print(f"\n  📨 Total messages: {len(all_messages)}")

    # Extract ALL signals (no keyword filter!)
    divider("PHASE 2: EXTRACT ALL SIGNALS")

    all_signals = []
    for msg in all_messages:
        params = extract_signal(msg['text'])
        if params['action']:  # Only need action, no strict entry requirement
            sig = {
                **msg,
                **params,
                "raw": msg['text'][:150]
            }
            all_signals.append(sig)

    print(f"  🎯 Total extracted signals: {len(all_signals)}")

    # Classify signals
    divider("PHASE 3: CLASSIFY SIGNALS (ACCEPT/REVIEW/REJECT)")

    accepted = []
    review = []
    rejected = []

    for sig in all_signals:
        classification = classify_signal(sig, TV_PRICE)
        sig['classification'] = classification

        diff = abs(sig['entry'] - TV_PRICE) if sig['entry'] else 999
        sig['diff_pips'] = round(diff, 1)

        if classification == "ACCEPT":
            accepted.append(sig)
        elif classification == "REVIEW":
            review.append(sig)
        else:
            rejected.append(sig)

    print(f"  ✅ ACCEPT signals:  {len(accepted)}")
    print(f"  ⚠️  REVIEW signals:  {len(review)}")
    print(f"  ❌ REJECT signals:  {len(rejected)}")

    # Display ACCEPT signals
    if accepted:
        divider(f"ACCEPT SIGNALS - ACTION REQUIRED ({len(accepted)})")
        print(f"  {'#':<3} {'Channel':<30} {'Action':<6} {'Entry':>8}  {'Diff':>6}  {'R/R':>6}")
        print(f"  {'─'*82}")
        for i, s in enumerate(accepted, 1):
            rr = "—"
            if s['sl'] and s['tp'] and s['entry']:
                rr = f"{abs(s['tp']-s['entry']) / abs(s['entry']-s['sl']):.2f}" if abs(s['entry']-s['sl']) > 0 else "—"
            print(f"  {i:<3} {s['channel'][:30]:<30} {s['action']:<6} {s['entry']:>8.2f}  {s['diff_pips']:>5.1f}p  {rr:>6}")

    # Display REVIEW signals (top 10)
    if review:
        divider(f"REVIEW SIGNALS - SELECTIVE ACTION ({len(review)} total, showing top 10)")
        print(f"  {'#':<3} {'Channel':<30} {'Action':<6} {'Entry':>8}  {'Diff':>6}  {'Score'}")
        print(f"  {'─'*82}")
        # Sort by diff (closest to TV price)
        review_sorted = sorted(review, key=lambda x: x['diff_pips'])
        for i, s in enumerate(review_sorted[:10], 1):
            score = "Close to TV" if s['diff_pips'] < 15 else "Moderate variance"
            print(f"  {i:<3} {s['channel'][:30]:<30} {s['action']:<6} {s['entry']:>8.2f}  {s['diff_pips']:>5.1f}p  {score}")
        if len(review) > 10:
            print(f"  ... and {len(review)-10} more")

    # Save results
    await client.disconnect()

    results = {
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "tv_price": TV_PRICE,
            "tv_symbol": TV_SYMBOL,
            "time_window": f"{start_time.strftime('%H:%M')} → {now_utc.strftime('%H:%M')} UTC",
            "total_messages": len(all_messages),
            "total_signals": len(all_signals)
        },
        "summary": {
            "accept": len(accepted),
            "review": len(review),
            "reject": len(rejected),
            "action_required": len(accepted)
        },
        "signals": {
            "accept": accepted,
            "review": review,
            "reject": rejected
        }
    }

    # Save full results
    out = Path(__file__).parent / "data" / f"signals_classified_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(out, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    # Final summary
    divider("FINAL SUMMARY")
    print(f"  📊 Signal Classification Report:")
    print(f"     Total messages: {len(all_messages)}")
    print(f"     Total signals:  {len(all_signals)}")
    print(f"     ")
    print(f"     🎯 ACCEPT (100% action):     {len(accepted)}")
    print(f"     ⚠️  REVIEW (selective):       {len(review)}")
    print(f"     ❌ REJECT (ignore):          {len(rejected)}")
    print(f"  ")
    print(f"  💾 Saved to: {out}")
    print(f"\n{'█'*82}")
    print("  ✅ SIGNAL SCRAPING & CLASSIFICATION COMPLETE")
    print(f"{'█'*82}\n")

    return results


if __name__ == '__main__':
    asyncio.run(scrape_all_signals())
