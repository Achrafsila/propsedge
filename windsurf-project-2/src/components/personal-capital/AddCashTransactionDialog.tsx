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
import { usePersonalPortfolio, CashTransactionType } from "@/context/PersonalPortfolioContext";

interface AddCashTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: CashTransactionType;
}

const emptyForm = () => ({
  amount: "",
  date: new Date().toISOString().split("T")[0],
  note: "",
});

// One dialog handles both deposit and withdrawal — the `type` prop picks
// which context action fires and how the form is labeled.
export function AddCashTransactionDialog({ open, onOpenChange, type }: AddCashTransactionDialogProps) {
  const { addDeposit, addWithdrawal } = usePersonalPortfolio();
  const [formData, setFormData] = useState(emptyForm());
  const isDeposit = type === "deposit";

  useEffect(() => {
    if (open) setFormData(emptyForm());
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const action = isDeposit ? addDeposit : addWithdrawal;
    action(amount, formData.date, formData.note.trim() || undefined);
    onOpenChange(false);
  };

  const set = (key: keyof ReturnType<typeof emptyForm>, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">{isDeposit ? "Add Deposit" : "Add Withdrawal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-[#8B97A8]">Amount</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date" className="text-[#8B97A8]">Date</Label>
            <Input
              id="date"
              type="date"
              required
              value={formData.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note" className="text-[#8B97A8]">Note (optional)</Label>
            <Input
              id="note"
              type="text"
              value={formData.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className={isDeposit
                ? "bg-[#10B981] hover:bg-[#0EA271] text-white"
                : "bg-[#14B8A6] hover:bg-[#0F9C8C] text-white"
              }
            >
              {isDeposit ? "Add Deposit" : "Add Withdrawal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
