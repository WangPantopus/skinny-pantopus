# Coordinator resume point: PAUSED at September 23, 2026, 20:35 UTC (session `92cc4526`)

Work is paused at the founder's request. Every agent stopped at a clean point, pushed all its code to origin and wrote a checkpoint. No builds, devices or dev servers are running. Read this file first, then the stream checkpoints in `checkpoints/`.

The decisions, founder questions and data actions are in `../README.md`, in the resume blocks at 15:00, 17:00 and 19:30.

## Git and merge state (checked 20:32 UTC)
- **master** is `1a15514cc`.
- **Merged today:**

  | What | Contents | When | Merge commit |
  |---|---|---|---|
  | One-at-a-time merges | 93 PRs | through the day | — |
  | Batch 1, #353 | 36 PRs | 16:51 | `f02dd4bd1` |
  | Batch 2, #374 | 34 PRs plus #385 (the CI ECR fallback) | 19:22 | `9779bf9d3` |
  | Batch 3, #387 | 20 PRs | 20:07 | `1a15514cc` |

  Batch 3's CI was fully green, and its database job passed through the fallback.
- **Merge runner:** stopped, because its queue is empty. `queue.txt` is empty.
- **Watcher:** expired. Nothing polls during the pause.

### Batch 4 candidates (reviewed; heads confirmed)
| PR | Head | State |
|---|---|---|
| #356 | `4713fbf1c` | master merged in; Shared UX's native error copy |
| #388 | `9acfcebf8` | Stream 2's native mail-detail trust fixes |
| #389 | `f1ed18fc1` | Stream 1: API routes stop echoing raw DB errors |
| #325 | `cce809b57` | master merged in; **Stream 2's iOS re-check still to do** before it's included |

Before building, run `scratchpad/check-candidates2.sh` on these. A PR is ready if its CI OK passed, or if it failed only the database job; heads that changed since review get flagged. #46 `place-design` is the founder's; leave it.

## Unpublished work (pushed to origin; no PR yet)
- **Stream 1**
  - `claude/stream1-listing-pending-pickup` `7c64c682b8`. PR 1, stacked on #365, which is now merged: the listing is held on accept, plus S1-05 for sold listings.
  - `claude/stream1-native-package-gig-hidden` `024980c8b2`. PR 2.
  - `claude/stream1-native-listing-offers-actions` `9c3c15c78f`. PR 3: S1-04 and S1-20, plus the fix for iOS counters that never sent. **S1-17 (fixed NYC coordinates) is still to add.**
  - Five web branches for S1-03/10/11/12/14/15/16/18/23/24: `claude/stream1-web-map-new-listing`, `-web-tasks-browse`, `-web-gig-detail`, `-web-gigs-v2-chat`, `-web-listing-detail`. They're code only and need one Next session to verify.
  - Backups: `wip/stream1/verify-18`, `wip/stream1/harness-r21`, `wip/stream1/acctdel-next-tsconfig`.
- **Stream 2**
  - `wip/stream2/home-trust-claims` `759be809c`: the Home group plus S2-14.
  - `wip/stream2/native-place-home` `0623d89d0`: S2-21, S2-15 and native S2-05.
  - `wip/stream2/vacation-hold-dates` `65bc96a97`: old and probably superseded by #325.
- **Stream 3**
  - `claude/stream3-native-business-geo-decode` `a9f8be769`: **BLOCKING.** Native business profiles fail for any business with a location. iOS is verified. The Android build and after-capture are still to do.
  - `claude/stream3-native-scheduling-you-owner` `e7d72161a`: scheduling/You, stacked on #383 (now merged). Not built yet.
  - `wip/stream3/accounts-social-publicshare-nostore` `3d39029b5`: old uncommitted web work found in a worktree. Review it before using it.
- **Shared UX.** Five groups, rebased on `9779bf9d3`:
  - `claude/shared-ux-native-hub` `90bae96a0`;
  - `claude/shared-ux-support-train-host-actions` `ebaf4ad5e`;
  - `claude/shared-ux-native-posts` `7a7d22139`. The top commit is the Pulse viewing-area WIP. Add `chosenArea: { nil }` to the iOS Pulse test factory first.
  - `claude/shared-ux-native-you-settings` `ffb41619f`;
  - `claude/shared-ux-native-shells` `32f1527eb`.
  - Integration backups: `wip/shared-ux/integration-1..4`.

## Agents (paused) and their first action on resume
| Agent id | Stream | Checkpoint | First action on resume |
|---|---|---|---|
| acb0d4c85e4960561 | Stream 1 (tasks, payments, marketplace) | `stream1-2026-09-23.md` | Restart harness run 27. Capture Android then iOS afters for PRs 1–3 and open them, adding S1-17 to PR 3. Then one web session for the five web branches. |
| a9e97b30d02232f83 | Stream 2 (Home, Mail) | `stream2-2026-09-23.md` | #325 iOS re-check. Then build the Home group and capture afters, then the Place group. |
| a629ea105558c0e0f | Stream 3 (accounts, chat, businesses, scheduling) | `stream3-2026-09-23.md` | Geo fix: restart the API, run `run-geo2.sh` (Android build and APK), capture the after, delete fixture BusinessLocation 980f6eb3, seal and open the PR. Then scheduling/You (merge master; member hub 403; Me Business; You header). |
| acd48b3e1807a80a8 | Shared UX (C-items) | `shared-ux-2026-09-23.md` | Fix the iOS Pulse test factory, then build and capture the five groups on both apps, open grouped PRs, and decode the Android placeholder title. Delete SavedPlace fixture `5f85723f` afterwards. |

