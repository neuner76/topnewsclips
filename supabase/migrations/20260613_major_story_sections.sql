-- Phase 3: story-page sections for major stories (Corroborated-threshold
-- coverage). Generated at ingest, stored only when they pass blocking
-- section QC; null for minor stories and failed generations.
alter table stories add column if not exists in_context text null;
alter table stories add column if not exists what_we_know jsonb null;
alter table stories add column if not exists what_remains_unclear jsonb null;
