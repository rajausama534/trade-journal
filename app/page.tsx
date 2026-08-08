"use client";

import "./edge.css";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity, BarChart3, BookOpen, Brain, CalendarDays, ChevronDown, CircleDollarSign,
  GraduationCap, HeartPulse, LayoutDashboard, Menu, Newspaper, NotebookPen, Plus,
  Settings, ShieldAlert, Target, TrendingUp, WalletCards, X, Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "@/components/MetricCard";
import { TradeModal } from "@/components/TradeModal";
import { AuthScreen } from "@/components/AuthScreen";
import { AccountModal } from "@/components/AccountModal";
import { RuleCenter } from "@/components/RuleCenter";
import { EdgeWorkspace } from "@/components/EdgeWorkspace";
import { accounts as starterAccounts, trades as seedTrades } from "@/lib/sample-data";
import { Account, NewTrade, Trade } from "@/lib/types";
import { isDemoMode, supabase } from "@/lib/supabase";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const workflowTabs = [
  ["Trading", Zap], ["Guardrails", ShieldAlert], ["Journal", BookOpen], ["Dashboard", LayoutDashboard],
  ["News", Newspaper], ["Plan", Target], ["Notebook", NotebookPen], ["Sanctuary", HeartPulse],
  ["AI Coach", Brain], ["Academy", GraduationCap],
] as const;
const managementTabs = [["Accounts", WalletCards], ["Analytics", BarChart3], ["Calendar", CalendarDays], ["Settings", Settings]] as const;

