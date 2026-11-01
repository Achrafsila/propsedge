export type EvidenceTrade = { date: string; symbol: string; direction: "long" | "short"; pnl: number; quantity: number };
export type Evidence = { id: string; headline: string; evidence: string; action: string; priority: number };
const fmt = (v: number) => Math.round(v * 100) / 100;
export function buildTraderEvidence(trades: EvidenceTrade[]): Evidence[] {
  const facts: Evidence[] = [];
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0);
  const grossWins = wins.reduce((a,t) => a+t.pnl,0), grossLoss = -losses.reduce((a,t) => a+t.pnl,0);
  const net = grossWins-grossLoss;
  const days = new Map<string, number>();
  const instruments = new Map<string, EvidenceTrade[]>();
  for (const t of trades) {
    days.set(t.date,(days.get(t.date)||0)+t.pnl);
    instruments.set(t.symbol,[...(instruments.get(t.symbol)||[]),t]);
  }
  if (wins.length >= 3 && losses.length >= 3 && grossLoss > 0) {
    const avgWin = grossWins/wins.length, avgLoss = grossLoss/losses.length;
    facts.push({ id:"payoff", headline:"Average win vs. average loss", evidence:`Average win ${fmt(avgWin)} vs. average loss ${fmt(avgLoss)}; payoff ratio ${fmt(avgWin/avgLoss)} across ${wins.length} wins and ${losses.length} losses.`, action:"Review the size of losing trades relative to winners, alongside win rate.", priority: avgWin < avgLoss ? 90 : 60 });
  }
  if (days.size >= 5 && net > 0) {
    const best = Math.max(...days.values()), share = best/net*100;
    if (share >= 40) facts.push({ id:"concentration", headline:"Profit concentrated in one day", evidence:`Best day ${fmt(best)} / net profit ${fmt(net)} = ${fmt(share)}% across ${days.size} days.`, action:"Check net performance excluding the best day before interpreting overall profitability.", priority:95 });
  }
  const comparable = [...instruments].filter(([, ts]) => ts.length >= 5).map(([name,ts])=>({name,count:ts.length,avg:ts.reduce((a,t)=>a+t.pnl,0)/ts.length})).sort((a,b)=>b.avg-a.avg);
  if (comparable.length >= 2) {
    const top=comparable[0], bottom=comparable[comparable.length-1];
    if (top.avg !== bottom.avg) facts.push({ id:"instruments", headline:"Instrument performance gap", evidence:`${top.name}: ${top.count} trades, avg P&L ${fmt(top.avg)}; ${bottom.name}: ${bottom.count} trades, avg P&L ${fmt(bottom.avg)}.`, action:"Compare trade execution by instrument in the journal before adjusting any exposure.", priority:75 });
  }
  const buys=trades.filter(t=>t.direction==="long"), sells=trades.filter(t=>t.direction==="short");
  if (buys.length>=5 && sells.length>=5) {
    const avg=(ts:EvidenceTrade[])=>ts.reduce((a,t)=>a+t.pnl,0)/ts.length;
    if (avg(buys)!==avg(sells)) facts.push({ id:"direction", headline:"BUY / SELL performance gap", evidence:`BUY: ${buys.length} trades, avg P&L ${fmt(avg(buys))}; SELL: ${sells.length} trades, avg P&L ${fmt(avg(sells))}.`, action:"Compare trade management for each direction; this is not a directional signal.", priority:65 });
  }
  const losingDays=[...days.values()].filter(v=>v<0);
  if (days.size>=5 && losingDays.length>=2) facts.push({ id:"losing-days", headline:"Losses across trading days", evidence:`${losingDays.length} losing days of ${days.size}; combined P&L ${fmt(losingDays.reduce((a,v)=>a+v,0))}.`, action:"Review the journal entries on losing days for repeatable patterns.", priority:55 });
  // Descriptive observations remain useful with small samples. Avoid claiming a proven edge.
  if (trades.length >= 5) {
    const mostTraded=[...instruments].sort((a,b)=>b[1].length-a[1].length)[0];
    if(mostTraded){const [name,ts]=mostTraded;const pnl=ts.reduce((s,t)=>s+t.pnl,0);facts.push({id:"favorite-market",headline:"Your most traded market",evidence:`${name}: ${ts.length} of ${trades.length} trades, net P&L ${fmt(pnl)}. This is frequency, not proof of superior performance.`,action:"A favorite market is not necessarily the most profitable.",priority:45});}
    const winning=trades.filter(t=>t.pnl>0).length;
    facts.push({id:"win-snapshot",headline:"Your recent scorecard",evidence:`${winning} winning trades out of ${trades.length}; total realized P&L ${fmt(net)}.`,action:"A small sample is only a snapshot.",priority:35});
    const bySize=new Map<string,EvidenceTrade[]>();
    for(const t of trades){if(t.quantity>0){const key=`${t.symbol}|${t.quantity}`;bySize.set(key,[...(bySize.get(key)||[]),t]);}}
    const common=[...bySize].filter(([,ts])=>ts.length>=3).sort((a,b)=>b[1].length-a[1].length)[0];
    if(common){const [key,ts]=common;const [symbol,size]=key.split("|");facts.push({id:"lot-habit",headline:"Your familiar lot size",evidence:`${size} lots on ${symbol} appears in ${ts.length} trades, with net P&L ${fmt(ts.reduce((s,t)=>s+t.pnl,0))}. Frequency alone does not establish an optimal lot size.`,action:"Compare sizing only within the same market.",priority:40});}
  }
  return facts.sort((a,b)=>b.priority-a.priority);
}
