import { Compass } from "lucide-react";
import { EdgePilotAvatarState } from "@/lib/analytics/buddyAdvice";

// ============================================================
// PropEdge — EdgePilot Avatar (V3 cockpit, placeholder)
// ============================================================
// Static placeholder only, by explicit instruction — no animation, no
// expressions yet. A future version will swap this glyph for real
// per-state artwork/motion; this component's props (state/size) are
// designed to stay stable when that happens, only the internals change.

const AVATAR_COLOR: Record<EdgePilotAvatarState, string> = {
  healthy: "#10B981",
  recovery: "#F59E0B",
  danger: "#EF4444",
  payout: "#298DFF",
};

export function EdgePilotAvatar({ state, size = 88 }: { state: EdgePilotAvatarState; size?: number }) {
  const color = AVATAR_COLOR[state];
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${color}40, ${color}12 60%, transparent 80%)`,
        border: `1px solid ${color}40`,
        boxShadow: `0 0 30px ${color}30`,
      }}
    >
      <Compass style={{ width: size * 0.42, height: size * 0.42, color }} />
    </div>
  );
}
