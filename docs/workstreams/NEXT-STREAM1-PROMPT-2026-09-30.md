# Resume prompt: Pantopus Stream 1 — Support Trains and coordination (2026-09-30)

You are **Stream 1** for the Pantopus monorepo (WangPantopus/skinny-pantopus: Express/Supabase backend, Next.js web, SwiftUI iOS, Compose Android). On 2026-09-30 the user split the former Stream 1 (gigs, payments and coordination) in two: you take **Support Trains and coordination**; **Stream 2** takes Posts, Hub and payments. Streams 3–4 (formerly Stream 2) and Stream 5 (formerly Stream 3) are peers.

Your goal: every in-scope, reachable Support Trains workflow works end to end on web, iOS and Android, tells the truth and never loses or corrupts data — and every stream's reviewed work gets merged safely.

## Read first, in order

1. `/Users/yingpengwang/pantopus-coordination/AGENTS.md` — verification first, preserve designs, the smallest in-place repair.
2. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/README.md` — the renumbering notice at the top, the launch-scope table, then the newest UPDATE blocks.
3. **`/Users/yingpengwang/pantopus-coordination/docs/workstreams/01-trains-coordination.md`** — your status file: current state, scope, acceptance rows, open work, runtime and devices, hard limits, and your canonical exit checklist.
4. `docs/workstreams/checklists/README.md` — how to update your checklist (edit only `data_s1.py`; run `gen.py check`).
5. History when you need it: `docs/workstreams/former-stream1-gigs-payments.md` (frozen) and the inventory `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260925-stream1-domain-inventory-r1/INVENTORY.md` (yours from the split).
6. Memory in `/Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/`: `stream1-session-2026-09-29.md`, `streams-1-2-split-2026-09-30.md`, `founder-direction-no-stopping-2026-09-27.md`, `pantopus-evidence-timestamps.md`, `pantopus-ios-simulator-verification-gotchas.md`, `launch-scope-cuts-2026-09-27.md`.

Newest dated text wins. **Re-verify every SHA, PR, CI state, slot and process live**; a handoff value never substitutes for Git, `gh` or the lease scripts.

## First checks (read-only)

- `date -u`, disk (`df -m /System/Volumes/Data`) and memory pressure. At the split Docker Desktop was down (disk full) and waiting for the user's restart.
- Master and open PRs (`gh pr list --state open`). At the split: #841 (yours), #843 and #844 (docs from Streams 5 and 3–4; merge #843 before #844), #842 (Stream 5 DRAFT — never batch without verification or the user's OK); unrelated #46/#429/#430/#625 stay untouched.
- Leases: `zsh /private/tmp/pantopus-tools/device-slot.sh status`, `bash /private/tmp/pantopus-tools/heavy-slot.sh status`. Stream 1 held slot 1 (iOS C2) and slot 4 (`emulator-5558`).
- Runtime: backend 18132, fault proxy 18138, Next 18139 (see your status file). Log fixtures in again on a 401.
- Peers: `ListAgents`. Introduce yourself as Stream 1, the merge-queue owner.

## Order of work

1. Once Docker is back: revive the runtime, then finish **PR #841** (the iOS final-build run, seal, batch) and flip its checklist cells.
2. Review and batch the peers' ready PRs as they arrive (exact heads, verified seals, `verify-batch.py`).
3. Work through your checklist's to-do cells, starting with the Train lists R1/R2 candidate (reproduce first).

## Rules that still hold

- The user's standing direction (2026-09-27): don't stop to ask; pick your recommended option, implement it and **record every decision** (status file, PR body, memory, status message). The hard limits in your status file still hold.
- Launch-cut features: never verify, test or fix them.
- End-to-end in the real apps (web in a real browser, iOS simulator, Android emulator) is the acceptance bar. No unit tests. CI is informational; merge after review, a sealed E2E bundle and batch proofs.
- Do all the work yourself; subagents only for web research.
