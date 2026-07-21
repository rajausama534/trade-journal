import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Trade = {
  ticket: string; symbol: string; side: "Buy" | "Sell"; lots: number;
  entry: number; exit: number; openedAt: string; closedAt: string;
  pnl: number; commission: number; swap: number;
};
type Payload = { login: number; balance: number; equity: number; trade?: Trade };

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/, "");
  if (!url || !key) return NextResponse.json({ error: "Server connector is not configured" }, { status: 503 });
  if (!token) return NextResponse.json({ error: "Missing sync token" }, { status: 401 });

  let body: Payload;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: connection } = await db.from("mt5_connections").select("user_id,account_id").eq("token", token).single();
  if (!connection) return NextResponse.json({ error: "Invalid sync token" }, { status: 401 });

  if (body.trade) {
    const t = body.trade;
    const { error } = await db.from("trades").upsert({
      user_id: connection.user_id, account_id: connection.account_id,
      external_id: t.ticket, source: "mt5", symbol: t.symbol, side: t.side,
      lots: t.lots, entry: t.entry, exit: t.exit, opened_at: t.openedAt,
      closed_at: t.closedAt, pnl: t.pnl + t.commission + t.swap,
      setup: "MT5 import", notes: "Automatically imported from MT5",
    }, { onConflict: "account_id,source,external_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await Promise.all([
    db.from("accounts").update({ balance: body.balance }).eq("id", connection.account_id),
    db.from("mt5_connections").update({ mt5_login: body.login, last_sync_at: new Date().toISOString() }).eq("account_id", connection.account_id),
  ]);
  return NextResponse.json({ ok: true, ticket: body.trade?.ticket ?? null });
}
