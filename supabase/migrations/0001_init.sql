-- SpineCoach AI — cloud sync schema (docs/09: Supabase future layer).
--
-- Mirrors the on-device IndexedDB entities that are worth syncing across
-- devices: profile, assessments, daily check-ins, workout logs, pain logs.
-- Progress photos (blobs) are intentionally excluded from v1 sync — they
-- stay on-device until a Supabase Storage integration is added.
--
-- Every table is owned by an authenticated user and protected by row-level
-- security so a user can only ever read or write their own rows. This keeps
-- the "User owns all records" rule from docs/08 true in the cloud too.

create extension if not exists "pgcrypto";

-- Profile row per auth user (1:1 with auth.users).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  age int not null check (age between 13 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  -- Client-generated UUID (matches the IndexedDB record id) so sync is a
  -- plain upsert with no id remapping.
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pain_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists assessments_user_idx on public.assessments (user_id);
create index if not exists check_ins_user_idx on public.check_ins (user_id);
create index if not exists workout_logs_user_idx on public.workout_logs (user_id);
create index if not exists pain_logs_user_idx on public.pain_logs (user_id);

-- Row-level security: each user sees only their own data.
alter table public.profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.check_ins enable row level security;
alter table public.workout_logs enable row level security;
alter table public.pain_logs enable row level security;

do $$
declare
  t text;
begin
  -- profiles keys on id = auth.uid(); the log tables key on user_id.
  execute $p$
    create policy "own profile" on public.profiles
      for all using (auth.uid() = id) with check (auth.uid() = id);
  $p$;

  foreach t in array array['assessments', 'check_ins', 'workout_logs', 'pain_logs']
  loop
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;
