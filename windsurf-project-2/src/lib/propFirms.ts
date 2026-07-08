// Prop firm names are free text (see the Admin "Add Challenge Type" form),
// so the same firm can end up stored under slightly different strings
// (extra whitespace, different casing) across separate challenge-type
// entries. There is no stable firm id in the data model, so dropdown
// dedup falls back to a normalized name as the grouping key.
export function normalizeFirmName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface PropFirmOption {
  key: string; // normalized name — stable identity for the option
  label: string; // original casing/spacing of the first entry seen
}

export function getUniquePropFirmOptions(
  itemsOrNames: { propFirmName: string }[] | string[]
): PropFirmOption[] {
  const seen = new Map<string, PropFirmOption>();
  for (const item of itemsOrNames) {
    const name = typeof item === "string" ? item : item.propFirmName;
    if (!name) continue;
    const key = normalizeFirmName(name);
    if (!seen.has(key)) {
      seen.set(key, { key, label: name });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
}
