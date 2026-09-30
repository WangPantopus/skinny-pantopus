# Resume prompt for the next Stream 4 session — Place, records, money and mail

Handoff written 2026-09-30T22:22:42Z by the previous Stream 4 session. It supersedes this file's 04:16Z and 07:52Z versions (both in git history).

## 0. Who you are
- You are **Stream 4**, one of the user's five parallel workstreams (renumbered 2026-09-30). Name the session **"Stream 4: Place, records, money and mail"**.
- **Directions in force:**
  1. **Verification first** (`AGENTS.md`, the user's September 13 direction): reproduce, then make the smallest repair to the existing implementation. Keep existing designs.
  2. **Founder direction** (2026-09-27, restated 2026-09-30): never stop to ask or wait. Decide for the best UX, safety, security and user retention, and record every decision in the 04 file, the PR, memory and the status message. The safety limits below still hold.
  3. **You do all real work yourself.** Subagents may only search and gather; you verify and fix.
  4. **Launch scope:** never verify, test or fix the eight cut features. For this stream's area that means cut #7, Household extras, and cut #8, Mail extras: household letters and My Mail Day, certified mail and e-signing, Mail Party, the community stream, event invites and translations. Stamps and the mailbox map serve only those.

## 1. Read first
Relative paths are in the shared coordination checkout `/Users/yingpengwang/pantopus-coordination` (branch `codex/workstream-coordination`).
1. [04-place-records-money-mail.md](04-place-records-money-mail.md):
   - the **CURRENT RESUME** at the top (handoff 22:19Z: state, next list, lessons, decisions);
   - the U02–U04 exit checklists;
   - the runtime section;
   - the live block, newest first.
2. The hub [README.md](README.md) (renumbering notice; LAUNCH SCOPE block), plus `AGENTS.md` and `docs/PROJECT_HANDOFF.md` in any repo checkout.
3. The kit README: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/README.md`. The path keeps `stream2`. **Never print `runtime/accounts.env`.**
4. Today's sealed evidence, for context; each has a README:
   - `20260930-stream4-fixes-r1`;
   - `20260930-stream4-verify-actions-r2`;
   - `20260930-stream4-u02-native-r1`.

   They're in the audit store `…/.pantopus-recovery/audits/`.

## 2. State at handoff (2026-09-30T22:21Z)
- **Master `a211e1f48`. Stream 4 has no open PRs.**
  - Today's last ten (#1102–#1111) merged in batch 223 (#1112): Your home trend, Place verify controls, uploader name, maintenance empty tabs, fridge remove-row, Android avatar, Android large text, the Warranties chip AA fix, the Civic promise, and the alerts false all-clear.
  - The merge-queue owner is now the **next Stream 1 session** (prompt `NEXT-STREAM1-PROMPT-2026-09-30-evening.md`; batches continue at 224).
- **Runtime:** free.
  - The backend is at rest on `00bf2d6ff` (pid 45803), with no patches and no ATTOM key. The proxy has no rules. The shared web worktree shows only its kept `.claude/launch.json`.
  - **No Stream 4 fixture exists.** Every one was cleaned exactly and recorded.
- **Devices:** the S34 pair (iOS "Pantopus S34" `DA8C2A5F-39BC-421D-9F18-EB4B481E506F`; Android AVD `pantopus_s34` on emulator-5562), shared with Stream 3.
  - Both are shut down, with build `a93b3e462` installed. The emulator snapshot restores on boot, so reinstall the APK you need.
  - Boot and sign-in recipes are in the CURRENT RESUME.
- **Builds: none kept.** The previous session deleted its builds, iOS DerivedData, extra worktrees and redundant stage copies to free the Mac (2026-09-30T22:45:11Z).
  Build fresh from current master in your own worktree, through the heavy slot. The first build is cold. The template is `builds/build-fixes-10.sh` in bundle `20260930-stream4-fixes-r1`; point its `WT` and `-derivedDataPath` at yours.

## 3. Rules in force
- **Coordination checkout:**
  - Own only `04-place-records-money-mail.md` and this file.
  - Fetch and `git merge --ff-only` before editing. Commit only your path with `git commit --only <path>`, then push.
  - On a push race, fetch and push again. Never sweep in peers' changes.
- **Names:** branches `claude/stream4-<topic>` from current master; audit bundles `YYYYMMDD-stream4-<topic>-rN`; the label `stream4:` for the runtime lease (`zsh tools/runtime-lease.sh acquire|release|status`), device slots (`/private/tmp/pantopus-tools/device-slot.sh`), the heavy slot (`/private/tmp/pantopus-tools/heavy-slot.sh`) and announcements.
- **Runtime lease** (shared with Stream 3): hold it for any fixture, fault rule, backend restart, shared-worktree change, whole-DB baseline or device run. A baseline is valid only inside the lease it was taken in. Release promptly, and message Stream 3 when you do.
  - Backend restart: `kill -INT <pid>`, then `python3 tools/detach.py runtime/backend.log runtime/start-backend.sh`, then append a JSON line to `runtime/backend-restarts.log`.
  - Patch the shared worktree with `git -C <SW> apply` using absolute paths, and revert with `apply -R`.
- **Code** goes in your own session worktree. The shared worktree `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream2-mail-journey-18b50a` serves the runtime's web; change it only under the lease, and keep its `.claude/launch.json`.
- **Evidence:**
  - Record every time from `date -u` and every SHA from `git rev-parse`; never estimate.
  - `tools/s4-secret-scan.py` must pass before `tools/seal-bundle.py`. Sealed bundles are never edited; correct claims in the 04 file.
  - Screenshots mask the account label. No raster on login screens or the Save Password sheet.
  - Native credential typing goes only through the kit's secret ops, after a focus check. Test values only on the local runtime.
- **Never:**
  - the physical iPhone;
  - the founder's environment (`pantopus-home-gig-replay` 64521/64522, backend :8000, simulator EB5AD759);
  - production providers, real user or payment data;
  - credentials, tokens, raw logs or DB archives in Git or chat;
  - destructive git (reset, stash, clean, gc, worktree removal);
  - fixture deletion outside exact ownership.

## 4. Next
Work the CURRENT RESUME's "Next, in order" (item 1 is done):
2. Two Document detail candidates (C: an image that fails to decode; D: a document with no file). Reproduce first.
3. iOS dark tint re-measure after Stream 1's #1061 merges.
4. Web A3 live re-measure.
5. The native Pulse hero's honest state with nothing known.
6. U03 native ⬜ cells.
7. U04 native cells (drivers drafted: `tools/s4-u04-{android,ios}.sh`).
8. Older open work (F02 native re-run, I04, I05, D04, D09, D01 E5).
9. Hosted and provider boundaries stay named.

## 5. Per-item workflow (the user's)
1. Reproduce first (real app, real caller, API and persistence).
2. Make the smallest repair.
3. Do the exact cleanup.
4. Seal the evidence bundle.
5. Open a PR (body: problem, fix, evidence with the seal and MANIFEST, checks; end with the Claude Code line).
6. Hand the head and seal to the Stream 1 queue owner.
7. Add a live entry to the 04 file.

Record each decision you make under the standing instruction in the 04 file, the PR and memory.
