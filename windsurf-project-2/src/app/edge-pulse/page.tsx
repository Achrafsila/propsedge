"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMarketIntelligence } from "@/lib/market/client";
import { MarketIntelligence } from "@/lib/market/types";
import { EdgePulseView } from "@/components/edge-pulse/EdgePulseView";

// ============================================================
// PropEdge — Edge Pulse page
// ============================================================
// Thin data-wiring layer, same convention as EdgePilotPage: fetches once
// on mount via the existing client-safe fetchMarketIntelligence() (which
// already hits /api/market-intelligence — no direct provider calls, no
// duplicate fetching), then hands the result to EdgePulseView for all
// presentation. Manual refresh re-fetches the same endpoint; switching
// the selected instrument (inside EdgePulseView) never re-fetches — every
// instrument is already present in one payload.
export default function EdgePulsePage() {
  const [intel, setIntel] = useState<MarketIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    const data = await fetchMarketIntelligence();
    setIntel(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMarketIntelligence().then((data) => {
      if (!cancelled) {
        setIntel(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <EdgePulseView intel={intel} loading={loading} refreshing={refreshing} onRefresh={() => load(true)} />;
}
