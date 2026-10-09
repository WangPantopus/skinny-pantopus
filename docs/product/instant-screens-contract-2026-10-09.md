# Instant Screens contract

The shared rules the four Instant Screens sessions build against: IS-iOS, IS-Android, IS-Server and IS-Web. Every platform implements the same freshness times, topic names, privacy tiers, limits and wording. Change this file only through the coordinator session ("Screen refresh performance and caching strategy"), which announces every change to all four.

- Design (why, research, mockups): https://claude.ai/artifact/AQ8qS87MJoHtWShPpdHSia
- Build plan (sessions, order, dates): https://claude.ai/artifact/8eYEXcE9zuXymtQ6wpRhGr
- Process: `AGENTS.md` and `/Users/yingpengwang/skinny-pantopus/launch-streams/RULES.md`, with the changes in section 12 below.

## 1. Founder decisions (October 9, 2026)

1. **Build the Instant Screens design on all three platforms and the server**, as four sessions working in parallel, one per codebase.
2. **Mailbox is off for launch.** It goes behind a new launch flag, `mailbox`, and the Mail tab becomes **Messages**: Place · Today · Nearby · Messages. Mailbox comes back after people and businesses sign up. This replaces the September 16 decision "Navigation stays Place · Today · Nearby · Mail".
3. **Choice 1, yes.** Owners and household members see the last copy of a Home screen while their access is re-checked. Guests, service providers and anyone whose access expires keep today's blank-and-re-check behavior.
4. **Choice 5, yes.** The server checks sign-in tokens itself instead of asking Supabase on every request. The server's own session record stays the authority on sign-outs, so a signed-out session is refused within 15 seconds.
5. **The web runs in parallel with the phones** for this work. This sets aside the October 3 "web waits" rule for these changes only.
6. **Storage.** One limit covers photos and saved pages together: 100 MB by default, with a picker for 50, 100 or 250 MB. Saved pages take at most 20 MB of it.
7. **Message history stays off the phone** (choice 4). The Messages *list* (names, last-message previews, unread counts) joins the phones' saved copy.

## 2. Who owns what

| Session | Owns (edits only these) | Device |
|---|---|---|
| IS-iOS | `frontend/apps/ios/` | one simulator, "Pantopus ISI" |
| IS-Android | `frontend/apps/android/` | one emulator, `pantopus_ISA` on emulator-5580 |
| IS-Server | `backend/`, `supabase/`, and `docs/launch-scope-flags-2026-10-01.md` for the new key | none until the day 13 rebalance, then `pantopus_ISS` on emulator-5582 |
| IS-Web | `frontend/apps/web/`, `frontend/packages/` | browser only until the day 13 rebalance, then simulator "Pantopus ISW" |
| Coordinator | this file, the design and plan pages | none |

- **No session edits another session's folder.** If you need something in another folder, write it in `REQUESTS.md` (section 12) and message the owning session.
- **Day 13 rebalance (October 22).** Once IS-Server and IS-Web finish their own lists, IS-Server converts only `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/` and IS-Web converts only `frontend/apps/ios/Pantopus/Features/Homes/`. They follow the owning phone session's conversion recipe exactly. The owning phone session reviews every helper PR before it merges. Helpers never touch the store, the list shells, the network client, sign-out code or the tab roots.
- **Kit ports.**

  | Session | Backend | Web | Browse at |
  |---|---|---|---|
  | IS-iOS | 18301 | 18311 | `http://isi.localhost:18321` |
  | IS-Android | 18302 | 18312 | `http://isa.localhost:18322` |
  | IS-Server | 18303 | 18313 | `http://iss.localhost:18323` |
  | IS-Web | 18304 | 18314 | `http://isw.localhost:18324` |

  Stream ids are `ISI`, `ISA`, `ISS` and `ISW`, for example `$KIT/build-ios.sh $WT 18301 ISI` and `$KIT/devices.sh sim ISI`.
- **Test accounts.** Create them with `$KIT/seed-qa-user.py <ISI|ISA|ISS|ISW> <label>`. Credentials go to `accounts/<id>.env` (mode 600) and are never printed.

## 3. What people see (all platforms)

