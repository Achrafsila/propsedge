"use client";

import { useEffect, useState } from "react";
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

interface AddPersonalAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "CAD", "AUD"];

const emptyForm = () => ({
  accountName: "",
  broker: "",
  currency: "USD",
  initialCapital: "",
  dailyLossLimit: "",
  maxDrawdownLimit: "",
  riskPerTradePercent: "",
  personalObjective: "",
});

// No prop firm fields by design — a Personal Account has no challenge
// phase, profit target, or payout rules. Every limit here is optional and
// only ever enforced by EdgePilot/Portfolio if the user actually fills it in.
export function AddPersonalAccountDialog({ open, onOpenChange }: AddPersonalAccountDialogProps) {
  const { addPersonalAccount } = useAccounts();
  const [formData, setFormData] = useState(emptyForm());

  useEffect(() => {
    if (open) setFormData(emptyForm());
  }, [open]);

  const set = (key: keyof ReturnType<typeof emptyForm>, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  // Empty optional inputs must map to null, never 0 — a blank Daily Loss
  // Limit means "no rule configured", not "0% allowed".
  const parseOptionalPercent = (value: string): number | null => {
    if (value.trim() === "") return null;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const initialCapital = parseFloat(formData.initialCapital);
    if (!Number.isFinite(initialCapital) || initialCapital <= 0) return;

    addPersonalAccount({
      accountName: formData.accountName.trim(),
      broker: formData.broker.trim() || undefined,
      initialCapital,
      currency: formData.currency,
      createdAt: new Date().toISOString().split("T")[0],
      dailyLossLimit: parseOptionalPercent(formData.dailyLossLimit),
      maxDrawdownLimit: parseOptionalPercent(formData.maxDrawdownLimit),
      riskPerTradePercent: parseOptionalPercent(formData.riskPerTradePercent),
      personalObjective: formData.personalObjective.trim() || null,
      status: "active",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Add Personal Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountName" className="text-[#8B97A8]">Account Name</Label>
            <Input
              id="accountName"
              required
              placeholder="e.g., My Trading Account"
              value={formData.accountName}
              onChange={(e) => set("accountName", e.target.value)}
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="broker" className="text-[#8B97A8]">Broker / Platform (Optional)</Label>
            <Input
              id="broker"
              placeholder="e.g., Interactive Brokers"
              value={formData.broker}
              onChange={(e) => set("broker", e.target.value)}
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initialCapital" className="text-[#8B97A8]">Initial Capital</Label>
              <Input
                id="initialCapital"
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.initialCapital}
                onChange={(e) => set("initialCapital", e.target.value)}
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-[#8B97A8]">Currency</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => set("currency", e.target.value)}
                className="w-full h-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1A2942]">
            <p className="text-xs text-[#8B97A8] pt-3 pb-1">
              Optional guardrails — leave blank if you don&apos;t want a rule enforced.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dailyLossLimit" className="text-[#8B97A8]">Daily Loss Limit (%)</Label>
              <Input
                id="dailyLossLimit"
                type="number"
                min="0"
                step="0.1"
                placeholder="None"
                value={formData.dailyLossLimit}
                onChange={(e) => set("dailyLossLimit", e.target.value)}
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDrawdownLimit" className="text-[#8B97A8]">Max Drawdown Limit (%)</Label>
              <Input
                id="maxDrawdownLimit"
                type="number"
                min="0"
                step="0.1"
                placeholder="None"
                value={formData.maxDrawdownLimit}
                onChange={(e) => set("maxDrawdownLimit", e.target.value)}
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="riskPerTradePercent" className="text-[#8B97A8]">Risk Per Trade (%)</Label>
            <Input
              id="riskPerTradePercent"
              type="number"
              min="0"
              step="0.1"
              placeholder="None — EdgePilot will infer a conservative default"
              value={formData.riskPerTradePercent}
              onChange={(e) => set("riskPerTradePercent", e.target.value)}
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personalObjective" className="text-[#8B97A8]">Personal Objective (Optional)</Label>
            <Input
              id="personalObjective"
              placeholder="e.g., Grow to $50k while staying under 1% daily risk"
              value={formData.personalObjective}
              onChange={(e) => set("personalObjective", e.target.value)}
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#10B981] rounded-xl">
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-to-r from-[#10B981] to-[#0EA271] hover:shadow-lg hover:shadow-[#10B981]/20 hover:scale-105 transition-all duration-200 text-white rounded-xl">
              Add Personal Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
