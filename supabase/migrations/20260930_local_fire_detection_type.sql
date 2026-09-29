-- My Local — add the fire_detection event type (NASA FIRMS satellite hotspots).
--
-- Distinct from fire_incident (confirmed CAL FIRE incidents): a satellite heat
-- detection is a signal, not a confirmed blaze, so lower base_importance (30 vs 60)
-- and a 24h auto-resolve (FIRMS is a rolling 24h window; absence-resolution also
-- clears it). auto_publish so detections surface in Need To Know. Apply in Supabase.

insert into local_event_type
  (slug, label, layer, icon, min_geo_precision, auto_publish, auto_publish_min_evidence_level, base_importance, auto_resolve_after_minutes, archive_after_days)
values
  ('fire_detection', 'Satellite fire detection', 'Fire', '🛰️', 'place', true, 1, 30, 1440, 30)
on conflict (slug) do nothing;
