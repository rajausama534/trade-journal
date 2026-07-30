import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Trade = {
  ticket: string;
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
};

type Payload = {
  login: number;
  balance: number;
  equity: number;
  trade?: Trade;
};

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!url || !key) return NextResponse.json({ error: "Server connector is not configured" }, { status: 503 });
  if (!token) return NextResponse.json({ error: "Missing sync token" }, { status: 401 });

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Number.isFinite(body.login) || !Number.isFinite(body.balance) || !Number.isFinite(body.equity)) {
    return NextResponse.json({ error: "Invalid account payload" }, { status: 400 });
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: connection, error: connectionError } = await db
    .from("mt5_connections")
    .select("user_id,account_id,initialized_at,sync_from")
    .eq("token", token)
    .single();

  if (connectionError || !connection) return NextResponse.json({ error: "Invalid sync token" }, { status: 401 });

  const now = new Date().toISOString();
  let syncFrom = connection.sync_from as string | null;

  if (!connection.initialized_at) {
    syncFrom = now;
    const [{ error: accountError }, { error: initError }] = await Promise.all([
      db.from("accounts").update({
        starting_balance: body.balance,
        balance: body.balance,
        connection_status: "Connected",
        last_synced_at: now,
      }).eq("id", connection.account_id),
      db.from("mt5_connections").update({
        mt5_login: body.login,
        initial_balance: body.balance,
        initialized_at: now,
        sync_from: now,
        last_sync_at: now,
      }).eq("account_id", connection.account_id),
    ]);

    if (accountError || initError) {
      return NextResponse.json({ error: accountError?.message || initError?.message }, { status: 400 });
    }
  }

  if (body.trade) {
    const t = body.trade;
    if (
      !t.ticket || !t.symbol || !["Buy", "Sell"].includes(t.side) ||
      !Number.isFinite(t.lots) || !Number.isFinite(t.entry) || !Number.isFinite(t.exit) ||
      !Number.isFinite(t.pnl) || !Number.isFinite(t.commission) || !Number.isFinite(t.swap)
    ) return NextResponse.json({ error: "Invalid trade payload" }, { status: 400 });

    const closedAt = new Date(t.closedAt);
    const openedAt = new Date(t.openedAt);
    if (Number.isNaN(closedAt.getTime()) || Number.isNaN(openedAt.getTime())) {
      return NextResponse.json({ error: "Invalid trade timestamps" }, { status: 400 });
    }

    // The journal begins at first activation. Older Exness history is deliberately ignored.
    if (syncFrom && closedAt.getTime() < new Date(syncFrom).getTime()) {
      return NextResponse.json({ ok: true, skipped: "before_sync_start", ticket: t.ticket });
    }

    const netPnl = t.pnl + t.commission + t.swap;
    const { error } = await db.from("trades").upsert({
      user_id: connection.user_id,
      account_id: connection.account_id,
      external_id: t.ticket,
      source: "mt5",
      symbol: t.symbol,
      side: t.side,
      lots: t.lots,
      entry: t.entry,
      exit: t.exit,
      opened_at: openedAt.toISOString(),
      closed_at: closedAt.toISOString(),
      pnl: netPnl,
      gross_pnl: t.pnl,
      commission: t.commission,
      swap: t.swap,
      setup: "MT5 import",
      notes: "Automatically imported from Exness MT5",
    }, { onConflict: "account_id,source,external_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await Promise.all([
    db.from("accounts").update({
      balance: body.balance,
      connection_status: "Connected",
      last_synced_at: now,
    }).eq("id", connection.account_id),
    db.from("mt5_connections").update({
      mt5_login: body.login,
      last_sync_at: now,
    }).eq("account_id", connection.account_id),
  ]);

  return NextResponse.json({ ok: true, ticket: body.trade?.ticket ?? null, syncFrom });
}
