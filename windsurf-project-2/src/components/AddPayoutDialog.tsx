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

interface AddPayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPayoutDialog({ open, onOpenChange }: AddPayoutDialogProps) {
  const { addPayout, fundedAccounts } = useAccounts();
  const [formData, setFormData] = useState({
    fundedAccountId: "",
    payoutDate: new Date().toISOString().split('T')[0],
    generatedProfit: "",
    requestedPayoutAmount: "",
    propFirmSplitPercentage: "10",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const requestedAmount = parseFloat(formData.requestedPayoutAmount);
    const splitPercentage = parseFloat(formData.propFirmSplitPercentage);
    const receivedAmount = requestedAmount * (1 - splitPercentage / 100);
    
    addPayout({
      fundedAccountId: formData.fundedAccountId,
      payoutDate: formData.payoutDate,
      generatedProfit: parseFloat(formData.generatedProfit),
      requestedPayoutAmount: requestedAmount,
      receivedPayoutAmount: receivedAmount,
      propFirmSplitPercentage: splitPercentage,
      status: "pending",
    });
    onOpenChange(false);
    setFormData({
      fundedAccountId: "",
      payoutDate: new Date().toISOString().split('T')[0],
      generatedProfit: "",
      requestedPayoutAmount: "",
      propFirmSplitPercentage: "10",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Request Payout</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fundedAccountId" className="text-[#8B97A8]">Funded Account</Label>
            <select
              id="fundedAccountId"
              value={formData.fundedAccountId}
              onChange={(e) => setFormData({ ...formData, fundedAccountId: e.target.value })}
              required
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            >
              <option value="">Select an account</option>
              {fundedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName} - {account.propFirmName} ({account.currentBalance})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="generatedProfit" className="text-[#8B97A8]">Generated Profit ($)</Label>
            <Input
              id="generatedProfit"
              type="number"
              value={formData.generatedProfit}
              onChange={(e) => setFormData({ ...formData, generatedProfit: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requestedPayoutAmount" className="text-[#8B97A8]">Requested Payout Amount ($)</Label>
            <Input
              id="requestedPayoutAmount"
              type="number"
              value={formData.requestedPayoutAmount}
              onChange={(e) => setFormData({ ...formData, requestedPayoutAmount: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="propFirmSplitPercentage" className="text-[#8B97A8]">Prop Firm Split (%)</Label>
            <Input
              id="propFirmSplitPercentage"
              type="number"
              step="0.1"
              value={formData.propFirmSplitPercentage}
              onChange={(e) => setFormData({ ...formData, propFirmSplitPercentage: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payoutDate" className="text-[#8B97A8]">Payout Date</Label>
            <Input
              id="payoutDate"
              type="date"
              value={formData.payoutDate}
              onChange={(e) => setFormData({ ...formData, payoutDate: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#D8A94A] focus:outline-none focus:ring-2 focus:ring-[#D8A94A]/20 transition-all"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#D8A94A] rounded-xl">
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-to-r from-[#D8A94A] to-[#C4933A] hover:shadow-lg hover:shadow-[#D8A94A]/20 hover:scale-105 transition-all duration-200 text-white rounded-xl">
              Request Payout
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
