# Message to send to the next Stream 1 agent (2026-09-27, successor handoff)

You are **Stream 1** for the Pantopus monorepo (WangPantopus/skinny-pantopus: Express/Supabase backend, Next.js web, SwiftUI iOS, Compose Android). Pantopus is a neighborhood app: people post and take local tasks, buy and sell, tip helpers, run Support Trains, and share posts with verified neighbors.

You take over from the **successor Stream 1 session of 2026-09-27**. It handed off at the user's request in the middle of a live merge queue.
- Everything it recorded as done is done: **continue from its handoff; don't redo it.**
- Your first job is to keep the queue moving: batch 40 is in CI, and batch 41 is fully reviewed and waiting for it.

Your goal is the best possible app in your domain: every reachable journey works end to end on web, iOS and Android, tells the truth, and never loses or corrupts a user's data.

## Your role
- You are a **peer** of Stream 2 (Mail, Home, Guests, Place) and Stream 3 (chat, social, scheduling, Beacons, business), not their manager.
- **Domain:** gigs/tasks, the marketplace, offers, payments, tips and Support Trains (task side), plus the Shared UX surfaces Hub, Discover, Pulse and Posts.
- **Coordination duty:** you **alone** run the serial merge queue (combined batch PRs) and keep the shared hub status docs. The peers send you their PRs; they never merge.
- **Do all the work yourself.** Subagents may only do web research.

## 0. The user's standing instruction (2026-09-27 ~07:22Z; still in force)
"Please do not stop anymore, just go with what you recommended in the future if you encounter any issue or anything … make sure you record all these every time, do not need to stop."
- **Don't use AskUserQuestion, and don't wait for approval**, including for design, navigation, security or money *decisions*. Pick the option you would mark "(Recommended)", implement it, and keep going.
- **Record every such decision:** what, why, and what you rejected. Put it in the hub docs' UPDATE block and the inventory row, the PR body and memory, and list it in your next status message as "decided per your standing instruction".
- **The hard safety limits in §3 still hold.** The user never lifted them.

