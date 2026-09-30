# Resume prompt for the next Stream 4 session — Place, records, money and mail (split from the former Stream 2)

Written 2026-09-30T04:16:32Z. You are **Stream 4**, one of the user's parallel workstreams. On 2026-09-30 the user split the former **Stream 2** (Home and household) into **Stream 3 — Home access, residency and security** and **Stream 4 — Place, records, money and mail**. The former Stream 3 is now Stream 5. Every fact here is a snapshot: verify the live state (branch, worktree, remote PRs, runtime, leases) before relying on it.

## 1. Read first
Every relative path here is in the shared coordination checkout `/Users/yingpengwang/pantopus-coordination` (branch `codex/workstream-coordination`), and "this checkout" means it. Master's copies are older snapshots, and your own session worktree is only for code.
1. [04-place-records-money-mail.md](04-place-records-money-mail.md) in this checkout: the CURRENT RESUME, the checklist (your rows, verbatim at the split), the open work, the decisions, the runtime and the live block.
2. The hub [README.md](README.md): the renumbering notice and the 2026-09-27 LAUNCH SCOPE block at the top.
3. `AGENTS.md` and `docs/PROJECT_HANDOFF.md`: the verification-first rules.
4. History up to the split: [former-stream2-home-household.md](former-stream2-home-household.md). "Stream 2" / "S2" there means the stream before the split. Read it for evidence, but record nothing new there.
5. The private kit README: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/README.md`. The path keeps `stream2`. Never print `runtime/accounts.env`.

## 2. State at the split
- Master `ed5ea9ec5` (refreshed 2026-09-30T04:40:59Z). Every former Stream 2 PR is merged, including the split's docs PRs #843 and #844 (merged 2026-09-30T04:24:12Z) and the U-row docs PR #848 (batch 137, #849, merged 04:40:14Z). Stream 1's own split (#846) is merged too. **Streams 3 and 4 have no open PRs**; check `gh pr list --state open` for anything newer.
- **Added 2026-09-30T04:36:26Z:** your screens' cells of U02–U05 are yours (U01 went to Stream 3). They sat in the former Stream 1's inventory, so the first split proof missed them. See your file's "Cross-cutting rows" section and open work item 8. `check-stream2-split.py` proves the assignment.
- **Docker was reset, and the shared runtime is gone (checked 2026-09-30T05:56:47Z).** Docker Desktop is back, but its disk image was re-created at 2026-09-30T05:51:48Z and holds no containers or volumes:
  - the runtime's database (Kong 64553, DB 64554) is gone, with every fixture and fixture account in it (Home105, Home70, the cohort Home 9d885f71 and its 9 neighbors, and the SQL Homes), and your open F02 fixture;
  - host processes from before the reset still run and point at the deleted database: proxy 18142 (PID 30261), backend 18143 (PID 2550) and web 18144 (PID 66349);
  - the founder's stack (64521/64522, backend 8000) is gone too. That's the user's to handle, never yours;
  - **native tooling is gone too** (checked 2026-09-30T05:58:25Z): the Android SDK (adb, emulator, system images), every AVD including emulator-5556's `Pantopus_Home_Recurrence_Acceptance`, and `~/.gradle`. Xcode is installed but has no iOS simulator runtime, so sim 6F914A30 is listed but can't boot. Reinstalling them is a large download and needs the user's OK. The new Stream 2 has asked Stream 1 to do one machine-wide reinstall, so check the hub first and don't start your own download. Until then only web and API work can run;
  - the disk has 187 GiB free.
- No runtime lease, device slot, heavy slot or iOS driver is held.
- **First, under the runtime lease:** whichever of Streams 3 and 4 takes it first rebuilds the shared runtime from current master, then tells the other stream.
  - The kit README only restarts existing containers. Create the stack with `supabase start --workdir <dir>` from master's `supabase/` config and migrations (the recipe is in the `pantopus-disposable-full-schema-project` memory). Reuse project id `pantopus-stream2-native-resume-r2` and ports 64553 (API), 64554 (DB) and 64558 (Inbucket), so the kit's tools keep working. Keep the stack's other ports inside 64550–64559; Stream 1 uses 64561/64562, the new Stream 2 64580–64589 (plus 18160/18168/18169), and Stream 5 64531–64539 (plus 18130, 18131, 18134, 18197 and 18198).
  - Write the new keys to `runtime/supabase.env` (mode 600). Recreate the fixture accounts from `runtime/accounts.env` without printing it. Restart the backend and proxy by exact PID, and log it in `runtime/backend-restarts.log`.
  - Take a fresh whole-DB baseline; old baselines and table counts don't carry over. Recreate only the fixtures a journey needs, from the bundle that first made them.
- Then your first item: F02's iOS part on a recreated cohort (see the file), once the native tooling is back. The open F02 fixture went with the database, so there's nothing left to clean. Until the user has the native tooling reinstalled, work the web and API parts of your open list in order (for example the web readers in I07, D09 and D01). Keep native steps queued and name them as blocked.

## 3. Rules in force
- Own only `docs/workstreams/04-place-records-money-mail.md` in this checkout. Every stream shares this checkout: fetch and fast-forward before editing, commit only your own paths with `git commit --only <paths>` (a plain commit would sweep in a peer's staged change), and check `git show --stat` before pushing. Publish to master through docs-only PRs (as #843 did), and never commit peers' uncommitted edits.
- Branches `claude/stream4-<topic>` from current master; audit bundles `YYYYMMDD-stream4-<topic>-rN`; lease label `stream4:` for the runtime lease (`tools/runtime-lease.sh`), device slots, heavy and announcements.
- The other stream of the pair shares the runtime, the kit, emulator-5556 and sim 6F914A30. Hold the runtime lease for any fixture, fault rule, backend restart, source-worktree branch switch, whole-DB baseline or device run, and release it promptly.
- The `stream2:` label and `claude/stream2-…` branches now belong to the new **Stream 2 — Posts, Hub and payments** (`02-posts-hub-payments.md`); never use them. The merge-queue owner for all five streams is **Stream 1 — Support Trains and coordination** (`01-trains-coordination.md`).
- Write code in your own session worktree, on a branch from current master. The shared worktree `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream2-mail-journey-18b50a` serves the runtime's web: check your pushed branch out there, or edit it, only while holding the runtime lease, and keep its uncommitted `.claude/launch.json`.
- Launch scope: never verify, test or fix the eight cut features.
- No competing tracker or merge queue. The Stream 1 queue owner (the coordinator) batches PRs; hand each PR over with its head SHA and seal.
- Never touch the founder's environment (64521/64522, backend 8000, simulator EB5AD759) or the physical iPhone. No destructive git or database commands, and no fixture deletion outside exact ownership. Keep secrets out of Git and chat.
- Record every time from `date -u` and every SHA from `git rev-parse`; never estimate.

## 4. Next
Work the open list in your file in order. For each item: reproduce first, make the smallest repair (or record a verification with no code change), clean up exactly, seal, open a PR, hand it to the coordinator, and add an entry at the top of your live block. Decisions and hosted boundaries wait for the user; don't turn them into passes.
