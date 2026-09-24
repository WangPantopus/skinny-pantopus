# Pantopus handoff: end of coordinator session `92cc4526`

**Written:** 2026-09-23, about 20:50 UTC.
**Status:** all work is PAUSED at a clean point.
**Master:** `1a15514cc` (WangPantopus/skinny-pantopus).
**This file's home:** hub repo `/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`.

This document is for whoever takes over: a person or a new Claude session. It records what was done, so nothing gets redone, where every artifact is, what's left in priority order, and exactly how to operate. If this file and an older note disagree, this file wins, except where the founder says otherwise.

**Read in this order (about 20 minutes):**
1. This file, all of it.
2. `coordinator-state-2026-09-23/COORDINATOR-RESUME.md`: the exact paused state and restart commands.
3. The four stream checkpoints in `coordinator-state-2026-09-23/checkpoints/`: per-stream detail, pushed refs and next steps.
4. `README.md` (this folder), the resume blocks at 15:00, 17:00 and 19:30 UTC. They hold the full wording of every decision, founder question and data action.
5. `HANDOFF-2026-09-23-FINAL-merged-prs.md`: the list of all 187 PRs merged today. Check it before fixing anything.
6. The repo's `AGENTS.md` and `docs/PROJECT_HANDOFF.md`: binding project rules and the long-running handoff.

---

## 1. The state in one screen

