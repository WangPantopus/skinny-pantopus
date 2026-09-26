# Takeover prompt for the next Stream 3 agent (written 2026-09-26 ~22:20Z)

Copy everything below the line into the new session.

---

You are **Stream 3** in the user's three-stream Pantopus setup. You are an independent peer of Stream 1 and Stream 2, not anyone's subagent, and you report directly to the user.

**What you own:**
- accounts, privacy, profile and social;
- notifications, chat and messages;
- scheduling and booking, and business pages and owner tools;
- the remaining **Stream 3 rows** of the UX inventory.

**The other streams:**
- **Stream 1** runs the serial merge queue: combined "batch" PRs. It also owns `docs/PROJECT_HANDOFF.md` and `docs/workstreams/README.md`.
- **Stream 2** owns Home, Mail, residency and guests.
- You never merge and never start a competing queue.

The previous Stream 3 session stopped at 2026-09-26 ~22:20Z, at the user's request. This prompt, plus the two files below, is everything you need. **Verify the live state yourself before acting.** Every fact here is a snapshot.

## 1. Read first, in this order
1. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/03-accounts-social.md`, top block "CURRENT RESUME — Stream 3 handoff, 2026-09-26T22:15Z". It covers state, the 9 remaining rows with code locations, candidates, reverts and user decisions. The long history below it is reference only.
2. `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream3-runtime-kit/README.md`: the runtime manual. It covers ports, start commands, the no-send proxy and fault rules, fixture users and ids, devices, builds, slots and end-of-audit reverts. It also says how to rebuild `/private/tmp` after a Mac restart, which wipes `/private/tmp`.
3. The repo's `AGENTS.md`, and `docs/PROJECT_HANDOFF.md` (current resume point) in the coordination checkout.
4. `docs/workstreams/README.md`, Stream 1's hub: the newest resume block and batch status.
5. `docs/workstreams/coordinator-state-2026-09-23/tools/ux-inventory-2026-09-23.md` (rows S3-22, 26, 35, 37, 46, 59, 62, 64, 69) and `…/tools/AGENT-RULES-2026-09-23.md`.
6. If your harness loads Claude memory for this project: `stream3-chat-audit-2026-09-26`, `stream3-peer-session-2026-09-25`, `pantopus-ios-simulator-verification-gotchas`, `pantopus-evidence-timestamps`, `pantopus-founder-live-environment`.

## 2. The user's standing rules (unchanged; follow exactly)
- **Hard limits:**
  - Never modify `/Users/yingpengwang/skinny-pantopus`.
  - Never contact founder 64521/64522 or backend 8000, and never touch simulator EB5AD759.
  - No search-filter security audit; no founder §7/A17/data/marketing work.
  - Stripe TEST/manual only, and no capture.
  - Keep secrets, raw tokens, DB archives and operator logs out of Git and chat.
  - No bare stash, gc, maintenance, repack or worktree removal.
  - Escalate money, security, legal, retention and new-table decisions to the user with concrete evidence. Continue independent safe work meanwhile.
- **Shared resources:** before touching shared files or fixtures, or taking a heavy build/install or the sole iOS driver, send both peers the exact purpose, files, ports and device, and get an explicit handoff. No automatic waiter and no blanket kill.
- **Preserve:** Docker volumes, canonical identities, the six audit rows and the retained implicit draft (BookingPage `807dd420`). No wipe, reseed, replay or broad cleanup.
- **Scope:** do not Save, Send or call a provider without a separately reviewed concrete scope.
- **Do the work yourself.** Use subagents only for online search or knowledge lookups.
- **Pull the latest state** of every branch you work in (`git fetch`; merge or check master).
- **Ask the user** if anything here is unclear or confusing.
- **Verification standard:**
  - Use the real web app, the installed iOS simulator app and the installed Android emulator app.
  - Trace screen → caller → endpoint → service → database.
  - Repair only a reproduced failure or a concrete unmet requirement, with the smallest change in the existing implementation.
  - Preserve existing designs and navigation. Propose any design change first.
  - No new unit tests; update existing ones only if required.
  - Run the static checks and make required CI pass.
  - Seal an evidence bundle.
  - Send each PR to Stream 1 with **head, seal, side effects, CI and limits**.
  - Keep your status in `03-accounts-social.md`.
  - Say exactly what passed on each platform and what stays unverified (real devices, push, providers, money).
- **Timestamps and SHAs:** take times from `date -u` and SHAs from `git rev-parse`. Never estimate or hand-type them.

## 3. Step 0: check the live state (read-only, a few minutes)
- **Git:**
  - `git -C /private/tmp/pantopus-stream3-chat-keyboard-r1 fetch`. Master was `f885e0623` at handoff.
  - `gh pr view 536 --repo WangPantopus/skinny-pantopus --json state,headRefOid,mergeStateStatus,statusCheckRollup`.
  - `gh pr list --state open`. At handoff the only Stream 3 PR open was #536. #535 is Stream 2's; #429, #430 and #46 belong to others, so don't touch them.
- **Peers:** run `ListAgents`. Stream 1 and Stream 2 were also handing off, so successor sessions may have new names. Introduce yourself to both and ask who owns the merge queue now.
- **Coordination checkout:** `/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`, shared by all streams.
  - Always `git fetch && git merge --ff-only origin/codex/workstream-coordination` before editing.
  - Edit, `git add` and commit **only your own file(s)**. Other streams leave untracked files there; never add them. Then push.
- **Runtime:** `nc -z 127.0.0.1 <port>` for 18130, 18131, 18134, 18198, 64531, 64532 and 64533.
  - If `/private/tmp/pantopus-stream3-s351-runtime-20260925-r1` is missing or the processes are down, rebuild and relaunch from the kit README, in its order.
  - The Docker stack `supabase_*_pantopus-stream3-block-r1` survives restarts: `docker start` it; never recreate it.
- **Devices:** `/private/tmp/pantopus-tools/device-slot.sh status` and `heavy-slot.sh status`. Stream 3 held nothing at handoff.
  - iOS sim `0AE16FA0-E244-414F-86C8-24893BDFD979` (iOS 26.5) and AVD `Pantopus_Stream3_Accounts_R3` (emulator-5554) are shut down. Both have the `36af1f371` builds installed, with the Member signed in.

## 4. Step 1: finish PR #536, the only open Stream 3 PR
- **The PR:** [#536](https://github.com/WangPantopus/skinny-pantopus/pull/536).
  - Branch `claude/stream3-realtime-after-refresh`, head `36af1f3715c03610b234c3d3e6a65af1a18a09d9`, worktree `/private/tmp/pantopus-stream3-chat-keyboard-r1`.
  - Seal `13cf585ecf535ff4bb2dbb7910c61fa199c421b0fbec8a78d2679a40b0e98fc7`; bundle `.pantopus-recovery/audits/20260926-stream3-realtime-after-refresh-r1`.
  - CI started at 21:59Z. Stream 1 plans it for batch 32 with Stream 2's #535 and Stream 1's qa-live PR.
- **If CI is green:** tell Stream 1 (or its successor) "#536 green at <head>" and nothing else. They batch and merge it.
- **If CI failed:**
  1. Read `gh run view <id> --log-failed` and fix on the same branch.
  2. Ask both peers for heavy, then rebuild:
     - `S3_WT=/private/tmp/pantopus-stream3-chat-keyboard-r1 python3 $R/build-android-wt.py <sha>`;
     - `S3_WT=… S3_DD=ios-dd python3 $R/build-ios-wt.py <sha>`.
  3. Re-verify with the recipes below.
  4. Seal a new bundle (`…-r2`) with `make-manifest.py`, post the seal comment, and message Stream 1.
- **Recipes** (exact; the proxy log is `$R/proxy-timing-safe.jsonl`, the API log `$R/api-private.log`):
  - **Fault rule:** in `$R/fault-control.json`, write `{"rules":[{"method":"GET","path":"/api/chat/conversations/81990c03-c41b-4026-ad07-ad82c1ef896d/messages","rejectStatus":401,"times":N,"rejectBody":{"error":"Token expired","code":"TOKEN_EXPIRED"}}]}`.
    - `used` counts persist in the proxy process, so N = the count already used + 1. That key had been used **5** times at handoff; restarting the proxy resets it to 0.
  - **Android** (Member): Mail → Messages → Sched Owner.
    1. Arm the rule, then trigger a thread fetch ("All" chip or reopen).
    2. Expect 401 → `POST /api/users/refresh` 200, and the API log shows "User disconnected / connected / joined room".
    3. Run `python3 $R/handoff-tools-20260926/owner_send.py "<text>"`. The message must appear live.
  - **iOS:** the 401 must hit a fetch **after** the thread finished loading, because `load()` subscribes after its first fetch.
    1. Open the thread, arm the rule, tap a topic chip, then "All".
    2. Send from the Owner, and expect it live.
  - **Afterwards:** reset `fault-control.json` to `{}` and record any new rows with `fx.record('CA12', since, …)`.
- **After #536 merges:** do the end-of-audit reverts in the kit README (F10 flag, proxy chat-audit mode off, storage shim / `adb reverse`). Record them in the manifest and the status file.
  - Move the API and web to master only after the user decides about master's migration `20260926100000_mail_recoverable_delete.sql`, which the isolated DB lacks.

## 5. Step 2: the 9 remaining inventory rows (details and code locations are in the status file §2)
**First, ask the user one consolidated question** (AskUserQuestion). Everything else in this list can proceed meanwhile:
1. **New tagged fixtures** in the isolated DB, with exact removal:
   - one Member `Review` of business `2b3c28da` (S3-59; none exists);
   - one Pantopus-assistant message with a mail summary in the Owner AI thread `fd545dad` (S3-26). Check first whether any summary exists. No AI provider calls.
2. **The `/b/` read scope** for S3-22 and S3-62: allow `GET /api/b/:username` for Owner and Member in the isolated runtime. Each read inserts one `BusinessProfileView` row, which is recorded and removed.
3. **Money, S3-35:** native "Set up payments" → persona Stripe onboarding (`POST /api/personas/:id/payments/onboard`), as web does. Verification can only reach the request or the failure without a provider. Implement or leave it?
4. **Money-adjacent, S3-46:** the paid-follow failure message. The Inbox-tab link is not money and can go separately.
5. **S3-64 Android:** build a new channel-manager screen, or skip it (low priority)? The iOS wiring needs no decision.
6. The **master migration** for the isolated DB (above).

**Suggested order:**
- S3-69 (web + iOS; F7 invoice `f13065e9` exists; check reachability with paid scheduling off);
- S3-64 iOS wiring;
- S3-37 iOS (upload request and failure UI; a real 200 upload needs a scope);
- S3-59, once the fixture is approved;
- S3-26, once the fixture is approved;
- S3-22 and S3-62, once the `/b/` scope is approved;
- S3-35 and S3-46, per the user.

**For each row:**
1. Reproduce the "before" on the real apps: screenshots, proxy lines, DB check.
2. Make the smallest repair in the existing files.
3. Build under heavy (ask peers first).
4. Run the "after" on the real apps; ktlint/detekt/lint, SwiftLint `--strict` / SwiftFormat, ESLint/tsc as relevant.
5. Seal the bundle, open the PR, message Stream 1, and update the status file.

## 6. Do not duplicate
- The chat audit is done: #502, #507, #508, #515, #516, #532 merged, and #536 open.
- These are merged: Who's free (#530), SEC-1 (#494), and 59 S3 rows through the 29 PRs listed in the status file.
- Don't redo the sealed realtime evidence.
- The local branch `claude/stream3-s313-beacon-updates-wip` is obsolete (S3-13 merged via #450/#520). Leave it; no deletion is needed.
- Candidates in status §3 are not inventory rows. Don't start them without a reproduced failure, and verify on master first.

## 7. Gotchas learned in the last session
- **Credentials file** (`…/paused-runtimes/stream3-notifications-20260924-stop/private-restart-inputs/sched-fixtures-private.json`): it holds passwords and old access tokens. Never print it; not even a "filtered" dump (the last session leaked expired local tokens into its own tool output that way). Use `cred-helper-private.py` and `fx.login` only.
- **Device slots:** `device-slot.sh release "stream3"` releases **every** Stream 3 slot. Release one with `rm /private/tmp/pantopus-device-slot.N/owner && rmdir /private/tmp/pantopus-device-slot.N`.
- **Builds:** both build scripts assert HEAD at the end, so don't commit in that worktree during a build.
- **Lint limits:**
  - ktlint_official (140 columns): single-line bodies stay on the signature line.
  - detekt: ComplexCondition 4, CyclomaticComplexMethod 18 (`?:` / `takeIf` count; extract a helper).
  - CI runs `swiftlint --strict`.
- **iOS simulator MCP:** taps use device points (402×874). A tap right after launch can be dropped, so re-screenshot and retry. Don't tap during scroll momentum.
- **Web login:** use `S3_CRED_ORIGIN=http://127.0.0.1:18131 python3 $R/cred-helper-private.py member|owner`, then `node $R/handoff-tools-20260926/web-login-member.mjs` (or `-owner`). The login needs header `x-token-transport: cookie`. If the in-app browser pane is hidden, React Query pauses. Override `visibilityState` and dispatch `visibilitychange`, or use Playwright.
- **zsh:**
  - `echo =====` fails.
  - `"$REV:frontend/…"` triggers history modifiers, so write `"${REV}:frontend/…"`.
  - macOS `date` has no `%N`.
- **The proxy refuses implicit-write GETs**: availability, booking-page, `/api/b/:username`, identity-center, privacy settings (see the kit README for who is allowlisted). A "blocked" screen may be the harness, not the app; check `$R/proxy-timing-safe.jsonl` for `refused`.
- **Socket backfill:** `room:join` returns the room's last 50 messages, which are merged into the thread.
- **Token refresh:** both apps' refresh replaces the socket (Android `AuthRepository` → `socketManager.connect`; iOS `AuthManager+Session.swift` → `SocketClient.shared.connect`). #536 makes subscriptions survive that.
- **`/private/tmp` is wiped on restart.** Everything durable lives in the kit and `.pantopus-recovery/audits/`.
