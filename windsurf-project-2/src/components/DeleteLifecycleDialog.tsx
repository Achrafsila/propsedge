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

interface DeleteLifecycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  accountName: string;
  propFirmName: string;
  // A 2-step lifecycle spans two DB rows (Step 1 + Step 2) — deleting it
  // removes both, so the wording has to say so up front rather than let a
  // user think they're deleting a single record.
  is2Step: boolean;
}

export function DeleteLifecycleDialog({
  open,
  onOpenChange,
  onConfirm,
  accountName,
  propFirmName,
  is2Step,
}: DeleteLifecycleDialogProps) {
  const title = is2Step ? "Delete complete challenge history?" : "Delete challenge?";
  const description = is2Step
    ? "This will permanently delete both Step 1 and Step 2 records, including their associated trading data. This action cannot be undone."
    : "This will permanently delete this challenge and its associated trading data.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(239,68,68,0.1)" }}
            >
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <DialogTitle className="text-[#F8FAFC]">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-[#94A3B8]">{description}</DialogDescription>
          <p className="text-sm">
            <span className="text-[#F8FAFC] font-medium">{accountName}</span>
            <span className="text-[#64748B]"> · {propFirmName}</span>
          </p>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#2F80ED] rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-xl"
          >
            Delete challenge history
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
