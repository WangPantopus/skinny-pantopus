# T5 Lighthouse audits

Lighthouse audits for each new T5 web page. Captures Performance,
Accessibility, Best Practices, and SEO scores against the production
build at mobile viewport (Moto G Power profile).

## Target scores (P75 across 3 runs)

| Category | Target | Hard floor |
|---|---|---|
| Performance | ≥ 90 | ≥ 85 |
| Accessibility | ≥ 95 | ≥ 95 |
| Best Practices | ≥ 95 | ≥ 95 |
| SEO | ≥ 90 | ≥ 85 |

CI fails the build if **any** new T5 page falls below the hard floor.
The full HTML report is retained as an artifact; the JSON is
committed under `docs/lighthouse-t5/<screen>.json` for diffing.

## Pages audited (12)

| Screen | URL | Report |
|---|---|---|
| Notifications | `/app/notifications` | `notifications.json` / `.html` |
| Bills | `/app/homes/demo/bills` | `bills.json` / `.html` |
| Pets | `/app/homes/demo/pets` | `pets.json` / `.html` |
| Connections | `/app/connections` | `connections.json` / `.html` |
| Offers | `/app/offers` | `offers.json` / `.html` |
| My bids | `/app/my-bids` | `my-bids.json` / `.html` |
| My tasks V2 | `/app/my-gigs` | `my-tasks.json` / `.html` |
| My pulse | `/app/my-pulse` | `my-pulse.json` / `.html` |
| Listing offers | `/app/listing-offers` | `listing-offers.json` / `.html` |
| Discover hub | `/app/discover-hub` | `discover-hub.json` / `.html` |
| Discover businesses | `/app/discover` | `discover-businesses.json` / `.html` |
| Review claims | `/app/admin/review-claims` | `review-claims.json` / `.html` |

## Run protocol

```sh
# From repo root
pnpm -F @pantopus/web install
pnpm -F @pantopus/web exec playwright install chromium

# 1. Build production
pnpm -F @pantopus/web build

# 2. Boot in another terminal — keep this running
pnpm -F @pantopus/web start

# 3. From repo root, install lighthouse + chrome-launcher in a /tmp scratch dir.
#    Avoids polluting the workspace lockfile.
mkdir -p /tmp/lh-scratch && cd /tmp/lh-scratch
npm install --silent lighthouse chrome-launcher

# 4. Run the audit harness
node /home/user/pantopus/docs/lighthouse-t5/run.mjs
```

The harness loops the 12 routes above with the Moto G Power preset and
writes `<screen>.json` + `<screen>.html` per route. Each run takes
~90 s × 12 routes = ~18 minutes wall clock.

## CI integration

`.github/workflows/web-ci.yml` runs the harness on every push to
`master` and on PRs against `master`. The job:

1. Boots `pnpm -F @pantopus/web start` against a SQLite seed.
2. Runs `node docs/lighthouse-t5/run.mjs --check`.
3. If any category falls below the hard floor for any page, the job
   fails and posts the report link on the PR.
4. On `master`, the JSON files are committed to a follow-up PR
   (auto-bot) so the diff against the previous run is visible.

The script `docs/lighthouse-t5/run.mjs` is intentionally small (~60
lines) — Lighthouse + chrome-launcher do the heavy lifting. It's not
checked into the lockfile because the harness install lives in
`/tmp/lh-scratch` only.

## Initial scores

Pending the first CI lane that has the chromium browser + lighthouse
package available. The `run.mjs` harness writes `<screen>.json` +
`<screen>.html` per route on first execution; until then the table
below carries pending placeholders.

| Screen | Perf | A11y | Best | SEO | Date |
|---|---|---|---|---|---|
| Notifications | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Bills | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Pets | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Connections | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Offers | _pending_ | _pending_ | _pending_ | _pending_ | — |
| My bids | _pending_ | _pending_ | _pending_ | _pending_ | — |
| My tasks V2 | _pending_ | _pending_ | _pending_ | _pending_ | — |
| My pulse | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Listing offers | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Discover hub | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Discover businesses | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Review claims | _pending_ | _pending_ | _pending_ | _pending_ | — |
