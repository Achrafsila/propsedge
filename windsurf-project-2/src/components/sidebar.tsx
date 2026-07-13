"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Wallet,
  BookOpen,
  BarChart3,
  DollarSign,
  Settings,
  Shield,
  LineChart,
  Compass,
  Activity
} from "lucide-react";
import { motion } from "framer-motion";
import { useAccounts } from "@/context/AccountsContext";
import { useAdmin } from "@/context/AdminContext";
import { useTradingMode } from "@/context/TradingModeContext";
import { getCapitalEligibleChallenges } from "@/lib/challenges";
import { borderRadius } from "@/design-system";
import { Logo } from "@/components/common/Logo";

export function Sidebar() {
  const pathname = usePathname();
  const { challenges, fundedAccounts } = useAccounts();
  const { isAdmin } = useAdmin();
  const { isPropFirmMode, isPersonalCapitalMode, setTradingMode } = useTradingMode();

  // Prop Firm nav — unchanged from before Personal Capital mode existed.
  const propFirmItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Challenges", href: "/challenges", icon: Trophy },
    { name: "Funded Accounts", href: "/funded", icon: Wallet },
    { name: "Trade Journal", href: "/journal", icon: BookOpen },
    { name: "Trader DNA", href: "/analytics", icon: BarChart3 },
    { name: "Edge Pulse", href: "/edge-pulse", icon: Activity },
    { name: "Payouts", href: "/payouts", icon: DollarSign },
    { name: "EdgePilot", href: "/edgepilot", icon: Compass },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: Shield }] : []),
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // Personal Capital nav — hides Challenges/Funded Accounts/Payouts/Admin,
  // adds Portfolio and Analytics (Trader DNA stays, it's not Prop-Firm-specific).
  const personalCapitalItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Portfolio", href: "/portfolio", icon: Wallet },
    { name: "Trade Journal", href: "/journal", icon: BookOpen },
    { name: "Trader DNA", href: "/analytics", icon: BarChart3 },
    { name: "Edge Pulse", href: "/edge-pulse", icon: Activity },
    { name: "Analytics", href: "/portfolio-analytics", icon: LineChart },
    { name: "EdgePilot", href: "/edgepilot", icon: Compass },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const sidebarItems = isPersonalCapitalMode ? personalCapitalItems : propFirmItems;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Step 2 rows are a continuation of their root challenge, not a separate
  // purchased account, so only root challenges count toward capital — and
  // only lifecycles still actively at risk (active/step1_completed/passed,
  // not yet converted). Failed and refunded lifecycles contribute $0;
  // converted ones have already moved into the funded sum below.
  const totalCapital = getCapitalEligibleChallenges(challenges).reduce((sum, c) => sum + c.accountSize, 0) +
                       fundedAccounts.reduce((sum, a) => sum + a.accountSize, 0);

  return (
    <aside className="w-64 bg-[#050816] border-r border-[rgba(148,163,184,0.1)] min-h-screen flex flex-col">
      <div className="group px-5 py-4 border-b border-[rgba(148,163,184,0.1)] transition-all duration-200">
        <Link href="/welcome" className="block transition-all duration-200 group-hover:drop-shadow-[0_0_14px_rgba(41,141,255,0.55)]">
          <Logo size="medium" variant="full" src="/logo-sidebar.png" />
        </Link>
      </div>

      {/* Trading Mode — segmented control, global switch between Prop Firm
          and Personal Capital. Prop Firm's selected state keeps the app's
          existing brand blue; Personal Capital's selected state is the only
          place this control uses the emerald accent. */}
      <div className="px-4 py-3 border-b border-[rgba(148,163,184,0.1)]">
        <div
          className="flex items-center gap-1 p-1 rounded-full"
          style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.1)' }}
        >
          <button
            type="button"
            onClick={() => setTradingMode("prop-firm")}
            className="flex-1 text-xs font-semibold rounded-full py-1.5 transition-all duration-200"
            style={{
              background: isPropFirmMode ? 'rgba(41,141,255,0.18)' : 'transparent',
              color: isPropFirmMode ? '#298DFF' : '#94A3B8',
            }}
          >
            Prop Firm
          </button>
          <button
            type="button"
            onClick={() => setTradingMode("personal-capital")}
            className="flex-1 text-xs font-semibold rounded-full py-1.5 transition-all duration-200"
            style={{
              background: isPersonalCapitalMode ? 'rgba(16,185,129,0.18)' : 'transparent',
              color: isPersonalCapitalMode ? '#10B981' : '#94A3B8',
            }}
          >
            Personal
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden
                ${isActive 
                  ? "text-[#F8FAFC]" 
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }
              `}
              style={{
                background: isActive ? 'rgba(41,141,255, 0.1)' : 'transparent',
                borderRadius: borderRadius.lg,
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute inset-0 bg-gradient-to-r from-[rgba(41,141,255,0.2)] to-[rgba(59,130,246,0.2)]"
                  style={{ borderRadius: borderRadius.lg }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon 
                className={`w-5 h-5 relative z-10 ${isActive ? "text-[#298DFF]" : ""}`} 
              />
              <span className="relative z-10">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-[rgba(148,163,184,0.1)]">
        <div 
          className="rounded-xl p-4 border"
          style={{
            background: 'rgba(16, 24, 40, 0.6)',
            borderColor: 'rgba(148, 163, 184, 0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <p className="text-xs text-[#94A3B8] mb-2">Total Capital</p>
          <p className="text-lg font-bold text-[#F8FAFC]">{formatCurrency(totalCapital)}</p>
        </div>
      </div>
    </aside>
  );
}
