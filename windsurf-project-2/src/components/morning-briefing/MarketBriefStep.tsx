"use client";

import { Newspaper, CalendarClock, TrendingUp, Info } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import {
  MarketIntelligence,
  MarketNewsItem,
  EconomicEvent,
  InstrumentMarketData,
  ImpactLevel,
  INSTRUMENT_KEYS,
} from "@/lib/market/types";

// ============================================================
// PropEdge — Market Brief step (Finnhub + TwelveData, V1)
// ============================================================
// Renders only the sections that actually have data. No "Data unavailable"
// spam: an instrument with no price data is collapsed, and a single global
// partial-data notice explains what the current provider tier doesn't
// cover. Every value is real provider data or a null that hides its row.

const IMPACT_COLOR: Record<Exclude<ImpactLevel, "unknown">, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#298DFF",
};

const MAX_GLOBAL_NEWS = 3;

function timeAgo(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function eventTime(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  } catch {
    return "";
  }
}

function fmtPrice(n: number): string {
  const decimals = Math.abs(n) >= 100 ? 2 : 5;
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const CARD_STYLE = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: borderRadius.xl,
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
      {children}
    </p>
  );
}

function EventsSection({ events, tz }: { events: EconomicEvent[]; tz: string }) {
  if (events.length === 0) return null;
  return (
    <div className="rounded-xl p-4" style={CARD_STYLE}>
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="w-4 h-4 text-[#298DFF]" />
        <p className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.sm }}>Today&apos;s Events</p>
      </div>
      <div className="space-y-2">
        {events.slice(0, 6).map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[#94A3B8] tabular-nums flex-shrink-0" style={{ fontSize: typography.fontSize.xs }}>
                {eventTime(e.scheduledAt, tz) || "—"}
              </span>
              <span className="text-[#CBD5E1] truncate" style={{ fontSize: typography.fontSize.xs }}>{e.title}</span>
            </div>
            {e.impact !== "unknown" && (
              <span
                className="px-2 py-0.5 rounded-full font-semibold flex-shrink-0 uppercase"
                style={{ fontSize: "0.5625rem", background: `${IMPACT_COLOR[e.impact]}1A`, color: IMPACT_COLOR[e.impact], border: `1px solid ${IMPACT_COLOR[e.impact]}40` }}
              >
                {e.impact}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsSection({ news }: { news: MarketNewsItem[] }) {
  const top = news.slice(0, MAX_GLOBAL_NEWS);
  if (top.length === 0) return null;
  return (
    <div className="rounded-xl p-4" style={CARD_STYLE}>
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="w-4 h-4 text-[#298DFF]" />
        <p className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.sm }}>Relevant News</p>
      </div>
      <div className="space-y-3">
        {top.map((n) => {
          const ago = timeAgo(n.publishedAt);
          return (
            <a key={n.id} href={n.url || undefined} target="_blank" rel="noopener noreferrer" className="block group">
              <p className="text-[#CBD5E1] group-hover:text-[#F8FAFC] transition-colors" style={{ fontSize: typography.fontSize.xs, lineHeight: typography.lineHeight.normal }}>
                {n.headline}
              </p>
              <p className="text-[#64748B] mt-0.5" style={{ fontSize: "0.625rem" }}>
                {n.sourceName}{ago ? ` · ${ago}` : ""}
              </p>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function LevelRow({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>{label}</span>
      <span className="text-[#CBD5E1] tabular-nums" style={{ fontSize: typography.fontSize.xs }}>{fmtPrice(value)}</span>
    </div>
  );
}

function InstrumentCard({ data, ago }: { data: InstrumentMarketData; ago: string | null }) {
  const kl = data.keyLevels;
  const hasLevels = kl !== null && (kl.dailyOpen !== null || kl.previousDayHigh !== null || kl.previousDayLow !== null || kl.previousDayClose !== null);
  return (
    <div className="rounded-xl p-4" style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.base }}>{data.symbol}</p>
        {data.currentPrice !== null && (
          <span className="text-[#F8FAFC] font-semibold tabular-nums" style={{ fontSize: typography.fontSize.sm }}>{fmtPrice(data.currentPrice)}</span>
        )}
      </div>

      <div className="space-y-1.5 mb-3">
        <LevelRow label="Daily Open" value={data.dailyOpen} />
        <LevelRow label="Previous Close" value={data.previousClose} />
      </div>

      <Label>Key Levels</Label>
      {hasLevels ? (
        <div className="space-y-1.5 mt-1.5">
          <LevelRow label="Prev Day High" value={kl.previousDayHigh} />
          <LevelRow label="Prev Day Low" value={kl.previousDayLow} />
          <LevelRow label="Prev Day Close" value={kl.previousDayClose} />
        </div>
      ) : (
        <p className="text-[#64748B] mt-1" style={{ fontSize: typography.fontSize.xs }}>Key levels unavailable from current provider.</p>
      )}

      {ago && <p className="text-[#475569] mt-3" style={{ fontSize: "0.5625rem" }}>Updated {ago}</p>}
    </div>
  );
}

export function MarketBriefStep({ intel }: { intel: MarketIntelligence }) {
  const ago = timeAgo(intel.fetchedAt);
  const available = INSTRUMENT_KEYS.filter((k) => intel.instruments[k].status !== "unavailable");
  const anyUnavailable = INSTRUMENT_KEYS.some((k) => intel.instruments[k].status === "unavailable");
  const calendarUnavailable = intel.economicEvents.length === 0;
  const showPartial = intel.status !== "complete" && (anyUnavailable || calendarUnavailable);

  // Built from the real per-domain attribution — never a single hardcoded
  // "Finnhub is connected" line, since prices now come from TwelveData and
  // the calendar domain may have no provider at all (e.g. 403 on this tier).
  const partialText = (() => {
    const connected: string[] = [];
    if (intel.providers.news) connected.push(`${intel.providers.news} (news)`);
    if (intel.providers.prices) connected.push(`${intel.providers.prices} (prices)`);
    const connectedLine = connected.length > 0 ? `Connected to ${connected.join(" and ")}.` : "";

    const bits: string[] = [];
    if (!intel.providers.calendar) bits.push("the economic calendar isn't available on the current provider plan");
    if (anyUnavailable) bits.push("some instrument price data isn't covered by the current provider");
    const gapSentence = bits.length > 0 ? `${bits[0][0].toUpperCase()}${bits.join(", ").slice(1)}.` : "";

    return `${connectedLine} ${gapSentence}`.trim() || "Some market data isn't available right now.";
  })();

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-2">
        <TrendingUp className="w-5 h-5 text-[#298DFF]" />
        <h2 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize["2xl"] }}>Market Brief</h2>
      </div>
      <p className="text-[#64748B] text-center mb-6" style={{ fontSize: typography.fontSize.xs }}>
        {ago ? `Updated ${ago}` : "Live market context"}
      </p>

      <div className="space-y-3">
        <EventsSection events={intel.economicEvents} tz={intel.timezone} />
        <NewsSection news={intel.news} />

        {available.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {available.map((k) => (
              <InstrumentCard key={k} data={intel.instruments[k]} ago={ago} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-4 text-center" style={CARD_STYLE}>
            <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>No live instrument price data available from the current provider.</p>
          </div>
        )}

        {showPartial && (
          <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
            <p className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.xs }}>{partialText}</p>
          </div>
        )}

        <p className="text-[#475569] text-center" style={{ fontSize: "0.625rem" }}>Market context model not connected yet.</p>
      </div>
    </div>
  );
}
