import * as XLSX from "xlsx";
import { Trade, TradeStatus } from "@/types";

export interface ParsedTrade {
  symbol: string;
  direction: "long" | "short";
  entryDate: string;
  exitDate: string;
  entryTime?: string;
  exitTime?: string;
  session?: Trade["session"];
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  status: TradeStatus;
  notes?: string;
  // Present when the source file carried them (TP/SL/Commission/Swap for
  // the legacy format, stop_loss/take_profit/commission/swap for the UTC
  // broker format) — both parsers populate the same fields here so
  // downstream code never has to know which format a trade came from.
  // Trade/Supabase have no dedicated columns for these yet, so they're
  // also folded into `notes` below for now, same as before this format
  // was added.
  stopLoss?: number;
  takeProfit?: number;
  commission?: number;
  swap?: number;
  // UTC broker format only: the broker's own trade/ticket id and its
  // close reason, carried through as metadata for possible future use.
  externalTradeId?: string;
  closeReason?: string;
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

type Row = Record<string, unknown>;

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

const UNKNOWN_FORMAT_ERROR =
  "Some columns could not be detected. Manual column mapping will be added in a later version.";

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_]+/g, "");
}

function findValue(row: Row, names: string[]): unknown {
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

// Temporary diagnostic for the entry_time/session-persisted-as-null bug —
// safe to remove once import is confirmed fixed in production.
function devLogDateSplit(rowNumber: number, openDateRaw: unknown, entryDate: string, entryTime: string, session: string | undefined): void {
  if (process.env.NODE_ENV === "production") return;
  console.log(
    `[importTrades] Row ${rowNumber} date split — raw Open Date: ${JSON.stringify(openDateRaw)}, entryDate: "${entryDate}", entryTime: "${entryTime}", session: ${session ?? "(none)"}`
  );
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
  // "+" collapses runs of whitespace (double space, tab, etc. between the
  // date and time) into a single split point — without it, a value like
  // "02/07/2026  01:37" (two spaces) produces an empty string in the middle
  // of the split, which only breaks the time half (see toTimeString below);
  // the date half is unaffected since it's always index 0.
  const datePart = trimmed.split(/[T\s]+/)[0];

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

// Extracts "HH:mm" from the same cell formats toDateString() accepts —
// notably the broker export's "DD/MM/YYYY HH:mm" (e.g. "02/07/2026 01:37").
// Returns "" when the cell has no time component (date-only cells, or an
// unparseable value) so callers can tell "no time recorded" apart from a
// genuine midnight timestamp.
function toTimeString(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const h = value.getUTCHours();
    const min = value.getUTCMinutes();
    // A date-only Excel cell becomes a Date at UTC midnight once parsed
    // (cellDates:true) — indistinguishable from a real 00:00 timestamp, so
    // exact midnight is treated as "no time" rather than risk fabricating one.
    if (h === 0 && min === 0) return "";
    return `${pad(h)}:${pad(min)}`;
  }

  if (typeof value === "number") {
    // Excel serial dates store the time-of-day as the fractional part of the
    // day count, so a whole number is unambiguously a date-only cell.
    if (Number.isInteger(value)) return "";
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && (parsed.H !== 0 || parsed.M !== 0)) {
      return `${pad(parsed.H)}:${pad(parsed.M)}`;
    }
    return "";
  }

  if (typeof value !== "string" || !value.trim()) return "";

  // Same "+" collapsing as toDateString — a run of whitespace between the
  // date and time (not just a single space) must still split into exactly
  // [datePart, timePart], or the real time-of-day silently gets dropped.
  const parts = value.trim().split(/[T\s]+/);
  if (parts.length < 2) return "";
  const m = parts[1].match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const h = +m[1];
  const min = +m[2];
  if (h < 0 || h > 23 || min < 0 || min > 59) return "";
  return `${pad(h)}:${pad(min)}`;
}

// Session windows, in minutes since midnight, per the fixed export format's
// house rule:
//   Asian:     00:00–07:59
//   London:    08:00–13:29
//   New York:  13:30–22:00
//   otherwise: unknown (missing entryTime, or outside all three windows)
const ASIAN_SESSION_END_MINUTES = 8 * 60; // last Asian minute is 07:59
const LONDON_SESSION_END_MINUTES = 13 * 60 + 30; // last London minute is 13:29
const NEW_YORK_SESSION_END_MINUTES = 22 * 60; // New York runs through 22:00 inclusive

