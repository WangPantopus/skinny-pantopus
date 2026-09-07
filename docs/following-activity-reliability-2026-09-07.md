# Following activity reliability

A shared `N × 25` post query could fill entirely with one busy Beacon's posts,
making another followed Beacon appear to have no updates. Each Beacon was also
capped before audience filtering, so 25 newer paid/draft/private posts could
hide an older permitted update and incorrectly report zero unread updates.

Following now loads each active, unblocked Beacon's permitted posts separately.
Archive, broadcast publication status, audience, distribution target, and tier
filters execute in PostgREST before the 25-row limit. Application-side
visibility checks remain in place. Rows with a broadcast status must explicitly
be `published`; ordinary posts with a missing/null broadcast status remain
eligible. Invalid empty/boolean/numeric broadcast statuses fail closed.

Each Beacon retains the existing 25+ unread display contract. Reads use the
last-seen timestamp, falling back to the date the viewer followed. Post IDs
break equal-timestamp ties deterministically. Membership sorting, counts, and
pagination happen after all activity is loaded. Any failed lookup returns an
unavailable response rather than a partial list with false empty updates.

At most five post queries run concurrently. This trades the previous single
incomplete query for one bounded query per visible membership, using the
existing persona/tier/date index. It requires no migration. Very large follow
lists still involve proportional requests; a future database aggregation can
reduce round trips after migration-baseline adoption. Unread values remain
capped at 25, not lifetime-exact counts.

## Verification

- Full backend Jest suite: **4,263 pass**, 16 existing skips.
- Five real PostgreSQL 17 / PostgREST 14 contract tests pass: uneven 80-post
  volume, 80 newer restricted/unpublished posts, SQL/application policy parity
  across all four ranks and broadcast states, seen/joined timestamp ties,
  and database ordering below JavaScript's millisecond precision.
- Route regressions enforce ORDER BY/LIMIT (the shared mock historically
  ignored them), verify the quiet Beacon and restricted-content cases, and
  preserve global pagination/counts. Concurrency and lookup-failure tests pass.
- The shared test adapter now understands nested AND/OR, JSON status fields,
  array containment, and SQL NULL comparisons needed by these filters. The
  full backend suite passes with those semantics.
- Migration-history checks pass; no migration was added or executed.
- Privacy gates and all 20 deployment/migration workflow tests pass.

Run the real query contract from `backend`:

```sh
PANTOPUS_POSTGREST_CONTRACT=1 node --test tests/contract/followingActivity.postgrest.test.cjs
```

It creates a disposable database and PostgREST container on an isolated Docker
network, exposes only a loopback HTTP port, loads synthetic rows, and removes
its resources afterward. It does not read `.env`, use the app database, send
notifications, or test application RLS. CI runs it as part of the backend job.
The filter syntax is documented in the [PostgREST API reference](https://docs.postgrest.org/en/stable/references/api/tables_views.html#logical-operators).

Physical-device push delivery remains the separate staging dependency described
in [beacon-staging-verification-2026-09-07.md](beacon-staging-verification-2026-09-07.md).