| State | Behavior |
|---|---|
| First visit | Each section appears as soon as its data arrives, with placeholders only where data is still missing. This is the only time a screen waits on the network. |
| Coming back | The screen as it was left, in the first frame: content, scroll position, filters, selection and open section. A quiet refresh may run, and changes update in place. No spinner or skeleton. |
| New items arrive | New posts or messages above the reading position wait behind a pill ("3 new posts", tap to scroll up). When the reader is at the top, they slide in. |
| A refresh fails | The content stays. If it is older than the kind's *max shown age* (section 4), one quiet line appears: "Couldn't refresh. Showing 3:42 PM." with Retry. A full-screen error appears only when there is nothing to show. |
| No signal | The existing offline strip, plus the saved copy. Actions that need the server say so instead of spinning. |
| Access ends | A 401, 403 or 404 on refresh deletes that entry at once and the screen shows the server's answer. "Session revoked" wipes everything (section 6). |
| Pull to refresh | Always fetches now. Shows the platform's pull indicator without blanking the screen. |
| Your own edits | Low-risk taps (like, save, mark read, task done) show at once as **pending**, then confirmed. If the server refuses, they roll back with a message. Money, identity, verification, access and invitations are never instant. |

Loading indicators: none for background refreshes. A skeleton appears only when there is no data at all.

## 4. Freshness table

Each kind of data has three separate settings, which must not be confused:

- **Fresh for:** inside this window, coming back sends no request.
- **Max shown age:** how old a copy may be and still be shown without the "Couldn't refresh" line.
- **Deletion:** when the copy is removed. That is the storage rules in section 7.

Data that is due for a refresh never disappears because it is due.

| Kind | Examples (client keys) | Fresh for | Max shown age | Saved on phone | Marked out of date early by |
|---|---|---|---|---|---|
| Public place facts | Place sections that don't depend on the viewer, civic districts, Ballot | 24 h | 7 days | Yes | topics `homes`, `place:{homeId}` |
| Today | weather, air, pickups, reminders, radon card | 10 min | 2 h | Yes | `today`, `home:{homeId}`, midnight in the **home's** time zone, the briefing push, coming back to the app after 15 min |
| Today alerts | weather and air alerts inside Today | 5 min | 30 min | Yes | same as Today. **A failed or out-of-date alert check is never shown as "no alerts".** Past the max shown age, show "Alerts unavailable · Retry". |
| Place | a home's facts for the viewer's role | 10 min | 1 day | Yes, owners and household roles only | `place:{homeId}`, `home:{homeId}`, role change |
| Homes and household | My Homes, a Home's dashboard, members, tasks | 2 min | 1 day | Yes, owners and household roles only, without the sensitive parts | `homes`, `home:{homeId}` |
| Nearby | first page of the feed, map cells, the density meter | 2 min | 1 day | First page only | own post; refresh results above the reading position go behind the pill |
| A post | post and comments | 1 min | 1 day | No | `post:{postId}` and own actions |
| Messages list | conversation list | 30 s | 1 day | Yes: names, last-message previews, unread counts | `message:new`, `chats`, reconnect |
| A conversation | messages in one chat | live | (memory only) | No (choice 4) | live events; on reconnect fetch with `after=` |
| Notifications | list and badges | 30 s | 1 day | No | `notification:new`, `badge:update`, `notifications` |
| You | own profile and settings | 10 min | 7 days | Yes | `profile:me`, own edits |
| Other people | profiles you open | 5 min | 1 day | No | follow, block, message |
| Support Trains | a train, its slots | 1 min | 1 day | No | `supporttrain:{trainId}` |
| Sensitive | access codes and Wi-Fi, emergency and medical, documents, bills, wallet and payouts, identity and verification, residency letters, payment methods | always re-checked | (never shown from a copy) | **Never** | n/a |
| Mailbox (off) | applies when Mailbox returns | 1 min | 1 day | List only, once the list reply is slimmed | `mail` |

These are starting values. Phase 1 logs how often each window is hit; the coordinator tunes the table, never a single platform.

## 5. Privacy tiers

| Tier | Covers | Memory | Saved on phone | Shown before the re-check |
|---|---|---|---|---|
| Everyday | public place facts, weather, Today, Nearby, your profile and settings | yes | yes | yes |
| Household | My Homes, a Home's dashboard, members, tasks, the Messages list | yes | yes (phones only) | Owners and household roles: **yes** (decision 3). Guests, service providers and any access with an expiry: **no**, keep blank-and-re-check, and never saved. |
| Sensitive | the "Sensitive" row above, plus any reply the server marks `no-store` that isn't on the allowlist | only while the screen is open | **never** | no, always re-checked |

Rules:

