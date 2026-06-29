"use client";

import { useParams, useRouter } from "next/navigation";
import { useAccounts } from "@/context/AccountsContext";
import { AccountAnalyticsView } from "@/components/account/AccountAnalyticsView";

export default function FundedAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const { fundedAccounts, trades, payouts } = useAccounts();
  
  const fundedId = params.id as string;
  const fundedAccount = fundedAccounts.find(a => a.id === fundedId);
  const fundedTrades = trades.filter(t => t.accountId === fundedId && t.accountType === "funded");
  const fundedPayouts = payouts.filter(p => p.fundedAccountId === fundedId);

  const handleAccountChange = (newAccountId: string) => {
    router.push(`/funded/${newAccountId}`);
  };

  if (!fundedAccount) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-[#8B97A8]">Funded account not found</div>
      </div>
    );
  }

  return (
    <AccountAnalyticsView
      account={fundedAccount}
      trades={fundedTrades}
      payouts={fundedPayouts}
      accountType="funded"
      allAccounts={fundedAccounts}
      onAccountChange={handleAccountChange}
    />
  );
}
