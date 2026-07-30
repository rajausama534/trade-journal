import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MT5TradePayload = {
  account_id: string;
  ticket: string | number;
  symbol: string;
  side: "Buy" | "Sell";
  lots: number;
  entry: number;
  exit: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  opened_at: string;
  closed_at: string;
  profit: number;
  commission?: number;
  swap?: number;
  comment?: string;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.MT5_WEBHOOK_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) return unauthorized();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server integration is not configured" }, { status: 500 });
  }

  let body: MT5TradePayload | MT5TradePayload[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0 || items.length > 200) {
    return NextResponse.json({ error: "Send between 1 and 200 trades" }, { status: 400 });
  }

  const accountIds = [...new Set(items.map((item) => item.account_id))];
  if (accountIds.length !== 1) {
    return NextResponse.json({ error: "Each request must contain one account_id" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id,user_id,platform")
    .eq("id", accountIds[0])
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (account.platform !== "MT5") {
    return NextResponse.json({ error: "Account is not configured as MT5" }, { status: 409 });
  }

  const rows = items.map((item) => {
    if (!item.ticket || !item.symbol || !item.opened_at || !item.closed_at) {
      throw new Error("Missing required trade fields");
    }
    const netPnl = Number(item.profit) + Number(item.commission ?? 0) + Number(item.swap ?? 0);
    return {
      user_id: account.user_id,
      account_id: account.id,
      symbol: item.symbol,
      side: item.side,
      lots: Number(item.lots),
      entry: Number(item.entry),
      exit: Number(item.exit),
      stop_loss: item.stop_loss ?? null,
      take_profit: item.take_profit ?? null,
      opened_at: new Date(item.opened_at).toISOString(),
      closed_at: new Date(item.closed_at).toISOString(),
      pnl: netPnl,
      notes: item.comment ?? null,
      source: "mt5",
      external_id: String(item.ticket),
      commission: Number(item.commission ?? 0),
      swap: Number(item.swap ?? 0),
      gross_pnl: Number(item.profit),
    };
  });

  try {
    const { error } = await supabase
      .from("trades")
      .upsert(rows, { onConflict: "account_id,source,external_id" });
    if (error) throw error;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save trades";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await supabase
    .from("accounts")
    .update({ connection_status: "Connected", last_synced_at: new Date().toISOString() })
    .eq("id", account.id);

  return NextResponse.json({ ok: true, synced: rows.length });
}
