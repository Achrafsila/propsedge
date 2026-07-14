import { EdgePulseView } from "@/components/edge-pulse/EdgePulseView";

// ============================================================
// PropEdge — Edge Pulse page
// ============================================================
// Thin wrapper only — EdgePulseView now owns its own per-instrument data
// wiring (fetchEdgePulse, one instrument at a time) since Edge Pulse's
// multi-timeframe payload is independent of the shared MarketIntelligence
// pipeline other pages (EdgePilot, etc.) still use.
export default function EdgePulsePage() {
  return <EdgePulseView />;
}
