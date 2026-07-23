alter table public.trades
  add column if not exists source text not null default 'manual',
  add column if not exists external_trade_id text,
  add column if not exists commission numeric not null default 0,
  add column if not exists swap numeric not null default 0;

create unique index if not exists trades_user_source_external_unique
  on public.trades (user_id, source, external_trade_id)
  where external_trade_id is not null;

create index if not exists trades_user_source_idx
  on public.trades (user_id, source);
