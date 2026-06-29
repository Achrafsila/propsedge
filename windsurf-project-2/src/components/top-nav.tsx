"use client";

import { Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopNav() {
  return (
    <header className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search accounts, trades, payouts..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
          <Bell className="w-5 h-5" />
        </Button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-zinc-800">
          <div className="text-right">
            <p className="text-sm font-medium text-white">John Trader</p>
            <p className="text-xs text-zinc-500">Pro Account</p>
          </div>
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
}
