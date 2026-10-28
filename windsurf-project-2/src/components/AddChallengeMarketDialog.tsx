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
import { MinimumDailyProfitType } from "@/types";

interface AddChallengeMarketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MarketType = "CFD" | "Futures";
// "instant" here is a pre-existing evaluation shape (single profit target,
// no Step 1/Step 2 split, but still has to be passed) — distinct from the
// new AccountTypeChoice "instant_funded" below, which skips evaluation
// entirely. Kept unchanged/untouched to avoid disturbing existing rows.
type CfdType = "1-step" | "2-step" | "instant";
type AccountTypeChoice = "evaluation" | "instant_funded";
type WizardStep = "account-type" | "market-type" | "form";

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
  // Instant Funded payout-eligibility rules — irrelevant/hidden for Evaluation.
  consistencyChoice: "" | "limit" | "none";
  consistencyRequired: boolean;
  consistencyLimit: string;
  minimumTradingDaysRequired: boolean;
  minimumTradingDays: string;
  minimumDailyProfitType: MinimumDailyProfitType;
  minimumDailyProfitValue: string;
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
  consistencyChoice: "",
  consistencyRequired: false,
  consistencyLimit: "",
  minimumTradingDaysRequired: false,
  minimumTradingDays: "",
  minimumDailyProfitType: "fixed",
  minimumDailyProfitValue: "",
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

function isValidPositiveInteger(value: string): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

const RequiredMark = () => <span className="text-[#EF4444]">*</span>;

