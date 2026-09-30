-- My Local — raw-payload retention (spec 2026-09-30).
-- Adds the batched tiered-prune function + a nullable label on local_job_run so
-- the lifecycle sweep and the retention prune can be recorded/shown on /local/status.
-- Additive only. Apply in the Supabase SQL editor.

alter table local_job_run add column if not exists label text;

create or replace function public.local_prune_raw_payload(
  p_full_cutoff     timestamptz,  -- now - 7 days
  p_snapshot_cutoff timestamptz,  -- now - 90 days
  p_batch           integer
) returns integer
language sql
security invoker
as $$
  with candidates as (
    select id,
           created_at,
           row_number() over (
             partition by source_id,
                          (created_at at time zone 'America/Los_Angeles')::date
             order by created_at asc
           ) as day_rank
      from public.local_raw_payload
     where created_at < p_full_cutoff
  ),
  doomed as (
    select id
      from candidates
     where day_rank > 1                      -- not the daily snapshot
        or created_at < p_snapshot_cutoff    -- past the 90-day horizon
     order by created_at asc
     limit p_batch
  ),
  deleted as (
    delete from public.local_raw_payload r
     using doomed d
     where r.id = d.id
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.local_prune_raw_payload(timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.local_prune_raw_payload(timestamptz, timestamptz, integer) to service_role;
