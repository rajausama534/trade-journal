"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Filter,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    signDisplay: "auto",
  }).format(value);

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

type Goal = { id: string; label: string; target: number; createdAt: string };

type JournalStats = {
  pnl: number;
  wins: number;
  losses: number;
  rate: number;
  pf: number;
  avg: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  largestWin: number;
  largestLoss: number;
};

function calculateStats(items: Trade[]): JournalStats {
  const wins = items.filter((trade) => trade.pnl > 0);
  const losses = items.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const pnl = items.reduce((sum, trade) => sum + trade.pnl, 0);
  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  const winRate = items.length ? wins.length / items.length : 0;

  return {
    pnl,
    wins: wins.length,
    losses: losses.length,
    rate: winRate * 100,
    pf: grossLoss ? grossProfit / grossLoss : grossProfit ? Number.POSITIVE_INFINITY : 0,
    avg: items.length ? pnl / items.length : 0,
    averageWin,
    averageLoss,
    expectancy: winRate * averageWin - (1 - winRate) * averageLoss,
    largestWin: wins.length ? Math.max(...wins.map((trade) => trade.pnl)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map((trade) => trade.pnl)) : 0,
  };
}

export default function Home() {
  const [tab, setTab] = useState("Dashboard");
  const [trades, setTrades] = useState<Trade[]>(isDemoMode ? seedTrades : []);
  const [accounts, setAccounts] = useState<Account[]>(isDemoMode ? starterAccounts : []);
  const [modal, setTradeModalState] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [nav, setNav] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [syncInfo, setSyncInfo] = useState<
    { accountId: string; login: number | null; lastSync: string | null }[]
  >([]);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalLabel, setGoalLabel] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  const seedAccounts = accounts;
  const openTradeModal = (open: boolean) =>
    open && !accounts.length ? setAccountModal(true) : setTradeModalState(open);

  useEffect(() => {
    const stored = window.localStorage.getItem("tradeflow-goals");
    if (stored) {
      try {
        setGoals(JSON.parse(stored));
      } catch {
        window.localStorage.removeItem("tradeflow-goals");
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("tradeflow-goals", JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [accountResponse, tradeResponse, syncResponse] = await Promise.all([
        supabase.from("accounts").select("*").order("created_at"),
        supabase.from("trades").select("*").order("closed_at", { ascending: false }),
        supabase.from("mt5_connections").select("account_id,mt5_login,last_sync_at"),
      ]);

      if (accountResponse.error || tradeResponse.error) return;

      setAccounts(
        (accountResponse.data || []).map((item) => ({
          id: item.id,
          name: item.name,
          firm: item.firm,
          platform: item.platform,
          balance: Number(item.balance),
          startingBalance: Number(item.starting_balance),
          dailyLimit: Number(item.daily_limit),
          maxLimit: Number(item.max_limit),
          status: item.connection_status,
        })),
      );
      setTrades(
        (tradeResponse.data || []).map((item) => ({
          id: item.id,
          accountId: item.account_id,
          symbol: item.symbol,
          side: item.side,
          lots: Number(item.lots),
          entry: Number(item.entry),
          exit: Number(item.exit),
          sl: Number(item.stop_loss || 0),
          tp: Number(item.take_profit || 0),
          openedAt: item.opened_at,
          closedAt: item.closed_at,
          pnl: Number(item.pnl),
          setup: item.setup || "",
          notes: item.notes || "",
        })),
      );
      if (!syncResponse.error) {
        setSyncInfo(
          (syncResponse.data || []).map((item) => ({
            accountId: item.account_id,
            login: item.mt5_login ? Number(item.mt5_login) : null,
            lastSync: item.last_sync_at,
          })),
        );
      }
    })();
  }, [user]);

  const filteredTrades = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return trades.filter((trade) => {
      const account = accounts.find((item) => item.id === trade.accountId);
      const matchesQuery =
        !normalized ||
        trade.symbol.toLowerCase().includes(normalized) ||
        trade.setup.toLowerCase().includes(normalized) ||
        (trade.notes || "").toLowerCase().includes(normalized) ||
        account?.name.toLowerCase().includes(normalized);
      const matchesAccount = accountFilter === "all" || trade.accountId === accountFilter;
      const matchesResult =
        resultFilter === "all" ||
        (resultFilter === "wins" && trade.pnl > 0) ||
        (resultFilter === "losses" && trade.pnl < 0) ||
        (resultFilter === "breakeven" && trade.pnl === 0);
      return matchesQuery && matchesAccount && matchesResult;
    });
  }, [trades, accounts, query, accountFilter, resultFilter]);

  const stats = useMemo(() => calculateStats(trades), [trades]);
  const filteredStats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

  const chart = useMemo(
    () =>
      [...trades]
        .sort((a, b) => a.closedAt.localeCompare(b.closedAt))
        .reduce<{ date: string; pnl: number }[]>((points, trade) => {
          points.push({
            date: new Date(trade.closedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            pnl: (points.at(-1)?.pnl || 0) + trade.pnl,
          });
          return points;
        }, []),
    [trades],
  );

  const setupPerformance = useMemo(() => {
    const grouped = new Map<string, { setup: string; pnl: number; trades: number; wins: number }>();
    trades.forEach((trade) => {
      const key = trade.setup.trim() || "Unclassified";
      const current = grouped.get(key) || { setup: key, pnl: 0, trades: 0, wins: 0 };
      current.pnl += trade.pnl;
      current.trades += 1;
      if (trade.pnl > 0) current.wins += 1;
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const dayPerformance = useMemo(() => {
    const grouped = new Map<string, number>();
    trades.forEach((trade) => {
      const day = new Date(trade.closedAt).toLocaleDateString("en-US", { weekday: "short" });
      grouped.set(day, (grouped.get(day) || 0) + trade.pnl);
    });
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day,
      pnl: grouped.get(day) || 0,
    }));
  }, [trades]);

  const psychology = useMemo(() => {
    const emotional = trades.filter((trade) =>
      /revenge|fomo|fear|greed|rushed|overtrade|impulsive|angry|anxious/i.test(trade.notes || ""),
    );
    const disciplined = trades.filter((trade) =>
      /patient|discipline|plan|confirmation|calm|rule|setup/i.test(trade.notes || ""),
    );
    return {
      emotional,
      disciplined,
      emotionalPnl: emotional.reduce((sum, trade) => sum + trade.pnl, 0),
      disciplinedPnl: disciplined.reduce((sum, trade) => sum + trade.pnl, 0),
    };
  }, [trades]);

  const calendar = useMemo(() => {
    const latest = trades.length
      ? new Date(Math.max(...trades.map((trade) => new Date(trade.closedAt).getTime())))
      : new Date();
    const month = new Date(latest.getFullYear(), latest.getMonth() + calendarOffset, 1);
    const daily = new Map<string, { pnl: number; count: number }>();
    for (const trade of trades) {
      const date = new Date(trade.closedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const value = daily.get(key) || { pnl: 0, count: 0 };
      value.pnl += trade.pnl;
      value.count += 1;
      daily.set(key, value);
    }
    const first = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const previous = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
    const cells = Array.from({ length: 42 }, (_, index) => {
      const day = index - first + 1;
      const date =
        day < 1
          ? new Date(month.getFullYear(), month.getMonth() - 1, previous + day)
          : day > days
            ? new Date(month.getFullYear(), month.getMonth() + 1, day - days)
            : new Date(month.getFullYear(), month.getMonth(), day);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      return {
        date,
        day: date.getDate(),
        current: date.getMonth() === month.getMonth(),
        data: daily.get(key),
      };
    });
    return { month, cells };
  }, [trades, calendarOffset]);

  async function addTrade(trade: NewTrade) {
    if (supabase && user) {
      const { data, error } = await supabase
        .from("trades")
        .insert({
          user_id: user.id,
          account_id: trade.accountId,
          symbol: trade.symbol,
          side: trade.side,
          lots: trade.lots,
          entry: trade.entry,
          exit: trade.exit,
          stop_loss: trade.sl,
          take_profit: trade.tp,
          opened_at: trade.openedAt,
          closed_at: trade.closedAt,
          pnl: trade.pnl,
          setup: trade.setup,
          notes: trade.notes,
        })
        .select("id")
        .single();
      if (error) return alert(error.message);
      setTrades((items) => [{ ...trade, id: data.id }, ...items]);
    } else {
      setTrades((items) => [{ ...trade, id: crypto.randomUUID() }, ...items]);
    }
    openTradeModal(false);
  }

  async function addAccount(account: Omit<Account, "id">) {
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name: account.name,
        firm: account.firm,
        platform: account.platform,
        balance: account.balance,
        starting_balance: account.startingBalance,
        daily_limit: account.dailyLimit,
        max_limit: account.maxLimit,
        connection_status: account.status,
      })
      .select("id")
      .single();
    if (error) return alert(error.message);
    setAccounts((items) => [...items, { ...account, id: data.id }]);
    setAccountModal(false);
  }

  async function updateAccount(account: Omit<Account, "id">) {
    const current = editingAccount;
    if (!current) return;
    if (supabase && user) {
      const { error } = await supabase
        .from("accounts")
        .update({
          name: account.name,
          firm: account.firm,
          platform: account.platform,
          balance: account.balance,
          starting_balance: account.startingBalance,
          daily_limit: account.dailyLimit,
          max_limit: account.maxLimit,
          connection_status: account.status,
        })
        .eq("id", current.id)
        .eq("user_id", user.id);
      if (error) return alert(error.message);
    }
    setAccounts((items) =>
      items.map((item) => (item.id === current.id ? { ...account, id: current.id } : item)),
    );
    setEditingAccount(null);
  }

  function exportTrades() {
    const rows = [
      ["Account", "Symbol", "Side", "Lots", "Entry", "Exit", "Stop Loss", "Take Profit", "Setup", "Opened", "Closed", "P&L", "Notes"],
      ...filteredTrades.map((trade) => [
        accounts.find((account) => account.id === trade.accountId)?.name || "",
        trade.symbol,
        trade.side,
        trade.lots,
        trade.entry,
        trade.exit,
        trade.sl,
        trade.tp,
        trade.setup,
        trade.openedAt,
        trade.closedAt,
        trade.pnl,
        trade.notes || "",
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tradeflow-export-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addGoal() {
    const target = Number(goalTarget);
    if (!goalLabel.trim() || !Number.isFinite(target) || target <= 0) return;
    setGoals((items) => [
      ...items,
      { id: crypto.randomUUID(), label: goalLabel.trim(), target, createdAt: new Date().toISOString() },
    ]);
    setGoalLabel("");
    setGoalTarget("");
  }

  if (loading) return <main className="auth"><section><p>Loading your journal…</p></section></main>;
  if (!isDemoMode && !user) return <AuthScreen />;

  const navItems = [
    ["Dashboard", LayoutDashboard],
    ["Trades", BookOpen],
    ["Accounts", WalletCards],
    ["Analytics", BarChart3],
    ["Calendar", CalendarDays],
    ["Psychology", Brain],
    ["Goals", Target],
    ["Settings", Settings],
  ] as const;

  const bestSetup = setupPerformance[0];
  const worstSetup = setupPerformance.at(-1);

  return (
    <div className="app">
      <aside className={nav ? "open" : ""}>
        <div className="brand"><div><Activity /></div><b>Trade<span>Flow</span></b><button onClick={() => setNav(false)}><X /></button></div>
        <nav>{navItems.map(([name, Icon]) => <button key={name} className={tab === name ? "selected" : ""} onClick={() => { setTab(name); setNav(false); }}><Icon size={19} />{name}</button>)}</nav>
        <div className="aside-foot"><div className="avatar">UR</div><div><b>Usama Raja</b><small>Prop trader</small></div><ChevronDown size={16} /></div>
      </aside>

      <main>
        <header className="top">
          <button className="mobile-menu" onClick={() => setNav(true)}><Menu /></button>
          <div><h1>{tab}</h1><p>{tab === "Dashboard" ? "Your trading performance, at a glance." : `Review your ${tab.toLowerCase()} workspace.`}</p></div>
          <div className="top-actions">{isDemoMode && <span className="demo">Sample data</span>}<button className="primary" onClick={() => openTradeModal(true)}><Plus size={17} />Add trade</button></div>
        </header>

        {tab === "Dashboard" && <>
          <section className="metrics">
            <MetricCard label="Net P&L" value={money(stats.pnl)} detail="Across all accounts" icon={CircleDollarSign} />
            <MetricCard label="Win rate" value={`${stats.rate.toFixed(1)}%`} detail={`${stats.wins} of ${trades.length} trades won`} icon={Target} tone="blue" />
            <MetricCard label="Profit factor" value={Number.isFinite(stats.pf) ? stats.pf.toFixed(2) : "∞"} detail="Gross profit / loss" icon={TrendingUp} />
            <MetricCard label="Expectancy" value={money(stats.expectancy)} detail="Expected value per trade" icon={Activity} tone={stats.expectancy >= 0 ? "green" : "red"} />
          </section>
          <section className="dashboard-grid">
            <article className="panel chart-panel"><div className="panel-head"><div><h2>Equity curve</h2><p>Cumulative realized profit</p></div><span className={stats.pnl >= 0 ? "positive" : "negative"}>{money(stats.pnl)}</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid stroke="#263148" vertical={false} /><XAxis dataKey="date" stroke="#778198" fontSize={12} /><YAxis stroke="#778198" fontSize={12} /><Tooltip contentStyle={{ background: "#111827", border: "1px solid #29334a", borderRadius: 10 }} /><Area type="monotone" dataKey="pnl" stroke={stats.pnl >= 0 ? "#31d896" : "#ff5c6c"} strokeWidth={2.5} fillOpacity={0.16} fill={stats.pnl >= 0 ? "#31d896" : "#ff5c6c"} /></AreaChart></ResponsiveContainer></div></article>
            <article className="panel accounts-panel"><div className="panel-head"><div><h2>Accounts</h2><p>Balance & rule health</p></div><button onClick={() => setTab("Accounts")}>View all</button></div>{seedAccounts.map((account) => { const change = (account.balance / account.startingBalance - 1) * 100; return <div className="account" key={account.id}><div className="account-icon"><WalletCards /></div><div><b>{account.name}</b><small>{account.firm} · {account.platform}</small></div><div className="account-value"><b>{money(account.balance)}</b><small className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</small></div></div>; })}<RuleCenter accounts={accounts} trades={trades} mode="summary" /></article>
          </section>
          <TradeTable trades={trades.slice(0, 5)} accounts={accounts} title="Recent trades" subtitle="Your latest closed positions" onViewAll={() => setTab("Trades")} />
        </>}

        {tab === "Trades" && <>
          <section className="panel filter-panel"><div className="filter-row"><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symbol, setup, account or notes" /></label><label><Filter size={15} /><select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="all">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option value="all">All results</option><option value="wins">Wins</option><option value="losses">Losses</option><option value="breakeven">Breakeven</option></select></label><button className="secondary" onClick={exportTrades}><Download size={16} />Export CSV</button></div><div className="filter-summary"><span>{filteredTrades.length} trades</span><span className={filteredStats.pnl >= 0 ? "positive" : "negative"}>{money(filteredStats.pnl)}</span><span>{filteredStats.rate.toFixed(1)}% win rate</span></div></section>
          <TradeTable trades={filteredTrades} accounts={accounts} title="Trade journal" subtitle="Filter, review and export every closed position" />
        </>}

        {tab === "Accounts" && (selectedAccountId && seedAccounts.find((account) => account.id === selectedAccountId) ? <AccountPerformance account={seedAccounts.find((account) => account.id === selectedAccountId)!} trades={trades} onBack={() => setSelectedAccountId(null)} onEdit={() => setEditingAccount(seedAccounts.find((account) => account.id === selectedAccountId)!)} /> : <><div className="section-actions"><button className="primary" onClick={() => setAccountModal(true)}><Plus size={16} />Add account</button></div><section className="cards">{seedAccounts.map((account) => <article className="panel account-card" key={account.id}><div className="panel-head"><div><small>{account.firm}</small><h2>{account.name}</h2></div><span className="status">{account.status}</span></div><strong>{money(account.balance)}</strong><p>Started at {money(account.startingBalance)} · {account.platform}</p><div className="limits"><span>Daily limit <b>{money(account.dailyLimit)}</b></span><span>Max limit <b>{money(account.maxLimit)}</b></span></div><div className="account-actions"><button className="secondary" onClick={() => setSelectedAccountId(account.id)}>View performance</button><button className="secondary" onClick={() => setEditingAccount(account)}>Edit / remove</button></div></article>)}</section></>)}

        {tab === "Analytics" && <><section className="metrics analytics-metrics"><MetricCard label="Average winner" value={money(stats.averageWin)} detail={`${stats.wins} winning trades`} icon={TrendingUp} /><MetricCard label="Average loser" value={money(-stats.averageLoss)} detail={`${stats.losses} losing trades`} icon={TrendingDown} tone="red" /><MetricCard label="Largest winner" value={money(stats.largestWin)} detail="Best single trade" icon={TrendingUp} /><MetricCard label="Largest loss" value={money(stats.largestLoss)} detail="Worst single trade" icon={TrendingDown} tone="red" /></section><section className="analytics-grid"><article className="panel"><div className="panel-head"><div><h2>P&L by weekday</h2><p>Find your strongest and weakest trading days</p></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dayPerformance}><CartesianGrid stroke="#263148" vertical={false} /><XAxis dataKey="day" stroke="#778198" /><YAxis stroke="#778198" /><Tooltip contentStyle={{ background: "#111827", border: "1px solid #29334a", borderRadius: 10 }} /><Bar dataKey="pnl" fill="#5f8cff" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></article><article className="panel setup-list"><div className="panel-head"><div><h2>Setup leaderboard</h2><p>Ranked by realized P&L</p></div></div>{setupPerformance.length ? setupPerformance.map((item) => <div className="setup-row" key={item.setup}><div><b>{item.setup}</b><small>{item.trades} trades · {(item.wins / item.trades * 100).toFixed(0)}% wins</small></div><strong className={item.pnl >= 0 ? "positive" : "negative"}>{money(item.pnl)}</strong></div>) : <p>No setup data yet.</p>}</article></section><section className="cards insight-cards"><article className="panel insight"><TrendingUp /><h2>Best setup</h2><strong>{bestSetup?.setup || "No data"}</strong><p>{bestSetup ? `${money(bestSetup.pnl)} across ${bestSetup.trades} trades.` : "Add trades to calculate this."}</p></article><article className="panel insight"><TrendingDown /><h2>Weakest setup</h2><strong>{worstSetup?.setup || "No data"}</strong><p>{worstSetup ? `${money(worstSetup.pnl)} across ${worstSetup.trades} trades.` : "Add trades to calculate this."}</p></article><article className="panel insight"><Target /><h2>Expectancy</h2><strong>{money(stats.expectancy)}</strong><p>Average expected return for each trade.</p></article></section></>}

        {tab === "Calendar" && <section className="panel calendar-panel"><div className="calendar-head"><button aria-label="Previous month" onClick={() => setCalendarOffset((value) => value - 1)}><ChevronLeft /></button><h2>{calendar.month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><button aria-label="Next month" onClick={() => setCalendarOffset((value) => value + 1)}><ChevronRight /></button></div><div className="weekdays">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <b key={day}>{day.slice(0, 3)}</b>)}</div><div className="calendar-grid">{calendar.cells.map((cell, index) => <article key={index} className={`${!cell.current ? "outside " : ""}${cell.data ? (cell.data.pnl >= 0 ? "profit" : "loss") : ""}`}><span>{cell.day}</span>{cell.data && <div><small>{cell.data.count} {cell.data.count === 1 ? "trade" : "trades"}</small><strong>{money(cell.data.pnl)}</strong></div>}</article>)}</div></section>}

        {tab === "Psychology" && <section className="psychology-grid"><article className="panel psychology-score"><Brain /><h2>Discipline review</h2><strong>{trades.length ? `${Math.max(0, Math.round((1 - psychology.emotional.length / trades.length) * 100))}%` : "—"}</strong><p>Based on keywords in your trade notes. Record the reason, emotion and execution quality after every trade for more accurate feedback.</p></article><article className="panel"><div className="panel-head"><div><h2>Disciplined trades</h2><p>Notes mentioning patience, rules, confirmation or a plan</p></div><span className={psychology.disciplinedPnl >= 0 ? "positive" : "negative"}>{money(psychology.disciplinedPnl)}</span></div><div className="psych-list">{psychology.disciplined.slice(0, 6).map((trade) => <div key={trade.id}><b>{trade.symbol} · {trade.setup}</b><small>{trade.notes}</small></div>)}{!psychology.disciplined.length && <p>No disciplined-trade notes detected yet.</p>}</div></article><article className="panel"><div className="panel-head"><div><h2>Emotional-risk trades</h2><p>Notes mentioning FOMO, revenge, fear or impulsive execution</p></div><span className={psychology.emotionalPnl >= 0 ? "positive" : "negative"}>{money(psychology.emotionalPnl)}</span></div><div className="psych-list">{psychology.emotional.slice(0, 6).map((trade) => <div key={trade.id}><b>{trade.symbol} · {trade.setup}</b><small>{trade.notes}</small></div>)}{!psychology.emotional.length && <p>No emotional-risk keywords detected.</p>}</div></article></section>}

        {tab === "Goals" && <section className="goals-layout"><article className="panel goal-form"><Target /><h2>Create a profit goal</h2><p>Goals are stored privately in this browser and do not require a database change.</p><label>Goal name<input value={goalLabel} onChange={(event) => setGoalLabel(event.target.value)} placeholder="FundedHive payout" /></label><label>Target profit<input type="number" min="1" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} placeholder="1000" /></label><button className="primary" onClick={addGoal}><Plus size={16} />Add goal</button></article><section className="goal-list">{goals.map((goal) => { const progress = Math.max(0, Math.min(100, stats.pnl / goal.target * 100)); return <article className="panel goal-card" key={goal.id}><div className="panel-head"><div><h2>{goal.label}</h2><p>Target {money(goal.target)}</p></div><button className="icon-btn" aria-label="Remove goal" onClick={() => setGoals((items) => items.filter((item) => item.id !== goal.id))}><X size={17} /></button></div><strong>{progress.toFixed(0)}%</strong><div className="goal-meter"><span style={{ width: `${progress}%` }} /></div><small>{money(stats.pnl)} of {money(goal.target)}</small></article>; })}{!goals.length && <article className="panel empty compact"><Target /><h2>No active goals</h2><p>Create a payout or monthly profit target.</p></article>}</section></section>}

        {tab === "Settings" && <section className="settings-grid"><article className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Settings /></div><div><h2>Your journal</h2><p>Personal account information</p></div></div><label>Email<input value={user?.email || "Demo account"} readOnly /></label><div className="settings-pair"><label>Timezone<input value="Asia/Dubai" readOnly /></label><label>Currency<input value="USD" readOnly /></label></div></article><article className="panel settings-card"><div className="settings-title"><div className="settings-icon sync"><Clock3 /></div><div><h2>MT5 synchronization</h2><p>Your automatic trade importer</p></div></div>{syncInfo.length ? syncInfo.map((sync) => { const account = accounts.find((item) => item.id === sync.accountId); return <div className="sync-row" key={sync.accountId}><div><b>{account?.name || "MT5 account"}</b><small>{sync.login ? `Login ${sync.login}` : "Waiting for MT5 login"}</small></div><div><span className={sync.lastSync ? "online" : "waiting"}>{sync.lastSync ? "Connected" : "Waiting"}</span><small>{sync.lastSync ? `Last sync ${new Date(sync.lastSync).toLocaleString("en-AE")}` : "Open MT5 to sync"}</small></div></div>; }) : <p className="settings-note">No MT5 connection has been added yet.</p>}<p className="settings-note">TradeFlow is read-only. It cannot open, close, or modify trades.</p></article><RuleCenter accounts={accounts} trades={trades} mode="settings" /><article className="panel settings-card danger-card"><div className="settings-title"><div className="settings-icon danger"><LogOut /></div><div><h2>Session</h2><p>Sign out from this device</p></div></div><button className="signout" onClick={() => supabase?.auth.signOut()}><LogOut />Sign out</button></article></section>}
      </main>

      {modal && <TradeModal accounts={seedAccounts} onClose={() => openTradeModal(false)} onSave={addTrade} />}
      {accountModal && <AccountModal onClose={() => setAccountModal(false)} onSave={addAccount} />}
      {editingAccount && <AccountModal account={editingAccount} onClose={() => setEditingAccount(null)} onSave={updateAccount} />}
    </div>
  );
}

function TradeTable({ trades, accounts, title, subtitle, onViewAll }: { trades: Trade[]; accounts: Account[]; title: string; subtitle: string; onViewAll?: () => void }) {
  return <section className="panel table-panel"><div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{onViewAll && <button onClick={onViewAll}>View all</button>}</div><div className="table-wrap"><table><thead><tr><th>Trade</th><th>Account</th><th>Side</th><th>Entry / Exit</th><th>Setup</th><th>Closed</th><th>P&amp;L</th></tr></thead><tbody>{trades.map((trade) => { const account = accounts.find((item) => item.id === trade.accountId); return <tr key={trade.id}><td><b>{trade.symbol}</b><small>{trade.lots} lots</small></td><td>{account?.name || "Removed account"}</td><td><span className={`side ${trade.side.toLowerCase()}`}>{trade.side}</span></td><td><b>{trade.entry}</b><small>{trade.exit}</small></td><td>{trade.setup}</td><td>{new Date(trade.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td className={trade.pnl >= 0 ? "positive" : "negative"}>{money(trade.pnl)}</td></tr>; })}{!trades.length && <tr><td colSpan={7} className="empty-table">No trades match the current filters.</td></tr>}</tbody></table></div></section>;
}
