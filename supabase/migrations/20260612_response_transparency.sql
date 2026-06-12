create table if not exists public.verified_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website_url text not null,
  organization_type text not null,
  issue_areas text[] not null default '{}',
  regions text[] not null default '{}',
  approval_status text not null default 'proposed' check (approval_status in ('proposed', 'approved', 'rejected', 'retired')),
  approved_by uuid null,
  approved_at timestamptz null,
  last_reviewed_at timestamptz null,
  reason_listed text null,
  risk_notes text null,
  verification_sources jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verified_response_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.verified_organizations(id),
  response_type text not null check (response_type in ('learn', 'track', 'share_responsibly', 'official_process', 'report', 'support_verified_response', 'local_resource')),
  title text not null,
  description text not null,
  url text not null,
  story_category text null,
  issue_area text null,
  region text null,
  approval_status text not null default 'proposed' check (approval_status in ('proposed', 'approved', 'rejected', 'retired')),
  approved_by uuid null,
  approved_at timestamptz null,
  last_reviewed_at timestamptz null,
  reason_listed text null,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  risk_notes text null,
  verification_sources jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reader_questions (
  id uuid primary key default gen_random_uuid(),
  story_id text null,
  story_slug text null,
  issue_id uuid null,
  question text not null,
  email text null,
  user_id uuid null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'answered', 'archived')),
  moderation_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verified_organizations_approval_status_idx on public.verified_organizations(approval_status);
create index if not exists verified_organizations_issue_areas_idx on public.verified_organizations using gin(issue_areas);
create index if not exists verified_organizations_regions_idx on public.verified_organizations using gin(regions);

create index if not exists verified_response_resources_approval_status_idx on public.verified_response_resources(approval_status);
create index if not exists verified_response_resources_response_type_idx on public.verified_response_resources(response_type);
create index if not exists verified_response_resources_story_category_idx on public.verified_response_resources(story_category);
create index if not exists verified_response_resources_issue_area_idx on public.verified_response_resources(issue_area);
create index if not exists verified_response_resources_region_idx on public.verified_response_resources(region);

create index if not exists reader_questions_story_slug_idx on public.reader_questions(story_slug);
create index if not exists reader_questions_status_idx on public.reader_questions(status);
create index if not exists reader_questions_created_at_idx on public.reader_questions(created_at desc);

alter table public.verified_organizations enable row level security;
alter table public.verified_response_resources enable row level security;
alter table public.reader_questions enable row level security;

drop policy if exists "Approved organizations are public" on public.verified_organizations;
create policy "Approved organizations are public"
  on public.verified_organizations for select
  using (approval_status = 'approved');

drop policy if exists "Approved response resources are public" on public.verified_response_resources;
create policy "Approved response resources are public"
  on public.verified_response_resources for select
  using (approval_status = 'approved');

drop policy if exists "Reader questions are private" on public.reader_questions;
create policy "Reader questions are private"
  on public.reader_questions for select
  using (false);

drop policy if exists "Anyone can submit pending reader questions" on public.reader_questions;
create policy "Anyone can submit pending reader questions"
  on public.reader_questions for insert
  with check (status = 'pending');
