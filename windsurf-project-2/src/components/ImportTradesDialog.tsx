"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/context/AccountsContext";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, X } from "lucide-react";
import { parseTradeFile, ParsedTrade, SkippedRow } from "@/lib/importTrades";

interface ImportTradesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountType?: "challenge" | "funded";
  defaultAccountId?: string;
}

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export function ImportTradesDialog({ open, onOpenChange, defaultAccountType, defaultAccountId }: ImportTradesDialogProps) {
  const { addTrade, challenges, fundedAccounts } = useAccounts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accountType, setAccountType] = useState<"challenge" | "funded">("challenge");
  const [accountId, setAccountId] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[] | null>(null);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);

  // Default to the account selected on the Trade Journal page whenever the
  // dialog opens, so imported trades land on the account being viewed.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAccountType(defaultAccountType ?? "challenge");
      setAccountId(defaultAccountId ?? "");
    }
  }

  const availableAccounts = accountType === "challenge"
    ? challenges.filter((c) => c.status === "active")
    : fundedAccounts.filter((a) => a.status === "active");

  // accountId alone isn't enough — it can be a stale id (e.g. an account
  // deleted after being selected) that no longer matches anything in
  // availableAccounts. Importing against that would create exactly the
  // "linked to missing account" trades Global Analytics has to warn about.
  const isDestinationValid = availableAccounts.some((a) => a.id === accountId);

  const resetState = () => {
    setAccountType("challenge");
    setAccountId("");
    setIsDragActive(false);
    setFileName(null);
    setIsParsing(false);
    setIsImporting(false);
    setParsedTrades(null);
    setSkippedRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const isSupportedFile = (file: File) => {
    const name = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  };

  const processFile = async (file: File) => {
    if (!isSupportedFile(file)) {
      toast.error("Unsupported file type. Please upload a .xlsx, .xls, or .csv file.");
      return;
    }

    setFileName(file.name);
    setParsedTrades(null);
    setSkippedRows([]);
    setIsParsing(true);
    try {
      const { trades, skippedRows: skipped } = await parseTradeFile(file);
      setParsedTrades(trades);
      setSkippedRows(skipped);
      if (trades.length === 0) {
        toast.error("No valid trades found in this file.", {
          description: `${skipped.length} row(s) skipped — see details below`,
        });
      }
    } catch (err) {
      console.error("Failed to parse trade file:", err);
      toast.error(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
      setFileName(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (!parsedTrades || parsedTrades.length === 0 || !isDestinationValid) return;
    setIsImporting(true);
    try {
      // Promise.allSettled so a single failed insert never stops the rest
      // of the batch from being imported.
      const results = await Promise.allSettled(
        parsedTrades.map((trade) =>
          addTrade({
            accountId,
            accountType,
            ...trade,
          })
        )
      );

      const imported = results.filter(
        (r) => r.status === "fulfilled" && r.value !== null
      ).length;
      const failed = results.length - imported;
      const skipped = skippedRows.length;

      if (failed > 0) {
        console.warn(`[ImportTrades] ${failed} trade(s) failed to import`);
      }

      if (imported > 0) {
        toast.success(`${imported} trades imported successfully`, {
          description: `${skipped} skipped, ${failed} failed`,
        });
        handleClose(false);
      } else {
        toast.error("No trades were imported", {
          description: `${skipped} skipped, ${failed} failed`,
        });
      }
    } catch (err) {
      console.error("Failed to import trades:", err);
      toast.error(`Failed to import trades: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const totalPnL = parsedTrades?.reduce((sum, t) => sum + t.pnl, 0) ?? 0;
  const dateRange = parsedTrades && parsedTrades.length > 0
    ? (() => {
        const dates = parsedTrades.map((t) => t.entryDate).filter(Boolean).sort();
        return `${dates[0]} → ${dates[dates.length - 1]}`;
      })()
    : "—";
  const selectedAccountName = availableAccounts.find((a) => a.id === accountId)?.accountName;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Import Trades</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="importAccountType" className="text-[#8B97A8]">Account Type</Label>
              <select
                id="importAccountType"
                value={accountType}
                onChange={(e) => {
                  setAccountType(e.target.value as "challenge" | "funded");
                  setAccountId("");
                }}
                className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
              >
                <option value="challenge">Challenge</option>
                <option value="funded">Funded Account</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="importAccountId" className="text-[#8B97A8]">Destination Account</Label>
              <select
                id="importAccountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
              >
                <option value="">Select an account</option>
                {availableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-all duration-300 ${
              isDragActive
                ? "border-[#2F80ED] bg-[#2F80ED]/10"
                : "border-[#1A2942] bg-[#0D1424] hover:border-[#2F80ED]/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
            {fileName ? (
              <>
                <FileSpreadsheet className="w-8 h-8 text-[#2F80ED]" />
                <p className="text-sm text-[#F8FAFC]">{fileName}</p>
                {isParsing && <p className="text-xs text-[#8B97A8]">Parsing file…</p>}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileName(null);
                    setParsedTrades(null);
                    setSkippedRows([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 text-[#8B97A8] hover:text-[#F8FAFC]"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 text-[#8B97A8]" />
                <p className="text-sm text-[#F8FAFC]">Drag & drop your trade file here</p>
                <p className="text-xs text-[#8B97A8]">or click to browse — .xlsx, .xls, .csv</p>
              </>
            )}
          </div>

          {parsedTrades !== null && (
            <div
              className="rounded-xl p-4 space-y-2 text-sm"
              style={{ background: "rgba(11, 18, 32, 0.5)", border: "1px solid rgba(148, 163, 184, 0.08)" }}
            >
              <div className="flex justify-between">
                <span className="text-[#8B97A8]">Trades detected</span>
                <span className="text-[#F8FAFC] font-medium">{parsedTrades.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B97A8]">Total P&L</span>
                <span className={`font-medium ${totalPnL >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                  {formatCurrency(totalPnL)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B97A8]">Date range</span>
                <span className="text-[#F8FAFC] font-medium">{dateRange}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B97A8]">Destination account</span>
                <span className="text-[#F8FAFC] font-medium">{selectedAccountName ?? "Not selected"}</span>
              </div>
              {skippedRows.length > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#8B97A8]">Skipped rows</span>
                    <span className="text-[#F59E0B] font-medium">{skippedRows.length}</span>
                  </div>
                  <ul className="text-xs text-[#8B97A8] space-y-0.5 pl-3 list-disc">
                    {skippedRows.map((s) => (
                      <li key={s.rowNumber}>
                        Row {s.rowNumber}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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
          <Button
            type="button"
            disabled={!parsedTrades || parsedTrades.length === 0 || !isDestinationValid || isImporting}
            onClick={handleImport}
            className="bg-gradient-to-r from-[#2F80ED] to-[#1E6BC7] hover:shadow-lg hover:shadow-[#2F80ED]/20 hover:scale-105 transition-all duration-200 text-white rounded-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            Import Trades
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
