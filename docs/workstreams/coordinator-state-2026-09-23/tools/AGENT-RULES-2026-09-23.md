# Pantopus stream agent rules — 2026-09-23 (coordinator session 92cc4526)

You are one of three stream agents. The coordinator is the main session ("main"). Read this whole file first.

## Goal (founder, today)
Run the real apps (iOS simulator, Android emulator, web) and test the features and workflows end to end:
- every case, including edge cases;
- every error handled, with a clear message a normal user understands;
- no crash, no dead end, no stale screen.

When a journey fails, reproduce it on current master. Then:
1. find the existing screen, caller, endpoint, service and table;
2. make the smallest repair in that implementation;
3. verify the same journey again on the real app.

Keep going.

## Repository rules (from AGENTS.md; binding)
- **Preserve what works.** Keep existing screens, designs, layouts, styling and navigation. Verification and functional repairs do not authorize redesign.
- **Never assume a gap.** An open row or a missing filename is not proof that a feature is missing. Reuse existing code, tables, routes and screens.
- **No duplicates.** No parallel tables or duplicate trackers. No speculative refactors.
- **Migrations.** Never rewrite applied migrations. A new migration must sort after master's newest. After #253 merges, that is `20260923000100`.
- **Presentation changes.** Keep functional/privacy repairs separate from presentation changes. Any visible design change needs founder approval: write it up as a proposal and tell main. The one standing exception: the founder allowed large-text and dark-mode fixes when light mode stays pixel-identical.
- **Scope of verification.** Mocked checks or green CI alone are not end-to-end proof. Report provider/device boundaries (real push, physical phone, hosted deploy, live Stripe) as unverified.

## Hard safety limits
- **Founder's live environment: never touch it.** Never send it requests, stop it or boot it:
  - Docker stack `pantopus-home-gig-replay` (Kong 64521 / DB 64522);
  - backend `:8000` (pid 65426);
  - iOS simulator `EB5AD759` (iPhone 17).