- **Allowlist, not "cache every GET."** Only the kinds in section 4 are kept, and only sensitive endpoints are named as never.
- **Scoped keys.** Every key is server (production, staging or a local build's API URL) + account + request path + parameters. Tokens never appear in keys, file names or logs.
- **Late replies dropped.** A reply that arrives after an account switch, a home switch or a newer local edit is dropped instead of overwriting. Reuse `HomeClaimSessionScope` on iOS and Android, and the request stamping in `frontend/packages/api/src/client.ts` on the web.
- **Access changes win.** A 401, 403 or 404 deletes that entry. A role or membership change (topic `home:{homeId}`) re-checks before the next display for expiring access, and in the background for owners and household roles.
- **Offline limit.** Offline, a phone can't learn that access was removed. Saved household copies are shown for at most 7 days, then deleted.
- **At rest on iOS.** Saved files live under `Library/Caches/` with `FileProtectionType.complete`. A file that can't be read while the phone is locked counts as missing.
- **At rest on Android.** Saved files live under `cacheDir`, never in backups. `allowBackup` stays false.
- **Web.** Nothing private is written to browser storage. The cache lives in memory (TanStack Query), and sign-out sends `Clear-Site-Data`.

## 6. The store (iOS and Android; TanStack Query on the web)

| Part | Rule |
|---|---|
| Key | server + account + method + path + sorted query |
| Entry | data, `fetchedAt`, ETag, kind (picks the window and tier), error state |
| Read | memory, then the saved copy (if the kind allows and it is under the max age), then the network. Content shows the moment any layer has it. |
| One request per key | concurrent asks share one in-flight request |
| Refresh | only when out of date or forced (pull to refresh, a topic, access check). Send `If-None-Match` with the stored ETag. **304:** keep the data and reset `fetchedAt` to now; show the revalidation time, not timestamps inside the body. **200:** replace and update in place, keeping row identity and scroll. **401:** the existing sign-in flow. **403/404:** delete the entry and show the server's answer. **Network error, or a 200 whose body says it failed** (for example Today's `{today: null, error}`): keep the data and mark the failure. |
| Short-lived links | signed photo links inside saved data are refreshed when the screen shows and never trusted from a saved copy |
| Mark out of date | by topic (section 8), from own edits, `sync:changed`, notifications, pushes, reconnect, coming back to the app after 15 min, and midnight in the home's time zone for Today |
| Wipe | sign-out (every path: iOS `clearLocalSession`, Android `finishLocalSignOut`, web query provider), session ended or revoked, account switch, account deleted, Clear cache. A wipe bumps a generation number so replies already in flight can't write into the new state. |
| Memory | at most 200 entries; entries unused for 30 min are dropped; trim to what's on screen when the phone warns about memory |
| Saved copy | per account folder; JSON with a schema version and the app build; at most 20 MB; least recently used goes first; nothing older than 7 days is read; a copy that doesn't decode is deleted |
| Images | one budget with saved pages, 100 MB by default (50, 100 or 250); least recently used goes first; unopened for 30 days goes; videos, original-size photos and documents are never cached automatically; wiped at sign-out |
| Screens | screens read from the store and never keep their own copy. Convert the shared shells first: iOS `ListOfRowsView` and `GroupedListView`; Android `ListOfRowsScreen` and `GroupedListScreen`. |

## 7. Storage & data screen

- **Settings row.** iOS: group "This iPhone", row "Storage & data", subtext "Photos and saved pages", the size on the right ("62 MB"), placed after Notifications. Android: the same, with group "This phone". Web: a "Storage & data" section in Settings.
- **Screen title:** "Storage & data". **Total:** the size, with "Pantopus on this iPhone" or "Pantopus on this phone" under it. **Meter:** three segments in this order: photos, saved pages, drafts.
- **Rows:**
  - "Photos and images", subtext "From posts, messages and homes you opened"
  - "Saved pages", subtext "So your tabs open instantly and offline"
  - "Drafts and uploads in progress", subtext "Kept until you send or finish them"
- **Button:** "Clear cache (60 MB)", showing the amount that will be freed.
- **Footnote under the button:** "Nothing in your account is deleted. Your homes, messages, posts and unsent drafts stay. Pages load from the internet the next time you open them."
- **Confirmation:**
  - title "Clear 60 MB?"
  - body "Your homes, messages, posts and unsent drafts stay. Photos and pages download again when you open them."
  - buttons "Clear cache" and "Cancel"
  - **Afterwards:** a toast, "Cleared 60 MB".
- **Automatic cleanup:**
  - row "Keep up to", value "100 MB", opening the picker (50 MB, 100 MB, 250 MB)
  - footnote "At the limit, the oldest photos go first. Anything you haven't opened in 30 days goes too."
