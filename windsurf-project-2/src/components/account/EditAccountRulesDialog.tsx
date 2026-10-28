"use client";
import {useEffect,useState} from "react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useAccounts} from "@/context/AccountsContext";
import {toast} from "sonner";
import type {Challenge,FundedAccount} from "@/types";
import {parseConsistencyLimitPercent} from "@/lib/analytics/payoutEligibility";
export function EditAccountRulesDialog({open,onOpenChange,account,accountType}:{open:boolean;onOpenChange:(open:boolean)=>void;account:Challenge|FundedAccount;accountType:"challenge"|"funded"}){
 const {updateChallenge,updateFundedAccount}=useAccounts();
 const [name,setName]=useState("");
 const [drawdown,setDrawdown]=useState("");
 const [dailyDrawdown,setDailyDrawdown]=useState("");
 const [target,setTarget]=useState("");
 const [choice,setChoice]=useState<"limit"|"none">("none");
 const [limit,setLimit]=useState("");
 useEffect(()=>{if(!open)return;
  setName(account.accountName);
  setDrawdown(String(account.maxDrawdown??""));
  if(accountType==="challenge"){
   const c=account as Challenge;setDailyDrawdown(c.dailyDrawdown==null?"":String(c.dailyDrawdown));setTarget(String(c.profitTarget??""));
   const v=parseConsistencyLimitPercent(c.consistencyRule);setChoice(v?"limit":"none");setLimit(v?String(v):"");
  }else{
   const f=account as FundedAccount;const c=f.payoutRules.consistency;
   setChoice(c.required?"limit":"none");setLimit(c.limitPercent==null?"":String(c.limitPercent));
  }
 },[open,account,accountType]);
 const valid=!!name.trim() && drawdown.trim()!=="" && Number.isFinite(Number(drawdown)) && Number(drawdown)>0 && (choice==="none" || (limit.trim()!=="" && Number(limit)>0 && Number(limit)<100))
  && (accountType==="funded" || ((dailyDrawdown==="" || (Number(dailyDrawdown)>=0&&Number.isFinite(Number(dailyDrawdown)))) && target!=="" && Number(target)>=0));
 function save(){
  if(!valid)return;
  const common={accountName:name.trim(),maxDrawdown:Number(drawdown)};
  if(accountType==="challenge"){
   updateChallenge(account.id,{...common,dailyDrawdown:dailyDrawdown===""?null:Number(dailyDrawdown),profitTarget:Number(target),consistencyRule:choice==="limit"?`${limit}%`:null});
  }else{
   const f=account as FundedAccount;
   updateFundedAccount(account.id,{...common,payoutRules:{...f.payoutRules,consistency:{required:choice==="limit",limitPercent:choice==="limit"?Number(limit):undefined}}});
  }
  toast.info("Account rules updated. Check account figures and broker conditions.");
  onOpenChange(false);
 }
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto border-white/15 bg-[#0b1425] text-white sm:max-w-lg">
 <DialogHeader><DialogTitle>Edit Account Rules</DialogTitle></DialogHeader>
 <p className="text-xs text-slate-400">Correct stored account configuration. Trades, payouts and current balances are preserved. Verify the firm limits before saving.</p>
 <div className="space-y-3">
 <label className="block text-xs text-slate-300">Account name<Input value={name} onChange={e=>setName(e.target.value)} className="mt-1 bg-[#131e31] text-white"/></label>
 <label className="block text-xs text-slate-300">Max drawdown (same units as current account)<Input type="number" min="0.01" step="any" value={drawdown} onChange={e=>setDrawdown(e.target.value)} className="mt-1 bg-[#131e31] text-white"/></label>
 {accountType==="challenge"&&<>
 <label className="block text-xs text-slate-300">Daily drawdown (optional)<Input type="number" min="0" step="any" value={dailyDrawdown} onChange={e=>setDailyDrawdown(e.target.value)} className="mt-1 bg-[#131e31] text-white"/></label>
 <label className="block text-xs text-slate-300">Profit target ($)<Input type="number" min="0" step="any" value={target} onChange={e=>setTarget(e.target.value)} className="mt-1 bg-[#131e31] text-white"/></label></>}
 <div className="rounded-xl border border-cyan-400/20 p-3"><Label>Consistency rule</Label>
 <select value={choice} onChange={e=>setChoice(e.target.value as "limit"|"none")} className="mt-2 min-h-11 w-full rounded-lg border border-white/20 bg-[#131e31] px-3 text-sm"><option value="none">No consistency</option><option value="limit">Consistency limit (%)</option></select>
 {choice==="limit"&&<label className="mt-3 block text-xs text-slate-300">Limit (%)<Input type="number" min="0.1" max="99.9" step="0.1" value={limit} onChange={e=>setLimit(e.target.value)} className="mt-1 bg-[#131e31] text-white"/></label>}</div>
 </div>
 <DialogFooter><Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button><Button type="button" disabled={!valid} onClick={save} className="bg-cyan-600 hover:bg-cyan-500">Save changes</Button></DialogFooter>
 </DialogContent></Dialog>;
}
