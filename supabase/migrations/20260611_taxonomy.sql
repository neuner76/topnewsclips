create table if not exists public.taxonomy (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('topic', 'region', 'section')),
  slug text not null unique,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.story_tags (
  story_id uuid not null references public.stories(id) on delete cascade,
  taxonomy_id uuid not null references public.taxonomy(id) on delete cascade,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  tagged_by text not null check (tagged_by in ('model', 'editor', 'needs_review')),
  created_at timestamptz not null default now(),
  primary key (story_id, taxonomy_id)
);

create index if not exists story_tags_taxonomy_story_idx
  on public.story_tags (taxonomy_id, story_id);

create index if not exists story_tags_story_idx
  on public.story_tags (story_id);

insert into public.taxonomy (kind, slug, label)
values
  ('topic', 'politics-government', 'Politics & Government'),
  ('topic', 'world-affairs', 'World Affairs'),
  ('topic', 'science', 'Science'),
  ('topic', 'health', 'Health'),
  ('topic', 'technology-ai', 'Technology & AI'),
  ('topic', 'business-markets', 'Business & Markets'),
  ('topic', 'climate-environment', 'Climate & Environment'),
  ('topic', 'media-information', 'Media & Information'),
  ('topic', 'justice-courts', 'Justice & Courts'),
  ('topic', 'education', 'Education'),
  ('topic', 'sports', 'Sports'),
  ('topic', 'culture-society', 'Culture & Society'),
  ('region', 'north-america', 'North America'),
  ('region', 'latin-america', 'Latin America'),
  ('region', 'europe', 'Europe'),
  ('region', 'middle-east', 'Middle East'),
  ('region', 'africa', 'Africa'),
  ('region', 'south-asia', 'South Asia'),
  ('region', 'east-asia-pacific', 'East Asia & Pacific'),
  ('region', 'global-multi-region', 'Global / Multi-region'),
  ('section', 'global-blindspot', 'Global Blindspot'),
  ('section', 'global-lens', 'Global Lens'),
  ('section', 'limited-coverage', 'Limited Coverage')
on conflict (slug) do update
set kind = excluded.kind,
    label = excluded.label,
    active = true;
