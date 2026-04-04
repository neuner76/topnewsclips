-- Add source tier classification columns to featured_journalists
-- These are set automatically when a community submission is accepted,
-- and used by the pipeline to classify stories from sources not yet in
-- the static source-tier.ts lookup table.

alter table featured_journalists
  add column if not exists source_tier  int  check (source_tier between 1 and 10),
  add column if not exists source_type  text;