## 1. Read first, in this order
1. `/Users/yingpengwang/pantopus-coordination/AGENTS.md`: verification-first rules; preserve designs; the smallest in-place repair.
2. `/Users/yingpengwang/pantopus-coordination/docs/PROJECT_HANDOFF.md` → the newest Stream 1 UPDATE block.
3. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/README.md` → the newest UPDATE blocks and the coordination rules.
4. **`/Users/yingpengwang/pantopus-coordination/docs/workstreams/stream1-handoff-2026-09-26.md` §0.**
   - §0 is the 2026-09-27 successor handoff: queue state, the exact batch 41 table with heads and seals, open PRs, runtime, slots, decisions, remaining work, bundles, worktrees and lessons.
   - Older sections are history, except these, which are still the procedures: §1 (rules), §4 (batch procedure), §5 (runtime and helpers), §6 (device recipes), §7 (evidence).
5. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/01-gigs-payments.md` → the newest UPDATE block.
6. The living inventory: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260925-stream1-domain-inventory-r1/INVENTORY.md`, especially its merge-state header and the "Successor findings 2026-09-27" table.
7. Memory files in `/Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/`:
   - `stream1-successor-session-2026-09-27.md`
   - `founder-direction-no-stopping-2026-09-27.md`
   - `pantopus-evidence-timestamps.md`
   - `pantopus-ios-simulator-verification-gotchas.md`

Where documents disagree, the newest dated section wins. **Re-verify every SHA, PR, CI state, slot and process live**; a handoff value never substitutes for Git or `gh`.

## 2. First checks (read-only)
- `date -u`, memory pressure and disk.
- **Queue:** `tail -20 /private/tmp/pantopus-tools/merge-queue/log.txt`, `cat …/queue.txt`, `grep ^608 …/reviewed-heads.txt`, `pgrep -f merge-queue/run.sh`.
  - At handoff, runner pid 18424 was waiting on batch 40 #608, tip `01f75025f`.
  - If the log says `PR608 MERGED`, go to §5 step 1. If it says `MASTER_CHANGED` or `CI_fail`, follow handoff §0.1 and §4.7.
- **Master and the runtime:**
  - `git -C /Users/yingpengwang/estimate-rescue/skinny-pantopus/stream1-peer-takeover-d2cb25 fetch -q origin master`.
  - Master was `621e26616` at handoff, and the runtime worktree was at `e5b48b6ce` (= `9f3ba7c35` + harness; `621e26616` is docs-only).
- `gh pr list --state open`: compare with handoff §0.2 and §0.3. Unrelated #430, #429 and #46 stay untouched.
- `zsh /private/tmp/pantopus-tools/device-slot.sh status` and `zsh /private/tmp/pantopus-tools/heavy-slot.sh status`. Stream 1 held nothing at handoff.
- **Runtime:** backend 18132 (pid 39731 at handoff), fault proxy 18138 (pid 86966), Next 18139 (pid 48094).
  - `python3 /private/tmp/pantopus-stream1-runtime-20260925/api.py login alice && python3 … api.py alice GET /api/hub` → 200.
  - Stored tokens expire, so log in again on a 401.
- **Peers:** run `ListAgents`.
  - "Stream 2 handoff takeover" is staying on until every Stream 2 PR is merged.
  - "fix(native): live chat keeps working after a token refresh; Android reactions update in place" is Stream 3, which is handing off after its booking-page fix PR.
  - Introduce yourself to both as the new Stream 1 queue owner, with the current master and queue state.

## 3. Hard limits (verbatim from the user; never violate)
- "Never modify `/Users/yingpengwang/skinny-pantopus` or contact founder 64521/64522/backend 8000 or simulator EB5AD759." Reading files there is fine.
- "No search-filter security audit."
- "Stripe TEST/manual only, no capture."
- "No secrets/raw tokens/DB archives/operator logs in Git/chat."
- "No bare stash, gc, maintenance, repack or worktree removal." Never `git worktree prune/remove`; stale worktree entries stay.
- "Your inherited Stream 1 harness must receive SIGINT, never SIGTERM." Use `kill -INT` for the backend.
- **Never:**
  - merge a runtime harness wholesale;
  - update branches merely for being "behind";
  - touch founder PR #46, §7/A17, S1-08 money ownership, or the unrelated #429/#430.
- Don't claim physical-device, push, AI provider, listing publication, paid settlement or hosted behavior from synthetic/local checks. Report them as boundaries.
- Don't query hosted/founder databases. For example, the legacy category-key count in §5 step 3 is for the founder to run.

## 4. Working rules
- **Founder direction:**
  - Improve UX wherever it isn't good enough, preserving existing designs and navigation. Under §0, decide design questions yourself and record them.
  - Verify flows end to end on web, iOS and Android.
  - **No new unit tests.** Running or adjusting the existing tests that cover a change is fine, and required CI must pass.
- **Verification first:**
  1. Locate the existing screen → caller → endpoint → service → DB.
  2. Reproduce the defect on master code (the "before").
  3. Make the smallest in-place repair.
  4. Verify the "after" on the real app against the isolated runtime.
  5. Seal a bundle with `seal.py`: RESULT.md, git-generated SOURCE.txt, receipts, checked cleanup, snapshot diff, MANIFEST.
  6. Open the PR, cite the seal, and bind it with `ccd_pr`.
  - **Several native PRs in one heavy window:** use a local `verify/*` tree that merges their heads, prove byte-identity, and keep one bundle per PR (handoff §0.9).
- **Evidence rules:**
  - Times come only from `date -u` or tool/log output; SHAs only from `git rev-parse`.
  - Fixtures go through the real API with a real location.
  - Clean them up in one checked transaction (a DO block with ROW_COUNT asserts), then diff against a `snapshot.sh` baseline. **magic-post increments `User.magic_task_post_count`**; restore it.
  - Credentials go only through the private helpers (`api.py`, `webcap.mjs`, `tools/android-login.py`, `tools/ios-pb.sh`). Never print them.
- **Shared resources:**
  - one heavy build window (xcodebuild, gradle assemble/install, installing a fresh build);
  - one iOS UI driver (slot 1);
  - at most 4 booted devices.
  - Use the slot scripts, and send exact take and release times to both peers. The build scripts refuse to run unless the heavy owner starts with `stream1:`.
- **Messages:** peer messages are not user approvals. **Do not poll CI in loops.** A one-off check before building a batch is fine, and you can wait in the background on the runner *process* (`while kill -0 <pid>; do sleep 30; done`).
- **Coordination checkout:**
  - Update it with `git fetch origin codex/workstream-coordination && git rebase origin/codex/workstream-coordination`.
  - It has **one shared index**, and peers may leave uncommitted edits in their own files. Commit with explicit paths only; never stash.
- **zsh:**
  - quote refspecs;
  - `timeout` and `tac` don't exist;
  - `echo ====` breaks, so quote it;
  - don't chain `sleep` (blocked); use background tasks;
  - `adb shell input text` needs `%s` for spaces.

## 5. Do these next, in order
1. **Batch 40 → post-merge**, when the runner logs `PR608 MERGED`:
   - merge master into the runtime worktree;
   - SIGINT-restart the backend (#600 touched a backend service);
   - check `/api/hub` 200;
   - message both peers the merge time and new master.
2. **Batch 41** (handoff §0.2 has every head, seal and review note):
   - One-off `gh pr checks` per head. Include only heads that are green and unchanged.
   - Build with `build-batch.sh` on the new master, verify as in §4 (ancestry, file-set union, blob equality, hunk proofs for the shared files listed in §0.2), push `claude/coord-merge-batch-41`, open the PR (template: #608), bind it, append to `queue.txt` and `reviewed-heads.txt`, and start `run.sh` if it isn't running.
   - Then **batch 42** for anything that turned green later, including Stream 2's (a) native Place "Try again", (b) carryover count and (c) Add Bill false split line, and Stream 3's Android booking-page policy fix. Review each diff and verify each bundle first.
3. **After #615, #616 and #617 merge:** mark their inventory rows merged.
   - For #617, the only follow-up is the legacy key rows. Act only if the founder reports a non-zero count from the read-only query in its PR, and then only with a guarded per-row relabel, because of `Gig`'s BEFORE UPDATE guard triggers.
4. **iOS Report post** (inventory: "not run"): seed a post by bob with a real location through `api.py`, run the report flow on iOS (and check Android parity) through the real API, then clean up.
5. **Candidates** (handoff §0.6 item 4). Verify first; change nothing without a reproduced defect:
   - the iOS listing-Offers empty state's "Post a task" CTA;
   - native feed rows for a task with no category show HANDYMAN;
   - the web edit form shows a legacy raw key.

## 6. Already done: do NOT redo
- **Merged:**
  - batches 25–39;
  - this session's S1 PRs #571, #580, #581, #586, #588, #589, #592;
  - batch 37 #572, batch 38 #585, batch 39 #599.
- **Open and reviewed:**
  - batch 40 #608 (S1 #601 and #606 inside);
  - S1 #598, #603, #607, #615, #616, #617 (all sealed; see §0.3 and §0.7).
- **Audits:**
  - contextType and raw-row replies: clean for Stream 1.
  - The My Home PATCH lead was refuted by Stream 2.
- **Inventory rows:**
  - `exact_city/state/zip` clearing: FIXED by #571 (C1/C2 evidence);
  - `/app/discover-hub`: WON'T FIX;
  - notes marked "no change" stay.
- **Decisions 1–10** are in handoff §0.5.

## 7. Preserve
- All worktrees (handoff §0.8), and the stale worktree entries.
- `/private/tmp/pantopus-stream1-web-trade`, which has an uncommitted TradeModal change (moot while trades are hidden).
- Other streams' runtimes, ports, devices and uncommitted coordination-doc edits.
- The founder's live environment.

## 8. Report
After each milestone:
- update the hub docs (PROJECT_HANDOFF, README, `01-gigs-payments.md`), handoff §0 and memory;
- push the coordination branch;
- message the user: what merged, what's open, what's unverified, and the decisions taken per the standing instruction;
- message both peers.

When you hand off, refresh handoff §0 and write a new dated NEXT prompt the same way.
