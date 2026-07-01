"use client";

import { useState, useEffect } from "react";
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

interface AddPayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFundedAccountId?: string;
}

const emptyForm = (defaultId = "") => ({
  fundedAccountId: defaultId,
  payoutDate: new Date().toISOString().split("T")[0],
  generatedProfit: "",
  requestedPayoutAmount: "",
  receivedPayoutAmount: "",
  propFirmSplitPercentage: "10",
  notes: "",
});

export function AddPayoutDialog({
  open,
  onOpenChange,
  defaultFundedAccountId = "",
}: AddPayoutDialogProps) {
  const { addPayout, fundedAccounts } = useAccounts();
  const [formData, setFormData] = useState(emptyForm(defaultFundedAccountId));

  // Re-seed when dialog opens so pre-selection always reflects current prop.
  useEffect(() => {
    if (open) setFormData(emptyForm(defaultFundedAccountId));
  }, [open, defaultFundedAccountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const requestedAmount = parseFloat(formData.requestedPayoutAmount);
    const splitPercentage = parseFloat(formData.propFirmSplitPercentage);
    const receivedAmount = formData.receivedPayoutAmount !== ""
      ? parseFloat(formData.receivedPayoutAmount)
      : requestedAmount * (1 - splitPercentage / 100);

    addPayout({
      fundedAccountId: formData.fundedAccountId,
      payoutDate: formData.payoutDate,
      generatedProfit: parseFloat(formData.generatedProfit) || 0,
      requestedPayoutAmount: requestedAmount,
      receivedPayoutAmount: receivedAmount,
      propFirmSplitPercentage: splitPercentage,
      status: "pending",
      notes: formData.notes || undefined,
    });
    onOpenChange(false);
  };

  const set = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Request Payout</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Funded Account */}
          <div className="space-y-2">
            <Label htmlFor="fundedAccountId" className="text-[#8B97A8]">Funded Account</Label>
            <select
              id="fundedAccountId"
              value={formData.fundedAccountId}
              onChange={(e) => set("fundedAccountId", e.target.value)}
              required
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            >
              <option value="">Select an account</option>
              {fundedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName} — {account.propFirmName}
                </option>
              ))}
            </select>
          </div>

          {/* Payout Date */}
          <div className="space-y-2">
            <Label htmlFor="payoutDate" className="text-[#8B97A8]">Payout Date</Label>
            <Input
              id="payoutDate"
              type="date"
              value={formData.payoutDate}
              onChange={(e) => set("payoutDate", e.target.value)}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>

          {/* Generated Profit */}
          <div className="space-y-2">
            <Label htmlFor="generatedProfit" className="text-[#8B97A8]">Generated Profit ($)</Label>
            <Input
              id="generatedProfit"
              type="number"
              step="0.01"
              placeholder="0"
              value={formData.generatedProfit}
              onChange={(e) => set("generatedProfit", e.target.value)}
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>

          {/* Requested Amount */}
          <div className="space-y-2">
            <Label htmlFor="requestedPayoutAmount" className="text-[#8B97A8]">Requested Amount ($)</Label>
            <Input
              id="requestedPayoutAmount"
              type="number"
              step="0.01"
              value={formData.requestedPayoutAmount}
              onChange={(e) => set("requestedPayoutAmount", e.target.value)}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>

          {/* Prop Firm Split */}
          <div className="space-y-2">
            <Label htmlFor="propFirmSplitPercentage" className="text-[#8B97A8]">Prop Firm Split (%)</Label>
            <Input
              id="propFirmSplitPercentage"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.propFirmSplitPercentage}
              onChange={(e) => set("propFirmSplitPercentage", e.target.value)}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>

          {/* Received Amount (optional override) */}
          <div className="space-y-2">
            <Label htmlFor="receivedPayoutAmount" className="text-[#8B97A8]">
              Received Amount ($)
              <span className="text-[#475569] ml-1 text-xs">(optional — auto-calculated from split)</span>
            </Label>
            <Input
              id="receivedPayoutAmount"
              type="number"
              step="0.01"
              placeholder={
                formData.requestedPayoutAmount
                  ? `${(parseFloat(formData.requestedPayoutAmount) * (1 - parseFloat(formData.propFirmSplitPercentage || "0") / 100)).toFixed(2)}`
                  : "Auto"
              }
              value={formData.receivedPayoutAmount}
              onChange={(e) => set("receivedPayoutAmount", e.target.value)}
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-[#8B97A8]">Notes</Label>
            <textarea
              id="notes"
              rows={2}
              placeholder="Optional notes..."
              value={formData.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full bg-[#0D1424] border border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 text-sm focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all resize-none placeholder-[#475569]"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#D8A94A] rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-[#D8A94A] to-[#C4933A] hover:shadow-lg hover:shadow-[#D8A94A]/20 hover:scale-105 transition-all duration-200 text-white rounded-xl"
            >
              Request Payout
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
