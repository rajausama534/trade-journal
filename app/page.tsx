"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity, BarChart3, BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  CircleDollarSign, Clock3, LayoutDashboard, LogOut, Menu, MoreVertical, Pencil, Plus,
  Settings, Target, Trash2, TrendingDown, TrendingUp, WalletCards, X,
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

const money = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 2, signDisplay: "auto",
}).format(value);

export default function Home() {
  const [tab, setTab] = useState("Dashboard");
  const [trades, setTrades] = useState<Trade[]>(isDemoMode ? seedTrades : []);
  const [accounts, setAccounts] = useState<Account[]>(isDemoMode ? starterAccounts : []);
  const [tradeModal, setTradeModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [openAccountMenu, setOpenAccountMenu] = useState<string | null>(null);
  const [nav, setNav] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [syncInfo, setSyncInfo] = useState<{ accountId: string; login: number | null; lastSync: string | null }[]>([]);

  const showTradeModal = (open: boolean) => open && !accounts.length ? setAccountModal(true) : setTradeModal(open);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null); setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [accountResult, tradeResult, syncResult] = await Promise.all([
        supabase.from("accounts").select("*").order("created_at"),
        supabase.from("trades").select("*").order("closed_at", { ascending: false }),
        supabase.from("mt5_connections").select("account_id,mt5_login,last_sync_at"),
      ]);
      if (accountResult.error || tradeResult.error) return;
      setAccounts((accountResult.data || []).map(x => ({
        id: x.id, name: x.name, firm: x.firm, platform: x.platform,
        balance: Number(x.balance), startingBalance: Number(x.starting_balance),
        dailyLimit: Number(x.daily_limit), maxLimit: Number(x.max_limit), status: x.connection_status,
      })));
      setTrades((tradeResult.data || []).map(x => ({
        id: x.id, accountId: x.account_id, symbol: x.symbol, side: x.side,
        lots: Number(x.lots), entry: Number(x.entry), exit: Number(x.exit),
        sl: Number(x.stop_loss || 0), tp: Number(x.take_profit || 0),
        openedAt: x.opened_at, closedAt: x.closed_at, pnl: Number(x.pnl),
        setup: x.setup || "", notes: x.notes || "",
      })));
      if (!syncResult.error) setSyncInfo((syncResult.data || []).map(x => ({
        accountId: x.account_id, login: x.mt5_login ? Number(x.mt5_login) : null, lastSync: x.last_sync_at,
      })));
    })();
  }, [user]);

  const stats = useMemo(() => {
    const pnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const wins = trades.filter(trade => trade.pnl > 0);
    const losses = trades.filter(trade => trade.pnl < 0);
    const gross = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const lost = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    return {
      pnl, wins: wins.length, rate: trades.length ? wins.length / trades.length * 100 : 0,
      pf: lost ? gross / lost : 0, avg: trades.length ? pnl / trades.length : 0,
    };
  }, [trades]);

  const totalStartingBalance = accounts.reduce((sum, account) => sum + account.startingBalance, 0);
  const totalCurrentBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  const chart = useMemo(() => [...trades]
    .sort((a, b) => a.closedAt.localeCompare(b.closedAt))
    .reduce<{ date: string; pnl: number }[]>((points, trade) => {
      points.push({
        date: new Date(trade.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pnl: (points.at(-1)?.pnl || 0) + trade.pnl,
      });
      return points;
    }, []), [trades]);

  const calendar = useMemo(() => {
    const current = new Date();
    const month = new Date(current.getFullYear(), current.getMonth() + calendarOffset, 1);
    const daily = new Map<string, { pnl: number; count: number }>();
    for (const trade of trades) {
      const date = new Date(trade.closedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const value = daily.get(key) || { pnl: 0, count: 0 };
      value.pnl += trade.pnl; value.count += 1; daily.set(key, value);
    }
    const first = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const previous = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
    const cells = Array.from({ length: 42 }, (_, index) => {
      const day = index - first + 1;
      const date = day < 1
        ? new Date(month.getFullYear(), month.getMonth() - 1, previous + day)
        : day > days
          ? new Date(month.getFullYear(), month.getMonth() + 1, day - days)
          : new Date(month.getFullYear(), month.getMonth(), day);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      return { date, day: date.getDate(), current: date.getMonth() === month.getMonth(), data: daily.get(key) };
    });
    return { month, cells };
  }, [trades, calendarOffset]);

  async function addTrade(trade: NewTrade) {
    if (supabase && user) {
      const { data, error } = await supabase.from("trades").insert({
        user_id: user.id, account_id: trade.accountId, symbol: trade.symbol, side: trade.side,
        lots: trade.lots, entry: trade.entry, exit: trade.exit, stop_loss: trade.sl,
        take_profit: trade.tp, opened_at: trade.openedAt, closed_at: trade.closedAt,
        pnl: trade.pnl, setup: trade.setup, notes: trade.notes,
      }).select("id").single();
      if (error) return alert(error.message);
      setTrades(value => [{ ...trade, id: data.id }, ...value]);
    } else setTrades(value => [{ ...trade, id: crypto.randomUUID() }, ...value]);
    showTradeModal(false);
  }

  async function addAccount(account: Omit<Account, "id">) {
    if (!supabase || !user) return;
    const { data, error } = await supabase.from("accounts").insert({
      user_id: user.id, name: account.name, firm: account.firm, platform: account.platform,
      balance: account.balance, starting_balance: account.startingBalance,
      daily_limit: account.dailyLimit, max_limit: account.maxLimit, connection_status: account.status,
    }).select("id").single();
    if (error) return alert(error.message);
    setAccounts(value => [...value, { ...account, id: data.id }]);
    setAccountModal(false);
  }

  async function updateAccount(account: Omit<Account, "id">) {
    const current = editingAccount;
    if (!current) return;
    if (supabase && user) {
      const { error } = await supabase.from("accounts").update({
        name: account.name, firm: account.firm, platform: account.platform,
        balance: account.balance, starting_balance: account.startingBalance,
        daily_limit: account.dailyLimit, max_limit: account.maxLimit, connection_status: account.status,
      }).eq("id", current.id).eq("user_id", user.id);
      if (error) return alert(error.message);
    }
    setAccounts(value => value.map(item => item.id === current.id ? { ...account, id: current.id } : item));
    setEditingAccount(null);
  }

  async function deleteAccount(account: Account) {
    const confirmed = window.confirm(
      `Delete ${account.name}? This permanently removes the account, every linked trade, and its MT5 connection. This cannot be undone.`
    );
    if (!confirmed) return;

    if (supabase && user) {
      const { error } = await supabase.rpc("delete_trading_account", { target_account_id: account.id });
      if (error) return alert(error.message);
    }

    setAccounts(value => value.filter(item => item.id !== account.id));
    setTrades(value => value.filter(trade => trade.accountId !== account.id));
    setSyncInfo(value => value.filter(item => item.accountId !== account.id));
    setSelectedAccountId(value => value === account.id ? null : value);
    setOpenAccountMenu(null);
  }

  if (loading) return <main className="auth"><section><p>Loading your journal…</p></section></main>;
  if (!isDemoMode && !user) return <AuthScreen />;

  const navItems = [
    ["Dashboard", LayoutDashboard], ["Trades", BookOpen], ["Accounts", WalletCards],
    ["Analytics", BarChart3], ["Calendar", CalendarDays], ["Settings", Settings],
  ] as const;

  return <div className="app" onClick={() => openAccountMenu && setOpenAccountMenu(null)}>
    <aside className={nav ? "open" : ""}>
      <div className="brand"><div><Activity /></div><b>Trade<span>Flow</span></b><button onClick={() => setNav(false)}><X /></button></div>
      <nav>{navItems.map(([name, Icon]) => <button key={name} className={tab === name ? "selected" : ""} onClick={() => { setTab(name); setNav(false); }}><Icon size={19} />{name}</button>)}</nav>
      <div className="aside-foot"><div className="avatar">UR</div><div><b>Usama Raja</b><small>Gold trader</small></div><ChevronDown size={16} /></div>
    </aside>

    <main>
      <header className="top">
        <button className="mobile-menu" onClick={() => setNav(true)}><Menu /></button>
        <div><h1>{tab}</h1><p>{tab === "Dashboard" ? "Overall account health, without clutter." : `Review your ${tab.toLowerCase()} workspace.`}</p></div>
        <div className="top-actions">{isDemoMode && <span className="demo">Sample data</span>}<button className="primary" onClick={() => showTradeModal(true)}><Plus size={17} />Add trade</button></div>
      </header>

      {tab === "Dashboard" && <>
        <section className="metrics">
          <MetricCard label="Starting balance" value={money(totalStartingBalance)} detail="First sync baseline" icon={WalletCards} tone="blue" />
          <MetricCard label="Current balance" value={money(totalCurrentBalance)} detail="Across active accounts" icon={CircleDollarSign} />
          <MetricCard label="Overall P&L" value={money(stats.pnl)} detail={`${trades.length} closed trades`} icon={stats.pnl >= 0 ? TrendingUp : TrendingDown} tone={stats.pnl >= 0 ? "green" : "red"} />
          <MetricCard label="Win rate" value={`${stats.rate.toFixed(1)}%`} detail={`${stats.wins} winning trades`} icon={Target} tone="blue" />
        </section>
        <section className="dashboard-grid">
          <article className="panel chart-panel">
            <div className="panel-head"><div><h2>Equity curve</h2><p>Cumulative realized P&L</p></div><span className={stats.pnl >= 0 ? "positive" : "negative"}>{money(stats.pnl)}</span></div>
            <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={stats.pnl >= 0 ? "#31d896" : "#ff5c6c"} stopOpacity=".35" /><stop offset="1" stopColor={stats.pnl >= 0 ? "#31d896" : "#ff5c6c"} stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#263148" vertical={false} /><XAxis dataKey="date" stroke="#778198" fontSize={12} /><YAxis stroke="#778198" fontSize={12} /><Tooltip contentStyle={{ background: "#111827", border: "1px solid #29334a", borderRadius: 10 }} /><Area type="monotone" dataKey="pnl" stroke={stats.pnl >= 0 ? "#31d896" : "#ff5c6c"} strokeWidth={2.5} fill="url(#fill)" /></AreaChart></ResponsiveContainer></div>
          </article>
          <article className="panel accounts-panel">
            <div className="panel-head"><div><h2>Active accounts</h2><p>Current balance and status</p></div><button onClick={() => setTab("Accounts")}>Manage</button></div>
            {accounts.map(account => <div className="account" key={account.id}><div className="account-icon"><WalletCards /></div><div><b>{account.name}</b><small>{account.firm} · {account.platform}</small></div><div className="account-value"><b>{money(account.balance)}</b><small>{account.status}</small></div></div>)}
            <RuleCenter accounts={accounts} trades={trades} mode="summary" />
          </article>
        </section>
      </>}

      {(tab === "Trades" || tab === "Dashboard") && <section className="panel table-panel">
        <div className="panel-head"><div><h2>Recent trades</h2><p>Your latest closed positions</p></div>{tab === "Dashboard" && <button onClick={() => setTab("Trades")}>View all</button>}</div>
        <div className="table-wrap"><table><thead><tr><th>Trade</th><th>Account</th><th>Side</th><th>Entry / Exit</th><th>Setup</th><th>Closed</th><th>P&amp;L</th></tr></thead><tbody>
          {trades.slice(0, tab === "Dashboard" ? 5 : 999).map(trade => { const account = accounts.find(item => item.id === trade.accountId); return <tr key={trade.id}><td><b>{trade.symbol}</b><small>{trade.lots} lots</small></td><td>{account?.name}</td><td><span className={`side ${trade.side.toLowerCase()}`}>{trade.side}</span></td><td><b>{trade.entry}</b><small>{trade.exit}</small></td><td>{trade.setup}</td><td>{new Date(trade.closedAt).toLocaleString("en-AE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td><td className={trade.pnl >= 0 ? "positive" : "negative"}>{money(trade.pnl)}</td></tr>; })}
        </tbody></table></div>
      </section>}

      {tab === "Accounts" && (selectedAccountId && accounts.find(account => account.id === selectedAccountId)
        ? <AccountPerformance account={accounts.find(account => account.id === selectedAccountId)!} trades={trades} onBack={() => setSelectedAccountId(null)} onEdit={() => setEditingAccount(accounts.find(account => account.id === selectedAccountId)!)} />
        : <section className="cards">{accounts.map(account => <article className="panel account-card" key={account.id}>
          <div className="panel-head"><div><small>{account.firm}</small><h2>{account.name}</h2></div><div className="account-menu-wrap" onClick={event => event.stopPropagation()}><button className="account-menu-button" aria-label={`Manage ${account.name}`} onClick={() => setOpenAccountMenu(value => value === account.id ? null : account.id)}><MoreVertical /></button>{openAccountMenu === account.id && <div className="account-menu"><button onClick={() => { setEditingAccount(account); setOpenAccountMenu(null); }}><Pencil />Edit</button><button className="delete" onClick={() => deleteAccount(account)}><Trash2 />Delete account</button></div>}</div></div>
          <span className="status">{account.status}</span><strong>{money(account.balance)}</strong><p>Started at {money(account.startingBalance)} · {account.platform}</p>
          <div className="limits"><span>Daily limit <b>{money(account.dailyLimit)}</b></span><span>Max limit <b>{money(account.maxLimit)}</b></span></div>
          <div className="account-actions"><button className="secondary" onClick={() => setSelectedAccountId(account.id)}>View performance</button></div>
        </article>)}</section>)}

      {tab === "Analytics" && <section className="cards"><article className="panel insight"><TrendingUp /><h2>Profit factor</h2><strong>{stats.pf.toFixed(2)}</strong><p>Gross profit divided by gross loss.</p></article><article className="panel insight"><TrendingDown /><h2>Largest loss</h2><strong>{money(trades.length ? Math.min(...trades.map(trade => trade.pnl)) : 0)}</strong><p>Use the calendar to review that day.</p></article><article className="panel insight"><Target /><h2>Expectancy</h2><strong>{money(stats.avg)}</strong><p>Average result per closed trade.</p></article></section>}

      {tab === "Calendar" && <section className="panel calendar-panel"><div className="calendar-head"><button aria-label="Previous month" onClick={() => setCalendarOffset(value => value - 1)}><ChevronLeft /></button><h2>{calendar.month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><button aria-label="Next month" onClick={() => setCalendarOffset(value => value + 1)}><ChevronRight /></button></div><div className="weekdays">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => <b key={day}>{day.slice(0, 3)}</b>)}</div><div className="calendar-grid">{calendar.cells.map((cell, index) => <article key={index} className={`${!cell.current ? "outside " : ""}${cell.data ? (cell.data.pnl >= 0 ? "profit" : "loss") : ""}`}><span>{cell.day}</span>{cell.data && <div><small>{cell.data.count} {cell.data.count === 1 ? "trade" : "trades"}</small><strong>{money(cell.data.pnl)}</strong></div>}</article>)}</div></section>}

      {tab === "Settings" && <section className="settings-grid"><article className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Settings /></div><div><h2>Your journal</h2><p>Personal account information</p></div></div><label>Email<input value={user?.email || "Demo account"} readOnly /></label><div className="settings-pair"><label>Timezone<input value="Asia/Dubai" readOnly /></label><label>Currency<input value="USD" readOnly /></label></div></article><article className="panel settings-card"><div className="settings-title"><div className="settings-icon sync"><Clock3 /></div><div><h2>MT5 synchronization</h2><p>Read-only automatic trade importer</p></div></div>{syncInfo.length ? syncInfo.map(sync => { const account = accounts.find(item => item.id === sync.accountId); return <div className="sync-row" key={sync.accountId}><div><b>{account?.name || "MT5 account"}</b><small>{sync.login ? `Login ${sync.login}` : "Waiting for MT5 login"}</small></div><div><span className={sync.lastSync ? "online" : "waiting"}>{sync.lastSync ? "Connected" : "Waiting"}</span><small>{sync.lastSync ? `Last sync ${new Date(sync.lastSync).toLocaleString("en-AE")}` : "Open MT5 to sync"}</small></div></div>; }) : <p className="settings-note">No MT5 connection has been added yet.</p>}<p className="settings-note">The first successful connection becomes the starting balance and start date. Older trades are ignored.</p></article><RuleCenter accounts={accounts} trades={trades} mode="settings" /><article className="panel settings-card danger-card"><div className="settings-title"><div className="settings-icon danger"><LogOut /></div><div><h2>Session</h2><p>Sign out from this device</p></div></div><button className="signout" onClick={() => supabase?.auth.signOut()}><LogOut />Sign out</button></article></section>}
    </main>

    {tradeModal && <TradeModal accounts={accounts} onClose={() => showTradeModal(false)} onSave={addTrade} />}
    {accountModal && <AccountModal onClose={() => setAccountModal(false)} onSave={addAccount} />}
    {editingAccount && <AccountModal account={editingAccount} onClose={() => setEditingAccount(null)} onSave={updateAccount} />}
  </div>;
}
