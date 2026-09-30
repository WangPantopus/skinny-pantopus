# Resume prompt for the next Stream 4 session — Place, records, money and mail (split from the former Stream 2)

Written 2026-09-30T04:16:32Z. You are **Stream 4**, one of the user's parallel workstreams. On 2026-09-30 the user split the former **Stream 2** (Home and household) into **Stream 3 — Home access, residency and security** and **Stream 4 — Place, records, money and mail**. The former Stream 3 is now Stream 5. Every fact here is a snapshot: verify the live state (branch, worktree, remote PRs, runtime, leases) before relying on it.

## 1. Read first
1. [04-place-records-money-mail.md](04-place-records-money-mail.md) in this checkout: the CURRENT RESUME, the checklist (your rows, verbatim at the split), the open work, the decisions, the runtime and the live block.
2. The hub [README.md](README.md): the renumbering notice and the 2026-09-27 LAUNCH SCOPE block at the top.
3. `AGENTS.md` and `docs/PROJECT_HANDOFF.md`: the verification-first rules.
4. History up to the split: [former-stream2-home-household.md](former-stream2-home-household.md). "Stream 2" / "S2" there means the stream before the split. Read it for evidence, but record nothing new there.
5. The private kit README: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/README.md`. The path keeps `stream2`. Never print `runtime/accounts.env`.

## 2. State at the split
- Master `8e44382ce`. Every former Stream 2 PR is merged; none is open.
- Docker Desktop has been down since ~03:30Z (disk full), so the shared runtime is unreachable until the user restarts it. Restarting it is the user's call; the founder's stack runs on it.
- No runtime lease, device slot, heavy slot or iOS driver is held.
- First item: the open F02 fixture: finish the iOS part and clean it up exactly (see the file) as soon as Docker is back and you hold the runtime lease.

## 3. Rules in force
- Own only `docs/workstreams/04-place-records-money-mail.md` in this checkout. Fetch and fast-forward before editing, then commit and push only your own changes. Publish to master through docs-only PRs (as #843 did), and never commit peers' uncommitted edits.
- Branches `claude/stream4-<topic>` from current master; audit bundles `YYYYMMDD-stream4-<topic>-rN`; lease label `stream4:` for the runtime lease (`tools/runtime-lease.sh`), device slots, heavy and announcements.
- The other stream of the pair shares the runtime, the kit, emulator-5556 and sim 6F914A30. Hold the runtime lease for any fixture, fault rule, backend restart, source-worktree branch switch, whole-DB baseline or device run, and release it promptly.
- Launch scope: never verify, test or fix the eight cut features.
- No competing tracker or merge queue. The Stream 1 queue owner (the coordinator) batches PRs; hand each PR over with its head SHA and seal.
- Never touch the founder's environment (64521/64522, backend 8000, simulator EB5AD759) or the physical iPhone. No destructive git or database commands, and no fixture deletion outside exact ownership. Keep secrets out of Git and chat.
- Record every time from `date -u` and every SHA from `git rev-parse`; never estimate.

## 4. Next
Work the open list in your file in order. For each item: reproduce first, make the smallest repair (or record a verification with no code change), clean up exactly, seal, open a PR, hand it to the coordinator, and add an entry at the top of your live block. Decisions and hosted boundaries wait for the user; don't turn them into passes.
