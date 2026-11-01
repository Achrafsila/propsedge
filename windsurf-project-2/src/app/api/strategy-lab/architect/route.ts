import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Strategy Architect." }, { status: 401 });
  const key = process.env.GROQ_API_KEY;
  if (!key || key.includes("[SENSITIVE]")) return NextResponse.json({ error: "AI key unavailable locally. Add a development GROQ_API_KEY to .env.local, then restart Props Edge." }, { status: 503 });
  let body: { description?: unknown; clarification?: unknown; answeredQuestions?: unknown; round?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 6000) : "";
  if (description.length < 40) return NextResponse.json({ error: "Describe your strategy in a little more detail (at least 40 characters)." }, { status: 400 });
  const clarification = typeof body.clarification === "string" ? body.clarification.trim().slice(0, 4000) : "";
  const answeredQuestions = Array.isArray(body.answeredQuestions) ? body.answeredQuestions.filter((x:unknown)=>typeof x==="string").slice(0,12) : [];
  const round = Math.max(0, Math.min(5, Number(body.round)||0));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const models = ["openai/gpt-oss-20b", "llama-3.3-70b-versatile"];
    let response: Response | undefined;
    let lastCode = "unknown";
    let lastStatus = 502;
    for (const model of models) {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.1, max_completion_tokens: 3000, reasoning_effort: model.startsWith("openai/") ? "low" : undefined, messages: [
          { role: "system", content: `You are Strategy Architect, an expert in translating ANY trading methodology into an actionable, testable playbook through a context-sensitive interview. Strategies may use price action, indicators, divergence, news, breakout, mean reversion, discretionary signals, or other techniques. NEVER assume a specific method. Identify known facts and true decision-blocking ambiguities. Do not ask optional questions (e.g. additional risk rules) or questions already answered. Treat BUY and SELL as possible examples of trade direction, not as the framework for understanding a strategy. Do not force symmetry, two scenarios, or ask which direction the trader trades. Preserve explicitly directional rules only if essential to the method. Distinguish setup/location from actual entry trigger. Never invent indicators, confirmation signals, targets, break-even or exits.
Return ONLY valid JSON: {name:string,instrument:string,session:string,contextTf:string,executionTf:string,beTrigger:number|null,summary:string,contextRules:string[],setupRules:string[],confirmationRules:string[],entryRules:string[],managementRules:string[],managementEvidence:[{rule:string,quote:string}],questions:[{id:string,question:string,selection:"single"|"multiple",options:[{id:string,label:string}]}],missing:string[]}.
Questions MUST be generated specifically from THIS trader's description, not generic predefined questions. Each question offers 2-5 meaningful mutually distinct options (including an option "Other / specify"), in the trader's language. Ask AT MOST ONE question TOTAL across the entire interview, and only if the precise ENTRY TRIGGER is not objectively testable. If no blocking entry ambiguity, questions MUST be []. Never ask about instrument, swing definitions, indicators, additional confluence, risk preferences, exit enhancements, or details already present. Never suggest new indicators or techniques not named by the trader. Options are suggestions, not facts. Never ask the same semantic question again even if worded differently. Respect previous answers as authoritative. If clarification has been provided or interview round > 0, questions MUST be [] and missing=[]. After sufficient clarity questions=[] and missing=[]. Do not force questions merely to fill a quota. Produce contextRules (market bias), setupRules (levels, confluence, retracement), confirmationRules (observable entry trigger), and entryRules (actual execution conditions only), each as short, observable conditions based on the trader’s own method. For a directional example in a general method, write conditions relative to the trader’s bias or signal, without adding mirror scenarios. Do not mention BUY/SELL unless the method explicitly depends on the distinction. Do not invent any entry timing. managementRules MUST include ONLY rules explicitly stated in the trader description or answers. For EVERY managementRule provide an exact literal substring from trader input in managementEvidence with matching rule and quote. No evidence means omit the management rule entirely. Stop loss and minimum RR are valid only if directly stated. Never introduce trailing stop, partial profits, break-even or extra SL adjustments without explicit evidence. Max 4 contextRules, 4 setupRules, 3 confirmationRules, 3 entryRules, and 4 managementRules, each one observable condition. Clearly distinguish inferred assumptions from confirmed rules in summary. Keep all generated text in the language of the original description. Output session Asia/London/New York/Any, contextTf H4/H1/M30/M15/M5, executionTf M15/M5/M1. Use Other for unknown instrument; null for unspecified break-even. Never claim a profitable edge.` },
          { role: "user", content: `${description}\n\nClarifications already provided by trader (authoritative):\n${clarification || "None"}\n\nQuestions already answered or dismissed (NEVER ask again):\n${answeredQuestions.join("\n") || "None"}\n\nInterview round: ${round}. ${round >= 4 ? "Finish the playbook now without further questions; flag unresolved information as unspecified, never fabricate it." : "Only ask ONE question about the exact entry trigger if it is too vague to backtest; otherwise return no questions."}` }
        ] })
      });
      if (response.ok) break;
      lastStatus = response.status;
      try { const detail = await response.json(); lastCode = String(detail?.error?.code || detail?.error?.type || "unknown").slice(0, 60); } catch { lastCode = "unknown"; }
      console.error("Strategy Architect upstream failure", { model, status: lastStatus, code: lastCode });
      if (response.status !== 404 || lastCode !== "model_not_found") break;
    }
    if (!response?.ok) {
      const reason = lastStatus === 401 ? "API key rejected" : lastStatus === 403 ? "Model or project access denied" : lastStatus === 429 ? "Request limit reached" : lastStatus === 400 ? "Model rejected the request" : lastStatus >= 500 ? "AI provider temporarily unavailable" : "AI request failed";
      return NextResponse.json({ error: `${reason} (${lastStatus}, ${lastCode}).`, status: lastStatus, code: lastCode }, { status: 502 });
    }
    const raw = await response.json();
    const content = String(raw.choices?.[0]?.message?.content || "").trim();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(content);
    } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start < 0 || end <= start) return NextResponse.json({ error: "The AI response could not be structured. Please retry." }, { status: 502 });
      try { result = JSON.parse(content.slice(start, end + 1)); }
      catch { return NextResponse.json({ error: "The AI response could not be structured. Please retry." }, { status: 502 }); }
    }
    const clean = (v: unknown, max: number) => Array.isArray(v) ? v.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0,max).map((x: string) => x.trim().slice(0, 140)) : [];
    const contextRules = clean(result.contextRules, 4);
    const setupRules = clean(result.setupRules, 4);
    const confirmationRules = clean(result.confirmationRules, 3);
    const entryRules = clean(result.entryRules, 3);
    const sourceText = `${description}\n${clarification}`.toLocaleLowerCase();
    const evidence = Array.isArray(result.managementEvidence) ? result.managementEvidence : [];
    const managementRules = clean(result.managementRules, 4).filter((rule:string) => evidence.some((item:Record<string,unknown>) => item && item.rule === rule && typeof item.quote === "string" && item.quote.trim().length >= 4 && sourceText.includes(item.quote.trim().toLocaleLowerCase())));
    const rules = [...contextRules, ...setupRules, ...confirmationRules, ...entryRules, ...managementRules];
    if (!rules.length) return NextResponse.json({ error: "No actionable rules found. Please add more detail." }, { status: 422 });
    const pick = (v: unknown, allowed: string[], fallback: string) => allowed.includes(String(v)) ? String(v) : fallback;
    return NextResponse.json({ name: String(result.name || "My Strategy").slice(0, 100), instrument: String(result.instrument || "Other").slice(0, 40), session: pick(result.session, ["Asia","London","New York","Any"], "Any"), contextTf: pick(result.contextTf, ["H4","H1","M30","M15","M5"], "H1"), executionTf: pick(result.executionTf, ["M15","M5","M1"], "M1"), beTrigger: result.beTrigger !== null && result.beTrigger !== undefined && [1,1.5,2].includes(Number(result.beTrigger)) ? Number(result.beTrigger) : null, rules, contextRules, setupRules, confirmationRules, entryRules, managementRules, summary: String(result.summary || "").slice(0, 400), missing: [], questions: round >= 1 || clarification ? [] : Array.isArray(result.questions) ? result.questions.filter((q:Record<string,unknown>)=>/entrée|entrer|entry|trigger|signal|confirmation|réaction|reaction/i.test(String(q.question||"")) && !/instrument|indicateur|indicator|swing|risk|risque|sortie|exit|target|objectif|confluence/i.test(String(q.question||""))).slice(0,1).map((q:Record<string,unknown>,i:number)=>({id:String(q.id||`question-${round}-${i}`).slice(0,80),question:String(q.question||"").slice(0,220),selection:q.selection==="multiple"?"multiple":"single",options:Array.isArray(q.options)?q.options.slice(0,6).filter((o:Record<string,unknown>)=>o&&typeof o.label==="string").map((o:Record<string,unknown>,j:number)=>({id:String(o.id||j),label:String(o.label).slice(0,110)})):[]})).filter((q:{question:string;options:unknown[]})=>q.question&&q.options.length>=2) : [], directionMode: "unconfirmed" });
  } catch { return NextResponse.json({ error: "AI generation failed. Please try again." }, { status: 502 }); }
  finally { clearTimeout(timeout); }
}
