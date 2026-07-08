"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/context/AccountsContext";

interface AddChallengeMarketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MarketType = "CFD" | "Futures";
type CfdType = "1-step" | "2-step" | "instant";

const CFD_TYPE_LABEL: Record<CfdType, string> = {
  "1-step": "1 Step",
  "2-step": "2 Step",
  instant: "Instant",
};

interface FormState {
  purchaseDate: string;
  propFirmName: string;
  accountName: string;
  accountSize: string;
  dailyDrawdown: string;
  maxDrawdown: string;
  purchaseCost: string;
  cfdType: CfdType;
  profitTarget: string;
  step1ProfitTarget: string;
  step2ProfitTarget: string;
  consistencyRule: string;
}

const INITIAL_FORM: FormState = {
  purchaseDate: new Date().toISOString().split("T")[0],
  propFirmName: "",
  accountName: "",
  accountSize: "",
  dailyDrawdown: "",
  maxDrawdown: "",
  purchaseCost: "",
  cfdType: "1-step",
  profitTarget: "",
  step1ProfitTarget: "",
  step2ProfitTarget: "",
  consistencyRule: "",
};

// A numeric field counts as filled-in only if it parses to a finite,
// non-negative number — an empty string, "abc", or a negative value are all
// rejected the same way so the submit button can never be enabled against
// garbage input.
function isValidNumber(value: string): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

const RequiredMark = () => <span className="text-[#EF4444]">*</span>;

