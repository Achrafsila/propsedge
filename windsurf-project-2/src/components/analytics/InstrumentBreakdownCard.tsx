"use client";

import { motion } from "framer-motion";
import { LineChart as LineChartIcon } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderIdentity } from "@/lib/analytics/traderIdentity";
import { RadialGauge } from "@/components/analytics/visualizations/RadialGauge";
import { CountUpNumber } from "@/components/analytics/visualizations/CountUpNumber";

const INSTRUMENT_COLOR = "#D4AF37";
const RING_COLORS = [INSTRUMENT_COLOR, "#298DFF"];

// One ring per top instrument from identity.topInstruments (exactly 2 today,
// per traderIdentity.ts's TOP_INSTRUMENT_COUNT — not decided here). Trade
// count per symbol comes from TraderDNAStats.tradesByInstrument, already
// computed on the page for the Global Overview KPI subtitles and passed down
// as a prop, not recomputed.
export function InstrumentBreakdownCard({
  identity,
  tradesByInstrument,
}: {
  identity: TraderIdentity;
  tradesByInstrument: Record<string, number>;
}) {
  const instruments = identity.topInstruments;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="rounded-xl p-6"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: "1px solid rgba(148,163,184,0.08)",
        borderRadius: borderRadius.xl,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${INSTRUMENT_COLOR}1A` }}
        >
          <LineChartIcon className="w-5 h-5" style={{ color: INSTRUMENT_COLOR }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Instrument Breakdown
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        {identity.marketSpecialization}
      </p>

      {instruments.length === 0 ? (
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          Not enough trade history yet to break down instruments.
        </p>
      ) : (
        <div className="flex flex-wrap justify-around gap-6">
          {instruments.map((instrument, i) => (
            <RadialGauge
              key={instrument.symbol}
              percent={instrument.percentage}
              color={RING_COLORS[i % RING_COLORS.length]}
              size={104}
              centerValue={<CountUpNumber value={instrument.percentage} format={(v) => `${Math.round(v)}%`} />}
              caption={`${instrument.symbol} · ${tradesByInstrument[instrument.symbol] ?? 0} trades`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
