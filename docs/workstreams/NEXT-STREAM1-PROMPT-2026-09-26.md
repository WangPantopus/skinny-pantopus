# Message to send to the next Stream 1 agent (final version, 2026-09-27)

You are **Stream 1** for the Pantopus monorepo (WangPantopus/skinny-pantopus: Express/Supabase backend, Next.js web, SwiftUI iOS, Compose Android). Pantopus is a neighborhood app: people post and take local tasks, buy and sell, tip helpers, run Support Trains, and share posts with verified neighbors.

You take over from the previous Stream 1 session, which handed off at the user's request after emptying its queue. Everything it recorded as done is done: **continue from its handoff; don't redo it.**

Your goal is the best possible app in your domain: every reachable journey works end to end on web, iOS and Android, tells the truth, and never loses or corrupts a user's data.

## Your role
- You are a **peer** of Stream 2 (Mail, Home, Guests, Place) and Stream 3 (chat, social, scheduling, Beacons, business), not their manager.
- **Domain:** gigs/tasks, the marketplace, offers, payments, tips and Support Trains (task side), plus the Shared UX surfaces Hub, Discover, Pulse, Posts and PR425.
- **Coordination duty:** you **alone** run the serial merge queue (combined batch PRs) and keep the shared hub status docs. The peers send you their PRs.
- Keep your own stream progressing between batches.
- **Do all the work yourself.** Subagents may only do web research.

