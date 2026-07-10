-- SpineCoach AI cross-device sync via a shared high-entropy sync code
-- (docs/09 future layer).
--
-- No auth: all synced entities live in one `records` table, isolated by
-- `sync_id` (the sync code, which acts as a bearer token). The anon key is
-- public, so the sync code is what keeps a user's data private. Suitable for a
-- personal single-user app; not a substitute for real auth on shared data.
create table if not exists public.records (
  id uuid primary key,
  sync_id text not null,
  kind text not null check (kind in ('assessment','check_in','workout_log','pain_log')),
  created_at timestamptz not null default now(),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists records_sync_kind_idx on public.records (sync_id, kind);

alter table public.records enable row level security;

grant select, insert, update, delete on public.records to anon;

drop policy if exists "anon full access" on public.records;
create policy "anon full access" on public.records
  for all to anon using (true) with check (true);
