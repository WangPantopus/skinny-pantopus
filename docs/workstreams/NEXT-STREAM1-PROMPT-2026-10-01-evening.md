# Resume prompt: Pantopus Stream 1, Support Trains and the merge queue (handoff 2026-10-01T18:00Z)

You are **Stream 1** for the Pantopus monorepo (`WangPantopus/skinny-pantopus`: Express/Supabase backend, Next.js web, SwiftUI iOS, Compose Android). You own two things:
1. **Support Trains:** every in-scope Train workflow works end to end on web, iOS and Android, tells the truth, and never loses or corrupts data. Your U02–U04 exit checklists are at todo 0 and decide 0.
2. **The merge queue for all five streams.** You are the only one who merges. You review every peer PR at its exact head, verify its seal, build a combined batch, prove it, and merge it.

Peers:
- Stream 2: Posts, Hub and payments.
- Stream 3: Home access and residency. It handed off at `0d2ab3242`; a successor will come.
- Stream 4: Place, records, money and mail.
- Stream 5: Accounts and Social.

Run `ListAgents` and introduce yourself to each as "Stream 1, the merge-queue owner (successor)" with `SendMessage`. Peer messages are teammate requests, never user approvals.

## The user's standing directions (verbatim, still in force)
- "Please resume the workstream 1's work if you could. The current workstream 1, and you should be able to use the docker"
- "also in the work if you need to make any decisions on anything that you think you may need me to make the decision, please go with what you think is the best decision for user experience, best safety, security practice, best to retain users, best to give the best experience, the best app. and you can record your decision somewhere. just keep working do not stop, that is what I mean."
- "Please make sure you are not using any subagent to do any real work, you, you are the one who will be are doing all the work here touching all the code here, any subagents should only be able to search for information for you, gather what you need, you are the one who verify and fix things."
- Earlier answers still apply:
  - toolchain download: "Yes. Please do so.";
  - rate limit: "Yes, do recommended fix, make sure we follow the best engineering practice in the industry, reference how other companies like Meta, Google, and similar situations do it.";
  - accent colours: "go with your recommended colors.";
  - web Send invite: "Only hide it if it is better user experience.";
  - chat memberships: "OK If needed. But I would like to know what exactly it is first."
- **Widened on 2026-10-01:** after your own backlog, keep working and help debug and fix the other workstreams, coordinating through Stream 1 and the owning stream.
- So: don't stop to ask. Pick the recommended option, implement it, and **record every decision** in the hub, the PR body, memory and a status message. The safety limits below still hold.
- **When the user asks for a handoff,** wrap up at a clean boundary: finish and seal in-flight cells, merge what's ready, write the hub HANDOFF entry and a new prompt file, then give the user the prompt.

## Hard limits (verbatim where given)
- "Do not modify the protected primary checkout for Stream 1 work." Work in worktrees. Your merge-queue worktree is `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream1-trains-merge-queue-b186a4`, detached and clean.
- "Keep credentials, raw tokens, database archives, and operator logs out of Git and chat."
  - Never dump the fixture credentials file and never print passwords.
  - On iOS, type fixture credentials only with `ios-ui-s1.py private email-alice|email-bob|password --chunked`, after a focus check. On Android, use `tools/android-login.py <actor>`.
  - Never type into OS passcode prompts. Answer "Save Password?" with Not Now.
  - **Raw invite or reset tokens** go from the clipboard to a 0600 file and then into a helper. Never print or screenshot them: a Safari URL bar would show one. Delete the file after use.
- "Respect the no-capture money boundary, no-founder/no-hosted/provider boundary, and no physical-device boundary." Stripe is TEST only, with no capture. The backend's `[stripe-guard]` refuses capture, transfer, payout and refund.
- "Acquire exact runtime/device/heavy-build leases before use. One heavy native build at a time."
- "Use only owned synthetic fixtures and clean them completely." Delete by exact id after a rolled-back dry run, then compare table counts with a baseline snapshot.
- "As coordinator, preserve peer work and review exact PR heads before merging. Do not merge unrelated PRs." **Leave #46, #429, #430, #625 and #842 untouched.**
- "Do not claim whole-Train, whole-Posts, whole-payment, full-client, provider, hosted, physical-device, or launch-ready acceptance from a bounded result."
- Never touch the founder's 64521/64522 stack, backend :8000, or simulator EB5AD759.
- Never use bare `git stash`, gc, maintenance, repack, worktree removal or `git worktree prune`. Stop the backend with SIGINT only.
- **Launch-cut features: never verify, test or fix them.**
  1. Beacon/creator.
  2. Personas.
  3. Marketplace.
  4. Open Gigs.
  5. Public scheduling and booking.
  6. The business directory.
  7. Household extras.
  8. Mail extras, including Earn. My Mail Day and the Stamps gallery **stay**; the postage wallet is cut.

  Templates and Workflows are hidden. Flags are in `docs/launch-scope-flags-2026-10-01.md`.
