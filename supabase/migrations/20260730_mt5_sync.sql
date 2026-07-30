alter table public.accounts
  add column if not exists last_synced_at timestamptz;

alter table public.trades
  add column if not exists gross_pnl numeric not null default 0,
  add column if not exists commission numeric not null default 0,
  add column if not exists swap numeric not null default 0;

create index if not exists trades_account_source_external_idx
  on public.trades(account_id, source, external_id);
