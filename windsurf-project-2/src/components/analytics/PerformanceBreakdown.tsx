"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Wallet, Building2, LineChart as LineChartIcon, Clock3 } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { BreakdownEntry } from "@/lib/analytics/globalAnalytics";

const fmt$ = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BreakdownTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const entry: BreakdownEntry = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs"
      style={{ background: "rgba(11,18,32,0.95)", border: "1px solid rgba(148,163,184,0.15)", backdropFilter: "blur(12px)" }}
    >
      <p className="text-[#F8FAFC] font-semibold mb-1">{entry.label}</p>
      <p className={entry.pnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}>{fmt$(entry.pnl)}</p>
      <p className="text-[#94A3B8]">{entry.trades} trades · {entry.winRate.toFixed(0)}% win rate</p>
    </div>
  );
};

function BreakdownCard({
  icon: Icon,
  title,
  data,
  activeKey,
  onSelect,
}: {
  icon: React.ElementType;
  title: string;
  data: BreakdownEntry[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const hasData = data.length > 0;
  const height = Math.min(360, Math.max(220, data.length * 44));

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
          <Icon className="w-5 h-5 text-[#298DFF]" />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          {title}
        </h3>
      </div>

      {hasData ? (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
              <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.15)" }} tickFormatter={fmt$} />
              <YAxis
                type="category"
                dataKey="label"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "rgba(41,141,255,0.06)" }} />
              <Bar
                dataKey="pnl"
                radius={[0, 6, 6, 0]}
                maxBarSize={28}
                // Recharts passes the rendered rectangle, not the raw datum —
                // the original BreakdownEntry lives on `.payload`.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(bar: any) => {
                  const key = bar?.payload?.key;
                  if (key) onSelect(activeKey === key ? "" : key);
                }}
                style={{ cursor: "pointer" }}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"}
                    opacity={activeKey && activeKey !== entry.key ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[220px] flex flex-col items-center justify-center text-center">
          <Icon className="w-10 h-10 text-[#475569] mb-3" />
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
            No trades match the selected filters
          </p>
        </div>
      )}
    </div>
  );
}

interface PerformanceBreakdownProps {
  byAccount: BreakdownEntry[];
  byPropFirm: BreakdownEntry[];
  byInstrument: BreakdownEntry[];
  bySession: BreakdownEntry[];
  activeAccountId: string;
  activePropFirm: string;
  activeInstrument: string;
  activeSession: string;
  onSelectAccount: (key: string) => void;
  onSelectPropFirm: (key: string) => void;
  onSelectInstrument: (key: string) => void;
  onSelectSession: (key: string) => void;
}

export function PerformanceBreakdown({
  byAccount,
  byPropFirm,
  byInstrument,
  bySession,
  activeAccountId,
  activePropFirm,
  activeInstrument,
  activeSession,
  onSelectAccount,
  onSelectPropFirm,
  onSelectInstrument,
  onSelectSession,
}: PerformanceBreakdownProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <BreakdownCard icon={Wallet} title="Performance by Account" data={byAccount} activeKey={activeAccountId} onSelect={onSelectAccount} />
      <BreakdownCard icon={Building2} title="Performance by Prop Firm" data={byPropFirm} activeKey={activePropFirm} onSelect={onSelectPropFirm} />
      <BreakdownCard icon={LineChartIcon} title="Performance by Instrument" data={byInstrument} activeKey={activeInstrument} onSelect={onSelectInstrument} />
      <BreakdownCard icon={Clock3} title="Performance by Session" data={bySession} activeKey={activeSession} onSelect={onSelectSession} />
    </div>
  );
}
