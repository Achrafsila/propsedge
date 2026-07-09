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
import { Upload, Clock } from "lucide-react";
import { AccountKind, getAccountOptionLabel } from "@/lib/accountLabels";
import { Challenge, FundedAccount, PersonalAccount } from "@/types";

interface AddTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountType?: AccountKind;
  defaultAccountId?: string;
}

export function AddTradeDialog({ open, onOpenChange, defaultAccountType, defaultAccountId }: AddTradeDialogProps) {
  const { addTrade, challenges, fundedAccounts, personalAccounts } = useAccounts();
  const [formData, setFormData] = useState({
    accountId: "",
    accountType: "challenge" as AccountKind,
    entryDate: new Date().toISOString().split('T')[0],
    entryTime: "",
    exitTime: "",
    session: "" as "London" | "New York" | "Asian" | "",
    symbol: "",
    pnl: "",
    notes: "",
    picture: null as File | null,
  });

  // Default to the account selected on the Trade Journal page whenever the
  // dialog opens, so a manually added trade lands on the account the user
  // is currently viewing.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFormData((prev) => ({
        ...prev,
        accountType: defaultAccountType ?? prev.accountType,
        accountId: defaultAccountId ?? "",
      }));
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pnl = parseFloat(formData.pnl);
    const status: "win" | "loss" | "breakeven" = pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";

    // Convert picture to base64 if provided
    let pictureUrl: string | undefined;
    if (formData.picture) {
      const reader = new FileReader();
      reader.readAsDataURL(formData.picture);
      reader.onload = () => {
        pictureUrl = reader.result as string;
        addTradeWithPicture(pnl, status, pictureUrl);
      };
      return;
    }

    addTradeWithPicture(pnl, status, pictureUrl);
  };

  const addTradeWithPicture = (pnl: number, status: "win" | "loss" | "breakeven", pictureUrl?: string) => {
    addTrade({
      accountId: formData.accountId,
      accountType: formData.accountType,
      entryDate: formData.entryDate,
      exitDate: formData.entryDate,
      entryTime: formData.entryTime || undefined,
      exitTime: formData.exitTime || undefined,
      session: formData.session || undefined,
      symbol: formData.symbol,
      direction: "long",
      entryPrice: 0,
      exitPrice: 0,
      quantity: 0,
      pnl,
      status,
      notes: formData.notes || undefined,
      picture: pictureUrl,
    });
    onOpenChange(false);
    setFormData({
      accountId: "",
      accountType: "challenge" as AccountKind,
      entryDate: new Date().toISOString().split('T')[0],
      entryTime: "",
      exitTime: "",
      session: "",
      symbol: "",
      pnl: "",
      notes: "",
      picture: null,
    });
  };

  const availableAccounts: (Challenge | FundedAccount | PersonalAccount)[] =
    formData.accountType === "challenge"
      ? challenges.filter((c) => c.status === "active")
      : formData.accountType === "funded"
        ? fundedAccounts.filter((a) => a.status === "active")
        : personalAccounts.filter((p) => p.status === "active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Add New Trade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountType" className="text-[#8B97A8]">Account Type</Label>
            <select
              id="accountType"
              value={formData.accountType}
              onChange={(e) => setFormData({ ...formData, accountType: e.target.value as AccountKind, accountId: "" })}
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            >
              <option value="challenge">Challenge</option>
              <option value="funded">Funded Account</option>
              <option value="personal">Personal Account</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountId" className="text-[#8B97A8]">Account</Label>
            <select
              id="accountId"
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              required
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            >
              <option value="">Select an account</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {getAccountOptionLabel(account, formData.accountType)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entryDate" className="text-[#8B97A8]">Date</Label>
            <Input
              id="entryDate"
              type="date"
              value={formData.entryDate}
              onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entryTime" className="text-[#8B97A8]">Entry Time</Label>
              <Input
                id="entryTime"
                type="time"
                value={formData.entryTime}
                onChange={(e) => setFormData({ ...formData, entryTime: e.target.value })}
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exitTime" className="text-[#8B97A8]">Exit Time</Label>
              <Input
                id="exitTime"
                type="time"
                value={formData.exitTime}
                onChange={(e) => setFormData({ ...formData, exitTime: e.target.value })}
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session" className="text-[#8B97A8]">Trading Session</Label>
            <select
              id="session"
              value={formData.session}
              onChange={(e) => setFormData({ ...formData, session: e.target.value as "London" | "New York" | "Asian" | "" })}
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            >
              <option value="">Select session</option>
              <option value="London">London</option>
              <option value="New York">New York</option>
              <option value="Asian">Asian</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="symbol" className="text-[#8B97A8]">Symbol / Index</Label>
            <Input
              id="symbol"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
              required
              placeholder="e.g., ES, NQ, CL"
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pnl" className="text-[#8B97A8]">P&L ($)</Label>
            <Input
              id="pnl"
              type="number"
              step="0.01"
              value={formData.pnl}
              onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
              required
              placeholder="e.g., 150.50 or -75.00"
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="picture" className="text-[#8B97A8]">Trade Screenshot (Optional)</Label>
            <div className="relative">
              <Input
                id="picture"
                type="file"
                accept="image/*"
                onChange={(e) => setFormData({ ...formData, picture: e.target.files?.[0] || null })}
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#2F80ED] file:text-white hover:file:bg-[#1E6BC7]"
              />
              <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B97A8] pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-[#8B97A8]">Notes (Optional)</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Trade notes..."
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#2F80ED] rounded-xl">
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-to-r from-[#2F80ED] to-[#1E6BC7] hover:shadow-lg hover:shadow-[#2F80ED]/20 hover:scale-105 transition-all duration-200 text-white rounded-xl">
              Add Trade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