- **Android builds.** Every Android build MUST set `PANTOPUS_API_BASE_URL` and `PANTOPUS_SOCKET_URL` to your own port. Before installing an APK, check its dex/BuildConfig strings: they must contain your port and must NOT contain `:8000`. (At 05:57Z an APK built without them defaulted to `http://10.0.2.2:8000` and reached the founder's backend.)
- **iOS builds.** Pass your API URL on the xcodebuild command line and check it the same way.
- **Search-filter security.** Do NOT audit or probe the free-text search filters, and do not craft filter or injection payloads. That area is handled by PR #255 (plain escaping) and the founder.
- **Stripe.** TEST mode only (`sk_test_`); assert `livemode:false`. No real money.
- **Secrets.** Keep credentials, tokens, device tokens, DB archives and raw operator logs out of Git, PR text and chat.
- **Git stash.** It is shared by all worktrees. Never run a bare `git stash`/`git stash pop`; use WIP commits.
- **Other checkouts.** Never modify `/Users/yingpengwang/skinny-pantopus` (the founder's main checkout). Never touch another stream's worktrees, stacks, devices or build output. Shed only your own.

## Resources (the Mac overloaded at ~05:00Z: load 660, swap full)
- **Heavy builds.** Any xcodebuild, Gradle assemble/install or fresh app install: `/private/tmp/pantopus-tools/heavy-slot.sh acquire "<stream>: <purpose>"`. Run `... release` as soon as the build ends. One heavy build at a time across all streams.
- **Devices.** Before booting an emulator or simulator: `/private/tmp/pantopus-tools/device-slot.sh acquire "<stream>: <device>"`. It also waits while memory is low. Use at most one booted device per stream. Shut the device down and run `device-slot.sh release "<stream>"` when you finish, or when it has been idle about 15 minutes.
- **Disk.** 96% full (about 19 GiB free). Delete only your own regenerable build output. Never delete `~/Library/Developer/Xcode/DerivedData` or other shared caches. Reuse your stream's existing derived-data dirs.
- **Services.** Before starting anything, check `memory_pressure | tail -1` and `uptime`. Stop your own Next/dev servers when you are not using them.

## Evidence
- **Location.** New bundles go under `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/<YYYYMMDD>-<stream>-<topic>-r<N>/`. That store is gitignored.
- **Legacy store.** Read old bundles in `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/`, but never write there. To reseal an old bundle: copy it to the new store, add files, then reseal the copy.
- **Contents.** Each bundle has a `RESULT.md` and a `MANIFEST.json`.
  - `RESULT.md`: defect, reproduction on master (exact SHA), repair (exact commit), real-app verification, limits.
  - `MANIFEST.json`: `updatedAt`, `branch`, `commit`, `boundary`, and `files` with each file's sha256 and size.
  - Cite the MANIFEST sha256 in the PR.
- **Timestamps and SHAs.** Take every timestamp from `date -u` at write time (this Mac is on PDT). Take every SHA from `git rev-parse`. Never estimate or hand-type either.
- **Screenshots.** Prefer text evidence (uiautomator dumps, accessibility trees, API/DB state) plus a few screenshots.

## Git / PR workflow
- **Worktree.** Work in your stream's existing `/private/tmp` worktree, or create a fresh one from `origin/master` at `/private/tmp/pantopus-<stream>-<topic>`.
- **Branches and PRs.** One focused PR per repair, on branch `claude/<stream>-<topic>`.
  - PR body sections: Problem, Reproduced failure, Change, Real-app verification, Evidence (bundle path + MANIFEST sha256), Limits.
  - End the PR body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
  - End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **CI.** The required check is "CI OK". Make it green before you report the PR ready.
- **Merging.** Do NOT merge, and do NOT edit the merge queue. Main reviews each PR and queues it (serial exact-head merges).
- **Hub docs.** Do NOT update the coordination repo (`/Users/yingpengwang/pantopus-coordination`). Main integrates status.

## Reporting to main (SendMessage to "main")
Keep reports short and concrete. Send one when:
- a PR is ready (number, head SHA, CI state, bundle MANIFEST);
- you confirm a defect;
- you need a founder decision (give a one-paragraph proposal with options);
- you are blocked, or hit resource trouble.

Do not wait for replies to continue independent work.

## Tooling gotchas
- **Android UI:** `ANDROID_SERIAL=emulator-XXXX python3 /private/tmp/pantopus-tools/aui.py dump|tap <text> [n]|has <text>|shot <path>`.
  - Wait after a swipe before tapping; a fling eats taps.
  - ESC (keyevent 111) dismisses Compose bottom sheets. BACK (4) hides the IME.
  - Type in short chunks; the emulator drops keystrokes under load.
- **iOS:** `xcrun simctl openurl <udid> <url>` for deep links. Reopening the same link needs a back navigation, then openurl. The iOS test host can hang with a persisted session.
- **Backend checkout:** a new checkout needs `pnpm install --frozen-lockfile --filter ./backend`. The shared pnpm store makes this fast.
- **zsh:** `rm dir/*` fails on an empty dir; use `find`. zsh treats a bare `=====` as an error; quote separators.
- **Money writes:** supabase-js does not throw on a failed write or RPC. Always read `{ error }`.
- **Refund lease:** it is 1 minute, so a retry inside it returns 202 pending.

---
## UPDATE 08:20 UTC: the founder's new direction (supersedes the conflicting rules above)

The founder said: *"keep working on all 3 workstreams until all features, functions, workflows within the app are
verified, tested with all cases … errors are handled properly, with great best user experience … when you work on every
single feature, function, flow, please think carefully whether the user experience is good enough or not. if not,
fulfill it. We do not care about unit test … all we need is to launch the apps in iOS, Android, simulator and emulator,
web app, test everything end to end, and fix anything you find."*

What this changes:
- **UX improvements are now authorized. You no longer need founder approval for them.**
  - On every screen and flow you touch, ask whether the experience is good enough. Look for:
    - clear copy;
    - visible and specific errors;
    - no dead ends;
    - obvious next steps;
    - sensible empty and loading states;
    - no duplicate submits;
    - correct back navigation;
    - accessible labels;
    - consistency across iOS, Android and web.
  - If it isn't good enough, improve it.
  - Stay inside the existing design system: existing components, colours, typography and spacing tokens. Improve and
    complete what's there; don't restyle or re-architect screens that already work.
  - Keep the "prove it" discipline: a before/after on the real app for every visible change.
- **Unit tests: don't write new ones.**
  - Don't spend time on coverage.
  - Update an existing test only when your change intentionally alters what it asserts, because CI must stay green.
  - Evidence is end-to-end on real apps (simulator/emulator/web) against a real backend.
- **Still escalate to main, briefly, before building:**
  - money-movement design;
  - security/permission policy;
  - legal/retention questions;
  - block/privacy concealment semantics;
  - anything needing a new table or a large new feature.
  - Main decides and records it; there's no need to wait for the founder unless main says so.
- **Coverage goal:** every feature/flow in your stream is verified end to end on all three clients. Use the existing
  80-row backlog (`docs/REMAINING_WORK_2026-09-11.md`) and the screen catalogs as the checklist. Include happy paths,
  edge cases, errors, offline, permission denials, process death, back navigation and deep links.
  - Record per-flow results in your bundles.
  - Report progress to main, including which rows can close.
- **Everything else above still applies:** safety limits, resource slots, the evidence store and the PR workflow.

---
## UPDATE 15:05 UTC: CI capacity (supersedes "one focused PR per repair" for native work)
- **Why.** CI is bound by macOS runners, about 6 jobs at once. Every native PR costs 5 macOS jobs: lint, build, and tests on three simulators, about 38 macOS-minutes. Web-only and backend-only PRs use no macOS time.
- **Native fixes.** Group related fixes (same screen, flow or files) into one PR, 2–4 items. Give each item its own section in the body: Problem / Reproduced / Change / Verified. Before opening a new native PR, add to an open one of yours on the same screen, unless it is already in a merge batch.
- **Web and backend fixes** stay small and separate. Prefer them when choosing what to do next.
- **Merges.** Main builds combined merge batches: each reviewed PR head merges unchanged, CI runs once, and GitHub marks every included PR merged. Don't push to a PR that main has put in a batch unless you're fixing a defect, and then tell main.
- **GitHub API.** The GraphQL rate limit is shared, and it ran out at 14:55 UTC. No `gh pr checks --watch` and no tight `gh pr view` loops. Main watches CI for every `claude/*` PR and tells you the result. If you must poll, use `gh api` REST at 2 minutes or slower.

---
## UPDATE 18:21 UTC: disk discipline after the 16:50 disk-full incident
- Git auto-maintenance is paused on the shared repo. Never run `git gc`, `git maintenance` or `git repack`.
- **Hold the heavy slot for the whole build.** `heavy-slot.sh acquire` comes before xcodebuild or Gradle assemble/install starts, and `release` comes only after the build and install finish. Never build while someone else holds the slot.
- **Keep your one derived-data dir** and reuse it. A from-scratch iOS build writes about 5–8 GiB. Delete APKs, stale app copies, `.next` dirs of stopped servers and old worktrees instead.
- **Disk alerts.** Main watches free space and alerts below 12 GiB. If main says the disk is low, park builds at once.

---
## UPDATE 19:48 UTC: Gradle daemon stop
- `./gradlew --stop` stops EVERY Gradle daemon for this user and Gradle version, including other streams'.
- Run it only while you still hold the heavy slot, BEFORE `heavy-slot.sh release`. Never run it after releasing: at 19:00:53Z that killed Stream 1's freshly started build.
