# Stream 2 — Home and household

Updated September 20, 2026. Owner: Home stream.

## September 21 D07 member permissions — reviewable handoff

**Current: candidate published, exact-head CI running; stream incomplete and continuing.** Per coordinator direction the assigned Home worktree now uses separate follow-up branch `codex/home-member-permission-recovery`, clean/pushed at **`deda07ecf57f5cf9d8e052e1215782afd60db790`**, [draft PR104](https://github.com/WangPantopus/skinny-pantopus/pull/104) stacked on PR102's branch. Only existing `frontend/apps/web/src/components/home/members/MemberDetail.tsx` changes (85 additions/63 deletions). Do not overwrite coordinator-updated `origin/codex/workstream-home`. [Exact CI35571776785](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35571776785) running; prior audit50289 [CI35570755239](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35570755239) completed SUCCESS, but its master update/integration belongs to coordinator.

- Baselines: actual HomeRolePermission SELECT denial caused real permissions500; panel claimed No specific permissions assigned with Admin Actions enabled despite3 saved permissions. Separately held real MemberA200/member3, close/open GuestB200/guest1, delivered oldA200 on live socket: B name stayed but role/summary/controls became member3. Six current/master/paid/staging/place/archive sources shared the catch and lacked lifetime guards.
- Repair: reuse existing ErrorState/failureMessage for explicit read/retry and hide controls until permissions load; scope reads and all existing asynchronous mutation completions to current panel/member/Home/owner authority. Preserve role choices, successful layout, removal navigation, backend policy and schemas. No new files/unit tests or speculative role-cycle change.
- Actual browser→SDK→homeIam/current permission helper→authority service/PostgREST/SQL: repeated read500 with no admin controls; Enter after restored SELECT returns correctmember3. Intact delayed A200 cannot overwrite Bguest1. UI GuestB→member saved; withdrawn actor members.manage→role403 with canonical message and unchanged SQL; restore→same control savesguest. Existing EditTasks checkbox persisted false then true. MemberA manager save200 held after SQL commit; close/openB; release old mutation200 leaves B panel open/guest/editable, reopenA recovers savedmanager. Later manager→member saved during read-table denial, existing Home access error/reload recovers after restoration. That post-save check uses the parent access guard; no broader command-idempotency claim.
- Validation: final typecheck0 errors, scoped ESLint0 errors/1 ref-cleanup warning, diffcheck clean. Required CI includes existing regressions. Native/hosted/account-switch, access-expiry and ownership-transfer flows are not newly accepted; guards on those existing completion callbacks share the repaired lifetime, with original policies/controls unchanged. Synthetic sign-in/dashboard aggregate and SQL-projected roster, controlled delay; actual permission/mutation handlers/database.
- Cleanup: original HomeRolePermission SELECT restored; original12 fixture table/object counts0 plus extra2User/2auth.users deleted and counted0. Exact Home/actor overrides cleaned with fixture. API18142 stopped; Next18141/own5containers retained for next Home scope, no native slot or peer resources changed. Fault holds released. Browser tab retained for continuation.
- Durable source/evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-member-r1/`,14 files plus manifest, binds exact component, baseline/comparison, real requests, held mutation/live socket, validation and cleanup. Credentials excluded from Git/chat.

**Handoff frozen for coordinator capture/publication.** Continue independent next Home source reconciliation while PR104 source remains fixed for CI; widerD05/D07 and all broader backlog remain incomplete. Coordinator integrates/releases PRs, not Stream2.

## September 21 D07 audit milestone — reviewable handoff

**Current: candidate published, required CI running; stream incomplete and continuing.** `codex/workstream-home` / `50289db7e0ca44f3effb575f717fa479e599f4c5`, [draft PR102](https://github.com/WangPantopus/skinny-pantopus/pull/102). Sole changed application path: `frontend/apps/web/src/components/home/members/MembersSecurityTab.tsx` (46 additions/9 deletions). [Exact-head CI35570755239](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35570755239) in progress; no current green claim.

- Baseline actual UI→SDK→homeIam/current permission helper→PostgREST/SQL rendered20of23 owned audit records. Denying table SELECT made the route500; UI cleared known records and claimed no matching events, retaining stale Load More without error/retry. Six current/master/paid/staging/place/archive source comparisons have the same silent catch.
- Existing component now reuses ErrorState/failureMessage for explicit retry, retains known rows on transient failure, retries the failed pagination offset, and clears history on401/403. Requests are retired across close/Home/current-management-access/unmount/newer read. No new application file/schema/backend/design/unit tests; role controls unchanged.
- Actual browser checks: cold/repeated SQL denial500; Enter retry200→20rows; second-page failure retains20, retry yields23/no duplicate/no extra Load More; unchanged Membership/Secret Reveals filters; genuinely empty200 has no error. Owned members.manage deny→real403 clears all history; restoration/retry recovers20. Held actual offset20 success200/3rows delivered on a live socket after close/reopen→newer offset0 denial403 cannot restore old data. Same-URL hold attempt serialized and is excluded from out-of-order proof.
- Web typecheck0 errors, scoped ESLint0 errors/8 warnings, diffcheck clean. Required CI runs existing regression/build gates. Accepted PR60 contracts and unaffected Home journeys are reused, not rerun.
- Limits: synthetic sign-in, unrelated dashboard aggregate and seeded audit records; actual route/permission/PostgREST/SQL. Controlled response delay. Native/hosted/account-switch and wider D07 role-control boundaries are not accepted by this check.
- Exact cleanup all12 row/object counts0; HomeAuditLog SELECT restored, exact members.manage override removed, private bucket removed. API18142 stopped; Next18141 and owned5containers retained for the next granted Home slice, no active fault, no native slot. Peer resources unchanged.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-audit-r1/` contains14 files plus manifest, source hashes, baseline/candidate/HTTP receipts, transport bound, validation and exact cleanup. No credentials/raw device tokens archived in Git/chat.

**Author handoff ready for coordinator review/publication;** next independent work is existing member-role/permissions source and runtime verification while this commit remains fixed for CI. No merge/backlog closure by Stream2.

## September 21 resumed verification — D07 Members and Security

**Current state: verification; stream incomplete.** Required worktree is clean on `codex/workstream-home`, fast-forwarded from3dc226983 to master0f6e55e01 after independently checking PR60 merged, later master source and open PRs. PR60 Home source is unchanged; accepted browser/SQL/Storage evidence is reused. Latest live handoff/backlog/README and all3stream status reconciled; historical statuses below are source-bound snapshots.

Coordinator grants existing18141/18142/64550–59 and D05/D07 fallback. Native capability inventory showed no booted iOS devices; CUA lists Simulator but rejects its app binding with Invalid app, unchanged from the recorded unavailable control. No build/boot/install/system reset attempted; sole heavy native slot released and coordinator acknowledged. Native M02/Emergency remains unverified.

Next bounded journey: existing dashboard MembersSecurityTab audit-log read/error/retry and member-role controls, real homeIam routes and canonical permissions/SQL. Source lead: audit loader catches errors as empty entries with no retry; verify actual browser before repair. Reuse existing guest fixture and real permissions/PostgREST adapter; synthetic sign-in/dashboard scaffold remains labelled. No application edits yet, no new unit tests, no shared-file/schema grant requested. Product QR/shutoff decisions remain untouched. Continue further unresolved Home slices after each reviewable milestone.

## September 20 integration handoff — master safety changes

**Current state: merged by coordinator; combined-head CI green.** This snapshot supersedes the earlier current-state paragraphs below. Branch `codex/workstream-home` is clean and pushed at **`3dc226983260311a4e4e123d89c4e7fc6a55f38c`**, merging fresh master `2d6ff2069` into accepted Home candidate `66f834cc7`. [PR60](https://github.com/WangPantopus/skinny-pantopus/pull/60) was merged by the coordinator as `ebeea43d50f1ef35c32d2b3de7add9f958f4119d` at23:07:05UTC on September20; freshly verified through GitHub. Stream2 did not independently merge.

- **Requirement and changed paths:** coordinator requested compatibility verification with merged Stream3 safety/session handling. Clean merge adds only `frontend/apps/web/src/components/chat/ConversationView.tsx`, `frontend/apps/web/src/lib/query-provider.tsx`, `frontend/packages/api/src/client.ts`, and `frontend/packages/api/src/endpoints/auth.ts`. No new Home repair, file, unit test, migration, content or appearance change. Home callers/readers/routes/services and migration remain identical to66f834cc7.
- **Focused actual browser acceptance:** existing ShareCenter WiFi form issued a real saved2h pass; holding only its201 reply, closing it and opening a Vendor draft left Create enabled. Releasing the old reply preserved the new draft. Vendor then issued its own8h/3-section link. Both saved passes appeared in issuer list, with no duplicate; SQL showed WiFi2h/count0 and Vendor8h/count1 after opening its displayed guest URL. Public reader showed the expected Vendor parking/entry/emergency content. Existing UI Revoke persisted revoked_at and public reload displayed Access Revoked. A synthetic list503 displayed its explicit error; removing the fault and clicking Retry recovered the actual saved list.
- **Reused evidence:** prior19-case HTTP/service/SQL/PostgREST/local Storage, passcode/quota/time/legacy checks, saved-result metadata, Emergency and document acceptance retain their recorded unchanged-source limits. Stream3's merged real-cookie account-change/held401/refresh acceptance is reused; this Home check does not independently establish those account-switch cases. No redundant broad suite or new unit tests were written.
- **Combined CI:** [CI35543397030](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35543397030), exact head3dc226983, completed SUCCESS:8 applicable checks pass/3 native-seeder path skips. Includes production web build, existing web tests/lint/typecheck, backend/privacy gates, browser Identity Firewall, Docker, migration safeguards and full database replay. Diff whitespace clean.
- **Acceptance disposition:** no reproduced compatibility failure or unresolved acceptance gap blocking this bounded browser repair was found. Synthetic fixture identity/dashboard reads, deliberate response delay/list503 and local provider boundary remain explicit. Installed native M02/Emergency, hosted services, broader D08 account scenarios, exact clipboard readback, placeholder WiFi QR and the web shutoff-category product decision remain broader backlog limits; do not claim native/hosted or full M02/D08 acceptance. Web shutoff creation remains disabled; no design decision was implemented.
- **Cleanup and shared effects:** exact owned files/homes/tasks/users/views/audits/grants/passes/receipts/documents/emergencies/objects all0; private Storage bucket removed by existing cleanup. API18142/Next18141 stopped, all5 own r1 containers stopped and preserved,18141/18142/64551/64552 have no listeners. Both new browser tabs closed, no peer resources/caches/cookies or native slot touched. Only this live02 status changed; coordinator publishes shared docs and decides PR integration/backlog disposition.

**Handoff frozen for coordinator publication.** Coordinator accepted the combined source/browser/CI evidence and merged PR60. Next action: publish this snapshot and select the next bounded Home acceptance slice while preserving all broader limits above.

**Current state: ready for coordinator review — final-head CI green.** Restored the missing assigned worktree at `/private/tmp/pantopus-workstream-home` from its preserved Git index (no staged delta), on `codex/workstream-home`. Adopted later commit `e84b085b7`, including the already-granted Emergency migration `20260916011000` and review corrections; PR60 remains draft and its exact-head CI35166437240 passed all eight applicable jobs. The older migration-request and extra-chip-row notes below are historical: the migration exists and the unapproved chip row was removed. Master integration is documentation-only. No new unit tests planned.

**Released runtime grant:** coordinator acknowledged SQL64552/API64551 (64550–64559), web18141/API18142. Existing `pantopus-stream2-guest-r1` containers were adopted at ledger55, fixture rows/objects cleaned to zero, then all five owned containers stopped (preserved, not removed). Browser uses isolated origin `http://[::1]:18141`; no peer cookies/resources or native builds. Browser M02 milestone is verified within the limits below; final candidate `66f834cc7b6325c27a32634020523a1b6dc7b3d0` pushed to draft PR60. Next: current-head CI/coordinator review, then select the next bounded Home slice; installed native guest/Emergency and broader D08 account/hosted boundaries remain open.

**New reproduced failure (September 20):** the real ShareCenter → CreateGuestPass UI submitted a WiFi pass over the real API/service/SQL; with only the 201 HTTP response held, closing and reopening as Vendor retained `Creating...`. Releasing the old response replaced the new Vendor draft with the old WiFi token while claiming Vendor / 8h / 3 sections (SQL held WiFi / 2h / 1 section). Candidate: existing `CreateGuestPass.tsx` and `ShareCenter.tsx` only, reuse existing generation/ref convention; no new application file/schema/screen or unit tests. Current full HTTP/SQL/Storage harness19/19; browser creation/passcode/refusal/revocation confirmed with SQL view_count0→1 and create/revoke audits. Clipboard cannot be verified in current IAB; displayed link navigation works.

## September 20 milestone — resumed work adoption and stale guest-pass creation

- **Branch/SHA:** `codex/workstream-home` / `0f663dc32fe83b6120be2d75519e266e02be25ee`, [PR60](https://github.com/WangPantopus/skinny-pantopus/pull/60), clean tracked worktree. Master `38f00dcc8` integrated as `24ae11d1b`, documentation only. Adopted all three prior application commits `28bad0d3d`, `6882ba29a`, `e84b085b7`. The branch and preserved index agreed before restoration; no staged work was discarded. Owner checkout/unrelated untracked work untouched.
- **Changed paths:** existing `frontend/apps/web/src/components/home/share/CreateGuestPass.tsx` and `ShareCenter.tsx`. No new app file, screen, service, migration, layout, styling or unit test. Existing form history/open branches were compared; paid branch has no delta in this form. Its current React state and the adjacent generation-ref convention suffice for repair.
- **Baseline:** real WiFi create persisted a 2h/1-section pass; only its HTTP201 was delayed. Close pending panel → open Vendor → type a new title: button stayed Creating. Releasing the response replaced that draft with old WiFi token while summary claimed Vendor/8h/3 sections. This was an actual UI→SDK→router→service→SQL write with synthetic transport delay, not a mocked response body.
- **Repair:** generation and pending guard per panel/Home opening; retired results/errors cannot update a new form; a dismissed but successfully saved pass refreshes its issuer list without closing a newer draft. Result kind/duration/section count/quota come from the saved pass; passcode comes from the submitted value, not later edits.
- **New browser proof:** identical close/reopen/delay sequence now leaves Vendor draft and enabled Create intact; old saved WiFi appears in active list; Vendor then saves its own8h/3-section pass. Separate held create with later edits to duration2→8, sections1→2, quota1→5 and passcode still confirms saved2h/1section/quota1/original passcode. SQL matched each saved record. Invalid quota−1 produced HTTP400 with API explanation, no success and count0; corrected form saved normally.
- **M02 browser checks:** actual dashboard Share tab issue → displayed local guest URL → wrong passcode refusal (SQL view_count0) → correct unlock (count1) → UI revoke → SQL revoked_at/create+revoke audits → public Access Revoked. One-view pass opens once then View Limit Reached without Retry. Scheduled pass → Not Active Yet with Retry; expired → Link Expired; legacy → Link Needs Replacing;128-character passcode field/unlock works. Issuer list reports scheduled with Revoke, current view counts/last viewed and past passes. Synthetic list503 renders explicit error instead of empty list; Retry restores real list. No new defect found in these unchanged accepted paths.
- **Adopted SQL/Storage proof:** reran existing `test-home-guest-pass-http.cjs --container supabase_db_pantopus-stream2-guest-r1 --api http://127.0.0.1:64551`:19/19 including scoped lifecycle, all six native Emergency types, actual document upload/download/receipt/revocation and zero cleanup. Existing 55-migration ledger/constraint verified before run; no replay/reset or migration applied. Prior detailed scoped/Emergency/document browser evidence remains source-bound and was not redundantly repeated.
- **Regressions:** existing `homeSharingLinks.test.tsx`20/20; web typecheck gate0 errors at0 baseline; scoped ESLint0 errors (existing any/ref-cleanup warning categories); `git diff --check` clean. No new unit tests. Earlier PR60 exact-head CI35166437240 is green on `e84b085b7`; it is not final-head evidence. [PR CI35541130110](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35541130110) passed all8 applicable checks/3 native-seeder path skips on0f663dc32. The automatic run arrived late; duplicate manually dispatched35541118755 was cancelled to avoid redundant jobs.
- **Limits:** fixture identity/rate limits and unrelated dashboard reads synthetic, actual share router/service/SQL and local PostgREST/Storage; no hosted provider or installed native acceptance. IAB clipboard action did not produce a readable copied URL, so current copying is unverified; prior accepted copied-link evidence is retained and displayed URL navigation was tested directly. Existing WiFi Quick Connect placeholder remains unimplemented pending the recorded presentation decision. Web Shutoffs create remains disabled pending subtype decision; granted native category migration already exists and real route/SQL saves all six. No broad M02/D08 closure.
- **Shared/integration effects:** only existing share component callback is additive; no SDK/backend/schema/native change in this follow-up, no paid/Stream3 overlap. Coordinator alone reviews/merges and publishes shared status.
- **Cleanup:** browser/API stopped; exact fixture count `{files,homes,tasks,users,views,audits,grants,passes,receipts,documents,emergencies,objects}` all0; private Storage bucket removed by existing cleanup. Five own r1 containers stopped, retained for reuse; ports18141/18142/64551/64552 free. Peer/retained containers remain running. Native slot never acquired. Only private ignored runtime/evidence/dependency links remain in assigned worktree; root link created this turn removed; no raw logs/credentials committed. Browser origin was IPv6 `http://[::1]:18141` (macOS refused127.0.0.2); peer cookies untouched.

## Previous milestone snapshot
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


## Current bounded follow-up — document-card sharing origin

Coordinator reacquired same SQL64552/API64551 and web[::1]:18141/API18142 for Stream2 on September20. Existing r1 containers restarted, not duplicated. Candidate existing DocsCard.handleShare uses `document`/`read` where service/SQL contract expects `HomeDocument`/`view`; verify actual Documents card before editing. No schema/native scope extension. PR60 head0f663dc32 preserved while baseline runs. Local fixture now loads real homeDocumentAccess utility for the existing document-list route; authentication and unrelated dashboard aggregate remain synthetic.

**Reproduced baseline:** uploaded owned text document through real POST `/documents/upload` (201), actual GET `/documents` rendered it in dashboard Documents card. Clicking existing Create share link POSTed `{resource_type:document,permission_scope:read}` and got400 `SHARE_INVALID`; generic toast hid API reason; SQL HomeScopedGrant count0. Existing source/history/open paid branch compared: DocsCard unchanged since import and no competing repair. Reuse canonical HomeDocument/view contract and existing SDK/helper; no replacement screen/service/schema needed. Coordinator notified before changing PR scope.


### Document-card sharing repair — September20

- **Branch/head:** `codex/workstream-home` / `66f834cc7b6325c27a32634020523a1b6dc7b3d0`, draft PR60. Its predecessor0f663dc32 has green CI35541130110; this caller-only commit now passes [CI35541676278](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35541676278):8 applicable checks successful,3 native/seeder path skips, including production web build and full database replay.
- **Path:** existing `frontend/apps/web/src/components/home/cards/DocsCard.tsx`,5 additions/5 deletions. Sends canonical `HomeDocument`/`view`, uses the SDK returned token directly with encoding, and existing `failureMessage` so plain-object API rejections retain their safe message. No new file/unit test/backend/schema/layout/native change.
- **Baseline and reuse:** actual uploaded document reached actual GET `/documents` and dashboard card. Existing share icon returned400 SHARE_INVALID, no grant, with `document`/`read`. Canonical SQL migration20260910040000 and existing19-check HTTP harness already establish HomeDocument/view and exact file/receipt/authority contracts. No paid-branch/archived replacement needed; original caller repaired in place.
- **New end-to-end:** same icon now POSTs HomeDocument/view→201; SQL one grant bound to uploaded document with can_edit=false and view_count0. UI reports copied (IAB clipboard bridge reads empty, so exact clipboard bytes remain unverified). Opening the returned local public link renders exact title and TXT label. Standard target-blank clicks did not send a download in IAB; supported browser locator downloadMedia on the displayed Download link did send the real request,200 text/plain and31 bytes whose SHA256 matched the uploaded fixture. API DELETE of that exact grant→200; reloading public page→Access Revoked. Revocation was API-driven because this card has no grant-management UI.
- **Error boundary:** deny docs.view through the owned fixture override while existing card remains mounted; click sends actual request→403 SHARE_RESOURCE_DENIED, UI displays “The shared content is no longer available.”, grant count stays1 (the revoked original). Overrides restored. Final SQL one grant/one revoked/one view before cleanup.
- **Verification:** web typecheck0 errors, scoped ESLint0 errors/4 pre-existing any warnings, diff whitespace clean. Earlier20 sharing regressions/full current-base CI retained; no unit tests added/repeated for this two-value caller repair.
- **Limits:** browser clipboard bridge and ordinary target-blank download behavior remain labelled IAB boundaries; supported browser download action is byte-exact evidence. Synthetic identity/dashboard aggregate; actual list/upload/share/service/SQL/local Storage. Hosted and installed-native boundaries open.
- **Cleanup:** exact rows/files/receipts/objects all0 again, private bucket removed by existing fixture cleanup; API18142/Next18141 stopped, own5 r1 containers stopped and preserved; no native slot. Two newly created tabs closed; no peer resource/cache/cookie edits. Temporary lint fallback symlink removed; app worktree tracked clean.

**Final handoff:** PR60 remains draft/open/mergeable at66f834cc7b6325c27a32634020523a1b6dc7b3d0; CI35541676278 fully green. Author update complete and ready for coordinator publication. No merge, deployment, shared backlog closure, provider activation or native installation performed. Runtime released again and fixture cleanup0. Next bounded work remains installed native M02/Emergency and wider D08 account/hosted acceptance, subject to runtime/tool availability; do not repeat accepted browser/backend checks without a relevant change or concrete risk.