- **Sign-out confirmation** adds: "Signing out removes what Pantopus saved on this phone."
- **Android only.** `android:manageSpaceActivity` opens this screen from the system's "Manage space" button. Sizes come from `StorageStatsManager` plus the app's own folder sizes.
- **Web section:**
  - body: "Pantopus keeps the pages you've opened in this tab's memory so going back is instant. It doesn't save your homes or messages in this browser."
  - second paragraph: "Signing out clears everything Pantopus kept in this browser. If you use a shared computer, sign out when you're done."
  - button "Clear saved data in this browser"
  - toast "Cleared. Pages will load fresh."
- **Never cleared by Clear cache:** drafts, uploads in progress and unfinished actions (refund and stop records), the sign-in, and settings.

## 8. Topics and the change signal

Topic names (strings):

- `homes`, `home:{homeId}`, `place:{homeId}`, `today`
- `chats`, `chat:{roomId}`, `notifications`
- `profile:me`, `post:{postId}`, `supporttrain:{trainId}`
- `mail` (dormant while Mailbox is off)

What happens, and what goes out of date (the client marks these; the server emits the same topics to everyone affected):

| Event | Topics |
|---|---|
| a task is created, changed, done or deleted | `home:{homeId}`, `today` |
| someone joins, leaves or changes role in a household | `home:{homeId}`, `homes`, `today`, `place:{homeId}` |
| a home is added, claimed or verified, or a place is saved or removed | `homes`, `place:{homeId}`, `today` |
| pickup days, holiday rules, calendar or briefing preferences change | `today`, `home:{homeId}` |
| a home's access codes, documents or emergency info change | `home:{homeId}` (sensitive parts always re-check anyway) |
| a chat is created or left | `chats` |
| a message is sent or read | `chat:{roomId}`, `chats` (plus the existing `message:*` and `badge:update`) |
| a notification is created or read | `notifications` (plus the existing `notification:new` and `badge:update`) |
| own profile or settings change on another device | `profile:me` |
| a Support Train slot is signed up for or changed | `supporttrain:{trainId}` |

**`sync:changed` (new socket event, IS-Server).** It is emitted to each affected user's existing user room. The payload carries topic names only:

```json
{ "topics": ["home:3f2c…", "today"], "at": "2026-10-10T17:00:00.000Z" }
```

- **No content and no names in the payload.**
- **Background jobs** run in the worker container, which has no socket server. They publish to the API process, through Postgres `NOTIFY sync_changed` or an internal call, and the API process emits.
- **Clients** mark matching entries out of date and refresh only what's on screen. After any socket reconnect, they mark all Household, Messages and Notifications entries out of date to catch up on missed signals.
- **Older apps** ignore the event; nothing depends on it arriving.

Other server interfaces, all additive:

- **`badge:update`** keeps `{unreadMessages, totalMessages, pendingOffers, notifications}`. The Messages tab badge shows `unreadMessages`. With `mailbox` off, no mail counts.
- **`message:new`** gains the other participant's id, so lists update the row in place without refetching the conversation list. Chats created through the REST API join both people's live connections.
- **ETags.** Express already sends them. IS-Server makes Today and Place replies hash without their volatile timestamps (`fetched_at`, `meta.total_latency_ms`, `generated_at`), keeping those fields in the body, so unchanged data returns 304.
- **Today on the phones** asks `GET /api/homes/:id/intelligence` for only the sections Today renders (`?sections=`, which the route already accepts). IS-iOS and IS-Android list the sections in their PR, and IS-Server confirms the content for those sections is identical.
- **"Only what's new."** `GET /api/notifications?after=<id|ts>` and conversations `?since=<ts>`, both additive.
- **Signed-in GETs** default to `Cache-Control: private, no-store`, from privacy PR 2005. Phones and browsers must not keep their own HTTP copies of API replies; only the store keeps copies.
- **Compression.** Add Express `compression` (the dependency is approved by this plan; tell L4 in REQUESTS).
- **Sign-in check (decision 4).**
  - Verify the access token's signature, expiry, audience and issuer on the server with `jose` (already a dependency). Use the project's published JWKS when the project signs with asymmetric keys. If it signs with the shared secret, the secret must be in the server's environment: locally from the kit; on staging and production it is a founder step, so write it in FOUNDER.md and keep `getUser` until it is set.
  - Keep `checkSessionPolicy` (the AuthSession revocation check with its 15-second cache and the `sessions_valid_after` watermark) on every request, along with the existing 503 "busy" mapping.
  - Fall back to `getUser` when local verification can't decide, for example an unknown key id.

## 9. Mailbox off and the Messages tab

The new launch key is `mailbox`. It is off unless listed, the same mechanism as the nine keys in `docs/launch-scope-flags-2026-10-01.md`: backend `LAUNCH_FEATURES`, web `NEXT_PUBLIC_LAUNCH_FEATURES`, iOS `PANTOPUS_LAUNCH_FEATURES`, Android `PANTOPUS_LAUNCH_FEATURES`. Tests keep running with every feature on.

