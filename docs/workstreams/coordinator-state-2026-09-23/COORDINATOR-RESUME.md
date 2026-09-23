# Coordinator resume point: September 23, 2026, 19:50 UTC (session `92cc4526`)

Read this first after an interruption. The per-stream detail is in the stream checkpoint files, listed under "Where things are". The decisions, founder questions and data actions are in `../README.md`, in the resume blocks at 15:00, 17:00 and 19:30.

## Git and merge state
- **master** is `9779bf9d3`, after batch 2.
- **Merged today:**
  - 93 PRs one at a time;
  - batch 1, #353 (36 PRs), at 16:51 as `f02dd4bd1`;
  - batch 2, #374 (34 PRs plus #385, the CI ECR fallback), at 19:22 as `9779bf9d3`.
- **In flight: batch 3, #387.**
  - Branch `claude/coord-merge-batch-3`, tip `91e0cc172`. CI run 35909254243 was queued at 19:49.
  - It holds 20 PRs: 257 339 346 349 350 365 371 372 373 375 376 377 378 379 380 381 382 383 384 386. The list is in `scratchpad/batch3.txt`.
  - The merge runner holds `queue.txt` = `387` and merges when CI OK passes.
- **Batch 4 candidates** (reviewed; CI green, or failing only the ghcr-affected database job):

  | PR | Head | State |
  |---|---|---|
  | #356 | `4713fbf1c` | master merged in |
  | #388 | `9acfcebf8` | ready |
  | #389 | `f1ed18fc1` | ready |
  | #325 | `cce809b57` | master merged in; Stream 2's iOS re-check still pending |

- **Not ours:** #46 `place-design` belongs to the founder. Leave it.

## How to restart
1. **Tools.** If `/private/tmp/pantopus-tools` is gone after a reboot, recreate it from `tools/`:
   ```
   mkdir -p /private/tmp/pantopus-tools/merge-queue
   cp -p tools/*.sh tools/*.py tools/*.md tools/ci-watch.* /private/tmp/pantopus-tools/
   cp -p tools/merge-queue/* /private/tmp/pantopus-tools/merge-queue/
   ```
2. **Merge runner.** `nohup /bin/zsh /private/tmp/pantopus-tools/merge-queue/run.sh >> …/run.out 2>&1 &`
   - It merges the first PR in `queue.txt` once CI OK passes on the exact head.
   - It keeps a failed PR queued and logs it once.
   - The deadline is 4 hours.
3. **Watcher.** Start `/private/tmp/pantopus-tools/coord-watch2.sh` as a Monitor.
   - It's REST-only and reports CI OK for every open `claude/*` PR, queue events, and DISK LOW below 12 GiB.
4. **Next batch.** When #387 merges, build batch 4 with the scripts in `scratchpad/`:
   1. `check-candidates2.sh <prs>` marks a PR ready when CI OK passed, or when the only failure is the database replay job.
   2. Fetch `+refs/pull/N/head:refs/remotes/pr/N`.
   3. `build-batch.sh origin/master <out> <prs…>` builds the chain with `git merge-tree` and `commit-tree`, with no checkout.
   4. Check duplicate definitions, then run `lint-batch.sh <tip> <multi-files>`.
   5. Push `claude/coord-merge-batch-N`, open the PR, and put its number in `queue.txt`.
   6. Retarget stacked PRs to base master first.
   7. In zsh, pass lists as `${=L}`.
5. **Agents.** If this session is still alive, resume each background agent with SendMessage using its id (below); its context is intact. If not, spawn a new agent per stream with `tools/AGENT-RULES-2026-09-23.md` and its checkpoint file.

## Background agents (session 92cc4526)
| Agent id | Stream | Area | Checkpoint file |
|---|---|---|---|
| acb0d4c85e4960561 | Stream 1 | tasks, payments, marketplace | `stream1-2026-09-23.md` |
| a9e97b30d02232f83 | Stream 2 | Home, mail | `stream2-2026-09-23.md` |
| a629ea105558c0e0f | Stream 3 | accounts, identity, chat, businesses, scheduling | `stream3-2026-09-23.md` |
| acd48b3e1807a80a8 | Shared UX | C-items, cross-cutting UX | `shared-ux-2026-09-23.md` |

The checkpoint files are in `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/checkpoints/`, a durable, gitignored store, and are copied into `checkpoints/` next to this file. Agents push unfinished code to `wip/<stream>/<topic>` branches, which have no PR and trigger no CI.

## Operating state to know
- **Git auto-maintenance is PAUSED** on the shared repo (`maintenance.auto=false`, `gc.auto=0` in `/Users/yingpengwang/skinny-pantopus/.git/config`). A repack loop filled the disk.
  - To revert: when the disk has 40 GiB or more free and agents are idle, run one `git maintenance run --task=gc`, then unset both settings.
  - Until then, don't run gc, maintenance or repack.
- **Slot back-pressure.** `heavy-slot.sh` and `device-slot.sh` wait while the kernel memory-pressure level is critical, or warning with load above 150.
  - Rules: one heavy build at a time; `gradlew --stop` only before releasing the slot; reuse your derived data.
- **CI.** A GitHub incident has been ongoing since 10:11 UTC, and ghcr.io refuses the Supabase image. #385's ECR fallback handles new runs, but re-runs of older runs still fail. PRs that failed only the database job are batch-ready.
- **Founder environment: never touch it.** That's the `pantopus-home-gig-replay` stack (64521/64522), backend `:8000`, and simulator EB5AD759.
- **Search-filter security audit:** do NOT resume it. #255's plain escaping is the whole fix.

## Where things are
- **Decisions and founder lists:** the hub README blocks at 15:00, 17:00 and 19:30. They cover decisions, FOUNDER QUESTIONS, FOUNDER DATA ACTIONS (count queries) and incidents.
- **Plans and inventories** are in `tools/`:
  - `trust-claims-2026-09-23.md`: about 55 unbacked "verified" claims and who owns each;
  - `ux-inventory-2026-09-23.md`: 155 items;
  - `AGENT-RULES-2026-09-23.md`: the rules, with updates through 19:48.
- **Evidence bundles** are in the worktree store `…/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`. Tell the founder to copy them to `skinny-pantopus/.pantopus-recovery/audits/` before that worktree is removed.
- **Memory:**
  - `~/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/` — `coordinator-handoff-2026-09-23.md`;
  - `pantopus-ci-capacity-merge-batches.md`;
  - `pantopus-disk-git-maintenance-loop.md`;
  - `founder-direction-ux-e2e-2026-09-23.md`.

## Open founder items (short list; details in the README)
- **Marketing copy.** "Every helper is identity-verified", "no anonymous tier": enforce these, or change the copy.
- **Data counts, then repairs:**
  - spoofed verified_business mail;
  - misfiled household letters;
  - fake default business stats;
  - bogus `business-<userId>` booking pages;
  - listings still active with an accepted offer.
- **Product questions:**
  - package pickups as real tasks;
  - real mail translation;
  - no-pay favours;
  - a real "Verified sellers" filter;
  - saved-search alerts;
  - trusted neighbors;
  - which Home privacy controls to build;
  - chat LocalProfile identity;
  - mail routing semantics;
  - the A17 mail variant layouts;
  - the native booking landing;
  - price-change settlement;
  - backing out of an accepted offer or trade.
- **Mac:** restart the leaking macOS ControlCenter (about 11 GB).