function detectSession(entryTime: string): Trade["session"] {
  const m = entryTime.match(/^(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const minutes = +m[1] * 60 + +m[2];
  if (minutes < ASIAN_SESSION_END_MINUTES) return "Asian";
  if (minutes < LONDON_SESSION_END_MINUTES) return "London";
  if (minutes <= NEW_YORK_SESSION_END_MINUTES) return "New York";
  return undefined;
}

function directionFromType(typeValue: string): "long" | "short" {
  return typeValue === "sell" || typeValue === "short" ? "short" : "long";
}

function statusFromPnl(pnl: number): TradeStatus {
  return pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";
}

// ============================================================
// Format detection
// ============================================================
// The dispatcher: opening_time_utc is unique to the new broker export, so
// its presence alone is enough to route to parseUtcBrokerFormat() — no
// need to check the rest of that format's columns first. Anything without
// it is assumed to be the legacy format.

type ImportFormat = "legacy" | "utcBroker";

function hasColumn(headers: string[], columnName: string): boolean {
  const target = normalizeHeader(columnName);
  return headers.some((h) => normalizeHeader(h) === target);
}

function hasAllColumns(headers: string[], requiredColumns: string[]): boolean {
  const normalizedHeaders = headers.map(normalizeHeader);
  return requiredColumns.every((col) => normalizedHeaders.includes(normalizeHeader(col)));
}

function detectImportFormat(headers: string[]): ImportFormat {
  return hasColumn(headers, "opening_time_utc") ? "utcBroker" : "legacy";
}

// ============================================================
// Legacy format: Symbol / Type / Open Date / Open / Closed Date / Closed
// / Lots / Profit (+ optional TP / SL / Commission / Swap)
// ============================================================

function parseLegacyFormat(rows: Row[]): ParsedTradeFile {
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
    const swap = findValue(row, ["Swap"]);

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

    const openDateRaw = findValue(row, ["Open Date"]);
    const closedDateRaw = findValue(row, ["Closed Date"]);

    const entryDate = toDateString(openDateRaw);
    if (!entryDate) {
      skippedRows.push({ rowNumber, reason: "Invalid or missing Open Date" });
      devWarn(`Row ${rowNumber} skipped: invalid or missing Open Date`);
      return;
    }

    const exitDate = toDateString(closedDateRaw);
    // Open Date / Closed Date carry both date and time (e.g. "02/07/2026
    // 01:37") — split the time out and derive the session from entryTime.
    const entryTime = toTimeString(openDateRaw);
    const exitTime = toTimeString(closedDateRaw);
    const session = detectSession(entryTime);
    devLogDateSplit(rowNumber, openDateRaw, entryDate, entryTime, session);

    const entryPrice = parseAmount(findValue(row, ["Open"]));
    const exitPrice = parseAmount(findValue(row, ["Closed"]));
    const quantity = parseAmount(findValue(row, ["Lots"]));

    const direction = directionFromType(typeValue);
    const status = statusFromPnl(pnl);

    // TP/SL/Commission/Swap have no dedicated Trade fields, so they're
    // preserved both as structured ParsedTrade fields (for parity with the
    // UTC broker format) and as notes text for now, same as before this
    // format was added. Commission/swap are informational only and are
    // never subtracted from pnl — the Profit column already reflects the
    // net result.
    const takeProfitValue = parseAmount(tp);
    const stopLossValue = parseAmount(sl);
    const commissionValue = parseAmount(commission);
    const swapValue = parseAmount(swap);

    const notesParts: string[] = [];
    if (tp !== undefined && tp !== "") notesParts.push(`TP: ${tp}`);
    if (sl !== undefined && sl !== "") notesParts.push(`SL: ${sl}`);
    if (commission !== undefined && commission !== "" && commissionValue !== null && commissionValue !== 0) {
      notesParts.push(`Commission: ${commission}`);
    }
    if (swap !== undefined && swap !== "" && swapValue !== null && swapValue !== 0) {
      notesParts.push(`Swap: ${swap}`);
    }

    trades.push({
      symbol: symbol.toUpperCase(),
      direction,
      entryDate,
      exitDate: exitDate || entryDate,
      entryTime: entryTime || undefined,
      exitTime: exitTime || undefined,
      session,
      entryPrice: entryPrice ?? 0,
      exitPrice: exitPrice ?? 0,
      quantity: quantity ?? 0,
      pnl,
      status,
      notes: notesParts.length > 0 ? notesParts.join(" | ") : undefined,
      takeProfit: takeProfitValue ?? undefined,
      stopLoss: stopLossValue ?? undefined,
      commission: commissionValue ?? undefined,
      swap: swapValue ?? undefined,
    });
  });

  return { trades, skippedRows };
}

// ============================================================
// New UTC broker format: ticket / opening_time_utc / closing_time_utc /
// type / lots / symbol / opening_price / closing_price / stop_loss /
// take_profit / commission / swap / profit
// ============================================================

