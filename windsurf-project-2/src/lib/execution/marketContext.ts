export type OHLC = {time:number;open:number;high:number;low:number;close:number};
export type MarketContext = {trend:"bullish"|"bearish"|"ranging";structure:"HH/HL"|"LH/LL"|"mixed";phase:"trending"|"ranging"|"volatile";atr:number;last:number;support:number;resistance:number;asOf:number;confidence:number};
export function analyzeMarketContext(raw:OHLC[]):MarketContext|null {
 const sorted=[...raw].filter(c=>Number.isFinite(c.time)&&[c.open,c.high,c.low,c.close].every(Number.isFinite)&&c.high>=Math.max(c.open,c.close,c.low)&&c.low<=Math.min(c.open,c.close,c.high)&&c.low>0).sort((a,b)=>a.time-b.time);
 const unique=sorted.filter((c,i)=>i===0||c.time!==sorted[i-1].time);
 const c=unique.slice(0,-1); // exclude potentially forming bar
 if(c.length<60)return null;
 const pivotHighs:number[]=[],pivotLows:number[]=[];
 for(let i=2;i<c.length-2;i++){
   if(c[i].high>c[i-1].high&&c[i].high>c[i-2].high&&c[i].high>=c[i+1].high&&c[i].high>=c[i+2].high)pivotHighs.push(c[i].high);
   if(c[i].low<c[i-1].low&&c[i].low<c[i-2].low&&c[i].low<=c[i+1].low&&c[i].low<=c[i+2].low)pivotLows.push(c[i].low);
 }
 const h=pivotHighs.slice(-2),l=pivotLows.slice(-2);
 const up=h.length===2&&l.length===2&&h[1]>h[0]&&l[1]>l[0];
 const down=h.length===2&&l.length===2&&h[1]<h[0]&&l[1]<l[0];
 const structure=up?"HH/HL":down?"LH/LL":"mixed";
 let trueRange=0;
 for(let i=c.length-14;i<c.length;i++){trueRange+=Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close));}
 const atr=trueRange/14,last=c[c.length-1].close;
 const recent=c.slice(-20),support=Math.min(...recent.map(x=>x.low)),resistance=Math.max(...recent.map(x=>x.high));
 const relativeRange=(resistance-support)/last;
 const phase=atr/last>0.008?"volatile":relativeRange<0.008?"ranging":"trending";
 const trend=up?"bullish":down?"bearish":"ranging";
 return {trend,structure,phase,atr,last,support,resistance,asOf:c[c.length-1].time,confidence:up||down?65:35};
}
