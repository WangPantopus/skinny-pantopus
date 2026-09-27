# Takeover prompt for the next Stream 3 agent (written 2026-09-27T10:21:47Z; updated 2026-09-27T11:17:35Z after every Stream 3 PR merged, and 2026-09-27T11:40:27Z for the launch scope in §0)

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
- Stream 1 runs the queue. Coordinate any merge with it, and never start a competing queue. Merges no longer wait for CI (§2, Merging).

The previous Stream 3 session (2026-09-26T22:58Z to 2026-09-27T11:17:35Z) stopped at the user's request, at a clean point. **All 11 PRs it opened are merged to master `35c5434df`.** No fixture is applied, and no device or heavy slot is held. **Verify the live state yourself before acting.** Every fact here is a snapshot.

## 0. Launch scope (user direction, 2026-09-27): what you do NOT verify, test or fix
Eight features are hidden behind feature flags for the first launch.
- Their code is **not deleted**, and you don’t do the flagging; the user handles that elsewhere.
- **Do not verify, end-to-end test or fix anything in them.** Remove them from any checklist or plan you inherit.
- Work already done on them stays as future-ready work.

The full cut table and the rule are in the shared block **“LAUNCH SCOPE — 2026-09-27”** at the top of `docs/PROJECT_HANDOFF.md` and `docs/workstreams/README.md` (Stream 1, coordination `d2bf06e36`). It assigns Stream 3 **#1 Beacon and creator tools**, **#2 Personas and identity switching**, **#5 Public scheduling for general businesses**, and crew pages under **#6**. The rule of thumb: a flow that exists only to serve a cut feature is out; shared infrastructure that also serves an in-scope feature stays.

**Out of scope for Stream 3:**

| Cut | Stream 3 surfaces now out of scope | UX-inventory rows (all already fixed, except S3-64’s Android part, which the user skipped) | Acceptance parts |
|---|---|---|---|
| #1 Beacon and creator tools | Beacon pages, Beacon Updates, Following publishers, audience profile and management, creator inbox, the broadcast composer and reach, fan/creator (persona) chat threads, membership tiers, paid follow and restricted content | S3-11, S3-12, S3-13, S3-33, S3-34, S3-35, S3-46, S3-68, and the broadcast “⋯” part of S3-67 | N03’s Beacon, persona and fan parts |
| #2 Personas and identity switching | Public personas and persona profiles (including the persona header’s Share/Block sheet), Beacon identity, the menu’s identity “Switch”, Identity Center and view-as, persona DMs | S3-06, S3-27, and the persona-DM part of S3-04 | N04’s PersonaBlock scope |
| #5 Public scheduling for general businesses | Booking pages and their setup wizards, event (appointment) types, public booking and manage-booking, customer “My bookings”, host booking detail, rebook/follow-up tools, group events and rosters, team scheduling and member hours, business scheduling settings, the availability UI, booking notifications and channel managers, cancellation-policy editors, reminders/workflows/templates, Who’s free, booking limits | S3-02, S3-05, S3-18, S3-19, S3-20, S3-21, S3-44, S3-45, S3-47, S3-51, S3-52, S3-64, and the “Book” part of S3-07 | N05’s booking parts; A05’s Calendarly inventory part |
| #3, #4, #6 (Stream 1’s cuts, where they touch Stream 3 surfaces) | Listing or task cards and pickers in chat, the Messages “Gigs”/“Market” filters, the public profile’s Gigs tab, “Earnings → My bids”, browsing or searching all businesses | The listing/task parts of S3-16; the “My bids” part of S3-42 | A05’s Marketplace part |
| #7, #8 (Stream 2’s cuts) | Their notification types: poll, package, pet, family calendar, bill management, letters, e-signing, community mail, mail event invitations | — | — |

**Still in scope for Stream 3:**
- accounts: sign-in, sessions, sign-out everywhere, account deletion;
- privacy and blocking;
- your own profile and other *people’s* public profiles (without persona or Gigs parts);
- connections;
- direct messages and the Messages list (without listing, task or persona threads);
- notifications for in-scope features;
- **crew pages**, meaning business pages and owner tools: creation, the page editor, the owner dashboard, team permissions, verification, reviews, share, unpublish, reports;
- **invoices and packages** (financial features; S3-69 stays in scope);
- the daily briefing;
- the AI assistant.

**Shared scheduling code** (`backend/routes/scheduling.js`, the availability engine) stays only as the engine underneath Crew Day. Test it only through Crew Day flows, not through booking-page UIs.

**Already done in cut areas, kept as future-ready work; do not re-verify:**
- #1: #576, #583, and the S3-11/12/13/33/34/35/46/68 fixes;
- #2: the persona part of #597;
- #5: #584, #595, #618, #623, and the S3-47/51/52/64 fixes.

