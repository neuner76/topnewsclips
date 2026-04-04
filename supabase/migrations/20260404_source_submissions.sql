-- Source submissions: community-nominated sources for editorial review
create table if not exists source_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- Submitter fields
  channel_url     text not null,
  reason          text not null,
  suggested_tier  int  check (suggested_tier between 1 and 10),
  submitter_email text,

  -- Editorial decision fields (set by admin)
  status              text not null default 'submitted'
                        check (status in ('submitted','under_review','accepted','declined')),
  reviewed_at         timestamptz,
  decision_tier       int  check (decision_tier between 1 and 10),
  decision_rationale  text,

  -- Flags
  is_community_nominated  boolean not null default false,
  community_nominated_at  timestamptz
);

-- Public-facing index: list recent submissions ordered by date
create index if not exists source_submissions_created_at_idx
  on source_submissions (created_at desc);

-- Admin index: filter by status
create index if not exists source_submissions_status_idx
  on source_submissions (status);

-- RLS: public can insert, nobody can read/update via anon key (admin uses service role)
alter table source_submissions enable row level security;

create policy "Anyone can submit a source"
  on source_submissions for insert
  to anon, authenticated
  with check (true);

-- Public read: only reviewed rows (submitted status hidden until reviewed)
create policy "Public can read reviewed submissions"
  on source_submissions for select
  to anon, authenticated
  using (status in ('under_review','accepted','declined'));
