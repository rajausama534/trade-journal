alter table public.accounts
  add column if not exists last_synced_at timestamptz;

alter table public.trades
  add column if not exists gross_pnl numeric not null default 0,
  add column if not exists commission numeric not null default 0,
  add column if not exists swap numeric not null default 0;

create table if not exists public.mt5_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  token text not null unique,
  mt5_login bigint,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists trades_account_source_external_idx
  on public.trades(account_id, source, external_id);
create index if not exists mt5_connections_token_idx
  on public.mt5_connections(token);

alter table public.mt5_connections enable row level security;

drop policy if exists "users own mt5 connections" on public.mt5_connections;
create policy "users own mt5 connections"
  on public.mt5_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
