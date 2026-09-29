# My Local — operations runbook

How the `/local` ingestion pipeline runs in production.

## Migrations (apply manually in the Supabase SQL editor)

There is no migration CI runner. Apply, in order, any un-applied files under
`supabase/migrations/` whose name starts `2026…local…` / touches `local_*`.
Applied to date: `20260907` (schema), `20260924` (source + event_type seeds),
`20260925` (ingest tables), `20260926` (raw payload), `20260927` (event columns),
`20260929` (coastal_flood min_geo fix).

## The dispatcher cron

The pipeline is driven by pinging one endpoint on a schedule:

```
GET https://www.topnewsclips.com/api/local/dispatch
Authorization: Bearer <CRON_SECRET>
```

- **`CRON_SECRET`** must be set in the Vercel **Production** env (the endpoint
  accepts this bearer token *or* a logged-in owner session; an external cron can
  only use the token). Redeploy after adding it.
- The endpoint runs only sources that are **due** — each self-throttles via its
  `crawl_interval_seconds` (300s floor, D4) — so pinging more often than every
  5 min just returns `due:[]`. It also runs the §7.4 lifecycle sweep once per call.

### Production scheduler: cron-job.org

1. Create a cronjob → URL above, method **GET**, schedule **every 5 minutes**
   (2–3 min for snappier freshness).
2. Advanced → **Headers**: `Authorization: Bearer <CRON_SECRET>` (same value as Vercel).
3. Save & enable.

Equivalents if the plan/infra changes: a Vercel Pro cron in `vercel.json`, or
Supabase `pg_cron` + `pg_net` calling the same URL with the same header.

### Troubleshooting

- **401 in the cron log** → the header value ≠ Vercel `CRON_SECRET`, or it isn't
  set / no redeploy since.
- **`due:[]` every time** → sources ran recently and aren't due yet (expected), or
  none are active/registered.
- Watch `/local/status` (owner-gated): "Last run" advancing, Recent runs accruing,
  the published count climbing. A missing-table/column error there means a
  migration above hasn't been applied.

## Flipping a section to the store (D1)

Once a section's events are landing published, serve it from the store by adding
its key to **`LOCAL_STORE_SECTIONS`** (comma-separated) in the Vercel env, then
redeploy. e.g. `LOCAL_STORE_SECTIONS=roadsAndIncidents`. Store-read falls back to
the live path on any error, and removing the env var reverts instantly.

Sections whose event types auto-publish (Need To Know, Roads) can flip as soon as
the cron has populated events. Held-type sections (Changing Around You →
`development_update`, Your Government → `government_action`) need their events
published from **`/local/review`** first.