| What | With `mailbox` off |
|---|---|
| Tab | Visible label **"Messages"** with a chat-bubble icon from each platform's icon set. It opens the conversation list directly: no Mailbox/Messages switch. Its badge counts unread messages. Internal names and accessibility/test identifiers stay as they are (for example `RootTab.mail`), so UI tests and tools keep working. |
| Hidden | Incoming, Counter and Vault; the Me / Home / Biz drawers; letters and the item detail; My mail day; vacation hold; mail search; the Hub's mail tile and "Scan mail" chip; mail rows in Today, the Hub and activity; mail notification settings. |
| Server | No mail notifications, pushes or emails. No mail in badge counts or lists. Mail Day and other mailbox jobs skipped with `skipForLaunchCut`. No mail rows in Hub, Today or the briefing. |
| Links | Phones: mailbox deep links and mail pushes land on the existing "not in the app yet" placeholder. Web: `/app/mailbox` (with any query) redirects to `/app/chat`, and other `/app/mailbox/*` pages go to `/app/place`, as cut pages already do. |
| Kept | Address verification by postcard ("Verify your address by mail"), home permissions, all Mailbox code behind the flag. |
| Records | IS-Server adds the tenth key to `docs/launch-scope-flags-2026-10-01.md`. L4 records the decisions in NEXT_STEPS. L4 retakes the store screenshots (they show "Mail") for the founder's approval. |

## 10. Measuring and checking

- **Tab loop.** Each platform scripts: Place → Today → Nearby → Messages → back to Place, five rounds; then a cold start; then the same with airplane mode.
- **Conditions.** The backend runs slowed to staging's speed (`NODE_OPTIONS=--require <L4 tools>/dbdelay.cjs`, 60 ms per database call, from `~/.config/pantopus/launch-kit/streams/L4/tools/`). The network is throttled: Android `adb emu network delay`/`speed`; iOS the Network Link Conditioner profile if available, otherwise say so; web uses Chrome throttling through Playwright.
- **Metrics.** Record requests per visit (from the backend log) and time from tap to content (from a debug log line or the screen recording). Put before and after numbers in every PR.
- **Real-app checks for each PR** where they apply: leave and come back, relaunch, airplane mode, sign out and sign in as another account, a second household member changing something on another device, Clear cache while a screen loads and a draft is open, and a low-memory warning.
- **Privacy check.** After visiting sensitive screens, and again after signing out, list the app's cache folders. Nothing from the account should remain, and no sensitive reply is ever on disk.
- **Tests.** No new unit tests. Existing tests that break because the intended behavior changed are updated in the same PR. Snapshot images are re-recorded when a screen's look changes. Run the platform's lint before pushing: SwiftLint and SwiftFormat; ktlint and detekt; web ESLint, typecheck and Jest; backend Jest near the change.

## 11. Milestones

| Date | Milestone |
|---|---|
| Oct 12 | D1: Messages tab live on all three platforms with Mailbox hidden; Today keeps its content on both phones; Android conversations stop flashing |
| Oct 18 | M1: tabs and main screens never blank on iOS and Android, with before and after numbers |
| Oct 21 | M2: server and web lists complete |
| Oct 22 | M3: phones open on their saved copy, even in airplane mode; Storage & data on phones |
| Oct 29 | M4: everything converted; final sweep (L4) |

## 12. Process changes for these four sessions

- **Base rules.** RULES.md applies, with folder ownership (section 2) replacing area ownership for loading, caching and storage code. For a screen in another stream's area, check that stream's open PRs first, merge master often and leave a note in REQUESTS.md.
- **Status files.** Each session keeps `/Users/yingpengwang/skinny-pantopus/launch-streams/status/IS-<iOS|Android|Server|Web>.md`, at most 40 lines, updated after each merge.
- **Questions about this contract** go to the coordinator session by message. Don't change the contract on your own.
- **Files with open privacy PRs.** Before editing them, merge master; if the PR is still open, wait for it or coordinate with its session:
  - iOS `Core/Networking/APIClient.swift`, `Core/Auth/AuthManager+Session.swift`, `App/AppDelegate.swift`
  - Android `di/NetworkModule.kt`, `data/auth/AuthRepository.kt`, `PantopusApplication.kt`
  - backend `app.js`
  - The PRs: 2005 (API replies off disk), 2002 and 2004 (sign-out purge), 2000 (Android image loader), 1998 (chat image token).
- **Do the work yourself** (RULES §12): no subagents or workflows for code, builds or app testing.
