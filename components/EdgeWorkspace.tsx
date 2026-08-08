"use client";

import { useMemo, useState } from "react";
import {
  Brain, BookOpenText, CalendarClock, CheckCircle2, CircleAlert, GraduationCap,
  HeartPulse, Newspaper, NotebookPen, Play, ShieldAlert, Sparkles, Target, TimerReset,
  TrendingUp, Zap,
} from "lucide-react";
import type { Account, Trade } from "@/lib/types";
import { LiveNews } from "@/components/LiveNews";
import { AICoach } from "@/components/AICoach";

type WorkspaceProps = { tab: string; accounts: Account[]; trades: Trade[] };
const card = "edge-card";
const storage = { plans: "tradeflow-edge-plans-v1", notes: "tradeflow-edge-notes-v1", state: "tradeflow-edge-state-v1" };

export function EdgeWorkspace({ tab, accounts, trades }: WorkspaceProps) {
  const [risk, setRisk] = useState(1);
  const [stop, setStop] = useState(100);
  const [balance, setBalance] = useState(accounts[0]?.balance || 10000);
  const [plan, setPlan] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem(storage.plans) || "");
  const [note, setNote] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem(storage.notes) || "");
  const [mood, setMood] = useState(() => typeof window === "undefined" ? "Neutral" : localStorage.getItem(storage.state) || "Neutral");
  const [reset, setReset] = useState(false);

  const stats = useMemo(() => {
    const wins = trades.filter(t => t.pnl > 0).length;
    const pnl = trades.reduce((s, t) => s + t.pnl, 0);
    const losses = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
    const gross = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    return { pnl, winRate: trades.length ? wins / trades.length * 100 : 0, pf: losses ? gross / losses : 0, edge: Math.max(0, Math.min(100, 75 + (trades.length ? pnl / Math.max(1, Math.abs(pnl)) * 8 : 0))) };
  }, [trades]);

  if (tab === "Trading") {
    const riskCash = balance * risk / 100;
    const lots = stop > 0 ? riskCash / stop : 0;
    return <section className="edge-workspace"><div className="edge-grid two"><article className={card}><div className="edge-title"><Zap /><div><h2>Trading desk</h2><p>Plan, size and validate the trade before execution.</p></div></div><div className="chart-placeholder"><TrendingUp size={54}/><b>Chart workspace</b><span>Connect TradingView or your broker feed here.</span></div></article><article className={card}><div className="edge-title"><Target /><div><h2>Risk calculator</h2><p>Position sizing is calculated from account risk.</p></div></div><div className="form-grid"><label>Balance<input type="number" value={balance} onChange={e=>setBalance(Number(e.target.value))}/></label><label>Risk %<input type="number" step="0.1" value={risk} onChange={e=>setRisk(Number(e.target.value))}/></label><label>Stop distance<input type="number" value={stop} onChange={e=>setStop(Number(e.target.value))}/></label><label>Risk amount<input readOnly value={`$${riskCash.toFixed(2)}`}/></label></div><div className="result-box"><span>Calculated size</span><strong>{lots.toFixed(2)} units</strong><small>Final lot conversion depends on the connected instrument contract size.</small></div><button className="primary wide">Validate trade</button></article></div><article className={card}><div className="edge-title"><BookOpenText /><div><h2>Active trade plan</h2><p>Keep your setup criteria visible while trading.</p></div></div><textarea value={plan} onChange={e=>setPlan(e.target.value)} placeholder="Bias, setup criteria, invalidation, management rules..."/><button className="primary" onClick={()=>localStorage.setItem(storage.plans, plan)}>Save active plan</button></article></section>;
  }

  if (tab === "Guardrails") return <section className="edge-workspace"><div className="edge-grid three"><Info icon={ShieldAlert} title="Max trades" value="5 / day" text="Stops impulsive overtrading."/><Info icon={CircleAlert} title="Daily loss" value="2.5%" text="Disables execution at your cap."/><Info icon={CalendarClock} title="News blackout" value="Enabled" text="Blocks high-impact event windows."/></div><article className={card}><div className="edge-title"><ShieldAlert/><div><h2>Live enforcement</h2><p>Rule breaks should be blocked before the order, not reviewed after it.</p></div></div><div className="guard-list"><Guard label="Risk per trade" value="1.0%"/><Guard label="Profit cap" value="Not set"/><Guard label="Trading window" value="London + New York"/><Guard label="Override confirmation" value="Required"/></div></article></section>;

  if (tab === "Journal") return <section className="edge-workspace"><article className={card}><div className="edge-title"><BookOpenText/><div><h2>Trade journal</h2><p>Every trade with context, emotion, lesson and review status.</p></div></div><div className="journal-list">{trades.slice(0,8).map(t=><div className="journal-row" key={t.id}><div><b>{t.symbol} · {t.side}</b><small>{new Date(t.closedAt).toLocaleString()} · {t.setup || "No setup tagged"}</small></div><span className={t.pnl>=0?"positive":"negative"}>{t.pnl>=0?"+":""}${t.pnl.toFixed(2)}</span><button>Review</button></div>)}</div></article></section>;

  if (tab === "News") return <LiveNews/>;

  if (tab === "Plan") return <section className="edge-workspace"><article className={card}><div className="edge-title"><Target/><div><h2>Trade plan</h2><p>Define your repeatable setups and session rules.</p></div></div><div className="check-grid"><Check text="Higher-timeframe bias defined"/><Check text="Key levels marked"/><Check text="Setup criteria confirmed"/><Check text="Invalidation defined"/><Check text="Risk fixed before entry"/><Check text="News checked"/></div><textarea value={plan} onChange={e=>setPlan(e.target.value)} placeholder="Write your active trading plan..."/><button className="primary" onClick={()=>localStorage.setItem(storage.plans, plan)}>Save plan</button></article><div className="edge-grid three"><Info icon={CheckCircle2} title="Plan compliance" value="Trackable" text="Compare executed trades with the plan."/><Info icon={TrendingUp} title="Plan performance" value={`${stats.winRate.toFixed(1)}% WR`} text="Measure results by setup and plan."/><Info icon={TimerReset} title="Pre-market routine" value="6 checks" text="Complete before the session starts."/></div></section>;

  if (tab === "Notebook") return <section className="edge-workspace"><article className={card}><div className="edge-title"><NotebookPen/><div><h2>Notebook</h2><p>Save ideas, market observations, lessons and mindset reviews.</p></div></div><textarea className="large-note" value={note} onChange={e=>setNote(e.target.value)} placeholder="Write a review, setup idea, lesson or observation..."/><div className="note-actions"><button>Daily review</button><button>Weekly review</button><button>Setup study</button><button>Mindset</button><button className="primary" onClick={()=>localStorage.setItem(storage.notes,note)}>Save note</button></div></article></section>;

  if (tab === "Sanctuary") return <section className="edge-workspace"><article className={`${card} sanctuary`}><HeartPulse size={42}/><h2>Reset before the next trade</h2><p>Use this when you are angry, rushed, fearful or tempted to revenge trade.</p><div className="mood-row">{["Calm","Neutral","Stressed","Frustrated","Tilted"].map(x=><button key={x} className={mood===x?"selected":""} onClick={()=>{setMood(x);localStorage.setItem(storage.state,x)}}>{x}</button>)}</div><button className="primary" onClick={()=>setReset(v=>!v)}><Play size={16}/>{reset?"Reset complete":"Start 60-second reset"}</button>{reset&&<div className="breathing">Inhale 4s · Hold 4s · Exhale 6s</div>}</article></section>;

  if (tab === "AI Coach") return <AICoach accounts={accounts} trades={trades}/>;

  if (tab === "Academy") return <section className="edge-workspace"><div className="edge-grid three"><Lesson title="Risk management" text="Position sizing, drawdown and survival."/><Lesson title="Execution discipline" text="How to follow a setup without improvising."/><Lesson title="Trade review" text="Turn every closed trade into useful feedback."/></div><article className={card}><div className="edge-title"><GraduationCap/><div><h2>Learning path</h2><p>Structured lessons tied to the workflow inside your journal.</p></div></div><div className="lesson-track"><Check text="Build your trading plan"/><Check text="Set account guardrails"/><Check text="Complete pre-market routine"/><Check text="Review 20 trades"/><Check text="Read weekly performance report"/></div></article></section>;

  return null;
}

function Info({icon:Icon,title,value,text}:{icon:any,title:string,value:string,text:string}) { return <article className={card}><div className="edge-title"><Icon/><div><h3>{title}</h3><strong>{value}</strong></div></div><p>{text}</p></article>; }
function Guard({label,value}:{label:string,value:string}) { return <div className="guard-row"><div><b>{label}</b><small>Active rule</small></div><strong>{value}</strong><span>ON</span></div>; }
function Check({text}:{text:string}) { const [on,setOn]=useState(false); return <button className={`check-row ${on?"done":""}`} onClick={()=>setOn(v=>!v)}><CheckCircle2 size={18}/>{text}</button>; }
function Lesson({title,text}:{title:string,text:string}) { return <article className={card}><GraduationCap/><h3>{title}</h3><p>{text}</p><button>Open lesson</button></article>; }
