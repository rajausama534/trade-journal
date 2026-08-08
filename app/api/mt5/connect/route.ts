import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!url || !anon || !service) return NextResponse.json({ error: "Supabase server configuration is incomplete." }, { status: 503 });
  if (!jwt) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await auth.auth.getUser(jwt);
  const user = userData.user;
  if (userError || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { accountId } = await req.json();
  if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 });

  const db = createClient(url, service, { auth: { persistSession: false } });
  const { data: account } = await db.from("accounts").select("id,user_id").eq("id", accountId).eq("user_id", user.id).single();
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const { data: existing } = await db.from("mt5_connections").select("token,mt5_login,last_sync_at").eq("account_id", account.id).maybeSingle();
  if (existing?.token) return NextResponse.json({ token: existing.token, login: existing.mt5_login, lastSyncAt: existing.last_sync_at, endpoint: `${req.nextUrl.origin}/api/mt5/sync` });

  const { data, error } = await db.from("mt5_connections").insert({ user_id: user.id, account_id: account.id }).select("token,mt5_login,last_sync_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ token: data.token, login: data.mt5_login, lastSyncAt: data.last_sync_at, endpoint: `${req.nextUrl.origin}/api/mt5/sync` });
}
