# Edge Pulse — Market Structure Definition Book

Status: **Draft, Sprint 2 (Market Structure calibration)**
Companion to `docs/edge-pulse-market-definitions.md` (Chapter 1, Liquidity). This
document is Chapter 2 — trend, swing-sequence, and structural-event definitions.
Same rules apply: every term is a mechanical rule over OHLC candles, deterministic,
no AI, no prediction, no trading instruction.

This is the **source of truth** for what a term means. Where the current
implementation (`swingDetection.ts`, `marketRegime.ts`, `marketPhase.ts`,
`structureEngine.ts`) diverges, that divergence is named in each concept's
**Known limitations** — this book is what the code should converge toward, not a
description of what it already does.

---

## Shared vocabulary

- **Closed candle**, **chronological order**, **N (fractal wing)** — identical to
  Chapter 1's shared vocabulary. N = 2 today, fixed across every timeframe.
- **Pivot** — a confirmed swing high or swing low (§1/§2).
- **Trend context** — whichever of `bullish_trend` / `bearish_trend` / `range` /
  `transition` / `unknown` the Regime Engine currently reports for a timeframe.
  Several concepts below (Pullback, BOS, CHoCH) are only meaningful *relative to*
  a trend context — none of them are evaluated context-free.

---

## 1. Confirmed Swing High

**Definition** — a closed candle whose `high` is the strict, unique maximum among
itself and N=2 closed candles on each side.
**Trading meaning** — the reference point a trader measures "higher high" against,
and the anchor for buy-side liquidity (Chapter 1, §3).
**Deterministic detection** — `swingDetection.ts::detectSwings`, unchanged from
Chapter 1 §1.
**Confirmation** — needs N closed candles after the pivot to exist.
**Invalidation** — never invalidated as a pivot (permanent historical fact); what
changes is whether it remains the *reference* HH (superseded by a later, higher
pivot) — see §3/§6 below.
**Examples** — highs `[101,103,106,104,102]` → `106` (index 2) confirmed.
**Counter-examples** — highs `[101,103,106,106,102]` → neither `106` qualifies
(tie).
**Known limitations** — N=2 fixed for every timeframe (Part 1 audit).

## 2. Confirmed Swing Low

Symmetric to §1 on the `low` field. Same detection function, same N, same
confirmation/invalidation rules, same limitation.

---

## 3. Higher High (HH)

**Definition** — the most recently confirmed swing high is priced above the
confirmed swing high before it.
**Trading meaning** — one leg of evidence that buyers are extending control —
never sufficient alone (a single HH with a Lower Low is *not* a bullish trend, see
§7).
**Deterministic detection** — `classifyDirection(prevHigh.price, currHigh.price)
=== "higher"`, evaluated over the **last two** confirmed swing highs only
(`marketRegime.ts`, `swingHighs.slice(-2)`).
**Confirmation** — both swings in the comparison must independently satisfy §1's
confirmation rule.
**Invalidation** — N/A directly; a HH is a historical comparison, not a live
level. (Contrast Chapter 1, where a *liquidity* level derived from the same swing
can be consumed/invalidated — that is a different concept living in the Liquidity
Engine, not here.)
**Examples** — confirmed swing highs `100 -> 105` → HH.
**Counter-examples** — `105 -> 100` → not a HH (Lower High, §5); `105 -> 105` →
neither (equal, see Range §10).
**Known limitations** — **only the last two swings are ever compared.** A
sequence of confirmed highs `[100, 108, 103, 110]` reports "HH" (103→110 is
higher) while completely ignoring that 108→103 was a Lower High one swing
earlier — a discretionary trader reading the full sequence would call this a
*choppy* or *transitional* uptrend, not a clean one, and would weight it very
differently than four cleanly ascending highs. This is the single most
consequential gap in Part 1's audit for anything downstream of "trend."

## 4. Higher Low (HL)

Symmetric to §3 on confirmed swing lows. Same "last two only" limitation.

## 5. Lower High (LH)