## 1. Read first, in this order
1. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/03-accounts-social.md`, top block "CURRENT RESUME — Stream 3 final handoff, 2026-09-27". Then the "LIVE — Stream 3 successor session" block under it, which has every PR, decision and candidate from this session. Everything further down is history.
2. `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream3-runtime-kit/README.md`: the runtime manual.
   - It covers ports, start commands, the no-send proxy and fault rules, fixture users and ids, devices, builds and slots.
   - It also says how to rebuild `/private/tmp` after a Mac restart, which wipes `/private/tmp`.
   - Its top section "Update 2026-09-27 (handoff)" lists what changed today.
3. The repo's `AGENTS.md`, then `docs/PROJECT_HANDOFF.md` and `docs/workstreams/README.md` (Stream 1's hub) in the coordination checkout.
4. If your harness loads Claude memory for this project: `stream3-successor-session-2026-09-27` (the most complete), `founder-direction-no-stopping-2026-09-27`, `founder-direction-merge-without-ci-2026-09-27`, `pantopus-ios-simulator-verification-gotchas`, `pantopus-android-credential-typing-focus`, `pantopus-evidence-timestamps`, `pantopus-founder-live-environment`, `pantopus-web-jest-before-push`.

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
- Run the fast local static checks (lint, typecheck or compile, the covering unit tests) and seal an evidence bundle. CI is no longer a merge gate (see Merging).
- Send each PR to Stream 1 with head, seal, side effects, CI and limits.
- Say exactly what passed on each platform and what stays unverified: real devices, push, providers, money.

### Merging (user direction, 2026-09-27; Stream 1 acted on it at 11:13:55Z)
- The user: merge directly, without waiting for CI, "as long as you did app launch end to end test on the feature, function, flows that they work well. We do not care about these unit tests or so many lints here in the CI."
- At the user's direction, Stream 1 removed master's required "CI OK" check at 11:13:55Z. The prior config and a restore file are in `docs/workstreams/coordinator-state-2026-09-23/repo-settings/` (`master-protection-before-2026-09-27.json`, `master-protection-restore-2026-09-27.json`, README). Force-push and deletion protection are unchanged.
- So a PR whose change was verified end-to-end on the real apps, with a sealed bundle, can merge as soon as it is reviewed. Merge through the queue owner (Stream 1), or yourself if no queue owner is active. Announce it to both peers, and check `mergeable_state` and merge-tree first.

### Timestamps and SHAs
Take times from `date -u` and SHAs from `git rev-parse`. Never estimate or hand-type them. A hand-typed SHA was caught before sealing once today.

## 3. Step 0: check the live state (read-only, a few minutes)
- **Git:**
  - Run `git -C /private/tmp/pantopus-stream3-chat-keyboard-r1 fetch`. Master was `35c5434df` at handoff (batch 42 #624).
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

## 4. Stream 3 PRs from this session: all merged
Evidence bundles are under `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`. Every PR has a seal comment. Seal files and PR bodies are in `$R/handoff-tools-20260926/` and the kit.

| PR | What | Head | Bundle (`20260927-stream3-…-r1`) and seal | Merged |
|---|---|---|---|---|
| #593 | Android: a failed reply to a business review says so and keeps the draft (S3-59 Android) | `bbca31072` | `android-review-reply-failure`, `ff7689fb971bc7841b057fa2359b079cb846398daac5e6bb29e1a63435235a76` | batch 40 #608, 10:26:15Z |
| #594 | iOS: notifications keep the right rows on a tab switch mid-load (S3-48 iOS) | `4c7fe3f9a` | `ios-notifications-generation`, `f2bf64945176a9678a8aea0a8bc9b7f9e479bfb3ba7a3048d2bbfbfdd18490a6` | batch 40, 10:26:15Z |
| #595 | iOS + Android: My bookings “Book again” opens the booking page; a row says where to manage it (S3-52 native) | `77d56b4a3` | `native-my-bookings-book-again`, `d5c772f095eac7c271f1e128fcf1f95105c47ef53190cbca19c9d4f145716252` | batch 40, 10:26:16Z |
| #596 | Android: the business page editor hides its inert Gallery (user decision) | `bc06ecec8` | `android-page-editor-gallery-hidden`, `895d17368bbac74d41ab79e20ca96ef07159cd5220fea11b272fb899b326d7b9` | batch 40, 10:26:15Z |
| #600 | Backend: a failed daily-briefing send marks its delivery failed | `2ff8ae956` | `briefing-failed-delivery`, `48a7778bf1843c6b355a761b77d1b6a876e257b081e098f2060e222e2c102cae` | batch 40, 10:26:15Z |
| #597 | iOS + Android: the “Share profile” sheet gets a real Share above Block/Report (user decision) | `4cd2e5d45` | `native-profile-share`, `10193489ba3d901e13e245c95ee57de1beee2e699632567d5b648b2eda90fc62` | batch 41 #622, 11:11:32Z |
| #604 | iOS + Android: the owner dashboard hides its Photos rail (no gallery backend) | `38a3ca314` | `native-dashboard-photos-hidden`, `c985b4fb6fb51af62d8f9cd423d6c193ed6cf1d6b3db36201b57452acb30d79b` | batch 41, 11:11:32Z |
| #605 | iOS + Android: tapping a connection opens their profile (web parity) | `324460396` | `native-connections-open-profile`, `c32a0f6778a0349ca375eced3a2f94f3f730a37994d5f8f2f70937fa597358b5` | batch 41, 11:11:31Z |
| #612 | iOS + Android: a DM’s header opens the other person’s profile (web parity) | `2583774f3` | `native-chat-header-profile`, `61c648327e456afd2a9c0886da3c8449ffb6ecd1852dd4aa12f1979b47679146` | batch 41, 11:11:31Z |
| #618 | Android: booking pages whose `cancellation_policy` is an object load again; an iOS preset no longer opens as Flexible | `88488d264` | `android-booking-page-policy-object`, `c9b9183d3a468892bab206473247f80a31562eb4ea320c00edeb531b5b83acf9` | batch 42 #624, 11:14:26Z |
| #623 | Web: the apps’ custom cancellation policies read correctly, so invitees see the host’s real terms (companion to #618) | `e04e1a933` | `web-policy-mobile-shapes`, `8225da0538e8f8725719603d31b0aacf575be3b04e74cd0f7b77083be293c619` | batch 42, 11:14:26Z |

- Nothing from this session is open.
- Batch 42 was merged without waiting for its combined CI, per the user (§2, Merging). Each PR’s own CI was green before merge.
- If a regression surfaces, start from the PR’s bundle: it has the before/after, the exact builds and the side effects.

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
- **2026-09-27 (user, after the first handoff):**
  - Keep working until every PR Stream 3 opened is merged, then update the handoff. Done: all 11 merged.
  - Merge without waiting for CI once a change is verified end-to-end in the apps (§2, Merging).
- **2026-09-27 (user, received before 11:39Z): launch scope.** Eight features are flagged off (code kept). Don’t verify, test or fix them, and remove them from plans (§0).
  - Stream 3’s classification calls, taken under the standing direction:
    - business pages count as the kept **crew pages** (§0);
    - S3-22/62 (crew-page CTA/endorse) and S3-26 (AI assistant mail chips) stay in scope, still blocked by the user’s 09-26 decisions;
    - the New York schedule finding moved out of the plan, as a note for Crew Day;
    - N03, N04, N05 and A05 are split by part.
- **2026-09-27 (Stream 3 under the standing direction):** the full list, with times and reasons, is in the status file's "Decisions taken without asking":
  - combined verification builds;
  - hiding the dashboard Photos rail;
  - Connections rows open the profile;
  - the DM header opens the profile;
  - the iOS double load after DM → profile → Message stays a candidate;
  - fixture BP1;
  - the Android policy fix design;
  - don’t merge PRs individually while Stream 1’s batches hold them;
  - the web companion #623, verified with a live-page fixture (recorded and reverted).
- **Still blocked by explicit user decisions** (in launch scope, since they are crew-page and assistant features):
  - **S3-22 and S3-62:** every `GET /api/b/:username` inserts a `BusinessProfileView` row, and `/b/` reads were not approved.
  - **S3-26:** web AI chat keeps messages client-side only.
  - The standing direction doesn't reopen these. Leave them unless the user raises them.

## 6. What to do next (ordered; launch scope applied, see §0)
1. **Android: check profile → Message after a DM header tap.** #612 didn’t check this. On iOS the stacked DM loads twice (candidate, deliberately left). See whether Android does the same.
2. **Candidates to verify on current master before touching anything.** All are in scope; they come from the status file’s candidate lists.
   - **Crew/business page (iOS):** the Contact / “Hire to review” failure toast is set but likely hidden behind the floating tab bar (Android shows it). It’s in `BusinessProfileView.swift` near line 63, with bottom padding `Spacing.s16`. Check which read the iOS profile uses; the proxy refuses `GET /api/b/:username`.
   - **Edit profile footer:** it says “All changes saved · just now” when nothing was saved (iOS `EditProfileStickyBar.swift:76`, Android `EditProfileScreen.kt:1008`). This is an honest-copy candidate.
   - **iOS login “Not you?” with two remembered accounts:** a product question. Under the standing direction, take the recommended option: clear the hint and confirm before revoking, like `ContinueAsView`. Record it.
3. **Re-check the in-scope Stream 3 areas end to end** where this session didn’t:
   - accounts, privacy and blocking;
   - people profiles and connections;
   - DMs and the Messages list;
   - notifications for in-scope features;
   - crew pages and owner tools;
   - invoices and packages.
   Reuse sealed evidence when the code is unchanged. Skip everything listed in §0.
4. **Keep the status file current** after each milestone; commit and push only your file. Keep the kit and memory current too.

**Removed from the plan by the launch scope** (public scheduling, #5), recorded for when those features return:
- **New hosts on web and iOS keep a New York schedule.** The web `SetupWizard.tsx` and iOS onboarding never update the default schedule’s timezone; the backend’s `ensureDefaultSchedule` (`scheduling.js:52`) seeds America/New_York, and only Android’s first-run wizard corrects it.
  - Note for whoever verifies **Crew Day**, which keeps the scheduling engine: if Crew Day availability relies on the default schedule, check its timezone there.
- The business-only web cancellation-policy editor (`RefundPolicyEditor`), and the B7 “Max per week 20” booking-limit placeholder.

## 7. Runtime state at handoff (everything released at the user’s request, 2026-09-27T11:50:57Z)
- **Stopped:** API 18134, no-send proxy 18130, web 18131, file server 18198. Relaunch them from the kit README’s process table, in its order.
- **Docker stack** `supabase_*_pantopus-stream3-block-r1`: stopped with `docker stop`; **both volumes are kept** (db + storage). Start the db first with `docker --context desktop-linux start`, then the others. The db exits with 137 and runs crash recovery on start; that is expected. Never recreate the stack.
- **API baseline** for relaunch: `S3_SRC=/private/tmp/pantopus-stream3-chat-realtime-r1 S3_BACKEND_TREE_OF=23e518b11df5216ec8db9980e68d12462f6cc1c4`. Master’s migration `20260926100000` is not applied, by user decision.
- **Web** relaunch tree: `/private/tmp/pantopus-stream3-web-chat-names-r1`, detached at master `35c5434df`, default flags. `.next-dev` was deleted, so the first page load recompiles.
- **Deleted (all rebuildable):** every built iOS app copy (`$R/ios-app-*`), every APK (`$R/stream3-*.apk`), the iOS DerivedData cache `$R/ios-dd`, and the Android build output in `pantopus-stream3-chat-keyboard-r1`. The next build is a full build, about 10+ minutes per platform.
  - Kept: the Swift package cache `$R/ios-spm` (5.3 GB, avoids re-downloading), logs, fixtures and all evidence bundles.
- **Worktrees:**
  - Removed: `pantopus-stream3-post-fanout-r1`, whose branch is merged; recreate it from `origin/master` if an API verify build needs it.
  - Kept:
    - `pantopus-stream3-chat-keyboard-r1`: the native build worktree, on merged branch `claude/stream3-android-booking-policy-object`; start new work from `origin/master`;
    - `pantopus-stream3-chat-realtime-r1`: the API source;
    - `pantopus-stream3-web-chat-names-r1`: the web source and Playwright.
- **Fixtures:** none applied. BP1 was last reverted at 10:40:34.368Z (manifest). Kept from earlier and still in force: S59 Review `e9fdca7a`, and CA0–CA13 chat messages.
- **Devices:** sim `0AE16FA0` and AVD `Pantopus_Stream3_Accounts_R3` are shut down; no slot or heavy is held. The sim still has the #612 build installed; the emulator restores its old snapshot on boot.
- `/private/tmp` is wiped when the Mac restarts. The kit README says how to rebuild `$R`.

## 8. Do not duplicate
- These are merged, with the batch that merged them:
  - #545, #552, #557 (batches 34–36);
  - #566 (batch 37);
  - #567, #573, #576, #582, #583, #584 (batch 38);
  - batch 39 `9f3ba7c35` (#599).
- Merged today from this session, so don't redo them: #593, #594, #595, #596, #597, #600, #604, #605, #612, #618, #623 (§4). The cancellation-policy work is complete on Android (#618) and web (#623); iOS already read every shape.
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
- **Web public booking pages:** the page data is fetched server-side with `next: { revalidate: 60 }` (`lib/publicShare.ts`). After changing a page, wait until the served HTML carries the new value before capturing, for example `until curl -s <url> | grep -q <marker>`.
  - The invitee review step shows the policy, and is reachable without writes: the slot hold is client-only. Never press “Confirm booking”.
  - `handoff-tools-20260926/web-anon-step.mjs` drives a signed-out visitor; `web-member-step.mjs` drives the Member session.
