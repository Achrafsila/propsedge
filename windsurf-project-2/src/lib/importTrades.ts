import * as XLSX from "xlsx";
import { TradeStatus } from "@/types";

export interface ParsedTrade {
  symbol: string;
  direction: "long" | "short";
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  status: TradeStatus;
  notes?: string;
}

export interface ParsedTradeFile {
  trades: ParsedTrade[];
  skippedRows: number;
}

// Columns required in the imported Symbol/Type/.../Profit spreadsheet.
const REQUIRED_COLUMNS = [
  "Symbol",
  "Type",
  "Open Date",
  "Open",
  "Closed Date",
  "Closed",
  "Lots",
  "Profit",
];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_]+/g, "");
}

function findValue(row: Record<string, unknown>, names: string[]): unknown {
  const targets = names.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    if (targets.includes(normalizeHeader(key))) {
      return row[key];
    }
  }
  return undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,$\s]/g, "");
    if (cleaned === "") return NaN;
    return parseFloat(cleaned);
  }
  return NaN;
}

// Excel/CSV dates can arrive as JS Date objects (xlsx with cellDates), raw
// serial numbers (uncommon for CSV), or plain text — normalize all to YYYY-MM-DD.
function toDateString(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return d.toISOString().split("T")[0];
    }
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.split("T")[0];
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  }
  return "";
}

export async function parseTradeFile(file: File): Promise<ParsedTradeFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The file has no sheets");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (rows.length === 0) {
    throw new Error("No rows found in file");
  }

  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_COLUMNS.filter(
    (col) => !headers.some((h) => normalizeHeader(h) === normalizeHeader(col))
  );
  if (missing.length > 0) {
    throw new Error(`Missing required column(s): ${missing.join(", ")}`);
  }

  const trades: ParsedTrade[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const symbol = String(findValue(row, ["Symbol"]) ?? "").trim();
    const typeValue = String(findValue(row, ["Type"]) ?? "")
      .trim()
      .toLowerCase();
    const profitRaw = findValue(row, ["Profit"]);
    const tp = findValue(row, ["TP"]);
    const sl = findValue(row, ["SL"]);
    const commission = findValue(row, ["Commission"]);

    // Skip fully empty rows
    if (!symbol && !typeValue && (profitRaw === "" || profitRaw === undefined)) {
      continue;
    }

    const pnl = toNumber(profitRaw);
    const entryPrice = toNumber(findValue(row, ["Open"]));
    const exitPrice = toNumber(findValue(row, ["Closed"]));
    const quantity = toNumber(findValue(row, ["Lots"]));
    const entryDate = toDateString(findValue(row, ["Open Date"]));
    const exitDate = toDateString(findValue(row, ["Closed Date"]));

    if (!symbol || isNaN(pnl) || !entryDate) {
      skippedRows++;
      continue;
    }

    const direction: "long" | "short" = typeValue === "sell" ? "short" : "long";
    const status: TradeStatus = pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";

    const notesParts: string[] = [];
    if (tp !== undefined && tp !== "") notesParts.push(`TP: ${tp}`);
    if (sl !== undefined && sl !== "") notesParts.push(`SL: ${sl}`);
    if (commission !== undefined && commission !== "" && toNumber(commission) !== 0) {
      notesParts.push(`Commission: ${commission}`);
    }

    trades.push({
      symbol: symbol.toUpperCase(),
      direction,
      entryDate,
      exitDate: exitDate || entryDate,
      entryPrice: isNaN(entryPrice) ? 0 : entryPrice,
      exitPrice: isNaN(exitPrice) ? 0 : exitPrice,
      quantity: isNaN(quantity) ? 0 : quantity,
      pnl,
      status,
      notes: notesParts.length > 0 ? notesParts.join(" | ") : undefined,
    });
  }

  return { trades, skippedRows };
}
