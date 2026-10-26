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
import { motion } from "framer-motion";
import { getAccountOptionLabel } from "@/lib/accountLabels";

interface AddFundedAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFundedAccountDialog({ open, onOpenChange }: AddFundedAccountDialogProps) {
  const { addFundedAccount, challenges } = useAccounts();
  const [formData, setFormData] = useState({
    propFirmName: "",
    accountName: "",
    sourceChallengeId: "",
    accountSize: "",
    fundingDate: new Date().toISOString().split('T')[0],
    initialBalance: "",
    maxDrawdown: "",
    purchaseCost: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const accountSize = parseFloat(formData.accountSize);
    const initialBalance = parseFloat(formData.initialBalance);
    addFundedAccount({
      propFirmName: formData.propFirmName,
      accountName: formData.accountName,
      sourceChallengeId: formData.sourceChallengeId || undefined,
      accountSize: accountSize,
      fundingDate: formData.fundingDate,
      initialBalance: initialBalance,
      currentBalance: initialBalance,
      currentProfit: 0,
      maxDrawdown: parseFloat(formData.maxDrawdown),
      remainingDrawdown: parseFloat(formData.maxDrawdown),
      status: "active",
      purchaseCost: formData.sourceChallengeId || formData.purchaseCost.trim() === "" ? undefined : Number(formData.purchaseCost),
      // This form doesn't collect an origin — a linked source challenge
      // means it really did come from an evaluation; otherwise it's a
      // manually-entered account with no more specific origin to record.
      fundingPath: formData.sourceChallengeId ? "evaluation" : "internal",
      payoutRules: { consistency: { required: false }, minimumTradingDays: { required: false } },
    });
    onOpenChange(false);
    setFormData({
      propFirmName: "",
      accountName: "",
      sourceChallengeId: "",
      accountSize: "",
      fundingDate: new Date().toISOString().split('T')[0],
      initialBalance: "",
      maxDrawdown: "",
      purchaseCost: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain [scrollbar-width:thin] sm:max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Add Funded Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="propFirmName" className="text-[#8B97A8]">Prop Firm Name</Label>
            <Input
              id="propFirmName"
              value={formData.propFirmName}
              onChange={(e) => setFormData({ ...formData, propFirmName: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#00C875] focus:outline-none focus:ring-2 focus:ring-[#00C875]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountName" className="text-[#8B97A8]">Account Name</Label>
            <Input
              id="accountName"
              value={formData.accountName}
              onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#00C875] focus:outline-none focus:ring-2 focus:ring-[#00C875]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourceChallengeId" className="text-[#8B97A8]">Source Challenge (Optional)</Label>
            <select
              id="sourceChallengeId"
              value={formData.sourceChallengeId}
              onChange={(e) => setFormData({ ...formData, sourceChallengeId: e.target.value })}
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#00C875] focus:outline-none focus:ring-2 focus:ring-[#00C875]/20 transition-all"
            >
              <option value="">None (Manual Entry)</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {getAccountOptionLabel(challenge, "challenge")}
                </option>
              ))}
            </select>
          </div>
          {!formData.sourceChallengeId && (
            <div className="space-y-2">
              <Label htmlFor="purchaseCost" className="text-[#8B97A8]">Account Purchase Cost ($) (Optional)</Label>
              <Input id="purchaseCost" type="number" min="0" step="0.01" inputMode="decimal"
                value={formData.purchaseCost}
                onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                placeholder="e.g., 249.00 (leave blank if free)"
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#00C875]" />
              <p className="text-xs text-[#8B97A8]">For directly funded accounts. If converted from a challenge, the original challenge cost is tracked separately.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="accountSize" className="text-[#8B97A8]">Account Size ($)</Label>
            <Input
              id="accountSize"
              type="number"
              value={formData.accountSize}
              onChange={(e) => setFormData({ ...formData, accountSize: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#00C875] focus:outline-none focus:ring-2 focus:ring-[#00C875]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initialBalance" className="text-[#8B97A8]">Initial Balance ($)</Label>
            <Input
              id="initialBalance"
              type="number"
              value={formData.initialBalance}
              onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#00C875] focus:outline-none focus:ring-2 focus:ring-[#00C875]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxDrawdown" className="text-[#8B97A8]">Max Drawdown (%)</Label>
            <Input
              id="maxDrawdown"
              type="number"
              step="0.1"
              value={formData.maxDrawdown}
              onChange={(e) => setFormData({ ...formData, maxDrawdown: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#00C875] focus:outline-none focus:ring-2 focus:ring-[#00C875]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fundingDate" className="text-[#8B97A8]">Funding Date</Label>
            <Input
              id="fundingDate"
              type="date"
              value={formData.fundingDate}
              onChange={(e) => setFormData({ ...formData, fundingDate: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#00C875] focus:outline-none focus:ring-2 focus:ring-[#00C875]/20 transition-all"
            />
          </div>
          <DialogFooter className="sticky bottom-0 z-10 !mx-[-1rem] !mb-[-1rem] border-t border-[#1A2942] bg-[#080D1B] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#00C875] rounded-xl">
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-to-r from-[#00C875] to-[#00A85F] hover:shadow-lg hover:shadow-[#00C875]/20 hover:scale-105 transition-all duration-200 text-white rounded-xl">
              Add Funded Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
