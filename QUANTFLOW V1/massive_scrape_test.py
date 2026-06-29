#!/usr/bin/env python3
"""
MASSIVE SIGNAL SCRAPING TEST
Scrape 800 messages from all channels (12-13 April)
Extract, classify, and report all signals
"""

import asyncio
import json
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict

API_ID = "38456630"
API_HASH = "4b2a85354b6e6d4103820dc92b522b53"
SESSION_FILE = str(Path(__file__).parent / "sessions" / "telegram_session.session")

TV_PRICE = 4680.92


def extract_signal(text: str) -> dict:
    """Extract trading parameters"""
    text_upper = text.upper()
    action = None
    if re.search(r'\b(BUY|LONG)\b', text_upper):
        action = "BUY"
    elif re.search(r'\b(SELL|SHORT)\b', text_upper):
        action = "SELL"

    prices = re.findall(r'\b(?:4[0-9]{3}|5[0-9]{3})(?:\.\d{1,2})?\b', text)
    entry, sl, tp = None, None, None
    if prices:
        entry = float(prices[0])
        if len(prices) > 1:
            sl = float(prices[1])
        if len(prices) > 2:
            tp = float(prices[2])

    sl_match = re.search(r'(?:SL|STOP)[:\s]+([0-9]{4,5}(?:\.[0-9]{1,2})?)', text_upper)
    if sl_match:
        sl = float(sl_match.group(1))

    tp_match = re.search(r'(?:TP|TAKE|TARGET)[1:\s]+([0-9]{4,5}(?:\.[0-9]{1,2})?)', text_upper)
    if tp_match:
        tp = float(tp_match.group(1))

    return {"action": action, "entry": entry, "sl": sl, "tp": tp}


def classify_signal(sig: dict, tv_price: float) -> str:
    """Classify as ACCEPT/REVIEW/REJECT"""
    if not sig['entry']:
        return "REJECT"

    diff = abs(sig['entry'] - tv_price)
    moved = tv_price - sig['entry']
    is_running = (sig['action'] == 'BUY' and moved > 0) or (sig['action'] == 'SELL' and moved < 0)

    rr = None
    if sig['sl'] and sig['tp']:
        risk = abs(sig['entry'] - sig['sl'])
        reward = abs(sig['tp'] - sig['entry'])
        rr = reward / risk if risk > 0 else None

    # ACCEPT: Valid + R/R >= 1.5 + Running
    if diff <= 15 and sig['sl'] and sig['tp']:
        if rr and rr >= 1.5 and is_running:
            return "ACCEPT"

    # REVIEW: Valid or close + some params + running
    if diff <= 25 and is_running:
        if sig['sl'] or sig['tp']:
            return "REVIEW"

    return "REJECT"