// The primary way to create a challenge from the Challenges page — unlike
// AddChallengeDialog.tsx (unchanged, still used by Dashboard's "+ New
// Challenge" quick action, just no longer wired into this page), this one
// never depends on an Admin-configured Prop Firm/Plan preset: Prop Firm is
// free text here, and the market type (CFD/Futures) picked in step 1 only
// decides which fields step 2 asks for.
export function AddChallengeMarketDialog({ open, onOpenChange }: AddChallengeMarketDialogProps) {
  const { addChallenge } = useAccounts();
  const [step, setStep] = useState<"market-type" | "form">("market-type");
  // TODO: marketType is UI-only routing state, not persisted anywhere — no
  // schema field exists for CFD-vs-Futures today, and nothing downstream
  // (filtering, display, funding logic) currently branches on it. If that
  // changes, add a migration (009_challenge_market_type.sql, following the
  // additive/idempotent style of 001-008) plus a `marketType?: 'CFD' |
  // 'Futures'` field threaded through src/types/index.ts and
  // src/lib/supabase/challenges.ts.
  const [marketType, setMarketType] = useState<MarketType | null>(null);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);

  const resetState = () => {
    setStep("market-type");
    setMarketType(null);
    setFormData(INITIAL_FORM);
  };

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const isTwoStep = marketType === "CFD" && formData.cfdType === "2-step";
  const isSingleTarget = marketType === "Futures" || (marketType === "CFD" && !isTwoStep);

  const isValid =
    !!marketType &&
    formData.propFirmName.trim() !== "" &&
    formData.accountName.trim() !== "" &&
    formData.purchaseDate.trim() !== "" &&
    isValidNumber(formData.accountSize) &&
    isValidNumber(formData.dailyDrawdown) &&
    isValidNumber(formData.maxDrawdown) &&
    isValidNumber(formData.purchaseCost) &&
    (isTwoStep
      ? isValidNumber(formData.step1ProfitTarget) && isValidNumber(formData.step2ProfitTarget)
      : isSingleTarget && isValidNumber(formData.profitTarget));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !marketType) return;

    const isCfd = marketType === "CFD";
    const kind: CfdType = isCfd ? formData.cfdType : "instant";
    const activeProfitTarget = isTwoStep ? parseFloat(formData.step1ProfitTarget) : parseFloat(formData.profitTarget);

    addChallenge({
      propFirmName: formData.propFirmName.trim(),
      accountName: formData.accountName.trim(),
      accountSize: parseFloat(formData.accountSize),
      challengeType: isCfd ? CFD_TYPE_LABEL[formData.cfdType] : "Futures",
      challengeKind: kind,
      challengeStep: isTwoStep ? "1" : "instant",
      step1ProfitTarget: isTwoStep ? parseFloat(formData.step1ProfitTarget) : undefined,
      step2ProfitTarget: isTwoStep ? parseFloat(formData.step2ProfitTarget) : undefined,
      purchaseCost: parseFloat(formData.purchaseCost),
      purchaseDate: formData.purchaseDate,
      profitTarget: activeProfitTarget,
      currentProfit: 0,
      maxDrawdown: parseFloat(formData.maxDrawdown),
      remainingDrawdown: parseFloat(formData.maxDrawdown),
      dailyDrawdown: parseFloat(formData.dailyDrawdown),
      status: "active",
      consistencyRule: formData.consistencyRule.trim() || undefined,
    });

    handleClose(false);
    resetState();
  };

  const inputClass =
    "bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all";
  const selectClass =
    "w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Add Challenge</DialogTitle>
        </DialogHeader>

        {step === "market-type" ? (
          <div className="space-y-4">
            <p className="text-[#8B97A8] text-sm">Select the account market type to continue.</p>
            <div className="grid grid-cols-2 gap-4">
              {(["CFD", "Futures"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setMarketType(type);
                    setStep("form");
                  }}
                  className="rounded-xl p-6 text-left border-2 transition-all duration-200 bg-[#0D1424] border-[#1A2942] hover:border-[#2F80ED] hover:bg-[rgba(41,141,255,0.06)]"
                >
                  <p className="text-lg font-bold text-[#F8FAFC] mb-1">{type}</p>
                  <p className="text-xs text-[#8B97A8]">
                    {type === "CFD"
                      ? "Step 1, Step 2, or Instant funded challenges"
                      : "Single profit-target futures evaluation accounts"}
                  </p>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#2F80ED] rounded-xl"
              >
                Cancel
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("market-type")}
                className="text-xs text-[#298DFF] hover:text-[#7CC0FF] transition-colors"
              >
                ← Back to market type
              </button>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[rgba(41,141,255,0.15)] text-[#298DFF] border border-[rgba(41,141,255,0.3)]">
                {marketType}
              </span>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marketPurchaseDate" className="text-[#8B97A8]">
                  Date <RequiredMark />
                </Label>
                <Input
                  id="marketPurchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketPropFirm" className="text-[#8B97A8]">
                  Prop Firm <RequiredMark />
                </Label>
                <Input
                  id="marketPropFirm"
                  value={formData.propFirmName}
                  onChange={(e) => setFormData({ ...formData, propFirmName: e.target.value })}
                  placeholder="e.g. FundingPips"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketAccountName" className="text-[#8B97A8]">
                Account ID / Account Name <RequiredMark />
              </Label>
              <Input
                id="marketAccountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                required
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marketAccountSize" className="text-[#8B97A8]">
                  Account Size ($) <RequiredMark />
                </Label>
                <Input
                  id="marketAccountSize"
                  type="number"
                  min="0"
                  value={formData.accountSize}
                  onChange={(e) => setFormData({ ...formData, accountSize: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketCost" className="text-[#8B97A8]">
                  Cost ($) <RequiredMark />
                </Label>
                <Input
                  id="marketCost"
                  type="number"
                  min="0"
                  value={formData.purchaseCost}
                  onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marketDailyLoss" className="text-[#8B97A8]">
                  Daily Loss ($) <RequiredMark />
                </Label>
                <Input
                  id="marketDailyLoss"
                  type="number"
                  min="0"
                  value={formData.dailyDrawdown}
                  onChange={(e) => setFormData({ ...formData, dailyDrawdown: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketMaxLoss" className="text-[#8B97A8]">
                  Max Loss ($) <RequiredMark />
                </Label>
                <Input
                  id="marketMaxLoss"
                  type="number"
                  min="0"
                  value={formData.maxDrawdown}
                  onChange={(e) => setFormData({ ...formData, maxDrawdown: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {marketType === "CFD" && (
              <div className="space-y-2">
                <Label htmlFor="marketCfdType" className="text-[#8B97A8]">
                  Type <RequiredMark />
                </Label>
                <select
                  id="marketCfdType"
                  value={formData.cfdType}
                  onChange={(e) => {
                    const cfdType = e.target.value as CfdType;
                    setFormData({ ...formData, cfdType });
                  }}
                  className={selectClass}
                >
                  <option value="1-step">Step 1</option>
                  <option value="2-step">Step 2</option>
                  <option value="instant">Instant</option>
                </select>
              </div>
            )}

            {marketType === "CFD" && isTwoStep && (
              <div className="rounded-xl p-4 bg-[rgba(41,141,255,0.06)] border border-[rgba(41,141,255,0.25)] space-y-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[rgba(41,141,255,0.15)] text-[#298DFF] border border-[rgba(41,141,255,0.3)]">
                    2 Step
                  </span>
                  <span className="text-xs text-[#8B97A8]">Both step targets are required.</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[#8B97A8]">
                      Profit Target Step 1 ($) <RequiredMark />
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.step1ProfitTarget}
                      onChange={(e) => setFormData({ ...formData, step1ProfitTarget: e.target.value })}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8B97A8]">
                      Profit Target Step 2 ($) <RequiredMark />
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.step2ProfitTarget}
                      onChange={(e) => setFormData({ ...formData, step2ProfitTarget: e.target.value })}
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {isSingleTarget && (
              <div className="space-y-2">
                <Label htmlFor="marketProfitTarget" className="text-[#8B97A8]">
                  {marketType === "CFD" && formData.cfdType === "1-step" ? "Profit Target Step 1 ($)" : "Profit Target ($)"} <RequiredMark />
                </Label>
                <Input
                  id="marketProfitTarget"
                  type="number"
                  min="0"
                  value={formData.profitTarget}
                  onChange={(e) => setFormData({ ...formData, profitTarget: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="marketConsistencyRule" className="text-[#8B97A8]">
                Consistency Rule (Optional)
              </Label>
              <Input
                id="marketConsistencyRule"
                value={formData.consistencyRule}
                onChange={(e) => setFormData({ ...formData, consistencyRule: e.target.value })}
                placeholder="e.g. No single day > 30% of total profit"
                className={inputClass}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#2F80ED] rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid}
                className="bg-gradient-to-r from-[#2F80ED] to-[#1E6BC7] hover:shadow-lg hover:shadow-[#2F80ED]/20 hover:scale-105 transition-all duration-200 text-white rounded-xl disabled:opacity-50 disabled:hover:scale-100"
              >
                Add Challenge
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
