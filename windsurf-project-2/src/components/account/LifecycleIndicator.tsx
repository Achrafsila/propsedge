import { LifecycleNode, LifecycleNodeState } from "@/lib/lifecycle";

// Icon + color are always paired so lifecycle state is never communicated
// by color alone — screen readers get the same distinction via aria-label.
const STATE_STYLE: Record<LifecycleNodeState, { icon: string; color: string; description: string }> = {
  done: { icon: "✓", color: "#10B981", description: "completed" },
  current: { icon: "●", color: "#298DFF", description: "current" },
  upcoming: { icon: "○", color: "#64748B", description: "upcoming" },
  failed: { icon: "✕", color: "#EF4444", description: "failed" },
};

export function LifecycleIndicator({
  nodes,
  compact = false,
  className = "",
  ariaLabel = "Lifecycle progress",
}: {
  nodes: LifecycleNode[];
  // Always abbreviate (S1/S2) — for dense contexts like the table.
  compact?: boolean;
  className?: string;
  // Override for non-evaluation variants, e.g. "Instant-funded CFD account"
  // — the per-node labels alone ("Instant Funded: current") don't convey
  // that there's no Step 1/Step 2 arc behind it.
  ariaLabel?: string;
}) {
  if (nodes.length === 0) return null;

  return (
    <span
      role="list"
      aria-label={ariaLabel}
      className={`inline-flex items-center flex-wrap gap-1 text-[11px] font-medium ${className}`}
    >
      {nodes.map((node, i) => {
        const { icon, color, description } = STATE_STYLE[node.state];
        return (
          <span
            key={`${node.label}-${i}`}
            role="listitem"
            aria-label={`${node.label}: ${description}`}
            className="inline-flex items-center gap-1"
          >
            <span className="inline-flex items-center gap-1" style={{ color }}>
              <span aria-hidden="true">{icon}</span>
              {compact ? (
                <span title={node.label}>{node.shortLabel}</span>
              ) : (
                <>
                  {/* Falls back to the abbreviation once the card itself
                      (marked @container by the caller) gets tight, so the
                      chain never wraps mid-word on a narrow grid column. */}
                  <span className="hidden @sm:inline">{node.label}</span>
                  <span className="@sm:hidden" title={node.label}>
                    {node.shortLabel}
                  </span>
                </>
              )}
            </span>
            {i < nodes.length - 1 && (
              <span className="text-[#475569]" aria-hidden="true">
                →
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
