create table if not exists public.ctrader_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_type text not null default 'bearer',
  scope text not null default 'accounts',
  expires_at timestamptz not null,
  connection_status text not null default 'authorized',
  ctrader_account_id bigint,
  trader_login bigint,
  broker_name text,
  is_live boolean,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ctrader_connections enable row level security;

revoke all on public.ctrader_connections from anon, authenticated;

comment on table public.ctrader_connections is
  'Server-only cTrader OAuth credentials. Access through service-role API routes only.';
