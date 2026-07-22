import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireApiUser } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("ctrader_connections")
      .select("connection_status,scope,expires_at,last_sync_at,created_at,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ connected: Boolean(data), connection: data || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read cTrader status.";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser(request);
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("ctrader_connections").delete().eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not disconnect cTrader.";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
