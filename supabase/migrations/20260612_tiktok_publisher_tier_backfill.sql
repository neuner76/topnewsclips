-- Tier follows publisher of record, not platform: official newsroom TikTok
-- accounts were classified Community T10 by the platform fallback. Backfill
-- existing stories to the publisher's tier (matches the new source-tier.ts
-- resolution).
update stories
  set source_tier = 6, source_type = 'Newsroom'
  where source in ('TikTok/@abcnews', 'TikTok/@60minutes')
    and source_tier is distinct from 6;

update stories
  set source_tier = 3, source_type = 'Public Broadcaster'
  where source = 'TikTok/@cbcnews'
    and source_tier is distinct from 3;