async def massive_scrape():
    try:
        from telethon import TelegramClient
    except:
        return

    print("\n" + "█"*82)
    print("█" + "  MASSIVE SCRAPE TEST: 12-13 APRIL".center(80) + "█")
    print("█"*82 + "\n")

    # Load config
    config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"
    with open(config_file) as f:
        config = json.load(f)
    channels = config['channels']

    # Date range: 12-13 April UTC
    start = datetime(2026, 4, 12, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 4, 13, 23, 59, 59, tzinfo=timezone.utc)

    print(f"  📅 Date Range: {start.strftime('%Y-%m-%d')} → {end.strftime('%Y-%m-%d')} UTC")
    print(f"  💰 TV Price: ${TV_PRICE}")
    print(f"  📡 Channels: {len(channels)}")
    print(f"  🎯 Target: 800 messages max\n")

    # Connect
    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        print("❌ Not authorized")
        return

    # Scrape
    print("  " + "─"*80)
    print("  PHASE 1: SCRAPING MESSAGES\n")

    all_messages = []
    channel_msgs = defaultdict(int)

    for ch in channels:
        count = 0
        try:
            async for msg in client.iter_messages(ch['id'], limit=800):
                if start <= msg.date <= end and msg.text and msg.text.strip():
                    all_messages.append({
                        "channel": ch['title'],
                        "text": msg.text,
                        "time": msg.date.strftime('%Y-%m-%d %H:%M:%S'),
                        "timestamp": msg.date.isoformat()
                    })
                    count += 1
                    if len(all_messages) >= 800:
                        break

            if count > 0:
                channel_msgs[ch['title']] = count
                print(f"  ✅ {ch['title'][:50]:<50} {count:>3} msgs")

        except:
            pass

        if len(all_messages) >= 800:
            break

    await client.disconnect()

    print(f"\n  {'─'*80}")
    print(f"  📨 Total messages: {len(all_messages)}")
    print(f"  📡 Active channels: {len(channel_msgs)}\n")

    # Extract signals
    print("  " + "─"*80)
    print("  PHASE 2: EXTRACT SIGNALS\n")

    all_signals = []
    for msg in all_messages:
        params = extract_signal(msg['text'])
        if params['action']:
            sig = {
                **msg,
                **params,
                "diff_pips": round(abs(params['entry'] - TV_PRICE), 1) if params['entry'] else 999,
                "price_moved": round(TV_PRICE - params['entry'], 1) if params['entry'] else 0
            }
            all_signals.append(sig)

    print(f"  🎯 Total signals extracted: {len(all_signals)}\n")

    # Classify
    print("  " + "─"*80)
    print("  PHASE 3: CLASSIFY SIGNALS\n")

    accepted = []
    review = []
    rejected = []

    for sig in all_signals:
        sig['classification'] = classify_signal(sig, TV_PRICE)

        if sig['classification'] == "ACCEPT":
            accepted.append(sig)
        elif sig['classification'] == "REVIEW":
            review.append(sig)
        else:
            rejected.append(sig)

    print(f"  ✅ ACCEPT:  {len(accepted)}")
    print(f"  ⚠️  REVIEW:  {len(review)}")
    print(f"  ❌ REJECT:  {len(rejected)}\n")

    # Display ACCEPT
    if accepted:
        print("  " + "═"*80)
        print(f"  ACCEPT SIGNALS - {len(accepted)} Total\n")
        print(f"  {'#':<3} {'Time':<19} {'Channel':<25} {'Action':<6} {'Entry':>8} {'Diff':>6}")
        print(f"  {'-'*80}")
        for i, s in enumerate(accepted[:20], 1):
            print(f"  {i:<3} {s['time']:<19} {s['channel'][:25]:<25} {s['action']:<6} {s['entry']:>8.2f} {s['diff_pips']:>5.1f}p")
        if len(accepted) > 20:
            print(f"  ... and {len(accepted)-20} more")

    # Display REVIEW (top 20)
    if review:
        print(f"\n  " + "═"*80)
        print(f"  REVIEW SIGNALS - {len(review)} Total (Top 20 by variance)\n")
        review_sorted = sorted(review, key=lambda x: x['diff_pips'])
        print(f"  {'#':<3} {'Time':<19} {'Channel':<25} {'Action':<6} {'Entry':>8} {'Diff':>6}")
        print(f"  {'-'*80}")
        for i, s in enumerate(review_sorted[:20], 1):
            print(f"  {i:<3} {s['time']:<19} {s['channel'][:25]:<25} {s['action']:<6} {s['entry']:>8.2f} {s['diff_pips']:>5.1f}p")
        if len(review) > 20:
            print(f"  ... and {len(review)-20} more")

    # Statistics
    print(f"\n  " + "═"*80)
    print(f"  STATISTICS\n")

    buy_total = len([s for s in all_signals if s['action'] == 'BUY'])
    sell_total = len([s for s in all_signals if s['action'] == 'SELL'])

    buy_accept = len([s for s in accepted if s['action'] == 'BUY'])
    sell_accept = len([s for s in accepted if s['action'] == 'SELL'])

    print(f"  Signal Distribution:")
    print(f"    BUY:  {buy_total:>3} total  |  {buy_accept:>3} ACCEPT")
    print(f"    SELL: {sell_total:>3} total  |  {sell_accept:>3} ACCEPT")
    print()

    # Channels with best signals
    print(f"  Top Channels by ACCEPT signals:")
    channel_accepts = defaultdict(int)
    for s in accepted:
        channel_accepts[s['channel']] += 1

    for ch, count in sorted(channel_accepts.items(), key=lambda x: -x[1])[:10]:
        print(f"    • {ch[:50]:<50} {count}")

    # Save results
    results = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "date_range": f"2026-04-12 to 2026-04-13",
            "total_messages": len(all_messages),
            "total_signals": len(all_signals),
            "tv_price": TV_PRICE
        },
        "summary": {
            "accept": len(accepted),
            "review": len(review),
            "reject": len(rejected),
            "buy_accept": buy_accept,
            "sell_accept": sell_accept
        },
        "signals": {
            "accept": accepted[:100],
            "review": sorted(review, key=lambda x: x['diff_pips'])[:50],
            "reject_count": len(rejected)
        }
    }

    out = Path(__file__).parent / "data" / f"massive_test_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(out, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\n  💾 Saved: {out}")
    print(f"\n  {'█'*80}")
    print(f"  ✅ TEST COMPLETE - {len(accepted)} ACCEPT signals ready for action")
    print(f"  {'█'*80}\n")

    return results


if __name__ == '__main__':
    asyncio.run(massive_scrape())
