# Stream 2 — Posts, Hub and payments

> **Split on 2026-09-30 (user direction).** The former Stream 1 (gigs, payments and coordination) became two streams:
> - **Stream 1 — Support Trains and coordination**: [`01-trains-coordination.md`](01-trains-coordination.md). It owns the merge queue.
> - **Stream 2 — Posts, Hub and payments** (this file).
>
> The former Stream 1's full history — evidence, decisions, batches and the pre-split acceptance accounting — stays in [`former-stream1-gigs-payments.md`](former-stream1-gigs-payments.md), frozen at the split. Its "Split reconciliation" proves that every checklist item went to exactly one of the two streams (230 = 122 + 108).
> **Not this stream:** the *former* Stream 2 (Home and household) is now Streams 3–4 ([`03-home-access-residency.md`](03-home-access-residency.md), [`04-place-records-money-mail.md`](04-place-records-money-mail.md); its history is [`former-stream2-home-household.md`](former-stream2-home-household.md)). Stream 5 (formerly Stream 3) is also separate.

## CURRENT RESUME — HANDOFF 2026-09-30T21:31Z (successor: start here)

> **2026-09-30T23:13Z:** the successor session is active; #1096 merged in batch 220, so step 2 below is done. Live progress is in CURRENT STATE.

The session "Stream 2: Posts, Hub and payments" handed over at the user's request. **Nothing is in progress:** all code is pushed, and one PR (#1096) waits for Stream 1's batch. The next-agent prompt is [`NEXT-STREAM2-PROMPT-2026-09-30-evening.md`](NEXT-STREAM2-PROMPT-2026-09-30-evening.md). Newest dated text wins. **Re-verify every SHA, PR, slot and process live.**

### 1. Where things stand (checked at 21:27–21:31Z)

