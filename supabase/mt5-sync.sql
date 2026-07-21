create table public.mt5_connections (id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,account_id uuid not null references public.accounts(id) on delete cascade,token uuid not null default gen_random_uuid() unique,mt5_login bigint,last_sync_at timestamptz,created_at timestamptz not null default now(),unique(user_id,account_id));
alter table public.mt5_connections enable row level security;
create policy "users own mt5 connections" on public.mt5_connections for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create index mt5_connections_token_idx on public.mt5_connections(token);
