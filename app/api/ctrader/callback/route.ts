import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCtraderRedirectUri, verifyOAuthState } from "@/lib/ctrader-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");

  if (error || !code || !state) {
    return NextResponse.redirect(`${siteUrl}/?ctrader=error`);
  }

  try {
    const payload = verifyOAuthState(state);
    const clientId = process.env.CTRADER_CLIENT_ID;
    const clientSecret = process.env.CTRADER_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("cTrader credentials are not configured.");

    const tokenUrl = new URL("https://openapi.ctrader.com/apps/token");
    tokenUrl.searchParams.set("grant_type", "authorization_code");
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("redirect_uri", getCtraderRedirectUri());
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);

    const response = await fetch(tokenUrl, {
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
    });
    const token = await response.json();
    if (!response.ok || token.errorCode || !token.accessToken || !token.refreshToken) {
      throw new Error(token.description || token.errorCode || "cTrader token exchange failed.");
    }

    const expiresAt = new Date(Date.now() + Number(token.expiresIn || 2628000) * 1000).toISOString();
    const admin = getSupabaseAdmin();
    const { error: saveError } = await admin.from("ctrader_connections").upsert({
      user_id: payload.userId,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      token_type: token.tokenType || "bearer",
      scope: "accounts",
      expires_at: expiresAt,
      connection_status: "authorized",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) throw saveError;

    return NextResponse.redirect(`${siteUrl}/?ctrader=connected`);
  } catch (callbackError) {
    console.error("cTrader OAuth callback failed", callbackError);
    return NextResponse.redirect(`${siteUrl}/?ctrader=error`);
  }
}
