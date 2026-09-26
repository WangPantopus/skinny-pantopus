# CURRENT RESUME — Stream 2 peer takeover (September 25, 2026)

Independent Stream 2 agent (peer of Streams 1 and 3; Stream 1 is only the serial merge steward). App worktree `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream2-mail-journey-18b50a`, branch `claude/stream2-mail-list-dismiss` (master `27eb23ad2` merged in; the PR branches are separate worktrees under `/private/tmp/pantopus-stream2-*`). The September 22 block below and every older section stay historical/authoritative for their journeys.

**Stream 2 — 2026-09-26 09:52Z (decision 4 done as #503; #493 in batch 25)**

- **#493 (R06)** is all green and in batch 25 (#499).
- **Decision 4 open as PR [503](https://github.com/WangPantopus/skinny-pantopus/pull/503).** Branch `claude/stream2-certified-statuses`, head `6ddb88ec6` on `dbd75332b`. CI started; reported to Stream 1 for batch 26.
  - **What makes a letter certified:** a live letter with `Mail.certified` now shows certified mail on web, iOS and Android.
    - Web: a card showing "Read · not signed" / "Signed", with "Sign for delivery".
    - Apps: the certified layout with a Received → Read → Signed chain from the letter's timestamps.
  - **Sign sheet:** it keys on signed, not read. Opening marks the letter read, and the sheet still shows until the recipient signs.
  - **Signing:** the apps sign through the recipient-only certified route (they used V1 `/ack`, which returned 400).
  - **Backend:** signing keeps the first read time. On master it overwrote `opened_at`.
  - **False claims removed** for Pantopus mail: the USPS stamp/carrier, the hard-coded sample extracted-task card, and a static "Sender domain checked" pill.
- **Evidence:** bundle `20260926-stream2-certified-statuses-r1`, MANIFEST `84461224f16b48119b0c7d3a16ae3dd3c5f7d7617254a6327f7c992e3ffaaeb9` (109 files).
  - Six synthetic certified letters for B are retained.
  - Master befores on all platforms; afters on all platforms.
  - Final APK `e31a360e…` and dylib `e15e549a…`. 3 `CertifiedDetailSnapshotTest` goldens are re-recorded.
- **For the user:**
  - No production path sends certified mail (only the dev seed), and there is no sender-side view or signing notice.
  - The legal footnote copy is unchanged.
  - The apps show Sign to non-recipients, but the server refuses them.
- **Heavy and devices:**
  - Heavy windows: 08:44–08:46Z (ktlint failure), 08:46–09:07Z, 09:08–09:15Z, 09:41–09:48Z.
  - iOS driver 08:47Z → released 09:16Z → back 09:45Z → released 09:50Z. 6F914A30 is shut down.
- **Runtime:** the branch backend runs on 18145, and the proxy on 18142 points to 18145.
- **Next:** decision 1 (household letter delete: 30-day restore, notices, "Recently deleted", dismiss parity). It's the largest: a migration plus 115 Mail queries in 15 backend files. Shared files will be coordinated first.

**Stream 2 — 2026-09-26 08:40Z (decision 2 / R06 done as #493)**

- **Decision 2 open as PR [493](https://github.com/WangPantopus/skinny-pantopus/pull/493).** Branch `claude/stream2-r06-native-letters`, head `1302cf89a` on master `e00952e3e`, 2 commits, no backend change. CI started. Reported to Stream 1 for batch 25.
  - **Native:** a Place dashboard "Identity · Residency letters & passes" entry, and letter-row PDF (iOS Quick Look; Android FileProvider → the phone's PDF viewer).
  - **All three platforms:** a guest reads "Verified guest" / "Verified service provider". Guests and service providers get a note instead of the issue forms, and keep the letters and passes they issued as residents (PDF + Revoke).
- **Evidence:** bundle `20260926-stream2-r06-native-letters-r1`, MANIFEST `887521e000d5d4a5e091cff45714812ab2c81bf50ac084ff3a2715cbe6eb18ca` (169 files).
  - Befores on master for all three platforms, then afters on both builds.
  - The app PDFs equal the server bytes.
  - Android checks and Paparazzi `PlaceDashboardSnapshotTest` unchanged. APK `4e638cbb…` and dylib `f8e870e2…` installed and hash-verified.
  - One emulator ANR is recorded, and didn't recur on a repeat.
- **Restore:** B is back to member (only `membership_version`/`updated_at` differ). Letter `17e892d2` and 4 role-change audit rows are retained.
- **Heavy and devices:**
  - Heavy: held 07:38:53Z–07:54:28Z and 08:19:06Z–08:26:46Z.
  - iOS driver: Stream 1 → me 07:40Z. Lent to Stream 3 07:48Z–07:52:30Z and 08:06:52Z–08:26:40Z. Then to Stream 1 at 08:28:51Z, with 6F914A30 shut down.
- **Still with the user:** the guest-letter verification finding (Proposal A, see 08:10Z block).
- **Next:** decision 4 (certified). The code is local in `/private/tmp/pantopus-stream2-certified` (`claude/stream2-certified-statuses`, `fa29286b0` on `e00952e3e`) and not yet built or verified.

**Stream 2 — 2026-09-26 08:10Z (decision 2 / R06 in progress; security finding escalated)**

- **Batch 24 (#489)** contains #482 (decision 3). Its iPhone 16 Pro job failed in `HomeTaskMediaViewModelTests` (timing, unrelated), passed on re-run, and is now green.
- **R06:** worktree `/private/tmp/pantopus-stream2-r06`, branch `claude/stream2-r06-native-letters`. Local head `1302cf89a` on master `e00952e3e` (2 commits, unpushed).
  - **Native Place dashboard:** an "Identity · Residency letters & passes" entry.
  - **Letter PDFs:** iOS opens them in Quick Look; Android opens them through the FileProvider in the phone's PDF viewer.
  - **Guests and service providers:** "Verified guest" / "Verified service provider" on iOS, Android and web. They get a note instead of the issue forms, and the letters and passes they issued as residents stay listed with PDF and Revoke.
- **Verified so far:**
  - **Befores:** on master for all three platforms. The guest is offered both generators, and issuing returns 403.
  - **Afters (first build):** the member flow works on both apps. The dashboard entry opens Identity, and the PDF opens in the device viewer with the exact bytes the server sends (sha `8e871f59…` on both). The web guest view on the current tree is also done.
  - **Still to run:** a rebuild for the "keep earlier letters" change, then the native guest afters.
- **SECURITY (escalated to the user; no code):** a resident changed to guest keeps letters that still verify.
  - The public check returned `valid: true` with B's name and address after B became a guest.
  - Both live checks ignore `role_base`; passes have the same gap.
  - **Proposal A:** treat guest and service-provider roles as residency ended in `verifyByCode` and `isStillVerifiedResident`. The write-up is in the scratchpad `evidence/r06/finding-guest-letter-verifies/FINDING.md`, to be sealed with the R06 bundle.
- **Decision 4 notes (next):**
  - Live certified letters render as ordinary letters on every platform. Web `getItemDetail` hard-codes `certified: false`. Native keys the certified layout on `mail_type == certified`, which `Mail_mail_type_check` forbids.
  - The native "Sign for delivery" calls V1 `/ack`, which needs `ack_required` and lets any household member acknowledge.
  - The only writer of `Mail.certified` is the dev seed route.

**Stream 2 — 2026-09-26 07:12Z (decision 3 done)**

- **Batch 21 merged** (master `e1509f346`, with #464 and #467). **#473 and #474 are in batch 22 (#478).**
- **Decision 3 open as PR [482](https://github.com/WangPantopus/skinny-pantopus/pull/482).** Branch `claude/stream2-issue-permissions`, head `07faa0324`, on `e1509f346`, in 2 commits. CI started.
  - **Server:** `PUT /api/homes/:id/issues/:issueId` accepts `home.edit` or `maintenance.manage` (master: `home.edit` only).
  - **Web:** the Maintenance page shows Report only to maintenance editors/managers, and Schedule / Complete / Dismiss only to those who can update. The dashboard issue panel is read-only for everyone else.
  - **iOS/Android Issues lists:** the same rule for the FAB, the empty-state button and the row actions.
  - **Home dashboard Issues entry** (`maintenance.view`): an Android Overview row, and an iOS link.
  - **iOS premise corrected:** I had said iOS had a drawer entry, but its Home drawer is preview-only as on Android, so the entry is added on iOS for parity. Flagged to the user.
- **Evidence:** bundle `20260926-stream2-issue-permissions-r1`, MANIFEST `c4d651ebb9b82b765a58aca6ebaac40e8a88e2226250bc3133998b045c37f760` (153 files).
  - **API:** a member with `maintenance.manage` gets 403 on master and 200 on the fix.
  - **Web, Android and iOS:** befores on master and afters on the fix, for owner, view-only member and member with manage.
  - **Android build:** ktlint, detekt, Paparazzi verify of `HomeDashboardSnapshotTest` (3/3 unchanged), assemble. The APK is installed and hash-verified.
  - **iOS:** rebuilt, installed and hash-verified; strict SwiftLint and SwiftFormat clean.
  - **Fixtures:** restored by exact key. Probe issue `8315f50f` is retained as `canceled`.
  - **Device state:** both apps are now signed in as member B.
- **Runtime:** the PR backend runs on 18145 (`runtime/start-backend-wt.sh`, S2_WT/S2_PORT); my proxy on 18142 targets 18145. 6F914A30 is shut down, and the iOS driver is released.
- **Next:** decision 2 (R06 native letters/passes entry, PDF viewer, guest card wording).

**Stream 2 — 2026-09-26 06:21Z (decision 5 done)**

- **D07 fix open as PR [474](https://github.com/WangPantopus/skinny-pantopus/pull/474)** (web only, `members/page.tsx`). Branch `claude/stream2-web-role-choice`, head `82f385560`, on `5bf1eb7f8`. CI started.
  - "Change role" opens a menu: "Current role: X", then the roles the viewer may give. It's hidden when there are none.
  - The rules follow the native pickers and `mutate_home_member`: never Owner, never self, and a non-owner can only give roles below their own rank.
  - The existing confirm then saves exactly that role.
- **Evidence:** bundle `20260926-stream2-web-role-choice-r1`, MANIFEST `b0d7067f38dc0c27f2013207beb974f06cb671eb46f7128563780380df564f33` (90 files).
  - **Befores (master):** Admin B's own row offers "Set as Manager", which returns 403. The owner is offered only the next role in the cycle.
  - **Afters:** the owner gets full menus. As Admin, B has no control on their own row and the member is offered Manager, Restricted and Guest; Manager saved. The owner moved B from Admin to Member with one confirm. As Member-rank, B has no control on a Manager.
  - **Fixtures restored by exact ids:** the third member row for synthetic `cb6c7225`, B's two permission overrides and the cached `can_manage_access` flag. Only trigger-managed columns differ.
- **Fixture note for peers:** the reference role matrix gives admins and managers no `members.view` / `members.manage`; only owners get them by default. Non-owner member management needs owner-granted overrides.
- **Next:** decision 3 (issue permissions plus an Android Issues entry). That needs heavy and an Android install later, which I'll ask for first.

**Stream 2 — 2026-09-26 06:09Z (decision 6 done; adds to the decisions block below)**

- **R04 fix open as PR [473](https://github.com/WangPantopus/skinny-pantopus/pull/473).** Branch `claude/stream2-ownership-transfer-safety`, head `ad0c1f162`, on `5bf1eb7f8`. Changes `backend/routes/homeOwnership.js` plus 4 lines in the web `owners/transfer/page.tsx`. No native changes, no migration. CI started.
  - **Buyer check:** the buyer must be an existing account before any write. Otherwise 400 `TRANSFER_BUYER_NOT_FOUND` or `TRANSFER_TO_SELF`, with nothing changed.
  - **Right seller:** an approved co-owner transfer runs for the proposer. On master, the deciding voter was revoked.
  - **Claim first:** the buyer's claim is created before the seller is revoked. On master the insert always failed: PGRST204, because it sends a `metadata` column that `HomeOwnershipClaim` lacks.
  - **Clean failure:** if any later save fails, the earlier steps are undone and the request returns 503 "Nothing was changed".
  - **Web landing:** after a direct transfer, the page opens the home dashboard, because the former owner gets 403 on Owners.
- **Evidence:** bundle `.pantopus-recovery/audits/20260926-stream2-ownership-transfer-fix-r1`, MANIFEST `a14373fb1b347489d84f636912cdd18182fba5c3139b1d73c7a7149dc469d993` (168 files).
  - Master befores for the co-owner path and the claim insert.
  - API afters: unknown email, self, fault-injected revoke failure, single-owner success, co-owner success with post-access checks, mixed-case email.
  - Web journeys through the real page: an unknown email shows the error toast; the buyer's email lands on the dashboard as Member.
  - Every test home was restored by exact ids. Retained history (synthetic buyer `cb6c7225`, 2 quorum actions, audit rows, 7 buyer notices) is listed in RESULT.md.
  - Native apps were not driven.
- **Follow-ups noted, not changed:**
  - A failed quorum execution still reports "approved". This predates the PR and affects every action type.
  - `Home.owner_id` is cleared when it pointed at the seller, even with a co-owner remaining. That is the existing legacy-pointer policy, and the co-owner keeps full access.
  - The native transfer screens' comments still mention off-platform buyers.
- **Runtime notes:**
  - My main worktree's build tree equals the #473 tree (`66e790c4a`, tree `dd38c745`).
  - Master's new `qrcode` web dependency was missing from that worktree's install. I linked it (git-ignored) from the Stream 2 home worktree's pnpm store; no founder checkout was touched.
  - The fixed backend runs on 18145; my proxy on 18142 is back on 18143.
- **Next:** decision 5 (web Members explicit role choice).

**Stream 2 — user decisions recorded 2026-09-26 (supersede the pending list in the 05:15Z block below)**

1. **Household letter delete:** proposal approved as sent.
   - 30-day recoverable delete: two Mail columns (deleted_at, deleted_by) plus an index, and a nightly purge. The letter hides for everyone at once.
   - A notice goes to the members who could see it, respecting their Home-updates setting.
   - Restore: web "Recently deleted" with Undo; the apps restore from the notice.
   - Dismiss parity: a dismissed shared Home letter sends the same notice and can be restored; the web stops listing dismissed letters.
2. **R06:** native entry to letters and passes on the existing Identity section, and the PDF opens in the device viewer. A guest's card no longer reads "Verified resident". Managers keep issuing letters.
3. **Home issues:** holders of maintenance.manage can update issues, and the buttons are hidden for everyone else. Android gets an Issues entry on the Home screen.
4. **Certified mail:** statuses Received (not yet opened), Read (opened, not signed) and Signed (the confirmation is sent on signing). The signing confirmation keys on signed, not read. Build the closest workable version.
5. **Web Members:** "Change role" sets the chosen role directly.
6. **R04 ownership transfer:** proposal A.
   - Resolve the buyer before any write, and run approved transfers for the proposer.
   - Create the buyer's claim first, and stop cleanly on any failed save.
   - B (keep the seller until approval) is deferred.

Plan: one PR each, in this order: 6, 5, 3, 2, 4, 1. Shared-file edits (notificationService, root navigation, migrations) are coordinated with the peers first.

**Stream 2 — 2026-09-26 05:15Z (adds to the 04:59Z block below)**

- **SECURITY, escalated to the user (R04; reproduced and restored; no code change):** a single owner's `POST /api/homes/:id/owners/transfer` to an email with no account returns 200 "Transfer initiated" with `transfer_claim_id: null`.
  - It revokes the owner, clears `Home.owner_id` and demotes the owner to member before resolving the buyer, and creates no claim.
  - The Home enters `security_state` claim_window for 14 days. The former owner has no ownership permissions and no undo (403).
  - Web and iOS show the message as success.
  - **Bundle:** `.pantopus-recovery/audits/20260926-stream2-transfer-ownerless-exposure-r1`, MANIFEST `4eb55adcbdad51b227d40a8809b12dbbc0093cba2813529c58eb799fc50715c9`.
  - **Restored** by exact ids; only trigger-managed columns differ, and 3 audit rows are retained.
  - **Proposal:** A (backend only) resolves the buyer, then creates the claim, then revokes, checking each write. B keeps the seller as owner until approval (policy).
- **D07 web role change (reproduced, no change):** Members "Change role" cycles one real change per confirm, and a lease resident is offered Admin. Proposed matching the native explicit role list (design change, awaiting the user).
- **Pending user decisions:** household delete specifics; R06 native entry/PDF/guest/manager; issue permissions and Android reachability; certified mail; web role picker; transfer ownership (security).

**Stream 2 — 2026-09-26 04:59Z (adds to the 03:50Z block below)**

- **Batch 20 (#463) merged**; master is `5bf1eb7f8`. It includes #461 (S2-03).
- **#464 (read state):** all CI green at `1cc00d5e0`, so it's ready for Stream 1's batch 21 review.
- **New D01 defect, reproduced and fixed as PR [467](https://github.com/WangPantopus/skinny-pantopus/pull/467).** Branch `claude/stream2-home-issue-status`, head `ca475c47f`, on `5bf1eb7f8`.
  - **Defect:** Home issue Mark complete and Dismiss fail on web, iOS and Android. The clients send `completed`/`dismissed`, but `HomeIssue_status_chk` (application baseline) allows only `open`, `scheduled`, `in_progress`, `resolved` and `canceled`. Every save is a 500, issues never leave open, and the health score stays down.
  - **Fix (3 files):** the web Maintenance page and both `HomeIssuesListViewModel`s send and read `resolved`/`canceled`. The rest of the web already did. Web History rows no longer offer Dismiss, as on native.
  - **Befores:** API, real web page and Android all 500. **Afters:** web, iOS and Android all 200, with History correct across clients.
  - **Builds:** APK `cce36e56…` (the first install failed silently under load; the verified reinstall is `android-install-note`) and iOS dylib `4d9424e2…`, both on :18142 only.
  - **Bundle:** `.pantopus-recovery/audits/20260926-stream2-home-issue-status-r1`, MANIFEST `170acadd3690f59856b0eb55f97b12af8f610ae155d02483db8c5106fee56ba5` (125 files).
  - **Fixtures:** 10 synthetic probe HomeIssue rows, all now `resolved` or `canceled` and retained. The DB had none before, and HomeIssueSensitive has 0 rows.
- **Findings for the user** (decisions, not changed):
  - Issue updates need `home.edit` while reporting needs `maintenance.*`, and the buttons show for every viewer.
  - Android's Issues list is reachable only from the health card when maintenance is the worst dimension; the Home-context drawer is preview-only.
- **Checked and dispositioned:**
  - All 24 S2-xx inventory rows now have a fix or disposition on master (S2-09/12/13/14/18/19 are verified fixed in source).
  - R06: all repairs are merged. The remainder is design/founder decisions: native Identity entry, native letter PDF, guest wording, manager role.
  - Stream 3's SMS-escrow lead is latent: no client sends phone or email recipients to mail send.
- **Heavy and devices:**
  - Heavy: held 04:17:10Z–04:29:26Z, then handed to Stream 1.
  - Short APK reinstall at 04:43Z, with Stream 3's explicit OK during its window.
  - iOS driver: from Stream 3 04:23:49Z, released 04:29:50Z, with 6F914A30 shut down.
  - emulator-5556 soft-restarted its system_server under host load (package service missing 04:37Z–04:42:38Z).

**Stream 2 — 2026-09-26 03:50Z (adds to the 03:16Z block below)**

- **Batch 19 (#459) merged** at 03:43:14Z; master is `a5fb4864c`. It includes #457 (Mail Party and bundle privacy) and #453 (Home links).
- **#461 (S2-03)** was approved by Stream 1 and is in batch 20 ([#463](https://github.com/WangPantopus/skinny-pantopus/pull/463)).
- **Read state opened as PR [464](https://github.com/WangPantopus/skinny-pantopus/pull/464)** at about 03:49Z. Branch `claude/stream2-native-mail-read-state`, head `1cc00d5e0`, on `a5fb4864c`. It's queued for batch 21 once CI is green.
  - **Decision A:** both apps call the web's `PATCH /api/mailbox/:id/view` after the generic detail loads an unviewed letter.
    - On success the row drops its unread highlight and the drawer badges refetch.
    - A failure leaves the letter unread.
    - Leaving at once still records the read (Android `NonCancellable`; iOS runs an unstructured task that the load awaits).
    - The server sets an ad letter's payout `pending` once.
  - **Certified:** unsigned certified letters stay unread, because their Sign for delivery confirmation keys on "unread".
  - **Files and tests:** 16 native files. Existing test stubs are in 3 Android MailDetail VM test classes and iOS `MailDetailCommunityTests`. No new tests and no backend changes.
  - **Real-app befores and afters on both apps:** read, ad payout once, 503 stays unread then recovers, and leaving at once with the reply held 5–8 s. Screenshots bracket the iOS case. 9 MailAction rows for 9 letters.
  - **Builds:** APK `11e7185b…` and iOS dylib `b3a7502f…`, both on :18142 only.
  - **Bundle:** `.pantopus-recovery/audits/20260926-stream2-native-mail-read-state-r1`, MANIFEST `cd1cd25aa3e7ba71023f003d7b881167859f6e0ff54414bba9f70f89baecbfdc` (144 files).
- **Fixtures (isolated DB 64554):**
  - New ad letters `451a9615` and `705e9621` (owner, $0.25, `pending`) are archived and retained.
  - The seven S2-Mail-List letters used were restored to unread by exact id, so Me is back to 25 unread.
  - The 9 MailAction `viewed` rows are retained.
- **New finding (code-level, for the user):** the native certified layout is unreachable with live data. The apps expect `object.reference_number`, but the V1 detail route sends the raw MailObject row. Its signing confirmation also keys on read state, which the web sets on open. This is a product and legal decision.
- **Heavy and devices:**
  - Heavy: held 03:33:07Z–03:41:55Z (from Stream 1, then to Stream 3).
  - iOS driver and slot 4: held 03:35Z–03:47:32Z (from Stream 3 and back to it), with 6F914A30 shut down.
  - The Claude panel auto-booted 6F914A30 at about 03:31Z. That wasn't any stream's call, and it was shut down at 03:34:45Z.
- **Still waiting on the user:** household delete-recovery specifics.
- **Next:** the remaining Stream 2 inventory rows, verified-first.

**Stream 2 — 2026-09-26 03:16Z (supersedes the security, S2-03 and "still waiting" items below)**

- **User decisions (2026-09-26):**
  - **Party-assign security fix:** approved as proposed.
  - **Bundle privacy:** approved as proposed.
  - **Native read state:** delegated to Stream 2 after industry research. The decision is A: the apps call the web's `PATCH /api/mailbox/:id/view` when a letter opens.
  - **Household Archive/Dismiss/Delete:** stays shared. The user asked for a deletion notice to the other members and a recovery window. The concrete proposal is with the user and awaits approval of the specifics.
- **#457 opened** at 02:36:04Z: party create/assign and bundles reach only the reader's household letters. Backend only, head `df1bbe1e9`, bundle `20260926-stream2-mail-party-bundle-privacy-r1`.
- **Batch 19 (#459):** Stream 1 queued #457 then #453. Stream 1 merges and reports it.
- **S2-03 opened as PR [461](https://github.com/WangPantopus/skinny-pantopus/pull/461)** at 03:15:50Z. Branch `claude/stream2-native-earn-dead-ends`, head `3a5cdb21e`, on master `564bf220d`.
  - **Change:** Earn help → Help center, Offer a service → Professional profile, and the dead "See all" is hidden. Android and iOS both, in 6 files. The Place and Mail stacks reuse the You stack's `.professionalProfile` route.
  - **Baseline:** `earn_populated` is re-recorded at 0.1091%. 28% of that is the See all removal; 72% is existing master drift from `4c15f4b70`, which alone is under the tolerance.
  - **Real-app befores and afters on both apps:**
    - Help and Professional open, and Back returns to Earn.
    - The populated Earnings tab has no See all.
    - The only requests were GETs plus the app-start refresh.
    - Builds: APK `8be739b5…`, iOS dylib `f5f33f04…`, both on :18142 only.
  - **Bundle:** `.pantopus-recovery/audits/20260926-stream2-native-earn-s2-03-r1`, MANIFEST `9d658fbb5713d7dc81dff403a0924dc1b10aed6f72d07caf898f840a0b8cbd96` (91 files).
  - **Overlap:** it shares `RootTabScreen.kt` and `HubTabRoot.swift` with #453; `git merge-tree` is clean and keeps both. It has no files in common with #457.
  - **Follow-up, not changed here:** on iOS the Professional profile shows two back controls, as it already does from the You stack. The view needs a header in every state before a stack can hide its bar.
- **Heavy and devices:**
  - Heavy: held 02:44:45Z–02:53:26Z for the S2-03 builds.
  - iOS driver: held 02:55:43Z–03:00:04Z, then released to Streams 1 and 3.
  - Simulator `6F914A30` was shut down at 03:03:07Z for device headroom.
- **Next:**
  - Read-state PR: Android and iOS, local, not yet built. It waits for a heavy window and then a simulator boot, both coordinated with the peers first.
  - Household delete recovery: after user approval.
- **Fixture:** the archived `ad` earning letter `1fac1d44` is retained, and S2-03 only read it.

**Stream 2 — 2026-09-26 02:19Z (adds to the 02:07Z block below)**

- **#451 merged** in batch 17 (#452) at 02:08:04Z; master is `8a9a97757`.
- **#453** (Home-links) is approved by Stream 1 at head `3f2b70b0b` for the next native batch, pending CI.
- **SECURITY, escalated to the user (live, reproduced, restored):** `POST /api/mailbox/v2/p2/party/assign` checks only that the caller can read the letter.
  - It then moves the letter to any `assignToUserId` and completes any `sessionId`, even one that doesn't exist.
  - **Reproduction:** the owner "assigned" a letter on a Home the member isn't in, using a random session id. The route answered 200, and the member's read went from 404 to 200 with the content.
  - **Bundle:** `.pantopus-recovery/audits/20260926-stream2-party-assign-exposure-r1`, MANIFEST `e71f87e002ccb6a967c54b47b292c6ff4eeecd9316a435c4364b189ba01e169c`.
  - **Proposal (backend only):** require a real session for that letter that includes the caller; require the assignee to be a session participant or an active occupant of the session's Home; check the write error before completing or logging.
  - `/party/join` already checks the household. No code changes until the user decides.
- **S2-03 remainder:** local commit `0b05448af` on `8a9a97757`.
  - Earn help → the Help center, "Offer a service" → the Professional profile (the iOS Place stack reuses the You-stack route), and the populated dashboard's "See all" is hidden.
  - Befores are done on both apps, using the new archived `ad` earning fixture `1fac1d44` ($0.25 pending, not cashable, outside Incoming).
  - Waiting for heavy (Stream 3, then Stream 1, then me).
- **Retained probe fixture:** home letter `d7ad725a` on Home `9d885f71` (archived, restored to the Home).

**Stream 2 — 2026-09-26 02:07Z (supersedes the PR states and "Next" in the 00:57Z block below)**

- **#445 merged** in native batch #449 at 01:29:12Z; master is `8f1a59f58`.
- **#451 (S2-16):** all CI green at `4f4c3b396`. Stream 1 approved it under §8.2, and it is queued in batch 17, PR #452 (#448 → #450 → #451).
- **Home-links opened as PR [453](https://github.com/WangPantopus/skinny-pantopus/pull/453)** (S2-10, S2-17, S2-06). Branch `claude/stream2-native-home-notification-links`, head `3f2b70b0b`, on `8f1a59f58`. Opened at 02:06:35Z; CI is running.
  - **Change:** the routers send Home notification links to existing screens:
    - residency_claim → claim review on its Residency tab;
    - `members` → Members, and `members?tab=requests` → its Requests tab;
    - `dashboard?tab=members` → Members;
    - `owners` → Owners;
    - `claim-owner/evidence?claimId=` → the claim's documents (iOS) or My claims (Android);
    - the landlord tenant_request → the Home (S2-06 minimum).
  - The iOS Place stack gains Owners, claim-review and Requests-tab routes that reuse the You-stack views.
  - Two existing router tests were updated; no new tests.
  - **Befores and afters on both apps:** seven exact-format notification rows plus a claim fixture. All seven failed before and land correctly after. Back returns to Notifications, and only GETs were sent.
  - **Builds:** APK `a00cfc81…`, iOS dylib `d891a959…`, both on :18142 only.
  - **Bundle:** `.pantopus-recovery/audits/20260926-stream2-home-links-r1`, MANIFEST `37f730c776216e2be5ad6718569d78910489a033050a4166db8c47e865ce0dc4` (138 files).
- **New retained fixtures** (isolated DB 64554): owner notifications `6e5e1ba6`, `5ffc4bfa`, `a411ce85`, `35a45d5b`, `2a287c73`, `ee6a92f6` and `c0f7273c`, and HomeOwnershipClaim `31bce01d` (the owner's own claim on home `9d885f71`, `submitted`, `doc_upload`).
- **Next: S2-03 remainder.** Earn help and "Offer a service" still open "isn't in the app yet" placeholders on both apps. The plan is to reuse the Help center and the Professional profile.
  - iOS "See all" beside Recent earnings opens an "All earnings" placeholder.
  - The static figures are already gone.
- **Heavy and iOS driver:**
  - Heavy: held 01:23:21Z–01:38:54Z.
  - iOS driver: held 01:14:40Z–01:18:07Z (befores) and 01:54:19Z–01:57:47Z (afters). Every iOS call named `6F914A30`.

**Mail journey — 2026-09-26 00:57Z (supersedes the PR states and "Next" in the ~00:10Z block below)**

- **#443** (Mail write routes truth) was merged at 00:15:41Z as `eaae991b0` and is in master `27eb23ad2` (batch 16, #446).
- **#445** (native list/Dismiss/Archive/badge/vault): CI is all green at head `352202313`, including `android / Lint, test, assemble`. Stream 1 approved it into native batch 14, PR [449](https://github.com/WangPantopus/skinny-pantopus/pull/449) (#436 → #439 → #444 → #445 → #447, tip `b75f13ffb` on `27eb23ad2`). That PR merges when its batch CI is green.
- **S2-16 opened as PR [451](https://github.com/WangPantopus/skinny-pantopus/pull/451).** Branch `claude/stream2-native-mail-s2-16`, head `4f4c3b396`, on master `27eb23ad2`. It was opened at 00:56:08Z and CI is running.
  - Unboxing's dead Photo library and More actions icons and its filed-state Open record/Share/Reminders/Archive chips are hidden. So is the ceremonial reading view's dead Share. Same-width spacers keep the centred titles in place.
  - The iOS reply-preview icons are now decorative, as on Android.
  - Four source files and three Android baselines changed. The baselines are `unboxing_filed` 5.41%, `unboxing_capture` 0.105% and `ceremonial_mail_open_phase` 0.029%. The PR body discloses that they also pick up master's `4c15f4b70` success-green change.
  - **Real-app befores and afters on both apps** (APK `bb2f64cb…`, iOS dylib `9f641b0a…`, both on :18142 only):
    - The removed controls are gone.
    - Back, the titles, Close and Archive keep identical bounds.
    - Only GETs were sent.
  - Bundle `.pantopus-recovery/audits/20260926-stream2-native-s2-16-r1`, MANIFEST `b45cdc8d430ce5e1074b1c21b4e2846f0ed09e4726378bdb9bb8e47b4e05aca6` (47 files).
  - No file overlaps #449, and `git merge-tree` with `b75f13ffb` is clean. Stream 1 plans #451 for the next native batch with #448 and #450.
- **Fixtures:** unchanged by S2-16, which only read the archived owner letters `a9ad531a` (unboxing) and `9f54982e` (ceremonial).
- **Next:** once #449 lands, branch the Home-links PR (S2-06/S2-10/S2-17) from master. It avoids Stream 3's hunks (connections, identity center, blocked users, and the scheduling/user/chat router cases).
- **Still waiting on the user:** native read state (A/B/C); household shared-row Archive/Dismiss/Delete semantics; the latent bundle auto-group privacy fix proposal.
- **Heavy and iOS driver:**
  - Heavy: held 00:35:26Z–00:41:51Z for the S2-16 builds.
  - iOS driver: received from Stream 3 at 00:44:54Z, then passed to Stream 3 before 00:48:26Z for their header check. Stream 1 is next.

**Mail journey — native afters, 2026-09-26 ~00:10Z (supersedes the "~22:15Z" native bullet above)**

- **Native PR** [445](https://github.com/WangPantopus/skinny-pantopus/pull/445) on branch `claude/stream2-native-mail-list-controls`, head `352202313`, on master `9ec9b18f0` (includes merged #435).
  - List fix (S2-22), Dismiss close/drop (S2-11), S2-08 native (Archive works, dead menu items/tiles hidden), drawer badge refetch, Android NonCancellable action handling.
  - Backend: `/drawers` counts incoming only; `vault/file` 500 on a failed write.
  - 17 Paparazzi baselines were refreshed, only where controls were removed (each >0.1%); drift-only baselines were left untouched.
- **Real-app afters** (Android APK `f6a41a64…`, iOS dylib `1a39334c…`): A1–A6 and I1–I7 passed; S2-08 Archive menu/tile success and 503 passed on both apps.
  - Found and fixed during the afters, re-checked on the rebuilt apps (APK `5e4581cc…`, iOS dylib `b9d8fa43…`, built from content identical to the PR head):
    - an Android slow-Dismiss+Back stale row;
    - a badge that never refreshed.
  - Bundle: `.pantopus-recovery/audits/20260925-stream2-native-mail-list-controls-r1`, MANIFEST `8faf5d29178ef64a68240b88015e5492c829e7349a0cc252549bd9392ad79b18` (252 files).
- **Fixtures:**
  - All 25 `S2-Mail-List` letters were restored (delivered, unarchived).
  - Retained: new MailEvent/MailAction audit rows (ids in the bundle) and the owner's five system VaultFolders.
  - Created and retained, all outside the owner's Incoming:
    - member letters `b8978998` (certified) and `7d555b15` (package), with MailRoutingQueue `9f465b4d` and MailPackage `6154b730`;
    - archived owner letters `9f54982e` (ceremonial) and `a9ad531a` (unboxing), with MailPackage `92e280f6`.
- **Next:**
  - `claude/stream2-native-mail-s2-16` `0a21baa5e` (unpushed) (S2-16: Unboxing and ceremonial dead controls hidden, iOS reply-preview icons made decorative). Needs a build, device afters and ceremonial baselines.
  - **Opened as PR [443](https://github.com/WangPantopus/skinny-pantopus/pull/443)** (head `0e811d563`, on master `9ec9b18f0`). Stream 1's §8.2 source review passed and it is planned as backend batch 16 once CI is green. Bundle `20260925-stream2-mail-write-routes-truth-r1`, MANIFEST `0fdb748295976b6080f069a11e2447103099acacd4ab8a89207f07367acd75b0`. Three commits:
    - certified acknowledge/reject 500 on a failed write (the web uses it; it gave a false "acknowledged");
    - package status 500 on a failed write;
    - resolve/route no longer clears the routing queue or reports "routed" for a letter that didn't move.
    - Each was reproduced with an exact DB fault (unfixed 200 vs fixed 500), and each happy path passed.
- **Dispositions:**
  - S2-04 is moot: no Translate entry on either app, and no generated translation links (only a hand-typed iOS deep link reaches the screen).
  - S2-23 and S2-24 are already fixed on master.
  - Party shelf "Priya" hard-coding is latent (party decode returns nil).
- **Decisions for the user:**
  - Native read state (options A/B/C, pending).
  - Household letters: Archive/Dismiss/Delete act on the shared row for every member, and web Delete is a hard delete.
- **Heavy/iOS:** heavy was released to Stream 1 at 22:51:05Z and again at 00:04:24Z after my 23:53:40Z rebuild window (Stream 1 then held it for its #439 quiet check); the iOS driver was released to Stream 1 at 00:06Z; the iOS driver was first released to Stream 1 at 23:13Z.

**Mail journey (S2-11, S2-22) — state at 2026-09-25 ~22:15Z**

- The September 24 two-file Android draft was recovered verbatim from a private transcript (49+/6-, never built) and then superseded: real befores on current master showed the same failures plus more, so the repair was rebuilt on the existing Pulse/Marketplace append-failure pattern.
- Retained fixture verified in DB `pantopus-stream2-native-resume-r2` (64553/64554): exactly 25 synthetic `S2-Mail-List-01…25` letters (all `delivered`, personal drawer, owner `bb1d5fae…`); MailEvent audits retained, including new rows from this session (IDs in the bundles). No cleanup authorized or performed; temporary lifecycle changes restored by exact predicates.
- **Befores (master 02abf6bd3, real apps):** Android APK `375ce5a5…` — page-2 503×3 replaced all 25 rows with "Couldn't load the list", Try again reloaded page 1 (offset 0); empty tabs read "No mail in Me → Vault yet…"; Dismiss kept the letter open and Back still listed it (S2-11 applies to Android too). iOS dylib `74a2d37f…` — page-2 503 kept rows but left a spinner with only a hidden scroll-away retry; Mail01 Dismiss kept the detail open and Back still listed it; a failed pull-to-refresh wiped the list (contrary to PR333). Web — see PR435.
- **PR [435](https://github.com/WangPantopus/skinny-pantopus/pull/435)** (backend + web, head `e615fc957`, 3 commits on master): item-action write errors now 500 instead of a false 200; drawer route honors the web filter and answers a page past the end as empty; web drawer list fixed (false empty after filter/drawer switch, letters past 20 never loaded, failed/paused first page shown as empty, silent page-2 failure, no `tab` so dismissed letters stayed). Real web + route afters sealed: `.pantopus-recovery/audits/20260925-stream2-mail-list-web-backend-r1`, MANIFEST `aa71b6b240a94ff7cc967c669eb245b69bb30d6ea4e8be2f39778edb8d0ad58c`. CI pending at open.
- **Native commit `ca0bb8aaa`** (Android + iOS, 14 files incl. ListOfRows shells): failed later page keeps rows + "Couldn't load more mail … Try again" for the same offset; stale page can't clear the loading guard; iOS refresh keeps rows; Dismiss closes the detail and Dismiss/File/Save-to-vault drop the row from the open list; honest per-tab empty copy. SwiftFormat/SwiftLint (CI versions) pass; Android static/assemble and both real-app afters **pending** the next heavy window. Depends on PR435's action-error fix. Not yet published.

**Runtime (owned, private):** API 127.0.0.1:18143 (worktree backend, no founder .env, jobs/cron off, loopback-only egress guard), fault proxy 18142, Next 18144; credentials and logs only in the session scratchpad. Android AVD `Pantopus_Home_Recurrence_Acceptance` (emulator-5556) and iOS `6F914A30` are shut down between windows; leases via `/private/tmp/pantopus-tools` with explicit peer messages.

**Open Stream 2 findings (new discoveries unless noted):** native generic letter detail still has dead Archive/Share/Mark unread tiles and menu items (original **S2-08** native half); native apps never mark letters read (V1 detail GET; `mark_mail_viewed` would also move ad payouts — needs a payout-free design); drawer unread badge counts dismissed/filed letters; Android bottom bar highlights Place on every child screen (reported to Stream 1, who owns root nav and is fixing it).

**PR422 original IDs (sent to Stream 1 for the ledger):** S2-05 (web #381 + native #422), S2-15, S2-21 and C-28 closed against their exact criteria; bundle MANIFEST `fbcea869…` rehashed equal.

**Next:** Android + iOS builds of `ca0bb8aaa` → real afters (page-2 retry offset, Dismiss close/drop incl. slow/failed action, empty copy, refresh failure) → seal native bundle → native PR; then S2-08 native (grouped Mail-detail PR) and the read-state proposal; then continue remaining Stream 2 inventory (S2-03/04/06/10/16/17 dispositions to confirm against merged PRs #257/#346/#388).

# CURRENT RESUME SUMMARY — Stream 2 Home and household (September 22, 2026)

This section is the takeover point for another agent. It consolidates existing receipts and the coordinator's current integration state; the detailed historical sections below remain authoritative for individual journeys. Do not repeat accepted journeys, create a second tracker, or infer whole-row closure from a bounded repair.

**Source and integration boundary**

- The original application worktree is `/private/tmp/pantopus-workstream-home`, branch `codex/native-emergency-edit-20260922`, HEAD `ee69cbd8d74367a22fbdfa4d9c4c306d3c662eb3`. It is intentionally unchanged and is 46 commits behind the coordinator's isolated PR192 integration head `ea044ebea7aedfae5c939e65ac1bccd841fc9e47` in `/private/tmp/pantopus-pr192-integration`; do not pull, reset, merge, or re-verify there unless the coordinator assigns that integration checkout.
- **PR192 merged** at 21:12 UTC as `37cb6d2167b1a59e7e77406feda59ca97873927c` after its fresh exact-head CI `35776302859` passed on `ea044ebea7` (all jobs, including Android lint/test/assemble and instrumented). It preserves the accepted Emergency Edit and Delete behavior. The original checkout at `ee69cbd8d` and its installed APK remain the evidence source; that commit is now in master history. The retained `stream2-backend-latest` route patch is identical to the merged route (all 47 added lines match), so the runtime can adopt master at its next restart; keep the backup.
- The sole live status is this file in `/Users/yingpengwang/pantopus-coordination` on `codex/workstream-coordination` (PR174). Coordinator incorporated the complete preserved PR161 status through `4d33f5f5314581b6561efc43089e86822913bb98`; that supplemental docs branch remains open, not a second live tracker. Coordinator owns merge/disposition and shared backlog updates.

**Completed Stream 2 code and contract changes**

- **PR144 → PR154 → PR160 package/bill batch:** merged PR144 `708b0a931` (package edit/manage authorization, own-record gating, In Transit migration/status validation and control visibility) and PR154 `b56fad654` (native package list reload, delivered-package pickup controls, confirmed-write dismissal and stale-error clearing). PR160 merged `6e24aef59` after exact CI `35724788993` (prior native receipt `35719644248`): it preserves historical bill status spellings, fixes Android/iOS bill date and paid/remove receipts, derives native identity/verification from occupancy, repairs D02 media/error handling, D03 standalone bill units, D09 false-empty pets/polls/readers, package lifecycle fields and the existing Home settings viewer labels. Existing screens, layouts and navigation remain intact.
- **PR175/176/178:** PR175 merged `0b1a26cc1` after CI `35728607795`, extending the existing HomeBill PUT allowlist/API type for dashboard-submitted fields; PR176 merged `95016cdbb` after CI `35729368796`, changing the existing web Settings Leave Home caller from admin `/detach` to self-service `/move-out`; PR178 merged `715ccd8c0` after CI `35731690811`, moving the existing mailbox preferences GET/PATCH block before generic `/:id` routing. No replacement screen, service, table or migration was introduced.
- **PR183:** merged `3e8d11dfd` after exact CI `35757736325`; the existing Android guest-pass form acknowledges dismissal after its delay so the existing callback returns to Members/Guests. Real create → Later and Share/Copy chooser → dismissal → DELETE/revoke journeys were cleaned exactly.
- **PR189/191/192 Emergency:** PR189 merged `6bec1e878` after CI `35766200401`; existing Android API/repository bindings now call the existing row-scoped DELETE and retain failed detail state with retry. PR191 merged `2048d9713` after CI `35771470998`; the existing Add Emergency form waits before acknowledging dismissal. PR192's source commits `5f9e6cf7f`, `96fb8ce3f`, `46c27c85d`, `a26545c10`, `ee69cbd8d` add the existing row-scoped PUT route/client binding, server-reload detail refresh, draft retention, untouched location/raw-detail preservation, and malformed/foreign identity response guards. `a26545c10` only aligns the existing regression fixture with the server envelope; no new test case/file was added. PR190 `ea43d92b3` is a coordinator-owned non-Stream2 integration merge; it adds no Stream2 app scope.

**Accepted end-to-end evidence and exact artifacts**

- The current Android APK from `ee69cbd8d` is SHA256 `073e9467e787df1fad93b9d3b28cfaa9db89c7fbaaee30b1e8eea4b850710491`, installed on `emulator-5556`. A populated title-only Emergency edit preserved `location=Cabinet 2`, `phone`, `custom_key` and `detail`; the detail reloaded from the server. A real `home.edit=false` response returned 403 with the draft and SQL unchanged; removing only that override and retrying returned 200. Disposable malformed-type and wrong `id`/`home_id` HTTP 200 readbacks kept the form open with its draft. Final fixture counts were `HomeEmergency=0`, `HomePermissionOverride=0`, `HomeAuditLog=0`.
- Earlier installed Android/iOS package and bill receipts, guest-pass create/Later/Share/revoke, Emergency DELETE, web Leave Home, mailbox route, D02/D03/D09 and PR160 evidence remain accepted within their recorded provider, hosted, synthetic-account and emulator/simulator limits. Key durable manifests include native batch `3302c64717b8cd983679c4e504ccf32bbcb62d244ab98ecfd2fff5bd5208db59`, package native `805d8d448de1d748c9b9af4e29476038bea79371b6bb067c98507ea932b5e211`, guest pass `dc9f2a3c5820a6adaa10e365a2443c2a7c0b1b47bf81995e0f91082f884eb022`, Emergency DELETE `48d996eef15c28b61006603e608f5573beee7975ec6b752a30bc19bc847cd052`, PR176 `753f7626e155727c71da8dd254b3b9fec4e03c09e77b9b772c01e21c38d69c0e`, and PR178 `1c72d93b6eea04b7dc66454df99bb68d7804a53e46d9d9dea138592f63455057`.
- The coordinator-authoritative current PR192 preservation bundle is `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-emergency-edit-preservation-r1/`, 12 files, `MANIFEST.json` SHA256 `9993d82400671c7a5249ac0e8cb159a5c303cfda2b4ba013b663212226ffa5d0`. It contains the recovered 11-file `ee69cbd8d` evidence plus the integration receipt; no journey was rerun for publication. The earlier local working bundle and older audit-root references are superseded for handoff by this path.
- The exact current iOS device build was signed from `ee69cbd8d` at `/private/tmp/pantopus-stream2-ios-latest/frontend/apps/ios/.stream2-device-dd-ee69/Build/Products/Debug-iphoneos/Pantopus.app`; bundle `app.pantopus.ios`, embedded API/socket `http://192.168.0.176:18142`, main binary SHA256 `b57e7d667fc218045f29136bf78429c94b22864c27921669dcb8b22087baa28a`, deep codesign valid. Physical iPhone `00008140-00087999020B001C` remains CoreDevice `unavailable`/4016; no install or launch is claimed.

**Runtime, device and cleanup boundary**

- Retained backend is `127.0.0.1:18143` behind LAN proxy `192.168.0.176:18142`; both health endpoints return 200 with the database connected. Port 18141 is unused. No `xcodebuild`, Gradle or Swift compiler is active; the one-heavy-native-build slot is released.
- Home fixture `f0e51100-0000-4000-8000-000000000200` is reconciled to zero synthetic Emergency, permission-override and audit rows. The existing runtime and provider/hosted boundaries remain labelled; no shared cache, peer runtime, migration ledger or unrelated fixture was removed.

**Authoritative 40-row Home accounting**

The existing inventory is exactly H01–H08, R01–R06, I01–I07, D01–D10, F01–F05 and M01–M04: **8 closed** (H01–H06, R01–R02) and **32 partial/open** (H07–H08, R03–R06, I01–I07, D01–D10, F01–F05, M01–M04). The existing 80-row backlog remains authoritative. The exact 40-row evidence mapping below this summary explains its remaining criteria and must be updated in place when a bounded criterion changes. Current open boundaries include onboarding/provider/lifecycle exit criteria, ownership transfer and residency passes, health/property/weather/calendar consumers, remaining Home mutations and media/unknown-save semantics, settings/privacy/concurrency, external-share hosted lifecycle, Place finance, and private-mail/large-household/neighbor actions. No partial row is closed by green CI alone.

**Precise next actions / no-repeat instructions**

1. Done: the coordinator merged PR192 (`37cb6d216`). Reuse the recorded `ee69cbd8d` installed evidence and the durable bundle; do not rerun Emergency Edit/Delete, guest-pass, bill, package, Leave Home or mailbox journeys.
2. If the physical iPhone becomes available, install the existing signed `.app` against LAN `18142` without rebuilding; until then, physical-device acceptance remains unverified.
3. **Next assigned row: R06 residency letters** (issue, view, public verification, revoke and denial across web/iOS/Android). The exact criterion, existing implementation and resources are in the coordination summary's current resume point. Preserve all current runtime/fixture cleanup and use only the live docs status file for further reporting.


**Earlier implementation groups preserved in this handoff**

| Existing area/source | Completed fixes and evidence to reuse | Publication / limits |
|---|---|---|
| Home authority, identity, residency and lease routes/services/SQL; existing native Home screens | Detail/list projections, per-field grants, current authority, native identity/first use, residency protected commands/receipts, invitations, lease requests and private file readers. Original accepted reports remain linked from the backlog and verification-first reconciliation. | PR32/35/36/37/43/44/45 merged; closed H01–H06/R01–R02 preserved. PR38–42 histories incorporated in43, not discarded. Broader R03–R06/provider/lifecycle limits remain. |
| Browser guest/share and emergency: existing guest page, ShareCenter/ScopedShareModal, Home SDK/routes | Honest expiry/view-limit/scheduled/reissue states, passcode bounds, error/retry, stale-result retirement; actual issue→copy→view→revoke plus real permission/SQL controls. Scoped links, DocsCard share, emergency persistence and download error handling followed. | PR53/60 merged; native/hosted external-share breadth remains D08/M02. |
| Dashboard/standalone audit and members: existing Home tabs and members page | Distinguish read500/403 from empty and retry; permission writes stay tied to selected member; correct existing five-role cycle; retire role/decline/invitation confirmations with caller/session; real request-list and audit failure/retry. | PR102/104/121/123/125/128/131/133 merged. Do not replay accepted UI/HTTP/SQL denial/retry and cleanup; explicit role-choice/product and broader provider panels remain. |
| Home settings/profile/privacy: existing HomeSettingsTab, edit modal, HomePrivacyService/routes, update_home_settings SQL | Recover failed reads before edits; use canonical PATCH/coordinate contract; persist optional clearing; fail closed on privacy read and partial-write pre-read failure; one atomic Home/profile/settings transaction. | PR108/109/110/112/116/118/137 merged. Existing retained-save/lifetime attempt limitations remain explicit; no full concurrent/account-lifetime claim. |
| Home package/bill/issue/pet/poll web panels and native Home models | Package row opens existing editor with current write permissions/status controls; native list/detail/pickup/remove recovery; truthful media handling and errors; canonical bill units/dates/status/paid_by/fields; native occupancy labels; false-empty readers fixed. | PR144/154/160/175 merged. Existing D02 attachments contract and remaining native actions/unknown-save/provider cases are not closed. |

Individual changed paths, source commits, before/after cases, exact SQL cleanup and existing regressions for these groups are preserved below; PR diffs contain the complete changed-file lists. No earlier test history is permission to add new unit tests now.

**Coordinator recovery and runtime qualifications (September22)**

- The peer's handoff was successfully pushed to its existing docs branch even though the task surfaced no assistant/tool output. Coordinator recovered that published work rather than regenerating evidence. The older `native-emergency-edit-r1` mirror was missing at the first check but is now present with16 files and MANIFEST `67224abeddb3f92194dedb785f283bd8b4f4f961e696eee42e710ddf13f466ed`; its common source artifacts match the12-file preservation bundle. Both are preserved; use the latter for the coordinator integration receipt.
- Original Home checkout has untracked `frontend/apps/web/.next-stream2/`; preserve it. `/private/tmp/pantopus-stream2-backend-latest` is detached at `cc885ab2315a289d7b809555dd00f759b1b82511` with a modified `backend/routes/home.js` and `home.js.before-emergency-edit` backup. This is the retained local runtime patch, not an unpublished feature to discard. Compare its exact route patch to accepted192 before adopting later source; do not reset it or start a duplicate runtime.
- Native SQL64554/PostgREST64553 retains59 ledger rows and the explicitly noncanonical22000 boost-column/index overlay described below; never rewrite this ledger or claim a full latest replay. Preserve existing synthetic fixture accounts/occupancies/bills; zero Emergency/override/audit cleanup does not mean the whole runtime database is empty.
- Stream2 has explicitly released the heavy native slot in its published handoff. Coordinator has not reassigned it; no build is authorized during this documentation consolidation. Idle Gradle/Kotlin daemons are not an active build and were not killed. API18143/LAN proxy18142 are intentionally retained. Historical `/api/health`404 is not a failed health check; use the established health endpoint from the private runtime recipe.
- Devices: Android `emulator-5556`, iOS simulator `6F914A30-8585-4B05-9E05-94441675F10A`; physical iPhone unavailable/CoreDevice4016. Private operational resume is `/private/tmp/pantopus-workstream-home/.stream2-verification/RESUME-2026-09-22.md`. Never print its credential-bearing companion files or proxy request logs.

**Verified current evidence references**

| Existing evidence bundle | Files checked | MANIFEST SHA-256 |
|---|---:|---|
| [20260922-stream2-home-native-batch1-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-home-native-batch1-r1/MANIFEST.json) | 97 | `3302c64717b8cd983679c4e504ccf32bbcb62d244ab98ecfd2fff5bd5208db59` |
| [20260922-stream2-package-native-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-package-native-r1/MANIFEST.json) | 30 | `805d8d448de1d748c9b9af4e29476038bea79371b6bb067c98507ea932b5e211` |
| [20260922-stream2-media-discard-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-media-discard-r1/MANIFEST.json) | 16 | `102f6979a5bf99979eb98a6152314631939d67b0a90d085239fa2eeae7c5be3d` |
| [20260922-stream2-bill-units-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-bill-units-r1/MANIFEST.json) | 10 | `215707aa9eaa607f4bdd57692d5906ec496cffa6c74849083dc667bd693f6f29` |
| [20260922-stream2-package-delivered-at-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-package-delivered-at-r1/MANIFEST.json) | 12 | `08dfb466c794556271c7e72b7b318cf95e9aeec190304775967cef3b63b5e865` |
| [20260922-stream2-false-empty-readers-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-false-empty-readers-r1/MANIFEST.json) | 14 | `b6c12b6f2dc470f26a7d32b8afc4eda7e29d076accd1ababc7b39444ee3f27c5` |
| [20260922-stream2-home-leave-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-home-leave-r1/MANIFEST.json) | 7 | `753f7626e155727c71da8dd254b3b9fec4e03c09e77b9b772c01e21c38d69c0e` |
| [20260922-stream2-mailbox-preferences-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-mailbox-preferences-r1/MANIFEST.json) | 4 | `1c72d93b6eea04b7dc66454df99bb68d7804a53e46d9d9dea138592f63455057` |
| [20260922-stream2-native-guest-pass-dismiss-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-guest-pass-dismiss-r1/MANIFEST.json) | 16 | `dc9f2a3c5820a6adaa10e365a2443c2a7c0b1b47bf81995e0f91082f884eb022` |
| [20260922-stream2-native-emergency-delete-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-emergency-delete-r1/MANIFEST.json) | 6 | `48d996eef15c28b61006603e608f5573beee7975ec6b752a30bc19bc847cd052` |
| [20260922-stream2-native-emergency-dismiss-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-emergency-dismiss-r1/MANIFEST.json) | 6 | `0eddbb79b71f81217caaaa67f8c4ed4eb8f74b77879dd0ff1a1e2abe7566819c` |
| [20260922-stream2-native-emergency-edit-preservation-r1](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-emergency-edit-preservation-r1/MANIFEST.json) | 12 | `9993d82400671c7a5249ac0e8cb159a5c303cfda2b4ba013b663212226ffa5d0` |

Earlier September21 audit/member/settings/privacy/confirmation/package bundles remain linked below with their original hashes and limits. The handoff integrity pass found no missing or changed listed file in96 checked bundles; it did not repeat product verification. Older “pending”, “current” and runtime paragraphs below are chronological evidence, not instructions overriding this summary.

## September 22 native Emergency Info edit — focused persistence and response-integrity repair verified end to end

The retained Android owner flow reproduced a concrete persistence gap after the accepted PR191 dismissal repair: Home dashboard → Emergency info → existing row → Edit opened the existing form, but `submitEdit` only committed a local draft. There was no Android PUT binding and no backend update route, so the change could not survive a server reload. Source comparison found the existing Home Emergency POST/DELETE route, DTO shape, form, detail route and shared web client; an in-place extension was sufficient and no new screen, service, table or migration was justified.

PR192 (`codex/native-emergency-edit-20260922`, commits `5f9e6cf7f`, `96fb8ce3f`, `46c27c85d`, `a26545c10`, and `ee69cbd8d`) adds the row-scoped `PUT /api/homes/:id/emergencies/:emergencyId`, reuses the existing Android DTO/API/repository, submits edits through the existing form, retains the draft on failed requests, reloads the existing detail on route resume, and exposes the same established PUT contract through the shared web SDK. `a26545c10` only aligns the existing edit regression fixture with the server-save envelope; no new test case or test file was added. Existing layout, styling and navigation remain unchanged.

The first populated-row review found a concrete preservation failure: changing only a title sent `location:null` and only the visible `detail` key, losing the untouched location, phone and custom key in SQL. The in-place repair carries the existing location and raw details through `EmergencyFormDraft`, merges only dirty visible keys, preserves legacy projections, and refuses to dismiss on malformed or identity-mismatched successful readbacks.

The exact current APK (commit `ee69cbd8d`, SHA256 `073e9467e787df1fad93b9d3b28cfaa9db89c7fbaaee30b1e8eea4b850710491`) was assembled with `:app:assembleDebug --no-daemon`, installed on `emulator-5556`, and exercised through the real owner UI and LAN backend. On a populated synthetic row, title-only edit returned HTTP 200 with `location=Cabinet 2` and all existing detail keys preserved; the detail screen reloaded the title. A temporary `home.edit=false` override produced HTTP 403 with the draft retained and SQL unchanged; removing only that override and retrying returned HTTP 200 and again preserved all untouched fields.

The exact current iOS head was also built in the isolated checkout `/private/tmp/pantopus-stream2-ios-latest` from `ee69cbd8d`. `xcodebuild -sdk iphoneos -configuration Debug` completed `BUILD SUCCEEDED`; deep code-sign verification passed, bundle `app.pantopus.ios`, and the embedded `PantopusAPIBaseURL` is `http://192.168.0.176:18142`. The artifact is `/private/tmp/pantopus-stream2-ios-latest/frontend/apps/ios/.stream2-device-dd-ee69/Build/Products/Debug-iphoneos/Pantopus.app`, main binary SHA256 `b57e7d667fc218045f29136bf78429c94b22864c27921669dcb8b22087baa28a`. CoreDevice still reports the paired iPhone unavailable (4016), so no physical install or launch is claimed.

Two disposable response-integrity journeys used the same rebuilt app and exact row-scoped caller. A proxy changed a valid HTTP 200 readback to an invalid `type`; the form stayed open with the draft retained. A second proxy changed only the returned `emergency.id` and `home_id` to foreign values; the form again stayed open instead of dismissing or accepting a foreign row. The server-side synthetic updates and all helper rows were then deleted by exact id. Final retained counts for the fixture home are `HomeEmergency=0`, `HomePermissionOverride=0`, and `HomeAuditLog=0`; loopback and LAN health are HTTP 200/database connected.

Durable sanitized evidence is `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-emergency-edit-r1/`, current `MANIFEST.json` SHA256 `67224abeddb3f92194dedb785f283bd8b4f4f961e696eee42e710ddf13f466ed`. It includes the prior loss reproduction, rebuilt preservation/denial receipts, malformed and identity readback boundaries, screenshots, APK hash and cleanup. Exact-head CI run `35764090022` completed successfully, including Android lint/test/assemble, instrumented tests, backend/web/database and safeguards; iOS and Seeder were correctly skipped by path detection. The physical iPhone remains unavailable to CoreDevice (4016/unavailable), so no physical iPhone install or launch is claimed. The backend is available at `192.168.0.176:18142` for a connected device.

**Bounded handoff receipt:** The sanitized local bundle at `/private/tmp/pantopus-workstream-home/.stream2-verification/evidence/20260922-native-emergency-edit-preservation-r1/` and the 16-file durable bundle have identical bytes for every common artifact; no durable file was missing and no journey was rerun. The coordinator also verified the unchanged 11-artifact mirror at `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-emergency-edit-preservation-r1/`, MANIFEST SHA256 `224096ef2d8be6fc42133397140131aef8f663eb7c8e0c58c0170d96e6e4521e`. Current source is `ee69cbd8d74367a22fbdfa4d9c4c306d3c662eb3` on `codex/native-emergency-edit-20260922`. Accepted limits remain the unavailable physical iPhone and the synthetic local fixture/provider boundary. Final fixture cleanup is `HomeEmergency=0`, `HomePermissionOverride=0`, `HomeAuditLog=0`; loopback/LAN health are HTTP 200/database connected. No native build is active and the heavy-build slot is released.

## September 22 exact Home/residency/records/mail accounting — existing 40-row inventory

This is the requested reconciliation of the existing Home slice of the 80-area
backlog: H01–H08, R01–R06, I01–I07, D01–D10, F01–F05 and M01–M04. It is an
accounting of current evidence and remaining acceptance boundaries, not a new
tracker or a claim that partial workflows close a whole row. The slice is **8
closed and 32 partial/open**. The eight closed rows are the existing H01–H06 and
R01–R02 receipts; every other row retains an explicit boundary below.

| Row | Current disposition and bounded evidence | Remaining boundary before row closure |
|---|---|---|
| H01 | **Closed — verified/preserve.** Existing detail/property authority and held-result retirement receipts are reused. | None within the recorded H01 scope; release-wide gates remain separate. |
| H02 | **Closed — verified/preserve.** Existing list authority, safe errors and held-result retirement receipts are reused. | None within the recorded H02 scope. |
| H03 | **Closed — verified/preserve.** Existing explicit projections and retryable detail/list/occupant reads are accepted. | None within the recorded H03 scope. |
| H04 | **Closed — verified/preserve.** Existing per-field grants, household references and current roster are accepted. | Managed history and peer ownership remain separately gated outside H04. |
| H05 | **Closed — verified/preserve.** Existing native identity, ownership, residency and current-access receipts are accepted. | Broader onboarding/first-use boundaries remain H07/H08/U01/U02. |
| H06 | **Closed — verified/preserve.** Existing guarded deletion eligibility and occupancy/null behavior are accepted. | Broader member onboarding remains H08. |
| H07 | **Partial/open.** Admission, invitation, task and native/browser recovery receipts are reused; recent native Home repairs do not change the row boundary. | New-account/provider/lifecycle exit criteria and remaining onboarding combinations. |
| H08 | **Partial/open.** Owner/applicant/private-setup lists, selected-address and recipient decision paths are evidenced. | Broader new-account, provider and onboarding/verification exit criteria. |
| R01 | **Closed — verified/preserve.** Prepared residency review, protected originals/receipts, decisions, restart and access retirement are accepted. | Release-wide gates remain separate. |
| R02 | **Closed — verified/preserve.** Atomic submission, lock races, selected-address fencing, populated preservation and legacy compatibility are accepted. | Historical-binary UI, hosted adoption and broader applicant/reviewer lifecycle remain outside R02. |
| R03 | **Partial/open.** Backend/browser/iOS/Android removal and current D10 self-leave use existing protected routes and receipts. | Complete re-entry, old unsubmitted reviewer originals and remaining occupancy lifecycle. |
| R04 | **Partial/open.** Existing ordinary claim/review and relationship milestones are reused. | Ownership transfer, challenge/dispute and recovery paths. |
| R05 | **Partial/open.** Existing lease approval/end/move-out/request repairs and native receipts are reused; PR176 only repairs the Home Settings caller. | Remaining lease attachment/provider/lifecycle combinations and broader release acceptance. |
| R06 | **Partial/open.** No new closure evidence in this stream. | Residency pass/letter issue, view, revoke and public verification. |
| I01 | **Partial/open.** No new closure evidence; current Home work does not establish checklist generation/cache freshness. | Health-score lag and uncertain-save recovery after checklist generation. |
| I02 | **Partial/open.** Existing malformed-card/read evidence is reused. | Nested row validation, metadata, generation races, carryover/history and pagination. |
| I03 | **Partial/open.** No new closure evidence. | Seasonal checklist hire/correct-gig linkage and original-intent recovery. |
| I04 | **Partial/open.** D03 bill date/amount bounded repairs are accepted; they do not close calendar policy. | Local date rules, dashboard boundaries, recurrence and DST transitions. |
| I05 | **Partial/open.** Existing property/detail readers are preserved. | Provider/data acceptance, stale cache, absent/wrong-property and verification wording. |
| I06 | **Partial/open.** No new closure evidence. | Weather, air quality, alerts, daylight and civic sections across geography/provider states. |
| I07 | **Partial/open.** Individual stale-reader repairs are recorded, including D09 response-integrity controls. | Mounted-view/cache invalidation without navigation, timeline labels and pagination. |
| D01 | **Partial/open.** Package permission/status controls, Emergency PUT/DELETE and guest-pass repairs are real end-to-end; PR192 is the current preservation milestone. | Issues and remaining Home-entity mutations, receipts and complete create/edit/delete coverage. |
| D02 | **Partial/open.** Existing panel error/draft retention is reused where verified. | Embedded issue/bill/package media, silent write failures, cancellation and unknown-save cases. |
| D03 | **Partial/open.** Standalone bill-unit/date behavior and package `in_transit` contract are repaired and evidenced. | Final cross-client/server contract and remaining native/provider boundaries. |
| D04 | **Partial/open.** No new closure evidence. | One truthful lifecycle across HomeMaintenanceLog/HomeIssue and competing readers/writers. |
| D05 | **Partial/open.** Settings read/save, permission, atomic and response-lifetime evidence is recorded. | General settings recovery, concurrent edits, retained intent, privacy and explicit clearing across clients. |
| D06 | **Partial/open.** Home privacy read-failure repair and actual consumer recovery are recorded. | Every exposed privacy control and all native/other consumers. |
| D07 | **Partial/open.** Invitation send/decline/role/audit and mailbox-preferences route repair evidence is recorded. | ShareCenter, Members/Security and provider-panel empty/error states plus explicit role choice. |
| D08 | **Partial/open.** Browser M02 share lifecycle and Android guest-pass issue/revoke/share evidence are accepted within limits. | Native/hosted external-share expiry, exact-resource scope, account changes and storage lifecycle. |
| D09 | **Partial/open.** Pets/polls false-empty routes and page retry behavior are repaired; PR192 readback guards malformed success. | Remaining malformed-success readers and complete cross-client verification. |
| D10 | **Partial/open.** Real Settings self-leave now uses the existing `/move-out` transaction and was restored cleanly. | Household delete/linked-resource cleanup across history, files, balances and live obligations. |
| F01 | **Partial/open.** Home bill cards are covered by D03 evidence only. | Place overview/detail across web/iOS/Android, fractions, currencies, periods and totals. |
| F02 | **Partial/open.** Existing privacy/error distinctions are reused where recorded. | Place financial failures, source absence, access retirement and joint Home/Place privacy. |
| F03 | **Partial/open.** Home bill create/edit/delete boundaries are recorded. | Place bill splits, malformed input, currency changes and permission-limited actions. |
| F04 | **Partial/open.** No new closure evidence. | Contributor eligibility, withdrawal/deletion, freshness, scale and retention. |
| F05 | **Partial/open.** No new closure evidence. | Final legacy/current bill format integration, worker deployment and safe schedule retirement. |
| M01 | **Partial/open.** Existing mailbox route and preferences route contracts are preserved; PR178 repairs route ordering only. | Private-mail recipient/attention/privacy/trust, membership state, errors and exact-content returns. |
| M02 | **Partial/open.** Browser guest-pass issue/view/revoke/time-window/view-limit journey and Android create/Later/Share/revoke are accepted; copied/public-page and provider limits are labelled. | Complete native/hosted guest flow, exact copied-link/public rendering and broader external-share acceptance. |
| M03 | **Partial/open.** Existing pagination/read receipts are reused where recorded. | Large-household/history ordering, performance and cross-resource scale checks. |
| M04 | **Partial/open.** No new closure evidence beyond the mailbox route repair. | Reachable conversions, translations, signing, physical-mail and neighbor-request behavior. |

## September 22 native Emergency form dismissal — focused repair verified, PR191

The retained Android owner flow reproduced a second Emergency contract failure after a successful Save: Home dashboard → Home health **Add contact** → Emergency info → Add info → valid Other entry. The existing `AddEmergencyInfoFormScreen` acknowledged `state.shouldDismiss` before its 400 ms delay, cancelling its own effect before `onClose()` ran. Two Save attempts therefore produced two real POSTs and two identical `HomeEmergency` rows while the form remained open (SQL 0 → 2). Source comparison found no alternate Emergency implementation; the accepted Guest form repair `83f507457` already uses delay before acknowledgement.

PR191 (`codex/native-emergency-dismiss-20260922`, commit `016a77b3e`) makes the one-line in-place repair: wait the existing 400 ms, acknowledge dismissal, then invoke the existing close callback. No layout, styling, navigation destination, route, service, schema, migration or test file changed.

The repaired app was rebuilt with `./gradlew :app:assembleDebug --no-daemon` (BUILD SUCCESSFUL, 2m44s; 43 tasks), installed on retained `emulator-5556`, APK SHA256 `f4c70c6868d612b1dd7d0a996cf4081f975a98a856152d2a3b49ddc73d0657ff`. A real owner Save for `Stream2 dismiss fixed` / `Dismiss test detail` returned to the existing list with **All 1 / Contacts 1**, and SQL showed exactly one row. The earlier duplicate rows and this repaired synthetic row were deleted by exact id; final `HomeEmergency=0` and `HomeAuditLog=0`, with loopback/LAN backend health 200.

The same installed journey also observed the existing Emergency **Edit** path: it opened the seeded form but returned to unchanged detail with no PUT request or SQL change because the backend has no `PUT /api/homes/:id/emergencies/:emergencyId` route. That remains a separate explicit contract gap; PR191 does not claim or repair it.

Durable sanitized evidence is `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-emergency-dismiss-r1/`, MANIFEST SHA256 `0eddbb79b71f81217caaaa67f8c4ed4eb8f74b77879dd0ff1a1e2abe7566819c`. PR191 CI is pending; no native build is active and the heavy slot is released.

## September 22 native Emergency Info DELETE — focused repair verified end to end

The retained Android owner flow reproduced a concrete persistence defect in the existing Emergency Info screen: Home dashboard → Emergency info → row → Delete → confirmation → Delete returned to the list, but the original `EmergencyInfoDetailViewModel.confirmDelete` only toggled local Compose state. Two real synthetic `HomeEmergency` rows remained in SQL. Source comparison found the existing backend `DELETE /api/homes/:id/emergencies/:emergencyId` route in `backend/routes/home.js` (home-management authorization, row-scoped delete, 200/404 behavior), but no Android Retrofit or repository binding in current, archived, or open refs.

PR189 (`codex/native-emergency-delete-20260922`, commits `0cbb505fe` and `5820dbb40`) makes the smallest in-place repair: it binds that existing route in `HomesApi` and `HomesRepository`, commits the local deletion only after a successful response, and keeps a failed detail loaded with newly wired functional server-error feedback and retry, rendered with the existing detail-screen typography. The existing screen layout, navigation, backend route, schema and migration history remain unchanged. No new screen, service, table, migration or unit test was added.

The repaired app was built with `./gradlew :app:assembleDebug --no-daemon` (BUILD SUCCESSFUL, 2m45s; 43 tasks), installed on retained `emulator-5556`, and exercised through the real owner UI, backend and SQL. Cancel kept the detail open with count 2. Two successful confirmations for two distinct rows used the repaired caller and existing DELETE route, returned to the list, reduced `HomeEmergency` 2 → 1 → 0, and rendered the existing `No emergency info set up` state. For the error path, one row was created through the UI, only the owner's temporary `home.edit` and `security.manage` overrides were disabled, and Delete returned the existing safe `You don't have permission to do that.` message while the detail and SQL row remained. Removing only those overrides and retrying deleted the row and returned to the empty state. Final retained fixture counts are `HomeEmergency=0`, temporary `HomePermissionOverride=0`, and `HomeAuditLog=0`; loopback and LAN backend health are HTTP 200/database connected.

Installed APK SHA256 is `691a3ac059660f3880e805d18d0061544d8f547104ceb808d9bd277df6b54fa3`. The existing `EmergencyInfoDetailViewModelTest` was updated only to stub the new successful repository contract (no new test was added), and the focused test run passed. Sanitized source/build/UI/SQL/cleanup evidence is durable at `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-emergency-delete-r1/`, MANIFEST SHA256 `48d996eef15c28b61006603e608f5573beee7975ec6b752a30bc19bc847cd052`. The first PR189 run 35746587131 had Android instrumented, database, deployment and detect green but exposed that stale fixture. Fresh run 35750020370 for `5820dbb40` is fully green: Android lint/test/assemble, Android instrumented emulator, database replay/lint, deployment safeguards, detect, and the aggregate CI OK; unrelated surfaces were correctly skipped. Its local Android build and real installed journey are complete. The physical iPhone remains unavailable (CoreDevice 4016), so no iPhone install or launch is claimed. The heavy native-build slot is released after this verification.

# Stream 2 — Home and household

## September 22 native Android guest-pass form — focused dismiss repair rebuilt and verified

The retained Android owner journey reached the existing Home Members → Guests → Add a guest form. A valid real submission created one `HomeGuestPass` row and one existing `guest_pass_created` audit, then showed the existing **Guest pass created / Share this pass now?** dialog. Tapping the existing **Later** action closed the dialog but left the form open. Source comparison found the existing `LaunchedEffect(state.shouldDismiss)` cleared its own key before its 700 ms delay; Compose cancelled that effect before the existing `onSent()` navigation callback could pop the form.

PR183 (`codex/native-guest-pass-dismiss-20260922`, commit `83f507457`) makes the smallest in-place repair in `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/guests/AddGuestFormScreen.kt`: the existing state acknowledgement now runs after the delay, preserving the existing callback, screen layout and navigation. No new screen, callback, route, service, schema, migration or design change was added.

The repaired app was rebuilt with `:app:assembleDebug --no-daemon` (successful, 2m23s), installed on retained `emulator-5556`, and exercised through the real owner flow: Home dashboard → Members → Guests → Add guest → valid two-hour pass submission → existing **Guest pass created / Share this pass now?** dialog → **Later**. The existing Members/Guests screen returned with the Add guest form dismissed, proving the caller callback now completes. The APK SHA256 is `d7e8e07707e356f40d995ccc21cde9274e30c6eecaf83b6c56b2023d43cfa72c`.

The first created pass was revoked through the existing LAN DELETE route (HTTP 200; `guest_pass_revoked` audit), then that synthetic pass and exactly its two generated audit rows were deleted. Final fixture counts were `HomeGuestPass=0` and `HomeAuditLog=0`; backend health remained 200.

The same rebuilt owner app then exercised the existing **Share** action after a second valid two-hour create. The Android system chooser rendered the guest message, a `https://pantopus.app/guest/` link prefix, and Copy to clipboard/Chrome/Drive/Messages targets; tapping Copy returned to the existing Members → Guests screen with the form dismissed. The shell cannot read the emulator clipboard, so exact copied bytes and public guest-page rendering remain covered by accepted browser M02 evidence. That UI pass plus one direct API create probe were both revoked through the existing DELETE route (HTTP 200 each), and exactly their four generated audit rows and two pass rows were deleted; final counts remained zero. PR183 CI run `35736295379` is fully green, including Android lint/test/assemble and instrumented tests; unrelated path jobs were skipped.

The current Stream2 branch was also rebuilt for a physical iPhone in the isolated checkout at `/private/tmp/pantopus-stream2-ios-latest` from commit `83f507457`: `xcodebuild ... -sdk iphoneos -configuration Debug` completed with `BUILD SUCCEEDED`, deep code-sign verification passed, bundle `app.pantopus.ios`, Team `6UYZBA546R`, and the embedded API/socket URLs point to `http://192.168.0.176:18142`. Artifact: `/private/tmp/pantopus-stream2-ios-latest/.stream2-device-dd-current/Build/Products/Debug-iphoneos/Pantopus.app` (main binary SHA256 `d1a159468ed075e5355ba658cb1f2324f8289c0ea3af6bff2c5ebd634b7c4f38`). CoreDevice install was attempted once and returned error 4016 because the physical phone is unavailable; no launch is claimed. Backend loopback and LAN health both remain 200.

The next ordered owner Home read was verified without mutation: Home Settings → Access codes loaded the existing screen with All (0), Wi-Fi (0), Alarm (0), Gate (0), Lockbox (0), “No access codes yet”, and the existing “Add your first code” action. No add/edit/delete action was taken and no fixture or audit row changed.

The retained My Tasks runtime also carries a clearly labelled, disposable compatibility overlay: the existing source migration `20260922022000_restore_existing_gig_boost.sql` (SHA256 `9181c557fca7b8d67a6eb1eb85a524001fb20f907a957f363e01eb2e12065c7c`) was applied outside `supabase_migrations.schema_migrations` to restore the two nullable boost columns and existing partial index required by the unchanged Gig projection. The overlay is **not canonical full replay**; the migration ledger was not edited and has no `20260922022000` row. Catalog checks show both timestamp columns and `idx_gig_boost_active`, with `Gig=0` and `GigBid=0`; direct/LAN My Tasks returned 200 and the owner tabs rendered existing empty states.

Durable sanitized evidence is `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-native-guest-pass-dismiss-r1/`, MANIFEST SHA256 `dc9f2a3c5820a6adaa10e365a2443c2a7c0b1b47bf81995e0f91082f884eb022`. It binds the source/build/API/SQL/cleanup receipts and runtime overlay details. No native build is running and the heavy slot is released. Native copied-link/passcode viewing remains outside this Android receipt and is covered by accepted browser M02 evidence; physical iPhone install/launch remains unavailable while device `00008140-00087999020B001C` is offline.

## September 22 native owner My Tasks — runtime schema compatibility repaired and verified

The retained Android owner journey reached the existing **My Tasks** screen, but the first real load showed `Couldn't load the list` / `Server error 500`. The existing backend route `GET /api/gigs/my-gigs` reproduced HTTP 500 on the same owner token. A disposable development backend isolated the server exception to the existing `GIG_LIST` projection requesting `Gig.boosted_at` while the retained disposable database was still at migration head `20260922010000` and lacked both nullable boost columns; `Gig` and `GigBid` each had zero rows.

The source already contains the additive forward migration `supabase/migrations/20260922022000_restore_existing_gig_boost.sql`, also present on current `origin/master`. I applied that exact existing SQL to the disposable runtime only: `boosted_at`, `boost_expires_at`, and the existing partial index were restored. No application source, screen, SDK, route, service or migration history changed; migration history remains at `20260922010000` because this runtime intentionally does not replay the intervening paid-gig migrations. No fixture rows were inserted or changed.

The real Android Retry control then reissued the same request and rendered the existing empty states: Open 0 / “No tasks posted yet — try Magic Task”, Active 0 / “No active tasks”, Done 0 / “No completed tasks yet”, and Closed 0 / “Nothing here”. Owner direct and LAN-proxy requests returned HTTP 200 with `{total:0,gigs:0}`; the viewer route also returned HTTP 200 with an empty envelope. The same retained owner session rendered the Home dashboard, verified Home Settings, empty Documents state, and the three seeded Members rows (owner, viewer tenant, editor tenant) through existing screens. No native build was started.

Private evidence: `/private/tmp/pantopus-workstream-home/.stream2-verification/evidence/20260922-native-my-tasks-r1/`, MANIFEST SHA256 `0328a6438809cfd91cb46deb613c2e41aae8e473b35b3bcd9212d7cf23352a58`. The temporary diagnostic backend was stopped; retained backend 18143 and LAN proxy 18142 remain healthy. Physical iPhone remains unavailable/offline, so no install or launch is claimed. Provider, hosted, and physical-device boundaries remain open.

## September 22 D10 household self-leave — repaired and verified in the real web journey

The current Home Settings caller used `api.homes.detachFromHome(homeId)` for the member-facing **Leave Home** action. That existing admin endpoint requires a target `userId`: on the retained full-schema native-r1 runtime, a lease-resident viewer's no-body request returned 503 (`Cannot read properties of undefined (reading 'userId')`), and `{}` returned 400 (`userId` required), while all three fixture occupancies remained active. The existing SDK already exposes `api.homes.leaveHome`, which calls the existing self-service `POST /api/homes/:id/move-out` transaction. No new screen, service, endpoint, schema or migration was justified.

PR176 (`codex/home-leave-route-20260922`, commit `ee9e78c5d`) makes that one-caller in-place repair. On the same runtime, the real Settings page was opened in a fresh Chromium context with the synthetic viewer session, **Leave Home** → confirmation **Leave** emitted exactly one `POST /api/homes/f0e51100-0000-4000-8000-000000000200/move-out` (HTTP 200) and navigated to `/app/hub`. SQL showed the existing transaction's occupancy soft-deactivation (`is_active=false`, `verification_status=moved_out`, member task management cleared), plus its existing notification and audit record. The synthetic occupancy row was restored byte-for-byte for the changed fields and only the two generated notification/audit rows were removed. The web type-check gate passes with 0 errors.

Runtime boundary: the retained backend was restarted with the local web origins so the browser's same-origin API proxy passed CORS preflight; no application CORS source change was made. Browser login itself was rate-limited after earlier probes, so the E2E context used the same synthetic GoTrue access token as a bearer header while exercising the actual page and caller. Provider, hosted and physical-device boundaries remain open. Coordinator owns merge and shared backlog disposition.

## September 22 latest native runtime handoff

The physical iPhone `00008140-00087999020B001C` is currently offline, so no device install or launch is claimed. The retained backend is healthy on 18143, with its disposable proxy exposed on the Mac LAN at `http://192.168.0.176:18142` (health 200) for a connected device on the same network. The running backend process was loaded from the accepted PR160 head plus the isolated PR175 bill-field contract and a real owner PUT persisted all expanded fields before the fixture was restored. The latest accepted native branch (`ede5b72b5`, PR160) was built in a detached runtime checkout with the LAN API/socket configuration; `make bootstrap` and an incremental Debug `xcodebuild` for the retained iOS simulator completed exit 0. The retained simulator was not reset or reinstalled. Connect and unlock the iPhone before installing this artifact; physical-device/provider acceptance remains unverified.

## September 22 PR160 CI correction and master rebase — source repaired, full CI green

PR160 branch `codex/stream2-home-batch1-20260922` was rebased onto verified master `69be3c11dc8520aed91228570460487d5579c82d` and force-pushed with `--force-with-lease`; current head is `ede5b72b5b774df7a27f559ab581df8e6c930528`. The pre-rebase run 35709144530 reproduced the same production/history spelling split on Android and iOS: fixtures and historical responses use `cancelled`, while the canonical server contract uses `canceled`. Android and iOS bill-list projections now classify both spellings as cancelled, and both bill-detail mutation receipts accept the historical spelling only when validating a canonical remove request. The existing Android settings fixture now supplies explicit `ownershipStatus: "verified"` for its established-home assertion; production settings remains explicit-status-only so absent proof stays unverified. No new tests, screens, migrations or design changes were added.

Fresh run 35715936875 then exposed one additional exact issue: Android detekt rejected `BillDetailViewModel.update` at cyclomatic complexity 18 after the compatibility predicate was added (threshold 18). Commit `ede5b72b5` extracts that predicate into a private helper without changing the receipt checks or accepted status spellings. The exact-head full CI dispatch 35719644248 is now green: iOS lint/build/test bundles and tests on iPhone SE (3rd generation), iPhone 16 and iPhone 16 Pro; Android lint/test/assemble and instrumented emulator; plus the web/backend/database/deployment gates.

The next reachable web contract gap was then reproduced against the retained native backend and SQL before editing: an owner PUT containing `bill_type`, `currency`, `period_start`, and `period_end` returned 200 but silently left those `HomeBill` columns unchanged because the existing route allowlist omitted them, even though the existing dashboard `BillSlidePanel` submits them. The repair is isolated in PR175, branch `codex/home-bill-field-contract-20260922`, commit `501caf65a` from current master; it extends that allowlist in place and widens the existing API client type. No screen, layout, schema, migration or test file was added. Owner verification returned 200 with every submitted field in the response and SQL, the original fixture was restored immediately, and a viewer PUT remained 403 with SQL unchanged. Invalid bill type and malformed date remain rejected by the existing database contract; reversed periods and arbitrary currency text remain accepted because the existing schema defines no corresponding constraint, so no new policy was invented. The dashboard source has no bill-row edit callback, so the existing edit panel remains unreachable without a founder navigation decision. PR160 remains the separate compatibility milestone at `ede5b72b5b774df7a27f559ab581df8e6c930528`.

Evidence and limits: `git diff --check`, SwiftFormat and SwiftLint pass on changed files. Focused Android Gradle regressions (`BillsListViewModelTest`, `HomeFinanceAccessTest`, `HomeSettingsViewModelTest`) pass after the repair. Backend `homeEffectivePermissions` and `homeProfileV2` pass (97 tests) for the isolated bill-field branch, and the web type-check gate remains at 0 errors. The generated-project iOS focused run reached the bill/finance tests and passed the status/finance cases; five pre-existing date-subtitle assertions fail one day early on the retained simulator. Those fixtures use full `T00:00:00Z` timestamps, which are instants and therefore render on the prior calendar day in America/Los_Angeles; they do not exercise the production `HomeBill.due_date` `date` contract. Bare `yyyy-MM-dd` values are parsed in the device calendar (the accepted Sep 30 native evidence remains valid), so no source change is justified. The same run built successfully; changing the process `TZ` does not change the simulator timezone. Master CI run 35714120974 is fully green, including Android unit/assemble; exact-head native receipt 35719644248 is also fully green. The native slot is released. Existing native runtime/devices remain untouched: iOS simulator 6F914A30, Android emulator-5556, backend proxy 18142/18143 and disposable project `pantopus-stream2-native-r1` remain as recorded below. The retained untracked web cache is preserved.

Next: the bounded native bill/settings regressions, generated-project iOS run and bill-field route repair are complete; the retained native Home row list can resume with Issues when the entry-point decision and native driver are available. The source map is complete: iOS reaches Issues through Dashboard `view_maintenance` → Maintenance list → the existing top-bar Issues action → `HomeIssuesListView`; Android has the same `view_maintenance` dashboard callback and `MaintenanceListScreen` → `HomeIssuesListScreen` route, but the retained viewer session exposes no reachable Maintenance/Issues entry in its actual drawer/dashboard state, matching the recorded IA gap. No navigation repair is justified without the founder's entry-point decision. Backend contract is `GET/POST/PUT /api/homes/:id/issues`; viewer `maintenance.view` can read, while create requires `maintenance.edit` or `maintenance.manage` and updates use the existing manage gate. Coordinator owns merge and shared backlog disposition.

## September 22 native batch 1 (bills + D05 on installed iOS/Android) — repaired and verified; STOP received

Branch `codex/stream2-home-batch1-20260922` head 417a464659821e2ee8772a36e69e3c6cfefa7e85 ([PR160](https://github.com/WangPantopus/skinny-pantopus/pull/160)); CI on this head at publication:    2 pass    9 pending (earlier head 46b7df6bd: Android ktlint failed on one line, fixed in 417a464659821e2ee8772a36e69e3c6cfefa7e85; all other jobs passed). Native commits 27b0fcf82, 46b7df6bd, 417a464659821e2ee8772a36e69e3c6cfefa7e85. Paths: `frontend/apps/android/.../homes/bills/{AddBillWizardScreen,BillDetailViewModel,BillsListViewModel}.kt`, `.../data/api/models/homes/BillDtos.kt`, `.../data/api/net/SafeApiCall.kt`, `.../homes/settings/HomeSettingsViewModel.kt`, `frontend/apps/ios/Pantopus/Features/Homes/Bills/{BillDetailView,BillsListViewModel,AddBillWizardViewModel}.swift`, `Features/Homes/Settings/HomeSettingsViewModel.swift`, `backend/routes/home.js` (bill PUT paid_by).

Runtime: disposable full-schema project pantopus-stream2-native-r1 (API 64553, DB 64554, ledger 59), worktree backend on 18143 behind a harness-only logging proxy on 18142, real GoTrue logins (s2-pkg-owner / s2-pkg-viewer, passwords reset through the GoTrue admin API), Home f0e51100-…0200 seeded by psql (owner, lease_resident viewer with maintenance.view/finance.view/docs.view overrides). Installed apps: iOS on simulator 6F914A30 (existing 2026-09-21 build, then r2/r3/r4 rebuilds), Android on emulator-5556 (existing apk, then r2–r5 rebuilds).

Reproduced (real app → real routes → SQL): Android add-bill date picker Sep 30 → Review "Sep 29" → stored 2026-09-29 (UTC-midnight millis converted through America/Los_Angeles); Android Mark paid and Remove bill sent no request at all — proxy showed only GET /me — the added log proved Moshi passed the absent amount into `BillDecimalAdapter.toJson`'s non-null parameter ("Received an unexpected response."); Android and iOS Remove sent `status: "cancelled"` (iOS reached the server: 500 "Failed to update bill" shown as "Server error 500", and the client sent the PUT twice for one tap); iOS Mark paid PUT {status paid, paid_at} 200 but SQL paid_by NULL (route only recorded the payer when the client omitted paid_at); iOS edit review formatted a UTC-parsed due date in the device zone ("Sep 29" for 2026-09-30); both lists only recognised "cancelled" so canceled bills stayed listed; D05: as the lease_resident, Android and iOS Home settings footers read "Stream2 native home · Owner" with a "Verified" chip.

Fixed and re-verified on rebuilt installed apps: Android date Sep 30 → stored 2026-09-30 → detail "Due Sep 30" (r2); Mark paid → PUT 200, SQL paid with paid_by = owner (r3 + backend); Remove → PUT {canceled} 200, SQL canceled (r3), list hides it (r4); footer "Stream2 native home · Lease resident", chip VERIFIED from the viewer's occupancy (r5). iOS Remove → PUT {canceled} 200, SQL canceled, list Paid 1/All 1 (r3); viewer footer "Stream2 native home · Lease resident", chip VERIFIED, My Homes "Tenant · Household access", dashboard "SHARED HOME", health "You don't have access…" (r4). Viewer refusals over the real routes: PUT bill 403, POST bill 403, POST issue 403; Android viewer bill detail is read-only and the list offers no Add a bill. Account switch (Android Log out → viewer login; iOS uninstall keeps the card → "Not you? Remove this account" → viewer login): no previous user's data (drawer identity s2pkgviewer / "Package viewer").

Evidence: owner audit `.pantopus-recovery/audits/20260922-stream2-home-native-batch1-r1/` (97 files incl. manifest, redacted proxy log, decoding-cause log, 48 iOS + 30 Android screens, source diff and bindings), MANIFEST 3302c64717b8cd983679c4e504ccf32bbcb62d244ab98ecfd2fff5bd5208db59. Limits: emulator/simulator only, synthetic accounts on a local project, harness proxy (its first version rewrote Host and broke DPoP login: 401 rendered as "Invalid email or password." — copy observation), no hosted providers/push/physical device, Android Issues screens unreachable for this account (drawer always Personal context, no dashboard tile, Me hub tiles need a bound Local Profile) so native issue journeys were not run; packages not re-run natively (server-only change); tasks/members/guest passes/docs/emergency/calendar/pets/residency native journeys not started. Observations not repaired: Android wizard "1 of 3" label never advances; Android Docs offers "Upload document" to a docs.view-only viewer; hub shows "Verify your home to unlock Pantopus" to a verified lease_resident on both platforms; Today's Pulse prints raw "smoke_season season".

Cleanup/runtime state (STOP order: left running): native project containers up, backend 18143 + proxy 18142 up (PIDs in `.stream2-verification/native/*.pid`), emulator-5556 headless up with r5 installed (viewer logged in), simulator 6F914A30 booted with iOS r4 installed (viewer logged in), fixture rows HomeBill 3 / HomeOccupancy 3 / issues 0 in the native DB, ledger 59; web guest-r1 runtime stopped and cleaned (rows 0, ledger 57); founder's iOS .env restored; no build running. Next: after PR160 CI on 417a464659821e2ee8772a36e69e3c6cfefa7e85, resume the founder's row list with native Issues (Android entry point is a founder decision), then the remaining batch-1 native journeys; resume note `.stream2-verification/RESUME-2026-09-22.md` (START HERE block).

## September 22 D09 false-empty readers — repaired and verified (web + routes)

Branch `codex/stream2-home-batch1-20260922` commit f05d2c5b7 ([PR160](https://github.com/WangPantopus/skinny-pantopus/pull/160)); paths `backend/routes/home.js` (pets/polls GET), `frontend/apps/web/src/app/(app)/app/homes/[id]/{pets,bills,packages,polls}/page.tsx`. Reproduced: with the owned disposable DB's HomePet table renamed and PostgREST's schema cache stale, PostgREST answered 42P01 "relation public.HomePet does not exist" and GET /:id/pets answered **200 {pets: []}** (obsolete missing-table fallback; polls identical in source); the standalone Pets/Bills/Deliveries pages rendered "No pets registered" / "Upcoming (0) … No bills here" / "Expected (0) … No packages here" after a failed read with only a 5s toast (private read500 fault). Dashboard useHomeData already keeps failed lists as errors (unchanged). Repair: the two routes return their existing 500 on every read failure; the four pages keep a loadError and render the existing "Current … could not be loaded. Retry to check current information." copy with a Retry control instead of the tabs/list. Verified: stale-schema pets GET 500, restored 200; pages under read500 show the unavailable copy; Retry after the fault clears restores the list. Owner audit `.pantopus-recovery/audits/20260922-stream2-false-empty-readers-r1/` (14 files incl. manifest), MANIFEST b6c12b6f2dc470f26a7d32b8afc4eda7e29d076accd1ababc7b39444ee3f27c5. Limits: table rename on the owned disposable DB only (restored, ledger 57); polls page fault path source-verified. Cleanup (batch): fixture rows 0, ledger 57, five guest-r1 containers stopped/preserved, harness/Next stopped by PID, ports 18141/18142 free, tab closed, viewport reset. Next: native pass of batch 1 rows on the owned simulator/emulator. Founder question: none new.

## September 22 package delivered_at / vendor_name — repaired and verified (web + route)

Same branch, commit bfa286b24 (PR160); path `backend/routes/home.js` (package PUT). Reproduced through the real Edit Package panel and the standalone Deliveries page: Vendor "Vendor C" + In Transit → PUT 200 but vendor stayed "Vendor A" (allowlist) and delivered_at stayed set, so the in-transit package sat under Expected printing "Delivered 9/22/2026" (API baseline identical). Repair: expected/in_transit/out_for_delivery null delivered_at and picked_up_by unless set explicitly by the caller; other statuses unchanged; vendor_name joins the PUT allowlist (already accepted on POST). Verified: API delivered→picked_up→expected clears both, explicit delivered_at honored, returned keeps delivered_at, vendor-only PUT persists, bogus status 400; UI editor In Transit + Vendor E → SQL in_transit | Vendor E | null | null; standalone page no "Delivered" line; real dashboard read packages_expected 1 / arriving 0. Owner audit `20260922-stream2-package-delivered-at-r1/` (12 files), MANIFEST 08dfb466c794556271c7e72b7b318cf95e9aeec190304775967cef3b63b5e865. Limits: no package audit-log row (pre-existing); native package screens (accepted 2026-09-22) not re-run for this server-only change. Cleanup as above.

## September 22 D03 standalone bill amount units — repaired and verified (web)

Same branch, commit 340185123 (PR160); path `frontend/apps/web/src/app/(app)/app/homes/[id]/bills/page.tsx`. Reproduced on the real page against the real bill routes: HomeBill.amount is numeric(12,2) major units (dashboard BillsList prints "USD 18.25") but the page multiplied by 100 on create (12.34 → stored 1234.00) and divided by 100 on display ($0.18, "$0.76 total due"); due 2026-09-30 printed "Due 9/29/2026"; delete sent status "cancelled" → 500 → "Failed to delete bill". Repair inside the page: send the typed amount unchanged, refuse empty/non-numeric/non-positive amounts before any request ("Amount is required", same rule as the dashboard panel), format through the existing formatHomeBillAmount/formatHomeBillDate helpers, total only across one currency, delete sends 'canceled'. Verified: "USD 18.25 … Due Sep 30", create 12.34 → stored 12.34, "abc"/empty → client toast with no request, 0.005 → stored 0.01, delete → PUT canceled 200 "Bill deleted". Owner audit `20260922-stream2-bill-units-r1/` (10 files), MANIFEST 215707aa9eaa607f4bdd57692d5906ec496cffa6c74849083dc667bd693f6f29. Limits: further local-date rules remain I04; BillsList's hard-coded "$" total unchanged; native bill screens not exercised. Cleanup as above.

## September 22 D02 media discard + silent write errors — repaired and verified (web + routes)

Branch `codex/stream2-home-batch1-20260922` from master 8e04c4db9, commit 6ce4dbfc2 ([PR160](https://github.com/WangPantopus/skinny-pantopus/pull/160)); paths `frontend/apps/web/src/app/(app)/app/homes/[id]/dashboard/page.tsx`, `components/home/{IssueSlidePanel,BillSlidePanel}.tsx`, `backend/routes/home.js` (issue POST). Runtime: owned guest-r1 containers (ledger 57), private harness `.stream2-verification/media-discard-serve.cjs` on 18142 (real issue/bill/package/pet routes, real homePermissions, real homeDashboardService readers incl. the real dashboard read, real PostgREST/SQL; synthetic identity, synthetic task/event collections, private fault switch), Next dev 18141, browser pane. Reproduced in the real panels: Report Issue with `issue-photo-A.png` and Add Bill with `bill-receipt-A.pdf` → POST 201 with no attachment field, photos `[]`/details `{}`, File rows 0, storage 0, no upload request, panel closed, no notice (`void mediaFiles`); Mark Paid under a private write500 → no toast, only console.error; reporter (maintenance.edit) Update own issue → 403 "No permission to manage issues" rendered as generic "Failed to save issue" (SDK rejects with a plain object); viewer with only maintenance.view → POST /issues **201** although every client hides the control. Also verified: Cancel sends no write, dropped reply keeps draft/error/re-enabled button and retry 201, delayed reply + real double click → exactly one POST. Repair: existing toast notice after a successful save with attachments ("… saved, but N attachment(s) were not uploaded: attachments for … are not available yet"), Mark Paid/Pick Up failures surface the server reason via the existing toast, Issue/Bill panels keep the SDK message (PackageSlidePanel pattern), POST /:id/issues requires maintenance.edit/manage. Verified after: viewer POST 403, reporter POST 201 / PUT 403 shown inline, owner saves with files → 201 + notice, Mark Paid 500 → toast + row unchanged, success → row Paid. Package panel: source-identical handler repaired the same way; Sep 21/22 package evidence reused (Pick Up 403 with no toast). Owner audit `.pantopus-recovery/audits/20260922-stream2-media-discard-r1/` (16 files), MANIFEST 102f6979a5bf99979eb98a6152314631939d67b0a90d085239fa2eeae7c5be3d. Regressions: backend Jest homeEffectivePermissions/homePermissions/homeMaintenance/homeProfileV2 4 suites/135 tests; web type-check gate 0 errors (eslint not runnable in this worktree; CI). Limits: synthetic identity, harness-only minted tokens, tab-local visibilityState override after each navigation, files chosen via DataTransfer on the real input, some journeys scripted on the real controls. Not repaired, recorded: bill edit panel unreachable from the dashboard and bill PUT drops bill_type/period/currency; issue PUT requires home.edit while HomeIssue RLS lets the reporter update own rows; behavior change: members without maintenance.edit can no longer create issues through the route. **Open founder question:** should issues/bills/packages support attachments at all? `HomeIssue.photos text[]` exists with no client/reader; bills/packages have no media column; wiring `/api/files/home/:homeId` would be a new contract.

## September 22 packages — iOS and Android end-to-end on the real apps

Founder asked for installed-app coverage. Built both apps from this branch against a disposable full-schema project (`pantopus-stream2-native-r1`, API64553/DB64554, 59 migrations including 20260922010000) with the worktree backend on127.0.0.1:18142, real GoTrue logins for three synthetic accounts (owner, lease_resident viewer, lease_resident editor with packages.edit override) and a seeded Home; package fixtures created through the real routes. iOS: owned simulator "Pantopus Stream2 Packages" (iPhone17, iOS26.5), Debug build with the API pointed at18142. Android: AVD Pantopus_Home_Recurrence_Acceptance, assembleDebug at10.0.2.2:18142 (first two builds died of Kotlin-daemon OOM / lost Gradle daemon while Xcode compiled; --no-daemon with a 7g heap succeeded).

Four native defects reproduced and repaired in place (no new file/screen/test): iOS Packages list loaded once and never reloaded after detail/log mutations (stale "In transit" row after pick-up/remove, pull-to-refresh recovered) — `PackagesListView` now reloads on reappearance via the existing `reloadAfterMutation`; iOS and Android detail disabled "Mark picked up" for delivered packages while enabling it for expected ones — enabled unless picked_up/lost/returned; iOS Remove popped the screen even when the PUT failed, losing the error — closes only after a confirmed write; Android kept the previous error text after a successful retry — success clears `saveError`. Both apps rebuilt and re-verified.

Verified on device: owner list/tabs (in_transit rendered "In transit", counted pending on the dashboard), Log a package POST201 → detail, Mark picked up PUT200 (picked_up_by set), Mark missing → lost, Remove → returned, list refreshed on return; backend stopped → inline "Can't reach Pantopus. Check your connection." on list (Try again) and detail (screen stays, no write), restart → retry succeeds. Viewer on both apps: sees the shared Home and list, Log a package → 403 shown inline with no row, Mark picked up/Remove on another member's package → 403 inline, SQL unchanged; Android permission recovery: after a live packages.manage grant the retry succeeds and the stale message clears. Editor role and duplicate taps are server/source-verified only (API matrix own200/other403; native `isSaving` guards).

Limits: physical devices, hosted providers, push, native audit trail and the native "+"/Mark controls still being offered to members without packages.edit (server refuses; iOS/Android dashboards already hide only the quick actions) are not covered; the emulator ANR'd under host load (adb reboot, slow typing). A `pkill -f "node app.js"` for my transport-error case also killed the peer backend on :8000; it was restored immediately (SUPABASE_URL64521, PORT8000, PGBOSS/CRON off) and is healthy.

Cleanup: my backend, owned simulator, emulator stopped; iOS .env restored; disposable fixture rows zero, ledger59, project stopped with volume preserved; ports18142/64553/64554 free. Durable owner `.pantopus-recovery/audits/20260922-stream2-package-native-r1/`: **30 files plus manifest**, manifest SHA256 **805d8d448de1d748c9b9af4e29476038bea79371b6bb067c98507ea932b5e211** (results, build/backend logs, screenshots, adb driver, four source bindings, diff). PR144 merged as 708b0a931 before these native commits landed, so they are re-based on master as [PR154](https://github.com/WangPantopus/skinny-pantopus/pull/154) (`codex/home-package-native-fixes`, commits3f4b57f67/e4a83faaf); the original branch commit was bd198a7bc. [PR154 CI35686996861](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35686996861) passed all required jobs on the pull_request event, including iOS lint/test bundles/tests on three simulators, Android lint/test/assemble and instrumented emulator tests, complete schema replay and migration safeguards (web/backend/seeder skipped by change detection). Dispatched on that head: [iOS CI35684314458](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35684314458) passed (SwiftLint/SwiftFormat, test bundles, tests on iPhone16 Pro/16/SE) and [Android CI35684316439](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35684316439) passed (lint/test/assemble, instrumented emulator tests); the full [CI35684312462](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35684312462) dispatch passed backend, web, seeder, schema replay and safeguards but its native jobs were cancelled by the concurrency group when those direct dispatches started, so the pull_request run on the synced head is the required receipt.

## September 22 D01/D03 package status and control gating — founder decisions applied and verified

Founder decided: add **In Transit** to the schema; for Pick Up permissions and the ungated expanded-card controls, take the best security and user-experience option, which is to keep the server-side HomePackage policy and hide every package control a member cannot use. Applied on the same PR144 branch as a second milestone, no new file besides the migration, no redesign, no unit tests.

Changes: `supabase/migrations/20260922010000_home_package_in_transit_status.sql` re-adds `HomePackage_status_chk` as a strict superset with in_transit (pattern of 20260916011000, no row/policy/RPC change); package PUT validates status against the seven canonical values (400 instead of 500); dashboard service accepts in_transit in the status filter, counts it as pending and as arriving when its ETA is today; DeliveriesCard gains optional `canAddPackage`/`canEditPackage` props that hide + Track Package, Pick Up and the row pointer/opening, with in_transit in the preview pending filter; dashboard page derives one `canEditPackage` (manage, or edit on own package) for row opening, Pick Up and Track Package; the standalone Deliveries page reads current access and profile with the packages and hides Log Package and per-row pickup/delete without the grant; useHomeData's local pending recount includes in_transit. Native palettes already roll unknown statuses into their In transit bucket, so no native change (source-only, no device acceptance).

Verified on the owned runtime with the migration applied (ledger56→57, retained): API owner PUT in_transit200 persisted, bogus status400, viewer GET?status=in_transit200; PostgREST arriving filter validated directly (0→1 after setting today's ETA). Owner UI: dashboard1 pending including the in-transit package, expanded list labels In Transit, Edit Package→In Transit→Update one PUT200 with row/SQL in_transit, Pick Up on every delivered package. Viewer UI: no + Track Package, no Pick Up, no pointer, row click opens nothing; standalone page no Log Package and no row actions. Editor UI: Pick Up/pointer only on own package, Pick Up PUT200 picked_up, standalone page shows Log Package and only the own card's delete. Typecheck gate0 errors; backend jest7 suites/164 tests pass; one accidental full-suite run showed an order-dependent homeClaimEvidenceRoutes failure that passes alone (11/11), unrelated.

Limits: same visibility-guard override and harness-only minted tokens as the prior section; screenshots trigger dashboard refetches so the journey avoided them; delivered_at is not cleared when a delivered package moves back to In Transit (pre-existing); no audit-log rows for package updates, no optimistic concurrency, no native/hosted acceptance. Required rollout order: **migration → backend → web**.

Cleanup: three owned packages, base fixture, extra synthetic users and override deleted; all owned counts0, ledger57 (applied migration retained), five containers stopped/preserved, tab closed, private API/Next stopped, ports18141/18142/64550–59 free, secrets deleted. Durable owner `.pantopus-recovery/audits/20260922-stream2-package-status-controls-r1/`: **19 files plus manifest**, manifest SHA256 **f3ac437a182e1d0bcd3c800ede1176fea313789a794c5cfc639c5c2caf2c9503**. Pushed as **3cb1e1262** on [PR144](https://github.com/WangPantopus/skinny-pantopus/pull/144) after rebasing onto the coordinator's master merge; [CI35677342761](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35677342761) passed all required jobs (deployment and migration safeguards, backend privacy gates/Jest, Docker image, web lint/typecheck gate/Jest, web E2E, complete schema replay/lint with the new migration; seeder/android/ios skipped by change detection). No merge or rollout performed; coordinator owns integration.

## September 21 D01 package edit entry — repaired and verified in the real UI

Adopted `origin/master` **ed391c3a6** (PR142) on independent `codex/home-package-edit-verification`. Reproduced first on the original route with real getUserAccess/role rows/overrides and SQL: a lease_resident with only packages.view created a package (POST201) and overwrote the owner's package (PUT200); an editor (packages.edit override, not creator) also overwrote it (PUT200); owner PUT status in_transit and an unknown id both returned generic500. The row-click no-op was already reproduced in the frozen baseline (63560e50) and was not repeated.

Smallest repair, three existing files, no new file/helper/table/migration/unit test or layout change: `dashboard/page.tsx` passes a package-aware callback through the existing DashboardTab to DeliveriesCard and opens the existing PackageSlidePanel only for packages.manage or packages.edit on the actor's own package (mirrors homepkg_update RLS); `backend/routes/home.js` POST now requires packages.edit/manage (insert policy) and PUT requires packages.edit/manage, returns404 for an unknown package and403 when a non-manager edits a package they did not create; `PackageSlidePanel.tsx` keeps the SDK's plain-object message (server reason) instead of always "Failed to save package". Typecheck gate0 errors; backend jest6 suites/162 tests (home router + permission suites) pass; web eslint cannot run in this worktree (missing @eslint/eslintrc), CI covers it.

Verified after repair (IAB tab seed, real package API/authority/PostgREST/SQL): API matrix viewer POST403/PUT403, editor PUT other's403 "You can only edit packages you added"/own200, owner (manage) PUT200, unknown404, in_transit still500. Owner UI: expanded Deliveries row opens Edit Package with saved fields; Cancel sends no PUT; edit+Update exactly one PUT200 with row/SQL updated; private put500 fault keeps the panel and draft with the error and re-enabled Update, disarm+retry200; dropped socket recovers the same way with no persisted write; delayed PUT plus double/triple click sends exactly one PUT (Saving... disabled); In Transit shows the server "Failed to update package" with row/SQL unchanged. Viewer UI: row click opens nothing; Pick Up on a delivered package is now PUT403 with no change (no toast captured within3s); the expanded card still renders "+ Track Package", whose create attempt is refused403 and shown inline. Editor UI: another member's row opens nothing, own row opens; saving a stale draft after an owner shell PUT overwrote the carrier (last write wins) while the empty tracking field left the owner's value (omitted, not cleared); revoking the override mid-edit produced PUT403 shown inline with the draft kept, and the existing authority refresh then retired the panel.

Limits: the browser pane reported visibilityState hidden and the app's visibility guard stalled loading, so a tab-local `Document.prototype.visibilityState` override was applied through the debugging console for the viewer/editor sessions only (owner session loaded without it). The CLI project dir was gone and stored keys had expired; harness-only HS256 anon/service tokens were minted from the running PostgREST JWK and deleted afterwards, excluded from the bundle. Synthetic sign-in/rate limits/ancillary collections remain; no native, hosted, provider, audit-log, media, vendor_name, explicit-clear or optimistic-concurrency acceptance. Open items, not repaired: In Transit option versus the six-value HomePackage CHECK (needs a product decision), ungated expanded-card "+ Track Package"/"Pick Up" controls for members without packages.edit, package updates write no HomeAuditLog row, and the existing behavior change that Pick Up now needs packages.edit/manage as the RLS policy states.

Cleanup: deleted only the two owned packages, then base fixture, extra synthetic users and override; all owned counts0, full Home/Owner/Package/Occupancy/Override/Preference/request/invitation/audit state0, ledger56 unchanged. Tab closed, private API/Next stopped, five owned containers stopped/preserved, IPv4/6 ports18141/18142/64550–59 free; no peer/native/cache changes. Durable owner `.pantopus-recovery/audits/20260921-stream2-package-edit-repair-r1/`: **33 files plus manifest**, manifest SHA256 **c2e53fe6ffd75fa6a9aaef11495376b4cb00686e6e5ce1c78ce66930cdbf2664** (harness/cleanup/probe scripts, pre/post responses, before/after/cleanup state, probes, nine source bindings, repair diff, result.md). Candidate **d8b172049** is [PR144](https://github.com/WangPantopus/skinny-pantopus/pull/144); [CI35675692984](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35675692984) passed all required jobs (backend privacy gates/Jest, Docker image, web lint/typecheck gate/Jest, web E2E, complete schema replay/lint, deployment and migration safeguards; seeder/android/ios skipped by change detection). No merge or rollout performed; coordinator owns integration.

## September 21 D01 package edit entry — actual no-op baseline frozen

Under the live README assignment, preserved original branches and created independent **codex/home-package-edit-verification** at unchanged **f4b27786172d7b2cae641b4c94f9e77aa75928c1**. All9 prior package proposal source hashes rebound exactly. No application edit, new unit test, schema change or other accepted journey replay.

Actual IAB27→SDK→Home routes/current authority→canonical package projection/PostgREST/SQL: genuine packageGET200[] rendered no packages. Existing expanded Deliveries Track Package form submitted only **Synthetic package edit baseline** and **USPS**; one POST201 saved expected package **be440c7a-ddc4-4484-9354-bc8c92fe33f6**. All unrelated full Home/Owner/Preference/occupancy/request/invitation/audit/ancillary state matched pre-create. One reload recovered exact saved row through actual packageGET200 and displayed it in expanded Deliveries.

Clicked exact current AX50 package-row container once at1789999148584/8677. Before/after AX and URL are byte-identical; later1789999169687 observation is still identical, with only Home/Deliveries headings and no Edit Package/Close panel. Full before/after-click state exactly equal; only original createPOST201, zeroPUT/status/pickup/otherwrite/provider/blocked/suppressed events. **Existing row-to-editor no-op reproduced.** A preceding read-only selector inspection timed out, then an unavailable local binding failed before UI action; both excluded, with exactly one subsequent successful AX rowclick. No click repetition or edit attempt.

Smallest source direction is existing dashboard/page.tsx callback plumbing: pass existing openPackagePanel(pkg) through DashboardTab to DeliveriesCard. Safe HOME_PACKAGE_LIST already includes created_by. Proposed per-record gate matches existing authenticated RLS: packages.manage OR packages.edit with created_by=currentUserId. No new editor/helper/service/table/migration or visual redesign is justified. **No repair implemented or merge-ready claim:** coordinator requested the following explicit release gates before opening existing edit controls.

- Current service-role PUT calls checkHomePermission without a permission argument, so only current Home access is checked; it neither enforces package edit/manage nor verifies target author/visibility. Service-role client bypasses authenticated RLS. A UI gate cannot establish server authorization. This remains a source finding pending scoped reproduction/repair.
- Edit mode exposes7 status choices: expected, in_transit, out_for_delivery, delivered, picked_up, lost, returned. Existing DB/read filter accepts6 excluding in_transit; PUT has no status enum validation and takes generic500 on DB error. In Transit is an explicit release gate, not an assumed working control. Both iOS/Android existing palettes use canonical expected with display label In transit and lost as Exception; detail actions write picked_up/lost/returned, without the web7-option editor. Native source only, no device acceptance.
- Other existing edit contracts: vendor_name sent but omitted by PUT allowlist; media stripped/discarded; empty text/date omitted rather than explicitly cleared. Panel awaits save before close and retains current mounted draft on rejection, but plain SDK errors become generic Failed to save package. New lifecycle/error/unknown-save/permission/media/status acceptance is not established. Source-only contract note binds7 further current-master-matching native/permission/admin files.

Cleanup: deleted only exactnewpackage before basefixture; allbasecounts/fullHome/Owner/Package/Preference/request/invite/occupancy/audit/ancillary state0, overrides/probeconstraint0. Full existing RPC definition/owner/ACL/effectiveEXECUTE and complete ledger56 unchanged, approved migration retained. Tab27/API/Next closed, five owned containers stopped/preserved, all reserved IPv4/6 ports18141/18142/64550–59 free. New inactive private runner removed after durable capture, no peer/native/cache changes. Source branch clean; no application commit for this runtime-only baseline.

Durable owner `.pantopus-recovery/audits/20260921-stream2-package-edit-baseline-r1/`: **32 files plus manifest**, SHA256 **63560e50faf624c550801842f2b2c2e8b599ca9cb3d863ae4079163f6a32afc0**. Original23 actualbaseline files remain unchanged;9 source/contract appendix files added. Exact private fixture/runner/SQL, originalcaller/projection, API/fullstate/compactactualUI/cleanup/provenance/ledger and repair-gates evidence; all32 hashes verified. Prior12-source/54binding bundle reused. Synthetic sign-in/rate limits/unrelated dashboard collections remain explicit; real relevant package API/authority/projection/SQL. No broader D01/D03/native/hosted/provider/session/concurrency closure. **Frozen for coordinator review; no further runtime/app edit until assigned.**

## September 21 D01/D03 package editing — next source-only proposal

Coordinator captured shorter-lifetime status73d22529; both attempts/source/cleanup remain preserved, with no third attempt or protection/defect claim. Current clean Home branch stays atf4b277861. Read-only remote refresh found masterc689c617 and paid53e738; paid fullCI remains coordinator-owned/pending and this proposal is separate. No branch adoption/application edit/runtime restart/new test.

Selected existing D01 package-edit recovery prerequisite to D03 status reconciliation. Dashboard DeliveriesCard renders clickable package rows but receives **onPackageClick={() => {}}**. Existing useHomePanels.openPackagePanel(pkg), hydrated PackageSlidePanel Edit Package mode, dashboard update handler and SDK/realPUT/PostgREST HomePackage already exist; every current opener invocation passes no package and opens create only. Standalone Deliveries has create/pickup/returned actions, no equivalent editor entry. This is a source lead, **not a reproduced browser failure**. D03 In Transit is indeed a UI option absent from current HomePackage CHECK/read filter, but its edit control is currently unreachable through this caller; do not manufacture a script-only UI baseline or alter status presentation/schema.

Focused9paths×6current/master/paid/staging/design/archive refs=54bindings/53present1historicalmissing. All6 dashboard variants retain no-op package-click wiring. Reuse existing opener/panel/caller/route/table; no new application file/helper/screen/service/table/migration justified. Reused dashboard-current-summary package/status/read-permission and web-dashboard-access-retirement authority/panel evidence within recorded limits; no duplicate Settings/guest/member walks or accepted journeys.

Proposed later runtime-only baseline after assignment/source binding: sameowned18141/18142/64550–59/ledger56/syntheticowner, real packageGET/POST and read service. Existing Track Package creates exactly one synthetic expected package (description/carrier, no media/provider), actual201/completeSQL. Click its exact rendered expanded Deliveries row once and observe whether existing Edit Package opens, with URL/controls/request evidence. No statusPUT/delete/pickup or repeatedcreate; if edit unexpectedly opens, record/close without save. Full package/ownership/occupancy/preferences/audit/ancillary state must remain unchanged by row click. Exact child-first fixture cleanup/RPC+ledger preservation/runtime release. No apprepair before reproduced baseline. Any eventual in-place opener callback wiring must preserve current edit/manage gates and layout; status/media/write-permission/unknown-save concerns remain separate.

Durable owner `.pantopus-recovery/audits/20260921-stream2-package-edit-source-r1/`: **12 artifacts plus manifest**, SHA256 **61d1462666bc0b736480e2e4664e51eabaa7bdbbebe5bbf8c69fe801fbfff299**. Eight complete relevant source files, exact HomePackage baseline excerpt with full-file binding,54binding comparison, reused-evidence report hashes and proposal. All12 verified. **Source-only; no runtime or application expansion until coordinator assignment.**

## September 21 D05 shorter lifetime attempt — intact reply, required ordering unavailable

Coordinator captured prior26a1b0c3 and assigned one shorter attempt. Same clean `codex/home-settings-save-lifetime-verification` at **f4b27786172d7b2cae641b4c94f9e77aa75928c1**, all8 original source bindings unchanged, prior d225/evidence preserved. Only private observer extended with request-arrival and response close/finish records and an automatic untouched200 deadline20s after real commit. SDK30s unchanged. No application/schema/provider/session/native/unit-test change or repeated write.

Actual IAB26 single CUA invocation: prepared A confirmed before arming; Save started1789997877088, disabled Saving controls observed7376, Share screen7521, return Settings7884 showing **Loading settings...**. Placeholder wait stopped1789997881199 with no input/readbackA; no B was entered and no additional interaction/write followed. This supported-CUA wait failure is separate from backend request timing and does not establish an application error.

Real settingsPATCH arrived1789997877164, committed A and one audit; original200 held1789997877254. Automatic delivery1789997897256 (**20002ms**), socketDestroyed=false/responseDestroyed=false; finish1789997897333, writableFinished=true/socket intact, within unchanged SDK30s. First fresh SettingsGET arrived **1789997897336**,3ms after finish; subsequent Settings and dashboard reads returned200. Final UI observed1789997924191 displays **Lifetime short committed A** and **Short committed welcome A** with Save available. No fresh A→unsavedB existed before delivery, so stale-draft behavior remains **unverified**, with neither defect nor inherent protection claimed.

Full response-held, immediately-before-delivery and afterward Home/Preference/Audit/occupancy/request/invitation/ancillary states are exactly equal: A+oneaudit, noBwrite. Exactly one settingsPATCH, zero profilePATCH or other mutation/provider/blocked/suppressed events. Synthetic sign-in/ancillary dashboard and prior unsupported ancillary errors remain explicit limits. No broad D05, concurrency, unknown-commit, hosted/native/session or save-lifetime acceptance.

Read-only attribution: private hook holds only exactPATCH and uses a timer, not a blocking loop or database transaction. During hold, actual guest-pass GETs arrived1789997877528/7585 and completed200 at7583/7634, proving other requests continued. Brief synchronous SQL snapshots occur only at capture/delivery. Existing Settings effect calls SDK GET; inspected SDK apiRequest/request interceptor contains no pending-save queue; Next rewrite is plain and middleware excludes api. No browser dispatch/Next ingress timestamps or matching Next API timing logs were captured. Thus **the precise cause of the Settings request ordering is unproven**; no general SDK/Next/browser serialization conclusion, alternate runtime or application repair.

Cleanup exact base/fullfixture/override/probeconstraint counts0; full RPC definition/owner/ACL/effectiveEXECUTE and full ledger56 unchanged. Approved migration retained. Tab26/API/Next closed, five owned containers stopped/preserved, all reserved IPv4/6 ports18141/18142/64550–59 free. Private inactive runner removed after evidence capture, arm absent; no peer/native/cache changes. Application branch clean, no source commit for this runtime-only boundary.

Durable owner `.pantopus-recovery/audits/20260921-stream2-settings-save-lifetime-short-r1/`: **34 files plus manifest**, SHA256 **dbb46b6654a42d42a9efc571e5d7e9d1f95cbeb6bc59f9e9bcc30c79bc595f74**. Includes original8+three relevant SDK/Next/middleware source bindings, exact private observer/fixture/SQL, actual arrival/response/socket/fullstate records, compact supported-CUA observations, provenance/ledger/cleanup and source-explanation.md. All34 hashes verified; credentials/raw operator logs excluded. Frozen for coordinator capture/review. **No further attempt or alternate browser/runtime started; next scope requires coordinator assignment.**

## September 21 D05 save-lifetime baseline — transport limitation

**Successful late-response behavior remains unverified; no application defect or repair claimed.** Under the new live README assignment, preserved originald225 and adopted assigned finalmaster **f4b27786172d7b2cae641b4c94f9e77aa75928c1** on independent `codex/home-settings-save-lifetime-verification` in the existing Home worktree. All8 relevant source hashes equal the reviewed10-artifact proposal/accepted137 bindings. Original RPC definition/owner/ACL/effective EXECUTE and complete local ledger56 matched before launch and after the journey. No application/schema/unit-test change or accepted atomicity replay.

First private setup attempt checked router-relative req.path when deciding whether to hold a reply, so the real ordinary settings200 was delivered immediately. This attempt is excluded from lifetime acceptance; one save and subsequent unsaved B are preserved in separate records, with exact fixture cleanup and tab24 closure. Corrected only the private matcher to originalUrl; no application defect inferred.

Corrected IAB25 journey: actual Save sent one settingsPATCH200 and committed name **Lifetime committed A** / welcome **Committed welcome A**, existing draft fields and one audit. The untouched successful body was held on the original response. Existing Share→Settings eventually loaded A from actual settingsGET200, and DOM readback confirmed unsaved **Lifetime unsaved B** / **Unsaved welcome B** with Save enabled. A selector transition wait timed out; fresh AX then confirmed Settings loaded. Tool roundtrips/transition delay exceeded the unchanged SDK30000ms setting. Exact response receipt: held1789997340279, explicit release1789997396500 (**56221ms**); both socketDestroyed and responseDestroyed true, no finish event. Therefore no intact late-success delivery was established. Generic browser API warnings are insufficient to independently attribute the precise timeout cause. B remained visible afterward; this is not proof of a success-completion guard.

Full committed state captured in the response, before release and afterward is exactly equal: Home/Preference/Audit/occupancy/request/invitation/ancillary state remains A with one audit and no B write. Exactly one corrected-attempt settingsPATCH, zero profilePATCH, blocked/suppressed/provider events. Synthetic sign-in/ancillary dashboard data and unsupported ancillary access/seasonal/health503, gig404/nearby400 remain explicit limits; not accepted Home Settings defects. No native/hosted/provider/session/concurrency/unknown-commit or broad D05 closure.

Cleanup: exact base fixture counts and full Home/Preference/request/invitation/audit/occupancy/ancillary state zero, overrides/probe constraint zero. Approved RPC provenance and full ledger unchanged; migration56 intentionally retained. Tabs24/25 closed, owned API/Next stopped, five containers stopped/preserved and all reserved IPv4/6 ports18141/18142/64550–59 free. New inactive private instrumentation removed after durable capture, arm/release files absent, no peer/native/cache changes. Application branch clean at f4b277861; no source commit required for this runtime-only unverified baseline.

Durable owner `.pantopus-recovery/audits/20260921-stream2-settings-save-lifetime-baseline-r1/`: **35 files plus manifest**, SHA256 **22fe382e0a84611cc11547cc8179445ff86a502161fc56a88382716d04927f44**. Includes8 source files/binding, exact private fixture/runner/SQL, HTTP/held/delivery/full state, compact actual DOM/AX transcription, complete RPC/ledger/cleanup, excluded setup records and next proposal. Credentials/raw operator logs excluded. All35 hashes verified.

Proposed later timing refinement, **not executed or granted**: unchanged SDK30s, automatic untouched original200 at20s after real commit, register socket events at capture and timestamp request arrivals. Prepare A/controls first; a single bounded CUA call performs Save→fresh pending AX→Share→fresh AX→Settings→fresh committed-A DOM→fill B/readback/enabled Save. No intervening shell/API roundtrip or manual release required. If correct UI sequence precedes intact original200, inspect B/full savedA+oneaudit/no extraPATCH without additional navigation; otherwise preserve unverified limitation and stop. No timeout override/fake result/new schema/test or repair scope. Frozen handoff ready for coordinator review; do not start another attempt until assigned.

## September 21 D05 atomic Settings — merged and frozen for publication

[PR137](https://github.com/WangPantopus/skinny-pantopus/pull/137) merged as **274e6e1c91c9049e855f6fe91e0484deebaedb2c** after exact updated head **bba09eefda263c1d8cdf8fc4c785fa18acfa67fe** passed [CI35601168238](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35601168238). Remote merge/head/CI success independently verified. Original d225 candidate also passed CI35600568312. Four Home application paths remain identical across the coordinator update; original source, real browser/API/SQL evidence and 36-artifact candidate bundle remain fixed. This section supersedes historical pending-CI wording below.

Local application worktree `/private/tmp/pantopus-workstream-home` is clean on `codex/home-settings-partial-verification` at **d225ff1e86e68ba6ff9e14c4ec43587760d0c65d**. No source adoption, new application edit, runtime restart or accepted UI/check replay. Coordinator reports subsequent PR138 merged b946eb9ea99819ffb27f42252cdaab237d02dea0 and local paid integration1f1c353cf529e7df4acdb1a1c5e84f13036e9479 with seven exact source bindings and affected checks passing; final documentation publication and paid publication/required CI remain coordinator-owned, not independently verified by Stream2 here.

Acceptance remains bounded to the recorded atomic-save UI failures/retries, final-audit rollback, permission/validation handling, reload/clearing and labelled HTTP/SQL compatibility cases. Synthetic sign-in/ancillary dashboard collections remain explicit limits. No new native, hosted, provider, session transition, concurrency, unknown-commit or save-lifetime acceptance; no broad D05/Stream2 closure. Required deployment order remains **migration → updated backend → web caller**; no hosted rollout performed.

Recorded cleanup remains preserved: exact fixtures and probe constraint zero, original audit catalog restored, approved candidate RPC and local migration ledger **56** intentionally retained. Owned tab/API/Next closed; five owned containers stopped/preserved and reserved ports released. No resources restarted or cleaned again, no peer/native/cache changes. Next save-lifetime proposal remains source-only, outside this fixed batch and without a runtime assignment. Freeze this status for coordinator capture/publication; coordinator owns shared handoff/backlog and integration.

## September 21 D05 atomic-save CI and next source-only proposal

Coordinator captured frozen candidate status64fabc in65a62c64e. Original PR137 **d225ff1e86e68ba6ff9e14c4ec43587760d0c65d** passed [CI35600568312](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35600568312), including fresh database replay/lint, backend and web gates. Coordinator updated PR137 to **bba09eefda263c1d8cdf8fc4c785fa18acfa67fe** with only five documentation files and reviewed SDK136 client change. Independently fetched and confirmed all four Home candidate paths unchanged; [updated CI35601168238](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35601168238) remains in progress. Original local branch/source/evidence and owned migration ledger56 remain fixed; no independent merge, CI rerun or application push.

Candidate durable bundle now has **36 files plus manifest**: original34 unchanged, with rollout-order.md and settings-atomic-pr-current.md added. PR body also records required rollout **migration, updated backend, then web caller**. Old backend ignores profile fields while saving other settings, so new web must not precede backend capability. No hosted rollout. All36 hashes reverified; historical frozen candidate section below retains its publication-time CI/count wording.

Completed next **source-only** reconciliation in owner `.pantopus-recovery/audits/20260921-stream2-settings-save-lifetime-source-r1/`:10 files plus flat manifest,8paths×7refs=56bindings/50present6historicalmissing. Compares current137/master/paid/staging/design/archive/accepted112, including existing Settings caller, conditional dashboard mount, useHomeData refresh, SDK/route/RPC and reusable CreateGuestPass/MemberDetail generation guards. All10 hashes verified. Existing settings read generation guards do not guard the awaited save continuation; it unconditionally schedules feedback and onHomeUpdate. Parent refresh clears ready state and unmounts panels. An old save response after leaving/reopening Settings may therefore retire a newer unsaved draft. **This is not a reproduced failure or accepted repair.**

Proposed bounded later runtime: after137 integration/final-master rebinding and coordinator assignment, hold only a real successful settings200 response after SQL commit on its original socket; navigate Share→Settings, load committed draftA, enter unsaved draftB, release oldreply, inspect B and extra reads while complete saved state remainsA/oneaudit. Use existing owned fixture/runtime, exact settingsPATCH allowlist and provider blocks; record delivery/socket status rather than fabricate success. Reuse accepted108/112/137 and mutation guards; no duplicate normal/error/atomic journeys, new helper/file/schema/unit test or design changes. If actualfailure is reproduced, propose in-place caller guard/timer cleanup. Late errors/session/Home transitions/concurrency/unknown commit remain separate.

Coordinator fixed next integration batch to136,137 and assigned Stream3 logout repair. This proposal stays outside that batch; **no new runtime or application edits until assigned**. Current application worktree remains clean at originald225; tab/API/Next closed, five owned containers stopped/preserved, fixture counts zero, migration retained. No new cleanup or peer resource changes. Coordinator owns shared handoff/backlog/merge/rollout disposition.

Updated September 20, 2026. Owner: Home stream.

## September 21 D05 atomic Settings — reviewable repair

**Published; required CI queued; stream incomplete.** Clean/pushed `codex/home-settings-partial-verification` at **d225ff1e86e68ba6ff9e14c4ec43587760d0c65d**, [draft PR137](https://github.com/WangPantopus/skinny-pantopus/pull/137), de0finalmaster base. [Exact CI35600568312](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35600568312) queued; no green claim. Exact4path/midtransactionprobe grants followed; separate from paid48702/priorpublication.

- Four paths: existing HomeSettingsTab.tsx sends one settings command containingname/type and existingdraft; safefailureMessage preserves APIerrors. Existing SDK homeProfile.ts addsoptionalname/type. Existing homeIam.js settingsPATCH validatescanonicalname string<=120/empty/null and exact10HOME_TYPES/no nulltype. One new `supabase/migrations/20260921010000_home_settings_atomic_profile.sql` CREATE OR REPLACEs same update_home_settings signature, addingprofilevalidation/assignments. ExistingHome/HomePreference/HomeAuditLog/authority/lock/clearing/defaults/preferences/audit logic preserved; Homeupdated_at triggerretained. NameDBlimitmatches existingJoi UTF16units, includingemoji.101additions/7deletions total. No newtable/service/paralleltransaction/newunit test/designchange; appliedhistory untouched. Forwardmigrationnecessary toextendalreadyappliedfunction safely; deploybeforecaller.
- Reused source11/56bindings, actualpartialsave baseline17 and accepted108/109/112withinlimits. No duplicatefullclearing/validation/UIjourney or unrelatedprofilecallers changed.
- Actual IAB23→SDK→realpermission/routes/RPC/PostgREST/SQL: original changedname/welcomedraft now sends one settingsPATCH. ExactRPC EXECUTEdenial→503 and completeHome/Preference/Audit/occupancy/ancillary unchanged, includingname/updated_at. Exactfunctionprovenancerestored; samecurrentdraftretry→onePATCH200/intendedfields+oneaudit.
- Approvedmidtransactionfault: absent-nameprecheck/fullHomeAuditLog owner/ACL/constraintdefinitions/validatedflags captured; addedonly NOT VALID CHECK rejecting ownedHome f0e51100-0000-4000-8000-000000000100 and home_settings_updated action. ActualUIchangedname/type/welcome/bills→503atfinalauditinsert; fullHome/Preference/Audit/ancillaryexactlyunchanged after earlierwritesrolledback. Droppedonlynamedprobe; completeoriginalcatalog/provenanceequal. SameUIretry→one200/all4intendedvalues+oneaudit. No broadtrigger/function/permissionfault for thisprobe.
- UI121charname400 and currenthome.edit403 eachretainoriginaldraft/show safeerror/leavefullstateunchanged; authorityrestore/retry200/fullreload showsname/Condo/welcome/billson. Existing112 explicitwelcomeempty verifiedthroughcontrolledDOMreadback/onePATCH200/SQL/reloadedsettings. Initialclearinteraction DOM.describeNode timeout thenstaleclick sentnowrite; freshread showedoldvalue, excluded. Only repeatedconfirmedclearaccepted. EightactualUI PATCHes:503,200,503,200,400,403,200,200; foursuccesses/fouraudits. No profilePATCH.
- ActualHTTP/SQL compatibility (labellednonUI):9invalidcasesatbothAPI/DB fullstateunchanged (longASCII/UTF16,numeric/object/array/boolname,null/unknown/numerictype);14validDBcaseswithinrolledbacktransactions (empty/null/maxASCII/maxUTF16name and10types); settings-onlyHTTPclears6fieldswhileomittedname/type/prefsremain;5validHTTPboundarycasesincltrailer thenoriginalvaluesrestoredviaHTTP.24totalsettingsPATCHreceipts,0providers/suppressed/blockedattempts. Existingauthority/preference/audit/clearingSQLbytesoutsideaddedprofilelogiccheckedunchanged. Settings-onlycompatibilitydoesnotclaimproviderdelivery.
- TypeScriptexit0, scopedlintexit0/0errors6existingwarnings, backendsyntax0, whitespaceclean. No newtests. Localforwardmigration committedwithcanonicalledgerrow55→56; samefunctionowner/ACL/signature. Fullfreshschemareplay/requiredCI pending; existingbroadertriggercontract not rerunlocally, approvednarroweractualUIrollbackprobe used. Hosted/native/session/concurrency/unknowncommit/save-lifetimeacceptance remainopen.
- Cleanupall12basecounts0 plusfullHome/Preference/request/invite/occupancy/audit/notification/capability/commands/override0; probeconstraint0. InstalledcandidateRPCprovenance andoriginalauditcatalog reverifiedaftercleanup. Forwardmigrationandledgerentryintentionallyretained inownedDB; nothosteddeployed. Tab23/API/Nextclosed,fiveowncontainersstopped/preserved,allreservedIPv4/6ports18141/18142/64550–59free; temporarylintsymlinkremoved. No peer/native/cachechanges.
- Durable owner `.pantopus-recovery/audits/20260921-stream2-settings-atomic-candidate-r1/`,34files+flatmanifest: exact4sources/binding,privatefixture/probes,realUI/API/fullSQL/validation/migration/provenance/rollback/compatibility/cleanup/PRbody. Baseline17/source11remainseparate. Credentials/rawoperatorlogs excluded. Identity/ancillarydashboardtask/events/counts synthetic; actualsettingsauthority/transaction/SQL.

**Frozen candidate for coordinator capture/review and CI/integration.** SharedSDK homeProfile.ts and homeIam settingsPATCH additivecontracteffects flagged; Stream3client.ts untouched. Coordinator owns merge/schema rollout/sharedbacklog. No broadD05closure or additionalruntimework.

## September 21 D05 changed-profile partial save — actual baseline frozen

PR133 merged **de0ac6ef3c051485b5800a288194ee563396a12a** after exactupdated78f137b72 [CI35597307862](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35597307862) passed. Coordinator captured prior live02b339 in a5357f314. Per runtime-only grant adopted finalmasterde0 on separate `codex/home-settings-partial-verification`, preserved133ref and rebound all8 relevant sources unchanged. Clean appsource/no edit/newtest/native/schema change.

Source11-artifact proposal remains at owner `.pantopus-recovery/audits/20260921-stream2-settings-partial-source-r1/`; all11 hashes checked, manifest SHA256e26b66358d33fc793a9f73d2441090912970d48e054ebad6b89338a55fdae032. Eightpaths×7current/master/paid/staging/design/archive/accepted112 refs=56bindings/52present4missing. Existingcomponent/exacttwohandlers/RPC equal112. Reuse108/109/112 acceptance;112's profile200/settings400 had unchangedprofileinputs, not changed-name atomicity.

Actual IAB22 dashboardSettings GET200 loaded originalname/welcome. Changed validname and welcome text, UIreadback confirmed. Captured fullHome/Preference/Audit/Occupancy plus request/invite/notification/capability/commandstate and exact update_home_settings definition/owner/ACL/effectiveEXECUTE. Transactional directservice_role EXECUTErevoke confirmed effectivefalse. SingleUI Save produced profilePATCH200 then settingsPATCH503. OnlyHome.name and updated_at persisted; oldwelcome/preferences/audits/allotherfullrows/counts unchanged. UI retained both intendeddraft values/enabledSave but showed only Failed to save; heading/sidebar retained oldname. Complete originalRPCprovenance restored immediately.

SamecurrentUI retry sent identical originalprofile/settings bodies→200/200, saved intendedname/welcome plusone home_settings_updated audit; fullreload showsbothvalues. Notificationpreferences/otherentities unchanged. Accepted112 behavior also normalizes pre-existing null local_tips to explicit empty on successfulsave; recorded rather than falsely claiming exactlytwofinalHomefields. Recovery works within this scope; initialpartialcommit violates atomic-save requirement and remains unrepaired.

Privatefixture limits: initial staticdashboardpermissions disagreed with realauthority; then unsupported task/eventstubs blocked load. Both attempts had zeroPATCHes/excluded. Aggregate now uses actualgetUserAccess; unrelatedtask/eventcollections explicitlysynthetic. Firstsetup exactcleaned; secondseedstate preserved. Identity/ancillarydashboard synthetic; actualprofile/settings/IAM/RPC/PostgREST/SQL. No providers/blockedattempts/newnative/hosted/session/concurrency/save-lifetime acceptance.

Proposed smallest atomic direction forreview: extend existing update_home_settings/route/SDK with canonicalname/home_type and send onecommand fromexistingHomeSettingsTab, preserving currentauthority/locks/clearing/preferences/design. No newtable/service/parallelrecords. Anyfunctionextension requires compatibleforwardmigration because appliedhistory must notbe rewritten; no migration/appedit isauthorizedyet. ExistingfailureMessage may convey safeerrors but copyalone doesnotestablishatomicity. Concurrency/unknowncommit/navigationretainedintent remain separate.

Durable owner `.pantopus-recovery/audits/20260921-stream2-settings-partial-baseline-r1/`,17files+flatmanifest: exactcomponent/finalbinding/privatefixture/SQL/HTTP/draft/fullstate/provenance/recovery/cleanup/scope. Cleanupbase12counts0 plus Home/Preference/request/invite/occupancy/audit/notification/capability/commands/override0, originalRPCprovenance verified aftercleanup. Tab22/API/Nextclosed, fiveowncontainersstopped/preserved; reservedIPv4/6ports18141/18142/64550–59 free. No peer/native/cachechanges.

**Actual baseline frozen for coordinator review before any application/schema repair.** Runtime released, no sourcecommit because this milestone changed noapplicationcode. Shared backlog remains open; no independent merge.

## September 21 D07 standalone Audit — reviewable repair

**Published; required CI running; stream incomplete.** Clean/pushed `codex/home-standalone-audit-verification` at **0e91b0cfd3d304762bb8a98031568081f0cd3196**, [draft PR133](https://github.com/WangPantopus/skinny-pantopus/pull/133), a165finalmaster base. [Exact CI35596780993](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35596780993) running; no green claim. Separate later work outside published131/132 and fixed paid48702bc9d. Exact topREADME page-only grant followed; prior baseline unchanged below.

- Sole existing `frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`,6 additions/2 deletions. auditError reset by existing retire; rejected auditRes through already imported safe failureMessage; existing ErrorState/onRetry(fetchData) before empty Audit branch. Successful empty/row UI/styles/navigation, currentaccess/generation/Requests/mutation handlers preserved; handler and Requests result bytes checked identical. No new application file/helper/schema/service/unit test.
- Reused baseline15/source12/63bindings and accepted102 dashboard14-artifact evidence, plus source-bound standalone role/decline/approval/Requests work. No accepted dashboard or mutation journey replay.
- Actual IAB21→SDK→IAM/currentpermission→PostgREST/SQL: genuine audit200empty retains No audit log entries/noerror. Seed one explicitly synthetic auditrow, capture complete state and tableprovenance; directservice_roleSELECT revoke transaction confirms effective table/anycolumnSELECT false. Existing Refresh→actual500/error/no falseempty; keyboard Try Again→second actual500/error still usable. Restore exact owner/tableACL/columnACL/RLS/effectiveSELECT, keyboard retry→200/exactevent/actor rendered. Exact members.manage=false override→actual403/No permission to view audit log, rows and management tabs/Invite absent; removeoverride/keyboardretry→200/exactrow and controls. Fullrequest/invite/occupancy/audit rows and ancillary counts unchanged throughout reads. Zero application mutations/providers/suppressedtransports/blockedattempts.
- TypeScript exit0; scoped ESLint exit0/zero errors15existing warnings; diff clean. Synthetic identity/seeded event/localledger55; no new native/hosted/provider/session/stale-read acceptance. Broader D07 remains open.
- Cleanup base12counts0 plus exactrequests/invites/occupancies/audits/notifications/capabilities/commands/overrides0; completeoriginaltableprovenance verified aftercleanup. Tab21/API/Nextclosed, fiveownr1containersstopped/preserved; allreservedIPv4/6ports18141/18142/64550–59 free; temporary lintsymlinkremoved. No peer/native/cachechanges; runtime released.
- Durable owner `.pantopus-recovery/audits/20260921-stream2-standalone-audit-candidate-r1/`,20files+flatmanifest: exactpage/privatefixture/runner/SQL/initial/fault/denial/recovery/fullstate/tableprovenance/validation/cleanup/PRbody. Baseline15/source12 remain separate. Credentials and raw operator logs excluded.

**Candidate frozen for coordinator capture/review and requiredCI/integration.** No independent merge/sharedbacklog closure or additional runtime work.

## September 21 D07 standalone Audit — actual baseline frozen

Verified PR131 merged **a165506795b7d4919a1ec596d0cd5322de0c2388** after exact45c3 [CI35595309234](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35595309234) passed. Adopted finalmaster on separate `codex/home-standalone-audit-verification`; original131ref preserved, all9 source bytes unchanged from12-artifact Audit proposal. No application edit/newtest/native. Followed conditional runtime-only grant.

Actual IAB20 standalone Members→Audit Log rendered one explicitly seeded stream2.audit_fixture event through real SDK/homeIam/currentpermission/PostgREST/SQL GET200. Captured full request/invite/occupancy/audit rows and ancillary counts, HomeAuditLog owner/tableACL/columnACL/RLS/effective service_role SELECT. Transactional direct SELECT revoke confirmed both effective tableSELECT and anycolumnSELECT false (no inherited/column permission defeating fault). Existing Refresh members→actual audit500 Failed to fetch audit log with members/me/requests200. UI falsely displayed No audit log entries, no error/retry, while exact audit event and all full state remained unchanged. Restored original SELECT immediately; complete original provenance exactly equal. Existing Refresh→200/exactevent/actor rendered again, fullstate unchanged. Zero application mutations, provider calls, suppressed transports or unexpected blocked attempts.

Proposed smallest existing-page repair only: auditError state/reset in existing retire, record rejected auditRes through already-imported failureMessage, existing ErrorState with guarded fetchData retry before empty Audit branch. Preserve successful rows/layout/navigation, existing currentaccess/generation guards and every mutation handler. No replacementcomponent/service/schema/helper/applicationfile/unit test or dashboard replay. Actual candidate trueempty/repeated500/keyboardretry/200 and optional isolated403/restoration subject to exactrepair scope. No app edit yet.

Durable owner `.pantopus-recovery/audits/20260921-stream2-standalone-audit-baseline-r1/`,15 files plus flatmanifest: exactpage/final9sourcebinding/privatefixture/runner/fullSQL/actualHTTP/UI/provenance/cleanup. Prior source12 and accepted102 dashboard14 reused within recorded limits. Synthetic identity/seeded audit/localledger55; no hosted/native/newsession/stale-read acceptance.

Cleanup all12 base counts0, exactrequests/invites/occupancies/audits/notifications/capabilities/commands/overrides0; original table/column/RLS/effectiveprivilege reverified after cleanup. Tab20/API/Next closed; fiveownedcontainers stopped/preserved, reservedIPv4/6ports18141/18142/64550–59 free. Runtime released; clean application branch at a165. Baseline frozen for coordinator review before any application edit; no sharedbacklog closure.

## September 21 D07 standalone Audit — source-only follow-up

PR131 original7d70f45f3 [CI35594780550](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35594780550) completed SUCCESS. Coordinator updated remote to45c3be38b4a8c67b33dbe6a2fdfcbe8bf7a4b6ec with five documentation files only and identical tested page; [updated CI35595309234](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35595309234) is running, not accepted green. Frozen prior live02 c0b4cc99 captured in coordinatorbc0a76357. Original local branch/source preserved; runtime remains released.

Permitted standalone Audit source comparison:9paths×7 current/master/paid/staging/design/archive/accepted102 refs=63 bindings,59present/4historicalmissing. All seven standalone variants assign only fulfilled auditRes and render No audit log entries for empty state. Actual SDK→homeIam.js /audit-log→members.manage helper→direct HomeAuditLog SELECT actorjoin/home/range produces403 on denial and500 on SQL failure. This is distinct from home.js /activity and Requests RPC. No standalone runtime failure has been reproduced yet.

Accepted102 dashboard MembersSecurityTab and exact audit route handler remain byte-identical. Reuse prior bounded14-artifact real500/retry/pagination/403/stale-page evidence; the standalone caller has different existing layout/navigation, so replacing it with dashboard panel is unnecessary. Existing ErrorState/failureMessage and guarded fetchData can support an in-place repair if failure is reproduced. No new application file/table/service/schema/unit test justified.

Durable owner `.pantopus-recovery/audits/20260921-stream2-standalone-audit-source-r1/`,12files plus flatmanifest:9sources/comparison/exactreusebinding/proposal. Coordinator verified12artifacts/63bindings and recorded conditional runtime-only grant in top README. After131merge, adopt finalmaster on separate follow-up and rebind source; only then use owned18141/18142/64550–59/existingfivecontainers. Seed one clearly synthetic auditrow/no business mutation/provider send, actual200/exactrow first. Capture tableowner/ACL/columnACL/RLS/effectiveSELECT; revoke directservice_roleSELECT transactionally only if effectivefalse, otherwise rollback. Existing Refresh→actualaudit500 with members/me/requests200/fullstateunchanged, restore exactprovenance immediately and recover200/exactrow. Clean exactfixtures/release runtime before reporting baseline. No application edits or new acceptance before baseline/exactrepair scope. No dashboard replay/native/hosted/provider/session claim.

**Next action waits for coordinator131merge/finalmaster notification.** Current original131 source, prior acceptance sections and released runtime preserved; no independent merge/shared backlog closure.

## September 21 D07 Requests list — reviewable repair

**Published; required CI queued; stream incomplete.** Clean/pushed `codex/home-request-list-verification` at **7d70f45f39b8602dde592c98cb45164d576e6e96**, [draft PR131](https://github.com/WangPantopus/skinny-pantopus/pull/131), final master747b45754 base. [Exact CI35594780550](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35594780550) queued; no green claim. Later batch outside fixed128/129/130. Prior frozen baseline remains below unchanged.

- Sole existing `frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`,9 additions/3 deletions. Existing requestsError state/retire reset, rejected list through safe failureMessage, existing ErrorState and guarded fetchData retry, no misleading zero during error. Successful count/empty/pending layout, canManage, generation/session guards and navigation preserved. Role/decline/approval handlers byte-identical to base. No backend/schema/new application files or unit tests.
- Reused accepted16-artifact actual list503/falseempty/full-state baseline and12-artifact source/63binding comparison. Existing role/decline/approval/departure evidence remains source-bound; no broad replay.
- Actual IAB19→SDK→router/homeInvitationService→PostgREST/SQL: genuine list200 empty renders Requests(0)/No pending requests; real applicant requestcreation200; exact RPC direct service_role EXECUTE revoke makes effective permission false, subsequent list503 and keyboard Try Again→503 show existing error and no falseempty/zero/actions. Restore exact function definition/owner/ACL/effectiveEXECUTE, keyboard retry→200/exact pending applicant/Requests(1)/existing controls. Current exact members.manage=false override→actual403/access-denied error/no controls; remove override and existing Refresh→200/exact applicant. Full request/invitation/occupancy/audit rows plus notification/capability/command counts unchanged throughout reads. All original function provenance restored exactly.
- Only one application mutation: requestcreation200. One safe suppressed request-notification method record, zero real providers/unexpected blocked attempts. Three automatic initial successful empty reads precede503/503/200/403/200; an overly narrow aggregate count assertion was corrected against captured receipts without rerunning UI. No application defect inferred from that private evidence assertion.
- TypeScript exit0; scoped ESLint exit0/zero errors15 existing warnings; diff check clean. Synthetic local identity and suppressed transport; real service/SQL on localledger55. No new session-transition/stale-read/hosted/installed-native/provider acceptance. Broader D07 and Stream2 remain open.
- Exact cleanup: all12 base counts0, extra applicant User/auth0, requests/invites/occupancies/audits/notifications/capabilities/commands/overrides0. Original RPC provenance checked again after cleanup. Tab19/API/Next closed, five own r1 containers stopped/preserved; reserved IPv4/6 ports18141/18142/64550–59 free; temporary lint symlink removed. No peer/native/cache changes.
- Durable owner `.pantopus-recovery/audits/20260921-stream2-request-list-candidate-r1/`,20 files plus flatmanifest: exact page, private fixture/runner, SQL/provenance, actual per-case and aggregate HTTP/full-row evidence, validation/cleanup/PR body. Credentials and raw operator logs excluded. Prior baseline16 and source12 remain separate frozen artifacts.

**Frozen candidate ready for coordinator capture/review and integration.** No merge/shared backlog closure. Runtime released; current-head CI pending.

## September 21 D07 Requests list — actual failure baseline frozen

After129merged, adopted **747b45754b24accce096898508e2de3355ed86a3** on separate `codex/home-request-list-verification`. Prior128refs preserved,9relevant sources unchanged from accepted12artifact/63binding map. Clean source/no appedit. Runtime-only grant followed, later work stays outside fixed128/129/docs130batch.

Actual requestcreation200/list200 rendered exact applicant inIAB18. Exact list_home_household_requests(uuid,uuid,text) functiondef/owner/ACL/effectiveprivilege captured; directservice_role REVOKE gave effectiveEXECUTEfalse (noinheritedgrant). Actual UIreload→list503 INVITE_UNAVAILABLE while occupants/me200, but UI said Requests(0) and No pending requests with noerror. SQL still pending; complete request/invite/occupancy/audit rows and notification/capability/commandcounts equalbefore. Restored only originalEXECUTE; fullfunctiondefinition/owner/ACL/effectiveprivilege exactlyequaloriginal. Existing Refresh members→list200/exactapplicant Requests1/fullstateunchanged. Earlier private stub503 remains excluded; this is actualservice/PostgREST/SQLfailure.

Proposed exactpage repair: requestsError state/reset onretire, rejectedreqRes via existingfailureMessage; existingErrorState with guardedfetchData retry before emptylist; omit misleadingzero count onlywhileerror. Preserve successfulscreen/controls/navigation/canManage/generation/otherhandlers/backend/schema. No appedit beforecoordinator review; no newfile/test/native orrole/invitation replays. Syntheticidentity/transport, deliberateownedRPCprivilegefault/localledger55; session/stale/hosted/deviceunverified.

Durable owner `.pantopus-recovery/audits/20260921-stream2-request-list-baseline-r1/`,16files+flatmanifest: exactpage/finalbinding/actualbefore-fault-recovery/fullSQL/functionprovenance/privatefixture/cleanup. Source12bundle reused. OnlyexactrequestcreationPOST;1suppressedrequestnotification,0provider/blockedunexpectedattempts. Cleanup12basecounts0+extraapplicantUser/auth/request/invite/occupancy/audit/Notification/capability/commands/override0. Fulloriginalfunctionprovenance restored beforecleanup. Tab18/API/Nextclosed,5ownedcontainersstopped/preserved,reservedIPv4/6portsfree. Runtime released; frozenbaseline readyforcapture.

## September 21 D07 Requests list — next source-only proposal

PR128 merged **b412b1b589bd9fa1755887e7c6afe26112c7c55e** after updatedd34ca7e341 [CI35592633526](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35592633526) passed. Coordinator captured prior frozen live02 hashd3c8ee7f in44d335145. Original local128dc130/source refs preserved; merged page bytes identical. Runtime remains released, no appedit/branchswitch.

Authoritative D07 still requires Members/Security error-versus-empty/current-access verification. Existing standalone Requests fetchData retires/clears requests, handles only fulfilled list results, then renders No pending requests for[] even when actual list rejects. Real SDKGET→home.js→homeInvitationService.listRequests→list_home_household_requests already returns safe503/authority403. This is source-only, not a reproduced production failure; earlier ancillary queue503 was a private service stub and stays excluded. Accepted sender invitation list recovery, audit panel,128approval/125decline/123role and current SQL contracts are distinct and reused.

Compared9paths×7current/archive/openrefs=63bindings (57present/6historicalmissing). Six refs use fulfilled-only clause; place-design has explicit else setAccessRequests([]), same empty-state outcome. Existing ErrorState/failureMessage and accepted MembersSecurityTab recovery patterns can be reused in this caller. SenderInvitationManager manages invitations, not access requests; replacement would change contract/navigation and is unnecessary. No new implementation/schema/screen/test justified.

Proposed runtime-only after separate finalmaster adoption and coordinator grant: own18141/18142/64550–59, actual requestcreation/list200/rendered applicant, no approval/decline. Capture fullstate/counts and exact list_home_household_requests(uuid,uuid,text) definition/owner/ACL/service_role privilege. Temporarily revoke only function EXECUTE from service_role in owned DB; tableSELECT fault is unsuitable for this SECURITYDEFINER RPC. Actual UIreload/Refresh should capture real GET503 while roster/me remain200; inspect falseempty and confirm pendingSQL/fullstateunchanged. Restore exactoriginalACL/privilege immediately, recover via existing Refresh members. Report baseline before any appedit. All external/dynamic notification transports and unrelated writes blocked; exactfixture/functionprovenance/runtime cleanup required. No accepted journey replay/new native/provider/session claim.

Durable owner `.pantopus-recovery/audits/20260921-stream2-request-list-source-r1/`,12files+manifest (9sources/63bindings/report/variantnote). Only variantnote added after initial11artifact handoff, prior bytes unchanged. No runtime/fault/fixture/application changes; coordinator scope pending. D05/D06/native/provider leads remain separate; no shared backlog closure.

## September 21 D07 Send invitation — reviewable repair for next batch

**Published, required CI running; stream incomplete.** Clean/pushed `codex/home-request-invite-verification` at **dc130eab9301f33ac38de7ba9ecd0b333680c5f8**, [draft PR128](https://github.com/WangPantopus/skinny-pantopus/pull/128), merged125bc2base. [Exact CI35592119547](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35592119547) running; no green claim. This belongs to next batch, does not extend127/paid publication.

- Sole existing handleApproveAccessRequest in members/page.tsx13additions/4deletions. Reuse pageConfirmation ownership and generation/token/origin/session beforePOST, success/error/finally. Existing retire/busyclear already present. Source outside handler byte-identical tobc2; role/decline/sharedstore/controls/copy/navigation/backend/schema untouched. No new application files or unit tests.
- Accepted baseline12/source13/77bindings reused without repetition. Actual IAB17→SDK→production homeInvitationService/transaction/PostgREST/SQL: normal approval200 creates one exact targeted pending invite and approves request, Requests0. A second synthetic applicant's real request/list200 permits independent remaining check while preserving first invite. Pending confirmation→BrowserForward /edit closes dialog/no additionalPOST; complete request/invite/occupancy/audit snapshots and Notification/capability/commandcounts identical. Fresh BrowserBack caller usable; exact temporary members.manage deny after confirmation opened returns403/current readable error/enabled Invite, same fullrows/counts. Restoreoverride/freshconfirmation→200, second targetedpendinginvite. Fullreload No pending requests. Approvalstatuses200/403/200;two creation200s. Full occupancy remained identical throughout; no membership/recipientacceptance claim.
- Dynamic email/notification modules intercepted for process lifetime: six safe method records for2requestnotifications+2email+2invite-notifications,0realproviders/blockedunexpectedattempts. Notification/capability/sender+decisioncounts0. No rawtokens/emailbody in evidence. Toast Invitation sent is not deliveryproof. Localfixtureledger55/syntheticidentity/transport; no hosted/native/session/otherdialog/delayedapprovalcompletion acceptance.
- TypeScriptexit0; scopedlintexit0/0errors15existingwarnings; diffclean. Before UI, second fixture username exceeded30character SQL limit and server did notlisten; exact partialfixtures cleaned/reseeded with shorter username. This private setup error is excluded from application evidence; no apprepair for it. Existing role/decline and invitation/SQL regression evidence reused because unchanged.
- Cleanup12basecounts0, both extraapplicantUser/auth0, exactrequest/invite/occupancy/audit/Notification/capability/sender+decisioncommands/override0; temporaryoverride removed/noDBgrantschanged. Tab17/API/Nextclosed,5owncontainersstopped/preserved, allreservedIPv4/6portsfree. Temporarylintsymlinkremoved; no peer/native/cachechanges.
- Durable owner `.pantopus-recovery/audits/20260921-stream2-request-invite-candidate-r1/`,15files+flatmanifest: exactpage/privatefixture/actualHTTP/fullSQL/UI/departure/denial/validation/cleanup. Baseline12/source13 remain separate frozen evidence. Credentials/rawoperatorlogs excluded.

**Candidate handoff frozen for coordinator capture/review and next-batch integration.** No broad D07 closure or further application/runtime work.

## September 21 D07 Send invitation — actual baseline frozen

Adopted merged125 master **bc2bec5adb7aab01f1fd098be7cd9df202739864** on separate `codex/home-request-invite-verification`, preserved125refs, clean/no appedit. Eleven relevant current source bytes match the accepted13file/77binding source bundle. Coordinator runtime-only grant followed; current batch125/126/rootremoval is not expanded.

Actual real requestcreation200/list200 rendered exact synthetic applicant(nooccupancy) in IAB16. Current Send invitation→Cancel produced no approvalPOST and identical full request/invite/occupancy/audit snapshots plus notification/capability/sender/decisioncommandcounts. Existing HomeSettings/Back creates same-document history; Send invitation opened then BrowserForward /edit leaves modal. Click Send invite onSettings→actual approvalPOST200, exact request approved/resolved_by owner, one targeted pending HomeInvite/source_request_id, one HOME_INVITE_CREATED audit. Full occupancy unchanged, no applicant membership. Success toast Invitation sent observed onSettings; it is not delivery evidence.

Private process-lifetime dynamic transport interception suppressed requestnotification/sendHomeInviteEmail/notifyHomeInvite (3safe method records, no raw tokens/emailbody).0realprovider/blockedunexpectedattempts;notification/capability/commandcounts0. Real service/SQL, synthetic identity/transport, localledger55. No recipient acceptance/receiptsemantic/native/hosted/session or broad invitation replay claim.

Proposed smallest repair: only existing handleApproveAccessRequest adopts pageConfirmation identity/current generation/token/origin/session guard beforePOST and success/error/finally, reuses retire busyclear; no sharedstore/UIcopy/backend/schema/newfile/tests. No app change yet; coordinator exact repair review pending.

Durable owner `.pantopus-recovery/audits/20260921-stream2-request-invite-baseline-r1/`,12files+flatmanifest: final11sourcebinding/exactpage/actualbaseline+Cancel/fullSQL/privatefixture/cleanup. Source13bundle reused separately. Cleanup all12base counts0 plus exactrequest/invite/occupancy/audit/Notification/capability/sender+decisioncommands/applicantUser/auth/override0; noDBgrantschanged. Tab16/API/Nextclosed,5ownedcontainersstopped/preserved, reservedIPv4/6portsfree. Runtime released. Frozen baseline ready for capture; no repeated verification before candidate scope.

## September 21 D07 Requests Send invitation — source-only comparison

PR125 original e7865fd81 [CI35589989322](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35589989322) passed. Coordinator updated125 to1c9181a596474b1e0e9cae60e589757690cf64fc with identical reviewed page bytes/docs-only additions; updatedCI35590631566 remains coordinator gate. Prior candidate live02 hash0af76cb4 captured54772e50a; frozen original local branch/source and released runtime preserved. No branch switch or application edit for this source-only task.

Existing Requests Invite→Send invitation confirm→SDK approveHouseholdAccessRequest→home.js→homeInvitationService.write(approve_request)→write_home_invitation traced. SQL current authority/source/policy checks and same-actor replay already exist; creates one targeted pending HomeInvite/source_request_id, request approved/resolver/audit, no membership. Awaited UI confirmation lacks accepted role/decline lifetime guards; source similarity alone is not a reproduced defect.11paths×7current/archive/openrefs=77bindings/72present/5historicalmissing, identical approval-handler hashes across all7.

Policy/side-effect distinction: approval separately awaits notifyCreated, which dynamically attempts email with raw token and in-app notification (real helper may badge/socket/push). Proposed private fixture must intercept both modules for process lifetime; log only safe method/count data, no raw capability. Unlike sender-recovery commands this route returns no delivery proof; existing Invitation sent toast cannot establish actual delivery. No recipient acceptance, receipt-policy replacement or copy change is in scope.

Proposed runtime after125integration: adopt finalmaster on separate follow-up and rebind relevant source; only own18141/18142/64550–59. Exact applicant/no occupancy, actual request creation/list200/rendered request; current Cancel noPOST/full state equal, then same-document departure with Send invitation pending. Record any actual stale approvePOST/status and exact pending-invite/request/audit changes while complete membership unchanged. All provider/unrelated mutations blocked; observe transport suppression and zero Notification/command/capability additions; clean exact invitations/requests/applicant and original fixture counts, then release own runtime. Reuse accepted sender/recipient/role/decline/SQL evidence; do not replay it.

Durable owner `.pantopus-recovery/audits/20260921-stream2-request-invite-source-r1/`,13files+flatmanifest (11sources,77bindings,scope/sideeffects/proposal). Source-only; no new acceptance/runtime/tests/native/provider activity. Coordinator scope review pending; original125 and runtime remain frozen.

## September 21 D07 Requests decline — reviewable repair

**Published, CI queued; stream incomplete.** Clean/pushed `codex/home-request-decline-verification` at **e7865fd81d15fe3802b65d2a18b7a3eacc9462e3**, [draft PR125](https://github.com/WangPantopus/skinny-pantopus/pull/125), merged55856362b base. [Exact CI35589989322](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35589989322) queued, no green claim. Coordinator exact caller grant followed; frozen baseline/source evidence below reused unchanged.

- Sole existing members/page.tsx19additions/10deletions: locally rename owned role dialog ref to pageConfirmation for role+decline; retirement closes only matching owned dialog and clears request busy. Decline captures current generation/token/APIorigin/session marker, refuses stale confirmation beforePOST, guards success/error/finally. Existing role behavior reused. Approval/shared dialog/store/backend/schema/design/navigation unchanged; no new application file or unit test.
- Actual IAB15→SDK→production route/service/PostgREST/SQL: current decline200/rejected+audit/Requests0. Create second exact pending applicant request through actual route, current list200 displays it. Open decline→same-document BrowserForward /edit closes dialog; no newPOST and full request/audit/occupancy/invite rows equal. BrowserBack fresh caller usable; exact members.manage override after modal opened yields real403, readable current message, enabled Decline and unchanged full rows. Remove override, fresh confirmation retry200; full reload No pending requests. Focused shared-ref role regression Guest→Admin200, UI ADMINS and SQL saved. Candidate reject statuses200/403/200, role200, two creation200s. Four notification methods suppressed;0provider/blocked unexpected attempts. Broad121/123 role and invitation/SQL acceptance reused.
- TypeScript exit0; scoped ESLint exit0/0errors15existingwarnings; whitespace clean. Initial lint dependency lookup failed before lint ran; reused existing root dependency symlink then completed and removed that temporary symlink. Required CI remains current-head gate. No delayed-decline/session/other-dialog/native/hosted/approval acceptance; synthetic identity/notification transport/local ledger55. Already-submitted commands are not claimed canceled.
- Cleanup:12base fixture counts0, extra applicant/role User/auth0 and request/invite/occupancy/override/audit0. No DB grants changed, exact temporary override removed. Ownedtab15closed, API/Nextstopped,5owncontainersstopped/preserved, all18141/18142/64550–59 IPv4/6portsfree. No peer/native/cache edits.
- Durable candidate owner `.pantopus-recovery/audits/20260921-stream2-request-decline-candidate-r1/`,14files+flatmanifest, exact page/private fixture, actual HTTP/fullSQL/UI/denial/departure/validation/cleanup. Accepted baseline11 and source10bundles remain separate/frozen. Credentials/raw operator logs excluded.

**Candidate handoff frozen for coordinator capture/review/integration.** No broader D07 closure or further app/runtime changes.

## September 21 D07 Requests decline — actual baseline frozen

On unchanged55856362b, IAB14 actual pending Requests loaded through real homeInvitationService/PostgREST/SQL after HTTP request creation200 and list200. Synthetic applicant has no occupancy. Current Cancel produces no rejectionPOST and complete request/audit/occupancy/invite snapshots remain identical. Existing HomeSettings navigation and BrowserBack establish same-document history; Decline opened on Requests then BrowserForward /edit leaves global modal visible. Clicking Decline there sends real rejectPOST200, sets exact request rejected/resolved_by owner/timestamps, adds one HOUSEHOLD_ACCESS_REJECTED audit and shows Request declined toast on Settings. Full occupancy/invite rows remain unchanged. This is actual caller failure, distinct from earlier private queue stub503.

No app change. Propose existing decline handler reuse current role ownership/current-generation pattern, sharing one page-owned confirmation ref with role; before-POST and completion/error/finally guards. Preserve approval handler/shared store/global dialog/controls/policy/backend/schema. Source bundle10files/48bindings reused; no repeated invitation/role acceptance or new unit tests.

Private fixture allows real service; process-lifetime dynamic notification interceptor suppressed exactly request and rejection notification calls; network guard permits only owned local64551, HTTP mutation guard permits only exact request creation/rejection.0blocked network/unexpected mutation attempts. Notification delivery/authentication remain synthetic; local ledger55, current full replay is accepted123CI. No session/native/hosted/approval acceptance.

Baseline durable owner `.pantopus-recovery/audits/20260921-stream2-request-decline-baseline-r1/`,11files+flatmanifest: exact page/private loader/server/full baseline+Cancel+SQL/cleanup. Exact cleanup12base counts0 plus applicantUser/auth/requests/invites/occupancies/overrides/audits0. No database grants changed. IAB14closed, API/Next stopped,5owncontainers stopped/preserved, all reserved IPv4/6ports free. Runtime released; source clean at55856362b. This baseline is frozen for coordinator review/capture; runtime/repair requires next exact scope.

## September 21 D07 Requests decline — source-only reconciliation

PR123 original178b4a17854b56de6b1ace25b58d26d4ea8289e3 [CI35588215044](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35588215044) passed; coordinator merged55856362bd736355616da740ff2fda8b8a5fd01c and captured prior frozen live02 hash30274412 in005d3e645. Adopted that exact master on separate `codex/home-request-decline-verification`;123 refs preserved, worktree clean. Earlier queued sentence below is historical captured handoff.

- Existing standalone Requests decline→SDK rejectHouseholdAccessRequest→home.js reject route→homeInvitationService.write→write_home_invitation traced. SQL current authority/exact source/nonpending/replay gates, atomic rejected status/resolver/audit and no membership grant already exist; actual list uses list_home_household_requests.48source/ref bindings across8paths and6current/archive/open refs:43present/5historicalmissing; decline handler identical across all6. No competing repair or justification for replacement/new implementation.
- Unguarded awaited decline confirmation is source-only concern, not reproduced defect. Accepted123 role lifetime and invitation sender/recipient/SQL contract evidence reused within limits. Earlier Requests503 was private fixture stubbing invitation service, not application failure. Existing invitation fixture patterns can enable actual service/RPC with synthetic identity and intercepted notification transport.
- Proposed coordinator scope: only owned18141/18142/64550–59; real request creation/list/decline through existing caller/route/service/PostgREST/SQL; exact new synthetic applicant/no membership. Runtime private loader must intercept dynamic notification requires for its lifetime and block provider/unrelated writes. UI pending-list200 first; current Cancel/noPOST then same-document departure/confirmation observation and full request/audit/occupancy/invite snapshots. Report actual baseline before any repair. No app edit/runtime start/native/new unit test yet.
- Durable source proposal: owner `.pantopus-recovery/audits/20260921-stream2-request-decline-source-r1/`,10files plus manifest (8sources,48bindings and scope). Source comparison/fixture proposal only; no new acceptance. Exact cleanup plan included. Runtime remains released; coordinator runtime/repair scope pending.

## September 21 D07 role-confirmation lifetime — reviewable repair

**Current: published, required CI queued; stream incomplete.** `codex/home-member-confirmation-lifetime` clean/pushed at **`178b4a17854b56de6b1ace25b58d26d4ea8289e3`**, [draft PR123](https://github.com/WangPantopus/skinny-pantopus/pull/123), final-master b409 base. [Exact CI35588215044](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35588215044) queued; no green claim. Coordinator exact top-README caller-only grant followed; earlier frozen baseline below is preserved unchanged.

- Sole existing standalone `frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`,16 additions/3 deletions. Track owned dialog identity; existing retire/unmount dismisses only that matching dialog. Capture generation/token/API origin/session marker before awaiting confirmation; reject stale continuation before POST and stale completion before toast/list refresh. No shared store/dialog, role/permission policy, layout/navigation, SDK/backend/schema/new application file or unit tests changed.
- Reused accepted15-artifact actual baseline and25ref source comparison: global old role dialog persisted after /members→/edit departure and posted200, changing Guest→Admin/one audit from Home Settings. No baseline rerun. Accepted121 five-role/Cancel/permission evidence reused.
- Candidate actual IAB13→SDK→IAM/authority→PostgREST/SQL: one normal current confirmation→one POST200/Admin/one audit. Subsequent open confirmation→BrowserForward /edit closes it immediately, no newPOST, full HomeOccupancy/HomeAuditLog snapshots identical. BrowserBack returns to fresh caller; new confirmation's current permission403 remains visible/full rows unchanged; remove exact override and retry→200/Manager. Normal/current/error paths remain usable.
- Related submitted-request lifetime: one current Member command sent before departure; real saved200 reply held6,003ms and delivered to intact socket after BrowserForward /edit. No former-caller occupants refresh occurred after held response; destination stayed Settings at observation. Returning loaded saved Member. This does not cancel or roll back an already-submitted command. Success-toast nodes were absent at post-delivery observation; no continuous transient-toast timeline is claimed.
- Validation: TypeScript exit0, scoped lint exit0/0errors15existingwarnings, diff clean. Four candidate rolePOSTs200/403/200/200. No new tests, large duplicate role suite or native build. Required current CI remains necessary. No actual other-dialog/session race, late-error reply, hosted/native or explicit-selector acceptance. Synthetic identity and local fixture/6second delivery timing; baseline incidental dashboard/private queue limits remain explicit. Local ledger55; complete current replay in CI.
- Cleanup: all12 base table/object counts0, two extra User/authUsers0, occupancies/overrides/audits0; original empty fixtures restored and no DB privileges changed. Owned tab13 closed, API18142/Next18141 stopped; all5owned r1 containers stopped/preserved; all reserved IPv4/6 ports18141/18142/64550–64559 free. Temporary lint symlink removed and held reply consumed. No peer/native resources touched. Runtime released.
- Durable candidate: owner `.pantopus-recovery/audits/20260921-stream2-member-confirmation-candidate-r1/`,18files plus flat manifest; exact page/probe/fixture, normal/departure/full-row/current-error/delayed-response proofs, validation and cleanup. Prior separate baseline15files remain frozen/reused. Credentials and raw operator logs excluded.

**New repair handoff frozen for coordinator capture.** Coordinator owns review/integration and shared disposition; prior baseline section is not rewritten. No broad D07 completion claim or further app/runtime changes.

## September 21 D07 role-confirmation lifetime — verification resumed

Adopted independently verified final master `b409bc9190dd43bbdcee0cdba8f307ae959d2dc3` on separate `codex/home-member-confirmation-lifetime`; prior121/privacy refs preserved. PR121 and119 merge states independently checked. Existing confirm-store, global dialog/root layout, standalone caller and accepted MemberDetail guards compared across five refs (25bindings). Global dialog is mounted outside route children; no general pathname cleanup found, only unrelated ConversationView cleanup. This is source evidence only until actual departure behavior is reproduced.

Existing standalone role-cycle/permission acceptance is reused. Runtime verification-only grant; no app edits/new UI/test/native scope. Own18141/18142/64550–59 checked free and five stopped owned r1 containers identified before restart. Private existing fixture/actual member contracts reused, synthetic sign-in/ancillary queue limits retained. Exact fixture/audit cleanup required.

**Actual confirmation lifetime failure reproduced:** IAB12 opened Guest→Admin on standalone /members. Existing Home Settings navigation had created a same-document /edit history entry; Browser Forward departed there with confirmation still open. Clicking its remaining Set as Admin sent the old role POST200, persisted target Admin/one audit and displayed success toast on Home Settings. Existing global ConfirmDialog sits outside route children and has no pathname retirement. Exact response/SQL in private member-confirmation-baseline.json. Incidental sidebar Members routes to dashboard (unsupported in this fixture); that navigation is excluded and history returned to the true standalone caller before baseline. No app edits yet. Proposed sole existing standalone page: retain identity of its own role dialog and dismiss it through existing retire/unmount only when still owned; capture current generation/token/origin/session before awaiting confirmation and reject stale continuation before POST. Do not change shared store/global UI, normal confirmation, permissions or cycle. Await coordinator exact path grant; source map25bindings and accepted MemberDetail lifetime convention reused.

**Verification-only checkpoint frozen for coordinator review:** no application edit or new commit; clean branch at b409bc919. Repair proposal above remains pending. Baseline preserved at owner `.pantopus-recovery/audits/20260921-stream2-member-confirmation-baseline-r1/`,15files plus flat manifest, including exact five source files,25ref bindings, real POST200/SQL/audit and full before/after snapshots. No new tests or repeated121 role journeys. Exact cleanup restored empty state:12base counts0, extra2users/auth0 and occupancy/override/audit0. No database grant changes. Tab12/API18142/Next18141 closed; all5owned r1 containers stopped/preserved; IPv4/6 ports18141/18142/64550–64559 free. Runtime released while awaiting the exact caller-only repair grant; do not repeat this accepted baseline when candidate verification resumes.

## September 21 D07 standalone role cycle — reviewable handoff

**Current: published, original-head required CI passed; stream incomplete.** Clean/pushed `codex/home-standalone-member-role-verification`, **`dc9611bc621237271928d7c35e63345308ae236a`**, [draft PR121](https://github.com/WangPantopus/skinny-pantopus/pull/121), final-master0d6a1f57b base. [Exact CI35583917301](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35583917301) completed SUCCESS at dc9611bc621237271928d7c35e63345308ae236a: production web build, web lint/typecheck/existing tests, Identity Firewall, safeguards, full database replay and CI OK passed; backend/native/seeder path-skipped. Read and followed coordinator exact cycle grant91b3dff34; prior privacy feature refs preserved.

- Sole application change: one existing line in `frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`. Keep current role in the nonowner cycle before locating its index. All existing controls/confirmation/design/navigation, members.manage and canonical server policy remain unchanged. No SDK/backend/schema/new file or unit tests.
- Baseline: actual standalone IAB11 Guest→Admin→Manager→Admin, persisted/audited. Initial private mounted-path receipt filter missed HTTP logs; preserve first3 UI/SQL observations with that limit. After correcting only private filter, repeated Admin→Manager→Admin captured two exact SDK POST200 replies with saved role/role_base and audits. Source-only30ref comparisons reused; six final-master path hashes unchanged from prior reconciliation. Existing role implementation repaired in place.
- Candidate real browser→SDK→IAM→authority RPC→PostgREST/SQL: five UI role transitions Admin→Manager→Member→Restricted→Guest→Admin all200 and saved/audited exactly. Cancel yields noPOST. Withdraw actor members.manage after confirmation opens→403/error toast; full HomeOccupancy and HomeAuditLog snapshots unchanged. Restore exact override→retry200/Manager. Nonowner without grants gets occupants403/no role controls; owned nonowner manager with explicit members.view/manage gets equal-rank403 and unchanged full rows. Owner makes target Member; same nonowner manager then changes it to Restricted200, correct audit actor and full reload displays Restricted. Ten candidate rolePOSTs (eight200/two403), plus Cancel and ungranted-read controls.
- Reused accepted MemberDetail and server authority evidence, without broad duplicate route reruns. TypeScript exit0; scoped lint exit0/0errors15existingwarnings; diff clean. Initial lint invocation from repository root found no web config; reran correctly from web and removed exact temporary symlink. No new tests. Current full CI remains required.
- Limits: synthetic sign-in and exact fixture grants, actual member permissions/services/SQL. Unrelated private fixture access-request queue503 excluded; no queue acceptance. Local ledger55, complete current replay in CI. No native/hosted, explicit role chooser, stale-confirmation/session or concurrent role-write acceptance; D07 as a whole remains open. This corrects the existing cycle only.
- Cleanup: original empty state restored; all12 base fixture/object counts0, two extra users/authUsers0, all owned occupancies/overrides/audits0. No database privilege changes. API18142/Next18141 stopped, tab11 closed; all5owned r1 containers stopped/preserved; IPv4/IPv6 probes18141/18142/64550–64559 allfree. Temporary lint symlink removed; no native/peer resources touched. Runtime released.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-standalone-members-r1/`,24files plus flat manifest: old/new page, source map/bindings, corrected baseline and initial limits, UI/request/SQL records, full-row denial proof, private fixture/runner, validation and cleanup. Credentials and raw operator logs excluded.

**Handoff captured/pushed in coordination `8fe4195cd` at frozen SHA256 6b0045953ab043a2fd18777f16a02f2b910d8f222e1f9573f158698c8b3ed8b2.** Coordinator independently reviewed all24 artifacts, ten POSTs, both full-row denials, Cancel and cleanup, and confirmed original-head CI. This status-only update records that final result. PR121 source and released runtime remain frozen through the coordinated PR120→121→documentation119 batch after paid a795 fullCI35582693975. No repeated role journey, broad completion claim, new application repair or runtime acquisition.

## September 21 D07 standalone Members role verification resumed

Coordinator released the hold after PR114–118 and documentation113 merged. Independently verified master `0d6a1f57b19ddebbaa78df1485546903929aca39` and PR118/113 merge states. Correct application worktree now uses separate `codex/home-standalone-member-role-verification` at final master, clean; prior local and remote privacy refs preserved and both repaired privacy files byte-identical. Existing30path/ref D07 source map reused, not counted as reproduction.

Current scope: actual standalone Members → SDK role POST → current IAM/authority service → canonical SQL; no application edit/new UI/test until failure and exact-path proposal. Existing screen and members.manage permission differences preserved. Own ports18141/18142/64550–59 checked free, five stopped owned r1 containers identified and reacquired. No peer/native resources changed. Private fixture removes its obsolete navigation-permission stub before baseline so /me uses the actual policy. Synthetic sign-in and unrelated provider boundaries remain explicit.

**Actual D07 baseline:** existing Change role UI moved owned target Guest→Admin→Manager→Admin; SQL and3chronological audits matched. Initial private HTTP logger used mounted req.path and missed exact status receipts; this limitation is retained. After correcting only private filter to originalUrl, repeated Admin→Manager→Admin yielded captured2POST200 with exact persisted role/audits. Canonical occupants and /me use real policy/services; unrelated access-request queue503 is a private-fixture limitation, not an app failure. Lower roles remain unreachable through the cycle. Proposed existing standalone members/page.tsx only: retain all nonowner roles before locating current index; preserve current confirmation/layout/navigation and members.manage. No replacement selector/UI/service/schema/new file/test. Explicit role-choice product requirement remains separate. Await exact grant.

## September 21 D06 privacy partial-write repair — reviewable handoff

**Current: published, original-head required CI passed; stream incomplete.** Separate `codex/home-privacy-write-verification` is clean/pushed at **`1ad1a06933e8e2debe5a947b8b5611ed7820421c`**, [draft PR118](https://github.com/WangPantopus/skinny-pantopus/pull/118), stacked on frozen PR11699e0. [Exact CI35579547138](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35579547138) completed SUCCESS: safeguards, backend privacy/Jest, Docker, full schema replay and CI OK; web/native/seeder path-skipped. Current live README exact route grant followed. Coordinator owns integration/merges.

- Sole application path: existing `backend/routes/homePrivacy.js`,5 additions/3 deletions including two stale comments. Capture and throw existing-row read error before default merge/upsert. Successful absence, permissions, validation and error envelope retained. No service/schema/UI/new file or unit test changes.
- Baseline: actual API saved address_precision/photo_blur/vault_auto_lock=true. Persistent SELECT denial caused PATCH500 and unchanged SQL (negative control). Actual PostgREST SELECT403 with controlled restoration of original SELECT before handing the real response to the route allowed PATCH200 `{map_opt_out:true}` to reset all three unrelated saved values to false. Unmodified database response bodies and actual persisted rows; recovery timing and identity synthetic. Twenty source/ref comparisons across current/master/paid/workstream/staging; route identical. Existing implementation repaired in place.
- Candidate:13 actual HTTP→current permission/route→PostgREST→SQL cases passed. Persistent denial and repeated recovered-read denial now stop before any upsert and preserve the entire row, including updated_at. Retry200 preserves unrelated true restrictions; explicitfalse updates only address_precision; current security.manage denial403 and three invalid payload400s preserve SQL; denied INSERT after a successful read500 preserves SQL and restored write retry200 succeeds; genuine absent row initializes unchanged defaults plus supplied map_opt_outtrue. Native/web UI not exercised: no current web toggle caller or available native control. No invented UI acceptance.
- Verification:8 existing homePrivacy checks passed with normal force-exit flag, exit0; syntax/whitespace checks passed. No new tests. PR116 Place UI/service evidence reused within its unchanged source limits. Concurrent partial writes, native seeded defaults/stale responses, hosted/provider and broader toggle consumer behavior remain open. Local schema ledger55/unchanged HomePrivacy; current complete schema replay remains required CI.
- Cleanup: all11 base table counts0, HomePrivacy0, authUser0 and owned Storage objects0. Original SELECT and INSERT restoredtrue. API closed; web/native unused. All five owned r1 containers stopped/preserved; IPv4/IPv6 probes show18141/18142/64550–64559 allfree. No peer resource changes. Runtime released.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-privacy-write-r1/`,11 files plus flat manifest; baseline/candidate HTTP/SQL/PostgREST receipts,20source comparisons, exact old/new route, private reproducible probe/fixture, existing-regression receipt and cleanup. No credentials or raw operator logs copied.

**Handoff captured/pushed in `ed73b0ce4` at frozen SHA256 db729875; this update records final original-head CI.** Hold additional application changes/runtime restart until next bounded scope; D06 remains incomplete. D07 standalone Members is the next available actual-browser alternative, separate from concurrent PATCH/native limitations.

**Independent D07 reconciliation during integration hold (source-only):**30source/ref comparisons across the standalone Members page, existing MemberDetail, SDK, Home IAM route, safe member projection and authority service. Canonical list supplies current role and role_base together; standalone cycle removes that current role before indexOf, so source predicts admin/manager rather than deliberate selection. Existing MemberDetail already has explicit five-role controls and accepted recovery/lifetime evidence, but its owner-only action gate differs from standalone members.manage, so reuse needs a deliberate compatibility decision. Existing role POST/SQL transaction owns authority/rank/age/owner/access-window checks. No new browser baseline, UI acceptance, repair or runtime acquisition. Private source map `.stream2-verification/d07-source-reconciliation.json`. Next actual standalone browser journey and any UI choice require coordinator scope after current integration batch.

## September 21 D06 privacy partial-write verification

Verification-only grant after PR116 evidence capture. Separate `codex/home-privacy-write-verification` starts at unchanged99e0cba3; PR116 remains frozen. Existing route, native caller and schema contracts compared. Actual HTTP/SQL only: no available web toggle caller or native control; no invented UI acceptance. Owned18141/18142/64550–59 listeners checked free and five owned stopped r1 containers identified before reacquisition. No application edit until reproduced persistence failure and coordinator path grant. Distinguish persistent SELECT denial (which can also block upsert) from a read failure followed by recovered write availability; preserve original rows/grants. No native slot or new unit tests.

**Reproduced actual HTTP/SQL failure:** saved address_precision/photo_blur/vault_auto_lock=true. Persistent SELECT denial made PATCH500 and unchanged SQL (explicit negative control). Second actual PostgREST SELECT403 was followed by restoring original SELECT before the route received that response; the same PATCH `{map_opt_out:true}` returned200 and reset all three unrelated saved values to false. No fabricated database response: only recovery timing was controlled in the private fetch harness. Existing route discards the SELECT error and merges defaults before actual upsert. Both API response and SQL prove changed persistence. After probe all11 base table counts0 plus HomePrivacy0 and original SELECT true; API stopped, owned containers remain running pending coordinator disposition. Proposal: existing `backend/routes/homePrivacy.js` only, check/throw existing read error before merging/upsert, retaining genuine-absence defaults and existing error envelope; correct its stale read fallback comments in that same path. No service/schema/UI/new file/unit test. Awaiting exact application grant. Private evidence `.stream2-verification/privacy-write-baseline.json`, source comparisons and reproducible private probe.

## September 21 D06 privacy read failure — reviewable handoff

**Current: published, exact original-head CI passed; stream incomplete.** `codex/home-privacy-read-verification` is clean/pushed at **`99e0cba3a73040e3e6c6bcfeefa9a65ad6ccc814`**, [draft PR116](https://github.com/WangPantopus/skinny-pantopus/pull/116), based on integrated master721d46e6. [Exact CI35578111441](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35578111441) completed SUCCESS, including backend/Docker/safeguards/full database replay; web/native path-skipped. Coordinator grant21f42c142 names this service only; prior integration heads remain untouched.

- Sole changed application path: existing `backend/services/homePrivacyService.js`,10 additions/23 deletions including stale fallback comments. Database/transport read failures now propagate to existing callers; successfully absent rows retain defaults. No route/PATCH/UI/schema/new file/unit test change.
- Baseline: real API PATCH saved `address_precision=true`; SQL true and actual Place header omitted the synthetic unit. Denying service-role SELECT on HomePrivacy made actual browser intelligence200 expose `Unit PRIVATE41`; GETprivacy200 falsely returned false while SQL remained true. Restoring SELECT restored restricted rendering. Thirty current/archive/open-branch source pairs compared; privacy service is identical across all six refs. Existing implementation is repaired in place.
- Actual browser → SDK → primary/list/current permissions → intelligence route/composer/privacy service/serializer → PostgREST/SQL: candidate read denial returns500 from privacy and intelligence; Place displays its existing error/retry without address/unit. Repeated UI retry remains safe. Restore SELECT and retry →200 and saved true hides unit. API-saved false →200/browser reload displays unit by existing policy. Exact row deletion/count0 → defaultfalse200/browser default behavior. Recreating true through existing PATCH →200/readtrue/browser hides unit again. No design change.
- Verification:33 existing checks in homePrivacy and Place endpoint suites passed, syntax and whitespace checks passed. No new tests. The local Jest process retained open handles after its passing115-second summary and was stopped; no clean local process-exit claim. Required CI uses the existing normal force-exit command. First silent runner was interrupted, and the rerun disabled Watchman. No unrelated runner/cache repair.
- Limits: synthetic sign-in and unavailable unrelated provider groups, actual Home/Place services and SQL. The initial private adapter setup500 is excluded from app-defect evidence. Local ledger55 contains unchanged HomePrivacy; full current replay remains CI. Independent transport disconnect, native seeded-default fallback, ignored-read PATCH, other privacy controls, outsider, provider and hosted boundaries are not newly accepted. D06 as a whole remains open.
- Cleanup: all12 owned fixture table/object counts0 plus HomePrivacy0; original SELECT restoredtrue. API18142/Next18141 stopped, all five owned r1 containers stopped/preserved, all18141/18142/64550–64559 ports free, owned browser tab10 closed. No native slot or peer resource changes. Runtime released.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-privacy-read-r1/`,14 files plus flat manifest; exact service,30 comparisons, baseline/candidate HTTP/UI observations, existing-regression receipt, private fixture definitions and exact cleanup. Credentials and raw operator logs excluded from Git/chat.

**Handoff captured in coordinator commit `d4ce6c85a`; prior frozen SHA256 bf9c9c5b verified.** Coordinator owns review, integration and merges while the paid combined gate runs. Next independent work may reconcile existing ignored-read PATCH/native fallback leads; no additional application path, schema or native repair is authorized by this milestone. Reuse unaffected accepted evidence; do not repeat the baseline.

## September 21 D06 restrictive Home address privacy — verification resumed

**Current: verification only; no application edit.** Coordinator released the integration hold after PR110/111/112 and documentation PR106 merged with exact-head CI. Own clean application worktree now uses separate branch `codex/home-privacy-read-verification` at final master `721d46e6d2ad6bfc1e67ea70b375d7b2d129d9f0`; frozen feature refs are preserved. PR106/112 merge SHAs and CI35576403371 success independently verified. Earlier accepted Home repairs remain source-bound and are not repeated.

Read the current live README grant, handoff and own status. D06 scope: existing Place consumer/caller with restrictive saved Home address privacy, real SQL read denial and recovery. Compare HomePrivacy policy/service/route/SQL and preserved evidence before proposing any repair. Existing web settings/security is an ownership-policy surface, not HomePrivacy toggles. No new unit tests, redesign, native build, backend/schema edit or application repair is authorized until the actual failure and exact paths are presented to coordinator.

Runtime reacquired after ownership/listener checks: web18141/API18142 and the five existing r1 containers on64550–64559. No peer/native resource changes. Synthetic sign-in and unavailable unrelated provider groups; actual Home primary/list services, Place UI/SDK, current permissions, intelligence/privacy routes, address serializer and PostgREST/SQL. Own local ledger55 includes the unchanged HomePrivacy table; current full-schema replay remains a CI boundary.

**Actual failure reproduced:** existing API PATCH `address_precision=true` saved200; SQL remains true. Existing Place header omits fixture unit. Denying only service-role SELECT on HomePrivacy makes the same browser reload return intelligence200 and display `Unit PRIVATE41`; GETprivacy also returns200 with false. Restoring SELECT restores the restricted header. Grant is restored now. Thirty current/archive/open-branch source pairs compared; earlier audit noted the source concern but did not establish this UI journey. Baseline receipts and exclusions are private in `.stream2-verification/privacy-baseline-evidence.json`.

Proposed exact repair, awaiting coordinator grant: existing `backend/services/homePrivacyService.js` only; propagate read errors to both existing caller error handlers, preserve defaults on genuine missing row. No screen or schema change. Native load-default fallback and ignored-read PATCH are separate source leads and not claimed fixed; no installed-native acceptance. The initial private fixture adapter setup500 is excluded from application-defect evidence.

## September 21 D05 optional settings clearing — reviewable handoff

**Current: published, original-head CI passed; integration held with coordinator; stream incomplete.** Separate authorized branch `codex/home-settings-clear-fields` is clean and pushed at **`22d2bc91e9037b92c441f7e6bd19c00f42811259`**, [draft PR112](https://github.com/WangPantopus/skinny-pantopus/pull/112), stacked on PR110. [Exact CI35574730971](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35574730971) completed SUCCESS: six applicable checks passed and five path-based skips, including the production web build, existing web tests/lint/typecheck, Identity Firewall, safeguards and full database replay. This applies to original head22d2bc91e; subsequent integration-head CI belongs to the coordinator. The coordinator merged PR109 at `c7755c345d14de9b13be81171b141c9c0156bbc6` after updated-head CI35574099206 passed. PR110's original CI passed; its updated `33414dda8` CI35574554620 is running. Remote predecessor branches were not overwritten.

- **Evidence correction:** earlier welcome/rules/other-textarea clearing claims in progress notes were invalid: browser `fill('')` did not change controlled textarea values. DOM readback and request receipts caught this; all six candidate lines were reverted before the genuine baseline. Those text-field claims are excluded and their failed-driver traces retained. The trash-day select-empty baseline was valid. Previous committed read/save/coordinate evidence does not rely on empty-textarea clearing and remains separate.
- Corrected baseline: keyboard select-all/Backspace cleared five textareas, and the trash-day selector was set to empty. DOM readback confirmed all six empty before Save with unchanged source. Actual profile200/settings200 requests omitted all six keys and restored the old values. Six branch comparisons plus the existing validator/SQL establish that present empty strings are accepted; no new implementation or migration is needed.
- Sole changed path: existing `frontend/apps/web/src/components/home/settings/HomeSettingsTab.tsx`, six additions/six deletions. Send explicit trimmed empty text/day values for `house_rules`, `parking_instructions`, `entry_instructions`, `trash_day`, `local_tips`, and `guest_welcome_message`. Existing controls, defaults, PATCH order, and partial-save semantics are preserved. No backend/schema/new file/unit test/design change.
- Actual UI → SDK → canonical permission/route/existing RPC → PostgREST/SQL: six empty draft values; deny `home.edit` → profile403/no settings write, draft retained and prior SQL values unchanged. Restore authority, then submit local tips of 10,001 characters → profile200/settings400, draft retained and all six SQL values unchanged. Keyboard-clear the invalid text and retry → two200 replies with six explicit empty strings; SQL confirms all six cleared, defaults24h/members unchanged. Full reload retains five empty textareas, trash Not set, and unchanged defaults.
- Validation: typecheck zero errors, scoped lint zero errors/seven warnings, whitespace check clean; required CI runs existing checks. Synthetic identity/ancillary dashboard and local provider boundary remain explicit. Native, hosted, and unrelated save-lifetime boundaries remain unverified; accepted unaffected journeys are reused.
- Cleanup: all12 fixture table/object counts zero. API18142 and Next18141 stopped; all five owned r1 containers stopped and preserved. Ports18141/18142/64551/64552 have no listeners. Owned browser tab9 closed, temporary lint symlink removed. No native slot, peer resource/cache deletion, or shared-runtime change. Runtime grant released to coordinator; private credentials/fixtures remain ignored and uncommitted.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-settings-clear-r1/`,17 files plus flat manifest. Includes exact source, corrected baseline, excluded driver traces, six-field comparisons, HTTP/SQL receipts, validation and cleanup.

**Handoff captured:** coordinator documentation commit `f60ce94e516e4363164e2db2ac2e2d977b439c4d` preserves the prior frozen snapshot and verifies all17 artifacts. This status-only update records final original-head CI. Application source and runtime remain held during the coordinator’s PR110 → PR111 → PR112 integration sequence. D05/D06/D07 leads remain open; no repeated baseline, extra repair, runtime restart or shared-backlog change is authorized by this update. The coordinator owns integration and shared disposition.

## September 21 D05 Home editor coordinates — reviewable handoff

**Current: published, CI queued; stream incomplete and continuing.** Granted separate branch `codex/home-edit-coordinate-read`, clean/pushed **`e50ed198723030208c4cf7016dc8561fee916436`**, [draft PR110](https://github.com/WangPantopus/skinny-pantopus/pull/110) stacked109. [Exact CI35574072291](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35574072291) queued. Sole existing `frontend/apps/web/src/app/(app)/app/homes/[id]/edit/page.tsx`:3parser lines plus finalnewline; no presentation/SDK/backend/schema/newfile/unit test.

- Reproduced actual canonical Home detailGET200 returned `{longitude:-122.33,latitude:47.61}` with savedSQLPOINT; editor fullreload falsely claimed No coordinates. Six source/branch parsers only handledGeoJSON/WKT. Extend existing localparser with finite-number canonicalobject branch; no exported existinghelper available, no replacement architecture.
- Actual UI→canonical Home detail/current permission service/route→SQL: valid47.61/-122.33 fills existing inputs; currentverified-coordinate UI replacement48/-123 is stripped by unchangedserverguard and originalpointreloaded; user_assertedSQL0/-12.34 displays correctly; UIlatitude0/longitude-75.5 saves200 and SQLmatches; invalid91→400/retaineddraft/SQLunchanged. DeliberateSQLNaNpoint→canonicalGET503 beforeform; existingerrornavigation leads/homes, whose listisunsupported infixture and excluded. RestoreSQLNULL→actual200/original emptycoordinates state. LegacyGeoJSON/WKT branches unchanged/reused, not synthetically re-tested.
- Typecheck0errors, scopedlint0errors/6warnings, diffclean. Syntheticidentity, deliberatemalformedSQL, localprovider; native/hosted/geocoder and full unrelatedHomeslist recovery remain unverified. Reuse previoussave/authority/provenance evidence.
- Cleanup12fixturecounts0, API18142stopped, Next18141/own5containers retained; lintsymlinkremoved, no native/peerresource changes. Durable owner `.pantopus-recovery/audits/20260921-stream2-home-edit-coordinate-r1/`12files+flatmanifest, exactsource/comparison/baseline/browser+HTTP+SQL/validation/cleanup.

**Handoff frozen for coordinator capture.** Nextgranted work: existing HomeSettingsTab optional-clearing payload after eachfield's actualfailure and canonicalcontract are established. Welcome/rules already reproduced bothcalls200 with oldvaluesreappearing; othertext/day fields require own baseline beforeinclusion. Preserve all existingcontrols/PATCHorder/partial-save semantics; no save-lifetime/schema extension. PR109 and thissource remain frozen while coordinator integrates.

## September 21 D05 settings save contract — reviewable handoff

**Current: published, CI queued; stream incomplete and continuing.** Granted follow-up branch `codex/home-settings-save-contract`, clean/pushed **`cb29cef1eff41802c0d0a6458b9203590267fce3`**, [draft PR109](https://github.com/WangPantopus/skinny-pantopus/pull/109), stacked on PR108. [Exact CI35573559457](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35573559457) queued. PR108 original39ced [CI35572724323](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35572724323) passed; coordinator owns integration. PR104 merged by coordinator after d304f08df CI35572440658 passed, component unchanged.

- Paths: existing `frontend/packages/api/src/endpoints/homes.ts`, `frontend/apps/web/src/components/home/settings/HomeSettingsTab.tsx`, `frontend/apps/web/src/app/(app)/app/homes/[id]/settings/page.tsx`; total5 additions/3 deletions. No backend/schema/newfile/unit test/layout/navigation change.
- Failure/reuse: dashboard Save actualPUT404, edited name omitted; legacy nickname editor actualPUT404/unchangedSQL, after method correction its public_info payload actualPATCH400. Canonical existing PATCH validator accepts name; native iOS/Android already sendPATCH/name.24 source/ref pairs and all5 SDK callers compared. Shared updateHome nowPATCH, existing input type admitsname/null, both editors sendcanonicalname. Other SDK methods/current permission/location provenance policies preserved.
- Actual browser cases: legacy name save200→SQL/fullreloadmatch; whitespace nickname produces no write;121chars400 specific validation/retaineddraft; actual home.edit denial403 safe message/SQLunchanged; restore/sameUIretry200. Dashboard profilePATCH200 then existing atomic settingsPATCH200 savedname/type/8hexpiry/welcome/notifications, SQL and fullreloadmatch;121chars400 and permission403 stop before secondcall with unchangedSQL, restore/retry200. Existing Home edit page savedname/type/bedrooms3/bathrooms2/sq_ft1500/year2000→UI success, route200 and SQLmatch.
- Affected LocationPicker/QuickModifiers source callers unchanged: exact locationpayload exercised through realHTTP/SQL→200 user_asserted; invalidlatitude400 unchanged; currentpermission403 unchanged; existingverifiedcoordinate guard strips replacement while allowing independentname. This is route/payload regression, not either full geocoder UI/provider journey.
- Typecheck0errors, scopedlint0errors/18warnings, diffclean; required CI runs existing suites, no newunit tests. Identity/ancillary dashboard synthetic; real Home detail/service/permission/validator/routes/RPC/PostgREST/SQL. Native/hosted/provider boundaries remain open. Existing two-call save transaction scope and optional-clearing/lifetime behavior unchanged, not newly accepted.
- Cleanup12fixturecounts0; no remainingpermissionoverride, ownedAPI18142 stopped; Next18141/own5containers retained for nextslice; temporarylintsymlinkremoved, no native/peerresources. Durable owner `.pantopus-recovery/audits/20260921-stream2-home-settings-save-r1/`17files+manifest, exact3sources/24comparisons/baselines/UI+HTTP+SQL/validation/cleanup.
- New separately reproduced lead: after real route storedverifiedcoordinates, existing Home edit reload says No coordinates. Actual canonicalGET200 returns `{longitude:-122.33,latitude:47.61}` but localparseLocation accepts onlyGeoJSON/WKT. No edit made for this lead. Propose small extension of existing parser, after existing-source comparison, with realread/UI verification and unchanged coordinateprovenance guard; coordinator grant pending.

**Handoff frozen for coordinator capture.** Continue bounded Home backlog; coordinator handles sharedSDK integration/merge/backlog disposition. Do not overwrite reviewer-owned predecessor branches.

## September 21 D05 settings reads — reviewable handoff

**Current: candidate published; stream incomplete and continuing.** Authorized separate branch `codex/home-settings-read-recovery`, clean/pushed at **`39ced0c27b95850a148b12a6b76fb34031cd9293`**, [draft PR108](https://github.com/WangPantopus/skinny-pantopus/pull/108) stacked on member follow-up. Only existing `frontend/apps/web/src/components/home/settings/HomeSettingsTab.tsx` changes (22 additions/7 deletions). [Exact CI35572724323](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35572724323) queued; no green claim. Coordinator merged PR102 after updated3de541d72 CI35571953892 passed. PR104 originaldeda CI35571776785 passed; coordinator owns its remote master update and integration. Neither integration branch was overwritten.

- Reproduced actual GET settings503 by denying owned HomePreference SELECT: form exposed default48h, blank welcome/rules and two enabled Save buttons despite SQL24h, saved welcome/rules and disabled notification preferences. Six current/master/paid/staging/place/archive sources share the silent catch. Existing ErrorState/failureMessage are reused; no new application file/service/schema/design/test.
- Repair: explicit load failure/retry; loading/failure blocks Save; asynchronous reads scoped to Home, current edit authority and component lifetime. Existing successful screen and save protocol preserved.
- Real browser→SDK→canonical homeIam/current permission helper→PostgREST/SQL: repeated503 with zero Save controls; restored SELECT plus UI retry recovered24h, welcome/rules and all5notificationsfalse. Removing exact disposable preference row then fresh load returned200 with notifications defaulttrue and saved Home fields intact. Actual home.view deny returned403/explicit denial/no save; restored access allowed retry. Held real successful200 while Loading, navigated Share, released on live socket: Share remained; changed owned SQL8h/new welcome and reopened Settings→current values. This is departed-panel/fresh-load evidence, not concurrent same-mounted Home/account response-order acceptance.
- Validation: web typecheck0errors, scoped ESLint0errors/7warnings, diffcheckclean. No new unit tests; required CI runs existing checks. Synthetic identity/ancillary dashboard, deliberate delay, local provider boundary; native/hosted/account-switch unverified. Earlier accepted guest/member/audit evidence reused unchanged.
- Separate save baseline: changing Home Name and clicking Save issued SDK PUT `/api/homes/:id`→404; canonical server route is PATCH, SQL unchanged. Name is omitted from the dashboard caller payload. This remains a subsequent bounded repair; this read PR does not establish successful saving. Shared SDK/schema remain untouched pending coordinator scope.
- Cleanup:12base fixture row/object counts0 plus HomePreference0/HomePermissionOverride0; original SELECT grant restoredtrue. API18142 stopped, delay released; Next18141/owned5containers retained for next Home scope, no native slot/peer resources touched. Temporary lint symlink removed.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-settings-read-r1/`,15files plus manifest, binds exact source/comparisons/baseline/candidate/HTTP/delay/validation/cleanup. No credential files or raw operator logs committed or shared.

**Handoff frozen for coordinator capture.** Next: compare canonical profile/settings contracts and all shared SDK updateHome callers, then propose minimal method/payload repair to coordinator. No migration justified or granted, no shared SDK edit yet. Continue backlog after this milestone; coordinator owns merges and shared disposition.

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

## Local latest-code iPhone readiness — September21

- **Source check:** `/private/tmp/pantopus-workstream-home` is clean at
  `f4b27786172d7b2cae641b4c94f9e77aa75928c1`; `origin/master` is nine
  coordination-only commits ahead and has no iOS or backend source diff, so no
  application work was duplicated or changed for this build.
- **Backend:** the existing local Supabase stack was reused (API `64521`, DB
  `64522`); the backend is running from this worktree on `0.0.0.0:8000` with
  `PGBOSS_ENABLED=false` and `CRON_ENABLED=false`. `GET /health` returned 200
  with `{"status":"healthy","database":"connected"}` from both
  `127.0.0.1` and `192.168.0.176`.
- **iOS configuration/build:** ignored local `.env` points API and Socket.IO to
  `http://192.168.0.176:8000`; `make bootstrap` generated the project. Debug
  simulator build succeeded, installed and launched on iPhone 17 simulator;
  the generated Info.plist contains the LAN URL and local-network ATS allowance.
  Generic `iphoneos` arm64 build also succeeded (warnings only), but is
  unsigned because no device profile was used.
- **Physical-device limit:** `devicectl` sees iPhone Yingpeng paired, but the
  install attempt was rejected because the phone was locked and Xcode could not
  mount the developer disk image. A signing retry also found no Xcode account or
  development profiles for the configured bundle/team. Unlock the phone and
  add the active Apple Developer account/team in Xcode before retrying the
  signed install. This is an environment/device limit, not an app-source
  failure.
- **Runtime:** backend remains intentionally running for the user’s device
  session; no database rows, fixtures, caches or peer worktrees were changed.

## Latest accepted native build and LAN handoff — September22

- The accepted native source remains PR160 exact head `ede5b72b5`; its full CI
  dispatch `35719644248` is green across iOS, Android, web, backend, database
  and deployment gates. The focused Stream2 D10 web repair remains PR176
  `ee9e78c5d` with CI `35722484544` green.
- A generic signed physical-device Debug build completed successfully from the
  accepted native source. Artifact:
  `/private/tmp/pantopus-stream2-ios-latest/.stream2-device-dd/Build/Products/Debug-iphoneos/Pantopus.app`.
  Bundle identifier is `app.pantopus.ios`; signing authority is the local Apple
  Development team `6UYZBA546R`.
- The retained physical iPhone remains Offline in `xcrun xctrace list devices`,
  so no install or device launch is claimed. The signed artifact is ready once
  the phone is connected/unlocked and paired. The retained Stream2 simulator
  was not reset or replaced.
- The combined temporary runtime is healthy at `127.0.0.1:18143` and through
  the LAN proxy `192.168.0.176:18142`; its source is PR160 plus the accepted
  PR175 bill-field allowlist. No application branch was merged or changed for
  this runtime handoff.

## Native head refresh — September22

- Coordinator refreshed PR160 to `4cca0a681` after merging current master;
  this includes the current iOS AppDelegate change while retaining the
  accepted Stream2 native fixes. The earlier exact-head CI receipt
  `35719644248` remains valid for `ede5b72b5`; fresh required CI for `4cca0a681`
  is running under the coordinator's merge queue.
- The signed device artifact was rebuilt from `4cca0a681` successfully at
  `/private/tmp/pantopus-stream2-ios-latest/.stream2-device-dd/Build/Products/Debug-iphoneos/Pantopus.app`.
  The bundle is `app.pantopus.ios` signed by local Apple Development team
  `6UYZBA546R`. The physical iPhone remains Offline, so installation and
  device-launch acceptance are still unverified.
- The LAN runtime was restarted from a temporary detached `4cca0a681` source
  with accepted PR175 commit `501caf65a` applied (`cc885ab23`), without changing
  the native fixture rows. Backend and proxy health both return 200 through
  `127.0.0.1:18143` and `192.168.0.176:18142`.

## Corrected device runtime build — September22

- Rechecked the build artifact before physical installation and found the
  ignored build environment still embedded the retired `192.168.0.176:8000`
  port. The disposable backend/proxy for this handoff is `192.168.0.176:18142`,
  so the build-only `.env` was corrected and the project regenerated. No
  application source, screen, service or schema file changed.
- Rebuilt the generic signed `iphoneos` Debug artifact from native head
  `4cca0a681`. The artifact at
  `/private/tmp/pantopus-stream2-ios-latest/.stream2-device-dd/Build/Products/Debug-iphoneos/Pantopus.app`
  now embeds `http://192.168.0.176:18142`, passes `codesign --verify --deep
  --strict`, and remains `app.pantopus.ios` signed by team `6UYZBA546R`.
- A real install attempt with `xcrun devicectl device install app` was rejected
  by CoreDevice error 4016 because the paired iPhone is still `unavailable` and
  cannot provide trusted connectivity, power assertion and developer services.
  No install or launch is claimed. Once the phone is unlocked and reconnects,
  this corrected artifact is ready for the install/launch retry.
- Backend health remains 200 through both `127.0.0.1:18143` and
  `192.168.0.176:18142`; the owner token also returned 200 for the existing
  Home `/me`, documents, guest-passes, tasks and issues routes with zero
  fixture rows. No fixture rows or peer resources were changed.

## PR176/PR178 evidence publication — September22

- The redacted PR176 bundle is durably retained at
  `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-home-leave-r1/`
  (source capture:
  `/private/tmp/pantopus-workstream-home/.stream2-verification/evidence/20260922-pr176-home-leave-r1/`).
  Its `MANIFEST.json` SHA256 is
  `753f7626e155727c71da8dd254b3b9fec4e03c09e77b9b772c01e21c38d69c0e`.
  It contains the reproduced `/detach` failures, the real Settings
  `/move-out` receipt, explicit before/after/restored `is_active`,
  `verification_status` and `can_manage_tasks` fields, the one-line source
  diff and validation receipt. The accepted journey generated exactly one
  `member_moved_out` Notification and one HomeAuditLog row; both were deleted
  after the probe. A later retained-runtime check found three additional
  matching synthetic notifications and no matching audit rows; those three
  were deleted by exact home/member metadata, leaving zero matching rows. The
  bundle does not claim byte-equality for untouched full-row fields. No token,
  password or raw proxy body is included.
- The redacted PR178 bundle is durably retained at
  `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream2-mailbox-preferences-r1/`
  (source capture:
  `/private/tmp/pantopus-workstream-home/.stream2-verification/evidence/20260922-pr178-mailbox-preferences-r1/`).
  Its `MANIFEST.json` SHA256 is
  `1c72d93b6eea04b7dc66454df99bb68d7804a53e46d9d9dea138592f63455057`.
  It contains the real direct/LAN 404 baseline, patched temporary-backend 200
  GET/PATCH receipts, exact existing-block move and validation receipt. The
  retained fixture comparison reported the existing `MailPreferences` row
  restored; no before/restored hash pair was captured, so this status does not
  claim byte-equal full-row proof. No UI/SDK/schema/migration/test change or
  raw credential is included.

## Installed native continuation — Android viewer/owner boundary — September22

- Reused the retained Android emulator `emulator-5556` with the existing
  viewer session and r5 build. The real Home dashboard opened Home Members and
  rendered the three existing fixture members (owner plus two tenants), and
  Home Settings loaded its existing identity/property/access sections. No
  member or settings mutation was sent.
- From the same viewer Home Settings route, Documents reached the real list
  screen and rendered the existing permission error (`You don't have
  permission to do that.`) with Retry. The viewer's real Home `/me` payload
  lacks `docs.view`, so this is the expected server/UI denial state rather
  than an empty-list or crash. The retained screenshot is private at
  `.stream2-verification/native/shots/android-home-members-r6.png`.
- A real owner login against the running backend returned HTTP 200 for Home
  `/me`, documents, guest-passes, tasks and issues; all five collections were
  empty. The installed viewer dashboard Tasks tab still shows the existing
  placeholder despite `tasks.view`/`tasks.edit`, and Issues has no reachable
  Home entry for this account. These remain recorded IA/product gaps; no
  redesign or speculative navigation repair was made.
