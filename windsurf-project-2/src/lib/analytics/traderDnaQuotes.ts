import type { Trade } from "@/types";
export type DNAQuote = { id:string; emoji:string; title:string; quote:string; evidence:string; count:number; market?:string };
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const sum=(ts:Trade[])=>ts.reduce((n,t)=>n+t.pnl,0);
const avg=(ts:Trade[])=>sum(ts)/ts.length;
const group=<T,>(xs:T[],key:(x:T)=>string)=>{const m=new Map<string,T[]>();for(const x of xs){const k=key(x);m.set(k,[...(m.get(k)||[]),x]);}return m;};
const pretty=(s:string)=>/^(XAU|GOLD)/i.test(s)?"Gold":s;
export function traderDnaQuotes(trades:Trade[]):DNAQuote[]{
 const ts=trades.filter(t=>Number.isFinite(t.pnl)&&t.symbol).sort((a,b)=>((a.exitDate||a.entryDate)+" "+(a.exitTime||"")).localeCompare((b.exitDate||b.entryDate)+" "+(b.exitTime||"")));
 if(ts.length<5)return [];
 const out:DNAQuote[]=[];
 const markets=[...group(ts,t=>t.symbol.toUpperCase())].map(([symbol,xs])=>({symbol,xs,mean:avg(xs)})).sort((a,b)=>b.mean-a.mean);
 const comparable=markets.filter(m=>m.xs.length>=3);
 if(comparable.length>=2&&comparable[0].mean>comparable[1].mean){
  const b=comparable[0];out.push({id:"market",emoji:"🥇",title:"Market bestie",quote:`Looks like ${pretty(b.symbol)} is treating you better than the other markets. 💛`,evidence:`${b.xs.length} trades · ${money(b.mean)} average per trade`,count:b.xs.length,market:b.symbol});
 }else if(markets.length){
  const b=[...markets].sort((a,b)=>b.xs.length-a.xs.length)[0];out.push({id:"market",emoji:"💛",title:"Your favorite playground",quote:`You keep coming back to ${pretty(b.symbol)}. Someone has a favorite! 👀`,evidence:`${b.xs.length} of ${ts.length} trades · ${money(sum(b.xs))} net P&L`,count:b.xs.length,market:b.symbol});
 }
 const buys=ts.filter(t=>t.direction==="long"),sells=ts.filter(t=>t.direction==="short");
 if(buys.length>=3&&sells.length>=3&&avg(buys)!==avg(sells)){
  const bull=avg(buys)>avg(sells);out.push({id:"direction",emoji:bull?"🐂":"🐻",title:bull?"Bull energy":"Bear energy",quote:bull?"Your BUY trades have been doing more of the heavy lifting. The bears might be jealous!":"Looks like your SELL trades have been carrying the team lately. 🐻",evidence:`BUY: ${buys.length} at ${money(avg(buys))}/trade · SELL: ${sells.length} at ${money(avg(sells))}/trade`,count:Math.min(buys.length,sells.length)});
 }
 for(const m of [...markets].sort((a,b)=>b.xs.length-a.xs.length)){
  const sizes=[...group(m.xs.filter(t=>t.quantity>0),t=>String(t.quantity))].map(([size,xs])=>({size,xs,mean:avg(xs)})).filter(x=>x.xs.length>=3).sort((a,b)=>b.mean-a.mean);
  if(sizes.length>=2&&sizes[0].mean>sizes[1].mean&&sizes[0].mean>0){const b=sizes[0];out.push({id:"lots",emoji:"🎯",title:"A lot-size sweet spot?",quote:`${b.size} lots on ${pretty(m.symbol)} has been looking pretty good in your journal. Just a clue, not a sizing rule! 😉`,evidence:`${b.xs.length} trades · ${money(b.mean)} average P&L · same instrument`,count:b.xs.length});break;}
 }
 const dated=ts.filter(t=>/^\d{4}-\d{2}-\d{2}/.test(t.exitDate||""));
 const days=[...group(dated,t=>t.exitDate.slice(0,10))].map(([date,xs])=>({date,xs,pnl:sum(xs)}));
 const weekdays=[...group(days,d=>String(new Date(d.date+"T12:00:00Z").getUTCDay()))].map(([day,xs])=>({day,xs,mean:xs.reduce((s,d)=>s+d.pnl,0)/xs.length})).filter(d=>d.xs.length>=2).sort((a,b)=>b.mean-a.mean);
 if(weekdays.length>=2&&weekdays[0].mean>weekdays[1].mean){const b=weekdays[0];const name=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][Number(b.day)];out.push({id:"weekday",emoji:"📅",title:"Your lucky weekday?",quote:`${name}s seem to be giving you a warmer welcome than the other days. 😎`,evidence:`${b.xs.length} ${name}s · ${money(b.mean)} average daily P&L`,count:b.xs.length});}
 const quiet=days.filter(d=>d.xs.length<=2),busy=days.filter(d=>d.xs.length>=4);
 if(quiet.length>=3&&busy.length>=3){const q=quiet.reduce((s,d)=>s+d.pnl,0)/quiet.length,b=busy.reduce((s,d)=>s+d.pnl,0)/busy.length;if(q>b)out.push({id:"frequency",emoji:"🧘",title:"Less clicking, more winning?",quote:"Your quieter days have been outperforming your busy ones. Maybe less really is more! ✨",evidence:`${quiet.length} quiet days: ${money(q)}/day · ${busy.length} busy days: ${money(b)}/day`,count:Math.min(quiet.length,busy.length)});}
 const wins=ts.filter(t=>t.pnl>0),losses=ts.filter(t=>t.pnl<0);
 if(wins.length>=2&&losses.length>=2){const w=avg(wins),l=-avg(losses);out.push({id:"payoff",emoji:w>=l?"💚":"💸",title:w>=l?"Winners doing the work":"A little profit thief",quote:w>=l?"Your winners have been punching above their weight. Keep an eye on that balance! 💚":"Your losing trades have been taking bigger bites than your winners. Sneaky! 👀",evidence:`Average win ${money(w)} · average loss ${money(l)}`,count:Math.min(wins.length,losses.length)});}
 if(ts.length>=10){const n=Math.floor(ts.length/2),first=ts.slice(0,n),last=ts.slice(-n);if(avg(last)>avg(first))out.push({id:"evolution",emoji:"🚀",title:"Trading glow-up?",quote:"Your recent trades are looking a little sharper than your earlier ones. Plot twist! 🚀",evidence:`Earlier ${n}: ${money(avg(first))}/trade · latest ${n}: ${money(avg(last))}/trade`,count:n});}
 if(days.length>=2){
  const dailyAvg=ts.length/days.length;
  const maxDay=Math.max(...days.map(d=>d.xs.length));
  out.push({id:"daily-frequency",emoji:"📊",title:"Your daily trading rhythm",quote:dailyAvg>3?"Your trading days are pretty busy! Try reviewing whether the later entries are adding value. 👀":dailyAvg>=1.5?"You average a few trades per active day. Keep quality ahead of quantity. 🎯":"One trade at a time? Your journal has a calmer rhythm. 🧘",evidence:`${ts.length} trades across ${days.length} active closing days · ${dailyAvg.toFixed(1)} trades/day · busiest day: ${maxDay}`,count:days.length});
  const best=[...days].sort((a,b)=>b.pnl-a.pnl)[0],net=sum(ts);
  if(net>0&&best.pnl>0){const share=best.pnl/net*100;
   out.push({id:"profit-concentration",emoji:"🛡️",title:"Protect your green days",quote:share>50?"One big day is carrying a lot of your profits. Protect the cushion; don't chase a repeat! 🛡️":"Your profit isn't riding on just one huge day. That's a healthier-looking spread. 💚",evidence:`Best closing day ${money(best.pnl)} · ${share.toFixed(0)}% of ${money(net)} net profit`,count:days.length});
  }
  const redDays=days.filter(d=>d.pnl<0);
  if(redDays.length){const worst=[...redDays].sort((a,b)=>a.pnl-b.pnl)[0];
   out.push({id:"loss-day",emoji:"🚦",title:"Red-day reset",quote:"A red day isn't a challenge to win it all back. Consider a daily stop and protect tomorrow's capital. 🚦",evidence:`${redDays.length} losing closing days out of ${days.length} · worst day ${money(worst.pnl)}`,count:redDays.length});
  }
 }
 const lossesOnly=ts.filter(t=>t.pnl<0),winsOnly=ts.filter(t=>t.pnl>0);
 if(lossesOnly.length){
  const largest=Math.min(...lossesOnly.map(t=>t.pnl)),totalLoss=-sum(lossesOnly);
  out.push({id:"loss-control",emoji:"🧯",title:"Loss control",quote:Math.abs(largest)/totalLoss>=0.4?"One loss accounts for a big slice of your red trades. Consider a pre-set risk limit before entering. 🧯":"Your losses are part of the game; keeping each one contained is the real skill. 🧯",evidence:`${lossesOnly.length} losing trades · largest loss ${money(largest)} · total gross losses ${money(totalLoss)}`,count:lossesOnly.length});
  if(winsOnly.length){const ratio=avg(winsOnly)/(-avg(lossesOnly));
   out.push({id:"reward-risk",emoji:"⚖️",title:"Realized payoff balance",quote:ratio<1?"Your average loss is bigger than your average win. Review exits and loss limits before thinking about bigger lots. ⚖️":"Your average win outweighs your average loss. Keep protecting that balance. ⚖️",evidence:`Average win ${money(avg(winsOnly))} · average loss ${money(-avg(lossesOnly))} · realized payoff ${ratio.toFixed(2)}x (not planned R:R)`,count:Math.min(winsOnly.length,lossesOnly.length)});
  }
 }else if(winsOnly.length>=5){
  out.push({id:"risk-reminder",emoji:"🛡️",title:"Don't skip the seatbelt",quote:"No red trades in this sample? Nice! Still, a winning streak isn't a substitute for a stop-loss plan. 🛡️",evidence:`${winsOnly.length} wins · 0 recorded losses in this sample · actual SL exposure unknown`,count:winsOnly.length});
 }
 if(!out.length)out.push({id:"snapshot",emoji:"👀",title:"Getting to know you",quote:"Your trading story is just getting started. Keep those screenshots coming!",evidence:`${ts.length} recorded trades · ${money(sum(ts))} net P&L`,count:ts.length});
 return out;
}
