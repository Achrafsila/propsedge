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
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md">
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
                  {getAccountOptionLabel(challenge, true)}
                </option>
              ))}
            </select>
          </div>
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
          <DialogFooter>
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
