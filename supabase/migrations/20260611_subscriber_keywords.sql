create table if not exists public.subscriber_keywords (
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  phrase text not null,
  created_at timestamptz not null default now(),
  primary key (subscriber_id, phrase),
  check (char_length(phrase) between 2 and 80)
);

create index if not exists subscriber_keywords_subscriber_idx
  on public.subscriber_keywords (subscriber_id);

alter table public.subscriber_keywords enable row level security;

drop policy if exists "subscriber_keywords_service_role_all" on public.subscriber_keywords;
create policy "subscriber_keywords_service_role_all"
  on public.subscriber_keywords
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
