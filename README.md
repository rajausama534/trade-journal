# TradeFlow Journal

A usable, responsive trade-journal MVP built with Next.js, TypeScript, and a Supabase-ready data layer.

## Included

- Performance dashboard with equity curve, P&L, win rate, profit factor, and expectancy
- Account overview with prop-firm rules and connection status
- Trades table and manual closed-trade entry
- Basic setup and loss analytics
- Responsive dark interface
- Sample-data fallback when Supabase is not configured
- Row-level-secured Supabase schema
- Explicit placeholder interfaces for MT5 EA, Match-Trader, and cTrader connectors

Automatic platform syncing is **not implemented**. `lib/connectors.ts` defines the contract and fails clearly until a real, server-side connector is configured.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Leave `.env.local` unset to use the included sample data.

## Connect Supabase

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env.local` and add the project URL and anonymous key.
3. Add Supabase Auth before enabling multi-user production writes. The sample UI works without credentials; the production schema requires authenticated user IDs.

## Integration roadmap

- **MT5:** an Expert Advisor should post signed position events to a server-only webhook. Store every SL/TP modification and de-duplicate by account and platform ticket.
- **Match-Trader:** implement OAuth/token storage on the server, then map platform history to the shared `Trade` model.
- **cTrader:** use Open API authorization and a background sync worker.

Never put trading passwords or private platform tokens in `NEXT_PUBLIC_*` variables. Keep connector credentials encrypted and server-side. The journal should remain read-only.
