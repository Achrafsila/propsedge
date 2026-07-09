"use client";

import { Newspaper } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { MarketBrief, MarketInstrumentBrief } from "@/lib/analytics/morningBriefing";

const SENTIMENT_COLOR: Record<NonNullable<MarketInstrumentBrief["sentiment"]>, string> = {
  bullish: "#10B981",
  bearish: "#EF4444",
  neutral: "#94A3B8",
};

function InstrumentCard({ brief }: { brief: MarketInstrumentBrief }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: "1px solid rgba(148,163,184,0.08)",
        borderRadius: borderRadius.xl,
      }}
    >
      <p className="text-[#F8FAFC] font-bold mb-3" style={{ fontSize: typography.fontSize.base }}>
        {brief.symbol}
      </p>
      <div className="space-y-2">
        <div>
          <p className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            High Impact News
          </p>
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
            {brief.highImpactNews ?? "Data unavailable"}
          </p>
        </div>
        <div>
          <p className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Market Sentiment
          </p>
          <p
            className="font-semibold"
            style={{ fontSize: typography.fontSize.xs, color: brief.sentiment ? SENTIMENT_COLOR[brief.sentiment] : "#64748B" }}
          >
            {brief.sentiment ? brief.sentiment[0].toUpperCase() + brief.sentiment.slice(1) : "Data unavailable"}
          </p>
        </div>
        <div>
          <p className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Opening Price
          </p>
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
            {brief.openingPrice ?? "Data unavailable"}
          </p>
        </div>
        <div>
          <p className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Key Levels
          </p>
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
            {brief.keyLevels ?? "Data unavailable"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MarketBriefStep({ marketBrief }: { marketBrief: MarketBrief }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Newspaper className="w-5 h-5 text-[#298DFF]" />
        <h2 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize["2xl"] }}>
          Market Brief
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InstrumentCard brief={marketBrief.gold} />
        <InstrumentCard brief={marketBrief.ndx} />
        <InstrumentCard brief={marketBrief.us30} />
        <InstrumentCard brief={marketBrief.eurusd} />
      </div>
    </div>
  );
}
