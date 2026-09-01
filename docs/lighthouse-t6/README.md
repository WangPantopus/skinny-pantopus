# T6 Lighthouse audits

Lighthouse audits for each T6 web page that has a live route.
Captures Performance, Accessibility, Best Practices, and SEO scores
against the production build at mobile viewport (Moto G Power
profile).

## Target scores (P75 across 3 runs)

| Category | Target | Hard floor |
|---|---|---|
| Performance | ≥ 90 | ≥ 85 |
| Accessibility | ≥ 95 | ≥ 95 |
| Best Practices | ≥ 95 | ≥ 95 |
| SEO | ≥ 90 | ≥ 85 |

CI fails the build if **any** new T6 page falls below the hard
floor. The full HTML report is retained as an artifact; the JSON is
committed under `docs/lighthouse-t6/<screen>.json` for diffing.

## Pages audited

### Web parity required (have a live route)

| Screen | URL | Tier | Report |
|---|---|---|---|
| Auth · Login | `/auth` | T6.1b | `auth-login.json` / `.html` |
| Auth · Create account | `/auth/signup` | T6.1b | `auth-signup.json` / `.html` |
| Auth · Forgot password | `/auth/forgot-password` | T6.1c | `auth-forgot.json` / `.html` |
| Auth · Reset password | `/auth/reset-password` | T6.1c | `auth-reset.json` / `.html` |
| Auth · Verify email sent | `/auth/verify-email-sent` | T6.1c | `auth-verify.json` / `.html` |
| Hub (refresh) | `/app/hub` | T6.2a | `hub.json` / `.html` |
| Me / Profile (refresh) | `/app/profile` | T6.2b | `me.json` / `.html` |
| Settings (refresh) | `/app/settings` | T6.2c | `settings.json` / `.html` |
| Members (per-home) | `/app/homes/demo/members` | T6.3a | `members.json` / `.html` |
| Packages (per-home) | `/app/homes/demo/packages` | T6.3d | `packages.json` / `.html` |
| Owners (per-home) | `/app/homes/demo/owners` | T6.3g | `owners.json` / `.html` |
| Access codes | `/app/homes/demo/access` | T6.4a | `access-codes.json` / `.html` |
| Home calendar | `/app/homes/demo/calendar` | T6.4c | `home-calendar.json` / `.html` |
| MyHomes (refresh) | `/app/homes` | T6.3f | `my-homes.json` / `.html` |
| MyListings | `/app/my-listings` | T6.3f | `my-listings.json` / `.html` |
| Mailbox (refresh) | `/app/mailbox` | T6.5b | `mailbox.json` / `.html` |
| Mail detail (A17 generic) | `/app/mailbox/demo` | T6.5b | `mail-detail.json` / `.html` |
| Chat conversation (refresh) | `/app/chat/demo` | T6.6b | `chat-conversation.json` / `.html` |
| Nearby map (MapListHybrid) | `/app/map` | T6.6a | `nearby-map.json` / `.html` |
| Support trains | `/app/support-trains` | T6.6c | `support-trains.json` / `.html` |
| Token Accept | `/invite/demo` | T6.6c (refresh) | `token-accept.json` / `.html` |

### Web parity deferred (no live route this milestone)

These home-pillar deep screens ship iOS + Android only per Q17 of the
buildout plan. Web sweep is a separate T7 effort.

- Maintenance (`/app/homes/[id]/maintenance` — placeholder page only)
- Household tasks
- Polls
- Documents
- Emergency info
- Vault
- My businesses
- MyBids stable (T5 covered)
- Audience hub / Creator inbox / Beacon / Privacy Handshake / Ceremonial
  mail / Identity Center / Legal full-page — mobile-only this tier.

## Run protocol

```sh
# From repo root.

# 1. Build the web app.
pnpm -F @pantopus/web build

# 2. Boot the web app in production mode.
pnpm -F @pantopus/web start  # foreground; binds :3000

# 3. In another terminal, install Lighthouse + chrome-launcher in /tmp.
#    Avoids polluting the workspace lockfile.
mkdir -p /tmp/lh-scratch && cd /tmp/lh-scratch
npm install --silent lighthouse chrome-launcher

# 4. Run the audit harness.
node /home/user/pantopus/docs/lighthouse-t6/run.mjs
```

The harness loops the T6 routes above with the Moto G Power preset
and writes `<screen>.json` + `<screen>.html` per route. Each run
takes ~90 s × ~22 routes ≈ ~33 minutes wall clock.

## CI integration

`.github/workflows/web-ci.yml` runs the harness on every push to
`master` and on PRs against `master`. The job:

1. Boots `pnpm -F @pantopus/web start` against a SQLite seed.
2. Runs `node docs/lighthouse-t6/run.mjs --check`.
3. If any category falls below the hard floor for any page, the job
   fails and posts the report link on the PR.
4. On `master`, the JSON files are committed to a follow-up PR
   (auto-bot) so the diff against the previous run is visible.

The script `docs/lighthouse-t6/run.mjs` mirrors the T5 harness
(~60 lines). It's not checked into the lockfile because the
harness install lives in `/tmp/lh-scratch` only.

## Initial scores

Pending the first CI lane that has the chromium browser + lighthouse
package available. The remote-execution container at the time of P27
landing didn't carry the lighthouse npm package; the harness writes
`<screen>.json` + `<screen>.html` per route on first execution.
Until then the table below carries pending placeholders.

| Screen | Perf | A11y | Best | SEO | Date |
|---|---|---|---|---|---|
| Auth · Login | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Auth · Create account | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Auth · Forgot password | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Auth · Reset password | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Auth · Verify email sent | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Hub (refresh) | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Me / Profile (refresh) | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Settings (refresh) | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Members | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Packages | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Owners | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Access codes | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Home calendar | _pending_ | _pending_ | _pending_ | _pending_ | — |
| MyHomes (refresh) | _pending_ | _pending_ | _pending_ | _pending_ | — |
| MyListings | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Mailbox (refresh) | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Mail detail (A17 generic) | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Chat conversation (refresh) | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Nearby map (MapListHybrid) | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Support trains | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Token Accept | _pending_ | _pending_ | _pending_ | _pending_ | — |

## Soak / leak protocol (mobile-only complement)

The Lighthouse runner exercises web pages only. The matching mobile
soak protocol — 60-second scroll + filter + pull-to-refresh loops on
each list screen — runs against the iOS simulator + Android emulator
with strict / leak mode enabled. See
[`docs/soak-tests-t6.md`](../soak-tests-t6.md) for the
mobile-specific runbook.
