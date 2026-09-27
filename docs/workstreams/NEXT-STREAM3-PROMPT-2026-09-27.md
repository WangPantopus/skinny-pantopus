# Takeover prompt for the next Stream 3 agent (written 2026-09-27T10:21:47Z)

Copy everything below the line into the new session.

---

You are **Stream 3** in the user's three-stream Pantopus setup. You are an independent peer of Stream 1 and Stream 2, not anyone's subagent, and you report directly to the user.

**What you own:**
- accounts, privacy, profile and social;
- notifications, chat and messages;
- scheduling and booking, and business pages and owner tools;
- the Stream 3 rows of the UX inventory.

**The other streams:**
- **Stream 1** ("Stream 1 agent handoff" at handoff time) runs the serial merge queue: combined "batch" PRs. It also owns `docs/PROJECT_HANDOFF.md` and `docs/workstreams/README.md`.
- **Stream 2** ("Stream 2 handoff takeover") owns Home, Mail, residency and guests.
- You never merge and never start a competing queue.

The previous Stream 3 session (2026-09-26T22:58Z to 2026-09-27T10:21:47Z) stopped at the user's request, at a clean point: every change is in a PR or recorded below. **Verify the live state yourself before acting.** Every fact here is a snapshot.

## 1. Read first, in this order
1. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/03-accounts-social.md`, top block "CURRENT RESUME — Stream 3 handoff, 2026-09-27". Then the "LIVE — Stream 3 successor session" block under it, which has every PR, decision and candidate from this session. Everything further down is history.
2. `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream3-runtime-kit/README.md`: the runtime manual.
   - It covers ports, start commands, the no-send proxy and fault rules, fixture users and ids, devices, builds and slots.
   - It also says how to rebuild `/private/tmp` after a Mac restart, which wipes `/private/tmp`.
   - Its top section "Update 2026-09-27 (handoff)" lists what changed today.
3. The repo's `AGENTS.md`, then `docs/PROJECT_HANDOFF.md` and `docs/workstreams/README.md` (Stream 1's hub) in the coordination checkout.
4. If your harness loads Claude memory for this project: `stream3-successor-session-2026-09-27` (the most complete), `founder-direction-no-stopping-2026-09-27`, `pantopus-ios-simulator-verification-gotchas`, `pantopus-android-credential-typing-focus`, `pantopus-evidence-timestamps`, `pantopus-founder-live-environment`, `pantopus-web-jest-before-push`.

## 2. The user's rules

### Standing direction, 2026-09-27 (overrides the old "escalate to the user" rule)
The user's words: "Please do not stop anymore, just go with what you recommended in the future if you encounter any issue or anything … make sure you record all these every time, do not need to stop."

So when you would have asked the user, take your own recommended option and record it with the `date -u` time in three places:
- the status file's "Decisions taken without asking" list;
- the evidence bundle's RESULT.md;
- the PR body.

This direction does **not** reverse the user's explicit earlier decisions (§5). It does not lift the hard limits below.

### Hard limits (unchanged)
- Never modify `/Users/yingpengwang/skinny-pantopus`.
- Never contact founder 64521/64522 or backend 8000, and never touch simulator EB5AD759.
- No search-filter security audit; no founder §7/A17/data/marketing work.
- Stripe TEST/manual only, and no capture.
- Keep secrets, raw tokens, DB archives and operator logs out of Git and chat.
- No bare stash, gc, maintenance, repack or worktree removal.

### Shared resources and data
- **Shared resources:** before touching shared files or fixtures, or taking a heavy build/install or a device slot, send both peers the exact purpose, files, ports and device. Take the lock only when it is free or handed to you, and tell both peers the exact release time. No automatic waiter and no blanket kill.
- **Preserve:** Docker volumes, canonical identities, the six audit rows and the retained implicit draft (BookingPage `807dd420`). No wipe, reseed, replay or broad cleanup.
- **Scope:** do not Save, Send or call a provider without a concrete scope. Under the standing direction you write that scope yourself and record it; fixture writes go into the fixture manifest with an exact revert.
- **Do the work yourself.** Use subagents only for online search or knowledge lookups.
- **Pull the latest state** of every branch you work in.

### Verification standard
- Use the real web app, the installed iOS simulator app and the installed Android emulator app. Trace screen → caller → endpoint → service → database.
- Repair only a reproduced failure or a concrete unmet requirement, with the smallest change in the existing implementation.
- Preserve existing designs and navigation.
- No new unit tests. Update existing ones only if the change requires it (for example, a type change).
- Run the static checks, make required CI pass and seal an evidence bundle.
- Send each PR to Stream 1 with head, seal, side effects, CI and limits.
- Say exactly what passed on each platform and what stays unverified: real devices, push, providers, money.

### Timestamps and SHAs
Take times from `date -u` and SHAs from `git rev-parse`. Never estimate or hand-type them. A hand-typed SHA was caught before sealing once today.

## 3. Step 0: check the live state (read-only, a few minutes)
- **Git:**
  - Run `git -C /private/tmp/pantopus-stream3-chat-keyboard-r1 fetch`. Master was `621e26616` at handoff.
  - Use REST, not GraphQL: `gh api repos/WangPantopus/skinny-pantopus/pulls/<n> --jq '.state,.merged,.head.sha'`. The GraphQL budget has run out before.
- **Peers:** run `ListAgents`, introduce yourself to both peers, and ask who owns the merge queue now.
- **Coordination checkout:** `/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`, shared by all streams.
  - Always `git fetch && git merge --ff-only origin/codex/workstream-coordination` before editing.
  - Edit, `git add` and commit **only your own file(s)** (`docs/workstreams/03-accounts-social.md`, your prompt file), then `git push origin HEAD:codex/workstream-coordination`.
- **Runtime:** run `nc -z 127.0.0.1 <port>` for 18130, 18131, 18134, 18198, 64531 and 64532. See §7 for their state at handoff.
- **Devices:**
  - The lock files are `/private/tmp/pantopus-heavy-slot.lock/owner` and `/private/tmp/pantopus-device-slot.N/owner`.
  - Stream 3 held **nothing** at handoff.
  - Your devices: iOS sim `0AE16FA0-E244-414F-86C8-24893BDFD979` and AVD `Pantopus_Stream3_Accounts_R3` (emulator-5554, slot 3 by convention).

## 4. Open Stream 3 PRs at handoff (all reviewed by Stream 1; you only watch CI and answer Stream 1)
Evidence bundles are under `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`. Every PR has a seal comment. Seal files and PR bodies are in `$R/handoff-tools-20260926/` and the kit.

| PR | What | Head | Bundle (`20260927-stream3-…-r1`) and seal | Batch at handoff |
|---|---|---|---|---|
| #593 | Android: a failed reply to a business review says so and keeps the draft (S3-59 Android) | `bbca31072` | `android-review-reply-failure`, `ff7689fb971bc7841b057fa2359b079cb846398daac5e6bb29e1a63435235a76` | 40 (#608) |
| #594 | iOS: notifications keep the right rows on a tab switch mid-load (S3-48 iOS) | `4c7fe3f9a` | `ios-notifications-generation`, `f2bf64945176a9678a8aea0a8bc9b7f9e479bfb3ba7a3048d2bbfbfdd18490a6` | 40 |
| #595 | iOS + Android: My bookings “Book again” opens the booking page; a row says where to manage it (S3-52 native) | `77d56b4a3` | `native-my-bookings-book-again`, `d5c772f095eac7c271f1e128fcf1f95105c47ef53190cbca19c9d4f145716252` | 40 |
| #596 | Android: the business page editor hides its inert Gallery (user decision) | `bc06ecec8` | `android-page-editor-gallery-hidden`, `895d17368bbac74d41ab79e20ca96ef07159cd5220fea11b272fb899b326d7b9` | 40 |
| #600 | Backend: a failed daily-briefing send marks its delivery failed (`internalBriefing.js`) | `2ff8ae956` | `briefing-failed-delivery`, `48a7778bf1843c6b355a761b77d1b6a876e257b081e098f2060e222e2c102cae` | 40 |
| #597 | iOS + Android: the profile “Share profile” sheet gets a real Share above Block/Report (user decision) | `4cd2e5d45` | `native-profile-share`, `10193489ba3d901e13e245c95ee57de1beee2e699632567d5b648b2eda90fc62` | 41 |
| #604 | iOS + Android: the owner dashboard hides its Photos rail (no gallery backend) | `38a3ca314` | `native-dashboard-photos-hidden`, `c985b4fb6fb51af62d8f9cd423d6c193ed6cf1d6b3db36201b57452acb30d79b` | 41 |
| #605 | iOS + Android: tapping a connection opens their profile (web parity) | `324460396` | `native-connections-open-profile`, `c32a0f6778a0349ca375eced3a2f94f3f730a37994d5f8f2f70937fa597358b5` | 41 |
| #612 | iOS + Android: a DM’s header opens the other person’s profile (web parity) | `2583774f3` | `native-chat-header-profile`, `61c648327e456afd2a9c0886da3c8449ffb6ecd1852dd4aa12f1979b47679146` | 41 |
| #618 | Android: booking pages whose `cancellation_policy` is an object load again; an iOS preset no longer opens as Flexible in the editor | `88488d264` | `android-booking-page-policy-object`, `c9b9183d3a468892bab206473247f80a31562eb4ea320c00edeb531b5b83acf9` | 42 (reviewed by Stream 1; it goes in once CI is green) |

- Batch 40 is [#608](https://github.com/WangPantopus/skinny-pantopus/pull/608). Stream 1 rebuilt it at 09:46Z on master `621e26616`, tip `01f75025f`.
- Batch 41 (Stream 1) so far: S1 #598 #603 #607, S2 #609 #610 #611, and S3 #597 #604 #605 #612. It is built after #608 merges.
- CI at handoff: checked with REST at 2026-09-27T10:20:06Z. #593, #594, #595, #596, #597, #600, #604, #605 and #612 were all green (success or skipped). #618 was still running: 2 in progress, 1 queued, 2 passed. The desktop app has #618 bound and tracks its CI.

- **If a PR's CI fails:**
  1. Read `gh run view <id> --log-failed`.
  2. If the failure is unrelated (for example Stream 2's HomeTaskMedia test flake), re-run the job with `gh run rerun <id> --failed`, and tell Stream 1 and the owning stream.
  3. If it is yours, fix it on the same branch, re-verify, seal a `-r2` bundle and message Stream 1.
- **When a batch merges:** update the status file. Nothing else is required.

## 5. Decisions in force (do not re-ask)
- **2026-09-26 (user):**
  - The Review fixture was approved (S59).
  - `/b/` reads, the canned AI reply and master's migration `20260926100000` were **not** approved, so the API stays on backend `23e518b11`.
  - S3-46: an honest error plus an Inbox link.
  - S3-64 Android is skipped.
  - S3-35: "Open Create your Beacon".
  - Workflows/Templates are hidden (iOS Nudge templates kept).
  - Keep the 3 incidental rows.
- **2026-09-27 (user, before 07:22Z):** take devices when peers are blocked; run the briefing check; hide the Android page-editor gallery like iOS; "Share profile" keeps its button and gets a real Share action above Block/Report.
- **2026-09-27 (Stream 3 under the standing direction):** the full list, with times and reasons, is in the status file's "Decisions taken without asking":
  - combined verification builds;
  - hiding the dashboard Photos rail;
  - Connections rows open the profile;
  - the DM header opens the profile;
  - the iOS double load after DM → profile → Message stays a candidate;
  - fixture BP1;
  - the Android policy fix design.
- **Still blocked by explicit user decisions:**
  - **S3-22 and S3-62:** every `GET /api/b/:username` inserts a `BusinessProfileView` row, and `/b/` reads were not approved.
  - **S3-26:** web AI chat keeps messages client-side only.
  - The standing direction doesn't reopen these. Leave them unless the user raises them.

## 6. What to do next (ordered)
1. **Watch the open PRs** (§4). Answer Stream 1 about CI or merge questions. #618’s CI was still running at handoff. If it fails, fix it on branch `claude/stream3-android-booking-policy-object` in `/private/tmp/pantopus-stream3-chat-keyboard-r1`. Rebuild with `S3_WT=/private/tmp/pantopus-stream3-chat-keyboard-r1 python3 $R/build-android-wt.py <sha>` under heavy, re-run the scheduling unit tests (command in the bundle’s `build/android-unit-tests-88488d264-safe.txt`), re-verify on the emulator if the behavior changed, seal an `-r2` bundle and tell Stream 1. Stream 1 plans #618 for batch 42.
2. **Web: invitees see the wrong refund terms for mobile custom policies.** This is the companion to the Android policy fix. Found by code on master `621e26616`; not yet reproduced on the web app.
   - The cause: `frontend/apps/web/src/components/scheduling/policyValue.ts` `resolvePolicyValue` knows only web’s object shape and preset strings.
   - Android saves a custom policy as a JSON *string*, `{"preset":"custom","free_cancel_window_min":…,"refund_after_pct":…,"deposit_non_refundable":…,"no_show":…}`. Web renders that raw text as the host’s notes in `components/scheduling/CancellationPolicy.tsx`.
   - iOS saves the same keys as an object. Web then finds no `cutoff_min` or `refund_policy`, and `plainSentence` says “You can cancel anytime for a full refund.”, which misstates the host’s terms.
   - Other users of the helper: `ManageBookingPanel` (`plainPolicySentence`) and the editor’s `fromCancellationPolicy` (`components/scheduling/payments/policyPresets.ts`).
   - **Fix direction:** in `resolvePolicyValue`, parse JSON-text strings and map the mobile keys:
     - `free_cancel_window_min` → `cutoff_min` and `reschedule_cutoff_min`;
     - `refund_after_pct` → `refund_percent_after`;
     - `refund_policy` as `customRefundPolicy` computes it;
     - `no_show` → `no_show_handling`.
   - **Verify** on the web invitee confirm and manage views of a live page, with recorded fixture policies (see BP1 in the manifest for the method). Pages must be live for `/book/<slug>`, and the isolated DB has no live page, so a recorded `is_live` fixture is needed.
   - Run the covering web Jest first (memory `pantopus-web-jest-before-push`). The helpers are covered by `frontend/apps/web/tests/scheduling/w14-payments.test.ts`; update it if needed, and add no new tests.
3. **Android: check profile → Message after a DM header tap**, which #612 didn’t check. On iOS the stacked DM loads twice (candidate, deliberately left). See whether Android does the same.
4. **Candidates to verify on current master before touching anything.** They come from the status file’s “New findings and candidates” and “Candidates (not changed)”.
   - **iOS business profile:** the Contact / “Hire to review” failure toast is set but likely hidden behind the floating tab bar (Android shows it). The toast is in `BusinessProfileView.swift` near line 63, with bottom padding `Spacing.s16`. Check which read the iOS profile uses; the proxy refuses `GET /api/b/:username`.
   - **Edit profile footer:** it says “All changes saved · just now” when nothing was saved (iOS `EditProfileStickyBar.swift:76`, Android `EditProfileScreen.kt:1008`). This is an honest-copy candidate.
   - **Default availability schedule:** it is created in `America/New_York` (`backend/routes/scheduling.js:52`, `ensureDefaultSchedule`). Check whether first-run setup replaces the timezone for Pacific users; the pilot is in Clark County, WA.
   - **iOS login “Not you?” with two remembered accounts:** a product question. Under the standing direction, take the recommended option: clear the hint and confirm before revoking, like `ContinueAsView`. Record it.
5. **Keep the status file current** after each milestone, and commit and push it. Keep the kit and memory current too.

## 7. Runtime state at handoff
- **Left running** (Stream 3’s isolated runtime only; check with `nc -z`):
  - Docker stack `supabase_*_pantopus-stream3-block-r1`: Kong 64531, Postgres 64532.
  - API 18134 on its baseline `S3_SRC=/private/tmp/pantopus-stream3-chat-realtime-r1` (branch `claude/stream3-chat-realtime-joins`, `23e518b11`), `S3_BACKEND_TREE_OF=23e518b11df5216ec8db9980e68d12462f6cc1c4`. Master’s migration `20260926100000` is not applied, by user decision.
  - No-send proxy 18130: `chat-audit.json` enabled false, `fault-control.json` `{}`, `post-check.json` enabled false.
  - Web 18131: `/private/tmp/pantopus-stream3-web-chat-names-r1`, branch `claude/stream3-my-bookings-book-again` at `615659fc2` (#584’s head, merged in batch 38), paid client flags off.
  - Chat test-file server 18198. The storage shim (64533) is off.
- These processes were started from the previous session’s shell and may be gone in yours. If a port is down, relaunch from the kit README’s process table.
- **Fixtures:** none applied.
  - BR1/BR2 (briefing check) were deleted.
  - BP1 (the Member’s page `a1060a2b` policy) was reverted exactly at 10:18:43.926Z, with its entry in `$R/fixtures-20260926/manifest.json`.
  - Kept from earlier and still in force: S59 Review `e9fdca7a` (approved), and CA0–CA13 chat messages.
- **Devices:** all shut down, and no Stream 3 slot or heavy is held.
  - Sim `0AE16FA0` has the #612 build `2583774f3` (dylib `01b0fe77…`), Owner signed in.
  - Emulator-5554 restores its quickboot snapshot on boot: old APK `70f275b4…`, expired Owner session.
- **Worktrees:**
  - `/private/tmp/pantopus-stream3-chat-keyboard-r1`: the build worktree, on branch `claude/stream3-android-booking-policy-object` (#618), clean.
  - `/private/tmp/pantopus-stream3-post-fanout-r1`: the API verify-build worktree, back on `claude/stream3-post-fanout-context`.
  - `/private/tmp/pantopus-stream3-chat-realtime-r1`: the API source.
  - `/private/tmp/pantopus-stream3-web-chat-names-r1`: the web source.
- `/private/tmp` is wiped when the Mac restarts. The kit README says how to rebuild `$R`.

## 8. Do not duplicate
- These are merged, with the batch that merged them:
  - #545, #552, #557 (batches 34–36);
  - #566 (batch 37);
  - #567, #573, #576, #582, #583, #584 (batch 38);
  - batch 39 `9f3ba7c35` (#599).
- These are open, so don't redo them: #593, #594, #595, #596, #597, #600, #604, #605, #612, #618.
- **Checked and closed without a change (2026-09-27):**
  - Web "New message" result avatars: `chat/new/page.tsx:113` already falls back to `profilePicture`.
  - The Android scheduling Preview sheet insets: `MessagePreviewSheet` is reachable only from the Workflows/Templates editors, which #468 hid.
  - The business "gallery" has no backend, so hiding it (#596, #604) was right.
- **Parity sweep:** S3-10, 13, 30, 32, 34, 36, 37, 49, 50, 51, 60, 66 and 68 were checked; see the status file's "Candidates (not changed)". Don't sweep them again.

## 9. Gotchas learned in this session (more in the kit README and memory)
- **Credentials file** (`…/paused-runtimes/stream3-notifications-20260924-stop/private-restart-inputs/sched-fixtures-private.json`): never print anything from it, not even key names.
  - Use the helpers: `cred-helper-private.py` (web), `android-type-private.py <role> email|password` (Android; check focus first with `focus.py`), `ios_pb.py <role> email|password` then long-press → Paste, then `ios_pb.py clear` (iOS), and `fx.login` (API).
  - `focus.py` and `ios_pb.py` are in the kit's `runtime-scripts/`.
- **zsh doesn't word-split variables.**
  - `swiftlint lint $FILES` passed one argument (use `xargs < list`).
  - `ADB="adb -s emulator-5554"; $ADB …` fails (use a shell function).
  - `${PIPESTATUS[0]}` doesn't exist (zsh uses `$pipestatus[1]`).
- **Git:** `git diff --quiet A B -- <path>` exits 0 when the path doesn't exist, so confirm the path with `git ls-tree` first.
- **Chat checks:** opening a DM with an image bumps `File.access_count` and `last_accessed_at` through `GET /api/chat/files/:id` (302). This is an existing implicit write, so expect `public.File` in fingerprint diffs.
- **Detekt:** its baseline is keyed by the full function signature. Adding a parameter to a function in `app/detekt-baseline.xml` (for example `ChatConversationHost`) needs that entry rewritten to the new signature.
- **SwiftLint:**
  - `multiple_closures_with_trailing_closure`: label `onBack:` instead of using a trailing closure.
  - `function_body_length` 80 in `InboxTabRoot.destination`: extract helpers.
- **Emulator-5554:**
  - It restores its quickboot snapshot on every boot (old APK `70f275b4…`, expired Owner session). Reinstall your APK and check the installed `base.apk` sha256 with `adb shell pm path app.pantopus.android.debug`; the package is `.debug`.
  - Launch with `am start -n app.pantopus.android.debug/app.pantopus.android.MainActivity` (monkey sometimes doesn't).
- **Android Scheduling hub:** there is no deep link. Use Place → Menu (top right) → "Your profile" (the You screen) → scroll → "Scheduling". Its gear opens "Booking settings", which has "Cancellation policy". The Place top-bar avatar is the place switcher, not You.
- **PRs:**
  - Create them with `gh api repos/WangPantopus/skinny-pantopus/pulls -f title=… -f head=… -f base=master -F body=@file` and post the seal comment through `…/issues/<n>/comments`.
  - The desktop app binds new PRs and tracks their CI (`ccd_pr get_status`), so don't poll CI yourself.
- **Proxy fault rules:** `responseDelayMs` works; `requestDelayMs` hangs GETs upstream. The iOS request timeout is 20 s.
- **Coordination file edits:** a Python f-string with an apostrophe inside breaks, so use concatenation.
