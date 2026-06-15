-- Task 8: source policy lives on featured_journalists (single source of truth).
--
-- Sources are already governed here (active, source_tier, channel_id). Policy
-- status, blocked slots, and blocked sections are added as columns rather than
-- in a parallel TS registry, so there is no second, conflicting source of truth.
alter table featured_journalists
  add column if not exists policy_status text not null default 'active'
    check (policy_status in ('active','restricted','deactivated','pending_reclassification')),
  add column if not exists blocked_slots text[] default '{}',      -- e.g. {'lead','need_to_know'}
  add column if not exists blocked_sections text[] default '{}',
  add column if not exists policy_reason text,
  add column if not exists policy_updated_at timestamptz;

-- Reconcile the existing `active` boolean with policy_status: any row already
-- marked inactive is canonically 'deactivated'. `active` stays as a fast filter;
-- the reader (lib/source-policy.ts) treats active=false as deactivated so the
-- two cannot drift.
update featured_journalists
  set policy_status = 'deactivated',
      policy_updated_at = coalesce(policy_updated_at, now())
  where active = false and policy_status = 'active';
