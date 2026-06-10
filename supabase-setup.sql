-- ============================================================
-- TopNewsClips.com — Supabase Database Setup
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- Stories table
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  embed_url text not null,
  platform text not null check (platform in ('youtube', 'x', 'tiktok')),
  view_count bigint not null default 0,
  share_count bigint not null default 0,
  msm_gap boolean not null default false,
  msm_notes text,
  published boolean not null default false,
  display_order integer not null default 99,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subscribers table
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  unsubscribe_token text not null unique default translate(rtrim(encode(gen_random_bytes(24), 'base64'), '='), '+/', '-_'),
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row Level Security — public can read published stories
alter table public.stories enable row level security;
alter table public.subscribers enable row level security;

-- Anyone can read published stories
create policy "Public can read published stories"
  on public.stories for select
  using (published = true);

-- Authenticated users (admin) can do everything to stories
create policy "Admin full access to stories"
  on public.stories for all
  using (auth.role() = 'authenticated');

-- Anyone can insert a subscriber (subscribe form)
create policy "Anyone can subscribe"
  on public.subscribers for insert
  with check (true);

-- Authenticated users can read all subscribers
create policy "Admin can read subscribers"
  on public.subscribers for select
  using (auth.role() = 'authenticated');

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger stories_updated_at
  before update on public.stories
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- Sample story (delete after testing)
-- ============================================================
insert into public.stories (
  title,
  slug,
  description,
  embed_url,
  platform,
  view_count,
  share_count,
  msm_gap,
  msm_notes,
  published,
  display_order
) values (
  'Welcome to Top News Clips — The Stories MSM Won''t Cover',
  'welcome-to-top-news-clips',
  'Top News Clips surfaces the viral stories rocking social media that mainstream outlets ignore. Add your first real story from the admin panel.',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'youtube',
  1000000,
  50000,
  false,
  null,
  true,
  1
);
