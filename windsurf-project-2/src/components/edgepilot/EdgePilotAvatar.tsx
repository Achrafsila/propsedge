"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { EdgePilotAvatarState } from "@/lib/analytics/buddyAdvice";

// ============================================================
// PropEdge — EdgePilot Avatar (V3 cockpit, official character library)
// ============================================================
// Renders the official EdgePilot character illustration for the current
// state — full-body, transparent PNG, shown in CONTAIN mode (never cropped,
// never recoloured, never given a background). Files live in
// public/edgepilot/ under their exact on-disk names (capitals + spaces,
// URL-encoded here). If a state's file ever fails to load, the component
// falls back to the Confident character — never a placeholder icon or emoji.
//
// The `state` is chosen by the surface using it: the cockpit hero via
// getAccountHealthState() (mode-driven), the Morning Briefing shows
// "morning", the Ask EdgePilot card shows "confident", etc.

const AVATAR_IMAGE: Record<EdgePilotAvatarState, string> = {
  confident: "/edgepilot/Confident.png",
  healthy: "/edgepilot/Healthy.png",
  recovery: "/edgepilot/Recovery.png",
  focus: "/edgepilot/Focus.png",
  nearPayout: "/edgepilot/Near%20Payout.png",
  motivation: "/edgepilot/Motivation.png",
  critical: "/edgepilot/Critical.png",
  reviewing: "/edgepilot/Reviewing%20Session.png",
  morning: "/edgepilot/Morning%20Check.png",
  payout: "/edgepilot/Payout%20Day.png",
};

const FALLBACK_STATE: EdgePilotAvatarState = "confident";

export function EdgePilotAvatar({
  state,
  size = 200,
  className,
  priority = false,
}: {
  state: EdgePilotAvatarState;
  /** Side of the (square) character box, in px — matches the 1:1 source art. */
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  // Falls back to the Confident character on an unknown state or a failed
  // image load. The guard on onError stops an infinite loop if Confident
  // itself is missing.
  const [errored, setErrored] = useState(false);
  const known: EdgePilotAvatarState = Object.prototype.hasOwnProperty.call(AVATAR_IMAGE, state) ? state : FALLBACK_STATE;
  const effective = errored ? FALLBACK_STATE : known;

  const isCritical = effective === "critical";
  const isPayout = effective === "payout";

  // Subtle idle motion only — a slow float for most states, a calmer
  // "breathing" scale for critical. Never anything flashy.
  const idle = isCritical ? { scale: [1, 1.02, 1] } : { y: [0, -6, 0] };
  const idleTransition = { duration: isCritical ? 3.6 : 4.6, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <motion.div
      className={className}
      style={{ position: "relative", height: size, aspectRatio: "1 / 1" }}
      animate={idle}
      transition={idleTransition}
      whileHover={{ scale: 1.02 }}
    >
      {/* Payout-only soft glow — sits behind the transparent character */}
      {isPayout && (
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 45%, rgba(245,158,11,0.35), rgba(245,158,11,0) 65%)" }}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <Image
        src={AVATAR_IMAGE[effective]}
        alt={`EdgePilot — ${effective}`}
        fill
        sizes={`${size}px`}
        className="object-contain select-none"
        priority={priority}
        draggable={false}
        // These are pre-made, hand-authored character illustrations with a
        // real alpha channel. Served unoptimized so the browser gets the
        // exact source PNG — the Next image optimizer is bypassed entirely,
        // which also means no /_next/image immutable-cache layer to serve a
        // stale version when the artwork is updated in public/edgepilot/.
        unoptimized
        onError={() => {
          if (effective !== FALLBACK_STATE) setErrored(true);
        }}
      />
    </motion.div>
  );
}
