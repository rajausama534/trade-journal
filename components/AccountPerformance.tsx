"use client";

import { ArrowLeft, Pencil, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Account, Trade } from "@/lib/types";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export function AccountPerformance({ account, trades, onBack, onEdit }: { account: Account; trades: Trade[]; onBack: () => void; onEdit: () => void }) {
  const accountTrades = trades.filter(trade => trade.accountId === account.id).sort((a, b) => a.closedAt.localeCompare(b.closedAt));
  const pnl = accountTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const wins = accountTrades.filter(trade => trade.pnl > 0);
  const losses = accountTrades.filter(trade => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const chart = accountTrades.reduce<{ date: string; pnl: number }[]>((points, trade) => {
    points.push({ date: new Date(trade.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), pnl: (points.at(-1)?.pnl || 0) + trade.pnl });
    return points;
  }, []);

  return <section className="account-detail"><div className="account-detail-head"><button className="secondary" onClick={onBack}><ArrowLeft size={17}/>All accounts</button><button className="primary" onClick={onEdit}><Pencil size={16}/>Edit account</button></div><div className="account-detail-title"><div><small>{account.firm} · {account.platform}</small><h2>{account.name}</h2></div><div><strong className={pnl >= 0 ? "positive" : "negative"}>{money(pnl)}</strong><small>Net P&amp;L</small></div></div><div className="account-performance-metrics"><article><TrendingUp/><span>Win rate</span><strong>{accountTrades.length ? `${(wins.length / accountTrades.length * 100).toFixed(1)}%` : "0.0%"}</strong></article><article><Target/><span>Profit factor</span><strong>{grossLoss ? (grossProfit / grossLoss).toFixed(2) : grossProfit ? "∞" : "0.00"}</strong></article><article><TrendingDown/><span>Average trade</span><strong>{money(accountTrades.length ? pnl / accountTrades.length : 0)}</strong></article><article><Target/><span>Total trades</span><strong>{accountTrades.length}</strong></article></div><article className="panel account-chart"><div className="panel-head"><div><h2>Account equity curve</h2><p>Performance for this account only</p></div><span className={pnl >= 0 ? "positive" : "negative"}>{money(pnl)}</span></div><div className="chart">{chart.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="accountFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={pnl >= 0 ? "#31d896" : "#ff5c6c"} stopOpacity=".35"/><stop offset="1" stopColor={pnl >= 0 ? "#31d896" : "#ff5c6c"} stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#263148" vertical={false}/><XAxis dataKey="date" stroke="#778198" fontSize={12}/><YAxis stroke="#778198" fontSize={12}/><Tooltip contentStyle={{ background: "#111827", border: "1px solid #29334a", borderRadius: 10 }}/><Area type="monotone" dataKey="pnl" stroke={pnl >= 0 ? "#31d896" : "#ff5c6c"} strokeWidth={2.5} fill="url(#accountFill)"/></AreaChart></ResponsiveContainer> : <div className="account-no-trades">No trades synced for this account yet.</div>}</div></article><article className="panel table-panel"><div className="panel-head"><div><h2>Account trades</h2><p>Only trades from {account.name}</p></div></div><div className="table-wrap"><table><thead><tr><th>Symbol</th><th>Side</th><th>Entry / Exit</th><th>Closed</th><th>P&amp;L</th></tr></thead><tbody>{[...accountTrades].reverse().map(trade => <tr key={trade.id}><td><b>{trade.symbol}</b><small>{trade.lots} lots</small></td><td><span className={`side ${trade.side.toLowerCase()}`}>{trade.side}</span></td><td><b>{trade.entry}</b><small>{trade.exit}</small></td><td>{new Date(trade.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td className={trade.pnl >= 0 ? "positive" : "negative"}>{money(trade.pnl)}</td></tr>)}</tbody></table></div></article></section>;
}
