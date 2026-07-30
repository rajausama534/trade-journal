"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity, BarChart3, BookOpen, CalendarDays, ChevronDown, ChevronLeft,
  ChevronRight, CircleDollarSign, Clock3, LayoutDashboard, LogOut, Menu,
  MoreVertical, Plus, Settings, Target, Trash2, TrendingDown, TrendingUp,
  WalletCards, X,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "@/components/MetricCard";
import { TradeModal } from "@/components/TradeModal";
import { AuthScreen } from "@/components/AuthScreen";
import { AccountModal } from "@/components/AccountModal";
import { AccountPerformance } from "@/components/AccountPerformance";
import { RuleCenter } from "@/components/RuleCenter";
import { accounts as starterAccounts, trades as seedTrades } from "@/lib/sample-data";
import { Account, NewTrade, Trade } from "@/lib/types";
import { isDemoMode, supabase } from "@/lib/supabase";

const money = (n: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(n);

export default function Home() {
  const [tab, setTab] = useState("Dashboard");
  const [trades, setTrades] = useState<Trade[]>(isDemoMode ? seedTrades : []);
  const [accounts, setAccounts] = useState<Account[]>(isDemoMode ? starterAccounts : []);
  const [activeAccountId, setActiveAccountId] = useState<string>("all");
  const [performanceAccountId, setPerformanceAccountId] = useState<string | null>(null);
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);
  const [modal, setTradeModalState] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [nav, setNav] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [syncInfo, setSyncInfo] = useState<{ accountId: string; login: number | null; lastSync: string | null }[]>([]);

  const setModal = (open: boolean) => open && !accounts.length ? setAccountModal(true) : setTradeModalState(open);
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
      const [ar, tr, sr] = await Promise.all([
        supabase.from("accounts").select("*").order("created_at"),
        supabase.from("trades").select("*").order("closed_at", { ascending: false }),
        supabase.from("mt5_connections").select("account_id,mt5_login,last_sync_at"),
      ]);
      if (ar.error || tr.error) return;
      setAccounts((ar.data || []).map(x => ({ id: x.id, name: x.name, firm: x.firm, platform: x.platform, balance: Number(x.balance), startingBalance: Number(x.starting_balance), dailyLimit: Number(x.daily_limit), maxLimit: Number(x.max_limit), status: x.connection_status })));
      setTrades((tr.data || []).map(x => ({ id: x.id, accountId: x.account_id, symbol: x.symbol, side: x.side, lots: Number(x.lots), entry: Number(x.entry), exit: Number(x.exit), sl: Number(x.stop_loss || 0), tp: Number(x.take_profit || 0), openedAt: x.opened_at, closedAt: x.closed_at, pnl: Number(x.pnl), setup: x.setup || "", notes: x.notes || "" })));
      if (!sr.error) setSyncInfo((sr.data || []).map(x => ({ accountId: x.account_id, login: x.mt5_login ? Number(x.mt5_login) : null, lastSync: x.last_sync_at })));
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

  const chart = useMemo(() => [...visibleTrades].sort((a, b) => a.closedAt.localeCompare(b.closedAt)).reduce<{ date: string; pnl: number }[]>((a, t) => {
    a.push({ date: new Date(t.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), pnl: (a.at(-1)?.pnl || 0) + t.pnl }); return a;
  }, []), [visibleTrades]);

  const calendar = useMemo(() => {
    const latest = visibleTrades.length ? new Date(Math.max(...visibleTrades.map(t => new Date(t.closedAt).getTime()))) : new Date();
    const month = new Date(latest.getFullYear(), latest.getMonth() + calendarOffset, 1);
    const daily = new Map<string, { pnl: number; count: number }>();
    for (const t of visibleTrades) { const d = new Date(t.closedAt); const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; const v = daily.get(key) || { pnl: 0, count: 0 }; v.pnl += t.pnl; v.count++; daily.set(key, v); }
    const first = month.getDay(), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), previous = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
    const cells = Array.from({ length: 42 }, (_, i) => { const day = i - first + 1; const date = day < 1 ? new Date(month.getFullYear(), month.getMonth() - 1, previous + day) : day > days ? new Date(month.getFullYear(), month.getMonth() + 1, day - days) : new Date(month.getFullYear(), month.getMonth(), day); const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; return { date, day: date.getDate(), current: date.getMonth() === month.getMonth(), data: daily.get(key) }; });
    return { month, cells };
  }, [visibleTrades, calendarOffset]);

  async function addTrade(t: NewTrade) {
    if (supabase && user) { const { data, error } = await supabase.from("trades").insert({ user_id: user.id, account_id: t.accountId, symbol: t.symbol, side: t.side, lots: t.lots, entry: t.entry, exit: t.exit, stop_loss: t.sl, take_profit: t.tp, opened_at: t.openedAt, closed_at: t.closedAt, pnl: t.pnl, setup: t.setup, notes: t.notes }).select("id").single(); if (error) return alert(error.message); setTrades(v => [{ ...t, id: data.id }, ...v]); } else setTrades(v => [{ ...t, id: crypto.randomUUID() }, ...v]); setModal(false);
  }
  async function addAccount(a: Omit<Account, "id">) { if (!supabase || !user) return; const { data, error } = await supabase.from("accounts").insert({ user_id: user.id, name: a.name, firm: a.firm, platform: a.platform, balance: a.balance, starting_balance: a.startingBalance, daily_limit: a.dailyLimit, max_limit: a.maxLimit, connection_status: a.status }).select("id").single(); if (error) return alert(error.message); setAccounts(v => [...v, { ...a, id: data.id }]); setAccountModal(false); }
  async function updateAccount(a: Omit<Account, "id">) { const current = editingAccount; if (!current) return; if (supabase && user) { const { error } = await supabase.from("accounts").update({ name: a.name, firm: a.firm, platform: a.platform, balance: a.balance, starting_balance: a.startingBalance, daily_limit: a.dailyLimit, max_limit: a.maxLimit, connection_status: a.status }).eq("id", current.id).eq("user_id", user.id); if (error) return alert(error.message); } setAccounts(v => v.map(item => item.id === current.id ? { ...a, id: current.id } : item)); setEditingAccount(null); }
  async function deleteAccount(account: Account) { if (!confirm(`Delete ${account.name}? Its trades and MT5 connection will also be deleted.`)) return; if (supabase && user) { const { error } = await supabase.from("accounts").delete().eq("id", account.id).eq("user_id", user.id); if (error) return alert(error.message); } setAccounts(v => v.filter(a => a.id !== account.id)); setTrades(v => v.filter(t => t.accountId !== account.id)); setSyncInfo(v => v.filter(s => s.accountId !== account.id)); if (activeAccountId === account.id) setActiveAccountId("all"); if (performanceAccountId === account.id) setPerformanceAccountId(null); setMenuAccountId(null); }

  if (loading) return <main className="auth"><section><p>Loading your journal…</p></section></main>;
  if (!isDemoMode && !user) return <AuthScreen />;
  const navItems = [["Dashboard", LayoutDashboard], ["Trades", BookOpen], ["Accounts", WalletCards], ["Analytics", BarChart3], ["Calendar", CalendarDays], ["Settings", Settings]] as const;
  const performanceAccount = accounts.find(a => a.id === performanceAccountId);

  return <div className="app"><aside className={nav ? "open" : ""}><div className="brand"><div><Activity /></div><b>Trade<span>Flow</span></b><button onClick={() => setNav(false)}><X /></button></div><nav>{navItems.map(([n, I]) => <button key={n} className={tab === n ? "selected" : ""} onClick={() => { setTab(n); setNav(false); }}><I size={19} />{n}</button>)}</nav><div className="aside-foot"><div className="avatar">UR</div><div><b>Usama Raja</b><small>Prop trader</small></div><ChevronDown size={16} /></div></aside><main><header className="top"><button className="mobile-menu" onClick={() => setNav(true)}><Menu /></button><div><h1>{tab}</h1><p>{tab === "Dashboard" ? "Your trading performance, at a glance." : `Review your ${tab.toLowerCase()} workspace.`}</p></div><div className="top-actions"><select aria-label="Active account" value={activeAccountId} onChange={e => setActiveAccountId(e.target.value)} style={{ background: "#111827", color: "white", border: "1px solid #29334a", borderRadius: 10, padding: "10px 12px" }}><option value="all">All accounts</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>{isDemoMode && <span className="demo">Sample data</span>}<button className="primary" onClick={() => setModal(true)}><Plus size={17} />Add trade</button></div></header>

  {tab === "Dashboard" && <><section className="metrics"><MetricCard label="Net P&L" value={money(stats.pnl)} detail={activeAccountId === "all" ? "Across all accounts" : "Selected account"} icon={CircleDollarSign} /><MetricCard label="Win rate" value={`${stats.rate.toFixed(1)}%`} detail={`${stats.wins} of ${visibleTrades.length} trades won`} icon={Target} tone="blue" /><MetricCard label="Profit factor" value={stats.pf.toFixed(2)} detail="Gross profit / loss" icon={TrendingUp} /><MetricCard label="Avg. trade" value={money(stats.avg)} detail="Per closed trade" icon={Activity} tone={stats.avg >= 0 ? "green" : "red"} /></section><section className="dashboard-grid"><article className="panel chart-panel"><div className="panel-head"><div><h2>Equity curve</h2><p>Cumulative realized profit</p></div><span className={stats.pnl >= 0 ? "positive" : "negative"}>{money(stats.pnl)}</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={stats.pnl >= 0 ? "#31d896" : "#ff5c6c"} stopOpacity=".35" /><stop offset="1" stopColor={stats.pnl >= 0 ? "#31d896" : "#ff5c6c"} stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#263148" vertical={false} /><XAxis dataKey="date" stroke="#778198" fontSize={12} /><YAxis stroke="#778198" fontSize={12} tickFormatter={v => money(Number(v))} /><Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: "#111827", border: "1px solid #29334a", borderRadius: 10 }} /><Area type="monotone" dataKey="pnl" stroke={stats.pnl >= 0 ? "#31d896" : "#ff5c6c"} strokeWidth={2.5} fill="url(#fill)" /></AreaChart></ResponsiveContainer></div></article><article className="panel accounts-panel"><div className="panel-head"><div><h2>Accounts</h2><p>Balance & rule health</p></div><button onClick={() => setTab("Accounts")}>View all</button></div>{visibleAccounts.map(a => { const change = a.startingBalance ? (a.balance / a.startingBalance - 1) * 100 : 0; return <div className="account" key={a.id}><div className="account-icon"><WalletCards /></div><div><b>{a.name}</b><small>{a.firm} · {a.platform}</small></div><div className="account-value"><b>{money(a.balance)}</b><small className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</small></div></div>; })}<RuleCenter accounts={visibleAccounts} trades={visibleTrades} mode="summary" /></article></section></>}

  {(tab === "Trades" || tab === "Dashboard") && <section className="panel table-panel"><div className="panel-head"><div><h2>Recent trades</h2><p>Your latest closed positions</p></div>{tab === "Dashboard" && <button onClick={() => setTab("Trades")}>View all</button>}</div><div className="table-wrap"><table><thead><tr><th>Trade</th><th>Account</th><th>Side</th><th>Entry / Exit</th><th>Setup</th><th>Closed</th><th>P&amp;L</th></tr></thead><tbody>{visibleTrades.slice(0, tab === "Dashboard" ? 5 : 99).map(t => { const a = accounts.find(x => x.id === t.accountId); return <tr key={t.id}><td><b>{t.symbol}</b><small>{t.lots} lots</small></td><td>{a?.name}</td><td><span className={`side ${t.side.toLowerCase()}`}>{t.side}</span></td><td><b>{t.entry}</b><small>{t.exit}</small></td><td>{t.setup}</td><td>{new Date(t.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td className={t.pnl >= 0 ? "positive" : "negative"}>{money(t.pnl)}</td></tr>; })}</tbody></table></div></section>}

  {tab === "Accounts" && (performanceAccount ? <AccountPerformance account={performanceAccount} trades={trades.filter(t => t.accountId === performanceAccount.id)} onBack={() => setPerformanceAccountId(null)} onEdit={() => setEditingAccount(performanceAccount)} /> : <section className="cards">{accounts.map(a => <article className="panel account-card" key={a.id}><div className="panel-head"><div><small>{a.firm}</small><h2>{a.name}</h2></div><div style={{ position: "relative" }}><button aria-label="Account menu" onClick={() => setMenuAccountId(menuAccountId === a.id ? null : a.id)}><MoreVertical size={20} /></button>{menuAccountId === a.id && <div style={{ position: "absolute", right: 0, top: 34, zIndex: 5, background: "#111827", border: "1px solid #29334a", borderRadius: 10, padding: 6, minWidth: 140 }}><button className="secondary" style={{ width: "100%" }} onClick={() => deleteAccount(a)}><Trash2 size={16} /> Delete account</button></div>}</div></div><span className="status">{a.status}</span><strong>{money(a.balance)}</strong><p>Started at {money(a.startingBalance)} · {a.platform}</p><div className="limits"><span>Daily limit <b>{money(a.dailyLimit)}</b></span><span>Max limit <b>{money(a.maxLimit)}</b></span></div><div className="account-actions"><button className="secondary" onClick={() => { setPerformanceAccountId(a.id); setActiveAccountId(a.id); }}>View performance</button><button className="secondary" onClick={() => setEditingAccount(a)}>Edit</button></div></article>)}</section>)}

  {tab === "Analytics" && <section className="cards"><article className="panel insight"><TrendingUp /><h2>Net result</h2><strong>{money(stats.pnl)}</strong><p>For the currently selected account scope.</p></article><article className="panel insight"><TrendingDown /><h2>Largest loss</h2><strong>{money(visibleTrades.length ? Math.min(...visibleTrades.map(t => t.pnl)) : 0)}</strong><p>Review losing trades and add journal notes.</p></article><article className="panel insight"><Target /><h2>Expectancy</h2><strong>{money(stats.avg)}</strong><p>Average return for every trade taken.</p></article></section>}

  {tab === "Calendar" && <section className="panel calendar-panel"><div className="calendar-head"><button aria-label="Previous month" onClick={() => setCalendarOffset(v => v - 1)}><ChevronLeft /></button><h2>{calendar.month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><button aria-label="Next month" onClick={() => setCalendarOffset(v => v + 1)}><ChevronRight /></button></div><div className="weekdays">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => <b key={d}>{d.slice(0, 3)}</b>)}</div><div className="calendar-grid">{calendar.cells.map((cell, i) => <article key={i} className={`${!cell.current ? "outside " : ""}${cell.data ? (cell.data.pnl >= 0 ? "profit" : "loss") : ""}`}><span>{cell.day}</span>{cell.data && <div><small>{cell.data.count} {cell.data.count === 1 ? "trade" : "trades"}</small><strong>{money(cell.data.pnl)}</strong></div>}</article>)}</div></section>}

  {tab === "Settings" && <section className="settings-grid"><article className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Settings /></div><div><h2>Your journal</h2><p>Personal account information</p></div></div><label>Email<input value={user?.email || "Demo account"} readOnly /></label><div className="settings-pair"><label>Timezone<input value="Asia/Dubai" readOnly /></label><label>Currency<input value="USD" readOnly /></label></div></article><article className="panel settings-card"><div className="settings-title"><div className="settings-icon sync"><Clock3 /></div><div><h2>MT5 synchronization</h2><p>Your automatic trade importer</p></div></div>{syncInfo.length ? syncInfo.map(s => { const account = accounts.find(a => a.id === s.accountId); return <div className="sync-row" key={s.accountId}><div><b>{account?.name || "MT5 account"}</b><small>{s.login ? `Login ${s.login}` : "Waiting for MT5 login"}</small></div><div><span className={s.lastSync ? "online" : "waiting"}>{s.lastSync ? "Connected" : "Waiting"}</span><small>{s.lastSync ? `Last sync ${new Date(s.lastSync).toLocaleString("en-AE")}` : "Open MT5 to sync"}</small></div></div>; }) : <p className="settings-note">No MT5 connection has been added yet.</p>}<p className="settings-note">TradeFlow is read-only. It cannot open, close, or modify trades.</p></article><RuleCenter accounts={visibleAccounts} trades={visibleTrades} mode="settings" /><article className="panel settings-card danger-card"><div className="settings-title"><div className="settings-icon danger"><LogOut /></div><div><h2>Session</h2><p>Sign out from this device</p></div></div><button className="signout" onClick={() => supabase?.auth.signOut()}><LogOut /> Sign out</button></article></section>}
  </main>{modal && <TradeModal accounts={accounts} onClose={() => setModal(false)} onSave={addTrade} />}{accountModal && <AccountModal onClose={() => setAccountModal(false)} onSave={addAccount} />}{editingAccount && <AccountModal account={editingAccount} onClose={() => setEditingAccount(null)} onSave={updateAccount} />}</div>;
}
