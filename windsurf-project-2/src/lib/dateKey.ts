// "YYYY-MM-DD" in local time — used anywhere a client-side feature needs to
// compare "is this the same calendar day" (e.g. the Morning Briefing's
// once-per-day gate, Today's Objective's daily reset). Deliberately not
// `Date.prototype.toDateString()`, which is locale-dependent and not safe
// to use as a stable storage/comparison key.
export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Same "YYYY-MM-DD" local-time key as todayDateString(), N days earlier —
// used for trailing-window lookups (e.g. Rules page's "recent violations"
// list) where a plain string >= comparison against contractDate/entryDate
// needs a stable cutoff key, not a Date object.
export function daysAgoDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