// Small self-contained toggle switch — the codebase has no Switch/Checkbox
// primitive today, so this rolls a minimal one rather than pulling in a
// dependency for two boolean fields.
function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer gap-4">
      <span className="text-sm text-[#F8FAFC] font-medium">{label}</span>
      <span className="relative inline-flex items-center shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span className="w-9 h-5 bg-[#1A2942] rounded-full peer-checked:bg-[#298DFF] transition-colors" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

// The primary way to create a challenge/account from the Challenges page —
// unlike AddChallengeDialog.tsx (unchanged, still used by Dashboard's "+ New
// Challenge" quick action; Instant Funded is not yet wired there — see the
// scoping note in the implementation report), this one never depends on an
// Admin-configured Prop Firm/Plan preset: Prop Firm is free text here, and
// the market type (CFD/Futures) picked in step 1 only decides which fields
// step 2 asks for. Account Type (Evaluation vs. Instant Funded) is chosen
// first — Instant Funded skips straight to the form with market type locked
// to CFD, since it's the only supported environment for v1.
export function AddChallengeMarketDialog({ open, onOpenChange }: AddChallengeMarketDialogProps) {
  const { addChallenge, addFundedAccount } = useAccounts();
  const [step, setStep] = useState<WizardStep>("account-type");
  const [accountType, setAccountType] = useState<AccountTypeChoice | null>(null);
  // TODO: marketType is UI-only routing state, not persisted anywhere — no
  // schema field exists for CFD-vs-Futures on evaluation rows today, and
  // nothing downstream (filtering, display, funding logic) currently
  // branches on it there. If that changes, add a migration following the
  // additive/idempotent style of 001-010 plus a `marketType?: 'CFD' |
  // 'Futures'` field threaded through src/types/index.ts and
  // src/lib/supabase/challenges.ts. Instant Funded accounts already persist
  // their environment via the new `tradingEnvironment` field.
  const [marketType, setMarketType] = useState<MarketType | null>(null);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);

  const resetState = () => {
    setStep("account-type");
    setAccountType(null);
    setMarketType(null);
    setFormData(INITIAL_FORM);
  };

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  // Selecting an account type always starts the form fresh — switching
  // between Evaluation and Instant Funded must never carry over the other
  // type's hidden field values (step targets, consistency limit, etc.).
  const handleSelectAccountType = (type: AccountTypeChoice) => {
    setAccountType(type);
    setFormData(INITIAL_FORM);
    if (type === "instant_funded") {
      setMarketType("CFD");
      setStep("form");
    } else {
      setMarketType(null);
      setStep("market-type");
    }
  };

  const isInstantFunded = accountType === "instant_funded";
  const isTwoStep = marketType === "CFD" && formData.cfdType === "2-step";
  const isSingleTarget = marketType === "Futures" || (marketType === "CFD" && !isTwoStep);

  const commonFieldsValid =
    formData.propFirmName.trim() !== "" &&
    formData.accountName.trim() !== "" &&
    formData.purchaseDate.trim() !== "" &&
    isValidNumber(formData.accountSize) &&
    isValidNumber(formData.dailyDrawdown) &&
    isValidNumber(formData.maxDrawdown) &&
    isValidNumber(formData.purchaseCost);

  const consistencyValid =
    formData.consistencyChoice !== "" &&
    (formData.consistencyChoice === "none" ||
     (isValidNumber(formData.consistencyLimit) &&
      parseFloat(formData.consistencyLimit) > 0 &&
      parseFloat(formData.consistencyLimit) < 100));

  const minDaysValid = !formData.minimumTradingDaysRequired || isValidPositiveInteger(formData.minimumTradingDays);

  const dailyProfitEntered = formData.minimumDailyProfitValue.trim() !== "";
  const dailyProfitValid =
    !formData.minimumTradingDaysRequired ||
    !dailyProfitEntered ||
    (isValidNumber(formData.minimumDailyProfitValue) &&
      parseFloat(formData.minimumDailyProfitValue) > 0 &&
      !!formData.minimumDailyProfitType);

  const isValid = isInstantFunded
    ? commonFieldsValid && consistencyValid && minDaysValid && dailyProfitValid
    : !!marketType &&
      commonFieldsValid &&
      consistencyValid &&
      (isTwoStep
        ? isValidNumber(formData.step1ProfitTarget) && isValidNumber(formData.step2ProfitTarget)
        : isSingleTarget && isValidNumber(formData.profitTarget));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    if (isInstantFunded) {
      // Instant Funded is a FundedAccount from creation — never a Challenge,
      // never an evaluation lifecycle. See the Option B architecture
      // decision: it must behave exactly like any other funded account
      // (visible to AI Coach, Risk Center, dashboard capital/P&L, /funded)
      // except for its origin, which fundingPath records for badges/filters
      // only — it never drives eligibility logic (that's payoutRules' job).
      const accountSize = parseFloat(formData.accountSize);
      addFundedAccount({
        propFirmName: formData.propFirmName.trim(),
        accountName: formData.accountName.trim(),
        accountSize,
        fundingDate: formData.purchaseDate,
        initialBalance: accountSize,
        currentBalance: accountSize,
        currentProfit: 0,
        maxDrawdown: parseFloat(formData.maxDrawdown),
        remainingDrawdown: parseFloat(formData.maxDrawdown),
        status: "active",
        fundingPath: "instant",
        tradingEnvironment: "cfd",
        purchaseCost: parseFloat(formData.purchaseCost),
        payoutRules: {
          consistency: {
            required: formData.consistencyRequired,
            limitPercent: formData.consistencyRequired ? parseFloat(formData.consistencyLimit) : undefined,
          },
          minimumTradingDays: {
            required: formData.minimumTradingDaysRequired,
            days: formData.minimumTradingDaysRequired ? parseInt(formData.minimumTradingDays, 10) : undefined,
            qualifyingDailyProfit:
              formData.minimumTradingDaysRequired && dailyProfitEntered
                ? { type: formData.minimumDailyProfitType, value: parseFloat(formData.minimumDailyProfitValue) }
                : undefined,
          },
        },
      });
    } else {
      if (!marketType) return;
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
        consistencyRule: formData.consistencyChoice==="limit" ? `${formData.consistencyLimit}%` : null,
      });
    }

    handleClose(false);
    resetState();
  };

  const inputClass =
    "bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all";
  const selectClass =
    "w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all";

  const dialogTitle =
    step === "account-type" ? "Add Account" : isInstantFunded ? "Add Instant Account" : "Add Challenge";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">{dialogTitle}</DialogTitle>
        </DialogHeader>

        {step === "account-type" ? (
          <div className="space-y-4">
            <p className="text-[#8B97A8] text-sm">Select the account type to continue.</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleSelectAccountType("evaluation")}
                className="rounded-xl p-6 text-left border-2 transition-all duration-200 bg-[#0D1424] border-[#1A2942] hover:border-[#2F80ED] hover:bg-[rgba(41,141,255,0.06)]"
              >
                <p className="text-lg font-bold text-[#F8FAFC] mb-1">Evaluation</p>
                <p className="text-xs text-[#8B97A8]">
                  Step 1, Step 2, or single-target challenge — must be passed before funding.
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleSelectAccountType("instant_funded")}
                className="rounded-xl p-6 text-left border-2 transition-all duration-200 bg-[#0D1424] border-[#1A2942] hover:border-[#F59E0B] hover:bg-[rgba(245,158,11,0.06)]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-lg font-bold text-[#F8FAFC]">Instant Funded</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[rgba(245,158,11,0.4)]">
                    Instant
                  </span>
                </div>
                <p className="text-xs text-[#8B97A8]">CFD account funded from day one — no evaluation phase.</p>
              </button>
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
        ) : step === "market-type" ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("account-type")}
              className="text-xs text-[#298DFF] hover:text-[#7CC0FF] transition-colors"
            >
              ← Back
            </button>
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
                      ? "Step 1, Step 2, or Instant evaluation challenges"
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
                onClick={() => setStep(isInstantFunded ? "account-type" : "market-type")}
                className="text-xs text-[#298DFF] hover:text-[#7CC0FF] transition-colors"
              >
                {isInstantFunded ? "← Back to account type" : "← Back to market type"}
              </button>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[rgba(41,141,255,0.15)] text-[#298DFF] border border-[rgba(41,141,255,0.3)]">
                  {marketType}
                </span>
                {isInstantFunded && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[rgba(245,158,11,0.4)]">
                    Instant
                  </span>
                )}
              </div>
            </div>

            {/* Common fields — shared by Evaluation and Instant Funded */}
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

            {!isInstantFunded && (
              <>
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
                      {marketType === "CFD" && formData.cfdType === "1-step" ? "Profit Target Step 1 ($)" : "Profit Target ($)"}{" "}
                      <RequiredMark />
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
                  <Label className="text-[#8B97A8]">Consistency <RequiredMark /></Label>
                  <select required value={formData.consistencyChoice} onChange={e=>setFormData({...formData,consistencyChoice:e.target.value as ""|"limit"|"none",consistencyRequired:e.target.value==="limit",consistencyLimit:""})} className={selectClass}>
                    <option value="">Select rule</option><option value="limit">Consistency limit (%)</option><option value="none">No consistency</option>
                  </select>
                  {formData.consistencyChoice==="limit"&&<Input type="number" min="0.1" max="99.9" step="0.1" required value={formData.consistencyLimit} onChange={e=>setFormData({...formData,consistencyLimit:e.target.value})} placeholder="e.g. 20" className={inputClass}/>}
                </div>
              </>
            )}

            {isInstantFunded && (
              <div className="space-y-4">
                <div className="rounded-xl p-4 bg-[rgba(41,141,255,0.06)] border border-[rgba(41,141,255,0.15)] space-y-3">
                  <Label className="text-[#8B97A8]">Consistency <RequiredMark /></Label>
                  <select required value={formData.consistencyChoice} onChange={e=>setFormData({...formData,consistencyChoice:e.target.value as ""|"limit"|"none",consistencyRequired:e.target.value==="limit",consistencyLimit:""})} className={selectClass}>
                    <option value="">Select rule</option><option value="limit">Consistency limit (%)</option><option value="none">No consistency</option>
                  </select>
                  {formData.consistencyChoice==="limit"&&<Input type="number" min="0.1" max="99.9" step="0.1" required value={formData.consistencyLimit} onChange={e=>setFormData({...formData,consistencyLimit:e.target.value})} placeholder="e.g. 20" className={inputClass}/>}
                </div>

                <div className="rounded-xl p-4 bg-[rgba(41,141,255,0.06)] border border-[rgba(41,141,255,0.15)] space-y-3">
                  <ToggleSwitch
                    checked={formData.minimumTradingDaysRequired}
                    onChange={(next) =>
                      setFormData({
                        ...formData,
                        minimumTradingDaysRequired: next,
                        minimumTradingDays: next ? formData.minimumTradingDays : "",
                        minimumDailyProfitValue: next ? formData.minimumDailyProfitValue : "",
                      })
                    }
                    label="Minimum trading days required"
                  />
                  {formData.minimumTradingDaysRequired && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[#8B97A8]">
                          Minimum trading days <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={formData.minimumTradingDays}
                          onChange={(e) => setFormData({ ...formData, minimumTradingDays: e.target.value })}
                          placeholder="e.g. 5"
                          required
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[#8B97A8]">Minimum profit per qualifying trading day</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={formData.minimumDailyProfitType}
                            onChange={(e) => setFormData({ ...formData, minimumDailyProfitType: e.target.value as MinimumDailyProfitType })}
                            className={selectClass}
                          >
                            <option value="fixed">Fixed amount ($)</option>
                            <option value="percentage">% of initial balance</option>
                          </select>
                          <Input
                            type="number"
                            min="0"
                            value={formData.minimumDailyProfitValue}
                            onChange={(e) => setFormData({ ...formData, minimumDailyProfitValue: e.target.value })}
                            placeholder={formData.minimumDailyProfitType === "fixed" ? "e.g. 100" : "e.g. 0.5"}
                            className={inputClass}
                          />
                        </div>
                        <p className="text-xs text-[#64748B]">
                          A trading day only counts toward the minimum requirement when its net profit reaches this threshold.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

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
                {isInstantFunded ? "Add Instant Account" : "Add Challenge"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
