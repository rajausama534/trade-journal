"use client";

import { FormEvent, useMemo, useState } from "react";
import { Brain, Sparkles, Target } from "lucide-react";
import type { Account, Trade } from "@/lib/types";

export function AICoach({accounts,trades}:{accounts:Account[];trades:Trade[]}){
  const [question,setQuestion]=useState("What pattern is hurting my results most?");
  const [answer,setAnswer]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const stats=useMemo(()=>{const pnl=trades.reduce((s,t)=>s+t.pnl,0);const wins=trades.filter(t=>t.pnl>0).length;return{pnl,wr:trades.length?wins/trades.length*100:0}},[trades]);

  async function ask(e?:FormEvent){e?.preventDefault();setLoading(true);setError("");setAnswer("");try{const r=await fetch("/api/ai/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,account:accounts[0]||null,trades:trades.slice(0,100)})});const j=await r.json();if(!r.ok)throw new Error(j.error||"AI request failed");setAnswer(j.answer||"");}catch(e:any){setError(e.message||"AI request failed")}finally{setLoading(false)}}

  return <section className="edge-workspace">
    <div className="edge-grid three"><Info icon={Sparkles} title="Performance" value={`${stats.pnl>=0?"+":""}$${stats.pnl.toFixed(0)}`}/><Info icon={Brain} title="Win rate" value={`${stats.wr.toFixed(1)}%`}/><Info icon={Target} title="Journal depth" value={`${trades.length} trades`}/></div>
    <article className="edge-card"><div className="edge-title"><Brain/><div><h2>AI trading coach</h2><p>Analyzes only your supplied account and journal data.</p></div></div>{answer&&<div className="ai-box"><span>Coach response</span><p style={{whiteSpace:"pre-wrap"}}>{answer}</p></div>}{error&&<div className="result-box"><b>AI not connected</b><small>{error}</small></div>}<form className="ai-input" onSubmit={ask}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about your trading..."/><button className="primary" disabled={loading||!question.trim()}>{loading?"Analyzing…":"Ask"}</button></form></article>
  </section>;
}
function Info({icon:Icon,title,value}:{icon:any;title:string;value:string}){return <article className="edge-card"><div className="edge-title"><Icon/><div><h3>{title}</h3><strong>{value}</strong></div></div></article>}
