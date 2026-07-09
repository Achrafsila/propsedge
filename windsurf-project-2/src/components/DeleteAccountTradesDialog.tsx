"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteAccountTradesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
  accountLabel: string;
}

export function DeleteAccountTradesDialog({ open, onOpenChange, onConfirm, isDeleting, accountLabel }: DeleteAccountTradesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(239,68,68,0.1)" }}
            >
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <DialogTitle className="text-[#F8FAFC]">Delete all trades on this account?</DialogTitle>
          </div>
          <DialogDescription className="text-[#94A3B8]">
            This permanently deletes every trade on <span className="text-[#F8FAFC] font-medium">{accountLabel}</span> only — trades on your
            other accounts are not affected. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#2F80ED] rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-xl disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete Trades"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
