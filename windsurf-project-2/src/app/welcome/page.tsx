"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, Wallet, DollarSign, BarChart3 } from "lucide-react";
import { gradientText } from "@/design-system";
import { Logo } from "@/components/common/Logo";
import { Footer } from "@/components/Footer";

const navLinks = [
  { label: "Challenges", href: "/challenges" },
  { label: "Funded", href: "/funded" },
  { label: "Payouts", href: "/payouts" },
  { label: "Journal", href: "/journal" },
];

const features = [
  { icon: Trophy, label: "Track challenges" },
  { icon: Wallet, label: "Manage funded accounts" },
  { icon: DollarSign, label: "Log payouts" },
  { icon: BarChart3, label: "Analyze performance" },
];

export default function Welcome() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Electric-blue radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% -5%, rgba(41,141,255,0.45) 0%, rgba(41,141,255,0.12) 30%, rgba(41,141,255,0) 62%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'linear-gradient(to top, rgba(41,141,255,0.10), transparent)' }}
      />

      {/* Top nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo size="medium" variant="full" src="/logo-sidebar.png" />
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-[#94A3B8] transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/dashboard"
          className="rounded-full bg-[#298DFF] px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:bg-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.4)]"
        >
          Get started
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 pb-16 text-center md:pt-24">
        {/* Hero logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mb-8"
        >
          <Logo size="xlarge" variant="full" src="/logo-full.png" />
        </motion.div>

        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 rounded-full border border-[rgba(41,141,255,0.3)] bg-[rgba(41,141,255,0.08)] px-4 py-1.5 text-xs font-medium text-[#7CC0FF]"
        >
          Built for Professional Prop Traders
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-extrabold tracking-tight"
          style={{ fontSize: "clamp(2.75rem, 8vw, 6rem)", lineHeight: 1, letterSpacing: "-0.05em" }}
        >
          <span className="text-white">One Workspace. </span>
          <span
            style={{
              background: gradientText.premium,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Every Prop Account.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-6 max-w-xl text-base text-[#94A3B8] md:text-lg"
        >
          Manage every challenge, funded account, payout and trading performance from one
          intelligent workspace designed for serious prop traders.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-105"
          >
            Launch Dashboard
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/challenges"
            className="flex items-center gap-2 rounded-full border border-[rgba(148,163,184,0.25)] bg-[rgba(255,255,255,0.02)] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:border-[#298DFF] hover:bg-[rgba(41,141,255,0.1)]"
          >
            View Challenges
          </Link>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 grid w-full grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.06 }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-[rgba(148,163,184,0.1)] bg-[rgba(16,24,40,0.5)] p-5 backdrop-blur-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(41,141,255,0.12)]">
                  <Icon className="h-5 w-5 text-[#298DFF]" />
                </div>
                <span className="text-xs text-[#94A3B8]">{f.label}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </main>

      {/* Footer */}
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
