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
import { useTradingMode } from "@/context/TradingModeContext";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, X } from "lucide-react";
import { parseTradeFile, ParsedTrade, SkippedRow } from "@/lib/importTrades";
import Link from "next/link";
import {
  AccountKind,
  ACCOUNT_STATUS_BADGE_COLOR,
  getAccountOptionLabel,
  getAccountStartDateLabel,
  getAccountStatusLabel,
  getSelectableAccounts,
} from "@/lib/accountLabels";

interface ImportTradesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountType?: AccountKind;
  defaultAccountId?: string;
}

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".jpg", ".jpeg", ".png", ".webp"];

export function ImportTradesDialog({ open, onOpenChange, defaultAccountType, defaultAccountId }: ImportTradesDialogProps) {
  const { addTradesBatch, challenges, fundedAccounts, personalAccounts } = useAccounts();
  const { tradingMode } = useTradingMode();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accountType, setAccountType] = useState<AccountKind>("challenge");
  const [accountId, setAccountId] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImageImport, setIsImageImport] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[] | null>(null);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);

  // Default to the account selected on the Trade Journal page whenever the
  // dialog opens, so imported trades land on the account being viewed.
  // Callers that don't pass defaultAccountType fall back to a
  // Trading-Mode-appropriate default, never hardcoded to "challenge" —
  // Personal Capital mode must never default to Challenge/Funded.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAccountType(defaultAccountType ?? (tradingMode === "personal-capital" ? "personal" : "challenge"));
      setAccountId(defaultAccountId ?? "");
    }
  }

  // Trade history is still valid data even after a challenge fails — a
  // trader backfilling/auditing a failed lifecycle needs to be able to
  // import into it too, not just active accounts. Funded accounts have no
  // "failed" status (active/breached/closed), so that side is unchanged.
  // Personal Accounts have no such lifecycle either — only active ones are
  // valid import destinations.
  const availableAccounts = getSelectableAccounts(accountType, tradingMode, {
    challenges,
    fundedAccounts,
    personalAccounts,
  }).filter((a) => a.status === "active" || a.status === "failed");

  // accountId alone isn't enough — it can be a stale id (e.g. an account
  // deleted after being selected) that no longer matches anything in
  // availableAccounts. Importing against that would create exactly the
  // "linked to missing account" trades Global Analytics has to warn about.
  const isDestinationValid = availableAccounts.some((a) => a.id === accountId);

  const resetState = () => {
    setAccountType(tradingMode === "personal-capital" ? "personal" : "challenge");
    setAccountId("");
    setIsDragActive(false);
    setFileName(null);
    setIsImageImport(false);
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

  const processFiles = async (files: File[]) => {
    if (!files.length) return;
    const image = files.every(f=>/\.(jpg|jpeg|png|webp)$/i.test(f.name));
    if (files.some(f=>!isSupportedFile(f)) || (!image && files.length!==1) || files.length>4) {
      toast.error("Choose one Excel/CSV file or up to 4 trade screenshots.");
      return;
    }

    setFileName(files.length===1?files[0].name:`${files.length} screenshots selected`);
    setIsImageImport(image);
    setParsedTrades(null);
    setSkippedRows([]);
    setIsParsing(true);
    try {
      let trades: ParsedTrade[], skipped: SkippedRow[];
      if(image){
        const payload = new FormData();
        files.forEach(file=>payload.append("file",file));
        const response=await fetch("/api/import-trades-image",{method:"POST",body:payload});
        const data=await response.json();
        if(!response.ok) throw new Error(data.error || "Image recognition failed");
        trades=data.trades as ParsedTrade[];
        skipped=[];
        if(data.duplicatesRemoved>0) toast.info(`${data.duplicatesRemoved} overlapping rows removed`);
        if(Array.isArray(data.warnings)&&data.warnings.length) toast.warning("Review image recognition", {description:data.warnings.slice(0,2).join(" · ")});
      } else ({ trades, skippedRows: skipped } = await parseTradeFile(files[0]));
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
    const files = Array.from(e.dataTransfer.files ?? []);
    void processFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    void processFiles(files);
  };

  const handleImport = async () => {
    if (!parsedTrades || parsedTrades.length === 0 || !isDestinationValid) return;
    setIsImporting(true);
    try {
      // A single chunked bulk insert (see addTradesBatch) instead of one
      // request per row — firing hundreds/thousands of concurrent
      // single-row inserts used to exhaust Supabase's connection pool
      // after roughly the first 100, silently failing the rest.
      const tradesToImport = parsedTrades.map((trade) => ({ accountId, accountType, ...trade }));
      const { imported, failed, errors } = await addTradesBatch(tradesToImport);

      const importedCount = imported.length;
      const skipped = skippedRows.length;

      if (errors.length > 0) {
        console.warn(`[ImportTrades] ${errors.length} batch(es) failed to import:`, errors);
      }

      if (importedCount > 0) {
        toast.success(`${importedCount} trades imported successfully`, {
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
  const selectedAccount = availableAccounts.find((a) => a.id === accountId);
  const selectedAccountName = selectedAccount?.accountName;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] w-[calc(100vw-1rem)] max-w-lg max-h-[calc(100dvh-1.5rem)] grid grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden p-4">
        <DialogHeader className="min-w-0 pr-9">
          <DialogTitle className="text-[#F8FAFC]">Import Trades</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain space-y-4 pb-5 pr-1 [-webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="importAccountType" className="text-[#8B97A8]">Account Type</Label>
              <select
                id="importAccountType"
                value={accountType}
                onChange={(e) => {
                  setAccountType(e.target.value as AccountKind);
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
              {tradingMode === "personal-capital" && personalAccounts.length === 0 ? (
                <div className="w-full bg-[#0D1424] border border-[#1A2942] rounded-lg px-3 py-2 text-sm text-[#8B97A8]">
                  No personal account found.{" "}
                  <Link href="/portfolio" className="text-[#2F80ED] hover:underline">Create one from Portfolio.</Link>
                </div>
              ) : (
                <select
                  id="importAccountId"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
                >
                  <option value="">Select an account</option>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {getAccountOptionLabel(account, accountType)}
                    </option>
                  ))}
                </select>
              )}
              {isDestinationValid && selectedAccount && (() => {
                const status = getAccountStatusLabel(selectedAccount, accountType);
                const color = ACCOUNT_STATUS_BADGE_COLOR[status] ?? "#94A3B8";
                return (
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
                    >
                      {status}
                    </span>
                    <span className="text-[#64748B] text-xs">
                      Start: {getAccountStartDateLabel(selectedAccount, accountType)}
                    </span>
                  </div>
                );
              })()}
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
              multiple
              accept=".xlsx,.xls,.csv,image/jpeg,image/png,image/webp"
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
                    setIsImageImport(false);
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
                <p className="text-xs text-[#8B97A8]">Choose one Excel/CSV file or up to 4 screenshots of the same trade list</p>
              </>
            )}
          </div>

          {parsedTrades !== null && <p className="text-xs leading-relaxed text-amber-200">Review recognised trades, prices, dates and P&L carefully before importing. Screenshots may be misread; incomplete rows are not imported.</p>}
          {parsedTrades !== null && (
            <div
              className="rounded-xl p-4 space-y-2 text-sm"
              style={{ background: "rgba(11, 18, 32, 0.5)", border: "1px solid rgba(148, 163, 184, 0.08)" }}
            >
              {isImageImport && (
                <div className="max-h-52 overflow-y-auto rounded-lg border border-white/10">
                  <div className="sticky top-0 bg-[#111C33] px-3 py-2 text-xs font-semibold text-white">Image recognition · trade preview</div>
                  {parsedTrades.map((t,i)=><div key={i} className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2 text-xs text-[#C6D5E5]">
                    <span>{t.symbol} · {t.direction} · {t.entryDate}</span>
                    <span className={t.pnl>=0?"text-emerald-300":"text-red-300"}>{formatCurrency(t.pnl)}</span>
                  </div>)}
                </div>
              )}
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

        <DialogFooter className="relative z-10 shrink-0 !bg-[#101A2B] !border-[#1A2942] pb-[max(1rem,env(safe-area-inset-bottom))]">
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