**Definition** — the most recently confirmed swing high is priced below the
confirmed swing high before it.
**Trading meaning** — one leg of evidence for seller control; in an existing
uptrend, a confirmed LH immediately after a HH is often a trader's first
hesitation signal (though not yet a CHoCH — see §18).
**Deterministic detection / confirmation / limitations** — symmetric to §3.
**Examples** — `108 -> 103` → LH. **Counter-examples** — `103 -> 108` → HH.

## 6. Lower Low (LL)

Symmetric to §4/§5 on confirmed swing lows.

---

## 7. Trend

**Definition** — a directionally consistent sequence of confirmed swing pivots:
Higher Highs paired with Higher Lows (bull), or Lower Highs paired with Lower Lows
(bear), sustained across **more than one** swing pair.
**Trading meaning** — the single most load-bearing read in discretionary trading —
almost every other judgment (is this a pullback or a reversal? is this expansion a
continuation?) is made *relative to* the current trend.
**Deterministic detection (current)** — `marketRegime.ts`: HH+HL → `bullish_trend`;
LH+LL → `bearish_trend`; anything else → `range` or `transition` depending on the
exact high/low direction combination.
**Confirmation** — requires ≥`MIN_COMPLETED_CANDLES=10` closed candles and ≥2
confirmed swings on each side (`MIN_SWINGS_FOR_DIRECTION=2`) before a trend can be
named at all.
**Invalidation** — a trend is re-evaluated fresh on every call, from scratch, over
whatever swing history is available — there is no "sticky" trend state that
persists until explicitly broken (a design choice worth naming explicitly: this
book takes no position on whether that's correct without live comparison, see
Part 5/7).
**Examples** — swing highs `[100,105,110]` + swing lows `[95,98,102]` → bull
trend.
**Counter-examples** — swing highs `[100,105,110]` + swing lows `[95,102,98]` (a
Lower Low breaks the sequence) → NOT a clean bull trend by a discretionary
trader's read, even though the current engine's "last two swings only" rule (§3
limitation) may still report `bullish_trend` if the LAST pair of lows happens to
tick up again after that LL.
**Known limitations** — inherits §3/§4's "last two swings only" gap directly; this
is where that gap has the most real-world consequence.

## 8. Bull Trend

Trend (§7) where the confirmed sequence is HH+HL. `marketRegime.ts`'s
`bullish_trend`. See §7 for full detection/confirmation/limitations.

## 9. Bear Trend

Trend (§7) where the confirmed sequence is LH+LL. `marketRegime.ts`'s
`bearish_trend`. Symmetric to §8.

---

## 10. Range

