"use client";

import { ReactNode } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import { typography } from "@/design-system";

// Single-value radial progress ring built on recharts' RadialBarChart
// (unused elsewhere in the app before this). The percent is always supplied
// by the caller — this component only draws it; it never derives or
// classifies anything itself.
export function RadialGauge({
  percent,
  color,
  size = 96,
  trackColor = "rgba(148,163,184,0.1)",
  centerValue,
  caption,
}: {
  percent: number;
  color: string;
  size?: number;
  trackColor?: string;
  centerValue?: ReactNode;
  caption?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const data = [{ value: clamped, fill: color }];

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            width={size}
            height={size}
            data={data}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              dataKey="value"
              background={{ fill: trackColor }}
              cornerRadius={size}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {centerValue !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="font-extrabold tabular-nums"
              style={{ fontSize: size >= 88 ? typography.fontSize.xl : typography.fontSize.base, color: "#F8FAFC" }}
            >
              {centerValue}
            </span>
          </div>
        )}
      </div>
      {caption && (
        <span
          className="text-[#94A3B8] text-center mt-2"
          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
        >
          {caption}
        </span>
      )}
    </div>
  );
}
