# Stream 2 — Home and household

Updated September 15, 2026. Owner: Home stream.
State: ready for review — M02 browser guest-pass slice repaired, retested, and
now re-run against actual SQL. The September 15 "transcribed contract" limit is
closed; three further defects surfaced only once real SQL was in the loop.

Acknowledged the clarified [working agreement](README.md#working-agreement) and
[verification-first rules](../../AGENTS.md): preserve iOS/Android/web appearance,
verify existing journeys, repair demonstrated failures in place and retest them.
Reuse accepted evidence; justify any new file/schema or replacement through the
required comparison, and label unverified provider/device boundaries explicitly.

## Scope and source

- Inventory: H/R/I/D/F/M Home and household rows. Accepted work stays accepted;
  the [remaining-work inventory](../REMAINING_WORK_2026-09-11.md) remains authoritative.
- Milestone: M02, existing browser guest-pass lifecycle through the Home Share
  tab, issued link, public guest view and revocation, including passcode,
  start/end windows, view limits and stale-result retirement.
- **Worktree/branch actually committed from — `/private/tmp/pantopus-workstream-home`,
  branch `codex/workstream-home`.** This is the assigned Stream 2 worktree and the
  guide's row is correct. The other path a session may report
  (`.../estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380`, branch
  `claude/pantopus-stream-2-home-3ef380`) is only the harness's isolated scratch
  worktree that a remote session is launched into; it sits at master `711340225`
  with a clean tree and **zero commits**, and no application code was written
  there. The single file touched in it was its own untracked `.claude/launch.json`,
  pointed at the app worktree so a local dev server could serve this branch's
  code; it was restored both times. All application edits, both commits and the
  push came from `/private/tmp/pantopus-workstream-home`.
- Base master `711340225`; commits **`70e079543`** (browser repairs) and
  **`88d076e56`** (real-SQL run + what it exposed), both pushed. Coordinator
  opened **draft PR #53** (`codex/workstream-home` → `master`) for CI and review;
  content ownership stays with this stream and this is not merge approval.
- No backend, service, schema or migration change. No native/mobile change.

## What the existing journey already did correctly

Verified through the real Share tab and the real `/guest/:token` page in a
browser, against the real `homeIam`/`homeGuest` routers and the real
`homeExternalShareService` over actual HTTP: quick-template and custom issuance,
the returned token becoming a real copyable link and a real QR, the copied link
opening with exactly the bound sections and Home fields, view counting and
"last viewed" reaching the issuer list, the passcode challenge, a wrong passcode
refused **without** spending view quota, a correct passcode unlocking, and
revocation moving the pass to Past Passes and killing the link immediately.
None of that needed repair. Backend/SQL authority, quota, receipt and race
behaviour reuses the accepted [sharing report](../home-invitation-sharing-2026-09-09.md)
within its recorded limits.

## Reproduced failures and the repairs

All five were reproduced in the browser before any edit, and re-verified after.

| Reproduced failure | Repair |
| --- | --- |
| Exhausted view limit rendered "Something Went Wrong" + Try Again (API: 410 `SHARE_VIEW_LIMIT`) | Terminal "View Limit Reached" screen, no retry |
| Unopened start window rendered the same generic error (API: 403 `SHARE_NOT_STARTED`) | "Not Active Yet", retry kept because it can succeed later |
| Legacy link claimed it "was revoked by the home admin" (API: 410 `SHARE_REISSUE_REQUIRED`) | "Link Needs Replacing — ask the sender for a new link" |
| ShareCenter badged `reissue_required` and `scheduled` passes **Active** and counted them in Active Passes | Reads the status the list endpoint already returns; dead links move to Past Passes, scheduled keeps Revoke and shows its start time |
| A failed pass list rendered "No active guest passes" | Explicit failure card with Retry |

Two further defects found while repairing the above: create/revoke/scoped-share
failures were discarded because this API client rejects with a plain object and
the screens tested `err instanceof Error` (a 400 `SHARE_INVALID` showed only
"Failed to create guest pass"); and the two passcode inputs disagreed with the
API's 128-character limit (create unbounded, guest capped at 20), so an issuer
could set a passcode a web guest could not type. Both repaired. Superseded async
results are now dropped on both screens using the repo's existing
`generation = useRef(0)` convention.

Changed paths: `frontend/apps/web/src/app/guest/[token]/page.tsx`,
`frontend/apps/web/src/components/home/share/{ShareCenter,CreateGuestPass,ScopedShareModal}.tsx`,
new `.../share/shareFailure.ts`, `frontend/apps/web/tests/homeSharingLinks.test.tsx`,
`frontend/packages/api/src/endpoints/homeIam.ts`, and new
`scripts/db/{home-guest-pass-http-fixture,test-home-guest-pass-http}.cjs`.

New-file justification: no existing harness exercised these routes over real
HTTP (the tracked `tests/guest-pass.spec.ts` mocks every API response, and the
existing `scripts/db/*-http-fixture.cjs` cover residency/removal/tasks, not
sharing). `shareFailure.ts` is shared by three share screens; the repo has no
reader for this client's plain-object rejection shape (ClaimEvidenceReview keeps
a private one). The existing `homeSharingLinks.test.tsx` was extended rather than
replaced; its denial case had mocked an `Error`, a shape this client never
produces, which is what hid the dropped reason.

