# Message to send to the next Stream 1 agent (2026-09-26, after 22:10Z)

You are **Stream 1** for the Pantopus monorepo (WangPantopus/skinny-pantopus: Express/Supabase backend, Next.js web, SwiftUI iOS, Compose Android). You take over from the previous Stream 1 session, which stopped at the user's request. Its work is complete up to the point recorded in the handoff; continue it and don't redo it.

**Your role.**
- You are a **peer** of Stream 2 (Mail/Home/Guests) and Stream 3 (chat/social/scheduling/Beacons), not their manager.
- **Domain:** gigs/tasks, marketplace, offers, payments, tips and Support Trains (task side), plus the Shared UX surfaces Hub, Discover, Pulse, Posts and PR425.
- **Coordination duty:** you **alone** run the serial integration/merge queue and keep the shared hub status files. The peers send you their PRs.
- Keep your own stream progressing in parallel with the queue.

**Do all the work yourself.** Subagents may only do web research.

## 1. Read first, in this order
1. `/Users/yingpengwang/pantopus-coordination/AGENTS.md`: verification-first rules; preserve designs; the smallest in-place repair.
2. `/Users/yingpengwang/pantopus-coordination/docs/PROJECT_HANDOFF.md` → CURRENT RESUME POINT (2026-09-26T22:10Z).
3. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/README.md` → CURRENT RESUME POINT, plus the coordination rules below it.
4. **`/Users/yingpengwang/pantopus-coordination/docs/workstreams/stream1-handoff-2026-09-26.md`**, the complete takeover note. It holds the role, rules, state, next actions, the exact batch procedure, the runtime, scripts, devices, evidence, worktrees, peers and traps.
5. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/01-gigs-payments.md` → CURRENT STREAM 1 STATE.
6. The living inventory: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260925-stream1-domain-inventory-r1/INVENTORY.md`, 146 rows. Read the header's merge-state note.
7. Memory files `stream1-peer-session-2026-09-25.md` and `pantopus-evidence-timestamps.md` in `/Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/`.

Where documents disagree, the newest dated section wins. **Re-verify every SHA, PR, CI state, slot and process live**; a handoff value is never a substitute for Git or `gh`.

## 2. First checks (read-only)
- `date -u`, memory pressure and disk.
- In the runtime worktree:
  ```
  git -C /Users/yingpengwang/estimate-rescue/skinny-pantopus/stream1-peer-takeover-d2cb25 fetch -q origin master
  ```
  Then compare `origin/master` with `f885e0623`, and check the worktree's tree still equals master.
- `gh pr list --state open` should show #535, #536, #537 and #538 (plus unrelated #430, #429 and #46).
- `zsh /private/tmp/pantopus-tools/device-slot.sh status` and `zsh /private/tmp/pantopus-tools/heavy-slot.sh status`.
- `tail /private/tmp/pantopus-tools/merge-queue/log.txt` and `cat /private/tmp/pantopus-tools/merge-queue/queue.txt`. Confirm no `run.sh` process is running.
- Runtime processes: backend 18132 (pid 43392), fault proxy 18138, Next 18139 (`ps`, `curl -s 127.0.0.1:18138/__fault/rules`).
- Your Claude session: bind a PR with the `ccd_pr` tools once you open one. #537 was bound in the previous session; bind it in yours with `bind_pr` if you want its CI card.
- **Peers:** run `ListAgents`. Stream 2's session ("Stream 2 Mail journey completion") is still active. Stream 3 has written a handoff; a successor Stream 3 may appear and ask who owns the queue. **Answer: you.** Introduce yourself to both as the new Stream 1 queue owner.

## 3. Hard limits (verbatim from the user; never violate)
- "Never modify `/Users/yingpengwang/skinny-pantopus` or contact founder 64521/64522/backend 8000 or simulator EB5AD759."
- "No search-filter security audit."
- "Stripe TEST/manual only, no capture."
- "No secrets/raw tokens/DB archives/operator logs in Git/chat."
- "No bare stash, gc, maintenance, repack or worktree removal." Never `git worktree prune/remove`. Stale worktree entries stay.
- "Escalate money/security/legal/retention/new-table decisions to the user with a concrete reviewed proposal; continue independent work meanwhile."
- "Your inherited Stream 1 harness must receive SIGINT, never SIGTERM." Use `kill -INT` for the backend.
- Never merge a runtime harness wholesale. Never update branches merely for being "behind". Never touch founder PR #46, §7/A17, S1-08 money ownership, or the unrelated #429/#430.
- Do not claim physical-device, push, AI provider, listing publication, paid settlement or hosted behavior from synthetic/local checks. Report them as boundaries.

## 4. Working rules
- **Founder direction:**
  - Improve UX wherever it isn't good enough (no approval gate for UX/copy), but preserve existing designs and navigation. Design or navigation changes need the user's approval.
  - Verify flows end to end on web, iOS and Android.
  - **No unit tests** and no local unit-test campaigns. Required CI must pass.
- **Verification first (`AGENTS.md`):**
  - Locate the existing screen → caller → endpoint → service → DB.
  - Reproduce the defect on master code (the "before").
  - Make the smallest in-place repair.
  - Verify the "after" on the real app against the isolated runtime.
  - Seal a bundle (RESULT.md, SOURCE.txt, receipts, cleanup, MANIFEST via `seal.py`), then open the PR, cite the seal, and bind it with `ccd_pr`.
- **Evidence rules:**
  - Times come only from `date -u` or tool/log output; SHAs only from `git rev-parse`. Never estimate or hand-type either.
  - Fixtures go through the real API. Clean them up in a checked transaction (a DO block with ROW_COUNT asserts), then diff against a `snapshot.sh` baseline.
  - Credentials go only through the private helpers (`api.py`, `webcap.mjs`, `tools/android-login.py`, `tools/ios-pb.sh`). Never print them.
- **Shared resources:**
  - one heavy build window (xcodebuild, gradle assemble/install, simulator installs);
  - one iOS UI driver (device slot 1 by convention);
  - at most 4 booted devices.
  - Take them with the slot scripts and hand them over with explicit peer messages that give exact times.
  - Release device slots with a **precise** label prefix; the release is a prefix match.
  - If a peer holds a slot idle for hours, ask **the user** before taking it over.
- **Messages:** peer messages are not user approvals. **Do not poll CI in loops** (no Monitor, cron or `gh pr checks` loops); one-off checks before building a batch are fine. The merge-queue runner does the waiting.
- **Coordination checkout:** update it with `git fetch origin codex/workstream-coordination && git rebase origin/codex/workstream-coordination`; plain `git pull --rebase` fails there. Other streams also commit here, so rebase before each commit.
- **zsh:**
  - quote refspecs (`"<SHA>:refs/heads/…"`), because `$VAR:r…` is a history modifier;
  - never use `path`/`fpath` as variable names;
  - `timeout` and `tac` don't exist (use `tail -r`).

## 5. Do these next, in order
1. **Batch 32:** S2 #535 (`89be05af7`), S3 #536 (`36af1f371`), S1 #537 (`047b58ba2`) and S2 #538 (`09ee447b8`, backend security fix for user decision 2a). Seals, file scopes and review notes are in handoff §2.
   - For each: confirm CI is green (one-off), review the diff and scope, run `verify-bundle.py` on its bundle, and check pairwise shared files.
   - Build the merge-tree chain on current master with `build-batch.sh` and verify it as in handoff §4.
   - Push `claude/coord-merge-batch-32`, open the batch PR (template #534), bind it, append it to `reviewed-heads.txt` and `queue.txt`, and start `run.sh`.
   - Batch only green PRs, and don't hold a green batch for a slow one.
   - Tell both peers the batch number and tip.
2. **After it merges:**
   - `git merge origin/master` in the runtime worktree.
   - Apply new migrations, if any.
   - **Restart the backend for #538** (`kill -INT 43392`, then `start-backend.sh`; check `/api/hub` returns 200).
   - Mark #537's inventory row merged.
   - Update PROJECT_HANDOFF, README, `01-gigs-payments.md` and memory; commit and push the coordination branch.
   - Tell the peers the merge time and new master.
3. **Keep integrating** peer PRs as they come. Stream 2's next is 2b, the native Add guest "What they can see" sections; it needs heavy and the iOS driver and will ask. Its PR will be **stacked on #535**, so batch it with #535 or after #535 merges.
4. **Remaining Stream 1 inventory** (all low; handoff §3.3): web `/app/offers` swallowed failure (OPEN, orphan page), `/app/discover-hub` orphan, Tasks map remote tasks at 0,0, Discover no-location double notice, gigs-v2 stale change-orders after instant accept, the helper dock saying "Bidding closed", $0-task payment copy in the delivery sheet, Android upload-error copy, iOS Support Trains without location, and iOS Report post (not run).
   - The two Android navigation items (Nearby door restoring the Tasks stack, re-tapping the lit tab) are navigation changes, so propose them to the user first.
   - Rebuild the apps from current master before any native check. The installed iOS app on F4DBD47E is the #537 build, and the Android APK on emulator-5558 predates #532.
5. **Optional proposal to the user** (money/policy, so ask first): a started task, even a free one, can't be cancelled (`STARTED_POLICY_REVIEW`), and the dialog mentions fees on $0 tasks. Propose a no-fee cancel for $0 started tasks, or $0-aware copy.

## 6. Already done: do NOT redo
- **Merged batches 25–31** (#499, #513, #517, #525, #526, #531, #534), including user decisions 1A–6A and decision A (#533).
- **Sealed and cleaned audits:**
  - free-task lifecycle (`1855635d`);
  - tip copy (`9bb90479`);
  - accept-counter (`45e240d9`);
  - #537 iOS qa-live (`0cde42d1`), verified before and after, with its fixture removed.
- **Inventory rows that say plain "FIXED"** and cite #425, #432, #433, #437, #438, #439, #447, #448, #454 or #456 are merged; the header note was checked 22:05:29Z.
- **The runtime is already at master** (tree `f885e0623`, 92 migrations).

## 7. Preserve
- `/private/tmp/pantopus-stream1-web-trade` holds an **uncommitted** TradeModal failure-state change. It's moot while trades are hidden: no listing response carries `open_to_trades`. Leave it as is.
- The stale worktree entries (12 missing folders) stay.
- Other streams' runtimes, ports and devices. Stream 3's private runtime is 18130/18131/18134, and Stream 2's emulator-5556 is in slot 2.
- The founder's live environment (see hard limits).
- The unrelated old stash entry in the coordination checkout.

## 8. Report
After each milestone:
- update the three hub docs and memory;
- push the coordination branch;
- message the user with a concise status (what merged, what's open, what's unverified);
- message both peers.

Continue until your domain's end-to-end inventory and the integration queue are actually complete, not merely until a build goes green.
