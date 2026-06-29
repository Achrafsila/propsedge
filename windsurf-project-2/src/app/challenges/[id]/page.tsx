"use client";

import { useParams, useRouter } from "next/navigation";
import { useAccounts } from "@/context/AccountsContext";
import { AccountAnalyticsView } from "@/components/account/AccountAnalyticsView";

export default function ChallengeAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const { challenges, trades, payouts } = useAccounts();
  
  const challengeId = params.id as string;
  const challenge = challenges.find(c => c.id === challengeId);
  const challengeTrades = trades.filter(t => t.accountId === challengeId && t.accountType === "challenge");
  const challengePayouts = payouts.filter(p => p.fundedAccountId === challengeId);

  const handleAccountChange = (newAccountId: string) => {
    router.push(`/challenges/${newAccountId}`);
  };

  if (!challenge) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-[#8B97A8]">Challenge not found</div>
      </div>
    );
  }

  return (
    <AccountAnalyticsView
      account={challenge}
      trades={challengeTrades}
      payouts={challengePayouts}
      accountType="challenge"
      allAccounts={challenges}
      onAccountChange={handleAccountChange}
    />
  );
}
