import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireApiUser } from "@/lib/supabase-admin";

type ImportTrade = {
  externalId: string;
  symbol: string;
  side: "Buy" | "Sell";
  lots: number;
  entry: number;
  exit: number;
  openedAt: string;
  closedAt: string;
  pnl: number;
  commission?: number;
  swap?: number;
  notes?: string;
};

function validTrade(value: ImportTrade) {
  return value && value.externalId && value.symbol && ["Buy", "Sell"].includes(value.side)
    && Number.isFinite(value.lots) && value.lots > 0
    && Number.isFinite(value.entry) && Number.isFinite(value.exit)
    && Number.isFinite(value.pnl) && !Number.isNaN(Date.parse(value.closedAt));
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await request.json() as { accountId?: string; trades?: ImportTrade[] };
    if (!body.accountId || !Array.isArray(body.trades) || !body.trades.length) {
      return NextResponse.json({ error: "Account and trades are required." }, { status: 400 });
    }
    if (body.trades.length > 5000) {
      return NextResponse.json({ error: "Import a maximum of 5,000 trades at a time." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .select("id")
      .eq("id", body.accountId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const clean = body.trades.filter(validTrade);
    const ids = clean.map((trade) => trade.externalId);
    const { data: existing, error: existingError } = await admin
      .from("trades")
      .select("external_trade_id")
      .eq("user_id", user.id)
      .eq("source", "ctrader")
      .in("external_trade_id", ids);
    if (existingError) throw existingError;
    const known = new Set((existing || []).map((trade) => trade.external_trade_id));
    const rows = clean.filter((trade) => !known.has(trade.externalId)).map((trade) => ({
      user_id: user.id,
      account_id: body.accountId,
      external_trade_id: trade.externalId,
      source: "ctrader",
      symbol: trade.symbol,
      side: trade.side,
      lots: trade.lots,
      entry: trade.entry,
      exit: trade.exit,
      stop_loss: 0,
      take_profit: 0,
      opened_at: trade.openedAt,
      closed_at: trade.closedAt,
      pnl: trade.pnl,
      commission: Number(trade.commission || 0),
      swap: Number(trade.swap || 0),
      setup: "cTrader import",
      notes: trade.notes || "Imported from cTrader statement",
    }));

    if (rows.length) {
      const { error } = await admin.from("trades").insert(rows);
      if (error) throw error;
    }

    return NextResponse.json({ imported: rows.length, skipped: clean.length - rows.length, invalid: body.trades.length - clean.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import cTrader trades.";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
