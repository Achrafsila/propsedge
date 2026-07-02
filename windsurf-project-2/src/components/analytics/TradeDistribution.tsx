"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { PieChart as PieChartIcon, Clock3 } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { SessionCount, WinLossSlice } from "@/lib/analytics/globalAnalytics";

const SESSION_COLOR = "#298DFF";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SliceTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const slice = payload[0];
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs"
      style={{ background: "rgba(11,18,32,0.95)", border: "1px solid rgba(148,163,184,0.15)", backdropFilter: "blur(12px)" }}
    >
      <p className="text-[#F8FAFC] font-semibold">{slice.name}</p>
      <p style={{ color: slice.payload.color ?? SESSION_COLOR }}>{slice.value} trades</p>
    </div>
  );
};

function WinLossPie({ data }: { data: WinLossSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
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
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
          <PieChartIcon className="w-5 h-5 text-[#10B981]" />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Win/Loss Distribution
        </h3>
      </div>

      {total > 0 ? (
        <>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3} isAnimationActive animationDuration={600}>
                  {data.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} stroke="rgba(3,7,18,0.6)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<SliceTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {data.map((slice) => (
              <span key={slice.name} className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: slice.color }} />
                {slice.name} · {slice.value} ({((slice.value / total) * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="h-[240px] flex flex-col items-center justify-center text-center">
          <PieChartIcon className="w-10 h-10 text-[#475569] mb-3" />
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
            No trades match the selected filters
          </p>
        </div>
      )}
    </div>
  );
}

function SessionDistribution({ data }: { data: SessionCount[] }) {
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
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(41,141,255,0.1)" }}>
          <Clock3 className="w-5 h-5 text-[#298DFF]" />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Trading Session Distribution
        </h3>
      </div>

      {data.length > 0 ? (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
              <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.15)" }} allowDecimals={false} />
              <YAxis type="category" dataKey="session" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} width={90} />
              <Tooltip content={<SliceTooltip />} cursor={{ fill: "rgba(41,141,255,0.06)" }} />
              <Bar dataKey="count" name="Trades" radius={[0, 6, 6, 0]} maxBarSize={28} fill={SESSION_COLOR} isAnimationActive animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[240px] flex flex-col items-center justify-center text-center">
          <Clock3 className="w-10 h-10 text-[#475569] mb-3" />
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
            No trades match the selected filters
          </p>
        </div>
      )}
    </div>
  );
}

export function TradeDistribution({ winLoss, bySession }: { winLoss: WinLossSlice[]; bySession: SessionCount[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <WinLossPie data={winLoss} />
      <SessionDistribution data={bySession} />
    </div>
  );
}
