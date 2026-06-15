-- Task 9: VICE/@vicenews policy as a data row, not code.
--
-- VICE was already retiered to T7 'Independent Commentary' (see
-- 20260611_vicenews_retier_and_new_channels.sql) but remained active=true. Its
-- relaunched creator/brand-partnership newsroom classification is under review,
-- so it is marked pending_reclassification and blocked from the lead and Need To
-- Know slots. It may still appear in Culture/Media, Global Lens, or lower
-- sections when appropriate and labeled.
--
-- NOTE: confirm the exact handle/channel_id in the live table before applying —
-- this assumes username = 'vicenews', platform = 'youtube'. If a prior cleanup
-- already deactivated VICE, reconcile to that state instead.
update featured_journalists
  set policy_status = 'pending_reclassification',
      blocked_slots = '{lead,need_to_know}',
      policy_reason = 'Relaunched creator/brand-partnership VICE; T4-era newsroom classification under review.',
      policy_updated_at = now()
  where username = 'vicenews' and platform = 'youtube';
