import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/supabase-admin";
import { createOAuthState, getCtraderRedirectUri } from "@/lib/ctrader-oauth";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const clientId = process.env.CTRADER_CLIENT_ID;
    if (!clientId) throw new Error("CTRADER_CLIENT_ID is not configured.");

    const url = new URL("https://id.ctrader.com/my/settings/openapi/grantingaccess/");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", getCtraderRedirectUri());
    url.searchParams.set("scope", "accounts");
    url.searchParams.set("product", "web");
    url.searchParams.set("state", createOAuthState(user.id));

    return NextResponse.json({ url: url.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start cTrader connection.";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
