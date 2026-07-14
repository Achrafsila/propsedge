# Edge Pulse — Market Definition Book

Status: **Draft, Sprint 1 (Liquidity only)**
Scope of this document: deterministic definitions for Edge Pulse's market-structure
concepts. Nothing here is AI-generated, predictive, or a trading instruction — every
term below is defined as a mechanical rule over OHLC candles, or it isn't in Edge
Pulse at all.

This is the **source of truth** for what a term means. Where the current
implementation (`src/lib/edge-pulse/engines/liquidityEngine.ts`,
`src/lib/market/engines/swingDetection.ts`) diverges from the definition below, that
divergence is called out explicitly in each concept's **Known limitations** — this
book is not a description of the code, it is what the code should converge toward.

Out of scope for this chapter (future sprints): Supply/Demand zones, Volume,
Order Blocks, BOS/CHoCH. Chapter 1 covers swing-based, single-price liquidity only.

---

## Shared vocabulary

These terms recur in every definition below and are defined once here rather than
repeated:

- **Closed / completed candle** — a candle whose period has fully elapsed. The
  candle at index 0 of any candle array in this codebase is always the
  *currently-forming* candle and is never treated as closed, never used for swing
  detection, and never used for confirmation.
- **Chronological order** — candles ordered oldest → newest. Provider feeds
  (TwelveData, FMP) return newest-first; every detection rule below reasons over
  the chronological (reversed) order.
- **N (fractal wing)** — the number of closed candles required on *each side* of a
  candidate candle for it to qualify as a swing extreme. The current engine uses
  **N = 2** (`DEFAULT_FRACTAL_WING` in `swingDetection.ts`), i.e. a 5-candle window
  (2 + center + 2).
- **Timeframe** — one of `M15`, `H1`, `H4`, `D1` (`daily` internally). A definition
  is timeframe-relative unless stated otherwise: "confirmed" on H1 says nothing
  about H4.

---

## 1. Confirmed Swing High

### Definition
A candle whose `high` is strictly greater than the `high` of every one of the N
closed candles immediately before it and the N closed candles immediately after it.

### Trading meaning
Marks a point where upward price discovery stalled and reversed — the reference
extreme a higher timeframe or a later candle must clear to be considered a fresh
high, and the anchor for buy-side liquidity above it.

### Deterministic detection rule
For a chronological array of closed candles `c[0..n-1]` and wing size `N`:

```
isSwingHigh(i) :=
  N <= i <= n-1-N
  AND c[i].high == max(c[i-N..i+N].high)
  AND count(c[i-N..i+N].high == c[i].high) == 1   // strict uniqueness
```

Current engine: **N = 2** (`swingDetection.ts::detectSwings`, `DEFAULT_FRACTAL_WING`).

### Confirmation requirement
A swing high only exists once N closed candles have formed *after* it — it cannot
be known "live" on the candle itself; it is confirmed N candles later. The
currently-forming candle (index 0) can never be the center of a swing and can
never itself confirm one early.

### Invalidation rule
A confirmed swing high is never retroactively un-confirmed by later price action —
the *pivot itself* is a historical fact. What changes over time is its
**liquidity relevance** (see Buy-Side Liquidity / Swept / Invalidated, below), not
whether it was a swing high.

### Timeframe handling
Computed independently per timeframe on that timeframe's own closed candles. A
swing high on M15 has no bearing on whether the same price is a swing high on H1 —
they are evaluated on separate candle series with separate wing windows.

### UI wording
Never surfaced as a raw term. Feeds "Latest HH" (Market Structure) and the
liquidity levels below. Never labelled "swing" or "fractal" in trader-facing copy
— that vocabulary is reserved for the collapsed Technical Reasoning section.

### Examples
- 5 closed daily candles with highs `[101, 103, 106, 104, 102]` → the candle with
  high `106` (index 2) is a confirmed swing high (unique max of the 5-window).

### Non-examples
- Highs `[101, 103, 106, 106, 102]` → **no** swing high at either `106` candle —
  tied maxima within one window disqualify both, they do not both become swing
  highs.
- A high of `106` that is the max of its window but where the candle at index 0
  (forming) would have been needed to complete the window — not evaluated at all
  until N more closed candles exist.

