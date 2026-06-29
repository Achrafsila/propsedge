#!/usr/bin/env python3
"""
QUANTFLOW V1 - Pipeline Steps 6, 7, 8
Uses TradingView live price + raw results from Step 1-5
"""

import json
from pathlib import Path
from datetime import datetime

TV_PRICE   = 4680.92
TV_OPEN    = 4681.13
TV_HIGH    = 4681.885
TV_LOW     = 4680.905
TV_SYMBOL  = "OANDA:XAUUSD"
TV_TIME    = "2026-04-13 01:41 UTC"


def divider(title=""):
    line = "═" * 80
    print(f"\n╔{line}╗")
    print(f"║  {title:<76}║")
    print(f"╚{line}╝\n")


def row(label, value, icon=""):
    print(f"  {icon} {label:<40} {value}")


def rr_rating(rr):
    if rr is None: return "—"
    if rr >= 2.0:  return f"{rr:.2f} ⭐⭐⭐"
    if rr >= 1.5:  return f"{rr:.2f} ⭐⭐"
    if rr >= 1.0:  return f"{rr:.2f} ⭐"
    return f"{rr:.2f} ❌"


def main():
    # Load raw results from steps 1-5
    raw_file = Path(__file__).parent / "data" / "pipeline_test_raw.json"
    with open(raw_file) as f:
        data = json.load(f)

    signals = data['signals']
    meta    = data['meta']

    # Deduplicate: same channel + action + entry
    seen = set()
    unique_signals = []
    for s in signals:
        key = (s['channel'], s['action'], s.get('entry'))
        if key not in seen:
            seen.add(key)
            unique_signals.append(s)

    # ─── STEP 6: TRADINGVIEW VERIFICATION ─────────────────────────────────────
    divider("STEP 6 │ TRADINGVIEW PRICE VERIFICATION (Live)")

    row("Symbol:",        TV_SYMBOL,         "📊")
    row("Live Price:",    f"${TV_PRICE}",     "💰")
    row("Open:",          f"${TV_OPEN}",      "📈")
    row("High:",          f"${TV_HIGH}",      "📈")
    row("Low:",           f"${TV_LOW}",       "📉")
    row("Fetch time:",    TV_TIME,            "🕐")
    row("Source:",        "OANDA (Real-time)","✅")

    print()
    STALE_THRESHOLD = 20  # pips

    verified = []
    for s in unique_signals:
        entry = s.get('entry')
        if not entry:
            continue
        diff = abs(entry - TV_PRICE)
        status = "VALID" if diff <= STALE_THRESHOLD else "STALE"

        # Compute R/R if we have SL + TP
        rr = None
        sl = s.get('sl')
        tp = s.get('tp')
        if sl and tp and entry:
            risk   = abs(entry - sl)
            reward = abs(tp - entry)
            rr = round(reward / risk, 2) if risk > 0 else None

        s['tv_price']      = TV_PRICE
        s['diff_pips']     = round(diff, 2)
        s['tv_status']     = status
        s['rr']            = rr
        s['price_moved']   = round(TV_PRICE - entry, 2)  # positive = moved in BUY direction
        verified.append(s)

    print(f"  {'#':<3} {'Channel':<28} {'Act':<5} {'Entry':>8}  {'TV Price':>8}  {'Diff':>6}  {'Status':<8}  R/R")
    print(f"  {'─'*78}")
    for i, s in enumerate(verified, 1):
        icon = "✅" if s['tv_status'] == "VALID" else "⚠️ "
        rr_str = rr_rating(s['rr'])
        ts = s['timestamp'][11:16]
        print(f"  {i:<3} {s['channel'][:28]:<28} {s['action']:<5} {s['entry']:>8.2f}  {TV_PRICE:>8.2f}  {s['diff_pips']:>5.1f}p  {icon} {s['tv_status']:<6}  {rr_str}")

    valid_count = sum(1 for s in verified if s['tv_status'] == 'VALID')
    stale_count = sum(1 for s in verified if s['tv_status'] == 'STALE')
    print(f"\n  {'─'*78}")
    row("VALID signals (≤20 pips from TV):", str(valid_count), "✅")
    row("STALE signals (>20 pips from TV):", str(stale_count), "⚠️")

    # ─── STEP 7: LIQUIDITY ANALYSIS ───────────────────────────────────────────
    divider("STEP 7 │ LIQUIDITY & RETAIL POSITIONING ANALYSIS")

    # Count overall retail bias
    buy_count  = sum(1 for s in verified if s['action'] == 'BUY')
    sell_count = sum(1 for s in verified if s['action'] == 'SELL')
    total      = buy_count + sell_count
    buy_pct    = round(buy_count / total * 100) if total > 0 else 0
    sell_pct   = 100 - buy_pct

    print(f"  📊 RETAIL BIAS ACROSS ALL CHANNELS (23:00 → now)")
    print(f"  {'─'*60}")
    bar_buy  = "█" * (buy_pct  // 4)
    bar_sell = "█" * (sell_pct // 4)
    print(f"  BUY  [{bar_buy:<25}] {buy_pct:>3}%  ({buy_count} signals)")
    print(f"  SELL [{bar_sell:<25}] {sell_pct:>3}%  ({sell_count} signals)")
    print()

    dominant = "BUY (BULLISH)" if buy_pct > sell_pct else "SELL (BEARISH)"
    crowding  = "HIGH CROWDING" if max(buy_pct, sell_pct) > 70 else "MODERATE" if max(buy_pct, sell_pct) > 55 else "BALANCED"

    row("Dominant retail bias:", dominant,  "🎯")
    row("Crowd level:",         crowding,   "👥")
    row("Price movement:",      f"TV price {TV_PRICE} — signals avg entry {round(sum(s['entry'] for s in verified) / len(verified), 2) if verified else 'N/A'}", "📈")

    print(f"\n  📋 PER-SIGNAL LIQUIDITY ASSESSMENT")
    print(f"  {'─'*78}")
    print(f"  {'#':<3} {'Channel':<28} {'Act':<5} {'Entry':>8}  {'Moved':>7}  {'Positioning':<16} {'R/R'}")
    print(f"  {'─'*78}")

    analyzed = []
    for i, s in enumerate(verified, 1):
        moved = s['price_moved']
        action = s['action']

        # Determine if retail is trapped or correctly positioned
        if action == 'BUY' and moved > 5:
            positioning = "RUNNING ✅"
            trap_status = "IN PROFIT"
        elif action == 'BUY' and moved < -5:
            positioning = "TRAPPED 🔴"
            trap_status = "STOP HUNT"
        elif action == 'SELL' and moved < -5:
            positioning = "RUNNING ✅"
            trap_status = "IN PROFIT"
        elif action == 'SELL' and moved > 5:
            positioning = "TRAPPED 🔴"
            trap_status = "STOP HUNT"
        else:
            positioning = "NEUTRAL ⚪"
            trap_status = "AT ENTRY"

        s['positioning']  = positioning
        s['trap_status']  = trap_status
        analyzed.append(s)

        moved_str = f"+{moved:.1f}" if moved > 0 else f"{moved:.1f}"
        rr_str = f"{s['rr']:.2f}" if s['rr'] else "  —  "
        print(f"  {i:<3} {s['channel'][:28]:<28} {action:<5} {s['entry']:>8.2f}  {moved_str:>7}p  {positioning:<16} {rr_str}")

    # ─── STEP 8: FINAL DECISIONS ──────────────────────────────────────────────
    divider("STEP 8 │ FINAL DECISION ENGINE")

    print(f"  Rules applied:")
    print(f"    • ACCEPT  → Valid + R/R ≥ 1.5 + Not trapped")
    print(f"    • REVIEW  → Valid + R/R < 1.5 OR Stale but good setup")
    print(f"    • REJECT  → Stale + bad R/R OR Trapped retail\n")
    print(f"  {'─'*78}")
    print(f"  {'#':<3} {'Channel':<28} {'Action':<5} {'Entry':>8}  {'Decision':<10} {'Confidence':<12} Reason")
    print(f"  {'─'*78}")

    decisions = []
    for i, s in enumerate(analyzed, 1):
        rr    = s['rr']
        valid = s['tv_status'] == 'VALID'
        trap  = "TRAPPED" in s['positioning']
        run   = "RUNNING" in s['positioning']

        if valid and rr and rr >= 1.5 and run:
            decision   = "ACCEPT ✅"
            confidence = "HIGH"
            reason     = f"Valid + R/R {rr} + Running"
        elif valid and run and not rr:
            decision   = "REVIEW ⚠️"
            confidence = "MEDIUM"
            reason     = "Valid + Running — no TP/SL"
        elif valid and rr and rr >= 1.0 and not trap:
            decision   = "REVIEW ⚠️"
            confidence = "MEDIUM"
            reason     = f"Valid R/R {rr} — verify entry"
        elif trap:
            decision   = "REJECT ❌"
            confidence = "HIGH"
            reason     = "Retail trapped — avoid"
        elif not valid and run:
            decision   = "REVIEW ⚠️"
            confidence = "LOW"
            reason     = "Stale but running — late entry risk"
        else:
            decision   = "REJECT ❌"
            confidence = "HIGH"
            reason     = "Stale signal — expired"

        decisions.append({**s, "decision": decision, "confidence": confidence, "reason": reason})
        print(f"  {i:<3} {s['channel'][:28]:<28} {s['action']:<5} {s['entry']:>8.2f}  {decision:<10} {confidence:<12} {reason}")

    # ─── FINAL SUMMARY ────────────────────────────────────────────────────────
    divider("FINAL PIPELINE SUMMARY")

    accepted = [d for d in decisions if "ACCEPT" in d['decision']]
    review   = [d for d in decisions if "REVIEW" in d['decision']]
    rejected = [d for d in decisions if "REJECT" in d['decision']]

    print(f"  📊 PIPELINE RESULTS:")
    print(f"  {'─'*50}")
    row("Time window:",            f"{meta['start_time'][11:16]} → {meta['end_time'][11:16]} UTC", "🕐")
    row("Total messages fetched:", str(meta['total_messages']),    "📨")
    row("Active channels:",        str(meta['active_channels']),   "📡")
    row("Raw signals detected:",   str(meta['raw_signals']),       "🎯")
    row("Extracted (full params):", str(meta['extracted_signals']), "🔧")
    row("After deduplication:",    str(len(unique_signals)),       "🔄")
    row("Verified vs TradingView:", str(len(verified)),            "📊")
    print()
    row("ACCEPT signals:",  f"{len(accepted)}  →  {', '.join([d['channel'][:20] for d in accepted]) or 'None'}", "✅")
    row("REVIEW signals:",  str(len(review)),  "⚠️")
    row("REJECT signals:",  str(len(rejected)),"❌")
    print()
    row("TradingView Price:",  f"${TV_PRICE} (OANDA:XAUUSD)",  "💰")
    row("Market bias:",        f"{dominant} — {crowding}",      "📈")

    # Save full report
    report = {
        "generated_at": datetime.now().isoformat(),
        "meta": meta,
        "tradingview": {"symbol": TV_SYMBOL, "price": TV_PRICE, "time": TV_TIME},
        "summary": {
            "accepted": len(accepted),
            "review": len(review),
            "rejected": len(rejected),
            "dominant_bias": dominant,
            "crowding": crowding
        },
        "decisions": decisions
    }

    out = Path(__file__).parent / "data" / f"full_report_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(out, 'w') as f:
        json.dump(report, f, indent=2, default=str)

    print()
    row("Full report saved:", str(out), "💾")
    print(f"\n{'█'*82}")
    print("  ✅  QUANTFLOW V1 — FULL PIPELINE TEST COMPLETE")
    print(f"{'█'*82}\n")


if __name__ == '__main__':
    main()
