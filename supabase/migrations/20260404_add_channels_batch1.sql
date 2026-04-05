-- Add new YouTube channels to featured_journalists
-- Tier 1 — Nonprofit Investigative
insert into featured_journalists (username, platform, active, source_tier, source_type) values
  ('frontline',     'youtube', true, 1, 'Nonprofit Investigative'),
  ('npr',           'youtube', true, 1, 'Nonprofit Investigative')
on conflict (username, platform) do update
  set active = true, source_tier = excluded.source_tier, source_type = excluded.source_type;

-- Tier 3 — Public Broadcaster
insert into featured_journalists (username, platform, active, source_tier, source_type) values
  ('bbcworldservice',  'youtube', true, 3, 'Public Broadcaster'),
  ('abcnewsaustralia', 'youtube', true, 3, 'Public Broadcaster'),
  ('cbcnews',          'youtube', true, 3, 'Public Broadcaster'),
  ('channel4news',     'youtube', true, 3, 'Public Broadcaster')
on conflict (username, platform) do update
  set active = true, source_tier = excluded.source_tier, source_type = excluded.source_type;

-- Tier 5 — Wire Service
insert into featured_journalists (username, platform, active, source_tier, source_type) values
  ('reuters',       'youtube', true, 5, 'Wire Service'),
  ('afpnewsagency', 'youtube', true, 5, 'Wire Service')
on conflict (username, platform) do update
  set active = true, source_tier = excluded.source_tier, source_type = excluded.source_type;

-- Tier 6 — Commercial Newsroom
insert into featured_journalists (username, platform, active, source_tier, source_type) values
  ('60minutes',          'youtube', true, 6, 'Commercial Newsroom'),
  ('2020',               'youtube', true, 6, 'Commercial Newsroom'),
  ('datelinenbc',        'youtube', true, 6, 'Commercial Newsroom'),
  ('cnn',                'youtube', true, 6, 'Commercial Newsroom'),
  ('bbcnews',            'youtube', true, 6, 'Commercial Newsroom'),
  ('cnbc',               'youtube', true, 6, 'Commercial Newsroom'),
  ('bloombergquicktake', 'youtube', true, 6, 'Commercial Newsroom'),
  ('abcnews',            'youtube', true, 6, 'Commercial Newsroom'),
  ('cbsnews',            'youtube', true, 6, 'Commercial Newsroom')
on conflict (username, platform) do update
  set active = true, source_tier = excluded.source_tier, source_type = excluded.source_type;