### Known limitations
- N = 2 is fixed across every timeframe today. A 2-candle wing on M15 rejects far
  less noise (in candle-count terms) than the same wing on D1, even though the
  code comment already flags this ("callers on shorter timeframes may need a
  different wing size... pass it explicitly") — no caller currently does.
- No minimum-history floor beyond `MIN_CANDLES_FOR_LIQUIDITY = 5` in the Liquidity
  Engine, which is only just enough to resolve *one* possible window — not a
  statistically meaningful sample (contrast `marketRegime.ts`'s
  `MIN_COMPLETED_CANDLES = 10`).

---

## 2. Confirmed Swing Low

### Definition
Symmetric to Swing High: a candle whose `low` is strictly less than the `low` of
every one of the N closed candles on both sides.

### Trading meaning
Marks a point where downward price discovery stalled and reversed — the anchor for
sell-side liquidity below it.

### Deterministic detection rule
```
isSwingLow(i) :=
  N <= i <= n-1-N
  AND c[i].low == min(c[i-N..i+N].low)
  AND count(c[i-N..i+N].low == c[i].low) == 1
```
Same N = 2, same window, computed in the same pass as Swing High
(`swingDetection.ts::detectSwings` returns both types together).

### Confirmation requirement
Identical to Swing High — confirmed only once N closed candles exist after it.

### Invalidation rule
Same as Swing High: the pivot is a permanent historical fact; only its liquidity
relevance changes.

### Timeframe handling
Same as Swing High — per-timeframe, independent series.

### UI wording
Feeds "Latest HL"/"Latest LL" and sell-side liquidity levels. Never shown as a raw
term.

### Examples
- Lows `[102, 100, 96, 99, 101]` → the candle with low `96` (index 2) is a
  confirmed swing low.

### Non-examples
- Lows `[102, 96, 96, 99, 101]` → no swing low at either `96` (tie).

### Known limitations
Same as Swing High (shared implementation).

---

## 3. Buy-Side Liquidity

### Definition
Resting buy-stop liquidity above a confirmed structural high — the price shelf
where buy orders (short-position stop losses, and breakout buy-stop entries) are
expected to trigger if price trades up into it.

### Trading meaning
**Buy-side liquidity does not mean "buyers are positioned there."** It means the
opposite in one sense and the same in another: it is a magnet for price because
resting **buy orders** (shorts covering, breakout buyers) sit there, not because
institutions are bullish on that exact print.

Typical sources (in priority order of structural weight, not implementation
order): equal highs, confirmed swing high, previous day/week high, external range
high.

### Deterministic detection rule
A price level qualifies as buy-side liquidity iff:
1. `price > currentPrice` (above the market);
2. it is a confirmed swing high (or one of the other typed origins in Part 3 —
   equal highs, PDH, PWH, range high);
3. no confirmed candle **close** has occurred beyond it since it formed (see
   Untouched / Swept / Invalidated below) — unless it is explicitly being reported
   *as* a swept level, not as live resting liquidity.

Current engine: selects the single **nearest** (by price) confirmed swing high
above `currentPrice` among swing highs where no later candle has **closed** above
it (`liquidityEngine.ts::nearestAbove` over `unbrokenHighs`).

### Confirmation requirement
Requires an already-confirmed swing high (see §1) as its origin — buy-side
liquidity is never derived from an unconfirmed / still-forming extreme.

### Invalidation rule
A level stops being valid buy-side liquidity the moment a confirmed candle
**closes** above it — at that point it is Consumed/Invalidated liquidity (§9), not
buy-side liquidity anymore, and must not be reported as a live buy-side level. A
wick that pierces it and closes back below is a **sweep** (§8), and the level's
buy-side status is contextual at that point (see §8's invalidation-vs-sweep split).

### Timeframe handling
Independent per timeframe. "Buy-side liquidity" on H4 is a different number from
"buy-side liquidity" on D1 unless the same swing happens to be confirmed on both.
Today's engine is only ever invoked once, on Daily, for the Liquidity Map section
(see Appendix A).

### UI wording
"Buy-Side Liquidity." Also surfaced under "Liquidity Resting Above" — same
number, different label, because the spec lists both as separate bullets. Never
"resistance," never "supply" (that's a different, not-yet-covered concept).

### Examples
- Confirmed swing high at `2035.40`, current price `2020.00`, no later close above
  `2035.40` → buy-side liquidity = `2035.40`.

### Non-examples
- A confirmed swing high at `2035.40` where a later candle closed at `2038.00`
  (decisively above it) → this is **not** buy-side liquidity anymore; it is
  Invalidated/Consumed liquidity.
- The nearest swing high **below** current price — that is never buy-side
  liquidity regardless of how "structurally significant" it looks; buy-side
  liquidity is always above price by definition.

### Known limitations
- Only sources from confirmed swing highs today. Previous Day High / Previous
  Week High / "external range high" (all named in your source list) are **not**
  wired into this engine at all yet — they exist elsewhere (Institutional Levels
  Engine) but are never merged into buy-side liquidity candidacy. This is the
  single largest gap between this Book and the current code.
- "Nearest" selection means only **one** buy-side level is ever surfaced. A trader
  may reasonably want to see the next 2–3 shelves, not just the closest — today's
  `LiquidityLevel` shape has no room for multiple ranked candidates (Part 3
  proposes this).

---

## 4. Sell-Side Liquidity

### Definition
Resting sell-stop liquidity below a confirmed structural low — the mirror of §3.

### Trading meaning
Magnet for price via resting **sell orders** (longs' stop losses, breakout
sell-stop entries) — not a claim that "sellers are positioned there."

### Deterministic detection rule
Symmetric to §3: `price < currentPrice`, confirmed swing low origin, no confirmed
close below it since formation. Current engine: nearest (by price) unbroken swing
low below `currentPrice` (`liquidityEngine.ts::nearestBelow`).

### Confirmation requirement
Requires a confirmed swing low as origin.

### Invalidation rule
A confirmed close below it converts it to Consumed/Invalidated liquidity, not
sell-side liquidity.

### Timeframe handling
Same as §3.

### UI wording
"Sell-Side Liquidity" / "Liquidity Resting Below" — same number, two labels.

### Examples
- Confirmed swing low at `1998.10`, current price `2020.00`, never closed below →
  sell-side liquidity = `1998.10`.

### Non-examples
- Symmetric to §3's non-examples.

### Known limitations
Same gaps as §3 (no PDL/PWL/range-low sourcing yet; single nearest pick only).

---

## 5. Equal Highs

### Definition
Two or more **confirmed** swing highs whose prices sit within an
instrument-and-timeframe-aware tolerance of each other, on the same timeframe.

### Trading meaning
A stronger, more probable buy-side liquidity candidate than a single isolated
swing high — repeated failure to clear the same shelf builds a thicker resting
order pool at (approximately) one price, not one.

### Deterministic detection rule — current implementation
1. Take the last `EQUAL_LEVEL_LOOKBACK_SWINGS = 6` **unbroken** confirmed swing
   highs on the timeframe.
2. Compute `tolerance = 0.25 × median(range of the last 20 closed candles)`
   (`EQUAL_LEVEL_TOLERANCE_RATIO = 0.25`, `MEDIAN_RANGE_WINDOW = 20`) — this is
   **not** a blind universal percentage of price; it self-scales to the
   instrument's and timeframe's own recent absolute range, which already handles
   most of the "instrument precision + timeframe" requirement (a JPY pair's larger
   absolute pip range and a D1 candle's larger range than an M15 candle are both
   automatically reflected).
3. Sort the 6 swings by price, chain consecutive members whose price gap is
   `<= tolerance` into a group, keep the **largest** group (ties broken toward the
   lower-priced group), require `count >= 2`.
4. Report the group's **average price** as the level, tagged with `count` and the
   member prices.

### Current tolerance (as requested)
`0.25 × median(last 20 closed candle ranges)`, evaluated fresh per call, per
instrument, per timeframe.

### Proposed improved tolerance
The self-scaling ratio is a sound foundation and should be kept, but two gaps
should be closed:

1. **Chain-transitivity gap.** Step 3 above only bounds *consecutive pairwise*
   gaps by `tolerance` — the first and last member of a 3+ swing cluster can be
   farther apart than `tolerance` itself (observed live on XAUUSD: a 3-swing
   cluster spanning 21.05 while individual pairwise gaps were 6.70 and 14.35).
   **Proposal:** require `max(group) - min(group) <= tolerance` directly (a true
   bounding-box check), not just pairwise chaining. This is a stricter, more
   defensible "equal" and is still O(n) to compute over 6 candidates.
2. **No floor for near-zero volatility.** If the last 20 candles are unusually
   flat (thin holiday session, etc.), `tolerance` can shrink to a value smaller
   than the instrument's realistic tick size, making "equal" require near-exact
   float matches. **Proposal:** floor `tolerance` at a small, explicit
   per-instrument minimum (reuse the same per-instrument step-size table pattern
   `institutionalLevelsEngine.ts` already established for psychological/half/round
   levels — e.g. XAUUSD floor 0.5, EURUSD floor 0.0003, US30 floor 5 — rather than
   inventing a second table, extend that one).

Both changes are additive and deterministic; neither requires a new data source.

### Confirmation requirement
Every member of the cluster must independently satisfy Swing High confirmation
(§1) first — equal highs is a clustering **on top of** confirmed swings, never a
substitute for confirmation.

### Invalidation rule
The cluster is invalidated member-by-member: if any one member's price is
subsequently closed through, that member drops out of "unbroken" and — per current
code — silently leaves the cluster on the next computation (recomputed fresh each
call, not maintained as persistent state). If removing it drops the group below 2
members, "Equal Highs" reports null that call, with no memory that a cluster once
existed there.

### Timeframe handling
Computed per-timeframe, using only that timeframe's own confirmed swings. Equal
highs on H1 are never merged with equal highs on H4.

### UI wording
"Equal Highs (N)" — N = member count. Never "double top" (a directional/pattern
claim this engine does not make).

### Examples
- Confirmed swing highs at `4195.33`, `4202.03`, `4216.38` (tolerance ≈ 15–21 on
  XAUUSD's recent range) → Equal Highs, count 3, price ≈ `4204.58` (current
  average-based reporting).

### Non-examples
- Two confirmed swing highs 60 points apart on a day where the tolerance computes
  to 15 → not equal highs, reported as two independent swing highs instead (one of
  which may still be buy-side liquidity on its own).
- A single confirmed swing high, however "round" the number looks — Equal Highs
  requires `count >= 2` by definition; one level is never "equal" to itself.

### Known limitations
- Chain-transitivity gap and volatility-floor gap, both above.
- No persistence/state across calls — a cluster's "count" can only ever describe
  *this instant*, never "this has been tested N times over M days," which is
  closer to what "equal highs" implies to a trader.
- Only draws from the last 6 unbroken swings — a genuinely older, still-unbroken
  equal-highs pool beyond that lookback is invisible to this rule.

---

## 6. Equal Lows

### Definition, trading meaning, rule, tolerance, confirmation, invalidation, timeframe, UI wording
Symmetric to §5 in every respect — same tolerance formula and same proposed
improvements, mirrored on swing lows.

### Examples
- Confirmed swing lows at `3949.45`, `3961.49` (XAUUSD live) → Equal Lows, count
  2, price ≈ `3955.47`.

### Non-examples
Symmetric to §5.

### Known limitations
Same as §5 (shared implementation, `clusterEqualLevels` is one function used for
both sides).

---

## 7. Untouched Liquidity

### Definition
A liquidity level (buy-side or sell-side, from any origin) that has not been
traded into by any candle since it formed — no wick has entered its price, let
alone closed through it.

### Explicit state definitions (as required)
| Event since formation | State |
|---|---|
| No candle's high/low has reached the level at all | **Untouched** |
| A wick reached the level, closed back on the origin side, structure still intact | **Tested** (a soft touch — see note) |
| A wick traded *beyond* the level and closed back on the origin side | **Swept** (§8) — still relevant, now flagged as having been raided once |
| A confirmed candle **closed** beyond the level | **Consumed / Invalidated** (§9) — no longer live resting liquidity |

Note: "wick through the level counts as touched" — yes. A pure touch that reaches
the exact level but does not trade *through* it and does not close beyond it is
the boundary case between Untouched and Tested; this Book treats **any** wick
contact (even without piercing past the level) as ending "Untouched" and starting
"Tested," reserving "Swept" specifically for the pierce-and-close-back pattern
(§8), and "Consumed" for a decisive close-through (§9).

### Deterministic detection rule
```
untouched(level) := for every closed candle c with index > level.formedIndex:
  side == "high" ? c.high < level.price : c.low > level.price
```
i.e. no candle's wick has even reached the level yet.

### Confirmation requirement
Requires the level itself to already be a confirmed origin (swing/equal-highs/
etc.) — untouched-ness is evaluated only from the confirmation index forward.

### Invalidation rule
N/A directly — "Untouched" is a state, not something that gets invalidated on its
own; it transitions to Tested, Swept, or Consumed based on the table above.

### Timeframe handling
Per-timeframe: a level untouched on D1 says nothing about whether the same price
has been wicked into intraday on H1.

### UI wording
Not currently a distinct UI label — folded implicitly into "still resting" (a
level is shown as buy/sell-side liquidity at all only while at least Untouched or
Tested). Part 3 proposes making this explicit via `LiquidityState`.

### Examples
- Swing high confirmed at `2035.40`; every candle since has stayed below `2035.00`
  → Untouched.

### Non-examples
- A candle's high reached exactly `2035.40` and closed lower → no longer
  Untouched (Tested at minimum).

### Known limitations
- The current engine has **no explicit state machine at all** for
  Untouched/Tested — a level is simply present (still "unbroken") or absent (fully
  dropped once broken). "Tested-but-not-swept-not-broken" is not distinguished
  from "never touched" today. This is the single largest structural gap this
  chapter identifies, and Part 3's model exists specifically to close it.

---

## 8. Swept Liquidity

### Definition
A liquidity sweep occurs when price trades **beyond** a confirmed level (wick) but
the same candle **closes back inside** the prior structure, within a deterministic
confirmation window — i.e. the raid failed to hold.

### Trading meaning
The resting orders at the level were very likely triggered (stops run, breakout
entries filled) but the move did not sustain — commonly read as a liquidity grab
rather than a genuine structural break.

### Deterministic detection rule — current implementation
Scans the last `SWEEP_SCAN_LOOKBACK_CANDLES = 20` closed candles, most-recent
first. For a candidate candle `c` at index `j` and a confirmed swing `s` with
`s.index < j`:
```
sweptHigh(s, c) := c.high > s.price AND c.close < s.price
sweptLow(s, c)  := c.low  < s.price AND c.close > s.price
```
Returns the **first** (i.e. most recent in time) candle/level pair matching either
rule; if one candle sweeps multiple swings simultaneously, the nearest-in-price
swing is chosen.

### Required return fields (per your spec) — mapped to current output
| Requested field | Current field | Present? |
|---|---|---|
| Swept level | `sweptPrice` | Yes |
| Sweep timestamp | `sweptDatetime` (level's own formation time) | Partial — this is the *level's* timestamp, not the sweep event's |
| Direction | `side` (`"high"`/`"low"`) | Yes, but named ambiguously (see limitations) |
| Confirmation candle | `sweepCandleDatetime` | Yes |
| Active vs. historical | — | **Missing entirely** |

### Confirmation requirement
The sweep candle itself is both the trigger and the confirmation — no additional
candle is required beyond the sweeping candle's own close. (This is a one-candle
confirmation window; see limitations for whether that's sufficient.)

### Invalidation rule
**A confirmed close decisively beyond the level must not be labelled merely a
sweep — it is Consumed/Invalidated liquidity (§9).** The dividing line is the
sweep candle's own close: if it closes back on the origin side, it's a sweep; if
it closes beyond, it was never a sweep at all, it was a break. This rule is
already correctly implemented at the single-candle level (`c.close < s.price` /
`c.close > s.price` for the *same* candle) — the gap is what happens on
**subsequent** candles (see limitations).

### Timeframe handling
Per-timeframe, using that timeframe's own confirmed swings and its own 20-candle
lookback window.

### UI wording
"Nearest Liquidity Sweep." Should read as a historical event note, never as a
live resting level.

### Examples
- Confirmed swing low at `4122.52`; a later candle's low reaches `4118.00` but
  closes at `4130.00` (back above) → Swept, side `low`, swept price `4122.52`.

### Non-examples
- Same swing low at `4122.52`; a later candle closes at `4115.00` (below it) → not
  a sweep, this is Consumed/Invalidated (§9).
- A wick that merely touches `4122.52` without going below it → Tested (§7), not
  Swept — no piercing occurred.

### Known limitations
- **This is the most important gap in the current engine relative to this Book.**
  `findNearestSweep` is called with the *full* swing list, not the unbroken one,
  and never checks whether the swept level was **later** (after the sweep candle)
  also fully broken by a subsequent close. Observed live on XAUUSD: a sweep was
  reported at `4122.52` (confirmed 2026-07-09) while current price (`4079.30`) is
  now well below that level in the *same* direction the sweep supposedly failed —
  i.e. price ultimately did break through after all, later, and the engine still
  reports it as "swept" rather than "consumed." **This must be fixed before Sprint
  2 ships**: a level's final state should be Consumed/Invalidated if *any* later
  candle closed decisively beyond it, regardless of what an earlier candle did.
- "Active vs. historical" is not tracked — every sweep found in the 20-candle
  window is reported identically regardless of how long ago it happened or how
  far price has since travelled from it.
- `sweptDatetime` is misleadingly named — it is the **level's formation
  timestamp**, not "when the sweep happened" (that's `sweepCandleDatetime`).
  Rename recommended in Part 3.
- One-candle confirmation window (no requirement that the *next* candle also
  confirms rejection) may be too permissive — worth testing against real data in
  Sprint 2 before tightening.

---

## 9. Invalidated Liquidity (and its relationship to "Consumed")

### Definition
A liquidity level whose resting orders have been **decisively removed from play**
by a confirmed candle **close** beyond it — as opposed to a temporary wick
(Swept, §8) or no contact at all (Untouched/Tested, §7).

This Book distinguishes two flavors, matching the `LiquidityState` enum in Part 3:

- **Consumed** — the mechanical fact: a confirmed candle closed beyond the level.
  The resting orders were filled/absorbed. This is symmetric to what
  `supplyDemandEngine.ts` already calls "broken" for zones — same idea, applied to
  a single price level instead of a zone.
- **Invalidated** — a broader condition: the level is no longer a *relevant*
  liquidity reference even though price may not have traded through it at all —
  e.g. a fresh, more extreme confirmed swing on the same side has formed, making
  the older one structurally superseded, or the active range (§11) has moved on
  without ever revisiting it.

Every Consumed level is also Invalidated (it's definitely no longer relevant).
Not every Invalidated level is Consumed (it may simply have been superseded,
never traded).

### Trading meaning
Tells a trader "stop watching this level" — either because the orders resting
there already executed (Consumed) or because a newer, more relevant level has
taken its place (Invalidated-but-not-Consumed).

### Deterministic detection rule
```
consumed(level) := exists closed candle c, index(c) > level.formedIndex,
                    where side == "high" ? c.close > level.price
                                          : c.close < level.price

invalidated(level) := consumed(level)
                      OR exists a later confirmed swing s' on the same side
                         that is now the nearer/qualifying candidate
                         (i.e. level is no longer selected as buy-side/
                          sell-side/equal-highs/internal/external by the
                          current computation)
```

### Confirmation requirement
`consumed` requires exactly one confirmed candle close beyond the level — no
additional confirmation candle needed (a close is already a fully-formed,
confirmed fact). `invalidated`-by-supersession requires the superseding swing to
itself be confirmed (§1/§2).

### Invalidation rule
N/A (this concept *is* the invalidation rule for every other liquidity type).

### Timeframe handling
Per-timeframe — a level consumed on H1 may still be untouched on H4 if H4 has not
yet formed a candle whose close reflects that move.

### UI wording
Not yet exposed. When implemented, should read as a plain fact ("Consumed on
2026-07-09") rather than a warning — Edge Pulse never editorializes.

### Examples
- Confirmed swing high at `2035.40`; a later candle closes at `2038.00` →
  Consumed (and therefore also Invalidated).
- Confirmed swing high at `2035.40`, never traded into, but a fresh confirmed
  swing high forms at `2041.00` and becomes the new nearest buy-side candidate →
  the `2035.40` level is Invalidated (superseded) but **not** Consumed — it was
  never traded through, just outranked.

### Non-examples
- A wick that pierces the level and closes back on the origin side → that's
  Swept (§8), not Consumed/Invalidated, regardless of how far the wick travelled.

### Known limitations
- **Not implemented at all today.** The current engine has a binary
  unbroken/broken concept baked into `isUnbroken()`, which is equivalent to
  "not Consumed" — but a Consumed level is never surfaced anywhere (it's just
  silently dropped from every list), and "Invalidated-by-supersession" doesn't
  exist as a concept in the code at all. Part 3's model is written specifically to
  make both states first-class, reportable facts instead of silent omissions.

---

## 10. Internal Liquidity

### Definition
Liquidity resting **inside** the currently active structural range (§11 defines
"active range") — confirmed swings that formed within the range's boundaries,
after the range itself became established.

### Trading meaning
Minor, lower-magnitude resting liquidity a trader might expect to be swept during
normal rotation inside the range, before price ever challenges the range's true
boundaries (external liquidity).

### Deterministic detection rule — current implementation
Given the active range `[sellSideLevel.price, buySideLevel.price]`:
```
internal := { s : s is an unbroken confirmed swing (high or low)
              AND s != sellSideSwing AND s != buySideSwing
              AND s.index > max(sellSideSwing.index, buySideSwing.index)
              AND sellSideSwing.price < s.price < buySideSwing.price }
```
Sourced strictly from confirmed swings — never from arbitrary candle highs/lows,
matching your requirement exactly.

### Confirmation requirement
Every member must independently be a confirmed swing (§1/§2) — the same bar as
any other liquidity level.

### Invalidation rule
Same as any liquidity level (§9): a member becomes Consumed/Invalidated the moment
a later confirmed close passes beyond it, or the moment the active range itself is
redefined such that the member falls outside it.

### Timeframe handling
Per-timeframe, computed from that timeframe's own active range and its own
confirmed swings only.

### UI wording
"Internal Liquidity" — plural list, not a single level.

### Examples
- Active range `[3961.49, 4195.33]` (XAUUSD); a confirmed swing forms at `4080.00`
  after the range was established → internal liquidity.

### Non-examples
- A confirmed swing at `4080.00` that formed *before* both range boundaries
  existed → excluded (the range wasn't established yet when it formed).
- Any unconfirmed candle extreme, however visually "inside" the range it looks —
  internal liquidity only ever draws from confirmed swings.

### Known limitations
- Reported as a flat, unranked list — no ordering by proximity to price or by how
  many times a member has been tested.
- Range-establishment timing (`max` of the two boundary indices) is a defensible
  but not the only possible rule — see §11 for the fuller discussion of "active
  range" definition.

---

## 11. External Liquidity

### Definition
Liquidity resting **outside** — specifically, defining the boundary of — the
active structural range: the range high and range low themselves.

### The active range, explicitly defined
The active range is `[sellSideLiquidity.price, buySideLiquidity.price]` — the
nearest unbroken confirmed swing low below current price, and the nearest
unbroken confirmed swing high above current price, on the timeframe being
evaluated. This is **the same pair** already computed for Buy-Side/Sell-Side
Liquidity (§3/§4) — external liquidity is not a separately-selected concept in the
current engine, it is that same pair re-packaged as a list.

Per your source list, a more complete "external liquidity" would also consider
the **most relevant external swing high/low** beyond the immediate range boundary
(i.e. the *next* shelf out, not just the nearest one) — that is not implemented
today (see limitations).

### Trading meaning
The two levels a trader watches to know whether the current range has been
genuinely broken (a confirmed close beyond either one) versus merely rotated
within.

### Deterministic detection rule
```
externalLiquidity := [ buySideLiquidity, sellSideLiquidity ].filter(exists)
```
Exactly two entries when both sides resolve, one entry if only one side has an
unbroken swing, zero if neither does.

### Confirmation requirement
Inherits §3/§4's requirement — both are confirmed swings.

### Invalidation rule
Inherits §3/§4 — a confirmed close beyond either boundary converts that boundary
to Consumed/Invalidated, and (mechanically, next computation) a new, more distant
boundary takes its place.

### Timeframe handling
Per-timeframe, same pair used for Buy/Sell-Side Liquidity on that timeframe.

### UI wording
"External Liquidity" — plural list (currently always 0–2 entries).

### Examples
- XAUUSD live: external liquidity = `[4195.33, 3961.49]` — the same two prices
  reported as Buy-Side and Sell-Side Liquidity.

### Non-examples
- A swing beyond the immediate range boundary (the "next shelf out") — not
  included today; only the immediate boundary pair qualifies.

### Known limitations
- Purely derivative of §3/§4 today — adds no new information beyond re-labelling.
  Your source definition explicitly wants "the most relevant external swing
  high/low" beyond the immediate boundary as an option; that would require
  keeping a ranked list of unbroken swings per side (Part 3's model supports this
  — see `strength`/multiple candidates note) rather than only the nearest.

---

## Appendix A — Current engine vs. this Book (gap summary)

| Concept | Current status | Primary gap |
|---|---|---|
| Confirmed Swing High/Low | Implemented, matches this Book | N is fixed at 2 for every timeframe |
| Buy/Sell-Side Liquidity | Implemented (nearest-only) | No PDH/PWH/range-high sourcing; single candidate only |
| Equal Highs/Lows | Implemented | Chain-transitivity gap; no volatility floor; no persistence |
| Untouched / Tested | **Not modeled as a state** | Binary unbroken/broken only |
| Swept | Implemented, but **conflated with Consumed** | Doesn't check later closes past the sweep candle — **highest priority fix** |
| Invalidated / Consumed | **Not modeled at all** | Broken swings are silently dropped, never reported |
| Internal Liquidity | Implemented, matches this Book | Unranked list |
| External Liquidity | Implemented, but purely derivative | No "next shelf out" beyond immediate boundary |

## Appendix B — Proposed typed model (Sprint 1, Part 3)

```ts
export type LiquiditySide = "buy_side" | "sell_side";

export type LiquidityState =
  | "untouched"   // never wicked into since formation
  | "tested"      // wicked into but not pierced beyond, closed back on origin side
  | "swept"       // pierced beyond, closed back on origin side (this candle)
  | "consumed"    // a confirmed close occurred beyond the level (mechanical fact)
  | "invalidated"; // consumed, OR superseded by a newer qualifying candidate — no
                    // longer relevant even if never traded through

export type LiquidityOrigin =
  | "swing_high"
  | "swing_low"
  | "equal_highs"
  | "equal_lows"
  | "previous_day_high"
  | "previous_day_low"
  | "previous_week_high"
  | "previous_week_low"
  | "range_high"
  | "range_low";

export interface LiquidityLevel {
  symbol: string;
  timeframe: "M15" | "H1" | "H4" | "D1";
  side: LiquiditySide;
  origin: LiquidityOrigin;
  price: number;
  formedAt: string;       // ISO timestamp of the origin candle
  state: LiquidityState;
  touches: number;        // count of Tested/Swept events since formation, before Consumed
  distance: number;       // currentPrice - price, signed (existing convention)
  distancePercent: number;
  strength: "low" | "medium" | "high"; // derived, e.g. equal-highs count / origin type
  evidence: string[];     // human-readable trace, same discipline as MarketPulse.evidence
}
```

Notes carried over from the audit, to resolve before implementing against this
model:
- `consumed` and `invalidated` must be computed by scanning **every** candle after
  formation, not stopping at the first sweep found — this directly fixes the
  XAUUSD gap in §8.
- `touches` requires tracking state transitions across the full post-formation
  history in one pass, not just the latest qualifying event (a change from today's
  "most recent match wins" scan).
- `strength` should be a deterministic function of `origin` + `touches` (e.g.
  `equal_highs` with count >= 3 → high; a lone `swing_high` with 0 touches →
  low/medium) — exact thresholds to be defined in Sprint 2 once real distributions
  across EURUSD/XAUUSD/US30 are sampled.
- This model naturally supports multiple ranked candidates per side (an array of
  `LiquidityLevel` sorted by distance), closing the "single nearest only" gap
  noted in §3/§4/§11 — a decision for Sprint 2 on how many to surface.

This model is a **proposal only** — nothing in the codebase has been changed to
match it yet, per this sprint's scope.
