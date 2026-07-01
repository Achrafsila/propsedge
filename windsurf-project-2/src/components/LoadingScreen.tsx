"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/common/Logo";

export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2400);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
    >
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(41,141,255,0.22) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-8">
        {/* Logo icon with pulse */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: [0, 1, 0.85, 1], scale: [0.85, 1, 0.97, 1] }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >
          <motion.div
            animate={{ opacity: [1, 0.75, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
          >
            <Logo size="large" variant="icon" />
          </motion.div>
        </motion.div>

        {/* Brand text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center"
        >
          <p className="font-bold text-lg tracking-widest uppercase">
            <span className="text-white">PROPS </span>
            <span
              style={{
                background: "linear-gradient(90deg, #298DFF, #60C8FF)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              EDGE
            </span>
          </p>
          <p className="text-[#3D4D5E] text-[10px] tracking-widest uppercase mt-1">
            Professional Prop Trading Workspace
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
