# Resume prompt for the next Stream 4 session — Place, records, money and mail

Handoff written 2026-10-01T17:54:23Z by the previous Stream 4 session (session id f1a9adbf). It supersedes
`NEXT-STREAM4-PROMPT-2026-09-30.md`.

## 0. Who you are and how you work

- **Identity.** You are **Stream 4**, one of the user's five parallel workstreams. Name the session
  **"Stream 4: Place, records, money and mail"**.
- **Partners.**
  - The merge-queue owner is the session **"Stream 1 resume: Support Trains and merge queue"**; message it with SendMessage
    (ListAgents shows the address). It merges in batches.
  - Stream 3 ("Home access and residency") shares the runtime and the S34 devices with you.
- **Directions in force:**
  1. **Verification first** (`AGENTS.md`):
     - reproduce on the real app, its caller, the API and the DB;
     - then make the smallest repair to the existing implementation;
     - keep the existing designs.
  2. **Founder direction** (2026-09-27, restated 2026-09-30 and 2026-10-01):
     - never stop to ask or wait;
     - decide for the best UX, safety, security and retention;
     - record every decision in the 04 file, the PR and the commit;
     - after your own backlog, keep working and help the other streams, coordinating through Stream 1 and the owning
       stream.
  3. **Do all real work yourself.** Subagents may only search and gather; you verify and fix.
  4. **Launch scope:** never verify, test or fix the eight cut features. For this stream:
     - cut #7, household extras: home bills, packages and package tracking, unboxing, pets, polls, the family calendar;
     - cut #8, mail extras: writing letters, ceremonial letters, certified mail and e-signing, community mail, mail party
       and invitations, translations, **Earn**, and the Stamps postage wallet.

     My Mail Day, the mailbox for received mail, the vault, Stamps (gallery and themes), mail tasks, vacation hold and Place
     **stay in scope**.
  5. **Merge policy:** required CI is off. PRs merge once reviewed and verified end to end in the real apps.

## 1. Workflow for every item

1. **Reproduce** on the real app, caller, API and DB, under the runtime lease.
2. **Repair** with the smallest change, on `claude/stream4-<topic>` from current master.
3. **Clean up exactly.** Use `tools/s4-cleanup-home.py <stage> '<want json>' '<extra scopes json>'`, which checks
   fingerprints against the stage baseline.
4. **Seal:** `python3 tools/s4-secret-scan.py runtime/<stage> && python3 tools/seal-bundle.py runtime/<stage> <bundle> <branches> <commits> <base> "<scope>"`.
   Always chain with `&&`. Never edit a sealed bundle.
5. **Open the PR** with problem, fix, evidence (seal and MANIFEST sha256) and checks. End the body with
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
6. **Hand it to Stream 1:** each head from `git rev-parse origin/<branch>`, plus the seal.
7. **Record it:** add a live entry at the top of "Live continuation — Stream 4" in
   `docs/workstreams/04-place-records-money-mail.md` (coordination checkout). Use `git commit --only` on that file, then push.
   If the push races another stream, `git fetch && git rebase origin/codex/workstream-coordination` your one commit and push
   again. The heading time is the commit time from `date -u`.

## 2. Read first

The coordination checkout is `/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`. Fetch and
fast-forward it first.

1. **The 04 file**, `docs/workstreams/04-place-records-money-mail.md`:
   - the new **CURRENT RESUME (2026-10-01)** at the top;
   - the older 2026-09-30 resume below it, whose runtime recipes and lessons still hold;
   - the "Runtime, devices and kit" section;
   - the live block, newest first.
