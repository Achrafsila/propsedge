"use client";

export type Bar = {time:number;open:number;high:number;low:number;close:number};
export type Setup = {side:1|-1;entry:number;sl:number;tp:number;title:string;reason:string};
export type DecisionBriefData = {action:"WAIT"|"NO TRADE";technical:string;bull:string;bear:string;risk:string;trigger:string;fresh:boolean};

// Deterministic pre-trade arbitration, inspired by multi-agent research roles.
// Never asks an LLM to infer a price, fill, market event or confirmed breakout.
export function evaluateDecision(bars:Bar[],selected:Setup|null,updatedAt:string):DecisionBriefData {
 const age=Date.now()-Date.parse(updatedAt);
 const fresh=bars.length>=25 && Number.isFinite(age) && age>=0 && age<=600000;
 const base={action:"WAIT" as const,technical:"Analyse en attente de bougies clôturées.",bull:"Aucun argument acheteur établi.",bear:"Aucun argument vendeur établi.",risk:"Aucune exécution ne peut être validée sans données fraîches.",trigger:"Attendre des données fiables.",fresh};
 if(!fresh)return {...base,action:"NO TRADE"};
 const closed=bars.slice(0,-1);const last=closed.at(-1)!;const previous=closed.slice(-11,-1);
 const high=Math.max(...previous.map(x=>x.high)),low=Math.min(...previous.map(x=>x.low));
 const closes=closed.map(x=>x.close);
 const avg=(n:number)=>closes.slice(-n).reduce((a,b)=>a+b,0)/n;
 const ma20=avg(20),momentum=last.close-closed.at(-4)!.close;
 const bull=last.close>ma20 && momentum>0;
 const bear=last.close<ma20 && momentum<0;
 const technical=`Clôture ${last.close.toFixed(2)} · MA20 ${ma20.toFixed(2)} · range précédent ${low.toFixed(2)}–${high.toFixed(2)}.`;
 const risk=selected ? (()=>{const distance=(selected.entry-selected.sl)*selected.side;const reward=(selected.tp-selected.entry)*selected.side;return distance>0&&reward>0?`Risque ${distance.toFixed(2)} $/oz, ratio théorique 1:${(reward/distance).toFixed(2)}. Taille de position et limites prop firm à vérifier.`:"NO TRADE : SL/TP incohérents."})():"Sélectionne un setup pour calculer son risque théorique. Aucune exposition broker vérifiée.";
 return {action:"WAIT",fresh,technical,bull:bull?"Momentum positif et clôture au-dessus de la moyenne courte.":`Arguments haussiers insuffisants : ${last.close<=ma20?"prix sous moyenne courte":"momentum non confirmé"}.`,bear:bear?"Momentum négatif et clôture sous la moyenne courte.":`Arguments baissiers insuffisants : ${last.close>=ma20?"prix au-dessus de la moyenne courte":"momentum non confirmé"}.`,risk,trigger:selected?`WATCHING ${selected.side===1?"BUY":"SELL"} à ${selected.entry.toFixed(2)} : attendre cassure, clôture et retest confirmés. Aucun signal READY n'est produit par ce moteur.`:"Sélectionne une proposition, puis attends une confirmation de structure."};
}

export default function DecisionBrief({value}:{value:DecisionBriefData}) {
 return <section className="space-y-3 rounded-xl border border-violet-400/20 bg-violet-400/[.045] p-3" aria-label="Decision review">
  <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-white">Edge Pilot · Decision Review</h3><span className="rounded-md bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-200">{value.action}</span></div>
  <p className="text-xs text-slate-200">{value.technical}</p>
  <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-emerald-400/15 p-2"><p className="mb-1 text-[10px] font-bold text-emerald-300">BULL CASE</p><p className="text-xs text-slate-300">{value.bull}</p></div><div className="rounded-lg border border-rose-400/15 p-2"><p className="mb-1 text-[10px] font-bold text-rose-300">BEAR CASE</p><p className="text-xs text-slate-300">{value.bear}</p></div></div>
  <p className="text-xs text-amber-100"><strong>Risk Guardian · </strong>{value.risk}</p><p className="text-xs text-cyan-200">{value.trigger}</p>
  <p className="text-[10px] text-slate-500">Arbitrage déterministe expérimental sur bougies Twelve Data. Ni signal IA confirmé ni conseil d'exécution.</p>
 </section>;
}
