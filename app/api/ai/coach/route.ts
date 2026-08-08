import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  const body = await req.json();
  const question = String(body.question || "").trim();
  const trades = Array.isArray(body.trades) ? body.trades.slice(0, 200) : [];
  const account = body.account || null;
  if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const prompt = `You are a strict trading-journal coach. Analyze only the supplied journal data. Do not invent trades or market facts. Focus on risk, discipline, recurring mistakes, setup quality and measurable behavior. Do not give guaranteed-profit claims.\n\nAccount:\n${JSON.stringify(account)}\n\nRecent trades:\n${JSON.stringify(trades)}\n\nTrader question:\n${question}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", input: prompt }),
  });

  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || "AI request failed." }, { status: response.status });
  const text = data.output_text || data.output?.flatMap((x:any)=>x.content || []).map((x:any)=>x.text || "").join("\n").trim();
  return NextResponse.json({ answer: text || "No response text returned." });
}
