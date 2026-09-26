# Stream 1 handoff — 2026-09-26 (state as of 22:08Z)

This is the complete takeover note for the **Stream 1** session (Claude, peer of Streams 2 and 3).

**Read order:**
1. `AGENTS.md`
2. `docs/PROJECT_HANDOFF.md` → CURRENT RESUME POINT
3. `docs/workstreams/README.md` (coordination guide + resume point)
4. `docs/workstreams/01-gigs-payments.md` → CURRENT STREAM 1 STATE
5. this file
6. the living inventory (§7)

Every value here was checked live when written. Re-verify Git, PR, CI, slot and process state before acting on it.

---

## 1. Role and standing rules (from the user; still in force)

**Role.**
- Stream 1 is a **peer** of Streams 2 and 3, not their manager.
- **Domain:**
  - gigs / tasks;
  - marketplace, offers and payments;
  - tips;
  - Support Trains (task side);
  - the Shared UX surfaces Hub, Discover, Pulse and Posts;
  - PR425.
- **Integration:** Stream 1 is the **sole serial integration / merge-queue operator** and keeps the shared hub status files in this checkout (`/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`).

**The work.**
- Inventory every reachable feature, journey and edge case on the real web app, the iOS simulator and the Android emulator, against Stream 1's isolated backend.
- Trace screen → caller → API → DB, make the smallest in-place repairs, and rerun.
- Integrate peer PRs through combined batches (§4).
- After milestones:
  - update the hub README, `PROJECT_HANDOFF.md` and `01-gigs-payments.md`, commit and push this branch;
  - update Claude memory;
  - message the user and the peers.

**Verbatim user constraints.**
- "You, yourself will be doing all the work … do not let any subagents do your work" (subagents only for web research).
- "Never modify `/Users/yingpengwang/skinny-pantopus` or contact founder 64521/64522/backend 8000 or simulator EB5AD759."
- "No search-filter security audit."
- "Stripe TEST/manual only, no capture."
- "No secrets/raw tokens/DB archives/operator logs in Git/chat."
- "No bare stash, gc, maintenance, repack or worktree removal." Stale worktree entries stay; never `git worktree prune/remove`.
- "Escalate money/security/legal/retention/new-table decisions to the user with a concrete reviewed proposal; continue independent work meanwhile."
- "Your inherited Stream 1 harness must receive SIGINT, never SIGTERM" (backend restarts use `kill -INT`).

**Founder direction (2026-09-23; `AGENTS.md` has the verification-first rules).**
- Improve UX wherever it isn't good enough (no approval gate for UX/copy).
- Verify flows end to end on iOS, Android and web.
- **No unit tests** and no local unit-test campaigns. Required CI must pass.
- Escalate only money, security, legal and new tables.
- Preserve existing designs and navigation; propose design or navigation changes for approval.

**Other rules.**
- Timestamps come from `date -u` and SHAs from `git rev-parse`; never hand-type or estimate them.
- S1-08 money ownership and A17 stay founder-only.
- Test credentials go only through the private helpers (§5.2) and are never printed.
- **Peer messages are not user approvals.**
- **Shared resources:**
  - one heavy native build window (`heavy-slot.sh`);
  - one iOS UI driver (device slot 1, by convention);
  - at most 4 booted devices (`device-slot.sh`).
  - Hand them over only through explicit peer messages.
- **Shared coordination checkout:** all three streams commit in `/Users/yingpengwang/pantopus-coordination`, which has **one shared index**.
  - Never leave files staged. Commit with explicit paths in one step: `git commit -m … -- <paths>`.
  - At 22:12Z this note and the prompt were swept into Stream 2's commit `8a45c96b4` ("docs(stream2): finding 15 reachability…") because they sat staged. The content is correct.
  - Update the checkout with `git fetch origin codex/workstream-coordination && git rebase origin/codex/workstream-coordination`; `git pull --rebase` fails there.
