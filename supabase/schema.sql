create extension if not exists "pgcrypto";
create table public.accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, firm text not null, platform text not null check (platform in ('MT5','Match-Trader','cTrader','Manual')),
  balance numeric not null default 0, starting_balance numeric not null, daily_limit numeric not null default 0,
  max_limit numeric not null default 0, connection_status text not null default 'Manual', created_at timestamptz not null default now()
);
create table public.trades (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade, symbol text not null,
  side text not null check (side in ('Buy','Sell')), lots numeric not null, entry numeric not null, exit numeric not null,
  stop_loss numeric, take_profit numeric, opened_at timestamptz not null, closed_at timestamptz not null,
  pnl numeric not null, setup text, notes text, source text not null default 'manual', external_id text,
  created_at timestamptz not null default now(), unique(account_id, source, external_id)
);
create index trades_user_closed_idx on public.trades(user_id, closed_at desc);
alter table public.accounts enable row level security; alter table public.trades enable row level security;
create policy "users own accounts" on public.accounts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own trades" on public.trades for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
