create table if not exists public.tracked_issues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text null,
  issue_area text null,
  regions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issue_story_links (
  issue_id uuid not null references public.tracked_issues(id) on delete cascade,
  story_id text not null,
  story_slug text not null,
  relationship text not null default 'core_update' check (relationship in ('core_update', 'background', 'context', 'response', 'unresolved_question')),
  created_at timestamptz not null default now(),
  primary key (issue_id, story_slug)
);

create index if not exists tracked_issues_slug_idx on public.tracked_issues(slug);
create index if not exists issue_story_links_story_slug_idx on public.issue_story_links(story_slug);

alter table public.tracked_issues enable row level security;
alter table public.issue_story_links enable row level security;

drop policy if exists "Tracked issues are public" on public.tracked_issues;
create policy "Tracked issues are public"
  on public.tracked_issues for select
  using (true);

drop policy if exists "Issue story links are public" on public.issue_story_links;
create policy "Issue story links are public"
  on public.issue_story_links for select
  using (true);
