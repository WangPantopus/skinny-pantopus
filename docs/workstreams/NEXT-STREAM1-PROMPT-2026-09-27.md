# Successor prompt: Pantopus Stream 1 (2026-09-27)

You are the next **Stream 1** agent for the Pantopus monorepo: Express/Supabase backend, Next.js web app, SwiftUI iOS app, and Compose Android app. Continue the existing verification and repair backlog. The previous session handed off after every PR it opened was merged; the recorded master is **35c5434df**, queue empty. Recheck live GitHub and worktree state before acting.

You are a peer of Streams 2 and 3, not their manager. While assigned as Stream 1 coordinator, you own the serial merge queue and shared hub status documents; peer streams own their changes and send their PRs for your review/integration. Coordinate shared devices and runtimes with them.

Handle application changes and real-app verification yourself. Do not delegate coding, simulator/emulator work, or acceptance decisions; any permitted research delegation is limited to web research.

## Objective

Make every **in-scope, reachable Stream 1 workflow** work end to end through its real web, iOS, and Android UI wherever that workflow exists on the client. Check the actual API/service and persisted result when relevant. Verify success, user-visible failures, recovery, and applicable edge cases. Repair demonstrated defects with the smallest change in the existing implementation, then repeat the affected real-app journey.

Use the existing acceptance table, screen/action catalogs, living inventory, handoff, and sealed evidence as the coverage map. Work through their genuinely open in-scope rows; do not create a parallel checklist. Reuse prior evidence when the relevant code, configuration, and behavior are unchanged. A merged PR, green CI, mocked check, API-only run, or stale “open” row is not by itself end-to-end acceptance.

## 1. Read first

Read these sources before choosing work. Newest dated blocks take precedence over history; verify their mutable facts live.

1. /Users/yingpengwang/pantopus-coordination/AGENTS.md
2. /Users/yingpengwang/pantopus-coordination/docs/PROJECT_HANDOFF.md — launch-scope table and newest Stream 1 update.
3. /Users/yingpengwang/pantopus-coordination/docs/workstreams/README.md — newest update and coordination/resource rules.
4. /Users/yingpengwang/pantopus-coordination/docs/workstreams/stream1-handoff-2026-09-26.md — read §0 and §3 first; use §1, §4, §5, §6, §7 and §11 for still-applicable procedures.
5. /Users/yingpengwang/pantopus-coordination/docs/workstreams/01-gigs-payments.md — newest Stream 1 update and acceptance accounting.
6. The living inventory at /Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260925-stream1-domain-inventory-r1/INVENTORY.md, including its merge-state header and “Successor findings 2026-09-27”.
7. Available session memory: stream1-successor-session-2026-09-27.md, founder-direction-no-stopping-2026-09-27.md, pantopus-evidence-timestamps.md, and pantopus-ios-simulator-verification-gotchas.md under /Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/.

## 2. Live preflight; preserve completed work

Before relying on the handoff, check the current UTC time, master and runtime-worktree commits, clean/dirty status, remote open PRs and their actual dispositions, the one current master CI snapshot, merge queue, owned backend/web runtime health, active device/build slots, and other streams’ reservations. The last recorded master is 35c5434df; the last recorded open unrelated PRs are #46, #429, and #430. Recheck rather than assuming these values remain current.

All Stream 1 PRs from the prior session, including #571, #580, #581, #586, #588, #589, #592, #598, #601, #603, #606, #607, #615, #616, and #617, are recorded merged in batches 37–42. Do not reimplement or repeat their accepted journeys without a changed source/contract, reproduced failure, or concrete unresolved risk. Batch 42 (#624) brought the recorded master to 35c5434df. The former required “CI OK” branch check was intentionally removed by the user. CI is informational: do not wait for it as an acceptance gate and do not treat unit-test/lint status as a substitute for real-app verification. Check the current master result once; investigate a concrete application break, not every unrelated check failure.

Use the existing Stream 1 runtime worktree and private helpers after checking their live state. The previous handoff says the main application checkout at /Users/yingpengwang/skinny-pantopus is protected and contains unrelated user work. **Never modify that checkout or contact founder services/devices.** Do not assume old PIDs, ports, tokens, build products, or device states are still valid.

## 3. Launch scope is a hard boundary

For first launch, the user is hiding eight feature groups behind flags and handles that work separately. Their code remains in the repository. **Do not inspect for defects, verify, end-to-end test, or fix a cut feature.** Apply the shared launch-scope table at the top of PROJECT_HANDOFF.md and README.md and the row tags in the living inventory. For a partly-cut row, skip only its explicitly named cut portion.

