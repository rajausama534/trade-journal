"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity, BarChart3, BookOpen, Brain, CalendarDays, ChevronDown, ChevronLeft,
  ChevronRight, CircleDollarSign, Clock3, Download, FileBarChart, Filter,
  LayoutDashboard, LogOut, Menu, Pencil, Plus, Search, Settings, Target,
  Trash2, TrendingDown, TrendingUp, WalletCards, X,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { MetricCard } from "@/components/MetricCard";
import { TradeModal } from "@/components/TradeModal";
import { AuthScreen } from "@/components/AuthScreen";
import { AccountModal } from "@/components/AccountModal";
import { AccountPerformance } from "@/components/AccountPerformance";
import { RuleCenter } from "@/components/RuleCenter";
import { accounts as starterAccounts, trades as seedTrades } from "@/lib/sample-data";
import { Account, NewTrade, Trade } from "@/lib/types";
import { isDemoMode, supabase } from "@/lib/supabase";

const money = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0, signDisplay: "auto",
}).format(value);
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
type Goal = { id: string; label: string; target: number; createdAt: string };
type Stats = { pnl:number; wins:number; losses:number; rate:number; pf:number; avg:number; averageWin:number; averageLoss:number; expectancy:number; largestWin:number; largestLoss:number };

function calculateStats(items: Trade[]): Stats {
  const wins = items.filter((t) => t.pnl > 0);
  const losses = items.filter((t) => t.pnl < 0);
  const grossProfit = wins.reduce((s,t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s,t) => s + t.pnl, 0));
  const pnl = items.reduce((s,t) => s + t.pnl, 0);
  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  const rate = items.length ? wins.length / items.length : 0;
  return { pnl, wins:wins.length, losses:losses.length, rate:rate*100,
    pf:grossLoss ? grossProfit/grossLoss : grossProfit ? Infinity : 0,
    avg:items.length ? pnl/items.length : 0, averageWin, averageLoss,
    expectancy:rate*averageWin-(1-rate)*averageLoss,
    largestWin:wins.length ? Math.max(...wins.map(t=>t.pnl)) : 0,
    largestLoss:losses.length ? Math.min(...losses.map(t=>t.pnl)) : 0 };
}

const tradeRow = (trade: NewTrade, userId?: string) => ({
  ...(userId ? { user_id:userId } : {}), account_id:trade.accountId, symbol:trade.symbol,
  side:trade.side, lots:trade.lots, entry:trade.entry, exit:trade.exit,
  stop_loss:trade.sl, take_profit:trade.tp, opened_at:trade.openedAt,
  closed_at:trade.closedAt, pnl:trade.pnl, setup:trade.setup, notes:trade.notes,
});

