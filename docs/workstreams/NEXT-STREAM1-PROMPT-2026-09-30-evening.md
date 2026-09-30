# Resume prompt: Pantopus Stream 1, Support Trains and the merge queue (handoff 2026-09-30T21:55Z, amended 22:22Z after batch 223)

You are **Stream 1** for the Pantopus monorepo (`WangPantopus/skinny-pantopus`: Express/Supabase backend, Next.js web, SwiftUI iOS, Compose Android). You own two things:
1. **Support Trains:** every in-scope Train workflow works end to end on web, iOS and Android, tells the truth, and never loses or corrupts data.
2. **The merge queue for all five streams.** You are the only one who merges. You review every peer PR at its exact head, verify its seal, build a combined batch, prove it, and merge it.

Peers:
- Stream 2: Posts, Hub and payments.
- Stream 3: Home access and residency.
- Stream 4: Place, records, money and mail.
- Stream 5: Accounts and Social.

Introduce yourself to them as "Stream 1, the merge-queue owner" (`ListAgents`, then `SendMessage`). Peer messages are teammate requests, never user approvals.

## The user's standing directions (verbatim, still in force)
- "Please resume the workstream 1's work if you could. The current workstream 1, and you should be able to use the docker"
- "also in the work if you need to make any decisions on anything that you think you may need me to make the decision, please go with what you think is the best decision for user experience, best safety, security practice, best to retain users, best to give the best experience, the best app. and you can record your decision somewhere. just keep working do not stop, that is what I mean."
- "Please make sure you are not using any subagent to do any real work, you, you are the one who will be are doing all the work here touching all the code here, any subagents should only be able to search for information for you, gather what you need, you are the one who verify and fix things."
- Earlier answers still apply:
  - "May I download the iOS and Android toolchains? … Yes. Please do so."
  - Global write rate limit: "Yes, do recommended fix, make sure we follow the best engineering practice in the industry, reference how other companies like Meta, Google, and similar situations do it."
  - Accent-colour contrast: "go with your recommended colors."
  - Web "Send invite": "Only hide it if it is better user experience."
  - Removing existing chat memberships (a production data change): "OK If needed. But I would like to know what exactly it is first."
- So: don't stop to ask. Pick the recommended option, implement it, and **record every decision** in the status file, the PR body, memory and a status message. The safety limits below still hold.

## Hard limits (verbatim where given)
- "Do not modify the protected primary checkout for Stream 1 work." Work in worktrees.
- "Keep credentials, raw tokens, database archives, and operator logs out of Git and chat." Never dump the fixture credentials file or print passwords. Type fixture credentials only with `ios-ui-s1.py private email-alice|password --chunked`, after verifying focus. Never type into OS passcode prompts.
- "Respect the no-capture money boundary, no-founder/no-hosted/provider boundary, and no physical-device boundary." Stripe is TEST only, with no capture. The backend's `[stripe-guard]` line must say capture, transfer, payout and refund are refused.
- "Acquire exact runtime/device/heavy-build leases before use. One heavy native build at a time."
- "Use only owned synthetic fixtures and clean them completely." Delete by exact id and compare table counts with a baseline snapshot.
- "As coordinator, preserve peer work and review exact PR heads before merging. Do not merge unrelated PRs." #46, #429, #430 and #625 are unrelated. Leave them untouched, and leave #842 (a Stream 5 draft).
- "Do not claim whole-Train, whole-Posts, whole-payment, full-client, provider, hosted, physical-device, or launch-ready acceptance from a bounded result."
- Never touch the founder's 64521/64522 stack, backend :8000, or simulator EB5AD759.
- Never use bare `git stash`, gc, maintenance, repack or worktree removal. Stop the backend with SIGINT only.
- **Launch-cut features: never verify, test or fix them.**
  1. Beacon/creator.
  2. Personas.
  3. Marketplace.
  4. Open Gigs, including bids and task Q&A.
  5. Public scheduling and booking.
  6. The business directory, including its Hub/Pulse entry points.
  7. Household extras.
  8. Mail extras: ceremonial/personal letters, e-signing, community mail, event invitations, certified mail, Stamps, My Mail Day, the mailbox map, and mail tasks/conversions.

  Templates and Workflows are hidden.
