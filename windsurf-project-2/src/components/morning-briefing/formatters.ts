// Same "$X,XXX" convention every other page's fmt$ already uses — kept
// local to this feature so every step component shares one copy instead of
// five near-identical ones.
export const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
