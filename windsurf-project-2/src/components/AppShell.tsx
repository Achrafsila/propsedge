"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard, BookOpen, Wallet, Fingerprint, Compass } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { Footer } from "@/components/Footer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MorningBriefing } from "@/components/morning-briefing/MorningBriefing";
import { useTradingMode } from "@/context/TradingModeContext";

const CHROMELESS_ROUTES = ["/welcome", "/login", "/signup", "/forgot-password"];

// Routes that only make sense in Prop Firm mode — hidden from the Personal
// Capital nav (see src/components/sidebar.tsx). If the user switches to
// Personal Capital while already sitting on one of these (or a subroute,
// e.g. /challenges/[id]), bounce them to /dashboard rather than leaving
// them on a page their current mode's nav no longer links to.
const PROP_FIRM_ONLY_ROUTES = ["/challenges", "/funded", "/payouts", "/admin"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPersonalCapitalMode } = useTradingMode();
  const isChromeless = CHROMELESS_ROUTES.includes(pathname);

  const [isLoading, setIsLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const alreadyLoaded = sessionStorage.getItem("pe_loaded");
    if (alreadyLoaded) queueMicrotask(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isPersonalCapitalMode) return;
    const onHiddenRoute = PROP_FIRM_ONLY_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    if (onHiddenRoute) {
      router.replace("/dashboard");
    }
  }, [isPersonalCapitalMode, pathname, router]);

  const handleLoadComplete = () => {
    setIsLoading(false);
    sessionStorage.setItem("pe_loaded", "1");
  };

  if (isChromeless) {
    return <>{children}</>;
  }

  return (
    <>
      <AnimatePresence>{isLoading && <LoadingScreen onComplete={handleLoadComplete} />}</AnimatePresence>
      <MorningBriefing />

      <div className="flex min-h-screen min-w-0 overflow-x-clip">
        <div className="hidden shrink-0 lg:block"><Sidebar /></div>
        {mobileNavOpen && <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(84vw,300px)] overflow-y-auto bg-[#050816] shadow-2xl">
            <button type="button" aria-label="Close menu" className="absolute right-3 top-3 z-10 rounded-lg border border-white/15 bg-[#14263A] p-2 text-white" onClick={() => setMobileNavOpen(false)}><X className="h-5 w-5"/></button>
            <div onClick={(event) => {if ((event.target as HTMLElement).closest("a")) setMobileNavOpen(false);}}><Sidebar /></div>
          </div>
        </div>}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav mobileMenuButton={<button type="button" aria-label="Open navigation menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)} className="rounded-lg border border-white/15 p-2 text-[#BBD5F1] lg:hidden"><Menu className="h-5 w-5"/></button>} />
          <main className="relative min-w-0 flex-1 overflow-x-hidden px-3 pb-28 pt-4 sm:px-5 lg:p-6">
            <div
              aria-hidden
              className="pointer-events-none fixed inset-x-0 top-0 h-[420px] z-0"
              style={{
                background:
                  "radial-gradient(80% 60% at 50% -10%, rgba(41,141,255,0.18) 0%, rgba(41,141,255,0) 60%)",
              }}
            />
            <div className="relative z-10 min-w-0">{children}</div>
          </main>
          <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#298DFF]/20 bg-[#071121]/95 px-2 pt-2 backdrop-blur-2xl lg:hidden" style={{paddingBottom:"max(8px, env(safe-area-inset-bottom))"}}>
            <nav aria-label="Mobile primary navigation" className="mx-auto grid max-w-lg grid-cols-4 gap-1">
              {[{href:"/dashboard",label:"Home",Icon:LayoutDashboard},{href:"/payouts",label:"Payouts",Icon:Wallet},{href:"/analytics",label:"Trader DNA",Icon:Fingerprint},{href:"/edgepilot",label:"EdgePilot",Icon:Compass}].map(item=><Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors ${pathname===item.href?"bg-[#298DFF]/20 text-[#90C8FF]":"text-[#91A5BD]"}`} aria-current={pathname===item.href?"page":undefined}><item.Icon className="h-5 w-5"/><span>{item.label}</span></Link>)}
            </nav>
          </div>
          <div className="hidden lg:block"><Footer /></div>
        </div>
      </div>
    </>
  );
}
