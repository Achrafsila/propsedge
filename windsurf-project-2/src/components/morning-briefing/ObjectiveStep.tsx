"use client";

import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TodaysObjective } from "@/lib/analytics/aiCoach";

const OBJECTIVE_OPTIONS: { value: TodaysObjective; emoji: string; label: string }[] = [
  { value: "pass_challenge", emoji: "🎯", label: "Pass a Challenge" },
  { value: "protect_funded", emoji: "🛡", label: "Protect a Funded Account" },
  { value: "prepare_payout", emoji: "💰", label: "Prepare a Payout" },
  { value: "build_consistency", emoji: "📈", label: "Build Consistency" },
  { value: "focus_discipline", emoji: "🧠", label: "Focus on Discipline" },
  { value: "recover_losses", emoji: "🔄", label: "Recover After Losses" },
];

export function ObjectiveStep({
  objective,
  onSelect,
}: {
  objective: TodaysObjective | null;
  onSelect: (objective: TodaysObjective) => void;
}) {
  return (
    <div className="w-full">
      <h2 className="text-[#F8FAFC] font-bold text-center mb-6" style={{ fontSize: typography.fontSize["2xl"] }}>
        What is today&apos;s primary objective?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OBJECTIVE_OPTIONS.map((opt) => {
          const isSelected = objective === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className="flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-200 pointer-events-auto"
              style={{
                background: isSelected ? "rgba(41,141,255,0.12)" : glassmorphism.card.background,
                backdropFilter: glassmorphism.card.backdropBlur,
                border: isSelected ? "1px solid rgba(41,141,255,0.5)" : "1px solid rgba(148,163,184,0.08)",
                borderRadius: borderRadius.xl,
              }}
            >
              <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
              <span
                className={isSelected ? "text-[#F8FAFC]" : "text-[#CBD5E1]"}
                style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium }}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
