-- Task 1.2: source library cleanup
-- VICE News relaunched in 2026 under new ownership — reclassify from Tier 4
-- (Independent News) to Tier 7 (Independent Commentary) to match source-tier.ts.
update featured_journalists
  set source_tier = 7, source_type = 'Independent Commentary'
  where username = 'vicenews' and platform = 'youtube';

-- New channels: Four Corners (ABC News In-depth, AU public broadcaster) and
-- The Print (India), matching the additions to source-tier.ts.
insert into featured_journalists (username, platform, active, source_tier, source_type, channel_id) values
  ('abcnewsindepth', 'youtube', true, 3, 'Public Broadcaster',      'UCxcrzzhQDj5zKJbXfIscCtg'),
  ('theprintindia',  'youtube', true, 7, 'Independent Commentary',  'UCuyRsHZILrU7ZDIAbGASHdA')
on conflict (username, platform) do update
  set active = true, source_tier = excluded.source_tier, source_type = excluded.source_type, channel_id = excluded.channel_id;
