import { NextRequest, NextResponse } from "next/server";

function fallbackCoach(question: string, trades: any[], account: any) {
  const closed = trades.filter(t => Number.isFinite(Number(t?.pnl)));
  const pnl = closed.reduce((s,t)=>s+Number(t.pnl||0),0);
  const wins = closed.filter(t=>Number(t.pnl)>0);
  const losses = closed.filter(t=>Number(t.pnl)<0);
  const grossWin = wins.reduce((s,t)=>s+Number(t.pnl),0);
  const grossLoss = Math.abs(losses.reduce((s,t)=>s+Number(t.pnl),0));
  const winRate = closed.length ? wins.length / closed.length * 100 : 0;
  const pf = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const setups = new Map<string,{count:number,pnl:number,wins:number}>();
  for (const t of closed) { const k=String(t.setup||"Untagged"); const x=setups.get(k)||{count:0,pnl:0,wins:0}; x.count++; x.pnl+=Number(t.pnl||0); if(Number(t.pnl)>0)x.wins++; setups.set(k,x); }
  const ranked=Array.from(setups.entries()).sort((a,b)=>a[1].pnl-b[1].pnl);
  const worst=ranked[0], best=ranked.length ? ranked[ranked.length-1] : undefined;
  const largestLoss=losses.length?Math.min(...losses.map(t=>Number(t.pnl))):0;
  const riskLine = account?.balance && largestLoss ? `Your largest recorded loss is $${Math.abs(largestLoss).toFixed(2)}, about ${(Math.abs(largestLoss)/Number(account.balance)*100).toFixed(2)}% of the selected account balance.` : `Your largest recorded loss is $${Math.abs(largestLoss).toFixed(2)}.`;
  const parts = [
    `Based on ${closed.length} recorded trades, net P&L is ${pnl>=0?"+":""}$${pnl.toFixed(2)}, win rate is ${winRate.toFixed(1)}%, and profit factor is ${Number.isFinite(pf)?pf.toFixed(2):"∞"}.`,
    wins.length && losses.length ? `Average win is $${avgWin.toFixed(2)} versus average loss of $${avgLoss.toFixed(2)}.` : "There is not enough mixed win/loss data yet to compare average winner versus loser.",
    riskLine,
    worst ? `Weakest setup by realized P&L: ${worst[0]} (${worst[1].count} trades, $${worst[1].pnl.toFixed(2)}, ${(worst[1].wins/worst[1].count*100).toFixed(0)}% win rate).` : "No setup tags are available yet.",
    best && best[0]!==worst?.[0] ? `Strongest setup by realized P&L: ${best[0]} (${best[1].count} trades, ${best[1].pnl>=0?"+":""}$${best[1].pnl.toFixed(2)}).` : "",
    `For your question — “${question}” — the first thing I would change is to reduce exposure to the weakest recurring setup and require a complete setup tag plus review note on every trade. Judge the change after at least 20 comparable trades, not after one or two outcomes.`
  ].filter(Boolean);
  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question = String(body.question || "").trim();
  const trades = Array.isArray(body.trades) ? body.trades.slice(0, 200) : [];
  const account = body.account || null;
  if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ answer: fallbackCoach(question, trades, account), mode: "journal-analysis" });

  const prompt = `You are a strict trading-journal coach. Analyze only the supplied journal data. Do not invent trades or market facts. Focus on risk, discipline, recurring mistakes, setup quality and measurable behavior. Do not give guaranteed-profit claims.\n\nAccount:\n${JSON.stringify(account)}\n\nRecent trades:\n${JSON.stringify(trades)}\n\nTrader question:\n${question}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", input: prompt }),
  });

  const data = await response.json();
  if (!response.ok) return NextResponse.json({ answer: fallbackCoach(question, trades, account), mode: "journal-analysis", providerError: data?.error?.message || "AI request failed." });
  const text = data.output_text || data.output?.flatMap((x:any)=>x.content || []).map((x:any)=>x.text || "").join("\n").trim();
  return NextResponse.json({ answer: text || fallbackCoach(question, trades, account), mode: text ? "ai" : "journal-analysis" });
}
