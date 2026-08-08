create extension if not exists "pgcrypto";

alter table public.trades add column if not exists emotion text;
alter table public.trades add column if not exists lesson text;
alter table public.trades add column if not exists screenshot_url text;
alter table public.trades add column if not exists plan_followed boolean;

create table if not exists public.mt5_connections (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32),'hex'),
  mt5_login bigint,
  broker_server text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mt5_connections add column if not exists token text;
alter table public.mt5_connections add column if not exists broker_server text;
alter table public.mt5_connections add column if not exists last_sync_at timestamptz;
alter table public.mt5_connections add column if not exists created_at timestamptz not null default now();
update public.mt5_connections set token=encode(gen_random_bytes(32),'hex') where token is null;
alter table public.mt5_connections alter column token set not null;
create unique index if not exists mt5_connections_token_idx on public.mt5_connections(token);

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

create index if not exists rule_events_user_created_idx on public.rule_events(user_id, created_at desc);

alter table public.mt5_connections enable row level security;
alter table public.trade_plans enable row level security;
alter table public.journal_notes enable row level security;
alter table public.rule_events enable row level security;

drop policy if exists "users own mt5 connections" on public.mt5_connections;
drop policy if exists "users own plans" on public.trade_plans;
drop policy if exists "users own notes" on public.journal_notes;
drop policy if exists "users own rule events" on public.rule_events;
create policy "users own mt5 connections" on public.mt5_connections for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own plans" on public.trade_plans for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own notes" on public.journal_notes for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own rule events" on public.rule_events for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