export default function Home() {
  const [tab, setTab] = useState("Dashboard");
  const [trades, setTrades] = useState<Trade[]>(isDemoMode ? seedTrades : []);
  const [accounts, setAccounts] = useState<Account[]>(isDemoMode ? starterAccounts : []);
  const [activeAccountId, setActiveAccountId] = useState("all");
  const [tradeModal, setTradeModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [nav, setNav] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [calendarOffset, setCalendarOffset] = useState(0);

  const visibleTrades = useMemo(() => activeAccountId === "all" ? trades : trades.filter(t => t.accountId === activeAccountId), [trades, activeAccountId]);
  const visibleAccounts = useMemo(() => activeAccountId === "all" ? accounts : accounts.filter(a => a.id === activeAccountId), [accounts, activeAccountId]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setLoading(false); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [ar, tr] = await Promise.all([
        supabase.from("accounts").select("*").order("created_at"),
        supabase.from("trades").select("*").order("closed_at", { ascending: false }),
      ]);
      if (ar.error || tr.error) return;
      setAccounts((ar.data || []).map(x => ({ id: x.id, name: x.name, firm: x.firm, platform: x.platform, balance: Number(x.balance), startingBalance: Number(x.starting_balance), dailyLimit: Number(x.daily_limit), maxLimit: Number(x.max_limit), status: x.connection_status })));
      setTrades((tr.data || []).map(x => ({ id: x.id, accountId: x.account_id, symbol: x.symbol, side: x.side, lots: Number(x.lots), entry: Number(x.entry), exit: Number(x.exit), sl: Number(x.stop_loss || 0), tp: Number(x.take_profit || 0), openedAt: x.opened_at, closedAt: x.closed_at, pnl: Number(x.pnl), setup: x.setup || "", notes: x.notes || "" })));
    })();
  }, [user]);

  const stats = useMemo(() => {
    const pnl = visibleTrades.reduce((s, t) => s + t.pnl, 0);
    const wins = visibleTrades.filter(t => t.pnl > 0);
    const losses = visibleTrades.filter(t => t.pnl < 0);
    const gross = wins.reduce((s, t) => s + t.pnl, 0);
    const lost = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    return { pnl, wins: wins.length, rate: visibleTrades.length ? wins.length / visibleTrades.length * 100 : 0, pf: lost ? gross / lost : 0, avg: visibleTrades.length ? pnl / visibleTrades.length : 0 };
  }, [visibleTrades]);

  const chart = useMemo(() => [...visibleTrades].sort((a,b)=>a.closedAt.localeCompare(b.closedAt)).reduce<{date:string;pnl:number}[]>((a,t)=>{ a.push({date:new Date(t.closedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}),pnl:(a.at(-1)?.pnl||0)+t.pnl}); return a; },[]),[visibleTrades]);

  const calendar = useMemo(() => {
    const latest = visibleTrades.length ? new Date(Math.max(...visibleTrades.map(t => new Date(t.closedAt).getTime()))) : new Date();
    const month = new Date(latest.getFullYear(), latest.getMonth() + calendarOffset, 1);
    const daily = new Map<string,{pnl:number;count:number}>();
    for (const t of visibleTrades) { const d=new Date(t.closedAt); const key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; const v=daily.get(key)||{pnl:0,count:0}; v.pnl+=t.pnl; v.count++; daily.set(key,v); }
    const first=month.getDay(), days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(), prev=new Date(month.getFullYear(),month.getMonth(),0).getDate();
    const cells=Array.from({length:42},(_,i)=>{ const day=i-first+1; const date=day<1?new Date(month.getFullYear(),month.getMonth()-1,prev+day):day>days?new Date(month.getFullYear(),month.getMonth()+1,day-days):new Date(month.getFullYear(),month.getMonth(),day); const key=`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; return {date,day:date.getDate(),current:date.getMonth()===month.getMonth(),data:daily.get(key)}; });
    return { month, cells };
  }, [visibleTrades, calendarOffset]);

  async function addTrade(t: NewTrade) {
    if (supabase && user) {
      const { data, error } = await supabase.from("trades").insert({ user_id:user.id, account_id:t.accountId, symbol:t.symbol, side:t.side, lots:t.lots, entry:t.entry, exit:t.exit, stop_loss:t.sl, take_profit:t.tp, opened_at:t.openedAt, closed_at:t.closedAt, pnl:t.pnl, setup:t.setup, notes:t.notes }).select("id").single();
      if (error) return alert(error.message);
      setTrades(v => [{ ...t, id:data.id }, ...v]);
    } else setTrades(v => [{ ...t, id:crypto.randomUUID() }, ...v]);
    setTradeModal(false);
  }

  async function saveAccount(a: Omit<Account,"id">) {
    if (editingAccount) {
      if (supabase && user) { const { error } = await supabase.from("accounts").update({ name:a.name, firm:a.firm, platform:a.platform, balance:a.balance, starting_balance:a.startingBalance, daily_limit:a.dailyLimit, max_limit:a.maxLimit, connection_status:a.status }).eq("id",editingAccount.id).eq("user_id",user.id); if (error) return alert(error.message); }
      setAccounts(v=>v.map(x=>x.id===editingAccount.id?{...a,id:x.id}:x)); setEditingAccount(undefined); return;
    }
    if (supabase && user) { const { data,error }=await supabase.from("accounts").insert({user_id:user.id,name:a.name,firm:a.firm,platform:a.platform,balance:a.balance,starting_balance:a.startingBalance,daily_limit:a.dailyLimit,max_limit:a.maxLimit,connection_status:a.status}).select("id").single(); if(error)return alert(error.message); setAccounts(v=>[...v,{...a,id:data.id}]); }
    else setAccounts(v=>[...v,{...a,id:crypto.randomUUID()}]);
    setAccountModal(false);
  }

  if (loading) return <main className="auth"><section><p>Loading your journal…</p></section></main>;
  if (!isDemoMode && !user) return <AuthScreen />;

  const useEdgeWorkspace = ["Trading","Guardrails","Journal","News","Plan","Notebook","Sanctuary","AI Coach","Academy"].includes(tab);

  return <div className="app">
    <aside className={nav ? "open" : ""}>
      <div className="brand"><div><Activity /></div><b>Trade<span>Flow</span></b><button onClick={()=>setNav(false)}><X/></button></div>
      <div className="workspace-nav-group">Trading workflow</div>
      <nav>{workflowTabs.map(([name,Icon])=><button key={name} className={tab===name?"selected":""} onClick={()=>{setTab(name);setNav(false)}}><Icon size={18}/>{name}</button>)}</nav>
      <div className="nav-divider"/><div className="workspace-nav-group">Manage</div>
      <nav>{managementTabs.map(([name,Icon])=><button key={name} className={tab===name?"selected":""} onClick={()=>{setTab(name);setNav(false)}}><Icon size={18}/>{name}</button>)}</nav>
      <div className="aside-foot"><div className="avatar">UR</div><div><b>Usama Raja</b><small>Trader</small></div><ChevronDown size={16}/></div>
    </aside>

    <main>
      <header className="top"><button className="mobile-menu" onClick={()=>setNav(true)}><Menu/></button><div><h1>{tab}</h1><p>{tab==="Dashboard"?"Your performance, discipline and account health in one view.":`Your ${tab.toLowerCase()} workspace.`}</p></div><div className="top-actions"><select aria-label="Active account" value={activeAccountId} onChange={e=>setActiveAccountId(e.target.value)} style={{background:"#111827",color:"white",border:"1px solid #29334a",borderRadius:10,padding:"10px 12px"}}><option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>{isDemoMode&&<span className="demo">Sample data</span>}<button className="primary" onClick={()=>accounts.length?setTradeModal(true):setAccountModal(true)}><Plus size={17}/>Add trade</button></div></header>

      {tab==="Dashboard" && <>
        <div className="workflow-banner"><div className="workflow-step"><small>1 · Prepare</small><b>Plan + pre-market checklist</b></div><div className="workflow-step"><small>2 · Execute</small><b>Risk sizing + guardrails</b></div><div className="workflow-step"><small>3 · Review</small><b>Journal + performance feedback</b></div></div>
        <section className="metrics"><MetricCard label="Net P&L" value={money(stats.pnl)} detail="Selected account view" icon={CircleDollarSign}/><MetricCard label="Win rate" value={`${stats.rate.toFixed(1)}%`} detail={`${stats.wins} of ${visibleTrades.length} won`} icon={Target} tone="blue"/><MetricCard label="Profit factor" value={stats.pf.toFixed(2)} detail="Gross profit / gross loss" icon={TrendingUp}/><MetricCard label="Avg. trade" value={money(stats.avg)} detail="Per closed trade" icon={Activity} tone={stats.avg>=0?"green":"red"}/></section>
        <section className="dashboard-grid"><article className="panel chart-panel"><div className="panel-head"><div><h2>Account equity curve</h2><p>Cumulative realized profit</p></div><span className={stats.pnl>=0?"positive":"negative"}>{money(stats.pnl)}</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={stats.pnl>=0?"#31d896":"#ff5c6c"} stopOpacity=".35"/><stop offset="1" stopColor={stats.pnl>=0?"#31d896":"#ff5c6c"} stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#263148" vertical={false}/><XAxis dataKey="date" stroke="#778198" fontSize={12}/><YAxis stroke="#778198" fontSize={12}/><Tooltip formatter={v=>money(Number(v))} contentStyle={{background:"#111827",border:"1px solid #29334a",borderRadius:10}}/><Area type="monotone" dataKey="pnl" stroke={stats.pnl>=0?"#31d896":"#ff5c6c"} strokeWidth={2.5} fill="url(#fill)"/></AreaChart></ResponsiveContainer></div></article><article className="panel accounts-panel"><div className="panel-head"><div><h2>Discipline summary</h2><p>Today&apos;s account rule health</p></div><button onClick={()=>setTab("Guardrails")}>Open guardrails</button></div><RuleCenter accounts={visibleAccounts} trades={visibleTrades} mode="summary"/></article></section>
        <TradeTable trades={visibleTrades.slice(0,6)} accounts={accounts}/>
      </>}

      {useEdgeWorkspace && <><EdgeWorkspace tab={tab} accounts={visibleAccounts.length?visibleAccounts:accounts} trades={visibleTrades}/>{tab==="Guardrails"&&<RuleCenter accounts={visibleAccounts.length?visibleAccounts:accounts} trades={visibleTrades} mode="settings"/>}</>}
      {tab==="Accounts" && <Accounts accounts={visibleAccounts.length?visibleAccounts:accounts} onAdd={()=>{setEditingAccount(undefined);setAccountModal(true)}} onEdit={a=>{setEditingAccount(a);setAccountModal(true)}}/>}
      {tab==="Analytics" && <Analytics trades={visibleTrades}/>} 
      {tab==="Calendar" && <CalendarView calendar={calendar} offset={calendarOffset} setOffset={setCalendarOffset}/>} 
      {tab==="Settings" && <section className="edge-workspace"><RuleCenter accounts={accounts} trades={trades} mode="settings"/><article className="edge-card"><h2>Connections</h2><p>MT4/MT5, cTrader and other broker sync should remain server-side. Your current connector layer can be extended without exposing trading credentials in the browser.</p></article></section>}
    </main>

    {tradeModal&&<TradeModal accounts={accounts} onClose={()=>setTradeModal(false)} onSave={addTrade}/>} 
    {accountModal&&<AccountModal account={editingAccount} onClose={()=>{setAccountModal(false);setEditingAccount(undefined)}} onSave={saveAccount}/>} 
  </div>;
}

function TradeTable({trades,accounts}:{trades:Trade[];accounts:Account[]}){return <section className="panel table-panel"><div className="panel-head"><div><h2>Recent trades</h2><p>Broker and manual journal entries</p></div></div><div className="table-wrap"><table><thead><tr><th>Trade</th><th>Account</th><th>Side</th><th>Entry / Exit</th><th>Setup</th><th>Closed</th><th>P&amp;L</th></tr></thead><tbody>{trades.map(t=>{const a=accounts.find(x=>x.id===t.accountId);return <tr key={t.id}><td><b>{t.symbol}</b><small>{t.lots} lots</small></td><td>{a?.name||"—"}</td><td><span className={`side ${t.side.toLowerCase()}`}>{t.side}</span></td><td><b>{t.entry}</b><small>{t.exit}</small></td><td>{t.setup||"—"}</td><td>{new Date(t.closedAt).toLocaleDateString()}</td><td className={t.pnl>=0?"positive":"negative"}>{money(t.pnl)}</td></tr>})}</tbody></table></div></section>}
function Accounts({accounts,onAdd,onEdit}:{accounts:Account[];onAdd:()=>void;onEdit:(a:Account)=>void}){return <section className="edge-workspace"><div className="panel-head"><div><h2>Trading accounts</h2><p>Broker, prop-firm and manual accounts.</p></div><button className="primary" onClick={onAdd}><Plus size={16}/>Add account</button></div><div className="edge-grid three">{accounts.map(a=><article className="edge-card" key={a.id}><div className="edge-title"><WalletCards/><div><h3>{a.name}</h3><p>{a.firm} · {a.platform}</p></div></div><strong style={{fontSize:28}}>{money(a.balance)}</strong><p>Daily loss: {money(a.dailyLimit)} · Max loss: {money(a.maxLimit)}</p><button onClick={()=>onEdit(a)}>Edit account</button></article>)}</div></section>}
function Analytics({trades}:{trades:Trade[]}){const setups=Object.entries(trades.reduce<Record<string,{pnl:number;count:number;wins:number}>>((m,t)=>{const k=t.setup||"Untagged";m[k]||={pnl:0,count:0,wins:0};m[k].pnl+=t.pnl;m[k].count++;if(t.pnl>0)m[k].wins++;return m},{}));return <section className="edge-workspace"><div className="edge-grid three"><article className="edge-card"><h3>Total trades</h3><strong style={{fontSize:30}}>{trades.length}</strong><p>Closed trades in current filter.</p></article><article className="edge-card"><h3>Best trade</h3><strong className="positive" style={{fontSize:30}}>{trades.length?money(Math.max(...trades.map(t=>t.pnl))):money(0)}</strong><p>Largest realized winner.</p></article><article className="edge-card"><h3>Worst trade</h3><strong className="negative" style={{fontSize:30}}>{trades.length?money(Math.min(...trades.map(t=>t.pnl))):money(0)}</strong><p>Largest realized loss.</p></article></div><article className="edge-card"><h2>Setup performance</h2><div className="journal-list">{setups.map(([name,s])=><div className="journal-row" key={name}><div><b>{name}</b><small>{s.count} trades · {(s.wins/s.count*100).toFixed(0)}% win rate</small></div><span className={s.pnl>=0?"positive":"negative"}>{money(s.pnl)}</span></div>)}</div></article></section>}
function CalendarView({calendar,offset,setOffset}:{calendar:{month:Date;cells:{date:Date;day:number;current:boolean;data?:{pnl:number;count:number}}[]};offset:number;setOffset:(n:number)=>void}){return <section className="edge-workspace"><article className="edge-card"><div className="panel-head"><button onClick={()=>setOffset(offset-1)}>←</button><h2>{calendar.month.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</h2><button onClick={()=>setOffset(offset+1)}>→</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>{calendar.cells.map((c,i)=><div key={i} style={{minHeight:92,padding:10,border:"1px solid #223048",borderRadius:10,opacity:c.current?1:.35}}><b>{c.day}</b>{c.data&&<><small style={{display:"block",marginTop:12}}>{c.data.count} trade{c.data.count===1?"":"s"}</small><strong className={c.data.pnl>=0?"positive":"negative"}>{money(c.data.pnl)}</strong></>}</div>)}</div></article></section>}
