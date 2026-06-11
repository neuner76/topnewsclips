create table if not exists public.subscriber_preferences (
  subscriber_id uuid primary key references public.subscribers(id) on delete cascade,
  format_preference text not null default 'both' check (format_preference in ('digest', 'clips', 'both')),
  pace_preference text not null default 'full' check (pace_preference in ('full', 'skim')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriber_follows (
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  taxonomy_id uuid not null references public.taxonomy(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subscriber_id, taxonomy_id)
);

create index if not exists subscriber_follows_subscriber_idx
  on public.subscriber_follows (subscriber_id);

create index if not exists subscriber_follows_taxonomy_idx
  on public.subscriber_follows (taxonomy_id);

alter table public.subscriber_preferences enable row level security;
alter table public.subscriber_follows enable row level security;

drop policy if exists "subscriber_preferences_service_role_all" on public.subscriber_preferences;
create policy "subscriber_preferences_service_role_all"
  on public.subscriber_preferences
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "subscriber_follows_service_role_all" on public.subscriber_follows;
create policy "subscriber_follows_service_role_all"
  on public.subscriber_follows
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