Stream 1 cut areas:

- **#3 Marketplace:** listings, listing offers, trades, listing Q&A, buyer–seller chat, listing Home slots, My Listings, Snap & sell.
- **#4 Open Gigs marketplace:** public task posting; public browse/feed/map/search/categories/filters; saved searches/alerts; hidden categories; task bookmarks; bids/offers/counters/My bids and expiry; stranger instant accept; task Q&A; provider search.
- **#6 General business directory:** business browsing/search and the map business layer.
- Hub, Discover, Pulse, or other entry points whose only purpose is one of those cuts.

Still in scope: payments and tips (subject to the hard money limits below), AI drafting where not part of cut public posting, known-crew task lifecycle after assignment, My tasks, rebook rail, Support Trains, Hub, Pulse, Posts, /start and Place preview, and accounts. Shared code stays in scope only for behavior required by an in-scope workflow. Do not revive cut work merely because it has an old PR, test, inventory entry, or unfinished design.

## 4. End-to-end acceptance; no unit tests

The user’s requested acceptance is the actual application launched on this Mac: web in a real browser, iOS in a simulator, and Android in an emulator. Use the owned local services/runtime and the existing real-UI drivers. For each in-scope workflow, exercise every client on which it is supported, and record when a client does not offer that flow. Do not claim success from a mock, unit test, API-only script, screenshot-only inspection, or CI.

**Do not add, write, or run unit tests or start a unit-test campaign.** Do not make unit tests or lints a merge/acceptance gate. Do only the builds and lightweight checks needed to launch the actual clients and diagnose a reproduced failure. Do not add a new test file or harness. Existing sealed app evidence is reusable when its implementation and runtime contract are unchanged.

For each journey, start from the real UI and follow the actual caller to the API/service and persisted state as relevant. Confirm the user-visible result, the correct stored effect (or absence of an effect on failure), and reload/reopen persistence where applicable. Derive edge cases from the workflow and existing acceptance row; exercise only the relevant cases, such as:

- empty/no-data and permission/ownership states;
- invalid input, unavailable service/read, timeout/offline, and malformed or unexpected response;
- retry and recovery after the original failure;
- duplicate taps/commands, overlapping requests, and lost replies where the command can be retried;
- cancel/back/discard, session expiry/account change, and foreground/background/process restart where that lifecycle applies;
- boundaries, stale data, or concurrency only where the existing contract or an observed defect makes them relevant.

For each failure, verify clear user-facing copy, no false success, no silent data loss, no unauthorized data exposure, no duplicate persisted side effect, and a working recovery path. Do not attempt every listed edge case on unrelated flows or repeat accepted cases without a concrete reason.

Keep existing web/iOS/Android design, layout, styling, and navigation. Functional verification does not authorize redesign. Reproduce a defect on the current app first, trace screen → caller → endpoint → service → database contract, and make the smallest in-place repair. Before adding a file, service, screen, table, or migration, compare existing and archived implementations and open branches; document why extension/reuse cannot solve a verified gap. Never rewrite applied migrations or add a parallel table for existing data.

If a verified repair cannot preserve the existing visual treatment and would require a design change, document the concrete need and proposed change for the user’s explicit approval before implementing that presentation change. Continue independent in-scope work meanwhile.

## 5. First work, in order

