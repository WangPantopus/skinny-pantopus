# Resume prompt for the next Stream 3 session — Home access, residency and security (split from the former Stream 2)

Written 2026-09-30T04:16:32Z. You are **Stream 3**, one of the user's parallel workstreams. On 2026-09-30 the user split the former **Stream 2** (Home and household) into **Stream 3 — Home access, residency and security** and **Stream 4 — Place, records, money and mail**. The former Stream 3 is now Stream 5. Every fact here is a snapshot: verify the live state (branch, worktree, remote PRs, runtime, leases) before relying on it.

## 1. Read first
1. [03-home-access-residency.md](03-home-access-residency.md) in this checkout: the CURRENT RESUME, the checklist (your rows, verbatim at the split), the open work, the decisions, the runtime and the live block.
2. The hub [README.md](README.md): the renumbering notice and the 2026-09-27 LAUNCH SCOPE block at the top.
3. `AGENTS.md` and `docs/PROJECT_HANDOFF.md`: the verification-first rules.
4. History up to the split: [former-stream2-home-household.md](former-stream2-home-household.md). "Stream 2" / "S2" there means the stream before the split. Read it for evidence, but record nothing new there.
5. The private kit README: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/README.md`. The path keeps `stream2`. Never print `runtime/accounts.env`.

## 2. State at the split
- Master `ed5ea9ec5` (refreshed 2026-09-30T04:40:59Z). Every former Stream 2 PR is merged, including the split's docs PRs #843 and #844 (merged 2026-09-30T04:24:12Z) and the U-row docs PR #848 (batch 137, #849, merged 04:40:14Z). Stream 1's own split (#846) is merged too. **Streams 3 and 4 have no open PRs**; check `gh pr list --state open` for anything newer.
- **Added 2026-09-30T04:36:26Z:** U01 (Home and unit identity on finished screens) is yours alone, and so are your screens' cells of U02–U05. They sat in the former Stream 1's inventory, so the first split proof missed them. See your file's "Cross-cutting rows" section and open work item 8 (U01) and item 9. `check-stream2-split.py` proves the assignment.
- The user's own open PR #430 (geo autocomplete center as `[lng, lat]`) is not a stream PR. Its Home-editor part was repaired by #626 (the 2026-09-27 coordinate milestone), and the coordinator leaves #430 untouched; closing it is the user's call.
- Docker Desktop has been down since ~03:30Z (disk full), so the shared runtime is unreachable until the user restarts it. Restarting it is the user's call; the founder's stack runs on it.
- No runtime lease, device slot, heavy slot or iOS driver is held.
- First item: the R06 iOS restart check (see the file), after Docker is back and you hold the runtime lease.

## 3. Rules in force
- Own only `docs/workstreams/03-home-access-residency.md` in this checkout. Every stream shares this checkout: fetch and fast-forward before editing, commit only your own paths with `git commit --only <paths>` (a plain commit would sweep in a peer's staged change), and check `git show --stat` before pushing. Publish to master through docs-only PRs (as #843 did), and never commit peers' uncommitted edits.
- Branches `claude/stream3-home-<topic>` from current master; audit bundles `YYYYMMDD-stream3-home-<topic>-rN`; lease label `stream3-home:` for the runtime lease (`tools/runtime-lease.sh`), device slots, heavy and announcements.
- The other stream of the pair shares the runtime, the kit, emulator-5556 and sim 6F914A30. Hold the runtime lease for any fixture, fault rule, backend restart, source-worktree branch switch, whole-DB baseline or device run, and release it promptly.
- The `stream2:` label and `claude/stream2-…` branches now belong to the new **Stream 2 — Posts, Hub and payments** (`02-posts-hub-payments.md`); never use them. The merge-queue owner for all five streams is **Stream 1 — Support Trains and coordination** (`01-trains-coordination.md`).
- Write code in your own session worktree, on a branch from current master. The shared worktree `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream2-mail-journey-18b50a` serves the runtime's web: check your pushed branch out there, or edit it, only while holding the runtime lease, and keep its uncommitted `.claude/launch.json`.
- Launch scope: never verify, test or fix the eight cut features.
- No competing tracker or merge queue. The Stream 1 queue owner (the coordinator) batches PRs; hand each PR over with its head SHA and seal.
- Never touch the founder's environment (64521/64522, backend 8000, simulator EB5AD759) or the physical iPhone. No destructive git or database commands, and no fixture deletion outside exact ownership. Keep secrets out of Git and chat.
- Record every time from `date -u` and every SHA from `git rev-parse`; never estimate.

## 4. Next
Work the open list in your file in order. For each item: reproduce first, make the smallest repair (or record a verification with no code change), clean up exactly, seal, open a PR, hand it to the coordinator, and add an entry at the top of your live block. Decisions and hosted boundaries wait for the user; don't turn them into passes.
