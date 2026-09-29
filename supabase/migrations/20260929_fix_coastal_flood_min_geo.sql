-- My Local — fix: coastal_flood min_geo_precision 'place' → 'county'.
--
-- NWS coastal-flood advisories are zone/county-level polygons with no point, so a
-- 'place' minimum could never be met — every advisory got stuck in the review queue
-- instead of auto-publishing (wrong for a safety alert). 'county' matches
-- weather_alert. Apply via the Supabase SQL editor. (The 20260924 seed is updated to
-- match for fresh installs.)

update local_event_type
   set min_geo_precision = 'county', updated_at = now()
 where slug = 'coastal_flood';
