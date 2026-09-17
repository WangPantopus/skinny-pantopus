# Stream 2 — Home and household

Updated September 16, 2026 (evening session). Owner: Home stream.
State: **ready for review** — the four bounded follow-ups this stream carried
forward (scoped `/shared/:token` links, the alternate `/app/homes/[id]/share`
entry, the members' Emergency page, the shared-document download journey) were
verified end to end, repaired in place and re-verified on `codex/workstream-home`
(fast-forwarded to master `d471611b3` first; guest-pass source identical to the
merged slice). Pushed as **`28bad0d3d`** + **`6882ba29a`**, draft
[PR #60](https://github.com/WangPantopus/skinny-pantopus/pull/60). Runtime reservation released. Full detail in the
[September 16 evening milestone](#milestone--september-16-2026-evening-scoped-links-settings-entry-emergency-info-shared-document-downloads).

**Runtime reservation (self-declared, taken 2026-09-16 ~16:05 PDT, RELEASED
~17:20 PDT):** the same disposable project as before —
`/private/tmp/pantopus-stream2-guest-r1`, container prefix
`pantopus-stream2-guest-r1`, SQL 64552 / API (Kong) 64551, with only db, kong,
postgrest, gotrue and storage-api started (`-x` for the rest). All 54 migrations
replayed (ledger 54). Nothing on 64521-64533, 18089 or 18130-18132 was connected
to or changed. Released with `supabase stop --workdir ... --no-backup`; no
`stream2` container remains, ports 64550-64559 are free, and the retained
`pantopus-home-gig-replay` (64521/64522) and `pantopus-stream3-block-r1` (64532)
containers were verified still up and healthy afterwards.

**Coordinator request (schema, needs assignment before any migration is written):**
both native Add Emergency forms POST `type` = `allergy` / `medical_condition` /
`medication` / `contact` / `pet_medical` / `power_of_attorney` / `other`
(Android `EmergencyFormCategory.backendType`, iOS `EmergencyFormCategory.rawValue`),
and `HomeEmergency_type_chk` refuses six of the seven — reproduced 2026-09-16 in
the replayed database (`INSERT ... type='contact'` → check-constraint violation;
only `other` saves) and through the real route over real PostgREST (HTTP 500
"Failed to create emergency info"). No lossless repair exists without widening
the constraint; a server-side mapping would silently turn an "Allergy" entry
into `first_aid` and change what the native detail screens show. Proposed
additive forward migration (not written): drop and re-add
`HomeEmergency_type_chk` with the nine current values plus the six form
categories, `SET lock_timeout`, "backwards compatible: yes", versioned after
master's newest and clear of the paid branch's `20260916021700..022100` block
(e.g. `20260916030000_home_emergency_form_types.sql`), with `HomeEmergencyType`
in `@pantopus/types` widened to match. Until it is granted the route now
answers a truthful 400 `INVALID_EMERGENCY_TYPE` instead of a 500; the native
forms still cannot save those six categories.

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
- **Merged.** Commits `70e079543` (browser repairs) and `88d076e56` (real-SQL run
  + what it exposed) reached master through PR #53 as **`4cc9d3787`**; docs PR #54
  merged as `b46934c92`. Independently verified from this worktree: both commits
  are ancestors of `origin/master`.
- **New base: `c14657e35`** (Stream 3's PR #51). `codex/workstream-home`
  fast-forwarded from `/private/tmp/pantopus-workstream-home` and pushed
  (`b46934c92..c14657e35`); branch identical to master, clean tree. The earlier
  `b46934c92` integration was documentation only; this one is not.
- **Integration check, and why it earned a full re-run.** Stream 3's delta touches
  none of this stream's files (`git diff --name-only HEAD...master` matches
  nothing under `guest/[token]`, `components/home/share`, `home-guest-pass*` or
  `endpoints/homeIam`), but it adds a **54th migration**
  (`20260916010000_direct_message_block_admission.sql`). That is a changed schema
  in the same database this stream replays, so the disposable project was rebuilt
  and the real-SQL journey repeated rather than assumed:
  - Replay applied all **54** migrations; ledger = 54; the 4 block-admission
    functions are present.
  - `test-home-guest-pass-http.cjs --container` — **9 checks pass**, owned rows
    back to zero. The new advisory-lock trigger on direct chat does not disturb
    `lock_home_external_share` or any guest-pass path.
  - Web **109 suites / 1481 tests** pass (Stream 3 adds 2 suites / 12 tests; all
    of this stream's remain green); typecheck gate at its 0-error baseline.
  - Runtime released again with `supabase stop --workdir ... --no-backup`; ports
    64551-64557 free; retained `pantopus-home-gig-replay` and
    `pantopus-stream3-block-r1` verified still up and healthy.
- This stream's merged slice also reached the paid branch through the coordinator's
  master integration (`6e106d9d0`); no action needed here.
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
- **Open bounded row carried forward (assigned to this stream):** the members'
  Emergency screen `frontend/apps/web/src/app/(app)/app/homes/[id]/emergency/page.tsx`
  orders categories by `['shutoff','contact','evacuation','medical','other']` —
  the same invented values the guest page carried, none of which
  `HomeEmergency.type` can hold under `HomeEmergency_type_chk`. Reproduction and
  repair not started; it needs its own baseline before any edit.
- **Next:** awaiting selection of the next bounded sub-slice — the Emergency-page
  row above, scoped `/shared/:token` grants, the shared-document receipt/download
  journey (needs a storage provider boundary, to be labelled), or the alternate
  `/app/homes/[id]/share` entry. No runtime is held by this stream and no native
  build is requested; the heavy slot stays free.


## Milestone — September 16, 2026 (evening): scoped links, Settings entry, Emergency info, shared-document downloads

**Branch / commits:** `codex/workstream-home`, base master `d471611b3`
(fast-forward only; the 11 commits behind were documentation). `28bad0d3d`
(harness + backend + web repairs + tests) and `6882ba29a` (document type label +
backend CI test). Draft PR: **[#60](https://github.com/WangPantopus/skinny-pantopus/pull/60)** — [CI run 35163173561](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35163173561) on `6882ba29a` is **green**: CI OK, Detect changes, Deployment and migration safeguards, Backend (privacy gates + Jest), Backend Docker image, Web (lint, typecheck gate, Jest), Web E2E (Identity Firewall), database / Replay and lint the complete schema all pass; Seeder, android and ios skip with no changed paths. Worktree clean.

**Changed paths (17 files, +1173/−153):** `backend/routes/home.js` (+38: 23514 →
400 `INVALID_EMERGENCY_TYPE`; new `DELETE /:id/emergencies/:emergencyId`),
`backend/routes/homeGuest.js` (attachment/type order), new
`backend/tests/homeEmergencyRoutes.test.js`,
`frontend/apps/web/src/app/(app)/app/homes/[id]/{emergency,share}/page.tsx`,
`frontend/apps/web/src/app/{guest,shared}/[token]/page.tsx`,
`frontend/apps/web/src/components/home/cards/EmergencyCard.tsx`, new
`.../components/home/emergencyTypes.ts`, `.../home/share/{ShareCenter.tsx
(export passStatus), shareFailure.ts (+requiresPasscode)}`, new
`.../home/share/sharedDocumentLabel.ts`, `frontend/apps/web/tests/homeSharingLinks.test.tsx`
(+7 tests), new `frontend/apps/web/tests/homeEmergencyPage.test.tsx` (5 tests),
`frontend/packages/api/src/endpoints/homeProfile.ts` (+`createHomeEmergency`,
`deleteHomeEmergency`), `scripts/db/{home-guest-pass-http-fixture,test-home-guest-pass-http}.cjs`.
No migration, no schema change, no native change, no layout/styling change.

### What the existing journeys already did correctly (verified first, reused)

The scoped-grant **backend** is correct end to end: issuing a `HomeTask` grant,
opening it, view counting, the 128-character passcode challenge/refusal/unlock,
view limits, future windows, legacy (`sharing_version` NULL) links, revocation
with idempotent replay, `can_edit:true` and foreign resource types refused, and
a withdrawn `tasks.view` grant retiring already-issued links — all as real SQL.
The document contract is also correct: `home_external_share_resource` binds the
exact `File` (fingerprint/sha/path checks), the read receipt is consumed once
per download and refuses a stale receipt after revocation, and a withdrawn
`docs.view` grant retires a guest pass that bound a document. The merged guest
slice (issue → copy → open → passcode → revoke) reproduces unchanged on today's
head (9/9 against the fresh 54-migration container before any edit). Emergency
GET/POST routes and their permission gate work for canonical types.

### Reproduced failures and the repairs (all reproduced before editing, re-verified after)

| Reproduced failure | Where | Repair |
| --- | --- | --- |
| Spent view limit → "Something Went Wrong" + Try Again (API 410 `SHARE_VIEW_LIMIT`); unopened window → same generic error (403 `SHARE_NOT_STARTED`); legacy link → "Access Revoked … revoked by the owner" (410 `SHARE_REISSUE_REQUIRED`); unknown token → generic + retry; passcode `maxLength=20` vs API 128 | `/shared/[token]` page (message-substring classification) | Reads the share API code through the existing `shareFailure` reader (now also carrying `requiresPasscode`); terminal screens for limit/reissue/not-found, retry kept only for not-started; `maxLength=128`; `generation` guard for superseded reads. Existing screens/copy retained; titles/bodies vary by code |
| "Share link copied to clipboard" put the **bare 64-hex token** on the clipboard (`res.share_url \|\| res.url \|\| res.token`); scheduled and legacy passes listed under Past Passes as "Expired", no Revoke on a scheduled link; failures showed the raw client message | `/app/homes/[id]/share` (Settings → Guest Passes) | Copies `${origin}/guest/<token>`; uses the exported `passStatus` (scheduled = current + revocable + "Starts …", legacy = "Needs new link", revoked = "Revoked"); `include_revoked:true` so the existing Revoked label is reachable; `failureMessage` for load/create/revoke; `generation` guard |
| Page grouped by `i.category` (no row has it), titled rows by `item.title` (rows have `label`), rendered `item.details` — a jsonb **object** — as a React child: **React throws "Objects are not valid as a React child (found: object with keys {})" and nothing renders** for any real row; Add created a `local-…` row and toasted success without any request; Delete removed only local state; create chips `shutoff/contact/evacuation/medical` are values the column refuses | `/app/homes/[id]/emergency` | Reads `type/label/location/details.{phone,notes,detail}`, groups by the real rollup (`emergencyTypes.ts`, same rollup as the native palettes), saves through `POST` with a `HomeEmergencyType` and the details object, deletes through the new `DELETE`, shows the server's row, reports the API reason on failure, `generation` guard |
| Filtered on `emergency_type ∈ {water_main, gas_shutoff, electrical_panel, sprinkler, contact, evacuation, plan}` — never a real value, so every row landed in "Other"; "+ Add Info" toggled an unused state | dashboard `EmergencyCard` (+ preview) | Buckets by real `type`; reads phone/notes from `details`; "+ Add Info" opens the existing Emergency page |
| Native Add Emergency forms POST `allergy/medical_condition/medication/contact/pet_medical/power_of_attorney` → check-constraint violation → **HTTP 500 "Failed to create emergency info"** (reproduced over the real route + real PostgREST) | `POST /:id/emergencies` | 23514 → 400 `{code:'INVALID_EMERGENCY_TYPE'}`. The schema widening itself needs the coordinator grant recorded at the top of this file; until then those six native categories still cannot be saved |
| No delete route existed (T6.0c "no PATCH/DELETE" row) | `home.js` | `DELETE /:id/emergencies/:emergencyId`: `can_manage_home` gate like POST, exactly-one-row of that home, 404 `EMERGENCY_NOT_FOUND` on replay |
| Every shared-document download served as `application/octet-stream` with an extension-less filename: `res.attachment(title)` ran after `res.type(mime)` and re-derived the type from the title | `homeGuest.js` | `attachment()` first, then the stored MIME type |
| Both public pages badged every shared document "PDF" (`doc.file_type \|\| 'PDF'`; the view carries `mime_type`/`doc_type`) | guest + scoped pages | `sharedDocumentLabel()` from the stored type |

### New-file justifications

`emergencyTypes.ts`: three web readers (page, card, preview) need the same
type→category rollup and detail reader; `@pantopus/types` declares the values
but no web mapping existed. `sharedDocumentLabel.ts`: two public pages, no
shared MIME→label helper (PrivateClaimEvidencePreview's map is private and
image/pdf-only). `homeEmergencyPage.test.tsx`: no suite rendered either
screen and it needs its own `next/navigation`/`homeProfile` mock shape.
`homeEmergencyRoutes.test.js`: no suite loads these handlers; `guestPass.test.js`
exercises the share service against the mocked database, not the routers.
Everything else extends existing files (the fixture/harness, the sharing test,
the SDK file, the share reader, ShareCenter's export).

### Evidence

- **Real HTTP/SQL/Storage harness** — `SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_ANON_KEY=…
  node scripts/db/test-home-guest-pass-http.cjs --container
  supabase_db_pantopus-stream2-guest-r1 --api http://127.0.0.1:64551`: **19 PASS**
  (8 accepted guest checks + 4 scoped + 3 emergency + 3 document + exact cleanup
  `{passes,views,audits,grants,receipts,tasks,emergencies,documents,files,homes,users,objects}` all 0).
  The same script still passes 8 checks route-only and 9 SQL-only, unchanged.
  In `--api` mode the production admin client (`backend/config/supabaseClient`)
  serves every non-share table/RPC/Storage call, so `home.js`, `homeDocumentFiles.js`
  and `homeDocumentStorage.js` run their real reads/writes; identity and rate
  limits are the only stubs.
- **Baselines** (before the repair, same harness/fixture): native form type →
  `500 {"error":"Failed to create emergency info"}`; download `content-type:
  application/octet-stream`; scratch Jest renders of the merged-master pages
  (not committed): Emergency page → React object-child error, no headings;
  Settings entry → listed the scheduled and legacy passes as "Expired" and
  copied `"baba…ba"` (the bare token).
- **Regressions**: web Jest **110 suites / 1493 tests** (was 109/1481); web
  typecheck gate **0 errors** at its 0-error baseline (run twice, after each
  commit); eslint **0 errors** on the changed paths (warnings are the existing
  `any`/`@ts-nocheck`/`generation.current` categories); backend Jest **118 tests**
  across `guestPass`, `homeEmergencyRoutes` (new, 7), `homeDocumentFiles`,
  `homeDocumentAccess`, `homeAddressRedaction`.
- **Browser journeys** on the local Next dev server (`.claude/launch.json` `web`,
  3000 → fixture 8000 through the existing `/api` rewrite), fixture in
  `--serve 8000` mode against the SQL/Storage-backed project: `/shared/<task>`
  renders the exact task; `<later>` → "Not Active Yet" + Try Again; `<legacy>`
  → "Link Needs Replacing"; `<limited>` opens once, second open → "View Limit
  Reached" with no Try Again; `<locked>` → passcode form with `maxlength=128`,
  wrong code → "Incorrect passcode. Please try again.", `sesame` → task; the
  task grant revoked through the API → "Access Revoked"; `/shared/<doc>` →
  Download link whose in-page fetch returns 200 `text/plain; charset=utf-8`,
  `attachment; filename="Fixture document"`, exact bytes; `/guest/<docPass>` →
  Shared Documents row, same download; Emergency page renders the two seeded
  rows under Shutoffs/Emergency Contacts (the pre-fix page crashes here), Add →
  Shutoffs → Gas → phone/details → row appears and SQL holds
  `type=shutoff_gas, details={notes,phone}`; Delete → confirm → row gone in UI
  and SQL (count back to 2); Settings entry lists 5 active incl. "Scheduled
  pass — Starts 9/17/2026 …" with Revoke and "Legacy pass — Needs new link"
  under Past; Revoke → confirm → pass moves to Past as "Revoked", SQL
  `revoked_at` set, audit `guest_pass_created,guest_pass_revoked`, public link →
  410 `SHARE_REVOKED`; New Pass → Guest → "Ana" → Create & Share → clipboard
  received `http://localhost:3000/guest/<token>` and that link opened the real
  guest page with Wi-Fi/parking/entry/house-rules and the real emergency icons
  (🔧 water shutoff, 📞 contacts). Screenshots were taken but not committed.

### Limits (labelled)

- Authentication is synthetic throughout (`x-fixture-actor` / the seeded owner;
  browser session via the `pantopus_access` + `pantopus_session` cookies).
  Storage is the disposable project's own Supabase Storage, not hosted.
- The dashboard `EmergencyCard` is verified by Jest only; the dashboard page needs
  many unrelated reads the fixture answers 404 (serve-mode catch-all), so it was
  not driven in the browser.
- **Native**: not built or run (no heavy-slot request). The native Add Emergency
  forms remain blocked by the constraint for six categories until the schema
  grant; no native code change is needed once it lands (the forms already send
  those ids). Installed native Emergency verification stays open.
- The scoped page keeps its existing `// @ts-nocheck`.
- `frontend/apps/web/src/components/home/QuickAccess.tsx` renders `{e.details}`
  (same object-child crash) but is **not rendered anywhere** (no importer); left
  untouched as dead code, flagged here.
- No native/mobile screen was changed; no web layout/styling changed.

### Visible change needing approval

The Emergency create form now shows a second small chip row (Water / Gas /
Electric / Breaker map, same chip style) only while "Shutoffs" is selected,
because shutoffs are stored per utility and the form previously saved nothing
at all. Without it the only alternatives were guessing a utility or keeping the
fake save. Everything else on the page is unchanged. If not approved, the row
can be dropped and "Shutoffs" would need a product decision on which type to
store.

### Shared-file / integration effects

- `frontend/packages/api/src/endpoints/homeProfile.ts`: two additive functions
  (`createHomeEmergency`, `deleteHomeEmergency`), Home-owned endpoint file, no
  existing signature changed. Flagged because the SDK package is shared.
- `backend/routes/home.js`: additive DELETE route + a 400 mapping inside the
  existing POST error branch; `backend/routes/homeGuest.js`: two-line ordering
  change. No Stream 1/3 overlap (`git diff --name-only` vs their paths: none).
- `ShareCenter.passStatus` is now exported (no behaviour change);
  `shareFailure.ShareFailure` gains `requiresPasscode` (additive).
- The scratch baseline tests and browser screenshots are not committed; the
  worktree's untracked state is only the gitignored `node_modules` symlink.

### Coordinator requests

1. Review/CI/merge of the draft PR (green locally as above; the harness `--api`
   mode needs the disposable project, the rest runs in CI).
2. The schema grant recorded at the top of this file (widen
   `HomeEmergency_type_chk` + `HomeEmergencyType`); this stream will write the
   forward migration, the SQL contract/generated test and the type widening,
   then re-run the harness with the six native ids.
3. Decision on the shutoff sub-kind row above.

### Runtime and fixture cleanup

Fixture server (8000) and Next dev server (3000) stopped; `--cleanup` counts all
zero (rows and Storage objects); the private bucket was removed; disposable
project stopped with `--no-backup` (no `stream2` container remains; 64550-64559
free); retained 64521/64522/64532 containers verified up and healthy; browser tab
closed. Nothing else on this Mac was created, written or mutated.

### Next

- Upon the schema grant: migration + contract + types, harness re-run, then
  installed native Emergency add/list verification (needs the heavy native slot).
- Remaining M02 breadth outside the browser: native guest-pass acceptance, the
  dashboard Share tab against a fuller scaffold, the wider D08 external-share
  expiry/account-change acceptance.