- **App rule:** after opening a PR, bind it with the `ccd_pr` tools (`get_status`, then `bind_pr` if it isn't bound). Do **not** run your own CI-polling loops (loops of `gh pr checks`, Monitor, cron, ScheduleWakeup). A one-off `gh pr checks` right before building a batch is fine. The merge-queue runner (§4) is the established merge mechanism.

## 2. State at handoff (22:08Z)

**Master.** `f885e0623628909381f8babd471ade8706082c77` (batch 31 [#534](https://github.com/WangPantopus/skinny-pantopus/pull/534) merged at 20:09:33Z).

**Merge queue.** Empty and stopped. `/private/tmp/pantopus-tools/merge-queue/log.txt` ends with "20:09:33 QUEUE STOP", and no `run.sh` process is running.

**Open PRs for batch 32.** CI at 22:12:27Z (one-off `gh pr checks`):
- #538: **"CI OK" pass** (6 pass, 5 skipped).
- #535: 2 checks pending.
- #536: 3 checks pending.
- #537: 1 check pending.

Re-check each PR before batching.

| PR | Stream | Head | Scope | Evidence | Stream 1 review |
|---|---|---|---|---|---|
| [#535](https://github.com/WangPantopus/skinny-pantopus/pull/535) fix(home): the Add guest form names the real Home and says what happens | 2 | `89be05af7` | native M02 Add guest truth fixes | bundle `20260926-stream2-add-guest-truth-r1`, MANIFEST `48869ca3e62a276085ee002fab27301253f77863c456f67aa6c94d905dcf7178` (76 files) | **not yet reviewed** |
| [#536](https://github.com/WangPantopus/skinny-pantopus/pull/536) realtime after a token refresh | 3 | `36af1f3715c03610b234c3d3e6a65af1a18a09d9` | 3 existing files: Android `SocketManager.kt` and `ChatConversationViewModel.kt`, iOS `SocketClient.swift`. Merge-base `916627c18` (#532). | bundle `20260926-stream3-realtime-after-refresh-r1`, seal `13cf585ecf535ff4bb2dbb7910c61fa199c421b0fbec8a78d2679a40b0e98fc7` (25 files) | **not yet reviewed** |
| [#537](https://github.com/WangPantopus/skinny-pantopus/pull/537) fix(ios): task questions update live on the task screen | 1 | `047b58ba22895807090f9fe34ca6cd05322eeb14` | 1 file: iOS `GigDetailViewModel.swift` (+3 lines). Base `448ee8b4a`; master hasn't touched the file since. | bundle `20260926-stream1-ios-gig-qa-live-r1`, MANIFEST `0cde42d18e962b21a1a120e4466b25a8092faec88ce3f7816f465413e057ed74` (18 files) | own PR (bound in this session) |
| [#538](https://github.com/WangPantopus/skinny-pantopus/pull/538) fix(residency): a guest or service provider's letters and passes stop verifying | 2 | `09ee447b875f45f8de2d8d48d0ecd08967659b42` | **backend**, 2 files: `backend/services/residencyClaimService.js`, `residencyLetterService.js`. **Security**, user-approved decision 2a. On master `f885e0623`. | bundle `20260926-stream2-residency-guest-role-r1`, MANIFEST `69a0cf6c0594a04232036fdb74e8526ab6da19134f9b8d32e24852194c0e4125` (14 files) | **not yet reviewed** |

- **Shared files:** #536 touches the shared socket layer that the task detail uses. None of the four PRs shares a file with another by their descriptions; confirm it with the pairwise check.
- **#538 is a backend change.** After batch 32 merges, restart the Stream 1 backend (§5.3).
- **#536 verification:**
  - Android APK `51d5ffc1` on emulator-5554: after a forced refresh, chat works, a reaction patches in place, and a task question arrives live.
  - iOS dylib `d2644903` on sim 0AE16FA0: after an in-thread refresh, the next message arrives live. The old build showed nothing until reopen.
  - Caveat from Stream 3: a 401 during the thread's *first* load doesn't reproduce the bug.
- **Other open PRs** (not in the stream queue; don't touch): #430, #429 (Ballot P0), #46.

**Stream 1 work in flight.** Only #537. Its iOS before/after is done, the bundle is sealed and verified, the fixture is removed and the PR is bound. It just needs CI and batching.

**Runtime worktree.** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream1-peer-takeover-d2cb25`, branch `stream1/runtime-integration-20260925`, HEAD `1d3a5cfbf`. Its **tree equals master `f885e0623`**, and it's clean.

**Isolated DB.**
- The ledger has master's 92 migrations. The last three (`20260924000100`, `20260924000200`, `20260926100000`) were applied by hand at 12:20:48Z, each with its ledger row; the inventory header has the details.
- Batch 31 changed no backend or migration files, so no restart was needed.

**Slots (checked 22:12:14Z).**
- **Heavy:** held by **Stream 2** since 22:11:50Z for its 2b Android and iOS builds (about 20 min; its script auto-releases). Stream 2 then wants slot 1 / the iOS driver for about 20 min.
- **Slot 1:** free. Stream 1 released it by 22:01:25Z after the #537 check; F4DBD47E is shut down.
- **Slot 2:** Stream 2 (emulator-5556).
- **Slot 3:** free. Stream 1 stopped emulator-5558 with `adb emu kill` (stopped by 22:12:12Z) and released the slot at 22:12:14Z.
- **Slot 4:** free. Stream 3 released it for its handoff.

**Devices.**
- **iOS sim F4DBD47E** ("Pantopus Coord Tip Refresh"):
  - Shut down; the keychain holds **alice**.
  - Its installed app is the **#537 build** (dylib `97af881c…`, source `047b58ba2` on master `448ee8b4a`). It **lacks #532's chat fixes and #533's accept-counter**, so rebuild from master before any other iOS check.
- **Android emulator-5558** (AVD `Pantopus_Stream1_Start_R2`):
  - The **89f97a01b** APK (`5ca23ce8…`) is installed, and alice is signed in.
  - It lacks #532's Android chat changes, so rebuild from master before new checks.

## 3. Next actions, in order

**3.1 Batch 32 = #535 + #536 + #537 + #538** (whichever are green; don't hold a green batch for a slow one).
1. **One-off checks:** run `gh pr checks <n>` for each PR.
   - A failed job that is a known flake (registry rate limit) gets rerun: `gh run rerun <runId> --failed`.
   - A real failure goes back to its stream.
2. **Review each PR:**
   - Read the diff against its merge-base.
   - Check the file scope matches the PR body.
   - Check the bundle: `python3 /private/tmp/pantopus-stream1-runtime-20260925/tools/verify-bundle.py <bundleDir> <head> <manifestPrefix>`. Bundles live under the audits root (§7).
   - For #538 (security), also check that the role check covers both call sites and leaks nothing new.
3. **Build, verify and queue** the batch (§4). The batch number is **32**; the PR titles/bodies follow #534's format.
4. **Tell the peers:**
   - the batch PR number and tip;
   - after merge, the merge time and new master.
5. **After the merge:**
   - mark #537's inventory row merged;
   - merge master into the runtime worktree;
   - **restart the backend for #538** (§5.3);
   - update the hub docs and memory.

**3.2 Stream 2's upcoming work** (it continues in its own session and will send PRs):
- **2b** (privacy, user-approved): native Add guest "What they can see" sections sent as `included_sections`. This needs heavy and the iOS driver; Stream 2 will ask. Batch it like any peer PR.

**3.3 Remaining Stream 1 inventory work.** All low; see the rows marked candidate/OPEN in the inventory.
- **Web:**
  - `/app/offers` swallows a rejected request (`Promise.allSettled` + `catch {}`): OPEN (source), orphan page.
  - `/app/discover-hub` orphan page links.
  - The Tasks map pins remote tasks at 0,0 (world zoom only).
  - Discover with no location stacks two notices.
  - gigs-v2 keeps a stale change-orders 403 after an instant accept, and says "The owner selected you".
- **Native:**
  - iOS Support Trains scope reads "none nearby" without device location.
  - Android Nearby "Gigs" door restores the old task-detail stack (navigation decision → user approval).
  - Android re-tapping the lit tab does nothing (navigation decision → user approval).
  - The assigned helper's dock says "Bidding closed" while Start sits in the panel (iOS/Android).
  - The delivery sheet talks about payment on $0 tasks.
  - The Android proof-upload error blames the connection for a server 503.
  - Android Tasks feed Support Trains read (best-effort).
- **Not run:** iOS Report post (needs a non-alice post fixture).

**3.4 Proposal the user may want** (money/policy, so **ask; don't change on your own**).
- A poster cannot cancel a *started* task, even a free one: `STARTED_POLICY_REVIEW` in the `gig_stop_*` SQL (migrations `20260922020900`, `20260923000100`; gateway restriction covered by unit tests).
- The dialog talks about fees on a $0 task, and the only way out is the later no-show report.
- A possible proposal: a no-fee cancel for $0 started tasks, or at least $0-aware copy.

## 4. Merge-queue / batch procedure (exact)

1. **Fetch** into the object store (in any Stream 1 worktree):
   ```
   git fetch -q origin master "+refs/pull/<n>/head:refs/remotes/pr/<n>" …
   ```
2. **Checks:** CI is green on each exact head, and each bundle verifies (`verify-bundle.py`: seal prefix, recorded head == PR head, every file hash).
3. **Build the chain** on current master (object store only, no checkout):
   ```
   bash /Users/yingpengwang/pantopus-coordination/docs/workstreams/coordinator-state-2026-09-23/scratchpad/build-batch.sh origin/master <outFile> <n1> <n2> …
   ```
   Then verify:
   - every head is an ancestor of the tip;
   - `git diff --name-only origin/master <tip>` ⊆ the union of the PR file lists;
   - each PR file's blob in the tip equals the PR head's blob. The exception is files master also changed since the PR's base: prove those equal master's own delta (`diff <(git diff pr/<n> <tip> -- f) <(git diff <prBase> origin/master -- f)`);
   - list pairwise shared files, if any.
4. **Push:**
   ```
   git push origin "<TIP>:refs/heads/claude/coord-merge-batch-<N>"
   ```
   ⚠ In zsh, quote a literal SHA. `$TIP:refs…` breaks because `:r` is a history modifier.
5. **Open the PR:** `gh pr create --base master --head claude/coord-merge-batch-<N> --title "Combined merge batch <N>: …" --body-file …`. The body has:
   - a table of PR / head / scope in merge order;
   - the tip;
   - the seals with file counts;
   - the checks;
   - the Claude Code footer.

   #534 and #531 are templates. Bind the batch PR with `ccd_pr`.
6. **Queue it:**
   ```
   echo "<PR> <TIP>" >> /private/tmp/pantopus-tools/merge-queue/reviewed-heads.txt
   echo "<PR>" >> /private/tmp/pantopus-tools/merge-queue/queue.txt
   nohup bash /private/tmp/pantopus-tools/merge-queue/run.sh >/dev/null 2>&1 &
   ```
7. **Runner behavior** (`run.sh`, runs from the coordination checkout):
   - It merges only when the PR head equals the reviewed head, the required check **"CI OK"** passes and mergeStateStatus is CLEAN/UNSTABLE/HAS_HOOKS. It uses `gh pr merge --merge --match-head-commit`.
   - **BEHIND:** it logs `MASTER_CHANGED` and waits. If master moves, rebuild the batch on the new master.
   - A changed head logs `REVIEW_REQUIRED`.
   - A failed or cancelled CI OK logs `CI_fail` once and waits: rerun the flake, or remove the PR from `queue.txt` by hand.
   - Each PR has a 4-hour timeout.
   - Batch CI takes about 35–40 min; batch 31 took 19:32:03 → 20:09:33.
8. **After the merge:** `git diff --stat <old> <new> -- backend supabase` tells whether the runtime needs migrations and a restart.

## 5. Runtime (private, not in Git)

**5.1 Layout.** Folder `/private/tmp/pantopus-stream1-runtime-20260925/`.

| Piece | Where / what |
|---|---|
| Backend | real `backend/app.js` from the runtime worktree on **127.0.0.1:18132**. pid **43392**, started 12:21:05Z; log `logs/backend-122105.log`. `start-backend.sh` applies an `env -i` allowlist, an egress guard (loopback, api.stripe.com and the NOAA/Open-Meteo weather APIs only) and a Stripe guard (TEST key; capture, non-manual intents, transfers, payouts and refunds refused). Jobs and cron are off, and email is in log mode. |
| Fault proxy | **127.0.0.1:18138** (`fault-proxy.cjs`, pid 86966): `/__fault/rules` (POST/GET/DELETE) and `/__fault/log?since=`. Helper `tools/fp.sh seq | add <id> <METHOD> <path-regex> [count] [status] | clear | log <sinceSeq> [filter]`; `log N` prints entries after N. |
| Web | Next dev on **127.0.0.1:18139** (pid 48094), serving the runtime worktree with HMR. `/api` and `/socket.io` are rewritten to 18138. |
| DB | Supabase stack `pantopus-stream1-resume-20260923` (Kong 64561, Postgres 64562). Read-only SQL: `./q.sh "select …"`. Fixture writes and cleanup: `docker exec -i supabase_db_pantopus-stream1-resume-20260923 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 < file.sql`, preferably with a DO block that checks ROW_COUNT. |
| Accounts | synthetic `sux_resume_alice` / `sux_resume_bob` / `sux_resume_dana` (ids `f9230c01-…-000000000001/2/3`), plus older Stream 1 fixtures `s1_sheet_r1_0/1/2`. No Homes exist. The only `StripeAccount` row belongs to `s1_sheet_r1_1`, so tips to alice, bob and dana return `CONNECT_REQUIRED`. The paid path is a boundary. |

**5.2 Helpers.** Credentials come from a private fixture file and are never printed.
- `python3 api.py login <actor>` stores `.tokens-<actor>.json` (0600).
  - `python3 api.py <actor> <METHOD> <path> ['<json>']` makes a call. Set `LIM=200000` for full output.
  - A `401 Invalid or expired token` means you should log in again.
- `node webcap.mjs <actor> <steps.json> <outDir>` drives headless Chrome through the real login.
  - It reuses `.webstate-<actor>.json` (0600). The web login limiter is 10 per 15 min per IP.
  - Step keys: `goto`, `click` (selector), `clickText` (exact), `clickRole {role,name,exact}`, `clickIn {within,text}`, `fill {selector,value}`, `fillPh {placeholder,value}`, `press`, `wait`, `waitText`, `waitUrl`, `eval`, `shot` (+ `scrollTo`, `full`), `timeout`.
  - Many `steps-*.json` examples sit in the folder.
- `python3 tools/android-login.py <actor>` fills the Android login form on emulator-5558 without printing the password.
- `bash tools/ios-pb.sh email <actor> | password | clear` puts a credential on sim F4DBD47E's pasteboard.
  - Long-press the field → Paste, then **clear**.
  - Tap "Not Now" on the system "Save Password?" prompt.
- `WT=<worktree> EXPECTED=<sha> bash build-android-static.sh` runs ktlint, detekt and assembleDebug, and writes a receipt.
  - It needs Stream 1 to **already hold** heavy; it never takes or releases it.
  - The worktree must be clean with HEAD == EXPECTED. It refuses an APK containing `:8000`.
  - APK: `<WT>/frontend/apps/android/app/build/outputs/apk/debug/app-debug.apk`.
- `WT=<worktree> IOS_SOURCE=<sha> bash build-ios-held.sh` builds the arm64 simulator app.
  - It needs a heavy owner that starts with `stream1:`, and the iOS subtree must equal IOS_SOURCE.
  - Output goes to DD `/private/tmp/pantopus-stream1-ios-dd`, with a receipt at `evidence/ios-build-<sha9>.json`.
  - ⚠ The DD is shared by all Stream 1 iOS builds; check the dylib hash before installing.
- `bash snapshot.sh <out.json>` records row counts for every public table (`{"at":…,"counts":{…}}`) for baseline and cleanup diffs.
- `python3 seal.py <dir> <branch> <commit> "<boundary>"` writes the MANIFEST.

**5.3 Bringing the runtime to a new master.**
1. In the runtime worktree, `git merge origin/master` (restore any served PR copies first with `git checkout -- <files>`).
2. Apply any new migrations: `comm` of `supabase_migrations.schema_migrations` against `supabase/migrations/`. Run each file with `psql -1 -v ON_ERROR_STOP=1`, with its ledger row.
3. If the backend changed:
   ```
   kill -INT <pid>
   nohup bash start-backend.sh > logs/backend-$(date -u +%H%M%S).log 2>&1 &
   ```
   Check `/api/hub` returns 200 as alice.

## 6. Devices and simulator gotchas

**Slots.**
- `zsh /private/tmp/pantopus-tools/device-slot.sh acquire '<stream>: <device …>' | release '<label prefix>' | status`.
  - ⚠ `release` removes **every** slot whose owner starts with the given prefix. Release with a precise prefix like `'stream1: iOS sim F4DBD47E'`, never bare `'stream1'`.
- `zsh /private/tmp/pantopus-tools/heavy-slot.sh acquire "<stream>: <purpose>" | release | status`.
  - Heavy covers xcodebuild, gradle assemble/install, and simulator installs of a fresh build.
  - The pid in the owner file is only the acquiring shell.

**Android emulator-5558** (AVD `Pantopus_Stream1_Start_R2`).
- **Boot:** acquire a device slot first, then:
  ```
  /Users/yingpengwang/Library/Android/sdk/emulator/emulator -avd Pantopus_Stream1_Start_R2 -port 5558 -no-snapshot-load -no-boot-anim -gpu host -no-metrics -no-audio &
  ```
- **Stop:** `adb -s emulator-5558 emu kill` (never pkill).
- **UI:** `ANDROID_SERIAL=emulator-5558 python3 /private/tmp/pantopus-tools/aui.py dump | tap '<text>'` (substring match; tap by coordinates when a title also matches).
- **Deep links:**
  ```
  adb -s emulator-5558 shell am start -a android.intent.action.VIEW -d "pantopus://gigs/<id>"
  ```
  Also `pantopus://listing/<id>` and `pantopus://post/<id>`.

**iOS sim F4DBD47E.**
- **Commands:** `xcrun simctl boot|shutdown F4DBD47E-ED21-4B85-941B-6B0C61DD5A31`; `xcrun simctl openurl … "pantopus://gigs/<id>"`. The router accepts `gig`/`gigs` and `listing`/`listings`; a bare `pantopus://settings` falls through to unknown, and only `settings/payments` routes.
- **MCP control tool:** screenshots and taps with `device` always set. Taps are in points, 402×874 (screenshot px × 402/920 on the displayed image).
- **Reopening the same task:** a deep link to a task that is already open does nothing. Go back first.
- **Timing:** take a fresh screenshot after any scroll before tapping.
- **iOS 26.5:**
  - a sheet whose `@State` is set in the presenting action renders stale;
  - a tap just above the keyboard can land on UIRemoteKeyboardWindow;
  - sheet detents shift buttons, so confirm each tap through the proxy log;
  - a hung `simctl boot` needs shutdown → boot.
- **Panel reboots:** the app's simulator panel has rebooted a just-shut-down sim before. Re-check `simctl list devices` after shutdown.

**Old builds.** Android APKs from before #509 show "Your account changed. Reopen this task" after a token refresh. It's fixed on master.

## 7. Evidence and inventory

**Bundle root:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/` (private, never committed). All streams' bundles live here.
- Each fix has a `RESULT.md` with before (master code) / after evidence, a source binding (`SOURCE.txt`) or build receipts, cleanup SQL, output and baseline diff, and a sealed `MANIFEST.json`.
- The PR body cites the seal.

**Living inventory:** `20260925-stream1-domain-inventory-r1/INVENTORY.md`, 146 rows, unsealed by design.
- Status legend: PASS / FIXED / REUSE / OPEN / BOUNDARY / ABSENT.
- At handoff it has 61 PASS and 58 FIXED:
  - 57 are merged — 44 say so in-row, and 13 plain-FIXED rows cite #425/#432/#433/#437/#438/#439/#447/#448/#454/#456, all merged (header note, 22:05:29Z);
  - 1 is #537, open.
- It also has 10 candidates, 1 OPEN, 5 notes, 2 routed, 2 BOUNDARY, 1 BY POLICY, 1 not run, 1 ABSENT (native listing Q&A) and 2 REUSE.

**Boundaries** (not verifiable here):
- the Stripe paid path (Connect onboarding and capture);
- posting a task through the UI (Mapbox geocoding);
- native delivery-proof photos (S3 upload → 503);
- real devices and push.

**Unsealed bundle folders:**

| Folder | Status |
|---|---|
| `…-domain-inventory-r1` | living, unsealed by design |
| `…-web-map-remote-tasks-r1` | before-only notes for the 0,0 candidate |
| `…-native-offers-failed-counts-r1`, `…-native-pulse-radius-banner-r1` | early drafts, superseded by sealed bundles. Check before reusing. |

## 8. What was done today (2026-09-26, UTC)

**Batches merged:**

| Batch (queue PR) | Master | PRs, in merge order | Merged at |
|---|---|---|---|
| 25 ([#499](https://github.com/WangPantopus/skinny-pantopus/pull/499)) | `dbd75332b` → `207eeb510` | 490 492 495 496 494 491 493 497 | 09:58:07Z |
| 26 ([#513](https://github.com/WangPantopus/skinny-pantopus/pull/513)) | → `9ac4a7cdf` | 498 500 501 504 505 506 502 503 507 508 | 11:37:08Z |
| 27 ([#517](https://github.com/WangPantopus/skinny-pantopus/pull/517)) | → `2e053fe9c` | 509 510 511 514 512 516 | 12:16:08Z |
| 28 ([#525](https://github.com/WangPantopus/skinny-pantopus/pull/525)) | → `be33552e8` | 518 515 519 520 521 522 | 13:49:47Z |
| 29 ([#526](https://github.com/WangPantopus/skinny-pantopus/pull/526)) | → `49b47e910` | 523 524 | 18:00:53Z |
| 30 ([#531](https://github.com/WangPantopus/skinny-pantopus/pull/531)) | → `448ee8b4a` | 527 528 529 530 | 18:49:34Z |
| 31 ([#534](https://github.com/WangPantopus/skinny-pantopus/pull/534)) | → `f885e0623` | 532 533 | 20:09:33Z |

**User decisions.**
- 1A–6A (09:48Z) are all merged:
  - 2A #506, 5A #505, 6A #504 in batch 26;
  - 1A #509 and 3A/4A #510 in batch 27.
- **Decision A** (native buyers accept a seller's counter): the reply was first seen by 17:49:40Z. It shipped as #533 in batch 31.

**Stream 1 PRs** (bundle seal in brackets):

| PR | What | Seal | Status |
|---|---|---|---|
| #509 | Android session marker | `51130b50` | merged |
| #510 | owner inbox + "Your offer"/Withdraw | `52125117` | merged |
| #511 | iOS offer Send with prefill | `6c323702` | merged |
| #514 | Discover/Explore Map SSR Leaflet | `0a2cc509` | merged |
| #518 | Manage Train signups failed + no-dates nudge | `ad6cc465` | merged |
| #522 | web instant accept on `/app/gigs/:id` | `b45639bf` | merged |
| #524 | web Reviewed step + reviewer names | `8786c694` | merged |
| #527 | tip copy for `CONNECT_REQUIRED` | `9bb90479` | merged |
| #533 | native accept-a-counter | `45e240d9` | merged |
| **#537** | iOS task questions live | `0cde42d1` | **open** |

**Audits sealed:**
- **Free-task lifecycle** `20260926-stream1-free-task-lifecycle-r1` [`1855635d`, 154 files]:
  - web, Android and iOS instant accept → start → complete → confirm → reviews/tips;
  - helper "Leave assignment";
  - the policy-blocked started-task cancel.
  - Fixtures T1–T9 were removed at 18:16:15Z.
- **Accept-counter** fixtures were removed at 18:51:16Z.
- **#537 check:**
  - before: master code, POST 201 at 21:57:53Z, no app request, "Questions (0)" until reopen;
  - after: POST 201 at 22:00:15.827Z, refetch +77 ms, "Questions (2)" live;
  - fixture removed at 22:01:12Z.
  - Only auth rows (sessions, security events, DPoP JTIs) are left, and they are documented.

**Runtime and coordination.**
- The isolated DB was brought to master's migrations at 12:20:48Z, and the backend was restarted (SIGINT) at 12:21Z. No backend change has merged since.
- **Heavy-slot incident:** Stream 2's heavy lock sat idle for about 4.5 h while its session was stalled. With the **user's approval** (AskUserQuestion), Stream 1 took it over at 17:20:14Z, and Stream 2 agreed afterwards. If a peer holds a slot idle for hours, ask the user before taking it.
- **Slot 1 hand-offs:** Stream 2 → Stream 3 at 21:46:29Z; Stream 3 → Stream 1 at 21:54:31Z; Stream 1 released it by 22:01:25Z.

## 9. Worktrees (`git worktree list`; checked 22:04Z)

- **Not merged, keep:** `/private/tmp/pantopus-stream1-gig-qa-live` (#537).
- **Runtime:** `stream1-peer-takeover-d2cb25` (tree == master).
- **Merged into master, safe to ignore** (all under `/private/tmp/pantopus-stream1-*`):
  - accept-counter, android-session, backend-views, batch11, gig-bidcount, ios-listing-link, ios-offer-send, listing-dock, manage-train, native-mylistings, native-mylists2, native-nav, native-pulse, native-questions, native-saved, native-wallet, pr425;
  - tip-reason, web-discover, web-discover-ssr, web-explore-map, web-feed-card, web-gigs, web-hide-trades, web-instant-accept, web-listing-offers, web-location, web-mkt, web-mybids, web-mylistings, web-mypulse, web-pay, web-review-step, web-save-guard, web-saved-links, web-snapshot, web-tasks-map.
- **Dirty, preserve** — `/private/tmp/pantopus-stream1-web-trade` (branch `claude/stream1-web-trade-modal-failure` at `dbd75332b`):
  - It has an **uncommitted** change to web `marketplace/[id]/_components/TradeModal.tsx`: a failed load of "your listings" now shows `ErrorState` + Retry instead of "no listings".
  - **Moot today:** the button that opens TradeModal (`marketplace/[id]/page.tsx:165`, `listing.open_to_trades && !isOwner`) never renders. #504 (decision 6A) found that no listing response carries `open_to_trades`, and it hid the create-form toggle.
  - Keep the change as is (don't discard, stash or commit it) for when trades return.
- **Stale entries whose folders are gone:** acctdel, native, native-bids-camera, noshow, offers, package-contract, package-native, reveal-address, verify-resume, web-groups, web-offers, web-resume. Five are unmerged older `wip/…` / `codex/…` branches from before this session. **Leave them**; worktree removal and prune are forbidden.

## 10. Peers (SendMessage; list sessions with ListAgents)

**Stream 2** (session "Stream 2 Mail journey completion", `uds:/tmp/cc-socks/37889.sock` at handoff): Mail, Home and Guests.
- Its user asked it to keep going, so it has no handoff yet. Its written fallback is `docs/workstreams/02-home-household.md` → CURRENT RESUME, with a runtime kit at `…/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/`.
- **Open:** #535, #538. **Next:** 2b (native; needs heavy and the iOS driver).

**Stream 3** (session "fix(web): connect booking follow-up and rebooking actions", `uds:/tmp/cc-socks/39145.sock`): chat, social, scheduling and Beacons.
- **Open:** #536.
- **Handoff:** committed at coordination `6d039a691` (`docs/workstreams/03-accounts-social.md` → CURRENT RESUME; takeover prompt `docs/workstreams/NEXT-STREAM3-PROMPT-2026-09-26.md`; runtime kit `.pantopus-recovery/stream3-runtime-kit/`).
- **Holds:** no device slot and no heavy lock. Its private runtime (API 18134, proxy 18130 in chat-audit mode, web 18131) stays up while its session lives.
- **A successor Stream 3 session** will use ListAgents and ask who owns the queue. The answer is **the next Stream 1 session**, which runs batch 32 and later batches.

**Message conventions.**
- Peers send "PR #N ready for your queue" with head, bundle and seal, file scope and verification.
- Reply with the review result, bundle verification and dry-run (merge-tree) result, then the batch number, and later the merge time and new master.
- Slot hand-offs are explicit messages with the exact release time.