- **Where checkpoints live:** in `checkpoints/` next to this file, and in the durable store `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/checkpoints/`, with each stream's helper scripts. Anything under `/private/tmp` (worktrees, derived data, harness env files with secrets) is lost on reboot; each checkpoint says how to regenerate it.
- **Resuming agents:** if session `92cc4526` is still alive, send each agent id a message; its context is intact. Otherwise spawn a new agent per stream with `tools/AGENT-RULES-2026-09-23.md` and its checkpoint file.

## Open coordinator decisions (answer on resume)
1. **Stream 2:** should unboxing and ceremonial-letter "Share" share something? If so, what? If not, hide them with the other dead controls.
2. **Stream 2:** landlord-request notifications open nothing on the apps. Proposed minimum: the tap opens the Home.
3. **Stream 3:** review `wip/stream3/accounts-social-publicshare-nostore` before deciding whether it's needed.

## How to restart the coordinator
1. **Tools.** If `/private/tmp/pantopus-tools` is gone, recreate it from `tools/`:
   ```
   mkdir -p /private/tmp/pantopus-tools/merge-queue
   cp -p tools/*.sh tools/*.py tools/*.md tools/ci-watch.* /private/tmp/pantopus-tools/
   cp -p tools/merge-queue/* /private/tmp/pantopus-tools/merge-queue/
   ```
2. **Watcher.** Start `/private/tmp/pantopus-tools/coord-watch2.sh` as a Monitor. It's REST-only and covers the queue, CI OK for every open `claude/*` PR, and DISK LOW below 12 GiB.
3. **Batch 4.**
   1. Run `check-candidates2.sh` on 325 356 388 389, plus new PRs as they arrive.
   2. Fetch the heads.
   3. `build-batch.sh origin/master <out> <prs>`.
   4. Check duplicates, then `lint-batch.sh`.
   5. Push `claude/coord-merge-batch-4` and open the PR.
   6. Write its number to `queue.txt` and start `merge-queue/run.sh` with nohup.
   7. Retarget stacked PRs to base master first. In zsh, pass lists as `${=L}`.
4. **Load.** Restart agents one or two at a time, so the Mac doesn't thrash again. The slot scripts gate on memory pressure.

## Operating state to know
- **Git auto-maintenance is PAUSED** on the shared repo (`maintenance.auto=false`, `gc.auto=0`).
  - To revert: when the disk has 40 GiB or more free and agents are idle, run one `git -C /Users/yingpengwang/skinny-pantopus maintenance run --task=gc`, then `git config --unset maintenance.auto` and `git config --unset gc.auto`.
  - Disk was 14 GiB free at 20:32 UTC.
- **Slots.** One heavy build at a time. `gradlew --stop` only before releasing the heavy slot. Reuse your derived data. The slot scripts wait while memory pressure is high.
- **CI.** ghcr.io may still refuse the Supabase image; #385's ECR fallback covers new runs.
- **Founder environment: never touch it.** That's `pantopus-home-gig-replay` (64521/64522), backend `:8000`, and simulator EB5AD759.
- **Search-filter security audit:** do NOT resume it.
- **Remaining stacks.** The agents' local database stacks are still running: `pantopus-stream1-wallet-read-r1` (64561/64562, also used by Shared UX), `pantopus-stream2-native-r1`, `pantopus-stream3-block-r1`. Stream 2's backend 18143 and proxy 18142 are also still up.

## Where things are
- **Plans and inventories** are in `tools/`:
  - `trust-claims-2026-09-23.md`: about 55 unbacked "verified" claims and who owns each;
  - `ux-inventory-2026-09-23.md`: 155 items;
  - `AGENT-RULES-2026-09-23.md`.
- **Evidence bundles** are in the worktree store `…/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`. Copy them to `skinny-pantopus/.pantopus-recovery/audits/` before that worktree is removed.
- **Memory:**
  - `~/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/` — `coordinator-handoff-2026-09-23.md`;
  - `pantopus-ci-capacity-merge-batches.md`;
  - `pantopus-disk-git-maintenance-loop.md`;
  - `founder-direction-ux-e2e-2026-09-23.md`.

## Open founder items (short list; details in the README)
- **Marketing copy.** "Every helper is identity-verified", "no anonymous tier": enforce these, or change the copy.
- **Data counts, then repairs** (queries are in the README):
  - spoofed verified_business mail;
  - misfiled household letters;
  - fake default business stats;
  - bogus `business-<userId>` booking pages;
  - listings still active with an accepted offer.
- **Product questions:**
  - package pickups as real tasks;
  - real mail translation;
  - no-pay favours;
  - a "Verified sellers" filter;
  - saved-search alerts;
  - trusted neighbors;
  - which Home privacy controls to build;
  - chat LocalProfile identity;
  - mail routing semantics;
  - the A17 mail variant layouts;
  - the native booking landing;
  - price-change settlement;
  - backing out of an accepted offer or trade;
  - support-train invites.
- **Mac:** restart the leaking macOS ControlCenter (about 11 GB).
