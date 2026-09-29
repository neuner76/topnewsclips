-- My Local — freshness: last_seen_at on local_events.
--
-- latest_update_at records when an event last CHANGED; for an ongoing event
-- (a multi-day closure) that can be hours old even though the source still reports
-- it every cycle, which reads as stale. last_seen_at records when the source last
-- CONFIRMED the event (bumped each run its dedupe_key appears, even with no change).
-- The store-read uses last_seen_at for the displayed freshness. Apply in Supabase.

alter table local_events add column if not exists last_seen_at timestamptz;