function parseUtcBrokerFormat(rows: Row[]): ParsedTradeFile {
  const trades: ParsedTrade[] = [];
  const skippedRows: SkippedRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    const symbol = String(findValue(row, ["symbol"]) ?? "").trim();
    const typeValue = String(findValue(row, ["type"]) ?? "")
      .trim()
      .toLowerCase();
    const profitRaw = findValue(row, ["profit"]);
    const openingTimeRaw = findValue(row, ["opening_time_utc"]);
    const closingTimeRaw = findValue(row, ["closing_time_utc"]);

    const isBlankRow =
      !symbol && !typeValue && (profitRaw === "" || profitRaw === undefined) && !openingTimeRaw && !closingTimeRaw;
    if (isBlankRow) return;

    if (!symbol) {
      skippedRows.push({ rowNumber, reason: "Missing symbol" });
      devWarn(`Row ${rowNumber} skipped: missing symbol`);
      return;
    }

    // profit is the source of truth for pnl — used as-is, never recalculated
    // and never combined with commission/swap.
    const pnl = parseAmount(profitRaw);
    if (pnl === null) {
      const reason =
        profitRaw === "" || profitRaw === undefined ? "Missing profit value" : `Invalid profit value: "${profitRaw}"`;
      skippedRows.push({ rowNumber, reason });
      devWarn(`Row ${rowNumber} skipped: ${reason}`);
      return;
    }

    const entryDate = toDateString(openingTimeRaw);
    if (!entryDate) {
      skippedRows.push({ rowNumber, reason: "Invalid or missing opening_time_utc" });
      devWarn(`Row ${rowNumber} skipped: invalid or missing opening_time_utc`);
      return;
    }

    const exitDate = toDateString(closingTimeRaw);
    const entryTime = toTimeString(openingTimeRaw);
    const exitTime = toTimeString(closingTimeRaw);
    const session = detectSession(entryTime);

    const entryPrice = parseAmount(findValue(row, ["opening_price"]));
    const exitPrice = parseAmount(findValue(row, ["closing_price"]));
    const quantity = parseAmount(findValue(row, ["lots"]));

    const direction = directionFromType(typeValue);
    const status = statusFromPnl(pnl);

    // ticket/stop_loss/take_profit/commission/swap/close_reason have no
    // dedicated Trade columns yet, so — same as the legacy format — they're
    // preserved both as structured ParsedTrade fields and as notes text.
    // Commission and swap are informational only and are never subtracted
    // from pnl; ticket/close_reason are carried through as metadata only.
    const ticket = findValue(row, ["ticket"]);
    const takeProfit = findValue(row, ["take_profit"]);
    const stopLoss = findValue(row, ["stop_loss"]);
    const commission = findValue(row, ["commission"]);
    const swap = findValue(row, ["swap"]);
    const closeReason = findValue(row, ["close_reason"]);

    const takeProfitValue = parseAmount(takeProfit);
    const stopLossValue = parseAmount(stopLoss);
    const commissionValue = parseAmount(commission);
    const swapValue = parseAmount(swap);

    const notesParts: string[] = [];
    if (ticket !== undefined && ticket !== "") notesParts.push(`Ticket: ${ticket}`);
    if (takeProfit !== undefined && takeProfit !== "") notesParts.push(`TP: ${takeProfit}`);
    if (stopLoss !== undefined && stopLoss !== "") notesParts.push(`SL: ${stopLoss}`);
    if (commission !== undefined && commission !== "" && commissionValue !== null && commissionValue !== 0) {
      notesParts.push(`Commission: ${commission}`);
    }
    if (swap !== undefined && swap !== "" && swapValue !== null && swapValue !== 0) {
      notesParts.push(`Swap: ${swap}`);
    }

    trades.push({
      symbol: symbol.toUpperCase(),
      direction,
      entryDate,
      exitDate: exitDate || entryDate,
      entryTime: entryTime || undefined,
      exitTime: exitTime || undefined,
      session,
      entryPrice: entryPrice ?? 0,
      exitPrice: exitPrice ?? 0,
      quantity: quantity ?? 0,
      pnl,
      status,
      notes: notesParts.length > 0 ? notesParts.join(" | ") : undefined,
      takeProfit: takeProfitValue ?? undefined,
      stopLoss: stopLossValue ?? undefined,
      commission: commissionValue ?? undefined,
      swap: swapValue ?? undefined,
      externalTradeId: ticket !== undefined && ticket !== "" ? String(ticket) : undefined,
      closeReason: closeReason !== undefined && closeReason !== "" ? String(closeReason) : undefined,
    });
  });

  return { trades, skippedRows };
}

// ============================================================
// Fallback generic parser for unrecognized formats
// ============================================================
// Best-effort column auto-mapping by common alias names. Only symbol,
// profit, and an open/entry date are treated as non-negotiable — direction,
// lot size, and close date all have safe defaults, the same "degrade
// gracefully rather than reject" philosophy the existing format already
// uses for its optional TP/SL/Commission columns. If even the
// non-negotiable three can't be found, this is truly an unknown format and
// we say so rather than guessing further — this project deliberately does
// not try to hand-support every prop firm's export layout.