**Definition** — price oscillating between two relatively stable boundaries with
no sustained directional swing sequence — equal (or near-equal) swing highs and
equal (or near-equal) swing lows, or a narrowing high/low pattern.
**Trading meaning** — no structural edge in either direction; a discretionary
trader waits for a confirmed boundary break (§17) rather than trading the
"trend."
**Deterministic detection** — `marketRegime.ts`: equal-high + equal-low → `range`;
lower-high + higher-low (narrowing) → also classified `range`. Separately, when
too few confirmed swings exist at all, a **candle-overlap compression fallback**
(§11) also classifies as `range` — a second, differently-derived path to the same
label.
**Confirmation** — same ≥10-candle, ≥2-swings-per-side floor as Trend, OR the
compression-overlap fallback's own ≥60%-overlap rule over the last 6 candles.
**Invalidation** — a confirmed close beyond either boundary swing is a Structure
Break of the range (§17 sense), ending the range read on the next computation.
**Examples** — swing highs `[110,110]`, swing lows `[100,100]` → range.
**Counter-examples** — swing highs `[110,115]`, swing lows `[100,105]` → bull
trend, not range.
**Known limitations** — two structurally different rules (`equal/equal` vs. the
compression-overlap fallback) produce the identical `range` label with no way for
a consumer to tell which path fired — Regime's own evidence array explains it,
but nothing in `StructureResult` (the UI-facing shape) preserves that distinction.
Also note: `marketPhase.ts` independently computes a *different* concept also
translated as "narrow/contained price action" — **Rotation** (§ below, phase, not
regime) — a Range regime and a Rotation phase can co-exist or diverge, and today's
UI only ever shows Regime's "Ranging" label, never Phase's "Rotation" (see §11's
limitation and the audit's biggest finding).

---

## 11. Compression

**Definition** — candle ranges are contracting relative to a recent baseline; the
market is coiling, typically preceding an expansion move.
**Trading meaning** — a discretionary trader watches compression for a breakout
setup — direction unknown until it resolves.
**Deterministic detection** — `marketPhase.ts`: ≥2 of 3 conditions — (a) recent
6-candle median range ≤70% of the prior 12-candle median range (≤50% = "strong"),
(b) ≥60% of consecutive recent-window candle ranges overlap, (c) recent window is
fully contained inside the baseline window's high/low envelope.
**Confirmation** — needs the full 18-candle floor (`RECENT_WINDOW+BASELINE_WINDOW`).
**Invalidation** — a subsequent Expansion read (§12) on a later candle ends it —
phase is recomputed fresh each call, not maintained as state.
**Examples** — 12 candles of range ~4, then 6 candles of range ~2, all contained
within the 12-candle envelope → compression, high confidence (if ratio ≤50% too).
**Counter-examples** — recent range shrinks to 70% of baseline but recent price
action pokes outside the baseline envelope → only 1 of 3 conditions holds (ratio)
→ not compression (falls through to Rotation or Unknown).
**Known limitations — critical (this audit's top finding)**: `structureEngine.ts`
computes this value correctly every call and then **discards it**. Nothing in
`StructureResult`, `copy.ts`, or any UI section currently displays "H4 is
compressing" — the only phase value that survives to the trader-facing layer is
`pullback` (as a label suffix). A trader cannot see this concept anywhere in Edge
Pulse today despite it being fully computed.

## 12. Expansion

**Definition** — a decisive, directional range increase: the latest closed
candle's range is materially larger than a recent baseline AND its close clears
the recent structural high/low.
**Trading meaning** — the market is actively moving, not consolidating; whether
this supports or fights the existing trend (§19 Continuation vs §15 Reversal) is
the next question a trader asks — the engine does not currently answer it (see
limitations).
**Deterministic detection** — `marketPhase.ts`: latest candle range ≥150% of the
12-candle baseline median (≥200% = "strong") AND its close clears the
prior-5-candle structural high/low in one direction. A large wick that expands
range without a directional close is explicitly excluded ("a large wick alone is
not enough for expansion").
**Confirmation** — single-candle-confirmable (checked first, before Pullback,
Compression, Rotation) — by construction the most decisive, fastest-confirming
phase read.
**Invalidation** — recomputed fresh each call; a subsequent quiet candle simply
stops re-triggering it.
**Examples** — baseline range ~4, latest candle range 9 (225%), closes above the
prior 5-candle high → expansion, at least medium confidence.
**Counter-examples** — same latest candle, but its close lands back inside the
prior 5-candle range (huge wick, flat close) → NOT expansion, explicitly.
**Known limitations — critical, same as §11**: never surfaced to the trader-facing
layer. Additionally: **expansion has no directional-agreement check against the
current trend.** A sharp reversal candle against an established uptrend and a
sharp continuation candle with it are BOTH just "expansion" — the phase engine
alone cannot tell a discretionary trader "this is trend continuation" vs. "this
is a reversal attempt." That distinction requires cross-referencing Regime's
trend direction against the expansion's own direction — not implemented anywhere
today (this is exactly the missing piece behind Continuation §19 and Reversal
§15 below).

---

## 13. Pullback

**Definition** — a shallow, short corrective move against an *already-established*
trend that has not invalidated the trend's defining structure.
**Trading meaning** — the textbook "buy the dip / sell the rip" condition — a
trader wants confirmation this is a pullback (not the start of a reversal) before
treating a countertrend move as an opportunity to re-enter with the trend.
**Deterministic detection** — `marketPhase.ts::evaluatePullback`, **only
evaluated when the caller supplies a trend regime** (bullish_trend/bearish_trend —
never for range/transition/unknown, by design). Retracement from the most extreme
point in the last 10 candles must be 0.5%–20% of that extreme, with ≥2 candles
since the extreme closing against the trend.
**Confirmation** — the extreme must have occurred *before* the latest candle (if
price is still making new highs/lows, there is no pullback yet — checked
explicitly).
**Invalidation** — a retracement beyond 20% of the extreme, or a break of the
trend's defining swing (the last HL in an uptrend, last LH in a downtrend), stops
qualifying as a Pullback — the deeper case becomes a Correction (§14) and,
if the defining swing is actually broken, a CHoCH (§18).
**Examples** — uptrend, recent high 118, latest close 116 (1.7% retracement), 2
prior closes each lower than the one before → pullback.
**Counter-examples** — same retracement math but regime is `range` (no trend
context supplied) → never labelled pullback, by design, even if the price action
looks identical — this is intentional, not a gap (`market-phase-scenarios.ts`
tests this directly: "Same price action WITHOUT a trend regime -> never labelled
pullback").
**Known limitations** — the 0.5%–20% band is a single, universal percentage
range applied to every instrument and timeframe alike — unlike Chapter 1's
liquidity tolerance (self-scaling to recent range), Pullback's band never adapts
to instrument volatility or timeframe. A 20% pullback threshold that is
reasonable on Daily gold may be far too permissive on M15 EURUSD.

## 14. Correction

**Definition** — the broader, un-bounded parent concept of a countertrend move:
any retracement against the established trend, whether shallow (Pullback, §13) or
deep enough to challenge the trend's defining structure.
**Trading meaning** — traders use "correction" more loosely than "pullback" —
often *including* moves that turn out to break structure. This book treats
Correction as the umbrella term and Pullback as the engine's specific, bounded
sub-case.
**Deterministic detection** — **not implemented as its own distinct state.**
Today, a countertrend move is either classified `pullback` (inside the
0.5%–20% band with ≥2 counter-closes) or falls through to whatever the next phase
rule matches (compression/rotation/unknown) — there is no explicit "Correction"
bucket for a countertrend move that's deeper than 20% but hasn't yet broken the
defining swing.
**Confirmation / Invalidation** — inherits Pullback's rules up to the 20% band;
beyond that, this book proposes Correction take over up to the point the defining
swing is actually broken (at which point it becomes CHoCH/Reversal, §15/§18).
**Examples** — uptrend, 25% retracement from the recent high, defining HL not yet
broken → this book calls it a Correction; the current engine has no matching
label and falls through toward Unknown.
**Counter-examples** — same 25% retracement, but the defining HL IS broken by a
confirmed close → CHoCH (§18), not merely a Correction.
**Known limitations** — genuinely missing from the current model, not just
under-surfaced. Proposed as a new phase value in Part 3.

## 15. Reversal

**Definition** — a trend has actually flipped: the market's own trend
classification (§7) changes from bull to bear or vice versa, evidenced by a second
confirming swing in the new direction (not merely one broken level).
**Trading meaning** — the highest-conviction structural event a trader tracks —
distinct from CHoCH (§18), which is the *first warning*, not confirmation.
**Deterministic detection** — **not implemented as its own concept.** Today, the
regime simply gets recomputed from scratch every call; if the new swing sequence
happens to satisfy the opposite trend's HH+HL/LH+LL rule, `MarketRegimeResult`
silently flips from `bullish_trend` to `bearish_trend` between two calls with no
"this is a confirmed reversal, here is the CHoCH that started it" narrative
attached.
**Confirmation** — this book proposes: a Reversal is confirmed when (a) a CHoCH
(§18) has fired, AND (b) a second, opposite-direction swing has since confirmed,
satisfying Trend's own §7 rule in the new direction.
**Invalidation** — N/A (a confirmed reversal is a historical fact once it
happens); the *new* trend is subject to its own future CHoCH the same way.
**Examples** — uptrend; CHoCH fires (close below the last HL); next confirmed
swing high is lower than the one before it AND next confirmed swing low is lower
too → Reversal confirmed, regime flips to `bearish_trend`.
**Counter-examples** — CHoCH fires, but the very next swing high is actually
higher again (the "reversal" fails to follow through) → not a Reversal, this book
would call it a Failed CHoCH / structure held (see §20/§21 relationship).
**Known limitations** — entirely unimplemented as an explicit, narratable event.

## 16. Transition

**Definition** — swing structure that agrees on neither a clean trend nor a clean
range — e.g. highs and lows moving in disagreeing directions, or a fresh,
still-unconfirmed breakout that hasn't yet earned a second confirming swing.
**Trading meaning** — genuinely ambiguous structure; a discretionary trader
would typically wait rather than assume either a trend or a range.
**Deterministic detection** — `marketRegime.ts`: the fallback classification
whenever high-direction and low-direction disagree in a way that matches neither
the trend nor range rules, OR whenever a fresh breakout override fires against a
non-matching regime (see §17).
**Confirmation** — always `low` confidence, by construction — the engine's own
comment states transition "by construction means the structure has not yet
resolved."
**Invalidation** — resolves (into trend or range) once a second confirming swing
forms — same mechanism as everything else, recomputed fresh each call.
**Examples** — swing highs disagree in direction from swing lows in a way that
satisfies neither HH+HL, LH+LL, equal/equal, nor the narrowing case.
**Counter-examples** — HH+HL → `bullish_trend`, never transition.
**Known limitations** — `Transition` and `Bullish/Bearish Shift` (structureEngine's
UI label, fired when a breakout direction exists during a `transition` regime) are
functionally the closest thing to a CHoCH/BOS signal that exists today, but
neither is labelled, scored, or explained as such — a trader sees "Transition" or
"Bullish Shift" with no indication of *why*, and no distinction between "this
transition is a break of the prevailing trend's structure" (CHoCH) vs. "this
transition is just noisy, directionless chop."

---

## 17. Structure Break (BOS)

**Definition** — a confirmed candle close beyond the most recent swing point **in
the direction that reinforces the currently-established trend** (or, for a range,
beyond the range's own boundary).
**Trading meaning** — confirms continuation; the market has cleared the level a
trader would use to judge "is the trend still working."
**Deterministic detection (target, not yet implemented as a labelled concept)** —
reuses the EXISTING `detectBreakout` primitive (`swingDetection.ts`) unchanged:
a confirmed close beyond the nearest prior swing of the relevant type. The
**only missing piece is a labelling rule**: `breakout.direction === (regime is
bullish_trend ? "bullish" : "bearish")` → label it BOS. No new low-level math is
required — see Part 7.
**Confirmation** — inherits `detectBreakout`'s existing rule: a single confirmed
close is sufficient (this book does not propose requiring a second confirming
candle, matching the existing engine's own single-candle-confirmable design for
this primitive — see Part 7's reasoning on why NOT to add an unjustified extra
bar).
**Invalidation** — a subsequent close back on the origin side does not
"unhappen" a BOS that already closed — but see Failed Break (§20) for the
single-candle wick case, and False Break (§21) for the multi-candle case this
book flags as a genuine, currently-unimplemented gap.
**Examples** — uptrend; latest confirmed close breaks above the prior swing high
→ bullish BOS (continuation).
**Counter-examples** — uptrend; latest confirmed close breaks *below* the prior
swing low → this is NOT a BOS, it is a CHoCH (§18) — opposite meaning, same
underlying primitive.
**Known limitations** — not implemented as a distinguishable, labelled, exposed
concept anywhere today; folds into the generic `transition` regime or `Shift`
structure label with no BOS/CHoCH distinction attached.

## 18. Change of Character (CHoCH)

**Definition** — a confirmed candle close beyond the swing point that *defines*
the currently-established trend's structure (the last HL in an uptrend, the last
LH in a downtrend) — the first structural evidence that the trend may be ending.
**Trading meaning** — the classic "something changed" signal — not yet a
confirmed Reversal (§15), but the point at which a discretionary trader stops
assuming trend continuation by default.
**Deterministic detection (target)** — same `detectBreakout` primitive as BOS,
with the OPPOSITE labelling condition: `breakout.direction !== ` the trend's own
direction, while regime is currently `bullish_trend`/`bearish_trend`. Mechanically
identical detection, contextually opposite meaning — the distinguishing input is
purely "what was the regime immediately before this candle," which the engine
already computes and simply never cross-references against breakout direction.
**Confirmation** — same single-confirmed-close rule as BOS.
**Invalidation** — a CHoCH that is not followed by a second confirming
opposite-direction swing does not escalate to a Reversal (§15) — this book treats
that case as a **Failed CHoCH** (structure held), distinct from a fully
unconfirmed transition.
**Examples** — uptrend (HH+HL); latest confirmed close breaks below the last
confirmed HL → bearish CHoCH.
**Counter-examples** — same uptrend, latest confirmed close breaks above the last
confirmed HH → that's a BOS (continuation), not a CHoCH.
**Known limitations** — entirely unimplemented as a distinguishable concept.

---

## 19. Continuation

**Definition** — price resumes in the direction of the established trend after a
Pullback/Correction, without the trend's defining swing having been violated.
**Trading meaning** — the "all clear" read after a pullback — the higher-timeframe
thesis remains intact.
**Deterministic detection (target)** — an Expansion (§12) whose directional close
agrees with the current trend direction, occurring after a Pullback/Correction
phase, with no intervening CHoCH.
**Confirmation** — inherits Expansion's single-candle-confirmable rule.
**Invalidation** — N/A directly (a historical read); the trend itself remains
subject to a future CHoCH.
**Examples** — uptrend, pullback phase, then a directional expansion candle
closing above the prior structural high (not just the pullback's own local
high) → continuation.
**Counter-examples** — same setup, but the expansion candle closes *down*,
through the trend's defining HL → that is a CHoCH-driven reversal attempt, not a
continuation.
**Known limitations** — not implemented; requires the same missing
Regime-direction × Expansion-direction cross-reference as BOS/CHoCH (§17/§18).
This book proposes implementing all three (BOS, CHoCH, Continuation) as one
composition step, since they share the identical cross-reference.

## 20. Failed Break

**Definition** — a single candle's wick pierces beyond a confirmed swing level,
but that same candle's own close comes back on the origin side.
**Trading meaning** — the market tested a level and immediately rejected it — a
trader's first piece of evidence the level may hold.
**Deterministic detection** — already implemented, `swingDetection.ts::
detectBreakout`, evaluated only against the single latest completed candle vs.
the nearest prior swing.
**Confirmation** — the piercing candle IS its own confirmation (one-candle rule).
**Invalidation** — N/A; a failed break is itself already the resolved outcome of
one candle.
**Examples** — prior swing high 110.5; latest candle high 112, close 108 → failed
break.
**Counter-examples** — same wick, but close at 111 (beyond 110.5) → that's a
confirmed break (BOS or CHoCH depending on trend context), not a failed break.
**Known limitations** — correctly implemented, but scoped to exactly one candle
— see False Break (§21) for the multi-candle version this book identifies as
missing.

## 21. False Break

**Definition** — price **confirms** a break (one or more candles close beyond the
level, satisfying §17/§18's own confirmation rule) but, within a short
deterministic window, reverses back through the level, retroactively
invalidating the apparent BOS/CHoCH.
**Trading meaning** — the "bull trap" / "bear trap" pattern — a confirmed-looking
break that turns out to be a liquidity grab rather than genuine structure change.
Distinguishing this from a genuine BOS/CHoCH as early as possible is one of the
highest-value judgments a discretionary trader makes.
**Deterministic detection (target, not implemented)** — this book proposes: a
confirmed BOS/CHoCH is provisionally "unconfirmed-stable" for a fixed number of
subsequent closed candles (a window analogous to Chapter 1's
`SWEEP_SCAN_LOOKBACK_CANDLES`, but much shorter — e.g. 2–3 candles, to be
calibrated against real data, never invented from nothing); if a candle within
that window closes back on the origin side of the broken level, the BOS/CHoCH is
relabelled **False Break** instead, and the pre-break trend/regime is restored.
**Confirmation** — the reversal-back-through candle IS the confirmation of
"false," symmetric to how the original break candle confirmed the BOS/CHoCH.
**Invalidation** — once the window elapses without a reversal-back-through, the
break is permanently confirmed (can no longer become "false" retroactively).
**Examples** — uptrend; confirmed close below the last HL (CHoCH); 2 candles
later, a confirmed close back above that same HL → False Break, uptrend
structure considered to have held.
**Counter-examples** — same CHoCH, but the window elapses with price staying
below the HL, and a second lower swing then confirms → Reversal (§15), not a
False Break.
**Known limitations** — entirely unimplemented. This is structurally the same
gap Chapter 1 flagged for Liquidity (`swept -> consumed` needing a full
forward-scan, not a single-candle check) — the same "scan forward, don't stop at
the first match" discipline that fixed the Liquidity Engine's sweep bug applies
here too, and should reuse the same pattern, not a new one.

---

## Appendix A — Proposed typed model (Sprint 2, Part 3)

```ts
export type StructureTimeframeLabel = "M15" | "H1" | "H4" | "D1";
export type TrendDirection = "bull" | "bear" | "range" | "transition" | "unknown";

// BOS and CHoCH share one shape — same underlying detectBreakout primitive,
// opposite labelling condition (§17/§18). `status` lets a False Break (§21)
// retroactively relabel a BOS/CHoCH without deleting the historical record.
export interface StructuralEvent {
  type: "BOS" | "CHoCH";
  direction: "bullish" | "bearish";
  price: number;       // the swing level that was broken
  confirmedAt: string; // ISO timestamp of the confirming candle
  status: "confirmed" | "false_break";
}

export interface MarketStructureState {
  symbol: string;
  timeframe: StructureTimeframeLabel;
  trend: TrendDirection;

  latestHH: number | null;
  latestHL: number | null;
  latestLH: number | null;
  latestLL: number | null;

  lastBOS: StructuralEvent | null;
  lastCHoCH: StructuralEvent | null;

  // Phase flags, broken out individually rather than one mutually-exclusive
  // enum — today's engine only ever returns ONE phase value per call, but
  // giving each concept its own field (a) matches how a trader actually
  // reasons ("this IS compressing AND rotating" is a coherent trader
  // statement even if today's engine can't yet say both at once), and
  // (b) is what makes Compression/Expansion/Rotation representable in the
  // UI at all — the audit's biggest single finding is that these are
  // computed today and never surfaced anywhere.
  pullback: boolean;
  correction: boolean;   // NEW — deeper-than-pullback, not-yet-CHoCH (§14)
  expansion: boolean;
  compression: boolean;
  rotation: boolean;

  continuation: boolean; // NEW — expansion agreeing with trend, no intervening CHoCH (§19)
  reversal: boolean;     // NEW — trend has actually flipped, evidenced by a 2nd confirming swing after a CHoCH (§15)

  strength: "low" | "medium" | "high" | "unavailable"; // same rating vocabulary as Chapter 1's LiquidityStrength
  evidence: string[]; // collapsed Technical Reasoning only, never shown by default
}
```

Mapping from what exists today:
- `trend` = `MarketRegimeResult.regime`, renamed to trader vocabulary (`bull`/
  `bear` for `bullish_trend`/`bearish_trend`, otherwise unchanged).
- `latestHH`/`latestHL`/`latestLH`/`latestLL` = already computed in
  `structureEngine.ts`, unchanged.
- `pullback`/`expansion`/`compression`/`rotation` = `MarketPhaseResult.phase`,
  unpacked from one enum into individual flags (additive, not a rewrite of
  `marketPhase.ts` itself — same "compose, don't rewrite" discipline as
  Chapter 1).
- `lastBOS`/`lastCHoCH`/`continuation`/`reversal`/`correction` = genuinely new,
  detailed in Part 7's implementation plan below.

This is a **proposal only** — nothing in the codebase has been changed to match
it, per this sprint's scope ("do not implement yet if migration is required").

## Appendix B — Gap table (current vs. target), Sprint 2 Part 4

| Concept | Current behaviour | Target behaviour | Gap | Severity |
|---|---|---|---|---|
| Confirmed Swing High/Low | N=2 fixed for every timeframe | N scaled per timeframe | Same noise-rejection window on M15 and D1 | Medium |
| HH / HL / LH / LL | Compares only the **last two** confirmed swings | Judge trend from a longer, majority-consistent run of swings | A choppy sequence with one bad swing 2-back reads identically to a clean trend | **Critical** |
| Trend / Bull / Bear | Recomputed from scratch each call; confidence uses swing-pair depth only | Same recompute model, but confidence should also reflect sequence *consistency*, not just depth | No penalty for a trend whose most recent swings disagree with the swing before them | High |
| Range | Two different rules (`equal/equal`, and a separate compression-overlap fallback) both output the same `range` label | Distinguish "boundary-defined range" from "insufficient-structure fallback" | Consumer cannot tell which rule fired without reading raw evidence strings | Medium |
| Compression (phase) | Computed correctly every call | Displayed in the Market Structure section | **Never surfaced anywhere in Edge Pulse today** | **Critical** |
| Expansion (phase) | Computed correctly; no directional-agreement check vs. trend | Cross-referenced against trend direction to distinguish Continuation from a reversal attempt | Never surfaced; no directional-agreement logic exists at all | **Critical** |
| Rotation (phase) | Computed, silently dropped identically to Compression | Displayed, and clearly distinguished from Range (regime) | Never displayed; conflated with "Ranging" in the one place phase leaks through (nowhere, currently) | High |
| Pullback | Universal 0.5%–20% retracement band for every instrument/timeframe | Self-scaling band, same discipline as Chapter 1's liquidity tolerance | A 20% band is not equally meaningful on Daily Gold vs. M15 EURUSD | Medium |
| Correction | Not implemented — falls through to compression/rotation/unknown | Explicit phase bucket for a countertrend move deeper than Pullback but short of CHoCH | Missing entirely | High |
| Reversal | Not implemented — regime silently flips between calls with no narrative | Explicit event: CHoCH + a second confirming opposite-direction swing | Missing entirely, no explanation ever surfaced when a trend flips | **Critical** |
| Transition | Single generic catch-all label | Should differentiate a CHoCH-driven transition from directionless noise | Same label, two very different real situations | High |
| Structure Break (BOS) | Folds into generic `transition`/`Shift`; not labelled | Explicit labelled event, reusing the *existing* `detectBreakout` primitive unchanged | Detection math already exists; only the labelling/cross-reference step is missing | **Critical** |
| Change of Character (CHoCH) | Not distinguished from BOS at all | Explicit labelled event: same primitive, opposite cross-reference condition | Missing entirely — paired with BOS as the sprint's central finding | **Critical** |
| Continuation | Not implemented | Expansion agreeing with trend direction, following a Pullback, with no intervening CHoCH | Missing | High |
| Failed Break | Implemented correctly, single-candle wick-and-close-back | No change needed | None | None |
| False Break | Not implemented — no multi-candle retrospective check exists | Forward-scan confirmation window (same discipline as Chapter 1's swept→consumed fix); a BOS/CHoCH reversed-through within the window retroactively relabels as False Break | Missing entirely — the same class of bug the Liquidity Engine's sweep fix addressed, now found in Structure too | **Critical** |
