"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { Footer } from "@/components/Footer";
import { LoadingScreen } from "@/components/LoadingScreen";
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

  useEffect(() => {
    if (isChromeless) {
      setIsLoading(false);
      return;
    }
    const alreadyLoaded = sessionStorage.getItem("pe_loaded");
    if (alreadyLoaded) {
      setIsLoading(false);
    }
  }, [isChromeless]);

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

      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopNav />
          <main className="relative flex-1 p-6 overflow-auto">
            <div
              aria-hidden
              className="pointer-events-none fixed inset-x-0 top-0 h-[420px] z-0"
              style={{
                background:
                  "radial-gradient(80% 60% at 50% -10%, rgba(41,141,255,0.18) 0%, rgba(41,141,255,0) 60%)",
              }}
            />
            <div className="relative z-10">{children}</div>
          </main>
          <Footer />
        </div>
      </div>
    </>
  );
}