export default function Home() {
  const [tab,setTab] = useState("Dashboard");
  const [trades,setTrades] = useState<Trade[]>(isDemoMode ? seedTrades : []);
  const [accounts,setAccounts] = useState<Account[]>(isDemoMode ? starterAccounts : []);
  const [tradeModal,setTradeModal] = useState(false);
  const [editingTrade,setEditingTrade] = useState<Trade|null>(null);
  const [accountModal,setAccountModal] = useState(false);
  const [editingAccount,setEditingAccount] = useState<Account|null>(null);
  const [selectedAccountId,setSelectedAccountId] = useState<string|null>(null);
  const [nav,setNav] = useState(false);
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(!isDemoMode);
  const [calendarOffset,setCalendarOffset] = useState(0);
  const [syncInfo,setSyncInfo] = useState<{accountId:string;login:number|null;lastSync:string|null}[]>([]);
  const [query,setQuery] = useState("");
  const [accountFilter,setAccountFilter] = useState("all");
  const [resultFilter,setResultFilter] = useState("all");
  const [goals,setGoals] = useState<Goal[]>([]);
  const [goalLabel,setGoalLabel] = useState("");
  const [goalTarget,setGoalTarget] = useState("");

  function openTrade(open:boolean, trade:Trade|null=null) {
    if (open && !accounts.length) { setAccountModal(true); return; }
    setEditingTrade(trade); setTradeModal(open);
  }

  useEffect(()=>{
    const savedGoals=localStorage.getItem("tradeflow-goals");
    if(savedGoals) try{setGoals(JSON.parse(savedGoals));}catch{localStorage.removeItem("tradeflow-goals");}
    if(isDemoMode){
      const savedTrades=localStorage.getItem("tradeflow-demo-trades");
      const savedAccounts=localStorage.getItem("tradeflow-demo-accounts");
      if(savedTrades) try{setTrades(JSON.parse(savedTrades));}catch{}
      if(savedAccounts) try{setAccounts(JSON.parse(savedAccounts));}catch{}
    }
  },[]);
  useEffect(()=>{localStorage.setItem("tradeflow-goals",JSON.stringify(goals));},[goals]);
  useEffect(()=>{if(isDemoMode){localStorage.setItem("tradeflow-demo-trades",JSON.stringify(trades));localStorage.setItem("tradeflow-demo-accounts",JSON.stringify(accounts));}},[trades,accounts]);

  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getUser().then(({data})=>{setUser(data.user);setLoading(false);});
    const {data}=supabase.auth.onAuthStateChange((_e,s)=>{setUser(s?.user||null);setLoading(false);});
    return()=>data.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!supabase||!user)return;
    (async()=>{
      const [ar,tr,sr]=await Promise.all([
        supabase.from("accounts").select("*").order("created_at"),
        supabase.from("trades").select("*").order("closed_at",{ascending:false}),
        supabase.from("mt5_connections").select("account_id,mt5_login,last_sync_at"),
      ]);
      if(!ar.error)setAccounts((ar.data||[]).map(i=>({id:i.id,name:i.name,firm:i.firm,platform:i.platform,balance:Number(i.balance),startingBalance:Number(i.starting_balance),dailyLimit:Number(i.daily_limit),maxLimit:Number(i.max_limit),status:i.connection_status})));
      if(!tr.error)setTrades((tr.data||[]).map(i=>({id:i.id,accountId:i.account_id,symbol:i.symbol,side:i.side,lots:Number(i.lots),entry:Number(i.entry),exit:Number(i.exit),sl:Number(i.stop_loss||0),tp:Number(i.take_profit||0),openedAt:i.opened_at,closedAt:i.closed_at,pnl:Number(i.pnl),setup:i.setup||"",notes:i.notes||""})));
      if(!sr.error)setSyncInfo((sr.data||[]).map(i=>({accountId:i.account_id,login:i.mt5_login?Number(i.mt5_login):null,lastSync:i.last_sync_at})));
    })();
  },[user]);

  const filteredTrades=useMemo(()=>trades.filter(t=>{
    const n=query.trim().toLowerCase(); const a=accounts.find(x=>x.id===t.accountId);
    return (!n||t.symbol.toLowerCase().includes(n)||t.setup.toLowerCase().includes(n)||(t.notes||"").toLowerCase().includes(n)||a?.name.toLowerCase().includes(n))
      &&(accountFilter==="all"||t.accountId===accountFilter)
      &&(resultFilter==="all"||(resultFilter==="wins"&&t.pnl>0)||(resultFilter==="losses"&&t.pnl<0)||(resultFilter==="breakeven"&&t.pnl===0));
  }),[trades,accounts,query,accountFilter,resultFilter]);
  const stats=useMemo(()=>calculateStats(trades),[trades]);
  const filteredStats=useMemo(()=>calculateStats(filteredTrades),[filteredTrades]);
  const chart=useMemo(()=>[...trades].sort((a,b)=>a.closedAt.localeCompare(b.closedAt)).reduce<{date:string;pnl:number}[]>((p,t)=>{p.push({date:new Date(t.closedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}),pnl:(p.at(-1)?.pnl||0)+t.pnl});return p;},[]),[trades]);
  const setupPerformance=useMemo(()=>{const m=new Map<string,{setup:string;pnl:number;trades:number;wins:number}>();trades.forEach(t=>{const k=t.setup.trim()||"Unclassified";const v=m.get(k)||{setup:k,pnl:0,trades:0,wins:0};v.pnl+=t.pnl;v.trades++;if(t.pnl>0)v.wins++;m.set(k,v);});return [...m.values()].sort((a,b)=>b.pnl-a.pnl);},[trades]);
  const dayPerformance=useMemo(()=>{const m=new Map<string,number>();trades.forEach(t=>{const d=new Date(t.closedAt).toLocaleDateString("en-US",{weekday:"short"});m.set(d,(m.get(d)||0)+t.pnl);});return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=>({day,pnl:m.get(day)||0}));},[trades]);
  const reports=useMemo(()=>{const m=new Map<string,Trade[]>();trades.forEach(t=>{const d=new Date(t.closedAt);const k=d.toLocaleDateString("en-US",{month:"long",year:"numeric"});m.set(k,[...(m.get(k)||[]),t]);});return [...m.entries()].map(([period,items])=>({period,items,stats:calculateStats(items)}));},[trades]);
  const psychology=useMemo(()=>{const emotional=trades.filter(t=>/revenge|fomo|fear|greed|rushed|overtrade|impulsive|angry|anxious/i.test(t.notes||""));const disciplined=trades.filter(t=>/patient|discipline|plan|confirmation|calm|rule|setup/i.test(t.notes||""));return{emotional,disciplined,emotionalPnl:emotional.reduce((s,t)=>s+t.pnl,0),disciplinedPnl:disciplined.reduce((s,t)=>s+t.pnl,0)};},[trades]);
  const calendar=useMemo(()=>{const latest=trades.length?new Date(Math.max(...trades.map(t=>new Date(t.closedAt).getTime()))):new Date();const month=new Date(latest.getFullYear(),latest.getMonth()+calendarOffset,1);const daily=new Map<string,{pnl:number;count:number}>();trades.forEach(t=>{const d=new Date(t.closedAt);const k=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;const v=daily.get(k)||{pnl:0,count:0};v.pnl+=t.pnl;v.count++;daily.set(k,v);});const first=month.getDay(),days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),prev=new Date(month.getFullYear(),month.getMonth(),0).getDate();const cells=Array.from({length:42},(_,i)=>{const day=i-first+1;const date=day<1?new Date(month.getFullYear(),month.getMonth()-1,prev+day):day>days?new Date(month.getFullYear(),month.getMonth()+1,day-days):new Date(month.getFullYear(),month.getMonth(),day);return{date,day:date.getDate(),current:date.getMonth()===month.getMonth(),data:daily.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`)};});return{month,cells};},[trades,calendarOffset]);

  async function saveTrade(value:NewTrade){
    if(editingTrade){
      if(supabase&&user){const {error}=await supabase.from("trades").update(tradeRow(value)).eq("id",editingTrade.id).eq("user_id",user.id);if(error)throw error;}
      setTrades(v=>v.map(t=>t.id===editingTrade.id?{...value,id:t.id}:t));
    }else if(supabase&&user){const {data,error}=await supabase.from("trades").insert(tradeRow(value,user.id)).select("id").single();if(error)throw error;setTrades(v=>[{...value,id:data.id},...v]);}
    else setTrades(v=>[{...value,id:crypto.randomUUID()},...v]);
    openTrade(false);
  }
  async function deleteTrade(trade:Trade){
    if(!confirm(`Delete ${trade.symbol} trade closed ${new Date(trade.closedAt).toLocaleDateString()}?`))return;
    if(supabase&&user){const {error}=await supabase.from("trades").delete().eq("id",trade.id).eq("user_id",user.id);if(error){alert(error.message);return;}}
    setTrades(v=>v.filter(t=>t.id!==trade.id));
  }
  async function addAccount(a:Omit<Account,"id">){
    if(supabase&&user){const {data,error}=await supabase.from("accounts").insert({user_id:user.id,name:a.name,firm:a.firm,platform:a.platform,balance:a.balance,starting_balance:a.startingBalance,daily_limit:a.dailyLimit,max_limit:a.maxLimit,connection_status:a.status}).select("id").single();if(error){alert(error.message);return;}setAccounts(v=>[...v,{...a,id:data.id}]);}
    else setAccounts(v=>[...v,{...a,id:crypto.randomUUID()}]); setAccountModal(false);
  }
  async function updateAccount(a:Omit<Account,"id">){const c=editingAccount;if(!c)return;if(supabase&&user){const {error}=await supabase.from("accounts").update({name:a.name,firm:a.firm,platform:a.platform,balance:a.balance,starting_balance:a.startingBalance,daily_limit:a.dailyLimit,max_limit:a.maxLimit,connection_status:a.status}).eq("id",c.id).eq("user_id",user.id);if(error){alert(error.message);return;}}setAccounts(v=>v.map(x=>x.id===c.id?{...a,id:c.id}:x));setEditingAccount(null);}
  function exportTrades(){const rows=[["Account","Symbol","Side","Lots","Entry","Exit","Stop Loss","Take Profit","R:R","Setup","Opened","Closed","P&L","Notes"],...filteredTrades.map(t=>{const risk=Math.abs(t.entry-t.sl),reward=Math.abs(t.tp-t.entry);return[accounts.find(a=>a.id===t.accountId)?.name||"",t.symbol,t.side,t.lots,t.entry,t.exit,t.sl,t.tp,risk?reward/risk:"",t.setup,t.openedAt,t.closedAt,t.pnl,t.notes||""];})];const blob=new Blob([rows.map(r=>r.map(csvCell).join(",")).join("\n")],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`tradeflow-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(u);}
  function addGoal(){const target=Number(goalTarget);if(!goalLabel.trim()||!Number.isFinite(target)||target<=0)return;setGoals(v=>[...v,{id:crypto.randomUUID(),label:goalLabel.trim(),target,createdAt:new Date().toISOString()}]);setGoalLabel("");setGoalTarget("");}

  if(loading)return <main className="auth"><section><p>Loading your journal…</p></section></main>;
  if(!isDemoMode&&!user)return <AuthScreen/>;
  const navItems=[["Dashboard",LayoutDashboard],["Trades",BookOpen],["Accounts",WalletCards],["Analytics",BarChart3],["Reports",FileBarChart],["Calendar",CalendarDays],["Psychology",Brain],["Goals",Target],["Settings",Settings]] as const;
  const bestSetup=setupPerformance[0],worstSetup=setupPerformance.at(-1);

  return <div className="app">
    <aside className={nav?"open":""}><div className="brand"><div><Activity/></div><b>Trade<span>Flow</span></b><button onClick={()=>setNav(false)}><X/></button></div><nav>{navItems.map(([n,I])=><button key={n} className={tab===n?"selected":""} onClick={()=>{setTab(n);setNav(false);}}><I size={19}/>{n}</button>)}</nav><div className="aside-foot"><div className="avatar">UR</div><div><b>Usama Raja</b><small>Prop trader</small></div><ChevronDown size={16}/></div></aside>
    <main><header className="top"><button className="mobile-menu" onClick={()=>setNav(true)}><Menu/></button><div><h1>{tab}</h1><p>{tab==="Dashboard"?"Your trading performance, at a glance.":`Review your ${tab.toLowerCase()} workspace.`}</p></div><div className="top-actions">{isDemoMode&&<span className="demo">Local mode</span>}<button className="primary" onClick={()=>openTrade(true)}><Plus size={17}/>Add trade</button></div></header>

    {tab==="Dashboard"&&<><section className="metrics"><MetricCard label="Net P&L" value={money(stats.pnl)} detail="Across all accounts" icon={CircleDollarSign}/><MetricCard label="Win rate" value={`${stats.rate.toFixed(1)}%`} detail={`${stats.wins} of ${trades.length} trades won`} icon={Target} tone="blue"/><MetricCard label="Profit factor" value={Number.isFinite(stats.pf)?stats.pf.toFixed(2):"∞"} detail="Gross profit / loss" icon={TrendingUp}/><MetricCard label="Expectancy" value={money(stats.expectancy)} detail="Expected value per trade" icon={Activity} tone={stats.expectancy>=0?"green":"red"}/></section><section className="dashboard-grid"><article className="panel chart-panel"><div className="panel-head"><div><h2>Equity curve</h2><p>Cumulative realized profit</p></div><span className={stats.pnl>=0?"positive":"negative"}>{money(stats.pnl)}</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid stroke="#263148" vertical={false}/><XAxis dataKey="date" stroke="#778198" fontSize={12}/><YAxis stroke="#778198" fontSize={12}/><Tooltip contentStyle={{background:"#111827",border:"1px solid #29334a",borderRadius:10}}/><Area type="monotone" dataKey="pnl" stroke={stats.pnl>=0?"#31d896":"#ff5c6c"} strokeWidth={2.5} fillOpacity={.16} fill={stats.pnl>=0?"#31d896":"#ff5c6c"}/></AreaChart></ResponsiveContainer></div></article><article className="panel accounts-panel"><div className="panel-head"><div><h2>Accounts</h2><p>Balance & rule health</p></div><button onClick={()=>setTab("Accounts")}>View all</button></div>{accounts.map(a=><div className="account" key={a.id}><div className="account-icon"><WalletCards/></div><div><b>{a.name}</b><small>{a.firm} · {a.platform}</small></div><div className="account-value"><b>{money(a.balance)}</b><small className={a.balance>=a.startingBalance?"positive":"negative"}>{((a.balance/a.startingBalance-1)*100).toFixed(2)}%</small></div></div>)}<RuleCenter accounts={accounts} trades={trades} mode="summary"/></article></section><TradeTable trades={trades.slice(0,5)} accounts={accounts} title="Recent trades" subtitle="Your latest closed positions" onViewAll={()=>setTab("Trades")} onEdit={t=>openTrade(true,t)} onDelete={deleteTrade}/></>}

    {tab==="Trades"&&<><section className="panel filter-panel"><div className="filter-row"><label className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search symbol, setup, account or notes"/></label><label><Filter size={15}/><select value={accountFilter} onChange={e=>setAccountFilter(e.target.value)}><option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label><select value={resultFilter} onChange={e=>setResultFilter(e.target.value)}><option value="all">All results</option><option value="wins">Wins</option><option value="losses">Losses</option><option value="breakeven">Breakeven</option></select></label><button className="secondary" onClick={exportTrades}><Download size={16}/>Export CSV</button></div><div className="filter-summary"><span>{filteredTrades.length} trades</span><span className={filteredStats.pnl>=0?"positive":"negative"}>{money(filteredStats.pnl)}</span><span>{filteredStats.rate.toFixed(1)}% win rate</span></div></section><TradeTable trades={filteredTrades} accounts={accounts} title="Trade journal" subtitle="Edit, delete, filter and export every closed position" onEdit={t=>openTrade(true,t)} onDelete={deleteTrade}/></>}

    {tab==="Accounts"&&(selectedAccountId&&accounts.find(a=>a.id===selectedAccountId)?<AccountPerformance account={accounts.find(a=>a.id===selectedAccountId)!} trades={trades} onBack={()=>setSelectedAccountId(null)} onEdit={()=>setEditingAccount(accounts.find(a=>a.id===selectedAccountId)!)}/>:<><div className="section-actions"><button className="primary" onClick={()=>setAccountModal(true)}><Plus size={16}/>Add account</button></div><section className="cards">{accounts.map(a=><article className="panel account-card" key={a.id}><div className="panel-head"><div><small>{a.firm}</small><h2>{a.name}</h2></div><span className="status">{a.status}</span></div><strong>{money(a.balance)}</strong><p>Started at {money(a.startingBalance)} · {a.platform}</p><div className="limits"><span>Daily limit <b>{money(a.dailyLimit)}</b></span><span>Max limit <b>{money(a.maxLimit)}</b></span></div><div className="account-actions"><button className="secondary" onClick={()=>setSelectedAccountId(a.id)}>View performance</button><button className="secondary" onClick={()=>setEditingAccount(a)}>Edit / remove</button></div></article>)}</section></>)}

    {tab==="Analytics"&&<><section className="metrics analytics-metrics"><MetricCard label="Average winner" value={money(stats.averageWin)} detail={`${stats.wins} winning trades`} icon={TrendingUp}/><MetricCard label="Average loser" value={money(-stats.averageLoss)} detail={`${stats.losses} losing trades`} icon={TrendingDown} tone="red"/><MetricCard label="Largest winner" value={money(stats.largestWin)} detail="Best single trade" icon={TrendingUp}/><MetricCard label="Largest loss" value={money(stats.largestLoss)} detail="Worst single trade" icon={TrendingDown} tone="red"/></section><section className="analytics-grid"><article className="panel"><div className="panel-head"><div><h2>P&L by weekday</h2><p>Strongest and weakest days</p></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dayPerformance}><CartesianGrid stroke="#263148" vertical={false}/><XAxis dataKey="day" stroke="#778198"/><YAxis stroke="#778198"/><Tooltip contentStyle={{background:"#111827",border:"1px solid #29334a",borderRadius:10}}/><Bar dataKey="pnl" fill="#5f8cff" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article><article className="panel setup-list"><div className="panel-head"><div><h2>Setup leaderboard</h2><p>Ranked by realized P&L</p></div></div>{setupPerformance.map(i=><div className="setup-row" key={i.setup}><div><b>{i.setup}</b><small>{i.trades} trades · {(i.wins/i.trades*100).toFixed(0)}% wins</small></div><strong className={i.pnl>=0?"positive":"negative"}>{money(i.pnl)}</strong></div>)}</article></section><section className="cards insight-cards"><article className="panel insight"><TrendingUp/><h2>Best setup</h2><strong>{bestSetup?.setup||"No data"}</strong><p>{bestSetup?`${money(bestSetup.pnl)} across ${bestSetup.trades} trades.`:"Add trades to calculate this."}</p></article><article className="panel insight"><TrendingDown/><h2>Weakest setup</h2><strong>{worstSetup?.setup||"No data"}</strong><p>{worstSetup?`${money(worstSetup.pnl)} across ${worstSetup.trades} trades.`:"Add trades to calculate this."}</p></article></section></>}

    {tab==="Reports"&&<section className="cards">{reports.map(r=><article className="panel account-card" key={r.period}><div className="panel-head"><div><small>Monthly report</small><h2>{r.period}</h2></div><span className={r.stats.pnl>=0?"positive":"negative"}>{money(r.stats.pnl)}</span></div><strong>{r.items.length} trades</strong><p>{r.stats.rate.toFixed(1)}% win rate · {Number.isFinite(r.stats.pf)?r.stats.pf.toFixed(2):"∞"} profit factor</p><div className="limits"><span>Average <b>{money(r.stats.avg)}</b></span><span>Expectancy <b>{money(r.stats.expectancy)}</b></span></div></article>)}{!reports.length&&<article className="panel empty"><FileBarChart/><h2>No reports yet</h2><p>Add trades to generate monthly reports.</p></article>}</section>}

    {tab==="Calendar"&&<section className="panel calendar-panel"><div className="calendar-head"><button onClick={()=>setCalendarOffset(v=>v-1)}><ChevronLeft/></button><h2>{calendar.month.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</h2><button onClick={()=>setCalendarOffset(v=>v+1)}><ChevronRight/></button></div><div className="weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><b key={d}>{d}</b>)}</div><div className="calendar-grid">{calendar.cells.map((c,i)=><article key={i} className={`${!c.current?"outside ":""}${c.data?(c.data.pnl>=0?"profit":"loss"):""}`}><span>{c.day}</span>{c.data&&<div><small>{c.data.count} trades</small><strong>{money(c.data.pnl)}</strong></div>}</article>)}</div></section>}

    {tab==="Psychology"&&<section className="psychology-grid"><article className="panel psychology-score"><Brain/><h2>Discipline review</h2><strong>{trades.length?`${Math.max(0,Math.round((1-psychology.emotional.length/trades.length)*100))}%`:"—"}</strong><p>Based on execution language in your trade notes.</p></article><article className="panel"><div className="panel-head"><div><h2>Disciplined trades</h2></div><span className={psychology.disciplinedPnl>=0?"positive":"negative"}>{money(psychology.disciplinedPnl)}</span></div><div className="psych-list">{psychology.disciplined.slice(0,6).map(t=><div key={t.id}><b>{t.symbol} · {t.setup}</b><small>{t.notes}</small></div>)}</div></article><article className="panel"><div className="panel-head"><div><h2>Emotional-risk trades</h2></div><span className={psychology.emotionalPnl>=0?"positive":"negative"}>{money(psychology.emotionalPnl)}</span></div><div className="psych-list">{psychology.emotional.slice(0,6).map(t=><div key={t.id}><b>{t.symbol} · {t.setup}</b><small>{t.notes}</small></div>)}</div></article></section>}

    {tab==="Goals"&&<section className="goals-layout"><article className="panel goal-form"><Target/><h2>Create a profit goal</h2><label>Goal name<input value={goalLabel} onChange={e=>setGoalLabel(e.target.value)} placeholder="FundedHive payout"/></label><label>Target profit<input type="number" min="1" value={goalTarget} onChange={e=>setGoalTarget(e.target.value)} placeholder="1000"/></label><button className="primary" onClick={addGoal}><Plus size={16}/>Add goal</button></article><section className="goal-list">{goals.map(g=>{const p=Math.max(0,Math.min(100,stats.pnl/g.target*100));return <article className="panel goal-card" key={g.id}><div className="panel-head"><div><h2>{g.label}</h2><p>Target {money(g.target)}</p></div><button className="icon-btn" onClick={()=>setGoals(v=>v.filter(x=>x.id!==g.id))}><X size={17}/></button></div><strong>{p.toFixed(0)}%</strong><div className="goal-meter"><span style={{width:`${p}%`}}/></div><small>{money(stats.pnl)} of {money(g.target)}</small></article>})}</section></section>}

    {tab==="Settings"&&<section className="settings-grid"><article className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Settings/></div><div><h2>Your journal</h2><p>Personal account information</p></div></div><label>Email<input value={user?.email||"Local journal"} readOnly/></label><div className="settings-pair"><label>Timezone<input value="Asia/Dubai" readOnly/></label><label>Currency<input value="USD" readOnly/></label></div></article><article className="panel settings-card"><div className="settings-title"><div className="settings-icon sync"><Clock3/></div><div><h2>MT5 synchronization</h2><p>Read-only trade importer</p></div></div>{syncInfo.map(s=><div className="sync-row" key={s.accountId}><div><b>{accounts.find(a=>a.id===s.accountId)?.name||"MT5 account"}</b><small>{s.login?`Login ${s.login}`:"Waiting for login"}</small></div><div><span className={s.lastSync?"online":"waiting"}>{s.lastSync?"Connected":"Waiting"}</span></div></div>)}{!syncInfo.length&&<p className="settings-note">No MT5 connection has been added yet.</p>}</article><RuleCenter accounts={accounts} trades={trades} mode="settings"/><article className="panel settings-card danger-card"><div className="settings-title"><div className="settings-icon danger"><LogOut/></div><div><h2>Session</h2><p>Sign out from this device</p></div></div><button className="signout" onClick={()=>supabase?.auth.signOut()}><LogOut/>Sign out</button></article></section>}
    </main>
    {tradeModal&&<TradeModal accounts={accounts} trade={editingTrade} onClose={()=>openTrade(false)} onSave={saveTrade}/>} 
    {accountModal&&<AccountModal onClose={()=>setAccountModal(false)} onSave={addAccount}/>} 
    {editingAccount&&<AccountModal account={editingAccount} onClose={()=>setEditingAccount(null)} onSave={updateAccount}/>} 
  </div>;
}

function TradeTable({trades,accounts,title,subtitle,onViewAll,onEdit,onDelete}:{trades:Trade[];accounts:Account[];title:string;subtitle:string;onViewAll?:()=>void;onEdit:(t:Trade)=>void;onDelete:(t:Trade)=>void}){
  return <section className="panel table-panel"><div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{onViewAll&&<button onClick={onViewAll}>View all</button>}</div><div className="table-wrap"><table><thead><tr><th>Trade</th><th>Account</th><th>Side</th><th>Entry / Exit</th><th>R:R</th><th>Setup</th><th>Closed</th><th>P&amp;L</th><th>Actions</th></tr></thead><tbody>{trades.map(t=>{const risk=Math.abs(t.entry-t.sl),rr=risk?Math.abs(t.tp-t.entry)/risk:0;return <tr key={t.id}><td><b>{t.symbol}</b><small>{t.lots} lots</small></td><td>{accounts.find(a=>a.id===t.accountId)?.name||"Deleted account"}</td><td><span className={`side ${t.side.toLowerCase()}`}>{t.side}</span></td><td><b>{t.entry}</b><small>{t.exit}</small></td><td>{rr?`1:${rr.toFixed(2)}`:"—"}</td><td>{t.setup}</td><td>{new Date(t.closedAt).toLocaleDateString("en-AE")}</td><td><strong className={t.pnl>=0?"positive":"negative"}>{money(t.pnl)}</strong></td><td><div className="account-actions"><button className="icon-btn" aria-label="Edit trade" onClick={()=>onEdit(t)}><Pencil size={16}/></button><button className="icon-btn" aria-label="Delete trade" onClick={()=>onDelete(t)}><Trash2 size={16}/></button></div></td></tr>})}{!trades.length&&<tr><td colSpan={9}><div className="empty compact"><BookOpen/><h2>No trades found</h2><p>Add a trade or change your filters.</p></div></td></tr>}</tbody></table></div></section>;
}
