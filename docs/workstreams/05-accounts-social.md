# STREAM 5 — Accounts and Social (formerly Stream 3; renumbered 2026-09-30)

> **Renumbering (user direction, 2026-09-30):** the former Streams 1 and 2 are each being split in two (Streams 1–4), so this stream, formerly **Stream 3**, is now **Stream 5**. Its scope, accepted evidence, decisions, kit and runtime are unchanged. This file moved from `03-accounts-social.md`.
> - Everything below dated before 2026-09-30 keeps the old name ("Stream 3", "S3"); read it as Stream 5.
> - Paths, branches, audit bundles and UX-inventory IDs that contain `stream3` or `S3-` keep their names.
> - Stream 5 owns this file in the coordination checkout. Its resume prompt is [NEXT-STREAM5-PROMPT-2026-10-01.md](NEXT-STREAM5-PROMPT-2026-10-01.md) (it replaces the 2026-09-30 one).

# CURRENT STREAM 3 STATUS — 2026-09-25/26 peer session (supersedes the 2026-09-22 summary below)

Stream 3 is an independent peer. It reports to the user; Stream 1 runs the serial merge queue. This is the live Stream 3 status location; the detailed history below stays as it was.

## LIVE — #1274 (briefing pushes honor the Push switch) sealed; #1277 (dialogs cover the header and sidebar) in CI; #1270 waits on iOS runners and Stream 1's devices, 2026-10-01T07:39:39Z

- **Sealed and with Stream 1: #1274** (backend; seal `fcc41a28…`; CI 36829839687 green).
  - The web Settings "Push Notifications" switch (`MailPreferences.push_notifications`) is honored by notificationService and chat pushes.
  - `internalBriefing.js`'s briefing (`/send`), weather/AQI (`/alert-push`) and reminder (`/reminder-push`) pushes ignored it. Now each checks `isPushEnabled` (exported). `/send` skips `push_disabled` and keeps the text.
  - Proof on the real endpoints, with the switch set through the real Settings page: master with the switch off sends 3 pushes; the head sends 0 off and 3 on. Stream 2 has been told.
  - **Decision:** security notices still push with the switch off (safety; email is their main channel).
- **In CI: #1277** (web, head `0e32a7521`). Six Stream 5 dialogs now portal to `document.body` (SlidePanel's pattern): ModalShell (incl. Security's step-up), ReportModal, AccountDeleteModal, Create/Edit Seat, and the chat page's Start new chat. ModalShell and ReportModal go to z-[60].
  - AppShell's `<main>` (`relative z-0`) had kept them under the header, sidebar and "+" button, which stayed clickable.
  - elementFromPoint probe: shell on top in 6/6 on master; the overlay on top in 6/6 on the head. Escape still closes each one.
  - Cards are pixel-identical in 4/6; the seat cards differ only at the corners.
  - 71 other files share the pattern (list in the bundle), sent to Stream 1 for their owners.
  - **Decision:** a modal dims and blocks the whole app, not just the page area.
- **#1270** (security notices open Devices): iOS CI jobs are queued (macOS capacity) and Android is running. Stream 1's candidate `3326f3ecc` has the device check queued. Seal after both.
- **Backlog check:** `getPostingIdentities`' broken BusinessProfile query only costs crew logos in the "Post as" picker (the seat path still lists crews), so it's cosmetic and stays low. The orphan `/app/chat/new` and `MessageActionMenu` are dead code, so no change.
- **Runtime:** API on master `dc878ddb5` (07:30:50Z); web on `0e32a7521` (#1277's head) after the after-run. No fixtures remain.

## LIVE — #1256 (b272), #1261 (b274), #1265 (b276) merged; #1270 (security notices open Devices) on Stream 1's devices; runtime hollowed by the macOS tmp sweep and repaired, 2026-10-01T07:12:50Z

- **Merged:** #1256 (crew Stripe return, b272), #1261 (monthly summary email opt-out, b274, ahead of today's 17:00Z run), #1265 (crew page editor row names, b276; master `dc878ddb5`).
- **Open: #1270** (iOS + Android + backend). Security notices ("New sign-in on …", device removed, password changed, security sign-out) led nowhere on the phone:
  - the push sent its destination only under `url`, and both apps route taps from `link`;
  - neither router mapped `settings/security`;
  - Android's App Link filter takes every pantopus.com path, so the email's "Review your devices" opened the app and stopped.
- **#1270's fix:**
  - the push adds `link: '/app/settings/security'`;
  - iOS `settings/security` → `SettingsView(initialRoute: .securityDevices)`;
  - Android `settings/security` → `MENU` then `SETTINGS_DEVICES`.
- **#1270's proof so far:**
  - The real notices on the runtime, with the push captured: master pushes have no `link`, and the head's carry it. No DB writes.
  - Backend: gates OK; Jest 341 suites and 6286 tests pass.
  - CI is running. Stream 1's candidate `3326f3ecc` holds the device check: the iOS "before" (openurl does nothing) is recorded; the after runs on both apps. The simulated push can't run on Stream 1's sim (no notification permission).
  - Seal after the device bundle.
- **Infrastructure (07:00Z): macOS `com.apple.tmp_cleaner`** deletes every `/private/tmp` file untouched for 3 days, nightly at local midnight. It hollowed both Stream 5 runtime trees: `node_modules/.pnpm`, the worktrees' `.git` pointer files, and about 8,000 tracked files each. Stream 1 lost `verify-bundle.py`.
  - **Repaired:** `git worktree repair`, restoring only the deleted tracked files, then `pnpm install --offline` (nothing downloaded). The API and web were restarted on master `008613b81` (receipts 07:05:27Z and 07:09:42Z), and a signed-in smoke check passed.
  - The launchers are backed up in the kit's `runtime-launchers-backup/`, and the runtime files' atime was refreshed.
  - Recovery recipe: memory `pantopus-tmp-cleaner`. Stream 1 relayed the warning to Streams 2–4. Moving the runtimes out of `/private/tmp` is the user's call.
- **Seen, not changed:**
  - **Replaced photos stay in storage.** The crew logo/banner route (`upload.js` `/business-media`) and the personal photo route both keep the replaced file in storage, so an old photo stays reachable at its URL. The personal route's "Delete old profile picture" comment has no delete. Deleting could break saved URLs, so this is a design call.
  - **Floating buttons overlap the editor.** The app's floating chat and "+" buttons overlap the crew page editor's settings panel and partly cover "Delete block".
- **Runtime:** API 18134 and web 18131 on master `008613b81`. No fixtures remain.

## LIVE — #1238 (b270) and #1253 (b271) merged; #1256 (crew Stripe return) sealed; #1261 (monthly summary email opt-out) in CI; app-wide page-health scan clean, 2026-10-01T06:36:50Z

- **Merged:** #1238 (Android View as "Not shown", batch 270, master `7c249e7d3`); #1253 (web profile Connect, batch 271, `12013a711`).
- **Sealed and with Stream 1: #1256** (seal `e332e433…`, backend only, no device run).
  - Crew owners who finish or refresh Stripe onboarding from the native crew Payments screen now return to `/app/businesses/<id>/dashboard?tab=payments`. They used to land on `/app/businesses/<id>?tab=payments`, which is a 404 on the web.
  - The Stripe hop itself is unverified: Stripe is disabled on the runtime. Stream 2 has been told (payments area).
- **In CI: #1261** (the monthly summary email, `monthlyReceiptJob`, which runs on the 1st at 17:00 UTC). It is the only recurring email in scope that isn't transactional, and nobody could turn it off:
  - its "Unsubscribe from monthly receipts" link was `/settings/notifications`, a web 404;
  - the job checked only `MailPreferences.email_receipts`, which no screen or API sets;
  - the account's Email Notifications switch (web Settings) was ignored;
  - a failed preference read counted as a yes.
- **#1261's fix:**
  - the job also honors `email_notifications`, and sends nothing when the read fails;
  - the link opens `/app/profile/settings`;
  - the switch's description reads "Receive email updates, like your monthly summary" (it was "gigs and bids", which describes no email the app sends).
- **#1261's proof** (the real job for hs12 with the transport captured, plus the real Settings page and API): on master, the link is a 404, and the email still goes out with the switch off. On the head, the link opens Settings; switch off, saved and read back; the job then sends 0 emails.
  - **Decision (standing direction):** use the existing account switch rather than add a new "monthly summary" control. No new control, no API change. `email_receipts` is still honored.
- **Seen, not changed:**
  - **No web summary view.** The email's "Share your Pantopus month" button and the web notification both redirect to `/app/profile`, which doesn't show the summary. iOS and Android do show it. Deferred: the summary's content is mostly Gigs and Marketplace numbers (launch cuts #3 and #4), which is the user's call.
  - **`emailed_at` on failed sends.** The job sets it even when the send fails.
  - **The one-off P0.2 display-name notice** (`p0-2-send-display-name-migration-emails.js`): its "Settings → Profile" link `/settings/profile` is a 404, and no client can change the display name it mentions. Fix both before any rerun.
- **Scan:** the app-wide web page-health scan (45 static, in-scope pages as hs12) found no new defect (`20261001-stream5-app-page-health-r1`).
- **Runtime:** API 18134 and web 18131 both on `a9d195999` (#1261's head; API receipt 06:30:37Z). No fixtures remain: every row from the runs was removed or restored by exact id, and the state equals the pre-run state.

## LIVE — #1243 (b267), #1244 (b268), #1251 (b269) merged; #1238 sealed (devices pass); #1253 web profile Connect in CI; landlord findings routed, 2026-10-01T05:56:21Z

- **Merged:**
  - #1243 (name card, batch 267, master `361f07042`);
  - #1244 (Discover connect, batch 268, `7a42f1d7a`);
  - #1251 (crew forms part 2: Legal tab, new crew wizard, location Hours page; batch 269, `a411def0e`).
- **Sealed and with Stream 1: #1238** (Android View as "Not shown"; seal `5d3c63f2…`).
  - Devices pass, from Stream 1's `20261001-stream1-android-1238-1242-r1` (TalkBack: "Not shown. Verified neighbor"; a shown badge reads its name only).
  - Sealed with `seal-pr-explained.sh`: the red unit job is master's Pulse snapshot from #1209.
- **In CI: #1253** (the web public profile gets Connect, as the apps have it).
  - Connect / Requested (disabled) / Accept / Connected, with Connections' removal confirmation. It shows only after a successful relationship read, never for a blocked person, the owner or a signed-out viewer.
  - The full loop passed through the real API between hs12 and hs12b: request 201, Requested persists; accept 200, Connected; Cancel sends nothing; Remove sends the DELETE (200); then Connect.
  - **Decision:** adding a control under the user's no-approval-gate UX direction, copying the apps' design and copy.
- **Seen, not changed:** the API's accept creates mutual follows and a block deletes them, but `DELETE /api/relationships/:id` keeps them. Since `followers` visibility maps to connections, the privacy impact looks small. Recorded for a product call.
- **Routed via Stream 1 to Stream 3:** the landlord portal's "End Lease" (ends the lease and notifies the tenant) and staff "Remove" (failure only console-logged) act in one click with no confirmation.
- **Handoff:** [NEXT-STREAM5-PROMPT-2026-10-01.md](NEXT-STREAM5-PROMPT-2026-10-01.md) is written. The scan tools are in the kit's `tools/stream5-e2e/` with README notes.
- **Runtime:** API 18134 on `7a42f1d7a` (receipt 05:45:46Z); web 18131 on `b37d34d09` (#1253's head). No fixtures remain: the run's 2 notifications and 2 follows were removed by exact id, and the state equals the pre-run state.

## LIVE — #1230 #1234 #1236 merged (batch 266); #1243 (name card) sealed, #1244 (Discover connect) in CI, #1238 (Android) waits for devices; master Android unit test broken by #1209 (Stream 2 re-recording), 2026-10-01T05:24:30Z

- **Merged in batch 266** (PR #1240, master `2abd0edd4`): #1230 (chat Report under the drawer), #1234 (ModalShell semantics), #1236 (five Stream 5 dialogs).
- **Sealed and with Stream 1: #1243** (seal `83b9ddaf…`): the name card (`UserIdentityLink`: chat senders, post authors, crew reviews).
  - **Before, on master:**
    - Message went to `/app/chat?room=<id>`, which the chat page ignores, so it landed on the Messages list;
    - one click on "Connected" removed the connection with no confirmation;
    - rejected Message, Follow and Connect showed nothing.
  - **After:**
    - Message opens `/app/chat/conversation/<id>`;
    - "Connected" asks Connections' own "Remove this connection?";
    - failures toast the server's reason.
- **In CI: #1244** (`/app/network` people results): the same one-click disconnect and silent failures, with the same fix. Its business Follow is cut #6 and was left alone.
- **Waiting for devices: #1238** (Android View-as "Not shown"). Its red unit-test job is master's own (next item); its instrumented job passed.
- **Master's Android unit tests have failed since batch 264:**
  - `PulseComposeSnapshotTest.pulse_compose_edit_prefilled` fails. Stream 2's #1209 changed the Pulse edit rendering without re-recording the golden; its own PR run 36810090384 already failed it.
  - Reported to Stream 1 and Stream 2. Stream 2 is re-recording the golden, and Stream 1 batches that first.
- **Scans with no new defect** (scratchpad AST scans over 115 Stream 5 web files on master):
  - `try/finally` with no `catch` around api calls: only the name card's two handlers (#1243).
  - Destructive api calls with no confirmation: only the name card's disconnect. The others are by design: declining a request, unblocking, dismissing a notification and unfollowing are one-tap; account deletion is confirmed upstream by its modal and the step-up.
  - The native Connections and profile screens already confirm a disconnect on iOS and Android, so the web was the odd one out.
- **Candidates:**
  - **(design call)** the name card opens only on mouse hover, so keyboard and touch users can't reach its Connect/Follow/Message.
  - **(design call)** the web public profile has no Connect button: it never had one, while the Android profile does. Connecting on web is only possible from the hover card or Discover.
- **Decisions:**
  - A removal is confirmed with Connections' own wording on every web entry point.
  - Failures show the server's reason, the EndorsementButton and profile pattern.
- **Runtime:** API 18134 on `2abd0edd4` (receipt 04:58:53Z); web 18131 on `7453a617b` (#1244's head). No fixtures remain.

## LIVE — #1226 + #1228 merged (batch 264); #1230, #1234, #1236 sealed and with Stream 1; #1238 (Android) waits for its device check; page-health scan clean, 2026-10-01T04:55:02Z

- **Merged in batch 264** (PR #1233, master `51634ec30`):
  - **#1226:** Stream 2's post-page media viewer, portaled, with Escape and names.
  - **#1228:** Stream 4's mail list Star, shown on keyboard focus. The row ignores its inner controls' keys, so Enter on Star stars the mail and Enter on Open follows the link.
- **Sealed and with Stream 1** (against master `ea52073b9`):
  - **#1230** (seal `5e258397…`): chat Report from Chat details opened UNDER the drawer, whose backdrop took the first click. Report now closes the drawer. The drawer and ReportModal are named dialogs that Escape closes (the drawer leaves Escape to a Block confirmation over it), and the reasons get `aria-pressed`.
  - **#1234** (seal `65b99834…`): the shared ModalShell becomes a named dialog with a close button named "Close". This follows Stream 1's conditions: semantics only, verified through the password step-up, and the gig-detail callers (cut #4) not exercised.
  - **#1236** (seal `5eb7fcc2…`): five Stream 5 dialogs become named dialogs that Escape closes. Delete account is an `alertdialog` whose "Type DELETE to confirm" label is tied to its field. The others: Start new chat, the chat image viewer, Create Seat & Invite, Edit Seat.
- **Waiting for Stream 1's device check: #1238** (Android View as). A hidden badge now carries `stateDescription` "Not shown"; TalkBack used to read just "Verified neighbor". Bundle `20261001-stream5-android-viewas-badge-r1`, with a device TODO.
- **Page-health scan, no PR** (`audits/20261001-stream5-page-health-scan-r1`): 17 Stream 5 web pages.
  - The only unexpected error is a dev-mode Next.js app-router error during the legacy `/app/businesses/new` server redirect on a full page load. The page recovers, and the users' links are clean.
  - The proxy-refused implicit-write GETs (privacy settings, identity center, view-as) are the known harness boundary.
- **Stale rows:** the older candidate table's S3-22 (hero CTA buttons), S3-37 (iOS banner/logo upload), S3-59 (iOS review-reply toast) and S3-62 (endorsement error toast) are already fixed on master.
- **Decisions:**
  - Dialogs get semantics and Escape (equal to each dialog's own Cancel/Close), with no focus trap and no change to outside clicks.
  - A destructive confirmation is an `alertdialog`, the global ConfirmDialog's pattern.
  - A nested overlay that covers its child is fixed by closing the parent (Report).
- **Runtime:** API 18134 on `ea52073b9` (receipt 04:36:57Z); web 18131 on `ea52073b9`. No fixtures remain: every room, crew and mail fixture was removed by exact id, with references checked.

## LIVE — #1195 #1200 #1192 #1196 #1206 #1208 #1216 #1217 merged (to batch 263, master `65de05db7`); cross-stream help: #1226 (Stream 2's post viewer) and #1228 (Stream 4's mail list Star) in CI, 2026-10-01T04:18:00Z

- **User direction (2026-10-01, ~03:40Z):** keep working while there is work, and help debug and fix other workstreams. Cross-stream fixes go through Stream 1's routing, and the owning stream is told before its file is touched.
- **Merged** (Stream 1 verified every seal):
  - **#1195** (03:04Z): the web crew page editor; a block's settings open from the keyboard, and its toolbar shows on focus.
  - **#1200** (03:13Z): a notification's Remove ✕ shows on keyboard focus.
  - **#1192 + #1196** (03:24Z): a hidden block's row says "Hidden from visitors" (iOS, Android); the iOS crew Pages back and delete buttons are named. Sealed against Stream 1's device bundles.
  - **#1206 + #1208** (03:38Z): the tab bars of the crew page, public profile and Connections say which tab is selected; profile and privacy fields are named by their labels.
  - **#1216 + #1217** (batch 263, PR #1227, 04:03Z, master `65de05db7`):
    - #1216: `verified_resident` means a verified, unexpired residency, not a confirmed email. Found by Stream 2. The chat Local Profile select was also repaired: it named 4 nonexistent columns, so every chat member's Local Profile and badge opt-out was ignored. Devices pass in Stream 1's `20261001-stream1-backend-1216-devices-r1`.
    - #1217: the crew tools' form fields are named by their labels.
- **In CI, then sealed and sent to Stream 1:**
  - **#1226** (Stream 2's `feed/post/[id]/page.tsx`; Stream 2 acked, no edits of theirs there), bundle `20261001-stream5-post-viewer-r1`, RESULT written.
    - **Before:** the post page's image viewer rendered inside `<main>` (z-0). The header's Profile avatar covered its Close, the sidebar's nav covered its Previous, the floating buttons painted over it, and Escape did nothing.
    - **Fix:** portaled (the #1182 pattern); Escape closes it; `dialog` "Full size media"; the buttons are named.
    - 0 differing pixels in the viewer's own area.
  - **#1228** (Stream 4's `mailbox/_components/MailListItem.tsx`), bundle `20261001-stream5-mail-star-keyboard-r1`, RESULT written.
    - **Before:** the list row's Star was opacity 0 on keyboard focus. The row's Enter/Space handler also caught keys on its inner controls, so Enter on Star opened the mail instead of starring it, and Enter on Open opened it in the pane instead of following the link.
    - **Fix:** the row handles only its own keys, and the Star gets `focus-visible:opacity-100`.
    - At rest, only the relative time differs.
- **Stream 1's hover-only list, resolved:** `components/MediaGallery.tsx` and `components/home/QuickAccess.tsx` are rendered nowhere: QuickAccess is only re-exported by an unimported barrel, and nothing references MediaGallery (#1228's `builds/unused-components-grep.txt`). Not changed; dead-code candidates for their owners.
- **Candidates recorded, not fixed:**
  - **`find_homes_nearby`** is called by `magicTask.js:601` and `urgentFanoutService.js:50` (both launch cut #4) and by `geospatialQueries.findHomesNearby`, which nothing calls. The function doesn't exist: its SQL is only a comment in `geospatialQueries.js`, there's no migration, and the runtime DB has no such function. Out of launch scope.
  - **Android View as** marks a hidden badge only visually: TalkBack reads "Verified neighbor", while iOS says "not shown" (Stream 1's #1216 run). Stream 5 identity; next native batch.
  - **For Stream 4:**
    - A starred mail's star shows only on hover in the web list (a visual call).
    - `GET /api/mailbox/v2/p3/mailday/summary` writes a `mailday_summary_viewed` event on every mailbox load (My Mail Day is cut #8).
    - `GET /api/mailbox/v2/item/:id` marks a mail opened, by design.
  - Older ones stay as listed below.
- **Decisions:**
  - Overlays leave `<main>` by portal. Hover-only controls get `focus-visible`, and their keyboard activation is repaired in the same PR when it's broken.
  - Dead components are not edited.
  - Launch-cut features are noted, not fixed.
- **Runtime:** API 18134 on `65de05db7` (receipt 04:05:34Z); web 18131 on `2279c88e3` (#1228's head). No fixtures remain: the post and the mail were deleted by exact id, and the mail tables equal their pre-fixture counts.

## LIVE — #1182 (b251) and #1190 (b253) merged; #1195 (page editor keyboard) sealed; #1200 (notification Remove focus) in CI; native #1192 + #1196 wait for Stream 1's candidate, 2026-10-01T03:04:03Z

- **Merged:**
  - batch 251: #1182 (chat image viewer + Chat details drawer portaled above the app chrome; 10 chat controls named; reaction button visible on focus);
  - batch 253: #1190 (Privacy/account toggles are named switches with state; settings back buttons and the notification close named).
- **Sealed and handed: #1195** (web crew page editor), head `09621511b`, CI 36808007677, seal `49e78742…`, bundle `20261001-stream5-page-editor-keyboard-r1`.
  - A block's settings opened only by mouse, and its toolbar was invisible on keyboard focus.
  - Now the type chip is a button, "Edit hero block", with the same look, and the toolbar shows on focus-within.
- **In CI: #1200** (web notifications), bundle `20261001-stream5-notification-remove-focus-r1`. The Remove ✕ on `/app/notifications` and in the bell was opacity 0 on keyboard focus; now `focus-visible:opacity-100`.
- **Native, waiting for Stream 1's next candidate:**
  - **#1192** (iOS + Android): a hidden block's row says "Hidden from visitors". This is Stream 1's 1158 finding.
  - **#1196** (iOS): the crew Pages screen's back and delete buttons are named.
  - Scans found nothing else unlabelled. The iOS EditFabs are labelled at their call sites, and Android has 0 unnamed IconButtons in Stream 5 screens.
- **Checks with no defect** (`audits/20261001-stream5-notification-links-r1`): every backend notification `link:` template was run through the web resolver and matched against the `page.tsx` routes. There are no dead links in Stream 5's area. `/chat/:id` is a native push payload; `/invite/lease` has a `next.config` redirect.
- **Decisions:**
  - The seat dialogs aren't portaled. Many centred dialogs share the backdrop extent, and a global fix belongs in the shared AppShell; I portaled only the overlays whose controls were covered.
  - Hover-only controls get `focus-visible`/`group-focus-within` variants, never new controls.
- **Kit:** `stream3-runtime-kit/tools/stream5-e2e/` now has `seal-pr.sh`, `seal-pr-explained.sh`, `storage-cleanup.py`, `unnamed-buttons.cjs`, `unnamed-links.cjs` and `notif-link-scan.cjs`, with README notes (proof recipes and runtime gotchas).
- **Candidates left:**
  - The notification rows (page and bell) are `role="button"` containing the Remove `<button>`, a nested interactive. Fixing it is a restructure.
  - The seat dialogs' backdrop extent (shared AppShell fix).
  - `getPostingIdentities` drift; the logo route keeps the replaced File; web portfolio upload parity.
- **Runtime:** API 18134 on `ddd5f96b7` (receipt 02:48:47Z); web 18131 on `3d93fe03e` (#1200's head). No fixtures remain.

## LIVE — whole sweep backlog merged (#1158 in batch 250); a11y + overlay sweep: #1165/#1167/#1168/#1170 merged (batch 248), #1182 (chat overlays + names) sealed, #1190 (privacy switches) in CI, 2026-10-01T02:43:51Z

- **Merged:**
  - batch 248: #1165 (Connections: a person's card is a real profile link; keyboard users can open a requester's profile before Accept/Decline), #1167 (Getting Started arrows named after their task), #1168 (empty crew Reviews tab uses the native wording instead of "Be the first to leave a review!"), #1170 (four crew-tools close buttons named);
  - batch 250: #1158 (native 4b, no Padding/Background chips), sealed against Stream 1's device bundle `20261001-stream1-native-1158-1159-1161-devices-r1`.
  - Stream 1 verified every seal.
- **Sealed and handed: #1182** (chat), head `187d7d0af`, CI 36805798401, seal `d4826d8b…`, bundle `20261001-stream5-chat-icon-names-r1`.
  - **Functional:** the chat image viewer and the conversation's "Chat details" drawer rendered inside AppShell's `<main>` (`relative z-0`, its own stacking context). The fixed header and sidebar (z-50) covered them, and their ✕ clicks were intercepted by the header's Profile button.
  - Fix: portal to `document.body` (the SlidePanel/PostDetailPanel pattern). The bundle proves raising the z-index alone didn't help.
  - Also: 10 chat controls named, and the reaction button shows on keyboard focus.
- **In CI: #1190** (settings), bundle `20261001-stream5-settings-controls-r1`. The Privacy and account-settings toggles ("Findable by email/phone", "Show Email/Phone on Profile", notifications) were plain buttons with no name or state. They now use the app's own `role="switch"` + `aria-checked` + name pattern; back buttons and the notification close are named.
- **Decisions:**
  - Overlays leave `<main>` through the existing portal pattern, not a new layering scheme.
  - Names reuse the codebase's words ("Close", "Back", "Close …").
  - Truthful empty-state copy uses the native wording, with no new control.
  - Blocked cards stay non-navigating.
- **Routed:**
  - Other streams' overlays inside `<main>` share the root cause (Stream 2's post-page image viewer, noted by Stream 1 for the hub).
  - Master's SwiftFormat breakage (#1103/#1105) was fixed by Stream 4's #1163.
- **Harness note:** the runtime's no-send proxy refuses `GET /api/privacy/settings` for fixture users (`implicit-write-privacySettings`; the route creates a default row). The Privacy page then shows "couldn't load". That's the guard, not the app.
- **Candidates left:**
  - native: a hidden block's row doesn't announce "hidden" on iOS/Android (Stream 1's 1158 run);
  - web page editor: canvas blocks are mouse-only to select, and their toolbars are invisible on keyboard focus;
  - crew seat modals (z-[70]) don't cover the app chrome (centred, so still usable);
  - `getPostingIdentities` drift;
  - the logo route keeps the replaced File;
  - web portfolio upload parity.
  - Skipped: `/app/chat/new` (no caller) and `MessageActionMenu` (not imported).
- **Runtime:** API 18134 on master `e318f26e9` (receipt 02:28:19Z); web 18131 on `fa69b4aed` (#1190's head); DB at `20260930184000`. No fixtures remain.

## LIVE — sweep backlog items 1–8 all merged except native 4b (#1158, in Stream 1's next candidate); drift triage done; new: #1165 (Connections cards keyboard-reachable) in CI, 2026-10-01T01:35:25Z

- **Merged since the last block:**
  - batch 239: #1139 (item 7, seat "⋮" menu) and #1143 (item 8, builder preview without invented hours/stars);
  - batch 241: #1149 (item 6, crew checklist Hours link + Logo upload);
  - batch 242: #1150 (business trust drift: `verified_business` for document-verified crews);
  - batch 243: #1119 (item 2, page-editor names + chip selection), #1121 (item 1b, iOS named pages + native editors tell the truth) and #1155 (item 5, dead hero "Background image" box removed).
  - Stream 1 verified every seal.
- **#1119/#1121 sealed against Stream 1's device bundle** `20261001-stream1-native-1119-1121-devices-r1` (MANIFEST `e5c7c502…`):
  - #1121: seal `909ce171…`, bundle `20260930-stream5-native-page-blocks-truth-r1`;
  - #1119: seal `4a940931…`, bundle `20261001-stream5-page-blocks-a11y-r1`.
  - Their PR CI was red only from stale merge bases (the #1128 golden; the HubTabRoot SwiftLint violation). Each bundle records CI's own iOS lint on the master+PR merge tree.
- **Found and routed:** master `c107890f8` failed CI's `swiftformat --lint .` on two Stream 4 files (from #1103 and #1105). Stream 4's #1163 fixed them in batch 243.
- **Drift triage** (Stream 2's scan at `e32f321b6`, no rescan; `audits/20261001-stream5-drift-triage-r1/RESULT.md`):
  - Stream 5's only actionable rows were fixed by #1150.
  - `getPostingIdentities` (trustState 300/343) stays a low-impact candidate.
  - `BusinessBooking` is launch cut #5.
  - Out-of-scope rows were routed: gigs `find_homes_nearby` (an RPC no migration defines), Home media, mail.
  - Correction sent to Stream 2: #1148 fixed only trustState step 1. Stream 2 decided to leave step 3 (`incoming_resident`) unrevived.
- **New, in CI: #1165** (web, `connections/page.tsx`).
  - On Connections, a person's card was a click-only `div`, so keyboard and screen-reader users couldn't open a requester's profile (Requests offered only Accept/Decline; Sent had no focus stop). Blocked cards showed a pointer over a no-op.
  - Fix: the avatar and name are one profile link. The blocked card has no link and no pointer.
  - E2E before/after on the runtime; accessibility tree checked; a visible focus ring; card lists pixel-identical. Bundle `20261001-stream5-connections-links-r1`. I seal it after CI.
  - **Decision:** blocked cards stay non-navigating (the existing intent); the link carries the card's identity, with no new control.
- **Open:** #1165 (CI), #1158 (native 4b; Stream 1's next candidate), draft #842 (stays out).
- **Candidates left** (lower confidence):
  - the crew Reviews tab says "Be the first to leave a review!" with no review action (native says "Be the first to hire …" with a contact CTA);
  - `/app/chat/new` sends a new chat to `/app/mailbox?roomId=…`, but nothing links to that page;
  - checklist "→" buttons have no names;
  - the logo route keeps the replaced File;
  - web portfolio upload parity.
- **Runtime:** API 18134 on master `4123bd455` (receipt 01:14:44Z); web 18131 on `4078fcc82` (#1165's head); DB at `20260930184000`. No fixtures remain.

## LIVE — sweep items 3, 4 and 7 merged or sealed (#1126, #1133, #1135, #1139, #1143); #1149 (item 6) and #1150 (business trust drift) in CI; #1119/#1121 on Stream 1's devices, 2026-10-01T00:58:55Z

- **Merged:**
  - #1126, the profile shows its real portfolio and the dead Services tab is gone (batch 228);
  - #1133, no Appearance controls that change nothing (batch 233);
  - #1135, a privacy fix: the anonymous portfolio read sends 7 columns instead of 27, with no file names, path or owner ids (batch 235, a security batch).
  - Stream 1 verified each seal.
- **Sealed and handed to Stream 1:**
  - **#1139 (item 7).** A seat's "⋮" menu opens by click, tap and keyboard (named, `aria-expanded`, menu roles). Head `319e78a10`, CI 36797043515, seal `1d78d1fe…`, bundle `20261001-stream5-seat-menu-r1`.
  - **#1143 (item 8).** The builder's edit preview no longer invents 9–5 hours and five stars. Head `0626f39a8`, CI 36797437407, seal `5f74e454…`, bundle `20261001-stream5-builder-preview-r1`.
  - **#1128.** The CI unblocker that pins the date-dependent Log-maintenance golden. Its Android unit tests ran and passed on 10-01; Stream 1 merges it alone.
- **In CI:**
  - **#1149 (item 6), crew checklist dead ends.** Each location gets an "Hours" link to the existing hours editor; the Profile tab gets a Logo upload through the creation flow's own `uploadBusinessMedia`. E2E: both steps complete (PUT hours 200, logo upload 200) and both items are ticked.
  - **#1150, business trust step drift** (from Stream 2's scan). It read `BusinessProfile.user_id` and `BusinessLocation.latitude`/`longitude`, which don't exist, so no crew member was ever `verified_business`.
    - **Decision:** only crews that are `document_verified` or stronger count. Self-attested crews don't, because owner-entered locations would make the rule gameable. Stream 2 agreed.
    - E2E via `place-eligibility`: master gave `remote_viewer` even for a document-verified crew; the fix gives `verified_business` at the storefront and `remote_viewer` 250 km away. Unverified and self-attested crews stay `remote_viewer`.
- **On Stream 1's devices:** #1119 and #1121, in combined candidate `68b8ac1ec`. Stream 1 asked for, and got, the editor tap path and the block data keys. I seal both after its bundle.
- **Next:**
  - item 5 (the dead hero "Background image" upload box);
  - native item 4b: the iOS/Android editors' Padding/Background chips, plus the untitled caption showing nothing instead of "Untitled";
  - then the lower-confidence candidates and a drift-scanner rerun.
- **Runtime:** API 18134 back on master `b494ba75e` (receipt 00:55:37Z); DB at `20260930184000`.
  - No fixtures remain. The local `pantopus-uploads` bucket is created per check and removed through the Storage API.
  - Seal helper: `scratchpad/seal-pr.sh` this session; copy it to the kit at handoff.

## LIVE — #1115 merged (batch 225); #1126 (profile portfolio + no dead Services tab) sealed and handed; #1119 + #1121 in Stream 1's combined device candidate; CI blocker fix #1128 approved, 2026-10-01T00:18:48Z

- **Merged:** #1115, crew page placeholder blocks and the contact form, in batch 225 (PR #1120, 23:48:30Z, master `0256c4f35`). Stream 1 verified seal `da24054b`.
- **#1126, sweep item 3 (web): sealed and handed to Stream 1.**
  - Head `e37139db1bfd0f7cd7c98d5271d4e3cd4a86b728`; CI 36795049577 success; seal `b79abfdc9f2fb22237b1c49e941ae1fc11c0306dd59d532499ae1953978ed213`; bundle `20261001-stream5-profile-portfolio-r1`; base `e7fc87cda`.
  - **Reproduced on master:** the web profile never requested the existing public portfolio (`GET /api/files/portfolio/:userId`, which iOS and Android use), so a user with a portfolio photo showed "No portfolio items". The Services tab could never list anything, and the owner's "Add your first service" opened an Edit Profile with no service field.
  - **Fix:** the real portfolio is shown, with loading, failure and empty states. The Services tab and Overview's "Featured Services" are removed (native has no such tab). Owner Insights counts only what can be filled in.
- **#1119 (page-editor a11y) and #1121 (item 1b, native page blocks truth)** are both open. Stream 1 put them into one combined device candidate (`e12254b59`). I seal both after its run.
  - #1121 head `0b4524e2f`. It stops iOS named pages showing visitors placeholders, owner notes and dead button pills, and stops the iOS/Android editors offering Gallery, Team and Pulse, with truthful hints. Its web palette string was checked on my runtime (bundle `20260930-stream5-native-page-blocks-truth-r1`).
- **CI blocker found:** `LogMaintenanceFormSnapshotTest.log_maintenance_form_minimal` renders `Instant.now()` against a golden re-recorded on 09-30.
  - Every Android PR whose unit tests ran after 00:00Z on 10-01 failed it (#1119 and Stream 1's Trains branch). Master looked green only through a cached test task.
  - Fix #1128 pins the dates (test only). Stream 1 approved it and merges it alone once its Android job is green; Streams 3/4 were told.
- **Decisions recorded** (also in the PRs):
  1. Show the real portfolio from the endpoint native already uses (no new exposure).
  2. Remove the Services tab (no data source; native parity).
  3. Point owners to the app to add portfolio photos, since the web has no uploader.
  4. On the iOS named page, show only working link buttons.
- **Candidates recorded:**
  - `GET /api/files/portfolio/:userId` returns every File column to anonymous callers (low; native shows `original_filename` as a caption fallback).
  - Web portfolio upload and delete (parity).
- **Runtime:** API 18134 on `a211e1f48` (receipt 00:02:17Z; backend equals master's); web 18131 on #1126's head; DB at `20260930184000`.
  - The local storage has no `pantopus-uploads` bucket. Create it for upload checks and remove it afterwards, as in the #1126 bundle.
  - No fixtures remain; "S5 Crew Biz" was left alone.

## LIVE — takeover session: #1115 (crew page blocks + contact form, web) sealed and handed to Stream 1; #1119 (native page-editor a11y) open, waiting for Stream 1's device run together with item 1b, 2026-09-30T23:46:02Z

- **Session:** "Stream 5 Accounts and Social takeover" [a14d84], started about 23:10Z from [NEXT-STREAM5-PROMPT-2026-09-30.md](NEXT-STREAM5-PROMPT-2026-09-30.md).
  - Stream 1's live queue session is "Stream 1 resume: Support Trains and merge queue".
- **#1081's iOS signal is still pending.**
  - Master push run 36780940453 (`c054fe318`) was cancelled at 21:52:51Z (superseded), so it has no iOS verdict.
  - The first uncancelled master run containing #1081 is 36785030404 on `a211e1f48`. Every non-iOS job is green, Android instrumented included; both iOS jobs were still queued at 23:14Z.
- **Runtime:** DB at `20260930184000` (master has no newer migration).
  - API 18134 on master `a211e1f48`: receipt 23:33:38Z, loopback only, no founder services.
  - Web 18131 on #1115's head `837086838`.
- **#1115, sweep item 1: crew page placeholder blocks and the dead contact form (web). Sealed and handed to Stream 1.**
  - Head `8370868386295379cf084455a319a922a9970f80`; CI run 36792079253 success; seal `da24054b9c570e7c658c2b6dcd1e6028f3d8687442555ccfbfd67eecdee72863`; bundle `20260930-stream5-crew-page-blocks-r1`; base `763969f07` (merge-tree clean).
  - **Reproduced on master:**
    - the Team block read "Team members will be displayed here." and the Posts block "Posts will appear here when available.";
    - the Gallery showed 6 grey tiles;
    - every embed printed "Embedded content: <url>", including a stored `javascript:` address;
    - the contact form's Name, Email and Message were never read, so Send Message opened an inquiry room with 0 messages.
  - **Fixed and checked on the real API and web:**
    - visitors no longer see those three blocks;
    - a YouTube or Vimeo embed plays (nocookie player, lazy, sandboxed);
    - any other http(s) embed is a link card, and anything else renders nothing;
    - the contact form sends the typed text into the inquiry chat (201, 1 message), and the owner sees it in the crew Inbox;
    - the editor palette no longer offers Gallery, Team or Pulse, and the editor's hints tell the truth;
    - contrast is clean in light and dark.
- **#1119, sweep item 2: page-blocks editor accessibility (iOS + Android).** Open at head `8d786a19c3efa032fcdc0ce54aa29181bc835ac4`; not sealed, as Stream 1 asked, until its device run.
  - iOS names the controls as Android does: Move up, Move down, Delete block, Add block and Remove, plus Back and Preview.
  - The chosen chip reads as selected: `.isSelected` on iOS, `selectable(RadioButton)` on Android.
  - Stream 1 will run it with item 1b in one device session (sim A189976E + emulator-5558), starting about 00:30Z.
- **Next: item 1b (native).**
  - The iOS and Android page editors still offer Team, Pulse and Gallery, with the old hints.
  - iOS `BusinessProfileNamedPageSection` renders a named page's blocks to visitors (a link with a slug) through `BusinessPageBlocksPreview`, which prints the same placeholders. Android has no such section.
- **Decisions recorded** (user's standing direction; also in the PRs):
  1. Blocks with no real content render nothing for visitors.
  2. The editors stop offering Gallery, Team and Pulse until a gallery uploader, a public team list or a public posts feed exists. Each of those is a product decision with privacy questions.
  3. Only YouTube and Vimeo get a player, through their privacy-enhanced domains; other addresses are links.
  4. The contact form sends into the inquiry chat, with no Name or Email field; a signed-out visitor sees only "Log in to Contact".
  5. Android chips use the app's selectable-radio pattern, so iOS and Android announce the selected option alike.
- **Fixtures:** the `s5blocks` crew and its 3 inquiry rooms were deleted by exact id. "S5 Crew Biz" was left alone.

## LIVE — HANDOFF: every Stream 5 PR merged (#1080, #1087, #1089, #1090, #1092 and #1081; batches 217–221, master `c054fe318`); none open; next = sweep backlog, 2026-09-30T21:42:08Z

- **Read [NEXT-STREAM5-PROMPT-2026-09-30.md](NEXT-STREAM5-PROMPT-2026-09-30.md) first.** It holds the full state, runtime, rules, backlog and lessons.
- **Merged since the last block:** #1080, "the profile completion card shows the real percentage", in batch 217 (PR #1084, 20:29:26Z, master `e514e033b`). Stream 1 verified seal `7d730cad…`.
  - Then #1087, #1089 and #1090 in batch 218 (PR #1094, 21:10:17Z) and #1092 in batch 219 (PR #1095, 21:10:58Z), master `11e2b72f6`. Stream 1 checked each head against its seal.
  - Then #1081 in batch 221 (PR #1100, 21:40:34Z), master `c054fe318`. The head matched seal `e82a960c…`.
- **What the four merged PRs fixed** (evidence in each bundle):
  - **#1087, "a public profile's trust signals are true":** head `0ccc4d928`, CI 36775249193, seal `7fbf14f0…`.
    - The public routes now send the User's worker counters. These are already public via `/api/gigs/reliability/:userId`; Stream 1 confirmed this in review.
    - The invented "Usually within 24h" and the "Reliable" guess are gone, and a crew at `/{username}` gets its crew page.
    - E2E: a worker with 3 done and 1 no-show showed "Completed 0 / New" on master and shows "Completed 3 / Reliable" on the fix. No history reads "New" even though the API sends a score of 100.
  - **#1089, "a failed connection action says why":** head `0d8c493ab`, CI 36775674336, seal `95da3278…`. A withdrawn request's Accept gets 404 from the API; master showed nothing, and the fix shows a toast and refreshes the list.
  - **#1090, "the crew dashboard Inbox":** head `a17a7d73b`, CI 36776269108, seal `a63a3c35…`. Rows read "? Unknown" and opened a 403 room on master; the fix shows the name and preview and opens the crew's chat.
  - **#1092, the stale "skills aren't saved" note removed:** head `be13de394`, CI 36776925247, seal `470e0df6…`. On master, skills save through the UI (200/200) and are listed after a reload.
- **#1081, merged in batch 221** (iOS + Android page editors keep a button's `url`; the Directions chip opens Maps and is hidden for home-based crews).
  - Head `7fb117fa7`, seal `e82a960cc0b14f18e02069644f0c51d3535848f0b3d5c07be9f8fb945305095b`, bundle `20260930-stream5-native-crew-links-r1`, base `e631ac2b6` (19 files, 21:39:18Z).
  - **Devices:** Stream 1's run passed all four checks on iOS and Android at this head (candidate `f002e2a9e`). Its bundle is `20260930-stream1-native-1081-devices-r1`, and I re-verified MANIFEST `a33acbb7…`. Stream 1 also posted the table on PR #1081.
  - **CI run 36771770835** was partial at the seal:
    - passed: Android lint, test and assemble; the database job; the safeguards;
    - Android instrumented: failed on a CI emulator hang (21/61 passed, 0 failed);
    - iOS jobs still queued.
  - **Next agent:** the PR run is only informational now. Check the iOS jobs in master's push run 36780940453 (`c054fe318`), and fix forward only if one fails on #1081's files.
- **Sweep of Stream 5's web screens** (read-only, 22 candidates, each confirmed before any fix): 5 fixed (above and #1080). The remaining items are in the prompt's section 5, in priority order: crew page placeholder blocks and the contact form; Services/Portfolio dead ends; block Appearance settings; the dead hero upload; checklist dead links; SeatCard keyboard access; preview hard-coding. Stream 1's device run added an iOS page-blocks editor item: unnamed buttons, and chips without a Selected trait (the prompt's item 2).
- **Decisions recorded:**
  - Reliability shows only from real history.
  - The public routes send the canonical worker counters instead of posted tasks.
  - The duplicate "Address on file" badge was left out; the header already shows verified residency.
  - A failed connection action refreshes the list.
  - #1081's check 2 ran as a non-member only. I accepted it because the owner's own view follows the same rule and has no privacy stake (recorded in RESULT and the PR).
- **Runtime:** API 18134 and web 18131 on master `11e2b72f6` (API receipt 21:15:34Z); DB at `20260930184000`; proxy allowances disabled. No fixtures remain from today's runs.
  - One unexplained crew is left alone: "S5 Crew Biz" (`s5_gig_biz_dfa0bf`, created 08:42Z).
- **Cleanup at handoff (22:46:57Z, user request):** removed the old native build caches and app builds from the runtime directory (10 GB → 135 MB) and the merged worktree `pantopus-stream3-chat-keyboard-r1` (2.1 GB). The runtime the next agent uses stays up. Details are in the kit README.
- **Kit:** `tools/stream5-e2e/README.md` and `ci-record.sh` hold today's E2E patterns: the `/b/` substitution, one real write through a read-only page, the WebSocket stub, gradient-aware contrast, and the 60 s profile cache.

## LIVE — S3-22 #1076 merged (batch 215); #1077 (light cards) and #1080 (profile completion truth) sealed; #1081 (native crew links + Directions) waiting on CI and Stream 1's device run, 2026-09-30T20:20:10Z

- **Merged:** #1076, S3-22 crew page buttons with http(s)-only links and no Directions to a home, in batch 215 (PR #1079, master `daeb2e26d`), seal `952d6a9d…`. **The S3-22 row is closed.**
- **#1077, "light cards and initials are readable in both schemes"** (web): head `225a9ef80`, retargeted to master, CI 36770042506 success, sealed `adcb284e…`.
  - A gradient-aware re-check found light gradients left light in dark mode under light text:
    - the Founding banner on the crew dashboard, a #1052 regression (1.07–1.47:1);
    - the crew CTA block (1.00–2.29:1);
    - the profile completion card (1.14–2.69:1).
  - It also found the banner's Dismiss and Claim buttons, and large initials on light stops. 12 failures → 0.
  - Stream 1 took the other light gradients: the AI assistant cards and Stream 2's feed card.
- **#1080, "the profile completion card shows the real percentage"** (web), stacked on #1077: head `57b493578`, CI 36770818510 success, sealed `a139de2d…`.
  - The card read a hard-coded 65%.
  - Its photo item checked `avatar_url`, which the API always returns as null.
  - Its portfolio row could never be completed.
  - The page logged the whole profile (email, phone, address, date of birth) to the console.
  - **Decision:** count what Edit Profile fills in (photo, bio, skills), hide the card at 100%, and drop the portfolio row. Recorded in the PR.
- **#1081, "crew page links survive a phone edit; Directions opens Maps, never to a home"** (iOS and Android; Stream 1 assigned it): head `7fb117fa7`, CI running.
  - The editors keep `url` and get a Link address field.
  - The Directions chip becomes a Maps button, hidden for home-based crews: `is_home_based` for outsiders, `location_type`/`show_exact_location` for the team.
  - API inputs are verified on my stack. **Devices are unverified:** Stream 1 runs iOS, with 4 checks listed in the PR.
- **Drift re-run** on master `20e7b4768`: the routes scan matches the known set; the schema scan has 0 new candidates and 5 fewer (fixed by #1046 and #1055).
- **Next:**
  1. #1080's retarget and handoff once #1077 merges.
  2. #1081's seal after CI and the device run.
  3. Then new work only for reproduced gaps.
- **Runtime:** API 18134 and web 18131 on master `20e7b4768`; DB at `20260930184000`. No fixtures remain; rls1's profile is restored.

## LIVE — #1055/#1066/#1068 merged (batches 211–213); S3-22 #1076 open (crew page buttons + http(s)-only links + no directions to a home), CI running, 2026-09-30T19:44:13Z

- **Merged:**
  - #1055 (S3-62, a verified resident can endorse) in batch 211 at `460712c09`, seal `43d8bc14…`;
  - #1066 (the 14-day rule counts from `verified_at`) in batch 212 at the rebased head `42a46ab58`, re-sealed `77e1fc82…` (equal patch-ids);
  - #1068 (chat list contrast) in batch 213.
  - Master is `8d4851ce5`.
- **S3-22 → PR #1076** (head `9eba6032d`, bundle `20260930-stream5-crew-page-buttons-r1`):
  - **Renderer:**
    - Hero buttons were dead. Hero and CTA-block buttons now follow the editor's action: Call → `tel:`, Directions → maps, Link → http(s) only, Message and Book → the inquiry chat.
    - A button with no target is hidden.
    - The CTA block's unchecked `window.open(b.url)` is gone. On master a stored `javascript:` link was passed to `window.open`.
  - **Editor:** a Link gets an address field with a hint.
  - **Stream 1's review, in the same PR:**
    - the API rejects non-http(s) button links (400);
    - no Directions for home-based crews in the header, Locations tab and Locations block (they pointed at the fuzzed point).
  - **E2E** (before `69f19cbb2`, after `9eba6032d`, via the non-writing `/b/` substitution, 0 `/api/b/` requests, 0 view rows): every action, the signed-in inquiry POST, the home-based and storefront Directions, the API 200 → 400, and the editor field.
  - **Routed to Stream 1 (native):**
    - the iOS and Android page editors drop a web-set button `url` (`BusinessPageBlockModel.swift:490`, `.kt:317`);
    - the crew profile "Directions" chip is static on both, and should be hidden for home-based crews.
- **Decisions recorded:**
  - Book keeps the inquiry-chat fallback. Public scheduling stays cut.
  - A button whose target is missing is hidden rather than dead.
  - Directions is hidden for home-based crews, which was Stream 1's call.
- **Next:**
  1. #1076's seal and handoff.
  2. Then the remaining S3 rows. S3-23 (verification asks for a raw file id) is next in the business-web group.
- **Runtime:** API and web on master `69f19cbb2`; DB at `20260930184000`. No fixtures remain.

## LIVE — #1060 merged (batch 210); #1055 re-sealed with a verified-occupancy rule; #1066 (14-day rule) sealed; #1068 (chat list contrast) open; #1052 re-check: no regressions, 2026-09-30T19:19:15Z

- **Merged:** #1060, "an unpublished business stays hidden from outsiders", in batch 210 (PR #1063, 18:52:46Z; master `5fded9767`). Stream 1 verified seal `645806d1…`.
- **#1055 (S3-62), held by Stream 1 for a trust gap and now fixed:**
  - With the column fixed, any active non-guest occupant qualified, **verified or not**.
  - Round 2 adds `verification_status = 'verified'`. Head `460712c09`, CI 36761361028 success, re-sealed `43d8bc14…`.
  - E2E: an unverified member got 201 on `e75977dbb` and 403 with the reason in the toast on `460712c09`. The verified resident still gets 201 and "Endorsed (1)"; the retract returns 200.
  - Waiting for Stream 1's batch.
- **#1066, "the 14-day rule counts from verification"** (approved by Stream 1): stacked on #1055, head `f1afa2cff`, CI 36764090895 success, sealed `3498c08b…`.
  - The 403 promised "verified for at least 14 days" but measured the Home's age. It now measures the occupancy's `verified_at`.
  - **Decision recorded:** a verified row with a null `verified_at` (legacy) counts as not yet 14 days until it is verified again. There's no per-row time for it, and every current writer stamps `verified_at`.
  - E2E:
    - verified today at a 20-day-old home: 201 → **403** (API and toast);
    - verified 15 days ago: **201**;
    - null `verified_at`: **403**.
- **#1052 contrast re-check** (Stream 1's request), sealed `843ff213…`, bundle `20260930-stream5-dark-hues-recheck-r1`:
  - 21 Stream 5 web routes × light/dark, before (`60636ee9c`) vs after (`5fded9767`).
  - Failures went from **12 to 2, with no regressions**. #1052 fixed the dark Log Out card (1.00–2.34:1), "Permanently delete" (4.41:1), privacy "Try Again" (3.12:1) and the notifications row and button.
  - The remaining 2 predate #1052: the chat list's initials avatars.
- **#1068, "chat list initials and the Assistant row are readable in both schemes"** (web, one file), head `931cd604b`, CI running.
  - The initials move from the 500 steps (2.15–4.47:1) to the 700 steps of the same hues (5.02–7.90:1).
  - The dark-mode Assistant row gets a dark gradient stop and app inks (1.01/1.03:1 → 13.82/6.68:1).
  - The same palette in Stream 3's Home member panels was routed through Stream 1.
  - **Decision:** this is an accessibility fix within the user's AA direction, keeping the layout and hues. Recorded here and in the PR.
- **Next:**
  1. #1068's seal.
  2. Retarget #1066 once #1055 merges.
  3. S3-22: the crew page's hero buttons.
- **Runtime:** DB at `20260930184000`; API 18134 and web 18131 on master `5fded9767`. No fixtures remain; the endorse-check allowance is disabled.

## LIVE — #1053 merged (security batch 207); #1055 (S3-62 endorsements) sealed and handed off; #1060 open, CI running, 2026-09-30T18:41:00Z

- **Merged:** #1053, "a business's private data stays with its team", in security batch 207 (PR #1054, 18:29:47Z, master `60636ee9c`). Stream 1 verified seal `4fbae5e1…`.
  - A non-member reading `GET /api/businesses/:id` now gets the public projection: business 55 → 17 keys, profile 37 → 30, locations 37 → 14.
  - Home-based locations are masked in all three public readers (fuzzed point or none, no street).
  - The anonymous public route drops the email (unless `show_email`), the owner's personal-account link and the founding expiry.
- **#1055, S3-62, "endorsing a crew works, and a refusal says why":** sealed `7117d6b4…` and handed to Stream 1.
  - Head `e75977dbb`, CI run 36759345512: success.
  - The endorse route embedded `Home.ownership_status`, a column no migration created, so every endorsement got 403, qualifying residents included.
  - The web button reverted with no message, which is the S3-62 row. It now shows the API's reason in a toast.
  - Checked before and after through the real API and web. The `/b/` page was loaded through the non-writing substitution, with 0 `/api/b/` requests.
- **#1060, "an unpublished business stays hidden from outsiders"** (Stream 1's follow-up on #1053): head `f7bdbff30`, CI running.
  - A non-member now gets 404 for an unpublished business, matching the public page and `/b/`.
  - E2E through the real API: rls2 got 200 with the projection on master → 404 on the branch. The owner's full rows are unchanged. Once published, the business still returns the projection.
  - iOS and Android `loadDetail` fall back to the public route only for a non-UUID id, so an unpublished business opened by id shows the existing not-found state.
- **Next:**
  1. #1060's seal and handoff.
  2. Re-check Stream 5's web A3 cells in dark mode on master after #1052 (Stream 1's request).
  3. S3-22: the crew page's hero buttons (Stream 1's order).
- **Follow-ups:** unchanged from the block below.
- **Runtime:** DB at `20260930184000`. API 18134 is on master `746b640ce` (18:37:18Z); web 18131 is on `60636ee9c`. No fixtures remain.

## LIVE — #1043 and #1046 merged; route-drift scan: one live gap routed; nothing open from Stream 5, 2026-09-30T18:05:56Z

- **Merged:**
  - #1043 in batch 204 (PR #1048, 17:57:47Z);
  - #1046 in batch 206 (PR #1050, 18:02:07Z).
  - Master is `8d84b82e7`. Stream 1 verified both seals.
- **Route-drift scan:** rebuilt, together with the schema-drift scanner, in `.pantopus-recovery/stream3-runtime-kit/tools/drift-scanners/` (README inside).
  - On master `8d84b82e7`: 1,259 routes and 2,393 calls (web, iOS, Android).
  - Outside the cut areas, the only live gap is the web landlord portal's Notices and Settings tabs, which call `/api/v1/landlord/properties/:homeId/notices|settings|staff`. No route or table exists for them. This is the 09-23 decision "Route item 9: an honest 'not available yet' state", still unimplemented. Routed to Stream 1 for its owner.
  - The rest are dead client helpers with 0 callers (Stream 5's chat helpers stay, per Stream 1) and two query-suffix artifacts.
- **Open from Stream 5:** nothing.
- **Follow-ups (recorded):**
  - takedown rules (the user's call);
  - closing neighbor-message reports;
  - native report entry points on a device (offered to Stream 1);
  - #1037's follow-up backfill, once the user confirms the API is deployed.
- **Runtime:** DB at `20260930184000`; API 18134 and web 18131 on master `1bc136f69`. The backend is unchanged by later batches: #1043's and #1046's files only.

## LIVE — #1042 merged (batch 203); #1043 sealed and handed off; #1046 follow-ups open, 2026-09-30T17:57:09Z

- **#1042 merged:** batch 203 (PR #1045), 17:50:15Z; master `1bc136f69`. Stream 1 verified the seal and every N04 condition.
- **#1043, Business Profiles names each business:** CI run 36754011840 green; sealed `c6608de8…`; handed to Stream 1.
- **#1046 ([PR](https://github.com/WangPantopus/skinny-pantopus/pull/1046)), head `8eeaed183`:**
  1. **One alert per post report,** following Stream 1's nit on #1042. Only the request whose `ignoreDuplicates` upsert wrote the row alerts. Stream 2 OK'd the posts.js change.
  2. **The dead `verified_resident` block** (nonexistent Home columns, always null, read by no client) is removed from `GET /api/businesses/public/:username`, so the public crew page can never carry the owner's county.
  - Before on master: 5 simultaneous submits gave 1 row and 5 alerts, and the key was present as null. After: 1 row, 1 alert, and the key is absent.
  - Bundle `20260930-stream5-report-dedupe-crew-place-r1`; CI running.
- **Runtime:** API 18134 and web 18131 on master `1bc136f69`, no alert inbox set. Fixtures cleaned.

## LIVE — #1043 (Business Profiles names each business) open, CI running; #1042 awaiting review, 2026-09-30T17:49:32Z

- **#1043** ([PR](https://github.com/WangPantopus/skinny-pantopus/pull/1043)), head `0a67f06d9`, a follow-up to #1037.
  - After #1037 every new owner's seat is named "Owner", so Profiles & Privacy → Business Profiles (and the iOS Professional card) read "Owner · Owner" with no business name.
  - The identity center now names each row by its business, and the seat name stays on the Team tab.
  - Only `identityCenter.js` changes; the shared seat serializer used for feed and post authors is untouched.
- **Evidence** (bundle `20260930-stream5-business-profiles-names-r1`, not yet sealed):
  - before: row `Owner`, web "Owner · Owner";
  - after: `S5 Profiles fixture`, web "S5 Profiles fixture · Owner".
  - The fixture was removed at 17:47:54Z. Identity suites pass 37/37.
- **Public crew badge:** no finding to repair. No client reads `verifiedResident` from `GET /api/businesses/public/:username`; web, iOS and Android read only business id, hours and catalog. The broken county/tier block is dead. If a sole-proprietor badge is ever built, follow Stream 1's privacy call: a server-computed boolean, never a place.
- **Runtime:** API 18134 on `0a67f06d9` (17:47:29Z). The web tree is on `5e476f975` (#1042). Both return to master after the merges.

## LIVE — N04 report queue #1042 green, sealed (d641c192) and handed to Stream 1; #1037 merged, 2026-09-30T17:43:48Z

- **#1037 merged** in batch 201 (PR #1039, master `ed08ad438`). Stream 1 verified the seal and the seat grants (service_role only). Batch 202 then moved master to `416898752`.
- **N04, "who processes reports":** a verified gap. Reports were write-only; no admin route, job or notification read them.
  - **Decision** (the user's standing direction, approved by Stream 1): the platform admin, the founder at launch, processes reports, with a **target of acting within 24 hours**.
- **PR [#1042](https://github.com/WangPantopus/skinny-pantopus/pull/1042)**, head `5e476f975`. No table, column or migration.
  - **Queue:** `GET /api/admin/reports?status=…` behind requireAdmin, plus resolve (`resolved`/`dismissed`; a repeat returns 409 unchanged).
  - **Kinds:**
    - UserReport, where DM reports land;
    - PostReport;
    - GigReport;
    - neighbor-message flags, listed view-only;
    - ListingReport stays out (Marketplace is cut).
  - **Alert:** one per new report through the existing `adminAlerts` / `ADMIN_ALERT_EMAIL` channel, with only the kind, the reason category, the report id and the queue link.
  - **Web:** `/app/admin/reports`.
  - **Hooks** in users.js, posts.js and gigs.js (Stream 2 OK'd) and neighborMessages.js (Stream 4 OK'd).
- **E2E:**
  - web report → admin resolves it in the page;
  - non-admin 403, and the page shows "Admins only";
  - all four kinds through the API;
  - a log-only alert per report.
  - Fixtures removed at 17:39:23Z and hs13b's role restored.
  - CI run 36752584313 green. Bundle `20260930-stream5-report-queue-r1`.
- **UX fix from the E2E:** the page first copied review-claims' 403 → `router.back()`, which from the alert's direct link leaves the app. It now shows an inline "Admins only" message; review-claims is untouched.
- **Follow-ups (recorded, not started):**
  1. **Takedown:** hide a post and restrict an account, which needs product rules. Until then the admin acts from the queue.
  2. **Closing neighbor-message reports:** needs a review status on the flag, since clearing `reported_at` would flip the recipient's "reported" state.
  3. **Native report entry points on a device:** not run in this session (no simulator grant); they call the same routes. Offered to Stream 1.
  4. **Public crew badge:** Stream 1's privacy call is to return only a server-computed boolean (active verified residency) and never a place.
  5. **The #1037 follow-up backfill,** for people who already hold a binding, once the API is deployed.
- **Harness:** the runtime proxy gained a `report-check` allowance (now disabled), and the launcher an optional `S3_ADMIN_ALERT_EMAIL` pass-through.
- **Runtime:** DB at `20260930184000`, equal to master. API 18134 and web 18131 run `5e476f975` until #1042 merges, then go back to master.

## LIVE — #1037 green, sealed (61fefcd1) and handed to Stream 1; fixtures removed, 2026-09-30T17:13:39Z

- **CI run 36748636022** at head `6135591cd`, all green.
  - Database job 110001467911 applied `20260930184000` in the replay from empty: 68/68 pgTAP, baseline 6/6.
  - Backend job 110001253708: 6,286 pass, 0 fail.
- **Bundle** `20260930-stream5-business-seat-writers-r1`, seal `61fefcd1c6c6f2cdda4f557e8b034b54e4cab9eb79f5cc680eb4d251551bcb33` (62 files). Stream 1's five conditions are mapped in its RESULT "Verification".
- **Fixtures** removed by exact ids at 17:11:29Z: the three rls1 businesses and the `ab620000-…` pair.
  - The migration's seats for two pre-existing members of an older business stay; that's the migration's effect.
  - The runtime DB stays at 184000; API 18134 stays on `6135591cd` until the merge.
- **Routed to Stream 1:** the scan's other 132 candidates by owning stream (posts/trustState → Streams 1/2; mail → 4; Home access → 3). The rest are cut or dead code.
- **Stream 5 finding, recorded and not fixed:** the native public crew profile (`GET /api/businesses/public/:username`) never shows a sole proprietor's "verified resident" badge, because its Home query uses nonexistent columns. Fixing it would publish the owner's home county, so it needs a privacy/product call.
- **Next:** Stream 1's review and merge, then return the runtime to master; then the follow-up backfill for people who already hold a binding, after the API deploys.

## LIVE — crew seat repair #1037 (20260930184000) open, CI running, 2026-09-30T17:07:43Z

- **Found by** a rebuilt schema-drift scan (the 09-23 scripts were lost in the wipe; the new copy is in the bundle), then reproduced on master `f7373d0cd` through the real API and web on my runtime. All four defects are in crew owner tools (A05), which are in launch scope.
  1. **No owner seat on creation.** A new business's owner gets 403 "No active seat at this business" on the dashboard Team tab and on seat invites, and Profiles & Privacy → Business Profiles says "No businesses yet".
  2. **Add-member's seat write never worked:** nonexistent `email` column, null display_name, `'iam_add'` not in the enum, and a select of `SeatBinding.id`.
  3. **removeMember unbound the person at every business.**
  4. **getSeatForUser `.maybeSingle()`:** anyone with two bindings got 403 everywhere.
- **PR [#1037](https://github.com/WangPantopus/skinny-pantopus/pull/1037)**, head `6135591cd`, migration number from Stream 1.
  - The API gets `ensureSeat()`, owner seats on both creation routes, a business-scoped removeMember and a list-based seat lookup.
  - The migration adds `'iam_add'` and backfills only people with no binding at all, so it's safe in either deploy order. It has a read-only preview (my stack: `1 | 4 | 0` → `0 | 0 | 0`); a rerun inserts 0.
  - People who already hold a binding somewhere and lack one elsewhere get a follow-up migration once the API is deployed.
- **Evidence:** bundle `20260930-stream5-business-seat-writers-r1`, not yet sealed.
  - Owner Team tab 403 → 200; add-member writes the seat.
  - Leaving A deletes only A's binding (8 → 7).
  - A two-business owner gets 200.
  - Web: Team tab "Active (2)"; Business Profiles populated.
- **Decision recorded:** the backfill is restricted to people with no binding. An unrestricted backfill would break the one seat that works today for people who'd get a second binding under the deployed API. A follow-up covers them.
- **Harness:** the runtime proxy's local-profile allowlist gained rls1, whose LocalProfile row already existed (count stays 1).
- **Runtime:** DB at `20260930184000`; API 18134 runs `6135591cd` (16:59:16Z). Fixtures: three businesses by rls1 plus the `ab620000-…` pair, to be removed by exact ids before the seal.
- **Next:** CI database job, then seal, hand off to Stream 1 and remove the fixtures. Then the follow-up backfill once the API is deployed, plus a possible UX follow-up: Business Profiles shows seat names ("Owner"), not business names.

## LIVE — #1030 merged; the security track is complete and nothing is open from Stream 5, 2026-09-30T16:20:51Z

- **#1030 merged** in batch 199 (PR #1033, 16:18:39Z, master `f7373d0cd`). Stream 1 verified the seal and applied 183000 to its runtime; signed-in reads return 200.
- **The day's end state** (all merged):
  - no client role holds a privilege on public tables: writes since #992, anon since #1022, authenticated since #1028;
  - RLS is on everywhere except PostGIS's `spatial_ref_sys`;
  - caller-trusting DEFINER RPCs are revoked (#996, #1030);
  - the client-callable DEFINER surface is exactly 12 reviewed caller-bound helpers (plus 5 trigger functions PostgREST can't call). It's pinned by the `client-rpc-surface` contract, with Stream 1 keeping the inventory in the hub;
  - check-migrations guards new tables (RLS), new DEFINER functions (revoke), grants to anon, authenticated or PUBLIC, and client grants on auth.uid()-default DEFINER functions.
- **Runtime:** DB at `20260930183000`, which equals master. API 18134 runs master `f7373d0cd` (16:19:22Z). No fixtures are active from today's journeys.
- **Housekeeping:** all 18 of Stream 5's merged, clean worktrees under `/private/tmp` were removed (about 7 GB; the disk is at 97%).
- **Open from Stream 5:** nothing. The remaining rows wait for the user's devices, keys or decisions (see the resume prompt §5), including deletion for accounts with payment history, a money and legal call.

## LIVE — #1030 (business RPC revoke, 183000) green, sealed and handed to Stream 1, 2026-09-30T16:13:41Z

- **[#1030](https://github.com/WangPantopus/skinny-pantopus/pull/1030)**, head `f21e54fb8` on master `a318010a2`.
  - CI run 36742096018 succeeded: database job 109979052117 ran 68/68 contracts, including the new `client-rpc-surface`, and the baseline test passed 6/6.
  - Seal `894d9c97…` (bundle `20260930-stream5-business-rpc-scan-r1`).
  - Stream 1's five conditions:
    1. CI green;
    2. the 4-caller probes went from 200/400 to 401/403;
    3. the API's role path returns 200 before and after;
    4. the rule's cases and the migration audit pass;
    5. the hosted note is written.
- **The business fixture** was removed by exact ids at 16:11:58Z.
- **Open from Stream 5:** #1030 (in Stream 1's queue).

## LIVE — batch 197 merged #1028 and #1023; #1030 rebased onto master and ready, CI running, 2026-09-30T16:09:50Z

- **Batch 197** (PR #1031, 16:07:41Z, master `a318010a2`) merged:
  - **#1028**, the authenticated default-deny with the chat policy fix;
  - **#1023**, the iOS delete sheet;
  - Stream 3's #1024.
- **#1023 on iOS** (Stream 1, bundle `20260930-stream1-1023-ios-delete-keyboard-r1`, seal `26bcf241…`), at `e8a85d6c4` with DELETE typed and the keyboard up:
  - the Cancel / Delete My Account row sits fully above the suggestion bar, and the return key reads "done";
  - tapping the button with the keyboard still up reached `DELETE /api/users/account` 200 and the signed-out start;
  - on master the bar had covered both buttons.
- **182000** is on Stream 1's runtime too. Signed-in API reads return 200.
- **[#1030](https://github.com/WangPantopus/skinny-pantopus/pull/1030)** (business RPC revoke, 183000):
  - the stacked run passed the database job: 68/68 contracts, including the new `client-rpc-surface`, and baseline 6/6;
  - rebased onto `a318010a2` as `f21e54fb8` and marked ready. Local checks pass; CI is running on the final head.
- **Open from Stream 5:** #1030.

## LIVE — new finding: a business RPC leaked permission maps to the anon key; fix #1030 (183000) in draft, stacked on #1028; #1028 approved for batch 197, 2026-09-30T16:03:08Z

- **#1028:** Stream 1 approved it for batch 197, together with Stream 3's #1024. Stream 2 approved too, so all three owning streams have.
- **#1023:** Stream 1 simulator-verifies it at `e8a85d6c4` and batches it after #1024. The branch must stay unchanged until then.
- **The finding** (scan of the SECURITY DEFINER functions clients can call through PostgREST RPC, their remaining direct path after #1028):
  - `business_get_user_permissions` uses whatever `p_user_id` is passed. Reproduced: with only the anon key, a signed-in outsider, staff or the owner, it returned 200 with the member's permission map. #996's scan had it as identity-bound because of its `DEFAULT auth.uid()`.
  - `apply_business_role_preset` let a team manager skip the API's owner and rank rules.
  - Neither has a caller.
- **[#1030](https://github.com/WangPantopus/skinny-pantopus/pull/1030):** migration `20260930183000` (number from Stream 1). Draft, stacked on #1028.
  - It revokes both functions from clients; service_role keeps them.
  - check-migrations refuses a client grant on any DEFINER function with an `auth.uid()`-default parameter, unless the function is a reviewed caller-bound helper. Run over every current migration, it flags exactly the leaking function.
  - New contract `client-rpc-surface.sql`: the client-callable DEFINER surface must be exactly the 12 reviewed helpers.
  - Evidence (bundle `20260930-stream5-business-rpc-scan-r1`): after the migration, both RPCs refuse every caller (401/403), and the API's own role and preset path, as owner, still returns 200 on all four steps.
  - Stream 3 approved; Streams 2 and 4 have been told. The RPC surface inventory was sent to Stream 1 for the hub.
  - Next: CI, then a rebase after batch 197, then ready and handoff.
- **Runtime:** DB has 181000, 182000 and 183000. The business fixture `ab61…` gets removed after #1030's CI is green.
- **Open from Stream 5:** #1023, #1028 (batch 197), #1030 (draft).

## LIVE — #1028 green and sealed, handed to Stream 1 with all five merge conditions met, 2026-09-30T15:49:26Z

- **[#1028](https://github.com/WangPantopus/skinny-pantopus/pull/1028)**, head `3fda3a151`.
  - CI run 36738969636 succeeded: database job 109968818882 ran 67/67 contracts, and the baseline PostgREST test passed 6/6.
  - Seal `a99b1526…` (bundle `20260930-stream5-authenticated-select-deny-r1`).
  - Stream 1's conditions:
    1. CI green;
    2. the rule is extended and its cases exercised;
    3. the hosted note is written;
    4. the per-stream journeys return 200 and direct reads return 403 on all 14 relations;
    5. the finance matrix keeps its coverage and every converted section is listed.
  - Streams 3 and 4 approved.
- **The journey fixture** `ab5f…0001` was removed by exact ids at 15:48:43Z.
- **Open from Stream 5:** #1023 (waits for #1024 and Stream 1's simulator run) and #1028 (in Stream 1's queue).

## LIVE — #1022 merged; authenticated default-deny #1028 (with the chat policy recursion fix) open, CI running; #1023 waits for #1024 and Stream 1's simulator run, 2026-09-30T15:46:26Z

- **#1022 merged** (anon default-deny, 181000): batch 196, master `8099b6516`. My runtime API is back on master.
- **[#1028](https://github.com/WangPantopus/skinny-pantopus/pull/1028): authenticated default-deny.** Migration `20260930182000`, head `3fda3a151`.
  - **Stream 1's inventory-first decision:**
    - no backend path reads as authenticated: the auth clients only call GoTrue, and the shared anon client never gets a session;
    - nothing outside the API uses authenticated: no Realtime subscriptions, an empty publication, no Storage policies, no hooks.
  - **Migration:**
    - REVOKE ALL on tables and sequences from authenticated, plus default privileges. EXECUTE is unchanged, and the policies stay as defense in depth.
    - It also fixes Stream 5's chat read-policy recursion (42P17 → clean refusal) with an `is_active_chat_participant` DEFINER helper, with the same meaning.
  - **Contracts:** 13 converted: refusals, data on the service path, and each read policy's helper asserted per actor. The finance matrix keeps full coverage. Every converted section is listed in the PR.
  - **Rule:** check-migrations refuses GRANTs to authenticated from 182000.
  - **Evidence** (bundle `20260930-stream5-authenticated-select-deny-r1`, not yet sealed):
    - direct reads with a user's own token plus the anon key went from 200 (own User, Home, occupancy, Post, Gig…) to 403 on all 14 relations probed; the chat tables went from 500 to 403, and anon from 500 to 401;
    - signed-in API journeys are 200 before and after: Stream 2 task detail and my-bids, Streams 3/4 homes, tasks and bills, Stream 5 profile, privacy and chat.
  - **Reviews:** Streams 3 and 4 approved; Stream 3's helper-EXECUTE assertions are added. Stream 2 has been told. CI is running on `3fda3a151`.
- **[#1023](https://github.com/WangPantopus/skinny-pantopus/pull/1023), iOS delete sheet:** the iOS build job passed. The lint waits for Stream 3's #1024 (their Home files), and Stream 1's simulator run is pending.
- **Runtime:** DB has 181000 and 182000. The local chat section went in as a delta, because 182000 was recorded before that section was added. The API runs master `8099b6516`. Journey fixture gig `ab5f…0001` gets removed after CI is green.
- **Open from Stream 5:** #1023, #1028.

## LIVE — anon default-deny #1022 reviewed by Streams 1–4, final CI running; iOS delete-sheet fix #1023 waits for Stream 1's simulator run; #1018 merged, 2026-09-30T15:18:32Z

- **#1018 merged** in batch 195 (PR #1021, 15:02:29Z, master `134dfb1ed`). Stream 1 verified the database job itself and added the four correction seals to the batch 185/187/189 records.
- **[#1022](https://github.com/WangPantopus/skinny-pantopus/pull/1022): anon default-deny.** Migration `20260930181000` (number from Stream 1). Head `ba22fad27`.
  - The migration revokes every remaining table, view and sequence privilege from anon, plus the matching default privileges. authenticated and service_role are unchanged.
  - **gigs.js my-bid** now reads the caller's own newest bid through supabaseAdmin. Android's task detail calls it for every non-owner, including the assigned worker (launch scope); it always got "no bid" and would otherwise have logged 500s. Stream 2 approved.
  - **The three other gigs routes** (/nearby, /user/me, /assignments/me) have no callers and go from 200-empty to 500. offers.js already fails, because its tables don't exist. debug.js returns 404 in production.
  - **check-migrations** refuses later GRANTs to anon or PUBLIC.
  - **Contracts:** home-finance-rls, home-policy-boundary, paid-gig-acceptance, beacon-storage-access, plus the baseline PostgREST test.
  - **Evidence** (bundle `20260930-stream5-anon-select-deny-r1`, not yet sealed):
    - anon PostgREST reads went from 200 to 401 on all 14 relations probed; anon's grants went from 253 to 3 (the PostGIS relations);
    - my-bid on a synthetic task:
      - master code, after the revoke: 500 for everyone;
      - branch code: the worker gets their current bid, the other bidder gets only their own, and the non-bidder and the owner get null;
    - backend Jest: 341 suites passed; privacy gates pass.
  - **Reviews:** Streams 2, 3 and 4 approved. Stream 1 approved the code after I corrected the migration comment in `ba22fad27`.
  - **CI:** the first run failed on beacon-storage-access, which switches roles dynamically and which my inventory missed; fixed in `e441c3599`. The database job is running on `ba22fad27`. Stream 1 batches it once that job is green.
- **[#1023](https://github.com/WangPantopus/skinny-pantopus/pull/1023): iOS delete sheet.** Once DELETE is typed, the button row scrolls above the keyboard; the return key reads Done; a drag dismisses the keyboard. No visual change. Stream 1 found the issue in the native pass.
  - Stream 1 will re-run it on its simulator, since this session has none.
  - master's iOS SwiftLint is red from two Stream 3 Home files (6e6a577f3, 46cd0b548); told Stream 3.
- **Stream 1's native pass for Stream 5 is complete:** account deletion with a private-setup Home passed on iOS and Android (bundle `20260930-stream1-account-delete-native-r1`), and the #950 copy and the portfolio delete were verified.
- **Runtime:** my DB has `181000` applied. API 18134 runs the #1022 branch (`0b844a532`); return it to master after #1022 merges. The my-bid fixture was removed by exact ids at 15:16:05Z.
- **Open from Stream 5:** #1022, #1023.

## LIVE — #992 broke four SQL contracts (master's database job red since 13:15Z); fix #1018 green and handed to Stream 1; four evidence bundles corrected, 2026-09-30T14:54:13Z

- **What happened:** #992 (API-only writes) revoked client write grants.
  - Four contracts still expected some direct client writes to succeed: payment-method-preferences, home-finance-rls, home-effective-permissions and paid-gig-acceptance.
  - master's database job failed on every run from #992's merge (run 36720355505 at `dd8090e17`) through `ba5ee672c`.
- **My evidence was wrong.** The "67/67 contracts pass" lines in the #992, #996, #1001 and #1002 bundles are invalid.
  - The local loop wrote `echo "$(basename $f) exit $?"`, which records basename's exit status, not psql's.
  - In each run, 43 to 55 of the 67 files never connected, because the local arm64 Postgres was crashed or recovering.
  - Stream 1 caught the red job. It approved fixing the contracts rather than reverting #992.
- **Fix:** [#1018](https://github.com/WangPantopus/skinny-pantopus/pull/1018), head `54fe24992`. No migration.
  - Every denial is kept, and each former client-write positive control is now refused.
  - The API's path is proven instead: service_role writes, and the client reads the result back.
  - Streams 2, 3 and 4 were told before the PR, and all three reviewed it.
  - CI database job success: [run 36731856487, job 109943586281](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36731856487/job/109943586281), 67/67 contracts and baseline PostgREST 6/6.
  - Evidence: bundle `20260930-stream5-contracts-api-only-r1`, seal `b1d5c737…`. With Stream 1's queue.
- **Corrections:** each of the four bundles has CORRECTION.md plus its run's stderr. The contract-claim lines are marked invalid, and the old files are kept under `superseded/`. Resealed:
  - #992: `28040cc7…` → `806af1c9…`;
  - #996: `ac9b751b…` → `b7d2cb7d…`;
  - #1001: `561db4f8…` → `184fbe4f…`;
  - #1002: `d2b72eee…` → `0ea52d29…`.
  - Stream 1 will add hub correction lines for batches 185/187/189.
- **Also merged:** #1015 (/health uses the service client; mailbox.js's unused anon import dropped), 14:27:00Z, `965c69091`.
- **Stream 1's native pass for Stream 5 work** (its bundles):
  - account deletion with a private-setup Home: Android PASS, iOS next;
  - #950 delete-sheet copy: verified on iOS and Android;
  - portfolio delete: iOS fixed by Stream 1's #1019, merged.
- **Next:**
  - the anon SELECT default-deny evaluation, after Stream 2 confirms gigs.js. Inventory started: 253 of 367 public relations are anon-readable by grant. Only public business pages, reference tables, HomePublicData, SeededBusiness and SubscriptionPlan have policies that admit anon rows. I'll ask Stream 1 for a migration number before any file;
  - fixture cleanup by exact ids.
- **Open from Stream 5:** #1018.

## LIVE — security track fully merged: every Stream 5 PR from today is in master (`a5f21354a`), 2026-09-30T14:17:54Z

- **Correction to the blocks below:** "open" there is out of date. Merged:
  - #1000 (DEFINER guard): batch 188, 13:50:27Z;
  - #1001 (owner-rights views) and #1002 (step 1 read revoke): batch 189, 13:51:14Z;
  - #1012 (availability checks): batch 192, 14:16:43Z, together with Stream 2's #1011 (step 2, PostLike/PostComment).
- **Today's security track, all merged:** #977, #978, #985, #988, #992, #994, #996, #1000, #1001, #1002 and #1012, plus Stream 2's #1009 and #1011.
- **The end state Stream 1 proposed:** once gigs.js (Stream 2; Open Gigs is launch-cut) and mailbox.js (Stream 4; an unused import) confirm no data reads, a small PR moves app.js /health's count to the service client. Then an anon SELECT default-deny becomes possible. I offered to take the /health PR.
- **Native pass:** Stream 1 started (a) account deletion with a private-setup Home and (c) the portfolio delete at 14:17Z.
- **Runtime:** my stack mirrors master. The DB has master's migrations through `180000`; API 18134 runs master `a5f21354a` (from 14:17:30Z).
- **Nothing open from Stream 5.**

## LIVE — #1012 fixes blind username/phone/email checks; Stream 2's #1011 reviewed, 2026-09-30T14:05:57Z

- **New open:** [#1012](https://github.com/WangPantopus/skinny-pantopus/pull/1012) (`50e55104f`, seal `02f2c233…`, no migration). users.js's `isUsernameAvailable`, `isPhoneAvailable` and `isEmailAvailable` read User through the anon client, which sees no rows under RLS, so every check said "available".
  - **Before:** a taken username created and then rolled back an auth user (a confirmation email in production), and a taken phone gave 500.
  - **After:** refused up front with 400; a fresh username gives 201 and a free phone 200.
  - chats.js drops an unused anon import. Found during the anon-client inventory for Stream 1's end state.
- **Reviewed:** Stream 2's #1011 (REVOKE SELECT on PostLike/PostComment, step 2) is correct. All 21 reads at master are supabaseAdmin, and no policy, view or client-called function depends on those tables. Stream 2's #1009, which moved posts.js off the anon client, merged in batch 191.
- **Anon-client inventory after #1012:**
  - app.js /health: harmless;
  - debug.js: dev only;
  - verifyToken/optionalAuth and users.js: auth calls only;
  - gigs.js: Stream 2 is checking Open Gigs, a launch cut;
  - mailbox.js: an unused import, told Stream 4;
  - offers.js: dead tables.
- **Open from Stream 5:** #1000, #1001, #1002, #1012.

## LIVE — step 1 of closing all-rows read policies is open as #1002; step 2 sent to Stream 2, 2026-09-30T13:39:30Z

- **Open:** [#1002](https://github.com/WangPantopus/skinny-pantopus/pull/1002) (`ea6d913e9`, migration `20260930179000`, seal `d2b72eee…`). REVOKE SELECT on FileThumbnail, TransactionReview and ReputationScore from client roles.
  - Probes: anon 200 → 401, and a signed-in stranger 200 → 403.
  - All callers use supabaseAdmin. The Marketplace flows are code review only (launch cut). 67/67 contracts.
- **Step 2 (Stream 2):** move posts.js:2875/2903 (PostLike/PostComment reads) from the anon client to supabaseAdmin with explicit visibility checks, then revoke. Stream 1 tracks it on the hub.
- **End state (Stream 1, recorded):** no backend code reads through the anon client; then anon SELECT is default-denied like #992. Not started; it follows step 2 and a full inventory.
- **Open from Stream 5:** #1000 (DEFINER guard), #1001 (owner-rights views), #1002. All wait for Stream 1's review after its iOS run.

## LIVE — #1001 (six owner-rights views) open; the open-SELECT-policy finding is with Stream 1, 2026-09-30T13:35:18Z

- **Open:** [#1001](https://github.com/WangPantopus/skinny-pantopus/pull/1001) (`680555795`, migration `20260930178000`, seal `561db4f8…`). REVOKE ALL on six views that run with owner rights (they bypass RLS) and that anon could SELECT:
  - `GigPublic`: all tasks with the worker, creator and origin ids. Stream 2 agreed.
  - `MailAnalyticsSummary`: every letter's read analytics. Stream 4 agreed.
  - Four persona/Beacon views: a launch cut, closed at the DB level only (Stream 1's decision).
  - Anon probes 200 → 401; 67/67 contracts. The only caller, `personas.js`, uses supabaseAdmin.
- **Also open:** [#1000](https://github.com/WangPantopus/skinny-pantopus/pull/1000), the DEFINER guard.
- **Finding sent to Stream 1 for a decision:** all-rows SELECT policies readable with the anon key: PostComment, PostLike, TransactionReview, FileThumbnail and ReputationScore; the rest look intended.
  - The backend's anon client reads PostLike and PostComment (posts.js), so closing them needs Stream 2 to move those reads to supabaseAdmin with visibility checks.
  - Proposed step 1: revoke SELECT on client-unused tables (FileThumbnail, TransactionReview, ReputationScore).

## LIVE — security track complete except #1000 (DEFINER guard); #994 and #996 merged, 2026-09-30T13:30:04Z

- **Merged since the last block:**
  - [#994](https://github.com/WangPantopus/skinny-pantopus/pull/994) (batch 186): the check-migrations RLS guard.
  - [#996](https://github.com/WangPantopus/skinny-pantopus/pull/996) (batch 187, 13:27:31Z, master `8ed5085bf`): client roles lost EXECUTE on ten SECURITY DEFINER functions that trusted a caller-supplied id.
    - The read-only scan found 27 DEFINER functions executable by anon. With only the anon key, `get_user_chat_rooms` returned any person's chat list with previews and names, and `get_full_home_profile` any Home's members; the writing ones opened chats, saved posts and raised unread counts.
    - After: 401 `42501`, no side effects. The app's calls are identical before and after (socket room list, DM, task chat, mail sessions, post save).
    - `listings.js`'s `toggle_listing_save` moved to supabaseAdmin. It's code review only, because Marketplace is a launch cut (Stream 1's decision).
- **Open:** [#1000](https://github.com/WangPantopus/skinny-pantopus/pull/1000) (`6b8b31d1f`, seal `0ea8f9f7…`). From `20260930176000` on, a SECURITY DEFINER function created in public needs EXECUTE revoked from PUBLIC, anon AND authenticated in the same file, or an explicit GRANT as a deliberate exception. The eight RLS helpers are exempt by name. Existing tests 8/8; eleven synthetic cases pass.
- **Security track, 2026-09-30, all merged except #1000:**

  | PR | Change |
  | --- | --- |
  | #977 | chat writes only through the API |
  | #978 | account, social and business writes only through the API; closes self-promotion to admin |
  | #985 | RLS on for 73 tables |
  | #988 | file delete works again |
  | #992 | grant-level default-deny for client writes |
  | #994 | RLS guard |
  | #996 | DEFINER RPC revoke |
  | #1000 | DEFINER guard (open) |

  Streams 2, 3 and 4 confirmed no impact on their flows.
- **Still open from the scan (not started):** the `ChatParticipant` read-policy recursion (42P17). It affects only direct reads, which no app makes.
- **Native pass:** Stream 1 will run (a) account deletion with a private-setup Home, (b) the #950 sheet copy and (c) the portfolio delete, on its devices after Stream 2's #980.
- **Runtime:** API 18134 runs `f6dc29d26` (#996's head). The DB matches master's migrations through `176000`.
- **Fixtures to remove later by exact ids:** DELBLOCK1 (rls1/rls2, hs*, solo2), GIGROOM1, the fixture letter, files, posts, tasks and DMs, and the `pantopus-home-documents` bucket row.

## LIVE — security track: the trio, #985, #988 and #992 merged; #994 (migration RLS guard) open, 2026-09-30T13:18:41Z

- **Merged since the last block:**
  - the decision-9 trio: #968 `33a43a569` + #976 `9b72153d2` (containing #974 `28f92e4e0`), batch 182, 13:03:26Z;
  - [#985](https://github.com/WangPantopus/skinny-pantopus/pull/985): RLS on for the 73 tables that had it off. Batch 183, 13:04:38Z.
  - [#988](https://github.com/WangPantopus/skinny-pantopus/pull/988): an owner can delete their own file again. `DELETE /api/files/:id` answered 404 for everyone, because it called the invoker `soft_delete_file` through the anon client; it now uses supabaseAdmin, and a non-owner is still refused. This is the profile tabs' delete on iOS and Android. Batch 184.
  - [#992](https://github.com/WangPantopus/skinny-pantopus/pull/992): clients can no longer write public tables directly. REVOKE INSERT/UPDATE/DELETE/TRUNCATE from anon/authenticated on every public table, plus default privileges so future tables start closed; SELECT is kept.
    - Before, direct own-row Post, Listing and UserPrivacySettings inserts were 201. After, they get 403 `42501`.
    - All 67 SQL contracts pass before and after, and the API's writes across streams succeed.
    - Streams 2 and 3 confirmed no impact; each stream got its list of now-inert policies.
    - Batch 185, 13:15:43Z, master `dd8090e17`.
- **Open:** [#994](https://github.com/WangPantopus/skinny-pantopus/pull/994) (`101976b4e`, seal `0cd4df83…`). The `check-migrations.cjs` guard: from `20260930174000` on, a migration that creates a public table must ENABLE ROW LEVEL SECURITY in the same file. Existing tests 8/8; eight synthetic cases behave as intended.
- **Process (Stream 1):** ask the coordinator for a migration number before creating a migration file. I had picked 174000 myself.
- **Native pass:** Stream 1 will run these on its iOS/Android devices after Stream 2's #980:
  - (a) account deletion for an account with a private-setup Home;
  - (b) the #950 delete-sheet copy;
  - (c) the portfolio delete.
- **Next (offered to Stream 1, awaiting the go-ahead):** a read-only scan of SECURITY DEFINER functions executable by anon/authenticated through PostgREST RPC (same anon-key threat model).
- **Runtime:** API 18134 runs master+#988 `3dfa0ecad`. The DB matches master's migrations through 174000; the `162000` row was relabeled to `172000`.
- **Fixtures:** DELBLOCK1 plus GIGROOM1. Remove by exact ids later.

## LIVE — #977/#978 merged; RLS-enable #985 ready; trio proven on the final heads, 2026-09-30T13:01:25Z

- **Merged:** [#977](https://github.com/WangPantopus/skinny-pantopus/pull/977) (chat writes only through the API) and [#978](https://github.com/WangPantopus/skinny-pantopus/pull/978) (account, social and business-profile writes only through the API; closes the self-promotion to admin). Batch 181, 12:50:47Z, master `113706f04`.
- **Trio re-run done on the final heads.** [#976](https://github.com/WangPantopus/skinny-pantopus/pull/976) is at `9b72153d2`, rebased onto #974 `28f92e4e0`, with #968 `ab0a5b097`. #968's renumbered `33a43a569` has the same migration blob `bcaf51243…` (`162000` → `172000`) and the same `homeRecordService.js`.
  - Seal `c2162508…` (87 files). Local tree `b84f386ae`. All six cases pass:
    1. owner + unverified member: `deleted`;
    2. owner + verified member: 409;
    3. owner + pin + pending applications: `purged`, with the claim and request closed and the notices sent;
    4. member with a photo: `kept`, and `uploaded_by` shows null;
    5. last member with a former member in the chat: `purged`, chat closed;
    6. owner_id-only: `kept`.
  - Jest 341/6286, 0 failures. Waiting for Stream 1's batch.
- **New security finding, in PR [#985](https://github.com/WangPantopus/skinny-pantopus/pull/985)** (head `95fdcb33b`, migration `20260930173000`, seal `467c3b2f…`):
  - **74 public tables had row-level security OFF.** anon/authenticated kept their grants, so the anon key alone could read and write them: wallets, earnings, invoices, Support Train funds, mail, map pins, reports and trust flags. Locally, 72 tables were readable, and a pin was changed with only the anon key.
  - **The fix:** enable RLS on 73. `spatial_ref_sys` belongs to PostGIS and is left out. There are no policies, so the result is deny-all.
  - **The scan found no backend impact.** 509 of 510 uses go through supabaseAdmin. Anon RPCs, invoker views, invoker triggers and Realtime are all clear.
  - **After the change:** anon sees 0 rows, and the cross-stream API smoke (trains, earnings, mail, vacation, reviews, pins) is all 200.
  - Stream 1 recorded the decision and assigned it to me. The PR lists the tables by owning stream.
- **Next (Stream 1 assigned, security track):**
  1. The write sweep for the other 111 tables. Evaluate a grant-level default-deny: REVOKE INSERT/UPDATE/DELETE/TRUNCATE from anon/authenticated, plus ALTER DEFAULT PRIVILEGES, keeping SELECT. Gate it on the same scan (invoker functions that write as anon/authenticated, and anon-client writes). Send the table lists to the owning streams before any merge.
  2. A `check-migrations.cjs` rule that flags `CREATE TABLE public.…` without `ENABLE ROW LEVEL SECURITY`.
- **Runtime:** API 18134 runs the local trio tree `b84f386ae`. The DB has the trio's migration (recorded as `162000`, same blob as #968's `172000`) plus `170000`, `171000` and `173000`. Return it to master, and relabel the `162000` row, after the merges.

## LIVE — security: direct database writes could make a user a platform admin; #977 and #978 close Stream 5's tables. Trio re-run pending, 2026-09-30T12:45:47Z

- **Security finding (local reproduction, disposable accounts, reverted by exact id):**
  - **Admin escalation.** Row-level-security write policies let a signed-in person who has the anon key write rows directly through PostgREST, around the API. With `user_update_self`, a disposable account set its own `User.role` to 'admin' (204), and the API's admin routes then answered it 200, because `requireAdmin` reads `User.role`.
  - **Other paths with the same key:** a requester can insert a connection as already accepted, and anyone can self-verify their professional profile and set its ranking boost.
  - **Chat:** a second `gig` room can be created for someone else's task. The other chat write policies are blocked only by an accidental `42P17` recursion.
  - **Exposure:** no app ships the anon key or a Supabase client (iOS, Android, web and git history checked), and no real key is committed on master. But login returns the Supabase session token, so anyone who obtains the anon key gets admin.
- **Open PRs (Stream 1 has them):**
  - [#977](https://github.com/WangPantopus/skinny-pantopus/pull/977) (`d5864827b`, migration `20260930170000`, seal `e979677e…`): chat rows are written only through the API. It drops 11 write policies on `ChatRoom`, `ChatMessage`, `ChatParticipant`, `MessageReaction` and `ChatTyping`. Queued right after the trio.
  - [#978](https://github.com/WangPantopus/skinny-pantopus/pull/978) (`859a8010a`, migration `20260930171000`, seal `2fc1ac8a…`): account, social and business-profile rows are written only through the API. It drops 16 policies on `User`, `UserProfessionalProfile`, `BusinessProfile`, `BusinessPageBlock`, `Relationship`, `RelationshipPermission`, `UserBlock` and `UserProfileBlock`.
    - After it, the role PATCH changes nothing (admin 403), and the other writes get 403 `42501`.
    - Profile update, connections and block/unblock through the API still work.
    - I asked Stream 1 to batch it early.
  - Both keep the read policies, and every backend write to these tables uses `supabaseAdmin` (70 writes scanned for #978).
- **Decision (standing direction; security best practice, no product trade-off):** for Stream 5's tables, the API is the only writer.
- **Needs a cross-stream decision (coordinator or user):** 246 user write policies existed on 124 public tables. #977 and #978 cover Stream 5's 13; the other 111 belong to other streams.
  - Recommendation: make every server-written table API-only, one stream at a time.
  - Each table first needs a scan for anon-client writes that rely on permissive policies without `auth.uid()`.
  - Also consider rotating the anon key if it was ever shared outside the backend.
- **Trio (#974 + #976 + #968) is on hold** until the heads are final (Stream 1).
  - #968 is final at `ab0a5b097` (a deleted uploader's id shows as null; the purge refuses when someone else holds `Home.owner_id`). Its final `162000` is re-applied on my stack.
  - #976 gained `c02af3976` (local until the rebase): LIF-02 counts only current verified co-residents (Stream 3's decision), and its queries fail closed.
  - Waiting for #974's new head. Stream 3 is aligning `othersKeepHome` with the purge's rule, and after a purge it will close the Home's remaining pending standing.
  - Then: rebase #976 onto it, push, and re-run the targeted cases. Fixtures hs9/hs9b and hs11–hs15 are ready.
- **Runtime:** API 18134 is still on the local tree `a2e222885`. The DB now also has my `170000` and `171000` applied, ahead of master until #977 and #978 merge.

## LIVE — decision-9 trio proven end to end (#974 + #976 + #968, one batch pending); #950, #964 and #966 merged, 2026-09-30T12:24:13Z

- **Merged since the last block:**
  - [#964](https://github.com/WangPantopus/skinny-pantopus/pull/964) (batch 178, 11:51:06Z, master `0c3a2dae1`): a direct or parentless group chat is deleted when its last member leaves (migration `20260930161000`).
  - [#966](https://github.com/WangPantopus/skinny-pantopus/pull/966) (batch 179, 12:03:47Z, master `7709e55fb`) fixed **a miss of mine**:
    - #964's statement trigger (`REFERENCING OLD TABLE AS gone`) failed master's "Replay and lint the complete schema" job, because the application lint ran plpgsql_check without naming transition tables (`42P01 relation "gone" does not exist`). Both #964's own CI run and batch 178's failed that way, and I hadn't read it before the handover.
    - The lint now passes each trigger's `tgoldtable`/`tgnewtable`. Local result: 1 error → 0, with warnings, functions and bindings unchanged.
  - [#950](https://github.com/WangPantopus/skinny-pantopus/pull/950) (batch 179): the delete confirmation says what stays, and live-train organizers see Stream 1's paragraph.
    - Native checks on `675f51155`: Android ktlint, detekt, lint and assemble pass; `PrivacyViewModelTest` 15/15; the iOS build passes.
    - Resealed as `cd4e4988…`.
    - Its two iOS CI reds were master's: a SwiftFormat file, and the Start-wizard test that Stream 1 fixed in #967.
- **Open, one batch:** [#976](https://github.com/WangPantopus/skinny-pantopus/pull/976) (mine, head `987b9a218`), with Stream 3's [#974](https://github.com/WangPantopus/skinny-pantopus/pull/974) and Stream 4's [#968](https://github.com/WangPantopus/skinny-pantopus/pull/968) (`b410aae70`, migration `20260930162000`).
  - **The change:** account deletion step 1c retires each Home the person created or lives in, before anything else changes. The outcome is `deleted`, `purged` or `kept`. A refusal gives 409 `ACCOUNT_RECORDS_RETAINED` or 503 `ACCOUNT_DELETE_UNAVAILABLE`.
  - **E2E** on a local combined tree (bundle `20260930-stream5-retire-homes-r1`, seal `a9b574bf…`), real route plus real Chrome:
    - private setup: master leaves an orphan Home; now `deleted`;
    - member with a task photo: master 409 (23514); now 200 `kept`, and the photo stays with the household;
    - sole owner: `deleted`;
    - last member: `purged`, shell kept, and a later member sees nothing;
    - with the purge grant revoked locally, the route gives 503 and changes nothing.
  - **Checks on the final tree:** backend Jest 341 suites / 6286 tests, 0 failures; privacy and CI checks pass.
  - `987b9a218` moves the import into the step. The alias guard allowlists `backend/routes/users.js:306` by line number, so any new top-of-file import in users.js breaks the guard.
- **Decision 10** (standing direction; Stream 4 adopted it in `b410aae70`): the purge **closes and detaches** a household chat (type `group`, home_id NULL, inactive, "(closed)") instead of deleting it.
  - The next household can't inherit it through `get_or_create_home_chat`.
  - Former members keep their own history, read-only (`ROOM_INACTIVE`).
  - #964's trigger deletes the room once nobody else is in it. Both paths are proven (hs4/hs6; hs7 in real Chrome and hs10).
- **Observations sent, not changed:**
  - Stream 4: the task-media list still returns the deleted uploader's id from `HomeTaskMediaIntent`.
  - Stream 3: the LIF-02 pre-check counts an unverified occupancy with no access as a co-resident, so the owner gets `HOME_TRANSFER_REQUIRED`.
  - Both: a person linked only by `Home.owner_id` is ignored by `othersKeepHome` and by the purge.
- **Runtime state (Stream 5 stack 64531/64532):**
  - API 18134 runs the **local combined tree `a2e222885`**, not master. The DB has 162000 applied, ahead of master until #968 merges. Return the API to master after the batch.
  - My launcher now sets `HOME_DOCUMENTS_BUCKET=pantopus-home-documents` (a private bucket row on my stack), so task photos upload locally.
  - The proxy's deletion allowlist is off.
- **Fixtures to remove later by exact ids** (`DELBLOCK1` manifest):
  - accounts hs2b, hs4b, hs6, hs9 and hs9b, and solo2;
  - their homes, the hs4 shell and the closed chat;
  - hs5's master-run orphan Home;
  - the bucket row.
- **Next:**
  1. After the trio merges, return the API to master.
  2. Check the `ChatRoom` insert policy found today: "Users can create chat rooms" lets any signed-in user insert a room of any type through PostgREST. It's defense in depth, since participants can't be added that way. First confirm whether any user-token path creates rooms.
  3. The iOS pass, when the grant arrives.
- **Needs the user:**
  - simulator access for "Pantopus S5";
  - the money/legal call on payment-history accounts (recommendation: anonymize).

## LIVE — account deletion reaches most users; #935/#936/#947 merged, #949/#950 open; Android native pass done, iOS waits for the user's simulator grant, 2026-09-30T10:54:37Z

- **Merged since the last block:**
  - [#935](https://github.com/WangPantopus/skinny-pantopus/pull/935) (10:07:28Z, `effb6a991`): a closed task chat also refuses edits and reactions.
  - [#936](https://github.com/WangPantopus/skinny-pantopus/pull/936) (10:07:28Z, `069fc26c6`): account deletion waits for an open task stop (409 `TASK_STOP_IN_PROGRESS`).
  - [#947](https://github.com/WangPantopus/skinny-pantopus/pull/947) (10:39:05Z, `32903f11f`): a Support Train organizer can delete their account. The interim guard is gone, and the full route is proven: the co-organizer train passed to Erin; the draft and the no-co-organizer train were removed.
- **Open:**
  - [#949](https://github.com/WangPantopus/skinny-pantopus/pull/949): `BusinessAuditLog.actor_user_id` becomes nullable with SET NULL (migration `20260930151000`), and the web Activity views show "Former member". Real route 409 → 200; real Chrome shows "Former member". Seal `9b9499e8…`.
  - [#950](https://github.com/WangPantopus/skinny-pantopus/pull/950): the delete confirmation says what stays, on web, iOS and Android. It shows the shared-home line (Stream 4's) and, for live-train organizers, Stream 1's paragraph. Verified in real Chrome. The native builds are queued behind heavy. Seal `3c2d467c…`.
- **Launch-critical deletion finding:** 19 of the route's 45 "set to NULL" columns are NOT NULL, so most active users got 409 "contact support". Reproduced with a home-task author (bundle `20260930-stream5-delete-home-history-r1`, seal `81ac038d…`). Stream 1 assigned owners:
  - Stream 2: five Gig/Refund columns (PR B), and the stop records in [#944](https://github.com/WangPantopus/skinny-pantopus/pull/944), which I reviewed and approved. #944 must be renumbered above 141000.
  - Stream 3: `HomeAccessSecret`. Merged as #943 (141000).
  - Stream 4: the other Home columns, plus a trigger that keeps home documents' files (143000).
  - Stream 5: `BusinessAuditLog` (#949).
  - The dry run's 409 stays as the safety net until every part lands.
- **Acceptance evidence (A02):** "deletion from two devices at once" passes at the API level (both 200, both sessions 401, account gone). Bundle `20260930-stream5-delete-two-devices-r1`, seal `1bab2bd0…`.
- **Native pass for #908 and #923:**
  - Android PASS on `pantopus_s5`: Dana is refused the business room and closed rooms; Bob keeps his retired room, and a send gets the closed notice; Carl gets a fresh task chat and an error on the retired link. Bundle `20260930-stream5-native-pass-r1`, seal `268657d6…`.
  - **iOS: blocked.** The user hasn't granted Claude access to the "Pantopus S5" simulator; the attach was refused. Nothing was driven around that permission.
- **Decisions taken without asking (the standing direction):**
  - Implement Stream 1's organizer notice myself, because I own the delete screens.
  - Word the disclosure to cover every retained record type.
  - Change the web business-activity fallback to "Former member".
  - Keep native on-device display of the deletion 409 unverified. The Android path to the sheet runs through Identity Center, which my proxy blocks for accounts without a local profile (a harness guard).
- **Needs the user:** grant "Let Claude use it" for the "Pantopus S5" simulator in the simulator panel, so the iOS pass can run.
- **Update (committed 11:11:35Z):**
  - [#949](https://github.com/WangPantopus/skinny-pantopus/pull/949) merged (batch 172, master `af4e76f0c`).
  - [#950](https://github.com/WangPantopus/skinny-pantopus/pull/950) was approved by Stream 1 against its spec. The new head is `675f51155`: `runCatching` was removed from the Android train count, because it swallowed coroutine cancellation (Stream 1's review note). The native build is queued.
  - I reviewed and approved Stream 2's [#953](https://github.com/WangPantopus/skinny-pantopus/pull/953) (the five Gig/Refund columns, 152000).
  - **Cross-check after #944** (bundle `20260930-stream5-delete-cross-check-r1`): the real route now deletes a helper who released a task, a helper only notified of a reopen, and two owners whose tasks held stop receipts. The home-task author waits for Stream 4's 153000.
  - **Decision (standing direction):** `AdminAccessLog.admin_user_id` and `TrustAnomalyFlag.business_user_id` stay refused by design, because they are security and trust-and-safety audit records that support closes. `PersonaDm*` is a launch cut, so it's left alone.
  - **For the user (money/legal):** people with payment history still get "contact support" (`PAYMENT_HISTORY_RETAINED`), which may matter for App Store 5.1.1(v). My recommendation is to anonymize those accounts, keeping the payment records and removing the person. Not built.

## LIVE — #923 and #931 merged; #935 and #936 queued; native pass waiting for a device slot, 2026-09-30T10:06:01Z

- **Task chat privacy:**
  - **[#923](https://github.com/WangPantopus/skinny-pantopus/pull/923) merged** 09:40:00Z (`53f9f1a43`, batch 163), head `c1c1234da`, seal `4ddb60cd…`. When a task's worker is released or bidding reopens, its gig room is retired as an inactive `group` room named "… (closed)", kept by the owner and the previous worker, and the task's next phase gets a fresh room.
  - **[#935](https://github.com/WangPantopus/skinny-pantopus/pull/935) open** (Stream 1's #923 note 2). A closed chat also refuses edits and reactions (REST and socket) with `ROOM_INACTIVE`; deleting one's own message stays allowed.
    - On master all three writes succeeded; on the fix all three are refused, and the active-room control still works.
    - Head `9a8e9d9a1`, seal `a6ad0a37…`.
- **Account deletion (accounts):**
  - **[#931](https://github.com/WangPantopus/skinny-pantopus/pull/931) merged** 10:00:29Z (`3bcc4658a`, batch 166), head `90d0a9f2d`, seal `a9a1d758…`.
    - The defect, reproduced on master `c1634c693`: a helper who released a task, a helper only notified of a reopen, and that task's owner each got a 500 from `DELETE /api/users/account`. All three were signed out everywhere but kept a half-deleted account. Cause: 26 of 69 no-action FKs to `User` aren't cleared, and `GigStopRequest.gig_id` RESTRICTs the cascaded `Gig`.
    - The fix: `account_deletion_dry_run` replays the route's clearing plus the User delete in a rolled-back transaction, so the route refuses before any change (409 `ACCOUNT_RECORDS_RETAINED`, or 503). There's also 409 `SUPPORT_TRAIN_ORGANIZER` (Stream 1's wording). Sessions are revoked only after the User row is gone. Ten newer attribution columns are nulled, and the person's own reactions and stop notices are deleted.
    - Verified on the API (before and after) and in real Chrome (the toast shows the message).
  - **[#936](https://github.com/WangPantopus/skinny-pantopus/pull/936) open** (Stream 2's request). 409 `TASK_STOP_IN_PROGRESS` while the person has a stop request that isn't completed. It must merge **before** Stream 2's `actor_id` SET NULL migration. Head `d5acd348e`, seal `406d588f…`.
  - **Agreements with other streams** (each lifts its 409 with no route change, because the dry run re-evaluates live):
    - **Stream 2:** `GigStopRequest.actor_id` becomes nullable with SET NULL; `GigStopRequest.gig_id` and `GigStopDelivery.request_id` become CASCADE. Paid tasks stay behind the payment-history 409.
    - **Stream 4:** `HomeMapPin.created_by`, `CommunityMailItem.published_by` and `MailAssetLink.linked_by` become nullable with SET NULL, shown as "Former member".
    - **Stream 1:** trains get an organizer handover, then SET NULL; the `SUPPORT_TRAIN_ORGANIZER` guard is dropped when that merges.
  - **Recorded follow-up (not started):** move the whole deletion into one SECURITY DEFINER transaction, which would close the narrow dry-run/delete race (Stream 1's #931 note 1).
- **Decisions taken without asking** (the user's standing direction):
  - Refuse honestly rather than delete other parties' records.
  - Use a dry run rather than a catalog scan, which missed cascaded RESTRICTs.
  - A closed chat refuses edits too, to keep the record intact; deleting one's own message stays allowed.
  - The retired room is named "(closed)", which reads the same for both sides (Stream 2's suggestion).
  - Fixture emails in web screenshots are blacked out before sealing.
- **Native pass (#908, #923, #931, #935):**
  - The Android build of `c1c1234da` (APK `05acb1e0…`) passed ktlint, detekt and lint at 10:03:42Z. The iOS build is running under heavy, held since 09:50:41Z.
  - The device-slot request for `pantopus_s5` (5564) is queued; all four slots are held by Streams 1, 2 and 4.
- **Fixtures:**
  - `GIGROOM1` (alice, bob, dana, biz, carl, erin; gig1–gig8) and `DELBLOCK1` (del1, pairA owner and helper, pairB owner) stay for the native pass, then are removed by exact ids.
  - Proxy `chat-audit` is on for the fixture callers; the deletion allowlist was reset to off at 09:56:22Z.

## LIVE — task chat privacy: #908 and #912 merged, #923 open (released worker's chat); native pass next, 2026-09-30T09:27:02Z

- **Owner:** Stream 5 owns the gig-room privacy work (chat), by the coordinator's LOCKED decision of 08:22:50Z. The finding and the entry-point fix (#899) are Stream 2's.
  - **[#908](https://github.com/WangPantopus/skinny-pantopus/pull/908) merged** 08:53:32Z (merge commit `59eec5f41`, batch 160). Once a task has an accepted worker, its gig room admits only that worker or an owner actor, on every REST path, the socket and the badge. Evidence `20260930-stream5-gig-room-privacy-r1`, seal `31e40087…`.
  - **[#912](https://github.com/WangPantopus/skinny-pantopus/pull/912) merged** 08:55:48Z (`dce2eabed`, batch 161). A forward migration removes leftover members from assigned tasks' rooms. Tasks with a business owner or worker are skipped for review. Seal `45ffccf7…`.
  - **[#923](https://github.com/WangPantopus/skinny-pantopus/pull/923) opened** 09:26:19Z, for Stream 1's queue. It retires a task's room when its worker changes (Stream 2's review of #908, finding 1).
    - On master `4a681a48d`, after a real `worker_release`, earlier askers, new askers and the next worker all read the previous worker's chat, and the released worker lost it.
    - **Head `c1c1234da`**, after Stream 2's task-side review. Stream 2 approved and suggested marking the retired room; it is now named "… (closed)". Evidence `20260930-stream5-gig-room-rotation-r1`, **seal `4ddb60cdacda0dbd2d42b709c5bc05abee2fbac1d60fe57efa6958e649376479`** (88 files), which supersedes `dae47008…` (screenshot emails blacked out) and `11f00c7e…`. PASS on API, real sockets and real Chrome, including clean runs with a new owner. iOS and Android are pending.
    - The native build is queued behind Stream 3's heavy build (it acquires automatically). All four device slots are held by Streams 1–3.
- **Decisions taken without asking** (user's standing direction of 2026-09-30: best UX, safety and security; record them; keep working):
  1. **#908 rule.** One rule for REST, the socket and badges, in one new shared file, `services/chatGigRoomAccess.js`, because the routes and the socket export no helpers.
     - It fails closed: a failed task lookup refuses access, and a send then notifies nobody.
     - An owner actor includes `gigs.post`, the same as chat's existing business rule. Stream 2 confirmed `#899` admits the same actors and retracted finding 2.
     - `asBusinessUserId` counts only after `canActAsBusiness`.
     - Leftover members are hidden from member lists.
  2. **#912 migration.** Leftover rows are removed by a separate, reviewed forward migration that lands after #908. Business-owner and business-worker tasks are skipped for review.
  3. **#923 approach: retire, don't filter.** The old room becomes an inactive `group` room (`gig_id` and name kept), and only the owner and the previous worker stay in it. Every task-room lookup selects `type='gig'`, so the next phase starts in a fresh room with no edits to Stream 2's stop, acceptance, fee or dispute code.
     - A retired room takes no new messages (403 `ROOM_INACTIVE`, "This chat has closed. Message them directly to keep talking."). Group rooms have neither block checks nor business identity; direct messages carry the conversation on.
     - Rejected: keeping `gig` with a marker (Stream 2's lookups would need edits, and the dispute service's `maybeSingle` would break), filtering messages per phase, and converting the room to `direct`.
  4. **Rooms mixed before #923 deploys are not changed.** The founder runs the read-only `scripts/dry-run-existing-rooms.sql` first. A follow-up proposal would retire `open_now` rooms; `reassigned` rooms can't be split without moving messages.
  5. **Private-tool changes.** The proxy's chat-audit `callers` list now names the `GIGROOM1` fixture ids, including Erin. `fx.py` was restored from the kit into the runtime fixtures folder.
- **Flagged to Stream 2 (their file):** `stripe/disputeService.js` should take a payment's chat room from `GigPaymentAcceptance.room_id`, so evidence for a released worker's payment finds the retired conversation.
- **Runtime:**
  - Stack `pantopus-stream3-block-r1` (Kong 64531, DB 64532), rebuilt from master's 95 migrations 08:25:11–08:25:47Z. Local applies: `20260930093000` at 08:52:40Z and `20260930101500` at 09:13:37Z.
  - Services: API 18134 on `7647498e8`, proxy 18130, web 18131 (Next dev on `88149d747`; its chat files equal master's).
  - Fixture `GIGROOM1`: 6 accounts (alice, bob, dana, biz, carl, erin) and tasks gig1–gig7. It stays for the native pass, then is removed by exact ids, and chat-audit goes back to disabled.
- **Next:** the native pass for #908 and #923 on AVD `pantopus_s5` (port 5564) and simulator "Pantopus S5" (`F7C15A4C…`), under `device-slot.sh` and `heavy-slot.sh` with the `stream5:` label (Stream 1 announced toolchains ready; hub `177c17d44`). Then fixture cleanup.

## LIVE — Docker came back empty; Stream 5 runtime stopped; #843 merged, 2026-09-30T05:55:23Z

- **Docker (reported by Stream 2, Posts/Hub/payments):** Docker Desktop came back at about 05:51Z with **no containers, images or volumes**. Its disk image was recreated, so every local Supabase stack is gone, including Stream 5's and the founder's (64521/64522). No pg_dump archive was found.
  - Stream 5 confirmed 0 containers at 05:53:43Z; the host disk is now 54% used (188 GiB free).
  - Stream 5's database and every fixture in it (Owner/Member, crew pages, chats: F1–F14, CA0–CA11) no longer exist. The private credential files now point at accounts that don't exist.
- **Runtime stopped (05:54:22–05:54:41Z):** API 18134 (PID 57616), proxy 18130 (30675), web 18131 (Next 77942/59723) and test-file server 18198 (57987). Stream 5's ports stay reserved: 18130, 18131, 18134, 18197, 18198 and the stack range 64531–64539. Stream 2 was told at about 05:55Z.
- **Before any new Stream 5 check:** build a fresh stack from master migrations on those ports and recreate the needed fixtures with the kit's fixture tools (`fixtures-20260926/PLAN.md` and `manifest.json` describe them). The last frozen API was `23e518b11`; decide whether to move to master. Accepted evidence stays valid for unchanged source.
- **[#843](https://github.com/WangPantopus/skinny-pantopus/pull/843) merged** 04:24:12Z (merge commit `16da583e8`): master's AGENTS.md now names Stream 5. Draft [#842](https://github.com/WangPantopus/skinny-pantopus/pull/842) (S3-26) stays a draft.

## LIVE — renumbered to Stream 5; branch audit done; draft #842 and docs PR #843 open, 2026-09-30T04:08:28Z

- **Renumbering (user direction, 2026-09-30):** the former Streams 1 and 2 are each being split in two (Streams 1–4), so this stream, formerly Stream 3, is now **Stream 5**.
  - Coordination commit `478cdc05f` moved this file from `03-…` and added notices atop the hub README and PROJECT_HANDOFF. It also points every markdown link here and adds [NEXT-STREAM5-PROMPT-2026-09-30.md](NEXT-STREAM5-PROMPT-2026-09-30.md).
  - The session is named "Stream 5: Accounts and Social", and device leases use the `stream5:` label, and the kit scripts accept only `stream5:` (tightened at about 04:15Z after the former Stream 2 became Streams 3, with `stream3-home:` leases, and 4, with `stream4:` leases).
  - Streams 1 and 2 were messaged at about 04:06Z.
- **[#843](https://github.com/WangPantopus/skinny-pantopus/pull/843) (docs, for Stream 1's queue):** updates AGENTS.md ("three streams" becomes parallel workstreams, pointing to this branch's live guide) and gives master's older snapshot docs the same notice and file move. No application change.
- **Branch audit at the user's request (commit, push and PR anything left):** every Stream 5 worktree is clean.
  - Local unpushed Stream 5 commits are either patch-equivalent to master or local verification builds marked "not for push". Three older fix drafts have final versions on master (`275457c38`, `83fc150c8`, `9c01aad86`).
  - Pushed branches with commits not on master:
    - `claude/stream3-native-connection-persona-links`: an older draft, superseded by `83fc150c8`;
    - `codex/stream3-a02-remote-signout-retry` (docs; #158 closed as a duplicate of #143 and #157) and `codex/stream3-verify-android-integration` (#172 closed): closed deliberately;
    - `wip/stream3/accounts-social-publicshare-nostore`: a 2026-09-23 checkpoint with a local-only tsconfig change and a cut persona part; kept as a branch, not a PR candidate;
    - `claude/stream3-web-assistant-summary-chips` (S3-26): never opened, so it is now **draft [#842](https://github.com/WangPantopus/skinny-pantopus/pull/842)**. It is unverified because AI content is blocked; do not batch it until it is verified or the user accepts it.
- **Still true:** Docker has been down since 03:30Z, and the user decides the restart. No lease is held. The open items are listed in the resume prompt §4.

## LIVE — user-approved round complete: #831, #833 and #839 all merged, 2026-09-30T03:40Z

- **User direction (2026-09-29T22:09:04Z):** build the notifications-off notice, the web account-deletion confirmation and the native lost-reply deletion check; verify end to end in the real apps; no unit tests. All three are built and verified.
- **[#831](https://github.com/WangPantopus/skinny-pantopus/pull/831) merged** (batch 130 #832, 01:32:16Z): "Notifications are off" banner with Open Settings (iOS + Android). Head `eab4f5c86`, seal `179873a4…` ([RESULT](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260929-stream3-notifications-off-notice-r1/RESULT.md)).
- **[#833](https://github.com/WangPantopus/skinny-pantopus/pull/833) merged** (batch 131 #834, ~02:15Z, master `3a2b816ba`): web deletion outcome on `/login`. Head `c80d5a78c`, seal `9306c6b1…` ([RESULT](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260929-stream3-web-deleted-confirmation-r1/RESULT.md)).
- **[#839](https://github.com/WangPantopus/skinny-pantopus/pull/839) merged** 03:36:29Z (merge commit `244c967d6`, batch 134 [#840](https://github.com/WangPantopus/skinny-pantopus/pull/840), master `8e44382ce`). S3 verified independently: `d5d60506a` is an ancestor of master and all 4 blobs match. Native deletion when the answer is lost.
  - Head `d5d60506a`; base `a3b3a5179`; clean against master `f35f71857`. Seal `cf7d9ce81ea8673dda70f549c9e1abe7d6f1e90deaab43ddbaf2935cb55fe092`, 232 files ([RESULT](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260929-stream3-native-delete-lost-response-r1/RESULT.md)).
  - Rule: the DELETE fails without an answer → probe refresh. Rejected → sign out, forget that account only, and show the login banner "We couldn't confirm your account was deleted. If you can still sign in, try again from Settings." Valid → the existing error. Success is unchanged.
  - Builds of the head: iOS dylib `ff8699db…`, APK `82be9358…` (heavy 02:39:21–02:54:50Z). All cases PASS:
    - iOS (2026-09-30): lost answer 02:59:59Z, first answer lost 03:03:58Z, no deletion 03:07:16Z, normal 03:09:39Z.
    - Android: lost answer 03:14:40Z, no deletion 03:18:27Z, normal 03:20:09Z.
  - Befores on `a90eda9aa` builds (equal to the base for every deletion, auth, network and settings path): iOS 2026-09-29 22:32–22:35Z, Android 03:26–03:27Z. Both showed "Can't reach Pantopus" while the server had deleted the account; a retry then gave "signed out for security" plus a card for the deleted account.
  - Lint: SwiftLint and SwiftFormat are clean; ktlint/detekt show nothing in the two Kotlin files.
- **Decisions taken without asking (UTC):**
  - 00:53–01:04Z: truthful "couldn't confirm", on native and web. Reason: at 00:51:49Z a DELETE revoked the sessions and then answered 500 with the account kept.
  - 01:38:05Z: deleted a local harness output that had captured a fixture cookie header (never committed; the account was deleted 01:39:15Z). The harness now redacts errors.
  - 01:46:58–01:51:22Z: S3's dev server served master's web files for the before run (restored and hash-checked).
  - 02:39:21Z: took heavy at 1-minute load 179 once Stream 1 released it. The load came from processes outside S3; memory was 34% free.
  - 03:22Z: replaced the first Android before-run, which had run on the emulator's snapshot APK (`634807499`, whose auth files differ from the base), with a rerun on the `a90eda9aa` APK.
- **Backend recommendation (not changed; security-sensitive, for the user and Stream 1):** in `DELETE /api/users/account`, revoke sessions only after the deletion commits, and clear the session cookies in its response.
- **Resources:** S3 holds no heavy, slot or driver.
  - Heavy 02:39:21–02:54:50Z.
  - iOS slot 3 + shared driver 02:55:15–03:11:24Z; then handed to Stream 2. The Owner is signed in again on iOS; sim `0AE16FA0` shut down.
  - Android slot 3 03:11:38–03:20:36Z and 03:23:19–03:27:55Z; emulator stopped.
  - Fault rules empty; deletion allowance off. Fixtures AUTH-DELETE3 through -R7, AUTH-DELETE7 and AUTH-DELETE8 deactivated; every private credential file deleted. API keys valid to 2026-10-01T19:35:48Z.
- **Disk full / Docker down (Stream 1 report, 03:30Z):** every local Supabase stack is offline, including S3's; its API, proxy and web processes have no database until Docker restarts. Stream 1 will ask the user before restarting Docker, because the founder's stack is on it.
  - At 03:32:46–03:33:01Z, S3 deleted only its own caches: iOS DerivedData, the SPM cache, old app copies and APKs, and the build worktree's Android outputs. Free space went 10167 → 18699 MiB.
  - The next S3 iOS build will be clean.
- **Next:** nothing pending in S3. Stream 1 records the backend recommendation as an open security-sensitive follow-up. Docker waits on the user. Open rows stay at boundaries the user supplies (physical devices, provider access, policies; see the previous block).

## Previous milestone — Stream 3 close-out sweep complete: PR805 merged, 2026-09-29T21:39Z (superseded by the LIVE block above)

- **Merged (verified independently at 21:35:44Z):** PR805 exact head `a90eda9aa` merged 21:35:18Z (merge commit `1e277e751`) through batch 121 [#808](https://github.com/WangPantopus/skinny-pantopus/pull/808) (21:35:16Z, with #806 and #807). Master is `ca946bbb2b9824bf34129daf4b6d75df2ca0f67e`; the candidate is an ancestor of master and all 5 file blobs on master equal the candidate. Stream 1 reviewed the diff, verified the 76-file seal and ran verify-batch.
- **CI note:** PR805's red checks all come from other streams' files already on master: SwiftLint (8, Place and Support Trains), ktlint (96, Support Trains, Maintenance, Place and Posts), and the migration safeguard (`20260928122200_support_train_update_push_choice.sql`). Local runs on the 5 files are clean: SwiftLint; SwiftFormat 0.61.1 (0/4 need formatting); ktlint in CI (no SignUpScreen finding); detekt `:app:detekt` at `a90eda9aa` (12 findings, none in SignUpScreen, including TokenAuthenticator ReturnCount that Stream 1's CI repair covers). Heavy slot held 21:36:10–21:38:05Z for that detekt run only; its Gradle daemon (PID 44219) was stopped at 21:38:27Z.

- **[PR805](https://github.com/WangPantopus/skinny-pantopus/pull/805)** "fix(auth): show sign-up errors on screen and keep emails as typed", opened 21:29:43Z.
  - Exact head `a90eda9aa4e35bad18e9b5b952c2b98f39f27509`, base `59154879d`; 5 native files, +54/−8.
  - Handed to Stream 1 for the merge queue at about 21:30Z. Master `e1bee221c` changed none of the 5 files, and merge-tree was clean.
  - [Private RESULT](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260929-stream3-native-push-tap-weak-password-r1/RESULT.md): 76 files, seal `737b208fb5bb29fb4beaecf55f1614bd0c457eb466f0617074ed43d9f4243fc4`; [seal comment](https://github.com/WangPantopus/skinny-pantopus/pull/805#issuecomment-5899321062). The builds are bound to the head's app trees (iOS `a4bb49c16bd1`, Android `4a6731549e74`).
  - **Defect A, verified before and after on both apps:** one sign-up answered 400 weak-password before upstream (no account). The banner was off screen on iOS `f1a5` (20:01:51Z) and Android `8f6dbc11c` (20:50:27Z). On the candidate it is visible without scrolling on Android (20:56:01Z) and iOS (21:19:05Z).
  - **Defect B, iOS:** typed synthetic addresses now stay exact in all three fields. Before, sign-up showed "S3-weakly-…", and Create Business → Basic info and Invite teammate showed a capital first letter with a spell-check underline (21:07:15Z, 21:10:13Z). After: exact matches at 21:11:51Z, 21:13:19Z and 21:18:37Z. Stream 2 independently reproduced this with real on-screen key taps on its own three fields; those fields are in Stream 2's PR.
- **Notification-tap routing, no app change:** iOS 5/5 PASS (previous block). Android 3/3 PASS on the candidate APK `6438be6d…`, using the exact tap intent:
  - Signed out: stays on Log in, then sign-in 200 at 20:59:17Z opens the chat.
  - Cold start: `COLD`, session restore, chat at 21:01:57Z.
  - Background: `HOT`, same process, chat at 21:02:47Z.
- **Earlier today, verification only:** web lost-response account deletion shows no defect ([RESULT](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260929-stream3-web-delete-lost-response-r1/RESULT.md), 17 files, seal `f9a88ff6138f84df9ad8e97f1463e26c78d76bdde80a1c768d9863d27798c23b`).
- **Writes/DB:** only refresh, login ×3 and logout ×2 reached the API; register ×4 were injected rejections; device registration and chat writes were refused by the guard. DB windows 19:41:52→20:32:20Z and 20:35:12→21:23:19Z changed only auth/session tables, plus the existing file-access counter from opening a chat image.
- **Design proposals (need user approval; not implemented):**
  - A notice on the existing notification settings screens, with "Open Settings", shown only when OS notifications are denied (both apps).
  - A confirmation after a web account deletion whose response was lost.
- **Post-launch note, launch cut #1/#2 (not verified or fixed, per the cut):** Stream 1 reports, via Stream 2, that Android `FollowingApi.markSeen(): FollowingSeenResponse?` would throw KotlinNullPointerException if `/api/personas/me/following/:personaId/seen` returns 204. Stream 1 fixed the same Retrofit pattern on `removeOrganizer` with a `Unit` return. Revisit when Beacon/personas return.
- **Resources:**
  - Android slot 3 20:46:50–21:03:47Z (emulator stopped 21:03:42Z).
  - iOS slot 2 21:03:52–21:21:58Z (sim shut down).
  - Shared iOS driver 21:00:42–21:22:05Z, then handed to Stream 2 (and on to Stream 1).
  - No heavy slot used. Fault rules empty; synthetic files deleted; Owner signed in on both apps.
  - API 18134 keys valid to 2026-10-01T19:35:48Z. No S3 lease held.
- **Decisions taken without asking (UTC):**
  - ~21:05Z (before the 21:05:15Z boot): capture the crew-field befores on the reused `f1a5` build, so the two crew-field changes rest on a reproduced failure.
  - ~21:17Z: discard the sign-up after attempt that iOS's "Use Strong Password?" sheet spoiled, and retype. The sheet was closed with X, never Fill.
  - ~21:24Z: keep the tested head rather than rebase (no overlap with master).
  - ~21:28Z: leave ktlint/detekt to CI rather than take the heavy slot.
  - ~21:30Z: log the Following 204 report only (launch cut).
- **End of sweep: everything locally feasible is closed.** The 10 S3 acceptance rows stay open only at boundaries the user must supply:
  - N01, N02 and part of A02: physical devices, release builds, push credentials; also secure storage, biometrics and provider revocation on devices.
  - A01: Apple/Google test sign-in and real email sending.
  - A03: hosted storage. A04: Smarty activation.
  - N05: a daily-briefing delivery policy, and whether Crew Day gets an entry point.
  - S3-22/S3-62: permission for `/b/` reads in the isolated DB. S3-26: an AI provider key, or accepting the gap.
  - N03: Beacon parts are cut; Pulse posting is Stream 1's. N04: moderation processing.
- **Shared chat picker (Stream 1 batch 123 [#815](https://github.com/WangPantopus/skinny-pantopus/pull/815), master `553b91504`, merged 21:52:13Z):** Manage train reuses the chat new-message picker as "Add co-organizer" (#812) through new optional parameters: iOS `NewMessageView(viewModel:title:emptyHeadline:emptyBody:)`, Android `NewMessageScreen(..., title, emptyHeadline, emptyBody, viewModel)`. Stream 3 reviewed the diff at 2026-09-29T21:53:15Z: the defaults equal chat's current copy ("New message"; nil falls back to the view model's empty text), and chat's own call sites (`InboxTabRoot`, `RootTabScreen`, default `hiltViewModel()`) are unchanged. No chat behavior change, so no re-run. Keep these defaults when editing either file.
- **Next:** nothing pending. Stream 3 is idle and ready for user-supplied access and devices, a decision on the proposals, or a routed finding. Stream 1's #798 updates S3's old 8-character Auth unit-test samples to the 12-character rule (tests only).

## Previous milestone — Stream 3 close-out sweep: native pass in progress, candidate a90eda9aa awaiting heavy, 2026-09-29T20:25Z (superseded by the LIVE block above)

- **Native pass (reused builds, no heavy build):** iOS `f1a5fcf2b` (dylib `6eb9fff8…`) and Android `8f6dbc11c` (APK `7531958c…`). Their notification, routing, auth and password sources are byte-identical to master; everything else changed since belongs to S1 or S2.
- **iOS notification-tap matrix** (S3 sim `0AE16FA0`; slot 2 plus shared driver 19:50:26–20:09:14Z; sim shut down). Payloads mirror the backend APNs builder.
  - Signed-out tap (stashed, then sign-in 200 → the chat opens): PASS.
  - Cold-start tap: PASS.
  - Push for the chat on screen (banner suppressed): PASS.
  - Background tap: PASS.
  - Room this account can't open (403, "You don't have permission", no data): PASS.
  - [Unsealed notes](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260929-stream3-native-push-tap-weak-password-r1/REPRODUCTION.md).
  - Test-device change: notifications were **denied** on this simulator and Settings refused the switch, so the same build was reinstalled and Allow was chosen on its own prompt. The permission is now authorized; the Keychain Owner hint survived and Owner is signed in again.
- **Reproduced sign-up defects** (proxy-injected weak-password 400 before upstream, synthetic address, no account created):
  - (A) iOS shows "Choose a stronger password." in the top banner, which is off screen after the normal scroll to the terms box, so nothing visibly happens.
  - (B) The iOS sign-up email field autocapitalizes and autocorrects (typed "s3-weakpw-…" became "S3-weakly-…"); the login email field already opts out.
  - Android has the same banner structure; its afters wait for the candidate build.
- **Candidate** `a90eda9aa4e35bad18e9b5b952c2b98f39f27509` (branch `claude/stream3-signup-error-visible-email-input`, base `59154879d`), 5 files +54/−8, SwiftLint clean:
  - iOS `FormShell` gains opt-in `scrollsToTopOnChange` (nil by default; other forms unchanged); sign-up passes its error.
  - Android sign-up wraps its banner in a `BringIntoViewRequester` (Android FormShell untouched).
  - The email modifiers go on sign-up plus two S3 crew-tool fields built the same way (business legal info, teammate invite).
  - Heavy is queued after S2; builds with the kit's app-only helpers from the clean native worktree, then iOS/Android afters.
- **Design proposal (needs user approval; not implemented):** neither app shows when the OS notification permission is denied (iOS `authorizationStatus` 1; Android `POST_NOTIFICATIONS` user-fixed denied). The in-app Notifications screen lists toggles "on" while nothing can arrive. Proposed: one row or notice on the existing notification settings screens with an "Open Settings" action, shown only when permission is denied.
- **Excluded harness events:**
  - One iOS background tap landed before the banner appeared.
  - Android under host load 43–62: a scroll registered as a tap on "Continue with Apple". The backend returned only the sign-in URL (`GET /api/users/oauth/apple` 200); Chrome stopped at its first-run screen and was backed out. No provider page, credential or account.
- **Resources:** Android slot 3 20:10:25–20:19:27Z, emulator stopped. Fault rules are empty; synthetic value files deleted. No S3 lease held now.
- **Decisions taken without asking (UTC):**
  - 19:50Z: reuse byte-identical builds instead of rebuilding.
  - 19:58Z: reinstall the same iOS build to reset the simulator's denied permission (a test device; disposable state).
  - 20:21Z: fix the banner through an opt-in on shared `FormShell` rather than per-screen scroll hacks, and include the two identical S3 crew email fields.
  - Record the denied-permission UI as a proposal, since it's a visible design change.

## Previous completed milestone — Stream 3 close-out sweep: PR793 merged, 2026-09-29T19:48:35Z

- **Merged (verified independently at 19:48:35Z):** [PR793](https://github.com/WangPantopus/skinny-pantopus/pull/793) exact head `c8ebd750b` merged 19:48:08Z through batch 116 [#795](https://github.com/WangPantopus/skinny-pantopus/pull/795) (19:48:06Z, with Stream 2's #794). Master is `f7a0a4a9d5d6b0f244b20bf95f7fdbe727618ad9`; its `page.tsx` blob `05a952d0fb87` equals the candidate. Stream 1 reviewed the head and verified the seal. Stream 1's CI-repair PR adds a one-line `@Suppress("ReturnCount")` to the Android `TokenAuthenticator` from #655; Stream 3 agreed (annotation only, #655 evidence unaffected).
- **User direction (2026-09-29, before 19:16Z):** close out every locally feasible Stream 3 item. The user will then provide provider access and run the physical devices personally.
- **[PR793](https://github.com/WangPantopus/skinny-pantopus/pull/793)**, exact head `c8ebd750b1ca20b48cf799d39d29e2cbb7e8dac6`, base `e5612639549a884f2380a45a0640f3e22bfe9b2d`. Master `e454b7a3b` leaves all 12 involved files unchanged, and merge-tree is clean. One existing file, `page.tsx` +35/−13; no test file changed. It repairs two reproduced problems:
  - **Bounce when sign-out fails:** at 19:16:39–19:16:50Z a stale `/` visit with logout failing went `R400 L429`×30 then `R429`, over 62 page loads. A failed logout now expires the JS-readable `pantopus_session` flag in the browser.
  - **#785 broke four existing web tests:** CI run 36520728288 and locally, 4 failed of 21. My #785 acceptance hadn't run that file. The "signing out" marker now names the page copy that owns the sign-out, which clears it on unmount; a remounted copy still reads it, so #785's protection stays.
- **Actual evidence** (real Chrome, candidate):
  - B1 stale `/` with logout failing: one `R400` and one `L429`, lands once on `/`, flag cleared.
  - B2 stale `/app/hub`: `R400 L200` once, then real sign-in 200 and sign-out 200.
  - B3 `/app/hub` with logout failing: `R400 L429` once, then `/login`.
  - B4 valid refresh: `R200`, no logout (49×200, 0×401).
  - B5 injected 503: transient screen, then Try again → `R400 L200` once.
  - Existing test file 21/21, ESLint clean, typecheck gate 0 errors.
  - [Private RESULT](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260929-stream3-web-session-flag-bounce-r1/RESULT.md): 47 files, seal `15133295553b8638dd22cc4ff2ab7f5dff0beaf12ef00db96f6538d16ca1caf8`; [seal comment](https://github.com/WangPantopus/skinny-pantopus/pull/793#issuecomment-5897411242).
- **Runtime:**
  - The Stream 3 API launcher mints its local keys for 48 hours, so they expired at 12:54:19Z. The first sign-in check then got 404 "User profile not found" (PostgREST: JWT expired); that run is excluded.
  - Restarted Stream 3's own API: SIGINT 57985 → 57616 at 19:35:48Z, same clean `23e518b11`, keys valid to 2026-10-01T19:35:48Z. The DB was unchanged across the idle period.
  - Web 18131 serves the detached candidate `c8ebd750b`. Proxy 18130 and files 18198 are unchanged. Fault rules are empty, and no helper or private state file is left.
  - DB diff: only auth history from two real sign-ins, both signed out.
  - No heavy or device slot used.
- **Decisions taken without asking (UTC):** 19:16Z reproduce the recorded #785 limit first; 19:19Z clear the flag inside the existing `signOutLocally()` and keep `/` as the designed fallback; 19:21Z fold Stream 1's reported test failures into the same PR by fixing the implementation, not the tests; 19:35Z restart Stream 3's own API to renew its expired keys (runtime only).
- **Next (locally feasible):**
  - Then a native pass, once the heavy slot is free (Stream 1 holds it since 19:29:19Z):
    - N01 app-side notification-tap handling on the iOS simulator via `simctl push`: cold start, background, signed-out continuation, and a notification for the other account after switching (earlier evidence covers the foreground banner and routing).
    - #727's native weak-password error screens, which have been source-reviewed only, through a controlled server response.
  - Everything else needs the user's access, devices or decisions (listed at the end of the sweep).

## Previous completed milestone — Stream 3 web stale-session repair PR785 merged, 2026-09-29T03:26:20Z

- **Merged (verified independently at 03:26:20Z):** [PR785](https://github.com/WangPantopus/skinny-pantopus/pull/785) exact head `51ae9c05d2f27130b09cf38561d7a7c96e934689` merged 03:25:44Z through batch 112 [#786](https://github.com/WangPantopus/skinny-pantopus/pull/786) (tip `1f7779d02`, merged 03:25:42Z). Master is `bf64e3c0a2e5160232f776e85abe4ad0db91b1d9`. REST merge state, ancestry and master's `page.tsx` blob `f926a63ad3b3` (equal to the candidate) all check out. Stream 1 reviewed the diff and verified the 52-file seal and its batch proofs. No Stream 3 PR, fixture, fault rule or lease remains. Web 18131 keeps serving the merged candidate tree (detached `51ae9c05d`); it has no reason to rebuild.
- **Lead:** Stream 1 routed an incidental web finding, received after its last recorded 02:23:32Z and acknowledged before 02:33:10Z. On master `be05b58dd` (its proxy seq 44285–44319), one stale-session visit to `/app/hub` sent 16 refresh and 15 logout requests one after another, and the visitor's sign-in then got 429. Stream 1 changed nothing and handed it to Stream 3 (retained A02 sessions).
- **Root cause (real contract traced):** `/session/refresh` signs out after an invalid refresh. That sign-out's token change makes `QueryProvider` remount every page: its key is `sessionGeneration`, from Stream 3's own account-retirement change `b414ad6f6` (2026-09-20). The remounted page has a fresh `startedRef` and a cleared loop guard, so it refreshed and signed out again, until a 429 or until a navigation happened to commit.
- **Reproduced on the Stream 3 runtime** (all involved files byte-identical to master):
  - Run 1, 02:43:01Z: `R400 L200`×10, `R400 L429`×5, `R429`.
  - Run 2 on exact master `14ec28c93`, 02:58:51Z: `R400 L200`×10, `R400 L429`×3. The real sign-in then got 200, but the visitor's own sign-out got **429** because the IP's 10 logouts per 15 minutes were spent.
- **Repair:** [PR785](https://github.com/WangPantopus/skinny-pantopus/pull/785), exact head `51ae9c05d2f27130b09cf38561d7a7c96e934689`, base `14ec28c93`. Master `f0f2030de` leaves all 11 involved files unchanged, and merge-tree is clean.
  - One existing file, `frontend/apps/web/src/app/session/refresh/page.tsx`, +11/−1. A module-level `signingOut` flag is set before either sign-out branch; a remounted copy shows the existing "Taking you back…" state and sends nothing.
  - No new file, API, schema, design change or unit test. Native apps are unaffected.
- **Actual evidence** (real Chrome → Next → no-send proxy → API → DB, on the candidate):
  - Stale session with logout still exhausted: `R400 L429` once, then `/login`.
  - Fresh budget: `R400 L200` once, then real sign-in 200 → `/app/hub` → sign-out 200.
  - Valid refresh: `R200`, back on `/app/hub` with no logout (49×200, 0×401).
  - Server-revoked refresh (Stream 1's state): `R401 L200` once.
  - Injected refresh 503: the existing transient screen with no logout, then Try again → `R400 L200` once.
  - Web typecheck gate: 0 errors.
  - [Private RESULT](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260929-stream3-web-session-refresh-remount-r1/RESULT.md): 52 files, MANIFEST.json seal `799180dcd28f2ed126f55d2f4a99acd90d8b64a54db065e11846d50c622f7aae`, sealed 03:22:06Z; [seal comment](https://github.com/WangPantopus/skinny-pantopus/pull/785#issuecomment-5883011884). CI is informational.
- **Cleanup and resources:**
  - All four Owner sessions (one from the master before-run, three from setups) are signed out or revoked. Fault rules are empty, this bundle's private token-bearing state files are deleted, and the credential helpers have exited.
  - 386-table diff: only truthful auth, session and security history, plus one `PropertyIntelligenceCache` `fallback` row. That row was created at 02:59:27.742Z by the real Hub `GET /api/ai/pulse` during the master before-run; there is no ATTOM or AI key, so no provider was called, and it expires at 2026-09-30T02:59:27Z.
  - Web 18131 now serves the detached candidate `51ae9c05d` from `/private/tmp/pantopus-stream3-web-chat-names-r1` (previously `704d15e80`; Next dev reloaded itself). API 18134 stays on `23e518b11`; proxy 18130 and files 18198 are unchanged. No heavy or device lease was used.
- **Decisions taken without asking (UTC):**
  - Before 02:33:10Z: take the routed lead and trace before any change.
  - 02:42:52Z (redirect receipt): the middleware redirect lands on `localhost:18131` because Next dev is bound to 127.0.0.1, and that origin is outside the API CORS allowlist. Treat this as a dev-only harness boundary, and correct only main-frame 3xx Location hosts inside the evidence tool.
  - 02:45:47Z: repair only the page. Keep the `QueryProvider` remount, `signOutLocally`, the limiters and the middleware as they are.
  - 03:19–03:20Z: retain the fallback cache row as truthful read bookkeeping, and delete this bundle's own revoked state files.
- **Limits and next:**
  - The loop-breaker branch is source-reviewed only.
  - Not reproduced: a visitor whose logout keeps failing with `onFail=/` can bounce between documents until a refresh 429. Recorded as an observation, not repaired.
  - Local dev runtime only: no hosted or production build, no other browsers.
  - Excluded harness runs: two CORS-blocked runs (02:38:50Z, 02:40:14Z) and run 1's missing browser event file (credential-helper Origin).
  - Next: nothing pending for Stream 3. Open new work only for a reproduced in-scope failure or a changed prerequisite. Earlier Stream 3 boundaries are unchanged: S3-22/26/62, the missing Crew Day caller, physical/provider limits and the launch cuts.

## Previous completed milestone — Stream 3 bounded reconciliation pass, 2026-09-29T02:03:31Z (no new work found)

- **Result:** Stream 3 remains complete for this bounded pass. There is no open Stream 3 PR, changed prerequisite or reproduced in-scope failure. No app was launched or built, and no fixture, device/heavy lease, runtime or product code was touched. All accepted evidence is reused unchanged, including the 94-file password seal `e2248c30…` in the block below.
- **Git/PR state (checked 01:58–02:03Z):** master `be05b58dd045a62f0afa3a470b37fd64cc50fcf8` (batch108) is 22 first-parent merges (batches 87–108) past the PR727 master `517d3cdf2`. All 17 Stream 3 PRs are MERGED per REST: predecessors 593/594/595/596/597/600/604/605/612/618/623 and takeover 628/634/639/648/655/727. Open PRs are S1 draft #718 (held) and unrelated #46/#429/#430/#625; none is Stream 3.
- **Drift check:** 83 non-docs files changed in that range, all S1 Support Train or S2 Home/Place. Of the 20 files in the six takeover PRs, 18 are byte-identical. `HubTabRoot.swift` and `YouTabRoot.swift` differ only by S1's Support Train `editSignup(supportTrainId:reservation:)` route (8+/8−). All 18 PR634-added DM-callback lines remain verbatim.
- **Shared-surface source review:** `createBulkNotifications(notifications, { sendPush = true } = {})`: 16 of 17 non-test call sites pass one argument and keep push; only S1's Support Train update passes the flag. The shared native GroupedList `toggleEnabled` defaults to `true` on both platforms; only S2's Home security screens pass it. In-scope notification and settings behavior is unchanged for Stream 3 callers, so no journey rerun is warranted.
- **Prerequisites unchanged:** Crew Day still has no caller in `frontend/apps` or `backend` at either ref (0 matches). /b/ reads stay refused (S3-22/62, crew Contact/toast), the AI/provider boundary (S3-26) is unchanged, and migration `20260926100000` was not applied. Every coordinator/peer note since 04:21Z marks S3 frozen; no lead was routed to Stream 3.
- **CI (informational; required checks disabled):** master CI [36423610710](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36423610710) failed only in peer-owned jobs: ktlint/SwiftLint style in S1/S2 files, the iOS test bundle's stale `EditSignupFormView` call (missing `supportTrainId`, from S1 #741) and the migration-history guard. No Stream 3 file is named. Not repaired here: outside ownership, and user direction excludes unit-test work.
- **Resources:** Stream 3 holds no lease. At 02:01:09Z device slot 1 was S1 (#718 Photos hold), slots 2–4 free, heavy free. The retained Stream 3 runtime was not touched.
- **Decision taken without asking (2026-09-29T02:03:31Z):** open no investigation, because the reconciliation found no reproduced in-scope failure or changed prerequisite; per user direction, do not manufacture work or repeat accepted journeys. The limits in the block below stay open and unverified: physical/provider/push/storage/production/live money, user-owned flags, S3-22/26/62 and Crew Day.

## Previous completed milestone — Stream 3 native password repair merged, 2026-09-28T04:21:30Z

- **Merged:** [PR727](https://github.com/WangPantopus/skinny-pantopus/pull/727), exact `8f6dbc11ccadf976ae2d7e9e594c09312d19019b` merged04:18:26Z through [batch86/#728](https://github.com/WangPantopus/skinny-pantopus/pull/728) at04:18:24Z; current master `517d3cdf24083ce8f0967750350afd5df7da08cf`. REST, source ancestry and all nine merged file blobs verified 2026-09-28T04:21:30Z. Nine existing files18+/18-. Both native signup/reset minimums now match the server's12-character contract. Android reset server failures retain the actual message instead of appearing as weak-password errors. Existing login policy and screen design are preserved. No new app file/API/schema, unit tests, lint campaign or subagents.
- **Actual evidence:** Both installed native apps passed8/11 local rejection,12 controlled pre-upstream submission, reset confirmation mismatch and draft retention. Final Android reset503 and manual retry display the correct error, exactly one request per activation. App-only builds and installed hashes verified. Full iOS tree/all eight minimum paths remain identical to verifiedf1a5; prior strong signup201/reset200 functions source-bound and reused. No fresh account creation or password rotation. [Private report](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260928-stream3-native-password-minimum-r1/RESULT.md),94 files, manifest `e2248c30502363bafb3d38f94ac7189c575ba1f9fb2494b06801b7cb377221d3`, sealed04:04:53Z. CI[36376246926](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36376246926) running/informational at submission. Pre-merge masterf982a4869 auth paths were unchanged from base; no behind-only rebuild.
- **Cleanup/resources:** AUTH-MIN1 cleaned04:02:43Z. Synthetic auth/public User counts0; all386 table hashes compared, only truthful authentication/session/device/security history changed. Every other table hash identical; drafts discarded and canonical Owner restored through UI on both. Guard OFF/faults0. Android final APK7531958cba65; iOS f1a5 dylib6eb9fff88844. Heavy released03:59:11Z; iOS0AE shutdown/slot3+driver released03:46:14Z; Android5554 normal shutdown/PIDgone/slot2 released04:02:43Z. No S3 leases. API18134 stays23e518b11; proxy18130 PID30675,web18131/file18198 retained. Prior restrictions unchanged.
- **Decisions taken without asking:**02:56:29Z/03:05:19Z scope only the new short-password boundary with exact synthetic no-send guards;03:20:12Z repair existing validators and guidance;03:25:24Z exercise reset using an unissued capability;03:56:57Z repair the reproduced Android reset mapper by moving its existing server-status branch and rerun only affected failure/retry. Source/proxy/cleanup decisions and UI harness exclusions are recorded in the sealed RESULT and PR body.
- **Next/limits:** All six takeover repairs628/634/639/648/655/727 are merged; no pending S3 PR or active fixture. Source and sealed evidence preserved; no behind-only rebuild. Earlier eleven predecessor PRs also remain merged. Retain/reuse accepted evidence. Roughly90–95% of the known retained repair checklist;22 whole launch cuts/47 retained or mixed rows. S3-22/26/62 are in-scope blocked rows; CrewDay needs a shipped caller. Dedicated weak-error screen copy has build/source review only; physical secure-store/biometric/OAuth, providers/push/storage/production/live money remain explicitly unverified. User-owned feature flags were not verified. No independently feasible unaccepted local gap remains identified in the existing retained mapping. Continue only for a new reproduced gap or a change to the recorded prerequisite; do not repeat accepted or cut journeys.

## Previous completed milestone — Stream 3 Codex takeover, 2026-09-27T17:53:30Z

- **State:** All five focused repairs from this takeover are merged: web628, native DM634, profile639, remembered-login648, Android step-up655. Latest655 exact `8686fb535b35fa1db0d2ac2a3bfee3b8d45cb56a` merged17:51:25Z via batch55/#656 (batch17:51:23Z), master `cda42fb8ac01ef4b91d403ca069adcce140300aa`; REST and ancestry verified. Work performed personally, no subagents. Launch cuts applied; no unit tests or broad lint/CI campaign.
- **Current source:** Retained `/private/tmp/pantopus-stream3-chat-keyboard-r1`, branch `codex/stream3-stepup-credential-rejection`, clean/pushed8686 on base1c82a914d. One existing Android TokenAuthenticator +13; exact credential-rejection discriminator preserves normal refresh. Android APK hash2610306dcd5365b2a6790a19245c7a055b612c6c50c9cefc0080ae4dd9a6e60d installed and verified. Unchanged iOS6b5 reused, dylib1d5e1fc8a941f64960517ece7c9e7cd399ba2a4c0a9aa056d3395a3ba7de5425.
- **Sealed evidence:** Account deletion bundle `20260927-stream3-native-account-delete-r1`,40 files, seal `a8b25c03254c57d3b8134202d4483e84d4db38ca6e4921f071f2f74e1ff8361a`, sealed17:47:17Z; [PR655 seal comment](https://github.com/WangPantopus/skinny-pantopus/pull/655#issuecomment-5858269933). Actual Android wrong-password/correction/ordinary401 refresh and both native typed confirmation,503/retry, real deletion, SQL retirement and signed-out relaunch covered. All six current-session manifests (203 artifact files including634 addendum) revalidated without replaying journeys.
- **Cleanup:** AUTH-DELETE1 restored17:45:43Z: both exact disposable accounts deleted by their own app UI; auth/public/session counts0 and1196 UUID columns have no remaining references. All386 table hashes compared; every non-auth table identical. Truthful auth/session/device/security and two expiring challenge rows retained. Both Owner contexts restored through real UI; Android Menu username matched canonical SQL (the helper initially expected display name). No session resurrection, audit rewrite or broad cleanup. Android no-snapshot-save means future boot needs reinstall/login.
- **Runtime/resources:** API18134 stays23e518b11; proxy18130 PID46402, web18131 and file18198 retained,64531/64532 up. /b/ and provider-triggering Place reads still refused. Faults empty, chat audit/post-check/deletion-check OFF. Apps stopped and both owned devices shut down. S3 holds no heavy/device/iOS driver: heavy released15:42:56Z, iOS slot1/driver17:39:49Z, Android slot4 17:44:03Z. Primary checkout untouched.
- **Next:** No open PR, active fixture or independently feasible unaccepted local gap identified in the existing retained mapping after this bounded pass. Preserve/reuse accepted evidence. Remaining22/62/26 and crew Contact/toast require the explicit prior /b/ or AI boundary to change; Crew Day needs a shipped caller; physical release/provider/storage/moderation/delivery-policy acceptance needs its named prerequisite. Do not infer whole-stream closure, invent replacement flows, repeat accepted journeys or start cut-feature work. Coordination owner retains shared handoff and future integration.
- **Decisions taken without asking (2026-09-27T12:53:32Z):** adapt private Android build helper to assembleDebug only, omitting legacy lint tasks to obey current user direction; preserve artifact/source binding checks. No product-code change, unit test or provider call authorized by this harness adjustment.
- **Decision taken without asking (2026-09-27T15:17:01Z):** accept only observed debug device behavior; restore hints through real UI while retaining legitimate auth/security history; preserve explicit restrictions and reuse unchanged accepted coverage. Recorded also in auth RESULT and PR648 body. Prior14:42:45/14:54:27 native repair decisions remain below.

- **A02 repair milestone (2026-09-27T17:42:43Z):** Android `8686fb535b35fa1db0d2ac2a3bfee3b8d45cb56a`, branch `codex/stream3-stepup-credential-rejection`, clean on base1c82a914d. One existing TokenAuthenticator file +13, explicitly assigned by S1. Real wrong password previously401→refresh200→replay401→false-expiry logout; installed candidate now one401→inline Incorrect password, no refresh/replay/logout. Correct password200→controlled DELETE503 retains DELETE/account. Ordinary protected GET auth-methods401→refresh200→conditional304 also passes. App-only assemble/install/hash verified; no units/lints. Evidence `20260927-stream3-native-account-delete-r1` remains UNSEALED; Owner restoration/cleanup/seal/PR next.
- **A02 actual deletion (2026-09-27T17:42:43Z):** iOS unchanged6b5 and Android8686 both completed actual own-account DELETE200. Both exact disposable auth.users/public.User/AuthSession counts now0; no canonical account deleted. Empty/incomplete confirmation and Cancel covered; iOS wrong-password+503/retry also pass. Both cold-relaunch signed-out; Android fields lengths0/0/no hint, iOS prior canonical hint returns. iOS Owner restored through real Login200/Menu;0AE shut down and slot1/driver released17:39:49Z. Android5554slot4 retained during Owner restore. S3 heavy released15:42:56Z; S1 currently owns heavy. API23e518/proxy18130PID46402 retained, faults empty; narrow deletion allowance remains active until cleanup.
- **Decision taken without asking (2026-09-27T15:37:08Z):** repair only exact POST /api/auth/step-up401 with UNAUTHORIZED and nonblank purpose as rejected presented credentials. Reuse tolerant error parser; bearer middleware401 without purpose, other endpoints/malformed bodies and ordinary session retirement remain unchanged. No API/schema/UI/new test file or speculative reauthentication repair. Existing iOS credential rejection handling reused without change. Runtime-only setup/transfer/focus issues are excluded from product acceptance.
- **Completion estimate (2026-09-27T17:42:43Z):** original69 UX rows minus22 wholly cut rows leaves47 retained/mixed rows. Known in-scope repair checklist is approximately90–95% complete (three prior-decision blockers22/26/62 remain; newly reproduced Android repair awaiting integration). This is an estimate of known local work, not release acceptance or a percentage of all possible behaviors. N01–N05/A01–A05 remain partial at recorded physical-device/release/provider/owner-policy boundaries. Reuse unchanged accepted evidence; no duplicate sweep or cut-feature validation.

- **Final integration verified (2026-09-27T17:53:30Z):** S1 independently reviewed the exact655 head and40-file seal, then proved batch55's three-file union/blobs/ancestry. Remote655 is merged, no S3PR remains open. Original session's11 PRs were already merged before takeover and were not redone; this takeover added628/634/639/648/655 only. Durable kit updated; all6 manifests203 files verified, all fixture entries inactive, deletion/chat/post allowances OFF, no S3 leases. Current native checkout clean8686 retained without an unnecessary rebuild/rebase after merge. Shared API remains frozen23e518 under prior direction.

- **Final A02 milestone (2026-09-27T17:51:48Z):** PR655 is review-ready, actual endpoints and accounts verified in the40-file seal above. Both disposable public/auth/session rows0, reference scan0; canonical User table unchanged. iOS automatically retried the controlled DELETE503 three times, all before upstream; final explicit retry succeeded. Android candidate recovered from wrong password in the same sheet, then handled503 and actual200. Ordinary protected-read401 refresh passed. CI snapshot [36338268824](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36338268824) in progress; informational only. No canonical account deletion or provider acceptance.

### Current acceptance reconciliation (2026-09-27T17:51:48Z; existing rows, no duplicate tracker)

| Existing rows / scope | Accepted evidence reused or added | Remaining boundary |
| --- | --- | --- |
| N01–N02, in-scope notifications | Retained platform reports and installed list/filter/read/delete, rollback/retry and destination evidence; latest iOS tab-generation594 and chat reconnect566/567. | Release APNs/FCM delivery, final foreground/background/cold-start/token/account matrix and physical Android remain unverified. Emulator data is not hardware acceptance. |
| N03–N04, people/connections/DMs/privacy | Existing block/report/cache/deep-link evidence; native connections605, header612, current628/634 return/draft repair, local chat/media/reconnect and privacy controls. S1 owns current Pulse composer/post-report work; no competing implementation or repeat. | Broader moderation processing, final release/provider lifetime and unexercised entry combinations remain limited. Beacon/persona/fan/listing/task parts are removed from this plan. |
| N05, reminders/daily briefing | Existing kept preference/worker evidence and briefing600 failure/retry persistence. | No settled daily-agenda producer/recipient/channel policy; provider delivery not established. Booking-only journeys cut. Crew Day has no located shipped caller/alias (S1 confirmed); preserve engine, no replacement flow or booking-UI proxy for it. |
| A01, accounts | Existing real local signup/verification/recovery/unverified-login evidence and current actual native login. | External Apple/Google consent/cancel/failure callbacks and real provider return remain unverified. |
| A02, sessions/deletion | Existing refresh/logout/remote-signout/Lockdown/cold-process evidence;648 remembered-account confirmation;655 wrong-password repair plus native real deletion and local retirement. | Provider/client revocation, physical secure-store/biometric/passcode combinations, populated Home/payment deletion eligibility and lost-response/concurrent deletion are outside this bounded acceptance. |
| A03–A04, storage/address | Existing real chooser→bytes/local storage and quota evidence; honest hosted storage credential failure and disabled address-provider unavailable/retry. | Hosted S3/CloudFront permissions/lifecycle and activated Smarty/geography/unit success need provider ownership/configuration; no purchase/activation or duplicate emulator variant. Home-specific work remains S2-owned. |
| A05, crew owner tools/profile/invoices/packages/AI | Retained creation/editor/dashboard/team/report/review/share coverage and reviewed596/604/593; current639 clean-profile repair; web invoice545. Existing native owner Invoices is the real route; unreachable SchedulingInvoiceDetail is not a new missing screen. | S3-22/62 and crew Contact/toast require prohibited public /b/ reads; S3-26 requires prohibited canned/provider AI content. No bypass. Invoices/packages stay financial; no live-money acceptance. Cut directory/marketplace/public-booking parts removed. |

Existing original69-row inventory is preserved;22 wholly cut,47 retained/mixed. Rough90–95% estimate applies to the known local repair checklist, not broad release completion. Remaining named boundaries stay open explicitly. Source reuse check: web628, native639 and all648 files are byte-identical fetched master;634 Android final callback/Inbox/You unchanged, Hub differs only in S2's Home privacy-mirror activation argument, outside the accepted DM callback. Original634 Android difference is its already-accepted addendum guard. No duplicate app runs were needed.

- **Current A02 gap/decision (2026-09-27T15:27:09Z):** September20 actual-native account record explicitly left deletion unexercised to preserve identities; web deletion and both native Lockdown already accepted. Use two newly disposable local GoTrue/publicUser fixtures (AUTH-DELETE1), no canonical-account deletion. Scope recorded15:24:41Z: real native Login→Privacy→typed DELETE→password step-up→account DELETE, Cancel/wrong password/503-before-upstream/retry/local retirement. Android actor `ac4ebe0a-9336-437d-8b88-494dd45db380`, iOS `04fe7d02-fc10-4c71-b133-842bb9919501`; exact-owned cleanup in manifest. No provider email/money/Home/booking/chat/schema/app edit. Two new User/auth rows prepared; initial private helper used invalid account_type personal, rejected before User insert, then corrected to schema individual and resumed same exact authID; excluded as harness setup failure, not app defect.
- **Runtime for A02 (2026-09-27T15:27:09Z):** Android5554slot4 acquired15:23:39Z, final6b5 reused/reinstalled/hash matched; heavy released15:25:11Z. S2 holds iOSdriver, explicit S2→S3 handoff pending. API23e518 deletion endpoint byte-identical master; narrow actor-only private proxy allowance for /api/auth/step-up, DELETE /api/users/account and default privacy row. Other prior restrictions unchanged. Evidence `20260927-stream3-native-account-delete-r1` in progress, no acceptance yet.
- **Crew Day reachability (2026-09-27T15:27:09Z):** source/catalog search finds no current CrewDay/crew day caller; S1 confirms no known alternate shipped route. Preserve shared engine and record this reachability limit in existing acceptance; no new flow or cut booking journey. Existing in-scope S3-22/62/26 restrictions remain.

- **Reproduced web defect (2026-09-27T13:03:23Z):** valid-cookie Owner, DM header → person profile → Message during current-user loading incorrectly routes to Login before any chat POST; natural fast tap and controlled 5s `GET /api/users/profile` delay both reproduce on master. Existing `PublicProfileClient.tsx:handleMessage` mistakes `currentUser === null` for signed-out. Repair only that handler using existing session marker/captureAction helper; no appearance/API/schema change. Web evidence in private bundle `20260927-stream3-profile-message-return-r1` (unsealed).
- **Decisions taken without asking (2026-09-27T13:03:23Z):** repair the reproduced web account-loading race while waiting for S1 heavy; retain truthful File access counters from real reads as prior #612 did (web loads three image files; only first was in initial NAV1 preimage). Restore only captured ChatParticipant fields exactly. No fabricated preimages or product-row deletes.
- **Milestone (2026-09-27T13:10:17Z):** web [PR #628](https://github.com/WangPantopus/skinny-pantopus/pull/628), head `704d15e80d3b96b6f18a359284c07d7a8589d878`, **merged in batch #630 at2026-09-27T13:12:36Z**, master `57ff69029e648c23eb20e5a87f344ad19250dd84`. One existing PublicProfileClient file +6/-1. Actual visible Chrome/local API/SQL: delayed viewer read now opens existing DM;503 clear error/retry;double-click single pending request;late reply does not undo navigation;anonymous goes Login. Bundle `20260927-stream3-profile-message-return-r1`,27 files, seal `bf5ebac08780305e60e1f2636574d8871716b414a1f070c4cf3348e1cf9cbacf`, [seal comment](https://github.com/WangPantopus/skinny-pantopus/pull/628#issuecomment-5856148673). Exact participant cleanup at13:06:29Z; only auth bookkeeping/File access counters remain. No native/provider/push/full-scope pass.
- **Resources/next:** S3 heavy released13:14:56Z; device slot4 kept. Android baseline `3125bb150` installed and SHA-matched (`89e2e57c0324a1ff9a610e3d4a0372b40d0d5721e1bd222484c6a9fb6718b969`) in retained native worktree for DM→profile→Message. S1 owns iOS driver/F4/5558. S3 API18134 remains23e518b11; proxy18130/web18131/file18198 up. NAV1 cleaned; NAV2 scoped Owner existing-room direct/read navigation begins13:16:19Z with participant preimages/exact revert, truthful File counters retained. Faults off. Native follow-up next; iOS toast uses a public /b/ companion read (still refused by proxy, no new approval inferred).
- **Native repair (2026-09-27T13:23:40Z):** Android baseline reproduced duplicate DM with empty visible composer; Back twice restores old instance/draft. iOS #612 duplicate-load finding reused after exact conversation-source/callback comparison. S1/S2 confirmed no callback overlap. Existing four callbacks now pop only an immediately previous normal person DM for the same id; other profile entry retains normal navigation. Source `8bc20d69e91c85c3d9acacaa8e4fa5925c4ce99a`, native bundle `20260927-stream3-native-profile-message-return-r1` unsealed. Android candidate app-only build under heavy since13:23:11Z; afters/iOS remain unverified.
- **Decision taken without asking (2026-09-27T13:23:40Z):** preserve the existing conversation instance/draft rather than pushing a duplicate for the immediate same-person return; reuse RouteStack value copy, no shared routing API/storage/schema or screen design change.
- **Observed limit:** web unsent DM draft is in memory and is empty after navigating to the public profile and returning; no durable cross-route draft acceptance or repair claimed in #628.

- **Native verification (2026-09-27T13:34:59Z):** Android candidate8bc20d69e installed/hash-matched (APK `9ffa9f440eb2c42f11c682a9e8c7a62b86e5868adfddd3e4ce99774c7bffc74e`): immediate same-person profile→Message preserves the unsent draft; one Back returns to Connections. Normal profile entry still opens the existing DM and Back returns to the profile. Local API/SQL: 1 room,2 participants,167 messages,9 audit rows; no Send. Evidence remains unsealed until iOS candidate verification/fixture cleanup.
- **Resources/next (2026-09-27T13:34:59Z):** cold iOS app-only build8bc20d69e since13:26:06Z, source frozen, S3 heavy held then promised to S1 candidate2d3486201. S2 holds iOS driver then hands to S3; Android5554 slot4 retained. Android clean Edit profile footer false “just now” reproduced, no footer repair yet. Earlier 3125bb150 native baseline is byte-equal master312439ca4 before this candidate. No units/lints run.

- **Native milestone (2026-09-27T13:49:22Z):** [PR#634](https://github.com/WangPantopus/skinny-pantopus/pull/634) exact8bc20d69e91c85c3d9acacaa8e4fa5925c4ce99a queued toS1. Android and iOS Hub/Inbox/You real-app→API→SQL checks preserve draft and Back target; normal profile entry remains working onAndroid/Hub/You. App-only builds/installed hashes verified. Bundle `20260927-stream3-native-profile-message-return-r1`,39files, seal `e47477147538c3b841bd51148ce5ded67afa8d915dfed2097ac47dd3af84c9e9`, [seal comment](https://github.com/WangPantopus/skinny-pantopus/pull/634#issuecomment-5856417955). No unit/lint campaign; one CI snapshot [36323629324](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36323629324) native jobs running, informational.
- **Cleanup/resources (2026-09-27T13:49:22Z):** NAV2two participant fields restored/equality verified13:45:39Z. Only auth bookkeeping,File access and two automatic refreshes inside existing3-row PlaceSectionCache remain. ChatRoom1,ChatMessage167,IdentityAuditLog9 unchanged. Audit off,faults empty. Heavy released13:39:14Z; iOSdriver/slot1 released13:44:20Z; Android5554 slot4 retained idle/app stopped. API23e518b11 unchanged.
- **Decisions taken without asking (2026-09-27T13:46:56Z):** retain truthful access/cache bookkeeping from real reads rather than invent preimages; restore captured ChatParticipant fields exactly. An after-scroll mistap opened Identity Center while seeking Edit profile; stopped immediately, no cut actions/acceptance and no identity/profile mutation. iOS footer remains unverified; Android false clean-footer copy reproduced. No footer change yet. Next: existing footer then remembered-login candidate, then retained in-scope acceptance gaps; explicit /b/ and AI restrictions preserved.

- **PR634 review follow-up (2026-09-27T13:56:10Z):** S1 verified39-file originalseal and found RouteStack.removeLast is internally guarded (empty-pop concern withdrawn). Actual Android consecutive Message taps0.287s reproduced a second empty DM from the retiring callback; one Back restores original draft. Added captured-entry identity guard in same callback, commit `8a7b9fd450100131ce10d08fad12e528a7050803`; no other source changed. Candidate build/afters pending; #634 integration held. Originalsealed bundle immutable; evidence in unsealed `20260927-stream3-native-profile-message-return-r1-addendum1`.
- **Decision taken without asking (2026-09-27T13:54:58Z):** guard only the reproduced retired Android profile action. iOS repeat/Back check pending S1driverhandoff; no speculative iOSguard added. NAV3 existingOwnerDM lookup/read scope/preimages recorded13:52:09Z, appstopped after before; restoreexactly oncompletion. S2currentlyheavy then S3nextmanualhandoff.

- **PR634 final review milestone (2026-09-27T14:18:22Z):** final head `8a7b9fd450100131ce10d08fad12e528a7050803` pushed, Android repeat-tap retiring-entry defect repaired and accepted in installed final app. iOS Hub/Inbox/You rapid Message checks and Hub Message→Back pass with unchanged iOS tree. Original39-file seal remains immutable; addendum `20260927-stream3-native-profile-message-return-r1-addendum1`,33files, seal `41f3e1eedda0fcc57cd74e1059bc55eb93f78b12ca42a670a65115f73d8aa6cc`, sealed 2026-09-27T14:17:18Z; [seal comment](https://github.com/WangPantopus/skinny-pantopus/pull/634#issuecomment-5856638260). Android transition-time Back can be ignored; next settled Back reaches Connections without duplicate DM. No unit/lint campaign; CI informational.
- **Cleanup/resources (2026-09-27T14:18:22Z):** NAV3 two participant preimages restored/equality verified14:10:31Z;386-table diff only truthful File access bookkeeping. Room1/messages167/audit9 unchanged. Audit off/faults empty; apps stopped; iOS shut down. Heavy released14:03:57Z, iOS driver/slot released14:06:56Z to peers. Android5554 slot4 retained idle, final APK3c6d493dfcae9af0964d9597d6d1e053150f2deb5be9d83b31a79da58a7b0b9a. S1 notified ready for merge; no competing queue.
- **Correction/decision taken without asking (2026-09-27T13:58:11Z):** original634RESULT's blanket “No provider call” was too broad. Automatic Place reads may invoke keyless weather adapters; untraced/unaccepted. Private proxy now refuses Home intelligence/Hub today during account/chat verification. The Android entry attempt stopped at that refusal is excluded; accepted run used Hub Menu. No product change and no delivery/payment provider operation.
- **Next:** clean Edit profile false “All changes saved · just now” reproduced on Android and iOS14:06:52Z without Save. Evidence started `20260927-stream3-native-profile-clean-copy-r1`. Minimal two existing strings to “No unsaved changes”, preserve visuals/actions, then actual clean→dirty→Discard checks. Existing /b/ and AI restrictions, physical/provider/push/live-money limits remain.

- **Decision taken without asking (2026-09-27T14:19:18Z):** reproduced native clean-profile footer now says “No unsaved changes” in the existing iOS/Android strings; same icon/style/layout/Save controls. Candidate `f593b752a2aebb5736182560ed7c7b03d535b94d` on fresh masterf6c1b025e; before files byte-identical to observed apps. Real loaded→dirty→Discard afters pending app-only builds, heavy afterS2; iOS driver S1→S2→S3. No Save/Send/provider scope, no unit/lint campaign.

- **Merged/next (2026-09-27T14:27:21Z):** PR634 final8a7b9fd45 merged14:23:15Z through batch48/#637, master `d7a9f704bd16cb14521c83ecf884eb680a35fc0e` (REST verified). S1 exact4-file proof/seals pass; CI informational failures recorded, not a gate. Footer candidatef593b752a app-only Android/iOS builds pass; Android69683edc6f0d8acd2a472d898c2b2f248eed8c9daa7e2ef4a8bcc8886d7cab42 installed/hash matched14:24:21Z; actual loaded→middle-name local edit→Discard restored honest clean label and disabled Save. No profile/skill/identity DB delta; only ordinary auth refresh bookkeeping. iOS after pending S2driverhandoff. Heavy released14:26:31Z; Android app stopped/slot4 held.

- **Native clean-profile milestone (2026-09-27T14:39:00Z):** [PR639](https://github.com/WangPantopus/skinny-pantopus/pull/639) exact `f593b752a2aebb5736182560ed7c7b03d535b94d` queued toS1. Both actual installed apps pass clean→local middle-name edit→Discard, correct text/Save states. Real API profile GET304 revalidated cached fields; no fresh200 claim. Bundle `20260927-stream3-native-profile-clean-copy-r1`,22files, seal `b538fe98dedd0cbf7fd87cb45e127e45c6637e7475093d613e012f3eeb100d7b`, sealed 2026-09-27T14:35:01Z; [seal comment](https://github.com/WangPantopus/skinny-pantopus/pull/639#issuecomment-5856769541).386-table diff only ordinary auth refresh bookkeeping; profile/skills/identity unchanged. Drafts discarded; no fixture rows. Heavy released14:31:30Z, iOSdriver/slot released14:32:39Z toS1; Android5554slot4 retained.
- **Next account scope (2026-09-27T14:39:00Z):** AUTH-HINT1 recorded14:30:06Z, activated14:36:09Z, private manifest/evidence `20260927-stream3-native-login-forget-confirm-r1`. ExistingOwner/Member real local login/logout and explicit device-hint removal only; no account deletion/provider email/OAuth/persona switch. Restore Owner through real UI, retain actual security/auth history, no session resurrection. Android single-hint Notyou immediately removed Owner without confirmation; two-account case/iOS pending. No auth source edit yet. S3-22/62 crew CTA/toast still blocked by explicit /b/ read restriction; not reopened.

- **Decision taken without asking:** Decision 2026-09-27T14:42:45Z: repair reproduced Android Login Notyou in two existing screen/ViewModel files. Reuse ContinueAs AlertDialog treatment; capture the displayed account, Cancel keeps it, confirmed removal clears its hint for this login visit rather than showing another account. Keep typed inputs and use existing busy state during removal. No Core/AuthRepository/new-file/schema/design changes. Fresh base 44d4c71ec59682502d26309fe01df8db3520e2e9 has byte-identical Login sources to observedf593; iOS code still unchanged pending actual before. App-only build and real UI afters next.
- **Current (2026-09-27T14:43:37Z):** Android two-hint defect reproduced14:41:05Z; candidatef8298d380cd581da639de41dac82426459fe7650 committed, heavy manually acquired14:43:12Z for app-onlybuild/install. AUTH-HINT1 active, Android signed out with Member hint after explicit Owner removal; restoreOwner through UI on completion. iOSbefore pending driver S1→S2→S3. PR639 merged unchanged in batch49/#640 at14:40:49Z perS1, master44d4c71ec59682502d26309fe01df8db3520e2e9; exact22-file seal verified byS1.

- **Decision taken without asking:** Decision 2026-09-27T14:54:27Z: actual iOS f593 before shows Owner avatarSO immediately replaced by existingMemberSM without confirmation (recorded14:53:25Z). Reuse ContinueAs confirmation in existingLoginView.swift; Cancel has no removal, confirm targets displayed account, keeps typed fields and clears hints for this login visit. Existing busy state prevents overlapping login/removal. Preserve no-argument ViewModel call forms onbothnative, including existing non-UI callers; no unit test edits/runs. No Core auth/secure-store/schema or new application file change. iOSinitialOwner+Member hints both preexisting, restoreOwner login without removingMember; AndroidMember is this scope addition and will be removed before finalOwner login.
- **Current (2026-09-27T14:55:46Z):** nativeLogin final candidate `6b5d8b84cebd8520c54a39910d71d227a652aed8` clean, three existingfiles. Androidfirstcandidatef8298d380 actualconfirm/Cancel/draft11+11/lifecycle/specificOwnerremoval pass; Member remains oncoldrelaunch. Finalcompatcall-form/rebuild/recheck pending. iOSbefore actualSO→SM replacement/no confirm recorded14:53:25Z; initialbothfixturehints preexisting, preserveMember. Source fixcommitted14:54:27Z, app-only builds nextafterS1heavy. S3iOSdriver/0AEslot1 acquired14:49:53Z; Android5554slot4. BothnativeOwner-session/hintcleanup pending AUTH-HINT1. No unit tests/lints run.

## CURRENT RESUME — Stream 3 handoff and prompt revision, 2026-09-27 (2026-09-27T12:41:37Z), read this first

The Stream 3 successor session (2026-09-26T22:58Z to 2026-09-27T11:18:27Z) stopped at the user's request, after the user asked it to stay until every PR it opened was merged. **All 11 are merged to master.**
- No fixture was applied at handoff; no device or heavy slot was held.
- The last runtime release was recorded at 2026-09-27T11:50:57Z: API, no-send proxy, web and file server stopped; Stream 3 Docker containers stopped with their volumes kept. Check the live state before relaunching; see prompt §7 and the runtime kit.
- The prompt revision below is documentation only; no application was launched and no new app journey or acceptance result is claimed.

**Takeover prompt:** [`NEXT-STREAM3-PROMPT-2026-09-27.md`](NEXT-STREAM3-PROMPT-2026-09-27.md), updated at 2026-09-27T12:41:37Z. It keeps the launch-scope map, merged-PR evidence, runtime and gotchas, and now makes the user's app-launched web/iOS/Android end-to-end requirement explicit: use real local app journeys, cover applicable error/recovery cases, and do not add, update or run unit tests.

**Runtime manual:** the kit README (`.pantopus-recovery/stream3-runtime-kit/README.md`, top section "Update 2026-09-27 (handoff)").

**Detailed record:** the log below, then the "LIVE — Stream 3 successor session" block (every PR’s evidence, decisions and candidates).

### Launch scope (user direction, 2026-09-27; applied 2026-09-27T11:40:50Z)
Eight features are flagged off for the first launch; the code is kept, and the user handles the flags.
- **Do not verify, end-to-end test or fix them.** They are removed from Stream 3’s plans.
- The shared cut table and rule are in the “LAUNCH SCOPE — 2026-09-27” block at the top of `docs/PROJECT_HANDOFF.md` and `docs/workstreams/README.md` (coordination `d2bf06e36`).
- The full Stream 3 mapping is in the takeover prompt’s **§0**. Summary:
  - **Out, #1 Beacon and creator tools:** Beacon pages, Updates, Following, audience, creator inbox, broadcast, fan/creator threads, tiers, paid follow. Rows S3-11/12/13/33/34/35/46/68, and the broadcast “⋯” part of S3-67.
  - **Out, #2 Personas and identity switching:** persona profiles, Beacon identity, the menu’s “Switch”, Identity Center and view-as, persona DMs. Rows S3-06/27, and the persona-DM part of S3-04.
  - **Out, #5 Public scheduling for general businesses:** booking pages and setup wizards, event types, public booking and manage-booking, My bookings, host booking tools, team scheduling, the availability UI, booking notifications and channels, policy editors, reminders/workflows, Who’s free, limits. Rows S3-02/05/18/19/20/21/44/45/47/51/52/64, and the “Book” part of S3-07.
  - **Out where they touch Stream 3 (Stream 1’s #3, #4, #6; Stream 2’s #7, #8):** listing/task cards and pickers in chat, the Gigs/Market filters, the profile Gigs tab, “My bids”, and the cut features’ notification types.
  - **In scope:** accounts, privacy and blocking, people profiles, connections, DMs and the Messages list, in-scope notifications, crew (business) pages and owner tools, invoices and packages, the daily briefing, the AI assistant. The scheduling engine is tested only through Crew Day.
  - **Already done in cut areas stays as future-ready work** (e.g. #576, #583, #584, #595, #618, #623); do not re-verify it.

### State at handoff
- **Runtime released (2026-09-27T11:50:57Z, user request):** servers stopped; Docker stack stopped (volumes kept); built apps, APKs, iOS DerivedData and Android/web build caches deleted; the merged `post-fanout-r1` worktree removed. Details and relaunch steps are in prompt §7.
- **Master `35c5434df`.** Stream 3 PRs from this session, all merged:
  - batch 40 [#608](https://github.com/WangPantopus/skinny-pantopus/pull/608), 10:26Z: #593, #594, #595, #596, #600;
  - batch 41 [#622](https://github.com/WangPantopus/skinny-pantopus/pull/622), 11:11Z: #597, #604, #605, #612;
  - batch 42 [#624](https://github.com/WangPantopus/skinny-pantopus/pull/624), 11:14Z: #618, #623.
  - Nothing is open.
- **Merge rule now (user direction):** merge once a change is verified end-to-end in the real apps; don’t wait for CI. At the user's direction, Stream 1 removed master’s required “CI OK” check at 11:13:55Z; the prior config and a restore file are in `docs/workstreams/coordinator-state-2026-09-23/repo-settings/`.
- **Blocked rows (explicit user decisions; not reopened):**
  - S3-22 and S3-62: `/b/` reads insert `BusinessProfileView`.
  - S3-26: web AI chat is client-only.

### Next (ordered; details in the prompt §6)
1. **Android:** check profile → Message after a DM header tap. #612 didn’t check it; iOS stacks a second DM, which loads twice.
2. **Verify the candidates on master before touching them:** the iOS crew-page (business profile) toast; the Edit profile “All changes saved” copy; the iOS “Not you?” question.
3. **Close remaining in-scope end-to-end coverage gaps** from the existing status and screen inventory: accounts, privacy/blocking, people profiles/connections, DMs/messages, in-scope notifications, crew pages and Crew Day scheduling, invoices/packages, the daily briefing and AI assistant. Exercise real web/iOS/Android callers as applicable, reuse unchanged sealed evidence, and skip every cut feature in the launch scope.
4. **Keep this file, the kit README and memory current.** Commit and push only your own files.
- **Removed by the launch scope (#5):** the New York default-schedule finding (web `SetupWizard.tsx` and iOS onboarding) moves out of the plan. Note for Crew Day: `ensureDefaultSchedule` seeds America/New_York, and only Android’s wizard corrects it.

### Resumed-session log (10:25Z to 2026-09-27T11:18:27Z)
- **10:25Z:** the user asked Stream 3 to stay until every PR it opened is merged, then update the handoff.
  - Stream 3 recommended keeping Stream 1’s batches rather than merging individually, which would have forced batch rebuilds and duplicate CI.
  - Stream 1 agreed, and stayed until batches 41 and 42 merged.
- **Batch 40** #608 merged at 10:26:20Z (master `a93c76d7f`). **Batch 41** #622 merged at 11:11:36Z (master `73e0baade`). **Batch 42** #624 merged at 11:14:24Z (master `35c5434df`), without waiting for its combined CI, per the user.
- **New PR [#623](https://github.com/WangPantopus/skinny-pantopus/pull/623)** (web; companion to #618; head `e04e1a933`; bundle `20260927-stream3-web-policy-mobile-shapes-r1`, seal `8225da0538e8f8725719603d31b0aacf575be3b04e74cd0f7b77083be293c619`):
  - `resolvePolicyValue` reads the apps’ custom policies. Invitees had seen raw JSON, or “You can cancel anytime for a full refund” for an iOS 12h/25% policy, and the host row had said “Set up”.
  - Verified before/after on the real web app, as owner and as an anonymous invitee. ESLint, typecheck gate and web Jest (1893) pass. Merged in batch 42.
- **Runtime in this phase:**
  - Web 18131 ran the #623 tree with paid client flags (`S3_WEB_PAID=1`) from 10:27:04Z. It was relaunched at 11:16:26Z on master `35c5434df` (detached) with default flags.
  - Fixture BP1 (the Member page `a1060a2b`, made live, five policy values) was reverted exactly at 10:40:34.368Z, `is_live` included.
  - Added `handoff-tools-20260926/web-anon-step.mjs`, a signed-out web visitor.
- **Finding (about 10:45Z, by code):** the New York schedule issue in Next item 1. The Member fixture’s public page showed its consequence at 10:29:45Z: slots from 6:00 AM PDT for 09–17 New York.
- **User direction (received shortly before Stream 1 acted on it at 11:13:55Z): don’t wait for CI to merge.** Merge once the change is verified end-to-end in the real apps.
  - Stream 3 first read master’s protection just after Stream 1 had removed the “CI OK” rule, and wrongly told Stream 2 there had been nothing to turn off.
  - Corrected at 11:16:00Z to Stream 2, and in memory.
- **Decisions (standing direction):**
  - 10:25Z: don’t merge PRs individually while Stream 1’s batches hold them.
  - About 10:28Z: do the web companion while batches run, verified with a live-page fixture (recorded and reverted).

## LIVE — Stream 3 successor session, started 2026-09-26T22:58Z, handed off 2026-09-27 (last update 2026-09-27T11:18:41Z; final state in the CURRENT RESUME above)

- **Session:** "fix(native): live chat keeps working after a token refresh…" [4fe2f0]. Queue owner since 02:50Z: "Stream 1 agent handoff" (the previous Stream 1 session handed off after batch 36). Stream 2's successor is "Stream 2 handoff takeover".
- **Slots (2026-09-27T11:18:41Z):** Stream 3 holds no heavy and no device slots. Every device was shut down before its slot was released.
- **Batches (all merged):** 40 #608 at 10:26:20Z (#593, #594, #595, #596, #600); 41 #622 at 11:11:36Z (#597, #604, #605, #612); 42 #624 at 11:14:24Z (#618, #623). Master is `35c5434df`.

### PRs
- **[#545](https://github.com/WangPantopus/skinny-pantopus/pull/545)** (web; S3-69 web part, S3-46): **merged** in batch 34 [#551](https://github.com/WangPantopus/skinny-pantopus/pull/551) at 00:46:57Z (master `73b98f6b6`). Bundle `20260926-stream3-web-pdf-checkout-r1` (seal `892831e1…`) + addendum1 (`8e0243cc…`, two stale Jest assertions).
- **[#552](https://github.com/WangPantopus/skinny-pantopus/pull/552)** (native; S3-64, S3-37, S3-35, S3-59 + Booking notifications Back): head `520ed06cf`: **merged** in batch 35 [#556](https://github.com/WangPantopus/skinny-pantopus/pull/556) at 02:23:56Z (master `0bd3759f4`). Bundle `20260926-stream3-native-dead-controls-r1`, seal `33d6a0c9b62363e9854e7549805fa17027f70dd0d1d79eca57b787640735e38c` (68 files; seal comment posted).
  - Verified on the iOS simulator (builds `498811062`, final `520ed06cf`) and the Android emulator (APK `2b9f468f…`); befores on `36af1f371` builds, identical to master for these files.
  - Two defects found in verification and fixed in the branch: Booking notifications Back (Swift 5 backward trailing-closure matching bound `{ dismiss() }` to `onTrailing`), and an uploaded 16:9 banner resizing the 16:7 editor banner.

### PR #557: new-post notifications to connections and followers (found via Stream 1's #553 work)
- **[#557](https://github.com/WangPantopus/skinny-pantopus/pull/557)** head `097e3e087`: **merged** in batch 36 [#561](https://github.com/WangPantopus/skinny-pantopus/pull/561) at 02:31:01Z (master `89f3c6bac`). Bundle `20260927-stream3-post-fanout-context-r1`, seal `e307f44afdc21624659ed674787b07411056e106ebb3ca4acd634cc2a1ba7347` (25 files; seal comment posted). My isolated API stays on `23e518b11` (master's migration not approved), so it does not have this change.
- Defect: `postCreationHooksService.js:148` passed `contextType: 'post'`; `Notification.context_type` is the enum ('personal', 'business'), so the one bulk insert failed and nobody got "<name> shared a new post" for connections/follower posts.
- Verified end-to-end (user approval 2026-09-27): before, on API `23e518b11`, the Member's post to Connections logged "invalid input value for enum notification_context_type" and the Owner got nothing; after, on a local verification build `e527ab988` (= `23e518b11` + the fix; master's mail migration still not applied), the Owner's web notifications show "Sched Member shared a new post". Backend privacy gates and full Jest (341 suites) pass.
- Fixture PF1 (2 posts, 1 notification, 1 LocalProfile) removed at 01:46:45Z; fingerprint clean apart from sign-in bookkeeping. API back on `23e518b11`.
- Proxy: a `post-check.json` allowance (`POST /api/posts` by the Member only) exists and is **off**.
- Stream 1 fixed the gig saved-search case as #555.

### PR #566: open chats keep getting live messages after a tab switch or a pushed screen (iOS and Android)
- **[#566](https://github.com/WangPantopus/skinny-pantopus/pull/566)** head `7b801e993`: **merged** in batch 37 [#572](https://github.com/WangPantopus/skinny-pantopus/pull/572) at 05:19:20Z (#572 at 05:19:18Z, master `563cddb47`). Bundle `20260927-stream3-chat-resubscribe-r1`, seal `fbbae81d9be68eebc3548153d035c5b1d4cb5d3c594f5bf54cef9e6c528c40bb` (74 files; seal comment posted). CI green (Stream 1: "CI OK" at 03:42:12Z). In batch 37 [#572](https://github.com/WangPantopus/skinny-pantopus/pull/572), queued 03:44:00Z (#560, #563, #564, #565, #570, #566).
- Defect: both apps' chat screens call `teardown()` when they leave the screen (iOS `.onDisappear`, Android `DisposableEffect`), which cancels the socket listeners; when the thread came back, `load()` returned early because it was already loaded, so nothing listened again until the thread was reopened. Found while acknowledging Stream 2's #560 report (leftover chat view models).
- Befores with master chat code: iOS (build `520ed06cf`) message 20 still missing 63.4 s after it was stored; Android (master APK `27a5e60e…`) message 24 still missing 61.2 s later; no request from the app; reopening showed them.
- Fix (2 existing files): iOS `fc56edc1f` re-subscribes and refreshes (merge) on return and makes the socket loops hold the view model weakly (the #560 leak); Android `f009f6be7` re-subscribes and marks the thread viewed on return (the room re-join ack backfills); Android `7b801e993` makes `optStringValue()` treat a JSON null as absent. That last bug was found in the Android after: the backfill gave topic-less messages the topic id "null", which drew a stray "General" divider.
- Afters: iOS (build `f009f6be7`, same iOS tree as the head) and Android (APK `16cfda1c…` of the head). A message sent while away is there on return; the next one is live. Both via a tab switch and via a screen opened from a shared card. Static checks: ktlint, detekt, lintDebug; SwiftLint `--strict` and SwiftFormat `--lint` clean.
- Side effects (fixture CA12): messages 19–38 kept (like CA0–CA11). Two `ListingView` rows and two listing counters, from opening shared listings, reverted exactly at 02:57:38.604Z (fingerprint match). Sign-in bookkeeping and attachment `last_accessed_at` changed. Chat-audit mode was on 02:09:03Z–02:55:44Z and is **off** now.
- Unverified: push suppression; edits/deletes/reactions/typing/presence separately; real devices.

### PR #567: the Android Messages list stays live after you open a conversation (S3-30 parity)
- **[#567](https://github.com/WangPantopus/skinny-pantopus/pull/567)** head `0294b046b` on `89f3c6bac` (merges cleanly). Bundle `20260927-stream3-android-chat-list-live-r1`, seal `c143cb6cb9bb3dbeb78a48cd53bdb6e8c7202f18e16612f2686bf9942ac87fb0` (32 files; seal comment posted). Reviewed OK by Stream 1; batch 38 (with S2 #568/#569 and S1 #571).
- Defect: the list's `DisposableEffect` → `teardown()` cancels its socket listeners when a conversation covers it, and `load()` returned early on the way back. The conversation just read kept its unread count, and new messages didn't show until pull-to-refresh. iOS fixed this as S3-30 (#331, `5e254e7d3`); the inventory listed iOS only. Found in #566's evidence.
- Before (master APK `27a5e60e…`): unread 2 stayed after reading; message 41 still not shown 61.3 s later, with no HTTP request, until pull-to-refresh. After (APK `9daa84ca…`): read state clears on return and new messages arrive live, over two round trips. ktlint, detekt and lintDebug pass.
- Change: one file (`ChatListViewModel.kt`, +12/−2). A return re-subscribes and merges a fresh read; a failed background read keeps the loaded list.
- Fixture CA13: messages 39–44 kept. Chat-audit mode was on 03:11:00Z–03:19:04Z and is off now.

### PR #573: the Android business page editor's banner and logo controls upload a photo (S3-37 parity)
- **[#573](https://github.com/WangPantopus/skinny-pantopus/pull/573)** head `f7e7bd4ce` on `89f3c6bac` (merges cleanly). Bundle `20260927-stream3-android-page-editor-media-r1`, seal `9deab38e2c0cb584f41387deeacb4bc6df122e270945e1696921a63565c1db39` (32 files; seal comment posted). Reviewed OK by Stream 1; batch 38.
- Defect: Android's "Change banner", "Change logo", "Add banner" and the "Logo" tile had no click handler, and a stored banner was drawn as the stock café palette. iOS fixed this in #552; the inventory listed iOS only.
- Fix: 5 editor files, plus one test line (a relaxed `UploadRepository` mock for the new constructor parameter). The targets open the photo picker and upload via the existing `UploadRepository.uploadBusinessMedia`; the editor shows real cover/profile images and keeps the palette without one.
- Before (master APK `27a5e60e…`): targets not clickable (uiautomator); taps open nothing. After (APK `bbbacb05…`): banner and logo upload with spinner, image and toast; a 500 keeps the old image and shows the reason. The proxy answered all three uploads before upstream; no DB or storage write. ktlint, detekt, lintDebug; `EditBusinessPageViewModelTest` 6/6; `verifyPaparazziDebug` `EditBusinessPageSnapshotTest` 2/2 (goldens unchanged).
- The gallery "Add" tiles are still inert (no backend); see the pending questions below.

### PR #576: Android Creator inbox "Send a broadcast · Compose" opens the composer (S3-68 parity)
- **[#576](https://github.com/WangPantopus/skinny-pantopus/pull/576)** head `edfe11e30` on `89f3c6bac` (merges cleanly into `563cddb47`, rechecked after batch 37 merged with #564's `RootTabScreen.kt` change). Bundle `20260927-stream3-android-creator-inbox-compose-r1`, seal `05c034cb08158be8e9c37d1fad5e05e7f531bcf257b443e569a765dcf1c08db3` (19 files; seal comment posted). Reviewed OK by Stream 1; batch 38 once green.
- Defect: `RootTabScreen` sent Compose to `AUDIENCE_PROFILE`. iOS fixed this in `bcb23ae91`; its Android change there was only S3-12.
- Fix: 3 files (+15/−5); Compose → `composeBroadcast(personaId)`, or the audience profile without a Beacon.
- Before (master APK): "Public Profile". After (APK `8fa0a377…`): "Compose broadcast" for @s3fx_member_beacon; nothing sent. `CreatorInboxViewModelTest` 9/9.
- Test setup: the persona DM routes need `audience_profile` (F10, reverted at 00:36:21Z). The proxy answered the thread list empty (`fault-s368-inbox-empty.json`), with no DB write; fault-control reset at 04:11:57Z.

### PR #582: Android Back on a dirty form asks "Discard changes?" (S3-60 Android; shared FormShell, agreed with Stream 1 and Stream 2)
- **[#582](https://github.com/WangPantopus/skinny-pantopus/pull/582)** head `85839a91a` on `7bdef3e8c` (merges cleanly into `c890f2588`). Bundle `20260927-stream3-android-form-back-discard-r1`, seal `e080a3ed55176d304b8277def03ebb4ccb1112fa1f50135ca5493be2a43f0245` (49 files). Sent to Stream 1; CI green (6 success, 6 skipped, checked 05:45:19Z).
- `FormShell` had no `BackHandler`: system Back left a dirty form silently (Edit profile reproduced: the tagline was lost). Fix: `BackHandler(enabled = isDirty && !isSaving && !showDiscardConfirm) { handleClose() }`, like `WizardShell`.
- After (APK `497dc156…`): Edit profile, PostGigV1 (Stream 1), Pulse (clean pickers and a clean composer don't prompt; a dirty composer asks), Report issue (Stream 2). `PostGigV1SnapshotTest` 2/2.

### PR #583: Android broadcast composer shows no sample audience counts
- **[#583](https://github.com/WangPantopus/skinny-pantopus/pull/583)** head `7b4f4556a` on `7bdef3e8c`. Bundle `20260927-stream3-android-composer-reach-r1`, seal `0ced0053c5a69b71d9c49e8effefa13b79cea3d084ff5b78ad24711545322b50` (17 files). Sent to Stream 1; CI green (6 success, 6 skipped, checked 05:45:19Z).
- The reach was seeded from `ComposeBroadcastSampleData` (1,247/518/212/64), so it showed while membership-stats failed. Now `emptyMap()` like iOS; one existing test updated (it asserted the sample 518). `ComposeBroadcastViewModelTest` 24/24.

### PR #618 (merged in batch 42 #624 at 11:14:24Z): Android reads every stored booking-page cancellation policy
- **[#618](https://github.com/WangPantopus/skinny-pantopus/pull/618):** head `88488d264`, first committed as `b991fd3f7` and amended for detekt’s complexity limit before any push. On master `621e26616`, it merges cleanly with batch 40’s tip and #597/#604/#605/#612.
- **Bundle:** `20260927-stream3-android-booking-page-policy-object-r1`, seal `c9b9183d3a468892bab206473247f80a31562eb4ea320c00edeb531b5b83acf9` (19 files; seal comment posted).
- **Defects, both reproduced on the master APK `27a5e60e…`:**
  - (1) `BookingPage.cancellation_policy` is jsonb. Web always saves an object and iOS saves one for custom, but Android typed the field `String?`, so Moshi’s `JsonDataException` failed the whole page. The Scheduling hub showed “Couldn’t load scheduling” while the API answered 200.
  - (2) The editor matched presets case-sensitively, so an iOS “moderate” opened as Flexible, and a Save would have overwritten it.
- **Fix (9 files):**
  - `CancellationPolicyValue` plus `CancellationPolicyValueJsonAdapter`, registered in `NetworkModule`, like `BusinessServiceAreaJsonAdapter`.
  - The editor reads presets in any case, and custom fields in either naming.
  - The business-settings label and the invitee Manage card use the editor’s existing wording.
  - Two tests were updated for the type change. Writes are unchanged.
- **After (APK `aced96c1…`):** the hub loads with web’s object, and the editor maps web preset, web custom, iOS custom, iOS lowercase preset and Android’s JSON string correctly.
- **Checks:** ktlint, detekt, lintDebug and assemble pass; scheduling unit tests 547 with 0 failures.
- **Fixture BP1** (six values on the Member’s page `a1060a2b`) was reverted exactly at 10:18:43.926Z. Otherwise only sign-in bookkeeping.
- **Not driven:** the business-settings label (no business booking page) and the invitee Manage card (no live page).
- **Related web defect (next PR candidate, found by code on master `621e26616`, not yet reproduced on the web app):** web’s `resolvePolicyValue` (`frontend/apps/web/src/components/scheduling/policyValue.ts`) knows only web’s own object shape and preset strings.
  - (a) Android’s custom policy is a JSON *string*. It becomes a notes-only policy, so the invitee’s `CancellationPolicy` card (`components/scheduling/CancellationPolicy.tsx`) shows the raw JSON text.
  - (b) iOS’s custom object (`free_cancel_window_min`, `refund_after_pct`, `deposit_non_refundable`, `no_show`) has no `cutoff_min` or `refund_policy`. `plainSentence` then says “You can cancel anytime for a full refund.”, which misstates the host’s terms to invitees, for example 12 h before and 25% after.
  - Also used by `ManageBookingPanel` (`plainPolicySentence`) and the editor’s `fromCancellationPolicy`.
  - Fix direction: normalize the mobile custom keys and JSON-text strings in `resolvePolicyValue`, mapping `free_cancel_window_min`→`cutoff_min`, `refund_after_pct`→`refund_percent_after`, and `refund_policy` as `customRefundPolicy` does.
  - Verify on a live page’s invitee confirm and manage views, with fixture policies (recorded, reverted). Run the covering web Jest first.


### PR #612 (sent to Stream 1 at 2026-09-27T09:25Z): a DM’s header opens the other person’s profile (iOS + Android, web parity)
- **[#612](https://github.com/WangPantopus/skinny-pantopus/pull/612)** head `2583774f3` on `f6c66d678`: merges cleanly into `9f3ba7c35`, and together with #597 and #605. Bundle `20260927-stream3-native-chat-header-profile-r1`, seal `61c648327e456afd2a9c0886da3c8449ffb6ecd1852dd4aa12f1979b47679146` (31 files; seal comment posted).
- Before: both apps’ DM header name and avatar did nothing; checked on master-equivalent builds (Android APK `27a5e60e…`, iOS `997d129c2`).
- After, Android (APK `5bebb34d…` of the head): name or avatar → profile (`GET /api/users/id` 200/304), and Back → DM.
- After, iOS (dylib `01b0fe77…`): the same from the Place tab. From the Mail tab, the new Inbox `publicProfile` route: Messages → DM → name → profile, and the profile’s Message → DM.
- Checks: ktlint, detekt, lintDebug and assemble pass; the iOS build passes; SwiftLint `--strict` and SwiftFormat are clean. The Marketplace:221 and Tasks:408 backward-matching warnings are gone.
- Side effects: none from the change. Sign-in bookkeeping and the existing `File.access_count` attachment counter only; every write was blocked at the proxy.
- Candidate (not changed): on iOS, DM → header → profile → Message stacks a second copy of the same DM, and the DM below reloads too (two topics/messages GETs). The Hub root’s existing profile → Message code already does this when that DM is lower in the stack. Popping back would avoid it.
- Correction to the #604/#605 bundles: “The build’s two remaining warnings” meant the two warnings in those PRs’ changed files, not the whole build. Their iOS lint was re-run correctly at 09:16Z and is clean.

### PRs #604 and #605 (sent to Stream 1 at 2026-09-27T08:52:47Z)
Afters on local verification tree `997d129c2` (master `f6c66d678` + both heads, byte-identical). Android APK `735d5744…`, iOS dylib `95506dfc…`. No table changed (08:21:58Z–08:51:30Z).
- **[#604](https://github.com/WangPantopus/skinny-pantopus/pull/604)** iOS + Android: the owner dashboard hides its Photos rail (gallery has no backend; the Add tile led to the hidden editor gallery). Head `38a3ca314`, bundle `20260927-stream3-native-dashboard-photos-hidden-r1`, seal `c985b4fb6fb51af62d8f9cd423d6c193ed6cf1d6b3db36201b57452acb30d79b`.
- **[#605](https://github.com/WangPantopus/skinny-pantopus/pull/605)** iOS + Android: tapping a connection opens their profile (web parity). Head `324460396`, bundle `20260927-stream3-native-connections-open-profile-r1`, seal `c32a0f6778a0349ca375eced3a2f94f3f730a37994d5f8f2f70937fa597358b5`.
- Checked in the build log: the `BusinessOwnerView.swift:101` backward trailing-closure warning binds to `onPosted` (correct), so there is no defect.

### PRs #593–#597 (sent to Stream 1 at 2026-09-27T08:10:04Z; CI running)
All sealed, with seal comments. Befores used master builds; afters used one local verification tree `72d6e0bd3` (master `563cddb47` + these five heads, disjoint files, each byte-identical). Android APK `84089eba…`, iOS dylib `30f255ba…`.
- **[#593](https://github.com/WangPantopus/skinny-pantopus/pull/593)** Android: a failed review reply says it wasn't posted (S3-59 parity). Head `bbca31072`, bundle `20260927-stream3-android-review-reply-failure-r1`, seal `ff7689fb971bc7841b057fa2359b079cb846398daac5e6bb29e1a63435235a76`.
- **[#594](https://github.com/WangPantopus/skinny-pantopus/pull/594)** iOS: notifications tab race and load-more Try again (S3-48 parity). Head `4c7fe3f9a`, bundle `20260927-stream3-ios-notifications-generation-r1`, seal `f2bf64945176a9678a8aea0a8bc9b7f9e479bfb3ba7a3048d2bbfbfdd18490a6`.
  - Race reproduced via Unread → All: a late Unread page replaced All.
  - A pull-to-refresh race is masked by `.refreshable` cancellation.
  - The proxy's `requestDelayMs` hangs delayed GETs upstream, so use `responseDelayMs`.
- **[#595](https://github.com/WangPantopus/skinny-pantopus/pull/595)** iOS + Android: My bookings "Book again" opens the booking page; iOS rows say where to manage (S3-52; uses #584's `page_slug`). Head `77d56b4a3`, bundle `20260927-stream3-native-my-bookings-book-again-r1`, seal `d5c772f095eac7c271f1e128fcf1f95105c47ef53190cbca19c9d4f145716252`.
- **[#596](https://github.com/WangPantopus/skinny-pantopus/pull/596)** Android: the page editor hides its inert Gallery (user decision). Head `bc06ecec8`, bundle `20260927-stream3-android-page-editor-gallery-hidden-r1`, seal `895d17368bbac74d41ab79e20ca96ef07159cd5220fea11b272fb899b326d7b9`.
- **[#597](https://github.com/WangPantopus/skinny-pantopus/pull/597)** iOS + Android: "Share profile" sheet shares the profile, `/u/:username` (user decision). Head `4cd2e5d45`, bundle `20260927-stream3-native-profile-share-r1`, seal `10193489ba3d901e13e245c95ee57de1beee2e699632567d5b648b2eda90fc62`.
- Side effects: sign-in/out bookkeeping only (fingerprint 07:29:59Z–08:05:40Z).
- Runtime after the run:
  - sim `0AE16FA0` has build `72d6e0bd3` with the Owner signed in (shut down);
  - emulator-5554 restores its snapshot at boot;
  - the API is on `23e518b11`, `fault-control.json` is `{}`, web is on #584's branch.

### PR #584: My bookings "Book again" opens the booking page; a row says where to manage it (S3-52, web + API)
- **[#584](https://github.com/WangPantopus/skinny-pantopus/pull/584)** head `615659fc2` on `563cddb47` (merges cleanly). Bundle `20260927-stream3-my-bookings-dead-controls-r1`, seal `187dcd0fbadcdedb55b58599fc3369f59d2ff3e1343cd0554558c3727a7b4080` (41 files; seal comment posted). Sent to Stream 1 before 05:42:41Z (queued there while it waits on the user); CI running.
- Defect (S3-52 remainder after `75e061e40`): web and iOS "Book again" on past bookings had no handler (`/my-bookings` rows lack the page slug), and rows showed a chevron that did nothing. Android already answers row taps (manage page if this device booked it, else "Manage this booking from your confirmation email link.").
- Change: `GET /api/scheduling/my-bookings` adds `page_slug` (live pages only, else null); web "Book again" links `/book/:slug` and hides without a slug; a web row click shows Android's message. "Pay" can't appear with real data (no balance field, no `balance_due` status); unchanged.
- Before (web): the row click and "Book again" did nothing. After: the real payload has `page_slug: null` for F5b (page `807dd420` is the retained draft, not live); a row click shows the message; a past row with an offline page has no "Book again"; "Book again" with a slug goes to `/book/<slug>`. Past rows came from proxy answers built from the real row. The API verification build `a62037b1d` (`23e518b11` + the API commit) served the after 05:35:57Z–05:38:06Z; the API went back to `23e518b11` at 05:38:11Z.
- Checks: web ESLint 0 errors, type-check gate, web Jest 122/1893; backend full Jest 341 suites and privacy gates.
- Not verified: a live page's landing (no live booking page in the isolated DB); iOS and Android follow-up (same wiring from `page_slug`; needs heavy + devices).
- Runtime note: web 18131 now serves this branch (master `563cddb47` + #584) from `/private/tmp/pantopus-stream3-web-chat-names-r1`.

### Committed, verification pending (need heavy + devices) — DONE: now #593, #594, #595 (see above)
- **S3-59 on Android: a failed review reply now says so.** Branch `claude/stream3-android-review-reply-failure`, head `bbca31072` on `c890f2588`; 1 file (`BusinessOwnerViewModel.kt`) adds "Your reply wasn't posted. <reason>" (iOS got the same in #552). Before captured on the master APK (bundle `20260927-stream3-android-review-reply-failure-r1/before`): the reply shows, the injected 500 lands at 05:11:22Z, and the reply vanishes with no message. The after needs a build.
- **S3-48 on iOS: notifications tab switch mid-load, and load-more retry.** Branch `claude/stream3-ios-notifications-generation`, head `4c7fe3f9a` on `c890f2588`; 1 file (`NotificationsViewModel.swift`) mirrors Android's d8cce256d and iOS Mailbox: a generation guard, local offsets applied only while current, and `loadMoreError` plus `retryLoadMore` (the shared list's Try again). SwiftLint `--strict` and SwiftFormat are clean. The build on sim `0AE16FA0` (`f009f6be7`) has master's notifications code, so it can serve as the before. Owner has 33 notifications (15 read / 18 unread; 2 pages). Rules `fault-s348-notif-delay.json` (12 s delay) and `fault-s348-notif-page-fail.json` are ready.

- **S3-52 on iOS and Android (follow-up to #584).** Branch `claude/stream3-native-my-bookings-book-again`, head `77d56b4a3` on `563cddb47`, not pushed; 7 existing files. iOS: `BookingDTO.pageSlug`, "Book again" pushes `.inviteeLanding(slug:)` and shows only with a slug, a row tap shows Android's message (toast overlay as in the page editor). Android: `BookingDto.pageSlug`, `BookingRowFooter.BookAgain(slug)` only with a slug, "Book again" → `SchedulingRoutes.publicBooking(slug)` (as `ManageBookingScreen` does). SwiftLint `--strict` and SwiftFormat clean; Android checks need the build. The before (iOS dead "Book again", Android "Book again" = row action) and after need the API verification build `a62037b1d` or #584 merged, proxy-served past rows, and both devices.

### Daily briefing failed-delivery — now [#600](https://github.com/WangPantopus/skinny-pantopus/pull/600) (sent to Stream 1 at 2026-09-27T08:14:48Z; bundle `20260927-stream3-briefing-failed-delivery-r1`, seal `48a7778bf1843c6b355a761b77d1b6a876e257b081e098f2060e222e2c102cae`). Checked end to end on local verification trees (`ac6e73fb7` before, `a1d1bbb34` after, injected compose failure): before, row stuck `composing` and the next call skipped; after, row `failed` and the next call retries. Test rows BR1/BR2 recorded and deleted; fingerprint unchanged; API back on `23e518b11` at 08:13:16Z. Original notes follow.

### (history) Committed locally, not pushed: daily briefing failed-delivery (`backend/routes/internalBriefing.js:320`)
- Branch `claude/stream3-briefing-failed-delivery`, head `2ff8ae956` on `7bdef3e8c`. Stream 2 found supabase-js builders have `then` but no `catch` (confirmed on 2.103.3). A scan of master's backend found 4 direct `.catch` sites: Stream 2's `homeIam.js:629` and `seasonalChecklistService.js:272`, Stream 1's `listings.js:562`, and this one (Stream 2 asked me to take it).
- In `/api/internal/briefing/send`'s error handler, the update to mark the `DailyBriefingDelivery` row failed throws before it is sent. The row stays `composing`, which later runs skip as already processed (no retry that day), and the handler's own 500 JSON is never sent. Fix: `Promise.resolve(builder).catch(...)`.
- Waiting for the user: an end-to-end check needs an injected failure in the isolated API and writes 1–2 `DailyBriefingDelivery` test rows (asked in chat at 04:27Z).

### Harness change (runtime only)
- The no-send proxy refuses `GET /api/homes/:id/seasonal-checklist`, `/property-value` (Home first-view writes, confirmed intended by Stream 2) and `GET /api/listings/:uuid` (ListingView upsert) as implicit writes (04:58Z; backup `no-send-proxy.cjs.pre-implicit-home-listing-*`). Fixture FS1: those Home rows from #582's Report issue path were deleted at 04:57:38.039Z.

### User decisions 2026-09-27 (AskUserQuestion, answered before 2026-09-27T07:22:06Z)
- **Devices:** take heavy + slot 3 (emulator-5554) + slot 1 (iOS driver, sim 0AE16FA0) now, since both peers were blocked on the user; notify both peers first, never touch Stream 2's slot 2, release everything when done.
- **Briefing fix:** run the injected-failure check on the isolated API (1–2 `DailyBriefingDelivery` test rows, recorded and deleted; no provider).
- **Android page-editor gallery:** hide it like iOS (#552).
- **"Share profile" (iOS + Android public/persona profile):** keep the button; its sheet gets a real Share action above Block/Report.

### Standing user direction (received mid-turn, recorded 2026-09-27T07:22:48Z)
- "Please do not stop anymore, just go with what you recommended in the future if you encounter any issue or anything … make sure you record all these every time, do not need to stop."
- From now on Stream 3 takes its own recommended option and records it below with the time; safety limits (no providers or live money, no secrets, founder environment untouched, no destructive cleanup, peers notified before shared resources) still hold.

### Decisions taken without asking (per the standing direction)
- 2026-09-27T08:01:47Z: **One combined verification build per platform** (`verify/stream3-native-batch-20260927`, head `72d6e0bd3`, local only) for S3-59 Android, S3-48 iOS, S3-52 native, the gallery hide and the Share action, instead of one build per head. Why: shorter heavy hold while both peers wait. Each PR's files are byte-identical in that tree (checked with `git diff --quiet <head> <verify> -- <files>`). Rejected: 5+ separate builds (~60 min of heavy).
- 2026-09-27T08:01:47Z: **Also hide the owner dashboard's "Photos" section on iOS and Android.** Both apps map the gallery to an empty list, so the rail only shows "Add photo", which opens the page editor, and the editor's gallery is hidden (iOS #552; Android in the gallery branch). Extends the user's "hide the gallery like iOS" decision. Rejected: leaving a tile that leads nowhere.

- 2026-09-27T08:19:57Z: **Native Connections rows open the person's profile** (connected, incoming and sent; not blocked), as web's rows already do (`router.push(`/${username}`)`). Local branch `claude/stream3-native-connections-open-profile`; shared call sites in `RootTabScreen.kt`, `HubTabRoot.swift` and `YouTabRoot.swift` were announced to both peers, and Stream 1 had no edits there. Rejected: leaving rows without a profile route. Build and device check pending, together with the dashboard Photos branch `claude/stream3-native-dashboard-photos-hidden` (`38a3ca314`).

- 2026-09-27T08:59:17Z: **A DM's header opens the other person's profile** on iOS and Android (web parity: `ConversationView.tsx` links the name). Person DMs only (not rooms, the AI thread or persona threads). Local branch `claude/stream3-native-chat-header-profile` (`c5e133780`, squashed to `2583774f3` after SwiftLint/SwiftFormat/detekt fixes; the detekt fix updates the signature-keyed `LongParameterList` baseline entry for `ChatConversationHost`). Shared call sites were announced to both peers, who reported no overlap: Android `RootTabScreen.kt` (ChatConversationHost); iOS Hub, You, Marketplace, Tasks and Inbox roots, where Inbox gains a `publicProfile` route like the others and Hub/You label `onBack`. Rejected: an in-chat sheet, which would diverge from the push navigation pattern. Build and device check pending.

- 2026-09-27T09:22:52Z: **The iOS double load after DM → profile → Message stays a candidate, not part of #612.**
  - Web stacks pages the same way, and the Hub root’s existing profile → Message code already reloads the DM below.
  - Popping back to the DM below would change navigation behavior beyond the parity fix.
  - Recorded in #612’s RESULT and PR body.
- 2026-09-27T09:22:52Z: **Released slot 1 before checking Android’s profile → Message stacking.** Stream 1 was waiting for the iOS driver, and slot 3 was already released. That check is listed as not done in #612.

- 2026-09-27T09:35:05Z: **Fixture BP1 for the policy reproduction.**
  - The Member’s own page `a1060a2b` got web’s Flexible object through the real `PUT /api/scheduling/booking-page`, direct to API 18134, with the exact revert recorded in the manifest.
  - It is not the Owner’s retained `807dd420`.
  - Why: a page’s policy object is the data state web’s editor produces; the reproduction needs it on a page an Android owner loads.
- 2026-09-27T09:45:49Z: **Fix Android to read every stored policy shape** (commit `b991fd3f7`, amended to `88488d264` after detekt flagged `ManageBookingViewModel.map` complexity; branch `claude/stream3-android-booking-policy-object`).
  - `CancellationPolicyValue` plus an adapter, following the `BusinessServiceAreaJsonAdapter` pattern.
  - The editor, the business-settings label and the invitee Manage booking card use it, with the editor’s existing preview wording. Writes are unchanged.
  - Two existing tests were updated only because the DTO field type changed.
  - Rejected: a `String` qualifier adapter (objects as raw JSON text would reach invitee screens), and changing Android’s write format (it would change what web and iOS read; a separate question).

- 2026-09-27T11:41:07Z: **Launch scope applied to Stream 3’s plans** (the user’s 8-feature cut). Classification calls:
  - Business pages count as the kept **crew pages**: creation, editor, dashboard, team permissions, verification, reviews, share, unpublish and reports stay in scope; browsing all businesses is out (#6).
  - S3-22/62 (crew-page CTA and endorse) and S3-26 (AI assistant mail chips) stay in scope, still blocked by the 09-26 user decisions.
  - Invoices and packages stay (S3-69 in scope). The daily briefing (#600) stays.
  - The scheduling engine is tested only through Crew Day; the New York schedule finding became a note for Crew Day.
  - Acceptance rows are split by part: N03 (Beacon/persona/fan out; Pulse posts and comments in), N04 (PersonaBlock out), N05 (booking out; reminders and briefing in), A05 (Marketplace and Calendarly parts out).
  - Rejected: dropping whole acceptance rows, which would also drop their in-scope parts; and editing the shared UX inventory, which is not Stream 3’s file. Stream 1’s shared block covers the rule.

### Earlier questions (answered above)
1. Android page editor gallery: hide it like iOS (#552), or leave it?
2. The persona/public profile header's "Share profile" button opens Block/Report on both apps (still true on master `89f3c6bac`: iOS `PublicProfileView.swift:428`, Android `PublicProfileScreen.kt:399`). Making it share would remove the only route to Block/Report. Options: a separate "…" button for Block/Report and a real Share; relabel as "More"; or leave it.

### Owner fixture password rotated (user-approved, 2026-09-27 01:49Z)
- The old one appeared in a screenshot in this session. The new one is only in the private credentials file (`…/private-restart-inputs/sched-fixtures-private.json`, 0600), which every helper reads; web and `fx` logins verified at 01:50Z. Old password → 401. Existing device/web sessions were not revoked. Manifest entry CRED1 (no values).

### Rows
- **Done in PRs:** S3-46 and S3-69 web (#545); S3-64 iOS, S3-37 iOS, S3-35 iOS + Android, S3-59 iOS (#552).
- **Closed without a change:** S3-69 iOS. `SchedulingInvoiceDetailView` is unreachable (only `InvoicesListView` pushes it, and nothing pushes `.invoicesList`); owner Invoices opens `BusinessInvoicesView`, links open the recipient view.
- **Blocked by user decision** (2026-09-26 ~23:05Z; no write-free or provider-free path):
  - S3-22 / S3-62: every `GET /api/b/:username` inserts a `BusinessProfileView` row unconditionally (`businessPublicPage.js:177`, `:365`), and the endorse button only renders on that page.
  - S3-26: web AI chat keeps messages only in the browser (`useAIChat.ts`); a mail summary exists only in a live provider stream.
- **Skipped by user decision:** S3-64 Android.
- **Stale inventory detail:** S3-59's "the draft is lost" — the composer already kept the text.

### User decisions (2026-09-26)
- ~23:05Z: Review fixture approved; `/b/` reads, canned AI reply and master's migration `20260926100000` not approved (API stays on `23e518b11`); S3-46 honest error + Inbox link; S3-64 skip Android.
- ~23:15Z: S3-35 revised to "Open Create your Beacon" (the button only shows without a Beacon, so there is no persona id for Stripe onboarding).

### Runtime state (isolated only)
- Running: Docker stack `pantopus-stream3-block-r1`, API 18134 (`23e518b11`), proxy 18130 (chat-audit off since 02:55:44Z; upload query/size logging since 00:14:15Z; `post-check.json` off), web 18131 on `/private/tmp/pantopus-stream3-web-chat-names-r1` at #545's head with paid client flags off, file server 18198. Storage shim off. `fault-control.json` = `{}`.
- Fixture S59 (Review `e9fdca7a` + the business `User` rating fields) kept; exact reverts in the manifest.
- **End-of-audit reverts done:** chat-audit mode off (23:25:54Z); F10 (`audience_profile` for the Member) reverted with its recorded SQL at 2026-09-27T00:36:21Z (manifest `revertedAt`); storage shim off; emulator reverse is `tcp:64531 tcp:64531`. API and web stay off master (migration not approved). CA0–CA11 and F13 kept.
- Simulator 0AE16FA0: build `f009f6be7` (#566's iOS tree) installed, Owner signed in, one test photo in its library; the paid flag was removed; shut down. Emulator-5554: restores its quickboot snapshot at every boot (APK `70f275b4…`), so installs don't survive shutdown.
- Web launcher opt-in `S3_WEB_PAID=1` exists (default off). Kit synced (`stream3-runtime-kit`).

### Candidates (not changed)
- **Launch scope (2026-09-27T11:41:07Z):** in the list below, B7 “Max per week 20”, the template editors, auto-created page timezones, persona items and booking/scheduling items are **out of scope** (cuts #1, #2, #5), so don’t verify them. The iOS “Not you?” question and the Edit profile footer stay in scope.
- **Checked 2026-09-27, closed without a change:**
  - Web “New message” result avatars: `chat/new/page.tsx:113` already falls back to `profilePicture`.
  - The Android scheduling `MessagePreviewSheet` insets: the sheet is reachable only from the Workflows/Templates editors, which #468 hid.
- **New candidates (2026-09-27), in suggested order (details in `NEXT-STREAM3-PROMPT-2026-09-27.md` §6):**
  1. ~~Web `resolvePolicyValue` misreads mobile policies~~: done as #623 (merged 11:14Z). Out of launch scope anyway (#5).
  2. Android profile → Message after a DM header tap (#612): not checked.
  3. The iOS business-profile Contact/“Hire to review” failure toast is likely hidden behind the floating tab bar.
  4. The Edit profile footer says “All changes saved · just now” when nothing was saved (iOS `EditProfileStickyBar.swift:76`, Android `EditProfileScreen.kt:1008`).
  5. Out of launch scope (#5): the default availability schedule is created in `America/New_York` (`backend/routes/scheduling.js:52`); web and iOS setup don’t correct it. This is a note for Crew Day, not a Stream 3 task now.
  6. The iOS DM → profile → Message double load (recorded in #612, deliberately left).
- Previously noted: B7 "Max per week 20" placeholder (a disabled stepper holding a made-up 20 on all three platforms; the backend has no weekly cap). The persona "Share profile" item is now a pending user question (above).
- **Candidate, now PR #612 (`2583774f3`, first `c5e133780`; 2026-09-27T08:27:38Z):** the chat header name opens the other person's profile on web (`ConversationView.tsx:349-350`, `chatPersonHref`), but not on Android (tapping it did nothing, 07:32Z). The iOS header has only an audience-profile hook. Next after the dashboard/Connections build.
- **Checked (2026-09-27T08:27:38Z):** the business "gallery" has no backend. `POST /api/upload/business-media` accepts only `logo`/`banner`; `gallery_file_ids` belongs to catalog items, and galleries otherwise exist only as a Custom Pages block. So hiding the editor gallery (#596) and the dashboard Photos rail is consistent.
- **Parity sweep method:** the S3-30, S3-37 and S3-68 Android gaps were all inventory rows listed for one platform. Checked since: S3-49, S3-50 and S3-66 have no gap on the other app; S3-60 became #582. Sweep done: S3-10, S3-13, S3-32, S3-36, S3-51 have no gap either; S3-34 is iOS per-stack wiring (Android has one NavHost); S3-48 (iOS) and S3-59 (Android) are committed above, verification pending. Web read for the same defect classes, no gap: the web notifications page keys its query cache by filter and zone and discards retired responses (the tab race), and a failed "Load more" shows "Could not load all notifications." with Retry while the button comes back; the web broadcast composer has no sample counts; a failed web review reply shows an error.
- iOS build warnings "backward matching of the unlabeled trailing closure … label the argument with 'onBack'" at `Features/Root/TasksTabRoot.swift:408` and `MarketplaceTabRoot.swift:221`: Stream 1 checked (03:18Z): both screens pass `{ pop() }` to `ChatConversationView`, whose last parameter is `onBack`, so Back works today. The risk is only a future Swift 6 switch (forward scan). Recorded in Stream 1's inventory; no change.

## (History) Stream 3 handoff, 2026-09-26T22:15Z — superseded by the 2026-09-27 final handoff at the top

The user asked the 2026-09-25/26 Stream 3 session to stop and hand off. Everything a successor needs is here and in two private files:
- **Runtime manual:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream3-runtime-kit/README.md`. It covers ports, start commands, the proxy and fault rules, fixture users and data, devices, builds and end-of-audit reverts.
- **Takeover prompt:** [NEXT-STREAM3-PROMPT-2026-09-26.md](NEXT-STREAM3-PROMPT-2026-09-26.md), in this folder.

The kit is git-ignored and durable. `/private/tmp` is wiped when the Mac restarts, and the kit can rebuild it.

### 1. State at handoff (verify again: `git fetch`, `gh pr view 536`)
- **Master:** `f885e0623` (batch 31 [#534](https://github.com/WangPantopus/skinny-pantopus/pull/534), which carried #532).
- **The only open Stream 3 PR:** [#536](https://github.com/WangPantopus/skinny-pantopus/pull/536), "live chat keeps working after a token refresh; Android reactions update in place".
  - Branch `claude/stream3-realtime-after-refresh`, head `36af1f3715c03610b234c3d3e6a65af1a18a09d9`, worktree `/private/tmp/pantopus-stream3-chat-keyboard-r1`.
  - Two commits over three existing files:
    - `e121e7fdc`: Android `data/realtime/SocketManager.kt` (`eventsOf` follows a `StateFlow` of the current socket through `flatMapLatest`) and iOS `Core/Realtime/SocketClient.swift` (a subscription registry re-attached on each `connect(token:)`).
    - `36af1f371`: Android `ChatConversationViewModel.kt`. S3-55: a `message:reaction_updated` event with `users` patches the row in place instead of `fetch(initial = true)`.
  - Its base, `916627c18` (#532), is in master, and master has not touched these files. `git merge-tree` is clean.
  - Seal `13cf585ecf535ff4bb2dbb7910c61fa199c421b0fbec8a78d2679a40b0e98fc7`; bundle `20260926-stream3-realtime-after-refresh-r1` (25 files). The seal comment is posted.
  - CI started at 21:59Z (run 36274720988): Android lint/test/assemble and instrumented, iOS lint and test bundles, safeguards.
  - Stream 1 has head, seal, side effects, CI and limits, and plans it for **batch 32** with Stream 2's #535 and Stream 1's qa-live PR.
  - **Next:** when CI finishes, report the result to Stream 1 (or its successor). If CI fails, fix on the same branch, rebuild under heavy, re-verify the affected journey and re-seal.
- **Verified for #536:**
  - Android APK `51d5ffc1…` on emulator-5554:
    - before: a natural refresh at 18:52Z; a forced refresh (one-time 401) in chat and on task detail (question 2 got no refetch); the reaction reload;
    - after: chat live after a forced refresh, 😂 patched in place, question 4 live.
  - iOS:
    - old dylib `8c46c919`: an **in-thread** 401 (topic chip) left the Owner's message 17 unshown until reopen;
    - fixed dylib `d2644903`: message 18 appeared live, with a refetch 22 ms after the send.
  - A 401 during a thread's **first** load doesn't reproduce the bug: `load()` subscribes after its first fetch.
  - **Not verified:** real devices and push; iOS task detail (Stream 1's `gig:qa-update` PR covers it); driving the chat list, badge and tasks feed (same stream, not separately exercised).
- **Merged in this session, 2026-09-25 20:00Z to 2026-09-26 20:09Z (29 Stream 3 PRs):**
  - #427, #436, #440, #444, #450, #455, #460, #465, #466, #468, #470;
  - #475, #479, #483, #485, #486, #488, #491, #494 (SEC-1, user-approved security fix), #497;
  - #502, #507, #508, #515, #516, #520, #523, #530, #532.
  - Bundles: `.pantopus-recovery/audits/2026092[56]-stream3-*` (33 folders).
- **Devices and slots:** none held.
  - iOS sim `0AE16FA0` was shut down at 21:54Z and slot 1 released (Stream 1 took it at 21:56Z). It still has dylib `36af1f371` with the Member signed in.
  - Emulator-5554 was shut down at 22:03Z and slot 4 released. It still has APK `36af1f371` with the Member signed in.
  - Heavy is not held.
- **Runtime: stopped at the user's request, 22:16–22:19Z.** Start it from the kit README.
  - Stopped: API 18134 (was `23e518b11`), proxy 18130, web 18131 (tree `75b6f2eab`), storage shim 64533 and file server 18198. The Docker stack `supabase_*_pantopus-stream3-block-r1` is stopped with its containers and volumes kept.
  - The DB restart and crash recovery were verified at 22:18Z, and the retained rows are intact.
  - Still set in files: `chat-audit.json` is enabled (chat-audit mode comes back when the proxy restarts), and `fault-control.json` is `{}`.
- **Disk:** about 27 GB of Stream 3's own rebuildable build output was deleted: old app/APK copies in the runtime folder, and Android and web build output in the merged-PR worktrees.
  - Kept: the #536 before/after builds, the iOS build caches, #536's Android build, and the web runtime tree's cache.
  - Details are in the kit README.
- **Worktrees:** with the user's approval (22:36Z), 22 merged, clean Stream 3 worktrees were removed with `git worktree remove`, no force. Their branches remain locally and on GitHub.
  - Left: `/private/tmp/pantopus-stream3-chat-keyboard-r1` (#536), `/private/tmp/pantopus-stream3-chat-realtime-r1` (API source), `/private/tmp/pantopus-stream3-web-chat-names-r1` (web source, and the Playwright used by the login scripts), plus the app-managed session worktree `stream3-peer-takeover-d8df28`.
  - The user's general "no worktree removal" rule still stands.
  - Free disk space went from 12 to 66 GiB.
- **Other streams' worktrees:** with each owner's written clearance and the user's request, Stream 3 also removed 37 merged Stream 1 worktrees and 18 merged Stream 2 worktrees. They were done by 2026-09-26T22:45:16Z (Stream 1's `date -u` check); an earlier estimate of 22:46–22:47Z was wrong. Same method: plain `git worktree remove`, no force, branches kept, no prune. The Mac went from 102 live worktrees to 14.
- **#536** passed CI at 22:34Z and is in batch 32 [#540](https://github.com/WangPantopus/skinny-pantopus/pull/540), queued 22:35Z (Stream 1).

### 2. Remaining Stream 3 inventory rows (checked in master `f885e0623` code, 2026-09-26 22:10Z)
The inventory (`coordinator-state-2026-09-23/tools/ux-inventory-2026-09-23.md`) has 69 S3 rows.
- **59** are named as fixed by merged Stream 3 PRs. Rows once reported as partial (S3-13, S3-50, S3-51, S3-66, S3-67) were completed by later PRs per their descriptions; they were not re-driven for this handoff.
- **1** is in #536 (S3-55).
- **9** remain, below.

My earlier answer to the user named only S3-22/37/59/64 plus 35/46. S3-26, S3-62 and S3-69 are also open; I missed them.

| Row | Client | Still wrong on master | Fix direction (inventory) | What is needed first |
|---|---|---|---|---|
| S3-22 | Web | `PublicBlockRenderer.tsx:85-99`: hero CTA buttons have no `onClick`. The CTA block (`:297-313`) opens `b.url` or the inquiry chat, whatever the action. | Call → `tel:`; Directions → the maps link already built in `BusinessPublicProfile.tsx`; Link → a URL field | The public `/b/` page's read inserts a BusinessProfileView row, and the proxy refuses `GET /api/b/:username`. Propose a scope to the user (allow that GET for Owner/Member and record/remove the view rows), or find a non-writing render path. |
| S3-26 | Web | `AIDraftCard.tsx:307-319`: the mail-summary "recommended actions" are `<button>`s with no handler. | Render them as plain text. Making them work needs the mail id in the tool output (backend) plus S2-07's caveats. | An AI mail-summary message to render. The Owner AI thread `fd545dad` (F3b) likely has none, so check it; a new fixture needs a proposal. No AI provider calls. |
| S3-37 | iOS | `BannerLogoEditor.swift` "Change/Add banner", "Change logo", gallery "Add" / "Add cover photo" do nothing; the banner draws `CafeGoldenHourBanner` (`EditBusinessPageMapper.swift:44`). | Upload with the existing `POST /api/upload/business-media/:businessId?type=logo\|banner` (`MultipartUploader.swift`); render the real image; hide the gallery controls | The upload is a write the proxy refuses, so verify the request and the failure UI. A real 200 upload needs a reviewed scope. |
| S3-59 | iOS | `BusinessOwnerViewModel.swift:110-116`: a failed review reply is only logged, rolls back and loses the draft. | Use the screen's existing toast (`:148-158`) and keep the draft | There is no Review for business `2b3c28da` (0 rows with `reviewee_id`). Propose and record one tagged Review fixture. The proxy's refusal then reproduces the failure. |
| S3-62 | Web | `EndorsementButton.tsx`: the catch reverts silently; the 403 reason is dropped. | Toast the rejection's message | The same `/b/` read blocker as S3-22. |
| S3-64 | iOS (+ Android) | `NotificationChannelManagerView` is only instantiated in its previews (`:473-485`). | Wire the iOS view into scheduling settings (reads pass; saves are refused writes). Android would need a **new screen**, low priority. | Propose the Android part to the user before building anything new. |
| S3-69 | Web + iOS | Web `InvoiceDetail.tsx:195-200`: a disabled "Download PDF" (title "PDF download coming soon"). iOS: "Download PDF", "Mark paid" and overflow do nothing. | Hide the PDF action and the dead iOS buttons until a route exists | F7 paid invoice `f13065e9` exists. Check that the invoice screens are reachable with paid scheduling off (the web launcher forces paid off). |
| S3-35 | iOS + Android | "Set up payments" on the audience profile opens your own follow handshake. | Start persona Stripe onboarding (`POST /api/personas/:id/payments/onboard`) and open the URL, as web does | **Money: escalate to the user with evidence.** No provider call; Stripe TEST/manual only. |
| S3-46 | Web | The paid follow toasts "Stripe Checkout is coming in the next release. Your handshake is saved." (`follow/page.tsx:176`); the Audience "Inbox — Coming soon" tab (`audience/page.tsx:218`) though `/app/audience/inbox` works. | A retryable checkout error; link the tab to the inbox | The checkout message is money-adjacent: **escalate**. The Inbox-tab link is not money and could go separately. The Audience nav needs the `audience_profile` flag (F10 enables it for the Member). |

### 3. Candidates noticed, not inventory rows, not changed
- **Empty topic view:** it shows the generic "This is the start of your conversation with …" copy. That's existing design.
- **B7 "Max per week 20":** a disabled placeholder on all three platforms.
- **Persona header "Share profile":** opened the Block/Report sheet on iOS and Android (seen 2026-09-25). Check master before acting.
- **Handed to Stream 2:** escrowed mail to a phone recipient uses the placeholder `smsService`, yet the API says "Mail sent successfully" (their finding 15).

### 4. Runtime state to revert when the chat audit ends (after #536 merges)
- F10 flag: revert SQL is in the manifest and the kit README.
- Proxy chat-audit mode: set `chat-audit.json` to `enabled: false`. Optionally restore `no-send-proxy.cjs.pre-topics-20260926T1305Z`, then restart the proxy.
- Storage shim and `adb reverse tcp:64531 tcp:64533`: use `tcp:64531 tcp:64531` on the next boot.
- API on `23e518b11` and web on `75b6f2eab`: move to master only after deciding about master's migration `20260926100000_mail_recoverable_delete.sql`, which this isolated DB lacks.
- Keep fixtures CA0–CA11 and F13 unless the user asks for cleanup. Exact reverts are in `fixtures-20260926/manifest.json`; CA10 and CA11 were recorded at 21:56Z.

### 5. User decisions in force (2026-09-26)
- **Fixtures:** the listed set is approved in full: isolated DB only, rows tagged "s3fx", an exact-removal manifest, no provider calls.
- **Incidental rows:** Stream 3 kept the three incidental rows (Owner UserPrivacySettings, Solo LocalProfile, Owner Wallet) as baseline.
- **Workflows/Templates:** hidden on all three platforms (#468). iOS booking Nudge's "Use a template" stays working.
- **SEC-1:** fix approved; merged as #494.
- **Chat audit:** "fix all of them" (#502, #507, #508, #515, #516, #532, and #536 open).
- **Still pending with the user:** the money decisions for S3-35 and S3-46.


**PRs**
- #523 (mail label) merged in batch 29 (#526, master `49b47e910`).
- [#530](https://github.com/WangPantopus/skinny-pantopus/pull/530) is in batch 30 ([#531](https://github.com/WangPantopus/skinny-pantopus/pull/531)).
  - Web only: Home "Who's free" stops looping. It sent 775 + 775 requests in 15 s and now sends 3 + 3.
  - Who's free, Find a time and the setup wizard read `occupants`, so members show instead of "Member" / "No household members found".
  - Seal `04f37eda…`. Stream 2 found the loop.
- [#532](https://github.com/WangPantopus/skinny-pantopus/pull/532): chat audit fixes. Head `916627c18`, seal `c6a265c8fa719560d68064fcef7ca9212a19fb2e0814e901f675151192832f93`; 13 commits over 9 existing files.
  - **Messages could vanish.** Each cause was reproduced, then fixed:
    - sharing a card selected its topic without a refetch;
    - the `room:join` backfill merged every topic into a topic view;
    - on Android, the first fetch raced the opening topic;
    - on iOS, the opening topic was re-selected on every refresh, so "All" didn't stick.
  - **Android keyboard:** the header stays on screen and the newest message stays in view.
  - **Listing category names** on all three platforms and in the iOS picker. Android task status "Open"; Android picker "$15".
  - **Android divider:** a card shared into a new topic gets its own divider.
  - **Android documents** keep their name; **Android Photos** picks videos, as iOS does.
  - **Web New message:** photos show, and "Searching…" replaces the false "No users found".
  - **Verified on the final builds** (APK `f849bda0`, iOS dylib `8c46c919`) against the isolated API and database:
    - messages arrive live in each of those cases;
    - an iOS photo sends and a 👍 reaction lands;
    - an Android video sends and plays inline on web.
  - Fixtures: CA6–CA9 and F14 (reverted), with exact reverts in the bundle.

**Heavy and devices**
- Heavy was with me from 17:26Z to 18:35Z. The extra time went to two failed static checks and two root-cause fixes found mid-turn.
- Stream 1 holds heavy and slot 1 now. Emulator-5554 (slot 4) is mine.

**Runtime left for the end of the audit** (kept until #532 merges):
- F10 flag;
- proxy chat-audit mode, its topic rule and query logging;
- storage shim and `adb reverse`;
- API on the #507 worktree;
- web tree detached.

## Update 2026-09-26 17:28Z: batch 28 merged; #523 in batch 29 (#526); chat-audit fixes in the Android build

- **Merged:** batch 28 (#525, 13:49Z, master `be33552e8`) carried #515 and #520.
- **Batch 29 (#526, queued 17:21Z):** #523 and Stream 1's #524.
- **Chat-audit fixes:** branch `claude/stream3-chat-audit-fixes`.
  - Head `13657e0e5`: master `be33552e8` merged in, plus six commits: `2b61cd806`, `661e5091d`, `5045921f7`, `4499f9241`, `743a439ff`, `7885e9084`.
  - Android build under heavy since 17:26:57Z. Handed over by Stream 1; it goes back to Stream 1 for an iOS build.
  - Web recheck on the final head at 17:22Z: listing cards read "Tools" and "Books & Media".
  - The user said to keep going and fix all of them.
- **Correction to the 13:14Z note:** on iOS, a refresh does not reload the thread as the share topic. It merges a topic-only fetch into what is already shown, so, as on Android, the other person's next message never arrives. The commit message was corrected before any push.
- **Closed:** Beacon search finding no "s3fx" Beacons is by design. `canDiscoverPersona` (`backend/routes/identitySearch.js:269`) excludes your own Beacon, and the only fixture Beacon is the searcher's.
- **Dropped candidate:** in `ChatRoomView`'s "Earlier messages" header, attachments are plain filename links. Their URL is `/api/chat/files/:id`, the members-only route, so they open. That is presentation only.
- **Stall:** heavy sat idle under Stream 2's name from about 12:53Z until Stream 1 released it at 17:20Z, with its user's approval.

## Update 2026-09-26 13:14Z: #523 open (batch 29); #515 and #520 in batch 28 (#525); chat-audit fixes branch waiting for heavy

**PR status**
- Batch 28 is [#525](https://github.com/WangPantopus/skinny-pantopus/pull/525) (queued by Stream 1 at 13:13Z). It carries #515 (native chat media) and #520 (Beacon S3-12/13/33/68 plus the Android Audience tab strip).
- [#523](https://github.com/WangPantopus/skinny-pantopus/pull/523): mail notifications are no longer labeled "Listing".
  - Head `e98b73259`, seal `023fa8e4d3dbd1b0523d6bc7adf7858988092397a511a3a7ec842371815edc93`.
  - Reviewed by Stream 1; goes in batch 29.
  - Before and after screenshots on both apps: the tag icon and "Listing" become the info icon and "System".

**Chat audit: new findings, all reproduced** (branch `claude/stream3-chat-audit-fixes`, not pushed yet)
- **Android keyboard:** the header was pushed off-screen and the composer sat half under the keyboard.
  - Fix: resize instead of pan while the chat is open, plus keyboard padding.
  - Waiting for the heavy build.
- **Listing cards (web, iOS, Android) and the iOS listing picker:** they showed the stored key ("books_media", "tools"); they now show "Books & Media" and "Tools".
  - Web reads `CATEGORY_LABELS` from `@pantopus/ui-utils`.
  - Web after is verified.
- **Web "New message":**
  - Results never showed photos: the dialog read `profile_picture_url`, but the search returns `profilePicture`.
  - It said "No users found." for the whole typing pause, 19–656 ms after the first keystroke.
  - Both are fixed and web-verified. Fixture F14 (a temporary Owner avatar) is already reverted.
- **Sharing on Android:**
  - Sending a listing card works end to end; the topic call returns 201.
  - But the share selected the item's topic without a refetch, so the Owner's next message was hidden until "All" was tapped. Evidence: CA6.
  - iOS has the same selection, and there the next refresh fetches only that topic (see the 17:28Z correction).
  - Fix: sharing keeps the current view, as on web.
- **iOS "All" candidate:** a chat opened about an item re-selects that item's topic on every refresh.
  - Fix: the opening topic is used once, as on Android.
  - To reproduce on the installed app before the after check.

**Fixtures** (manifest, with exact reverts)
- CA6: the Android listing share, its topic, and the Owner's test message.
- CA7: a Member task, for task sharing from the native apps.
- F14: reverted.

**Runtime**
- In chat-audit mode, the proxy now also allows the find-or-create topic call. The earlier iOS listing share at 12:29Z had it refused, so that share's topic step was unverified.

**Slots**
- Heavy order: Stream 2 → Stream 1 (Android) → me (one Android build of the fixes branch) → Stream 1 (iOS).
- Stream 1 holds the iOS driver.
- Emulator-5554 (slot 4): me.

## Update 2026-09-26 12:25Z: #516 merged (batch 27); #515 queued for batch 28; #520 Beacon rows open; mail-notification label fix built next

**PR status**
- Batch 27 (#517) merged at 12:16:08Z (master `2e053fe9c`) and includes #516 (web chat scroll and media).
- #515 (native chat media) is reviewed, green and sealed (`a4aba3a9…`); it's in batch 28 with #518 and #519.

**[#520](https://github.com/WangPantopus/skinny-pantopus/pull/520): Beacon owner screens (S3-12, S3-13, S3-33, S3-68)**
- Head `0e7bfcaea`, seal `a312b295e1b15ee3ecd6bfa16cd3e49d1f632d04fcbb946ecade704a8ff47d5b`.
- Checked on iOS for all four rows, and on Android for S3-12 and S3-33.
- Also fixes the Android Audience profile tab strip, which showed only "Updates" (a Row child with fillMaxWidth). The 11 Paparazzi baselines are re-recorded.
- Fixture F10: the `audience_profile` flag is on for Member, with an exact revert in the manifest. It must be reverted at the end of the audit.

**Chat: sharing items**
- Web (Owner): Share a Task and Share a Listing send cards ("s3fx chat share task" $25, "s3fx chat share listing" $10).
- Member receives them live on web and on Android; the Android cards open the task and listing detail pages.
- Fixture CA4 is recorded.
- Not checked: sending cards from the native apps.

**Chat: Android keyboard (reproduced)**
- With the keyboard open, the chat header is pushed off-screen: the window pans, and the chat screen has no IME padding.
- The fix needs the chat to switch to resize mode while open, IME padding, and the bottom tab bar hidden while typing. That's queued as a separate careful change.

**Mail notification label** (Stream 2's FYI, reproduced on Android with fixture F13)
- mail_new and home_mail_removed showed a tag icon and "Listing".
- Fix: branch `claude/stream3-notification-mail-label`, head `e98b73259`. Mail types map to System, before the home rule.
- Builds wait for heavy, after Stream 2.

**Web "New message" search:** works. Candidate only: result avatars read `profile_picture_url`, but the API returns `profilePicture`.

**Process note:** at about 12:16Z my simulator booted briefly while Stream 2 held slot 1, because my script's slot claim failed and it didn't stop. Stream 2 was told, and the sim was shut down at once.

## Update 2026-09-26 11:35Z: chat audit (user request). #515 native media and #516 web media open; batch 26 (#513) carries #502, #507, #508

**Merged**
- **Batch 25 (#499, master `207eeb510`)**: #491 (S3-57), #494 (SEC-1) and #497 (chat pickers).

**Batch 26 ([#513](https://github.com/WangPantopus/skinny-pantopus/pull/513), queued by Stream 1)**
- [#502](https://github.com/WangPantopus/skinny-pantopus/pull/502): S3-31 / S3-54, native Messages filter empty states and the action-failure feedback.
- [#507](https://github.com/WangPantopus/skinny-pantopus/pull/507): chat sockets join their rooms on connect and never drop an early `room:join`. Bundle r2, seal `19652bdb…`.
- [#508](https://github.com/WangPantopus/skinny-pantopus/pull/508): web chat shows names again.

**New PRs**
- [#515](https://github.com/WangPantopus/skinny-pantopus/pull/515) (native, stacked on #502, head `5378ef4dc`):
  - Photos keep their caption and show every photo ("+N").
  - A tap opens the shared full-screen viewer.
  - PDFs and videos open (Android in the app for the file type, iOS in Quick Look).
  - The server's "Photo" label is not shown as a caption.
  - Verified on emulator-5554 and simulator 0AE16FA0. Bundle `20260926-stream3-native-chat-media-r1` is sealed after one more iOS capture.
- [#516](https://github.com/WangPantopus/skinny-pantopus/pull/516) (web, stacked on #508, head `962bf60ed`):
  - The thread opens at the newest message, keeps its place on "Load earlier", and shows "New messages ↓" instead of pulling a reader down.
  - Videos play inline. This needed a keyed message list: the first REST page used to remount every bubble after the socket's 50 recent messages.
  - No "Photo" caption.
  - Bundle `20260926-stream3-web-chat-media-r1`, seal `7890aea6732bd018c5d7a22367e45632fab55efe3a164302828322a9a3c3a030`.

**Chat audit results so far**
- **Latency:** fixed by #507. Android→web: server ~61–63 ms plus ~16–21 ms to render.
- **Reactions:** live both ways.
- **Sends:** photo, PDF and video from web, and photo from Android, work.
- **Order:** chronological with the newest at the bottom on all three. Older pages load in order: iOS scrolls to message 01; web order was correct before, and #516 fixes the web jump.
- **Names and media:** fixed by #508, #515 and #516.
- **Still open:**
  - sharing a gig or listing inside chat (needs a fixture gig and listing);
  - the Android header with the keyboard open (seen once);
  - the "New message" people search still reading the old user fields;
  - `ChatRoomView`'s history header, which shows attachments as links.

**Environment-only finding**
- The local storage stand-in answers a matching `If-None-Match` with an empty 200 instead of 304.
- Android's Coil cache then stored an empty photo body. Production S3 returns 304, which Coil 2.7.0 handles (bytecode checked).
- Emulator-5554 now reaches storage through a private shim on 64533 (`adb reverse tcp:64531 tcp:64533`) that drops the two validators.

**Fixtures**
- CA0–CA3 are recorded in the manifest with exact reverts.
- CA3: 22 messages and 3 files in DM `ea81a397`.

**Pending user decision**
- Nonprofit verification evidence: the CHECK constraint rejects `ein_verification` and `tax_exempt_letter` (a new migration, and the fee goes to 0%). Unchanged.

**Candidates** (from Stream 2's FYI)
- Both apps label every notification whose type contains "mail" as "Listing": the tag icon and green chip. That includes `mail_new`, `mail_urgent` and `home_mail_removed`. To check after the Beacon afters.

**Runtime** (private)
- **API 18134:** runs the #507 worktree (`23e518b11`) with local storage.
- **Proxy 18130:** chat-audit mode is on. Chat writes are allowed for Owner and Member only; socket.io passes through.
- **Next 18131:** runs `962bf60ed`.
- **Supporting services:** file server 18198 and storage shim 64533.

**Slots**
- Heavy: Stream 1.
- iOS driver: Stream 1 until about 11:50Z, then me for the Beacon afters (S3-12/13/33/68, head `3f0b98c71`), then back to Stream 1.
- Emulator-5554 (slot 4): me.

## Update 2026-09-26 08:55Z: PR497 (web chat share pickers) open; batch 24 merged (master `dbd75332b`)

- **Batch 24 (#489) merged** at 08:44:25Z, per Stream 1. It carried #483, #485, #486 and #488 from Stream 3.
- **Batch 25 chain (Stream 1's dry run on `dbd75332b` is clean):** #490, #492, #495, #496, **#494 (SEC-1)**, **#491 (S3-57)** and #493. Stream 1 reviewed #494 (CI green) and #491 (CI still running).
- **[PR497](https://github.com/WangPantopus/skinny-pantopus/pull/497): web chat Share a Task / Share a Listing pickers** (Stream 1's find). Head `ad78fe036`, two existing files.
  - Five reads (my tasks, task search, my listings, their listings, listing search) used to show their empty copy on failure.
  - They now show the existing `ErrorState` with Try Again, which re-runs the read.
  - Verified in ChatRoomView and ConversationView as Owner, with proxy 500s before upstream. Retries recover once the fault is removed.
  - DB unchanged. Bundle `20260926-stream3-web-chat-picker-failures-r1`, MANIFEST.json SHA-256 `9fc83c0b5c691bbe8076d0abd32efb17f1c451ea47c505b301d3602762a2325d`.
- **Runtime:** the API on 18134 and Next on 18131 both run master `dbd75332b` (worktree `/private/tmp/pantopus-stream3-pickers-r1`); `fault-control.json` is `{}`.
- **Next:** S3-31, now unblocked by #485. Native builds wait for heavy (Stream 2 has it).

## Update 2026-09-26 08:42Z: SEC-1 open as PR494 (user-approved); nonprofit evidence-type defect escalated

- **[PR494](https://github.com/WangPantopus/skinny-pantopus/pull/494): SEC-1, approved by the user in chat.** Branch `claude/stream3-evidence-file-ownership`, head `ffa04bb7d`, one file (`backend/routes/businessVerification.js`, +17).
  - `upload-evidence` now files a document only when the caller uploaded it, it isn't deleted, and its `file_context` is `business_verification`.
  - Unknown and foreign IDs share one 400.
  - **Before** (isolated API on master `e00952e3e`): Owner filed Viewer's File as the business's evidence → 201 pending.
  - **After** (API on `ffa04bb7d`): foreign, wrong-purpose, deleted and unknown files all get 400. A duplicate type still gets 409. The owner's own verification upload gets 201. Only the valid case wrote.
  - Bundle `20260926-stream3-evidence-file-ownership-r1`, MANIFEST.json SHA-256 `24ac015c38cb2640c194abe1e232788424be38e0da01ef9b952f8b0e8fc4fb00`.
  - Side effects (isolated DB, exact reverts): fixture F8 (4 File rows plus 2 trigger-created FileQuota rows), 2 pending evidence rows with their audit rows, and login sessions.
  - Device journeys were not re-run: the upload hop needs S3 credentials this runtime lacks.
  - The API on 18134 is back on master `e00952e3e`.
- **New defect, escalated to the user (money):** `bve_evidence_type_check` (baseline migration) rejects `ein_verification` and `tax_exempt_letter`, which all three clients offer in the 501(c)(3) section.
  - Nonprofit evidence therefore always returns 500. Reproduced, with no rows written.
  - The repair is a forward migration widening the CHECK. Admin approval of that evidence then sets the nonprofit's fee to 0%, so the decision is the user's; nothing was changed.
- **Next:** the web chat Gig/Listing pickers (worktree `/private/tmp/pantopus-stream3-pickers-r1`, branch `claude/stream3-web-chat-picker-failures`). #489 (batch 24) and #491 CI are running.

## Update 2026-09-26 07:46Z: S3-57 fix committed (native); security item escalated to the user

- **S3-57, both platforms:** branch `claude/stream3-native-rollback-feedback`, head `bac788aa0`, 8 existing files.
  - iOS and Android now toast when a notification delete, Mark all read or unblock rolls back, and confirm a successful unblock.
  - Android befores are recorded on master-equal APK `c65d76a1`: the refused DELETE, read-all and unblock all rolled back silently.
  - SwiftLint strict and SwiftFormat are clean.
  - Waiting on the iOS driver for iOS befores, then heavy for the build.
- **S3-31 (Messages filter empty state):** Android before recorded (Gigs filter shows "No conversations yet" and drops the AI row). The fix changes the same chat-list block as #485, so it follows #485's merge.
- **Security item, escalated to the user** (found by Stream 1 while reviewing #486; confirmed in code):
  - `POST /api/businesses/:id/verify/upload-evidence` (`backend/routes/businessVerification.js` ~170–245) only checks that `file_id` is a UUID before inserting the evidence. It never checks that the File belongs to the caller.
  - An owner could therefore point admin review (`adminVerification.js` lists `file_id`) at someone else's private file.
  - Proposed fix: before the insert, require the File row to be the caller's own, with `file_context` `business_verification`. Not changed without the user's go-ahead.

## Update 2026-09-26 08:28Z: PR488 (S3-39) and PR491 (S3-57 native plus an iOS delete bug) open; batch 24 = #489

- **Batch 23 merged** at 07:51:21Z (#479). Batch 24 = [PR489](https://github.com/WangPantopus/skinny-pantopus/pull/489), carrying #483, #485, #486 and #488 from Stream 3.
- **[PR488](https://github.com/WangPantopus/skinny-pantopus/pull/488): web S3-39.** The business address step drops the "Request access · Recommended" and "I'm in a new building" placeholders, and a failed Verify gets Retry instead of an endless spinner.
  - Verified with synthetic create, geo and verdict responses; DB unchanged.
  - Bundle MANIFEST.json SHA-256 `0bb3d8a22617296973eb5bb98cdf3c5c267ff69d94c7a60a7818160b9d569d90`.
- **[PR491](https://github.com/WangPantopus/skinny-pantopus/pull/491): S3-57 on iOS and Android**, plus a newly found iOS defect: Delete in "Delete notification?" never sent a request (the dialog binding cleared `pendingDelete` first).
  - Built under heavy 07:54–08:18Z; APK `5b9202ae`, dylib `85e11958`. Before and after on both apps; all writes refused or synthetic.
  - Bundle MANIFEST.json SHA-256 `56ed8237265f34fb56b7deae0bf4dcf4ef7757a85ae0a32ad153288f41f8c526`.
- **S3-31:** befores recorded on both platforms (filtered-empty shows "No conversations yet" and drops the AI row). The fix waits for #485.
- **Queued (from Stream 1):** web chat Gig/Listing pickers show a failed read as "No tasks yet" / "You have no listings".
- **Harness:** proxy `rejectDelayMs` holds an injected answer, so a toast can be captured.

**Time correction (2026-09-26 07:38Z, from git log):** four headings below were hand-estimated 5–8 min late. They now show their commits' `git log` times: 06:30Z, 06:42Z, 07:30Z and 07:37Z (previously 06:35Z, 06:50Z, 07:35Z and 07:40Z). The pushed commit subjects keep the old labels.

## Update 2026-09-26 07:37Z: S3-23 open as PR486

- **[PR486](https://github.com/WangPantopus/skinny-pantopus/pull/486): open.** Web S3-23. Head `a1e25c026`, 3 files.
  - Business Settings → Legal asked for a "file ID" from a file manager web doesn't have, and the nonprofit tab used `window.prompt`. Both are now file pickers.
  - They make the same two hops as iOS and Android: `POST /api/files/upload` (business_verification, private), then `uploadVerificationEvidence` with the returned id.
  - Verified with a refused upload and with synthetic success; the evidence call carries the uploaded id. DB unchanged.
  - Bundle `20260926-stream3-web-verification-upload-r1`, MANIFEST.json SHA-256 `a4c45618908fe10075d415ab9cf31996505b3bf87028b0aabfa6167b66a96a4d`.
  - The nonprofit tab can't render with the fixture, so it's checked by lint and tsc only. Its letters can unlock the 0% fee after admin review; this change adds no fee logic.
- **S3-39 still reproduces in code:** the address step's "Request access" and "I'm in a new building" show "coming soon", and a failed verify keeps the spinner. The step needs address autocomplete, and providers are off in this runtime, so it's queued behind synthetic-data work.

## Update 2026-09-26 07:30Z: PR483 (S3-43) and PR485 (S3-48, S3-56) open; batch 22 merged (master `a916e6bd9`)

- **Merged in batch 22** ([PR478](https://github.com/WangPantopus/skinny-pantopus/pull/478), 07:13:40Z): #475 (S3-47) and #470 (S3-66). Batch 23 = [PR484](https://github.com/WangPantopus/skinny-pantopus/pull/484), carrying #479.
- **Addenda and a correction for #475 and #479** (Stream 1 verified the hashes):
  - I had said a synthetic 200 from the proxy couldn't reach the web page. That was wrong: the app's `/api` calls are same-origin through Next.
  - With that, the empty reminders ("No reminders"), B7's "No event types yet" and B7's save-success states are now verified. The DB was unchanged.
  - Addendum MANIFESTs: `daa00946…` and `29e3dc4d…`.
- **[PR483](https://github.com/WangPantopus/skinny-pantopus/pull/483): open.** Web S3-43. Head `072264f1b`, 3 files.
  - Advanced Privacy listed only `UserProfileBlock` rows and said "No blocked users" for people blocked from a profile (`UserBlock`), with no link to Blocked users. The Blocked users page never listed the scoped blocks.
  - Now Blocked users lists all three contracts; scoped rows show "· Search block" and lift via `DELETE /api/privacy/blocks/:id`. Advanced Privacy links there.
  - Verified with synthetic block lists and a synthetic or refused unblock; DB unchanged.
  - Bundle `20260926-stream3-web-blocked-users-complete-r1`, MANIFEST.json SHA-256 `9b2970ba2f653e654f63cb8865645262d8ecde24e1fd77bf3bcdef563c13e866`.
- **[PR485](https://github.com/WangPantopus/skinny-pantopus/pull/485): open.** Android S3-48 and S3-56. Head `95886f149`, 3 files. Built under heavy (07:06–07:24Z) on APK `cca77428…`.
  - S3-48: a tab switch mid-load refetches and drops the late page. Before, Unread showed read rows; after, only unread.
  - S3-48: a failed next page shows Try again instead of an endless spinner.
  - S3-56: Messages pulls to refresh.
  - Unit tests in the affected packages pass (26/10/7/4).
  - Bundle `20260926-stream3-android-notifications-chat-refresh-r1`, MANIFEST.json SHA-256 `dde4f7201c3111534ee7ed807622ef595a406caacef7c2026c4469a975ab505b`.
- **Harness:** the no-send proxy now also refuses `GET /api/privacy/settings` for non-Owner callers, because it inserts a default row.
- **Not doable here:**
  - S3-55: the reaction reload is realtime-driven, and realtime is blocked.
  - S3-62: Endorse only renders on the public `/b/` page, whose read inserts a view row.
- **Progress, as reported to the user:** 69 Stream 3 rows.
  - 40 merged fully and 5 partly; now also S3-47 and S3-66 merged.
  - Open: S3-43, S3-48, S3-56, plus the B7 finding.
  - About 18 rows remain, and 2 need money decisions: S3-35 and S3-46.

## Update 2026-09-26 06:42Z: web B7 limits open as PR479 (master `e1509f346`, batch 21 merged)

- **Batch 21 merged:** #465, #466 and #468. #470 and #475 are in batch 22 ([PR478](https://github.com/WangPantopus/skinny-pantopus/pull/478)).
- **[PR479](https://github.com/WangPantopus/skinny-pantopus/pull/479): open, CI running.** Web "Booking limits & notice rules" (B7) on Availability. Head `59a76e57d`, 3 existing files. This is a new finding, not an inventory row.
  - Before (Member): the tab showed hard-coded 4 h / 8 per day / 20 per week / 2 per person. Done toasted "Limits updated." with no request, and the values reset when the tab reopened.
  - After: like iOS and Android B7, it reads the first active event type, names it and shows its real values. A null cap shows as 0, "0 means no limit". Done sends only the moved fields with `PUT /event-types/:id`. Max per week is disabled, as on native. Loading, error/retry and empty states are handled.
  - Verified with every write refused by the no-send proxy: request bodies `{"daily_cap":3}` and `{"per_booker_cap":1,"slot_interval_min":60}`; an injected 500 shows the retry state; DB fingerprint identical; ESLint, tsc and the affected Jest file (11/11) pass.
  - Bundle `20260926-stream3-web-booking-limits-r1`, MANIFEST.json SHA-256 `cefe9fc83c183379ef7aa720501562156ce28fb59ed0f0c01bacb1dc1881b1c6`.
  - Limits: the 200 save path wasn't exercised (a real save needs a reviewed scope); the empty state wasn't rendered.
  - Follow-up candidate: the disabled "Max per week 20" placeholder on all three platforms.

## Update 2026-09-26 06:30Z: S3-47 open as PR475 (master `5bf1eb7f8`)

- **[PR475](https://github.com/WangPantopus/skinny-pantopus/pull/475): open, CI running.** Web S3-47. Head `305f63cab`, 1 file (`EventTypeForm.tsx`).
  - The event type editor's Reminders row showed "1 day, 1 hour before" for everyone. It now shows the booking page's real `reminder_minutes` (existing `summarizeReminders`) and links to the Reminders page; a failed read shows WorkflowList's retry copy.
  - The static, disabled "Booking limits · Off" row is removed. The per-event limits stay in the Advanced card.
  - Reproduced and verified as Member (fixture F5d, page reminders `[120]`): before "1 day, 1 hour before", after "2 hours before"; the link lands on "Default reminders" with 2 hours selected; an injected 500 shows the failure copy; create mode makes no read. DB fingerprint identical during the afters; ESLint and web tsc clean.
  - Bundle `20260926-stream3-event-type-reminders-r1`, MANIFEST.json SHA-256 `21988c0a1556ec7784033ce365a353fdb2f9c3932090d7eaaea5068110e3e5a7`.
  - Fixture F5d (user-approved set, exact reverts): Member event type `4bc2310d` and Member's personal page `a1060a2b` (not live).
  - Broad80: S3-47.
- **New finding (not in the inventory):** web Availability → "Booking limits & notice rules" (B7, `BookingLimitsForm.tsx`) starts from hard-coded defaults and its Done only toasts "Limits updated."; nothing is read or saved. Next: reproduce on the real app and propose the fix.
- **Harness gotcha:** in the hidden in-app pane, React 19 never reveals a streamed Suspense boundary (rAF doesn't fire), so a page can sit on its skeleton. Calling the pending boundary comment's `_reactRetry()` hydrates it.

## Update 2026-09-26 06:08Z: fixture set created (isolated DB `pantopus-stream3-block-r1` only)

The user approved the full set and the keep decision for the three incidental rows.
- **Where it's recorded:** the private runtime's `fixtures-20260926/` holds `PLAN.md` and `manifest.json`. The manifest lists 129 rows, each with an exact revert.
- **Guardrails:** no provider call (no email, push, SMS, AI or Stripe). Retained draft BookingPage `807dd420` unchanged (still not live); the 6 original IdentityAuditLog rows intact.
- **Through the real API** (direct to the isolated API):
  - F1: published business `s3sched_biz_da533f`.
  - F2: Member's Beacon `s3fx_member_beacon`, followed by Owner, with 1 broadcast.
  - F3a: Owner↔Member chat with 59 messages (more than one 50-message page).
  - F4: Owner↔Member connection plus mutual follows.
  - F5a: 2 event types on Owner's page.
  - F5b: an upcoming confirmed booking, Mon 2026-09-28 10:00 ET.
- **As DB rows, because the API path would call a provider or can't book the past:**
  - F3b: Owner's AI thread (metadata only).
  - F5c: a past confirmed booking, which puts it in the no-show window.
  - F6: 30 tagged notifications, so Owner has 33 across 2 pages.
  - F7: a paid $120 business invoice with no Stripe rows.
- **Verified through read-only API calls:** every fixture surfaces for its user.
- **Unblocks:** S3-13, S3-47, S3-48, S3-51 no-show, S3-53 New chat, S3-54, S3-55, S3-56, S3-67 broadcast "⋯", S3-68, S3-69, and S3-50 with real edges.
- **Batches:** batch 21 (#471) holds #465, #466 and #468. #470 is planned for batch 22 with Stream 1's #472.

## Update 2026-09-26 05:50Z (master `5bf1eb7f8`)

- **[PR470](https://github.com/WangPantopus/skinny-pantopus/pull/470): open, CI running.** S3-66 on iOS and Android. Head `b99401990`, 15 files.
  - Business Share now hands out "Check out <name> on Pantopus — <web>/b/<username>" when the public page is live, and the app link with the name while it's unpublished.
  - It also fixes the link it shares: both apps showed "Business not found" for `/b/<username>` of a published business (reproduced), because the username went to the id-only detail read. A not-found, non-UUID id now resolves through the read-only public page.
  - Bundle `20260926-stream3-business-share-link-r1`, MANIFEST.json SHA-256 `1811fddc8f4bd0f628a325757420a9a519af2c89c800ee7db8c775922193470c`.
- **CI green:** #465, #466 and #468. All four are with Stream 1 for batch 21.

## Update 2026-09-26 05:10Z (master `5bf1eb7f8`, batch 20 merged)

- **Merged in batch 20** ([PR463](https://github.com/WangPantopus/skinny-pantopus/pull/463), 04:22:41Z): [PR455](https://github.com/WangPantopus/skinny-pantopus/pull/455) (S3-50, S3-53 Call, S3-67) and [PR460](https://github.com/WangPantopus/skinny-pantopus/pull/460) (web S3-42, S3-61).
- **Open for Stream 1's queue:**
  - [PR465](https://github.com/WangPantopus/skinny-pantopus/pull/465): S3-08, S3-36, S3-34; for batch 21.
  - [PR466](https://github.com/WangPantopus/skinny-pantopus/pull/466): web S3-65 Unpublish confirm. Head `d8d7a2993`, 1 file. Bundle `20260926-stream3-business-unpublish-confirm-r1`, MANIFEST SHA-256 `296a7637ab1b356061b554a1598d8a7ca1b2c2e2aad5ba3691c8b807f43c4b72`.
  - [PR468](https://github.com/WangPantopus/skinny-pantopus/pull/468): head `e98e8cb64`, 7 files. Bundle `20260926-stream3-hide-automation-hub-back-r1`, MANIFEST SHA-256 `e16220404e0f0187f60082110be37d8d33437b404b073e34ba978a32bedb5bad`.
    - The user's decision B: Workflows and Message templates are hidden on web, iOS and Android.
    - A new iOS dead end is fixed: the Scheduling hub pushed from You had no Back, and the swipe was disabled.
    - It also makes the S3-51 Templates → Preview → "Send test" path unreachable.
- **Fixtures** (user-approved set; isolated DB only; private plan and manifest with exact reverts in the runtime `fixtures-20260926/`):
  - F1 done at 04:40:35Z: the real API published `s3sched_biz_da533f`. It wrote BusinessProfile publish fields, BusinessAuditLog `3b723c4d…` and NeighborhoodSignalCache `d518cacc…`.
  - F2–F7 are next: a Beacon persona with a broadcast, conversations including an AI thread, a connection and follow, event types plus a booking in the no-show window, notifications, and a DB-only paid invoice.
- **Next rows this unblocks:** S3-66 (native business share link, now with a published business), then S3-47 (event types).

## Update 2026-09-26 04:20Z (master `a5fb4864c`, batch 19 merged)

- **[PR455](https://github.com/WangPantopus/skinny-pantopus/pull/455) and [PR460](https://github.com/WangPantopus/skinny-pantopus/pull/460)** are in Stream 1's batch 20 ([PR463](https://github.com/WangPantopus/skinny-pantopus/pull/463): #455 → #460 → #458 → #461), queued.
- **[PR465](https://github.com/WangPantopus/skinny-pantopus/pull/465): open, CI running, sent to Stream 1 for batch 21.**
  - Head `b27e3115d12fd4216f67ba2c777cc77c4bde4815`: 3 fix commits plus a clean merge of master `a5fb4864c`; 8 existing files.
  - **S3-08** (iOS + Android): the owner dashboard's Settings opens the page editor (web's business settings are those profile fields). Insights (top bar and "This week" link) is hidden until a native screen exists; the tiles stay.
  - **S3-36** (iOS): the You stack gets the Hub's Discover businesses route, so "Claim an existing page" no longer opens Create.
  - **S3-34** (iOS): the Public profile card opens the fully wired audience profile. From You Settings it's a push; from Hub Settings and the drawer Identity Center sheet it opens the profile cover (as notification links do). Settings' unwired copy is removed.
  - Befores on master-equal installed builds; afters on iOS dylib `206e1c76…` and Android APK `78d6df0e…` (ktlint, detekt, lint and assemble passed; SwiftLint strict and SwiftFormat clean).
  - Bundle `20260926-stream3-owner-settings-entries-r1`, MANIFEST.json SHA-256 `5b6228c969c9bd6199ba2e3cdb6428c3de5e8cda3cf43cda6e993271b329c148`.
  - Side effects: auth bookkeeping only.
  - Limits: S3-35 unchanged (needs persona Stripe onboarding); Beacon-owner states and Discover results need fixtures.
  - Broad80: advances A05 and N03, partially; no row closes.
- **User decisions (2026-09-26, in chat):**
  - Fixture set: approved in full (published business, Beacon persona with a broadcast, conversations including an AI thread, a connected and following pair, event types, notifications, a DB-only paid invoice, a booking in the no-show window). Isolated DB only, tagged rows, an exact-removal manifest, no provider calls.
  - The three incidental rows (Owner UserPrivacySettings, Solo LocalProfile, Owner Wallet): the user left the choice to Stream 3, which keeps them as fixture baseline. They are what the app creates on first visit; deleting them would only make the next visit recreate them, and the proxy allowlist relies on Solo's row.
  - Workflows and templates: **B, hide** on all three platforms until sending exists. iOS booking Nudge's "Use a template" reads saved templates into a nudge that really sends, so that path is kept working.
- **Handed to Stream 2 (their finding 15):** escrowed mail to a phone-number recipient calls the placeholder `smsService` (it only logs), yet the API answers "Mail sent successfully".

## Git and integration (master `564bf220d`, 2026-09-26 02:40Z)

- **PR427:** web booking actions, merged through batch PR431. The resolved booking-detail file matches the exercised 417+427 runtime.
- **ID mapping:** sent to Stream 1 and accepted.
  - Closed: S3-03, S3-04, S3-05 (batch428: 411/417/421) and S3-44 (427).
  - Partial: S3-18 (web only).
  - Ledger per Stream 1: 96 merged / 59 unfinished, before this session's PRs.
- **[PR440](https://github.com/WangPantopus/skinny-pantopus/pull/440): merged** in web batch 15 (PR442, 23:47:26Z) at head `3354d7109699b8a605d94897363fb7f41efdedc0`.
  - Covers S3-40 list, S3-41 (profile, business, profile title), S3-45, S3-51 web parity and S3-63 web.
  - Bundle `20260925-stream3-web-load-failures-r1`, MANIFEST.json SHA-256 `b0718ec2dcc818443de0e0756620051f912cdff742c4c696c2636a2ab2ed2613`.
- **[PR436](https://github.com/WangPantopus/skinny-pantopus/pull/436) and [PR444](https://github.com/WangPantopus/skinny-pantopus/pull/444): merged** in native batch 14 (PR449, 2026-09-26 01:29:06Z, master `8f1a59f58`).
  - PR436 is native scheduling truth: S3-51 native, S3-52 partial, the invented Booking settings values and the Android policy editor's wrong owner. Bundle `20260925-stream3-scheduling-automation-truth-r1`, MANIFEST.json SHA-256 `aed2e2cde9ee96fc322c15bc09433f89d18d57f5005feabd70c582e76739ee11`.
  - PR444 is native social: S3-58, S3-63, S3-60 and S3-49. Bundle `20260925-stream3-social-confirm-requests-r1`, MANIFEST.json SHA-256 `623a8b5f6ce658ef2f90c52f8c33477ef0c1b147352840e955dc7b1f85c5ca93`.
- **[PR450](https://github.com/WangPantopus/skinny-pantopus/pull/450): merged** in batch 17 (PR452, 02:08:00Z, merge `e920dc277`; master `8a9a97757`).
  - Covers S3-06 and S3-11, plus the Data export / Hub Edit profile double Back.
  - Bundle `20260926-stream3-native-placeholder-exits-r1`, MANIFEST.json SHA-256 `0793d4a096118fd81dbc273e1b3b512564d71a62235670f05cfca2f477e70f51`.
- **[PR455](https://github.com/WangPantopus/skinny-pantopus/pull/455): open, CI running**, awaiting Stream 1 review for the next native batch.
  - Head `d91bd08197492431090ed2d79822d59868849944`, 3 commits and 15 files on `8f1a59f58`. It merge-trees clean onto `564bf220d`; batches 17 and 18 touched none of its files.
  - **S3-50** (iOS + Android; the inventory listed iOS only): Follow and Connect wait for the relationship read, and a failed read hides them with a toast. Failed posts show "Couldn't load posts / Try again" instead of "Quiet for now".
  - **S3-53:** the Call control is removed from person threads (iOS + Android).
  - **S3-67** (iOS + Android): Terms and Privacy Share hand out the public `/terms` and `/privacy` pages on the build's web origin; "Hire to review" starts the Contact inquiry; the business footer Report and Share run the overflow actions.
  - Befores and afters pass on the installed apps: iOS dylib `f35d6be8…`, Android APK `fb0f8c3e…`. ktlint, detekt, lint, SwiftLint strict and SwiftFormat are clean.
  - Bundle `20260926-stream3-profile-share-truth-r1`, MANIFEST.json SHA-256 `23063f8a04d70032e0262d2ad16921eb7c49247ae201ab2e7149d73998dd0c26`.
  - Broad80 advances, partial: N03, N04 and A05; no row closes.
- **[PR460](https://github.com/WangPantopus/skinny-pantopus/pull/460): open (web), CI running**, for Stream 1's queue.
  - Head `051eff7f71f3150ea15dce4a5a81bef9c3327dcd` on `564bf220d`, 3 web files, merge-tree clean.
  - **S3-42:** failed profile stats show "—" with Try again, and the Earnings card opens `/app/wallet`.
  - **S3-61:** the rejected field is marked with the sign-up form's treatment; the toast has no raw key; the phone conflict marks the phone field; a profile-saved/skills-failed save says so. Its generic-message part was already stale.
  - Befores ran on master before any edit; the afters are DOM captures, and save failures were injected with the backend's exact envelopes. ESLint 0 errors; the type-check gate passes.
  - Bundle `20260926-stream3-web-profile-truth-r1`, MANIFEST.json SHA-256 `f5c25505b52fdd49cc8635d12e082c5b20643646d5db8892cdebf0f56af15915`.
- **Parked local branch `claude/stream3-s313-beacon-updates-wip`** (`18edeaf58`): S3-13. It needs a Beacon owner with Beacon Updates to reproduce first.

## Runtime (private, `/private/tmp/pantopus-stream3-s351-runtime-20260925-r1`)

- **API 18134:** runs from the Stream 3 worktree; its backend tree equals master. Jobs, cron and providers are off, and keys are minted in memory from the stack JWK.
- **No-send proxy 18130:**
  - Reads pass through, except write-capable GETs. Refused are availability; booking-page for anything but Owner's personal page (the caller is read from the header or the `pantopus_access` cookie); `GET /api/b/:username`, which inserts a `BusinessProfileView` row on every read; and `GET /api/identity-center` (plus handle-less `/view-as`) for callers without a LocalProfile (ensureLocalProfile). Only Owner and Solo, who have rows, pass.
  - Mutations are refused, except local auth and the template preview POST.
  - Socket upgrades are refused.
  - Per-path fault injection comes from `fault-control.json`, which is empty (`{}`) now.
- **Retained DB `pantopus-stream3-block-r1`** (64531/64532): the Personal draft BookingPage `807dd420…` and 6 IdentityAuditLog rows are intact. `BusinessProfileView` has 0 rows.
- **Devices:**
  - iOS 0AE16FA0 (signed in as Solo) was shut down at 02:24:49Z, and the iOS driver went to Stream 1.
  - emulator-5554 (Owner) was shut down at 02:36:52Z.
  - All Stream 3 device slots are released. Heavy was released to Stream 1 at 02:29:59Z.
- **Worktrees:**
  - PR455 is in `/private/tmp/pantopus-stream3-profile-share-r1`.
  - `/private/tmp/pantopus-stream3-web-load-failures` still has untracked `frontend/packages/*/node_modules` link directories, used only to run Next there. Removing them is local cleanup.

## Side effects this session

- Auth bookkeeping from login, refresh, logout and two web cookie logins.
- One default `UserPrivacySettings` row for Owner, created 2026-09-25 21:18:59.308287Z when Privacy was opened. Exact cleanup awaits the user: `user_id='81990c03-c41b-4026-ad07-ad82c1ef896d' AND created_at='2026-09-25 21:18:59.308287+00'`.
- One PlaceSectionCache refresh.
- One `LocalProfile` row for Solo, created 2026-09-26 00:36:11.802992Z by `GET /api/identity-center` (ensureLocalProfile) when Identity Center was opened on iOS. Exact cleanup awaits the user: `id='7e511c3f-86e8-4dd1-a16f-d27124870e50' AND user_id='1f13068b-86ef-4085-b0a1-cd5883ac816e'`. Remove Solo from the proxy's LocalProfile allowlist first.
- No scheduling, template, workflow, booking, block, relationship or profile rows. Every block POST was refused before upstream.
- PR455's befores and afters changed auth bookkeeping only. Its inquiry and read-receipt POSTs were refused before upstream.
- **One `Wallet` row for Owner**, created 2026-09-26 02:54:11.62272Z when PR460's Earnings link opened `/app/wallet`. `GET /api/wallet` runs `getOrCreateWallet`, which is existing behavior.
  - Exact cleanup awaits the user: `id='c39b32a7-37d0-42d6-8504-a255fabd8150' AND user_id='81990c03-c41b-4026-ad07-ad82c1ef896d'`.
  - The proxy now refuses `GET /api/wallet` for any caller but Owner.

## New findings and candidates

- **Fixed in PR436:** Booking settings stated invented values, and the Android policy editor could create a bogus business page.
- **Product decision with the user:** workflows and templates are stored but nothing executes them. A = honest copy, B = hide.
- **Handed to Stream 1:** homeowner iOS can't reach You.
- **Mine to fix later:** the Android scheduling Preview sheet (`MessagePreviewScreen`) draws its header under the status bar (Stream 1 asked).
- **Blocked on a published-business fixture (user decision):**
  - S3-66: business share should carry the business's own link. It reproduces on Android too, not only iOS.
  - S3-65: web Unpublish confirm.
  - Related: `pantopus://b/<username>` asks the id-only `/api/businesses/:id` and shows "Business not found". It could not be separated from "unpublished" with the one unpublished fixture.
- **Candidates:**
  - iOS business profile: the Contact / "Hire to review" failure toast is set but not visible, probably behind the floating tab bar. Android shows it.
  - The persona header's "Share profile" opens Block/Report instead of sharing (seen on Android; iOS has the same code).
  - Template editors discard a non-empty draft without confirmation.
  - The Android page DTO types `cancellation_policy` as a String.
  - Auto-created pages default to America/New_York.
  - iOS login "Not you?" with two remembered accounts shows the next one by design (it cleared to blank with one). Product question: clear every hint, or offer "Use a different account"? Pair it with a confirm before the tap revokes that account's stored session, as ContinueAsView already does.
  - The iOS Edit profile footer says "All changes saved · just now" when nothing was saved.
  - S3-56: Android Messages has no pull-to-refresh (reproduced). Deferred to the chat group, which needs conversation fixtures.
  - S3-53 "New chat" and the S3-67 broadcast "⋯" need conversation and Beacon fixtures.

## Next

1. PR455: CI, then Stream 1's review and the next native batch.
2. Needs the user's go-ahead:
   - One scoped zero-cost fixture set in the isolated DB. It now also needs a published business, for S3-66 and S3-65.
   - The two exact-row cleanups: UserPrivacySettings for Owner and LocalProfile for Solo.
   - The fixtures cover S3-50 real edges, 52, 57, 48, 43, 13, 56, S3-47 (no EventType rows exist; the page's reminders match the static text), S3-68 (needs a Beacon persona), S3-69 (a paid invoice) and the S3-51 no-show CTA.
3. Next groups:
   - Waiting on Stream 1's list of unfinished S3 IDs, to avoid redoing merged rows.
   - Fixture-free native: the persona "Share profile" opens Block/Report; the iOS business failure toast is hidden behind the tab bar.
   - Android Preview sheet insets.
   - The remaining chat group (S3-53 New chat, 54, 55, 56) once conversation fixtures exist.

# CURRENT STREAM 3 RESUME SUMMARY — 2026-09-22

This is the current handoff point. It supersedes older opening paragraphs and stale “pending”
wording below while preserving the detailed history and evidence links. Stream 3 is not a whole-app
closure claim; it is ready for coordinator integration review with the explicit open boundaries here.

## Git, application and merge state

- **Application worktree:** `/private/tmp/pantopus-workstream-accounts-social`, branch
  `local/stream3-ios-integration`, `HEAD=b956a00767835586b5114698a3a2e91fbcddefad`. It has
  unrelated existing local web changes in `frontend/apps/web/src/lib/publicShare.ts`,
  `frontend/apps/web/tsconfig.json` and untracked `frontend/apps/web/.next-stream3/`; preserve
  them and do not reset or fold them into Stream 3.
- **Android worktree:** `/private/tmp/pantopus-stream3-android`, branch
  `local/stream3-android-integration`, clean at `HEAD=3b374454ad07060cf5dcaa1ce02fc48b3be4c88e`.
- **Live coordination worktree:** `/Users/yingpengwang/pantopus-coordination`, branch
  `codex/workstream-coordination`; this file is the only live Stream 3 status location. The
  current status commits are pushed to `origin/codex/workstream-coordination`.
- **PR195:** [merged](https://github.com/WangPantopus/skinny-pantopus/pull/195) by the coordinator at 22:05 UTC as
  `86f63a0eaf70dfc808950649aae34ef45015c985` after update to `7f557a0069` and fresh exact-head CI `35786420151`
  (Android lint/test/assemble, emulator tests, schema replay and aggregate CI OK). The earlier head
  `3b374454a` CI `35768401037` also passed. The Android worktree was fast-forwarded (clean) to `7f557a006`.
- **Merged scoped repairs:** PR163 → `e5335f584dd99f82e7c66a3974b04400098f0c0c`; PR168 →
  `b30e0d395`; PR178 mailbox route order → `715ccd8c0`; PR182 profile PATCH contract → merged
  remotely at head `7b6ddc6516769e02d12b6eff37f52fb0d326455e` on 2026-09-22. The older PR182
  paragraph below says “no merge” because it predates that merge; treat this summary as current.

## Grouped implementation repairs and source bindings

- **Cache invalidation:** existing `backend/routes/blocks.js` and
  `backend/routes/neighborMessages.js`; PR163 repaired block/unblock feed-filter invalidation
  without redesigning the cache or schema.
- **Android social safety:** existing
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileViewModel.kt`
  is the sole PR195 production diff. It scopes the personal `UserBlock` visibility guard to Local
  profiles and fails closed when `/api/users/blocked` is unavailable; Persona/Relationship scopes
  remain distinct. The earlier Detekt-only extraction is in the merged PR168 Android path.
- **Profile PATCH contract:** existing `backend/routes/users.js` commits `26fe9d57f` and
  `b956a0076` return the canonical user projection and emit `PROFILE_READBACK_UNAVAILABLE` after
  a write when UserSkill readback fails. No DTO, UI, schema or migration replacement was added.
- **Mailbox:** PR178’s existing route-order repair is integrated; Stream 3 made no duplicate
  mailbox implementation.

## Earlier Stream 3 coverage retained for integration review

The table below groups the earlier merged work and its accepted evidence so the next agent can
continue from the existing implementation and reports rather than repeat the same journeys. The
PR links identify the source revisions; the detailed reports and bundle indexes remain the
evidence of behavior and limits.

| Area and existing source contract | Merged work and retained evidence | Current boundary |
| --- | --- | --- |
| Auth/session callers, web session state, native sign-in and deliberate logout | [PR65](https://github.com/WangPantopus/skinny-pantopus/pull/65), [PR82](https://github.com/WangPantopus/skinny-pantopus/pull/82), [PR136](https://github.com/WangPantopus/skinny-pantopus/pull/136), [PR138](https://github.com/WangPantopus/skinny-pantopus/pull/138), [PR145](https://github.com/WangPantopus/skinny-pantopus/pull/145), [PR149](https://github.com/WangPantopus/skinny-pantopus/pull/149), [PR151](https://github.com/WangPantopus/skinny-pantopus/pull/151), [PR152](https://github.com/WangPantopus/skinny-pantopus/pull/152); retained browser/native evidence covers account-deletion confirmation, unavailable security records, logout/session-expiry feedback, push registration after sign-in, resend verification and iOS deliberate sign-out. | Apple/Google callback, provider cancellation/revocation and physical-device/keychain behavior remain unverified; A01/A02 stay partial. |
| Web social, chat, feed, map, profile, marketplace and Beacon callers | [PR51](https://github.com/WangPantopus/skinny-pantopus/pull/51), [PR64](https://github.com/WangPantopus/skinny-pantopus/pull/64), [PR65](https://github.com/WangPantopus/skinny-pantopus/pull/65), [PR66](https://github.com/WangPantopus/skinny-pantopus/pull/66), [PR67](https://github.com/WangPantopus/skinny-pantopus/pull/67), [PR69](https://github.com/WangPantopus/skinny-pantopus/pull/69), [PR70](https://github.com/WangPantopus/skinny-pantopus/pull/70), [PR73](https://github.com/WangPantopus/skinny-pantopus/pull/73), [PR83](https://github.com/WangPantopus/skinny-pantopus/pull/83), [PR84](https://github.com/WangPantopus/skinny-pantopus/pull/84), [PR85](https://github.com/WangPantopus/skinny-pantopus/pull/85), [PR86](https://github.com/WangPantopus/skinny-pantopus/pull/86), [PR88](https://github.com/WangPantopus/skinny-pantopus/pull/88), [PR89](https://github.com/WangPantopus/skinny-pantopus/pull/89), [PR90](https://github.com/WangPantopus/skinny-pantopus/pull/90), [PR91](https://github.com/WangPantopus/skinny-pantopus/pull/91), [PR93](https://github.com/WangPantopus/skinny-pantopus/pull/93), [PR94](https://github.com/WangPantopus/skinny-pantopus/pull/94), [PR95](https://github.com/WangPantopus/skinny-pantopus/pull/95), [PR96](https://github.com/WangPantopus/skinny-pantopus/pull/96), [PR97](https://github.com/WangPantopus/skinny-pantopus/pull/97), [PR99](https://github.com/WangPantopus/skinny-pantopus/pull/99), [PR105](https://github.com/WangPantopus/skinny-pantopus/pull/105), [PR107](https://github.com/WangPantopus/skinny-pantopus/pull/107), [PR111](https://github.com/WangPantopus/skinny-pantopus/pull/111), [PR114](https://github.com/WangPantopus/skinny-pantopus/pull/114), [PR115](https://github.com/WangPantopus/skinny-pantopus/pull/115), [PR117](https://github.com/WangPantopus/skinny-pantopus/pull/117), [PR178](https://github.com/WangPantopus/skinny-pantopus/pull/178), [PR186](https://github.com/WangPantopus/skinny-pantopus/pull/186); retained browser/API/SQL evidence covers reports, failed drafts, search, profile authorization, chat destinations, feed filters, Beacon links/comments and stale-handle recovery. | Owner-routed Marketplace, Home, payment, booking, wallet and subscription actions remain with their owning streams; provider/native release evidence is limited. |
| Scheduling, reminder preferences and booking notification routes | [PR72](https://github.com/WangPantopus/skinny-pantopus/pull/72), [PR75](https://github.com/WangPantopus/skinny-pantopus/pull/75), [PR77](https://github.com/WangPantopus/skinny-pantopus/pull/77), [PR80](https://github.com/WangPantopus/skinny-pantopus/pull/80), [PR81](https://github.com/WangPantopus/skinny-pantopus/pull/81), [PR101](https://github.com/WangPantopus/skinny-pantopus/pull/101), [PR103](https://github.com/WangPantopus/skinny-pantopus/pull/103), [PR120](https://github.com/WangPantopus/skinny-pantopus/pull/120), [PR126](https://github.com/WangPantopus/skinny-pantopus/pull/126), [PR129](https://github.com/WangPantopus/skinny-pantopus/pull/129); retained worker/source, retry, preference, local SMTP and paused-host evidence is indexed in the N05 sections. | No claim of a settled daily-agenda producer/recipient/channel policy or physical delivered reminder; natural-timer evidence remains bounded to the recorded local run. |
| Native notifications, Pulse/Beacon and profile safety callers | [PR164](https://github.com/WangPantopus/skinny-pantopus/pull/164), [PR165](https://github.com/WangPantopus/skinny-pantopus/pull/165), [PR166](https://github.com/WangPantopus/skinny-pantopus/pull/166), [PR167](https://github.com/WangPantopus/skinny-pantopus/pull/167), [PR168](https://github.com/WangPantopus/skinny-pantopus/pull/168), plus the open [PR195](https://github.com/WangPantopus/skinny-pantopus/pull/195); retained installed-emulator evidence covers N01 local notification controls and local social identity/follow/post/reply/mute boundaries. | N02 still needs physical Android notification acceptance; N01 release/device states, N03 release-candidate cohort, and wider N04 native/socket/provider lifetime remain open. Emulator evidence is local/emulator evidence only. |
| Block/unblock cache and safety endpoints | [PR163](https://github.com/WangPantopus/skinny-pantopus/pull/163) retained the existing `blocks.js`/`neighborMessages.js` contracts and real browser → HTTP → PostgREST/SQL cache evidence. | Hosted moderation/provider processing and remaining entry-point/socket coverage are not claimed. |
| Profile persistence and provider-backed storage/address boundaries | [PR182](https://github.com/WangPantopus/skinny-pantopus/pull/182) retained the existing `users.js` PATCH contract and installed 503→200 readback retry; A03/A04 retained chooser/S3 failure and address-provider-unavailable UI/API evidence. | Hosted storage success/lifecycle and activated Smarty/geography/unit success remain unverified; the A04 literal `%20` street fixture is explicitly not a geography-success claim. |

## Evidence and runtime bindings

Durable evidence is at
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream3-native-social-r1`.
The verified bundle has 198 files and MANIFEST SHA-256
`1fa796d1b6f08e89b549f0aadf0f6986241fbd511184ff2825dc889071957f26`; raw logs, credentials,
tokens and database archives remain outside Git/chat. Operational receipts are under
`/private/tmp/pantopus-stream3-20260920-r1`.

Accepted real boundaries include: PR163 web screen → HTTP → PostgREST/SQL cache behavior;
installed Android notification list/filter/read/delete/Cancel/offline rollback/retry and induced
HTTP-5xx rollback/retry; Android local-neighbor block → Settings → fresh deep link with fail-closed
blocked-list read fault; Pulse/Beacon/follow/post/reply/mute and identity separation; A03 chooser →
real multipart portfolio upload reaching the existing S3 credential failure with zero File rows;
A05 installed profile PATCH 503 preserving two unsaved values → same-form 200 retry; A02 cold-process
session restoration and logout; and A04 route plus installed Add Home provider-unavailable result,
retry, draft preservation, disabled continuation and discard/logout.

Source/APK/device bindings: Android repair source head `3b374454a`; installed repaired APK
SHA-256 `2728688a30a78449c990c302ebc72053802322772a990e7a3a6030e2265d504a`; earlier retained
notification APK SHA-256 `83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`;
Android device `emulator-5554`; retained iOS simulator `Pantopus Stream3 Social R2`, UDID
`0AE16FA0-E244-414F-86C8-24893BDFD979`. Intended local ports are API `18130`, Next `18131`,
SQL/Postgres `64532`, PostgREST `64531`, Mailpit `64535/64536`; API and Next are currently stopped,
while the retained local Supabase/Mailpit containers remain available for an assigned runtime.
The N03 release-build/native slot has not been reassigned and no build should start here.

The current native bundle above is authoritative for the latest installed work. Earlier retained
indexes remain applicable where their source/configuration is unchanged: the 20260915 social
bundle [current MANIFEST](../../../skinny-pantopus/.pantopus-recovery/audits/20260915-stream3-social-r2/MANIFEST.json) is `f5ac697ba9f06552aeda14b1bbfa01f4b795779817bcf4f9bbe1e368956bac13`; the
20260920 accounts/social [current MANIFEST](../../../skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/MANIFEST.json) is
`09b2c346c28031033c2943bacfb85ae7ae54b5cba4bef232df18b039b210971c`. These are file hashes re-read
at consolidation; older a6534761/cca38fc2 values below identify earlier bundle snapshots, not
the current manifest bytes. Earlier artifacts keep their own original source and runtime limits.

Fixture cleanup is recorded: N03 block/home/occupancy/overlay counts zero; N01 local/emulator HTTP-5xx target
removed after successful retry; A03 Bob File rows zero after S3 failure; A04 temporary HomeAddress,
Home and AddressClaim rows zero; A05 Bob first/last/middle/bio restored, zero UserSkill rows and
privileges restored; every exercised account logged out and local API processes stopped.

## Current authoritative acceptance accounting

The exact quoted N01–N05/A01–A05 criteria and evidence mapping are in the “Exact ten-row acceptance
mapping for next handoff” section below. Current state is: N01 release/device notification states
remain partial; N02 physical Android remains open; N03 release-candidate Pulse/Beacon cohort remains
open; N04 moderation processing, wider entry points and full native/socket/provider lifetime remain
open; N05 daily-agenda delivery has no settled producer/recipient/channel policy; A01 external
Apple/Google callbacks remain open; A02 provider/device revocation combinations remain open; A03
hosted storage success/lifecycle remains open; A04 legitimate unavailable handling is accepted but
activated Smarty/geography/unit success remains open; A05 owner-routed Marketplace/subscription/
booking/wallet/mail/search/Home/payment actions remain open. Unit-test coverage is excluded from
these functional/evidence estimates and no new unit tests were written.

## Next actions and explicit non-actions

PR195 is merged (`86f63a0ea`). **Assigned next (coordinator, 22:45 UTC): iOS parity of the PR195 defect.** iOS
`PublicProfileViewModel.loadRelationship(id:)` reads only `/relationship` and leaves `canFollow` true on error.
Reproduce on installed iOS `0AE16FA0` first, then mirror PR195 minimally (Local scope only) only if it reproduces. The heavy
native slot goes to Stream 3 next; details are in the coordination summary's current resume point. The next agent may
use the exact prerequisites in the final section below, preserve accepted reports, and repair only a
reproduced defect in the existing caller/endpoint/service contract. Do **not** rerun the accepted
PR163 cache journey, PR168 Detekt repair, PR195 local block/read-fault journey, N01 local/emulator
notification matrix, A03 S3 credential failure, A04 provider-unavailable variants, A05 profile
503→200 retry, or A02 cold-process pass. Do not start a native build without the reassigned slot;
do not activate providers, purchase services, run hosted migrations, add schema, redesign UI, add
unit-test files, or merge independently.

Known boundaries/inconsistencies are deliberate: the A04 UI used literal `%20` street input from
ADB, so it does not claim normal geography success; the installed APK is debug, not release
candidate; green PR195 CI does not claim skipped backend/web/iOS jobs; and historical sections below
retain their original timestamps and limits.

# Stream 3 — Accounts, social and notifications

Current September21 10:33UTC: approved isolated natural scheduler check completed
and exact fixtures/messages cleaned; final evidence/limits appended below. Prior
source-only/pending paragraphs are historical. Stream remains incomplete; unchanged
b409 source and retained runtime preserved, no new application edits.

Updated September21 — **Stream incomplete; ongoing verification.**
Sole live status remains this neutral coordination file. No new unit tests written.
Application `/private/tmp/pantopus-workstream-accounts-social`, separate branch
`codex/stream3-scheduler-reconciliation` at released master
**b409bc9190dd43bbdcee0cdba8f307ae959d2dc3**, tracked clean plus owned .next-stream3.
Coordinator integrated PR120 as246407e8e, PR121e61cffed6 and docs119→b409 after exact
gates. All earlier feature refs preserved. Current assignment source-only N05 scheduler/
daily-agenda reconciliation, no new runtime or application edit. Retained API18130/PID7996
was started before this source-only adoption; Next18131/PID14742 and Supabase64531–37
remain reserved. No natural scheduler test yet, no native/provider/full-stream closure.

## N05 scheduler/daily-agenda source reconciliation and isolation proposal

Source-only README assignment followed. Seven current/master/paid/staging/place/Beacon/
originalfc99 revisions map jobs/index.js, bookingReminders, schedulingNotifyPrefs,
bookingNotifyService and web notificationPrefs. All register bookingReminders with
real node-cron UTC3,18,33,48 * * * *; neither pg-boss nor Lambda exclusion set includes
it. app.js starts jobs after listening unless CRON_ENABLED=false; test environment skips.
Installed node-cron4.2.1. Retained local runtime CRON_ENABLED/PGBOSS_ENABLED=false,
SMTP127.0.0.1:64535. No environment changed or jobs activated.

Worker first globally completes past confirmed Bookings, then scans confirmed bookings.
BookingPage.reminder_minutes precedes host reminder_lead_times; current <=8minute early
allowance/120minutecatchup/up-to30day offset and booking/kind receipt remain. Host
notify_me.reminder gates existing notification; invitee savednotification/email is separate.
Accepted earlier manual-worker/SQL/localSMTP/offset/retry/cancellation evidence remains
valid but does not establish natural registration execution or whole-app startup.

Web daily_agenda row promises each morning8am in all7refs, with no backend daily-agenda
keyword consumer found. Current iOS/Android explicitly label existing booking_request
as Booking request after older misleading Daily agenda copy. This is a separate unresolved
contract, not proof that an implementation is absent or authorization to build a digest.
No native execution or worker pause/hostemail/attendee/daily-agenda delivery acceptance.

Proposed natural-cadence check, **not started; coordinator approval pending**:
private child loads unchanged jobs/index.js; allow only wrapped jobName bookingReminders
through to real node-cron, record/skip other registrations. Fail-closed transport query
isolation adds exact temporary Booking id to every Booking read/PATCH, including completion
sweep. One future owned temporary booking uses existing read-only account/page/event;
real wall clock waits for next original UTC tick, no manual invocation/time advance.
Observe callback/ownedlog+notice/localSMTP, stop task after completion, verify original
retained rows unchanged and no unexpected additions, clean exact new IDs. Isolation
wrappers are synthetic boundaries: natural selected-job timing only, not unmodified
all-jobs app startup or hosted provider delivery. Alternative emptyDB/PostgREST expansion
would need new runtime assignment/replay; not acquired. Never enable all cron on retainedDB.

Private scheduler-source-reconciliation.json contains exact revision/sourcehash map;
mirror now495files, allhashverified, MANIFEST **c73d600dc87b9d4f140feaad01dda2422e0a2fb64a5799c5a087da3b81c1e2fb**.
No app/harness/fixture/schema/provider mutation, no new tests or repeated acceptedjourney.
Next: coordinator reviews contract/isolation before any runtime expansion; continue to
preserve N01–N05/A01–A05 platform/provider/session limits below.

## Scheduling Resume persistence — PR120 handoff

Exact component-only grant recorded README661ada630 after real no-PUT/unchangedSQL/
reloadbaseline. Seven existing/archive/open Resume callbacks identical. Only existing
NotificationPrefsForm changed: import existing readGroup, derive paused from existing
prefs, call existing serialized persist with scheduling spread/paused:false. Existing
rollback/owner generation handles the banner along with all preferences. Normal controls,
layout and navigation preserved; no backend/SDK/schema/newfile/unit test/worker edits.

Actual Bob GoTrue/browser(tab18)→SDK→existing preferencesPUT→PostgREST/SQL:
UPDATEdenial then two keyboardResume attempts produce500 at09:24:03.952 and09:24:27.828;
paused banner/disabledcontrols return and originalJSON remains exactlyunchanged. Restore
UPDATE, keyboardretryPUT200 at09:25:02.544 saves paused:false, preserves nestedhost channels,
notify_me.reminder and unrelated sentinel key. Fullreload no pausedbanner/Resumebutton,
reminderpush/email remainenabled. This verifies persisted Resume state, not paused worker
or notification delivery. SQL seeded pausedfixture; no pause-creationUI claim.

Installed TypeScript --noEmit and scopedESLint both exit0/emptylogs; diffcheckpass.
No new unit tests. Reuse unchanged PR103 read/save/retry and reminder-offset evidence;
no broad suite repeats. New intact held-response account-switch/departure/native checks
not performed; current owner-generation/serializedqueue behavior reused unchanged.
No SMTP/provider/worker execution or pause-delivery policy expansion.

Cleanup: exactabf9180d-de0c-4251-af8d-9a0801f616ba removed, originalBobpreference
absence0 restored; UPDATEgrant restored, tab18closed. Original bookings/page/otherfixtures
untouched. Private scheduling-resume-final-evidence.json binds5sourcehashes, comparison,
baseline,failedwrites,savedJSON,actualUI/fullreload,checks/cleanup/limits. Durable
**493files** hashverified, MANIFEST
**01c10c465af654c5d6220bdb808dd365afc88f0bad15d2f629ac482c070e133d**
in existing accounts-social-r3 mirror. Older artifacts retain ownsource/runtime limits.
Next: exact120CI and coordinatorreview; featuremerge held behind paid a795 fullCI35582693975.
Whole N01–N05/A01–A05 provider/native/session/delivery acceptance remains open below.

## N05/A05 Scheduling Resume — actual baseline, no application edit

README granted existing NotificationPrefsForm/PauseBanner runtime-only verification.
Actual Bob real GoTrue UI /app/scheduling/settings/notifications loaded saved
SchedulingNotificationPreference.prefs.scheduling.paused=true: banner and disabled
matrix. Keyboard Resume hides banner/enables controls; HTTP log records no preferences
PUT, and SQL JSON remains exactly unchanged including paused=true. Full reload restores
the banner/disabled controls. No worker/SMTP/provider execution or delivery-policy claim.
State was SQL seeded; no pause-creation UI claim. PR103 key retention/read/save/retry
and prior reminder offsets/delivery evidence reused within their unchanged boundaries.

Existing screen→SDK get/updateNotificationPreferences→scheduling.js GET/PUT
/notification-preferences→existing preference JSON contract traced. Seven current/master/
paid/staging/place/Beacon/originalfc99 Resume callbacks identical and local-only.
Proposed smallest existing component repair: call existing serialized persist with
nested scheduling spread/paused:false, derive banner state from prefs so existing
optimistic/confirmed rollback and owner generation retirement apply. Assignment pending;
no app edit/new file/test/schema/worker/global notification policy change.

Exact temporary preference **abf9180d-de0c-4251-af8d-9a0801f616ba** removed; original
Bob preference absence restored0. Unrelated keys stayed unchanged, no privileges changed,
tab17closed. Original booking/page/fixtures retained; no peer runtime touched.
Private scheduling-resume-fixture.json, after-click.json, baseline.json and source-
comparison.json bind source, original state, HTTP/SQL and actual UI history. Durable
**486files** hashverified; MANIFEST
**09b13897635dfc265f6a5941a715ef02e7db102bf28f042677840b968eee6349**
in existing accounts-social-r3 mirror. Latesthead does not rebind older evidence.
Next: coordinator component-only proposal review; if granted, actual UPDATE failure/
rollback/retry, persisted Resume/fullreload and unrelated-key preservation. Worker pause,
channel delivery and native/session-held-response acceptance remain separate/unverified.

## Private professional blocked-housemate repair — PR117 handoff

Granted only canViewProfessionalProfile after actual private active housemate200 under
either-direction blocked Relationship. Seven current/master/paid/staging/place/Beacon/
originalfc99 helper variants identical. Existing getProfileVisibility checks block before
shared-home access. Move existing professional block guard after self/inactive guards
and before public/private branches:1added/2removed lines, other helpers/scopes unchanged.
No new file/service/schema/middleware/UI/unit tests or presentation change. PR117 stacks
on115 because its actual viewer identity wiring is required; do not merge ahead of115.

Actual local GoTrue HTTP→PostgREST/SQL **10housemate cases pass**: legitimate active
private housemates200; both block directions403/error-only; blocked inactive/ended403;
Relationship SELECT denial500, restored retry403; unblock restores200; unblocked inactive
and ended occupancy403. Twenty focused affected owner/public/private/bearer/cookie controls
also pass after the guard relocation. Existing115 evidence retained separately; no broad
suite repeats. Existing2suites37tests, syntax/diffcheckpass. No new unit tests.

HTTP/SQL-only; temporary Home/occupancy/profile/relationship states SQL seeded, no screen
invented or native/provider/home-UI acceptance. Candidate artifact records precommit e47
plus working-tree helper; final3sourcehashes bind exacte729. Other helpers, shareHome query
failure semantics, session lifetime and safety-scope policy were not expanded.

Cleanup: candidate5exacttemporary rows removed, original Home/HomeOccupancy/
UserProfessionalProfile/Relationship counts0 restored, RelationshipSELECT restored,
auxlogout200. Affected20control phase2exactrows removed/originalprofile/relationship0,
6auxlogout200. ExactIDs/results in professional-housemate-candidate-results.json and
professional-housemate-affected-controls.json; earlier baseline separatelycleaned.
No original retained fixture or peer resource mutated. Owned runtime stays reserved.

Private professional-housemate-final-evidence.json binds3sourcehashes,7refcomparison,
baseline,10+20actualcases,checks/cleanup/limits. Durable **481files** hashverified;
MANIFEST **7393d99b7f073b66c75a9e54893a3ce0e0fa69ea4a799f278234a94770357ec9**
in existing accounts-social-r3 mirror. Earlier artifacts retain actualsource/runtime;
latest head is not blanket rerun. Coordinator owns review and eventual integration,
currently held behind paid fullCI. Next: exact117CI/handoff; preserve114/115 refs.
Broad N01–N05/A01–A05 native/provider/session/delivery limits remain open below.

## Professional public viewer identity — PR115 handoff

Separate README grant limited to professional.js GET /:username optional identity.
Six current/archive/open route tails identical, viewerId alwaysnull. Actual prior
blocked-public200 and accepted-private404 baseline already cleaned. Existing optionalAuth
middleware plus req.user identity now reach existing canViewProfessionalProfile; only
3added/2removed lines. No helper/middleware/global-auth/UI/schema/newfile/unit test change.
Branch independently based721d; PR114 source/ref untouched.

Actual local GoTrue bearer and cookie login→HTTP→PostgREST/SQL **20cases pass**:
blocked public both transports403, reverseblock403, owner200, anonymouspublic200;
Bearer blocked viewer wins over another owner's cookie. Relationship SELECT denial
returns500 for authenticated nonowner, owner/anonymous existing policy unaffected;
restore retry403. Private accepted connection both transports200, owner200, unrelated403,
anonymous404; relationship lookup500 then restore200. Inactiveowner404/missing404 unchanged.
No current public screen caller: explicitly HTTP/SQL-only; records SQL seeded, not UI
creation. Housemate/private helper-policy expansion and installed native remain unverified.

Two first cookie attempts accidentally used bearer-mode login (deliberately clears
cookies); not an app regression. Preserved attempts are excluded from cookie acceptance.
Corrected run requests x-token-transport:cookie, checks actual nonempty issued cookie and
absence of tokens in JSON; both transports then pass. Diagnostic and final sessions
logged out. Existing optionalAuth/visibilityPolicy suites37/37, syntax/diffcheckpass.

Final exact temporary IDs and six logout200 receipts are in
professional-auth-candidate-results.json; both original UserProfessionalProfile[] and
Relationship[] restored, RelationshipSELECT restored. Earlier failedattempt rows also
removed finally. No other fixture changes. Original retained profiles/posts/memberships
unchanged; owned runtime retained. No external provider/native activity.

Private professional-auth-final-evidence.json binds4sourcehashes/comparison/baseline/
corrected20cases/checks/cleanup/limits. Durable **470files**, all hashes verified; MANIFEST
**c5c01720b601f776e3aad1f26388d963530992261cf6ef3ac08076a5c8e694bc** in existing
accounts-social-r3 mirror. Includes final114CI; older artifacts retain own revision and
runtime, latest head not blanket rerun. Coordinator owns integration after current batch.
Next: exact115CI/review handoff; preserve114. No helper expansion without reproduced
case/assignment. Continue original whole-stream inventory; broad native/provider/session
and reminder-delivery limits remain open. Local expiry-origin/CORS lead stays separate.

## Professional self-editor load recovery — PR114 handoff

Exact README sole-writer grant: existing web professional/page.tsx load/error/retry only.
Actual prior saved-profile SELECT500 produced enabled create form; seven current/archive/
open variants had identical page/helper bytes and released721d page hash also matches.
Reuse page plus existing ErrorState. Add load error/retry before normal modes and a load
request counter retired by cleanup/new request; confirmed absence still enters create.
Current QueryProvider remounts component-local state on session generation change. No
new application file, backend/schema/service/unit test/public-route edit or redesign.
Normal view/edit/create forms and navigation unchanged.

Actual authenticated Bob browser→SDK→HTTP→PostgREST/SQL: saved fixture headline displays;
actual SELECT denial500 shows ErrorState/Try Again without creation controls; repeated
keyboard retry stays error; restore SELECT and keyboard retry200 restores same headline.
Full saved row compared unchanged. Exact fixture removal then fresh reload200 confirms
absence and preserves original creation form. No create/update/verification submitted.
Creation state itself was SQL seeded, not UI creation acceptance. Browser tab16closed.

Scoped ESLint passes0errors/4existing warnings. Direct installed TypeScript compiler
passes exit0/no output, diffcheck passes. Initial npx selected the wrong tsc package,
failed, and is excluded as validation; corrected direct compiler is the accepted run.
The pre-existing ts-nocheck remains, so no full static coverage claim for this page.
No new unit tests or repeated broad suites. Request retirement/session isolation is
source-reviewed here; intact held-response account-switch/native/offline acceptance
remains unverified. Public-profile optional-auth defect remains separate HTTP-only.

A local expired-session attempt redirected from stream3-auth.localhost to localhost
/session/refresh and hit CORS. Ordinary real login on the configured isolated origin
recovered and returned to /app/professional. No auth/config change; record this runtime
boundary separately from the profile loader and do not claim expiry continuation success.

Cleanup: exact candidate e3cd7ca0-7858-4f80-8c14-d68d327b5baf removed; original
UserProfessionalProfile[] restored and SELECT restored. Original retained fixtures intact.
Private professional-self-final-evidence.json binds5sourcehashes, released baseline,
actualUI/SQL/HTTP log, row comparison, checks and limits. Durable **461 files** all hashes
verified in existing accounts-social-r3 mirror; MANIFEST
**2e1e18fb7dd7503dfcd12bd8c974bdbb8f9c9e9517d6cc47e5db393580f05d81**.
Each older artifact retains its own revision/runtime; latest head is not a blanket rerun.
Next: finish exact CI/review handoff; coordinator holds merges during paid full CI.
No new public route/auth/shared repair without assignment. Continue independent coverage
reconciliation against the original inventory; provider/native/session limits remain open.

## Legacy Relationship read failure — PR111 handoff

Coordinator granted only existing getRelationshipStatus after actual Bob Beacon UI
exposed Dana under Relationship SELECT denial despite a saved blocked relationship.
Seven current/master/paid/staging/place/Beacon/original fc99 variants have identical
helper bytes: query errors ignored and exceptions converted to none. Reuse the existing
helper with maybeSingle, checked error propagation, and no catch-to-none. Preserve
successful absence, self/missing-input and existing status/direction mappings. No new
file/service/schema/UI/policy/unit tests. Fast-forwarded this separate branch to merged
PR107/master4e69 before repair; frozen earlier refs untouched.

Actual real local GoTrue/browser/Next18131/API18130/PostgREST64531/SQL64532:
saved blocked row hides Beacon; actual SELECT denial yields existing unavailable/Retry
search with no search result; restored permission and keyboard Return retry keeps it
hidden; exact block deletion plus fresh reload restores the original Beacon. Tab14
closed afterward. Relationship creation itself was SQL-seeded, not UI acceptance.

Eleven affected HTTP reads (public/local identity search, users search and three profile
variants, four LocalProfile variants, relationship status) return error-only500 under
lookup denial. Follow POST500 leaves full UserFollow and Notification table snapshots
unchanged; healthy blocked follow403. Actual SQL status transitions plus HTTP verify
blocked in both directions, accepted→connected, pending_sent/pending_received, successful
absence→none and self→none. Restored public search200 returns original result. Non-Beacon
callers are HTTP-only. Existing58 tests across3 suites pass; syntax/diffcheck pass.

Caller review: users profile/search visibility and identity/local search use existing
helpers; follow check occurs before insert/notification; relationship GET has existing
500 catch. relationships.js helper imports unused. Professional helper call currently
has always-null viewerId and is a separate unmodified source lead. Chat/socket use
separate blockService and are untouched. No installed native, socket, hosted provider,
offline, intact session-race or whole N03/N04 acceptance from this milestone.

Exact temporary **14e37cd2-5d12-45e7-a043-fcc123c037e7** removed, original Relationship[]
restored and SELECT restored; auxiliary real auth session logged out200. Original other
safety tables, profiles, posts and memberships retained. No failed-follow insert/notice.
Private relationship-read-final-evidence.json binds source hashes, comparison, actual
baseline/UI, HTTP mappings/effects, checks and cleanup. Durable **448 files** hash-verified
in existing `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/`;
MANIFEST SHA256 **cca38fc28830dcfad59513da6062a496b44576974d61d032033de70cb7b1926a**.
Each older artifact retains its own source/runtime limits; latest review head is not a
blanket rerun. Coordinator review and exact-head CI/integration remain pending.

Next: finish PR111 gate/handoff without duplicating CI; continue independent existing
inventory journeys. Professional optional-auth source lead requires actual reproduction
and a fresh route grant before repair. Broader notification/provider/native/session and
reminder delivery limits in the whole-stream table remain open. Stream2 owns homes.ts
and HomeSettingsTab save contract; leave untouched. Root completion upload runtime
18132/18133/64561–67 and f9200360 fixtures are separate and untouched.

## Post-PR111 runtime-only professional findings

Coordinator captured prior live03 SHA9a4e4ece in05fa6f0b9 and released status writer.
PR111 exact36fb automaticCI35574234363 independently confirmed SUCCESS; private
relationship-read-ci-final.json records exact head/jobs. No new source change.

Granted isolated runtime-only follow-up reproduced existing self-editor failure:
actual Bob web /app/professional displays SQL-seeded active profile headline;
UserProfessionalProfile SELECT denial yields backend500 but UI switches to enabled
Enable Professional Mode/create form, with no load error or retry. Restore SELECT
and reload returns the same saved headline. No create/update/verification clicked.
Proposed existing-page load-only error/retry repair awaits coordinator assignment;
no new application edits. Backend /profile/me already propagates query error; current
iOS/Android source handles500 as error. Old catalog missing-native-enable/disable
claims are stale against current source; no rebuilding or new native acceptance.

Separate HTTP-only /api/professional/:username baseline: real authenticated Bob with
saved blocked Relationship still receives Dana public profile200; accepted relationship
with private profile incorrectly gets404. Anonymous public200/private404 controls.
Existing viewerId always null bypasses canViewProfessionalProfile. Web and iOS public
endpoint definitions found, no current public-screen caller found. Do not invent a
screen or claim UI coverage. Future route repair requires separate scoped grant.

Cleanup: Dana profile3e7c651d-85bb-4ae5-a6e1-9bb0c994514a and relation
dbb2ea03-9ec6-404c-ba56-0c0ac193378d removed; Bob self profile
e3cd7ca0-7858-4f80-8c14-d68d327b5baf removed. Both tables restored to original[];
UserProfessionalProfile SELECT restored, auxiliary session logout200, tab15closed.
Original retained fixtures untouched. Private professional-auth-baseline.json and
professional-self-baseline.json distinguish HTTP/UI/SQL-seeded boundaries.
Durable mirror now **453 files**, hashes verified; MANIFEST
**01efc9daef3b4b90cb94109517d811a1c7899ae399f6359f7b19db77b0c53e5d**.
Previous448 manifest remains the coordinator-reviewed PR111 evidence snapshot;
new files add finalCI and next baseline findings, not changed implementation.

Previous local branch codex/workstream-accounts-social preserved atafe8d2f4c; its remote
primary branch remains21b93aa62. Do not push later milestones into that old ref.
Coordinator requested explicit commit pushes for the later independent milestones:

| Milestone | Branch / head | Review / current CI |
| --- | --- | --- |
| Beacon comment/privacy/drafts | codex/workstream-accounts-social / 21b93aa62 | [Draft PR70](https://github.com/WangPantopus/skinny-pantopus/pull/70), base master. Prior CI35546207895 failed all three iOS test jobs; iPhone16 log confirms four assertions from the expired September17 booking fixture. Reused accepted paid9ecf66fc7/9ae1edb3b as b30f4b330/07827d2b0, identical final fixture bytes. Exact078 CI35547834908 all applicable green. Strict branch protection required docs-only master e8b49c963 merge in isolated checkout→21b93aa62. Diff exactly5docs, backend/frontend/supabase bytes unchanged. Exact21b required CI35549733796 all15 applicable/aggregate green. Coordinator merged PR70 as358daaa17068ebbb6c9591b13bf0378cea7d02b1 at01:39:03Z; no UI rerun for docs. Detached owned /private/tmp/pantopus-stream3-pr70-ci is clean; runtime checkout untouched. |
| Reminder receipt/destination | codex/stream3-booking-reminder-retry / cbfba3503 | [Draft PR72](https://github.com/WangPantopus/skinny-pantopus/pull/72), stacked on remote PR70 branch. Exact-head CI35547400223 CI OK/all applicable green; native/web skipped by paths. Two-file source reviewed by coordinator. |
| Personal posting/draft recovery | codex/stream3-personal-post-recovery / 423176969 | [Draft PR73](https://github.com/WangPantopus/skinny-pantopus/pull/73), stacked on PR72 branch. Exact-head CI35547412275 CI OK/all applicable green, including web/identity E2E; native skipped. Five-file source reviewed by coordinator. |

All three attached to this task. Author did not merge. Retarget master only after
prerequisites merge; do not push later commits into PR70 or conflate another stream's
CI with this one. Coordinator asked to finish these bounded handoffs before a new
application scope. Independent evidence/inventory continues.

## N03/N04 unavailable scoped block check — PR107 handoff

Coordinator separately approved temporary UserProfileBlock search_only verification,
then granted only existing visibilityPolicy.js isScopedBlocked after actual exposure.
Normal real BobUI search hidDana's publicBeacon; denyUserProfileBlockSELECT and a new
search exposed it despite savedblock. Existing followingrow remains visible by current
search_onlypolicy. Five current/master/paid/staging/Beacon helperhashes identical and
ignored queryerror. Reuse existinghelper; destructureerror andthrow it. No newtable/service/
UI/policy/test or merging of UserBlock/UserProfileBlock/PersonaBlock/Relationship scopes.

Actual candidate realGoTrue/browser/API/PostgREST/SQL: identical deniedblockread produces
existing searcherror/0resultlinks; restoredgrant+Enterretry confirms0matchingresults while
blockpersists. Exactblockremoval thenfreshreloadsearch restorespublicBeacon.
Ten affected REST callers (identitysearchpublic/local, userssearch/id/username/compatibility,
localprofile/detail/activity/gigs/listings) underdenial all500 with onlyerror/no targetdata.
Restorednormalblock:3searches200empty,3userprofiles403,4localroutes404. Selfprofile200 and
anonymouslocal200 retain existingpolicy. Non-Beacon caller evidence is HTTP-only.
Reverse search_only0, business_context search1, reversefull0, removal1 confirmedHTTP;
no otherblockscope rowschanged. No socketcaller tothishelper found.

Existing3suites/58tests pass (visibilityPolicy,identitySearch,identityFirewallPrivacy),
syntax/diffcheckpass. No newunit tests. LegacyRelationship lookup error remains a
separate unverifiedlead; broadvisibilityrefactor/native/offline/provider/sessionrace
notaccepted. Source/publicpresentation/policy otherwiseunchanged. N03/N04 remainopen.

Cleanup: temporary7a00181d-f20e-45b0-bb22-6ce114f28985 removed both baselineandcandidate,
originalUserProfileBlocktable[] restored, SELECTrestored, auxiliarysessionslogout,
actualnormalUIrestored/tab12closed. Originalprofiles/posts/memberships/blockfixtures
preserved; authaudit/sessioneffectsretained. Private search-block-final-evidence.json
binds4sourcehashes, fivevariantcomparison, actualbaseline/UI/10route/scopedcontrols,
checks/cleanup. Durable440files hashverified, MANIFEST
**ba7611c262e30585b6a8ebb8ed5c8b4958fc344dce5dea1c078c661181bf20e8**
in existing accounts-social-r3 mirror. ExactCI35572584966queued; coordinator ownsreview,
retarget afterPR105integration and merge. Prior103/105/101refs remainfrozen.

## N03 Beacon/profile search errors — PR105 handoff

Actual Bob directory searchstream3 returned original publicBeacon. PublicPersonaSELECT
failure then newstream3-localquery returnedHTTP200/empty and false No public Beacons
matched. Five current/master/paid/staging/Beacon searchTableFields helpers identical:
Promise.allSettled rejections/queryerrors ignored. Coordinator granted only existing
identitySearch.js helper; replace two continues with throws, reusing route500 and existing
UIerror/Retrysearch. No UI/design/schema/service/newfile/tests or ranking/privacy change.

Actual candidate web→realGoTrue→HTTP→PostgREST/SQL: deniedPublicPersonaSELECT now500,
explicit unavailable/Retrysearch; restoregrant+Enterretry gives originalpublicBeacon.
Genuineabsentquery200 remainsNoMatches. One field's synthetic403 with otherqueriesreal
causeserror; Enterretry200 recovers. Earlier one-shot503 ended200 and is excluded from
error-state proof (transient recovery, not persistent field failure acceptance).
Unchanged following-list actual PersonaMembershipSELECTdenial shows expliciterror;
restore+Enterretry returnsoriginalBeacon, so no followingrepair. Prior follow/unfollow/
privateidentity/link evidence reused within source limits, not repeatedwholesale.

Affected scopes realauthenticatedHTTP: public200/onepersona, local200/oneLocalProfile,
combined200/both, genuineempty200; LocalProfileSELECTdenial local500+combined500,
restoreretrylocal200, shortquery400. Localprofile scope is HTTP-only, not new UIacceptance.
Existing identitySearch10/10, syntax/diffcheckpass. No newunit tests. Native/hostedprovider,
broader access-change/stale-session and other helper privacy-read errors remainoutside
this bounded repair. No wholeN03/A05 closure.

Cleanup: no applicationfixture rowscreated/modified; PublicPersona/PersonaMembership/
LocalProfile SELECTrestored, singlefieldfaultconsumed, auxiliaryauthsessionlogout200,
tab11closed. Originalprofiles/posts/membership retained; authaudit/sessioneffectsretained.
Private beacon-directory-final-evidence.json binds4sourcehashes, comparison/baseline/
actualUI/HTTP/fault/checks/cleanup limits. Durable429files hashverified; MANIFEST
**2f963c5541e66437d00b8bd1c569492f77e790a9eb025dda820e84b1df952551**
in existing accounts-social-r3 mirror. ExactheadCI35571949622running; coordinator review
and integrationpending. Do not alter frozenPR103/101 refs or repeat acceptedjourneys.

## Scheduling channel preference retention — PR103 handoff

Granted getPrefs-only in existing schedulingNotifyPrefs.js. Actual A4 host Reminder
sent—Email on →PUT200 at06:57:44.741→SQL scheduling.host.reminder_sent.email=true,
but actual reload off. Existing helper returned only three canonical fields, dropping
stored scheduling choices. Five current/master/paid/staging/Beacon comparisons confirmed
same omission. One-line spread preserves own stored keys before existing canonical
normalization; no new file/UI/schema/worker/channel-delivery policy or unit tests.

Actual candidate browser on real BobGoTrue/Next18131/app18130/PostgREST64531/SQL64532:
reload existingtrue shows on; saveCancellationEmailoff preservesReminderEmailtrue.
Actual UPDATE denial500 leavesSQLtrue, existing UI rolls back and repeated failure
shows explicit Unable to save notification preferences error. Restoregrant, Enterretry
savesfalse; reloadshows reminderfalse/cancellationfalse. Direct authenticated GET matches;
separate real EvanGET200 has no Bob scheduling data. Canonical defaults remain. No new
intact-held-response crossaccount UI claim; unchanged queue/lifetime source evidence reused.
Existing scheduling26/26 and syntax/diffcheckpass; no newtests.

Cleanup: originalBob snapshot was empty (no preference row), not an existingrow.
Removed exact UIcreated61338118-5cb8-4c59-8819-30b3a1fb2e97; Bobrowcount0 restored,
UPDATEgrantrestored, auxiliaryHTTPsessionsloggedout, tab10closed. First cleanup parser
assumed a row and failed before anywrite; corrected absence restoration is final proof.
Original booking/page/otherfixtures unchanged; no worker/provider/mail executed here.

Private scheduling-channel-final-evidence.json binds4sourcehashes plus comparison,
baseline/savedSQL/HTTPcandidate/denial/retry/cleanup/checks. Durable419files hashverified,
manifest **7d966c8b3261da236ed1e8196fc6810ace890192e01f708eac5537f3b3cd295a**
in existing accounts-social-r3 mirror. CurrentPR103CI35571103116queued; review and
integration pending. Persistence/readback only: hostemail/attendee/dailyagenda/pause
actual delivery and policy remain open; no native/hosted acceptance or N05 closure.

## PR101 final CI/integration disposition

Independently verified exacta5b CI35570564542SUCCESS6jobs/5pathskips and remotePR101
MERGED as **944489d5449286d2b362cd96334bcd771636f0fc** at2026-09-21T06:59:55Z.
Passed detection/safeguards/backend/Docker/schema/aggregate; web/identity/native/Seeder
skipped. Coordinator reviewed and merged; author did not self-merge. Earlier pending
wording below is historical. No repeat of accepted race journeys; actual UI/localSMTP
and after-final-read/provider/rearming limits remain unchanged. Frozena5bref preserved.

## N05 cancellation/reschedule stale reminder — PR101 review handoff

Coordinator granted existing bookingReminders.js only after actual failure. Compare
current/master/paid worker (samehash) and older staging/Beacon variants: none rechecks
booking byID between scan and claim. Reuse existing worker/table/notifications;15-line
in-place check, no schema/service/newfile/unit test/design change. Fresh read errors,
missing/terminal booking or changed start/end/host skip claim; later scan handles current
schedule. This does not atomically exclude cancellation after the final read/provider start.

**Actual baseline:** isolated Bob GoTrue browser existing host BookingDetail→More→Cancel,
Changed plans→Cancel persistedcancelled06:49:56.099. Real worker confirmed scan completed
06:49:31.536 but its reply deliberately held until06:50:08. Reminder log0ad13372 and
notice5fd60919 saved after cancellation, local SMTP reminder e5inJdnVoHHZjKzriyyT2m
arrived06:50:08.274 after cancellationANhcidg9 at06:49:56.202. Actual Mailpit UI showedboth.
Only real scan delivery delayed; no mocked row/auth. Temporary free bookingSQL-cloned,
not creationUI acceptance; original retained booking untouched.

**Candidate actual UI/API/SQL:** reset only temporary booking; keyboard host cancel
commits06:52:29.358 while real scan held, release produces0reminder logs/notices/newmail.
Reschedule screen selects09:00PDT available slot→Reschedule now→toast/time updated,
SQLstart16:00Z at06:53:21.692; released oldscan produces0reminder logs/notices.
Then temporary timestamp controlled due; actual BookingSELECT revoked after real scan
before fresh read:0claims/notices, grant restoredfinally. Fresh retry produces1log/1notice/
1SMTPQe6ugzjRXgGUbmJwFmrWyZ; repeat unchanged. Original baseline mail remains separately
identified, never counted as candidate send. Host/notification-only settings unchanged.

**Checks/limits:** existing schedulingLogic26/26, syntax/diffcheckpass; no new tests.
Manual worker real clock/localSMTP64535+Mailpit64536, not natural cron or hostedprovider.
No native/paidbooking/intact account-switch/provider-race acceptance. Existing receipt
key booking/kind is not rearmed after a previously delivered reminder and later move;
that policy/acceptance remains separate. Prior offset/0/empty/30day and destination
proofs retain their unchanged-source limits. N05 and wholeStream remainopen.

**Cleanup:** exacttemporaryeb013de4-a517-49f2-972c-45f744ba4e78 and its notices deleted;
BookingAttendee/BookingReminderLog/BookingToken/Payment/Booking/Notification all0 forID.
Original booking9c7f570c fullrowunchanged, BookingSELECTrestored; hold/releaseflagsremoved.
Five newlocal test emails retained as private evidence; no externalrelay/provideractivation.
Phase browser tabs8/9 closed; ownedruntime/originalfixtures retained. Otherstreamsuntouched.

Private `booking-lifecycle-final-evidence.json` binds revision and6 source hashes,
comparison/baseline/candidate/reschedule/readfailure/retry/cleanup artifacts and actual
UI versus synthetic boundaries. Durable407files hashverified in existing
`.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/`; manifest
**92837977efcc7751f53e83a20f2707b05bd5db46a7be0f69aea5b42004927bfb**.
Current exact-headCI35570564542pending; coordinator review/integration separate.
Keepa5bfrozen while continuing read-only reconciliation for next bounded grant.

## Persona feed mute — final bounded handoff, September21 06:15UTC

**Implementation:** six files in1d8357330: existing posts.js route, feedService,
SDK posts.ts, PostCard, useFeedData, plus granted enum-only forward migration13000.
Existing/archive/open-branch comparison found no persona feed-mute implementation;
existing PostMute table/uniqueness and endpoint are reused. Existing enum needs one
additive value; no new table/service/index/screen, applied history rewrite or unit test.
Apply enum migration before persona writes. Applied only on owned local SQL64532.

**Baseline:** actual Beacon menu sent user/public-persona UUID; successful local
removal returned after reload. Repair uses public persona type/id and matches only
persona identity_context_id. Private owner remains redacted, user/business/topic and
notification-only membership mute retain their contracts. Actual followup found own
persona mute offered despite safe viewer.isOwner; reuse that flag to suppress it and
preserve own cards in optimistic cache removal, matching existing server own-post policy.
Warm alternate feed filters also restored the post; persona success now cancels and
updates all existing feed queries on the captured session's QueryClient.

**Actual UI/API/persistence:** real isolated GoTrue accounts, Next18131, full app18130,
PostgREST64531/PostgreSQL64532. Existing menu and keyboard confirmation, denied INSERT500
with usable cards/error, restored retry200, SQL persona/public-ID row, reload removal,
HTTP unmute plus actual reload restoration. No existing web unmute UI found or invented.
Lost successful POST reply changed to synthetic503 after real commit: error/cards remain;
retry converges to same single row. Dana own menu excludes mute; server own-post bypass
also verified directly. Isolation covers other-owner persona and same-owner personal post.
One-active-persona-per-user constraint preserved; no two-active-same-owner proof.

Thirteen direct HTTP/SQL groups cover owner-only deletion, another actor cannot delete
Bob's row, DELETE500/retained row/retry, repeated/concurrent POST with one saved row,
unauth401/invalid400, authorized fullpost/private-owner redaction and legacy user scope.
This matrix predates final cache edits; separate following proofs cover those changes.

**Ordering:** actual warm Updates cache retains only other persona after mute.
Held Questions304 at05:56:33.785, mute200 at41.791, intact release53.787 and finish53.788;
selecting Questions still excludes target. This is cached304 retirement, not a new200
body or cross-account proof. Earlier12s attempt finished before mutation and is excluded.
Server real SQL-read race baseline restored target in fresh final feed. Candidate mute
05:59:55.708, newer55.794 excludes target, older pre-mutation read06:00:07.701 retains
its earlier snapshot, final fresh07.761 correctly excludes target. pendingEntry ownership
prevents old database reads republishing after invalidation/replacement. Only transport
completion delayed12s; real SQL rows/auth unchanged. No claim that old in-flight HTTP
snapshots are retroactively changed.

**Session review:** feed keys omit actor IDs, but existing QueryProvider creates a new
QueryClient and keyed child generation on token/session storage changes. Both old hook
closures retain the old client; its all-feed cancellation/write cannot address the new
client. Existing SDK additionally rejects changed-session replies. Reviewed exact source
hashes, no speculative provider/shared-auth change. Intact held-mute account switch,
complete offline/reconnect and installed native journeys remain unverified.

**Local validation:** final backend cache source passed existing2suites/24tests;
web typecheck0errors and scoped ESLint0errors after final frontend cache repair;
backend syntax/diffcheck passed. No new tests. Final-source actual Bob menu mute/reload
kept target absent; after cleanup a fresh actual browser shows original Beacon post.
CI35567483902 running; CI success and integration are not yet claimed.

**Cleanup:** authenticated Bob/Dana DELETE200; exact temporary posts e16b4607 and
d924073b removed, other-owner persona fd7d431a with its temporary tier/channel/member
removed. Original seven table IDsets restored (PublicPersona/PersonaTier/BroadcastChannel/
PersonaMembership/Post/PostMute/Notification); target membership full row unchanged.
Eight existing post-related table counts0. PostMute SELECT/INSERT/DELETE all restored;
three fault flags absent. Original six posts, persona/membership, actors, block/booking
fixtures retained. Additive enum remains installed locally; auth/security audit/session
effects retained. No hosted/provider mutation or peer-runtime changes.

**Evidence:** private `persona-feed-mute-final-evidence.json` binds all6 source hashes,
three reused session sources, source revision/config, actual UI/HTTP/SQL and synthetic
limits. Supporting source comparison, migration preservation, fixture, HTTP13groups,
owner/cache baselines, excluded ordering attempt, server race baseline/candidate,
transport logs, existing checks and exact cleanup are in durable
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/`.
387files hash-verified; MANIFEST SHA256
**7697323376753b3a05d6a2711daae5d07cdc956b90db48c40fb069b06cdb4bf1**.
Artifacts retain their actual source/config; manifest head is not blanket retesting.
Private source/runtime directory `/private/tmp/pantopus-stream3-20260920-r1` retained.

**Handoff:** coordinator review frozen1d835/PR99 and automatic exact-head CI, then
integrate if accepted. No self-merge or new feature scope. Owned backend18130/PID13145,
Next18131/PID14742 and Supabase64531–37 remain for continuation; no active fault or
new native reservation. Original prior browser tabs ended with the previous turn;
new tab7 is the cleaned real Bob feed. The pre-existing stale Post-not-found sidepanel
is unrelated to this milestone and unchanged. N03/N04/A05 and whole Stream3 remain open;
use the current coverage matrix below with this persona-mute evidence replacing its
older ungranted/reproduced-only entry. Native enum/UI compatibility is not accepted.

## Final map integration disposition — frozen for coordinator capture

Independently verified remote PR97 **MERGED**, merge commit
**027afc13a361330f16539ea98133eb793367eb24**, at 2026-09-21T05:36:32Z.
Coordinator reports exact updated-head9b1fa0d43 automaticCI35564770177 passed with
CLEAN mergeability/source review. Earlier exact4c6f full-nativeCI35562416370 also passed;
its durable receipt and actual UI/API/SQL evidence remain separately source-bound.
Remote PR96 is also **MERGED**, at 2026-09-21T05:36:34Z, automatically closed by
combined integration; its head remainsd10e. Both repairs are integrated, not a whole
N03/A05 or Stream3 closure. Duplicate canceledCI35562211102 remains superseded, not passed.

Only this live status changed. Application checkout/runtime are untouched; do not
push old local4c6f over coordinator-updated remote9b. Paidc426 already contains identical
three map files and has its own pending integration gate. Persona feed-mute migration
sequencing remains coordinator review only; no new application grant. Freeze this
status for capture before coordinator merges master into the neutral worktree.

## Final map full-CI receipt

Independently fetched GitHub run35562416370: **SUCCESS** on exact
4c6f117712428452f041e997d76e007e0dbfb62a, including all native jobs.
Private map-final-ci-receipt.json preserves job conclusions and source revision.
Durable364files manifest **791cbe2b4a26c3ca932ba8706a5d9dd45ddb4a2c13686f6358db078838028947**; prior artifacts remain unchanged.

This is automated build/test evidence, not new installed-screen or physical-device
acceptance. Existing actual browser/API/SQL and cleanup evidence retains its separate
scope. Coordinator reports updated PR97 head9b1fa0d43 adds only documentation beyond
4c6f; its own automatic merge gate remains pending. No manual duplicate dispatch,
application edit, local branch overwrite or runtime change was performed here.
Master integration is still separate from this completed source-bound native run.

## Latest coordinator CI and integration disposition

Coordinator reports automatic PR96 exactd10e CI35562256054 passed changed surfaces;
automatic PR97 exact4c6f CI35562565822 also passed. PR97 is now retargeted to master
at unchanged4c6f117712428452f041e997d76e007e0dbfb62a and described as the combined
three-file map failure/order plus popup-destination repair, preserving both commits
and their separate evidence. Neither this report nor green CI establishes merge.

Duplicate manual PR96 CI35562211102 was canceled as superseded/redundant, **not passed**.
The final-tree combined map manual CI35562416370 remains the full-native gate;
d10e→4c6f native/workflow bytes are unchanged. Delayed automatic runs can appear
several minutes after PR creation; do not dispatch duplicate CI after a short absence.
Source remains frozen, no new application grant. Existing runtimes/retained fixtures
preserved. This disposition is coordinator-reported; earlier pending entries below
are historical checkpoints. Final integration/current native completion remains open.

## Current whole-stream acceptance reconciliation

Read-only reconciliation at 2026-09-21T04:53:25.682348+00:00 on4c6f11771. Existing
[screen catalog](../screen-parity-inventory.md), [mobile wiring](../mobile-wiring-audit.md)
and [notification inventory](../notification-template-inventory.md) remain discovery
sources; REAL_VIEW/rendered controls and May audit wording do not establish current
end-to-end success. No additional application edits during coordinator integration.

| Existing row | Current bounded evidence to reuse | Required acceptance still open |
| --- | --- | --- |
| N01 | Actual web saved-notification list/bell reads, mutations, keyboard removal, post/booking/listing destinations and preferences (PR75/81/85/86/91); exact UI/API/SQL evidence above. | Provider-delivered foreground/background/cold-start, denied permission, token lifecycle, login continuation and all destinations under current authority. Saved records alone do not establish push delivery. |
| N02 | Historical Android emulator FCM and owner-confirmed physical iPhone Beacon preferences retain their original source/device limits. | Physical Android unavailable; current installed iOS/Android interaction capability unavailable. CI simulator/emulator tests are not installed-screen or physical-device evidence. |
| N03 | Real local follow/unfollow/retry; fan identity/privacy, restricted oldlinks, posting/draft recovery, comments/replies, hide/filter failures and web maps under current milestones. | Persona feed mute is repaired and locally verified in PR99 above, awaiting CI/review/integration; release-cohort eligibility, broader access transitions, native discovery/posting/reply and remaining map layers unverified. Notification-only membership mute remains distinct. |
| N04 | Existing safety/report entry repairs, realGoTrue session retirement, persisted block/messaging denials and unavailable checks; distinct UserBlock/UserProfileBlock/PersonaBlock/Relationship scopes retained. | Remaining installed entry points, moderation processing, broad socket/provider side effects, full offline/reconnect/concurrent/lost-reply/session matrix across all scopes. Existing bounded evidence does not close whole row. |
| N05 | Actual booking UI/API/SQL, manual existing worker/local SMTP delivery, saved notices and owner/invitee destination boundaries, canonical timing/host choices. | Natural cron/timing, lost SMTP acknowledgement, partial delivery/concurrent cancellation or reschedule, individual invitee destination, remaining host-email/attendee/dailyagenda/pause contracts and native/provider delivery. Home calendar belongs to Stream2. |
| A01 | LocalGoTrue real login and recovery-email delivery/return-form evidence; isolated accounts provisioned for testing, no new public-signup acceptance claimed. Disabled Google/provider boundary recorded. | Complete signup/email verification remains open. Password-reset final credential change needs user takeover; Apple/Google success/cancel cannot run while providers disabled. No provider activation or native claim. |
| A02 | RealGoTrue account changes/cookie refresh, protected-data retirement, security records/global sign-out and two account deletions with exact block cleanup. | Broader native/other-browser expiry/revocation, unavailable storage/frozen-tab and provider-session combinations. Historical controlled proofs retain precise transport limits. |
| A03 | Existing shared upload/document evidence and implemented file picker remain reusable under their original versions. | Hosted Storage permissions/quotas/media lifecycle and native chooser capabilities unavailable/unassigned; no shared storage edits. |
| A04 | Existing provider report plus local OAuth capability check. | Activated Smarty/geographic/provider acceptance and paid activation bundle unavailable; address ownership remains coordinated with Stream2. |
| A05 | Recent actual Marketplace reporting, seller identity, Q&A, notification return, message/card destinations; map popup post destination now PR97. Existing catalog reused. | Remaining search/subscription/booking/identity and adjacent reachable actions; Home/mail/payment findings routed to owners. No claim that every catalog action works. |

Private exact-byte reconciliation has24 artifact/file bindings:16 unchanged,8 different.
Three marketplace-message baseline bindings intentionally predate repairedPR93; baseline
is not candidate acceptance. Marketplace blockService/chats/modal match accepted hashes;
useListingDetail delta changes only success destination, leaving denied/error paths intact.
Other changed files keep scoped earlier/later milestone evidence, not blanket retests.
Private current-evidence-source-bindings/current-coverage-reconciliation record details;
durable363files manifest **b0b1b7984397c8622e1da9d82a959b727f7294a6276365a406910de0996b197d**. No new runtime acceptance is implied.

## Current N03/A05 map popup destination milestone

[Draft PR97](https://github.com/WangPantopus/skinny-pantopus/pull/97), exact
**4c6f117712428452f041e997d76e007e0dbfb62a**, stacked on frozenPR96d10e.
Only existing DiscoverMap PostPinPopup href changes /app/posts/:id to canonical
/app/feed/post/:id. Six existing/master/paid/staging/Beacon/archive variants used
obsolete route. Reused existing full-post screen, SDK getPost/getComments, existing
posts GET/:id visibility checks/serialization; no new route/files/SDK/schema/tests.

Baseline actual popup opens Next404. Candidate actual Evan popup Enter opens saved
post title/content and canonical AuthBob profile. Browser focus command timed out
after navigation, but subsequentAX/DOM confirms destination; GETpost/comments200 at
04:48:02 and SQL1PostView. This is actual localGoTrue/HTTP/PostgREST/SQL, no auth or
persistence mocks. Fixture SQL-seeded publiclocal post at synthetic PDX defaultcenter;
post creation not retested. Stale popup mouseclick after exactSQLdeletion opens same
canonicalroute with bothGET404 at04:48:53 and existing Post not found, no stalecontent.

Exact fixtureec1f7bea-6314-4364-abd1-a1d066cb40fa and ten related counts0; original6
PostIDs preserved. No grant/fault changes in this milestone. Types0/ESLint0/diff0,
no newtests. CI dispatched because no automaticPR checks appeared; integration and
retargeting coordinator-owned. Native/provider and broader fullpost lifetime/error
acceptance remain open; no policy change or N/A rowclosure. Runtime retained on same
owned ports; browserEvan at missingpost. No additional feature scope before integration.

Private map-post-destination comparison/fixture/candidate/cleanup/types/lint/pr and
HTTP log; durable361files manifest **89693bdcf8a48bda6e394813b6a4ccc5d7f7e0c49c651dd646faa43e6b629db9**.
PR96 exactd10e manualCI35562211102 currently inprogress (backend/privacy/identityE2E
passed; other jobs pending). Do not treat source/localUI/CI/integration as interchangeable.

## Current N03/A05 map failure and response ordering milestone

[Draft PR96](https://github.com/WangPantopus/skinny-pantopus/pull/96), app7cebdd5d8,
review **d10e39b5e05d6ce85d27b40e010b3902b29300ba** after docs-only master merge.
Prior PR95 exact378c9ee passedCI35561104880 and coordinator merged4e58b0bc;
its four accepted source hashes/evidence are reused, not a blanket rerun.

Granted existing posts.js posts-only map catch, FeedMap and DiscoverMap posts feedback.
Baseline FeedMap Search this area under PostSELECT denial returned200/0 in view;
DiscoverMap actual ShowPosts returned500/blank without feedback. Intact old Askempty200
also replaced newer Updates1. Six-reference current/archive/open comparison confirms
reuse in place. Posts-only errors now reach existing500, both callers expose retry,
FeedMap retains known pins and retires old callbacks by request generation/token/unmount.
DiscoverMap uses existing abort flag, including turning posts off. No new files/tests/
SDK/schema/policy change; mixed-layer legacy partial success deliberately remains open.

Actual IAB Evan→local GoTrue/Next18131→full app18130→PostgREST/SQL64532: FeedMap warm
and cold500, repeated error and keyboard retry200; known1 pin retained and cold state
Unavailable. Intact old Ask200 release04:35:21.339 leaves newer Updates1. DiscoverMap
cold50004:42:59/repeated50004:43:02 show error/retry, restored Enter20004:43:13 restores
marker. Turning posts off during8s hold leaves layer off/no pins/error after intact
cached304 finish04:43:45.648. This is disabled-layer proof, not reverse-order200 proof
for DiscoverMap. No mocked authentication/persistence; SQL-seeded public post at synthetic
NYC then PDX default-map coordinates; SELECT fault and response delay are controlled.

Exact post45a9939c-5852-45e9-9d37-ddae11ca4f07 removed; Post/File/Comment/Hide/Like/
NotHelpful/Report/Save/Share/View counts0. Original six Post IDs preserved; SELECT
restoredtrue, responseflag consumed. Original fixtures/authaudit retained. Owned backend
session44858/Next60362 remain active; Evan browser at deleted popup404. Types0/lint0,
backend syntax/diff0; no newtests. Required CI pending; integration coordinator-owned.
Native/provider, broader map session transitions, DiscoverMap warm-failure/reordering
and mixed partial reporting remain unverified. No N/A row closure.

Private pulse-map-candidate/source-comparison/baseline/boundaries/fixture/types/lint/pr,
map-response-faults and real-auth-http artifacts; durable 354 files manifest
**52f815c85d345303a845dc112788b6702eca882dd35b8262affbab3bb7b82656**. Artifact-specific source/config remains authoritative.

Next separate assigned repair: actual DiscoverMap popup View Post used /app/posts/:id
and Next404. Confirm existing full-post route/API, compare references, then href only
and actual authorized/missing navigation. No new routes/identity/schema/persona scope.
Persona feed-mute extension still proposal-only; never repurpose notification mute.

## Current N03/A05 filter read and unmute failure milestone

[Draft PR95](https://github.com/WangPantopus/skinny-pantopus/pull/95), appff1917e15,
review **436a93c190b02cc740836759f37f75e807b472e0** includes masterb463ee385 after
PR94 exact1fb passedCI35560095912/coordinator merge. Granted existing posts.js DELETE
mute, feedService.getMuteAndHideFilters, useFeedData.ts and feed/page.tsx only. All
five filter reads checked before cache write; existing error responses/retry/ErrorState
reused. Known current-owner rows retained, falseempty/caughtup suppressed onerror,
automatic pagination pauses onerror. No policies/schema/newfiles/tests/design change.

Baseline real HTTPunmute DELETE denial returned200 but leftsame savedrow. ActualBob
feed under persistedhide+PostHideSELECT denial/coldservercache returned200 and exposed
hiddenpost. Independent PostSELECT denial GET500 x3 rendered Nothing here yet/noRetry.
Candidate realGoTrue/fullHTTP/PostgREST/SQL: each PostHide/PostMute/Relationship/
PersonaBlock/UserFeedPreference SELECTdenial gives list500/sports500; each restored
sameactor read200 respects savedhide. Unmute DELETEdenial500 retains1, restoredretry200
removesrow. Map service fails closed, but existing map-layer catch returns200empty;
APIlead only, separate scope/actualmapUI stillpending.

Actual browser cold500 shows ErrorState/TryAgain; failedretry remains error. Restored
SQL keyboardretry200 shows genuineempty with persistedhide. Exacthide cleanup and
ownedcache restart restore originalpost. Warm surface-switch/revisit500 retainsknown
post pluserror, restoredEnterretry200 clearserror/keepspost. Extra private injected503
then held realBob feed200 started04:24:40.078 (recorded postID2824...), logout200
04:24:48.792, Evanlogin20004:24:55.620. Oldrelease04:25:00.080 was destroyed/socketDestroyed
true, so **disconnected-response evidence only**, not intactcrossaccount delivery.
Evanfreshfeed20004:25:01.669 genuineempty/noBobrows. Existing QueryProvider generation
remount/cacheclear and API session guards unchanged; source-bound prior evidence reused.

Exact candidatehide1e1de420 and temporarymute removed; PostHide0/PostMute0. All six
SELECT privileges and PostMuteDELETE restored, extraresponseflag consumed, existing
post/membership/block retained. Authaudit/sessioneffects retained; Evanbrowseractive.
Owned backend current session31915; frontend unchanged. Matrix+UI persistence real;
only extra503/20s responsehold synthetic, not auth/database. Types0, lint0errors/3existing
warnings, syntax/diff0; existing feedService/postMute2suites24pass, no newtests.
RequiredCIpending/coordinatorintegrationseparate. PaginationfailureUI/intactdelayed
ordering/native/provider/mapUI/personaextension remainopen; noN/Arowclosure.

Private pulse-filter-matrix/candidate/read-baseline/types/lint/existingregression files,
pulse-mute-delete-baseline and feed-response-faults plus browserhistory. Durable344files
manifest **b77d30b23aa316790918ec06c219c336a8d26f1e280bde545373689b71e96598**.
Next afterfreeze: inspect actual existing map failure journey. Persona extension remains
read-only proposal: existing PostMute enum lacks persona; additive enum/SDK/API/filter/
caller extension could preserve public identity and legacy scopes, but not assigned.
No reuse of notifications-only membership mute or private author restoration.

## Current N03/A05 Pulse hide persistence milestone

[Draft PR94](https://github.com/WangPantopus/skinny-pantopus/pull/94), app39513752b,
review **1fb5a58adc576cddd4219e4921a3c1ad5c22b01c** includes reviewed mastere8ece6ebc
(PR93 exact e036 passed CI35559652324 and coordinator merged). Sole granted handler
backend/routes/posts.js /hide/:id checks existing post lookup and upsert errors;
maybeSingle preserves confirmed absent404, catch500 reused. No caller/policy/design/
schema/newfile/test change. Compared six existing/archive/open sources; all ignored
hide persistence error. Existing client already displays failure and retains card.

Baseline actual Bob Beacon feed Hide Post under PostHide INSERT denial returned200
at04:07:29.364, toast Post hidden and card removed, SQL0; reload restored post.
Candidate actual same failure500 at04:10:12.705 keeps card/Failed to hide post. Restore
and same-menu retry200 saves exact rowfbfa8bec; fullreload remains empty. Two concurrent
real authenticated HTTP retries200/200 preserve one row; absentpost404, unauth401,
Post SELECT denial500. AuxiliaryHTTPsession logout200. Browser uses existing local
GoTrue/HTTP18130/PostgREST/SQL64532, not synthetic authentication or mocked persistence.

Exact temporary PostHide fbfa8bec-87a2-4315-a51e-9cf7bc295339 removed; PostHide0/PostMute0,
original followerpost retained; INSERT/SELECT restored. Authaudit/session effects
retained. Direct cleanup may leave existing filtercache until TTL/restart; no recovery
claim beyond recorded UI. Backend owned restart session2461, Next unchanged. Syntax/
diffcheck pass; requiredCIpending, native/provider/delayedsession unverified, no rowclosure.

Private pulse-hide-baseline/sourcecomparison/candidate/boundaries files; durable332files
manifest **f5c94e6cc7b6a76c3a335d162bcc526cb3d9de922cb6df899b77d6acdb1dbe5f**.
Next distinct reproduced lead: PostCard MuteUser on Beacon sends canonical personaID
as user, persisted PostMute0b80d9dd, toast/cardremoval then reload restores post.
Exacttemporaryrow cleaned0. Existing persona muteFollowing is notifications-only;
reusing it for hide-from-feed would change policy. Preserve safe public identities,
no private author restoration or new table. Further contract comparison/assignment
needed before repair. Filter/unmute error handling remains sourcelead, unverified.

## Current A05 messaging destination milestone

[Draft PR93](https://github.com/WangPantopus/skinny-pantopus/pull/93), exact
**e036af696090b47d037cd0fad810c6fc31694a89**, base master9f14a638a after documentation
PR87 publication and explicit three-file coordinator grant. PR91 merged ef7382ea1
following exact CI35558601157. No application differences from ea8e to new base;
accepted evidence reused. Exactly existing useListingDetail send-success destination,
PublicProfileClient.handleMessage destination and ChatRichCard listing href changed.
Prior archive/open/master comparisons retained; no new files/tests/routes/design/policy.

Actual Dana baseline direct201/message201 persisted but navigated ignored roomquery
and inbox. Existing inbox row correctly opened conversation/Bob. Its ViewListing
link hit Next404. Hydrated public Bob Message repeated ignoredroomquery. Candidate
uses captured seller/recipient ID for existing conversation route and existing
marketplace detail href. Errors and other card types remain unchanged.

Actual candidate UI on Next18131/full app18130/local GoTrue/PostgREST/SQL64532:
scoped ChatMessage INSERT denial gave direct201/message500, zero messages, retained
draft/form and no navigation. Restoring INSERT then same-form retry gave message201,
exactly one persisted listing_offer and correct conversation/Bob with exact draft.
ViewListing opened authorized detail200. Seller publicprofile Message activated via
Enter returned correct conversation and saved message. After exact listing deletion,
keyboard ViewListing gave HTTP404/Listing not found with no stale detail. Source-bound
prior blocked Marketplace403/database503 and SDK/session checks reused; no new delayed
session/duplicate-tap/native/provider acceptance. UserIdentityLink remains source-only,
outside grant. Other card types unchanged by exactdiff, not broadly rerun.

Exact fixture listing4157ed45-9453-4432-b540-9c0184a030fe and roomc022a97f-4174-4b42-
9d4c-14d760e3fe79 retired. Listing/views/interactions/questions/room/messages/participants0;
original ChatRoom/ChatMessage/ChatParticipant/Notification ID sets unchanged. Original
DanaEvan block retained; INSERT restored; authaudit/session effects retained. Browser
Dana remains on deleted fixture's notfound page; owned runtimes unchanged.

Typecheck0errors, scopedESLint0errors/5existingwarnings; no newtests. Required CI pending,
coordinator review/integration separate. Evidence marketplace-message-baseline/source-
comparison/candidate-fixture/candidate/types/lint/pr files and actual HTTPlog; browser
action history in this task. Durable325files manifest
**4e1e6529b4315dcad5f2d22086e5081fa86371842a5429733cc6842bcbe8b266**.
Private artifact-specific sources/config remain authoritative, not blanket retests.

Independent N03 read-only reconciliation: actual own publicprofile Activity shows Dana's
two retained Connections posts and follower post, backed by GET200 and exact three SQL
Post rows. Connections source loads connected authors excluding self; existing parity
doc describes that scope, so no policychange inferred. Native My Posts remains untested.
No fixture changes. Next continue remaining N/A acceptance; this milestone closes no row.

## Current A05/N04 milestone — listing reporting

[Draft PR88](https://github.com/WangPantopus/skinny-pantopus/pull/88), application6ee007f7e,
review/pushed956dab1d1 includes current docs masterbc06d6b39; exactly two existing
files (useListingDetail.ts handleReport and shared ReportModal.tsx listing choice data).
Coordinator granted scope after actual failures; no new files/tests/schema/policy/design.
PR86 exactc5802b4a1 passed applicable CI35556598901 and coordinator merged3277477fc;
its prior bounded UI evidence is reused, not rerun or confused with native acceptance.

Baseline actual Bob UI created free remote fixture54f29656-3872-44a9-be3c-3cfcc5ef6953
on owned18131→18130/localGoTrue/PostgREST/SQL64532. Evan signed in through real UI.
Safety concern was offered but POST400; modal closed. Other/details under scoped
ListingReport INSERT denial returned500 and also lost draft. Hook source identical
SHA74196b1a7e69f8a871bcfc20f5b2ebcffe84a2c9e1866a021fac9d7bbb0226b4 across master,
paid, web staging and Beacon. Shared modal matches initial archive and already retains
rejected submissions; reuse suffices. All modal callers audited; other entities retain
original six choices. Existing API/SQL seven listing reasons reused without policy edits.

Candidate actual UI500 keeps Other/details and re-enables submission; sameform retry200
persists exact draft. Each offered spam/harassment/inappropriate/scam/prohibited/
counterfeit/other produces200 and one corresponding record. HTTP invalid/safety/
misinformation/oversized400 and unauthenticated401 leave exactly7reports. Profile
report modal still displays original six options; cancelled without submission.
Typecheck gate0errors; scoped ESLint0errors/2pre-existing warnings. Required current
CI pending at handoff; no new unit tests. Lost-success deduplication, moderation
processing, native/provider acceptance remain unverified. A failed request does not
prove no write; no report idempotency policy is invented here.

Exact fixture listing deleted through scopedSQL after evidence capture: Listing,
ListingReport, ListingView, ListingInteraction, ListingQuestion, ListingSave,
ListingMessage and ListingOffer counts0. Seven reports retired via existingFKcascade.
INSERT privilege restored, auxiliary HTTP session logout200; browser Evan remains
active and earlier fixtures/auth audit history retained. No broad cleanup claim.
Evidence marketplace-report-baseline.json/candidate.json/boundaries.json, source
comparison and private listing snapshot, lint/types logs. Durable private289files at
owner .pantopus-recovery/audits/20260920-stream3-accounts-social-r3; MANIFEST SHA
78b7d94c591173675bb63563585ce891dd852c2b6fdc6f74d190ba765b99aa63. Each artifact source
is authoritative, manifest head is not blanket retest evidence.

Next independent A05 finding: actual listing Seller is User/disabled ViewProfile
while real detail API returns canonical safe local identity displayName/handle/href.
SellerSection still reads removed legacy name/username/profile_picture_url. Existing
public href opens Auth Bob correctly. No repair yet; request bounded component
assignment and preserve typed safe contract (do not restore private legacy fields).

## A05 seller identity follow-up

[Draft PR89](https://github.com/WangPantopus/skinny-pantopus/pull/89), e3627adeb,
stacked on PR88; exact two existing files SellerSection.tsx and optionalhref only
in types/listing.ts. Coordinator granted both after actual detail User/disabled
ViewProfile versus correct canonical API identity. Both files unchanged across
master/paid/staging/Beacon/initialarchive. No backend privacy restoration or design
change; canonical fields/href reused, legacy fields left for other consumers.

Actual Evan UI detail→ViewProfile Enter→Auth Bob public page and sellername click
both pass. Separate SQLseeded free fixture9f6a46b8-7127-4e1b-a7d1-27e552a1020a
avoids repeating accepted creation. Controlled persisted empty ownerusername/local
handle made real API hrefnull; UI retained safe displayname and disabled navigation.
Both original handles restored exactly; reload recovered links. This is unavailable
publicdestination evidence, not proof of production redaction or completenullcreator.
Native/avatar-download/businessdestination unverified. Types0errors/scopedlint0;
no newtests. Current requiredCI/integration pending at handoff.

Exact sellerfixture deleted; Listing/View/Interaction/Report counts0, originalprofile
handles restored. Authaudits retained, Evanbrowseractive. marketplace-seller-candidate,
missing-href, identity-before/sourcecomparison and lint/types artifacts private.
Durablemanifest 73943dfb9040775b5651bbadd9c0e3cfeb2a4a3af691c0b8fb16b54b0185db23 (296files), source-bound as usual.
Next: existing marketplace Q&A/save/read journeys and existing broader N/A limits;
no stream closure.

## Current A05 Q&A read milestone

[Draft PR90](https://github.com/WangPantopus/skinny-pantopus/pull/90), app0ce235cfc,
reviewfdb37a904 includes currentmastera12610270. PR88 mergedcc28ddd3e after exactCI
35557360294; PR89 strict216e533af passed CI35557699093 and merged by coordinator
asa12610270. Source unchanged by branch updates; no blanket journey rerun.

Actual Evan question201 persistedae15b954 on SQLseeded listingaa065fb0-ed74-4846-
802b-2e0a2dff169a, but UIAnonymous/no link despite safe canonical asker fields. Real
ListingQuestion SELECT denial GET500 rendered Questions0/Noquestionsyet. Existing
QASection and caller identical across six archive/open/master variants. Granted
three-file in-place loader/error/Retry/canonical askernames+href repair; no mutation,
backend/schema/newfile/type/design change or newtests. Loader keeps knownrows and
checks listing/request/token/session marker; existing QueryProvider remount retained.

Actual cold/repeated500 explicitRetry/no falseempty, restoredSELECT sameRetry200
recovers question. Bob actual answer200 persisted and created exactlyone asker notice;
post-save read200 injected503 retained knownquestion/error; Retry200 recovered answer
without resubmission. Subsequent warmupvote/read503 and delayedRetry200 followed by
newerunvote/read200 left0. Older read held03:35:06.001, newerUI06.601, olderrelease
16.001/finish16.002 destroyedfalse/socketfalse/writableFinishedtrue; finalUI29.986
still0. Faultlog records questioncount, not full oldpayload; priorvote value follows
successful toggle sequence. Askerlink actually opens Auth Evan profile. Owner UI
Delete200 then GET200 yields genuineempty. Existing Save/reload/Unsave worksunchanged.

Generated seller question notice opened correct public/listing preview through bell.
OpenListing's native handoff was blocked by browsersecuritypolicy and not retried or
bypassed; native continuation unverified. Saved notification/webbell is not provider
push evidence. Intact crossaccount Q&A reply notnewlyexercised; existing account
remount/interceptor evidence reused, newhook guards source-bound only for thatcase.

Exact aa065 listing/question/save/view/interaction/upvote0; both generatednotices
4930ee07-eba1-49d6-8849-dfc9df8c45e2 and5b9d909c-22e2-4e45-b186-b4eba819e94c deleted.
OriginalnotificationIDs/readflags unchanged. SELECTrestored, faultflagconsumed;
Bobbrowseractive/authaudits retained. Backendrestartedowned session36821 appending
same log, Next18131unchanged; no otherstreamresources touched. Types0errors,
lint0errors/3pre-existing warnings; currentCIpending, integrationseparate.

Private marketplace-qa-baseline/candidate/sourcecomparison, workflow-before,
listing-questions-response-faults and lint/types logs; durable304files manifest
bd043a4acc666aac39a8343eae3f67461c68bfc5027a0d780b9155652f88b9fb. No broad N/A closure. Next read-onlynotification destination trace:
web resolver maps posts/Home but passes /listings through to publicpreview with no
Q&A; canonical authenticated listing screen is separate. Request assignment before
any sharednotification repair. Broader A05/native/provider/authorization stillopen.

## Current N01/A05 listing notification destination milestone

[Draft PR91](https://github.com/WangPantopus/skinny-pantopus/pull/91), appe23406bde,
reviewea8e8603c includes currentmasterfd04ae43c (PR90 exactfdb passedCI35558194245
and coordinator merged). Existing notificationRoutes.ts alone maps valid-ID
listing/listings/marketplace links to /app/marketplace while preserving suffixes,
URLvalidation and other mappings. Current/master/Home/paid had identical0deebaae;
archive/oldnotification branches also lacklistingmapping. No native/publicshare/
backend/provider/schema/newfiles/tests or permissions changes.

Earlier actual listing question notice reached publicpreview without Q&A; native
handoff was blocked/not retried. First uncommitted candidate had an accidental
UUIDregex suffix omission and still routed public; corrected to byte-identical
original regex before accepted checks/commit. Final actual fullnotification click
opens ownerAnswer, actual UIanswer200 persists; asker answer notice opens sameweb
listing without sellercontrols. Bell /marketplace alias preservesquery, fullpage
/listing alias preservesquery+fragment. 2aliasnotices SQLseeded; questionnotice from
existing authenticated HTTPquestion handler, accepted unchanged creationUI reused.
After exactlisting deletion, retainednoticenavigation→HTTP404/Listingnotfound/no
stalequestion. Explicitlogin?redirectTo returns Evan to correctauthorizedlisting.
Directloggedout listing route still follows existingmiddleware publicalias and
localredirecthostlocalhost; this is not fullguestcontinuation/native acceptance.

Exact d53498d0-9411-4a0b-b5ba-d4176f88cb34 listing/question/view/save/interaction0
and all4relatednotices0. OriginalnotificationIDs/readflags unchanged; auxiliary
HTTPsessionlogout200; Evanbrowseractive/authaudit retained. Types/lint0errors;
29existing routing/HomeTask cases pass2suites. CurrentCIpending/reviewseparate;
no provider/native/business/allaccess-change coverage claim.

Private marketplace-notification fixtures/persisted/candidate/sourcecomparison,
existing-regression/types/lint logs. Durable313files manifest
19dfb8b2c669141ee28c28974c3c1381344d290bae5e91cd4a8b4a5af1051fdc. Next independent N04/A05 existingMarketplace
MessageSeller blocked-entry verification, reusing accepted backendblock policy;
no new repair assignment or sharedfilechange. Other whole-stream limits remain.

## N04/A05 no-code Marketplace messaging extension and next findings

On ea8e8603c, actual Marketplace MessageSeller→existing createDirectChat denies
Evan→Dana403 and Dana→Evan403 under the retained DanaUserBlock. Both actualforms
retain unsentdraft/error. Revoked isolatedUserBlockSELECT and restarted onlyowned
API to ensure coldcache: sameform503. SELECTrestored, retry403; no sendMessage call.
ChatRoom/Participant/Message/Notification totals unchanged. Exact two disposable
listings d2a6286c-2687-4a56-a748-43c0b4fb08f1 and8af13f77-5bd9-457e-a17b-d590f5145938,
views/interactions/messages/offers cleaned0; originalblock unchanged. No source
change/newtests. This extends entry-point evidence, not independent socket/native
or unblock/concurrency acceptance. Backend now session94409 on18130, same private
launcher/log append; Next18131 unchanged. Dana browseractive/authauditsretained.

Independent successful-message baseline found next concrete defects, not repaired
while coordinator closes current integrationbatch. SQLseeded Boblisting6a18d868-
0aa9-410f-9c6c-e39ca84a597b; actual DanaUI direct201/message201 saved exactlyone
listing_offer in newroom eed0f38e-1a06-4d68-8039-a4c14c5b87e8. Existing caller sends
/app/chat?room=... but ChatList ignoresquery and opens inbox. Inboxrow opens existing
/app/chat/conversation/Bob correctly and shows persistedmessage. Its existing
ChatRichCard ViewListing uses /app/listings/id and actualNext404. Hydrated public
Bobprofile Message repeats sameignoredroomquery/inbox. UserIdentityLink has a third
samequery caller; sourcelead only, popoverUI not verified. No file edits/grant yet.

Exact positivefixture listing/newroom/message/participants cleaned0 via canonical
FKcascade; no newNotification rows in thisphase. Initial cleanup read used wrong
message_typecolumn, failed beforemutation; corrected canonical type query/cleanup
succeeded. OriginalroomIDs preserved, DanaEvan block retained. Evidence private
marketplace-block-before/results and marketplace-message-before/baseline/persisted.
Durable318files manifest 79012cecb848844bb52acbc910f6f578494dabbbcd0815b77e0fcc13bf753073. CurrentPR91 exactea8
passedCI35558601157; coordinator merging bounded route scope, author doesnotmerge.

Next after documentationbatch: obtain assignment for reproduced existing
useListingDetail send-success destination, PublicProfileClient.handleMessage and
ChatRichCard listinghref. Compare allopen/archive variants; reuse canonical existing
conversation and marketplace screens, preservestyles/policies; no replacementroutes
or tests. Continue other whole-stream limits; this is not Stream3 completion.

## Coordinator integration progress (read-only reconciliation)

PR70 merged358daaa; PR72 currentf2ea16704 merged703e7050867d4747db958dfda8a20bf2224d1991;
PR73 current806d64635 mergedae85bad599f87933ac00e3f76ca23ac5cb6daa53; PR75 current5edcaad6c
mergedcc560bce6c61d915d8a3c503a55b8c167270a43e; PR77 currentcc252a474 mergedb49dd59224d38c060d726a11bc45148f36404fcf.
Coordinator checked each strict update changed only docs/accepted clock fixture before
required CI. Accepted application bytes/evidence unchanged. Coordinator merged
PR80 ase92aeab69044ea3eeccbd6e2c4ebe096e26cb0cb and PR81 as6f4703065055f42a9def558e0e72c1e09024a03a.
PR82 strict914e68764 passed CI35553548674 and merged **01e842aef4b8877773712a17f1c5a545fc7f5081**
at02:20:58Z. All reviewed stack70/72/73/75/77/80/81/82 integrated. Author did not merge
or mutate coordinator-owned refs. Historical sections retain original source/limits.

## N04 post report retry — PR83, current milestone

[Draft PR83](https://github.com/WangPantopus/skinny-pantopus/pull/83), branch
codex/stream3-post-report-retry, headbf595fa80, base master01e842aef. Exactly two existing
handlers: useFeedData.handleReport and full feed/post/[id]/page.tsx handleReport now
rethrow after the existing error toast. Existing ReportModal already retains reason
and details on rejection; all feed-handler callers await it through this modal.
No shared modal/backend/schema/layout/new test change. Existing master, paid/Beacon
branch variants and modal were compared; no replacement was needed.

Baselineafe8: actual Bob full post Report and Nearby→Pulse→Beacons→card menu Report
both received500 under isolated PostReport INSERT denial, showed error then closed
modal and lost details. Candidate both actual browser entry points retain Other
and exact details on500; restoring INSERT and submitting the same form returns200,
closes with success, and persists exactly one report per UI journey. Real local
GoTrue cookies/HTTP/Express/PostgREST/PostgreSQL, no mocked identity/persistence.
Additional separate authenticated HTTP: visibleGET200, invalid reason400,1001char
input400, unauthenticated401, SQL-controlled inaccessible403, missing404; zero extra
reports. First fixture setup used an invalid audience enum and failed atomically;
finally restored, then rerun with canonical nearby audience and private visibility.
These are controlled access checks, not actual moderation-state lifecycle evidence.

Exact reportsa2032035-9d26-497c-a5ef-0fe662cb910c and8eba4713-8fd4-4beb-8a2d-966e645bae59
removed, target Bob/Post report count0. Post visibility/audience/distribution restored;
PostReport INSERT restored; both auxiliary HTTP sessions logout200. Current browser
and earlier fixtures remain. Local typecheck gate/focused ESLint pass. No new unit
tests. PR83 exactbf595 CI35554056362 all applicable/aggregate green. Coordinator merged PR83 as0fb600391ea6bd88c8f39e9f72bfa6b0b059f765.

Evidence post-report-baseline-results.json, post-report-candidate-results.json,
post-report-boundaries.json and setup-failed snapshot, post-report-types.log/lint.log.
Candidate SHA b53034572475e53547c01aab15e8db7eb1e7c2c97d4f9602d2741a9855b01c02.
Durable private mirror now243files; MANIFEST SHA
2c321c806b41ff73db8ac32fb90a8b357626654fdb9a957fe73dfa9264dc320e.
Artifact-specific source/config remains authoritative, not blanket rerun evidence.
Installed native, provider/moderator processing, report idempotency/concurrency,
account-switch/departure and whole N04 remain unverified.

A02 evidence qualification: repeated refresh500 in private operator logs corresponds
to rejected Origin http://localhost:18131 before auth/cookie parsing. Owned IAB uses
stream3-auth.localhost:18131; coordinator Chrome/IAB inventories have no localhost18131
tab. Exact originating client unknown. Coordinator requested no further unrelated
investigation/CORS broadening. Do not classify these as authenticated refresh failures
or claim all auth error handling verified.

## N03/N04 Beacon publication access — PR84

[Draft PR84](https://github.com/WangPantopus/skinny-pantopus/pull/84), c89949f62,
branch codex/stream3-post-visibility-fields, basePR83. Coordinator granted exactly
existing posts.js POST_VISIBILITY_SELECT additions archived_at/post_metadata. Shared
helper omitted the fields its existing canViewPost policy needs. Current/master/paid/
Beacon selector+helper variants identical, SHA f3434e6897e6bb48bd42026272765f19249900c1779a1a797a16d54b2c26cb24.
No replacement/schema/newtest; no phantom Post.status column added.

Actual baselinebf595: owner Dana HTTParchive200; follower postGET403 and real reload
Post not found, but standalonecomments200 exposed7/8 and likes200. Bob already-open
actual UI Send persisted1comment201 and1ownerNotification after archive. Exact both
removed, original7comments restored via ownerunarchive200. Candidate actual staleUI
Send403 retains draft, no persistedcomment/notice. Archived and SQL-controlled draft
matrices each cover11 follower reads/actions, all403; owner detail/comments/likes200,
seven effect-table counts plus Notification unchanged. Published restoration gives
reads200; retainedUIcomment first hits existing20/min content limiter429, draft still
retained, natural expiry retry201 yields1comment/1notice. No limiter override.
Baseline/candidate exact newcomments/notices removed, original7comments/published
metadata restored; auxiliary owner/fan sessions local logout200. Owner archive/
unarchive naturally updates updated_at; not rewound. Existing31cases/3suites pass.
Coordinator updated PR84 to strictf19349e38, unchanged accepted app bytes; CI35554806445 green and mergedc1c03a3c62944c0a07570db285f945a338c9f1c5. Personal policy unchanged/source+existingtests;
no new personal/native/provider/socket or atomic archive-versus-write race acceptance.

Detailed archive-visibility-results.json SHA
aaceb9644a6e5f8d04e7453bd194de4726e0b8964a7eec5e181f81d11c4a907f,
phase snapshots and candidate-matrix. Private mirror258files, MANIFEST
4c758ece1dc28343d3e0d74eb40c8e1b0127950d97a7a67dc492aeef669e217e.
Backend now PID8033/session61160 on18130; old log preserved from durable snapshot as
real-auth-backend-before-archive.log, current log begins candidate restart.18131 unchanged.

## N01/N02 notification read recovery — PR85

[Draft PR85](https://github.com/WangPantopus/skinny-pantopus/pull/85), headed5b4a8bb,
branch codex/stream3-notification-read-errors, base masterc1c03a3c6. Exactly two granted
existing web files NotificationBell.tsx and app/notifications/page.tsx. No backend,
BadgeContext/socket/SDK/provider/schema/newtest change. Master/paid identical before;
older Beacon differs only accepted guardedtap/route code. Existing QueryProvider
already remounts account-local state on session change; reuse it. Bell now rejects
outdated filter/closed/unmounted reads and token/marker changes; fullpage consumes
query cancellation and checks session. Existing lists use explicit error/Retry,
keep successful/known same-owner slice rows, and suppress false confirmed-empty.

Actual c899 baseline Bob bell11saved/7unread. Isolated Notification SELECT denial:
warmfullpage silently keeps cache; coldfullpage after HTTP500 says All caught up/No
notifications yet, bell likewise. Candidate real coldSQL500 both expliciterror/Retry;
known11warmbell/fullpage rows retained with error. Restored SELECT + actual Retry
recovers; unread filter failure truthful. ScopedPersonal fullpage repeated platform503
transport fault after real SQL keeps7personalrows+error; Retry recovers5unread. Failed
personal503+successful platform200empty gives incomplete/Retry, not empty. One-shot
initialfault was superseded by overlappinginitialreads and is not partialstate proof.

Warm ordering: old Personal500 held02:44:49.897, newer Business200empty UI50.358,
oldrelease59.898/finish59.900 destroyed/socketfalse; after02:45:09.612 stillconfirmed
Businessempty/noolderror orrows. Actual cross-tab Boblogout/Evanlogin whileoldBob
Personal200held02:45:27.797: newEvanUI48.176 beforeoldrelease52.798. Pendingtabretired
tologin, Evanbell/maininbox2ownrows. Oldresponse destroyed/sockettrue/no finish:
**retirement/disconnection only, not intact cross-account delivery evidence**.
Actual EvanAudience GET200empty at02:47:14 usesexisting Allcaughtup/Nonotifications.

All13original Bob/Evan notification IDs/context/readflags unchanged before/after.
No notification mutations; SELECTrestored, privatefaultflagabsent. Bobbrowserloggedout,
newEvanbrowseractive; authaudit/sessioneffectsretained. Earlierfixturesremain. Split
bellcohortoff; fullpagepersonal/platformpartial actual, bellall/legacyfiltersactual;
splitbell behavior only existingregressions, not installedacceptance. No providerpush,
native/physical, allmutationfailures, pagination-scale or frozen-tab delivery closure.
Typecheckgate0; focusedlint0errors/twopre-existingunusedwarnings.16existingcases/2suites
pass; no newtests. PR85 exacted5 requiredCI passed; coordinator merged **d2b83304922b28ff1f12ceaab70d284b1bec3682**. Initialtypenarrowingerror fixedbefore
commit; cleanup-refwarningremoved. Notifications/unreadcounteroutages remain distinct.

Evidence notification-read-baseline.json, notification-read-candidate.json,
notification-response-faults.jsonl, notification-records-before/after.json,
notification-read-types-final.log/lint-final.log/existing-regressions.log. Candidate
SHA8c83abe7d01b2251a09d815c7bebd1a1dce96e328482d8c2f35caa45509ec9e3.
Durable private268file MANIFEST30d163bb66f40b4c2cb8d59a5f1fc76692feeba5547a550e7576f2fb50676e87.
Owned18130 currentlauncher session91329 (private response-fault instrumentation only),
web18131 unchanged. No otherstreamruntime/cache/provider changed.

## N01/N02 notification actions and keyboard removal — PR86

[Draft PR86](https://github.com/WangPantopus/skinny-pantopus/pull/86), c5802b4a1,
branch codex/stream3-notification-actions, base masterd2b833049. Sole granted existing
NotificationBell.tsx, app/notifications/page.tsx, and narrowly added NotificationRow.tsx
keyboard/pending prop. Compare current/master/paid/Beacon: handlers all silent catch;
row identical hashfcf3d21253c71fc3014237d894ea0dbb48f35151d390980f891d72153d1381d8.
Existing selecteddetail and row Remove callers audited; sole NotificationRow caller
updated. No new files/tests/layout/backend/SDK/socket/schema/provider edit.

Actualed5baseline: Evan fullpage+bell MarkAll/Remove each500 under Notification
UPDATE/DELETE denial, no feedback. A SQL-created disposable notification Remove Enter
DELETE200 then unintended PATCHread500 and navigationSecurity. Candidate error toasts
truthfully say could notconfirm/tryagain; pending guards prevent duplicates; child
Remove Enter/Space stop propagation, ordinaryrowkeys remain. Successful same-account
commands invalidate existing notification cache family; reads started before committed
mutation retire. Markall uses authoritative rows instead of marking newly arrived
rows optimistically. Owner/view marker guards suppress obsolete completions/toasts.

ActualUIcandidate: scoped Audience(fullpage) and Business(bell) failure+retry succeed;
real UPDATE/DELETE grants restored.4keyboardremovals (Enter/Space eachsurface) exactly
DELETE200, no parentPATCH/navigation; ordinaryrowEnter/Space stillopenSecurity both
surfaces. Lostcommitted readall200→503 leaves uncertaintoast/knownunread, SQLflags true;
retry200 refreshes. Lostcommitted DELETE200→503 leaves knownrow/toast, SQL0; retry200
removes idempotently. No rollbackclaim. Disposables reused by exactID between phases,
recorded ledger; source createdrecords in SQL, UI/API mutations real, no deliveryclaim.

An initial candidate canceled an in-flight initial list on mutation start; rapid
MarkAll interrupted loading. Repaired by allowing initial reads and disabling initial
MarkAll, retaining success-time retirement. Another actual candidate failure: DeleteA
held10s, switch Read, oldresponsefinishes, returncachedAll<30s resurrectsdeletedA.
Existing cache invalidation fixes it. Finalhold03:05:59.804, Read00.376, intactrelease
03:06:09.806/finish09.808; returnAll19.909 showsAabsent. Doubleclick exactly1DELETE,
pendingRemove disabled. Cached-filter failure/repair evidence retained, not erased.

Accountswitch mutation: oldEvanDeleteheld03:08:15.569, Bobvisible27.509, oldrelease40.572
destroyed/sockettrue/nofinish. Pendingtabretiredtologin; nointactcrossaccountdelivery
claim. No socket/provider/newnotificationarrival matrix closure. All4disposable IDs
retired; finalSQLdeleted onlyremainingDbdcbad0a..., other3alreadygone. Original13Bob/Evan
notification IDs/context/readflags compareidentical; grantsSELECT/UPDATE/DELETE restored,
allnotificationfaultflagsabsent. Evanloggedout/currentBobleftactive; audit/sessionrows
and earlier acceptancefixtures retained. No broadcleanup claim.

Typecheckgate0; focusedlint0errors/twopre-existingwarnings;16existingcases pass onfinal
source. No newtests. RequiredCI/coordinatorintegrationpending. Source-bound private
notification-mutation-candidate.json SHA
d323a40aff2b9b5fd75b0d504e85adb1f0ec1d747ee20692893938f0bc953f46;
linked baseline/keyboard/fixture/transport/check artifacts. Durable280file MANIFEST
**a0d847a7a2d68b4a3fd00dc01572d90ce16e78193d7d4f175bf416e5c961c864**.
Ownedbackend18130 currentlauncher session71561;18131 unchanged. Private responsefault
instrumentation logs are not application edits. Next independent A05 marketplace
reachable-action verification from existing catalog/screens; route payment/Home toowners.

## PR75 — preference database failures, ready for review / CI

Coordinator grants sole writer for existing scheduling.js GET/PUT notification-preferences
handlers and schedulingNotifyPrefs.js getPrefs only. Actual Evan UI Save of Atstart
stores nested[0] but resets to defaults with success; UPDATE denial likewise returns200
and success while SQL unchanged. SELECT denial renders defaults with200. All grants
restored; exact created Evan preference row retired, restoring original absence.
Source423, private reminder-prefs-baseline.json and before/after snapshots.

Committed/pushed **5e3a8b963** on codex/stream3-preference-failures in
[Draft PR75](https://github.com/WangPantopus/skinny-pantopus/pull/75), stacked on PR73
branch423. Coordinator reviewed exact two-file source; exact-head CI35548342100 all applicable green. No older
PR ref changed. Current repair checks database errors, preserving genuine absent-row defaults.
Actual candidate UI: failed GET500 shows Try Again; restored SELECT and Retry returns200.
INSERT/UPDATE denial500 shows safe error and retains selected15/30; sameformretry200
persists one row. Canonical HTTP save/read200; read and PUT readfailure500; worker
rejects before claiming and notice/log counts unchanged; recovery200/absentdefaults200.
Existing26 scheduling regressions pass, no new tests. Evidence prefs-ui-results.json,
prefs-http-results.json and prefs-existing-regressions-final.log bound to5e3a8b963.
Exact Evan preference row retired (0); SELECT/INSERT/UPDATE restored. Successful
web save still resets due to separate nested-field mismatch; no fulljourney closure.
Concurrent first inserts/updates, installed native and provider delivery remain open.
getPrefs consumers: HTTP GET/PUT; reminder worker reads before claiming delivery;
hostWants/hostWantsKey gate existing lifecycle/reminder notification service. Existing
lifecycle wrapper catches/logs notification failure; broader delivery retry remains open.
No new storage, test, schema or presentation change. Web lead-time alignment is separate:
existing native H1/A4 use BookingPage.reminder_minutes; webH1/A4/WorkflowList use nested
prefs. Master/paid/Beacon variants inspected; no replacement implementation needed.
Controlled ownerHTTP page[0] plus SQL booking start+2min and real-clock manual worker
produced0 reminder_0m logs/notices; original page/times restored in finally. This is a
controlled API/SQL reproduction, not natural timing or UI delivery acceptance.

## PR77 — canonical web reminder timing, ready for review / CI

Coordinator assigned exactly RemindersQuickSetup.tsx, WorkflowList.tsx, and
NotificationPrefsForm.tsx reminder section. Reuse existing SDK get/updateBookingPage,
canonical reminder_minutes already used by native/worker; preserve[]/0 and existing
five/43200 limits. Existing design/channel/pause policy stays. Scope async responses
and pending timers to originating owner/mount; serialize auto-saved reminder edits.
Committed/pushed **e11123328** on codex/stream3-reminder-timing-ui in
[Draft PR77](https://github.com/WangPantopus/skinny-pantopus/pull/77), base PR75branch.
Coordinator reviewed source. Exact-head CI35549296796 all applicable green; local finaltypes/lint pass,
no new helper/test/schema. ActualH1[0]save/reload,[]→WorkflowNoReminders→A4none;
rapidA4edits under2200msfirstreplyhold persist latest15/30/60; reloadmatches.
Five-choicecap and31days rejected;30days43200 saved. Readfailure500 across all3
surfaces is explicit/retryable. UPDATEfailure H1retains/A4rollsbackconfirmed; restore
and retry saves. H1doubleSave/lostcommitted503 with neweredit retainslatest/retry;
A4pendingdeparture retires queuedsecondwrite and latecompletion. SQLgrants restored.

Actuallogout during heldEvanPUT retiresoldtab. Boblogin and reopenedH1 show onlyBob
1day+1hour; BobSQL unchanged. **Newlogin occurred1.1s after oldreply release**, so no
new-login-before-old-reply claim. Home/business owners and native/provider/offline
remainunverified. Worker0/empty/30day delivery unchanged; channel/pause mismatch and
oldWorkflow helper copy remain separate. This is persisted timingUI acceptance only.
CreatedEvanBookingPage27c8a4f3-4e62-43ef-8c40-cd25c5ae6637 deleted0; Evanprefs0,
Bobpage1440/60 unchanged; all faultflags consumed. Otheroriginalfixtures retained.
Evidence reminder-alignment-ui-results.json, page-response-faults.jsonl,
reminder-alignment-types-final.log/lint-final.log, bound to committed3file hashes.
Prior PR75 failure repair remains separate at5e3a8b963; all existing PR refs intact.

## PR80 — reminder worker settings/delivery repair, review / CI

Actual H1 saved Bob[] through realUI/API/SQL. With one existing booking timestamp
controlled to+60min, real-clock manual worker emitted a hostnotice and SMTPemail,
shown in localMailpit receipt dZecpRLTpxrcGCngB5PCbX. User selectedNoReminders.
UI[0], start1minpast/endfuture:0zero logs/notices. UI[43200], start30daysahead:
0long logs/notices. Worker source ignores[]/0 and caps scan/offset7days despite
canonical route/native30day acceptance. Each booking timestamp restoredfinally;
Bob1440/60 restoredthroughUI. Exact new60m notice/log deleted so candidate[] cannot
pass using baseline dedupe; SMTPreceipt retained private. Coordinator now grants existing bookingReminders.js and bookingNotifyService.js
formatLead only: explicit[]; integer0..43200/30day scan; recentlystarted zero only,
no early-zero send; existing120mincatchup/completion/dedupe/release; checkedpage/eventtype
read errors. Committed/pushed **6e422bd91** on codex/stream3-reminder-worker-times in
[Draft PR80](https://github.com/WangPantopus/skinny-pantopus/pull/80), basePR77branch;
Exact-head CI35550052378 all applicable green. Candidate actualH1[]→no notices/logs with earlier60m dedupe
removed; zeroearly→none; duezero2concurrentrealworker calls→1log/1host/1SMTP then
repeatunchanged;30days→1/1/1 thenrepeatunchanged. Page/EventType readfailures leave
no newnotice/log; restoredreads allowretry. SMTPfailure→host1/log0; restoredSMTP
retry→hoststable/log1/email1; repeatunchanged. Existing26schedulingregressions pass.

Exact newcandidate3logs/3notices deleted; Bob1440/60 restoredviaUI, all controlled
bookingtimes restoredfinally and allgrants restored. SMTPhealthy; its controlled
restart cleared earlierinmemory receipts (recorded taskUI/private evidence);
latestretrymail nwcabv5XDV27ai4hDogox4 remains. Originalfixtures retained.
Sourcehash-bound reminder-worker-candidate-results.json and eight linked realworker
results include precise boundaries. PR72 destinations reused with unchangedbytes.
No naturalcron/exactstartguarantee, installednative, providerrelease, lostSMTPack,
or concurrentcancellation/reschedule/settingschange acceptance. N05 staysopen.
Granted existing worker plus existing formatLead zero-label;
no cron/provider/schema/newservice change. Evidence reminder-worker-{empty,zero,long}-baseline.json,
corresponding private logs and reminder-worker-baseline-cleanup.json. ControlledSQL
timestamps/manual invocation are distinct from natural schedule/cron/providerrelease.

## PR81 — canonical host push choices / response lifetime

Coordinator assigned two existing web files, hub/notificationPrefs.ts and
NotificationPrefsForm.tsx. Actual Bob Reminder sent/P off→PUT200 and success toast,
then immediate/reload reset on. SQL nested scheduling.host.reminder_sent.push=false
but canonical notify_me.reminder=true. Real manual worker created1hostnotice/1log
and actual dropdown displayed it. Same helper blob in master/paid/Beacon branches;
reuse native notify_me contract, no replacement service/schema needed.

Committed/pushed **dd80580e4**, codex/stream3-host-notification-choices,
[Draft PR81](https://github.com/WangPantopus/skinny-pantopus/pull/81), base PR80branch.
Exact-head CI35551218783 all applicable green. Map five supported host push rows to canonical notify_me
(reminder_sent→reminder), serialize saves, latest-response guards, confirmed rollback,
retire queue/timers on owner/mount departure; explicit accessible names, same layout.
Actual off save/reload persists; worker hostnotice delta0, attendeeSMTP/log delta1
under unchanged transactional policy. UPDATE500 rolls back; restore/retry200.
Rapid changes with8000ms earlier reply held persist latest choices/reload; committed
reply replaced503 rolls back and retry200 converges. Leave with15000ms held first
write retires queued second edit. **New login before server release established (not late response delivery)**: Bob PUT held
01:29:27.913Z; logout20001:29:41.254Z; Evan login20001:29:53.325Z; Evan screen01:30:02.532Z
has own defaults before old release01:30:12.913Z; after01:30:20.813Z remainsEvan defaults.
The45s hold exceeds SDK30s timeout, so late successful client delivery is unproven.
Bounded25s repeat: Evan UI01:37:28.091Z before release31.545Z, but response/socket
destroyed=true, no finish event. Navigation/session retirement disconnects the old
request. After55.558Z Evan remainsunchanged; NO intact late-response delivery claim.
Evidence channel-overlap-transport-results.json. New exact emptyEvanpage66629ef2-03c3-44c5-bd8f-f2e677c05514
and new Bobpreference row cleaned; no app change or broad rerun.
Bob queued cancellation never saved. Reschedule/no-show also actualsave/reload/SQL.
Type gate/focusedlint passed, no new unit tests. Source hashes in private
channel-candidate-results.json; baseline channel-baseline-results.json, linked worker
records and prefs-response-faults.jsonl. Real localGoTrue/HTTP/PostgREST/SQL; manualworker
with restored onebooking timestamp/localSMTP, no cron/installed/physicalpush claim.

Cleanup: baseline newhostnotice/log removed; candidate1log removed. Exact newly
created Bob/Evan preference rows removed, both0. Auto-created empty EvanBookingPage
604f23a8-c77a-4037-a1ec-e9275e887cdc removed after verifying0bookings/eventtypes. Bobpage
1440/60 and originalfixtures retained; grants restored, faultflags consumed.
Host email, attendee toggles, dailyagenda8am and pause remain separate unresolved
policy/wiring rows; no inventedpolicy. Non-reminder rows have UI/API/SQL evidence,
not full lifecycle delivery. Home/business switches, true offline/reconnect and
same-user multitab writes remain unverified. Stream and N05 remain incomplete.

## PR82 — Security records, refresh and session cleanup

Coordinator assigned existing authDeviceService.js list helpers, authSessionService.js
listActiveSessions/listSecurityEvents, and web settings/security/page.tsx loader and
lifetime behavior. Baseline dd805: actual Security Refresh during denied
AuthSecurityEvent SELECT returned GET devices200 and “No security activity recorded
yet,” despite previously visible history. Restored grant/Refresh recovered the events.
The same list helpers returned [] for device/session read failures. Native/current
master/paid implementations and all helper callers were inspected before editing.

Draft [PR82](https://github.com/WangPantopus/skinny-pantopus/pull/82), branch
codex/stream3-security-read-errors, current review head **afe8d2f4cab1c9cbda5558f5d067451fb4a69213**,
application source **57e495460e9aaacb6c50c062ef7dfee7b3f05632**,
stacked on PR81. Three application files plus one existing assertion file. Checked reads reuse route500 handling;
warm known rows remain usable with existing retry banner, cold failure is unavailable.
Loader ordering and session/mount guards retire old results and pending confirmations.
Successful refresh resets expanded history to the existing collapsed/Show more state:
baseline39→Refresh20/noShowMore; candidate ShowMore40, failedRefresh preserves40,
restoredRetry10+ShowMore→40. No layout redesign, new service/schema/provider or unit test.

Actual local GoTrue/CUA/HTTP/PostgREST/PostgreSQL verification: cancel/wrong password
leave auxiliary Evan session200 and Bob200; valid “sign out others” yields Evan401,
Bob200 and current browser still signed in. Registry revoked, GoTrue session removed.
Three individual table SELECT failures now return devices500; standalone events500;
all restored and recovered200. AuthDevice failure during revocation now reports500
AFTER earlier GoTrue/session revocation committed; restored UI retry succeeds with0
additional sessions. This is explicit partial failure, not atomic revocation.

Initial202a candidate global sign-out regression was caught by actual UI: endpoint200
revoked Bob, but strict token comparison after expected cookie removal left private UI
busy. Final57e permits token absence only for successful revoke-all with unchanged
captured marker/mount. Existing endpoint clears the same four cookies as logout;
removed redundant second logout and retained synchronous local cleanup/token-change
broadcast. Actual final Bob global action exits private UI to login01:58:18.275Z;
Bob auxiliary401, Evan200. Local Mailpit received the security email. No physical push.

Evidence ordering limits: old devices500 was held15s, released01:49:53.963/finished.964;
a newer refresh began51.159 but its200 finished54.021. This proves old failure after a
newer request began, not after newer success. Pending unsubmitted global confirmation
retired on Evan→Bob without POST revoke-all. A separate held global response from Evan
at02:02:02.000 preceded Bob login/UI03.835 and release27.002; response/socket were
destroyed, no finish. Bob actual authenticated reload56.636 succeeded. This proves
session retirement/disconnection; **no intact old-account response delivery claim**.
An earlier held attempt logged in only after release and is not overlap evidence.

Private security-read-baseline-results.json, security-read-candidate-results.json,
security-read-http-results.json, security-response-faults.jsonl, security-global-results.json
and global-response-faults.jsonl bind source, exact sequence and boundaries. Existing
2auth suites/100 tests passed before the client-only follow-up; backend bytes unchanged.
Final web type gate/lint pass. Initial CI35552276595 failed an old exact banner-text
assertion. Coordinator granted only the two existing assertion updates (banner wording and
absence of redundant logout; retained local-clear/navigation checks). Committed
afe8d2f4c, application bytes unchanged. All11 existing page cases pass; no new tests.
Current required CI35553113322 runs at afe8d2f4c. Earlier202a/57e CI failures are retained
as obsolete-assertion failures, not current application acceptance.

Cleanup: all AuthDevice/AuthSession/AuthSecurityEvent SELECT grants restored; extra
probe sessions revoked/GoTrue0, audit rows retained. Deliberate global/revoke-others
operations revoked earlier isolated-account sessions; no session resurrection. Current
Bob browser remains for continuing work. No device keys, resume grants, physical/native,
provider activation or hosted persistence acceptance. PR82 not integration-ready until
required final CI is green. Coordinator owns all older stack refs; do not push into them.

## Installed iOS capability attempt — slot released

Coordinator granted sole heavy-native slot and existing owned simulator
0AE16FA0-E244-414F-86C8-24893BDFD979 (Pantopus Stream3 Social R2, iPhone17/iOS26.5).
Boot succeeded. CUA rejected Simulator/name and discovered bundle ID. Xcode27
installation has DeviceHub.app instead of the former Simulator path; exact path
and discovered running com.apple.dt.Devices both timed out in CUA. No build or
install began because actual screen control could not be established. Owned
simulator shutdown succeeded; final booted inventory empty. Native slot released.
No other simulator, physical phone, service reset, provider or source change.
Private native-capability-results.json, native-owned-boot/shutdown.log and
native-after-release.json bind this capability attempt to6e422bd91. Installed iOS
N03/N04 and lifetime acceptance remain open; prior evidence is not promoted.
Continue independent browser verification of existing notification preferences;
channel/pause source leads remain unverified until actual UI/API/SQL reproduction.

## Current safety milestone — merged, broader verification continues

Application worktree `/private/tmp/pantopus-workstream-accounts-social`, branch
`codex/workstream-accounts-social`. [Merged PR64](https://github.com/WangPantopus/skinny-pantopus/pull/64)
final safety head **f387cd480**, committed and pushed. Includes separately reviewable
`e83eaac91` chat actions, `b414ad6f6` cookie-login state retirement,
`72823e366` stale-request retry guard, `f387cd480` pending refresh cancellation.
Coordinator reviewed final source and exact-head CI passed; merged as **2d6ff2069**
at23:00UTC. Safety/N04 and whole Stream3 remain open.

| Reproduced problem | Existing implementation repaired | Actual candidate evidence |
| --- | --- | --- |
| Existing chat-details Report/Block had no handler. | ConversationView uses existing ReportModal, confirmStore, SDK/routes and UserReport/UserBlock. No layout/new screen/service/schema. | Real browser→SDK→HTTP→PostgREST/SQL: report, write failure/retry, block cancellation/failure, lost successful reply/retry one row, Settings find/unblock, pending departure. Earlier phase uses synthetic sign-in; persistence real. |
| Cookie login skipped session-change notification; old tab retained Bob identity/draft and disabled safety. | Existing SDK auth/client + mounted QueryProvider publish existing nonsecret marker, retire cached queries and remount account state. | Real local GoTrue two-tab Bob→Alice login replaces identity and unsaved Private setting with Alice Public default. Same-account protected401→real cookie refresh200 preserves unsaved draft/open drawer. |
| Bob's delayed401 retried under newly signed-in Dana and saved Dana→Evan block without Dana confirmation. | Existing web client binds request to originating session marker; rejects stale response/refresh/retry/cleanup. | Baseline22:37 wrong persisted actor; candidate22:40 no block/no refresh/retry. Same-account Dana401→refresh200→retry200 saves one rightful block. |
| Old successful refresh overwrote new login cookies: fresh Settings returned Bob email under Dana shell. | Existing client AbortController cancels pending web refresh on local/cross-tab account transition; mutex completion belongs to its own promise; stale apply/event/cleanup checks. | Real GoTrue refresh with all4Set-Cookie intact: baseline945ms rollback; candidate920ms preserves Dana fresh protected read. New Dana401→refresh200 also succeeds before canceled old reply release. Old400 + newDana refresh leaves Dana signed in. Two earlier >10s client-timeout attempts excluded. |

No backend/socket/native source change in PR64. Web TypeScript passes on final
source (`refresh-cookie-candidate-types.log`); focused lint0errors (one existing
Settings ts-nocheck warning in separately held A02 page). CI is distinct from browser acceptance.
Expired/failed responses and delay schedules were injected privately. Local auth,
HTTP handlers and PostgreSQL were real. No hosted OAuth/provider or installed
native acceptance. Cross-tab cancellation depends on browser storage events;
unavailable storage, frozen-tab event delivery and other browsers are unverified.
No unauthorized message or Notification rows in these safety fixtures (both0).


## Integrated A02/N03 milestones

PR65 **f30c7fe7a** merged by coordinator as **61080b399**, exact-head CI35544236662
all applicable green. Existing Settings StepUpPasswordModal and SDK optional X-Step-Up
repair missing-stepup deletion. Forward migration20260916012000 changes only two
UserBlock FKs to CASCADE, matching existing UserProfileBlock/UserReport precedent,
with lock_timeout and compatibility annotation. Actual local GoTrue UI cancellation,
wrong-password retry and valid Alice deletion removed Auth/publicAlice plus two
outgoingblocks; Charlie deletion removed incomingBobblock. Tabs retired to sign-in.
Migration only applied to owned SQL, not hosted. Broader cleanup/provider/native open.

PR66 **3a2b18be5** merged **2d12b85a7**, exact-head CI green. Existing personaBlocks
route-scoped guards fix real Follow404 with audience_profile=false; no flag activation.
Existing personas DELETE-follow checks membership/tier error versus confirmedabsence,
replacing invalid UUID sentinel. Actual UI Follow201/private membership, preference,
mute/refresh/unmute/unfollow work. Lost committed reply503 then stale retry formerly500,
now200 clears. Real HTTP duplicateFollow200/one row, repeatDELETE200, SQLread500 retains
row, blockflagoff404/unauth401. Synthetic paid marker409 restoredNULL. Existing3suites53pass.

PR67 **0e976ad84** merged **d69482d3f**, exact-head CI green. Existing owner follower
GET/PATCH reuse canonical fan serializer and safe membership fields, preserving
PersonaFollow rank1 view/counts. Actual UI formerly AuthBob/personalusername, now
fan_4e567960; mute/restore works. HTTP whitelist, nonowner403, SQLread500 verified.
Existing2suites31/webtypes pass; stale existing CI identity assertion corrected to
canonical fan fallback (7focusedpass). No new tests; native existing DTOs compatible,
no installed acceptance.

PR69 **62bc6dd61** merged **5eab68ab7**, CI35545384574 all applicable green. Existing
web post page and PostDetailPanel author links now use canonical /@stream3-local-r3.
Actual fullpage and feed-card panel clicks formerly opened missing personal profile;
now reach publicBeacon. Personal/business paths and visual treatment preserved.

## PR70 — comment privacy and failed draft evidence

Core3ea8f3495, combined6f45690a9, correctionc4cbb4138. Six existing files only:
posts.js four comment response paths/future comment+reply notifications; web
CommentThread/page/Panel submit contract; two native PulsePostDetailViewModel mappers.
Existing protected-fan policy and serializers reused. Private actor IDs omitted for
other viewers; ownactor ID remains for own controls. Blank safeauthor ID is mapped
to nil/null in native rows so private-profile navigation is unavailable. No schema,
replacement service or visual change.

Actual creator/fan UI replies save safe fan/Beacon names, ownDelete controls only;
creator reply notification click reaches exact authorized post and clears unread.
SQL AudienceIdentity readfailure500 saves no comment. Beforedraftrepair text cleared;
candidate failure retains text/reply target, SQL stays2, restoregrant sameformretry201
saves one (total3), clears. Real HTTP all4projections safe, ownedit200/owndelete200,
otheredit/delete403, outsider403; readfailure before create/edit500. Existing initial
2suites21pass, final webtypes/lintpass. Required currentCI distinct from this evidence.

Explicit controlled PersonaBlock fixture (direct SQL, no flagactivation/UIblockclaim)
plus real owner reply201 formerly saved1 notice to blockedBob; persona_id metadata
now activates existing suppression: same case0, unblockedreply1, selfreply0. Fixture
block removed in finally. Historical unsafe notices, like notification identity,
suppression-read-error behavior and native installed remain open. Ordinary personal
comment HTTP201/edit200 and actual detailUI still show local identity/owncontrols on
UI-created personal post; that post's creation used later independent helper repair.

Evidence: comment-ui-results.json, comment-http-results.json, comment-block-baseline.json,
comment-block-results.json, comment-metadata-results.json, comment-personal-results.json,
comment-final-types.log/lint.log. Relevant posts.js bytes bound to c4cbb4138 bySHA256.
Attachments/pending departure/newer response/provider/native screens not accepted.

## PR72 — real reminder delivery and destination evidence

Existing bookingNotifyService.js uses recipient-stable existing Notification key and
checked receipt after null return (duplicate and failedinsert both returnnull).
Host reminder uses existing /app/scheduling/bookings/:id with ownerquery; invitee uses
existing ownbookings list. schedulingShared preserves statusCode403 and adds status403
for actual app.js handler. No notificationService/schema/worker change.

Actual existing setup/slotpicker/form→HTTP/SQL confirmed bookings:
baseline af30791e-bf05-4e76-a9ba-63c1d1081574; retrycandidate
9c7f570c-852f-4f22-b32d-6a754555c639; registeredinvitee
7f8c6d81-1431-4328-9026-611a3b6810f6. Real SMTP confirmation receipts. Manual existing
worker at real clock, naturally due1440m offset: SMTPoutage host1/log0; baseline
retry guestemail1 but host2/log1. Baseline actualnoticeclick404. Candidate freshbooking
outage1/log0→retry1/log1/guestSMTP1; repeat keeps counts/readstate. Actual host notice
911b2828-a2b3-4ae7-9d44-fa54d41b7d88 opens correct4:15PMbooking, readtrue. Owner200,
other403(no data), signedout401. Existing26schedulingregressions pass.

Actual LogoutBob/LoginEvan→publicform matching email binds invitee_user_id Evan;
worker saves onehost/oneinvitee reminder. Evan click opens My bookings with only his
4:30PMconfirmedrow; unread2→1. This is authorized list acceptance, not exact individual
invitee detail. Local SMTP mailbox displayed real reminder and489BICS. Manualworker
is not cron cadence, externalSMTP/SMS/push or native evidence. Home/business, preferences,
lost email acknowledgement, concurrent newclaims/cancel timing remain open.
Read-only current UI/source leads: reminder UI writes scheduling.reminder_minutes,
getPrefs only returns canonical reminder_lead_times; Atstart0 is filtered by worker;
requiredphone helper promises SMS though this path sends app/email. No repair scope
started for these leads. Lifecycle notices retain old links and require separate work.

Evidence reminder-ui-results.json (baseline plus candidate/registered),
reminder-authority-results.json, reminder-candidate-*.log/json and mailbox evidence;
exact relevant service bytes bound to cbfba3503. New fixtures retained, not cleaned yet.

## PR73 — personal profile creation and three composer paths

Existing ensureLocalProfile inserted verified_resident absent from canonical table,
swallowed failure into legacy-local-*; Post UUID field rejected it. Actual Bob
Connections UI500/no post also discarded draft. Existing master and Beacon branches
share failing bytes; current table suffices, no schema/newsystem. Helper now uses
canonical fields, checkederrors and concurrent23505 reread; read-only legacyhandle
fallback preserved. Existing PostComposer, useFeedData, AppShell submission function
and feed/page wrapper return success before reset/close. Compose effect consumes only
compose after feed.user exists, preserving surface through initial shell mounting.

Actual inline/global/modal SQLread500 each retains text/form/audience with no post;
restoregrant sameformretry201 creates one/clears/closes. First post58c020b1-13f6-40cf-8b2c-8a4011e37ad4
uses realLocalProfile e18ee833-f979-4013-89e1-b3a0802bc32c. Cold Connections compose
link retains ?surface=connections and opens NewPost. Concurrent DanaHTTP201/201 yields
oneLocalProfile (unforced timing). EvanINSERTfailure500 yields0profile/0post; all grants
restored. Existing3backend suites26pass; finalwebtypespass; scopedlint0errors and
3preexistingwarnings. Personal post/comment realUI preserved local identity.

Ownposts appear optimistically but Connections reload omits them: separate unresolved
feed-reader gap, so fullposting/discovery acceptance is not claimed. Media/native,
pending departure/newer replies/duplicate browser taps remain open. Evidence
personal-post-ui-results.json, personal-profile-concurrency.json,
personal-profile-insert-failure.json, personal-post-final-types.log/lint.log,
personal-post-existing-regressions.log. Fivepersonalposts/twoLocalProfiles/owncomments
retained; exact IDs in evidence. No new unit tests.

## Runtime, retained fixtures and evidence

Owned HTTP18130 (current launcher session44858), Next18131 (60362); real app.js,
GoTrue/Kong64531/PostgREST/SQL64532 project pantopus-stream3-block-r1, private
workdir /private/tmp/pantopus-stream3-auth-r3. Host stream3-auth.localhost isolates
cookies from other streams. SMTP sink pantopus-stream3-mail-r3 binds127.0.0.1:64535
SMTP/64536UI, existing Mailpit image, only stream3-*@example.com/no relay. SMTPhealthy.
No hosted activation, retained64522 changes or anotherstream resource mutation.

Private auth-fixtures.json: Alice/Charlie deleted by actualUI; Bob/Dana/Evan active.
One legitimateDana→EvanUserBlock. Beacon persona b1cb6c08-76d3-4b30-90af-6380ee76fd25,
channel ea747ad3-ce3f-4f22-aafc-24b0868abda1, followerpost2824a813-f632-4ead-adb6-baa42e27e453,
currentBobmembership/fan_4e567960 plus comments/replies/notifications. Refollow changes
membershipIDs; fetch current IDs before cleanup. BookingPage530c443e-c3dc-4c70-884b-b9ca6cdbf8c4,
EventType0506244f-6c1e-4449-bd7e-47781154ae13 and threebookings above, related availability,
attendee/token/reminder-log/notice rows remain. Personal fixture IDs in private evidence.
AuthSession/AuthSecurityEvent/IdentityAuditLog and related records require exact cleanup.
LocalProfile SELECT/INSERT, AudienceIdentity SELECT, PersonaMembership SELECT restored;
synthetic paidmarkerNULL and temporaryPersonaBlocks removed. Mailpit memory resets on
its own restart; current candidate mailbox retained. No broad unrelated cleanup. Read-only fixture-inventory.json now records17 nonempty direct User-reference tables,3 auth users,3 reminder logs,3 booking tokens and5 availability rules. Initial read-only inventory failed on an assumed owner column; corrected to actual AvailabilitySchedule.user_id. This is an inventory, not cleanup.

Earlier synthetic phase cleaned0/stopped; current phase uses real local auth.
Adopted PR51/6055bc2b9 transactional gate and later realPostgREST/socket replay within
reported synthetic-auth/READCOMMITTED/single-counterparty limits; no duplicate rerun.
September15 rawmirror76files verified; September16 losttempraw remains source-bound
reported acceptance. iOSSimulator failure/AndroidCUA window attachment and unavailable
physicalAndroid prevent new installed acceptance; current native CI is not screen UI proof.

Primary private /private/tmp/pantopus-stream3-20260920-r1; durable private mirror
/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/
contains **234 files**, MANIFEST SHA256 **1140457cf2cec8a2497eb9c7f3995897b455d05737f6fc266ca20f992cd8348e**. Coordinator checked fourcandidate
hash bindings. Individual artifacts retain actual source/configuration, not a blanket
HEAD rerun. Credentials/tokens/operatorlogs stay private, outside Git/chat.

A01 partial recovery: realforgotUI→HTTP200→SMTPreceipt→actualemaillink opens resetform
and preserves original /@destination; SMTPoutage503 and restore/retry delivery pass.
Password entry/submission not performed (computer-use credential-change handoff boundary),
so full recovery unverified. ExternalOAuth/provider/native unavailable in currentsetup. Actual Google UI initiates
GET200 but IAB blocks exact local authorization URL (ERR_BLOCKED_BY_CLIENT); real
GoTrue HTTP400 says provider disabled. Local Google/Apple enabled=false; Apple UI
not exercised, no provider activation. Private oauth-local-boundary.json records
source/config and actual UI vs HTTP boundary; successful/cancelled OAuth remainsopen.

## Whole-stream continuation and exact next action

PR70 merged by coordinator; coordinator exclusively retargets72 and later stack; coordinator alone merges/retargets. No new
application scope before bounded handoffs known, per active coordinator. Then resume
existing N01–N05/A01–A05 coverage mapping in historical section below; no row is closed
by these milestones. N03 restrictedpost oldlink403 afterunfollow/refollowrestore and
actual notification destinations are bounded accepted evidence; UI Delivered1 is an
eligible-recipient count, not providerreceipt. N05 realSMTP now supplements prior mock
worker proof; remaining preferences/timing/individualinvitee/cancel/retry cases open.
N04 wider authorization/moderation/socket/platform cases, N01/N02 delivery/device,
A01 recovery/OAuth, A02 broader lifetime, A03 hostedstorage, A04 provider activation,
A05 remaining reachable actions remain open. Sharedschema/auth/socket/notification/
provider changes need assignment; Home/payment findings go to respective owners.

**Historical sections below retain original evidence and are superseded by this
current snapshot for Git/runtime/next-action disposition.**

## Source and reconciliation

Application worktree `/private/tmp/pantopus-workstream-accounts-social`, branch
`codex/workstream-accounts-social`. **PR #51 merged to master as `c14657e35`**;
branch fast-forwarded to that base, tree clean, nothing unpushed. Backend suite
green on the merged base (326 suites /5473 tests /0 failures). The transactional
block admission work (`6055bc2b9`) is now in master. Initial inspection found clean `fc99f8ee7`
with no later changes, PR or CI. Current master `0616d6e79` was integrated as
shared documentation only. Current pushed milestones: **`dfc860bfe`** (initial safety repair), **`41588bbec`** (native lifetime/web navigation), **`8d31d452f`** (N05 reminder failure contract), **`bf16f6f50`** (message retry privacy), **`22adc7285`** (existing retry test fixture models SQL NULL actor defaults), **`6055bc2b9`** (transactional direct-message block admission).
Merged [PR51](https://github.com/WangPantopus/skinny-pantopus/pull/51);
[CI35054358217](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35054358217) for current HEAD **`22adc728512b8dd0f261c0aaf02e255123dc7f50`**
has since **completed successfully** (confirmed 2026-09-16 on resume; it was still
in progress at the cutoff inspection). Earlier runs were superseded; initial Android
indentation failure was repaired. Green CI is not acceptance: the reproduced
concurrent block/send race below is still open, so N04 does not close. No merge or
integration approval.
Application worktree is clean: owned generated tsconfig restored to HEAD and Next
cache moved to private evidence storage after stopping the server.

The prior `fc99f8ee7` router journey used **in-memory Supabase mocks, synthetic
x-test-user-id authentication and in-process Supertest**. It exercised no
browser, native screen, PostgreSQL, RLS, PostgREST or socket transport. Its
post-unblock send returned500, so restored delivery was not proved. Historical
11 iOS/11 Android/1459 web/5430 backend totals were reported by the prior writer;
they were not recovered raw-output evidence in this resumed run. Its broad web
suite did not cover the changed blocked page or Block control. These limits are
not superseded by later evidence for a different source/scope.

## Current bounded milestone — existing N04 safety controls

Implementation repaired in `dfc860bfe`:
- Existing three-platform blocked loaders distinguish incomplete/unavailable
  results from confirmed emptiness, retaining successfully loaded rows. Native
  partial rows use the existing footer; existing screen/layout files unchanged.
- Existing block service throws `BLOCK_CHECK_UNAVAILABLE`, instead of false, on
  failed/malformed count reads. REST/chat socket and neighbor-message callers
  keep unavailable distinct from confirmed blocks. Every active participant in
  a business direct room is checked; an invalidated in-flight query cannot
  publish/cache an earlier allow. Existing room reading/admission policy remains.
- Web Report profile opens the **existing ReportModal**, SDK reportUser and
  existing `users.js`/UserReport endpoint. No replacement reporting system.
- Web list/confirmation responses retire across session changes/unmount; the
  relationship list reads the server-selected counterparty. Browser verification
  additionally reproduced a repeated current-profile-fetch loop, repaired in place.
- Existing excluded chat-access suite is now in the normal Jest runner.

Comparison/reuse: original files, archived UserBlock/UserReport contracts and open
paid socket delta were inspected. The paid delta is its independent private-gig
helper/export; no conflict or edit to that implementation. Existing native model,
chat-access and socket-session tests were extended. Two new focused web regression
files were necessary because existing privacy-preview/Beacon tests cover different
surfaces. The earlier `fc99f8ee7` adds the SDK `endpoints/blocks.ts` application file and export: existing users.ts had no UserBlock client; privacy/relationships clients address different contracts and cannot substitute. It wraps the existing blocks.js HTTP routes using the existing client; no replacement service, screen, table or migration. This resumed milestone adds only two test files.
UserBlock, UserProfileBlock, PersonaBlock and Relationship remain distinct.

## Evidence by class (do not combine these into end-to-end completion)

| Class | Current evidence and limitations |
| --- | --- |
| Baseline reproduced | New web blocked-page6/6 and report/session3/3 failures; repeated-profile read1 additional failure. Backend original21 pass/new5 fail: unavailable create/send201, second participant bypass201, delayed stale allow, missing count treated empty. Android2 distinct partial-list failures, retried to6 recorded failure executions. |
| Local regressions | **42 backend**, **12 rendered web**, **20 Android JVM**, **17 iOS model** pass. Web TypeScript passes; scoped ESLint has warnings/no errors. iOS scoped SwiftLint/SwiftFormat pass. Android formatter fixed the CI indentation defect; final full static/CI remains pending. Native screen wrapper changes are lifecycle hooks only, without layout changes. Mocked/stubbed persistence/auth applies to these tests. |
| Browser → HTTP → persistence | Actual existing profile Report submitted harassment to one pending UserReport; profile Block succeeded; Settings → Blocked Users displayed Social Bob; Unblock removed the UserBlock; failed personal list + successful empty relationship list showed unavailable/Retry, then confirmed empty after recovery. Actual SDK, HTTP, PostgREST and PostgreSQL; synthetic authentication, older retained schema, local Debug/development runtime. |
| Actual HTTP/PostgreSQL | **9/9** focused cases pass: owner list/removal isolation, bidirectional direct-create denial, duplicate blocks, reverse block after unilateral unblock, warm-cache unblock/create/send with a saved message, existing-room member reads/nonmember denial/bidirectional send denial, unavailable block read503 with no intercepted delivery effects, browser report persistence and retry. |
| Native installed | New owned simulator installed/launched with API18130. Initial preview-auth launch was insufficient (401); the accepted run used the real installed sign-in UI backed by a synthetic local sign-in fixture. Actual installed normal sign-in → Hub → Settings → Blocked users displayed persisted Social Bob; Unblock removed the UserBlock (SQL confirmed). Failed personal list + empty profile list displayed existing error/Try again; recovery/Try again displayed confirmed empty. Synthetic sign-in, local PostgREST/SQL; block creation/report/chat and session races remain unverified on installed screens. |
| Socket/provider | **6/6 actual loopback Socket.IO → HTTP/PostgREST/SQL cases pass**: both-direction denial, warm-cache transition, existing-room membership/nonmember denial, reconnect, reverse block, DB-unavailable acknowledgments/no message/notification effects, one saved/broadcast message after lost-reply retry with outsider excluded. Synthetic exact-fixture socket identity; provider calls intercepted and unrelated global typing cleanup disabled in harness. Initial3-second harness acknowledgment cutoff timed out; rerun with10-second cutoff passed. No provider/device claim. |
| CI / integration | PR51 draft/current HEAD22adc7285; CI35054358217 in progress at final inspection. Earlier Android indentation repaired. No integration/merge; N04/N05 and Stream3 remain open. |

Private detailed scripts, before/after logs, XML, SQL schema snapshot, runtime and
captured persisted rows: `/private/tmp/pantopus-stream3-20260915-r2`.
Key files: `backend-baseline.log`, `backend-final.log`, `web-baseline.log`,
`profile-baseline.log`, `profile-repeat-baseline.log`, `web-final.log`,
`android-baseline.xml`, `android-partial-candidate.xml`, `ios-partial-candidate.log`,
`http-sql-results.json`, `browser-report-persistence.json`,
`browser-unblock-persistence.json`, `ios-unblock-persistence.json`, `socket-sql-results.json`, `android-lifetime-final.xml`, `ios-lifetime-gate-baseline.log`, `ios-lifetime-candidate.log`, `android-lifetime-baseline.log` (two distinct failures retried3 each;19 executions/6 failures). Browser/simulator interactions are also in the
current **Resume Stream 3 verification** task transcript. No raw logs, fixture
credentials or device tokens belong in Git/chat. Coordinator integrates detailed
contributions into the existing report; this is not a new backlog.

## Remaining N04 work and immediate next action

Native delayed-list/late-rollback/account/leave/reopen guards now pass focused model tests. Web navigation baseline reproduced a stuck pending Block action;6 profile +6 blocked-page regressions pass after retiring route controls and updating target profile. iOS reused the exact paid branch `41c75d49a` SequencedURLProtocol gate helper with coordinator assignment. Original delay-based test was nondeterministic and is not accepted; gate baseline failed, candidate17 passed. New native lifetime code is **not yet installed-screen verified**.

Next: remaining existing profile/chat/report entry points and session/departure journeys; full-stream source binding and N05 partial-delivery/preference/destination checks. Native slot released to Stream1. New native model coverage establishes controlled session/departure behavior only; installed account switching remains open.

**RESOLVED at `6055bc2b9`** (was the open blocker at 8d31). Reproduced failure:
delaying the outbound ChatMessage insert after
REST authorization, committing B→A UserBlock first, then releasing the insert
returned201, persisted one message and delivered one `message:new` to B over the
actual socket. No Notification/provider attempt. Evidence:
`concurrent-send-baseline.json`, `verify-concurrent-send.cjs`. The six accepted
socket cases do not cover this interleaving. Existing membership-only ChatMessage
RLS/service-role insertion is not transactional block authorization. Coordinator subsequently granted the exact forward schema/test scope and isolated
migration-test DB listed in the cutoff handoff below. Repair applied within that exact grant, on isolated
SQL64532 only; no retained/shared schema changed.

`6055bc2b9` adds a BEFORE INSERT trigger on ChatMessage that, for direct rooms
only, takes deterministic unordered-pair advisory locks per active counterparty
and re-reads UserBlock. plpgsql VOLATILE gives that re-read a fresh READ
COMMITTED snapshot after the lock wait, so a block committed while the sender
waited is seen and the send is refused PT403. A matching BEFORE INSERT OR UPDATE
OR DELETE trigger on UserBlock takes the same keys. chats.js maps PT403 ahead of
the legacy insert fallbacks; the two participant system-message inserts now
record a denial instead of discarding it.

Two corrections were made to the first implementation after adversarial review,
both verified on SQL64532: (a) the UserBlock trigger's `lock_timeout='5s'` was
removed — a block waiting behind a held send was **aborting at 5002ms**, so
blocks.js returned500 and the block did not exist; it now waits and succeeds
(measured 7063ms). A timed-out send is retryable; a timed-out block is a safety
failure. (b) UPDATE now locks the OLD pair as well, so repointing a block cannot
leave the vacated pair unguarded.

Evidence: migration applies cleanly; generated pgTAP contract passes with
`scripts/db/sync-sql-contracts.cjs` unchanged (56 wrappers verified); two-connection
harness confirms denial PT403, INSERT/UPDATE/DELETE coverage, re-admission after
unblock, and the block-waits fix; backend **326 suites /5473 tests /0 failures**,
chatAccessControl **37/37** (was31/31). Fixtures cleaned (0 remaining).

**Owed live PostgREST smoke check: DONE, passing.** Real PostgREST v16.1
(cached image) on owned API64531 against owned SQL64532; retained64522 untouched.
Results:

| Check | Result |
| --- | --- |
| Control, no block, insert via supabase-js | `error: null`, 1 row inserted — legitimate traffic unaffected |
| Blocked insert, raw HTTP | **403**, body `{code:"PT403", message:"DIRECT_MESSAGE_BLOCKED", details:…}` |
| Blocked insert, supabase-js | `error.code === "PT403"`, `error.message === "DIRECT_MESSAGE_BLOCKED"` |
| The exact `chats.js` branch predicate | **fires (true)** |
| Rows persisted on refusal | **0** |
| Fixture cleanup | 0 remaining |

So the mapping does not rest on documented behaviour any more; it is observed
through the real client. The PostgREST container was removed and 64531 released.
Harness note: supabase-js builds `${url}/rest/v1/...` while bare PostgREST serves
at root, so the transit URL was rewritten in the harness; the client's own error
parsing — the thing under test — was untouched.

**End-to-end socket replay: DONE, the fix holds.** The existing 103-line fixture
runtime and `verify-concurrent-send.cjs` were copied and repointed at the owned
stack (SQL64532, own PostgREST on64531, app18140); the r2 originals are
byte-unchanged. One deliberate substitution: the original read its JWT secret from
Stream1's private file, replaced with an own secret so nothing depends on another
stream's assets.

Same script, same interleaving, same three fixture actors:

| | BEFORE `8d31d452f` | NOW `6e1758234` |
| --- | --- | --- |
| HTTP status | 201 | **403** |
| ChatMessage rows persisted | 1 | **0** |
| `message:new` delivered to B | 1 | **0** |
| Notification rows / provider attempts | 0 / 0 | 0 / 0 |
| held before insert / block committed first | true / true | true / true |

The denial is proven to come from the persistence gate, not the route pre-check
(the route returns a byte-identical body from both): direct psql INSERT raises
`DIRECT_MESSAGE_BLOCKED` at `direct_message_block_admission()` line42, and raw
PostgREST returns `403 {code:"PT403"}`. Four extra interleavings also ran:
control (201/1/1, happy path intact), reverse-direction block during the hold
(403/0/0), unblock-then-send (201/1/1, the DELETE branch does not wedge), and a
block-read fault case.

Independently audited by two agents against the live catalog: both agreed. The
installed `pg_get_functiondef` was diffed against the committed migration and
matches.

**Caveats recorded rather than smoothed over.** Authentication is synthetic
(`x-fixture-actor` header, `db.auth.getUser` stubbed) — the authorization decision
is real, the identity is not. The retired stack reached PostgREST through Kong,
which strips `/rest/v1`; this replay talks to bare PostgREST, so the harness
rewrites that prefix — a deviation the baseline run did not have. The race is
forced, not natural: the insert is parked inside the client fetch shim, before the
request leaves the process. Providers are intercepted, so `providerAttempts:0`
proves the route did not call them, not that a real pipeline would stay silent.
Single-counterparty rooms only, so the multi-key lock ordering, the
`DIRECT_MESSAGE_ACTOR_INVALID` spoofing guard and the `is_active IS NOT FALSE`
divergence are still unexercised end-to-end. READ COMMITTED only. The audit also
correctly flagged that "ran twice, byte-identical" is unverifiable from the
artifacts, that `heldBeforeInsert`/`blockCommittedBeforeMessageInsert` are
asserted-then-hardcoded literals rather than measurements, and that the
`persisted` counts are filtered rather than table counts.

Cleanup: fixture rows created14, removed14; exhaustive count over every base table
in `public`, `auth` and `storage` shows only canonical seed data remains. PostgREST
container removed,64531 released; 64532 left running. One leftover of this
stream's own making was found by the audit and reaped: a backgrounded smoke-check
process had errored without closing its `pg` client and held a session for ~63
minutes; its fixtures were already removed and0 rows of either prefix remain.

N04 still does not close: the ChatParticipant activation race, ungated message
edits (`PUT /api/chat/messages/:messageId`, outside the sends-only grant),
installed native block/report/chat lifetime and the account-deletion `UserBlock`
FK lead all remain open.

Still open: all existing block entry points, installed native socket/reconnect,
concurrent block versus already-authorized send (cache invalidation is not a SQL
transaction), multi-process cache boundaries, lost successful replies/retry,
actual offline and navigation/account transitions, PersonaBlock cascade lifetime,
report moderation and old/shared/deep-link authorization. Separate scopes retain
existing policy; do not invent profile/bid/message policies from existing UI copy.
The prior account-deletion/UserBlock FK lead remains to reproduce. Home/gig findings
are routed through the coordinator, including the gig chat-room block path.

## Reproduced: account deletion is blocked by UserBlock (A02 / N04 lead)

**Reproduced at the database level on isolated SQL64532**, not inferred. Both
`UserBlock` foreign keys to `"User"` are NO ACTION and the deletion handler in
`backend/routes/users.js` never touches the table (`grep -n UserBlock` there
returns nothing), so:

| Case | Result |
| --- | --- |
| Delete a user who has blocked someone | `ERROR: violates foreign key constraint "UserBlock_blocker_user_id_fkey"` |
| Delete a user **someone else** blocked | `ERROR: violates foreign key constraint "UserBlock_blocked_user_id_fkey"` |
| Delete after the block row is removed | succeeds |

The second case is the serious one: a third party who blocks you can prevent your
own account deletion. All fixtures were created inside a transaction and rolled
back; 0 rows persisted.

**`UserBlock` is the lone outlier among the sibling contracts** — this is a
consistency repair, not a new policy:

| Table | FKs to `"User"` |
| --- | --- |
| `UserProfileBlock` | both ON DELETE CASCADE |
| `UserReport` | both ON DELETE CASCADE |
| `Relationship` | requester/addressee CASCADE (`blocked_by` NO ACTION — same class, likely masked because the blocker is also requester or addressee) |
| `UserBlock` | **both NO ACTION** |

**Grant requested before any edit.** Two candidate repairs, both outside the
current grant:
1. Forward migration aligning the two `UserBlock` FKs with the CASCADE precedent
   its siblings already use. Smallest and consistent; no applied history rewritten.
2. Clearing the rows in the `users.js` deletion handler, matching how that handler
   already treats other tables.
Recommend (1), with (2) only if the handler must stay the single point of truth.
`backend/routes/users.js` and FK-altering migrations are not in this stream's
current assignment, so nothing has been edited. `Relationship_blocked_by_fkey`
should be assessed at the same time by whoever owns it.

## Whole-stream coverage reconciliation (existing inventory rows)

| Rows | Existing implementation/evidence to preserve | Remaining acceptance |
| --- | --- | --- |
| N01–N02 | Notification routes/dispatcher/DeepLinkRouter/AuthManager; [platform report](../notification-platform-verification-2026-09-09.md), [iOS continuation](../ios-notification-continuation-2026-09-09.md), [chat continuation](../chat-notification-continuation-2026-09-09.md), existing Home Task routing reports. Reported Android FCM emulator permission and exact post/chat return are distinct from iOS synthetic installed navigation and owner-confirmed physical iPhone Beacon preferences. | Bind unchanged source/config before reuse; remaining foreground/background/cold-start, token/account/unread/preferences matrix. Physical Android unavailable in recorded setup; no new hardware granted. Provider-delivered versus saved records must remain separate. |
| N03 | Nearby → Pulse/Beacons/Connections, directory/following/profile/post routes; [social discovery](../social-discovery-2026-09-06.md), screen-parity/native wiring catalogs. | Current cohort flags, posting eligibility, reply/conversation return, mute/unfollow, identity/access-change/old-link boundaries. Historical local fixtures do not establish release/provider acceptance. |
| N04 | Current milestone and limitations above; existing blocks/privacy/relationships/persona/report/chat contracts. | Complete the remaining matrix above; current milestone does not close row. |
| N05 | Existing calendar editor, calendar service/RPC/briefing signals and reminder jobs; [calendar reliability](../calendar-reliability-2026-09-06.md). Saved pickup rules deliberately no longer promise night-before push. | Trace each still-promised reminder through worker, retry/preferences and actual authorized destination/delivery. A saved schedule is not delivery. Coordinate Home calendar ownership. |
| A01–A02 | Existing auth forms, users/auth routes, provider callbacks, session/device stores; [sensitive auth](../native-sensitive-auth-2026-09-09.md), [form hydration](../web-auth-form-hydration-2026-09-12.md), notification continuation and accepted Home account-lifetime reports. | Real signup/verification/recovery/OAuth/provider failures and remaining session expiry/revocation/logout/account switching/local retirement. Current synthetic sign-in does not satisfy provider acceptance. Shared auth edits need assignment. |
| A03 | Existing upload/storage/document paths; accepted file-picker PR44, document/upload reports linked in verification reconciliation. | Hosted Auth/Storage/quotas/permissions and native chooser/provider boundaries. Obtain shared-file ownership before edits; no storage change assigned here. |
| A04 | [Provider report](../staging-provider-acceptance-2026-09-09.md): historical Google premise success, Smarty402/no active subscription, Google/Apple OAuth disabled in staging, Lob test request/outage evidence. | Read-only current configuration/source reconciliation first; activated residential/provider/OAuth capability unverified. No purchases, subscriptions or provider activation authorized. |
| A05 | Existing screen-parity/mobile wiring catalogs, current web page/component routes, Root/Hub/Settings/feature navigation, Calendarly inventory. | Reconcile reachable actions against current source and actual UI. This pass already verified profile safety and found/fixed the profile read loop. Marketplace/subscription/booking/wallet/mail/search remain to trace; Home/payment findings go to owners. |

These are coverage mappings to the authoritative N/A rows, not new acceptance
closures. Loading/error/retry, accessibility and session lifetime accompany each
journey. Native/web appearance remains protected.

## Coordination and active resources

Granted: blockService.js, direct-chat socket handlers, chats.js and bounded Jest
suite inclusion. Broader auth/notification/shared SDK/schema/storage edits need
new coordinator assignment. Coordinator notified of baseline/final evidence and
owns shared report publication and eventual review/merge.

Final cleanup at **2026-09-15 21:13:58 PDT**: stopped owned HTTP18130/PID91147
and web18131/PID93370; process inspection confirmed both absent. Exact three synthetic
User IDs `f9150300-0000-4000-8000-000000000001` through `...0003` and their owned
rooms/block/report/relationship/notification/audit rows were retired by the runtime's
transactional cleanup. Correct UserProfileBlock ownership column is `user_id`.
Fresh `cleanup.json` reports **0 remaining fixture users**; `final-cleanup-state.json`
binds cleanup time and source. Earlier wrong-column cleanup had rolled back and is
not final evidence. No REST18089 access, retained SQL64522 schema/reset/container
mutation or another stream's fixtures. HTTP18130/web18131 are released.
Heavy native slot **released to Stream1** after final20 Android/17 iOS runs; no new local native build/install until coordinator releases it. New simulator
**Pantopus Stream3 Social R2**, ID `0AE16FA0-E244-414F-86C8-24893BDFD979`, iOS26.5.
App build uses explicit API/socket18130 settings; no existing simulator/physical
phone was installed or changed. Owner's iPhone17 remains untouched. Owned simulator shut down after the run. Android JVM
run finished; no Android AVD acquired. Generated products and logs are private.


## N05 bounded milestone — booking reminder failure contract

Source `8d31d452f`: existing scheduling UI/API/BookingPage.reminder_minutes →
`jobs/bookingReminders.js` → `services/scheduling/bookingNotifyService.js` →
existing Notification/emailService. Worker already releases BookingReminderLog
when delivery throws. Baseline existing schedulingLogic suite23 passed/new3 failed:
email `{success:false}` and personal Notification null both resolved as success,
and the worker kept its sent-log row. The granted service-only repair checks these
results and throws; unchanged worker now retries then deduplicates the accepted
receipt. All26 tests pass with mocked database/provider responses. No schema,
provider activation, worker or notificationService edit. This is not real delivery.
Partial-recipient retry duplication, lost provider acknowledgments, exact timing,
preferences and authorized destination still need verification. Detailed private
`n05-booking-baseline.log`, `n05-booking-worker-baseline.log`,
`n05-booking-candidate.log`. N05 remains open.


## N04 follow-up — message retry privacy

Actual8d31 HTTP/PostgreSQL baseline: fixture C (not a member of A/B room)
submitted A/B's known client_message_id in its authorized C/A room and received200
with A/B's private message/author/room. Existing chats.js lookup filtered only the
global unique client ID, contrary to its same-room/sender comment. Inbf16f6f50 the
existing lookup and23505 recovery bind authorized room, sender and human business
actor; wrong-scope collisions return409 without content/effects. No new schema.
68 existing focused backend cases pass (one first-run socket-hang-up in chatRoutes
passed on the affected repeat). Actual HTTP/PostgreSQL3/3: outsider409, original
actor authorized retry200, concurrent same-scope200/201 with one saved row. Business
actor separation is model-tested only. Existing excluded delivery suite's two retry
cases initially failed because its fake insert omitted PostgreSQL's NULL actor
default; the existing fixture now models that default and both cases pass. A CLI
ignore-pattern override initially selected unrelated suites and is not acceptance;
the corrected private config ran exactly the two delivery cases.

Evidence: cross-room-retry-baseline.json, retry-scope-baseline.log,
retry-scope-final.log, retry-scope-results.json, retry-delivery-focused.log,
retry-delivery-final.log. This repair does **not** fix the transactional block race.

## Cutoff handoff — exact next action and reservations

User requested immediate wrap-up; no further implementation or tests were started.
All application changes are pushed in draft PR51 at22adc7285. Coordinator's prior
review covers onlydfc860bfe; newer lifetime, reminder and retry milestones still need
coordinator review. Coordinator also paused on user request; heavy native slot was
released, but recheck live reservations before any new build/install.

**Done on resume (2026-09-16):** the concurrent admission failure is repaired at
`6055bc2b9` and pushed. **Next action:** stand the fixture API back up on an owned
port against an owned database, replay `verify-concurrent-send.cjs` against the
fix, and confirm the PT403 → HTTP403 mapping through real PostgREST. Then continue
the whole-stream coverage table; do not stop at N04.

Coordinator already granted these exact files (no need to request the same grant again):
- `supabase/migrations/20260916010000_direct_message_block_admission.sql` (forward migration).
- `scripts/db/contracts/direct-message-block-admission.sql` (new source SQL contract).
- `supabase/tests/direct-message-block-admission.test.sql` (generated with existing
  `scripts/db/sync-sql-contracts.cjs`, leave generator unchanged).
- Existing `backend/routes/chats.js` denial mapping and existing
  `backend/tests/integration/chatAccessControl.test.js` focused regressions.

**No files in that new migration/SQL-test scope have been created yet.** Existing
application baseline, archived034/037/072 and open branch work were compared: no
transactional UserBlock admission contract exists. Applied history must remain
unchanged; use existing tables/columns, no replacement service/table/screen.
Scope is **direct-room sends only**, current human actor versus all active
counterparties. Do not widen gig/group/read policy or direct-create RPC scope.
Current send uses human request identity for authorization and stores business
sender separately in `user_id`, human in nullable `actor_user_id`. Current
`get_or_create_direct_chat` has no SQL block guard; its race is separate, unverified.

Proposed approach, **not implemented or validated**: deterministic unordered-pair
locks shared by UserBlock mutations and direct ChatMessage admission, with a fresh
block check after waiting. Inspect participant roster stability and all active
counterparties; do not assume cache revision solves SQL concurrency. Preserve the
existing no-counterparty behavior and room-read policy. Required contract evidence:
real two-connection wait/commit orders, rollback, reverse blocks, business actor,
empty/no-member cases, service-role trigger enforcement, grants/search_path, and
isolation limits. In particular test snapshot behavior beyond READ COMMITTED,
roster changes, lock order/deadlocks, and actor spoofing. Avoid accidentally invoking
chats.js legacy insert fallback through error text containing actor_user_id or
check-constraint patterns. SQL errors must fail closed without message/socket effects.

Owned isolated DB is **left running for the next agent**, canonical schema only;
no fixture phase or new migration began:
- Workdir `/private/tmp/pantopus-stream3-block-db-r1`.
- Project/container prefix `pantopus-stream3-block-r1`;
  container `supabase_db_pantopus-stream3-block-r1` healthy, SQL64532.
- API64531/shadow64533 remain reserved; API runtime was not started.
- Supabase PostgreSQL17.6.1.165/PostgRESTv16.1 cached locally. Existing canonical
  migrations replayed successfully. Initial config without auth bootstrap failed
  and CLI removed its own failed container; restored canonical bootstrap passed.
- `supabase/migrations` and `supabase/tests` symlink to application canonical paths.
  Config differs only for isolated project/ports. Never reset SQL64522, use
  Stream1'sf9150410 fixtures, touch REST18089, or activate hosted migrations/providers.

Owned simulator `0AE16FA0-E244-414F-86C8-24893BDFD979` remains shut down. The installed
run predates the native lifetime repair; installed lifecycle acceptance remains
open. No Android installed or physical-device acceptance was obtained.

**Durable evidence:**
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260915-stream3-social-r2/`
contains **76 files** refreshed at cutoff, including final cleanup, retry/privacy
and isolated DB bootstrap evidence. `MANIFEST.json` SHA256:
`f5ac697ba9f06552aeda14b1bbfa01f4b795779817bcf4f9bbe1e368956bac13`.
Individual evidence retains its actual source/config; manifest current HEAD does
not mean every earlier check was rerun. Directories700/files600; private scripts
and operator logs stay out of Git/chat. Original private runtime/scripts remain at
`/private/tmp/pantopus-stream3-20260915-r2`. Large ios-derived and retired Next cache
were intentionally excluded from the durable mirror. Browser/simulator action
history remains in task `01a0a824-301b-74e3-a1d9-b205714ed7a1`.

After the transactional milestone, continue the whole-stream coverage table above;
do not stop at N04. N01/N02 historical Android evidence at699c531a predates changed
AuthRepository/PendingDeepLinkStore source253d5c6cf; bind newer accepted evidence
before reusing those session claims. N05 SupportTrain's shared last_reminder_sent
24-hour/day-of behavior is a source lead, not a reproduced defect; new worker edits
need assignment. Native chat block/report lifetime and account-deletion UserBlock
FK are also unverified leads. Route Home/payment findings to owners. This file is
the sole live Stream3 status; coordinator owns detailed shared-report publication.


## Final persona-mute CI and integration disposition — September21 06:19UTC

Independently verified GitHub PR99 **MERGED** at2026-09-21T06:19:04Z as
**dd24f0029c58dd38e201a9fe6b349eda317361d7**, from exact
**1d835733025cf85cae00f000f61c1c45d509b642**. Automatic
[CI35567483902](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35567483902)
completed **SUCCESS:8 applicable jobs passed/3 path skips**. Passed: detection,
deployment/migration safeguards, backend privacy/Jest, web lint/typecheck/Jest,
identity E2E, backend image, complete schema replay/lint and aggregate CI OK.
Android, iOS and Seeder skipped; this supplies no new installed-native acceptance.
Coordinator reviewed and merged; author did not self-merge or activate hosted migration.

This supersedes the earlier pending-CI/review/integration wording for PR99 only.
Application checkout stays frozen1d835, clean except owned .next-stream3; no source
edit or repeated journey. The387-file private evidence manifest and exact cleanup
remain unchanged. Recorded real UI/API/SQL, controlled transport, session source-review,
unmute HTTP-only, one-active-persona, native/provider and broader row limits all remain.
Owned runtime and original retained fixtures preserved as recorded above; no new scope.
Whole Stream3/N03/N04/A05 are not closed by this integration.

Coordinator captured prior live03c09d8f4a in documentationPR100. This append is the
only Stream3 status change; coordinator owns publication. Paiddd0 fullCI35567323534
was still running native jobs at coordinator handoff and remains a separate gate;
no claim here about its completion or persona integration into that branch.

## PR115 final exact-head CI

Independently confirmed automaticCI35577904476 completed SUCCESS on exact
e47eb37de098f076b307d109ee20953b45b51307. Final job receipt is
professional-auth-ci-latest.json; durable mirror now471files, all hashes verified,
MANIFEST **a653476145474080a0f32bc48382d48ecc2fce31c79b163a4ea0cb3114d3afaa**. Source remains frozen;
no repeated runtime journeys, new fixture or policy expansion. PR114 exact59bCI also
passed. Coordinator owns review/integration; no broader/native/UI acceptance implied.

## Private professional blocked-housemate baseline — verification only

Coordinator granted actual HTTP/SQL verification, no helper edit. Separate branch
at e47 preserves114/115 refs. Read live canViewProfessionalProfile/shareHome and
Home/HomeOccupancy schema plus installed triggers before narrow fixture creation.
Actual private active-housemate read200 with no relationship; both viewer→owner
and owner→viewer blocked Relationship still200/profile returned. Mark viewer occupancy
inactive or ended yields403. Existing helper tests connection then shareHome without
private-branch block check. General getProfileVisibility already checks Relationship
blocking before shareHome. Proposed move existing professional block guard above
public/private split after self/inactive guards; assignment pending, no app edits.

Exact5temporary IDs and5responses in professional-housemate-baseline.json; cleaned
Home,HomeOccupancy,UserProfessionalProfile,Relationship back to original counts0,
auxiliarylogout200. No provider/UI/native claims, no borrowed Home runtime or policy
change. Existing115 owner/anonymous/public/connection evidence reused, not repeated.
Mirror now473files/hashverified; MANIFEST **1bd399a723dcd9af9c7ae063a05c3bcfe87111db455d740b753a52e86a45c214**.
Next: coordinator helper-scope review and existing/archive/open comparison before
any repair. Prior471 PR115 evidence remains source-applicable; current milestone
does not close N04/N03 or broad housemate authorization.

## PR117 final exact-head CI

AutomaticCI35579542422 independently confirmed SUCCESS on exacte729a516a87fb4e406b93462a86ff5b57d6a25d0. Final job receipt professional-housemate-ci-final.json;
durable mirror482files all hashverified, MANIFEST **5cbf7d8b2530cfe1bd323bbdadd8f0937543699c103d41536fe6ebc63f1bdb5c**.
Earlier481source/runtime artifacts unchanged; no repeat journey/new fixture/code edit.
Coordinator owns review/integration, held behind paid fullCI; no whole-stream closure.

## PR120 final exact-head CI and source-only limits

Coordinator reviewed493files/fivebindings and captured live03248883e0 in f07a40cdc.
AutomaticCI35583298837 now independently confirmed SUCCESS on exact
03279bd78b2c9691bcfb5fc76305a1b38834a78f. Final jobreceipt scheduling-resume-ci-final.json;
mirror494files allhashverified, MANIFEST **88077e0ddcd7fa4c4b32c607d1cd0f2f53a57ca289699a95a412f53981bdfc1d**.
Source frozen; no repeated runtime acceptance/new fixture/app change. Coordinator holds
new featuremerges/repairs behind paid a795 fullCI.

Source-only N05 reconciliation: notificationPrefs.ts daily_agenda row promises each
morning8am, but scoped backend search found no key consumer. Existing bookingReminders
cron is minutes3,18,33,48 in jobs/index.js. Prior manually invoked worker/localSMTP
evidence does not establish natural scheduler/daily-agenda delivery. These are separate
unverified contract leads, not missing-feature proof or new delivery-policy authorization.


## N05 natural scheduler verification — active September21 10:28UTC

The later top-README runtime-only grant supersedes the earlier pending proposal.
Resumed/adopted private harness and plan; no existing child or SQL fixture was running.
Import inspection selected bookingReminders and skipped49 registrations, with zero
network requests/sockets/violations. Source b409 unchanged; retained API7996/Next14742
remain untouched. Full retained Booking3/Page1/ReminderLog3/Notification20/EventType1/
SchedulingNotificationPreference0 rows and Mailpit12 messages captured privately.
Exact temporary Booking be6c416f-550e-4d56-80e0-01d4e524aca4 created; one private
child armed for original UTC10:33 tick, no manual worker call or time advance.
Every Booking query/sweep scoped to that ID; downstream fixture-only writes/local
transport guards installed before imports. Current acceptance pending callback,
SQL/SMTP observation and cleanup. Private scheduler-natural-* artifacts in existing
20260920-r1 directory; no application changes/new unit tests/provider/native work.


## N05 isolated natural tick — completed September21 10:33UTC

Unchanged b409 selected bookingReminders registration ran once at10:33:00.005UTC
for original10:33:00.000 schedule (node-cron4.2.1), without manual invocation or
time advance.49 other registrations skipped. Guards installed before imports:
zero violations,14 real local PostgREST calls, every Booking GET/PATCH exact-ID
scoped including terminal sweep. Real receipt POST201 and Notification POST201;
local SMTP accepted one exact invitee email at10:33:00.156. SQL snapshots confirm
one new reminder_60m receipt and one saved host notification, no unrelated additions
or retained mutations. Child stopped after one callback and exited0; independently
confirmed absent. API7996/Next14742 remain retained/unchanged.

Exact cleanup: Booking be6c416f-550e-4d56-80e0-01d4e524aca4, ReminderLog
6417de49-52a8-471d-9cd5-941261f1c6fb, Notification129c7777-aace-460e-bfee-58bde8e76e79
and Mailpit message DZ7KzVpdR4MKPd73fxm9Sv removed. Full Booking/Page/ReminderLog/
Notification/EventType/SchedulingNotificationPreference rows equal pre-test snapshots;
original12 Mailpit message IDs restored. No grants, sessions, providers or appfiles
changed; no new unit tests or repeated manual-worker journey.

Evidence scheduler-natural-source/import-inspection/result/observations/cleanup.json
and private harness/snapshots in existing durable accounts-social-r3 directory.
Mirror 511files allhashverified; MANIFEST **6eeeb6178d8bbca87ac1fc1a31b18e1f6f66b37b7d598c4a7555e4accc964ebd**.
Synthetic boundaries: selected-job registration filter, exact query/write/transport
isolation and SQL-seeded booking. Timer, PostgREST/SQL persistence and local SMTP
were real. This is not a new UI journey, unmodified all-jobs startup, hosted provider,
physical-device/native or daily-agenda acceptance. Prior UI/manual-worker evidence
retains its own sources/limits. No implementation commit/PR/CI needed for runtime-only
work; integrated PR120 gates remain unchanged. Whole stream remains incomplete.
Next: coordinator evidence review/next bounded assignment; unresolved daily-agenda,
worker pause/channel policy, after-final-check cancellation and provider/native/session
boundaries remain open. Do not repeat this accepted isolated timer check unchanged.


## Pause/resume source contract — next bounded proposal

Source-only grant: separate codex/stream3-scheduling-pause-contract adopts
9ae572d748cadad856b5a2c8561e7bc3e7cc4624; prior refs/evidence/retained runtime preserved.
Diff from b409 is coordination docs and Home role caller only; accepted scheduler
source bindings unchanged. Seven current/archive/open references,49 source bindings
recorded in scheduling-pause-source-reconciliation.json. No runtime or app changes.

Web NotificationPrefsForm reads scheduling.paused and Resume persists false via
existing per-user preference GET/PUT/JSONB. Banner promises Notifications paused /
Emergency alerts still come through. iOS and Android notification models instead
read BookingPage.is_paused and Resume updates that page flag. Existing web accepting-
bookings card says Bookings are paused / New bookings are turned off; public scheduling
route uses is_paused to reject new bookings409. These are distinct persisted contracts.
Native parity/runtime effects remain unverified; do not conflate or change either policy.

Existing schedulingNotifyPrefs hostWants/hostWantsKey read notify_me only; worker
uses reminder offsets and sendBookingReminder invokes hostWantsKey(reminder). Service
explicitly documents host in-app/push gating with transactional invitee reminders
unaffected. Source predicts host saved-notification delivery despite scheduling.paused,
but no new delivery failure reproduced. Email/attendee/emergency/daily-agenda behavior
is not specified sufficiently to invent broader suppression rules.

Propose one new exact temporary booking and host preference scheduling.paused=true/
notify_me.reminder=true, preserving original absence. Bind actual web paused banner
to GET/SQL, run existing worker once with exact fixture/query/write/local-SMTP guards,
observe saved host notification separately from transactional invitee mail, clean exact
rows/mail and verify retained snapshots. Reuse accepted Resume persistence and natural
timer evidence; no repeat timer or provider/native sends. Runtime execution and any
repair await coordinator assignment; source-only grant fully completed.

Durable mirror now510 hashesverified, MANIFEST **1db1537fc545f860e72ce2c1189ed9b5f230c60517184d8b71acf671e22a9819**. Two natural-check
raw import/runtime log copies removed from durable bundle as requested; originals
preserved private in20260920-r1. Structured import/result/SMTP/SQL/cleanup receipts
remain, so accepted evidence is intact. New source-only head does not imply rerun.


## Web paused notifications — reproduced delivery baseline September21 10:41UTC

Runtime-only grant executed on9ae source, existing API/Next retained. Real authorized
Bob GoTrue UI sign-in → notification settings shows Notifications paused / Emergency
alerts still come through, disabled host controls, Resume. Exact SQL-seeded preference
c2afadb8-91d5-4011-829e-6c9c72c74247 has scheduling.paused=true/notify_me.reminder=true.
Initial actual GET200 logged; zero-delay unmodified reload GET304 binds Bob actor to
current cached representation. First private assertion wrongly expected200 and rejected
304; corrected receipt retains this limitation. No response fault or synthetic auth.
Known local expired-session origin issue required ordinary sign-in at configured origin;
this does not establish expiry continuation acceptance.

Unchanged worker manually invoked exactly once under accepted exact-ID/query/write/
recipient/local transport guards (not natural timer). Zero violations, real host
Notification a7a9be50-acaa-4f82-80da-06d635bf21ed saved despite paused banner/SQL.
Receipt661c99de-209f-487c-afb1-0584cd7a969e saved; one transactional invitee localSMTP
mail accepted10:40:42.961 and observed separately. UI after delivery still paused;
no physical push/provider claim. Source confirms both hostWants/hostWantsKey ignore
scheduling.paused. Proposed smallest repair: each existing host gate returns false
on strict prefs.scheduling?.paused===true before existing notify_me check. Preserve
invitee transactional branches/page availability/offsets/error handling/UI. No edits;
coordinator assignment required. This does not define emergency/email/attendee policy.

Exact temporary booking70d010f7-ccc8-43e0-a35e-e48d8fdc1b95/preference/log/notice
and mailPRRojHUrBgNKzwUTKsvLnu removed. All six full retained-table snapshots equal
originals, preferenceabsence0 restored, original12 mailIDs restored. Child exited0
and absent, tab19closed, retained API/Next/DB unchanged. Ordinary browser authsession
retained; auth/audit tables are not claimed restored. No grants changed/new unit tests.

Private scheduling-pause-* structured evidence/UI captures/operator scripts mirrored,
raw runtime log remains private only. Durable 526files hashesverified; MANIFEST
**d4139b811d92ce4f2e6ee36521ab2c3929815c117691d5d2a233fe6adfac4d5d**. Prior Resume and natural scheduler acceptance reused without rerun.
Next coordinator review/exact repair assignment; native page-pause mismatch/dailyagenda
and full-stream provider/session/native boundaries remain open.


## Host pause gate repair — candidate verified/pushed September21 10:51UTC

Exact README grant followed; only schedulingNotifyPrefs.js hostWants/hostWantsKey
add strict scheduling?.paused===true false-return after successful getPrefs. Two
added lines, existing recipient/default/read-error/page/offset/UI contracts preserved.
Source **efaeaab5c4db7191dacd1a7da280bfbf7f35fa29**, branch
codex/stream3-scheduling-pause-contract pushed; draft publication/automaticCI pending.
No new tests, source baseline/49bindings and prior Resume/natural timing reused.

Candidate actual paused web screen, SQL preferencea22a6f22-6e22-4f91-a595-822b756ca99d:
manual unchanged worker plus existing notifyBookingEvent(confirmed) consumer produce
zero host notices and two transactional localSMTP emails. Actual web Resume PUT200
persists paused:false; fresh booking plus same two callers produce host reminder and
confirmation notices, two more local emails. Candidate children load repaired source;
retained API uses unchanged preference persistence. Confirmed fanout directly invoked;
booking-confirmation transition UI/API itself was not exercised. No natural timer rerun,
provider/device/native/emergency/dailyagenda/channel expansion. First fresh-booking
insert violated existing overlap constraint (no row/delivery); nonoverlapping due slot
used for successful case. Guard violations0 in both children, both exit0/absent.

Exact2bookings0f9085c5-6fb8-432f-9d80-f78250a495da and
c54a0168-5ee9-4f2c-872d-06ea0eed1082,2receipt rows,2hostnotices,1preference and4mail
messages deleted; all exact IDs in scheduling-pause-candidate-cleanup.json. Six full
table snapshots and original12mailIDs restored; preferenceabsence0, tab20closed,
retained API/Next/DB unchanged. Ordinary browserauthsession retained, no grantschanged.
26 existing schedulingLogic tests pass, node syntax/diffcheckpass. Runtime/import
rawlogs remain private only; structured final receipt records checks and limitations.
Durable 549files allhashverified, MANIFEST **b618852cdd9bc76a6db517a6f53720b849fdf70c3af0af76f585f5c924299c89**.
Next required automaticCI/coordinator review; no selfmerge/whole-stream closure.


PR126 published draft https://github.com/WangPantopus/skinny-pantopus/pull/126.
Exact efaeaab5c automaticCI35590893520 completed SUCCESS (6applicable passes/5path
skips), including backend/privacy, image, schema and CI OK. No new web/native
acceptance. Final CI structured receipt mirrored:550files hashesverified, MANIFEST
**d4efa3b39f3a7e2e7aff66ee7f746819b707a5281bcbaa3e3a5fda03977839eb**. Coordinator owns review/integration; source frozen and no rerun.


## Host channel source-only reconciliation after PR126 integration

Independently confirmed126 MERGED5b80279643bb72c800648cb922685e8818afc4f1,
updated49becdb41 exactCI35591151829 success; accepted gatehash8c40b8d4 matches.
Separate codex/stream3-scheduling-channel-contract adopts5b802, preserves priorrefs,
evidence and retained runtime. No new appedit/runtime/tests or accepted-journey replay.
Seven refs/49bindings in scheduling-channel-source-reconciliation.json supplement
existing maps. Web host Push writes notify_me plus nested scheduling.host row; Email
only writes nested email. GET/PUT preserve JSON. Existing host gates precede saved
Notification insert; shared notification service then independently gates physical
push using global MailPreferences/type prefs. Saved notice is not physicalpush.
Native host P/E bind one notify_me boolean, not separate nested email (source-only).
Existing scheduling fanout emails non-user invitee; no host nested-email consumer
found in inspected delivery path. Existing recipient policy keeps invitee transactional
reminders; emergency/dailyagenda/hostemail policy cannot be invented from this search.

Propose one exact temporary unpaused prefs+due booking; actual web Reminder sent
Email off→on while Push/notify_me.reminder staysfalse, preserve unknownkeys, bind
PUT/GET/SQL/reload. One unchanged manually invoked worker with exact query/sweep/
write/recipient guards/localSMTP only; observe hostemail independently of savednotice
and transactional inviteemail. Allow exacthost/inviteerecipients only and reject external
providers. Fullsnapshot/exactcleanup, no timer/native/provider rerun. This is proposed
verification, not reproduced defect or repair authorization; awaiting coordinator scope.
Durable 551 hashesverified, MANIFEST **a3c5e0d35c33106683d8489155152a58e68f98f4f7cb38bea9dba54531de5852**. No rawlogs added.


## Host Reminder sent Email — actual baseline September21 11:02UTC

Granted later-batch runtime-only check on5b802; no appedit. Exact actorBob matches
bookinghost. Actual existing web Emailoff→on, Push staysfalse; instrumented PUT200
identifies actor, SQL retains notify_me.reminder=false, nestedhost.reminder_sent.email
true and sentinel. Actual reload GET200 sameactor/visible Emailon Push off. Initial
Playwright checkbox selector found no DOMrole match; observed native AX checkbox
click succeeded. No request occurred from failed locator.

One unchanged manually invoked worker, exactfixture/sweep/write/recipient/socket
guards, violations0, exit0: one reminder receipt, no host Notification, no host SMTP,
one transactional invitee SMTP accepted11:02:18.081. Saved Emailon therefore does
not produce host mail in this bounded existing reminder path. Source map established
no nestedhostemail consumer; existing getUserContact/bookingEmailHtml/emailService
and worker failure release can be reused. Propose extend existing sendBookingReminder
only for strict explicit host email opt-in independently of push, respecting strict
pause, exacthost contact and existing email/template transport; require success and
preserve invitee/default/page/shared-service policies. Lookup/suppression handling and
partial-recipient retry boundaries must be resolved in exact repair grant; no new
system/schema/defaults or implementation yet. This does not close other host emails.

Exact bookingf09a3df3-2a72-4c93-8255-8a09cf31d119,preference
2a02dc86-61e1-4007-9a43-d372d7259f60,receiptbce24579-1567-40b4-9a92-e4eca7b023ec
and Mailpit7WYq9JJMpa5vJB9V5Lga3y removed. Six fulltable snapshots/original12mailIDs
restored; originalprefabsence0, no hostnotice created. Childabsent/tab21closed, retained
API/Next/DB/authsession unchanged. No grants/providers/native/timer/newtests. Initial
prefs/booking SQLseeded, actual UI emailcommand; manual worker/isolation limits explicit.
Structured scheduling-channel-* receipts/UI/snapshots/scripts mirrored, rawlog private.
Durable 567 hashesverified, MANIFEST **0acba78f4c5cb57089dfdfedd98f587ad2874786c2a7babdef4f9ae9ffc0ac88**.
Next coordinator evidence review/exact repair proposal; closed125/126batch untouched.


## Host-email repair proposal — contact/suppression/retry source reconciliation

No code/runtime changes or baseline rerun. Sevenrefs/42bindings added in structured
scheduling-channel-repair-proposal.json. Exact proposed path only existing
bookingNotifyService.js sendBookingReminder: explicit nestedhost reminderemailtrue,
strictpausefalse, exactassignedhost (no owner fallback), checked existing User contact
select fields, existing template/format/emailService. Lookup error/missingrow/emptyemail
throws before email fanout and worker releases receipt; no silent completed delivery or
address fallback. User.email normally NOTNULL; invalid-data case must retain synthetic
boundary if canonical fixture cannot express it. Existing generic getUserContact callers
remain unchanged. Candidate source/semantics still require coordinator assignment.

Do not reuse invitee EmailSuppression for host: unsubscribe scope uses caller-supplied
invitee address and booking owner, so doing so could grant guests suppression over a
host. Existing invitee branch untouched. MailPreferences.email_notifications exists,
but web description is Receive email updates about your gigs and bids; inspected
scheduling/genericemail consumers do not establish broaderglobal precedence. Proposed
minimal repair leaves this contract unchanged and uses explicit scheduling opt-in/pause.
A global scheduling-email optout rule needs explicit product decision; no inventedpolicy.

Preflight opted-in hostcontact before recipient emails; hostsend before unchanged
invitee branch avoids invitee duplication on known hostfailure. Check success===true
or throw/releaseclaim. Hostsuccess→inviteefailure still releases claim and can repeat
hostmail on retry; accepted-but-lostSMTPack likewise can duplicate. Existing savednotice
idempotency stays; no exactly-once claim/new ledger/schema. Same-address role
deduplication not invented. Runtime proposal includes actualUI→localSMTP, off/absent/
pause negatives, lookupfailure/restore, host SMTPfailure/retry/dedupe and partialrecipient
failure/retry with exact message accounting. LostACK remains limited unless separately
exercised. Full fixture/grant/mail restoration, no native/timer/provider/newtests.
Durable 568hashesverified, MANIFEST **fcc7206c1e70967f334f10b0a58662925b6ba7b9b66c020882218819e26bd39d**; rawlogs private.
Next coordinator scope/policy review before any repair.


## Host reminder Email repair — next-batch candidate September21 11:13UTC

Exact grant fulfilled only in existing sendBookingReminder,29addedlines. Strict
explicit nestedhost email opt-in/notpaused, checked exactassignedhost User contact
(no ownerfallback), existingtemplate/emailService success requirement before invitee
email. Existing hostnotice/idempotency/invitee branches/sharedhelpers/gigs-bidsglobal
setting/defaults untouched. No guest-controlled suppression applied tohost. Source
**c3f1bd03868d916530e0477c318e3f5ddd43c91a**, branch codex/stream3-scheduling-channel-contract committed/pushed.
Draft publication/automaticCI pending, coordinator owns next-batch integration.

15 bounded worker attempts: actual web Emailopt-in PUT200/SQL→host1/invitee1;
completed repeat0/0. Off/absent/paused eachhost0/invitee1. Real exactUserSELECT403
via privilege denial→mail0/claimreleased; restore→1/1. Synthetic missingcontact→0/0/
released; restore1/1. Synthetic hostpreacceptanceSMTP rejection→0/0/released; retry
1/1 thencompletedrepeat0/0. Inviteerejection afterhostaccepted→1/0/released; retry
1/1 thenrepeat0/0. Partialcase exacthost2/invitee1 proves at-least-once limit, not
exactlyonce; lostSMTPack untested/can duplicate. Allguards violations0/childrenexit0.
SMTPfaults are injected sendMail rejection responses; successful deliveries real local
SMTP. Missingcontact response synthetic afterrealquery, contactpermissionfailure real.
No timer/native/provider rerun. Negativeprefs SQLseeded. First tab22closed too soon
after optimisticclick, SQLoff; reopenedtab23/retried and waited PUT200/SQLon before
worker. Initial unpersisted attempt excluded; no account/session-lifetime claim.

Exact8ownedbookingIDs in hostmail-cleanup.json; intermediate bookings/logs removed by
exactID between cases. Finalreceipt4092324f-f0f5-4a1e-84f9-7b541891faa1 and preference
ff053c30-a55a-43f4-8670-38a6c3b2ab64 removed;14mailIDs cleaned (host6/invitee8).
Six fulltable snapshots/original12mailIDs restored, originalSELECT privilege true
restored, childabsent/tabs22+23closed. API/Next/DB/authsession retainedunchanged.
26existing schedulingLogic tests/syntax/diffcheckpass, no newtests. Structured
hostmail-final/matrix/percase/SQL/SMTP/UI/cleanup/operator artifacts private mirrored;
rawlogs excluded. Durable 601hashesverified, MANIFEST **063354ba650ec189fa7345431ddab1a4bcaf5f04684537e322eaf1fd80ed47e9**.
Whole stream and otherhostemail/native/provider/session acceptance remain open.


PR129 draft https://github.com/WangPantopus/skinny-pantopus/pull/129 published.
Exactc3f originalCI35592896635 SUCCESS:6applicablepasses/5pathskips, including
backend/image/schema/CI OK. Coordinator reviewed601 source/runtimehashes and
independent retained-row equality; guarded master update/newheadCI remain separate.
Source/runtime frozen. FinalCI receipt mirrored:602hashesverified, MANIFEST
**2b37a97af78791d5493cc802ce80610cb0fe74ded9a5da682f323f81a0202d24**. No repeated journey or extra product change.


## Next A02 source-only proposal — local session-refresh origin

129 source/runtime frozen on localc3f; coordinator guarded03a2 update has identical
service and requiredCI underway. No app/runtime/fixture/newtest or acceptedjourney
replay. Reused actual prior incidental stale-session observations: configured
stream3-auth.localhost navigation reached localhost/session/refresh transientfailure;
ordinary correct-origin login recovered. No current production/authdefect asserted.

Sevenrefs/35bindings map middleware→refreshpage→SDK/client→Nextconfig. Middleware
builds redirects with new URL(...,req.url), client refresh uses same-originrelative
POST and transient preservescookies. InstalledNext15.5.15 runMiddleware constructs
absolute URL using server fetchHostname or localhost. This is a configuration lead,
not proof of rootcause/deploymentfailure. Source proposal artifact includes exacthash.

Propose first nonmutating HTTP redirect check on retainedNext with only synthetic
sessionflag1/noauth token: existing protected settings path on configuredalias vs
localhost, inspect Location origin/preservedpathquery and current startup/reverseproxy
contract. Explicitly not real refresh/authacceptance. If configuration-only, propose
local runtime correction before sharedauth edits; real browser expirycontinuation
requires separatecontrolledownedsession scope. No tokens/timeadvance/foreigncookies.
Durable603hashesverified, MANIFEST **61f6c35d991164c94541ad1b56e117084c99b69b910755df6eb5adb9ab6b56c2**, artifact
session-refresh-origin-source-proposal.json. Await coordinator bounded assignment.


## Local refresh redirect origin — nonmutating observation11:22UTC

Granted retainedNext HTTP-only check: same protected notifications path+two query
parameters, synthetic sessionflag1/noaccess/auth token. AliasHost and localhostHost
both307 to http://localhost:18131/session/refresh; redirectTo preserves exactpath/query,
no Set-Cookie on eitherresponse. Redirects notfollowed, no browser/session/SQLchanges.
Actual parent14400 starts next dev --hostname127.0.0.1 --port18131, child14742
listensloopback. InstalledNext builds middleware URL using serverfetchHostname and
normalizes127.0.0.1 tolocalhost; app usesreq.url. This explains the local observed
origin with existing startup; no hosted/production/authdefect or realexpiryclaim.

Propose changing only owned Next startup hostname to stream3-auth.localhost if
OSloopbackresolution confirmed, keepingport/distDir/proxy/session. No restart applied;
requires coordinator runtimegrant. Then repeat just redirect-origin check before any
real expiryjourney. Do not change auth/CORS/trustforwardedhost to mask localsetup.
Resolution details, bothHTTPheaders and startupcontract in session-refresh-origin-http.json.
Durable604hashesverified, MANIFEST **a2ada5a8c84c7cceafb5ed16fb97fb868240d6552480664ba6e33eaed26c5ba6**. All prior129/runtimeevidence preserved.


## Owned Next hostname corrected — local runtime only11:26UTC

Granted correction performed after PID/cwd/parent and exclusive loopback alias checks.
Captured original process argv/env through NUL-separated OS procargs into private
launch file (not mirrored or printed). Stopped only parent14400/listener14742; both
absent/portreleased. Same executable/cwd/env/distDir/cache/port18131/APIproxy started
with only --hostname stream3-auth.localhost changed. Newparent42165/listener42493,
exec61129, listenerIPv6::1. Independently compared newprocess environment exactequal
and argv hostname-only. API7996/18130 retained, no DB/cache/cookies/authsession/source
changes. Private restore runner retained; restoration not needed because startupworks.

Both aliasHost and localhostHost probes now307 with relative /session/refresh Location
and exact original redirectTo path/query preserved; no SetCookie. Synthetic marker
only/noaccess/auth token, no redirectfollowing/browserauth. This fixes recorded local
redirectorigin configuration; real expiry/refresh continuity remains unverified and
requires separate grant. No productionauthfix/CI/newtests/provider/nativeclaim.

Structured next-hostname-change/probes receipts plus nonsecret restartoperator mirrored;
private raw launch environment/runtime log excluded. Durable607hashesverified, MANIFEST
**f7ae6e2e3d3d2ce16336e8c5e3946fbbcb0dec805be43c9fa9116e40fd15111b**. New ownedNext reservation42493/42165 replaces old14742/14400;
API/DB/session remainretained.129/evidence/application branch unchanged.


## Natural access-cookie expiry proposal — plan only

Existing Bob browserlogin receipt10:40:13.684UTC, accesscookie maxAge3600 source,
no later login/refresh success recorded through11:27:50. Natural expiry candidate
after11:40:13.684; keep closed tabs/session and recheck renewal receipts before
any granted navigation. No cookie deletion/manualrefreshpage/clock/JWT/authDBchange.
Propose one actual protected settings navigation afterexpiry (harmlessquery marker),
observe middleware recovery→same-origin refreshPOST→localGoTrue→originaldestination
and Bob identity/identity-boundpreferencesGET, full unchangedprefs SQL. SafeHTTP
receipts already record method/path/status; GoTrue evidence only narrowly parsed
metadata+whitelisted nonsecret session fields, no rawtokens/hashes/headers/logs. If
unavailable distinguish source-inferred provider path rather than inventreceipt.
Naturalexpiry label remains timing-based unless safeexpiry metadata available; missing
cookie simulation/manualrefreshentry would be different scopes, not substitutes.

Close only new ownedtab; remove unusedmetadataflag; preserve rotated ordinarysession/
registry timestamps. No authDBrestoration claim/logout/revocation/other-sessionchange.
If no recovery or failure, preserve/report actualstate rather than silently relogin.
Plan/cleanup/observability detail session-natural-refresh-plan.json; no execution yet.
Durable608hashesverified, MANIFEST **e10f218b9bfa68cc161b8063df0141a0e7c39f64e98ff1f690e08bdf0c862a72**. Coordinatorreview pending.


Natural-session runtime grant active: waiting with owned testtabs closed until
11:40:20UTC; renewed-history check through11:36:32 still latestlogin10:40:13.684.
Before snapshot records originalprefsabsence0 and actor-only whitelisted app/GoTrue
session metadata, no token/hash/cookie fields. No navigation or session mutation yet.
Next exactaction: recheck no renewal, capture receipt offsets, open protectedsettings
with harmlessquery on correctedalias; never manuallyenter refresh or relogin.


## A02 natural local session recovery — verified bounded11:41UTC

Granted actual UI continuation passed after natural access-cookie window: lastlogin
10:40:13.684+3600s source lifetime, no intervening renewal, navigation after11:40:20.
No cookie removal/manualrefreshentry/clock/JWT/authDBmanipulation. Timing-based
naturalexpiry, not directcookie-store inspection. Actual tab24 first displayed same-
origin /session/refresh and Restoring your session; automatically returned to original
settings URL with stream3_natural_refresh=1 and Auth Bob identity. APIrefreshPOST200
11:40:41.755; independent localGoTruePOST/token grant_type refresh_token200 at11:40:41.
Actor sessionfdbea9cf-e8b0-4c4c-a666-09b88887a880 last_refresh_at11:40:41.744,
issued10:40:13.676/unrevoked. Other actor appsession metadata unchanged.

PreferencesGET20011:40:45.081 exactBob actor; fullSQLprefs originalabsence0 unchanged.
One actualreload stays same destination/query/account; only one refreshPOST total,
no recoveryloop. Tab24closed, zero-delay metadataflag consumed, naturalbrowser/session
rotation/authregistry timestamps retained; no authDBrestore/logout/revocation claim.
No credentials/tokens/cookies/hashes/rawGoTrue logs exported. Existing API7996 auth
source bytes unchanged0d6→c3f; corrected Next42165/42493 currentc3f. No source edit/
CI/newtests/native/hosted/OAuth/otherdestination or crossaccount acceptance.

Safe session-natural-before/after/start/UI/final metadata/operator mirrored, 616
hashesverified, MANIFEST **bd26e7cfbaa7640f166d00bb8d50ebd21cef9440e3791dc809985995b6a0ad76**. Existing fullstream limits remain;
coordinator review/next bounded assignment. Localhostname correction remains configonly.

Postcheck found Next automatic tsconfig generated-types include/reordering from
ownedrestart. Prior trackedclean confirmed; restored exact HEAD bytes, sourceclean
again except owneduntracked .next-stream3. No intended application/config edit.
Private session-natural-generated-config-cleanup.json records before/restored hashes.


After frozen natural result capture182fbeaf1: next A02 source-only proposal maps
existing transient refresh UI/SDK and AuthDevice read503. Conditional existing
session device association only (not yet queried), propose ownedDB AuthDeviceSELECT
denial→manualrefreshpage503/Tryagain→restore/read200/currentBobdestination. Explicit
manualentry/databasefault, not another naturalexpiry run. BlanketAuthSessiondenial
may take legacyfallback and is not proposed. No binding/cookie/JWT/clockmutation;
if noexistingdeviceassociation, stop/review alternative. Exactgrant/prefs/tabcleanup,
GoTrue safe metadata/rotation boundaries in session-transient-retry-source-proposal.json.
No runtimegrant/execution/appchanges yet.617durablehashesverified, MANIFEST
**56bde763ec34c613feb7f2a98292fe7b490420bc633c24ed3dc4eabdb7950f43**. Prior616 acceptance/source/session evidence unchanged.


Granted read-only association preflight: existing exact Bob unrevoked session from
natural recovery has device association **false**. Query returned boolean
only; no deviceID/credential export, no binding/session/cookie/grant mutation.
Structured session-transient-device-association.json records provenance. Later
proposal now618hashesverified, MANIFEST **b82fa1d1973cf9f0447a9ee2b96093babd61e043c2c150525e790feb8b34b5c4**. Runtime/faultmanualrefresh
still ungranted/unexecuted; accepted616 natural evidence remains unchanged.

Association is absent: AuthDevice-denial proposal stopped without runtime execution
or manufactured binding. One coordinator message incorrectly said PRESENT before
reading tool output; immediately corrected. Structured evidence/live03 boolean were
always false. Existing session and natural acceptance preserved.


Alternative transient recovery source-only proposal: reuse private http-probe
pre-Express request emit interception (existing refreshhold is post-GoTrue and
inappropriate). Proposed one-shot exactPOST/refresh+ownedport/loopback+Origin+
cookie-transport+unique fullReferer marker match, short-expiry descriptor consumed
before synthetic503, no forward/noSetCookie/no logout. Nonmatchingrequests untouched.
Actual manualrefreshpage transientUI→keyboardTryagain forwards normally→realGoTrue
200/currentBobdestination; no naturalexpiry rerun. Observe safeinterception/noGoTrue
firstattempt/no registryrotation and exactactor/prefs onretry. No token/header/body
values logged. Existing private hook extension needs separately granted ownedAPI
restart/exactenv/source binding; cleanup marker+hookrestore/ownrestart, retainNext/DB/
rotatedsession, closetab. No binding/grant/cookie/appmutation executed. Detailed
session-transient-transport-proposal.json mirrored;619hashesverified, MANIFEST
**81eb4927744b732a680891d1fe8959fec8985bb3c49412d16f9d57b4e0efe3bc**. AuthDevice-denial proposal remains stopped (associationfalse).


## A02 synthetic transient refresh retry — bounded verification complete

Actual existing web refresh page manually entered with unique relative settings
destination. One-shot pre-Express private hook returned503 at11:50:30.610UTC;
all exact request match booleans true, no forwarding/Set-Cookie. Actual UI showed
Couldn’t restore your session, session retained, Try again. Keyboard retry reached
real backend20011:50:49.349 and local GoTrue POST/token refresh_token20011:50:49.
Returned original settings URL/query and Auth Bob identity. Preferences GET304
identity-bound to Bob (cache revalidation, not fresh200); full SQLprefs remained
original absence0. An observer initially expected200; accepted observed304 without
repeating refresh/UI. No login/logout HTTP receipt in this interval.

Failure snapshot full actor prefs/app-session/GoTrue-session metadata and safe
GoTrue receipts equal before. Retry retained all73 own appsession IDs; only
fdbea9cf-e8b0-4c4c-a666-09b88887a880 changed in own app and GoTrue metadata.
Exactly one new successful GoTrue refresh. Other own session metadata unchanged;
other-account metadata not inspected. Successful ordinary rotation retained.
No DB fixtures/grants/binding/cookies/clock/JWT changed; no authDBrestore claim.

Cleanup: original private hook exactSHA d7c8b95318bab69c34050b6924df8ed9f7a5b44be79d0a3f39e8b35cd9768a5d
restored; consumed descriptor and metadataflag absent. Fault API63469 stopped.
Restored API73610/exec69695 listens127.0.0.1:18130, original backendcwd and exact
original captured argv/environment verified in memory without secret export.
Next42165/42493 unchanged; owned Supabase retained, testtab25 closed. Local source
c3f1bd03868d916530e0477c318e3f5ddd43c91a; trackedclean, owned.next-stream3 only.
No application edit/newtests/CI in this runtime-only scope; PR129 merge separately
confirmed747b45754b24accce096898508e2de3355ed86a3. No new implementation acceptance.

Manual entry/synthetic pre-forward failure is not natural expiry, real provider
outage, database failure, native/hosted/OAuth/cross-account/session-matrix coverage.
AuthDevice proposal remains stopped: existing device associationfalse. Prior
natural616 evidence remains reusable within original limits; no journey rerun.

Durable evidence: /Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/
transient-before/after-failure/after-retry/final, intercept, runtime-change, navigation
and actual UI failure/success snapshots. Private launch environment/raw operator
logs excluded. 628 artifact hashes verified; MANIFEST **18bb02a8179b131c5dbfe4ce05199ca5bdf7a9c83e00ee6098e234672b52ed72**.
Coordinator review pending; full stream remains incomplete, next bounded assignment.


## Next A01–A02 source reconciliation — runtime review pending

Accepted628 transient result frozen by coordinator6a3c7c692. Adopted current
masterde0ac6ef3c051485b5800a288194ee563396a12a on codex/stream3-session-return-reconciliation; old
codex/stream3-scheduling-channel-contract/c3f ref preserved. No tracked edits;
owned.next-stream3 retained. Nine existing auth screen/caller/route/service bindings
are byte-identical to c3f; only intervening Home page/docs differ. API73610 still
loadedc3f/Next42165+42493 retained; no blanket new-master runtime evidence claim.

PR82 already covers actual revoke-others/global/partial failure and account retirement.
Natural/transient refresh accepted separately; do not replay. Proposed remaining
ordinary profile Settings logout→unauthenticated protected settings link with query→
login redirectTo→real Bob login→exact authorized destination and prefs. Existing
profile/settings handleLogout calls API auth.logout→users local route→GoTrue local
signout/authDeviceService.logoutLocal→AuthSession revoke; middleware and login
preserve safe path/query. Source mapping and nine hashes in
session-logout-return-source-proposal.json. No concrete failure claimed from source.

Runtime proposal deliberately retires only retained Bob fdbea9cf session after safe
identity preflight; no others/global/device association. Compare all own session
metadata/preferences; prove old local GoTrue removal/registry revoke, exact current
identity on newly created login session, no unauthenticated private content. Retain
natural revoked/audit/newlogin records; no resurrection/DBreset. Close new tabs only.
No logout/revocation executed, no app edits/newtests/CI or native/provider expansion.
Negative destination authorization/remote revocation/offline logout remain separate.
Durable629 artifacts, MANIFEST **c8d396cde23983b70d932029029ce60c323dac722df763842a5c8ac5332218d0**. Coordinator scoped review
required before runtime. Full stream remains incomplete.


## Granted local logout/return baseline — actual failure, review required

Preflight UI Auth Bob and uninterrupted successful login/refresh history to fdbea9cf;
exact current registry unrevoked. Actual profile Settings keyboard Log Out returned
POSTlogout20012:19:21.183UTC, current registry revoked and exact GoTrue session
removed. All other own app/GoTrue metadata equal, full prefs[] unchanged. UI login
then direct protected scheduling-settings?stream3_logout_return=1 redirected to
login with exact encoded path/query; no private settings content in observed UI.

Unexpected automatic refresh burst immediately after logout: {"('/api/users/profile', 304)": 4, "('/api/users/logout', 200)": 1, "('/api/users/refresh', 400)": 29, "('/api/users/refresh', 429)": 2, "('/api/users/login', 429)": 1}.
Actual Bob sign-in submitted once12:20:01.521 returned429 with visible Too many
requests. Please try again shortly. No new GoTrue token receipt or login session.
Postfailure metadata exactly equals postlogout snapshot. Destination return NOT
verified. Source matches general one-minute limiter text; root cause/attribution of
refreshburst unresolved, do not claim repaired or bypass limiter. No retry performed.

Tab26closed; unused zero-delay preference observation descriptor removed. Runtime
API73610/Next42165+42493/DB retained. Old session naturally revoked; browser now
signed out, no session resurrection/newlogin/cookie manipulation. No source edit or
newtests. Baseline artifacts logout-return-before/after-logout/final and UI before/
loggedout/login-required/login-failure mirrored, 636 hashes; MANIFEST
**c3634539de03ea53b554aff9e5f768e8eb214feceec371a4f45dca2e6b86f15d**. Coordinator review before repair/retry.


Postlogout source attribution: captured first3seconds include60 each401 homes/
businesses/professional/seats and30 featureflag401 alongside29refresh400+2refresh429.
ProfileToggle unconditional mount loads those four endpoints; QueryProvider keyed
retirement remounts on every clear; SDK web401 unconditional canRefresh and invalid
refresh clear emits another marker. Singleflight covers only overlap, not successive
remount waves. Strong source/sequence feedback-loop match, not exact tab attribution:
existing HTTP logs lack Origin/Referer/tabID. Current inventory only retained tab4
reset-password, query omitted and tab untouched; source has no automatic API call.
Historical tab state unknowable from these receipts. Root18132 lead not independently
attributed. Global30/minute write limiter runs before user/auth routes, consistent
with logout+29refresh then429s/login rejection. Do not raise/bypass limiter.

Proposed smallest existing SDK401 gate: automatic web refresh only with active
session signal (including stale-access flag), otherwise reject without refresh or
repeatedclear; preserve explicit recovery/mobile/generation guards. No edit or
retry executed. PR82 client/provider bytes identical; historical retirement retained;
openPR metadata47/46/34 no dedicatedauthfix. Detailed source hashes/sequence/limits
logout-burst-source-attribution.json; durable637 MANIFEST **edbf0d6a92976197bbcfd117b6447187555a08e7907669b056b7a0dc45feee9a**.
Coordinator review pending; original failedreturn remains unverified.


## PR136 — stop signed-out automatic web refresh

Granted oneexisting SDK client.ts gate now requires hasActiveSession for automatic
web401 refresh. Mobile branch, explicitrefresh, staleaccess sessionflag, generation
guards/singleflight/privacy retirement unchanged. No limiter/backend/UI/provider
redesign/newfiles/tests. Commit d6fba68d3cf1154211849a1b659a7e48d03012a6 pushed
on codex/stream3-session-return-reconciliation; draft
https://github.com/WangPantopus/skinny-pantopus/pull/136 (separate paidbatch).

After naturalratewindow ordinary UI login created14312967-9a68-4c51-bcb0-0266f6898285;
other own sessions unchanged. Candidate Nextcompiled SDK guard present in loaded
page/layoutchunks; DOM script list recorded. Actual Settings keyboardlogout retired
only14312967 registry/GoTrue;9 trailing privateGET401, **zero refreshPOST/429**.
Observed immediate intermediate remounted shell had blankaccount/defaultsettings;
then login navigation completed. Protected own scheduling-settings query redirected
to exactlogin redirectTo, no private settings content in observedloginUI. Actual
login200/localGoTrue passwordgrant20012:27:45 returned original path/query/AuthBob.
Newsession507ef9ec-89b6-4ff3-a04c-6c69d5e0618c onlyaddition; all other own app/GoTrue
metadata unchanged from postlogout. Fullprefs[] unchanged; identity-bound prefsGET304
12:27:45.738 cachevalidation. Complete measuredcandidate interval:2POST200 (logout/
returnlogin),9GET401, zero refresh/429; initial setup login precedes this interval.

Cleanup: tab27closed, zero-delaydescriptorconsumed, retained natural revoked/audit/
newloginrecords. API73610/Next42165+42493/DB unchanged, no counterreset/restart.
Sourcebefore-finalcommit hash in logout-fix-before; UI/script/safeHTTP/SQL/GoTrue
snapshots in logout-fix-*. Prior natural/explicitrefresh evidence reused for unchanged
controlflow only; new401gate staleaccess compatibility sourcechecked, no newexpiry
runtime claim. No native/hosted/negative-destination/broadsessionclosure. Baseline
historical tab initiator stillunproven; candidate boundedjourney passes.

Existing57 authArrival/sessionRefresh tests pass; web typegate0errors; SDKscoped
lint0errors/33existingwarnings; diffcheckpass. StandaloneSDK typecheck stillfails35
diagnostics. Isolated old/candidate compilecomparison both59normalizedidentical
(includes copy-specific module resolutionerrors), not standalonegreen. Initial
pnpm isolatedcommand couldn't resolve workspace; direct existingtsc used. Initial
webeslint invocation ignored externalfile; actualpackageconfig rerun recorded.
No newtests or testcoverage claim. RequiredCI pending, no merge/integration claim.
Durable653 hashes verified; MANIFEST **2786b1fae61dbc82ed908c0c055900c7d4aeaff203e16157c7947cd6c9cdcd55**. Coordinatorreview.


Next source-only A02 proposal: ordinary local logout pre-forwardfailure. PR82
revocation partialfailure happened AFTER commit; PR136 local200 retirement and
refreshnatural/transient cannot establish this boundary. Existing profilelogout
catch assumes cookiescleared and navigateslogin after localclear; SDK clearsession
only after POSTsuccess; retained sessionflag can still authenticate middlewarelogin
redirect. Potential misleading failure handling requires actual baseline, not policy
invention. Proposed separately granted exact owned507ef9ec session + one-shot
preExpress POSTlogout503, noforward/SetCookie, fullmetadata/prefs equality/UIobserve.
No runtime, retry/logout/login or appedit executed. Restore privatehook/env/restart
ownAPI only ifgrant, close ownnewtab, preserve natural session; no cookie/clock/JWT/
device/DBreset. Not genuineoffline or lostsuccessfulreply. Detailed existingfive
bindings/isolation/cleanup in logout-failure-source-proposal.json. PR136fixed;
CI35599880117 browserE2E/database/safeguards passed, webjob stillrunning.
Durable654 hashes; MANIFEST **e4000f55b7a1c627d96027ca49e8e9e0880825b6081d9f0afa428b10b92877eb**; coordinatorreviewpending.


PR136 exact d6fba68d3 CI35599880117 **SUCCESS**: weblint/typegate/Jest/productionbuild,
IdentityFirewallE2E, database replay/safeguards andCI OK allpassed. Backend/native/
Seeder jobs skipped bychangefilter, not runtimeverified. Receiptlogout-fix-ci.json;
durable655 MANIFEST **b95bd5576d3d29058da1fef589f133638cdd744ca0d3775b2f01611f0a87c8b4**. Draft remains coordinatorreview/
integration pending; standaloneSDKdiagnostic limitation unchanged.


## Separate local logout pre-forward503 baseline — reproduced UI failure

Granted exact Bob/current507ef9ec preflight matched complete prior metadata and UI.
Private one-shot matched all exactlogout/18130/loopback/Origin/transport/Referer
conditions;50312:37:15.297UTC, descriptorconsumed/noforward/noSetCookie. Actual
Settings keyboardlogout showed no appfailure/retry, navigated automatically to
/app/place displaying AuthBob. Devissuebadge briefly visible, not usablelogouterror.
Full own app/GoTrue metadata and prefs[] unchanged; no GoTrue token receipt or
HTTPlogin/refresh/retry, subsequent profile304s. Sessionretained as expected for
pre-forwardfailure; silentlyreturning to authenticatedPlace is the reproducedgap.
No manualretry/login/logout or apprepair. This is synthetic503, not actualoffline
or lostsuccessfulreply; no native/provider/broadauthclosure.

Cleanup complete: faultAPI3022stopped, restoredAPI3800/exec20593 originalargv/env/cwd
exact in-memory comparison; originalhookSHAd7c8b95318bab69c34050b6924df8ed9f7a5b44be79d0a3f39e8b35cd9768a5d
restored, markerabsent, testtab28closed, Next42165/42493+DB retained. Actualcurrent
507ef9ec session retained, no DB/grant/device/cookie/clock/JWTmutation. Locald6f
source/PR136 frozen; no new appedit/tests/CI in baseline. Privateenv/operatorlogs
excluded. Safe logout-failure-before/after/intercept/runtime-change/cleanup/UI
artifacts mirrored, 662 hashes; MANIFEST **c511bc373dccac4d4c578277c4376f00ca945675986e28931e2244ec1004fc14**. Coordinator
review/repairassignment pending; scopedproposal reuse existing handleLogout error
feedback and return before localclear/navigation on rejection, preservingdesign.


## PR138 — actionable profile Settings logout failure

Adopted finalmaster2d66626c on separate codex/stream3-logout-failure-feedback; old
136branch preserved. Only existinghandleLogout catch: existingtoast.error safe
Could not confirm sign-out. Please try again. thenreturn beforelocalclear/navigation.
Successfulpath/otherhandlers/design unchanged. Commit287058421aea780806c59142fa7796df971b3e98
pushed draft https://github.com/WangPantopus/skinny-pantopus/pull/138 . No newfiles/tests.

ActualUI Bob/current507ef9ec preflight; reviewedprivate exactone-shot50312:41:56.166
allmatchtrue/noforward/noSetCookie. Settings/identity retained; error visible inAX
and keyboard LogOut stillusable. Full own app/GoTrue metadata andprefs[] unchanged.
Fault consumed; samebutton keyboardretry real200 retiresonly507ef9ec inregistry/
GoTrue and reacheslogin. Allotherownmetadata/prefs unchanged; zero refresh/429;
no loginreturn replay (accepted136 unchangedsuccessfulpath reused). Onefault only,
no optionalduplicateattempt. Synthetic preforward failure, not offline/lostcommit;
wording doesnotassert stillsignedin for all errors. Native/hosted remainsunverified.

Cleanup: faultAPI6394 stopped, restoredAPI7948/exec60505 originalenv/argv/cwd exact
in-memory verified, originalhookSHA d7c8b95318bab69c34050b6924df8ed9f7a5b44be79d0a3f39e8b35cd9768a5d
restored; descriptorabsent/tab29closed. Next42165/42493+DB retained. Naturalrevoked/
auditrecords retained; browser now signedout, no resurrection/newlogin. Baseline
andcandidate ownmetadata/UI/HTTP/cleanup in logout-feedback-*; privateenv/rawlogs
excluded. Existing57authchecks pass, webtypegate0errors, scopedlint0errors/one
existingts-nocheckwarning, diffpass. Sourcepage retains existingts-nocheck, so type
gate alone doesnotverify handler; actualUI/HTTP/SQL is primary.

ExactCI35601204534 queued at287058421; draftreview/integrationpending. Durable
673 hashes; MANIFEST **6c40498319ab8d84d371dbf982c9d81b4eae7a2ac9533fa3cbc9dd3f80122272**. Fullstream remainsincomplete.


Evidence correction: initial logout-feedback-ui-failure.txt saved a later AXdiff
after toast removal, so alone didnot substantiate errorvisibility. Recovered original
CUA function_call_output at12:41:56.394 from ownsession logline20980 into NEW
logout-feedback-ui-failure-original-tool.txt: Settings URL/AuthBob and exacterror
text at107, reusableLogout92 focused, Dismissnotification108. ProvenanceJSON records
originalcall/timestamp/source/hash. Originaldiff preserved, no reconstruction or
browser/relogin/logout replay. Durable675 verifiedhashes; MANIFEST
**c6117ee2ec41d001556967f0b6b91ddf600d5afed7d1e9fefc7b1ee5b22a76cc**. PR138sourceunchanged; coordinatorreview.


PR138 original exact287058421 CI35601204534 **SUCCESS**: webchecks/build,
IdentityFirewallE2E, database replay/safeguards, aggregatepassed. Backend/native/
Seeder skipped byscope, not runtimeproof. Receiptlogout-feedback-ci.json; durable
676 verifiedhashes MANIFEST **bcd878a527a399fb842ffe0e80d75f5a79fea752430371b0cb539eca36022349**. Originalbranchfixed,
coordinator merge/integration reviewpending. No further runtimeexpansion inbatch.


## Final cohort disposition — PR138 merged, bounded acceptance retained

Remote read confirms PR138 updated head532296c802ae9aba5616f26568c4398edd096db4
CI35601772751 SUCCESS and merge b946eb9ea99819ffb27f42252cdaab237d02dea0.
Coordinator reports update added only four accepted Home137 paths; tested Settings
page bytes unchanged. PR137 merged274e6e1c first; coordinator combined paidlocal
1f1c353c sourcebindings/checks reported passing. Those combined checks are coordinator
evidence, not a Stream3 rerun. Original287058421/CI35601204534 evidence retained.
Corrected original toast AX/provenance remains accepted; original later diff preserved.

Implementation/CI/merge complete for this narrow handler repair. Actual acceptance
remains synthetic pre-forward503 keeping Settings/error/currentidentity, unchanged
fullownmetadata/prefs, then real local logoutretry200 retiring only507/currentGoTrue
and reachinglogin without refreshburst/429. No native/hosted/genuineoffline/lostcommit
or wholeauth/stream completion claim. Prior136 destinationreturn reused only for
unchanged successfulflow. Fullstream broader acceptance remains open.

Retained last-verified runtime API7948/exec60505, Next42165/42493, ownedDB; original
privatehook/env restored, descriptorabsent/testtab29closed, browser signedout, natural
revoked/auditrecords retained. This disposition update does not probe runtime again.
No local sourceadoption, UI/API/check replay or new scope. Localoriginal287058421
branch and old136ref preserved. Durable676 manifest remains
bcd878a527a399fb842ffe0e80d75f5a79fea752430371b0cb539eca36022349.
Coordinator finaldocumentation/publication owns next integration step.


## Source-only next boundary — lost committed local logout reply

Current originmasterf4b27786172d7b2cae641b4c94f9e77aa75928c1 fetched only, not adopted; local287058421
fixed. Eight relevantpage/SDK/middleware/Nextproxy/backendservice bindings exactcurrent
master. PR82 partialfailure AFTERretirement and destroyed globalreply duringaccount
switch do not verify sameaccountlocalresponse-loss retry. PR136 successfuldelivered
logout andPR138 preforward503 likewise insufficient. Boundaryunverified; no observed
newdefect/runtimeclaim. Detailedlogout-lost-response-source-proposal.json mapsordering:
queuedclearCookieheaders→resolveproof→GoTruelocalrevoke→best-effortregistry/audit→
originalres.json; SDK onlyretireslocally afterreceivedsuccess, UIcatchsafeerror.
HTTP200alone cannot prove revocation (helper/safeHook can swallowfailures).

Propose separately granted newordinaryBoblogin (currentlysignedout), exactownsession
snapshot; private one-shot exactlogout response-end hold ORIGINAL200 beforeheaders
sent, verify SQLcurrentretired/GoTrueabsent andothermetadata/prefs unchanged while
socketpending, then destroyonlyoriginalsocket beforeheaders/bodydelivery. No
synthetic200/503, no cookie/tokenvalues. Record actualNextproxy/browser failure and
automaticauth; stale sessionflag may triggerrecovery, so no no-refreshassumption.
Optional separatelygranted samebuttonretry onlyifexistingcontrolremains; no relogin
or workaround ifnot. Non200/headerssent/deadline/failedcommitproof: stop and release
originaluntouched response wherepossible, record actualvariant. Preserve natural
records; exacthook/env/ownedAPIrestore+closetab/descriptor cleanup. No appedit/tests/
login/logout/refresh/provider/native/runtimeaction in this source-onlyassignment.
Existingimplementation/privatehook suffices; no replacement/schema or duplicate
backlog. Durable677 verifiedhashes MANIFEST **06df0aa18798993509bd9a092fa3596be0961bae2399f01eb54e044abc7f42d4**. Coordinator
runtimereviewrequired; source/runtime/signedoutstate preserved.


## Lost committed local logout reply — bounded original-response result

Initial prematuregrant withdrawn before anyruntimeaction: onlyREADME/source/ps/Git
reads occurred. Corrected written grant used aftereightmasterbindings confirmed;
paidnext.config onlyunrelatedstatusprivacyheaders differs. Local287058421fixed,
no adoption/appedit/test/provider/native action. One actualBoblogin established
5d64b918-f785-4075-b742-67a0128f42f3; allotherownmetadata/prefs unchanged.

Original actual Settingslogout200 held13:30:00.004UTC atresponseend withallrequest
matchbooleans true, headersSentfalse,4queuedclearCookieheaders (no valuesrecorded).
LiveSQLproof whilepending: exactcurrentregistryrevoked/GoTrueabsent, allotherown
app/GoTrue rows andprefs[] equalbefore. Only afterproof, originalsocketdestroyed
13:30:00.153 after149ms (under8secdeadline). Close13:30:00.154 hadheadersSentfalse,
destroyed/socketDestroyedtrue,writableEnded/Finishedfalse; no finish event/original
response delivery. Originalstatus200 comesfromheldresponse, not deliveredHTTPlog.
No manufacturedstatus/body/session/cookie.

FirstUI capture stillSettings/AuthBob; subsequent actualUI login preserving
redirectTo=/app/profile/settings. OneautomaticrefreshPOST401 at13:30:04.836;
no GoTruetokencall/newlogin/429. Full finalownmetadata/prefs exactlycommitproof;
onlysetupsession wasretired, no resurrection. No currentLogoutcontrol remained,
so conditionalmanualretry NOTperformed; no relogin/workaround. Actualbrowser
endedsignedout; intermediateerror/toast and exactNext/browserlogoutstatus not
captured (filteredbrowserlogs empty, retainedNextlog no matchingstatus). Do not
claim a particular502/status or zero-frame privateUI; cachedSettings initially
visible is not serverauthorization. OriginalAPI→Nextresponse-loss boundary proven,
physicaloffline/native/hosted/providerfailure notverified. No repairneeded established
for observed automaticrecovery; conditionalretry remainsunexercised.

Cleanup: originalprivatehook exactSHAd7c8b95318bab69c34050b6924df8ed9f7a5b44be79d0a3f39e8b35cd9768a5d
restored; faultAPI48055 stopped, restoredAPI48548/exec80449 original
env/argv/cwd exactinmemory; descriptor/decisionabsent, tab30closed. Next42165/42493
+DBretained, naturalrevoked/auditrecords andsignedoutstatepreserved. No rawenv/log/
token/cookie export. Safe logout-loss-* snapshots/observer/transport/UI/cleanup
mirrored, 691 verifiedhashes MANIFEST **d49d23a7d72e93b75e6f7f2379e8a8d3a0d83d763ed874ca0eecc818b421120f**. No newCI/source
change; coordinatorreviewpending within above limits.


## Next inventory priority — A02 remote revocation/open browser (proposal only)

Reuse accepted82/136/138/691. PR82 proved sign-out-others auxiliaryHTTP401, not
private-state retirement/current authorization in a still-open secondary browser.
Local logout/reply-loss acceptance cannot substitute. This is the next bounded
security/session gap; native/provider/platform limitations remainopen. No repeated
source searches or runtimejourneys thismilestone. ExistingSecurity step-up action→
/api/auth/sessions/revoke-others→authDeviceService/AuthSession/GoTrue contract from
accepted82; latest client/middleware bindings reused with exact priorlimits.

Propose one visible secondarybrowser case after coordinator narrowremote-action
source rebind and isolationreview. Existing authorizedfixture must have zeroactive
sessions before creating two ownlogins; do not revoke retainedBob/peerfixture
sessions. Two independent cookie/store contexts and distinctsessionIDs required;
two tabs alone insufficient. Supported separateprofile capability or reviewedowned
alternateorigin stillunverified. If no zero-sessionfixture/context, stop for exact
assignment; no speculativeaccountcreation. ClientA actualSecurity signoutothers,
clientBprotectedSettings read/poll denied/private-state retired; Aretained/Brevoked
SQL/GoTrue, eventualsafe logincontinuation undercurrentauthorization. No global/
offline/native/frozenbrowser/provider expansion or oldcancel/passwordtestrepeat.
Naturalrecords retained, newlycreatedsessions cleanup onlywithinfuturegrant.
Detailed a02-remote-open-browser-next-proposal.json. Not runtime-ready: fixture/context
availability and narrowremoteroute binding pending. Current signedout/API48548/
NextDB/source preserved. Durable692 MANIFEST **b5d2ea6bfc7064d33a17d47c34720268f3eae3223064e94ed6ea1a7c81418576**.


A02 assigned readonlypreflight:12 targeted Security/StepUpSDK/routes/middleware/
services/socket/config bindings exactmasterf4b277861, no sourceadoption/change.
Knownowned AuthEvan d3671605-b8cc-4e92-8c82-99aa5041ff48 existsinapp+auth, email
confirmed, zero unrevokedapp/GoTrue sessions/devices/resumegrants. Alice/Charlie
zero counts excluded because actualaccountsdeleted; Bob3/Dana14actives preserved.
Currentbrowser signedout; recoverytab4 untouched. No accountcreation/login/revoke.

Supportedcontext inventory IAB1 andChromeextension4; distinctbrowser surfaces, not
yet provenisolatedauthenticatedsessions. Proposed sameownedalias18131 inboth, no
alternatehost/profileinstallation. Host-onlylax cookies, refreshpath/api/users/refresh;
APIcapturedoriginalenv explicitlyallowsalias. AliasSocketContext uses sameorigin
/socket.io rewrite, not literal-localhostdirectbranch. Actualsocketconnect/delivery
stillunverified. Passwordstepup creates thenrevokes temporaryGoTrue session; future
evidence must accountforit and confirmabsence, not assumeonlytwo sessioncreations.

Future narrowjourney: verifydistinctA/Bsession IDs on sameexistingEvanfixture after
recheckingzeroactive; AexistingSecuritystepup signoutothers, BvisibleprotectedSettings
read/poll/sessionevent denies+retiresUI/login; Aretained/Brevoked andtempstepups gone.
No historicalcancel/passwordcase replay/native/provider/global/offline expansion.
CleanupnormalA logout onlyifgranted/newtabs only/naturalrecords retained. No runtime
restart/appedit/tests/cookie-storage mutation or userhistory access. Detailed source/
fixture/context/config a02-remote-open-browser-preflight.json plus two safe inventory
artifacts; durable695 MANIFEST **c772d3d05b9548edf915893272db8bf7fcddd07799760ea4837df9a6e6f71655**. Runtimegrantpending.


Assigned two-browser runtime stopped before authentication: exactEvanzero/full
baseline confirmed (27historicalapp rows, GoTrue0,prefs0,devices/grants0). IABtab31
opened login only. Chromecreate request timedout30s and resetCUA; oldChrome4 then
reportedunavailable. No credentials entered in eitherbrowser; no login/revocation.
Recovered/closed onlynewIAB31; laterbrowserinventory showsChrome2 andIAB1. Readonly
Chrome2 ownedtargettab query returnednone; no Chromecreationconfirmed, no borrowed
user tabs closed or storage/history read. No blindcreate retry/profile workaround.

Full afterEvanmetadata/prefs exactlybaseline; no authHTTP sincebaseline. API48548/
NextDB/source unchanged; originaltab4/signedoutstate preserved. This is capability
interruption, not product failure or remote-revocation acceptance. Context4→2
identity/retry scope needs coordinatorreconciliation; actual two-context isolation
unverified. Safe remote-browser-before/abort artifacts; durable697
MANIFEST **622e0f021ff1778933d0089cb65905867e8c23862bf94909c8dd569df1891eeb**. No tests/appedit/runtime restart.


## A02 reconnect retry — runtime restored, second browser context unavailable

README "one A02 browser reconnect retry" followed on a new Claude session (harness
changed from Codex). Documented retainedAPI48548/80449 andNext42165/42493 were absent
at start: no18130/18131 listener, PIDs gone, hostuptime1d3h (no reboot); retained
Supabase stream3-block-r1 64531–37 andSMTP64535 still running. Only the owned API/Next
were restarted from the exact previously captured private launch files (identical
executable/argv/cwd/22-key env, original hook sha d7c8b953 unchanged, all21 fault
trigger paths absent), Next with NEXT_DIST_DIR=.next-stream3 on stream3-auth.localhost
18131; login page200. This is restoration from identical inputs, not continuity of the
prior processes. No app edit/env mutation/DB write; local287058421 source fixed.

Evan recheck after restart (a02-retry-before.json): appUnrevoked0/total27, GoTrue0,
devices0, resumeGrants0, prefs0; appSessions/GoTrue/prefs byte-equal to remote-browser-
abort.json; only two /api/health404 liveness probes in authHTTP since restart.

Second context: Claude in Chrome list_connected_browsers returned [] initially and on
the one bounded retry; tabs_context reported extension not connected, no tab group, no
owned target tab. Google Chrome process57357 runs but no extension instance is signed
in to this account. Prior Codex IAB1/Chrome4→2 identities are not addressable here.
Per grant: no tab creation, profile/alternate browser/extension install, cookie edit,
IAB login or credentials. Built-in browser pane left closed. Capability boundary, not
product failure; distinct-session/A step-up/B retirement scope untouched.

User reported the extension installed and signed in; three further connection reads
still returned [] and one bounded tabs_context createIfEmpty reported not connected
(no tab created). Read-tier computer-use look at Chrome only: profile window shows
claude.ai settings with Preferred browser = Built-in browser and no pinned Claude
extension icon; the other window is an Incognito Pantopus tab owned elsewhere, untouched.
Extension instance is not registered to this account from this session; likely side
panel never opened/signed in for this profile, different Claude account, or reload
needed. No install/reload/sign-in/profile/incognito change performed.

Artifacts a02-retry-before/runtime-restore/browser-boundary.json; durable700
MANIFEST **6aadada10fe3ceb6f94576bf1b2becc3bc015e808e76fef69d0d7de807862f82**.
Next: user opens the Claude side panel in Chrome signed in as this account (or
coordinator assigns another supported second context); then Chrome target tab first,
then IAB tab, per grant. Runtime36126(API)/36139(Next) retained. No tests/app edit.


## A02 remote sign-out — two-context journey completed

User confirmed the extension; Claude in Chrome then reported one connected browser.
Evan rechecked zero (a02-retry-prelogin.json equal to before). Exactly two owned tabs:
Chrome tab257777372 (clientA) and built-in pane tab (clientB, emulated1280x900 because
the hidden pane reports0x0). One ordinary UI login each: A POST/api/users/login200
01:32:03→session15b7e0a8; B 01:32:52→f10f6310. Binding by real requests: server
AuthSession.user_agent from each login equals that browser's navigator.userAgent
(Chrome/153 vs Claude/2.2553.1 Chrome/152); A's Security page listed both with
"This device" on the earlier one. Two app + two GoTrue sessions, devices/grants/prefs0.

A existing Security "Sign out of all other devices"→password step-up modal→POST
/api/auth/step-up200 01:34:45.811→POST/api/auth/sessions/revoke-others200 .896 (both
Chrome UA in API log). GoTrue audit: login .770 (temporary step-up session), logout
.803 (temporary removed), logout .879 (B). SQL: B revoked_at01:34:45.884 reason user,
A unrevoked; GoTrue only A; 27 historical rows/prefs/devices/grants byte-equal to
baseline. Only non-session change: auth.users.last_sign_in_at moved to the step-up
login time. A Security re-listed "This device" only; A polls continued304.

B untouched on personal Settings: its next real ~5s polls at01:34:48.763 returned401
(unread-count/chat stats/received-offers), SDK POST/api/users/refresh401 once, no
GoTrue token call/429, then location /login?redirectTo=%2Fapp%2Fprofile%2Fsettings with
Sign in form only. No manual control, workaround login or timer change. No socket
connection/event evidence captured; no socket delivery claim. Retirement proven via
HTTP401 path only. Post-retirement layout GETs401 observed, no visible failure.

Assigned cleanup: A ordinary Settings Log Out→POST/api/users/logout200→/login;
A revoked_at01:36:14 reason logout, no refresh POST/429; final GoTrue0/app unrevoked0,
appTotal29 (27+2 natural revoked rows retained). Both owned tabs closed, viewport
reset, no other tab/store touched. Runtime36126/36139 and DB retained; no fault
triggers armed; no app edit/new test. Not physical offline/native/hosted/provider.
Artifacts a02-retry-{prelogin,after-login-a,after-login-b,bindings-pre-revoke,
after-revoke,final,result}.json; durable707
MANIFEST **f50472b0c2c7825c8c5aa26a6ab59085ea6ff95329d406991d15cba8a7247234**.
Next: coordinator review; A02 open-browser gap closed within these limits.


## Next inventory priority — A01 signup verification and reset completion (proposal only)

With the A02 open-browser gap closed, the next unresolved accounts row runnable on the
retained local runtime is A01: complete signup/email verification and the password-reset
final credential change that earlier needed user takeover. Eight bindings (users.js,
emailService.js, register/verify-email/verify-email-sent/forgot-password/reset-password
pages, SDK auth.ts) are byte-equal to origin/master ed391c3a6; local287058421 fixed.

Contract from source: register→503 when delivery unavailable→400 taken/invalid→admin
generateLink(signup)→User insert (verified:false, auth user deleted on insert failure)→own
SMTP verification link {APP_URL}/verify-email?token_hash→503 if send fails→201, no
auto-login. verify-email→anon verifyOtp→400 invalid/expired→User.verified sync→any
verifyOtp session dropped→login. forgot-password (5/15min)→generateLink(recovery,
/reset-password)→sendPasswordResetEmail→one enumeration-safe message. reset-password→
client length/match checks→verifyOtp(recovery,token_hash)→scoped updateUser→revoke ALL
sessions/devices/grants+watermark→200→login; 400 invalid/expired or unable. Mail sink is
retained Mailpit 64535/64536 (12 lifecycle messages retained), not GoTrue's mailer.

Proposed runtime (not started): one new owned synthetic stream3-auth-r3-*@example.com
created only by the real register form and deleted exactly at cleanup; Evan d3671605
(zero sessions) as reset target, password restored to the recorded fixture value by a
second real reset. Journeys: signup success→Mailpit→verify link→verified→first login;
duplicate email/username 400; login-before-verification actual response; consumed
verify link reuse 400 and resend; reset success→old password fails/new succeeds; consumed
reset token reuse 400; unknown email same message/no mail. Expired tokens need clock or
config change (limit). No provider/native/hosted mail, no limiter exhaustion, no lost-
response hook in this milestone. Detailed a01-signup-reset-source-proposal.json; durable708
MANIFEST **f967e080959dde6c0e05f6b89f6275b651576cbb218712ee9b7f5d30d327cb01**.
Coordinator fixture/account-creation grant required before runtime. Runtime36126/36139
and signed-out state retained; no app edit/new test.


## A01 signup verification and reset completion — verified; unverified-login repair PR145

User granted the A01 runtime scope directly. Built-in pane tab only (UA Claude/2.2553.1),
retained API/Next/DB, real Mailpit 64535/64536. Signup: real /register form for new owned
stream3-auth-r3-frank@example.com→POST/api/users/register201 01:55:35→/verify-email-sent;
auth.users unconfirmed, User.verified false; Mailpit "Confirm your email for Pantopus"
with /verify-email?token_hash link (token never exported). Login before verification with
correct credentials→POST/api/users/login401 and "Invalid email or password" while API log
recorded GoTrue "Email not confirmed": REPRODUCED DEFECT — users.js mapped every
signInWithPassword error to the generic401, leaving its own 403 "Please verify your email
before signing in."/needsVerification branch unreachable. Verify link→verify-email200
01:57:21→login page; email_confirmed_at set, verified true, GoTrue/app sessions0 (verifyOtp
session dropped). Consumed link reuse→400 "Invalid or expired verification link/code" +
Resend; resend for verified account→200 enumeration-safe message, API skipped, no mail.
Verified login200→/app/place; logout200. Duplicate signup→400 "A user with this email
address has already been registered" visible, no new rows.

Reset (Evan d3671605, zero sessions): forgot-password200→recovery_sent_at, GoTrue audit
user_recovery_requested, Mailpit "Reset your Pantopus password"; unknown email→same message,
no mail. Reset page client checks "Passwords do not match."/"Password must be at least 12
characters." without network. Reset200 02:01:16→login page; GoTrue audit login/
user_updated_password/user_modified/logout (scoped recovery session removed), AuthSession
rows byte-equal, prefs/devices/grants unchanged, "All devices were signed out" notice mailed.
Old password401, new password200→/app/place, logout200. Consumed token reuse→400 "Invalid or
expired reset token". Fixture password restored by a second real forgot/reset; original
credential login200 then logout. Expired-token/SMTP-outage/limiter-exhaustion not exercised.

Repair: smallest existing-route change on codex/stream3-unverified-login-feedback
(932bfc227, PR145 https://github.com/WangPantopus/skinny-pantopus/pull/145): in the existing
authError branch map /email not confirmed/i to the existing 403 needsVerification response
(9 lines added). API restarted from the exact captured recipe (36126→50622). Fresh unverified
stream3-auth-r3-grace@example.com→login403 with "Please verify your email before signing in."
and the login page's existing Resend control; resend200 mailed "Your Pantopus verification
link"; verified account wrong password still401 generic, no resend control. Existing
tests/authDpop + authUsersHooks 127 passed; node --check clean; no eslint config in backend;
no new unit tests. Next dev rewrote web tsconfig include for .next-stream3 (unstaged).

Cleanup: Frank/Grace AuthSession/User/auth.users rows deleted in one transaction (auth.users
3/User3/orphan0); Evan active0/GoTrue0, two natural revoked login rows retained; Mailpit19
natural messages retained; pane tab closed/viewport reset; runtime50622/36139+DB retained.
Artifacts a01-{before-evan,signup-mail,signup-result,reset-before-evan,reset-mail,
reset-after-evan,reset-final-evan,reset-result,fix-verification,cleanup}.json; durable718
MANIFEST **60ed88d5f44ce6c0caf08f900cc2e2c419bf14a108a581fa007a5de13ef55a2f**.
Next: PR145 CI/review; remaining A01 limits are providers disabled, expired tokens,
delivery outage and native clients.


## Native iOS/Android accounts journeys — verified; three more repairs (PR149/151/152)

User directed full native coverage. Built Debug iOS (xcodebuild, worktree .env API/SOCKET
127.0.0.1:18130) on owned simulator Pantopus Stream3 Social R2 (erased twice: unknown r2
passcode, then clean push-fix check) and Debug Android (gradlew assembleDebug, .env
10.0.2.2:18130; first daemon died at host load 170, retry 10m51s) on new owned emulator
Pantopus_Stream3_Accounts_R3 (android-34 arm64). Retained API restarted twice from the
exact recipe to load repairs (50622→80982); Next 36139/DB retained. Evidence in
native-accounts-result.json (27 journeys) and screenshots; durable719
MANIFEST **51cbc2a6b4f725468b12f183c46766652519c1521c297a654a88c830d9b7478b**.

Verified natively (real API/SQL/GoTrue audit for each): iOS/Android login with device
registration (iOS trusted, emulator unverified), wrong password 401 messages, OAuth Apple
start→consent→cancel, Devices screens (iOS gated by device-owner prompt; simulator accepts
any passcode), remove orphaned device (wrong step-up → password_failed/device retained;
correct → DELETE device, session device_revoked), sign-out-others from iOS and from Android
retiring the web client (401s→refresh 401→login redirect), web revoke retiring iOS and
Android via socket kick (kicked:1 then kicked:2, both refresh_refused within 200ms,
"You were signed out for security" + account hint), forgot/reset on both (deep link
pantopus://auth/reset-password, mismatch/no request, success revokes all others with
password_reset, fixture password restored by the iOS reset), Android native sign-up →
unverified login 403 + Resend (PR145 natively), Android notification preferences toggle
PUT /api/hub/preferences persisted and restored, Blocked users empty state, Settings
logout on both, iOS cold-start resume, simctl push foreground banner.

Defects reproduced and repaired (smallest existing-code changes, each verified on rebuilt/
restarted runtime): PR149 iOS posted the APNs token before any sign-in → 401 → first-ever
login screen said "Your session has expired" (defer until signedIn; token now saved by the
post-login device registration). PR151 resent verification links are magiclink tokens but
native clients post type=signup → "Link expired" in-app (verify-email retries the hashed
token with the alternate purpose; Android verified from the resent token). PR152 after a
deliberate iOS Log out a racing GET /api/hub with no token hit endSession(.expired) → the
login screen claimed expiry (reason published only when a session actually ended).
One Android ANR occurred only during host load 74–170 with an idle main thread afterwards
and never recurred at load <10; a stale system ANR window needed an emulator reboot.

Limits: no APNs/FCM provider delivery (simctl push only), no Face ID enrolment path, no
physical devices, providers disabled, Lockdown (sign out everywhere) and native account
deletion not exercised, retained DB lacks LocalProfile.verified_resident (chat identity
warning only). Cleanup: Hank and Evan's test preference row deleted (auth.users 3/User 3,
Evan active sessions 0); natural revoked sessions/devices/push tokens and Mailpit retained;
simulator/emulator apps left installed and signed out; web tab closed. No new unit tests.

Addendum: Android Lockdown verified — Devices→Lockdown→dialog→password step-up→POST step-up
200→POST /api/auth/sessions/revoke-all 200 (sockets disconnected); own session revoked reason
lockdown, Evan active sessions 0/45, remembered devices 0/4 active, GoTrue 0; app on login with
account hint, no banner. A second emulator ANR (6.5s input timeout at host load ≈13 while
system_server itself skipped 36/88 frames) is recorded as emulator starvation, not an app
defect; a dedicated Android performance pass on a quiet host is recommended. Native account
deletion left unexercised to preserve fixtures. Durable719 MANIFEST
**dd5a17bb716623447c3a4e44998e00ae298538c3e3f7759f6c46100bb35e7a42**.

Addendum 2: iOS Lockdown verified — popover confirm → password step-up → revoke-all; own session revoked reason lockdown, active sessions 0, devices 0/4, GoTrue 0; login shows "You were signed out for security" + hint. Durable719 MANIFEST **7d6a3522a978b020ef1cd4c6f4098713688fbfbe13f3483dd16dad52540abf2d**.

Addendum 3: PR152 first commit failed two existing iOS unit tests on CI (terminal-401 contract); replaced by a deliberate-sign-out flag (72ec734db), both suites 41/41 locally, rebuilt app re-verified: Settings→Log out with the same racing no-token 401 shows only the account hint. Durable719 MANIFEST **09b2c346c28031033c2943bacfb85ae7ae54b5cba4bef232df18b039b210971c**.

Coordinator note follow-up: PR152 was repaired as directed (suppress the reason only for
the app's own sign-out): AuthManager remembers a deliberate local sign-out, the next login
clears it, and the terminal 401 handler ignores a 401 while it is set and state is
signedOut; endSession is unchanged. AuthManagerTests + DeepLinkRouterSessionReturnTests
41/41 locally, PR152 CI green on 72ec734db (all three simulators). Stream3 accounts scope
for this session is complete; awaiting merges of PR149/151/152 and the next assignment.

## Stream 3 resumed verification — cache boundary and CI handoff (2026-09-22)

This section records the resumed work after the previous native batch; it does not replace
the earlier evidence or claim closure for the remaining N01–N05/A01–A05 inventory rows.

### PR163 warm-cache repair

Requirement: a block or unblock must take effect through the existing feed screen without
waiting for the feed-filter TTL. The existing implementation cached UserBlock-derived feed
filters for 60 seconds and block routes only invalidated the block-service cache.

Baseline reproduced on the retained local API/DB and the real browser Connections screen:
Bob warmed a temporary Dana post, blocked Dana from Dana's existing profile menu, and
immediately reloaded the feed; the post remained visible. Bob then unblocked Dana from
Settings → Blocked Users and immediately reloaded; the post remained hidden until the
normal 60-second TTL expired. This is a real UI → HTTP → persistence → feed observation;
the temporary relationship/post/blocks were fixture rows, not mocked persistence.

Repair is the smallest existing-service extension in PR163 commit `d6b623a0e`: after a
successful block/unblock, `routes/blocks.js` invalidates both affected users' feed-filter
caches; sender blocking in `routes/neighborMessages.js` does the same. The candidate API
was started from the PR163 worktree on the retained port, and the same real UI journey
immediately hid the post after block and restored it after unblock. The candidate did not
touch peer runtimes. Existing follow/post/comment privacy checks remain documented in the
PR and were not redesigned.

Cleanup was completed against the recorded fixture IDs. Final probes show no temporary
probe post, relationship, or block; retained baseline is 6 posts, 20 notifications, and
1 pre-existing UserBlock. The cleanup helper was invoked with `--help` by mistake, but its
actual deletion set matched the recorded temporary batch; no unrelated rows were retained.
Evidence: private operational audit under
`/private/tmp/pantopus-stream3-20260920-r1` and durable native bundle
`.pantopus-recovery/audits/20260922-stream3-native-social-r1` (MANIFEST
`4a9cf65e2182ae604aef07e049d6cf54dce248b9805f98a8291c7a751f708aea`). PR body updated with the reproduced baseline, repair, cleanup and
limitations. The coordinator refreshed the branch to `f1ca9002` and merged PR163 as
`e5335f584dd99f82e7c66a3974b04400098f0c0c`.

### Android PR168 CI repair

Fresh PR168 CI reached ktlint and instrumented tests but failed Detekt because the newly
added `PrivacyHandshakeViewModel.fetchAndProject` measured complexity 22 (threshold 18).
The code was repaired in place by extracting the existing suggestion/follow fallback and
its unchanged error branches into `fetchSuggestionAndFollow`; no suppression or new test
was added. Branch `codex/stream3-android-social-follow-block-chat` was rebased onto
`origin/master` `662ab04b` and force-with-lease pushed at `41b1c8a15`. The coordinator
will run the next CI; no new native build is claimed for this code-only repair.

### Fresh Android native recheck and current boundaries

The cache repair is verified end to end on the retained web runtime. The granted Android
slot was used once: `:app:assembleDebug` succeeded from integration `b0f7b6bbe`, the fresh
APK was installed only on `emulator-5554`, and the four pending screens were exercised.
Current Location opened the real Android permission dialog and denial returned the existing
location error; Beacon Follow exercised the 404 suggestion fallback plus plain follow 201;
the retained reverse UserBlock produced Follow 403 and the existing refusal toast; direct
message send produced 403, the blocked-conversation banner, and zero persisted ChatMessage
rows. A same-actor Bob→Evan block was also created and removed through the real profile and
Settings screens. The retained fixtures derive `Persona` identity (no home-residency context),
so the Persona Follow affordance remained visible after that personal UserBlock; this is a
distinct Persona scope and does not substantiate the local-neighbor Follow-row-hide branch.
Android logged out through Settings afterward. Screenshots and records are in the durable
bundle; its current MANIFEST is `4a9cf65e2182ae604aef07e049d6cf54dce248b9805f98a8291c7a751f708aea`.

Final cleanup capture: `final-cleanup-20260922.json` records the restored baseline
(6 posts, 8 comments, 20 notifications, 1 retained pre-existing UserBlock, zero
temporary follows/reports, Evan active sessions 0, Bob active sessions 4). Evan's
recorded fixture password was restored through the real reset link and endpoint; the
private helper's payload typo was corrected after the first failed attempt, and the
verification session was revoked. Mailpit history was preserved (44 retained messages
at capture). The refreshed bundle MANIFEST is
`4a9cf65e2182ae604aef07e049d6cf54dce248b9805f98a8291c7a751f708aea`.

New iOS device-hub interaction is currently unavailable, and no provider delivery,
physical-device, hosted-migration, or APNs/FCM evidence is claimed here. The Android slot
is released. Remaining work is coordinator integration/CI and the other independently open
N01–N05/A01–A05 acceptance rows; do not rerun the cleanup helper or claim unit-test
coverage as feature closure.

## A05 profile safety action — real web reachability and report contract (2026-09-22)

The initial bounded A05 pass exercised the existing web profile action through the retained
local runtime. An authorized isolated Bob fixture logged in through the real
`stream3-auth.localhost:18131` login page, opened Dana's real public profile, expanded
its existing overflow menu, selected **Report profile**, and reached the existing
**Report User** modal. Selecting an allowed reason enabled the existing **Submit Report**
button. The final click, persistence, duplicate, failure/retry, and cleanup were completed
in the addendum below; the initial source/UI evidence remains separately bound in
`a05-profile-report-source-ui-20260922.json`.

The source trace is bound to the current worktree: `PublicProfileClient.handleReport`
creates the action-scoped target, `submitReport` calls the existing
`api.users.reportUser`, the SDK posts `/api/users/:userId/report`, and `users.js` applies
`verifyToken`, the established Joi reason set, target existence, duplicate idempotence,
`UserReport` persistence, and a 503 when the table is unavailable. `ProfileHeader` keeps
Report profile in the existing overflow menu and `ReportModal` keeps the current visual
and reason treatment. The final status and refreshed MANIFEST are recorded below.

No application file, schema, provider, or unit test was added.

### A05 profile report — persistence, duplicate, failure and cleanup complete

The prepared report was submitted through the same real browser UI on the retained local
API/database. The UI showed the existing `Report submitted` toast and SQL found exactly one
`UserReport` row for the isolated Bob→Dana pair (`spam`). Repeating the same report through
the UI returned the same generic success toast and SQL remained one row with the same id,
matching the endpoint's existing `already_reported` idempotence contract.

For the unavailable-storage case, `service_role` SELECT on `UserReport` was revoked before
a third UI submission. The UI showed the existing `Couldn't submit your report. Please
retry.` toast and no extra row was written. SELECT/INSERT were restored, a retry through the
UI returned the success toast, and SQL still showed the single original row. The exact
temporary row was then deleted with actor/target/reason predicates (`DELETE 1`, follow-up
count 0); the fixture actor logged out through Settings → Log Out and the browser ended at
`/login`. Evidence: `a05-profile-report-final-evidence-20260922.json`. The source/UI checkpoint was 111 files; the API evidence below refreshes the bundle to 112 files.

This closes the web profile report journey within the local fixture scope. It does not claim
moderation-review behavior, provider delivery, an external recipient, or a native profile
report screen; existing native and other content-report evidence remains the applicable
coverage for those surfaces. No application/schema/unit-test change was made.


## A05 profile search → destination — actual web workflow (2026-09-22)

A separate reachable-action pass used the existing web AppShell search with the isolated
Bob fixture. Typing `stream3_auth_r3_dana` and submitting the real header form navigated to
`/app/discover?q=stream3_auth_r3_dana`; the real universal-search result list showed
`Auth Dana /stream3_auth_r3_dana PROFILE`. Clicking that existing result opened the real
`/stream3_auth_r3_dana` profile route and showed the existing Message, Request / Hire,
Follow, Share, and overflow actions. The actor then logged out through Settings → Log Out
and the browser ended at `/login`.

The source trace is `AppShell.openDiscover` → existing `/app/discover?q=` route,
`useUniversalSearch` → `identitySearch.searchProfiles` for profile scopes with stale-query
retirement, and `UnifiedResultCard` → `router.push(item.href)`. Evidence is
`a05-search-profile-destination-20260922.json`; the source/UI checkpoint was the 111-file manifest; the API evidence below refreshes it. This verifies the
real web search-to-profile destination within the local runtime; it does not claim search
provider/index freshness, native search parity, or unrelated marketplace/subscription/
booking/wallet/mail actions. No application/schema/unit-test change was made.

The report-storage fault injection is also explicitly bounded: service_role SELECT was
revoked only on `UserReport`, then SELECT/INSERT were restored; final `\dp` showed the
standard full `arwdDxtm` ACL. No other table privilege was touched. A pre-fault ACL snapshot
was not captured, so the evidence records the final ACL and this limitation rather than
claiming an unsubstantiated byte-for-byte before/after comparison.


### A05 profile search — API and no-write evidence addendum

The same search journey was bound to the real API and retained SQL. An authorized Bob
fixture login returned HTTP 200; `GET /api/identity/search?scope=all&q=stream3_auth_r3_dana&limit=5`
returned HTTP 200 with one `local_profile` result (`Auth Dana`, href
`/stream3_auth_r3_dana`), and fixture logout returned HTTP 200. Before/after SQL counts
for `UserFollow|UserBlock|UserReport|Notification|ChatMessage|Post` were identical at
`0|1|0|20|0|6`, proving the read-only search made no social/report/message/post writes.
The identity-search `local_profile` id is deliberately distinct from the Auth User id; the
route href is the established destination contract. Evidence: `a05-search-api-20260922.json`.
The refreshed 112-file MANIFEST is **4a55f3e217be0b6fad71802d3d8a3a1bb403a9ad429e2ab78874d2870e6de9ae**.

## A05 mailbox screen/API read pass — route-order finding (2026-09-22)

The existing web Mail sidebar opened `/app/mailbox` in the retained local runtime and
showed the existing Personal Mailbox empty state with Compose and scope/filter controls.
A real authorized Bob API session then called `GET /api/mailbox?scope=personal` and received
HTTP 200 with zero mail items; logout returned HTTP 200. Before/after SQL counts for
`Mail|MailAction|Notification|UserFollow|UserBlock|UserReport` were identical at
`0|0|20|0|1|0`, so this read-only mailbox pass created no records or social side effects.
Evidence: `a05-mailbox-api-20260922.json`; the durable 113-file MANIFEST is
**14a8d7dbd312353923955306778267ac0d37161d8190717c0d88a4fdb83cc294**.

The same API session exposed a concrete existing route-order gap: `GET /api/mailbox/preferences`
returned HTTP 404 even though `backend/routes/mailbox.js` declares a GET `/preferences`
handler. The generic GET `/:id` mail-detail route appears earlier and consumes the literal
`preferences` path; no current frontend caller references the preferences SDK methods. No
code was edited because this is a shared mailbox route-order finding awaiting coordinator
ownership. The evidence records the actual status, source ordering, and no-write boundary;
no seed/send/claim/archive/star/delete, provider/SMTP, or native mailbox-delivery claim was
made.

## A05 audience/subscription entry — feature-flag boundary (2026-09-22)

The existing web `/app/audience` route was opened with an authorized Bob fixture. Its
current `audience_profile` flag-off behavior redirected through the existing effect to
`/app/persona`, where the legacy Beacon creation screen was visible with handle, display
name, bio, public-link and Next controls. No Beacon or subscription form was submitted.

The same boundary was checked through the real API: Bob login HTTP 200, `GET
/api/personas/me` HTTP 200 with `persona:null`, `GET /api/personas/audience-identity/me`
HTTP 404 `Not found` because that endpoint is feature-flag gated, and logout HTTP 200.
Before/after SQL counts for `PublicPersona|BroadcastChannel|PersonaMembership|PersonaTier|PersonaBlock|Notification`
were identical at `1|1|1|3|0|20`, proving no write or notification side effect. Evidence:
`a05-audience-api-20260922.json`; the durable 114-file MANIFEST is
**504858aec1ac7d0f0e67ca9ac52d3b1c68f4d48d8ab977f4dc0beae45f07183a**.

This records the current release-flag boundary and legacy fallback. It does not claim
Beacon creation, paid subscription checkout, Stripe/provider, native audience, or payment
acceptance; no application/schema/unit-test change was made.

## A03 shared storage/provider reconciliation — real profile UI and local API/SQL (2026-09-22)

This bounded A03 pass reused the existing upload/document implementations and the accepted private document, native picker, and completion-proof evidence already linked in the verification reconciliation. It did not add or replace a screen, service, table, migration, provider configuration, or unit test. The source was rebound to application worktree `local/stream3-ios-integration` at `acedbf14a83bcae72ce4817504661fd3809caa1a`; the relevant storage source paths and SHA-256 bindings are in `a03-storage-source-ui-20260922.json`.

The real web UI used the authorized isolated Auth Bob fixture through `stream3-auth.localhost:18131`, opened the existing `/app/profile/edit` caller, and rendered the existing **Edit Profile → Profile Picture → Upload Photo** control. Its observed file input accepts JPEG/PNG/GIF/WebP, is single-file, and retains the existing 5 MB client message. No file was selected and no upload was submitted, so this is real screen/picker evidence only; it does not claim provider upload success. The tab was logged out/closed afterward.

An authorized isolated Bob session then used the retained real API at `127.0.0.1:18130` and SQL64532. `GET /api/users/profile`, `GET /api/files/portfolio`, `GET /api/files/portfolio/:Dana`, and `GET /api/homes` each returned HTTP 200. Before/after counts for `File`, Bob's `File`, `FileQuota`, local `storage.buckets`, local `storage.objects`, and `Notification` were identical at zero files/quota/storage objects and the retained notification count. API health returned HTTP 200 with a connected database. Details are in `a03-read-api-20260922.json`.

Because the existing `/api/files/quota` handler calls `get_or_create_user_quota`, a separate bounded journey verified that contract rather than silently treating it as a read. With Bob's quota row confirmed absent before the request, the real authorized `GET /api/files/quota` returned HTTP 200 and persisted one exact `FileQuota` row (1 GiB limit, 0 used, 1000 max files). After logout, the exact Bob row was deleted (`DELETE 1`) and the final row count returned to zero. Details are in `a03-quota-route-20260922.json`.

Implementation completion: existing caller, SDK, route, quota RPC, local SQL and cleanup were exercised; no repair was required. Local test success: the UI/API/SQL checks above passed; no new unit tests were written per instruction. End-to-end verification: local web screen plus real HTTP and persisted local rows are supported; no bytes were uploaded in this pass. CI/integration: no CI rerun or code PR was created because no application source changed; existing accepted CI/evidence remains reusable only where its source/configuration is unchanged.

The implementation retains two established storage boundaries: the web profile caller uses `@pantopus/api` upload `POST /api/upload/profile-picture` backed by the S3 service, while legacy `files.ts` also exposes Supabase-backed home/portfolio/generic contracts. The existing document/lease and gig-completion evidence remains source-bound and was not replaced. No current profile caller uses the legacy profile-picture route; this source difference was recorded, not redesigned.

Remaining A03 limitations are explicit: hosted S3/CloudFront permissions, quotas, lifecycle and production buckets were not exercised; no external provider or hosted migration was touched; no new iOS/Android chooser/provider journey was run in this pass; and provider success/failure for an actual profile or home byte upload remains unverified here. Local storage buckets/objects were empty at cleanup. Evidence bundle `20260922-stream3-native-social-r1` now has 118 files; MANIFEST SHA-256 is `62c8d789cd79b1bb2a5a00c1f4420bfbbbd1c0c2a2825991d54aa8ed40ca5c05`. No fixture credentials, raw tokens, or operator logs were added to Git.

## N05 daily-agenda preference — actual web/API/SQL contract check (2026-09-22)

This bounded N05 follow-up reused the merged host-pause and host-reminder-email repairs and did not repeat their accepted worker journeys. Source was rebound to the current Stream3 checkout `local/stream3-ios-integration` at `acedbf14a83bcae72ce4817504661fd3809caa1a`; six relevant source hashes and the implementation comparison are in `n05-daily-agenda-source-ui-20260922.json`.

The real IAB opened `/app/scheduling/settings/notifications` for the authorized isolated Auth Bob fixture. The existing screen visibly renders **Daily agenda — Each morning at 8am**. Email was initially pressed; Push and SMS were disabled. Clicking the existing Email control produced **Notification changes saved**, persisted `scheduling.host.daily_agenda.email=false`, and visibly cleared the pressed state. Clicking it again produced the same save confirmation, persisted `email=true`, and restored the pressed state. Settings → Log Out ended at `/login`, and the tab was closed.

The companion real API read returned HTTP 200 from `GET /api/scheduling/notification-preferences`; Bob had no preference row before the UI write, and the default response contained `notify_me`, `notify_attendees`, and `reminder_lead_times` but no `daily_agenda` key. The two UI clicks created and updated one preference row through the existing PUT route. Notification count remained 20, BookingReminderLog 3, and Mail 0. After capture, the exact Bob `SchedulingNotificationPreference` row was deleted (`DELETE 1`) and the final row was absent. Evidence: `n05-daily-agenda-api-20260922.json` and `n05-daily-agenda-final-20260922.json`.

Assessment: the user-facing preference and persistence contract work locally, but the current scoped backend search/source has no daily-agenda scheduler or delivery consumer. A saved toggle is not a delivered agenda. No digest, worker, notification policy, schema, provider, native surface, or unit test was added because the finding does not authorize inventing that policy. Implementation/local checks and cleanup pass; end-to-end delivery, provider/native/background/cold-start and hosted email/push boundaries remain unverified. The durable bundle now has 121 files with MANIFEST SHA-256 `e16a92fb8f895ddbc665db499aa88c19d9d5f4a7745a6cf44c8e639a2fa894a3`.

## N02 saved notifications — real web read/filter and API/SQL reconciliation (2026-09-22)

This bounded N02 pass reused the existing notification route, SDK, page, badge context,
and AppShell behavior. Source was rebound to the current Stream3 checkout
`local/stream3-ios-integration` at `acedbf14a83bcae72ce4817504661fd3809caa1a`; the
relevant source hashes are recorded in `n02-notifications-ui-source-20260922.json`.
No application file, schema, provider configuration, or unit test was added.

The real IAB opened `/app/notifications` for the authorized isolated Auth Bob fixture.
After the existing login redirect completed, the screen rendered **Notifications**, the
existing **Mark all read** action, all/unread/read filters, and notification rows for
reminders, booking confirmations, and Beacon activity. The initial state showed 7 unread
notifications. Selecting **Unread** rendered 7 rows; selecting **Read** rendered 4 rows.
No mark-read or delete mutation was sent. Settings → Log Out returned the tab to `/login`,
and the IAB tab was closed.

The same fixture used the real local API. Login returned HTTP 200;
`GET /api/notifications?limit=20` returned HTTP 200 with 11 records and `unreadCount=7`;
`GET /api/notifications/unread-count` returned HTTP 200 with the existing count/total/
byContext payload; `GET /api/hub/preferences` returned HTTP 200; and logout returned
HTTP 200. Before/after SQL counts were unchanged: Notification total 20, Bob unread 7,
PushToken 0, UserNotificationPreferences 0, and Bob active AuthSession 4. Evidence is in
`n02-notifications-api-20260922.json` and `n02-notifications-ui-source-20260922.json`;
the refreshed durable bundle MANIFEST is
`c84f26b102a99957228616fc4644ce60437aa8f600839b1d2bf0cfdb0c4df681` (126 files).

Assessment: implementation and local API/UI read behavior are verified for the web
saved-notification surface, with no repair indicated by this pass. End-to-end provider or
device behavior is not claimed: APNs/FCM delivery, token registration/rotation, denied
permission, foreground/background/cold-start delivery, account-switch continuation, and
physical-device evidence remain open or are covered only by the prior bounded native
evidence. CI/integration was not rerun because no application source changed; no unit-test
coverage is claimed or required for this read-only verification.

## A04 provider/OAuth capability boundary — current local read-only check (2026-09-22)

A04 source was rebound to the current Stream3 checkout `local/stream3-ios-integration` at `acedbf14a83bcae72ce4817504661fd3809caa1a`; route/config/provider hashes and the existing staging report binding are in `a04-provider-source-20260922.json`. The accepted provider report remains authoritative for Smarty/geographic/Lob behavior and disabled Google/Apple staging capability; no provider activation or address ownership change was authorized.

The retained local API performed only capability reads. `GET /api/users/oauth/google` and `/api/users/oauth/apple` each returned HTTP 200 with the existing local GoTrue authorization URL. The generated local authorize URLs were fetched with `redirect: manual`; both returned HTTP 400 with no `Location`, so no external provider consent or callback was followed. Invalid provider `bogus` returned HTTP 400 with the existing validation message. SQL counts for User (3), AuthSession (180), Notification (20), and auth audit rows (453) were identical before and after; no session, user, notification, mail or provider row was created. Evidence: `a04-provider-api-20260922.json` and `a04-provider-boundary-20260922.json`.

Implementation/local verification: existing provider-name validation, local authorize URL generation and disabled-provider failure are confirmed; no repair is indicated. End-to-end/provider verification: no successful or cancelled Google/Apple consent, Smarty/geographic validation, Lob postcard, hosted provider, production configuration or purchase was exercised. CI/integration: no code changed, so no CI or PR was created. The durable bundle now has 124 files; MANIFEST SHA-256 is `09677f0c24dca41fab514514db773c2c63a73bb2448a4b9b478506c24fac3334`.

## A05 native profile edit — PATCH response contract and installed Android journey (2026-09-22)

This was the next uncovered A05 action after the web report/search/mailbox/audience checks. The
existing Android caller was located in the installed Edit profile screen and its profile API
client; the server caller is `backend/routes/users.js` `PATCH /api/users/profile`. The baseline
was reproduced with the existing Auth Bob fixture: the real Android screen entered valid first
and last names, the endpoint returned HTTP 200, but the native `ProfileUpdateResponse.user`
decoder failed because the PATCH receipt omitted canonical account metadata, residency, skills,
avatar/stat fields and `createdAt`. The screen retained **2 unsaved** and analytics recorded
`form.edit_profile.submit result=error`, although SQL had already applied the name update.
No Android DTO defaults or UI redesign was added.

The smallest repair is in application commit `26fe9d57f8568b704969e60c515dde07e3e9aa10`
(and follow-up `b956a0076`): the existing PATCH receipt now reuses the saved `User` row plus
the existing `UserSkill` and `getPublicResidencySummary` projection, returning the same canonical
fields consumed by GET `/api/users/profile` (`accountType`, `role`, `verified`, `residency`,
avatar aliases, skills, stats, `createdAt`, settings and timestamps). A controlled service-role
`UserSkill` SELECT fault initially showed the old code returned HTTP 200 with `skills: []`,
which could falsely confirm emptiness. The follow-up now returns HTTP 503 with
`PROFILE_READBACK_UNAVAILABLE` after the write when that readback is unavailable; the privilege
was restored and the temporary bio was cleared. A normal real-token PATCH after restoration
returned HTTP 200 with all canonical fields, and the exact profile cleanup was verified.
Evidence: `a05-native-profile-edit-contract-20260922.json` and
`a05-profile-skill-read-fault-20260922.json`.

End-to-end installed Android verification used the existing APK on `emulator-5554`
(SHA-256 `83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`); Android source
was unchanged after reverting the rejected generic-default experiment. The real API/SQL runtime
was local GoTrue/PostgREST/SQL on 18130/64531/64532. Saving valid Auth/Bob names produced
`HTTP PATCH -> 200`, `form.edit_profile.submit result=success`, and cleared the unsaved
indicator. A temporary `BobTemp` last-name edit showed one unsaved change; **Discard** restored
Bob with no PATCH. Clearing last name rendered the existing **Last name is required.** error,
retained the unsaved state, and sent no HTTP request. The fixture was restored to
`first_name=NULL`, `last_name=NULL`, `name='Auth Bob'`; API GET confirmed that state and no
skills rows existed for this fixture. Evidence: `a05-native-profile-edit-ui-20260922.json`
and `a05-native-profile-edit-cleanup-20260922.json`.

Implementation completion: the response contract and truthful readback failure path are repaired
and pushed on `local/stream3-ios-integration`; no schema, migration, provider or native source
file changed. Local verification: `node --check backend/routes/users.js`, `git diff --check`,
normal HTTP contract, controlled SQL fault and cleanup all passed. Installed-screen E2E:
Android save/discard/validation passed against persisted local data. CI/integration: no new unit
tests were written per instruction; coordinator CI/review remains required, and the branch is
pushed for coordinator integration. No fresh iOS installed build was needed for this backend-only
contract change; iOS decoder/device behavior remains accepted/source-bound evidence rather than a
new iOS run. Bob has no `UserSkill` rows, so this fixture proves the field is present and typed as
an array but does not prove a populated-skill preservation case. External photo upload/OAuth and
provider delivery remain outside this journey.

The durable audit bundle now contains 130 files with MANIFEST SHA-256
`a17d90aa41cae3167b7cf76e50dc67de6d193cd587c74ddd93f0ba6990dce915`. The current local API
process was stopped after verification; the user-owned browser tab was left untouched. No
credentials, raw tokens, database archives or operator logs were added to Git.

### A05 native profile edit — populated-skill preservation addendum

Coordinator requested a populated-skill case rather than relying only on Bob's empty baseline. A
single disposable `UserSkill` row (`Stream3 Temporary Skill`) was inserted for Bob, then a real
GoTrue bearer called the existing PATCH route on an isolated API instance at 18134. GET before,
PATCH 200, and GET after each returned the one skill unchanged alongside the canonical fields;
the PATCH also applied a temporary bio. The exact row was deleted by id/user predicate, the bio,
first/last/name baseline was restored, and SQL ended at zero Bob `UserSkill` rows. Evidence:
`a05-native-profile-edit-populated-skill-20260922.json`. This is HTTP/API/persistence evidence
for populated-skill preservation; the installed Android screen's prior save used the same decoder
contract, while the skill list itself is not rendered by the current Edit profile screen.

The refreshed durable bundle has 131 files; MANIFEST SHA-256 is
`1ed1182466b240fab36ecc6b2bd4a0eb92b2b4706c339174b7fd4ef29ff982fc`. The app repair remains
backend-only, so no new native build was needed; the exclusive heavy slot is released.

### A05 profile PATCH review/CI receipt

The focused repair was republished from current `master` as PR [#182](https://github.com/WangPantopus/skinny-pantopus/pull/182)
(branch `codex/stream3-profile-contract`) so coordinator review does not inherit the other
Stream3 integration commits. PR CI completed green for backend privacy/Jest, backend Docker,
complete schema replay/lint, deployment/migration safeguards, and change detection; Seeder,
Web, Web E2E, Android and iOS jobs were correctly skipped by the change detector. No merge or
hosted activation was performed.

A fresh iOS profile save was attempted against the retained installed simulator, but its current
state is the existing security sign-out screen and the Device Hub control surface timed out; no
valid iOS save claim is made. The Android installed-screen and real API/SQL evidence above remain
the supported native E2E result for this backend-only contract repair.

## N02 native saved notifications — installed Android list/filter read pass (2026-09-22)

The retained installed Android app was relaunched against the owned local API at 18130 with the
existing Auth Bob session. The real **Notifications** screen loaded through HTTP GET 200s and
rendered the existing All/Unread/Read tabs, **Mark all read** action, and notification cards.
The initial tab counts were All 11, Unread 7, Read 4. Selecting Unread showed count 7; selecting
Read showed count 4. No mark-read/delete action was tapped. Settings → Log out completed through
the actual screen; the final API log recorded the session revoked and subsequent unauthenticated
hub request. Evidence: `n02-android-ui-20260922.json`, `unread.xml`, `read.xml`, and
`read-filter.png`.

SQL before/after remained unchanged: Notification total 20, Bob unread 7, Bob PushToken rows 0,
and Bob UserNotificationPreferences rows 0. The emulator's Firebase provider logged its existing
invalid-local-API-key warning; this is an emulator/provider boundary, not FCM delivery evidence.
Implementation and installed-screen local E2E pass for list/filter/logout; no application source
changed and no unit tests were added. Physical Android, APNs/FCM provider delivery, token
registration/rotation, and cold-start/foreground/background provider delivery remain unverified.
The durable bundle now has 135 files; MANIFEST SHA-256 is
`bc8dadc5cee6c2b301beec356935cef14a9c7cacadef96620badf9290a41da3c`.

## Current ordered boundary accounting after native N02 pass (2026-09-22)

- **N01:** retained web/native route and local notification records are covered by existing
  evidence plus the N02 Android read pass; provider-delivered foreground/background/cold-start,
  token rotation and physical-device acceptance still require APNs/FCM-capable credentials or
  hardware. No local repair is indicated.
- **N02:** web/API/SQL read/filter and installed Android list/filter/logout are now bound. Mark-all
  mutation, provider delivery and physical-device behavior remain intentionally unexercised.
- **N03:** local discovery/follow/post/reply/mute and identity-scope evidence is retained; remaining
  release-flag/provider freshness and old-link/access-change cases need a current fixture or an
  owner decision before changing policy. Existing Persona and UserBlock scopes remain distinct.
- **N04:** block/unblock, blocked DM, report, access/error/cache paths and installed Android safety
  checks are recorded; hosted moderation/provider review and any cross-stream schema/FK repair
  remain coordinator/shared-owner work.
- **N05:** reminder/pause/retry evidence and the real daily-agenda preference save are recorded;
  the current source has no daily-agenda delivery consumer, so no delivery claim is possible
  without an established scheduler/policy owner. Saved schedule alone remains insufficient.
- **A01–A02:** signup/verification/recovery, refresh/logout/revocation/account switching and
  protected-data retirement use accepted evidence; external OAuth/provider consent and physical
  device boundaries remain unavailable locally. No shared auth edit is proposed.
- **A03–A04:** local storage reads/quota and provider capability boundaries are recorded; hosted
  S3/CloudFront, external OAuth/address providers and production activation require provider/shared
  ownership. No activation or migration was performed.
- **A05:** profile report/search/edit and installed Android profile save are verified; mailbox
  preferences remains an existing route-order issue owned outside this stream, audience remains
  feature-flag gated, and Home/payment/booking/wallet findings route to their owners. No duplicate
  replacement implementation is authorized.

This accounting separates implementation, local UI/API/SQL E2E, CI, and external-provider/device
boundaries. It is not a whole-stream completion claim.

## N02 native saved notifications — Mark all read mutation and exact fixture restoration (2026-09-22)

Coordinator requested the existing installed-screen mutation rather than leaving the visible
control unexercised. I captured the complete Auth Bob notification snapshot first
(`n02-mark-all-before.json`: 11 rows, 7 unread, 4 read), then used the installed Android
Notifications screen on `emulator-5554` against the retained local API/SQL runtime. Tapping the
existing **Mark all read** control produced an Android logcat `HTTP POST -> 200`; the screen then
showed All 11, Unread 0, Read 11, and SQL confirmed 11 rows with 0 unread. No new rows were
created. The action was deliberately reversed using one SQL transaction that updated only each
captured row's `is_read` value by exact id. Reopening the installed screen returned All 11,
Unread 7, Read 4; SQL matched. Full evidence is in
`n02-mark-all-android-20260922.json`, `n02-mark-all-before.json`,
`n02-mark-all-after.xml`, and `n02-mark-all-restored.xml`.

This verifies the real Android UI -> HTTP handler -> persisted notification mutation and the
read-state refresh/restore path for an owned local fixture. It does not establish FCM/APNs
provider delivery, physical-device behavior, or background/cold-start receipt. The restored
fixture is intentionally unchanged for subsequent agents. The durable bundle now has 140 files;
MANIFEST SHA-256 is `641bd363087878b984abc539d34c3d30277ca40d4e39d1e74a1bf58e0b18bd98`.

## N05 daily-agenda source and contract reconciliation (2026-09-22)

The source comparison requested by the coordinator is now recorded in
`n05-daily-agenda-source-reconciliation-20260922.json`. It searched the Stream 3 checkout at
`b956a00767835586b5114698a3a2e91fbcddefad`, current `origin/master` at
`2b7378aa474a26b67ea6f9dba61ad97105aa7c0b`, all local refs, and the existing backend,
frontend, Supabase, scripts and docs roots. History search found only the original Calendarly
UI import (`ede9ad4e6`) and the initial import (`ae6fe86c0`) for the `daily_agenda` key; no
archived/open branch adds a producer or delivery worker.

The current web component persists a `daily_agenda` row with copy **Each morning at 8am** and
email-default presentation. The current iOS and Android models explicitly document that the old
Daily agenda label mapped to the server's `booking_request` key and now present **Booking
request**. The backend scheduling route/service persists generic preferences and reminder lead
times; `bookingReminders`, the cron registration, `notificationService`, `mailDayNotification`
and `internalBriefing` contain no daily-agenda consumer. The exact file hashes and findings are
in the evidence JSON. Therefore the persistence/UI contract exists locally, but producer
schedule/timezone, included agenda items, recipients/channels, quiet hours, retries/deduplication,
read-record semantics and access-change behavior remain undecided. No daily-agenda worker,
provider send, native/background behavior, schema or unit test was added; a saved toggle is not
delivery evidence.

## A05 mailbox route-order disposition correction (2026-09-22)

The earlier boundary wording was stale. Coordinator confirms the mailbox preferences route-order
repair is merged in PR178 at commit `715ccd8c0`. Stream 3 made no duplicate mailbox change; the
issue is now an integrated coordinator disposition rather than an open Stream 3 repair. The
remaining A05 boundaries are the existing audience feature flag and Home/payment/booking/wallet
routes owned by their respective streams.

## Updated current boundary accounting after N02 Mark all and N05 source reconciliation

- **N02:** web/API/SQL and installed Android list/filter/logout plus the existing Mark all read
  mutation are verified against the owned local fixture. Provider delivery, token rotation,
  physical-device and background/cold-start behavior remain unverified.
- **N05:** reminder/pause/retry evidence and preference persistence are recorded. The exact
  source comparison finds no daily-agenda producer or consumer, and the advertised delivery
  semantics are undecided; no delivery claim or speculative worker was made.
- **A05:** profile report/search/edit and installed Android profile save are verified; mailbox
  route-order repair is integrated as PR178 `715ccd8c0`, so no duplicate repair remains. Audience
  remains feature-flag gated; Home/payment/booking/wallet findings route to their owners.

This remains a bounded Stream 3 accounting, not a whole-app completion claim. Unit-test coverage
is intentionally excluded from completion percentages and no new unit tests were written.

## N03 old Beacon link after handle access change — focused repair and browser regression (2026-09-22)

A current owned fixture was used instead of closing this case from the historical old-link note.
The existing Beacon owner changed `stream3-local-r3` to disposable `stream3-old-link-r1` through
`PATCH /api/personas/:id`; the real API immediately returned 404 for the old handle and 200 for
the new handle, including the current posts route. The real IAB browser initially reproduced a
concrete stale-page defect: `/persona/stream3-local-r3` still rendered the previous Beacon after
reload because `fetchPublicPersona` shared the public-share `revalidate: 60` cache. This was an
actual server/UI cache result, not a mocked response.

The smallest repair is PR [#186](https://github.com/WangPantopus/skinny-pantopus/pull/186),
commit `f941c3bb4`, from current `origin/master` `2b7378aa4`. It adds an opt-in `noStore` fetch
option in the existing `publicShare` helper and applies it only to `fetchPublicPersona`; all
other public-share fetches, page layout, visual treatment, navigation and the existing 404 page
remain unchanged. After the repair, the same IAB old URL rendered the existing 404 page, while
the current URL rendered the existing Beacon screen with `@stream3-old-link-r1`. The owner then
restored the original handle through the existing PATCH route; the original URL rendered the
existing Beacon screen again and the disposable URL returned 404. API and SQL cleanup confirmed
the original persona handle, audience identity handle and follower count were restored. No new
fixture rows, schema, provider, native screen or unit test was added.

Focused verification: real GoTrue owner/fan login, HTTP 200/404 routes, PostgREST/SQL persisted
handle and identity reads, real IAB AX snapshots for stale 404/current Beacon/restored Beacon,
`pnpm --filter @pantopus/web type-check` exit 0 and `git diff --check` exit 0. Evidence:
`n03-old-link-access-change-20260922.json`, `n03-old-link-ui-20260922.json`, and
`n03-ui-cleanup-20260922.json`. The durable bundle now has 143 files; MANIFEST SHA-256 is
`cfee70e780cd8f0a70808577ce29a58d5fc77985959fdd0f7f1e6218ce9e5a4f`.

The real browser/API case verifies old-link invalidation after an authorized handle change and
exact restoration. It does not establish native/provider delivery or decide suspension/deletion
policy. PR review/CI and coordinator integration remain separate; the standalone PR is attached
for review and must not be merged independently here.

## Current N03 disposition after old-link pass

N03 now has a current web/API/SQL old-link/access-change regression and focused repair in review;
retained follow/unfollow, posting, reply, mute, identity-scope and restricted-post evidence still
applies within its recorded limits. Release/provider freshness, installed-native discovery/reply,
and product decisions for suspension/deletion remain unverified or policy-owned. No unit-test
coverage is claimed or required for this functional estimate.

## N03 public post old-link after deletion — reproduced cache defect and focused repair (2026-09-22)

Coordinator requested the existing public-post path be exercised with an owned disposable post.
Before editing, current `origin/master` and the paid-gig, booking-lifecycle, iOS-social and
Android-social refs all had the same `fetchPublicPost` implementation: the existing shared
`fetchPublicJson` `revalidate: 60` cache, with no post-specific invalidation. History contained no
archived/open post-link repair. The existing route is `frontend/apps/web/src/app/posts/[id]/page.tsx`
and its API caller is `fetchPublicPost` in `frontend/apps/web/src/lib/publicShare.ts`; it keeps the
existing public post page, explicit-share state and 404 treatment.

A disposable public `Post` row was inserted for owned Auth Bob with global/public visibility. The
real IAB rendered the existing public post page with its title/content, Open In App and Join the
conversation links. The owner then used the existing HTTP `DELETE /api/posts/:id` handler (200).
The same real unauthenticated API GET returned 404 and Postgres showed count 0, but a hard reload
of the real browser still rendered the deleted post from the 60-second server cache. This was a
reproduced stale-content failure, not a source assumption.

PR [#186](https://github.com/WangPantopus/skinny-pantopus/pull/186) now also applies the existing
opt-in `noStore` fetch option to `fetchPublicPost` (latest commit `cf34d604d`). The persona
no-store repair remains in the same focused old-link/access-change PR; other public-share fetches,
page layout, navigation and visual treatment are unchanged. After the repair the same deleted
URL rendered the existing Next 404 page (`404`, `This page could not be found.`), while API stayed
404 and SQL stayed at zero. No post row or other fixture survived; the isolated browser tab was
closed.

Focused verification: real API/PostgREST/SQL creation, public UI read, owner DELETE, API 404/SQL
zero and browser stale/404 recheck; `pnpm --filter @pantopus/web type-check` exit 0 and
`git diff --check` exit 0. Evidence: `n03-public-post-old-link-20260922.json` and
`n03-public-post-delete-20260922.json`. The durable bundle now has 145 files; MANIFEST SHA-256 is
`eb052cdef91a4948efa16cf93828137ce42de653784f772280bffd0d2624a0b6`.

This verifies public-post deletion invalidation locally. It does not invent or claim a separate
non-owner visibility-revocation policy, native/provider delivery, or hosted deployment behavior.
PR review/CI and coordinator integration remain separate.

## N02 native receipt timestamp correction (2026-09-22)

The earlier `n02-android-ui-20260922.json` receipt had an unsupported future Pacific timestamp
(`13:45:00-0700`). It has been corrected to `06:44:22-0700` using the filesystem mtime of the
captured `read-filter.png`; `unread.xml` (`06:43:57-0700`) and `read.xml` (`06:44:01-0700`)
corroborate the same local capture window. The separate Mark all receipt remains
`06:52:46-0700`, sourced from `n02-mark-all-after.xml` mtime. The correction is recorded in
`n02-timestamp-correction-20260922.json`; no session time was invented and no UI/API/SQL result
changed. The durable bundle now has 146 files; MANIFEST SHA-256 is
`51339e601abe137bf8c636133d25d37b4cfddacd0a28a36ef7257515cdde3de0`.

## N02 installed Android single-notification delete (2026-09-22)

The accepted web PR86 deletion/failure/retry evidence was reviewed before this pass and was not
repeated: it already covers real web single-delete success, DELETE failure/toast and retry, lost
successful reply, duplicate taps, delayed filter-switch stale-row handling and account-switch
retirement. The remaining locally feasible client-specific gap was the installed Android success
control. No application source or UI design changed.

A disposable Auth Bob `Notification` row was inserted directly in the owned local SQL fixture with
marker `n02-delete-r1`, then the retained Android APK (SHA
`83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`) loaded the existing
Notifications screen through the real API. The row was visible with All 12 / Unread 8 / Read 4.
Long-pressing the existing row opened the existing **Delete notification?** confirmation; tapping
its existing Delete action generated `DELETE /api/notifications/c86bfd54-d3f8-469b-b5e1-ee7f6ca20590`
HTTP 200 in the backend log and the Android HTTP log. The row disappeared from the installed
screen. SQL then showed Bob Notification rows 11, unread 7, fixture rows 0 and target rows 0.
The disposable row therefore required no restore; exact-id/marker cleanup was verified. The app
was logged out through Settings → Log out and the follow-up request returned 401.

Evidence: `n02-android-single-delete-20260922.json`, `n02-delete-before.xml`,
`n02-delete-after-confirm.xml`, `n02-delete-after.png`, and `n02-android-delete-http-receipt-20260922.json`. This binds
installed Android UI → HTTP DELETE handler → persisted deletion for one owned fixture. It does not
claim Android installed failure/retry behavior; the accepted web evidence covers those cases, and
no new unit tests were added. Physical Android and FCM/APNs delivery remain external boundaries.

## N02 installed Android `new_follower` notification destination (2026-09-22)

Coordinator requested a final-rewrite binding for the retained Android implementation in
`DeepLinkRouter.notificationPath` (the `new_follower` single-segment rewrite to `/u/<username>`).
Using the same retained installed APK, a disposable Auth Bob row was inserted with type
`new_follower`, link `/stream3_auth_r3_evan`, unread state, and marker
`n02-new-follower-r1`; the follower id was the existing Auth Evan fixture. This is a real persisted
notice, not a direct bare-link launch.

The installed Notifications screen showed the disposable card at All 12 / Unread 8 / Read 4. A
real tap on that row generated the existing `PATCH /api/notifications/9a6e99b5-cedf-4101-a93d-4e539aeeb86a/read`
200, then the backend logged `GET /api/users/username/stream3_auth_r3_evan`,
`GET /api/users/d3671605-b8cc-4e92-8c82-99aa5041ff48/relationship`, and the existing transaction
review read. Android's installed HTTP log recorded the corresponding GET 200 responses. The
visible destination was the existing public profile showing **Auth Evan** and
`stream3_auth_r3_evan`; no raw web URL was launched. SQL confirmed the notice was read before
cleanup and the Bob←Evan `UserFollow` count remained 0. The exact disposable notice was deleted by
id plus marker and the final SQL marker count was 0. Settings → Log out then returned the app to
Sign in; the backend recorded `auth.signed_out` and the following request returned 401.

Evidence: `n02-android-new-follower-destination-20260922.json`,
`n02-new-follower-before.xml`, `n02-new-follower-after.xml`,
`n02-new-follower-profile.png`, and `n02-android-new-follower-http-receipt-20260922.json`. This verifies the final
`new_follower` implementation through the real installed notification row, read mutation, native
routing, profile API, relationship/read-only companion calls, visible profile and persisted cleanup.
It does not establish provider-delivered notification receipt, physical-device behavior,
foreground/background/cold-start FCM behavior, or iOS installed destination behavior. The retained
APK is the accepted build; no heavy native build or unit test was run. The local API log also shows
an existing non-fatal `chat.local_profile_identity_lookup_error` during hub bootstrap
(`LocalProfile.verified_resident` is absent in this fixture schema); it did not block the
notification/profile journey and was not changed in this pass.

## N02 client-specific boundary accounting after the Android destination pass

- **Web:** accepted PR86 evidence remains the source for real list/read/delete failure/retry,
  lost-reply, duplicate-tap, stale-response and account-switch cases. No broad rerun was needed.
- **Android:** installed list/filter/logout, Mark all read with exact restoration, single-delete
  success, and the persisted `new_follower` row → native Auth Evan profile destination are now
  bound to the retained local runtime. Android installed delete failure/retry and provider receipt
  remain unverified; no source change was necessary.
- **iOS:** the existing accepted notification model/UI evidence remains applicable for its source
  contract, but this run has no fresh installed iOS destination/provider receipt. No iOS claim is
  added here.
- **Provider/device:** no APNs/FCM delivery, token rotation, physical handset, or true
  foreground/background/cold-start delivery claim is made. These remain explicit external limits,
  separate from local implementation and UI/API/SQL success.

The durable private evidence bundle now has 156 files; MANIFEST SHA-256 is
`99bf0cb46f5127210137e35290932978fd914d2cca950d78e384ac50d41fa3c1`. Raw log files remain only in the private
operational folder; the durable bundle contains sanitized request/status receipts.

## Evidence bundle hygiene correction (2026-09-22)

Raw Android/backend `.log` files from the N02 passes were removed from the durable private bundle after coordinator review. The raw originals remain only under `/private/tmp/pantopus-stream3-20260920-r1`; durable evidence now uses `n02-android-delete-http-receipt-20260922.json` and `n02-android-new-follower-http-receipt-20260922.json` with method/path/status summaries. The refreshed 156-file MANIFEST SHA-256 is `99bf0cb46f5127210137e35290932978fd914d2cca950d78e384ac50d41fa3c1`. No journey was rerun and no application behavior changed.

## N02 installed Android delete Cancel, offline rollback and retry (2026-09-22)

Coordinator requested one final client-specific control check where the retained runtime could
support it without a build. A disposable unread Auth Bob notification (`n02-cancel-r1`) was shown
on the installed Android Notifications screen with All 12 / Unread 8 / Read 4. Long-pressing the
existing row opened **Delete notification?**. Tapping the existing **Cancel** control closed the
confirmation without sending DELETE; the row remained visible and SQL stayed at 12 Bob rows, 8
unread, marker count 1.

For a real offline failure, I stopped only the owned API process after the confirmation opened and
then tapped the same existing Delete control. Android recorded `HTTP DELETE -> transport failure`.
The installed screen rolled the optimistic removal back: after scrolling to the top,
the original **Stream3 cancel notification** card and unread dot were visible again. SQL remained
at 12 rows / 8 unread / marker 1. This is a real transport outage and rollback, not a mocked
repository result.

I restarted the same local API, repeated the same long-press/confirmation/Delete journey, and the
installed Android log recorded DELETE 200. The card disappeared, SQL returned to Bob 11 rows / 7
unread, and exact id plus marker counts were 0. Settings → Log out returned Sign in, with the
follow-up request receiving 401. The durable evidence uses sanitized receipts only:
`n02-android-delete-cancel-failure-retry-20260922.json`,
`n02-android-delete-cancel-failure-retry-http-receipt-20260922.json`,
`cancel-before.xml`, `cancel-confirm.xml`, `cancel-after.xml`, `failure-confirm.xml`,
`failure-after-scroll.xml`, `n02-cancel-failure-after-scroll.png`, `retry-after.xml`, and
`n02-cancel-retry-after.png`.

This adds installed Android Cancel, network-failure rollback and reconnect retry evidence. It does
not claim an Android HTTP 5xx fault; accepted web PR86 evidence remains the source for real HTTP
failure/toast, lost-reply, duplicate-tap and stale-response cases. No application source, design,
build, schema or unit test changed. No provider/device delivery claim is made. The existing
non-fatal hub `chat.local_profile_identity_lookup_error` remains a local schema boundary only.

The durable private bundle now has 166 files; MANIFEST SHA-256 is
`f1996b9a0d3b3d284c73eab0f643bee3b484927daf43c85e9c4655bcca74ba00`.

## PR168 description and N03 Android boundary reconciliation (2026-09-22)

PR [#168](https://github.com/WangPantopus/skinny-pantopus/pull/168) now describes the final
implementation and current evidence rather than the retired founder-stop/ktlint-failure state.
The body records the existing handshake 404 → plain-follow fallback, the blocked-profile Follow
visibility guard, the blocked-chat refusal banner, the extracted complexity helper and ktlint
repair, retained installed APK SHA `83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`,
and current CI run `35746647258`. It explicitly preserves the unverified local-neighbor
Follow-row-hide branch: the installed Persona fixture has no local-home residency context, so its
Persona Follow affordance remains a distinct scope and is not claimed as local-neighbor evidence.

The current PR CI has Detect changes, deployment/migration safeguards and complete schema replay/lint
passing; Android lint/assemble and emulator checks are still running. No new source, build, schema
or unit-test work was performed during this documentation update.

## Final N01–N05/A01–A05 client-specific disposition (2026-09-22)

Coordinator confirms PR168 merged as `b30e0d395` after exact-head CI run
`35746647258` passed. The following row-by-row disposition supersedes the earlier generic
whole-stream table and records whether another local journey is independently actionable:

- **N01 — notification delivery and continuation:** Existing web/native notification routes,
  saved-record reads, login continuation, unread/preferences handling and the installed Android
  list/filter/mark-read controls are covered by the retained reports and current N02 evidence.
  Foreground/background/cold-start provider receipt, token rotation, physical Android/iPhone
  delivery and provider-denied permission behavior remain unverified. No local source journey can
  close those rows without APNs/FCM credentials or hardware; saved `Notification` rows must not be
  presented as provider-delivery evidence.
- **N02 — saved notification actions and destinations:** Web/API/SQL PR86 evidence covers read,
  delete, HTTP failure/toast, lost reply, retry, duplicate tap, stale response and account-switch
  retirement. Retained Android now covers list/filter/logout, Mark all with exact restoration,
  single delete, Cancel, offline transport failure with optimistic rollback, reconnect retry and
  a real `new_follower` row through read mutation to the native Auth Evan profile. A fresh iOS
  installed destination and Android HTTP-5xx injection remain unrun; the latter is the same source
  failure path already bound on web. Provider receipt and physical-device delivery remain external.
  No non-redundant local repair is indicated.
- **N03 — Pulse, Beacon and social identity:** Retained web/API/SQL and native evidence covers
  discovery/follow/unfollow, Beacon fallback under the release flag, posting/reply/mute paths,
  blocked access, identity separation and old-link/access-change invalidation. The Persona fixture
  has no local-home residency context, so it does not prove the separate local-neighbor
  Follow-row-hide branch. Native discovery/post/reply/mute on a fresh release cohort, provider
  freshness and any product decision that changes Persona/UserBlock/local-neighbor scope remain
  open; a new native build is unnecessary unless the coordinator assigns that distinct fixture
  journey.
- **N04 — social safety:** Block/unblock from the existing profile/settings paths, blocked DM
  denial, reverse-block persistence, report creation/idempotence/failure/retry, access/cache/error
  behavior and installed Android safety paths are recorded. Remaining work is hosted moderation or
  shared-owner schema/FK integration and any iOS physical/provider boundary; no independent local
  source repair is indicated. Existing UserBlock, UserProfileBlock, PersonaBlock and Relationship
  scopes remain distinct.
- **N05 — reminders/calendar:** Natural reminder worker, pause/resume, retry/failure and
  authorized destination evidence are retained, and the daily-agenda web preference has a real
  UI/API/SQL persistence proof. Source reconciliation found no daily-agenda producer/consumer or
  settled schedule/recipient/channel/retry contract. Delivery cannot be verified locally until an
  owner defines that policy and assigns a scheduler/provider; a saved preference alone is not
  delivery evidence.
- **A01 — signup, verification and recovery:** Real web signup/email verification/reset and the
  accepted native account journeys are recorded, including actionable unverified-login feedback.
  External Google/Apple consent/callback/provider failures and physical-provider boundaries remain
  unavailable locally; no additional local auth screen repair is indicated.
- **A02 — sessions and account lifetime:** Natural refresh, transient retry, logout failure/retry,
  remote sign-out, lock-down, account switching and protected local-data retirement use accepted
  evidence. Remaining physical provider revocation, cold-process/device and external OAuth return
  boundaries require provider/device capability; no shared auth edit is proposed.
- **A03 — shared storage:** Existing profile/document picker UI, local profile/portfolio/home reads,
  quota route and exact cleanup are recorded. A real native chooser-to-byte upload and hosted
  S3/CloudFront permissions/lifecycle/quota/provider failure remain unverified and require shared
  storage ownership or provider credentials; no local replacement is justified.
- **A04 — provider dependencies/OAuth:** Current local Google/Apple capability reads and invalid
  provider handling are recorded, with no activation or external callback followed. Real provider
  consent/callback/failure, hosted address/storage dependencies and production activation remain
  external/shared-owner boundaries; no local provider configuration change is authorized.
- **A05 — remaining reachable actions:** Web profile report/search/edit and audience/mailbox
  boundaries plus installed Android profile save are recorded; the mailbox route-order repair is
  integrated as PR178 `715ccd8c0`. Remaining Marketplace/subscription/booking/wallet/mail/search
  actions and Home/payment findings belong to their owners; they require source ownership or an
  explicitly assigned route fixture rather than another Stream 3 duplicate audit.

This is the final client-specific accounting for this pass. It separates implementation and local
UI/API/SQL evidence from CI/merge state and provider, device, policy and ownership boundaries. No
unit-test coverage is claimed or required, and no new tracker or raw log was added.


## N02 installed Android HTTP 5xx delete rollback and retry (2026-09-22 addendum)

This closes the previously listed Android HTTP-5xx injection gap for the locally retained
implementation. I reused the existing Notifications screen, confirmation, DELETE handler and
owned PostgREST/SQL fixture; no application, schema, design, or migration change was made. The
retained installed APK was SHA-256
`83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`, running against the owned
API on port 18130 and PostgREST/SQL on 64531/64532. Auth Bob
`c021d181-d7df-4ba9-9e49-fd1cdd6d5548` received disposable Notification
`8559382b-224b-42cb-8b40-505316df9e9b` with type `stream3_notification_http500_check` and marker
`n02-http500-r1`.

Baseline fault: after confirming the existing long-press **Delete notification?** action, I
revoked only `DELETE` on the existing `public."Notification"` table from `service_role`. The
installed Android log recorded `HTTP DELETE -> 500 (145ms)`; the API recorded the real DELETE
path and PostgreSQL `permission denied for table Notification`. SQL stayed at 12 Bob rows / 8
unread / fixture 1 / target 1, so the row was not silently lost. After restoring the grant, the
same installed row and confirmation path recorded HTTP 200 (123ms); SQL became 11 / 7 / 0 / 0
and the existing screen no longer showed the fixture. The API was stopped cleanly, the grant was
checked true, the disposable row was absent, and the installed account was logged out through
Settings → Log out. The failure-state XML/screenshot was not retained before compaction; the
sanitized Android HTTP receipt, backend 500 receipt, unchanged SQL counts and retained post-retry
XML substantiate the result. No provider, physical-device, iOS, CI, hosted-migration or unit-test
claim is made.

Evidence: `n02-android-http500-delete-retry-20260922.json`,
`n02-android-http500-delete-retry-http-receipt-20260922.json`, and `retry-after.xml` in the
private durable bundle. This is an induced local database-permission fault and is separate from
provider delivery. It complements, rather than duplicates, the accepted web PR86 failure/retry
journey.

## N03 installed Android local-neighbor block-state repair (2026-09-22 addendum)

The accepted PR168 Android implementation had a concrete reopened-profile defect: its existing
relationship endpoint reports `Relationship` only, while personal blocks are stored in
`UserBlock`. After a real profile **More → Block this user**, the same screen hid Follow/Connect,
but a fresh deep-link reopen fetched profile/posts/relationship and restored Follow/Connect even
though the Bob → Evan `UserBlock` row still existed. The canonical local-neighbor source was
checked before editing: `GET /api/users/id/:id` derives verified residency from existing
`HomeOccupancy`, and the existing `ProfileFollowRow` renders from `canFollow`; no new table or
scope was needed.

Focused repair on branch `local/stream3-android-integration` extends the existing
`PublicProfileViewModel.loadRelationship` path. It reads the existing `/api/users/blocked` list
before calling the existing relationship endpoint; a matching personal `UserBlock` sets
`canFollow=false`, `isFollowing=false`, and `connection=Blocked`. A blocked-list read failure
fails closed with non-actionable actions and the existing truthful toast rather than restoring
Follow/Connect. Relationship, PersonaBlock and other scopes remain distinct. The existing visual
layout/navigation was preserved and no unit tests, schema/model files or migrations were added.

The focused Android build passed (`./gradlew :app:assembleDebug`, 43 tasks, `BUILD SUCCESSFUL in
1m 24s`); installed APK SHA-256 is
`2728688a30a78449c990c302ebc72053802322772a990e7a3a6030e2265d504a`. With an owned canonical
fixture (existing Home `2ca4bc33-a285-4faa-9420-48edb97eb603`, Bob owner and Evan member both
active/verified, existing Evan LocalProfile temporarily exposing the local badge), the installed
UI showed Verified neighbor + Follow/Connect before blocking. Real profile block POST 200 hid the
actions. A fresh deep-link reopen on the repaired APK kept Message + Verified neighbor and showed
zero Follow/Connect. Settings → Blocked users listed Evan; existing Unblock removed the row, and
a fresh reopen restored Follow/Connect. With `SELECT` on `public."UserBlock"` revoked, the real
`GET /api/users/blocked` returned 500; the repaired profile stayed non-actionable with no
Follow/Connect and the UserBlock row remained. The SELECT grant was restored before cleanup.
Exact cleanup removed the UserBlock, restored the LocalProfile overlay, deleted the two
HomeOccupancy rows and Home; final counts were block=0/home=0/occupancy=0/overlay=0. The
installed account was logged out through Settings and the API was stopped cleanly.

Evidence: `n03-android-local-follow-block-repair-20260922.json`, its sanitized HTTP receipt,
`n03-local-before.xml/png`, `n03-local-after-block.xml/png`,
`n03-local-blocked-refresh.xml/png` (pre-repair reproduction), `n03-repair-blocked.xml/png`,
`n03-repair-unblocked.xml`, and `n03-repair-readfault.xml/png`. iOS installed behavior, physical
provider/device behavior, CI/integration merge state and hosted moderation remain separate
boundaries; this addendum claims only the verified Android local-profile path.

## Stream 3 handoff reconciliation after the 2026-09-22 native passes

The durable private evidence bundle now contains 181 files; refreshed MANIFEST SHA-256 is
`637c0364dd9c2e700270ef1dc9e328d66b0a2005601dca503cc9be5a5f572e92`. Raw logs and credentials
remain outside the bundle. Implementation completion, local UI/API/SQL success, CI/merge state,
and external provider/device limits are intentionally reported separately:

- **N01:** local saved-record/list/preferences and installed Android controls are evidenced; APNs/FCM provider delivery, token rotation, physical devices, and true foreground/background/cold-start delivery remain unavailable.
- **N02:** web PR86 and installed Android list/filter/read/delete/cancel/offline rollback/retry/new-follower destination plus the induced Android HTTP-5xx rollback/retry are evidenced; iOS installed destination and provider delivery remain unavailable.
- **N03:** web/API/SQL and Android discovery/follow/unfollow/post/reply/mute/identity/block paths are evidenced, including the repaired reopened local-neighbor block state; fresh iOS cohort/provider freshness and any policy change across Persona/UserBlock/local-neighbor scopes remain unverified.
- **N04:** local block/unblock, DM refusal, reporting/idempotence/failure/retry and access/cache/error paths are evidenced; hosted moderation/shared-owner schema, iOS installed and provider boundaries remain outside this worktree.
- **N05:** reminder worker and daily-agenda preference persistence are evidenced; no source producer/consumer or settled delivery policy exists for daily-agenda delivery, so delivery is not claimed.
- **A01:** signup, verification, recovery and native account flows are evidenced; external Google/Apple consent/callback and provider failures remain unavailable.
- **A02:** refresh, retry, logout, remote sign-out, lock-down, account switching and local-data retirement are evidenced; physical provider revocation/cold-process boundaries remain unavailable.
- **A03:** existing profile/document-picker contracts, reads and quota are evidenced; native chooser-to-byte upload and hosted storage permissions/lifecycle remain shared-provider boundaries.
- **A04:** local provider capability and invalid-provider handling are evidenced; real consent/callback/production activation remains unavailable and was not changed.
- **A05:** reachable web/native report, search, edit, audience, mailbox and profile actions are evidenced; booking/payment/Home findings remain with their owners. The `/signup` booking misroute is already owned by Stream 1 and was not duplicated here.

No new unit tests were added per user direction. The workstream is ready for coordinator review of the
Android source commit and status/evidence commit; no merge, hosted migration, provider activation,
or independent CI claim is made here.


## A03 Android local chooser-to-byte upload boundary (2026-09-22 addendum)

To close one independently local A03 acceptance gap without holding a heavy build slot, I reused
the installed Android APK (SHA-256
`2728688a30a78449c990c302ebc72053802322772a990e7a3a6030e2265d504a`) and the existing profile
Portfolio screen. After real local Bob authentication, **Profile → Portfolio → Add portfolio
item** opened the existing `ActivityResultContracts.GetContent("*/*")` flow. Android DocumentsUI
showed the owned Downloads file `stream3-portfolio-r1.png`; selecting it returned the real
content URI, display name, MIME type and 68 bytes to the existing sheet, which populated the
filename and title. Tapping the existing Add control issued the real multipart
`POST /api/files/portfolio` through API 18130.

The request returned HTTP 500. The backend receipt is the existing route's S3 thumbnail/original
upload path failing with `Resolved credential object is not valid`; the local runtime has no valid
AWS bucket/credential configuration. SQL showed zero Bob `File` rows for the marker and zero Bob
File rows overall, so no partial record was left. The emulator file was deleted, Bob logged out
through Settings, and the API stopped cleanly. This proves the chooser and byte-read path through
the app's existing caller and API boundary, while the final hosted object/persistence step is
blocked by the shared-storage provider configuration. No local replacement, schema change, UI
redesign, provider activation or unit test was added; an owner with approved isolated S3-compatible
credentials must rerun the same existing journey for successful hosted persistence evidence.
Evidence: `n03-android-portfolio-chooser-failure-20260922.json`.

## PR195 CI repair and current head (2026-09-22 addendum)

Fresh current-master CI run `35763514679` exposed 21 existing
`PublicProfileViewModelTest` failures caused by the new block-list call being evaluated for
established Persona test profiles whose mocks intentionally do not provide a blocked-list result.
The focused source repair scopes the already verified personal UserBlock visibility check to the
Local profile kind—the concrete reopened local-neighbor gap—while leaving Persona, Relationship and
other block scopes unchanged. Existing class verification then passed with
`./gradlew :app:testDebugUnitTest --tests app.pantopus.android.ui.screens.profile.PublicProfileViewModelTest`
(`BUILD SUCCESSFUL`, 37 tasks, 2m43s). The repair is commit `3b374454a` on PR [#195](https://github.com/WangPantopus/skinny-pantopus/pull/195), still one changed production file relative to current master; fresh exact-head CI is running. No new tests were written or modified.

The private durable bundle now contains 182 files; refreshed MANIFEST SHA-256 is
`0c14162f655e7b7ec546201eac52a4206032df56f9e3f990073f75c0a9c027ea`.


## N02 retained iOS saved-notification destination capability check (2026-09-22 addendum)

A bounded read-only check used the owned booted **Pantopus Stream3 Social R2** simulator
`0AE16FA0-E244-414F-86C8-24893BDFD979` (iOS 26.5). `xcrun simctl listapps` confirmed the
installed `app.pantopus.ios` build 1.0.0 (1); `xcrun simctl launch` returned process 58323 and a
screenshot captured the actual Pantopus sign-in screen. It showed the existing security message
**You were signed out for security. Sign in again.** and a masked remembered Auth Evan account.

This check did not mutate simulator state, restart the device, build/install, inject a notification,
or enter credentials. The current session exposes no CUA native app/accessibility surface
(`getApp("Simulator")` is invalid), so I could enumerate/launch/capture but could not navigate the
installed UI to a saved notification row or destination. The iOS saved-notification destination
therefore remains explicitly unverified; this is a precise simulator-control/session boundary,
separate from APNs delivery and separate from Android/web evidence. Evidence:
`n02-ios-saved-notification-capability-20260922.json` and `ios-capability-20260922.png`.

The private durable bundle now contains 184 files; refreshed MANIFEST SHA-256 is
`30fd45250bd87efe01dfb803d3c8635f771f75e1df04faf0e6107bd7b9ef99ed`.


## A02 installed Android cold-process/session recovery (2026-09-22 addendum)

I reused the installed Android build and the existing Bob fixture for the one locally actionable
A02 boundary that remained distinct from the accepted web natural-expiry, synthetic retry and
two-context remote sign-out evidence. A real Android login (`POST /api/users/login` 200) opened the
existing hub with Auth, Notifications, Menu and setup cards. I then force-stopped the app process
and relaunched the existing `MainActivity` without clearing app data or touching the database.

The socket disconnected at 18:50:36.850Z. On cold relaunch the API received no second login; instead
`GET /api/users/profile` 200 at 18:50:40.344Z was followed by a new socket session and the normal
hub/chat/discovery/notification reads. The installed app first showed its existing notification
permission prompt; tapping the existing **Don’t allow** control returned to the authenticated hub
showing Auth, Notifications, Menu and the existing setup cards. This binds local process retirement
→ protected session restoration → real UI/API continuity. Settings → Log out then returned Sign in,
`POST /api/users/logout` 200, the follow-up hub request was no-token/401, and the API stopped
cleanly. No source, schema, provider, design or unit-test change was made.

Evidence: `a02-android-cold-process-recovery-20260922.json`, `a02-cold-before.xml`, and
`a02-cold-after.xml`. The post-permission hub XML was not retained separately; the visible state
and API receipts are recorded honestly. This does not claim physical keychain failure, provider
revocation, APNs/FCM delivery or hosted OAuth behavior. The durable private bundle now contains
187 files; refreshed MANIFEST SHA-256 is
`3f0a7bac2613d80a2a6d314e1b8eaa51c5671b4a412fc071aec989fc3a3edb47`.

## A05 installed Android profile readback fault and retry (2026-09-22 addendum)

The existing backend repair for the profile PATCH readback contract had already been verified at
HTTP/API level, but its user-facing Android fault/retry state had not been exercised. I reused the
existing installed APK (`2728688a30a78449c990c302ebc72053802322772a990e7a3a6030e2265d504a`) on
`emulator-5554`, the existing **Settings → Edit profile** screen, and the existing
`PATCH /api/users/profile` caller. With the disposable Auth Bob fixture, I entered temporary
`Fault` / `Probem` values and tapped the existing Save control after revoking only
`SELECT` on `public."UserSkill"` from `service_role`. The real request returned HTTP 503 with
`PROFILE_READBACK_UNAVAILABLE`; the server logged that the profile write completed but skills
readback was unavailable. The installed screen retained **2 unsaved changes** and did not show a
false saved state. This is the real UI/API boundary for the repaired readback error path, not a
mocked response.

After restoring the existing `UserSkill` SELECT grant, the same pending form was retried through
the same Save control. The real request returned HTTP 200; the screen showed **All changes saved ·
just now**, and the server logged `Profile updated`. The temporary first/last name write was then
removed by an exact SQL fixture cleanup because the public PATCH validation requires string name
parts; the User row ended with `first_name=NULL`, `last_name=NULL`, `middle_name=NULL`, `name='Auth Bob'`,
`bio=NULL`, zero Bob `UserSkill` rows, and the SELECT grant restored. Settings logout returned
HTTP 200 and the local API process was stopped. No application, schema, design, provider or unit
-test change was made.

Evidence: `a05-android-profile-readback-fault-retry-20260922.json` and
`a05-android-fault-evidence-20260922/{fault-before.xml,fault-after-503.xml,retry-200.xml}`.
The two fault-state XML captures intentionally have the same visible state because the repaired
failure preserves the pending form; the distinct retry XML records the transition to saved. This
proves local installed UI/API/SQL error and retry handling. It does not claim hosted provider,
iOS or physical-device behavior.

## Current row-accounting correction after the native addenda (2026-09-22)

The older generic row table above predates the latest native evidence. The current accounting is:

- **N01:** local saved-record/list/preferences and installed controls are evidenced; APNs/FCM
  delivery, token rotation, physical-device delivery, and true provider foreground/background/
  cold-start behavior remain unverified.
- **N02:** the authoritative remaining criterion is physical Android notification/device acceptance.
  Installed Android emulator list/filter/read/delete/Cancel/offline rollback/reconnect retry,
  `new_follower` destination, and induced Android HTTP-5xx rollback/retry are supporting emulator
  evidence only; physical Android acceptance remains open because no physical Android is available.
- **N03:** web/API/SQL and Android discovery/follow/unfollow/post/reply/mute/identity/block paths,
  including reopened local-neighbor block visibility and fail-closed blocked-list read fault, are
  evidenced. Fresh iOS/provider freshness and policy changes across Persona/UserBlock/local-home
  scopes remain outside this local runtime.
- **N04:** local block/unblock, blocked DM refusal, report idempotence/failure/retry, access/cache/
  error paths and installed Android safety are evidenced. Hosted moderation/shared-owner schema and
  iOS/provider boundaries remain owner work.
- **N05:** reminder worker/pause/retry and daily-agenda preference persistence are evidenced; no
  daily-agenda producer/consumer or settled delivery policy exists, so delivery is not claimed.
- **A01:** web/native signup, verification, recovery and unverified-login feedback are evidenced;
  external Google/Apple consent/callback/provider boundaries remain unavailable.
- **A02:** refresh/retry/logout/remote sign-out/lock-down/account switching/local-data retirement
  and installed Android cold-process session restoration are evidenced; physical provider
  revocation and external OAuth return remain unavailable.
- **A03:** existing document-picker/chooser-to-byte path and local reads/quota are evidenced; the
  real hosted portfolio upload returned the provider's existing credential 500 with no partial row,
  so hosted S3/CloudFront success and lifecycle remain shared-provider boundaries.
- **A04:** the authoritative row is address/provider coverage: activated Smarty, geography/unit
  disambiguation and legitimate unavailable responses. Real local full-address and unit routes now
  return explicit unavailable/manual-review envelopes and the installed Add Home form preserves its
  draft with retry/edit and a disabled continuation; activated external provider success remains
  unavailable without provider ownership.
- **A05:** web report/search/edit/audience/mailbox and installed profile save are evidenced; this
  addendum now also covers installed profile readback HTTP-503 preservation and same-form HTTP-200
  retry. Marketplace/subscription/booking/wallet/mail/search and Home/payment findings remain with
  their owners.

The durable private bundle now contains 191 files with MANIFEST SHA-256
`f72d89f805e0592d0a7d967e2ed1afb121dfe10ad81212543b2c2efc4f892107`. No unit-test coverage is
claimed or required; implementation, local UI/API/SQL behavior, CI, merge, and external provider
boundaries remain separately reported.

## PR195 exact-head CI completion (2026-09-22 addendum)

The fresh current-master CI run `35768401037` for PR [#195](https://github.com/WangPantopus/skinny-pantopus/pull/195)
completed successfully at head `3b374454ad07060cf5dcaa1ce02fc48b3be4c88e`. Android **Lint, test,
assemble** and **Instrumented tests (emulator)** are SUCCESS, as are deployment/migration safeguards,
complete schema replay/lint, change detection and the aggregate **CI OK** job. Backend, web, iOS and
seeder jobs were correctly skipped by change detection because this PR contains the focused Android
production repair only. The earlier exact-head failure was superseded by this scoped Local-profile
guard repair; no merge was performed here. Coordinator review/merge remains the integration boundary.

## Authoritative N02/A04 row mapping correction (2026-09-22)

The authoritative backlog in `docs/REMAINING_WORK_2026-09-11.md` defines **N02** as:
“Physical Android notification/device acceptance remains unverified; emulator delivery is not
hardware acceptance. No physical Android is currently available in the recorded setup.” The
installed Android/emulator notification journeys and the induced HTTP-5xx rollback/retry remain
valid emulator/local evidence, but they do not close that physical-device criterion. This row has
no additional iOS or provider requirement in the authoritative wording, so those are not counted
as N02 gaps here.

The same backlog defines **A04** as: “Remaining address/provider coverage, including activated
Smarty scenarios, geography/unit disambiguation and legitimate unavailable responses. Prepare
what is possible on existing/free capacity first.” OAuth consent/callback belongs to **A01** and
is removed from the A04 accounting. A bounded real local A04 route pass used the existing
`POST /api/v1/address/validate` and `POST /api/v1/address/validate/unit` handlers with real Auth
Bob bearer sessions and providers intentionally absent/disabled in the retained local
configuration. Full validation returned HTTP 200 with `ADDRESS_VALIDATION_UNAVAILABLE`,
`SERVICE_ERROR`, confidence 0 and `manual_review`; a temporary isolated multi-unit
`HomeAddress` fixture (`missing_secondary_flag=true`) plus unit `2B` returned HTTP 200 with
`ADDRESS_REVALIDATION_UNAVAILABLE` and the same explicit unavailable/manual-review verdict. Both
sessions logged out HTTP 200; the temporary address was deleted (zero rows, no Home or
AddressClaim), and the API stopped. No provider activation, purchase, successful external
Smarty/geography result or schema/application change was made.

Evidence: `a04-address-unavailable-20260922.json`; the raw local API log remains operational only.
The durable private bundle now contains 192 files with MANIFEST SHA-256
`758a5f48e9757539b69863d1bf043724573c3724acc0ccf1f62094c51a814b1a`.

## Exact ten-row acceptance mapping for next handoff (2026-09-22)

This block quotes the current authoritative criterion and binds it to the evidence above. It
supersedes earlier shorthand rows while preserving their reports.

- **N01 criterion:** “Close remaining release-build notification states across platforms: exact
  post/chat/task destinations, foreground/background/cold start, permission denial, login
  continuation, token changes, account switching and unread state. Preserve completed evidence
  rather than rerunning it blindly.” Existing web/native notification routes, saved-record reads,
  unread/preferences, Android emulator actions and installed cold-process/session continuity are
  retained. Release-build cross-platform foreground/background/cold-start delivery, token-change
  behavior and physical-device delivery remain unverified.
- **N02 criterion:** “Physical Android notification/device acceptance remains unverified; emulator
  delivery is not hardware acceptance. No physical Android is currently available in the recorded
  setup.” Installed Android emulator list/filter/read/delete/Cancel/offline rollback/reconnect
  retry, destination and induced HTTP-5xx rollback/retry are recorded as emulator evidence only.
  The physical Android acceptance row remains open solely because the required device is unavailable.
- **N03 criterion:** “Release-candidate Pulse and Beacon journeys must preserve address-free
  discovery, explicit following, eligible posting, conversation/reply return, mute/unfollow and
  private/public identity boundaries.” Web/API/SQL and retained Android discovery, follow/unfollow,
  Beacon fallback, posting/reply, mute and identity separation are recorded. A fresh release-
  candidate native cohort for the complete Pulse/Beacon sequence remains unverified; no policy or
  provider claim is inferred from the debug APK evidence.
- **N04 criterion:** “Reporting, blocking, moderation and old/shared/deep-link access need a
  usable end-to-end safety workflow under the final release flags. Draft PR51 at `dfc860bfe` has
  bounded browser/HTTP/PostgreSQL and regression evidence; native lifetime, real socket/provider
  delivery and wider entry-point acceptance remain open.” Web/API/SQL report persistence,
  idempotence/failure/retry, block/unblock, DM denial, cache/access/deep-link checks and installed
  Android safety are recorded, including PR195’s fail-closed local-neighbor visibility repair.
  Moderation processing, full native lifetime/socket/provider delivery and any wider entry point
  outside the exercised inventory remain open.
- **N05 criterion:** “Any promised calendar/reminder delivery must arrive once, open the correct
  authorized destination and honor preferences; saved schedule data is separate evidence.” Existing
  reminder worker/pause/retry/destination evidence and real preference persistence are recorded.
  No daily-agenda producer/consumer or settled delivery policy exists in this scope, so a saved
  preference is not counted as delivery.
- **A01 criterion:** “Remaining real signup, verification/recovery email and OAuth callbacks,
  including Apple/Google, cancellation, provider failure and return to the original authorized
  destination.” Web signup/email verification/recovery and accepted native account flows are
  recorded, including actionable unverified-login feedback. External Apple/Google consent,
  cancellation/failure callbacks and authorized return remain unverified.
- **A02 criterion:** “Real onboarding/account session expiry, revocation, logout/account switching
  and local protected-data retirement across provider and client combinations not covered by
  controlled local login.” Natural refresh/retry, logout failure/retry, remote sign-out, lock-down,
  account switching, local-data retirement and installed Android cold-process restoration are
  recorded. Provider-combination revocation and other client/provider combinations outside the
  controlled local runtime remain unverified.
- **A03 criterion:** “Hosted media/document upload, preview, replacement, deletion, permissions,
  quotas and file cleanup under actual Auth/Storage configuration.” Existing profile/document
  screens, reads/quota and Android chooser-to-byte request are recorded. The real hosted portfolio
  request reached the existing S3 path and returned its credential 500 with no partial row; hosted
  success and complete preview/replacement/deletion/permission/lifecycle evidence require shared
  storage credentials/ownership.
- **A04 criterion:** “Remaining address/provider coverage, including activated Smarty scenarios,
  geography/unit disambiguation and legitimate unavailable responses. Prepare what is possible on
  existing/free capacity first.” The real local full-address and unit-revalidation routes now
  return explicit `ADDRESS_VALIDATION_UNAVAILABLE` and `ADDRESS_REVALIDATION_UNAVAILABLE` verdicts
  under the existing disabled-provider configuration, with an isolated multi-unit fixture and
  exact cleanup. Activated Smarty/geography success and external provider scenarios remain
  unavailable without provider ownership/credentials; no activation or purchase was made.
- **A05 criterion:** “Reconcile all reachable marketplace, subscription, booking, wallet, mail,
  profile, search and adjacent actions against the current release inventory. Old static audits
  are discovery inputs, not proof that each item is still broken.” Web report/search/audience/
  mailbox/profile edit and installed profile save plus the installed profile readback fault/retry
  are recorded. Marketplace/subscription/booking/wallet/search-adjacent and Home/payment findings
  remain with their owners; the `/signup` booking misroute was not duplicated.

No unit-test coverage is claimed or required by the user direction. The remaining items above are
explicit device, release-candidate, provider, policy or owner boundaries rather than silently
converted implementation claims.

## A04 installed Add Home unavailable response and retry (2026-09-22 addendum)

The route-only A04 unavailable result was followed through the existing installed Android caller to
check that a successful HTTP 200 envelope cannot look like verified success or discard the address
form. On `emulator-5554` with real Auth Bob login, **Hub → Start verification → Add address
manually** accepted the existing street/unit/city/state/ZIP fields and issued the real
`POST /api/v1/address/validate` against the same local runtime with Google/Smarty unavailable.
The response was HTTP 200 with `error_code=ADDRESS_VALIDATION_UNAVAILABLE`,
`verdict.status=SERVICE_ERROR`, `address_id=null`, confidence 0 and `next_actions=[manual_review]`.

The existing Android screen rendered **Address verification is unavailable. Try again.** with
**Try again** and **Edit address** actions. It retained all entered fields, showed the existing
step-2 property-review surface, and kept **Continue** disabled; it did not create a Home or claim
or present a verified result. Tapping **Try again** repeated the same real HTTP request and left the
same banner, fields and disabled continuation. Going back opened the existing **Discard your
progress?** dialog; choosing **Discard** removed the draft, and Settings → Log out returned HTTP
200. The API process then stopped cleanly.

This is installed UI/API behavior on the existing caller, not a mocked response. The server's
`manual_review` next action is recorded as an explicit provider/policy boundary; the current client
offers retry/edit and does not submit a manual review case. No application repair was justified
because the draft is preserved, the failure is visible and continuation is blocked. Evidence:
`a04-address-ui-unavailable-20260922.json` and
`a04-address-ui-evidence-20260922/{form-before.xml,after-unavailable.xml,after-retry.xml,after-unavailable.png,after-retry.png}`.
The durable private bundle now contains 198 files with MANIFEST SHA-256
`1fa796d1b6f08e89b549f0aadf0f6986241fbd511184ff2825dc889071957f26`.

## Minimal prerequisites for the remaining open criteria (2026-09-22)

No further local variant is justified after the accepted A04 unavailable UI/retry pass. The next
agent should start only when the corresponding capability is present:

- **N01:** a release-candidate build on the target platforms, an authorized notification provider
  fixture with token rotation, and physical-device access for foreground/background/cold-start and
  permission-continuation evidence.
- **N02:** a physical Android device and release build capable of receiving the authorized
  notification fixture; emulator evidence cannot substitute for this row.
- **N03:** an assigned release-candidate native build slot with final Pulse/Beacon flags and
  disposable address-free identities/posts/replies so the complete discovery → follow → eligible
  post → reply return → mute/unfollow → private/public identity sequence can be exercised.
- **N04:** a moderation owner who can provide the final release flags, moderation processing
  disposition and any approved socket/provider fixture needed beyond the recorded local HTTP/SQL
  and installed Android safety paths.
- **N05:** a product owner must define the daily-agenda producer, recipient/channel, exact-once
  timing, authorized destination and retry policy; then an assigned scheduler/provider runtime is
  required. A saved preference cannot supply those missing semantics.
- **A01:** authorized Apple/Google OAuth client credentials, redirect origins and consent/callback
  environments, plus provider failure/cancellation controls for returning to a protected original
  destination.
- **A02:** approved provider revocation/expiry controls and at least the required client/device
  combinations for keychain/session retirement; controlled local login cannot prove them.
- **A03:** shared storage owner approval plus valid isolated S3/CloudFront credentials, bucket,
  quota/lifecycle and cleanup fixture for hosted byte upload/preview/replacement/deletion.
- **A04:** activated Smarty/geography/unit provider credentials or a free approved provider fixture
  that yields real candidate/disambiguation outcomes. The legitimate-unavailable response and
  installed retry/draft behavior are already accepted locally.
- **A05:** route ownership and authorized fixtures for Marketplace, subscription, booking, wallet,
  mail/search-adjacent and Home/payment actions; Stream 3 should not duplicate those owners' audits.

These are capability prerequisites, not new backlog rows. No provider activation, purchase, schema
change, design change or unit-test file was added.

## N03/N04/N01 native-social-r1 — installed iOS+Android journeys verified; 8 defects reproduced, 6 PRs (September 22)

Branches (each from master c1280e078, none merged): backend `codex/stream3-userblock-content-gate`
29951b76a → PR163; iOS `codex/stream3-ios-push-tap-main-thread` 579a57fe7 → PR164,
`codex/stream3-ios-deeplink-surface` 8890d1a58 → PR165, `codex/stream3-ios-social-follow-block-chat`
8b4d47c0a → PR166; Android `codex/stream3-android-deeplink-location` 32a216f9a → PR167,
`codex/stream3-android-social-follow-block-chat` f248ce8e9 → PR168. Verification builds came from
local integration branches (iOS 4adcc12c8 = 164+165+166, Android 827f28a08 = 167+168), one native
build at a time. Retained API restarted once from the exact captured recipe (80982 → 49623) to load
PR163; Next 36139, DB, Mailpit and both devices retained.

Runtime/actors: iOS 0AE16FA0 as Evan, Android emulator-5554 as Bob (later Evan for the account
switch). Evan's fixture password was rotated to a throwaway through the REAL forgot/reset flow
(pantopus://auth/reset-password deep link) because the headless simulator offers no scriptable or
pasteboard text path and the fixture value must never be printed; restored at cleanup by the same
real flow from a script. Simulated GPS on both devices; the emulator's fused location never returned
a fix (geo fix + test provider both failed) so Android posted to Connections.

Verified natively (real API/SQL receipts per journey): Pulse Nearby/Connections feed load, empty
state, injected 503 error frame + Try again recovery (both); address-free rendering (city/coords
label only, no street); iOS Nearby Ask post via fresh GPS (POST /api/posts 201, ask_local/nearby),
Android Connections post (201); shared post link to another user's Nearby post (Android 200);
comment + threaded reply with post_commented / comment_replied notifications and exact foreground
tap destinations on both platforms; Beacon profile, follow/unfollow of a user and (after the fix) of
a Beacon; report post (PostReport pending), report user (UserReport pending) on both; block from the
profile on both, Settings → Blocked users list/unblock/re-block with one DELETE for a double tap
(Android), block while a DM is open (Android details sheet, thread closes); DM after block refused
403 in both directions (no ChatMessage written); held block reply (private hook, 25 s auto-release);
simctl push foreground banner + tap destination; Android background (HOME→link) and cold start
(force-stop→link) destinations; POST_NOTIFICATIONS denial (system prompt → logcat only, no in-app
state); Android sign-out → deferred post link → login form → sign in as Evan → continuation to the
post and Evan-only unread count.

Reproduced defects → repairs: (1) iOS background push banner tap crashed (SIGABRT, UIKit
state-restoration assert in the async didReceive completion) → PR164; (2) iOS Place/Mail-tab deep
links rendered under the Nearby→Pulse sheet (profile, Beacon, notifications; 3 occurrences) → PR165;
(3) new_follower link `/<username>` unroutable natively (tap marked read, no navigation) → PR165 +
PR167; (4) Beacon Follow dead-ended on the flag-gated fan-handle-suggestion 404 under the release
default → plain-follow fallback PR166 + PR168; (5) UserBlock did not gate follow/feed/post
reads/comments — blocker followed the blocked user (notification delivered), blocked author's post
readable via shared link → PR163 (backend) + Follow row hidden after block PR166/PR168; (6) chat 403
rendered as bare "Failed to send · Retry" → banner copy PR166/PR168; (7) Android composer "Current
Location" never requested the runtime permission → PR167; (8) Android `pantopus://feed` from a
child screen left the child on top (recorded, not fixed — navigateToRootTab restoreState).

Re-verified on the rebuilt iOS app: sheet dismissed and Notifications visible on the link;
new_follower tap opens the profile; Beacon follow → suggestion 404 → POST /api/personas/:id/follow
201 → "You're following" step (Dana got persona_follow); refused send shows "You can't send messages
in this conversation."; background banner tap keeps pid 52093 (0 crash reports) and opens the room.
Backend gate on the restarted API: Bob's post → 403 for Evan, blocked comments dropped, follow → 403.
Backend Jest 10 suites/153 pass. Android: bare-username link opens the profile on the rebuilt app; the remaining Android re-verification (composer permission prompt, Beacon fallback, blocked Follow, refused-send copy) runs after the next Android rebuild carrying 87460475e (two emulator ANRs under xcodebuild host load ≈21 were starvation, not app defects).

Limits: simctl push and adb `am start` stand in for APNs/FCM (no provider delivery); emulator, not
hardware (N02 boundary unchanged); throwaway password rotation labelled; no report-outcome
notification exists (no PostReport/UserReport reader) — moderation outcome is a product boundary;
persona broadcasts remain readable/followable across a personal UserBlock (persona surfaces gated by
PersonaBlock/tier only) — founder call; retained DB lacks find_businesses_nearby (matched-businesses
404) and LocalProfile.verified_resident; Mapbox key absent so location_name is a coordinate string;
iOS Ask title not rendered on native cards/detail (design question, web to compare); `PERSONA ·
VERIFIED` chip shown for any user without home residency (derivedKind) — product call; iOS pushed
Place-stack screens show duplicated back/title chrome (presentation, untouched).

Cleanup: partial — pre-existing Notification read flags restored from preflight after an accidental "Mark all read" (Bob), POST_NOTIFICATIONS re-granted, iOS Beacon membership removed by unfollow; batch-1 rows (2 Posts, 2 PostComments, 1 PostReport, 2 UserReports, 2 UserBlocks, 1 UserFollow, 5 Notifications) still present for the remaining re-verification and are deleted child-first by `cleanup-social-r4-rows.py` (dry run recorded); Evan stays signed in on both devices for batch 2 and his fixture password is restored at the final cleanup by `restore-evan-password.py` (real reset flow).

Evidence: `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream3-native-social-r1/`
(preflight.json, n03/n04/n01-native-result.json, push payload, crash .ips, screenshots), 95
files, MANIFEST **392f263c7ff73f9500a2c43cf05d1cb90c1ef3efea74fcb6e5f5bbb1ab1c3b14**. CI at publication: PR163 29951b76a FAILURE/SKIPPED/SUCCESS;PR164 579a57fe7 /SKIPPED/SUCCESS;PR165 ba8f7374e /SKIPPED/SUCCESS;PR166 8b4d47c0a /SKIPPED/SUCCESS;PR167 87460475e /SKIPPED/SUCCESS;PR168 f248ce8e9 /FAILURE/SKIPPED/SUCCESS; Runtime: API pid 49623:18130 (codex/stream3-userblock-content-gate 29951b76a), Next 36139:18131, containers *pantopus-stream3-block-r1 + pantopus-stream3-mail-r3, simulator 0AE16FA0 (installed local/stream3-ios-integration e86b9fe5b = PR164+165+166), emulator-5554 (installed 827f28a08 = PR167 first commit + PR168; rebuild with 87460475e pending). Next: finish the Android re-verification, run touched unit suites, batch-1 row cleanup, then batch 2 rows (A05 native sweep → A03 → N05 → A02 → A01 → A04/N02 notes).
Open founder questions: personal block vs persona surfaces; Ask title rendering; PERSONA·VERIFIED chip semantics; report-outcome notifications.


## Founder stop — native-social-r1 state at 09:25UTC (September 22)

Stopped on instruction before the Android on-device re-verification finished. Everything is
committed and pushed; no build is running. Branches/heads/PRs: backend
`codex/stream3-userblock-content-gate` 29951b76a → PR163 (CI: privacy Gate 3a fails because the
new top-level require shifted the allowlisted `routes/users.js:306` compat line to :307 — remedy:
inline the require at the follow-route use site or move the allowlist key; Jest passed); iOS
`codex/stream3-ios-push-tap-main-thread` 579a57fe7 → PR164 (CI green), `codex/stream3-ios-deeplink-surface`
ba8f7374e → PR165 (CI green; router widening withdrawn for the accepted unknown-path contract,
replaced by a type-scoped `new_follower` link rewrite), `codex/stream3-ios-social-follow-block-chat`
8b4d47c0a → PR166 (CI green); Android `codex/stream3-android-deeplink-location` 87460475e → PR167
(CI green), `codex/stream3-android-social-follow-block-chat` f248ce8e9 → PR168 (CI: ktlint, three
formatting findings listed in the PR); verification builds pushed as `codex/stream3-verify-ios-integration`
e86b9fe5b and `codex/stream3-verify-android-integration` 10c4368c6 (never for merge); docs PR170.

Reproduced/fixed: see the section above (8 defects, 6 PRs). Re-verified on device: all iOS fixes
(sheet dismissal, new_follower tap → profile on the r4c build only for the list path, Beacon plain
follow, refused-send banner, background push tap without crash) and the backend gate (403 post read,
comments dropped, follow refused). Not re-verified: Android composer permission prompt, Android
Beacon fallback / blocked Follow row / refused-send copy on the rebuilt APK (the installed APK is
827f28a08 = PR167 first commit + PR168; the 87460475e rewrite is built locally but not installed);
iOS DeepLinkRouter suites not rerun after the rewrite (last run on 46bde64f3: 123 executed, 3
failures all from the withdrawn widening); Android unit suites not run.

Evidence: `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream3-native-social-r1/`
100 files, MANIFEST **9ff965be0d1042fc3e147ee15bb5224c1c2c500ede9bd59be251d9ee8721faf4** (result.md indexes
every journey; crash .ips, push payload, cleanup/restore scripts included). Limits: simctl push and
adb `am start` stand in for APNs/FCM; simulator/emulator only; Evan's password rotated through the
real reset flow (throwaway, never the fixture value in transcripts).

Runtime left running: API pid 49623 on 127.0.0.1:18130 (code = PR163 branch), Next pid 36139 on
18131 (stream3-auth.localhost), containers `*pantopus-stream3-block-r1` + `pantopus-stream3-mail-r3`,
simulator 0AE16FA0 signed in as Evan with build e86b9fe5b, emulator-5554 signed in as Evan (Bob
signed out) with the 827f28a08 APK; emulator location permission revoked for the pending test.
Rows created and NOT cleaned (guarded child-first script `cleanup-social-r4-rows.py` in the bundle):
Posts 5f7a2322/b9cf8480, PostComments 60a4048a/b4691d46, PostReport de0dfb95, UserReports
a492140b/ac8a85d3, UserBlocks 440b7047/acde5f0c, UserFollow 63bcd4ff, Notifications b35ea1b0/
a78eb98a/93b05807/46375f39/04922c53. Evan has 2 active device sessions and the throwaway password
(`restore-evan-password.py` restores it through the real reset flow); Bob's pre-existing notification
read flags were restored and POST_NOTIFICATIONS re-granted.

Exact next step: fix the two CI findings (PR163 inline require; PR168 ktlint), install the
10c4368c6 APK, finish the four Android re-verifications, rerun the iOS DeepLinkRouter suites and
the Android view-model suites, run the cleanup + password restore, refresh MANIFEST/docs, then
batch 2 (A05 → A03 → N05 → A02 → A01 → A04/N02). START HERE note:
`/private/tmp/pantopus-stream3-20260920-r1/RESUME-2026-09-22.md`.