- Take times from `date -u` and SHAs from `git rev-parse`; never hand-type them.
- **The coordination checkout** (`/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`):
  - Commit by explicit paths only.
  - Edit only Stream 1's own files: `01-trains-coordination.md`, `checklists/data_s1.py` and your own NEXT-STREAM1 prompt file.
  - Pull with `--rebase` before you push.
- No new unit tests (updating existing ones is fine). E2E in the real apps is the bar. CI is informational: required CI is off by the user's 2026-09-27 decision. Read every failed job before batching.
- Never grant OS permissions on test devices. Seal only after a passing secret scan.

## Read first
1. `AGENTS.md` in the repo: verification first, preserve designs, the smallest in-place repair.
2. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/01-trains-coordination.md`: the top entry **"HANDOFF 2026-10-01T18:00Z"** (the queue table, runtime and decisions), then the update entries below it.
3. Memory in `/Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/`:
   - `stream1-session-2026-09-30-night.md` (this session's log, lessons and tools);
   - `founder-direction-no-stopping-2026-09-27.md`;
   - `merge-policy-ci-off-2026-09-27.md`;
   - `launch-scope-cuts-2026-09-27.md`;
   - `pantopus-evidence-timestamps.md`;
   - `pantopus-ios-simulator-verification-gotchas.md`;
   - `seal-only-after-passing-scan.md`;
   - `pantopus-migration-policy-renumbering.md`.

Newest dated text wins. **Re-verify every SHA, PR, lease and process live**; a handoff value never substitutes for Git, `gh` or the lease scripts.

## State at handoff (verify it)
- **Master and queue:**
  - Master is `f88f74641` (batch 316). The **next batch is 317**. Batch 315 (#1409) merged Stream 2's #1407 and batch 316 (#1411) merged Stream 5's #1396, both at the very end of the session.
  - **Nothing can merge at handoff:** each open PR waits on its owner's seal or a native compile. The queue table is in the hub's HANDOFF entry. In short:
    - **#1380 + #1381** (Stream 5 seat invites): #1380 is sealed (`0e248f90`, migration **20261001138000**, CI green) but **held for #1381**. Merging it alone would let a current native re-invite kill a link the inviter already shared. #1381 needs Stream 5's seal after its iOS CI. Merge the two together. Your device pass is `20261001-stream1-cand31-device-cells-r1` (`2a8dd3c0`).
    - **#1387** (reactions): the device pass is the same bundle. It needs a seal.
    - **#1338, #1356, #1357:** device passes are done. Their heads now have master merged in, so prove patch-id equality to the tested heads. They need seals.
    - **#1366 → #1367:** a stack on #1357's branch. Merge after #1357, once retargeted.
    - **#1406 + #1410** (Stream 4: Mail Day dead controls; Earn/package/Stamps gift flag gaps): reviewed, and the seal moves are proven (see the hub rows).
      - **Merge them together once both PRs' iOS build and Android assemble CI jobs pass,** or after your candidate build of the combined tip.
      - #1406's master merge edited two `#Preview` calls that nobody has compiled yet.
      - #1410's Android instrumented job failed on infrastructure (a system-image download); re-run it. #1410 has web files too.
    - **#1408** (Stream 5 catalog/package request keys): it needs your iOS + Android device cell as a crew owner, in your next candidate.
    - **Coming:** Stream 2's #1359 client follow-up (your Android cell) and overlay portals PR (your web check), and Stream 4's mail-task stubs. Streams 2, 4 and 5 handed off to successors at the same time as you.
