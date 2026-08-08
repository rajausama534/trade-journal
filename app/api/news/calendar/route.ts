import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const key = process.env.TRADING_ECONOMICS_API_KEY || "guest:guest";
  const importance = req.nextUrl.searchParams.get("importance") || "2";
  const url = `https://api.tradingeconomics.com/calendar?c=${encodeURIComponent(key)}&importance=${encodeURIComponent(importance)}`;
  const response = await fetch(url, { next: { revalidate: 300 } });
  let data: any = null;
  try { data = await response.json(); } catch {}

  if (!response.ok || !Array.isArray(data)) {
    return NextResponse.json({
      events: [],
      error: "Economic calendar provider is temporarily unavailable.",
      provider: process.env.TRADING_ECONOMICS_API_KEY ? "Trading Economics" : "Trading Economics guest access"
    }, { status: 200 });
  }

  const events = data.slice(0, 250).map((x:any) => ({
    id: String(x.CalendarId || x.CalendarID || `${x.Date}-${x.Event}`),
    date: x.Date,
    country: x.Country,
    event: x.Event || x.Category,
    category: x.Category,
    actual: x.Actual ?? null,
    forecast: x.Forecast ?? x.TEForecast ?? null,
    previous: x.Previous ?? null,
    importance: Number(x.Importance || 0),
    currency: x.Currency || "",
    source: x.Source || "Trading Economics",
  }));
  return NextResponse.json({
    events,
    provider: "Trading Economics",
    access: process.env.TRADING_ECONOMICS_API_KEY ? "authenticated" : "guest"
  });
}
