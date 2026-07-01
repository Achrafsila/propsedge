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

export interface SkippedRow {
  // 1-based row number as it appears in the spreadsheet (header row is row 1).
  rowNumber: number;
  reason: string;
}

export interface ParsedTradeFile {
  trades: ParsedTrade[];
  skippedRows: SkippedRow[];
}

// Columns required in the imported Symbol/Type/.../Profit spreadsheet.
// TP, SL and Commission are optional and must never cause a row to be skipped.
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

function devWarn(message: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[importTrades] ${message}`);
  }
}

// Parses numbers that may use dot or comma decimals, thousands separators,
// currency symbols, parenthesized negatives (e.g. "(123.45)"), or be blank.
// Returns null (not NaN) when the value truly cannot be parsed, so callers
// can tell "no value" apart from "0".
function parseAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }
  if (typeof value !== "string") return null;

  let str = value.trim();
  if (str === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(str)) {
    negative = true;
    str = str.slice(1, -1).trim();
  }

  // Strip currency symbols, spaces and any other non-numeric characters.
  str = str.replace(/[^0-9.,+-]/g, "");
  if (str === "") return null;
  if (str.startsWith("-")) negative = true;
  str = str.replace(/[+-]/g, "");

  const hasComma = str.includes(",");
  const hasDot = str.includes(".");

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Comma is the decimal separator (e.g. "1.234,56"); dots are thousands.
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Dot is the decimal separator (e.g. "1,234.56"); commas are thousands.
      str = str.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = str.split(",");
    const lastPart = parts[parts.length - 1];
    if (parts.length === 2 && lastPart.length !== 3) {
      // Single comma with a non-3-digit tail is a decimal separator (e.g. "12,5").
      str = parts.join(".");
    } else {
      // Thousands separators (e.g. "1,234" or "1,234,567").
      str = parts.join("");
    }
  } else if (hasDot) {
    const parts = str.split(".");
    if (parts.length > 2) {
      // Multiple dots => European-style thousands separators (e.g. "1.234.567").
      str = parts.join("");
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) return null;
  return negative ? -Math.abs(num) : num;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject dates that overflowed (e.g. Feb 30 -> Mar 2).
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Handles Excel serial numbers, JS Date objects (from cellDates), ISO strings,
// and the common broker export formats: YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
// and DD.MM.YYYY / DD/MM/YYYY / MM/DD/YYYY (with an optional time suffix).
function toDateString(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const iso = toIsoDate(parsed.y, parsed.m, parsed.d);
      if (iso) return iso;
    }
    return "";
  }

  if (typeof value !== "string" || !value.trim()) return "";

  const trimmed = value.trim();
  const datePart = trimmed.split(/[T\s]/)[0];

  // YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
  let m = datePart.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) {
    const iso = toIsoDate(+m[1], +m[2], +m[3]);
    if (iso) return iso;
  }

  // DD-MM-YYYY / DD.MM.YYYY / DD/MM/YYYY / MM/DD/YYYY
  m = datePart.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (m) {
    const year = +m[3];
    const first = +m[1];
    const second = +m[2];
    // Disambiguate day/month order: if only one of them can be a valid month,
    // that one is the month. Otherwise default to day-first (common in
    // broker/MT4-style exports).
    let day: number;
    let month: number;
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    } else {
      day = first;
      month = second;
    }
    const iso = toIsoDate(year, month, day);
    if (iso) return iso;
  }

  // Fallback to native parsing for anything else (ISO datetimes, RFC 2822, etc).
  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) {
    return `${native.getUTCFullYear()}-${pad(native.getUTCMonth() + 1)}-${pad(native.getUTCDate())}`;
  }

  return "";
}

export async function parseTradeFile(file: File): Promise<ParsedTradeFile> {
  // raw: true stops xlsx's CSV parser from guessing cell types itself — its
  // built-in numeric sniffer strips commas as thousands separators before our
  // own parseAmount() ever runs, silently corrupting decimal-comma values
  // (e.g. "-543,21" becomes -54321). With raw:true, CSV cells stay untouched
  // strings, while real .xlsx/.xls binary cells (already numbers/Dates in the
  // file format) and cellDates are unaffected.
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The file has no sheets");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
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
  const skippedRows: SkippedRow[] = [];

  rows.forEach((row, index) => {
    // Row 1 is the header, so the first data row is row 2.
    const rowNumber = index + 2;

    const symbol = String(findValue(row, ["Symbol"]) ?? "").trim();
    const typeValue = String(findValue(row, ["Type"]) ?? "")
      .trim()
      .toLowerCase();
    const profitRaw = findValue(row, ["Profit"]);
    const tp = findValue(row, ["TP"]);
    const sl = findValue(row, ["SL"]);
    const commission = findValue(row, ["Commission"]);

    const isBlankRow =
      !symbol &&
      !typeValue &&
      (profitRaw === "" || profitRaw === undefined) &&
      !findValue(row, ["Open Date"]) &&
      !findValue(row, ["Closed Date"]);
    if (isBlankRow) {
      // Fully empty row (e.g. trailing blank line) — not a real trade, not counted as skipped.
      return;
    }

    if (!symbol) {
      skippedRows.push({ rowNumber, reason: "Missing Symbol" });
      devWarn(`Row ${rowNumber} skipped: missing Symbol`);
      return;
    }

    // Profit is the source of truth for pnl — never derived from entry/exit prices.
    const pnl = parseAmount(profitRaw);
    if (pnl === null) {
      const reason =
        profitRaw === "" || profitRaw === undefined
          ? "Missing Profit value"
          : `Invalid Profit value: "${profitRaw}"`;
      skippedRows.push({ rowNumber, reason });
      devWarn(`Row ${rowNumber} skipped: ${reason}`);
      return;
    }

    const entryDate = toDateString(findValue(row, ["Open Date"]));
    if (!entryDate) {
      skippedRows.push({ rowNumber, reason: "Invalid or missing Open Date" });
      devWarn(`Row ${rowNumber} skipped: invalid or missing Open Date`);
      return;
    }

    const exitDate = toDateString(findValue(row, ["Closed Date"]));
    const entryPrice = parseAmount(findValue(row, ["Open"]));
    const exitPrice = parseAmount(findValue(row, ["Closed"]));
    const quantity = parseAmount(findValue(row, ["Lots"]));

    const direction: "long" | "short" = typeValue === "sell" ? "short" : "long";
    const status: TradeStatus = pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";

    // TP/SL/Commission have no dedicated Trade fields, so they're preserved as
    // notes. Commission is informational only and is never subtracted from
    // pnl — the Profit column already reflects the net result.
    const notesParts: string[] = [];
    if (tp !== undefined && tp !== "") notesParts.push(`TP: ${tp}`);
    if (sl !== undefined && sl !== "") notesParts.push(`SL: ${sl}`);
    if (commission !== undefined && commission !== "") {
      const commissionValue = parseAmount(commission);
      if (commissionValue !== null && commissionValue !== 0) {
        notesParts.push(`Commission: ${commission}`);
      }
    }

    trades.push({
      symbol: symbol.toUpperCase(),
      direction,
      entryDate,
      exitDate: exitDate || entryDate,
      entryPrice: entryPrice ?? 0,
      exitPrice: exitPrice ?? 0,
      quantity: quantity ?? 0,
      pnl,
      status,
      notes: notesParts.length > 0 ? notesParts.join(" | ") : undefined,
    });
  });

  return { trades, skippedRows };
}