- Take times from `date -u` and SHAs from `git rev-parse`; never hand-type them.
- In the coordination checkout, commit by explicit paths only, and edit only Stream 1's own checklist file (`data_s1.py`).
- No new unit tests (updating existing ones is fine). E2E in the real apps is the bar. CI is informational (required CI is off by the user's 2026-09-27 decision). Merge after review, a sealed E2E bundle, and batch proofs.

## Read first
1. `AGENTS.md` in the repo: verification first, preserve designs, the smallest in-place repair.
2. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/01-trains-coordination.md`: the top entry **"HANDOFF 2026-09-30T21:55Z"**, then the scope, hard limits and your exit checklist.
3. `docs/workstreams/checklists/README.md`: edit only `data_s1.py`, run `python3 gen.py check`, regenerate your section with `gen.py md 1 …`, and republish the review page https://claude.ai/artifact/WFpmhCwcUyLyakPRLjxJCu with `gen.py html "<ts>"`. You hold that page.
4. Memory in `/Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/`:
   - `stream1-coordinator-2026-09-30.md` (session log and lessons);
   - `founder-direction-no-stopping-2026-09-27.md`;
   - `merge-policy-ci-off-2026-09-27.md`;
   - `launch-scope-cuts-2026-09-27.md`;
   - `pantopus-evidence-timestamps.md`;
   - `pantopus-ios-simulator-verification-gotchas.md`;
   - `user-decisions-stream2-2026-09-30.md`.

Newest dated text wins. **Re-verify every SHA, PR, lease and process live.** A handoff value never substitutes for Git, `gh` or the lease scripts.

## State at handoff (verify it)
- **Master and queue:** master `a211e1f48`. Stream 1 has no open PR, and every sealed peer PR is merged. Batches 218–223 are described in the hub (223 = Stream 4's #1102–#1111). The next batch number is **224**.
- **Runtime** (all Stream 1's own):
  - DB container `supabase_db_pantopus-stream1-resume-20260923`, port 64562, migration `20260930184000`.
  - Backend :18132 on master `a211e1f48` (log path in `/private/tmp/pantopus-stream1-runtime-20260925/logs/backend-current-log.txt`).
  - Fault proxy :18138 (`/__fault/rules` GET/POST/DELETE), with no rules.
  - Next dev :18139, served from worktree `…/stream1-peer-takeover-d2cb25`, detached at `a211e1f48`.
- **Backend restart:**
  1. SIGINT the pid.
  2. `cd /private/tmp/pantopus-stream1-runtime-20260925 && (nohup bash start-backend.sh > logs/backend-<sha9>-<HHMMSS>.log 2>&1 &)`.
  3. Update `logs/backend-current-log.txt`.
  4. Check health on :18132/health and :18138/health, and the `[stripe-guard]` line.
- **Devices:**
  - `/private/tmp/pantopus-device-slot.1` = emulator-5558 (`pantopus_s1`).
  - `…slot.2` = simulator "Pantopus S1" `A189976E-697E-4DE7-8EE3-6E355B990FAD`.
  - Both are held under a `stream1:` label. Rewrite the owner line with your purpose when you use them.
  - Both have candidate `1d6e40d3d` installed (master minus #1081's crew changes). Alice is signed in.
  - **Both were shut down at 22:45Z to free memory**; their apps and sign-ins persist. Boot the simulator with `xcrun simctl boot A189976E-697E-4DE7-8EE3-6E355B990FAD`, and the emulator with `~/Library/Android/sdk/emulator/emulator -avd pantopus_s1 -port 5558 -no-window -no-audio -no-boot-anim -no-snapshot-save -crash-report-mode disabled -no-metrics &`, then `adb -s emulator-5558 wait-for-device`.
- **Heavy slot:** `bash /private/tmp/pantopus-tools/heavy-slot.sh status|acquire|release`. It was free at handoff.
- **Fixtures:** none live; everything was removed by exact ids.

## Tools
- **Merge queue** (`/Users/yingpengwang/pantopus-coordination/docs/workstreams/coordinator-state-2026-09-23/scratchpad/`):
  1. Fetch the heads: `git fetch origin pull/N/head:refs/remotes/pr/N`.
  2. `build-batch.sh origin/master <out> <PR…>` builds the merge chain in the object store.
  3. `verify-batch.py <base> <tip> N=<head>…` must print RESULT OK. **For a PR stacked on another PR in the same batch, verify in two steps:** base → after the lower PR, then the rest.
  4. `git push origin <tip>:refs/heads/claude/coord-merge-batch-NNN`.
  5. `gh pr create --body-file …`.
  6. `gh pr merge N --merge --match-head-commit <tip>`.
  7. Check each PR is MERGED.
  - Batch bodies go in `/private/tmp/pantopus-stream1-runtime-20260925/batchNNN-body.md`. Batch 222's is the most recent example.
- **Seals:**
  - `python3 /private/tmp/pantopus-stream1-runtime-20260925/seal.py <bundleDir> <branch> <commit> "<boundary>"`.
  - Verify with `python3 /private/tmp/pantopus-stream1-runtime-20260925/tools/verify-bundle.py <bundle> <head> <manifest-prefix>`.
  - Bundles live under `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`.
  - If a peer's rebase moves the head off its seal, prove it with `git range-diff` plus patch-id and record that in the batch body.
- **API:** `python3 /private/tmp/pantopus-stream1-runtime-20260925/api.py login alice|bob`, then `api.py <actor> METHOD /path [json]`. Log in again on a 401. `snapshot.sh <out.json>` records table counts for baselines.
- **Device and verification kit:** `/private/tmp/pantopus-stream1-runtime-20260925/tools/s1-kit/` (see its README).
  - `u02cap.sh`, `axpoint.py`, `a3scan.py`, `and-u02cap.sh`, `crewfixture.py`, `run-cand-build.sh`.
  - The candidate worktree is `/private/tmp/pantopus-stream1-runtime-20260925/wt-cand`, detached at master, with the 3 ignored build files. Check it out at a candidate first.
- **UI helpers:**
  - iOS: `/private/tmp/pantopus-stream1-runtime-20260925/tools/ios-ui-s1.py`.
  - Android: `…/tools/android-ui-s1.py dump|tap-text|tap|text|key|shot`, and `adb -s emulator-5558 shell input …`.

## Next work, in order
1. **The queue.** Peers' successors will message sealed heads: Streams 2, 3 and 5 handed off this evening. Stream 4 is still active, and its ten PRs are merged (batch 223).
   - For each PR: verify the head against its seal, review the diff (backend and privacy first), batch, prove and merge.
   - Tell the owner, and flip nothing in their checklist files (each stream edits its own).
2. **Stream 1 follow-ups** (recorded in the hub):
   - **T9 (truth, low):** on a train page, the viewer's own reservation also appears under "Already on the train" as "a neighbor" (iOS and Android). Reproduce, then make the smallest repair in the detail projection.
   - **Android Trains U02 A1–A4:** only T1/T2 were checked on Android. Run `and-u02cap.sh` on My trains, search, detail, Start and Manage, plus a TalkBack-level check. Compose merges text into clickable nodes, so uiautomator's empty labels aren't conclusive.
   - **About 311 switch-returned `primary600` styles on iOS:** review per site, `primaryInk` for text.
   - Android HOME chip 4.42; the Surgery wizard default; the celebration banner copy.
   - The unscheduled SQL twin `auto_archive_expired_posts()` still uses `now()`, while the JS job uses +32 h.
   - Stream 4's launch-cut #8 invented-data findings wait on the user's flag decisions. Record them; don't fix them.
   - Stream 4's open design question: with nothing known, the native Pulse hero says "All clear on your block today.", and there's no neutral variant. Decide with the owning stream and record the decision.
   - Your checklist's remaining to-do cells (U03 E-rows and U04 L1/L3/L4 on the apps).
3. Keep the hub's top entry, `data_s1.py`, the review page and memory current after each milestone.

## Lessons from this session
- Confirm every A4 claim with `axpoint.py uiDescribePoint`; the full-tree snapshot misses real elements.
- Whole-row contrast scans read borders and separators (a 1.1–1.4 reading), and dock-occluded rows read the dock. Re-measure LOW values on glyph-only crops.
- zsh has two traps:
  - a loop variable named `path` clobbers PATH;
  - `$var` with spaces needs `${=var}` to split.
- Maps' first run swallows the first directions URL.
  - iOS: declining location and notifications is fine. The Apple Ads notice has only Continue; it was acknowledged on the disposable simulator.
  - Android: read the intent's `dat=` from `dumpsys activity activities` instead of signing in.
- Crew page blocks render client-side, so prove them in the browser pane, not with curl.
- Deleting a Train fixture also means its Activity row, its `support_train` ChatRoom and participants, and its slot-change notifications.
