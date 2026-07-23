"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Link2, Loader2, RefreshCw, Unplug, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Account = { id: string; name: string; firm: string };
type Connection = { connection_status: string; scope: string; expires_at: string; last_sync_at: string | null };
type ParsedTrade = {
  externalId: string;
  symbol: string;
  side: "Buy" | "Sell";
  lots: number;
  entry: number;
  exit: number;
  openedAt: string;
  closedAt: string;
  pnl: number;
  commission: number;
  swap: number;
  notes: string;
};

const aliases: Record<string, string[]> = {
  id: ["deal id", "position id", "order id", "id"],
  symbol: ["symbol", "instrument"],
  side: ["direction", "side", "type", "opening direction"],
  lots: ["quantity", "volume", "lots", "closing quantity"],
  entry: ["entry price", "opening price", "open price"],
  exit: ["closing price", "exit price", "close price"],
  openedAt: ["opening time", "open time", "entry time"],
  closedAt: ["closing time", "close time", "exit time"],
  pnl: ["net", "net profit", "net $", "profit", "p&l"],
  commission: ["commission"],
  swap: ["swap"],
};

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

function numeric(value: string | undefined) {
  const cleaned = String(value || "").replace(/[$,\s]/g, "").replace(/[^0-9+-.]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function dateValue(value: string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value.replace(/\.(\d{3})\d+$/, ".$1"));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseStatement(text: string): ParsedTrade[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("The statement does not contain trade rows.");
  const headers = splitCsvLine(lines[0]).map(normalise);
  const index = (key: keyof typeof aliases) => headers.findIndex((header) => aliases[key].includes(header));
  const indexes = Object.fromEntries(Object.keys(aliases).map((key) => [key, index(key as keyof typeof aliases)])) as Record<string, number>;
  for (const required of ["symbol", "side", "entry", "exit", "closedAt", "pnl"]) {
    if (indexes[required] < 0) throw new Error(`Could not find the ${required} column in this cTrader CSV.`);
  }
  return lines.slice(1).map((line, row) => {
    const cells = splitCsvLine(line);
    const get = (key: string) => indexes[key] >= 0 ? cells[indexes[key]] : "";
    const sideText = normalise(get("side"));
    return {
      externalId: get("id") || `ctrader-${dateValue(get("closedAt"))}-${row}`,
      symbol: get("symbol").replace("/", "").trim().toUpperCase(),
      side: sideText.includes("buy") ? "Buy" : "Sell",
      lots: Math.abs(numeric(get("lots"))) || 0.01,
      entry: numeric(get("entry")),
      exit: numeric(get("exit")),
      openedAt: dateValue(get("openedAt") || get("closedAt")),
      closedAt: dateValue(get("closedAt")),
      pnl: numeric(get("pnl")),
      commission: numeric(get("commission")),
      swap: numeric(get("swap")),
      notes: "Imported from cTrader statement",
    };
  }).filter((trade) => trade.symbol && trade.entry && trade.exit);
}

async function authHeaders() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in first.");
  return { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };
}

export default function ConnectionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [parsed, setParsed] = useState<ParsedTrade[]>([]);

  const totalPnl = useMemo(() => parsed.reduce((sum, trade) => sum + trade.pnl, 0), [parsed]);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("accounts").select("id,name,firm").order("created_at");
      setAccounts(data || []);
      if (data?.[0]) setAccountId(data[0].id);
      try {
        const response = await fetch("/api/ctrader/status", { headers: await authHeaders() });
        const status = await response.json();
        if (status.connected) setConnection(status.connection);
      } catch { /* connection status is optional */ }
    })();
  }, []);

  async function connect() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/ctrader/connect", { method: "POST", headers: await authHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start cTrader connection.");
      window.location.assign(result.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed."); setBusy(false); }
  }

  async function disconnect() {
    if (!confirm("Disconnect cTrader from this journal?")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ctrader/status", { method: "DELETE", headers: await authHeaders() });
      if (!response.ok) throw new Error("Could not disconnect cTrader.");
      setConnection(null); setMessage("cTrader disconnected.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Disconnect failed."); }
    finally { setBusy(false); }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try { const trades = parseStatement(await file.text()); setParsed(trades); setMessage(`${trades.length} trades ready to import.`); }
    catch (error) { setParsed([]); setMessage(error instanceof Error ? error.message : "Could not parse statement."); }
  }

  async function importTrades() {
    if (!accountId || !parsed.length) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/ctrader/import", {
        method: "POST", headers: await authHeaders(), body: JSON.stringify({ accountId, trades: parsed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Import failed.");
      setMessage(`Imported ${result.imported} trades. ${result.skipped} duplicates skipped.`);
      setParsed([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); }
    finally { setBusy(false); }
  }

  return <main style={{maxWidth:960,margin:"0 auto",padding:"40px 20px"}}>
    <a href="/" className="secondary" style={{display:"inline-flex",gap:8,alignItems:"center",marginBottom:24}}><ArrowLeft size={16}/>Back to journal</a>
    <header style={{marginBottom:28}}><h1>Trading connections</h1><p>Connect cTrader with read-only access or import a free cTrader statement.</p></header>

    <section className="panel" style={{marginBottom:20,padding:24}}>
      <div className="panel-head"><div><h2>cTrader Open API</h2><p>Official read-only OAuth connection. Trading actions remain disabled.</p></div>{connection&&<span className="status"><CheckCircle2 size={14}/> Connected</span>}</div>
      {connection ? <><p>Scope: <b>{connection.scope}</b> · Status: <b>{connection.connection_status}</b></p><div style={{display:"flex",gap:10,marginTop:18}}><button className="secondary" disabled={busy}><RefreshCw size={16}/>Sync setup pending</button><button className="signout" onClick={disconnect} disabled={busy}><Unplug size={16}/>Disconnect</button></div></> : <button className="primary" onClick={connect} disabled={busy}>{busy?<Loader2 size={17}/>:<Link2 size={17}/>}Connect cTrader</button>}
    </section>

    <section className="panel" style={{padding:24}}>
      <div className="panel-head"><div><h2>Free statement import</h2><p>Export cTrader history as CSV, then upload it here. Duplicate deal IDs are ignored.</p></div><Upload/></div>
      <label>Journal account<select value={accountId} onChange={(event)=>setAccountId(event.target.value)}><option value="">Choose account</option>{accounts.map((account)=><option key={account.id} value={account.id}>{account.name} · {account.firm}</option>)}</select></label>
      <label style={{display:"block",marginTop:16}}>cTrader CSV<input type="file" accept=".csv,text/csv" onChange={chooseFile}/></label>
      {parsed.length>0&&<div className="filter-summary" style={{marginTop:16}}><span>{parsed.length} trades</span><span>{totalPnl.toLocaleString("en-US",{style:"currency",currency:"USD"})}</span><span>{parsed[0]?.symbol} and more</span></div>}
      <button className="primary" style={{marginTop:18}} onClick={importTrades} disabled={busy||!accountId||!parsed.length}>{busy?<Loader2 size={17}/>:<Upload size={17}/>}Import trades</button>
    </section>
    {message&&<p style={{marginTop:18}}>{message}</p>}
  </main>;
}
