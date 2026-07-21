"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Account, Trade } from "@/lib/types";

type RuleConfig = {
  dailyLimit: number;
  maxLimit: number;
  maxPerTrade: number;
  warningAt: number;
  aBookBlocked: boolean;
  bBookBlocked: boolean;
};

type ConfigMap = Record<string, RuleConfig>;
const storageKey = "tradeflow-rule-config-v1";
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function defaults(account: Account): RuleConfig {
  return {
    dailyLimit: account.dailyLimit,
    maxLimit: account.maxLimit,
    maxPerTrade: 0,
    warningAt: 80,
    aBookBlocked: false,
    bBookBlocked: false,
  };
}

function useConfigs(accounts: Account[]) {
  const [configs, setConfigs] = useState<ConfigMap>({});

  useEffect(() => {
    const load = () => {
      let saved: ConfigMap = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch {}
      setConfigs(Object.fromEntries(accounts.map((a) => [a.id, { ...defaults(a), ...saved[a.id] }])));
    };
    load();
    window.addEventListener("tradeflow-rules-updated", load);
    return () => window.removeEventListener("tradeflow-rules-updated", load);
  }, [accounts]);

  const save = (next: ConfigMap) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setConfigs(next);
    window.dispatchEvent(new Event("tradeflow-rules-updated"));
  };
  return { configs, setConfigs, save };
}

function health(account: Account, trades: Trade[], config: RuleConfig) {
  const accountTrades = trades.filter((t) => t.accountId === account.id);
  const latest = accountTrades.length
    ? new Date(Math.max(...accountTrades.map((t) => new Date(t.closedAt).getTime())))
    : new Date();
  const sameDay = (date: Date) => date.toDateString() === latest.toDateString();
  const dailyLoss = Math.max(0, -accountTrades.filter((t) => sameDay(new Date(t.closedAt))).reduce((sum, t) => sum + t.pnl, 0));
  const maxLoss = Math.max(0, account.startingBalance - account.balance);
  const largestTradeLoss = Math.max(0, ...accountTrades.map((t) => Math.max(0, -t.pnl)));
  const rows = [
    { label: "Daily drawdown", used: dailyLoss, limit: config.dailyLimit },
    { label: "Maximum drawdown", used: maxLoss, limit: config.maxLimit },
    { label: "Maximum per trade", used: largestTradeLoss, limit: config.maxPerTrade },
  ].map((row) => ({ ...row, percent: row.limit > 0 ? (row.used / row.limit) * 100 : 0 }));
  const highest = Math.max(0, ...rows.map((r) => r.percent));
  return { rows, highest, breached: highest >= 100, warning: highest >= config.warningAt };
}

export function RuleCenter({ accounts, trades, mode }: { accounts: Account[]; trades: Trade[]; mode: "summary" | "settings" }) {
  const { configs, setConfigs, save } = useConfigs(accounts);
  const statuses = useMemo(() => accounts.map((account) => {
    const config = configs[account.id] || defaults(account);
    return { account, config, result: health(account, trades, config) };
  }), [accounts, trades, configs]);

  if (!accounts.length) return null;

  if (mode === "summary") {
    const danger = statuses.some((s) => s.result.breached);
    const warning = statuses.some((s) => s.result.warning);
    return <div className={`rule-center ${danger ? "breach" : warning ? "warning" : "safe"}`}>
      <div className="rule-overview">
        {danger || warning ? <AlertTriangle /> : <ShieldCheck />}
        <div><b>{danger ? "Rule limit reached" : warning ? "You are near a rule limit" : "All account rules are within limits"}</b><small>{danger ? "Stop trading and check the breached rule." : warning ? "Reduce risk before your next trade." : "Current closed-trade losses are below your warning levels."}</small></div>
      </div>
      {statuses.map(({ account, result }) => <div className="rule-account" key={account.id}>
        <b>{account.name}</b>
        {result.rows.map((row) => <div className="rule-meter" key={row.label}>
          <span>{row.label}</span><strong>{row.limit ? `${money(row.used)} / ${money(row.limit)}` : "Not set"}</strong>
          <i><em style={{ width: `${Math.min(100, row.percent)}%` }} /></i>
        </div>)}
      </div>)}
    </div>;
  }

  const update = (id: string, field: keyof RuleConfig, value: number | boolean) =>
    setConfigs((current) => ({ ...current, [id]: { ...(current[id] || defaults(accounts.find((a) => a.id === id)!)), [field]: value } }));

  return <article className="panel settings-card rules-editor">
    <div className="settings-title"><div className="settings-icon"><ShieldCheck /></div><div><h2>Prop-firm safety rules</h2><p>Set the exact restrictions shown in each firm dashboard.</p></div></div>
    <p className="settings-note">A-book and B-book restrictions differ by firm and account. Keep them editable instead of relying on guessed rules.</p>
    {statuses.map(({ account, config }) => <section className="rule-form" key={account.id}>
      <h3>{account.name}<small>{account.firm}</small></h3>
      <div className="settings-pair">
        <label>Daily drawdown ($)<input type="number" min="0" value={config.dailyLimit} onChange={(e) => update(account.id, "dailyLimit", Number(e.target.value))} /></label>
        <label>Maximum drawdown ($)<input type="number" min="0" value={config.maxLimit} onChange={(e) => update(account.id, "maxLimit", Number(e.target.value))} /></label>
        <label>Maximum loss per trade ($)<input type="number" min="0" value={config.maxPerTrade} onChange={(e) => update(account.id, "maxPerTrade", Number(e.target.value))} /></label>
        <label>Warn me at (%)<input type="number" min="1" max="100" value={config.warningAt} onChange={(e) => update(account.id, "warningAt", Number(e.target.value))} /></label>
      </div>
      <div className="book-rules">
        <label><input type="checkbox" checked={config.aBookBlocked} onChange={(e) => update(account.id, "aBookBlocked", e.target.checked)} /> A-book blocked</label>
        <label><input type="checkbox" checked={config.bBookBlocked} onChange={(e) => update(account.id, "bBookBlocked", e.target.checked)} /> B-book blocked</label>
      </div>
    </section>)}
    <button className="primary save-rules" onClick={() => save(configs)}>Save safety rules</button>
  </article>;
}
