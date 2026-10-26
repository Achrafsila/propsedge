"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Target, AlertTriangle, Quote } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { AccountRiskState, RecommendedRisk } from "@/lib/analytics/aiCoach";
import { AccountHealthState, BiggestRisk } from "@/lib/analytics/buddyAdvice";
import { PrimaryEvaluation } from "./CockpitHero";

// ============================================================
// PropEdge — Executive Cards row (EdgePilot V3)
// ============================================================
// Four glanceable cards, no explanations, no lists — every value here is
// read straight from already-computed engine output (riskStates, the
// account's committed DailyContract, buddyAdvice.ts's single Biggest Risk
// selection). Nothing is calculated in this file.

function fmt$(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

const cardStyle = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: borderRadius["2xl"],
};

function CardShell({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="rounded-2xl p-5 flex flex-col"
      style={{ ...cardStyle, minHeight: 200 }}
    >
      {children}
    </motion.div>
  );
}

function CardLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-3.5 h-3.5 text-[#298DFF]" />
      <span className="text-[#94A3B8] uppercase" style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label }}>
        {children}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>{label}</span>
      <span className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.sm }}>{value}</span>
    </div>
  );
}

function AccountHealthCard({
  index,
  healthState,
  riskState,
  recommendedRisk,
}: {
  index: number;
  healthState: AccountHealthState | null;
  riskState: AccountRiskState | null;
  recommendedRisk: RecommendedRisk;
}) {
  const equity = riskState ? riskState.account.accountSize + riskState.account.currentProfit : null;
  const buffers = [riskState?.dailyBuffer, riskState?.maxBuffer].filter((v): v is number => v !== null && v !== undefined);
  const tightestBuffer = buffers.length > 0 ? Math.min(...buffers) : null;

  return (
    <CardShell index={index}>
      <CardLabel icon={ShieldCheck}>Account Health</CardLabel>
      {healthState ? (
        <span
          className="self-start px-3 py-1 rounded-full font-bold mb-4"
          style={{ background: `${healthState.color}1A`, color: healthState.color, border: `1px solid ${healthState.color}40`, fontSize: typography.fontSize.sm }}
        >
          {healthState.label}
        </span>
      ) : (
        <span className="text-[#64748B] text-sm mb-4">No active account</span>
      )}
      <div className="mt-auto space-y-0.5">
        <Stat label="Current Equity" value={equity !== null ? fmt$(equity) : "—"} />
        <Stat label="Risk" value={recommendedRisk.amount !== null ? fmt$(recommendedRisk.amount) : "—"} />
        <Stat label="Tightest risk buffer (daily / max)" value={tightestBuffer !== null ? fmt$(tightestBuffer) : "—"} />
      </div>
    </CardShell>
  );
}

function TodaysMissionCard({ index, primaryEvaluation }: { index: number; primaryEvaluation: PrimaryEvaluation | null }) {
  const contract = primaryEvaluation?.contract ?? null;
  return (
    <CardShell index={index}>
      <CardLabel icon={Target}>Today&apos;s Mission</CardLabel>
      {contract ? (
        <div className="space-y-0.5">
          <Stat label="Max Risk" value={contract.maxRiskPerTrade !== null ? fmt$(contract.maxRiskPerTrade) : "—"} />
          <Stat label="Max Trades" value={contract.maxTrades !== null ? String(contract.maxTrades) : "—"} />
          <Stat label="Session" value={contract.allowedSessions.length > 0 ? contract.allowedSessions.join(", ") : "Any"} />
          <Stat label="Instruments" value={contract.allowedInstruments.length > 0 ? contract.allowedInstruments.join(", ") : "Any"} />
          <Stat label="Stop Rule" value={contract.stopAfterLosses !== null ? `${contract.stopAfterLosses} loss${contract.stopAfterLosses === 1 ? "" : "es"}` : "—"} />
        </div>
      ) : (
        <p className="text-[#64748B] text-sm">Not committed today.</p>
      )}
    </CardShell>
  );
}

function BiggestRiskCard({ index, biggestRisk }: { index: number; biggestRisk: BiggestRisk | null }) {
  return (
    <CardShell index={index}>
      <CardLabel icon={AlertTriangle}>Biggest Risk</CardLabel>
      {biggestRisk ? (
        <>
          <p className="font-extrabold text-[#F8FAFC] mb-3" style={{ fontSize: typography.fontSize["2xl"] }}>
            {biggestRisk.label}
          </p>
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal }}>
            {biggestRisk.detail}
          </p>
        </>
      ) : (
        <>
          <p className="font-extrabold text-[#10B981] mb-3" style={{ fontSize: typography.fontSize["2xl"] }}>
            Clear
          </p>
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
            No major risk identified today. Stay disciplined.
          </p>
        </>
      )}
    </CardShell>
  );
}

function KeyTakeawayCard({ index, keyTakeaway }: { index: number; keyTakeaway: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="rounded-2xl p-8 flex flex-col items-center text-center"
      style={cardStyle}
    >
      <CardLabel icon={Quote}>Key Takeaway</CardLabel>
      <p
        className="text-[#CBD5E1] italic max-w-3xl"
        style={{ fontSize: typography.fontSize["2xl"], lineHeight: typography.lineHeight.relaxed }}
      >
        &ldquo;{keyTakeaway}&rdquo;
      </p>
    </motion.div>
  );
}

export function ExecutiveCardsRow({
  primaryEvaluation,
  healthState,
  riskState,
  recommendedRisk,
  biggestRisk,
  keyTakeaway,
}: {
  primaryEvaluation: PrimaryEvaluation | null;
  healthState: AccountHealthState | null;
  riskState: AccountRiskState | null;
  recommendedRisk: RecommendedRisk;
  biggestRisk: BiggestRisk | null;
  keyTakeaway: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AccountHealthCard index={0} healthState={healthState} riskState={riskState} recommendedRisk={recommendedRisk} />
        <TodaysMissionCard index={1} primaryEvaluation={primaryEvaluation} />
        <BiggestRiskCard index={2} biggestRisk={biggestRisk} />
      </div>
      <KeyTakeawayCard index={3} keyTakeaway={keyTakeaway} />
    </div>
  );
}