## Evidence and limits

- New: `node scripts/db/test-home-guest-pass-http.cjs` — 8 checks over real HTTP
  through the production routers and service. Browser journey driven end to end
  on a local Next dev server: issue → copy → open → passcode → revoke, plus each
  refused state before and after the repair.
- Regressions: web suite **107 suites / 1468 tests** pass; backend
  `homeExternalShareRoutes` + `guestPass` **51 tests** pass; web typecheck gate
  at its 0-error baseline; eslint 0 errors on the changed paths (the two new
  `generation.current` cleanup warnings match the existing ClaimEvidenceReview
  convention, which warns identically).
- **Real SQL (September 16).** `node scripts/db/test-home-guest-pass-http.cjs
  --container supabase_db_pantopus-stream2-guest-r1` — **9 checks pass** with the
  share RPCs executing as actual SQL (all 53 migrations, `service_role` through
  `docker exec psql`), including a new one proving a withdrawn `access.view_wifi`
  grant both refuses issuance and retires links it already backed. The same
  script still passes its 8 checks without a container. The browser journey was
  repeated on the SQL-backed server: issuing from the real Share tab persisted a
  `HomeGuestPass` with `resource_bindings` and a `guest_pass_created` audit row;
  the copied link opened with the bound sections; revoking from the UI set
  `revoked_at`, wrote `guest_pass_revoked`, and turned the link into a 410 and
  the Access Revoked screen. Scheduled and legacy passes kept honest badges from
  the real list status. Owned rows verified back to **zero**.
- **Three defects only real SQL could expose** (all repaired in `88d076e56`):
  1. `HomeEmergency.type` can only hold the `HomeEmergencyType` values already
     declared in `@pantopus/types` (`HomeEmergency_type_chk`: `shutoff_water`,
     `shutoff_gas`, `shutoff_electric`, `breaker_map`, `extinguisher`,
     `first_aid`, `evac_plan`, `emergency_contacts`, `other`). The public guest
     page matched `'shutoff'`/`'contact'`, values this column never holds, so
     **every** emergency entry fell through to the generic icon — a water
     shutoff rendered identically to a contact list. Mapped to the real values
     using the page's own glyphs; confirmed in the browser on real rows.
  2. `inspect_home_external_share` rechecks the issuer's **current** permission
     for each bound section. My transcription only rechecked
     `members.manage`/`home.view`, so it would have kept serving a wifi link
     after the issuer lost `access.view_wifi`. Transcription corrected to match.
  3. `trg_sync_homeaccesssecret_value` refuses an INSERT carrying a secret and
     only moves it into `HomeAccessSecretValue` on UPDATE; the fixture now seeds
     through that contract instead of writing the value table directly.
- **Remaining labelled limits.** Authentication is still synthetic, and dashboard
  reads unrelated to sharing are scaffolded in an uncommitted local launcher.
  Shared-document sections, scoped `/shared/:token` grants, native guest
  acceptance and the alternate `/app/homes/[id]/share` entry remain outside this
  slice. This closes only the bounded browser slice; broader M02 and release
  acceptance stay open.

## Coordination and handoff

- **Shared-file effect:** `frontend/packages/api/src/endpoints/homeIam.ts` —
  `GuestPass.status` widened to include `reissue_required` and `scheduled`,
  which `mutate_home_external_share` already returns. Type-only; no runtime or
  contract change. Flagging it because the SDK package is shared.
