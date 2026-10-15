# PB handoff — October 14, 2026, resumed session

The founder requested a handoff before the remaining implementation and verification were finished. **The rebuilt PB runtime, synthetic fixtures, native apps and build caches are being kept for the next session.** This replaces the earlier cleanup snapshot. Continue existing work; do not recreate completed slices or treat drafts as merged or accepted.

## Start here

- Worktree: `/Users/yingpengwang/skinny-pantopus/.claude/worktrees/pulse-pb-backend-data-22af6b`.
- Branch: `claude/pulse-pb-s10-follows`. Implementation head: `7113887b282a2342254ff4b33a9733709bd106a1`; the subsequent handoff commit changes documentation only. Use `git rev-parse HEAD` for the final documentation tip.
- Fetch origin and inspect worktree/branch status, open PRs and exact-head CI first. At handoff, master is `b4234543c`, green (CI `38643228669`). No PR was merged during this resumed session.
- Read `AGENTS.md`, `NEXT_STEPS.md`, the mobile brief, Pulse `README.md`, `streams/PB-backend.md`, `status/PB.md`, this handoff, build spec, API contract and scenarios. Check other owners' current status and branches before adding code.
- All eleven tables and the Census download are approved. H1 and H3 are clear; Census migrations are already merged. No hosted changes or deployment are authorized.

## Git preservation audit and remaining-work estimate

