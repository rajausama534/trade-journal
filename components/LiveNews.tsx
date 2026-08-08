"use client";

import { useEffect, useMemo, useState } from "react";
import { Newspaper, RefreshCw, ShieldAlert } from "lucide-react";

type Event = { id:string; date:string; country:string; event:string; actual:string|null; forecast:string|null; previous:string|null; importance:number; currency:string; source:string };

export function LiveNews() {
  const [events,setEvents]=useState<Event[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("all");

  async function load(){
    setLoading(true); setError("");
    try { const r=await fetch("/api/news/calendar?importance=2",{cache:"no-store"}); const j=await r.json(); if(!r.ok) throw new Error(j.error||"Calendar request failed"); setEvents(j.events||[]); }
    catch(e:any){setError(e.message||"Calendar request failed");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load()},[]);

  const shown=useMemo(()=>events.filter(e=>filter==="all" || e.country?.toLowerCase().includes(filter)),[events,filter]);
  return <section className="edge-workspace">
    <div className="edge-grid two">
      <article className="edge-card"><div className="edge-title"><Newspaper/><div><h2>Economic calendar</h2><p>Live macro events from the configured provider.</p></div></div><strong>{loading?"Loading…":`${shown.length} events`}</strong></article>
      <article className="edge-card"><div className="edge-title"><ShieldAlert/><div><h2>News guardrail</h2><p>Use high-impact events as blackout windows before execution.</p></div></div><strong>30m before / after</strong></article>
    </div>
    <article className="edge-card">
      <div className="panel-head"><div><h2>Upcoming releases</h2><p>Actual, forecast and previous values update from the live feed.</p></div><div style={{display:"flex",gap:8}}><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All</option><option value="united states">United States</option><option value="euro">Euro Area</option><option value="united kingdom">United Kingdom</option></select><button onClick={load}><RefreshCw size={15}/> Refresh</button></div></div>
      {error&&<div className="result-box"><b>Calendar not connected</b><small>{error}</small></div>}
      {!error&&<div className="journal-list">{shown.slice(0,80).map(e=><div className="journal-row" key={e.id}><div><b>{e.event}</b><small>{new Date(e.date).toLocaleString()} · {e.country} · Impact {e.importance}</small></div><span>{e.actual??"—"} / {e.forecast??"—"}</span><small>Prev {e.previous??"—"}</small></div>)}</div>}
    </article>
  </section>;
}