- **Runtime reservation taken and released September 16 (self-declared; no
  coordinator row existed and no message channel was available).** Private
  project `/private/tmp/pantopus-stream2-guest-r1`, container prefix
  `pantopus-stream2-guest-r1`, SQL 64552 / API 64551 (studio 64555, inbucket
  64556, analytics 64557, shadow 64553, pooler 64554), created by
  `supabase start --workdir` with all 53 migrations applied (340 public tables).
  Chosen clear of every retained resource; 64521-64533, 18089, 18130-18132 and
  15292 were never connected to or mutated. **Released** with
  `supabase stop --workdir /private/tmp/pantopus-stream2-guest-r1 --no-backup`;
  its ports are free and the retained `pantopus-home-gig-replay` (64521-64527)
  and `pantopus-stream3-block-r1` (64532) containers were verified still up and
  healthy afterwards. The project directory remains for cheap recreation; the
  tracked fixture rebuilds the whole run in one command if the coordinator wants
  to repeat it.
- **Original runtime request (September 15, then blocked):** requested one fresh
  disposable `pantopus-home-guest-pass-*` Postgres container on an unassigned
  port. **Blocked:** the Docker daemon on this Mac did not respond all session —
  `docker ps`, `docker ps -a` and a direct query of `~/.docker/run/docker.sock`
  all hung past 120s with no output, with ten queued `docker ps` processes from
  several sessions. Docker Desktop and its backend/virtualization processes are
  alive and the retained 64522/18089 listeners still accept connections. I ran
  no state-changing docker command and did not restart Docker Desktop, because
  that would disturb the retained rehearsal containers. Coordinator decision
  needed; when the daemon returns, the tracked fixture takes a `container`
  option and the same journey can be re-run against real SQL.
- **Environment finding for every stream:** `qrcode@1.5.4` (and `@types/qrcode`,
  `jsqr`) are in `pnpm-lock.yaml` but absent from the owner's main-checkout
  `node_modules`, so the Share tab and the invitation QR flows fail to build
  there with `Module not found: Can't resolve 'qrcode'`. A `pnpm install` is
  needed in any worktree that builds the web app. I did not run one; I fetched
  those three packages into my own gitignored `node_modules` instead.
- **Proposed, not implemented (needs approval — visible change):** the guest
  page's Wi-Fi "Quick Connect" block renders a static placeholder icon labelled
  "QR Code" under the text "Scan to connect automatically"; nothing is
  scannable, while the app already ships the real shared `QRCode` component used
  on the issuer side. Filling the same 128px box with the real component would
  complete the intended function but changes visible output, so it is held.
- **Resources/cleanup:** local Next dev server (3000) and the fixture HTTP
  server (8000) both stopped. No container, shared cache, database, migration,
  simulator or device was created, written or mutated; ports 64522/18089 were
  never connected to beyond a `pg_isready` liveness probe. Uncommitted local
  dev-environment state remaining in my worktree only: a `node_modules` symlink
  to the main checkout, copied per-package symlink farms, and the three fetched
  packages — all gitignored or untracked, removable on handoff.
- **Peer finding for whoever owns the members' Emergency screen:**
  `frontend/apps/web/src/app/(app)/app/homes/[id]/emergency/page.tsx` orders
  categories by `['shutoff','contact','evacuation','medical','other']` — the same
  invented values the guest page used, none of which `HomeEmergency.type` can
  hold. Not touched here (different screen, outside this slice); routing it to
  the coordinator rather than expanding scope.
- **PR #53 CI is green (run `35128148860`): 6 pass, 5 skip, 0 failures.** Passing:
  CI OK, Detect changes, Deployment and migration safeguards, **Web (lint,
  typecheck gate, Jest) 4m41s**, Web E2E (Identity Firewall) 2m8s, and
  **database / Replay and lint the complete schema 2m2s**. Skipped with no
  changed paths: backend, Backend Docker image, Seeder, android, ios — consistent
  with this candidate touching no backend, schema or native code. The database
  replay job passing is the independent check on the same 53-migration replay
  this stream ran locally; this candidate adds no migration. No native build
  requested, so the heavy slot stays free as far as this stream is concerned.
- **Next:** PR #53 is green and awaiting coordinator review/merge disposition;
  then continue to the next M02 sub-slice (scoped `/shared/:token` grants, the
  shared-document receipt journey, or the alternate `/app/homes/[id]/share`
  entry).
