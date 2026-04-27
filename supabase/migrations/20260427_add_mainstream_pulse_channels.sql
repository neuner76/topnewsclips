-- Add mainstream pulse YouTube channels to featured_journalists
-- These are gated from NTK/InTheKnow — used only for the Mainstream Pulse section
insert into featured_journalists (username, platform, active, source_tier, source_type) values
  ('nytimes',          'youtube', true, 6, 'Mainstream Pulse'),
  ('associatedpress',  'youtube', true, 6, 'Mainstream Pulse'),
  ('wsj',              'youtube', true, 6, 'Mainstream Pulse'),
  ('foxnews',          'youtube', true, 6, 'Mainstream Pulse')
on conflict (username, platform) do update
  set active = true, source_tier = excluded.source_tier, source_type = excluded.source_type;

-- NPR and Reuters already exist in featured_journalists with their independent tiers.
-- They remain as-is — their stories appear in the regular digest AND power the pulse section.
