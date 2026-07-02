"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { EquityPoint } from "@/lib/analytics/globalAnalytics";

const fmt$ = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EquityTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const point: EquityPoint = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs"
      style={{ background: "rgba(11,18,32,0.95)", border: "1px solid rgba(148,163,184,0.15)", backdropFilter: "blur(12px)" }}
    >
      <p className="text-[#94A3B8] mb-1">
        {point.tradeId === "start" ? "Start" : `${point.date} · Trade #${point.index}`}
      </p>
      <p className="font-semibold" style={{ color: "#298DFF" }}>
        {fmt$(point.cumulative)}
      </p>
      {point.tradeId !== "start" && (
        <p className={point.pnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}>
          {point.pnl >= 0 ? "+" : ""}
          {fmt$(point.pnl)}
        </p>
      )}
    </div>
  );
};

export function GlobalEquityCurve({ points, netPnL }: { points: EquityPoint[]; netPnL: number }) {
  const values = points.map((p) => p.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(max - min, 1);
  const padding = Math.max(range * 0.15, 10);
  const yDomain: [number, number] = [min - padding, max + padding];

  const hasTrades = points.length > 1;

  return (
    <div
      className="rounded-xl p-6 transition-all duration-300"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: "1px solid rgba(148,163,184,0.08)",
        borderRadius: borderRadius.xl,
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(41,141,255,0.1)" }}>
            <Activity className="w-5 h-5 text-[#298DFF]" />
          </div>
          <div>
            <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
              Global Equity
            </h3>
            <p className="text-[#94A3B8] text-xs mt-0.5">Cumulative P&L, trade by trade</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[#64748B] text-xs mb-0.5">Net P&L</p>
          <p className={`font-bold ${netPnL >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{fmt$(netPnL)}</p>
        </div>
      </div>

      {hasTrades ? (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis
                dataKey="index"
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.15)" }}
                tickFormatter={(v) => (v === 0 ? "Start" : `#${v}`)}
              />
              <YAxis
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmt$(v)}
                width={72}
                domain={yDomain}
                allowDataOverflow
              />
              <Tooltip content={<EquityTooltip />} />
              <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#298DFF"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
                activeDot={{ r: 4, fill: "#298DFF", stroke: "#0B1220", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[320px] flex flex-col items-center justify-center text-center">
          <Activity className="w-10 h-10 text-[#475569] mb-3" />
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.base }}>
            No trades match the selected filters
          </p>
        </div>
      )}
    </div>
  );
}