- **Master** is `11e2b72f6` (batch 219). Every `claude/stream2-*` branch on origin is an ancestor of master except `claude/stream2-web-post-edit`.
- **The only open PR is [#1096](https://github.com/WangPantopus/skinny-pantopus/pull/1096): web can edit your own post.**
  - Head `c26c706e4968af49a049105bacc3014f79112e2f`. Seal `406c0939ba649052f7f5dcda10ee3fbc3e19f7184bf82e8e16e9593421861a91` (bundle `20260930-stream2-web-post-edit-r1`, 58 files).
  - CI: "Web (lint, typecheck gate, Jest)" and "Web E2E" pass (run 36778944709); the other jobs skip (web-only).
  - Stream 1 has it for its next batch. Stream 1's rule is "please don't merge any yourself".
- **Merged this evening:**
  - batch 211: #1038, #1047;
  - batch 214: #1073;
  - batch 215: #1078;
  - batch 218: #1075, #1085, #1086, #1088, #1091.
- **Checklist (this file's section below):**
  - U02: 81 done, 2 boundary. iOS Payments & wallet sit behind the simulator's device-passcode prompt, and Android wallet screenshots are blocked by the secure screen.
  - U03: 54 done, 1 to do, 2 not offered. The to-do is "Edit a post → Web" = #1096.
  - U04: 16 done.
- **Acceptance rows P01–P10** are unchanged: money journeys reuse the accepted evidence. Their hosted and provider parts need the user's environments. For U05, the inventory is Stream 2's input, and Stream 1 assembles the release manifest.

### 2. First steps

1. **Read-only checks:**
   - `date -u`;
   - `git fetch`, master, `gh pr view 1096`;
   - `bash /private/tmp/pantopus-tools/heavy-slot.sh status`;
   - `zsh /private/tmp/pantopus-tools/device-slot.sh status` (it's a zsh script; bash fails on its `(N)` glob);
   - `ListAgents`.

   Introduce yourself to Stream 1 as "Stream 2: Posts, Hub and payments".
2. **When #1096 merges:**
   1. In `checklists/data_s2.py`, change U03 "Edit a post" → Web to `done`, with evidence `#1096 merged (batch N), seal 406c0939`.
   2. Run `python3 checklists/gen.py check`.
   3. Render with `gen.py md 2 "$(date -u +%Y-%m-%dT%H:%MZ)" https://claude.ai/artifact/WFpmhCwcUyLyakPRLjxJCu` and paste it over this file's checklist section. **The review page moved on 2026-09-30T23:14Z** (Stream 1 republished it): use https://claude.ai/artifact/FQw1gNR2vwNNKw9cGSxsT2 from now on.
   4. Commit by explicit paths and push `codex/workstream-coordination`.
   5. Ask Stream 1, the holder of the review page, to republish it.
   6. Mark the inventory row "Web · post edit" FIXED.

   If Stream 1 asks for #1096 changes: the branch is checked out in worktree `…/stream-2-posts-hub-payments-76db95`, and Next on 18169 serves that worktree.
3. **Then the backlog below, in order.** Reproduce before repairing, make the smallest repair, and send each head and seal to Stream 1.

### 3. Backlog (ordered; my recommendation; full rows in the inventory)

1. **Web deal expiry copy** (candidate; source read, not reproduced):
   - The composer's deal expiry placeholder says "Expires (optional)" (`DealFields.tsx`).
   - The Place-feed create path returns 400 "Deals must include an expiration date." without one (`backend/routes/posts.js`).
   - Reproduce on web first, then fix the copy or client validation.
2. **Native posting-eligibility check** (candidate, not reproduced). Web's stale "last answer wins" (fixed in #1078) exists natively too, but there it only drives a warning banner. Check before changing anything.
3. **iOS Today "Manage"** has no route to Notification settings; it opens the inbox. Android opens Notification settings. After #1075, the briefing push shows only Back and Share.
4. **Native post page "SHARE" chip** (UX candidate). The detail chip collapses seven types into "SHARE", while the feed card says Rec/Deal/Win and web says "RECOMMENDATION". It's presentation: decide under the standing direction, record the decision, and keep it separate from functional repairs.
5. **Web post page type strip in dark mode** stays light (presentation; contrast passes). Stream 1 owns the palette, so coordinate first.
6. **Web feed map popup:** near the top of the map, the "Search this area" pill covers the popup's type chip (layout).
7. **Later / only if needed:**
   - Align the unscheduled SQL twin `auto_archive_expired_posts()` with #1086's 32 h grace if it's ever scheduled.
   - The radon line's EPA link needs a new client field.
   - After launch: true instants with the poster's zone and end-of-local-day expiry (data migration + all clients).
8. **Carried notes (act only if reproduced):**
   - web `/api/location/resolve` ignores a stale unpinned area (parity note);
   - the post-save toggle race 500 (every client guards double taps);
   - iOS `ChatConversationView(…, onUseAIDraft:)` trailing closure binds to `onBack` (chat files are Stream 5's).

### 4. Runtime (left running for you; verify live)

- **Stack** `pantopus-stream2-posts-20260930` (7 containers; workdir `/private/tmp/pantopus-stream2-posts-db-20260930`):
  - API 64581, Postgres 64582, shadow 64580. Range 64580–64589 is Stream 2's.
  - The newest applied migration is `20260930184000`, which is master's newest at 21:28Z.
- **Private runtime** `/private/tmp/pantopus-stream2-runtime-20260930`. PIDs are in `PIDS.txt`; logs are in `logs/`.
  - Never print or copy `.keys.env`, `.local-secrets.env`, `.fixture-password`, `.webhook-secret`, `.tokens-*` or `.webstate-*`.
  - **Backend 18160** (`/health` 200): `start-backend.sh`.
    - env -i allowlist, TZ=UTC, jobs and cron off.
    - Egress guard and Stripe guard; a placeholder `sk_test_` key, with api.stripe.com blocked.
  - **Fault proxy 18168** (`/health` 200): `node fault-proxy.cjs`, run from the runtime dir.
    - Controlled with `fault.py add|clear|rules|log|seq`.
    - Actions: status (custom body/count), delay, hold, reset, lose.
  - **Next dev 18169:** `start-web.sh`, TZ America/Los_Angeles. Its `/api` is rewritten to 18168. The first compile of a route takes about 25 s.
  - **Restart or re-point:**
    - Both start scripts take `WT=<worktree>`.
    - Stop a process by its PID after checking `lsof -nP -iTCP:<port> -sTCP:LISTEN`.
    - Start again with `WT=… nohup ./start-….sh > logs/<name>-$(date -u +%Y%m%dT%H%M%SZ).log 2>&1 &`, then update `PIDS.txt`.
- **Fixtures:**
  - Alice/Bob/Dana `f9300c02-0000-4000-8000-00000000000{1,2,3}` (`s2.posts.*.0930@example.com`), all viewing Vancouver, WA. The password is in the 0600 file; never print it.
  - Now: Post 3 (the seed), Gig 0, Payment 0, PostComment 0, Notification 0.
  - Sign-in bookkeeping remains (AuthSession 85, AuthSecurityEvent 115, AuthDpopJti 74). Remove it at the final teardown only.
- **Helpers (runtime dir):**
  - `api.py login|<actor> METHOD path [json]`, `snapshot.sh`, `seal.py <dir> <branch> <commit> <boundary>`, `money-ui-fixtures.py create|cleanup <dir>`, `run-node.sh <script>`.
  - `webcap.mjs` (steps goto/click/clickText/clickRole/fill/fillPh/press/wait/waitText/waitUrl/eval/shot/sh/fault; cfg.geolocation).
  - `a11ycap.mjs` (axe; **no eval step, it's silently ignored**; `A11Y_BASE=http://localhost:18169 A11Y_STATE_SUFFIX=-localhost`), `a11ycap-geo.mjs` (Vancouver GPS fix), `modalcap.mjs`.
  - Android: `aui.py dump|tap|has|shot`, `a11y-tree.py`, `native-build-iosu02.sh`, `android-build-iosu02.sh`.
  - **Never copy** `run-node.sh`, `api.py`, `webcap.mjs` or `android-switch.py` into bundles, or webcap network logs. Redact token, password and session paths in any runner copy.
- **Devices** (resources released 2026-09-30T22:42Z):
  - `emulator-5560` (AVD `pantopus_s2`) is **stopped**, and device slot 3 is **released**. The AVD and its app data are kept (Alice was signed in).
  - To use it again: `zsh /private/tmp/pantopus-tools/device-slot.sh acquire "stream2: pantopus_s2 emulator-5560 <purpose>"`, then boot headless with `-port 5560 -no-window -no-snapshot -crash-report-mode disabled -no-metrics` (about 23 s). Never consent to a crash dialog.
  - Kept APK: `$R/apk/app-debug-35a9f5f1c.apk` (#1085's head). Build a fresh one from master for new work.
  - Deleted as regenerable: `$R/ios-derived-data` (12 GB), the older APKs (about 1.2 GB), and the worktree's `frontend/apps/android/app/build` (1.5 GB).
  - No iOS simulator access in this session; Stream 1 runs Stream 2's iOS cells.
  - Heavy slot: nothing of Stream 2's is held or queued (Stream 4 held it at 21:19Z).
- **Teardown** (only when Stream 2's runtime is ended):
  1. Stop Next, proxy and backend by PID.
  2. `docker stop` the 7 `*_pantopus-stream2-posts-20260930` containers, and never any other.
  3. The emulator is already stopped and slot 3 released (22:42Z).

### 5. Decisions recorded this session (per the user's standing direction)

1. **F6:** the iOS tip sheet draws on the opaque app surface, not system glass.
2. **F8:** the refund reasons list inline.
3. **F7:** the empty-history line is "No requests yet." on all three clients.
4. The web composer A3 was measured with a fresh GPS fix, never by loosening the Place rule.
5. **Deal auto-archive** waits 32 h past the stored midnight (Stream 1's rule).
6. **Web shows stored event and deal times as typed** (UTC wall clock), and the composer sends an explicit `Z`.
7. **A Place preview follow-up names only what claiming really gives.**
8. **Web post edit:**
   - author-only; the composer in edit mode;
   - only changed fields are sent, so untitled stays untitled;
   - audience, location, photos, an alert's type and a lost-and-found contact stay as posted, and the form says so;
   - one automatic retry for a lost reply or a 5xx;
   - the backdrop doesn't close the dialog.
9. The native "SHARE" chip mapping stays a recorded candidate.

### 6. Lessons

- **Through the Next proxy, a dropped upstream reply reaches the browser as a 500, not a network error.** Retry logic must treat 5xx as possibly committed, and the retried call must be safe to repeat.
- **webcap:**
  - composer creation on this runtime needs "Location" → "Use current location";
  - scope dialog clicks with `[role=dialog] button:text-is("Save")`, because the card behind has its own "Save";
  - the PostCard root is `<article>`.
- **axe can't measure a chip covered by another element** (the map pill). Sample rendered pixels instead (scratch `pngpix.py`).
- **Build hygiene:** Android ktlint wants `LiveRegionMode` imported before `clearAndSetSemantics`. Make every commit compile on its own. Run the covering web Jest suites (or all, about 10 s) before pushing.
- **zsh:**
  - quote git paths containing `:`;
  - heredocs with UUIDs misparse, so write configs from python;
  - `device-slot.sh` needs zsh.
- **`aui.py tap "<text>"` can hit a notice carrying the same words.** Tap by bounds.
- **The Place preview API returns 503 on this stack** (no geocoder). Use a labelled stand-in preview that carries the service's own card.
- **modalcap needs a fresh `.webstate-alice.json`.** Refresh it with a webcap login.

### 7. Evidence from this session

Bundles are in `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`. The seal is the MANIFEST sha256.

| Bundle | Seal | PR |
|---|---|---|
| `20260930-stream2-web-post-edit-r1` | `406c0939` | #1096 (open) |
| `20260930-stream2-place-preview-truth-r1` | `ccfadc25` | #1091 |
| `20260930-stream2-web-post-dates-r1` | `4c7f54d7` | #1088 |
| `20260930-stream2-deal-archive-pacific-day-r1` | `d9c215dc` | #1086 |
| `20260930-stream2-ios-u02-fixes-r1` | `1d07a1ac` | #1085 (Stream 1's iOS pass: `e3137445`) |
| `20260930-stream2-web-tip-sheet-dark-sunken-r1` | `db86c5f9` | (after Stream 1's #1082) |
| `20260930-stream2-web-place-eligibility-race-r1` | `fe6ecd1e` | #1078 |
| `20260930-stream2-web-composer-a3-r1` | `7d308e46` | (measurement) |
| `20260930-stream2-large-text-dialogs-r1` | `42bb8b0b` | #1075 |
| `20260930-stream2-web-recommend-chip-contrast-r1` | `a0260faa` | #1073 |
| `20260930-stream2-web-a3-master-recheck-r1` | `daf7aa08` | (measurement) |
| `20260930-stream2-posts-followups-r1` | `a67de577` | #1047 |
| `20260930-stream2-hub-today-truth-r2` | `88bd4642` | #1038 |

Stream 1's iOS evidence for these cells:
- `20260930-stream1-ios-u02-stream2-r1` (`3df1ecfb`);
- the #1085 pass `e3137445`;
- `20260930-stream1-ios-primary-ink-r1` (MANIFEST `3be31394`; #1061, and #1075's briefing view shows only Back and Share).

The inventory, `…/20260930-stream2-posts-hub-payments-inventory-r1/INVENTORY.md` (living, unsealed), was updated at this handoff with every status above and the follow-ups.

## CURRENT STATE — 2026-09-30T23:31Z (Stream 2 session "Stream 2: Posts, Hub and payments", successor)

- **Latest (2026-09-30T23:31Z): [#1113](https://github.com/WangPantopus/skinny-pantopus/pull/1113) sent to Stream 1** — web composer: a Place deal needs an end date, and the composer says so before sending (backlog item 1).
  - Head `b3e4f933a5aa2bbf462713be8ab0a1d99c2f3938`, seal `401fee1636beb71bd2c5f8265755bad4f39878b9a4f825f11c37be8dae8ac246` (bundle `20260930-stream2-posts-web-deal-expiry-r1`, 40 files). Web only, 2 files.
  - **Reproduced on master in Chrome:** the date field's "Expires (optional)" placeholder never renders on `type=date`, `POST /api/posts` → 400 "Deals must include an expiration date.", and the only feedback was the feed's 3-second bottom toast (no live region).
  - **Fix:** a Place deal (nearby, neighborhood, saved place, target area) with no end date stops in the composer with the edit path's "A deal needs an expiry date." and sends nothing; the field is `aria-required` there. Connections deals may still omit it.
  - **Verified in Chrome:** no request without a date and the draft kept; one 201 with a date ("Expires 10/15/2026"); a Connections deal without a date still 201. axe light 0; dark 1 pre-existing chip failure (below). Type-check gate 0, ESLint 0, Jest 122/2343. Cleanup 351/353 (2 = sign-in bookkeeping).
  - **Decisions** (standing direction): stop before sending with the existing wording (rejected: a native-style prefilled date, or a placeholder-only change that no browser shows); `aria-required`, not `required`. Kept separate: a visible "Deal ends" label; a live region for the feed toast.
  - **New finding:** in dark mode the composer's "Your location" chip draws the intent accent as text on the dark card (Deal #15803d on #0f1e2b = 3.37:1). Palette is Stream 1's; told it, measuring every intent next.
  - **Next:** backlog item 2 (native posting-eligibility "last answer wins": check before changing).
- **Earlier (2026-09-30T23:13Z): the successor session is active** (started 23:12Z by `date -u`).
  - **[#1096](https://github.com/WangPantopus/skinny-pantopus/pull/1096) merged** in batch 220 ([#1098](https://github.com/WangPantopus/skinny-pantopus/pull/1098), 2026-09-30T21:37:21Z) at head `c26c706e4`. Master is now `a211e1f48` (batch 223).
  - **Checklist:** U03 "Edit a post → Web" is done (#1096, seal 406c0939). U02 81 done / 2 boundary; U03 55 done / 0 to do / 2 not offered; U04 16 done. The inventory rows for web post edit and the composer date labels are marked fixed.
  - **Review page:** Stream 1 republished it at a new URL, https://claude.ai/artifact/FQw1gNR2vwNNKw9cGSxsT2 (23:14Z; the old one can't be updated from its account). The checklist section above is re-rendered with it.
  - **Runtime:** backend 18160 (PID 64016) and Next 18169 (PID 64140) now serve this session's worktree `stream2-posts-hub-payments-29bc9a` (master `a211e1f48`; its node_modules brought to the current lockfile with `pnpm install --prefer-offline --frozen-lockfile`). The proxy 18168 and the stack are unchanged.
  - **No open Stream 2 PRs.** Next: the handoff backlog in order, starting with (1) the web deal expiry copy (reproduce first).
- **Earlier (2026-09-30T21:31Z): handed over** at the user's request; start from "CURRENT RESUME — HANDOFF" above.
  - **Merged in batch 218** (#1094, master `d0a39aa4e`): [#1075](https://github.com/WangPantopus/skinny-pantopus/pull/1075), [#1085](https://github.com/WangPantopus/skinny-pantopus/pull/1085), [#1086](https://github.com/WangPantopus/skinny-pantopus/pull/1086), [#1088](https://github.com/WangPantopus/skinny-pantopus/pull/1088) and [#1091](https://github.com/WangPantopus/skinny-pantopus/pull/1091). Master is now `11e2b72f6` (batch 219).
  - **[#1096](https://github.com/WangPantopus/skinny-pantopus/pull/1096)** head `c26c706e4`, seal `406c0939…`: web can edit your own post (Stream 1's conditions met).
    - Verified in Chrome: an untitled post stays untitled; E1 (a failed save keeps the edit), E2 (a lost reply is retried once and saved once) and E5 (deleted meanwhile says so).
    - axe found the composer's event start input unnamed (the create form shares it). After naming the date inputs: 0 in light and dark.
    - CI passes. It is with Stream 1 for its next batch.
  - **Checklist:** U02 81 done / 2 boundary; U03 54 done / 1 to do (#1096); U04 16 done. The inventory now marks every fixed row and lists the follow-ups.
- **Earlier (2026-09-30T20:58Z):**
  - **With Stream 1** (its merge order: #1061 → Trains U02 → #1075 → #1085 → #1086 → #1088, then #1091):
    - **[#1085](https://github.com/WangPantopus/skinny-pantopus/pull/1085):** Stream 1 passed the iOS after-checks on candidate 63585f622. The U02 addendum is resealed as e3137445.
    - **[#1086](https://github.com/WangPantopus/skinny-pantopus/pull/1086):** deal archive (backend review first).
    - **[#1088](https://github.com/WangPantopus/skinny-pantopus/pull/1088)** head `e82fb445c`, seal `4c7f54d7…`: web event and deal dates read as typed.
      - Before: 6:00 PM read 11:00 AM, and Oct 15 read 10/14.
      - After: the dates render in UTC and the composer sends an explicit Z. No data change; legacy posts are fixed too.
    - **[#1091](https://github.com/WangPantopus/skinny-pantopus/pull/1091)** head `db729a35c`, seal `ccfadc25…`: the Place preview promises only what claiming gives.
      - Radon uses A3's line. Election, environmental, water, flood and seismic follow-ups are made true. Handed over by Stream 4.
  - **Next:** web post edit, approved by Stream 1 with conditions: author-only; reuse the composer and `updatePost`; E1/E2/E5; untitled stays untitled; nothing silently dropped; axe in both schemes.
- **Earlier (2026-09-30T20:39Z):**
  - **Merged:** [#1078](https://github.com/WangPantopus/skinny-pantopus/pull/1078) (batch 215): "Use my location" keeps the composer; "Current location".
  - **Sent** (in order):
    - **[#1085](https://github.com/WangPantopus/skinny-pantopus/pull/1085)** head `35a9f5f1c`, seal `1d07a1ac…`: Stream 1's iOS U02 F1–F3/F6–F8, plus "No requests yet." on all three clients.
      - Android: verified on the emulator (Check status sends GET …/refunds; the line stays).
      - Web: verified in Chrome.
      - iOS: build-for-testing and lint pass; the runtime check is Stream 1's (candidate 63585f622).
    - **[#1086](https://github.com/WangPantopus/skinny-pantopus/pull/1086)** head `82b818b31`, seal `d9c215dc…`: deal auto-archive waits until 32 h past the stored midnight, the end of the stated day in US Pacific (Stream 1's rule).
      - Replayed at the 04:00 UTC runs: master archived an "Oct 1" deal at Sep 30 9 PM Pacific; the fix keeps it through Oct 1.
  - **Web tip sheet A2 dark done** after Stream 1's #1082: presets #080E20 on #0F172A, axe 0. Seal `db86c5f9…`.
  - **Found and approved by Stream 1:** web shows post event times 7 h early and web deal dates a day early for Pacific users.
    - All three clients store the typed time as UTC wall-clock, but web renders it in local time.
    - Fix next (web only): render in UTC and send an explicit `Z`.
  - **Handed over by Stream 4:** three unbacked Place preview claims in `placePreviewService.js`: the radon reminder, election deadlines "on its page", and a ballot-deadline reminder. Fix after the date PR.
  - **Queued last:** web post edit, approved by Stream 1 with its conditions.
  - **Decisions** (standing direction):
    1. F6 opaque tip sheet.
    2. F8 inline reasons.
    3. F7 wording "No requests yet.".
    4. The deal-expiry rule is Stream 1's.
    5. The native "SHARE" chip mapping stays a recorded candidate.
- **Earlier (2026-09-30T20:06Z):**
  - **[#1078](https://github.com/WangPantopus/skinny-pantopus/pull/1078)** head `7b39a6332` (sent), seal `fe6ecd1e…`, web Pulse feed:
    - "Use my location" could leave an eligible viewer without the composer: the stale load-time eligibility answer (no GPS) landed after the fresh-GPS answer. Reproduced with an 8 s delay at my proxy.
    - Fix: only the latest check decides. The area line now says "Current location" instead of "Set area".
  - **Web composer A3 done** with a posting-eligible viewer (emulated GPS; the Place rule is unchanged): 0 contrast failures in light and dark. Seal `7d308e46…`.
  - **F-branch** is now `35a9f5f1c`:
    - my eb67866a9 build failed Android ktlint on an import order (fixed);
    - iOS build-for-testing passed;
    - the Android rebuild is queued behind Stream 1's combined candidate (told to rebuild with 35a9f5f1c).
  - **Reminded Stream 1:** the dark sunken token from your 09-30 decision is still open on master.
- **Earlier (2026-09-30T19:41Z):**
  - **Merged:**
    - [#1038](https://github.com/WangPantopus/skinny-pantopus/pull/1038) and [#1047](https://github.com/WangPantopus/skinny-pantopus/pull/1047) in batch 211 (master `ef2022ba5`), at heads `b4e8bebed` and `9d7eb585d`. Seals: r2 `88bd4642…`, followups `a67de577…` (resealed with the test-bundle addendum), untitled `176cd103…`.
    - [#1073](https://github.com/WangPantopus/skinny-pantopus/pull/1073) in batch 214 (master `20e7b4768`): the Recommendation chip's text is #92400E. It went 4.33 → 6.12 on the post page and 4.29/4.46 → 6.06/6.29 on the map chips. Seal `a0260faa…`.
  - **Open:** [#1075](https://github.com/WangPantopus/skinny-pantopus/pull/1075), head `2fbf87fc2`, seal `42bb8b0b…`:
    - Android Sun & sky 8 dp gap at font 2.0;
    - the Report/Delete dialogs survive a configuration change;
    - iOS Today More/Manage only where they lead.
    - Stream 1 holds it for one iOS compile and run in its combined candidate.
  - **Stream 1's iOS U02 pass** (`20260930-stream1-ios-u02-stream2-r1`, `3df1ecfb…`):
    - Pulse feed, Post detail, Composer, Report and Hub pass.
    - My posts, Today and the Start/preview blues in dark wait on Stream 1's #1061.
    - Payments & wallet sit behind the simulator's passcode prompt (boundary).
  - **Fixes on `claude/stream2-ios-u02-fixes` `eb67866a9`** (pushed; my Android + iOS build is queued in the heavy slot):
    - F1/F2/F3: the Place preview Back, the address clear ✕, and the Start, tip and refund fields are named.
    - F6: the tip sheet draws on the opaque app surface.
    - F7: "No requests yet." after a check finds none, on iOS, Android and web. Web is verified in Chrome with a money fixture, which stays in place until the Android run.
    - F8: the refund reasons list inline.
  - **Decisions** (per the user's standing direction):
    1. **F6:** the tip sheet uses the opaque app surface, not system glass. Glass over the dock's blue can't guarantee AA for a money sheet. Agreed with Stream 1; this matches Android and web.
    2. **F8:** the refund Reason picker lists inline (one row per reason, as Android's radios do). The system menu truncated the value at AX5.
    3. **F7:** the empty-history line is neutral, "No requests yet.", because the sheet covers both refunds and hold releases.
    4. **Composer A3 on web:** it needs a posting-eligible viewer. My Alice is a remote viewer on Place, so the composer is correctly hidden. It'll be measured with a fresh-GPS runner, not by loosening the Place rule.
- **Earlier (2026-09-30T19:00Z):**
  - **Web A3 re-checked on master `2693fcbcf` after #1052** (axe, light and dark; seal `20260930-stream2-web-a3-master-recheck-r1` `daf7aa08…`):
    - Pulse feed, My posts, Hub, Today detail, wallet and payment settings: no contrast failure in either scheme. Five "decide" cells are now done.
    - Post page: the Recommendation type chip is 4.33:1. It is #B45309 on its 8.2% tint over bgLight, and 10px bold text needs 4.5.
      - The map's popup and cluster chips fail too (4.498 and 4.29).
      - Every other type passes every composite (lowest 4.59).
      - Stream 1, the palette owner, approved #92400E: branch `claude/stream2-recommend-chip-contrast` `6f4a3d8c5`, one line in `post-types.ts`. The web after-run is next.
    - Composer: the master capture didn't open the New Post dialog, so the after-run re-measures it.
    - Tip sheet dark: the sunken token still equals the card surface. That's Stream 1's token change (you decided on 09-30).
    - Recorded, not changed: the post page's type strip stays light in dark mode. It's presentation, a separate item per Stream 1.
  - **[#1038](https://github.com/WangPantopus/skinny-pantopus/pull/1038)** head `b4e8bebed`: the pinned iOS test builds the Today DTOs with their current fields. build-for-testing succeeded, and r2 is resealed (`88bd4642…`). Waiting for CI and Stream 1's batch.
  - **[#1047](https://github.com/WangPantopus/skinny-pantopus/pull/1047)** test fix `9d7eb585d`: the post-detail test matches the error state's `retryable`. build-for-testing is queued in the heavy slot; I push once it passes.
  - **Stacked branch** `claude/stream2-large-text-dialogs`:
    - three fixes: Sun & sky spacing at font 2.0, the Report/Delete dialogs survive a configuration change, and iOS Today shows More/Manage only where they lead somewhere;
    - rebased on `b4e8bebed`; the PR follows #1038's merge.
- **Earlier (2026-09-30T17:57Z):**
  - **[#1038](https://github.com/WangPantopus/skinny-pantopus/pull/1038)** head `71cf7309a7ebc3aefd585158bbca98ed52af869b`, re-sent to Stream 1.
    - Share sends only place-level information: weather, public alert, allowlisted signal kinds. Never the viewer's bills, tasks, calendar, mail or gigs, a summary line, or the place name.
    - The Today screen loads when a signal carries an action object. Before, it showed "Couldn't load today" for anyone with pickup days or a task today.
    - Verified on Android with a "Gig today" fixture. Seals r1 `44bc9f8b…`, r2 `32cf8dfc…`.
  - **[#1047](https://github.com/WangPantopus/skinny-pantopus/pull/1047)** head `d0470cd8c` (sent). Five follow-ups:
    1. Cold-start "Pantopus" tips are info cards with a working dismiss on all three clients (they opened "We couldn't find this post").
    2. Untitled posts (web's default) can be edited in both apps; the title stays null.
    3. Web "Later" on Attach a Home is remembered.
    4. iOS gives no Try again on a gone post.
    5. iOS My posts → Write a post shows the purpose picker.
    - Android and web verified. Seals `9e667fe9…` and `176cd103…`.
  - **Next:** the Android Sun & sky caption spacing at font 2.0, after #1038 merges.
- **Earlier (2026-09-30T17:37Z):**
  - **[#1034](https://github.com/WangPantopus/skinny-pantopus/pull/1034) merged** (batch 201, `cb72a43cd`).
  - **#1038 is held by Stream 1 for share privacy and fixed on the branch** (building, head `71cf7309a`):
    - Today's signals include the viewer's own bills, tasks, calendar, mail and gigs, and the summary line is composed from them. The share text joined them all.
    - The share message is now built at mapping time from the weather, a public weather alert and an allowlist of place-level signal kinds only (decided with Stream 1 under the user's direction, privacy first).
    - Reproducing that also found a second defect: signals carrying an `action` object made both apps' Today screen fail ("Couldn't load today"). This hits anyone with a pickup calendar or local update. Fixed by not decoding `action`.
  - **Stream 1 findings taken:**
    - The iOS comment-photo cell is "not offered" (text-only composer).
    - Cold-start "Pantopus" tips (seeded facts) open "We couldn't find this post" and send reactions for a fact id on every client. On web they render as full posts with no dismiss. The fix is drafted: info cards with the existing dismiss endpoint, on all three clients, going onto the follow-ups branch.
- **Earlier (2026-09-30T17:19Z):**
  - **[#1038](https://github.com/WangPantopus/skinny-pantopus/pull/1038)** head `3360078326c014e631a14bc4d5a178506917b7b8` (sent): the Hub Today screen tells the truth, and its Share, More and Manage work.
    - Real sunrise/sunset from the weather feed (the backend adds `weather.sunrise_utc` / `sunset_utc`). The Sun & sky card is left out without them.
    - Share sends the briefing without the place name, and the share line says so.
    - Android: More opens the menu and Manage opens Notification settings.
    - The chip reads "Post type: Share".
    - Seal `20260930-stream2-hub-today-truth-r1` `44bc9f8b…`. Android after-run done; iOS build and lint clean. iOS runtime is with Stream 1 and needs the branch's backend for real sun times.
  - **Building:** `claude/stream2-posts-followups` `b47934c50`, three small fixes:
    1. A post saved without a title (web's default general posts) couldn't be edited in either app. Android reproduced it: "Title is required", 0 writes (`20260930-stream2-post-edit-untitled-r1` before/). Stream 1 found it on iOS.
    2. iOS offered Try again on a gone (404) or hidden (403) post. Android already hides it.
    3. Web "Later" on Attach a Home is remembered for a week, per account. Verified in Chrome: snooze key 168 h, hidden after reload, back after expiry. Web tsc, ESLint and Jest (1951) pass.
  - **Next branch** (after #1038 merges):
    - the Android Sun & sky caption spacing at font 2.0 (captions touch);
    - iOS My posts → "Write a post" opens the purpose picker (it always made an Ask post; found by Stream 1). The patch is drafted and lint-clean.
  - **Stream 1's iOS runs**, all without code changes: Create E6 (`3ee82fc9…`), Edit E1/E2/E5 (`4b8ed58a…`), Posts L4 (`dd4939ee…`). That's 8 of my runtime cells. Left: the comment photo failure, and U02 A1–A4 on a master build.
  - **Stream 4:** told about sample tracking data on the mailbox package screen. It's launch-cut #7 (package tracking), so they recorded it under that boundary.
- **Earlier (2026-09-30T16:43Z):**
  - **[#1027](https://github.com/WangPantopus/skinny-pantopus/pull/1027) merged** (batch 198, master `a60e276bb`). Stream 1 verified its seal; lint and CI are green.
  - **[#1034](https://github.com/WangPantopus/skinny-pantopus/pull/1034)** head `7d15b7585984d038193c48755ea2a2590d1d226b` (sent). Android follow-up:
    - Start keeps "Sign in" on one line at font 2.0, and the address field is named;
    - task-progress steps read done / current step / not yet;
    - refund reason radios are named.
    - Verified on the APK of the head. Seals `20260930-stream2-u02-android-a11y-r2` `607283e7…` and `20260930-stream2-u02-money-screens-android-r1` `1e9293bd…` (the money fixture is removed: 350/353 tables equal the baseline, the other 3 are sign-in bookkeeping).
    - Also checked: Start and the Report dialog stay light and readable in dark mode.
  - **New finding, native Hub Today detail** (Android runtime; iOS maps the same placeholders):
    - The screen showed the design sample's sun times (sunrise 6:14 AM, sunset 7:32 PM, "13h 18m of daylight" on Sep 30 in Vancouver, WA, where the day is about 11h 45m).
    - It showed "3 members · sent to your household chat" for everyone.
    - On Android, Share (top bar and card), More and Manage did nothing.
    - The weather feed already had today's sunrise and sunset; the orchestrator dropped them.
    - **Fix** on `claude/stream2-hub-today-truth` `7d3341e7f` (backend + Android + iOS, plus the "Post type: Share" chip name), building in the heavy slot. Backend: 5 suites, 104 tests pass. SwiftLint `--strict` and SwiftFormat are clean. The Android build and after-run are next.
  - **Decisions** (per the user's standing direction):
    1. Today's Share sends the conditions, advisory, signals and the Pantopus link, but no place name, because a location label can be a street address.
    2. Android More opens the app menu (as on iOS), and Manage opens Notification settings (briefings and alerts). iOS Manage still opens the inbox (no route to Notification settings there; follow-up).
    3. Sun & sky is left out when the feed has no sun times, never guessed.
    4. A morning-briefing push on iOS opens Today (TodayTabRoot) with Back returning to the address's day and Share working. More and Manage there still have no route (follow-up).
  - **Stream 1's iOS runs** (no code change): U03 Hub R1 passes (`7a50ea0a…`); U04 Hub L3 + L2 pass (`3280a64f…`).
  - **Seen, not changed:** the Android Report dialog closes if the system theme changes while it is open (its state isn't kept across a configuration change; nothing is lost).
  - **Correction:** the first seals of the two #1034 bundles carried hand-typed times. The times now come from the files, the bundles are resealed, and Stream 1 has the new seals.
  - **My stack** is 16 master migrations behind (153000–183000). Applying them next, so the after-runs match master.
- **Earlier (2026-09-30T15:51Z):**
  - **iOS cells:** Stream 1 is taking all of my iOS runtime cells on its simulator: U03 E6, E1/E2/E5, comment photo failure and Hub R1; U04 L4, Start L2/L3 and Hub L2/L3; and U02 A1–A4 after #1027. They're marked "Stream 1 iOS, queued"; Stream 1 reports each one.
  - **A3:** Stream 1's accents PR moves `primary600` to #0369A1 (5.93:1). My Android A3 cells point at it.
  - **Follow-up** `claude/stream2-start-large-text` 7d15b7585 is queued (Android):
    - Start "Sign in" letter-wrapping at font 2.0 and the address field name;
    - the task-progress steps have no state for a screen reader;
    - the refund reason radios are unnamed.
    - Found with a synthetic paid-task fixture on my stack (no provider call; bundle `20260930-stream2-u02-money-screens-android-r1`, pending cleanup and seal).
  - **Money screens A4 (Android):** tip sheet (named; amounts correctly disabled while payouts aren't set up), payment card and Wallet pass. The refund form's reasons are fixed in the follow-up.
  - **Reviews for Stream 5:** #1028 (authenticated default-deny) approved for my four contracts.
- **Earlier (2026-09-30T15:31Z):**
  - **[#1016](https://github.com/WangPantopus/skinny-pantopus/pull/1016) merged** (batch 194, master `ed8f7d539`): archived posts stay in My posts after a reload. iOS verified by Stream 1 (`20260930-stream1-1016-ios-archived-reload-r1`).
  - **[#1027](https://github.com/WangPantopus/skinny-pantopus/pull/1027)** head `e032d3d5e50016b32fe3ba455f7d25f4878e5a7c` (sent): U02 Android accessibility, verified on the APK of the head. Seal `20260930-stream2-u02-android-a11y-r1` `a966aa19…`.
    - A4: selected states on Pulse, the composer, the Hub filter and list tabs; "More actions for …" names rows that have no title; the chip tone isn't read; "Heart reaction"; the Description and date rows are named.
    - A1 at font 2.0: Pulse chips were clipped; composer "Phone" was zero-width, so it couldn't be chosen; Hub captions were losing words.
  - **A2 verified with #1013:** dialogs and sheets are readable in system dark mode.
  - **A3:** only the brand blue #0284C7 fails (4.10:1 on white), so the Android A3 cells go to the app-wide token decision. Stream 1 is building "native accents AA".
  - **Building:** the Start screen follow-up c84be82ce ("Sign in" wrapped letter by letter at font 2.0; the address field had no name). Then a tiny follow-up after #1027 merges: a share post's chip reads "Post type: Share" (not "Share post", the same as the Share button), on iOS and Android.
  - **Reviews for Stream 5:**
    - #1018 (my two contracts, service_role positive controls) OK.
    - #1022 gigs.js `my-bid` via supabaseAdmin with the own-bid filter (the assigned worker's task detail is in scope) OK.
    - The other gigs.js anon reads are launch cut #4 or unused; they return 500 after the default-deny, which is accepted.
- **Earlier (2026-09-30T14:46Z):**
  - **Merged in batch 192** (#1014, master `a5f21354a`), together with Stream 1's Android theme fix #1013:
    - [#1005](https://github.com/WangPantopus/skinny-pantopus/pull/1005) native Lost & Found; iOS verified by Stream 1 (`20260930-stream1-1005-ios-lost-found-r1`);
    - [#1011](https://github.com/WangPantopus/skinny-pantopus/pull/1011) the PostLike/PostComment read revoke. **Hosted: deploy #1009's backend before applying 20260930180000.**
  - **[#1016](https://github.com/WangPantopus/skinny-pantopus/pull/1016)** head `a78ab346c6ea3144682ba1d5af851c234a49c527`: archived posts stay in My posts after a reload (owner-only `include_archived`, API + iOS + Android). Seal `20260930-stream2-my-posts-archived-reload-r1` `b74e23c0…`. Android was verified across relaunches; the iOS build succeeds.
  - **Building** (heavy slot): the U02 accessibility fixes on `claude/stream2-screen-reader-posts-hub` (e032d3d5e):
    - screen-reader selected states, names and field labels on the Pulse feed, post page, composer, My posts, Hub and shared list;
    - large text: Pulse chips were clipped, composer choices broke or were hidden ("Phone" at zero width, so it couldn't be chosen), and Hub captions lost words;
    - iOS: row names and heart reaction names.
  - **Drafted next:** the Start screen at large text ("Sign in" wrapped letter by letter) and the address field's screen-reader name.
  - **A2 dark mode** is unblocked by #1013; my Android A2 cells will be re-checked on the next APK.
  - **Cross-stream:**
    - The #980 iOS dialog-bug shape exists in Scheduling (launch cut #5) and Templates (hidden): recorded by Stream 1, not fixed.
    - Stream 5 is updating my payment-method-preferences and paid-gig-acceptance contracts for #992. I asked it to keep service_role positive controls.
- **Earlier (2026-09-30T14:04Z):**
  - **Merged:**
    - [#980](https://github.com/WangPantopus/skinny-pantopus/pull/980) (batch 188), My posts failure messages. iOS was verified by Stream 1 (`20260930-stream1-980-ios-my-posts-r1`, `d172244f…`), which also caught and got fixed an iOS Delete that never sent the delete (06ffc83fb).
    - [#1009](https://github.com/WangPantopus/skinny-pantopus/pull/1009) (batch 191), posts.js reads as the server. Seal `20260930-stream2-posts-admin-reads-r1` `6dad61c6…`.
  - **[#1005](https://github.com/WangPantopus/skinny-pantopus/pull/1005)** head `83cb4a4f77598f54f960f15ff8a9e7da5aee6634`: native Lost & Found. The post page shows "Lost · Contact: Phone …" (selectable), and found posts aren't labelled LOST on the feed. Seal `20260930-stream2-posts-native-lost-found-contact-r1` `903a2201…`; Android verified, Stream 1 running iOS.
  - **[#1011](https://github.com/WangPantopus/skinny-pantopus/pull/1011)** head `678a07f861a1d255b7c2c23d77305bee30a40ced`: migration `20260930180000` revokes client SELECT on PostLike and PostComment. Before, the anon key alone read every like and live comment. Seal `20260930-stream2-revoke-post-comment-like-reads-r1` `46bc61e3…`; Stream 5 reviewed it as correct.
    - **Deploy order on hosted: #1009's backend first, then this migration.**
  - **In progress:** archived posts vanished from My posts after a reload. The route dropped them even for the owner, so a post could never be restored.
    - Reproduced on Android. Stream 1 found it on iOS.
    - Fix a78ab346c: an owner-only `include_archived`, which native My posts sends (API + iOS + Android). The API was verified on my backend; the native build is queued.
  - **U02 Android sweep started** (`20260930-stream2-u02-android-a11y-r1`): screen-reader names and selected states on the Pulse feed, post page, composer, My posts and Hub (fixes next).
    - A2 dark mode is blocked on Stream 1's Android theme fix: Material dialogs and sheets turn dark while app screens stay light, which hides text. Stream 1 decided to keep the light scheme until real dark tokens exist.
  - **Decisions (per the user's standing direction):**
    - The likers list leaves out people in a block with the viewer, in either direction, following the posts/messages block model.
    - The Lost & Found contact goes on the post page only (not the feed cards), shown as stored, with no tap-to-call.
    - `GigPublic` is revoked, not dropped (Stream 5's PR).
    - listings.js's toggle goes through supabaseAdmin (Stream 5's PR).
  - **Runtime:** backend 18160 on the archived-fix head (PID 77091). Alice's farmers-market post stays archived for the after-run.
- **Earlier (2026-09-30T13:14Z):**
  - **[#989](https://github.com/WangPantopus/skinny-pantopus/pull/989) merged** in batch 184 (#991, master `0c95b18ca`, 13:13:04Z). Android Start no longer passes the previous person's address to the next person on the device (privacy). Seal `20260930-stream2-start-android-lifetimes-r1`, 73 files, `433cf635…11ba`.
    - Before: a visitor previews an address → Alice signs in → Not now → she signs out. The signed-out screen showed "Your Place · 500 W 8th St", and Bob was offered Alice's address to save.
    - Cause: the funnel's view model is Activity-scoped (composed outside the nav graph).
    - After (one app session, APK of the head): a fresh start screen after each sign-out; Bob gets no offer; the save path still works (201).
  - **[#980](https://github.com/WangPantopus/skinny-pantopus/pull/980)** head `bed19b524d498f3b11a1e1e283a178c6f20d43a1` (in Stream 1's queue): My posts now says when an archive, restore or delete fails, on iOS and Android. Seal `20260930-stream2-my-posts-action-failures-r1`, 46 files, `54995229…22cd`.
    - Verified on the real Android app with one-shot 500s. The post stays where it was; the success paths show no toast.
    - iOS built here. Stream 1 is running the iOS after-run on its own simulator before merging.
  - **Sealed with no code change:** Android Delete E1 (`20260930-stream2-posts-android-delete-e1-r1`, 22 files, `569a60a4…2064`). The post page keeps the post and says "Couldn't delete the post"; My posts was the gap, fixed by #980.
  - **In progress:** the native Lost & Found contact line, branch `claude/stream2-native-lost-found-contact` head `e6e8b5db5`. The iOS and Android post pages show "Lost · Contact: Phone 5555550123" as web does.
    - Reproduced on Android (no line) with two API fixtures by Alice, read by Bob. The API returns `lost_found_contact_pref` to him.
    - The native build is queued in the heavy slot.
  - **Decisions (recorded per the user's standing direction):**
    - Lost & Found contact: the native **post page** gets the line. Native feed cards stay as they are, though web shows the line on cards too: the post page is where a neighbor acts, and a card change would be a layout change.
    - The number is shown as stored (digits, like web). The line is selectable so it can be copied; there's no tap-to-call.
    - #980's iOS check: Stream 1 runs it on its simulator, because this session has no simulator access.
  - **Runtime:** emulator-5560 is signed in as Bob. The two LF fixture posts stay until the Lost & Found after-run. The Start stand-in rules are cleared (`rules: []`).
- **Earlier (2026-09-30T11:25Z):**
  - **[#953](https://github.com/WangPantopus/skinny-pantopus/pull/953) SEALED** (PR B; head `3a9c9ae8763134bfd9ad8f244e79539ad7c92d0c`; migration `20260930152000`; Stream 5 approved; sent to Stream 1). Seal `20260930-stream2-task-columns-account-deletion-r1`, 93 files, `f6a9b9c0…e0af`.
    - Asking a task question, reporting or being reported in a no-show, requesting a change, or starting a refund no longer blocks deleting the account.
    - Before: 23502 for 6 fixture people and 409 through the route. After: every deletion through the real route returns 200.
    - Deleted people read "Former member": web Q&A and change orders on the real client, and Android on this head's APK. iOS built only.
  - **[#957](https://github.com/WangPantopus/skinny-pantopus/pull/957) SEALED** (PR C; head `249fa42e00fbde994a6250e275659948f5a60f6a`; migration `20260930155000`; database only; sent to Stream 1). Seal `20260930-stream2-stale-change-requests-r1`, 27 files, `30389ae7…afb2`.
    - When a task's helper changes, its pending change requests are withdrawn ("The helper on this task changed.").
    - Before: after a release, the new helper approved the old helper's requests. After: approving returns 400.
    - Shown on web and Android through the real route.
  - **#899 verified on Android:** a stranger's "Message" on an assigned task opens a private direct room with the owner only.
  - **Out of launch scope (cut #4):** native Q&A shows every asker as "Neighbor" (the DTO decodes name/username; the backend sends displayName/handle).
  - **For Stream 5:** a direct ChatRoom whose two members both delete their accounts stays as an empty row.
  - **Next:** the U02–U04 native Android cells (APK = master + #953). iOS stays blocked on simulator access.
- **Earlier (10:32Z):**
  - **[#933](https://github.com/WangPantopus/skinny-pantopus/pull/933) merged** in batch 166 (master `77dc37f64`): a failed read isn't "not found" for post actions either.
  - **Account deletion is now first in the queue** (Stream 1 assignment: launch-critical, App Store requirement). It goes ahead of the native cells.
  - **[#944](https://github.com/WangPantopus/skinny-pantopus/pull/944)** head `de27f3f64c6258e4bfbb0c568d767687eee5001e` (sent to Stream 1; Stream 5 reviewing): stopping a task no longer blocks deleting the account.
    - Before: the route refused 7 of 9 people (everyone who cancelled or released a task, and every owner whose task was stopped).
    - Migration `20260930140000`:
      - a finished stop keeps its receipt with the actor cleared;
      - an unfinished stop is refused by a CHECK, and #936's `TASK_STOP_IN_PROGRESS` stays the message;
      - money-free receipts go with their task, while a stop tied to a payment keeps it (guard trigger);
      - the other person's cancel push is still delivered (null-safe comparison).
    - After: 9/9 real deletions through the route, 200.
    - Seal `20260930-stream2-stop-records-account-deletion-r1`, 59 files, `7fdfc16d…65f9f`.
  - **Next: PR B**, the five NOT NULL task columns that the route "sets to NULL" (GigQuestion.asked_by, GigIncident.reported_by/reported_against, GigChangeOrder.requested_by, Refund.initiated_by). Nullable + ON DELETE SET NULL, null-safe readers showing "Former member" on web, iOS and Android, proved with the dry run.
  - **Local tooling hazard (told Stream 1 and Stream 5):** on the arm64 image `supabase/postgres:17.6.1.106`, a permission-denied call under `SET ROLE authenticated` segfaults Postgres (recovery takes about 0.3 s). So do SQL contract blocks that expect `insufficient_privilege`, and gig-stop block 3. It reproduces on master's schema; CI (x86) passes.
  - **Native:** my Android APK built 10:16:46–10:22:23Z (master Android sources; the heavy slot passed to Stream 1). iOS stays blocked until the user grants simulator access to this session.

- **Docker came back empty at ~05:51Z** (Docker.raw recreated; 0 containers, images and volumes). Every earlier local stack is gone, including the founder's 64521/64522. The iOS simulator runtimes, Android SDK, AVDs and ~/.gradle were also removed from this Mac. **Stream 1 owns the machine-wide native reinstall and is waiting for the user's OK (~14–16 GB); no stream downloads toolchains itself.** Until then Stream 2 does web and API cells only.
- **Stream 2 runtime (new, own):**
  - Stack `pantopus-stream2-posts-20260930` in `/private/tmp/pantopus-stream2-posts-db-20260930`, built 05:54–05:55Z from master `ed5ea9ec5` migrations (93 applied). Ports: API 64581, DB 64582, shadow 64580; range 64580–64589 is Stream 2's.
  - Private runtime `/private/tmp/pantopus-stream2-runtime-20260930`: backend 18160, fault proxy 18168, Next 18169, all from worktree `stream-2-posts-hub-payments-76db95`. The backend uses an inert placeholder `sk_test_` key with api.stripe.com blocked by the egress guard, so no Stripe call can leave the Mac. PIDs are in `PIDS.txt`.
  - Fixtures: Alice/Bob/Dana `f9300c02-0000-4000-8000-00000000000{1,2,3}` (`s2.posts.*.0930@example.com`, password in a private 0600 file), all viewing Vancouver, WA; three posts by Alice.
  - Other streams' ports: Stream 1 64560–64569 + 18132/18138/18139; Streams 3/4 64550–64559 + 18142–18144; Stream 5 64531–64539 + 18130/18131/18134/18197/18198.
- **Open PRs (sent to Stream 1 with heads and seals):**
  - [#850](https://github.com/WangPantopus/skinny-pantopus/pull/850) head `f18c971e38ef07f9cee59f16a5e61786b9854a46`: web Pulse main feed. A failed area read no longer says "Set an area to see local posts"; it shows an error with Try Again, and skeletons while the read is in flight. The Neighborhood Pulse card no longer shows false zeros on a failed read or under a chip. Seal `20260930-stream2-pulse-web-feed-reads-r1`, 71 files, `f23b5c51…b057`.
  - [#851](https://github.com/WangPantopus/skinny-pantopus/pull/851) head `89c76c4476f0983c369248a8a44c1bcbef66c402`: the web public post page says "Couldn't load this post" with Try Again on a failed read. Only a 403 still says "isn't publicly shareable". Seal `20260930-stream2-posts-web-public-page-r1`, 45 files, `70ca346b…024a`.
- **#850 and #851 merged** in batch 138 (#853, master `1d5e76d85`, 2026-09-30T06:23:56Z).
- **[#856](https://github.com/WangPantopus/skinny-pantopus/pull/856)** head `33571df191e26f5e255ef73b2e18438e8178eb6f` (sent to Stream 1): Hub Today privacy and staleness.
  - Before: `/api/hub/today` was `private, max-age=300` with `Vary: Origin`, so after Alice signed out and Bob signed in on the same browser, Bob's Today showed Alice's area. The payload also carries coordinates and, for home owners, bill, task, calendar and mail signals. Refresh never reached the server, and an area change kept the old area; the server's per-user memo was never cleared.
  - Now: `private, no-cache` on /today and /briefings/:id, and the memo is cleared on location, pin and hub-preference writes.
  - Seal `20260930-stream2-hub-web-account-switch-r1`, 56 files, `1d30b5ea…f3f2`. Android likely had the same reuse through its OkHttp disk cache; the header covers it, but it wasn't run.
- **#856 merged** in batch 140 (#857, master `c063bb868`, 2026-09-30T06:36:53Z).
- **[#862](https://github.com/WangPantopus/skinny-pantopus/pull/862)** head `a61fcf72d12a6ae91e279bc452f04bccbbf32cd9` (sent to Stream 1): Lost & Found contact (create-a-post E6).
  - Web sent its free-text "How to contact you" as `contactPref` (the API allows only dm/comment/phone), so every natural note failed with 400. Web now mirrors the native Direct message/Comments/Phone choice and phone field.
  - Cards show words instead of "dm"/"phone|N".
  - The API strips non-digits from `contactPhone`, so the native apps' typed "(555) 555-0123" stops failing.
  - Seal `20260930-stream2-posts-web-create-bad-input-r1`, 44 files, `778875ca…abfa`.
- **Web Hub L2 (cold start) verified without code change:** seal `20260930-stream2-hub-web-cold-restart-r1`, 16 files, `42571869…ca43`.
- **#862 merged** in batch 143 (#864, master `eff3f69f5`, 2026-09-30T06:53:44Z).
- **Web delete E1 verified without code change:** the feed card, the post page and My Pulse each keep the post and say "Failed to delete post"; a retry deletes it. Seal `20260930-stream2-posts-web-delete-e1-r1`, 30 files, `32dfeb43…7127`.
- **Web L1 verified without code change:** post and comment drafts are kept while another tab runs a session refresh, and both send once. Seal `20260930-stream2-posts-web-draft-across-tabs-r1`, 15 files, `d0895b51…4d64`.
- **[#873](https://github.com/WangPantopus/skinny-pantopus/pull/873) merged** in batch 147 (#876, master `b16eca646`, 2026-09-30T07:18:29Z): web /start address lookup failures.
  - A failed suggestions read now says "We couldn't look up addresses right now." with Try again.
  - A geocoder outage returns 503 instead of 200 `could_not_place` "add the city and state"; a real no-result is still `could_not_place`.
  - Seal `20260930-stream2-start-web-lookup-failures-r1`, 32 files, `124f49b5…abfa`.
- **Web Start L2/L3 verified without code change:** the previewed address survives a browser restart and saves after sign-in; sign-out clears it; a draft bound to Alice is never handed to Bob. The geocoder reads used labelled proxy stand-ins. Seal `20260930-stream2-start-web-lifetimes-r1`, 23 files, `e2c35ebc…f33b`.
- **Found for other owners:** Scout and /unlisted still turn a geocoder outage into "add the city and state" (inventory row).
- **[#879](https://github.com/WangPantopus/skinny-pantopus/pull/879)** head `ec5c6b91dd85f8ddf1a30a9af9d0494f0f28620b` (sent to Stream 1): the closed post detail panel is `inert`. Before, it was only slid off-screen, so a keyboard walk of My Pulse reached "Close post" at x=1800. Web My posts U02 A1/A2/A4/A5 are done; A3 is the brand-blue token. Seal `20260930-stream2-posts-web-my-posts-a11y-r1`, 29 files, `678c1c3b…2bad`.
- **Web Hub R1 verified without code change:** the payload, the Today card and detail, and the Action Queue all fail truthfully; Discover's Posts tab makes no read. Seal `20260930-stream2-hub-web-reads-r1`, 31 files, `890d21cb…abe7`.
- **#879 merged** in batch 149 (#880, master `3bf2cde34`, 2026-09-30T07:25:43Z).
- **[#884](https://github.com/WangPantopus/skinny-pantopus/pull/884) merged** in batch 150 (#886, master `b06b9f3e5`, 2026-09-30T07:34:27Z). The web tip sheet is now a named modal dialog: focus moves in and stays in, Escape closes it only when Skip/Close would, the custom amount has its label, and the payout error is announced.
  - Seal `20260930-stream2-tips-web-money-a11y-r1`, 51 files, `27d8588c…ae22`.
  - U02 web A1/A3/A4/A5 are done. A2 goes to the token decision: in dark mode `--app-surface-sunken` equals `--app-surface`, so the $5/$10/$20 presets lose their fill (the class is used 772 times).
- **[#889](https://github.com/WangPantopus/skinny-pantopus/pull/889) merged** in batch 152 (#891, master `919305835`, 2026-09-30T07:42:55Z; hub record `13fe4c266`). On the task page, "Request a refund" moves focus into the form and Cancel returns it. The progress stepper's done/current labels use the existing dark variants (they were 3.55:1 and 3.0:1).
  - Seal `20260930-stream2-payments-web-card-refund-a11y-r1`, 33 files, `56a9edad…e3f5`. U02 web A1–A5 are done.
  - An early before-run carried uncommitted edits across a branch switch; it was discarded and the reason recorded.
- **[#894](https://github.com/WangPantopus/skinny-pantopus/pull/894) merged** in batch 154 (#895, master `b04c2c136`, 2026-09-30T07:55:46Z; head `b58174aec4d262cf28f28fcf17119c4d9ba1e74b`; hub record `9e74d794e`): **payee privacy repair** (found during the payment card check).
  - Bob's (the payee's) Earnings Breakdown showed the payer's "Visa ···· 4242".
  - `GET /api/gigs/:gigId/payment` kept the payer's card, payment-method id and risk band for the worker.
  - `GET /api/payments/:paymentId` and `GET /api/payments?type=received` gave the payee every Stripe id, the card, the risk band, and the fee receipt (`metadata.gig_fee` with the fee's provider charge id and request id).
  - Fix: `payeePayment()` removes those 11 fields and the receipt for anyone who isn't the payer. The payer and `gigs.manage` delegates are unchanged. Amounts, the public `gig_fee` and the web layout are unchanged; the payee just has no card line.
  - Seal `20260930-stream2-payments-worker-card-privacy-r1`, 50 files, `3eea59ac…0d60`.
  - Checks: backend Jest 341 suites. Native not run: no native model references the removed fields.
  - Decisions: the fee receipt was folded into the same PR (same leak class and routes); failure code/message are hidden from the payee; managers keep the full view.
  - Stream 1's review note (not blocking): `GET /api/payments/:paymentId` compares `payer_id === userId` while the list uses `String()`. Both are strings today; keep them consistent if either is touched again.
- **Bounded privacy check of money reads** (one synthetic paid task, 12 reads × signed out/stranger/payee/payer; seal `20260930-stream2-payments-money-reads-privacy-r1`, 44 files, `33058403…a1d8`):
  - Participant-only as intended: the payment, refund, tip, cancellation-preview and change-order reads. Wallet income rows store no provider ids.
  - Public by design (note, not changed): the task timeline and the task detail.
  - Found and fixed:
    - **[#900](https://github.com/WangPantopus/skinny-pantopus/pull/900) merged** in batch 156 (#901, master `b7eb7a7eb`, 2026-09-30T08:19:04Z; hub record `76df8c99f`), head `aa8dc567c1be65be4e556dde80ed31ef9d58362e`: `GET /api/gigs/:id` gave signed-out and stranger readers `payment_id`, `payment_status` and `cancellation_fee`. The web badge showed a stranger "Payment Held" or "Auth Failed" (the payer's card declined). Now these fields go only to the owner/managers and the worker, like `GET /:gigId/payment`; strangers get the unpaid-task layout.
    - **[#899](https://github.com/WangPantopus/skinny-pantopus/pull/899) merged** in the same batch 156, head `4eabfd2333a82a81f58214d1ec77188290da3a9c` (seal `20260930-stream2-tasks-chat-room-privacy-r1`, 42 files, `96ededab…4b91`): **a stranger could join an assigned task's chat.** `GET /api/gigs/:gigId/chat-room` (web "Send Message", shown to every viewer) added any signed-in caller to the poster–worker task room. Reproduced: Dana read Bob's note to Alice. Now a non-participant on an assigned task gets their own direct room with the poster, and the task room stays Alice and Bob's (Dana's read returns 403).
  - **The gig-room residue belongs to Stream 5** (coordinator decision LOCKED 2026-09-30T08:22:50Z, after crossed messages): people already in a task room keep reading it, because the chat messages read checks only that a membership row exists.
    - Stream 5 implements (b): a room check across the chat routes and socket, following its path map. Stream 2 is not an editor of `chats.js` or the socket, and reviews task-side behaviour when Stream 5 sends the PR.
    - (a), removing memberships from production data, stays with the user; Stream 5 raises it.
  - The stranger's tip-preview refusal says "The original tip needs to be checked before continuing." It returns no data, but the copy is misleading (note).
- **[#902](https://github.com/WangPantopus/skinny-pantopus/pull/902) merged** in batch 157 (#903, master `f310f01e6`, 2026-09-30T08:26:39Z; hub record `8e4581ea8`), head `cc4aca1235832853c51d7b1476aac85627d4e3c2` (seal `20260930-stream2-posts-location-privacy-r1`, 33 files, `48f986f3…cd92`): **non-authors got a post's exact point.**
  - `applyPostLocationPrivacy` blurred `latitude`/`longitude`, but `effective_latitude`/`effective_longitude` went out unblurred on the post detail (signed out included), the feed and profile posts, and so did the raw PostGIS `location` (post detail). For a home-linked post the effective pair is the home's coordinates.
  - Now non-authors get the same keyed blur on the effective pair and no `location`. Authors are unchanged, and web pages are pixel-identical. This is `docs/location-privacy-matrix.md` ("Non-authors never see exact post locations").
- **Proposal for the user (no written policy, so not changed):** anyone with an assigned task's link, signed out included, can read the worker's identity (`accepted_by`/`acceptedBy`) and the exact start/finish times (`/timeline`, detail). Together with the approximate task area, that shows when a named helper was at someone's place. The web doesn't display the worker to strangers.
  - Recommendation: give non-participants neither the worker's identity nor exact lifecycle times (dates only), like #900's payment rule.
- **User decisions (2026-09-30, this session):** "go with what you recommend for the best user experience and safety, security practice", followed by a standing direction to decide for UX, safety, retention and the best app, record it, and keep working. Memory: `user-decisions-stream2-2026-09-30`.
  1. Design tokens (AA brand blue and emerald, dark `--app-surface-sunken`): now **owned by Stream 1** (one editor app-wide; the user delegated it to Stream 1 as well). My measured pairs were sent to Stream 1, and my 8 token cells close from its evidence.
  2. Pulse filter chip split (mute control out of the chip button, same look): Stream 2, in progress.
  3. One-time removal of leftover gig-room memberships: approved. Stream 5 implements it after its read-side rule (#908), as a reviewed forward migration.
  4. Assigned-task privacy: done in #910 (below).
- **[#910](https://github.com/WangPantopus/skinny-pantopus/pull/910)** amended head `69dbb21a425db6b6edcc9460e4ac00844fc1a653` (sent to Stream 1 after its review; seal `20260930-stream2-tasks-identity-timing-privacy-r1`, 58 files, `9f1217ef…c396`): **people outside an assigned task no longer see who, when, or its private details.**
  - Before, `GET /api/gigs/:id` gave signed-out and stranger readers the access note ("side gate code…"), exact pickup/dropoff addresses and notes, care details, the remote meeting link, the worker's acknowledgement, delivery proof, the worker, and exact lifecycle times; `/timeline` gave the times too.
  - Now non-participants get none of the private fields. Once a worker is assigned: `accepted_by: "assigned"` (so installed clients keep the task taken), `acceptedBy: null`, day-only times (the Pacific date as 19:00Z, so the stepper stays truthful).
  - A rejected token, or the web session flag without its access cookie, now gets a 401, so clients refresh instead of showing the worker a stranger's view. `optionalAuth` has an additive `req.authRejected` flag.
  - Web pages are text-identical, and the recovery journey is proven (401 → refresh → 200, worker controls shown).
  - Decisions: day precision rather than null; the `"assigned"` placeholder; open tasks keep their public posting details.
- **Review of Stream 5's #908** (gig-room access rule, read-only):
  - Finding 1, privacy: `worker_release` and `reopen_bidding` set `accepted_by=NULL`, which reopens the room's owner–worker history to leftover members and to new Send Message joiners, and a later worker reads the earlier one's conversation. Suggested: rotate the room on release/reopen. Stream 5 decides; I offered a task-side join guard.
  - ~~Finding 2~~ **retracted:** `getGigOwnerAccess(…, 'gigs.manage')` already falls back to `gigs.post` (`routes/gigs.js` 975–976). Verified on master with a synthetic business fixture (a post-only team member gets the task room). No change; sealed note `20260930-stream2-tasks-chat-owner-actor-r1` (`d12e4441…d9ee9`).
  - Finding 1 is being implemented by Stream 5 in chat-owned code: retire the room when the accepted worker changes.
- **#910 amendment (Stream 1's review):**
  - supabase-js reports an unreachable auth service as an `AuthRetryableFetchError` object. Only a definite 4xx rejection, a revoked session or no user now counts as rejected. An unreachable answer is cached as its own marker for 5 s: anonymous, never a 401.
  - Real outage proof: my own auth container was stopped. Bob's valid token got 200 anonymous during the outage and his worker view right after recovery; a rejected token got 401 once auth was back.
- **[#919](https://github.com/WangPantopus/skinny-pantopus/pull/919)** head `9a73fc1be15f811473a2234bab188787a2885a2f` (sent to Stream 1; seal `20260930-stream2-pulse-web-chip-mute-control-r1`, 33 files, `a98aff6c…b5ac`): **the active Pulse chip's mute control is its own button** (user decision 2; U02 Pulse feed web A4).
  - axe nested-interactive is gone. The tab walk reaches native "Recs" (pressed) and "Mute Recs in Pulse" buttons. The chip row is pixel-identical in light and dark. Space mutes the topic.
  - The toast now says "Recommendation posts muted in Place feed" instead of the raw type.
- **#910 and #919 merged** in batch 162 (#921, master `fd7de8790`, 2026-09-30T09:22:51Z).
- **[#924](https://github.com/WangPantopus/skinny-pantopus/pull/924)** head `6e815e94de0dc8ecdf9c2ad101f2fd01ca873e85` (sent to Stream 1; seal `20260930-stream2-auth-rate-limit-not-rejection-r1`, 14 files, `91016221…9506`): **an auth rate limit (429) or timeout (408) isn't a rejected token** (Stream 1's #910 follow-up).
  - With one injected GoTrue 429 (via a second fault proxy between my backend and my own gateway), master gave a valid user 401 twice (the rejection was cached 15 s).
  - Now it's 200 anonymous, cached 5 s as unreachable, then the worker view. 408 behaves the same.
- **[#925](https://github.com/WangPantopus/skinny-pantopus/pull/925)** head `e0eedc53ae118261020d9d6c99b453d306928529` (sent to Stream 1; seal `20260930-stream2-payments-dispute-evidence-room-r1`, 14 files, `bd464d78…29f9`): **dispute evidence uses the disputed payment's own conversation** (P06; the follow-up to Stream 5's #923 room rotation).
  - Before, Bob's dispute evidence was Alice's message to the next worker. Now the room order is `GigPaymentAcceptance.room_id`, then the newest room of the task (current or retired) that the payee is in, then the current room. The acceptance path is proven with a control.
- **Review of Stream 5's #923** (retire the room when the worker changes): approved from the task side. Stream 5 adopted the " (closed)" name suffix and documented that business team members are re-added only when acting as the business.
- **Native:**
  - `emulator-5560` (AVD `pantopus_s2`, device slot 3) is up. It needed `-no-window -crash-report-mode disabled -no-metrics` after a vCPU stall left a crash-consent dialog blocking the next boot (told Stream 1).
  - My Android assembleDebug waits on the heavy slot, held by stream3-home since 09:12:16Z; I asked them whether it's idle.
  - iOS: the user hasn't granted this session access to simulator "Pantopus S2" in the simulator panel. I won't drive it through the helper binary directly (that would bypass the consent gate), so the iOS cells wait for that grant.
- **#924 and #925 merged** in batch 163 (#926, master `c1634c693`, 2026-09-30T09:40:01Z), with Stream 4's #922 and Stream 5's #923.
- **[#930](https://github.com/WangPantopus/skinny-pantopus/pull/930)** head `e9ece760077dcb24324abe27c0084ae00597d398` (sent to Stream 1; seal `20260930-stream2-posts-read-failure-not-404-r1`, 49 files, `9cd0db8c…d8ef1`): **a failed read isn't "not found"** (post and task detail; closes the inventory candidate on `GET /api/posts/:id`).
  - Before: with a sustained PostgREST 503, injected through the auth-side proxy in front of my own gateway, an existing post or task came back 404. The web said "may have been deleted" / "may have been removed", with no retry.
  - Now it's 503, and the web's existing error states show Try Again. The recovery journey is proven.
- **Native queue:** my Android build waits for the heavy slot (stream3-home, stream4 and stream5 held it in turn). The wait now checks every 2 s, and I asked Stream 1 to treat Stream 2 as next.
- **Decided per the standing instruction** (recorded in the PR bodies too):
  - For #850, the Pulse card shows a dash for an unknown count (screen readers hear "Not available"). I rejected hiding the card (layout jump) and an extra unfiltered count request.
  - For #851, the button row may wrap instead of squeezing four labels.
- **Next:**
  - Every Stream 2 web checklist cell is now done or waiting on the user's decisions (brand-blue, emerald and sunken tokens; the Pulse chip structure). The remaining to-do cells are native (iOS/Android) and start once Stream 1 reports the toolchains are back.
  - The bounded privacy checks are done: money reads (#899, #900) and post locations (#902; saved posts and Hub Discover go through the same fixed function). Task-side review of Stream 5's gig-room PR when it arrives.
  - **Native (the user approved the toolchain reinstall on 2026-09-30; Stream 1 installs, and nobody builds or runs devices until it announces "toolchains ready"):**
    - Prepared, no build: `frontend/apps/ios/.env` (API and socket → `http://127.0.0.1:18168`, Sentry empty, `pk_test_` key) plus `make bootstrap` (XcodeGen only), and `frontend/apps/android/local.properties` (`sdk.dir`). All gitignored.
    - Android builds must set `PANTOPUS_API_BASE_URL`/`PANTOPUS_SOCKET_URL=http://10.0.2.2:18168`; the Gradle default is the founder's `:8000`.
    - Order once ready, one heavy build at a time:
      1. Build both apps.
      2. U03: E6 typed phone (both), delete E1 (both), edit E1/E2/E5 (iOS) and E2/E5 (Android), comment photo failure (both), Hub R1 (both).
      3. U04: Posts L4, Start L2/L3, Hub L2/L3 (both).
      4. Native checks of #899 (a stranger's task chat opens a direct room) and #900.
      5. U02 native a11y cells, plus the decided Android task-progress wrap-only fix.

## STATE AT THE SPLIT — 2026-09-30T04:18Z

- **Master** `8e44382ce` (batch 134). Stream 2 has no open PRs; this file is its starting point.
- **Docker Desktop is down** since about 03:30Z (the disk filled), so no local database stack is reachable. Restarting Docker is the user's call because the founder's stack runs on it. Stream 2's runtime doesn't exist yet: set it up as described under "Runtime and devices" once Docker is back.
- All work below comes from the former Stream 1: its approved checklists, open inventory rows, acceptance rows P01–P10, decisions and proposals. The split reconciliation lists every item.

## Scope

- **Posts and Pulse:** the Pulse feed, My posts and counts; create, edit and delete a post (web offers no edit action — only iOS and Android do); comments, including photo attachments; report a post; post links and the public post page; AI drafting in the composer.
- **Start and Place preview:** the `/start` funnel and Place preview.
- **Hub:** the former Stream 1's Hub cards (status strip, finish setup, weather and Today, action queue, personal card, the Posts part of the Discover card, jump back in, recent activity) and the Today detail.
- **Money:** tips and payments (rows P01–P10), the money screens (tip sheet, payment card and refund sheet, payments and wallet settings), the wallet, the known-crew task lifecycle after assignment (start, complete, confirm, review, stop, reschedule), My tasks and the rebook rail.
- **Launch-scope cuts owned — skip them; never verify, test or fix:** #3 Marketplace, #4 Open Gigs marketplace, #6 general business directory, and the Hub, Discover and Pulse entry points into them. In the inventory, skip ⛔ rows entirely and the named part of ◐ rows.
- **Parked launch-cut branches** (pushed 2026-09-30 so nothing is lost; unverified, no PR, not for merge): `claude/stream1-web-trade-modal-failure` (`6eb3f6e64`), `claude/stream1-android-listing-wizard-chrome` (`62e7074cd`), `claude/stream1-magic-compose` (`fa7e164a3`), `claude/stream1-magic-post-items` (`b68a3a3d0`), `claude/stream1-offers-price-label` (`901c3331d`), `claude/stream1-web-seller-offers` (`ec02eb482`).

## Acceptance rows owned

Copied from the frozen accounting in `former-stream1-gigs-payments.md`; update them here from now on. Money journeys reuse the accepted P02–P10 evidence: nothing is rerun, and there is still no capture. Their hosted and provider parts need the user's environments.

| Row | Accepted work to preserve | Exact remaining boundary / disposition |
|---|---|---|
| P01 | Original tip reservation, immutable provider parameters, route/SQL recovery | Completed reservation milestone; original report explicitly assigns broader real-provider acceptance to P02/L01. Preserve the founder's instruction not to count this milestone as whole-row closure. |
| P02 | Actual TEST original recovery, decline/retry, browser 3DS/cancel, naturally aged >24h discovery on all three clients | Historical reconciliation beyond the restored owned examples and hosted provider operation remain unverified. Cold discovery is complete and must not be repeated from the old note. |
| P03 | Installed iOS/Android aged recovery, provider failure, lost reply, duplicate tap and stale retry; browser actual TEST checkout. **Installed Android native tips** (Sep22 evening, APK `db303e5b…`): new-card tip, sheet-dismiss pending → Cancel tip, 3DS success, 3DS failure → recovery on the same intent, and the three-tip limit. Audit `20260922-stream1-p03-android-tip-r1`, MANIFEST `f81b0244…37ec`. | **Recorded closed September23 within local limits** in [the original acceptance catalog](../REMAINING_WORK_2026-09-11.md): iOS native tip df1187bf…, storage-loss02d6c7ae…, and #241 immediate tip-refresh e65d5c01…. These supersede this old pending cell. Reuse historical acceptance; original Sep23 bundle files are not in the current runtime audits mirror, so no fresh seal revalidation is claimed. No new capture/provider run. #527 unavailable-reason23-file9bb90479… revalidated2026-09-27, all3clients already accepted; no copy gap. |
| P04 | Start Work, completion/reopen/owner capture, immutable displayed terms; actual TEST paid workflow | **Recorded closed September23 within local limits**: founder policy and #253/#254 fee execution/display accepted in original catalog, poster-fault-fee-r2 seal57092fbf…. This historical pending decision is superseded; current no-capture and S1-08/A17 reservations still apply. No reimplementation/retest; original bundle not revalidated in current mirror. Hosted/provider/physical limits and recorded support-release follow-up remain. |
| P05 | Zero-fee unstarted stop and held-money recovery | **Recorded closed September23 within local limits**, same #253/#254 and57092fbf… acceptance asP04. Preserve founder policy; do not treat the old checkbox as unfinished implementation or new money authorization. Original bundle not revalidated here; hosted/support limits remain. |
| P06 | Actual TEST dispute evidence, won/lost outcomes before and after wallet income, debt/proof controls and recovery. **Android** (Sep22 evening): an immediate-dispute TEST card reproduces the documented capture-proof boundary. Confirm completion returns 409 "Captured charge needs reconciliation"; the Payment stays `capture_pending` with the dispute recorded but not frozen; the payer sees "Authorized"/"Capturing", not the dispute; refund is 409 DISPUTED; a won dispute restores `captured_hold` without `captured_at`; settlement refuses payout even after 48h. Audit `20260922-stream1-p06-android-dispute-r1`, MANIFEST `58aff8a5…3e73`. | Founder record+freeze decision already implemented/accepted by #204 on both native clients, e83baeae… in original catalog; supersedes old proposal. Historical Connect transfer/reversal and hosted support/debt remain, plus payout-status device-auth boundary. Sep23 original seal not freshly revalidated here. #664 actual Android/Chrome failed Connect-status read/retry/404 accepted93c45f97…; iOS prompt blocks before read, no iOS change. |
| P07 | Paid-gig atomic wallet delivery; reviewed tip atomic-delivery repair190 | PR193 receipt/release destination and PR196 cancellation/refund recovery are verified and merged (G01); queued wording was historical. Broader booking delivery, support handling of legacy unknown outcomes and native/hosted delivery remain open. |
| P08 | **◐ LAUNCH SCOPE 2026-09-27: the bid step is out (#4 Open Gigs); authorization→proof upload→capture→wallet stays.** Installed iOS poster/Android worker actual TEST bid→authorization→proof upload→capture→wallet; browser journey. **Installed Android payer/owner** (Sep22 evening): authorization and owner capture (the P09/P03 bundles), plus a checkout lifetime check. Sheet dismissal cancels the setup; after process death the owner is offered Resume/Cancel for the same bid; remote revocation signs out ("Your session has expired"); another account on the same device sees no checkout (owner reads 403); the owner's cancel voids the intent. Audit `20260922-stream1-p08-android-account-r1`, MANIFEST `75f3381e…c162`. | **Recorded closed September23 within local limits**: iOS checkout lifetime8df47db4…; iOS in-app notification return e65d5c01… and Android exact-gig/mark-read4cfa1725… accepted in original catalog. These supersede old pending cells; original bundles not in current mirror, no fresh seal verification/rerun claimed. In-app list is not APNs/FCM, local Storage not hosted S3, synthetic Connect not bank payout. Bid-only observation is cut#4. |
| P09 | Browser actual TEST refunds/stops; installed iOS partial refund, lost reply recovery, over-limit guard and hold release; **installed Android payer** (Sep22 evening, APK `db303e5b…`/master `094ed5826`): authorization, owner capture, $5 partial refund, lost committed reply → Check status (provider calls [500,500], no duplicate), disabled over-limit Continue, $7.50 hold release; post-refund wallet release credits exactly the refund-aware share (213 of 1063 after 1000 refunded). Audit `20260922-stream1-p09-android-r1`, MANIFEST `670186c9…d5e9`. Android refund failures: provider unavailable → Retry after the lease makes one refund; provider-created refund with lost reply → Retry adopts it with no duplicate; worker/stranger 403 with no worker controls. Audit `20260922-stream1-p09-android-faults-r1`, MANIFEST `7a38ecf7…4fce`. | Historical real Connect transfer/reversal (credentials) and broader close/release scope. Native 3DS is accepted separately; dispute UI stays P06. The optional UX note (a retry inside the one-minute lease returns pending without explanation) is a proposal, not a defect. |
| P10 | **◐ LAUNCH SCOPE 2026-09-27: bid expiry/pagination is out (#4 Open Gigs); durable checkout and completion retention stay.** 10,001-bid expiry/pagination, retained durable checkout behavior, completion-original retention and cleanup recovery | Production workload/capacity and provider delivery remain; bounded local workload checks must not be repeated just because production is unavailable. |
| U02 | Sep28 iOS Post body/composer fixed text reproduced at largest Dynamic Type; [20-file7cb37839 evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260928-stream1-ios-post-accessibility-r1/RESULT.md), presentation change REJECTED by the user 2026-09-29T18:29Z (keep the current layout; accepted as-is). No code change/full contrast claim. Sep27 #667 bounded Android Post comment repair accepted at default/2×font/light-dark with preserved frame; actual Chrome keyboard and487px narrow viewport,52-file6d337d63…. Full matrix remains partial. Workflow-level visual checks. **Sep22 Android payment screens** (payment card, refund sheet, tip sheet) at font scale 2.0 and in dark mode: all reflow and stay usable. A dark-mode **tip-sheet contrast defect** (title nearly invisible) is repaired and merged in PR198 (`6f3436bf3` → `4cc024ba3`, exact-head CI `35795454198`; light mode pixel-identical, dark legible). Audit `20260922-stream1-u02-android-payment-a11y-r1`, MANIFEST `26ca2ea8…b33b`. | Remaining reachable-screen large text/zoom/keyboard/screen-reader/contrast/dark-mode matrix. Layout proposals needing design approval: the "WINNER" badge squeezes at 2.0, and task-progress labels break mid-word. Other GigDetail sheets may share the dark-mode pattern (not exercised). |
| U03 | Sep29 #789 (batch114) native Manage → Delete leaves the deleted train's dead detail and lands on a re-read My trains / Train search on actual Android 5558 and iOS C2 (list, search, lost-reply retry: Android manual, iOS automatic), 70-file `0f1bb844…`, 11 Trains exact cleanup. Sep29 #787 (batch113) native My trains/search chips truthful for paused/completed/archived on actual Android 5558/iOS C2, 34-file `5e9b44cf…`, exact cleanup. Sep29 #783 (batch111) Support Train pause/resume/unpublish/archive/delete committed-lost reply → retry now acknowledged on actual Android 5558 (5 commands), iOS C2 (pause, auto-retried delete) and Chrome (delete); API 18/18, 9 Trains cleaned, 19 fingerprints equal; 108-file `a8db546c…`. Co-organizer/nudge unverified. Sep29 #718 (batch109) Post create committed-lost reply → manual retry keeps one Post on actual Chrome, Android 5558 and iOS C2, with changed payload 409 and concurrent sends one row; its create-retry fingerprint is now keyed so viewers cannot confirm hidden tagged places (0/401 guesses). 49-file `b916f286…`; photo cases reuse 263-file `6535202a…`; one trashed C2 Photos asset awaits local authentication. Sep28#778 native per-updatepush301-file7915aa9b: bothnative503/lost201/duplicate/changed-setting409/malformed-choice/recovery;72whole-row checks, exact16scopes0/18hashrestore. No physical/provider claim. Sep28#776 header108-file16d79acc reuses unchanged sealed real native error/Retry/empty;36full-row read equalities/16scopes0/18hashrestore. Sep28#774 native elapsed-coverage repeated503/real Try again/recovery/Cancel accepted278-filea335aabc;83 valid scoped full-row comparisons,16chat placeholders excluded,32scopes0/18hashrestore. Driver/setup limits explicit. Sep28#771 native distinct-helper repeated503/malformed-read/recovery/Cancel accepted within207-filee95cb74f;72 full-row equalities,16 scopes0/18 fingerprints restored. iOS malformed Close and numeric command toast excluded. Sep28#767 native count503/malformed/read recovery and Cancel/no mutation accepted,175-filee864bdd2/26 bindings/72 full-row equalities;16 scopes0/18 hashes restored. No web-equivalent count or unreachable Android Review acceptance. Sep28#765 native Close & thank repeated failures/malformed replies/actual timeouts/original retry/pending duplicate accepted;342-file8094e494/19 bindings/125 full-row checks; Chrome read parity,48 scopes0/18 hashes restored. Exact source/driver/provider limits in seal.  Sep28#762 native Send update repeated503/malformed201/lost201/originalretry/pendingduplicate accepted,206-file735d2c8c/15bindings; Chrome helper readback;16scopes0/18hashrestore. Provider/push/edited-draft cases remain explicit; Close-and-thank accepted separately by#765 within its limits. Sep28#759 native date Add/Edit503/malformed/lost201/originalretry/duplicate/discard/localdate/cold accepted,441-file906a79fb/22bindings; AndroidRemove affected-route503/retry, Chrome read parity. Exact16scopes0/18hashrestore; driver/abandoned-draft/concurrency/timezone/guest/provider limits explicit. Sep28 organizer removal verification-only119-fileaa5e: both native Cancel/503/lost200/retry/pending duplicate/cold, Chrome roster/reload;42fullrow checks,16scopes0/18retainedhashes restored. #747 address-sharing179-fileb9bcc: bothnative repeated503/lost200/retry/pendingduplicate/helpercold/Leave withdrawal; Chrome per-helper privacy/reload/truthful copy. Exact limits in seals. Sep28#741 actual iOS organizer signup edit503/lost200/retry/duplicate/invalid/discard/stale409/refresh/clear/helper403 accepted;156-file0226862e/21bindings,17ownedscopes0/18retainedhashes restored. Web/Android read parity/no Edit affordance; broader scope explicit. Sep28#733 native helper delivery/organizer confirmation repeated503/lost200/manual retry/persistence accepted,123-file5dae628e/49bindings; web read-only parity;16 owned scopes0/18 retained hashes restored. Sequential retry only; guest/concurrent/partial event-slot/provider boundaries remain. #730 main-entry503/404/retry accepted73-file9ce52fb8, no fixture/mutation. Sep28#725 bounded organizer nonempty/read503/recovery/cold accepted on actual Chrome/iOS/Android;104-file446d7678/30bindings, exactTrain/referral cleanup and17pre-run fullhashes restored. No other organizer-command/delivery/provider acceptance. Sep28#720 Train meal signup503/lost201/retry accepted on Chrome/iOS C2/Android5558, native cancellation503/lost200/retry/cold;131-file0ca6a015/16bindings, exact Train/3slots/4reservations/chat/8notices0 and17fullhashes restored. Web has no helper cancel; no delivery/edit/guest/funds/concurrency acceptance. Sep27#699 later-draft/reply-cancel/repeated503/retry accepted across all clients,107-filec9b5f951 and exact15comments/post cleanup. Sep27#691 image deletion/lost-delete and #695 target lifetime accepted in91-file6c65bbad/107-fileec69319a seals. Recorded per-workflow checks; Sep27 #671 plain-text Post comments: actual web/iOS/Android committed-lost-reply recovery, Android overlapping retries/new identical intent, repeated iOS503 and exact cleanup (113-file1bf8a689…) | Apply missing cases to each actual affected client; PR193/196 booking receipt/cancellation failures are now repaired within their recorded scopes. No claim of all-app edge-case coverage. |
| U04 | Sep29 #789 native lists re-read after a delete (Android on return; iOS via `supportTrainDeleted`); iOS non-delete staleness after a two-level/Search/deep-link return remains open. Sep29 S3 #785 (batch112) web stale session: one refresh and at most one sign-out across invalid/revoked/valid/transient cases, 52-file `799180dc…` (reusable). Sep28#778 bothnative cold read/persisted channel choice, same-command retries preserve single notice;301-file7915aa9b. Web tab19-filedbadacae settled/reload verified without code change,150ms transition qualified. Sep28#776 bothnative cold headers same-date1/different-date2;108-file16d79acc, no clock-change claim. Sep28#774 real native cold reads show correct empty/future/current/finished coverage;278-filea335aabc. No clock-change or early-completed-history claim. Sep28#771 actual native cold reopening preserves distinct helper counts1/2/1/0 after fixture changes;207-filee95cb74f. No command-durability or account-race claim. Sep28#767 actual native cold reopening restores correct delivered count;175-filee864bdd2. Count-only scope, no command durability claim. Sep28#765 actual iOS/Android cold completion and Chrome helper Updates/reload pass;342-file8094e494. No abandoned uncertain-command durability claim.  Sep28#762 cold native sender/detail and Chrome full Updates/reload pass,206-file735d2c8c; no full native update feed or abandoned-draft/account claim. Sep28#759 actual final iOS/Android cold reads preserve saved dates; Chrome calendar/reload parity,441-file906a79fb. No abandoned-editor or process-death command identity promise. Sep28 organizer removal119-fileaa5e preserves canceled roster/open slots across actual native cold restart; address-sharing179-fileb9bcc preserves helper address across cold restart and withdraws after actual Leave. No in-flight account or durable-draft claim. Sep28#741 actual iOS cold saved fields/assigned arrival/cleared note persist, restored Alice after Bob denial;156-file0226862e. No in-flight account-change/durable-draft claim. Sep28#733 iOS helper process-reopen and Android organizer process-reopen preserve completed Train results;123-file5dae628e, no pending-command account/process guarantee. Sep28 #709 whole-post image deletion manual web/Android and automatic iOS lost-reply retry/cold absence accepted119-file214a; all owned5Posts/onecomment/File/21objects0. Broader upload/concurrency limits remain. Sep28 iOS Post unsent draft survives actual Settings background/foreground and size/theme change; cold return discards in-memory text without a Send. [20-file7cb37839 evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260928-stream1-ios-post-accessibility-r1/RESULT.md); no durable-draft promise. Sep28 ordinary Post account isolation accepted on actual Chrome/iOS/Android,46-file3f832a8c, exactPost/3comments0/full retainedhashes equal; no old-subscriber or durable-unsent promise. Sep27#699 preserves later pending drafts on actual web/iOS/Android,107-filec9b5f951; account/process-death unsent retention remains open. Sep27#695 web panel target-generation repair and unchanged native delayed-read/write navigation/cold persistence accepted,107-fileec69319a; account/process-death drafts remain open. Sep27 #671 all-client Post comment persistence after reload/cold reopen (113-file1bf8a689…); successful late old-account Hub200 after real logout/login accepted on Chrome (23-file79e9382e…), full cache/native lifetime remains separate. Accepted Home/account-switch and session lifetimes; Sep27 #667 actual Android deep-linked Post draft survives font/theme recreation, cold/warm new links and Back pass (52-file6d337d63…); #648 native Not-you lifetimes reused unchanged | Remaining multi-client foreground/background/cold-process and concurrent-account journeys; no process-death draft retention promise accepted. Physical-provider receipt is only one separate boundary. |
| U05 | Existing screen and action catalogs | Final integrated release-build inventory on all three clients after repair integration; keep every unfinished reachable action explicit. **(LAUNCH SCOPE 2026-09-27: exclude the flagged-off screens; see the shared cut table.)** |

For the shared U rows, Stream 2 owns the Posts and Pulse, Start and Hub, and money-screen cells (checklist below) and inventories its own screens for U05; Stream 1 assembles the final release manifest.

## Open work at the split

> **2026-09-30T21:31Z:** items 1, 3, 4, 5 and 6 are done or in #1096 (see the checklist and CURRENT STATE). What is still open is in "CURRENT RESUME — HANDOFF" §3.

1. **The checklist's to-do cells** (below):
   - U03: Pulse web R1/R2 on the main feed; create a post E6 (all three clients); edit E1/E2/E5 (iOS) and E2/E5 (Android); delete E1 (all three); comment photo-attachment failure (iOS, Android); the public post page R1 and E4 for a private post (web); Hub cards R1 (all three).
   - U04: Posts L4 (iOS, Android) and web L1 (draft kept across tabs); Start and Place preview L2/L3 (all three); Hub L2/L3 (iOS, Android) and L2 (web).
   - U02: native accessibility for the Pulse feed, post detail, composer, My posts, Report, Start/Place preview, Hub, Today and the money screens; web My posts, tip sheet and payment sheets.
2. **Open inventory rows** (carried into Stream 2's inventory, below):
   - ~~Web Hub Attach Home card: "Later" isn't remembered across loads~~: remembered for a week per account in #1047 (verified in Chrome).
   - Web `/api/location/resolve` ignores a stale unpinned area while native keeps it (parity note, not a defect).
   - Backend post-save toggle returns 500 when two toggles race (every client now guards double taps; a server fix would need a forward migration, not justified).
   - ~~iOS post detail: the 404 state offers Try again, which can't help~~: removed for 404 and 403 in #1047 (Android parity; iOS runtime with Stream 1).
   - iOS `ChatConversationView(…, onUseAIDraft:)` trailing closure binds to `onBack` (works today; note).
3. **Done:** Android task-progress labels no longer break mid-word at font 2.0. At large text the strip becomes a one-step-per-line list, which e7b1b3a96 (2026-09-22) had already shipped. It was checked on the emulator on 2026-09-30 (`20260930-stream2-task-progress-large-text-r1`, seal `e8811724…`, fixture removed, 353/353 tables equal).
4. **Proposal:** the active Pulse filter chip holds its mute control inside the chip's button, so screen readers can't reach it; the fix splits it into two controls that look the same (structural, so confirm with the user first).
5. **Needs the user:** the app-wide design-token decision (7 of its 12 checklist cells are Stream 2's).
6. **Parity observation, not built:** web has no post edit action (the API exists).

## Runtime and devices (set up after Docker is back)

> **2026-09-30T21:31Z:** this runtime exists and is running. Its live details, restart and teardown are in "CURRENT RESUME — HANDOFF" §4 above. The rules below still hold.

- **Ports reserved for Stream 2** (free at the split): backend **18160**, fault proxy **18168**, Next **18169**.
- **Worktrees:** add Stream 2's own (never remove any, and never modify the protected checkout `/Users/yingpengwang/skinny-pantopus`).
- **Database, preferred:** Stream 2's own isolated Supabase stack, seeded from a copy of Stream 1's database (`pantopus-stream1-resume-20260923`) so the fixture accounts and retained posts match. Set it up only once Docker is back and at least ~30 GB is free (the recipe is in memory `pantopus-disposable-full-schema-project.md`).
- **Database, interim:** run Stream 2's own backend, fault proxy and Next on the reserved ports against Stream 1's stack. Use copies of Stream 1's runtime scripts with the port and worktree changed; never edit Stream 1's copies. Use your own fixture rows, and make cleanup proofs table-scoped: fingerprint only the tables your run touches, since Stream 1's Train rows change concurrently. Agree any database-wide snapshot with Stream 1 first.
- **Devices:** borrow Stream 1's iOS C2 (slot 1) and `emulator-5558` (slot 4) through `device-slot.sh` leases labelled `stream2:`, announced to Stream 1 with exact times. Create Stream 2's own simulator and AVD later, when there's disk room.
- **Heavy builds:** `bash /private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: <purpose>"`. One heavy native build at a time across all streams.
- **Names:** session "Stream 2: Posts, Hub and payments"; lease label `stream2:`; branches `claude/stream2-<area>-<topic>` and bundles `YYYYMMDD-stream2-<area>-<topic>-rN`. The area is posts, pulse, hub, start, tips, payments or tasks. The former Stream 2 used `stream2` names before the renumbering (its successors now use `stream3-home:`/`stream4:` and `claude/stream3-home-…`/`claude/stream4-…`), so always include the area and check `git ls-remote` for a collision.
- **PRs:** send each exact head and its seal to Stream 1 for review and batching. Stream 2 never merges.

## Hard limits (unchanged, verbatim where given)

- "Do not modify the protected primary checkout for Stream 1 work." (The same applies to Stream 2.) Never touch founder 64521/64522, backend :8000 or simulator EB5AD759.
- "Keep credentials, raw tokens, database archives, and operator logs out of Git and chat." Never dump the fixture credentials file; redact its path in bundle copies of runners.
- "Respect the no-capture money boundary, no-founder/no-hosted/provider boundary, and no physical-device boundary." Stripe TEST only, no capture.
- "Acquire exact runtime/device/heavy-build leases before use. One heavy native build at a time."
- "Use only owned synthetic fixtures and clean them completely."
- "Do not claim whole-Train, whole-Posts, whole-payment, full-client, provider, hosted, physical-device, or launch-ready acceptance from a bounded result."
- No bare stash, gc, maintenance, repack or worktree removal. Times from `date -u`, SHAs from `git rev-parse`; never estimate them.
- Launch-cut features: never verify, test or fix them. Design changes need the user's approval (AGENTS.md); otherwise follow the recommendation and record the decision.

## Stream 2 exit checklists (U02–U04) — split from the former Stream 1 on 2026-09-30, updated 2026-09-30T23:15Z

**Stream 2: Posts, Hub and payments.** Review page: https://claude.ai/artifact/FQw1gNR2vwNNKw9cGSxsT2. This section is Stream 2's canonical copy; progress is tracked here only.
These rows came from the former Stream 1's approved checklists (2026-09-29). With the other stream's section they add up exactly to the pre-split totals; the reconciliation is frozen in `former-stream1-gigs-payments.md`.
Legend: ✅ done (sealed evidence) · ❓ confirm from existing evidence before any rerun · ⬜ to do · 🔷 user decision · ⛔ named boundary · – not offered on that client.
A row closes when every client cell is ✅, –, ⛔ with its named boundary, or 🔷 decided. Anything found broken gets the smallest fix with real-app before/after evidence and exact cleanup; visual changes go to the user first.

**U03 edge cases** — E1 server error; E2 lost reply; E3 double tap; E4 not allowed; E5 changed meanwhile; E6 bad input; R1 read failure; R2 empty.

| Workflow | iOS | Android | Web |
|---|---|---|---|
| **Posts and Pulse** | | | |
| Pulse feed, My posts, counts | ✅ Cold-start Pantopus tips (seeded facts) opened "We couldn't find this post" (Stream 1): info cards with a dismiss (#1047 merged (batch 211), Stream 1 iOS seal 47c730f8)<br>✅ My posts: archived posts stay after a reload (vanished from both tabs before) (#1016, Stream 1 bundle 9d03a647)<br>✅ Lost & Found: contact line (selectable) and FOUND chip (#1005, Stream 1 bundle e95f5d0f)<br>✅ Comment counts (C-18)<br>✅ R1 R2 (Sep26 native Pulse reads) | ✅ Cold-start tips opened a post that doesn't exist (reproduced, 404): info cards with a working dismiss (#1047 merged (batch 211), seal a67de577)<br>✅ My posts: archived posts stay after a reload (vanished from both tabs before) (#1016, seal b74e23c0)<br>✅ Lost & Found: post page shows how to reach the owner; found posts no longer labelled LOST (#1005 (merged), seal 903a2201)<br>✅ Comment counts (C-18)<br>✅ R1 R2 (Sep26 native Pulse reads) | ✅ Cold-start tips rendered as full posts with no dismiss: info cards with a dismiss X (#1047 merged (batch 211), seal a67de577)<br>✅ Comment counts (C-18)<br>✅ R1 R2 on My Pulse (Sep25)<br>✅ R1 R2 on the main feed; failed area read and false Pulse zeros fixed (#850) |
| Create a post (Text, photo, audience, place) | ✅ E2 E3 (#718)<br>✅ E1 photo upload failure (#718)<br>✅ E6: typed (555) 555-0123 stored as digits; the post page shows the contact line (Stream 1 iOS run, no change) (Stream 1 bundle 3ee82fc9)<br>✅ My posts → Write a post always made an Ask post: the purpose picker shows (#1047 merged (batch 211), Stream 1 iOS seal 47c730f8) | ✅ E1 E2 E3 (#657, #718)<br>✅ E6 on device: typed (555) 555-0123 accepted, stored as digits (seal ee9a6767) | ✅ E2 E3 (#718)<br>✅ E1 photo upload failure (#718)<br>✅ E6: Lost & Found contact fixed; four tags reported truthfully (#862) |
| Edit a post | ✅ E1 a failed save keeps the edit; E2 a lost reply is retried once; E5 deleted elsewhere says so (Stream 1 iOS run, no change) (Stream 1 bundle 4b8ed58a)<br>✅ A post saved without a title (web's general posts) couldn't be edited: the Headline stays empty, Save sends PATCH 200 (#1047 merged (batch 211), Stream 1 iOS seal 47c730f8) | ✅ E1, audience kept (#657, #659)<br>✅ E2 lost reply kept + safe retry; E5 deleted meanwhile says so (seal 04b91511)<br>✅ A post saved without a title couldn't be edited (reproduced, 0 writes): the title stays null (#1047 merged (batch 211), seal 176cd103) | ✅ Web had no post edit action; built in #1096 with Stream 1's approval (author-only, the composer in edit mode, only changed fields sent, untitled stays untitled; E1/E2/E5 and axe verified in Chrome) (#1096 merged (batch 220), seal 406c0939) |
| Delete a post | ✅ E2 (#709)<br>✅ E1 My posts says when a delete, archive or restore fails; Delete really deletes (it sent nothing before) (#980, Stream 1 bundle d172244f) | ✅ E2 (#709)<br>✅ E1 post page: keeps the post and says "Couldn't delete the post"; retry deletes (no change) (seal 569a60a4)<br>✅ E1 My posts: says when a delete, archive or restore fails (#980, seal 54995229) | ✅ E2 (#709)<br>✅ E1: feed card, post page and My Pulse keep the post and say so; retry deletes (no change) (bundle 32dfeb43) |
| Comments (Add, reply, delete, pages, photos, drafts) | ✅ E1 E2, delete, pages (#671, #699, Sep27)<br>– Photo attachment failure: not offered (the iOS comment composer is text-only; web comment photos still display) (Stream 1 bundle e4825b97) | ✅ E1 E2, delete, pages (#671, #699, Sep27)<br>– Photo attachment failure: not offered (the Android comment composer is text-only) | ✅ E1 E2, delete, pages, photos (#671, #699, Sep27) |
| Report a post | ✅ E1 E2 E3 (#642 server dedupe) | ✅ E1 E2 E3 (#642) | ✅ E1 E2 E3 (#642 server dedupe) |
| Post links | ✅ Links open the right post (#472) | ✅ Links open the right post (#472) | ✅ Public post page: E4 private post kept; R1 now "Couldn't load" with Try Again (#851) |
| **Start and Hub** | | | |
| Start funnel and Place preview | ✅ R1 (#635) | ✅ R1 (#635) | ✅ R1 (#607)<br>✅ R1 address lookup failures say so (suggestions, geocoder outage) (#873) |
| Hub cards and status pills (Stream 1 parts only) | ✅ Pills open real screens (C-02)<br>✅ R1: every failed read is shown as a failure, with Try again (Stream 1 iOS run, no change) (Stream 1 bundle 7a50ea0a) | ✅ Pills open real screens (C-02)<br>✅ R1: every failed read is shown as a failure, with Try again (seal b716c9ce) | ✅ Hub posts (Sep25)<br>✅ R1: Hub payload, Today card and detail, Action Queue fail truthfully (no change) (bundle 890d21cb) |

**U04 lifetimes** — L1 background and return; L2 cold restart; L3 switch account; L4 session refresh.

| Area | iOS | Android | Web |
|---|---|---|---|
| Posts and comments | ✅ L1 L2 L3 (Sep27-28)<br>✅ L4: comment and edit replay once after a session refresh (Stream 1 iOS run, no change) (Stream 1 bundle dd4939ee) | ✅ L1 L2 L3 (#667, Sep27)<br>✅ L4: comment and edit replay once after a session refresh (seal d875dafb) | ✅ L2 L3 L4 (Sep27, #785)<br>✅ L1 post and comment drafts kept while another tab refreshes the session (no change) (bundle d0895b51) |
| Start and Place preview | ✅ L2: the preview survives a restart and is offered after sign-in; L3: the next person sees no offer or address (Stream 1 iOS run, no change; sign-out also clears a pending preview) (Stream 1 bundle be19dced) | ✅ L2: the preview survives a cold restart and is offered after sign-in (seal 433cf635)<br>✅ L3: the next person on the device no longer sees or is offered the previous address (#989, seal 433cf635) | ✅ L2 L3: the previewed address survives a browser restart and never moves to another account (no change) (bundle e2c35ebc) |
| Hub (the former Stream 1 cards) | ✅ L3: account switch shows only the new account; L2: cold restart reads fresh data (Stream 1 iOS run, no change) (Stream 1 bundle 3280a64f) | ✅ L3: account switch shows only the new account (seal ea85ae47)<br>✅ L2: cold restart reads fresh data (seal ea85ae47) | ✅ L3 (Sep27 late Hub reply)<br>✅ L3 Today no longer reused across accounts; area change and Refresh re-read (#856)<br>✅ L2 cold start shows current state (no change) (bundle 42571869) |

**U02 accessibility** — A1 largest text; A2 dark mode; A3 contrast; A4 screen reader; A5 keyboard (web).

| Screen | iOS | Android | Web |
|---|---|---|---|
| **Posts and Pulse** | | | |
| Pulse feed | ✅ A1–A4: fixed text, nothing clips at AX5; dark readable; contrast passes; named (Stream 1 bundle e43f4f13) | ✅ A4 selected states + heart names; A1 chips no longer clipped at font 2.0 (#1027, seal a966aa19)<br>✅ A2: stays light and readable in system dark mode (#1013 + seal a966aa19)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A4 A5; post-type text, map markers and menus fixed (#829)<br>✅ A3: no contrast failure in light or dark after #1052 (brand blue, emerald) (axe on master 2693fcbcf, seal daf7aa08)<br>✅ A4 the active chip's mute control is its own button (user approved); toast names the topic (#919) |
| Post detail and comments | ✅ A1 kept as is (your decision)<br>✅ A2 A3 A4: dark readable; the Share chip is 4.57:1; named, and the comment field is labelled (Stream 1 bundle e43f4f13) | ✅ A1 A2 comments (#667)<br>✅ A4: chip tone no longer read (#1027, seal a966aa19)<br>✅ A4: a Share post's chip read "Share post", like the Share button; it reads "Post type: Share" (#1038 merged (batch 211))<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A5 comments (Sep27)<br>✅ A1 A2 A4; type chip and dark header fixed (#829)<br>✅ A3: brand blue passes after #1052; the Recommendation chip went from 4.33:1 to 6.12:1 (#92400E; map chips 4.29/4.46 → 6.06/6.29) (#1073 merged (batch 214), seals daf7aa08, a0260faa) |
| Post composer | ✅ A1 kept as is (your decision)<br>✅ A2 A3 A4: dark readable; contrast passes; named (Stream 1 bundle e43f4f13) | ✅ A4 states and names; A1 contact choices ("Phone" was zero-width at font 2.0) (#1027, seal a966aa19)<br>✅ A2: readable in system dark mode (#1013)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A4 A5; intent text and AI button fixed (#829)<br>✅ A3: the composer at rest and with Recommend chosen, measured with a fresh GPS fix (the posting rule unchanged): 0 contrast failures in light and dark (seal 7d308e46)<br>✅ "Use my location" could leave an eligible viewer without the composer (a stale load-time eligibility answer landed last; reproduced): only the latest check decides; the area line says "Current location" (#1078 merged (batch 215), seal fe6ecd1e) |
| My posts | ✅ A1 A2 A4: no clipping; dark readable; named, with the Selected trait on the active tab (Stream 1 bundle e43f4f13)<br>✅ A3: the dark selected tab is fixed in the shared ListOfRows tab strip by Stream 1's #1061 (merged, batch 218; verified on My trains 4.13 → 7.99; My posts shares the strip, not captured separately) (Stream 1 bundle 3be31394 (ios-primary-ink-r1)) | ✅ A4 row names + tab states (#1027, seal a966aa19)<br>✅ A1: readable at font 2.0 (no change needed) (seal a966aa19)<br>✅ A2: delete dialog and options sheet readable in dark mode (luminance 43 → 225/240) (#1013, seal a966aa19)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A4 A5; the closed post panel is inert (was focusable off-screen) (#879)<br>✅ A3: no contrast failure in light or dark after #1052 (brand blue, emerald) (axe on master 2693fcbcf, seal daf7aa08) |
| Report a post | ✅ A1–A4: the system dialog scales; dark reasons 5.25–5.39:1 after #1056 (merged); named (Stream 1 bundle e43f4f13) | ✅ A1 readable at font 2.0; A4 reasons and Cancel named (no change) (seal a966aa19)<br>✅ A2: stays light and readable in dark mode (seal 607283e7)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A3 A4 A5; close button named (#829) |
| **Start and Hub** | | | |
| Start funnel and Place preview | ✅ A1 A2: fixed text, the arrival offer scales; dark readable (Stream 1 bundle e43f4f13)<br>✅ A4: the preview Back, the address clear ✕ and the address field are named (F1–F3) (#1085 merged (batch 218), seal 1d07a1ac; iOS verified by Stream 1, e3137445)<br>✅ A3 dark: Start "Sign in" 4.44 → 8.59; preview "Save it to get updates." 4.13 → 7.99 (Stream 1's #1061, merged batch 218) (Stream 1 bundle 3be31394 (ios-primary-ink-r1)) | ✅ A1 "Sign in" stays on one line at font 2.0; A4 the address field is named (#1034 merged (batch 201), seal 607283e7)<br>✅ A4 other controls named (seal a966aa19)<br>✅ A2: stays light and readable in dark mode (seal 607283e7)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A3 A4 A5 on /start (U02 web bundle ddbfe77a) |
| Hub (the former Stream 1 cards) | ✅ A1–A4: no clipping; dark readable; "Explore Map" 4.62:1; named (Stream 1 bundle e43f4f13) | ✅ A4 filter state; A1 tile captions no longer lose words (#1027, seal a966aa19)<br>✅ A2: stays light and readable in dark mode (#1013)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A4 A5; You badge fixed (#829)<br>✅ A3: no contrast failure in light or dark after #1052 (brand blue, emerald) (axe on master 2693fcbcf, seal daf7aa08) |
| Today detail | ✅ Truth: real sun times, a true share line, no private signal or summary in Share, loads with action signals, Back from a briefing push, chip "Post type: Share" (Stream 1 iOS run on #1038) (Stream 1 bundle aeb2d308)<br>✅ A1 A2 A4: no clipping; dark readable; named (Stream 1 bundle e43f4f13)<br>✅ A3 dark: the hero label 4.13 → 7.99 (Stream 1's #1061 commit 3a0cfbd03, merged batch 218) (Stream 1 bundle 3be31394 (ios-primary-ink-r1))<br>✅ More and Manage did nothing on the briefing push: now shown only where they lead; Stream 1's capture of the briefing view on a build with #1075 shows only Back and Share (#1075 merged (batch 218), seal 42bb8b0b; Stream 1 bundle 3be31394 (ios-primary-ink-r1) ios/cand1-01-today-briefing-light-tree.txt) | ✅ A4 controls named (no change) (today bundle before/)<br>✅ Truth, share privacy and the action-signal decode (#1038 merged (batch 211), seals 44bc9f8b, 88bd4642)<br>✅ A2: stays light and readable in dark mode (seal 44bc9f8b)<br>✅ A1: at font 2.0 the Sun & sky captions keep an 8 dp gap (#1075 merged (batch 218), seal 42bb8b0b)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A4 A5 (U02 web bundle ddbfe77a)<br>✅ A3: no contrast failure in light or dark after #1052 (brand blue, emerald) (axe on master 2693fcbcf, seal daf7aa08) |
| **Money screens (viewing only, no payments)** | | | |
| Tip sheet | ✅ A1: no clipping; the disabled amounts are exempt (the helper has no payouts, and the sheet says so) (Stream 1 bundle e43f4f13)<br>✅ A2/A3 dark: the tip sheet draws on the opaque app surface (F6; Stream 1 measured dark 6.81 from 2.32/4.01, light 7.63); A4 the custom amount is named (F3) (#1085 merged (batch 218), seal 1d07a1ac; iOS verified by Stream 1, e3137445) | ✅ A1 A2, dark title fixed (PR198)<br>✅ A4: amounts, custom field, send and Not now named; disabled state announced with its reason (seal 1e9293bd)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A3 A4 A5; the sheet is a named modal dialog that keeps focus, Escape closes it, errors are announced (#884)<br>✅ A2 dark: after Stream 1's #1082 the presets fill #080E20 on the sheet's #0F172A (as subtle as light); axe 0 light and dark; Escape closes (seal db86c5f9) |
| Payment card and refund sheet | ✅ A2: dark readable (Stream 1 bundle e43f4f13)<br>✅ A1 the refund reasons list inline and wrap at AX5 (F8); A4 the refund amount is named and its instruction visible (F3); Check status says "No requests yet." (F7, also Android and web) (#1085 merged (batch 218), seal 1d07a1ac; iOS verified by Stream 1, e3137445)<br>✅ A3: dock "Send a tip" 4.08 → 5.67 (F4) and counterparty initials 2.74 → 5.67 in both schemes (F5) (Stream 1's #1061, merged batch 218) (Stream 1 bundle 3be31394 (ios-primary-ink-r1)) | ✅ A1 A2 (Sep22)<br>✅ A4: task-progress steps read done / current step / not yet; refund reasons named; other controls named (#1034 merged (batch 201), seals 1e9293bd, 607283e7)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A3 A4 A5; refund form keeps keyboard focus, dark progress labels readable (#889) |
| Payments and wallet settings | ⛔ Behind the OS device-passcode prompt on the simulator; Stream 1 doesn't type into it (boundary) | ✅ A1 A2 by accessibility tree (Sep27)<br>⛔ Screenshots blocked (secure screen)<br>✅ A4: controls named; balance reads "Available to withdraw: 0.00 USD" (seal a966aa19)<br>✅ A3: brand blue is now #0369A1: 5.93:1 on white, 5.54:1 on the page background, white on it 5.93:1; status colours 5.1–7.4:1 (#1029, token check on master 1e1b6bacc) | ✅ A1 A2 A4 A5; filter and back-button names (#829)<br>✅ A3: wallet and payment settings have no contrast failure in light or dark after #1052 (emerald, brand blue) (axe on master 2693fcbcf, seal daf7aa08) |

**Outside this plan:** Money journeys: Tips, task payments, refunds, disputes and wallet reuse the accepted P02-P10 evidence. Nothing is rerun, and there is still no capture. Their hosted and provider parts stay with the P rows. Crew Day and rebooking a known crew: Not built yet: no screen or route calls it (Stream 3, Sep27). There's nothing to check. Launch cuts: Marketplace, Open Gigs, the business directory, and Hub or Pulse entry points into them stay excluded. The "WINNER" badge note belongs to bids, so it's dropped. U01 and U05: U01 has no cells in either stream (it belongs to the former Stream 2). U05 starts once your launch flags are on master: each stream inventories its own screens, and Stream 1 assembles the final release manifest.

**Decisions:** (1) Approved 2026-09-29: these checklists, the greyed sign-up button (merged, #811), and the people picker for co-organizers (merged, #812). [both streams] (2) Android task-progress labels that break mid-word at font 2.0: a wrap-only fix when the money screens come up (my recommendation). (3) Open for you: one design-token decision for every accent under AA's 4.5:1. That covers white on primary-600 (4.09:1) and primary-600 text on greys (3.8-4.35:1); emerald-600 fills and text (3.51-3.77:1); and the post-type accent fills with white text, meaning avatar initials, the composer's submit button (amber-500 is 2.15:1), the active feed-filter chips (2.15-4.23:1) and map pins. Stream 2 adds the header badge (3.76) and the Members tab (3.52). My recommendation: one step darker per fill, keeping each hue (primary-700 is about 5.9:1). It's app-wide and visible, so it needs your approval. [both streams] (4) Proposal: the active Pulse filter chip holds its mute control inside the chip's button, so screen readers can't reach it. Fixing it means splitting the chip into two controls that look the same.

- U03 items: done 55, confirm from existing evidence 0, to do 0, your call 0, boundary 0, not offered 2
- U04 items: done 16, confirm from existing evidence 0, to do 0, your call 0, boundary 0, not offered 0
- U02 items: done 81, confirm from existing evidence 0, to do 0, your call 0, boundary 2, not offered 0

## Inventory and history

- **Stream 2's living inventory:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260930-stream2-posts-hub-payments-inventory-r1/INVENTORY.md`. It holds the open rows at the split; add new findings there.
- **History:** everything before the split — every batch, bundle, decision and lesson of the former Stream 1 — is in [`former-stream1-gigs-payments.md`](former-stream1-gigs-payments.md) (frozen) and the former shared inventory `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260925-stream1-domain-inventory-r1/INVENTORY.md`, which is now Stream 1's (read-only for Stream 2).
