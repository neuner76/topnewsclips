-- TRT World was classified Tier 3 'Public Broadcaster' until 2026-06-11
-- (commit aa78caa added it to STATE_MEDIA_PREFIXES/STATE_MEDIA_JOURNALISTS).
-- The taxonomy page has always listed TRT World as the Tier 8 State Media
-- example. Backfill all existing TRT stories to match.
update stories
  set source_tier = 8, source_type = 'State Media'
  where source ilike '%TRT World%' and source_tier is distinct from 8;

-- Same legacy check for the other state-media outlets, in case any
-- pre-classification stories exist.
update stories
  set source_tier = 8, source_type = 'State Media'
  where (source ilike '%CGTN%' or source ilike '%TeleSUR%')
    and source_tier is distinct from 8;
