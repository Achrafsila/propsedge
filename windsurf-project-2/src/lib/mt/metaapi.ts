// Direct MetaTrader 4 / MetaTrader 5 connection, via the MetaApi cloud bridge
// (https://metaapi.cloud). MT4/MT5 expose no public web API, so a bridge that
// hosts the terminal and exposes REST is the standard way to reach them from
// a Next.js app. Server-only: the MetaApi token must never reach the browser.

export type MtPlatform = "mt4" | "mt5";

const PROVISIONING_URL =
  process.env.METAAPI_PROVISIONING_URL ??
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const CLIENT_URL =
  process.env.METAAPI_CLIENT_URL ??
  "https://mt-client-api-v1.new-york.agiliumtrade.ai";

function token(): string {
  const t = process.env.METAAPI_TOKEN;
  if (!t) throw new Error("METAAPI_TOKEN is not configured");
  return t;
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "auth-token": token(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MetaApi ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface ConnectInput {
  name: string;
  login: string;
  password: string; // investor (read-only) password recommended
  server: string; // broker server name, e.g. "ICMarketsSC-Demo"
  platform: MtPlatform;
}

export async function connectAccount(input: ConnectInput): Promise<{ id: string }> {
  const created = await call<{ id: string }>(
    `${PROVISIONING_URL}/users/current/accounts`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        type: "cloud-g2",
        login: input.login,
        password: input.password,
        server: input.server,
        platform: input.platform,
        magic: 0,
      }),
    }
  );
  await call(`${PROVISIONING_URL}/users/current/accounts/${created.id}/deploy`, {
    method: "POST",
  });
  return { id: created.id };
}

interface MetaDeal {
  id: string;
  type: string; // DEAL_TYPE_BUY | DEAL_TYPE_SELL | DEAL_TYPE_BALANCE ...
  entryType?: string; // DEAL_ENTRY_IN | DEAL_ENTRY_OUT | DEAL_ENTRY_INOUT
  positionId?: string;
  symbol?: string;
  volume?: number;
  price?: number;
  profit?: number;
  commission?: number;
  swap?: number;
  time: string; // ISO 8601, UTC
  comment?: string;
  reason?: string;
}

export interface MtClosedTrade {
  externalTradeId: string;
  symbol: string;
  direction: "long" | "short";
  entryDate: string; // YYYY-MM-DD (UTC)
  entryTime: string; // HH:MM:SS (UTC)
  exitDate: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number; // lots
  pnl: number; // profit + commission + swap
  commission: number;
  swap: number;
  closeReason?: string;
}

async function fetchDeals(accountId: string, from: Date, to: Date): Promise<MetaDeal[]> {
  const out: MetaDeal[] = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const url =
      `${CLIENT_URL}/users/current/accounts/${accountId}/history-deals/time/` +
      `${from.toISOString()}/${to.toISOString()}?offset=${offset}&limit=${limit}`;
    const page = await call<MetaDeal[]>(url);
    out.push(...page);
    if (page.length < limit) break;
  }
  return out;
}

const split = (iso: string) => [iso.slice(0, 10), iso.slice(11, 19)] as const;

// Pairs each position's opening deal (IN) with its closing deal (OUT) into a
// single closed trade. Balance/credit operations and still-open positions are
// ignored. Partial closes are summed into one trade per position.
export async function fetchClosedTrades(
  accountId: string,
  from: Date,
  to: Date = new Date()
): Promise<MtClosedTrade[]> {
  const deals = await fetchDeals(accountId, from, to);
  const byPosition = new Map<string, MetaDeal[]>();
  for (const d of deals) {
    if (!d.positionId || !d.symbol) continue;
    if (d.type !== "DEAL_TYPE_BUY" && d.type !== "DEAL_TYPE_SELL") continue;
    const list = byPosition.get(d.positionId) ?? [];
    list.push(d);
    byPosition.set(d.positionId, list);
  }

  const trades: MtClosedTrade[] = [];
  for (const [positionId, list] of byPosition) {
    list.sort((a, b) => a.time.localeCompare(b.time));
    const opens = list.filter((d) => d.entryType === "DEAL_ENTRY_IN");
    const closes = list.filter((d) => d.entryType === "DEAL_ENTRY_OUT");
    if (opens.length === 0 || closes.length === 0) continue;

    const first = opens[0];
    const last = closes[closes.length - 1];
    const lots = opens.reduce((s, d) => s + (d.volume ?? 0), 0);
    const avg = (ds: MetaDeal[]) => {
      const vol = ds.reduce((s, d) => s + (d.volume ?? 0), 0);
      return vol ? ds.reduce((s, d) => s + (d.price ?? 0) * (d.volume ?? 0), 0) / vol : 0;
    };
    const sum = (k: "profit" | "commission" | "swap") =>
      list.reduce((s, d) => s + (d[k] ?? 0), 0);
    const [entryDate, entryTime] = split(first.time);
    const [exitDate, exitTime] = split(last.time);

    trades.push({
      externalTradeId: positionId,
      symbol: first.symbol!,
      direction: first.type === "DEAL_TYPE_BUY" ? "long" : "short",
      entryDate,
      entryTime,
      exitDate,
      exitTime,
      entryPrice: avg(opens),
      exitPrice: avg(closes),
      quantity: lots,
      pnl: sum("profit") + sum("commission") + sum("swap"),
      commission: sum("commission"),
      swap: sum("swap"),
      closeReason: last.reason,
    });
  }
  return trades.sort((a, b) =>
    (a.exitDate + a.exitTime).localeCompare(b.exitDate + b.exitTime)
  );
}
