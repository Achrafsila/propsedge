"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Search, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function TopNav({mobileMenuButton}:{mobileMenuButton?:React.ReactNode}) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayName = user?.email?.split("@")[0] ?? "Trader";
  const initial = displayName[0]?.toUpperCase() ?? "T";

  return (
    <header className="h-16 min-w-0 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-2 px-3 sm:px-5 lg:px-6">
      <div className="flex min-w-0 items-center gap-3 flex-1">{mobileMenuButton}
        <div className="relative hidden w-full max-w-96 min-w-0 sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search accounts, trades, payouts..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
          <Bell className="w-5 h-5" />
        </Button>

        {/* User menu */}
        <div className="relative pl-2 sm:pl-4 border-l border-zinc-800" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-zinc-500 truncate max-w-[160px]">
                {user?.email ?? ""}
              </p>
            </div>
            <div className="w-10 h-10 bg-[#298DFF] rounded-full flex items-center justify-center font-semibold text-white text-sm flex-shrink-0">
              {user ? initial : <User className="w-5 h-5" />}
            </div>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              className="absolute right-0 top-12 w-52 rounded-xl border overflow-hidden z-50"
              style={{
                background: "rgba(8,13,27,0.97)",
                borderColor: "rgba(41,141,255,0.18)",
                backdropFilter: "blur(16px)",
              }}
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-[rgba(148,163,184,0.1)]">
                <p className="text-xs font-medium text-white truncate">{displayName}</p>
                <p className="text-[11px] text-[#8B97A8] truncate mt-0.5">
                  {user?.email ?? ""}
                </p>
              </div>

              {/* Sign out */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#94A3B8] hover:text-white hover:bg-[rgba(41,141,255,0.08)] transition-all duration-150"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
