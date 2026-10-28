import type {OHLC} from "./marketContext";
export type StructureEvent = {kind:"bullish-sweep"|"bearish-sweep"|"bullish-bos"|"bearish-bos"|"bullish-mss"|"bearish-mss";time:number;level:number};
export type LiquidityStructure = {events:StructureEvent[];lastHigh:number|null;lastLow:number|null;bias:"bullish"|"bearish"|"mixed";lastEvent:StructureEvent|null};
export function analyzeLiquidityStructure(candles:OHLC[]):LiquidityStructure {
 const valid=[...candles].filter(c=>Number.isFinite(c.time)&&[c.open,c.high,c.low,c.close].every(Number.isFinite)&&c.low>0&&c.high>=c.low).sort((a,b)=>a.time-b.time).slice(0,-1);
 const highs:{i:number;price:number}[]=[], lows:{i:number;price:number}[]=[],events:StructureEvent[]=[];
 if(valid.length<15)return {events,lastHigh:null,lastLow:null,bias:"mixed",lastEvent:null};
 for(let i=2;i<valid.length-2;i++){
  const c=valid[i];
  if(c.high>valid[i-1].high&&c.high>valid[i-2].high&&c.high>=valid[i+1].high&&c.high>=valid[i+2].high)highs.push({i,price:c.high});
  if(c.low<valid[i-1].low&&c.low<valid[i-2].low&&c.low<=valid[i+1].low&&c.low<=valid[i+2].low)lows.push({i,price:c.low});
 }
 let priorBias:"bullish"|"bearish"|"mixed"="mixed";
 for(let i=10;i<valid.length;i++){
  const top=[...highs].reverse().find(p=>p.i<=i-3);
  const bottom=[...lows].reverse().find(p=>p.i<=i-3);
  const c=valid[i],previous=valid[i-1];
  if(top&&c.high>top.price&&c.close<top.price&&previous.close<=top.price)events.push({kind:"bearish-sweep",time:c.time,level:top.price});
  if(bottom&&c.low<bottom.price&&c.close>bottom.price&&previous.close>=bottom.price)events.push({kind:"bullish-sweep",time:c.time,level:bottom.price});
  if(top&&c.close>top.price&&previous.close<=top.price){
   events.push({kind:priorBias==="bearish"?"bullish-mss":"bullish-bos",time:c.time,level:top.price});priorBias="bullish";
  }
  if(bottom&&c.close<bottom.price&&previous.close>=bottom.price){
   events.push({kind:priorBias==="bullish"?"bearish-mss":"bearish-bos",time:c.time,level:bottom.price});priorBias="bearish";
  }
 }
 const recent=events.filter(e=>e.time>=valid[Math.max(0,valid.length-30)].time);
 return {events:recent.slice(-12),lastHigh:highs.at(-1)?.price??null,lastLow:lows.at(-1)?.price??null,bias:priorBias,lastEvent:recent.at(-1)??null};
}