2. **The hub `README.md`** (renumbering and LAUNCH SCOPE), plus `AGENTS.md` and `docs/PROJECT_HANDOFF.md`.
3. **The kit README:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/README.md`.
   Below, "kit" means that folder. Never print `runtime/accounts.env` or `runtime/supabase.env`.
4. **Today's sealed bundles**, in `…/.pantopus-recovery/audits/`, each with a README:

   | Bundle | MANIFEST | Contents |
   |---|---|---|
   | `20261001-stream4-flaggaps-themes-r2` | `35b44f01…` | #1375 recheck, flag gaps iOS/web/Android, themes, personal fallback, same-day letters, off switch |
   | `20261001-stream4-mailday-controls-r3` | `c685c3a8…` | Mail Day dead controls; mail-task dock before plus dock-only after |
   | `20261001-stream4-flaggaps-placeholder-r4` | `ce96a419…` | Android cut-link placeholder titles on the flag-gap head |

## 3. State at handoff

- **Master** was `c5ab503df` at handoff; fetch for newer. Stream 4's merges today:

  | PRs | Batch |
  |---|---|
  | #1282, #1300, #1301, #1317 | earlier batches |
  | #1354 | 300 |
  | #1372 | 304 |
  | #1373, #1374 | 305 |
  | #1375, #1400, #1401, #1402, #1403 | 313 (master `7ba02cf7a`) |

- **Open PRs, both handed to Stream 1:**
  - [#1406](https://github.com/WangPantopus/skinny-pantopus/pull/1406) — My Mail Day dead controls. Branch
    `claude/stream4-mailday-dead-controls`, head `68eba7522`; master was merged in to resolve a `#Preview` conflict with
    #1375. Seal `20261001-stream4-mailday-controls-r3`.
  - [#1410](https://github.com/WangPantopus/skinny-pantopus/pull/1410) — the flag gaps: Earn, Scan an item and the Stamps header
    hidden, and Android's cut-link placeholder titles. Branch `claude/stream4-mail-flag-gaps`, head `360f2fb02`. Seals
    r2 and r4.
- **Pushed without a PR:** `claude/stream4-mail-task-stubs`, head `d378fee78`.
  - Live tasks hide the dock's Snooze, Delegate and Calendar and the header's Share and More (the flag `hasUnbuiltActions`;
    sample data keeps them).
  - Before evidence and a dock-only after are sealed in r3. The header change needs a build and after frames.
- **Runtime and devices:**
  - The lease and slots are free.
  - The backend rests on master `726510e65`, unless Stream 3's successor moved it.
  - No Stream 4 fixtures exist and the fault rules are empty.
  - Both S34 devices are shut down with the owner signed in; the emulator has the master APK `215f6d747`.
- **Other streams:** Stream 3 handed off to a successor at about 17:38Z. That successor will message you before taking the
  lease.

## 4. Next, in order

1. **Follow #1406 and #1410** through Stream 1's queue; answer any review. Stream 1 asked for each item to be
   sent sealed.
2. **Mail-task stubs** (`claude/stream4-mail-task-stubs`):
   1. Build: `zsh tools/build-s4-native.sh /Users/yingpengwang/estimate-rescue/skinny-pantopus/stream-4-workstream-c3e7 claude/stream4-mail-task-stubs mailtask both ktlintCheck detekt :app:testDebugUnitTest --tests '*MailTask*' :app:verifyPaparazziDebug --tests '*MailTask*'`.
      c3e7 is clean on that branch; check `git -C <c3e7> status` first.
   2. Window: lease, slot, baseline. Fixtures: `s4-block-fixture.py`, `s4-member-fixture.py`, `s4-mail-task-fixture.py`.
   3. Open `pantopus://mailbox/tasks/<task id>` on iOS (the `ios-mailtask` build) and Android (`android-mailtask`). The
      dock should show only Mark done, and the header no Share or More.
   4. Clean up exactly, seal, and open the PR. The problem and before evidence come from r3 (`c685c3a8…`): Calendar showed
      "Added to calendar" with no request; Snooze only toasted; Delegate's button only closed its sheet; Share and More did
      nothing; the task row stayed unchanged.
   5. Hand it to Stream 1.
3. **U05.** Open
   [`stream4-u05-inventory-draft-2026-10-01.md`](stream4-u05-inventory-draft-2026-10-01.md). It is agent-gathered and
   **unverified**.
   - Verify each NOOP, SAMPLE, premature-success and launch-cut leak on current master: code first, then device or API.
   - For each item, decide: fix (smallest repair, with evidence, one PR per topic), hide, honest placeholder, unreachable or
     boundary. Record the disposition in the 04 file.
   - Fill the U05 row for Stream 1's release manifest.
   - **Start with the maintenance check.** The draft says the iOS maintenance log is reachable from the profile cover's
     Maintenance tile. If so, the parked `claude/stream4-ios-maintenance-reminder-flag` (`7f492bb31`) stops posting to the
     cut home calendar on iOS, and Android's similar POST needs the same.
4. **Mail Day settings honesty.** Only "Mail Day enabled" is honored, since #1402. Recommended: honor the delivery time as
   "not before" in the push's timezone, and hide the inert include, interrupt, sound, haptics and timezone rows on iOS,
   Android and web. Decide, record it, build, then evidence.
5. **Small findings:**
   - iOS VoiceOver: a reviewed Mail Day row is one button whose label omits Undo. Add a hint or a named action.
   - Android: the mail task's "Pulled from this mail" card is solid orange, while iOS shows a white card with an orange
     stripe. Check the tokens first.
6. **Then help the other streams** through Stream 1, as the founder direction asks.

## 5. Runtime, devices, builds

- **Runtime lease:** `bash tools/runtime-lease.sh acquire "stream4: <purpose>"`, released with `… release "stream4"`.
  - It covers any fixture, fault rule, backend restart, shared-worktree change, baseline or device run.
  - Release it promptly and message Stream 3 when you take or release it.
- **Device slots:**
  - Acquire with `zsh /private/tmp/pantopus-tools/device-slot.sh acquire "stream4: <device>"`. Run it with zsh, not bash.
  - Release with `zsh /private/tmp/pantopus-tools/device-slot.sh release "stream4"`, after shutting the device down.
  - The S34 pair is shared with Stream 3. Usually only one slot is free, so run one device at a time.
- **Devices:**
  - **iOS sim "Pantopus S34":** UDID `DA8C2A5F-39BC-421D-9F18-EB4B481E506F`, bundle `app.pantopus.ios`, driven by
    `tools/ios-s3-step.py <stage> <cmd> <case> …`.
  - **Android AVD `pantopus_s34`:** emulator-5562, package `app.pantopus.android.debug`, driven by `tools/android-s3-step.py`.
  - **Boot the emulator from the kit:**
    `python3 tools/detach.py runtime/emulator-s34.log /Users/yingpengwang/Library/Android/sdk/emulator/emulator -avd pantopus_s34 -port 5562 -no-window -no-snapshot-save -no-audio -no-boot-anim`.
  - Both are left shut down with the kit owner signed in.
- **Backend** (shared worktree `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream2-mail-journey-18b50a`; backend 18143,
  fault proxy 18142, Next dev 18144):
  - Switch it only under the lease, with `zsh tools/s4-backend-switch.sh <commit> "<source>" "<reason>"`.
  - The script refuses unless the worktree's only change is its standing `.claude/launch.json` edit (sha256 `625e2e3c…`).
  - It restarts the backend and logs the restart to `runtime/backend-restarts.log`.
  - Leave the backend on current master at the end of your window.
- **Builds** go only through the heavy slot (`/private/tmp/pantopus-tools/heavy-slot.sh`). Builds refuse under 10 GiB free.
  - Use the durable script `zsh tools/build-s4-native.sh <worktree> <branch> <out> <ios|android|both> [gradle args]`.
    `ANDROID_FEATURES=all` makes an all-features Android control.
  - Outputs go to `/private/tmp/pantopus-stream4-builds/{ios,android}-<out>/`, each with a `HEAD` file. Kept now:
    `ios-c1-merged` (master 215f6d747 + #1375), `ios-flaggaps` (G f431deec2), `ios-dcmt` (4c38e8fef), `android-flaggaps-before` (master 215f6d747), `android-flaggaps` (f431deec2), `android-flaggaps-all` (control), `android-dcmt` (4c38e8fef), `android-flaggaps2` (`360f2fb02`).
  - **Never merge into or switch a worktree whose build is queued.**
- **Worktrees** (Stream 4's; leave other streams' alone):

  | Path | Branch |
  |---|---|
  | `…/stream-4-workstream-4a5d06` | `claude/stream4-mail-flag-gaps` |
  | `…/stream-4-workstream-a16d86` | `claude/stream4-mailday-dead-controls` (#1406) |
  | `…/stream-4-workstream-c3e7` | `claude/stream4-mail-task-stubs` |

  - Backend Jest has no `node_modules` of its own in a16d86 and c3e7. Run it with
    `NODE_PATH=<4a5d06>/backend/node_modules <4a5d06>/backend/node_modules/.bin/jest --rootDir . <tests>` from the worktree's
    `backend/`.

## 6. Tools added on 2026-10-01 (in the kit's `tools/` unless noted)

- **Runtime:** `s4-backend-switch.sh`; `build-s4-native.sh`.
- **Mail Day fixtures:**
  - `s4-mailday-route-fixture.py <stage> <label> [nomatch]` makes a household letter plus a router queue row, matched to
    member B or with no match;
  - `s4-mailday-yesterday-fixture.py` makes a finished yesterday, so the recap card shows;
  - `s4-mail-task-fixture.py` makes a letter plus a task through the product route.
- **Mail Day probes:**
  - `s4-mailday-route-api.py <stage> <label> <fixture> [drawer]`;
  - `s4-drawer-presence.py`;
  - `s4-mailday-today-probe.py`;
  - `s4-mailday-job-probe.py run|reset|setting` with `runtime/run-mailday-job.sh`, which runs the push job once in the
    backend's isolated environment.
- **Themes:** `s4-themes-fixture.py`, which seeds migration 048's six themes; `s4-themes-api.py`.
- **Web:**
  - `s4-web-earn-nav.mjs` masks any text containing "@";
  - `s4-web-route-redirect.mjs` records redirects without following them;
  - refresh the web session first with `node tools/s3-web-login.mjs owner`.
- **U05:** the research prompt is in `runtime/stream4-u05-inventory-agent-prompt.md`.

## 7. Lessons from 2026-10-01

- **Catching iOS toasts.** A toast lasts 2.2 s, and `ios-s3-step.py` returns about 2.6 s after its tap, so it misses them.
  Take a burst of `xcrun simctl io <udid> screenshot` in the background, 0.25 s apart, while tapping.
- **Fast Android taps.** The Android driver's `tap` can spend about 30 s finding and scrolling. For timed taps, read the
  element's `bounds` from the saved tree and use `adb -s emulator-5562 shell input tap x y` during a
  `adb exec-out screencap -p` burst.
- **Emulator state.** A boot can bring back an older APK. Before capturing, verify the installed APK: pull it with
  `pm path` and `adb pull`, then `shasum`.
- **Sign-in screens.** Check each new launch frame's text tree for a sign-in screen before viewing it. Take no raster of
  sign-in screens; delete any unseen.
- **Next dev redirects.** Middleware builds redirects on host `localhost`, where the saved `127.0.0.1` cookie isn't sent, so
  a followed redirect lands on the sign-in page. Record redirects with `maxRedirects: 0`.
- **iOS navigation quirks:**
  - Deep links don't navigate while the iOS Mail tab shows its Messages segment; tap "Mailbox" first.
  - Toolbar items aren't in the default AX read; use `tapxy`.
- **Earn creates a wallet.** `GET /api/wallet` runs `getOrCreateWallet`, so opening Earn or the web Earn Wallet creates a
  Wallet row. Fault it with 503 first.
- **Integration builds.** A branch cut from a newer master can't be merged into an older integration commit without pulling
  in unrelated files and migrations. Cherry-pick its single commit instead.
- **Cleanup scope surprises.** Mail Day's summary card logs `mailday_summary_viewed` MailEvent rows with no letter, so add
  them to your MailEvent extra scope. The cleanup tool asserts exact counts, so do a dry pass first; it stops before
  deleting.
- **Unreachable layouts.** Native package and records mail layouts never render with real data. They decode the MailObject
  row, which has no such keys.

## 8. Decisions recorded today (details in the 04 file and the PRs)

- **Earn is hidden with `mail_extras`** (call 12, Stream 1 approved).
- **Exact Mail Day Undo needs no migration.**
- **`memory/dismiss` stays as is**, since nothing calls it.
- **My Mail Day hides controls that have no destination.**
- **The mail-task dock and header show only real actions.** The sample design data keeps them; live data hides them.
- **Locked themes return 403.**
- **The Mail Day push fails closed** when the settings can't be read.

## 9. Safety limits (always)

- **Production:** no production providers, real user data or payment data.
- **Secrets:** no credentials, tokens, raw logs or DB archives in Git or chat. Never print `runtime/accounts.env` or
  `supabase.env`.
- **Git:** no destructive commands — no reset, stash, clean, gc, worktree removal or `git worktree prune`.
- **Fixtures:** delete only within exact ownership.
- **Evidence:** every time from `date -u` and every SHA from `git rev-parse`. Mask account labels; the synthetic display
  names "Stream2 Resume owner" and "Stream2 Resume member" are allowed. Take no raster on sign-in screens.
- **Credentials and accessibility:** type native credentials only through the kit's secret operations, after a focus check.
  TalkBack probes must refuse to run while TalkBack is off.
- **The founder's environment:** never touch docker `pantopus-home-gig-replay` (ports 64521/64522), backend :8000, simulator
  EB5AD759, or the physical iPhone.