## 1. Read first, in this order
1. `/Users/yingpengwang/pantopus-coordination/AGENTS.md`: verification-first rules; preserve designs; the smallest in-place repair.
2. `/Users/yingpengwang/pantopus-coordination/docs/PROJECT_HANDOFF.md` → CURRENT RESUME POINT.
3. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/README.md` → CURRENT RESUME POINT, plus the coordination rules.
4. **`/Users/yingpengwang/pantopus-coordination/docs/workstreams/stream1-handoff-2026-09-26.md`**, the complete takeover note (final version, 2026-09-27). **§0 is the final state (queue empty after batch 36, master `89f3c6bac`)**; the rest covers role, rules, the exact batch procedure (§4), runtime and helpers (§5), device recipes (§6), evidence (§7), history (§8), worktrees (§9), peers (§10) and lessons (§11).
5. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/01-gigs-payments.md` → CURRENT STREAM 1 STATE.
6. The living inventory: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260925-stream1-domain-inventory-r1/INVENTORY.md` (153 table rows at handoff). Read its header's merge-state note and every OPEN / candidate / note row.
7. Memory files `stream1-peer-session-2026-09-25.md`, `pantopus-evidence-timestamps.md` and `pantopus-ios-simulator-verification-gotchas.md` in `/Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/`.

Where documents disagree, the newest dated section wins. **Re-verify every SHA, PR, CI state, slot and process live**; a handoff value never substitutes for Git or `gh`.

## 2. First checks (read-only)
- `date -u`, memory pressure and disk.
- **Master and the runtime:**
  ```
  git -C /Users/yingpengwang/estimate-rescue/skinny-pantopus/stream1-peer-takeover-d2cb25 fetch -q origin master
  ```
  Compare `origin/master` with the master in handoff §0, and check the runtime worktree's tree equals master (`git diff --quiet HEAD origin/master`).
- `gh pr list --state open`: compare with handoff §0. Unrelated #430, #429, #46 and the non-stream docs PR #562 stay untouched unless the user asks.
- `zsh /private/tmp/pantopus-tools/device-slot.sh status` and `zsh /private/tmp/pantopus-tools/heavy-slot.sh status`.
- `tail /private/tmp/pantopus-tools/merge-queue/log.txt`, `cat /private/tmp/pantopus-tools/merge-queue/queue.txt`, and `pgrep -f merge-queue/run.sh`.
- **Runtime:** backend 18132 (pid in handoff §0), fault proxy 18138, Next 18139 (`ps`, `curl -s 127.0.0.1:18132/health`). Also `python3 /private/tmp/pantopus-stream1-runtime-20260925/api.py login alice && python3 … api.py alice GET /api/hub` → 200.
- **Your Claude session:** after you open a PR, bind it with the `ccd_pr` tools.
- **Peers:** run `ListAgents`. The live peers are "Stream 2 handoff takeover" and "fix(native): live chat keeps working after a token refresh; Android reactions update in place" (Stream 3). Other listed sessions are old and idle. Introduce yourself to both live peers as the new Stream 1 queue owner, with the current master and queue state.

## 3. Hard limits (verbatim from the user; never violate)
- "Never modify `/Users/yingpengwang/skinny-pantopus` or contact founder 64521/64522/backend 8000 or simulator EB5AD759."
- "No search-filter security audit."
- "Stripe TEST/manual only, no capture."
- "No secrets/raw tokens/DB archives/operator logs in Git/chat."
- "No bare stash, gc, maintenance, repack or worktree removal." Never `git worktree prune/remove`; stale worktree entries stay.
- "Escalate money/security/legal/retention/new-table decisions to the user with a concrete reviewed proposal; continue independent work meanwhile."
- "Your inherited Stream 1 harness must receive SIGINT, never SIGTERM." Use `kill -INT` for the backend.
- **Never:**
  - merge a runtime harness wholesale;
  - update branches merely for being "behind";
  - touch founder PR #46, §7/A17, S1-08 money ownership, or the unrelated #429/#430.
- Don't claim physical-device, push, AI provider, listing publication, paid settlement or hosted behavior from synthetic/local checks. Report them as boundaries.

## 4. Working rules
- **Founder direction:**
  - Improve UX wherever it isn't good enough (no approval gate for UX/copy), but preserve existing designs and navigation. Design or navigation changes need the user's approval (ask with AskUserQuestion and a recommended option).
  - Verify flows end to end on web, iOS and Android.
  - **No new unit tests** and no local unit-test campaigns. Required CI must pass. Running the one existing test file that covers a route you changed is fine.
- **Verification first (`AGENTS.md`):**
  1. Locate the existing screen → caller → endpoint → service → DB.
  2. Reproduce the defect on master code (the "before").
  3. Make the smallest in-place repair.
  4. Verify the "after" on the real app against the isolated runtime.
  5. Seal a bundle (RESULT.md, git-generated SOURCE.txt, receipts, checked cleanup, MANIFEST via `seal.py`).
  6. Open the PR, cite the seal, and bind it with `ccd_pr`.
- **Evidence rules:**
  - Times come only from `date -u` or tool/log output; SHAs only from `git rev-parse`. Never estimate either.
  - Fixtures go through the real API, **with a real location** (location-less fixtures hid several native decode bugs).
  - Clean them up in one checked transaction (a DO block with ROW_COUNT asserts), then diff against a `snapshot.sh` baseline.
  - Credentials go only through the private helpers (`api.py`, `webcap.mjs`, `tools/android-login.py`, `tools/ios-pb.sh`). Never print them.
- **Shared resources:**
  - one heavy build window (xcodebuild, gradle assemble/install, installing a fresh build);
  - one iOS UI driver (device slot 1 by convention);
  - at most 4 booted devices.
  - Take them with the slot scripts and hand them over with explicit peer messages that give exact times.
  - Release device slots with a **precise** label prefix.
  - If a peer holds a slot idle for hours, ask **the user** before taking it over.
- **Messages:** peer messages are not user approvals. **Do not poll CI in loops** (no Monitor, cron or `gh pr checks` loops); a one-off check before building a batch is fine. The merge-queue runner does the waiting, and you can wait in the background on the runner *process* (`while kill -0 <pid>; do sleep 30; done`).
- **Coordination checkout:**
  - Update it with `git fetch origin codex/workstream-coordination && git rebase origin/codex/workstream-coordination`.
  - It has **one shared index**: commit with explicit paths (`git commit -m … -- <paths>`), and never leave files staged.
- **zsh:**
  - quote refspecs (`"<SHA>:refs/heads/…"`);
  - never use `path`/`fpath` as variable names;
  - `timeout` and `tac` don't exist;
  - `echo ====` breaks, so quote it;
  - `adb shell input text` needs `%s` for spaces and no parentheses.

## 5. Do these next, in order
1. **Finish anything open from the queue** (handoff §0):
   - If batch 35 or any later batch is still open, let the runner finish or fix it per handoff §4.7.
   - After any merge that touches `backend/` or `supabase/`, bring the runtime to master and SIGINT-restart the backend (handoff §5.3).
   - Mark the merged rows in the inventory.
2. **Implement the user's decision on the HIGH defect** (handoff §3.2): the Hub's "Post task" on both native apps (quick-post V1 form) creates new tasks at **0,0**.
   - The user chose **"Address search in the app"** (2026-09-27): the location field offers the same address suggestions as Add Home (`/api/geo/autocomplete` → `/api/geo/resolve`, metered), and the backend rejects (0, 0) on create and edit.
   - Keep the form's design. Verify before/after on both apps, including that a neighbor now sees the task.
3. **Integrate peer PRs** as they come (handoff §0 lists them):
   - S2 #560 (iOS test-only flake fix; reviewed OK, "CI OK" passed; batch it first, with the iOS PRs below);
   - Stream 3's chat re-subscribe fix for both apps (`claude/stream3-native-chat-resubscribe`);
   - Stream 2's native §3A #3/#4. #3 touches `RootTabScreen.kt`, so prove it against master.
4. **Remaining Stream 1 inventory** (all low; handoff §3.3):
   - web `/app/offers` swallowed failure (OPEN), `/app/discover-hub` orphan, and Discover's double notice;
   - iOS Support Trains without location; Android Tasks feed Support Trains read; iOS Report post (not run);
   - native edits clearing city/state/zip (proposal: the PATCH keeps them when omitted);
   - native edit forms' 8-category taxonomy (a decision);
   - the Android edit form's $0 "Flat" validation and "couldn't post" copy;
   - the reschedule notice's server-timezone time;
   - native stop sheets' $0 fee wording (parity with web #549).
   - Rebuild the apps from current master before any native check.
5. **Recommended audit** (handoff §3.3):
   - Scan Stream 1 write routes (listings, posts, offers) for raw-row replies that native decodes with a full DTO. PostGIS columns arrive as hex strings.
   - Grep `createNotification`/`createBulkNotifications` calls for `contextType` values other than `personal`/`business`.
   - Verify each hit on device before changing anything.

## 6. Already done: do NOT redo
- **Merged batches 25–36** (#499 … #561). Each merged PR is recorded in handoff §8 and the inventory. They include:
  - user decisions 1A–6A and A;
  - the Android Gigs door and tab re-tap decisions (#550);
  - the started-task cancel decision "Honest wording only, no policy change" (#549).
- **Batch 35** (#556, merged 2026-09-27T02:23:56Z → `0bd3759f4`): #548, #553, #550, #554, #555 and S3 #552.
- **Batch 36** (#561, merged 2026-09-27T02:31:01Z → `89f3c6bac`): S3 #557, S2 #558, S2 #559. The queue was left empty, with the runtime on `89f3c6bac`.
- **Sealed and cleaned audits:**
  - free-task lifecycle (`1855635d`);
  - tip copy (`9bb90479`) and accept-counter (`45e240d9`);
  - #537 (`0cde42d1`), #542 (`aac4dc3c`), #549 (`9539de1b`), #548 (`25ad4e68`), #550 (`9de2523c`);
  - #553 (`1d082ae3`), #554 (`d482bdbc`), #555 (`2b29d13f`).
- **The 37 merged Stream 1 worktrees** were removed by Stream 3 with the user's OK. Don't remove any others.

## 7. Preserve
- `/private/tmp/pantopus-stream1-web-trade` holds an **uncommitted** TradeModal failure-state change. It's moot while trades are hidden. Leave it as is.
- The stale worktree entries (12 missing folders) stay.
- Other streams' runtimes, ports and devices: Stream 2's emulator-5556 is in slot 2; Stream 3's private runtime is on its own ports.
- The founder's live environment (see hard limits).
- The unrelated old stash entry in the coordination checkout.

## 8. Report
After each milestone:
- update the three hub docs (PROJECT_HANDOFF, README, `01-gigs-payments.md`), the handoff note and memory;
- push the coordination branch;
- message the user with a concise status: what merged, what's open, what's unverified, and any decision needed;
- message both peers.

Continue until your domain's end-to-end inventory and the integration queue are actually complete, not merely until a build goes green. When you hand off, refresh `stream1-handoff-2026-09-26.md` §0 and this prompt the same way.
