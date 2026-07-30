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

const validNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/, "").trim();

  if (!url || !key) {
    return NextResponse.json({ error: "Server connector is not configured" }, { status: 503 });
  }
  if (!token) {
    return NextResponse.json({ error: "Missing sync token" }, { status: 401 });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Number.isInteger(body.login) || !validNumber(body.balance) || !validNumber(body.equity)) {
    return NextResponse.json({ error: "Invalid account payload" }, { status: 400 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: connection, error: connectionError } = await db
    .from("mt5_connections")
    .select("user_id,account_id,mt5_login,last_sync_at,created_at")
    .eq("token", token)
    .single();

  if (connectionError || !connection) {
    return NextResponse.json({ error: "Invalid sync token" }, { status: 401 });
  }

  if (connection.mt5_login && Number(connection.mt5_login) !== body.login) {
    return NextResponse.json({ error: "Sync token belongs to a different MT5 login" }, { status: 409 });
  }

  const { data: account, error: accountError } = await db
    .from("accounts")
    .select("id,created_at,starting_balance")
    .eq("id", connection.account_id)
    .eq("user_id", connection.user_id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Connected account no longer exists" }, { status: 404 });
  }

  const firstSync = !connection.last_sync_at;
  const trackingStartedAt = new Date(connection.created_at || account.created_at).getTime();

  if (body.trade) {
    const t = body.trade;
    const closedAt = new Date(t.closedAt).getTime();
    const openedAt = new Date(t.openedAt).getTime();

    if (
      !t.ticket || !t.symbol || !["Buy", "Sell"].includes(t.side) ||
      !validNumber(t.lots) || !validNumber(t.entry) || !validNumber(t.exit) ||
      !validNumber(t.pnl) || !validNumber(t.commission) || !validNumber(t.swap) ||
      !Number.isFinite(closedAt) || !Number.isFinite(openedAt)
    ) {
      return NextResponse.json({ error: "Invalid trade payload" }, { status: 400 });
    }

    // Defense in depth: even a misconfigured/older EA cannot import trades
    // closed before this TradeFlow connection was created.
    if (closedAt < trackingStartedAt) {
      return NextResponse.json({ ok: true, ignored: "historical_trade", ticket: t.ticket });
    }

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
      opened_at: t.openedAt,
      closed_at: t.closedAt,
      pnl: t.pnl + t.commission + t.swap,
      setup: "MT5 import",
      notes: "Automatically imported from MT5",
    }, { onConflict: "account_id,source,external_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const accountUpdate: Record<string, number> = { balance: body.balance };
  if (firstSync) accountUpdate.starting_balance = body.balance;

  const [balanceResult, syncResult] = await Promise.all([
    db.from("accounts").update(accountUpdate).eq("id", connection.account_id).eq("user_id", connection.user_id),
    db.from("mt5_connections").update({
      mt5_login: body.login,
      last_sync_at: new Date().toISOString(),
    }).eq("account_id", connection.account_id).eq("user_id", connection.user_id),
  ]);

  if (balanceResult.error || syncResult.error) {
    return NextResponse.json({ error: balanceResult.error?.message || syncResult.error?.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    firstSync,
    startingBalanceCaptured: firstSync ? body.balance : undefined,
    balance: body.balance,
    ticket: body.trade?.ticket ?? null,
  });
}
