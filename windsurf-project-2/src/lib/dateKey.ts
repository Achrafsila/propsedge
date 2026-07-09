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