1. **Native onboarding / Start address-preview “Try again” is reported dead.** This is in scope. The handoff identifies iOS PlacePreviewBody.swift:253 and PendingPlaceView.swift:53 and Android PlaceLaunchScreen.kt:737; Stream 2’s merged #619 added retry/retrying support to the shared place section.
   - First inspect current master and the real call paths, then reproduce on the installed iOS and Android apps. Do not assume the old line numbers or proposed one-argument repair still apply.
   - If reproduced, wire the existing retry callback to the same preview load in the smallest existing call sites. Preserve current screens.
   - On both actual clients, trigger the failed preview, press Try again, verify a fresh request happens, the pending/error state is truthful, recovery shows the loaded preview, and repeated failure remains retryable without duplicate or stale content. Use only the existing local fault-proxy recipe/evidence for controlled failure injection; the button and recovery must still be exercised in the real app.
   - Recheck the already-merged web /start retry (#607) only if the native comparison or a concrete current failure warrants it.
2. **iOS Report post, then Android parity.** The inventory says “not run”; Posts are in scope.
   - Seed only an owned synthetic post by bob using the private api.py helper and a real location. Exercise report through the real iOS UI, then check the corresponding Android flow. Verify the correct report is stored once, the reporter and reported item are correct, denial/failure is honest, and a retry does not create duplicates. Clean up exactly the owned post/report/user data and verify cleanup.
3. **Continue the rest of the existing Stream 1 inventory in its recorded order**, skipping all cut rows and reusing unchanged accepted evidence. Cover the supported web, iOS, and Android clients for every remaining in-scope workflow, including the applicable error/recovery cases above. Keep each work item bounded; fix a demonstrated issue before moving on and rerun that journey on every affected client.
4. Take one current snapshot of master CI. Treat it as informational; fix forward only a concrete application failure relevant to the workstream. Do not wait for unit-test/lint gates.

## 6. User decisions, boundaries, and operational safety

- The user’s standing direction is to keep making progress: for ordinary in-scope implementation/product choices, choose the option you would recommend and record the choice, reason, and rejected alternative. Do not stop for routine clarification. This does not override explicit safety limits, launch cuts, reserved founder decisions, or the verification-first requirement.
- Do not redesign. If a verified repair needs an unavoidable visual change, seek the user’s explicit approval before that change, as required by AGENTS.md; keep progressing on independent tasks.
- Preserve the hard limits from handoff §3, including: no changes to /Users/yingpengwang/skinny-pantopus or founder services/devices; no search-filter security audit; Stripe TEST/manual only and **no capture**; do not touch #46, S1-08 money ownership, §7/A17, or unrelated #429/#430; do not query hosted/founder databases; no physical-device install; no secrets, raw tokens, database archives, or operator logs in Git/chat.
- Never run destructive global cleanup, reset shared databases, rewrite retained ledgers, or delete preserved worktrees/products. Inspect the exact runtime/device lease before use; use only owned synthetic fixtures and clean them in a checked transaction. Verify zero owned fixture rows/objects and compare to the pre-run snapshot.
- Do not use a bare stash, run git gc/maintenance/repack, or remove/prune worktrees. Preserve saved branches and stale worktree entries.
- The inherited Stream 1 backend must receive SIGINT, never SIGTERM. Use the slot scripts and coordinate with both peers before holding a heavy native build or UI driver. One heavy build at a time; at most four booted devices. Stop only processes/devices you own, using the recorded safe procedure.
- Never merge a runtime harness wholesale or update a branch solely because it is behind. Keep peer PRs and coordination edits intact. Commit explicit paths only.

## 7. Evidence, repair, and integration

For every reproduced issue or newly accepted journey, use the existing bundle/seal procedure from the handoff. Record the actual source SHA, app/build identity, runtime/device, steps, expected and actual UI result, relevant request and persistence receipts, failure/retry behavior, cleanup proof, and exact limits. Keep credentials and raw operational logs private. Link the sealed bundle from the existing inventory and status row; do not create another tracker.

After a fix, repeat the reproduced journey on every affected real client and its relevant failure/recovery case. Verify persistence or absence of side effects through the existing API/database contract. If a provider, hosted service, physical device, or other external boundary is unavailable or forbidden, state exactly what remains unverified and continue independent work; never imply broader acceptance.

When a PR is needed: review the exact head; verify its sealed end-to-end evidence; prove the combined batch with the existing build-batch.sh, verify-batch.py, and lint-batch.sh procedures; then merge with the documented exact-head command. The master required CI check is off, so do not wait on run.sh or make CI a gate. Check current rules live first. Attach every PR created to this task. Do not merge unrelated user PRs.

After each meaningful milestone, update the existing inventory row and the newest blocks in PROJECT_HANDOFF.md, README.md, 01-gigs-payments.md, this handoff §0, and the relevant session memory. State what changed or was accepted, what remains next, which evidence supports it, and exact verification limits. As Stream 1 coordinator, publish the ready coordination updates through the established branch workflow; commit explicit paths only and never include unrelated peer edits.

## 8. Final report

Report the current master and PR state, work completed, real-app clients actually launched, journeys and relevant error cases exercised, evidence links, any fixes/PRs, exact cleanup status, what remains open, and what could not be verified. Clearly separate accepted evidence reused from journeys rerun in this session. Make no whole-app or launch-readiness claim unless the existing acceptance catalog supports it.