const FALLBACK_ALIASES = {
  symbol: ["symbol", "instrument", "pair"],
  type: ["type", "side", "direction"],
  lots: ["lots", "volume", "size"],
  profit: ["profit", "pnl", "net_pnl"],
  openDate: ["open_date", "entry_date", "opening_time"],
  closeDate: ["close_date", "exit_date", "closing_time"],
};

interface FallbackColumnMap {
  symbol: string | null;
  type: string | null;
  lots: string | null;
  profit: string | null;
  openDate: string | null;
  closeDate: string | null;
}

function findHeader(headers: string[], aliases: string[]): string | null {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.find((h) => normalizedAliases.includes(normalizeHeader(h))) ?? null;
}

function detectFallbackColumns(headers: string[]): FallbackColumnMap {
  return {
    symbol: findHeader(headers, FALLBACK_ALIASES.symbol),
    type: findHeader(headers, FALLBACK_ALIASES.type),
    lots: findHeader(headers, FALLBACK_ALIASES.lots),
    profit: findHeader(headers, FALLBACK_ALIASES.profit),
    openDate: findHeader(headers, FALLBACK_ALIASES.openDate),
    closeDate: findHeader(headers, FALLBACK_ALIASES.closeDate),
  };
}

function fallbackGenericParser(rows: Row[], headers: string[]): ParsedTradeFile {
  const columns = detectFallbackColumns(headers);

  if (!columns.symbol || !columns.profit || !columns.openDate) {
    throw new Error(UNKNOWN_FORMAT_ERROR);
  }
  const { symbol: symbolCol, profit: profitCol, openDate: openDateCol, type: typeCol, lots: lotsCol, closeDate: closeDateCol } =
    columns;

  const trades: ParsedTrade[] = [];
  const skippedRows: SkippedRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    const symbol = String(row[symbolCol] ?? "").trim();
    const typeValue = typeCol
      ? String(row[typeCol] ?? "")
          .trim()
          .toLowerCase()
      : "";
    const profitRaw = row[profitCol];
    const openDateRaw = row[openDateCol];

    const isBlankRow = !symbol && !typeValue && (profitRaw === "" || profitRaw === undefined) && !openDateRaw;
    if (isBlankRow) return;

    if (!symbol) {
      skippedRows.push({ rowNumber, reason: "Missing symbol" });
      devWarn(`Row ${rowNumber} skipped: missing symbol`);
      return;
    }

    const pnl = parseAmount(profitRaw);
    if (pnl === null) {
      const reason =
        profitRaw === "" || profitRaw === undefined ? "Missing profit value" : `Invalid profit value: "${profitRaw}"`;
      skippedRows.push({ rowNumber, reason });
      devWarn(`Row ${rowNumber} skipped: ${reason}`);
      return;
    }

    const entryDate = toDateString(openDateRaw);
    if (!entryDate) {
      skippedRows.push({ rowNumber, reason: "Invalid or missing open/entry date" });
      devWarn(`Row ${rowNumber} skipped: invalid or missing open/entry date`);
      return;
    }

    const closeDateRaw = closeDateCol ? row[closeDateCol] : undefined;
    const exitDate = toDateString(closeDateRaw);
    const entryTime = toTimeString(openDateRaw);
    const exitTime = toTimeString(closeDateRaw);
    const session = detectSession(entryTime);

    const quantity = lotsCol ? parseAmount(row[lotsCol]) : null;
    const direction = directionFromType(typeValue);
    const status = statusFromPnl(pnl);

    trades.push({
      symbol: symbol.toUpperCase(),
      direction,
      entryDate,
      exitDate: exitDate || entryDate,
      entryTime: entryTime || undefined,
      exitTime: exitTime || undefined,
      session,
      entryPrice: 0,
      exitPrice: 0,
      quantity: quantity ?? 0,
      pnl,
      status,
    });
  });

  return { trades, skippedRows };
}

// ============================================================
// Entry point
// ============================================================

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
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
    defval: "",
    raw: true,
  });

  if (rows.length === 0) {
    throw new Error("No rows found in file");
  }

  const headers = Object.keys(rows[0]);
  const format = detectImportFormat(headers);

  if (format === "utcBroker") return parseUtcBrokerFormat(rows);

  // "legacy" only means "not the UTC broker format" — if this file doesn't
  // actually carry the legacy format's full required-column set either,
  // it's an unrecognized third format, so fall through to best-effort
  // column auto-mapping instead of forcing it through parseLegacyFormat().
  if (hasAllColumns(headers, REQUIRED_COLUMNS)) return parseLegacyFormat(rows);
  return fallbackGenericParser(rows, headers);
}
