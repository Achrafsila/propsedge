export interface PropFirmPreset {
  id: string;
  propFirmName: string;
  planName: string;
  accountSize: number;
  purchaseCost: number;
  challengeType?: '1-step' | '2-step' | 'instant';
  profitTarget: number;
  step1ProfitTarget?: number;
  step2ProfitTarget?: number;
  maxDrawdown: number;
  drawdownMode: 'EOD' | 'Daily' | 'Trailing';
  dailyDrawdown: number | null;
  maxContracts: number;
  minTradingDays: number | null;
  consistencyRule: string | null;
  newsTrading: string;
  payoutDays: number | null;
  minPayout: number | null;
  maxPayoutRequest: number | null;
  payoutSplit: number | null;
  notes: string;
}

export const propFirmPresets: PropFirmPreset[] = [
  // MyFundedFutures
  {
    id: 'myfundedfutures-flex-50k',
    propFirmName: 'MyFundedFutures',
    planName: 'Flex Plan 50K',
    accountSize: 50000,
    purchaseCost: 153,
    profitTarget: 3000,
    maxDrawdown: 2000,
    drawdownMode: 'EOD',
    dailyDrawdown: null,
    maxContracts: 3,
    minTradingDays: 2,
    consistencyRule: '50%',
    newsTrading: 'allowed',
    payoutDays: 5,
    minPayout: 500,
    maxPayoutRequest: 2000,
    payoutSplit: 80,
    notes: 'First payouts are limited. MLL after first payout locked at $100.',
  },
  {
    id: 'myfundedfutures-pro-50k',
    propFirmName: 'MyFundedFutures',
    planName: 'Pro Plan 50K',
    accountSize: 50000,
    purchaseCost: 114,
    profitTarget: 3000,
    maxDrawdown: 2000,
    drawdownMode: 'EOD',
    dailyDrawdown: null,
    maxContracts: 5,
    minTradingDays: 2,
    consistencyRule: '50%',
    newsTrading: 'allowed',
    payoutDays: 14,
    minPayout: 1000,
    maxPayoutRequest: null,
    payoutSplit: 80,
    notes: 'Buffer requirement around $2.1K.',
  },
  // Goat Funded Futures
  {
    id: 'goat-funded-futures-eod-50k',
    propFirmName: 'Goat Funded Futures',
    planName: 'EOD 50K',
    accountSize: 50000,
    purchaseCost: 69,
    profitTarget: 3000,
    maxDrawdown: 2000,
    drawdownMode: 'EOD',
    dailyDrawdown: null,
    maxContracts: 5,
    minTradingDays: null,
    consistencyRule: 'evaluation 50%, funded 30%',
    newsTrading: 'allowed with funded restriction',
    payoutDays: 7,
    minPayout: null,
    maxPayoutRequest: null,
    payoutSplit: 90,
    notes: 'Profit split up to 90%.',
  },
  {
    id: 'goat-funded-futures-pro-50k',
    propFirmName: 'Goat Funded Futures',
    planName: 'Pro 50K',
    accountSize: 50000,
    purchaseCost: 95,
    profitTarget: 3000,
    maxDrawdown: 2000,
    drawdownMode: 'EOD',
    dailyDrawdown: null,
    maxContracts: 3,
    minTradingDays: null,
    consistencyRule: 'evaluation 50%, funded none',
    newsTrading: 'allowed with funded restriction',
    payoutDays: 5,
    minPayout: null,
    maxPayoutRequest: null,
    payoutSplit: 90,
    notes: 'No daily loss limit. No consistency rule in funded.',
  },
  // Blue Guardian Futures
  {
    id: 'blue-guardian-futures-1step-standard-50k',
    propFirmName: 'Blue Guardian Futures',
    planName: '1 Step Standard 50K',
    accountSize: 50000,
    purchaseCost: 55,
    profitTarget: 3000,
    maxDrawdown: 2500,
    drawdownMode: 'EOD',
    dailyDrawdown: 1250,
    maxContracts: 3,
    minTradingDays: null,
    consistencyRule: '40%',
    newsTrading: 'allowed',
    payoutDays: 5,
    minPayout: null,
    maxPayoutRequest: null,
    payoutSplit: null,
    notes: 'Standard account. Micro scaling allowed.',
  },
  {
    id: 'blue-guardian-futures-1step-pro-50k',
    propFirmName: 'Blue Guardian Futures',
    planName: '1 Step Pro 50K',
    accountSize: 50000,
    purchaseCost: 59,
    profitTarget: 3000,
    maxDrawdown: 2000,
    drawdownMode: 'EOD',
    dailyDrawdown: null,
    maxContracts: 6,
    minTradingDays: null,
    consistencyRule: '35%',
    newsTrading: 'allowed',
    payoutDays: 5,
    minPayout: null,
    maxPayoutRequest: null,
    payoutSplit: null,
    notes: 'Pro account. Micro scaling allowed.',
  },
  // Alpha Futures
  {
    id: 'alpha-futures-50k-evaluation',
    propFirmName: 'Alpha Futures',
    planName: '50K Evaluation',
    accountSize: 50000,
    purchaseCost: 159,
    profitTarget: 3000,
    maxDrawdown: 2000,
    drawdownMode: 'EOD',
    dailyDrawdown: null,
    maxContracts: 4,
    minTradingDays: 2,
    consistencyRule: null,
    newsTrading: 'none',
    payoutDays: null,
    minPayout: null,
    maxPayoutRequest: null,
    payoutSplit: null,
    notes: 'Evaluation account. Qualified rules available after passing.',
  },
];

export const getPropFirms = () => {
  const firms = [...new Set(propFirmPresets.map(p => p.propFirmName))];
  return firms.sort();
};

export const getPlansByFirm = (firmName: string) => {
  return propFirmPresets.filter(p => p.propFirmName === firmName);
};

export const getPresetById = (id: string) => {
  return propFirmPresets.find(p => p.id === id);
};
