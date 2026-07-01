"use client";

import Image from "next/image";
import { motion } from "framer-motion";

type LogoSize = "small" | "medium" | "large" | "xlarge";
type LogoVariant = "full" | "icon";

interface LogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  animated?: boolean;
  monochrome?: boolean;
  src?: string;          // override the default image source
  className?: string;
}

const iconDimensions: Record<LogoSize, number> = {
  small: 28,
  medium: 40,
  large: 72,
  xlarge: 216,
};

const fullHeights: Record<LogoSize, number> = {
  small: 32,
  medium: 44,
  large: 72,
  xlarge: 216,
};

// Defaults
const LOGO_FULL   = "/logo-welcome.png";  // welcome page nav / full logo with text
const LOGO_ICON   = "/logo-favicon.png";  // sidebar / icon-only

export function Logo({
  size = "medium",
  variant = "full",
  animated = false,
  monochrome = false,
  src,
  className = "",
}: LogoProps) {
  const imgStyle = monochrome
    ? { filter: "grayscale(1) brightness(0.45)" }
    : undefined;

  const defaultSrc = variant === "icon" ? LOGO_ICON : LOGO_FULL;
  const resolvedSrc = src ?? defaultSrc;

  const dim = variant === "icon" ? iconDimensions[size] : fullHeights[size];

  const inner = (
    <div className={`inline-flex flex-shrink-0 ${className}`}>
      <Image
        src={resolvedSrc}
        alt="PropEdge"
        width={600}
        height={dim}
        style={{
          width: "auto",
          height: dim,
          objectFit: "contain",
          maxWidth: "100%",
          ...imgStyle,
        }}
        priority
      />
    </div>
  );

  if (!animated) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      {inner}
    </motion.div>
  );
}
