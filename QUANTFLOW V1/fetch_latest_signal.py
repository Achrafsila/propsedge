#!/usr/bin/env python3
"""
Fetch latest signals from Technical Pips channel
Focus on 01:04 signal
"""

import asyncio
import json
import re
from pathlib import Path
from datetime import datetime, timezone

API_ID = "38456630"
API_HASH = "4b2a85354b6e6d4103820dc92b522b53"
PHONE = "+212688434773"
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

    # Try to extract specific SL/TP
    sl_match = re.search(r'(?:SL|STOP)[:\s]+([0-9]{4,5}(?:\.[0-9]{1,2})?)', text_upper)
    if sl_match:
        sl = float(sl_match.group(1))

    tp_match = re.search(r'(?:TP|TAKE|TARGET)[1:\s]+([0-9]{4,5}(?:\.[0-9]{1,2})?)', text_upper)
    if tp_match:
        tp = float(tp_match.group(1))

    return {"action": action, "entry": entry, "sl": sl, "tp": tp}


async def fetch_latest():
    try:
        from telethon import TelegramClient
    except:
        print("❌ Telethon error")
        return

    print("\n" + "█"*82)
    print("█" + "  FETCH LATEST SIGNAL - TECHNICAL PIPS (01:04)".center(80) + "█")
    print("█"*82 + "\n")

    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        print("❌ Not authorized")
        return

    # Get Technical Pips channel ID
    config_file = Path(__file__).parent / "data" / "quantflow_monitoring_config.json"
    with open(config_file) as f:
        config = json.load(f)

    tech_pips = next((ch for ch in config['channels'] if 'Technical' in ch['title']), None)
    if not tech_pips:
        print("❌ Technical Pips channel not found")
        return

    print(f"  📡 Channel: {tech_pips['title']}")
    print(f"  🆔 ID: {tech_pips['id']}")
    print(f"  💰 TV Price: ${TV_PRICE} (OANDA:XAUUSD)\n")

    # Fetch recent messages
    print("  📨 Fetching recent messages...\n")

    messages = []
    async for msg in client.iter_messages(tech_pips['id'], limit=50):
        if msg.text:
            messages.append({
                "text": msg.text,
                "timestamp": msg.date.isoformat(),
                "time_str": msg.date.strftime('%H:%M:%S')
            })

    # Find message around 01:04
    target_time = "01:04"
    matching = []

    for msg in messages:
        time_str = msg['time_str'][:5]  # HH:MM
        if time_str == target_time or time_str.startswith("01:0"):
            matching.append(msg)

    await client.disconnect()

    if not matching:
        print(f"  ⚠️  No messages found at {target_time}")
        print(f"\n  Recent messages:")
        for msg in messages[:10]:
            print(f"    • {msg['time_str']}: {msg['text'][:60]}...")
        return

    print(f"  ✅ Found {len(matching)} message(s) at ~{target_time}:\n")

    # Process matching signals
    signals = []
    for msg in matching:
        params = extract_signal(msg['text'])

        if params['action'] and params['entry']:
            diff = abs(params['entry'] - TV_PRICE)
            price_moved = TV_PRICE - params['entry']

            # Calculate R/R
            rr = None
            if params['sl'] and params['tp']:
                risk = abs(params['entry'] - params['sl'])
                reward = abs(params['tp'] - params['entry'])
                rr = reward / risk if risk > 0 else None

            # Running check
            is_running = (
                (params['action'] == 'BUY' and price_moved > 0) or
                (params['action'] == 'SELL' and price_moved < 0)
            )

            signal = {
                "time": msg['time_str'],
                "action": params['action'],
                "entry": params['entry'],
                "sl": params['sl'],
                "tp": params['tp'],
                "tv_price": TV_PRICE,
                "diff_pips": round(diff, 2),
                "price_moved": round(price_moved, 2),
                "is_running": is_running,
                "rr": round(rr, 2) if rr else None,
                "raw_text": msg['text'][:150]
            }

            # Classify
            if diff <= 15 and params['sl'] and params['tp']:
                if rr and rr >= 1.5 and is_running:
                    classification = "ACCEPT ✅"
                else:
                    classification = "REVIEW ⚠️"
            elif diff <= 25 and is_running:
                classification = "REVIEW ⚠️"
            else:
                classification = "REJECT ❌"

            signal['classification'] = classification
            signals.append(signal)

    # Display results
    print("  " + "─"*78)
    for sig in signals:
        print(f"\n  🎯 SIGNAL @ {sig['time']}")
        print(f"  ├─ Action:        {sig['action']} ({sig['classification']})")
        print(f"  ├─ Entry Price:   ${sig['entry']:.2f}")
        print(f"  ├─ Stop Loss:     ${sig['sl']:.2f}" if sig['sl'] else "  ├─ Stop Loss:     —")
        print(f"  ├─ Take Profit:   ${sig['tp']:.2f}" if sig['tp'] else "  ├─ Take Profit:   —")
        print(f"  ├─ TV Price:      ${sig['tv_price']:.2f}")
        print(f"  ├─ Variance:      {sig['diff_pips']:.1f} pips")
        print(f"  ├─ Price Moved:   {sig['price_moved']:+.2f} pips")
        print(f"  ├─ Status:        {'RUNNING ✅' if sig['is_running'] else 'TRAPPED ❌'}")
        print(f"  ├─ R/R:           {sig['rr']:.2f}" if sig['rr'] else "  ├─ R/R:           —")
        print(f"  └─ Full text:     {sig['raw_text']}...")

    print(f"\n  " + "─"*78)

    # Summary
    accepts = [s for s in signals if "ACCEPT" in s['classification']]
    reviews = [s for s in signals if "REVIEW" in s['classification']]

    print(f"\n  📊 CLASSIFICATION:")
    print(f"     ✅ ACCEPT: {len(accepts)}")
    print(f"     ⚠️  REVIEW: {len(reviews)}")

    # Save result
    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "channel": tech_pips['title'],
        "tv_price": TV_PRICE,
        "signals": signals
    }

    out = Path(__file__).parent / "data" / f"latest_signal_{datetime.now().strftime('%H%M%S')}.json"
    with open(out, 'w') as f:
        json.dump(result, f, indent=2, default=str)

    print(f"\n  💾 Saved: {out}")
    print(f"\n{'█'*82}\n")

    return signals


if __name__ == '__main__':
    asyncio.run(fetch_latest())