The founder requested a second audit of all local PB branches, not just the current checkout. All 30 local PB branches were checked against origin, master and GitHub PRs. One historical backup commit (`858522ffc`) had not been pushed. Its patch is already represented by `3e29095bf` in merged PR 2278; no missing implementation was found. The exact backup is now pushed on `claude/pulse-pb-s5-preapproval-backup` and preserved in [archival PR 2326](https://github.com/WangPantopus/skinny-pantopus/pull/2326), closed as superseded. Do not merge or apply that old migration. All active PB work remains in the eight-PR chain below; older work is merged. Local branch aliases with no matching remote contain only commits already on master.

The approximate planning estimate for the **full PB backend/data lane** is **30% complete, 70% remaining**, crediting existing implementation but including its unfinished app verification in the remaining effort. This is a scope/effort estimate, not a count of PRs, an estimate for the entire app, or a claim that draft features are release-ready. Foundations are merged; distance/feed/conversation/actions/follows are at varying acceptance stages; creation, remaining actions/preferences and most later slices are still ahead.

Only private local runtime material is intentionally outside Git: credentials/env files, synthetic fixtures, diagnostic probes/logs, installed devices and rebuildable dependencies/build artifacts. These remain for resuming verification, not as uncommitted product changes.

## Already on master

S1 server restrictions; S4 topics/mutes; S5 shared read checks, adult attestation, Census areas and audience wall; S7 lifecycle/expiry/reminders; block-safe replies/notifications; legacy radius caps; held/removed post/reply filtering; Plans moderation. Detailed PRs and evidence remain in `status/PB.md`.

The preceding session merged 2301, 2298, 2304 and the 2305 → 2278 → 2306 → 2307 → 2309 chain, then S6 contract 2310. Audience rules read all verified homes and label/post from the primary home. **No creation path writes the new Pulse read scopes yet.** Label limits and remaining S5/S8 work are incomplete.

## Open PB chain: implemented versus accepted

Each row is stacked on the preceding row; 2311's recorded base is the already-merged feed-contract branch. All eight heads below passed applicable CI when rechecked for handoff. Keep implementation PRs draft until required real-app checks finish. S9 and S10 are not complete.

| PR | Branch suffix after `claude/pulse-pb-` | Green implementation head | Contents |
|---|---|---|---|
| [2311](https://github.com/WangPantopus/skinny-pantopus/pull/2311) | `s5-distance` | `230053f07` | Draft: privacy-safe distance formatter and service-only density lookup. |
| [2312](https://github.com/WangPantopus/skinny-pantopus/pull/2312) | `s6-feed` | `6df382a77` | Draft: grouped feed, new counts, opaque pagination, snapshot time and monotonic seen markers. |
| [2313](https://github.com/WangPantopus/skinny-pantopus/pull/2313) | `s9-contract` | `838c8051a` | Contract: claims responses and additive legacy reply envelope. |
| [2317](https://github.com/WangPantopus/skinny-pantopus/pull/2317) | `s9-conversations` | `9587754fe` | Draft: conversation/reply reads, stable branches and additive create-reply fields. |
| [2319](https://github.com/WangPantopus/skinny-pantopus/pull/2319) | `s9-reply-deletion` | `20a8fcb7e` | Draft: atomic reply scrubbing on account deletion, preserved descendants and legacy parent projection. |
| [2320](https://github.com/WangPantopus/skinny-pantopus/pull/2320) | `s9-reply-actions` | `122e61e93` | Draft: atomic Helpful, private/idempotent Thanks, direct inbox notices and quiet-hours release. |
| [2321](https://github.com/WangPantopus/skinny-pantopus/pull/2321) | `s10-contract` | `cc24a9e86` | Contract: follow/list/delete, summary undo, why and narrower-only audience DTOs. Narrowing is not implemented. |
| [2322](https://github.com/WangPantopus/skinny-pantopus/pull/2322) | `s10-follows` | `7113887b2` | Draft: private follow graph, Following feed/counts, viewer state, preference summary/undo and why. Carries this handoff. |

Retarget parents after they land, or merge a verified top head containing the exact green parent heads after retargeting included PRs to master. Keep branches. Recheck `/Users/yingpengwang/skinny-pantopus/launch-streams/status/REQUESTS.md` before each merge; this active launch-stream queue is separate from the retired September system. PB has no outstanding HOLD. Never merge another owner's client draft as part of PB's stack.

### Built in this resumed session

- **Reply deletion:** `20261015043700_pulse_preserve_deleted_authors_replies.sql` (renumbered October 15; was `20261014224000`) makes `PostComment.user_id` nullable with `SET NULL`; deletion scrubs content/identity/mentions within the User transaction. Counts exclude deleted rows. Pulse keeps anonymous removed placeholders/topology; legacy responses omit deleted parents and attach surviving descendants to the nearest live ancestor. Rollback restores author and text.
- **Helpful/Thanks:** migrations `20261015043800_pulse_reply_actions.sql` and `20261015043900_pulse_helpful_event.sql` (renumbered October 15). Helpful locks the post then reply; multiple marks are allowed; last unmark reopens only an answered Ask, never a closed/expired one. `CommentThanks` is private, unique per sender/reply, retry-safe and refuses self-Thanks. Actor, access, moderation and blocks are checked. `pulse_helpful`/`pulse_thanks` use the inbox, hold pushes during quiet hours and recheck access before release; obsolete Helpful notices are suppressed. `pulse_helpful_marked` fires only on transition to marked. Reply names use the card identity projection.
- **Follows:** `20261015044000_pulse_follows.sql` (renumbered October 15). Service-only `PulseFollow` supports post/topic/place, never person/business. PUT/DELETE are idempotent; repeated weekly follows keep the deadline; `on_resolve` ends permanently even after restore; `keep` survives resolution. Membership is applied before paging/counting through shared feed filters. Topic follows exclude older posts. List, preference summary undo and private why are implemented. `notify=recap|each` is stored, but delivery and core preferences still require PC integration.

These migrations are already applied to PB's local stack. Do not edit applied migrations or reset the database to resume.

## Verification and limits

### Existing checks and database/API probes

- Distance: two readers, rounding, sparse density, duplicate occupancies, invited/ended/guest/pending/frozen homes, hidden/grid-snapped points. Feed: 106 equal-timestamp rows without duplicates, scope/moderation/expiry/mute/hide, six types plus legacy/business/curator, labels, closed areas, save/Going and concurrent seen acknowledgments.
- Conversation: 205 replies, deep branches, repeated client request IDs, soft-deleted rows, held/removed moderation, both block directions, hidden parent identity, microsecond polling, malformed input and revoked access.
- Actions: concurrent Helpful, last-unmark reopening, closed Ask stays closed, Thanks retry/privacy/self refusal, blocked/held replies, quiet-hours release and stale-notice filtering.
- Follows: duplicate PUT/DELETE, week deadline, on-resolve ending/restore, keep, reader isolation, restricted targets, no person targets, mute/undo, topic publication time, summary undo and private why.
- Actions head: existing Jest passed 342 suites/6,633 tests, one suite/16 tests skipped. Follow head: local full run passed 338 suites and hit transient failures in four unrelated suites; all 61 tests in those suites passed a serial rerun. Follow CI `38651077295` passed full backend, Docker, safeguards and schema replay. Privacy gates, migration policy, SQL contracts and function lint passed (425 application functions at the follow head). No new unit/UI tests were added.

### Actual apps on the rebuilt PB runtime

- **Web:** feed renders six types and legacy rows; held rows absent. Alice's new reply survives reload and Bob sees it. Deleting a disposable synthetic account through Settings/password confirmation preserves Bob's descendant after reload. The earlier “Post not found” concern was an offscreen hidden detail panel, not a reproduced visible failure.
- **Android, PA 2303:** Alice signed in; grouped Camas feed renders six types plus legacy, Resident and `1.5 mi`, verified-area content and no held post. Event Going persisted across clients (iOS sees one going). Legacy conversation shows surviving descendants after account deletion. A native Android reply appeared through iOS's “1 new reply” banner. After force-stop/relaunch, Nearby shows quiet state and Show earlier. Following displays the Ask followed from iOS, confirming persisted membership across clients.
- **iOS, PI 2314 including 2308:** Alice signed in; types/labels/distance render. Conversation shows oldest-first flat branches, “Replying to Alice”, anonymous “Reply removed”, surviving “Replying to a neighbor” and `nearby` reply distance. Thank changes to Thanked; Follow changes to Following with notifications-off confirmation. The new-reply banner displays the Android reply. An iOS reply was submitted and appeared. After terminate/relaunch the session returns to signed-in Your Place; the conversation has not yet been reopened to verify every action's persistence.

**Still required before implementation merges:** other-account runs on both devices; reopen conversations after relaunch to verify Thanks/Follow/replies and reader-private flags; mark/unmark Helpful as the Ask author and check the other reader/inbox; finish feed paging/caught-up/new-count/topic/mute, offline/error paths, reader-specific distance and revoked access. Android's current draft has legacy conversation, not S9 actions UI. PI's claims/narrowing controls are unfinished. API probes do not substitute for these checks.

One observation for PA investigation: after relaunch Android Following displays “Add a home” although Alice has a verified home (iOS Your Place shows it). The followed Ask loads. This is not yet diagnosed as a backend or client defect.

Hosted services, physical phones, production delivery and deployment were neither changed nor verified.

## Remaining backend work, in order

1. Finish native checks with existing drafts; repair PB defects, coordinate client defects with the owner, merge only eligible green/verified PB PRs. Check `read_at`, selected `area_id` polling, opaque cursors and caught-up acknowledgment; `end.since` is not the server snapshot.
2. **S5 limits / S8 creation:** attestation/label limits, new types/read scopes, Share cap, expiry, held sales and edit-route support. PS's `evaluateComposerChecks` remains a dependency. Do not duplicate PS-owned safety files. No new-scope creation is enabled.
3. **Remaining S9:** OfferClaim requests/choice (max five, first-wins race, retries); reports through existing moderation with PS; narrower-only audience changes from contract §2.13; remaining notifications/slowed-exchange integration. Helpful, Thanks and deletion preservation are built but not fully accepted. Existing PostReport/admin handling is post-based; inspect schema/owner before reply-report support.
4. **Remaining S10 / PC integration:** core preferences, recap/each delivery, native acceptance and remaining specified events. Supply PC's shared-wall helpers: `digestPosts(viewerId, { since, until, limit })`, `unansweredForHelper(viewerId, { minAgeHours, limit })`, `followRecaps(viewerId, { since })`, `getSeenMarker(viewerId, view)`. These are not built. PC owns digest, preferences/delivery integration and noise-budget work; recheck its status before touching seams.
5. **S12:** KnownEntry/KnownConfirmation, RightNowEvent/RightNowReport, search/upcoming; contract addendum first. Provider accounts remain founder work.
6. **S14–S17:** `Plan.source_post_id` and conversation plan endpoint/card; public hooks under H2 with PC; place/area opening; libraries/council districts/visitor observations/boundaries; business offers and Official identity with PS. Reuse Plans/Business; no marketplace/Earn expansion.
7. **S20:** code sign-in design note first, then endpoints/device binding/limits; PV abuse run before merge (H6). SMS unavailable without the founder's provider.
8. **S21–S24:** recurring Plans/cohosts; Support Train link; duplicate-post merge/transfer hooks; secondary reading homes, pins and acquisition counts. Follow stream/spec and contract-first rule.

H2 public exposure/moderation coverage and H6 auth abuse verification remain. PS status has no completed implementation and PC has a design note; this does not establish whether they have unpushed work. Inspect before assuming a dependency is absent.

## Retained PB runtime

Private runtime: `~/.config/pantopus/pulse-pb-runtime` (mode 700). Credentials, env, raw logs, probes and screenshots stay there, out of Git/chat. Dependencies are installed. Source `~/.config/pantopus/dev-env.sh` before node/pnpm/supabase/java.

| Resource | PB identity |
|---|---|
| Supabase | Six running `*_pantopus-pulse-pb` containers; API 55001, Postgres 55002, inbox 55004 |
| Backend / web | `http://127.0.0.1:55100` / `http://127.0.0.1:55101`; PID files/logs in private runtime |
| iOS | `Pulse-PB`, UDID `65EB814A-0BF5-4310-BACE-BFEF34EEEAF1`, bundle `app.pantopus.ios`, booted |
| Android | AVD `pulse-pb`, serial `emulator-5572`, package `app.pantopus.android.debug`, booted |

Never operate PA's `emulator-5574`, PI's simulator or another stack. Verify device identity and listener working directory before stop/restart. Backend was restarted without its temporary HTTP diagnostic preload for handoff. `.env` remains local, background jobs off and `PUSH_EXPO_ENABLED=false`.

Use the live stack first. If stopped, `scripts/pulse/stream-runtime.sh start pb --env backend/.env` starts Supabase, not backend/web, and rewrites ignored backend env. Preserve local-only delivery settings. If dependencies actually need reinstalling, use `pnpm install --frozen-lockfile`. Do not reset/reseed/reinstall/rebuild everything by default.

### Client artifacts and control notes

- iOS private `ios-client/`: PI 2314 `d9422a46b` (includes PI 2308 `c9d4554c9`). Installed app: `dd/Build/Products/Debug-iphonesimulator/Pantopus.app`. Android private `android-client/`: PA 2303 `a5f8d9ee3`; installed APK: `android-client/app/build/outputs/apk/debug/app-debug.apk`. Both builds finished. PA's Kotlin-comment issue is already fixed; do not redo it.
- Existing client drafts 2302, 2315, 2316 and 2318 remain owner work. No tracked client source was changed by PB. Reuse rather than replace them.
- iOS API/socket uses `http://localhost:55100`; Android API uses `http://10.0.2.2:55100`. Check public-web settings before external-sharing tests: Android defaults to hosted and iOS rebuild may restore port 3000. Configure the private verification copy for PB web 55101 before opening those links.
- iOS local signing is needed for device-bound login. Working incremental command (set `PB_RUNTIME="$HOME/.config/pantopus/pulse-pb-runtime"`):

  ```sh
  xcodebuild -project "$PB_RUNTIME/ios-client/Pantopus.xcodeproj" \
    -scheme Pantopus -configuration Debug \
    -destination 'id=65EB814A-0BF5-4310-BACE-BFEF34EEEAF1' \
    -derivedDataPath "$PB_RUNTIME/dd" CODE_SIGNING_ALLOWED=YES \
    CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO \
    ONLY_ACTIVE_ARCH=YES ARCHS=x86_64 build
  ```

  Unsigned builds could not create the device key; manual entitlements did not fix launch. Reuse the working app unless source changes require rebuilding.
- The founder explicitly authorized local adb/AppleScript controls on PB devices. Native CUA was disabled and iOS Simulator MCP unavailable in this chat. Private `ios-tap.js` guards the Pulse-PB front window and maps 1206×2622 screenshot coordinates; it also supports dragging. Read its guard before use and abort subsequent keystrokes if it fails. System Events window enumeration was unreliable; helper uses CoreGraphics. Always pass `-s emulator-5572` to adb.
- Android entry needs pacing; fast long strings lost characters. Tap password explicitly: Tab selected Forgot password. Keep credentials private. No new UI tests are needed for manual native verification.

### Fixtures/current state

- `accounts.json`: synthetic Alice, Bob, Carol, visitor and now-deleted disposable “official”. Existing `example.com` logins work; shared helper's `example.invalid` default is rejected by app validation. Never print passwords/tokens. Do not rerun the whole seeder and duplicate rows.
- `fixtures.json`, `pb-api.cjs`, private probes and `bin/psql` are retained. The psql wrapper refuses non-PB hosts/ports. Inspect helpers first: some probes mutate/reset fixture state.
- Main Ask: `21513d76-09cf-45a7-97d2-bf0d2fff06bd`, author Carol. Alice is signed in on both devices; native-created follow/Thanks remain; her Event Going is true. Disposable author is deleted and Bob's child remains. Native replies are retained for persistence checks. No active probe mutes remain.
- Android is on Following with the Ask visible; iOS cold-launched to signed-in Your Place. Private `android.png`/`ios.png` show those states. Web sessions may remain; reauthenticate privately if needed.

Commit footer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branches: `claude/pulse-pb-<topic>`. PRs include “Scenarios run:” and “Not verified here”, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. No new unit tests, hosted changes/deployment, paid actions, messages to real people or changes to another session's resources.