| | |
|---|---|
| **master** | `1a15514cc` |
| **PRs merged on 2026-09-23** | **187**: serial merges before 14:54, then combined batches #353 (36 PRs), #374 (34 PRs plus #385) and #387 (20 PRs) |
| **Open PRs** | 4: #325, #356, #388, #389. All are reviewed; they form **batch 4**. #325 still needs Stream 2's iOS re-check. |
| **Unpublished work** | 25 pushed branches with no PR yet. See §5.2. Every one is on origin. |
| **Agents** | 4 background agents, all paused with checkpoints written (§5.3) |
| **Acceptance backlog** | `docs/REMAINING_WORK_2026-09-11.md`: **13 closed / 67 partial**. P03, P04, P05 and P08 closed on 2026-09-23. |
| **UX inventory** (155 items) | 62 fixed and merged; 2 in open PRs (C-15 in #356, S1-21 in #389); 31 in unpublished branches; about 60 not started (§6.3) |
| **Trust-claims sweep** (about 55 claims) | Most person, business and chat claims are fixed and merged. The rest are in branches (§6.4). |
| **Running processes** | None of ours except the agents' local DB stacks and Stream 2's backend and proxy (§5.4). The merge runner and watcher are stopped. |

---

## 2. Standing directions and hard rules (binding)

### 2.1 Founder direction (2026-09-23; supersedes older "preserve designs" gating for UX)
> "Keep working on all 3 workstreams until all features, functions, workflows within the app are verified, tested with all cases … errors are handled properly, with great best user experience … when you work on every single feature, function, flow, please think carefully whether the user experience is good enough or not. if not, fullfil it. We do not care about unit test … all we need is to launch the apps in iOS, Android, simulator and emulator, web app, test everything end to end, and fix anything you find. … please merge whenever you think they are ready."

- **UX improvements need no founder approval.** Stay inside the existing design system.
- **Escalate to the coordinator:**
  - money-movement design;
  - security or permission policy;
  - legal and retention questions;
  - block and privacy concealment;
  - new tables;
  - large new features.

  The coordinator decides and records it; the founder can override.
- **No new unit tests.** Update an existing test only when a change deliberately alters what it asserts, because CI must stay green.
- **Evidence** means a real app (simulator, emulator or browser) against a real backend, with before and after. Mocked checks or green CI alone are not end-to-end proof.

### 2.2 Hard limits
- **Search-filter security audit: DO NOT resume it.** Don't reproduce, probe or write up the free-text search filter-injection issue, and don't craft payloads. PR #255, which applies `escapeIlike()` at 8 call sites, is the whole fix; the founder handles the rest. Fixing unrelated bugs in the same files (for example the FK embed in #386) is fine, verified through normal UI or API use only.
- **Founder's live environment: never touch it.** That's Docker stack `pantopus-home-gig-replay` (Kong 64521 / DB 64522), backend `:8000` (from `/private/tmp/pantopus-workstream-home`), and iOS simulator `EB5AD759`.
- **Android builds** must set `PANTOPUS_API_BASE_URL` and `PANTOPUS_SOCKET_URL` to your own port. Check the APK dex for your port and for no `:8000`.
- **Stripe:** TEST only (`sk_test_`, `livemode:false`).
- **Secrets:** no credentials, tokens, device tokens, DB archives or raw operator logs in Git, PR text or chat.
- **Git stash** is shared by all worktrees. Never run a bare `git stash`; use WIP commits.
- **Never modify the founder's main checkout** (`/Users/yingpengwang/skinny-pantopus`). The one exception: the coordinator paused git auto-maintenance in its `.git/config` during the disk incident (§4.6).
- **Timestamps** come from `date -u` and **SHAs** from `git rev-parse` / `ls-remote`. Never estimate or hand-type either. If one is wrong, correct it openly with a `corrections` entry.
- **AGENTS.md rules still apply:**
  - verify existing work before changing it;
  - make the smallest repair in the existing implementation;
  - add no parallel tables;
  - never rewrite applied migrations;
  - a new migration must sort after master's newest and include `SET LOCAL lock_timeout='5s';`.

---

## 3. Where everything lives

| What | Where |
|---|---|
| Product repo | GitHub `WangPantopus/skinny-pantopus`. The founder's checkout is `/Users/yingpengwang/skinny-pantopus`; don't modify it. |
| Coordinator worktree | `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380`, branch `work-255`. It has one intentional uncommitted change: `.claude/launch.json` adds a `web-coord-api-down` config. Don't commit it. |
| Hub, the single live coordination location | `/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination` (pushed). Folder `docs/workstreams/`. |
| Evidence store (new bundles) | `…/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`, gitignored, about 151 bundles today. **Copy them to `skinny-pantopus/.pantopus-recovery/audits/` before the worktree is removed.** The legacy store in the main checkout is read-only, because a hook blocks writes. |
| Agent checkpoints | `…/pantopus-stream-2-home-3ef380/.pantopus-recovery/checkpoints/`, copied into the hub at `coordinator-state-2026-09-23/checkpoints/`, with each stream's helper scripts |
| Coordinator tools | Normally `/private/tmp/pantopus-tools/`, which is wiped on reboot. A durable copy is in the hub at `coordinator-state-2026-09-23/tools/`. |
| Batch scripts and lists | `coordinator-state-2026-09-23/scratchpad/` in the hub |
| Plans and inventories | `tools/ux-inventory-2026-09-23.md` (155 items), `tools/trust-claims-2026-09-23.md`, `tools/AGENT-RULES-2026-09-23.md`, `tools/fee-review-253-2026-09-23.md`, `tools/ios-double-back-inventory.md` |
| Claude memory | `~/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/`. Index in `MEMORY.md`. Key files: `coordinator-handoff-2026-09-23.md`, `founder-direction-ux-e2e-2026-09-23.md`, `pantopus-ci-capacity-merge-batches.md`, `pantopus-disk-git-maintenance-loop.md`, the runtime recipes (`pantopus-native-e2e-runtime-2026-09-22.md`, `stream2-*`, `pantopus-disposable-full-schema-project.md`) and `pantopus-founder-live-environment.md`. |
| Stream worktrees | `/private/tmp/pantopus-*`. **Wiped on reboot.** Everything important is pushed, and each checkpoint says how to recreate them. |

---

## 4. What was done this session (don't redo)

### 4.1 Start-of-session handoff tasks: all done
- **P04/P05 poster-fault fee:**
  - #253 (backend plus migration `20260923000100`) and #254 (fee line on web, iOS and Android) merged after two independent reviews.
  - Review issues fixed: capture/record race, refunds gap, reports before the scheduled start, stuck reservations, sub-50¢ fees waived with `FEE_BELOW_MINIMUM`, wrong spending totals, replay parking.
  - Verified with Stripe TEST. Bundles r1 (MANIFEST `18db9ac4…`) and r2 (`57092fbf…`).
- **#255:** `escapeIlike()` applied as a plain defensive edit.
- **#251/#252:** queued and merged.

### 4.2 Merges: 187 PRs on 2026-09-23 (full list in the appendix)
- **Serial exact-head merges until 14:54 UTC**, for example #241–#328 and #289–#318.
- **Batch 1 (#353)**, 36 PRs, merged 16:51 as `f02dd4bd1`.
- **Batch 2 (#374)**, 34 PRs plus #385, merged 19:22 as `9779bf9d3`. The coordinator added two commits:
  - `aa1297ffd` splits helpers into `HubViewModel+Formatting.swift`, because #304 and #333 together broke SwiftLint `file_length`;
  - #385 is the CI registry fallback.
- **Batch 3 (#387)**, 20 PRs, merged 20:07 as `1a15514cc`. CI was fully green.

### 4.3 Main outcomes, by theme (PR numbers are merged unless marked)
- **Money and payments:**
  - P04/P05 fee (#253/#254).
  - Tips parity (#312).
  - **Price-change orders are refused on every task** until settlement is designed: #269 interim, #366 backend all-task, #377 clients.
  - Earn shows the real wallet, and offer money isn't cashable (#346).
  - The API no longer echoes raw DB errors on offer and completion routes (#389, **open**).
  - Coupon order route disabled with a 501 (#328).
- **Security and privacy:**
  - **Mail "Verified business" spoof fixed (#368):** the sender business is resolved server-side through `mail.send` IAM, and `verified_business` is set only for document- or government-verified businesses. Web compose now has a "Send as" picker (#370).
  - Record photos are in private storage with signed URLs (#347).
  - `home.view` is required to post from a Home (#297).
  - Task lists are block-filtered in both directions (#298).
  - Relationship block concealment (#293).
  - Account-delete guard (#271).
  - Household letters now land in the Home drawer (#363).
- **Trust and honesty** (the sweep found about 55 unbacked "verified" claims and sample data in live paths):
  - #365: seller card and Make offer.
  - #367: web fabricated business stats, "Verified host" and "Verified requester".
  - #371: business claims.
  - #372: chat claims and policy copy.
  - #373: profiles, invented verification methods, fake mutual names, View-as sample fallback.
  - #375: bid rows, "Open to offers", Tasks map copy.
  - #378: web "Verified Neighbor" follows a real badge, and the marketplace "Verified" filter is removed.
  - #383: scheduling seeded people and avatar and host checks.
  - #384: Help and Creator policy copy.
  - #348/#349/#350: Privacy cards, Delete account path, Your data rows.
  - #388: mail detail trust (**open**).
- **Fake or placeholder features switched off honestly** (501, no writes, entry points hidden):
  - mail translation (#369 backend and web; #388 native hide, **open**);
  - package-pickup tasks (#378 backend and web; native hide on an unpublished branch);
  - coupon order (#328).
- **Broken features fixed:**
  - Task `items` stored as JSON strings (#359 writers plus normalise on read; #375 Android tolerant decode).
  - Organic business matching never ran (#362).
  - Waitlist "Get notified" was dead (#358 hid it; #364 wires the real join).
  - Share-ETA never notified, and household member lookups returned [] because of an ambiguous FK embed (#386).
  - Notification deep links (#257, #279, #292).
  - Mail-task failure reasons, replay and vacation dates (#325, **open**).
  - Magic drafts decode (#339/#340/#341).
  - Android wizard chrome (#337).
  - gigs/new link (#342).
- **UX dead ends, weak errors and navigation** (dozens), for example:
  - web API error copy (#256/#311);
  - offline banner (#322);
  - iOS single Back (#329);
  - refresh keeps content (#333);
  - placeholders say what's missing (#316);
  - sign-out confirm (#338);
  - Hub pills route correctly (#314);
  - You rows (#315);
  - post-detail errors (#351);
  - web dead links (#343, #352);
  - Action queue (#360);
  - comments (#361);
  - web Mailbox failures (#369);
  - Home dead ends (#380, #381);
  - native 4xx copy (#356, **open**);
  - chat send failures (#309/#319);
  - many Stream 3 settings and notification fixes.
- **CI and infra:**
  - #385: the DB replay retries `supabase db start` from `public.ecr.aws` when ghcr.io refuses the image.

### 4.4 Acceptance backlog rows closed
P03, P04, P05 and P08 are closed with evidence. The count is **13 closed / 67 partial**. No other rows were closed. Many are launch or ops rows that need the founder.

### 4.5 Coordinator decisions already made (don't re-litigate; the founder may override)
- **Merges:** combined batches with exact PR heads (§8.3). Stacked PRs are retargeted to master before batching.
- **Trust rule** (all streams):
  - a UI claims "verified" only from a real server field for that entity;
  - no sample or fixture data in live paths;
  - policy copy must match what the backend enforces.
- **Price changes:** refused on every task (interim) until the founder designs settlement.
- **Fake features:** switch off honestly with a 501, no writes and hidden entry points, rather than fake success. This applies to coupon, translation and package gigs.
- **Quick-post "Free"** becomes "Open to offers", because the backend has only fixed, hourly and offers. Offers-priced tasks read "Open to offers" everywhere.
- **Items double-encoding:** fix the writers and normalise on read, with no data migration.
- **Discover People tab:** hidden, because correcting its filter would expose every member.
- **Native privacy cards** that never saved are hidden (S3-29).
- **Support email:** `support@pantopus.com`. `pantopus.app` has no MX record.
- **Mail sender trust:** only from `sender_trust`, which #368 makes trustworthy.
- **Share-ETA notices** are labelled as the sharing member.
- **`routeMail`'s resident step** stays dormant.
- **Chat's LocalProfile lookup** (a nonexistent column) stays failing closed; it's a founder question.
- **The profile avatar "check"** from `User.verified` (email-confirmed) is removed everywhere, including the You header (branch).
- **Listing accept** holds the listing as `pending_pickup` (not the invalid 'reserved'), with checked writes and reverse transitions.
- **S1-05:** the "Alert me when similar appears" callout is removed.
- **Home Security:** hide every toggle that no client or server enforces. Only `address_precision` is enforced server-side; check on-device enforcement per toggle. The native Trusted neighbors entry is hidden.
- **Support-train wizard no-match:** honest copy, no sample contacts, CTA "Continue".
- **The web marketplace "Verified" filter** (based on `is_address_attached`) is removed.
- **Native Business scheduling** must use a business the user manages, and hide the Business option when there is none.
- **CI grouping rule:** group related native fixes into one PR (2–4 items), because macOS CI capacity is scarce. Web and backend PRs stay small.

### 4.6 Incidents and infrastructure changes (know these)
- **GitHub GraphQL budget exhausted (14:55).** The old watcher polled about 85 PRs a minute. It was replaced by the REST-only `ci-watch2.sh`. Agents must not use `gh pr checks --watch`.
- **Disk full (about 16:50).** `git maintenance run --auto` kept repacking the shared 24 GiB object store and leaving 1 GiB `tmp_pack_*` files.
  - Auto-maintenance is **PAUSED**: `git -C /Users/yingpengwang/skinny-pantopus config maintenance.auto false` and `gc.auto 0`.
  - To revert, once 40 GiB or more is free and agents are idle: run `git -C /Users/yingpengwang/skinny-pantopus maintenance run --task=gc`, then `git config --unset maintenance.auto` and `git config --unset gc.auto`.
- **Memory thrash (about 18:35).** Load was about 430 and swap full.
  - `heavy-slot.sh` and `device-slot.sh` now wait while the kernel memory-pressure level is critical, or warning with load above 150.
  - macOS **ControlCenter** leaked about 11 GB. Restarting it with `killall ControlCenter` is the founder's call.
- **ghcr.io outage (from about 17:54)** during a GitHub incident: every DB replay failed. #385's fallback fixes new runs.
- **Gradle cross-kill.** `./gradlew --stop` stops every stream's daemons. Run it only BEFORE releasing the heavy slot.
- **Merge runner:** the deadline is 4 hours, and a failed CI OK now keeps the PR queued (logged once) instead of dropping it.

---

## 5. Exact current state

### 5.1 Open PRs = batch 4 (all reviewed)
| PR | Head | Owner | Content | Before batching |
|---|---|---|---|---|
| #356 | `4713fbf1c` | Shared UX | Native plain copy for unreadable 4xx bodies (C-15); master merged in | Confirm CI OK, or a DB-only failure |
| #388 | `9acfcebf8` | Stream 2 | Native mail detail trust from stored trust; Translate hidden; sender card inset; avatar check only when verified | Confirm CI |
| #389 | `f1ed18fc1` | Stream 1 | Offer and completion routes stop echoing raw DB errors (S1-21) | Confirm CI |
| #325 | `cce809b57` | Stream 2 | Mail-task failure reasons, owner replay, vacation dates; master merged in | **Stream 2 must first finish the iOS re-check of its 3 sections** |

### 5.2 Unpublished branches: pushed to origin, no PR yet (details in each checkpoint)
- **Stream 1**
  - `claude/stream1-listing-pending-pickup` `7c64c682b8`: backend `pending_pickup` hold, native "Pickup pending" and S1-05. It was stacked on #365, which is now merged; open it against master. **Needs:** Android and iOS afters.
  - `claude/stream1-native-package-gig-hidden` `024980c8b2`: native hide of the package-task entries. **Needs:** afters.
  - `claude/stream1-native-listing-offers-actions` `9c3c15c78f`: S1-04 "Message buyer", S1-20 confirms and failure toasts, and the fix for iOS "Send counter" never sending. **Needs:** S1-17 added (fixed NYC coordinates → explicit, then viewing location, then device), then afters.
  - Web branches, code only; verify them all in ONE Next session:
    - `claude/stream1-web-map-new-listing` `9a88899bc5`: S1-03, S1-10;
    - `-web-tasks-browse` `b62c217538`: S1-11, S1-15;
    - `-web-gig-detail` `874881aec7`: S1-12 gig, S1-18;
    - `-web-gigs-v2-chat` `ed8fd6f4d8`: S1-16 and the decline confirm;
    - `-web-listing-detail` `141c35ffbc`: S1-14, S1-24, S1-23, S1-12 listing.
  - Backups: `wip/stream1/verify-18`, `wip/stream1/harness-r21`, `wip/stream1/acctdel-next-tsconfig`.
- **Stream 2**
  - `wip/stream2/home-trust-claims` `759be809c`, the Home group:
    - Hub pill "N neighbors";
    - Security toggles hidden plus the sample footer "14 Elm Park Lane" removed;
    - Trusted neighbors hidden;
    - "N reached" counts removed;
    - web Travel Mode note and vacation/travel auto-gig hidden;
    - Community `neighborCount={47}`;
    - S2-14.

    **Needs:** build and afters on web, iOS and Android.
  - `wip/stream2/native-place-home` `0623d89d0`: S2-21, S2-15, native S2-05. **Needs:** build, befores and afters.
  - `wip/stream2/vacation-hold-dates` `65bc96a97`: probably superseded by #325; verify, then discard.
- **Stream 3**
  - `claude/stream3-native-business-geo-decode` `a9f8be769`, **BLOCKING**:
    - The bug: native business profiles fail for any business with a location. The backend sends `latitude`/`longitude`; the apps required `lat`/`lng`.
    - iOS is verified.
    - **Needs:** Android build via `run-geo2.sh`, the Android after, deleting fixture BusinessLocation `980f6eb3`, sealing, and opening the PR.
  - `claude/stream3-native-scheduling-you-owner` `e7d72161a`: hub Business pill uses a real managed business; live preview shows real times; time-zone copy fixed. It was stacked on #383 (now merged). **Still to add:**
    - merge master;
    - member hub (a 403 on manage-only reads must not fail the whole hub);
    - Me Business context;
    - You header "Verified" only from residency.

    Then build and afters.
  - `wip/stream3/accounts-social-publicshare-nostore` `3d39029b5`: old uncommitted web work of unclear purpose. **Review it before using.**
- **Shared UX** (five grouped native branches, rebased on `9779bf9d3`; all need builds and afters on both apps):
  - `claude/shared-ux-native-hub` `90bae96a0`: People tab hidden (native), C-12, C-35, C-03. Passed on both apps before the rebase.
  - `claude/shared-ux-support-train-host-actions` `ebaf4ad5e`:
    - C-07, C-08, C-09, C-16;
    - wizard trust claims and honest no-match;
    - three wizard fixes found on device, not yet re-verified;
    - Manage "Invite more helpers" copy.

    Android Paparazzi re-record needed.
  - `claude/shared-ux-native-posts` `7a7d22139`: C-17, C-18, C-32, the Pulse badge, and the **Pulse viewing-area fix** (WIP top commit; the Nearby feed ignored the chosen area). **First:** add `chosenArea: { nil }` to the iOS Pulse test factory.
  - `claude/shared-ux-native-you-settings` `ffb41619f`: C-21 (Android recompose fix not re-verified), C-37.
  - `claude/shared-ux-native-shells` `32f1527eb`: C-29, C-33. **Add:** decode URL-encoded Android placeholder titles.
  - Backups: `wip/shared-ux/integration-1..4`. `claude/shared-ux-discover-hide-people` is superseded.

### 5.3 Agents (paused). Resume them or replace them with the checkpoints.
| Agent id (session 92cc4526) | Stream / area | Checkpoint | First action |
|---|---|---|---|
| `acb0d4c85e4960561` | Stream 1: tasks, payments, marketplace | `checkpoints/stream1-2026-09-23.md` (+ `stream1-tools-2026-09-23/`) | Restart harness run 27. Capture Android then iOS afters for the 3 native branches (add S1-17 to PR 3) and open them. Then one web session for the 5 web branches. |
| `a9e97b30d02232f83` | Stream 2: Home, Mail | `checkpoints/stream2-2026-09-23.md` (+ `stream2-harness-2026-09-23/`) | #325 iOS re-check. Then build and capture the Home group, then the Place group. |
| `a629ea105558c0e0f` | Stream 3: accounts, identity, chat, businesses, scheduling | `checkpoints/stream3-2026-09-23.md` (+ `stream3-tools-2026-09-23/`) | Finish the geo decode PR (blocking). Then scheduling/You. Then items 6/7 (§6.2). |
| `acd48b3e1807a80a8` | Shared UX (coordinator C-items) | `checkpoints/shared-ux-2026-09-23.md` (+ `shared-ux-runtime-2026-09-23/`) | Fix the iOS Pulse test factory. Build and capture the 5 groups, then open the grouped PRs. Delete SavedPlace fixture `5f85723f-4bac-4cf3-991d-834f3d93010d` when done. |

If the session is gone, spawn one new agent per stream (§8.1) with the rules file and its checkpoint.

### 5.4 Runtime still up
- **DB stacks:**
  - `pantopus-stream1-wallet-read-r1` (Kong 64561 / DB 64562), used by Stream 1 and Shared UX;
  - `pantopus-stream2-native-r1`;
  - `pantopus-stream3-block-r1`.
- **Stream 2 backend** on 18143 and **proxy** on 18142.
- **Everything else is stopped:** harnesses, Next servers, devices, Gradle.
- **After a reboot:** the checkpoints explain how to regenerate the env files that hold secrets (they aren't copied to durable storage), for example by minting local keys as in `stream2-runtime-revival-gotchas.md`.

---

## 6. What's left, in priority order

### 6.1 P0: do first
1. **Stream 3 geo decode PR.** Business profiles are broken natively for any business with a location. Finish, publish, then batch.
2. **Batch 4:** #356, #388, #389, plus #325 once its iOS re-check passes, plus the geo PR if it's ready. Procedure in §8.3.
3. **Restart the coordinator tools:** the watcher, and the runner when a batch exists (§8.5).

### 6.2 P1: finish the unpublished branches (§5.2)
Each needs a build under the heavy slot, afters on the real apps, a sealed bundle, a PR, a review and then a batch. Keep the CI grouping rule.
- **Stream 3 items 6 and 7, after scheduling/You:**
  - Help "email verification unlocks posting, messaging…": check server enforcement; if it isn't enforced, fix the copy.
  - Hide Report for the owner of the business.
  - Identity Center "Visible only to verified connections": match what's enforced.
  - "No verified businesses nearby yet": use plain copy if the list isn't filtered by verification.
  - AI prompt "Summarize today's mail and packages": keep it only if the endpoint really reads them.
  - The endorse 403 copy.
  - "Verified recently" wording.
- **Coordinator decisions still to give** (the agents asked):
  1. Stream 2: should the unboxing and ceremonial-letter "Share" buttons share something, and if so what? Otherwise hide them with the other dead controls (S2-16).
  2. Stream 2: landlord-request notifications open nothing (S2-06). The proposed minimum is that the tap opens the Home.
  3. Stream 3: review `wip/stream3/accounts-social-publicshare-nostore`.

### 6.3 P2: UX inventory items not started (IDs from `tools/ux-inventory-2026-09-23.md`)
**Done:** 62 merged; 2 open (C-15, S1-21); 31 in unpublished branches:
- C-03, 08, 09, 16, 17, 18, 21, 29, 32, 33, 35, 37;
- S1-03, 04, 05, 10, 11, 12, 14, 15, 16, 17, 18, 20, 23, 24;
- S2-14, 15, 21.

**Not started**, grouped by owner. Keep the severity order: dead end, then misleading, then weak, then cosmetic.
- **Coordinator / Shared UX:** C-28 (a failed lookup lands the Place tab on the Hub for the rest of the session).
- **Stream 1:**
  - S1-08: business "Payments" shows the owner's personal payout account.
  - S1-09: bids panel shows "No bids yet" when the load failed (all clients).
  - S1-22: web counter-offers use browser prompts, and gigs-v2 Decline has no confirm.
  - S1-25: Android listing compose "Auto" camera button is dead, and the delivery fee is hardcoded.
- **Stream 2:**
  - S2-03: Earn dashboard help, refer, offer a service and "See all" are placeholders, and its figures are static.
  - S2-04: mail translation "Reply" and chips. It's mostly moot now that Translate is hidden; verify.
  - S2-06: landlord tenant_request notifications (needs decision 2 above).
  - S2-10: "residency request ready" opens the dashboard, not the review.
  - S2-11: dismissed mail stays in the iOS list.
  - S2-16: unboxing and ceremonial icons do nothing (needs decision 1 above).
  - S2-17: Home notification links land one level up.
  - S2-22: Android mail list: a failed load-more replaces the list, and empty drawers show a raw "→".
- **Stream 3** (the biggest block, about 49 items):
  - **Notifications and links:** S3-03 (Support Train notifications open nothing), S3-04 (more notification types open nothing), S3-05 (attendee booking notifications open a forbidden booking).
  - **Placeholders:** S3-06 (Identity Center), S3-08 (business Insights and Settings), S3-11 (Creator inbox Settings), S3-12 (audience follower rows), S3-13 (Beacon Updates and Following).
  - **Booking and scheduling:** S3-18 (host booking Rebook, Follow up and Message do nothing), S3-44 (follow-up promises a rebook link it never sends), S3-45 (manage-booking says "expired" on any error), S3-47 (event type editor shows fixed Reminders and Limits), S3-51 (scheduling entries land on "Payments coming soon"), S3-52 ("My bookings" rows and Book again / Pay do nothing), S3-64 (scheduling notification channels).
  - **Business web:** S3-22 (business page CTAs don't act), S3-23 (verification asks for a raw file ID), S3-39 (address step placeholders), S3-65 (Unpublish has no confirm).
  - **Assistant:** S3-26 (mail-summary chips do nothing).
  - **Chat:** S3-31 (filters say "No conversations yet"), S3-40 (web failed history reads "Say hello"), S3-49 (search failure says "No matches"), S3-53 (Call and New chat look live), S3-54 (message delete has no confirm and silent failures), S3-55 (a reaction reloads the whole thread), S3-56 (no pull-to-refresh).
  - **Audience and creator:** S3-33 ("coming soon" toasts), S3-34 (audience profile controls do nothing), S3-35 (Set up payments opens your own follow), S3-46 (web "Stripe Checkout coming" and "Inbox coming soon"), S3-68 (broadcast Compose opens the profile).
  - **Business editor and sharing:** S3-36 ("Claim an existing page" opens Create), S3-37 (iOS page editor controls are decoration, with a stock café banner), S3-66 (share sends only the app link).
  - **Profiles:** S3-41 (web profile and business pages say "not found" for any failure), S3-42 (profile stats show 0 or $0.00 on failure), S3-50 (iOS profile "Connect" or "Quiet" after a failed load), S3-59 (a failed business-review reply vanishes), S3-60 (Edit profile swipe discards edits), S3-61 (web profile save hides the bad field), S3-62 (endorse silently undoes).
  - **Blocks and notifications:** S3-43 (web Blocked Users never lists web blocks), S3-48 (Android notifications All/Unread race, and load-more spins forever), S3-57 (notification delete, mark-all and unblock failures are silent), S3-58 (profile block has no confirm), S3-63 (connection request opens "All", not Requests).
  - **Small dead controls:** S3-67 (Legal Share, broadcast "⋯", "Hire to review"), S3-69 (invoice Download PDF).

Each item's entry in the inventory file gives the exact file:line, how to reach it, and what the user sees.

### 6.4 Trust-claims plan status (`tools/trust-claims-2026-09-23.md`)
- **Done (merged):**
  - security spoof (#368 and #370);
  - chat (#372);
  - profiles and View-as (#373);
  - business (#371 and #306);
  - web stats, host, requester and endorsements (#367);
  - scheduling people and checks (#383);
  - policy copy (#384 and #348);
  - Stream 1 bid rows, Tasks map, seller card and web badges (#375, #365, #378);
  - share-ETA (#386).
- **Open:** #388 (mail detail).
- **In branches:** Stream 2 Home group; Stream 3 You header; Shared UX support-train wizard and Pulse badge; Stream 1 native package-gig hide.
- **Unreachable today** (founder note): the A17 mail variant layouts (certified, community, coupon, package, party…). The Mail type/mail_type CHECK constraints and absent variant payloads mean they can't render in production.
- **Founder:** the marketing copy (§7.1).

### 6.5 P3: coordinator and cross-cutting work
- **Full-app re-sweep.** After the inventory is cleared, run a fresh per-platform pass to measure what's left. Every pass today found new issues, so don't assume the app is clean.
- **Backlog rows.** Re-evaluate candidates with evidence: U05 and A05 (inventory reconciliation), N01 (notification destinations: #257, #279, #292), M04 (mail actions: #369, #378, #388), D02 (media: #380 removed the dead pickers). Close only with evidence; update `docs/REMAINING_WORK_2026-09-11.md` and the count.
- **Revert git auto-maintenance** safely (§4.6).
- **Copy the evidence store** to the main checkout's `.pantopus-recovery/audits/`, or tell the founder to.
- **Hub:** keep the README resume blocks current; the founder reads them.
- **CI capacity** (macOS about 5–6 concurrent jobs) is the throughput limit. Options for the founder: larger or self-hosted macOS runners, or a smaller PR test matrix.

---

## 7. Founder queue (decisions, data actions, questions)

The full wording and queries are in `README.md`, in the 15:00, 17:00 and 19:30 blocks.

### 7.1 Decisions needed before launch
1. **Marketing claims.** "Every helper is identity-verified and reviewed" and "…no anonymous tier" appear in `PillarsSection.tsx:9`, `HeroSection.tsx:102`, `join/[code]/page.tsx:108`, `LoginView.swift:585` and `LoginScreen.kt:783`. Neither is enforced: sign-up, posts, DMs and bids need no verification. Enforce them or change the copy. The coordinator recommends changing the copy.
2. **Price-change settlement design,** and an operator path for tasks already above $0 with no payment.
3. **Backing out of an accepted offer or trade.** No route cancels one, and refunds need a policy.

### 7.2 Data actions (read-only counts first, then approve repairs)
1. Mail rows marked `verified_business` from a typed name before #368 deployed.
2. Household letters misfiled in the personal drawer. There's a count and an UPDATE; see #363.
3. Business pages still publishing the fake default stats ("1,000+ / 5+ / 4.9"). Two queries; see #367.
4. Bogus `business-<userId>` BookingPage, EventType and Booking rows from the native Business pill.
5. Listings still `active` that have an accepted offer or trade. The query is at `audits/20260923-stream1-listing-pending-pickup-r1/evidence/founder-count-query.sql`.
6. Optional cleanups:
   - fake `MailPackage.gig_id` values;
   - cached fake translations (`Mail.translation_text/lang/cached_at`);
   - made-up `neighbors_received`.

### 7.3 Product questions
Package pickups as real tasks (address privacy, pay) · real mail translation (provider cost; L01 bundle) · a no-pay "favour" task type · a real "Verified sellers" filter · native saved-search alerts (list and delete) · a trusted-neighbors feature · which Home privacy controls to build for real · support-train phone/email invites · chat LocalProfile name/locality and chat's verification source (PRV-05) · `routeMail` semantics (it never sets `recipient_user_id`, so a letter matched to another resident becomes private to the router) · the A17 mail variant layouts (wire or remove) · the native booking landing (add `/book/<slug>`, or retire it) · neighborhood posts showing matched businesses (public posts only) · People discovery visibility rules · the web unboxing panel ("Decision 2": map package fields, or keep it hidden) · the earlier items still open: account-deletion retention, the draftBusinessReminder email, unfunded ad payouts, the landlord dispute route, native privacy fields, and Time Machine snapshot thinning.

### 7.4 Machine
Restart the leaking macOS ControlCenter (`killall ControlCenter`; about 11 GB).

---

## 8. Runbooks

### 8.1 Starting or resuming agents
- **Same session still alive:** send each agent id a message. Example: "Main: resume from your checkpoint `<path>`. Start with <first action>. Rules: `/private/tmp/pantopus-tools/AGENT-RULES-2026-09-23.md`."
- **New session:** spawn one general-purpose background agent per stream. Tell it to:
  - read `AGENTS.md`, the rules file (recreate `/private/tmp/pantopus-tools` from the hub first), its checkpoint and this handoff §5–§6;
  - report to "main" with SendMessage;
  - never merge or edit the hub;
  - follow the CI grouping rule;
  - use `heavy-slot.sh` and `device-slot.sh`;
  - run `gradlew --stop` only before releasing the heavy slot;
  - keep its one derived-data dir.
- **Load:** start agents one or two at a time. The Mac thrashes with four agents plus simulators and emulators.

### 8.2 Reviewing a PR (the coordinator's job; agents never merge)
1. **Read the body.** It needs Problem, Reproduced (on master, with a SHA), Change, Real-app verification, Evidence (bundle path plus MANIFEST sha256), and Limits.
2. **Read the diff** (`git fetch origin +refs/pull/N/head:refs/remotes/pr/N`), with extra care on:
   - money paths;
   - permissions and privacy: who can read or write, and 404 versus 403 for non-members;
   - trust claims: "verified" only from real fields;
   - sample data;
   - unchecked supabase-js `{ error }`;
   - PostgREST FK embeds (tables with two FKs to User need `!fk_name`).
3. **Check it merges** with the pending batch tip: `git merge-tree --write-tree --name-only <tip> refs/remotes/pr/N`.
4. **Record it** as pre-reviewed, and batch it when CI OK is green on that exact head.

### 8.3 Combined merge batch (the scripts are in the hub's `coordinator-state-2026-09-23/scratchpad/`)
```bash
# 0) fetch
git -C <worktree> fetch -q origin master
# 1) readiness: CI OK passed on current head, or failed ONLY the DB replay job; flags heads changed since review
scratchpad/check-candidates2.sh 325 356 388 389          # zsh: pass lists as ${=L}
# 2) fetch heads
for n in 325 356 388 389; do git fetch -q origin +refs/pull/$n/head:refs/remotes/pr/$n; done
# 3) build the chain in the object store (merge-tree + commit-tree; skips conflicts; prints OK/SKIP/TIP)
scratchpad/build-batch.sh origin/master /tmp/batch4.txt 325 356 388 389
# 4) checks: files touched by >1 PR → duplicate fun/func definitions vs master; then pinned SwiftLint/SwiftFormat
scratchpad/lint-batch.sh <TIP> <multi-files-list>
# 5) push + PR (use ${TIP} in zsh, not $TIP:)
git push origin "${TIP}:refs/heads/claude/coord-merge-batch-4"
gh pr create --base master --head claude/coord-merge-batch-4 --title "chore: combined merge of N reviewed PRs (batch 4)" --body-file body.md
# 6) queue it and run the serial runner
echo <PR> > /private/tmp/pantopus-tools/merge-queue/queue.txt
nohup /bin/zsh /private/tmp/pantopus-tools/merge-queue/run.sh >> /private/tmp/pantopus-tools/merge-queue/run.out 2>&1 &
```
- **Fixing the batch.** If batch CI fails on a combined-only problem (e.g. `file_length`), add a small coordinator fix-up commit to the batch branch. Build it with a temp `GIT_INDEX_FILE` via `read-tree`, `update-index` and `commit-tree`. Lint it locally with the pinned SwiftLint 0.63.3 and SwiftFormat 0.61.1, which are installed. Document it in the batch PR body.
- **Stacked PRs.** Retarget each one's base to master first (`gh api -X PATCH repos/WangPantopus/skinny-pantopus/pulls/N -f base=master`). Include the parent before the child.
- **After the merge:**
  - verify each included PR shows `merged=true`;
  - tell the agents;
  - update the hub.

### 8.4 CI triage
| Symptom | Cause | Action |
|---|---|---|
| `database / Replay…` fails with `toomanyrequests` | ghcr.io rate limit or outage | New runs use #385's ECR fallback. Re-runs of old runs don't, because they keep the old workflow. Treat DB-only failures as batch-ready. |
| iOS Lint `file_length` on a batch | Several PRs grew one file | Fix-up commit splitting an extension |
| Android `testDebugUnitTest` Paparazzi failures | Copy or UI change without re-recorded goldens | The owner re-records just those frames (`recordPaparazziDebug`) |
| detekt `CyclomaticComplexMethod` | A function grew | Extract a small private helper |
| iOS build "ambiguous use of Task.init" or a trailing-closure mis-binding | Swift closure inference | Pass labelled arguments explicitly |
| CI queued for hours | About 5–6 concurrent macOS jobs, each native run taking 5 jobs | Batch, and group native PRs. Don't cancel other PRs' SE-simulator runs (they catch layout snapshots). |

### 8.5 Watcher and runner
- **Watcher.** `/private/tmp/pantopus-tools/coord-watch2.sh` runs as a Monitor with a 30-minute timeout; re-arm it on expiry. It's REST-only and auto-watches every open `claude/*` PR. It emits:
  - `PRn head <sha> CI OK=pass|fail|cancel`;
  - `PRn MERGED`;
  - queue events;
  - `DISK LOW` below 12 GiB.
- **Runner.** `/private/tmp/pantopus-tools/merge-queue/run.sh` merges the first PR in `queue.txt` with `gh pr update-branch` if it's behind, then waits for CI OK and runs `gh pr merge --merge --match-head-commit`. It logs to `log.txt` and exits when the queue is empty.

### 8.6 Resources
- **Before starting anything,** check `uptime`, `sysctl kern.memorystatus_vm_pressure_level` and `df -h /`.
- **Heavy builds:** `heavy-slot.sh acquire "<stream>: <purpose>"` … `release`. Hold it for the whole build and install.
- **Devices:** `device-slot.sh acquire` / `release`, with at most 4 devices, never EB5AD759. Shut devices down when they're idle.
- **Disk:** keep 15 GiB or more free. Delete APKs, stale `.app` copies, `.next` dirs of stopped servers and stale worktrees. Keep one derived-data dir per stream; a fresh iOS build writes 5–8 GiB.
- **Memory:** stop Next dev servers when they're idle (one used 7 GB), and stop emulators when they're idle.

### 8.7 Evidence and PR format
- **Bundle:** `.pantopus-recovery/audits/<YYYYMMDD>-<stream>-<topic>-r<N>/` with `RESULT.md` and `MANIFEST.json`.
  - `RESULT.md` holds the defect, the reproduction on master with its SHA, the repair commit, real-app verification and limits.
  - `MANIFEST.json` holds `updatedAt`, `branch`, `commit`, `boundary`, and per-file sha256 and size.
  - Cite the MANIFEST sha256 in the PR.
  - Record corrections openly (a `corrections.json`, then reseal).
- **PR:** branch `claude/<stream>-<topic>`. The body has Problem / Reproduced / Change / Real-app verification / Evidence / Limits, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### 8.8 Verification runtimes
See the memory files: `pantopus-native-e2e-runtime-2026-09-22.md` (disposable project, backend, iOS/Android build and drive), `stream2-guest-pass-harness-runtime.md`, `stream2-runtime-revival-gotchas.md`, `pantopus-disposable-full-schema-project.md`, `pantopus-ios-simulator-verification-gotchas.md` and `pantopus-worktree-native-build-setup.md`. Each stream checkpoint has its exact restart commands.

---

## 9. Gotchas that cost time today
- **zsh**
  - `for n in $list` doesn't word-split; use `${=list}` or `bash -c`.
  - `$VAR:r…` is read as a modifier; write `${VAR}:refs/...`.
  - A bare `=====` is an error.
  - Backticks inside an unquoted heredoc run as command substitution; quote the heredoc (`<<'EOF'`).
  - `cd` changes the shared working directory; use absolute paths or `git -C`.
- **GitHub API.** `gh pr view` and `gh pr checks` use GraphQL (5,000 points an hour, shared by everyone). Use `gh api` REST for polling.
- **PostgREST.** Tables with two FKs to User (e.g. HomeOccupancy: `user_id`, `added_by_user_id`) need `User!HomeOccupancy_user_id_fkey!inner(...)`; otherwise you get PGRST201 and silently empty data.
- **supabase-js** doesn't throw; always check `{ error }`, especially on money writes. Enum or column mistakes fail silently (e.g. `listing_status` has no 'reserved' or 'traded').
- **Android Compose strong skipping** (Kotlin 2.0.21) can freeze chrome that's read only at first composition; see #337's live-chrome mirror.
- **Paparazzi pixel comparisons.** Compare RGB, not only alpha; one false "unchanged" came from an alpha-only check.
- **Git.** Never run `git gc`, `maintenance` or `repack` while auto-maintenance is paused. Never use a bare `git stash`.
- **The web dev `next.config.js`** defaults the API to `127.0.0.1:8000`, the founder's backend. Always set `NEXT_PUBLIC_API_URL`.

---

## 10. Appendices
- `HANDOFF-2026-09-23-FINAL-merged-prs.md`: all 187 PRs merged on 2026-09-23, with batch and branch.
- `coordinator-state-2026-09-23/COORDINATOR-RESUME.md`: the paused state and restart commands.
- `coordinator-state-2026-09-23/checkpoints/*`: per-stream checkpoints and helper scripts.
- `coordinator-state-2026-09-23/tools/*`: rules, inventory, trust-claims plan, watcher, runner and slot scripts.
- `README.md`: running history and the full decision, question and data-action text.
