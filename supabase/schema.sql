create extension if not exists "pgcrypto";

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  firm text not null,
  platform text not null check (platform in ('MT5','Match-Trader','cTrader','Manual')),
  balance numeric not null default 0,
  starting_balance numeric not null,
  daily_limit numeric not null default 0,
  max_limit numeric not null default 0,
  connection_status text not null default 'Manual',
  created_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('Buy','Sell')),
  lots numeric not null,
  entry numeric not null,
  exit numeric not null,
  stop_loss numeric,
  take_profit numeric,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  pnl numeric not null,
  setup text,
  notes text,
  source text not null default 'manual',
  external_id text,
  emotion text,
  lesson text,
  screenshot_url text,
  plan_followed boolean,
  created_at timestamptz not null default now(),
  unique(account_id, source, external_id)
);

create table if not exists public.mt5_connections (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32),'hex'),
  mt5_login bigint,
  broker_server text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  name text not null default 'Active plan',
  content text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  note_type text not null default 'daily',
  content text not null,
  mood text,
  created_at timestamptz not null default now()
);

create table if not exists public.rule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  rule_key text not null,
  severity text not null check (severity in ('info','warning','breach')),
  value numeric,
  limit_value numeric,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists trades_user_closed_idx on public.trades(user_id, closed_at desc);
create index if not exists rule_events_user_created_idx on public.rule_events(user_id, created_at desc);

alter table public.accounts enable row level security;
alter table public.trades enable row level security;
alter table public.mt5_connections enable row level security;
alter table public.trade_plans enable row level security;
alter table public.journal_notes enable row level security;
alter table public.rule_events enable row level security;

drop policy if exists "users own accounts" on public.accounts;
drop policy if exists "users own trades" on public.trades;
drop policy if exists "users own mt5 connections" on public.mt5_connections;
drop policy if exists "users own plans" on public.trade_plans;
drop policy if exists "users own notes" on public.journal_notes;
drop policy if exists "users own rule events" on public.rule_events;

create policy "users own accounts" on public.accounts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own trades" on public.trades for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own mt5 connections" on public.mt5_connections for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own plans" on public.trade_plans for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own notes" on public.journal_notes for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own rule events" on public.rule_events for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