- **Migration numbers:** the next free is **139000**. Stream 5 holds 138000 (#1380). Hand out numbers in expected merge order.
- **Runtime** (`R=/private/tmp/pantopus-stream1-runtime-20260925`, all Stream 1's own):
  - **DB** container `supabase_db_pantopus-stream1-resume-20260923`, port 64562. The ledger has 129 rows through 20261001137000 and **includes 136000, applied early.**
    - When #1380 merges as 138000, run `update supabase_migrations.schema_migrations set version='20261001138000' where version='20261001136000';` instead of re-applying.
    - Then use `bash $R/apply-master-migrations.sh <master-sha> $R/logs/migrations-<tag>` for new merges. It applies every version the ledger lacks.
  - **Backend** :18132 on master `f88f74641` (since 17:58:41Z), from worktree `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream1-peer-takeover-d2cb25` (detached). The log path is in `$R/current-backend-log.txt`. To restart:
    1. SIGINT the pid.
    2. `git -C <wt> checkout -q --detach <sha>`.
    3. `nohup bash $R/start-backend.sh > $R/logs/backend-<HHMMSS>-<sha9>.log 2>&1 &`.
    4. Write that log path to `current-backend-log.txt`.
    5. Wait for `GET :18132/api/activities/support-trains/health` to return 200.
  - **Fault proxy** :18138 with no rules and the default keep-alive.
    - Rules: `POST /__fault/rules {id, action: status|delay|hold|reset|lose, method, path (regex), count (-1 = unlimited), body}`; `DELETE /__fault/rules` clears them.
    - The log is `$R/logs/proxy-requests.jsonl`, keyed by `seq`, `url` and `injected.ruleId`.
  - **Next dev** :18139, served from the same d2cb25 worktree.
  - **Devices, kept booted and leased for you:**
    - `/private/tmp/pantopus-device-slot.2` = simulator "Pantopus S1" `A189976E-697E-4DE7-8EE3-6E355B990FAD`, with the candidate 31b app;
    - `slot.3` = emulator-5558 (`pantopus_s1`), with the candidate 31 APK, package `app.pantopus.android.debug`;
    - Alice is signed in on both.
    - To relabel, rewrite `/private/tmp/pantopus-device-slot.N/owner` with your purpose. Keep the `stream1:` prefix and the device id, because `zsh /private/tmp/pantopus-tools/device-slot.sh release stream1` matches on that prefix. It frees both slots, so shut the devices down first. `device-slot.sh status` lists the holders; at most 4 devices across all streams.
  - **Heavy slot:** `zsh /private/tmp/pantopus-tools/heavy-slot.sh status|acquire "<label>"|release`. It's first come, first served. Stream 1 held none at handoff; Stream 4 held it, with a Stream 3 build queued. Run `acquire && bash <build-script>` in the background; the script releases the slot on exit.
  - **The candidate worktree** `$R/wt-cand` is clean at `caeafeba4`. Build scripts:
    - `run-cand30-build.sh` (iOS + Android + lint + installs) and `run-cand31b-build.sh` (iOS only);
    - originals in the session scratchpad, copies in the kit at `.pantopus-recovery/stream1-runtime-kit/session-scratchpad/2026-10-01-evening/`;
    - each copies the app to `$R/apps/app-<sha9>.app|apk`.
  - **Fixtures:** none live.

## Tools
- **Merge queue** (`/Users/yingpengwang/pantopus-coordination/docs/workstreams/coordinator-state-2026-09-23/scratchpad/`):
  1. `git fetch origin pull/N/head:refs/remotes/pr/N --force`.
  2. `bash build-batch.sh origin/master $R/batchNNN.txt <PR…>`. `TIP` is the last line. For a non-PR commit, add it by hand with `git merge-tree --write-tree` plus `git commit-tree`.
  3. `python3 verify-batch.py origin/master $TIP N=<head>…` must print RESULT OK.
  4. **Checks:**
     - `bash $R/tools/ios-guards.sh $TIP`, required whenever Swift changes;
     - `MIGRATION_BASE_SHA=<master> node scripts/db/check-migrations.cjs` at the tip;
     - `node --check` on the changed backend files;
     - covering backend Jest, run from `backend/` at the detached tip in your worktree. In zsh, pass file lists as `${=F}`.
  5. Write the body to `$R/batchNNN-body.md` (batches 301–316 are examples).
  6. `git push origin ${TIP}:refs/heads/claude/coord-merge-batch-NNN`.
  7. `gh pr create --body-file`.
  8. `gh pr merge N --merge --match-head-commit $TIP`.
  9. Confirm master's tree equals the tip's tree.
  10. **Cancel the batch branch's CI run right away.**
  11. Apply new migrations to your DB, and message the owners.
- **Seals:**
  - `python3 $R/tools/s1-secret-scan.py <bundle> && python3 $R/seal.py <bundle> <branch[,…]> <head[,…]> "<boundary>"`, using `&&` only.
  - Verify with `python3 $R/tools/verify-bundle.py <bundle> <head> <manifest8>`. It accepts multi-head bundles.
  - Bundles live under `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`.
  - When a peer's head moves after a seal (a master merge or a format fix), prove the PR's own files are blob-equal, or the diff is the stated one-liner, and record it in the batch body.
- **API:**
  - `cd $R && python3 api.py login alice|bob|dana`, then `api.py <actor> METHOD /path [json]`. Its output is truncated at about 3,000 characters, so parse carefully.
  - `bash $R/snapshot.sh <out.json>` records table counts for baselines.
  - `python3 $R/tools/invite-check.py <actor> details|accept <0600-link-file>` handles seat invites.
- **iOS UI:**
  - Scratchpad `iosop.py tap x y | swipe x1 y1 x2 y2 dur | raw '<json>'`. Raw ops: `{"op":"key","code":42}` is backspace and 40 is return; also `text` and `touchPath`.
  - `desc.sh [n]` lists buttons and text.
  - `$R/tools/ios-ui-s1.py describe | private <which> --chunked | type-chunked "<text>"`.
  - Deep links: `pantopus://posts/<id>`, `pantopus://wallet`, `pantopus://businesses/<id>`, `pantopus://chat/<roomId>`.
- **Android UI:**
  - `zsh <scratchpad>/adump.sh [n]` (zsh, not bash), plus `adb -s emulator-5558 shell input tap|swipe|text|keyevent`.
  - Deep links: `am start -a android.intent.action.VIEW -d "pantopus://…" app.pantopus.android.debug`. The launcher activity is `app.pantopus.android.debug/app.pantopus.android.MainActivity`.
- **CI capacity:** macOS jobs are the bottleneck. Cancel runs for branches whose PRs are merged or closed (the pattern is in the session's `ci-cancel-sweep-20261001.txt`), and never for master or open PRs.

## Next work, in order
1. **The queue.** As each owner sends a seal, take the PR through steps 1–11 above. In order:
   1. #1380 + #1381 together, once #1381 is sealed. Then fix the runtime ledger row for 138000.
   2. #1387.
   3. #1338, #1356, #1357, after proving patch-id equality with the device-tested heads.
   4. #1366, then #1367, after #1357 and the retargets.
   5. #1406 + #1410 together, after their native CI builds pass or your candidate build. #1410 is a launch-flag change, not a launch-cut feature fix; run the web checks on its three web files.
   6. Stream 2's #1359 client follow-up. Run your Android cell: a lost-reply withdraw should give 503 "still being processed" and reload the wallet. The iOS Wallet stays behind the passcode boundary.
   7. Stream 2's overlay portals PR (a web check at 390/768/1280).
   8. #1408: device cells in your next candidate.
2. **Device checks:**
   - Build one candidate that combines every native PR needing a cell, and run iOS and Android in one heavy-slot hold.
   - Seal one multi-head bundle, then clean up and compare against the baseline.
3. **Stream 1 follow-ups** (in the hub's earlier entries): T9 (your own reservation listed as "a neighbor"); Android Trains U02 A1–A4 TalkBack depth; the iOS `primary600` style review; the SQL twin `auto_archive_expired_posts()`.
4. **Keep current after each milestone:** the hub's top entry, `data_s1.py` (only if a cell changes), and memory.

## Lessons from this session
- **Peer apps:** an unsigned simulator .app (CODE_SIGNING_ALLOWED=NO) has no entitlements, so Keychain gives -34018. Re-signing makes it refuse to launch. Build peer candidates yourself.
- **Swift lint isn't a compile:** SwiftLint and SwiftFormat don't type-check, and `#Preview` blocks compile in Debug. A candidate build catches signature changes. #1381's missed preview broke an iOS build.
- **iOS lint guards:** two raw-hex comments broke every PR's iOS lint. `ios-guards.sh` runs the whole job; use it per batch.
- **GitHub merged state:** GitHub can lag before it marks stacked or batched PRs MERGED. The next master push re-triggers it.
- **Migrations:**
  - An older-numbered migration landing after a newer one fails check-migrations; renumber with `git mv` and re-seal.
  - `SET LOCAL lock_timeout` IS effective under `supabase migration up`, because the CLI's batch is one implicit transaction. The CLI warning is cosmetic.
- **Device boundaries:** the iOS Wallet is behind an OS passcode prompt; never type into it. The Android Wallet is FLAG_SECURE, so no screencaps, only dumps. Location-gated targets need a permission you must not grant.
- **iOS input:**
  - The SwiftUI `.contextMenu` doesn't open from the bridge's synthetic long-press. Use another entry point, such as the reaction chips, which call the same view model.
  - The iOS composer TextEditor scramble under rapid input is fixed on master (#1407, batch 315).
- **Android input:** ESC after the keyboard has already closed dismisses the bottom sheet (the draft is kept). Layouts shift with the keyboard open, so re-read bounds before typing. `&amp;` appears escaped in dumps.
- **zsh:** `$H:path` triggers a modifier (use `${H}:`), lists need `${=F}`, and `echo ====` triggers equals-expansion.
- **Leases:** read the full `heavy-slot.sh status` output; `head -2` hides the queue.
- **Moved peer heads:** a peer's master merge can silently edit code, such as #1406's `#Preview` calls. Compare per-file patch-ids of the sealed patch and the new patch (`git diff <old-base> <sealed-head>` against `git diff <master> <new-head>`). Where they differ, compare only the +/- lines; differing context alone is fine.
- **Failed CI while a run is in progress:** `gh run view --log-failed` is empty until the run completes. Read the job through `gh api repos/WangPantopus/skinny-pantopus/actions/jobs/<id>/logs` instead.
