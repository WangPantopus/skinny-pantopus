# Stream 1 — Support Trains and coordination

> **Split on 2026-09-30 (user direction).** The former Stream 1 (gigs, payments and coordination) became two streams:
> - **Stream 1 — Support Trains and coordination** (this file).
> - **Stream 2 — Posts, Hub and payments**: [`02-posts-hub-payments.md`](02-posts-hub-payments.md).
>
> The former Stream 1's full history — evidence, decisions, batches and the pre-split acceptance accounting — stays in [`former-stream1-gigs-payments.md`](former-stream1-gigs-payments.md), frozen at the split. Its "Split reconciliation" proves that every checklist item went to exactly one of the two streams (230 = 122 + 108).
> Streams 3–4 (formerly Stream 2: [`03-home-access-residency.md`](03-home-access-residency.md), [`04-place-records-money-mail.md`](04-place-records-money-mail.md)) and Stream 5 (formerly Stream 3: [`05-accounts-social.md`](05-accounts-social.md)) are not part of this split; Stream 1 still reviews and merges their PRs.

## CURRENT STATE — 2026-09-30T04:16Z (at the split)

- **Update 2026-10-01T13:46Z (Stream 1), batches 299–300.**
  - **Merged:**

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 299 | #1350 | 13:14:00Z | Stream 5's #1346: one reset or verification email per request, so its link keeps working |
    | 300 | #1355 | 13:43:49Z | Stream 5's **#1351** (one direct chat per pair; migration **20261001130000**), Stream 5's **#1353** (an invoice is paid only once its payment is captured), **my #1352** (publish-retry data loss; seal `c6919ebd`), and Stream 4's **#1354** (shared Android TalkBack: ListOfRows, WizardShell, PantopusButton) |

    Master is **`ff08ed75b`**; the next batch is **301**.
  - **Stream 1's exit checklists:** U02, U03 and U04 now have **todo 0 and decide 0**. #1354 closed the two shared Android U02 items, and Start a train gained E4 chips for #1352.
  - **#1338** (Stream 5, password change keeps the session) **passes my device check** on iOS and Android (seal `ca7e7b07`):
    - a wrong current password answers 401 with a field error, and the app stays signed in;
    - a correct change keeps the changing app signed in while the other device and an API session are revoked.

    It's **held only for Stream 5's own seal** (two iOS CI jobs pending).
  - **Found while testing (pre-existing; Stream 5 is fixing it on both apps):** Change password's **New password field reveals itself in plain text at 12 characters** (the minimum, when it turns valid) on iOS and Android, and **on iOS it also loses focus there**.
  - **Waiting:**
    - #1349 (Stream 5, Android DPoP per attempt): I'll build its APK and force a re-send with the fault proxy;
    - Stream 2's Connections and wallet cells (candidate m's .app);
    - Stream 3's guest-pass PR (131000);
    - Stream 2's toggles PR (134000).
  - **Runtime:** the backend runs candidate 27 `e3aa58e1c` from d2cb25. Its Trains code equals master's (#1347 + #1352), and #1338 is extra. Both devices carry candidate 26.
- **Update 2026-10-01T12:56Z (Stream 1), batches 294–296.**
  - **Merged:**

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 294 | #1336 | 12:17:20Z | Stream 2's #1331: the landing's hero and "The foundation" stack on phones (seal `b2cd1648`) |
    | 295 | #1337 | 12:28:20Z | **#1332, the first-launch cut flags**, solo (seal `b2b521c4`). Keys `beacon`, `personas`, `marketplace`, `open_gigs`, `public_scheduling`, `business_directory`, `household_extras`, `mail_extras`, all off unless `LAUNCH_FEATURES` / `NEXT_PUBLIC_LAUNCH_FEATURES` / `PANTOPUS_LAUNCH_FEATURES` lists them. Guide: `docs/launch-scope-flags-2026-10-01.md` |
    | 296 | #1340 | 12:34:38Z | **My #1339**: Support Train notifications name the helper or donor and show "Fri, Oct 9" (seal `577d4fa6`). `req.user` has no name, so every helper was "A helper" |

    Master is **`d8d3f5e03`**; the next batch is **297**.
  - **Trains notifications:** the tap-through works on iOS and Android (seal `fb34d0c8`). It found the copy defect fixed in #1339.
  - **Data loss found by Stream 5's idempotency audit, and fixed by me (not yet merged):** a publish whose reply is lost deleted the train it had just published.
    - Android: OkHttp re-sends the POST, the re-send gets 409, and the wizard deletes the train. iOS and web: the lost reply is an error, and the wizard deletes the train.
    - Reproduced on all three on master.
    - Fix `02292ccd4`:
      - publish answers a repeat on a live train with the train (200);
      - `DELETE ?draft_only=true` keeps a train that isn't a draft (409 `NOT_A_DRAFT`);
      - the three wizards discard with `draft_only` and treat `NOT_A_DRAFT` as launched.
    - The web after-run and the API contract pass. The native after-runs wait for candidate 26 (master + #1338 + this fix) in the heavy slot. Bundle: `20261001-stream1-trains-publish-retry-r1`.
  - **Decisions on Stream 5's audit:**
    - **Shared Android cause:** OkHttp `retryOnConnectionFailure` stays on. Stream 5 owns the DPoP proof per network attempt (a network interceptor). The general fix is server-side idempotency per route, with one client key per user intent.
    - **Stream 1's other four:** nudges/send, reveal-address, fund/enable and generate-slots, in that order after publish-retry.
  - **Migration numbers reserved** (master's newest is `20261001100000`): `20261001130000` Stream 5 (direct-chat race), `20261001131000` Stream 3 (guest-pass `request_id`), `20261001132000` Stream 2 (`wallet_debit` replay check, `IF FOUND`), `20261001134000` Stream 2 (post like/comment-like/repost/share set functions). `20261001133000` was reserved for Stream 3's residency letters and **released** at 13:10Z: letters reuse the claim fix's deterministic-id pattern, so there's no schema change. Whoever lands later renumbers above master's newest at batch time.
  - **Also merged since:** batch 297 (#1345, 12:57:38Z): Stream 5's #1341, #1343 and #1342 (repeat-safe reports, neighbor notes and connection request/accept). Batch 298 (#1348, 13:06:55Z): Stream 5's #1344 (crew posts no longer 500) and **my #1347** (Trains generate-slots, gift fund enable, reminders and guest address emails are safe to re-send; seal `45b96b4e`). Master is **`cd374963c`**; the next batch is **299**.
  - **Money decisions** (recorded for the user):
    - **Invoice /confirm:** marks an invoice paid only when Stripe reports the PaymentIntent `succeeded`, or `requires_capture`, which it then captures. Under the no-capture boundary only the refusal path is verified.
    - **Crew invoice and package-buy duplicates:** made idempotent.
    - **Wallet withdraw:** one key per withdrawal intent (Stream 2).
  - **Launch-flag calls accepted:**
    - the rebook rail is hidden, because its only action is the cut composer;
    - My Mail Day and the Stamps gallery stay visible, because they cover all received mail. Stream 4 confirmed and carved out the sample-data postage wallet under `mail_extras`.
    - The mailbox Earn `initiateWithdrawal` is cut #8, recorded only.
  - **Stream 3's guest-pass design is approved:** a request_id per create intent, and a replay rotates the token on the same row. Its three-app check must include a quick double-send, so the link the page shows is the live one.
  - **Waiting:**
    - #1338 (Stream 5, password change keeps the session) needs my device check, which runs in candidate 26.
    - Stream 2's Connections and wallet iOS cells run after that.
    - Stream 4's shared Android a11y PR is building.
  - **Runtime:** the peer-takeover worktree is on candidate 26 `7383e4160`, and its backend started at 12:52:42Z.
- **Update 2026-10-01T12:10Z (Stream 1), batch 293.** Merged #1335 at 12:08:55Z: **my #1334** (no self-notifications for organizer-helpers on address share and confirm; seal `6faa66b5`) and Stream 3's #1333 (Home members web a11y). Master is **`1eaa12827`**; the next batch is **294**. The runtime worktree is on master, and its backend code is identical.
- **Update 2026-10-01T12:10Z (Stream 1).** Android "Review signups, edit signup" A1–A4 is **not applicable** (seal `4b48bf0a`). The route is registered, but it has no caller and no deep link, and organizers manage signups in Manage, as on iOS. Stream 1's U02 is now done apart from Stream 4's 2 shared Android items.
- **Update 2026-10-01T12:05Z (Stream 1).**
  - **The six "A3 brand-blue token" decide cells are closed** (seal `749e0d21`). On master `a0eba5315`, axe finds 0 violations in light and 0 contrast violations in dark across 12 Trains web screens, so the 2026-09-30 AA accent utilities resolved them.
  - My first run measured the login page (a stale web session); it's kept as a NOTE and discarded. Lesson: assert page content before trusting axe.
  - Stream 1's U02 now has **0 decide** cells and 3 todos: 2 shared Android a11y items with Stream 4 (fix `5ed03843c` in progress), and Android Review signups A1–A4, mine.
  - **Runtime:** the peer-takeover worktree is on master `a0eba5315`, with the backend restarted at 11:43Z.
  - **Stream 2:**
    - posts.js:654 legacy branch: no change. It fails closed, and widening access to legacy rows is a privacy risk.
    - Two later items are recorded: Marketplace share-to-feed should set `distribution_targets ['place']` when Marketplace returns, and a production count of empty-target local-visibility posts would decide whether to retire the branch.
    - #1331 (landing mobile layout): the placeholder clamp and the stacked-art centering are approved.
- **Update 2026-10-01T11:40Z (Stream 1).**
  - **Merged:**

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 290 | #1323 | 11:16:56Z | Stream 5's #1320 (reviews) and #1322 (notifications and connections): tie-break by id |
    | 291 | #1325 | 11:20:36Z | Stream 2's #1324: the landing page passes WCAG AA contrast (my palette: `#0369A1`, `#736C63`) |
    | 292 | #1330 | 11:38:18Z | **My #1329** (Manage hands a non-organizer to the train page; `d53be353`); Stream 3's #1327 (Change role / dashboard refusal) and #1328 (invite-link fixes); Stream 5's #1326 (icon button names) |

    Master is **`a0eba5315`**; the next batch is **293**.
  - **Trains: U03 and U04 are complete for Stream 1** (todo 0):
    - Android dates remove E2 (`a9bd2b8b`): Remove cancels by PATCH, and the retry is a no-op;
    - Android U04 L1, L3 and L4 (`8d76b60a`).
  - Left: U02's 3 todos (the app-wide shared ListOfRows A4, Android Start steps 2–5 in the shared WizardShell, Android Review signups A1–A4) and 6 decide cells.
  - **Assignments:**
    - Stream 5 runs a native-POST idempotency audit (232 in-scope routes), then earnRiskReview.js (the job does nothing today; a shape will come before any behavior change), then trustState.js.
    - Stream 2 has posts.js:657 and the landing mobile layout (approved).
    - Stream 3 recorded landlordTenant.js as dead.
    - adminVerification /queue is launch-cut #6 and stays untouched.
- **Update 2026-10-01T11:12Z (Stream 1).**
  - **Merged** (each seal verified, every failed CI job read, verify-batch RESULT OK):

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 283 | #1305 | 10:09:08Z | Stream 5's **#1304**: the privacy preview only previews your own profile (any signed-in user could read anyone's connections-only posts). Alone, ahead of the queue |
    | 284 | #1307 | 10:20:13Z | Stream 5's **#1306**: Private and Registered-only profiles stay hidden on the local profile and in search |
    | 285 | #1309 | 10:29:14Z | Stream 5's **#1308** + migration **20261001100000** (assigned by me): "Only me" for Neighborhood hides your city, a move shows the new one, and a hide-only backfill |
    | 286 | #1315 | 10:47:54Z | Stream 5's **#1313** (a block hides you in app search and on your local profile) and **#1310** (the false P0.2 email retired) |
    | 287 | #1316 | 10:55:14Z | Stream 2's **#1299**: Pulse card VoiceOver actions. My cells r1 `3bca977e` and r2 `a72658ef`: changes requested ("helpful" lost the count), then fixed; a SwiftFormat `docComments` finding was fixed too |
    | 288 | #1319 | 10:58:17Z | Stream 5's **#1314** (dead Default profile visibility removed) and Stream 4's **#1317** (Home activity pages tie-break by id) |
    | 289 | #1321 | 11:06:44Z | Stream 2's **#1311** (gone post leaves Pulse; my iOS cell `438c341b`) and **#1312** ("Posted to your connections"; my iOS cell `208560df`), plus Stream 5's **#1318** (dead findable switches removed) |

    Master is **`6d3d05b9d`**; the next batch is **290**.
  - **Trains cells sealed:**
    - Android co-organizers E1–E5 (`0ba9c231`);
    - iOS gift fund E1–E3 (`0b082b86`);
    - Android gift fund E1–E3 (`6e5cc551`);
    - iOS U04 L3 and L4 (`0f496730`).

    U03 has 1 cell left (Android dates remove E2). U04 has iOS done, with Android L1, L3 and L4 left.
  - **Defect found (L3) and repaired, mine:** branch `codex/trains-manage-nonorganizer-20261001`, commit `8ddda924e`.
    - A Manage link opened by a non-organizer rendered every organizer control on iOS and Android. The server 403s all of them; the web already redirects to the train page.
    - Fix: Manage hands a non-organizer to the train's own page.
    - Candidate 25 (iOS + Android + ktlint/detekt + Trains tests) is queued in the heavy slot. The before is recorded in `20261001-stream1-ios-u04-l3l4-r1` and `20261001-stream1-trains-manage-nonorganizer-r1`.
  - **Findings routed:**
    - Android OkHttp silently re-sends a POST after a dropped connection. The creates carry `client_request_id`, so they're safe; new creates need idempotency keys.
    - Stream 4's created_at-only offset pagination: mine (`supportTrains.js:2251`) is to fix. Stream 5 has reviews (#1320) and notifications/relationships (#1322). Stream 3 has the admin queue. The cut lists stay untouched.
    - Stream 3's iOS confirmationDialog double-tap dead dialog: fix with `.alert`. A cross-stream list will follow.
  - **Decisions recorded (the user's standing direction):**
    - persona view-as is guarded like local (authorization, not Persona work);
    - the hide-only backfill is approved;
    - the false P0.2 email is retired;
    - landing page palette: `#0369A1` and muted `#736C63`, implemented by Stream 2;
    - a non-organizer opening Manage goes to the train page.
  - **Runtime:**
    - The backend runs `686ea0427`.
    - I hold device slots 2 (sim) and 3 (emulator-5558).
    - My heavy-slot job: cand25.
- **Update 2026-10-01T09:54Z (Stream 1).**
  - **Merged:** batch 282 (#1303, 09:52:50Z): Stream 2's #1296 and #1298 (web Posts), Stream 4's #1300 and #1301 (native Documents replace headline, native Place refusal), and Stream 5's #1302 (Edit profile reaches the public LocalProfile copies). Master is **`bbd6b72d0`**; the next batch is **283**.
    - Stream 4's one bundle (`df72ad06`) records their combined build `4312e6f71`. Every #1300/#1301 file is blob-equal to it, and master changed none of those files or the symbols they use after its base.
    - #1302 review: no app calls `PATCH /api/local-profiles/me`, so the sync can't overwrite a public name someone chose there.
  - **Trains cell sealed: iOS co-organizers E1–E5** (`c3bf7bcc`; checklist flipped).
    - Retries are upserts or no-ops, and a double tap sends one request.
    - A co-organizer sees no add or remove, and only Pause.
  - **Peer cell: #1299 iOS** (`3bca977e`, at `8c9312498`): **changes requested, then fixed.**
    - The Sim helper's raw `uiDescribeAll` tree has a `custom_actions` key (`runners/ios-ax-keys.py`), so a card's VoiceOver actions can be listed here.
    - Master's `.combine` already exposed 4 actions. The PR's reaction action dropped the count ("helpful" against the button's and master's "helpful, 0").
    - Stream 2 pushed `64cab2740` (named like the button). My iOS candidate 23 (`35ae0f15f` = master `bbd6b72d0` + `64cab2740`) is queued in the heavy slot, and the r2 cell follows.
  - **Runtime:**
    - The backend runs `686ea0427` (Trains files equal master's).
    - I hold slots 1 (emulator-5558) and 2 (sim, app `f23581348`).
  - **Queue:**
    - #1299 r2;
    - Stream 2's gone-post refresh (`28217b9dc`) and "Posted to your connections" toast (`09216e1d1`; to rebase now that #1296 is on master);
    - Stream 3's invite-link fixes;
    - Stream 5's local-profile visibility privacy fix (reproduction first).
- **Update 2026-10-01T09:22Z (Stream 1).**
  - **Merged:** batch 281 (#1297, 09:21:28Z): **my #1292 and #1294**, Stream 2's #1293 (my iOS cell `e379c329`), Stream 3's #1295, and Stream 5's #1290. Master is **`e333507a9`**; the next batch is **282**.
  - **Mine, merged:**
    - **#1292 (`51a60c0d`): back to draft is reversible.**
      - Organizers get "Publish train" while the train is a draft, on iOS and Android.
      - Publish reuses the train's chat room. Re-publishing used to make a second room.
      - Verified on both apps: E1, E3 and the 422 message; 1 room, same thread, history kept.
    - **#1294 (`6c9376f3`): co-organizer chat membership.**
      - The privacy defect: a removed co-organizer kept reading the train's coordination chat (200).
      - Now add joins the chat and remove leaves it (403), unless the person is still a helper with an active signup.
      - Verified through the API and in the iOS app.
    - **Follow-up for a later decision:** stale memberships of co-organizers removed before #1294 need a one-time cleanup with a production review. Not done.
  - **Peer device cell:** #1293 iOS (`e379c329`). On iOS it's defensive parity, as with #1275.
  - **Decisions recorded (the user's standing direction: best UX):**
    - **Stream 2:** a new post that won't appear on the surface on screen gets a truthful toast saying where it went, e.g. "Posted to your connections". Its own PR.
    - **Stream 3:** I recommended hiding "Owner" in Change role, since the server always refuses it. Their call as owner.
  - **Runtime:**
    - The backend runs `686ea0427` (master `b91b6e8d1` + #1292 + #1294), from the `stream1-peer-takeover` worktree, detached.
    - I hold device slots 1 (emulator-5558) and 2 (sim).
  - **Queue:**
    - #1296 (Stream 2 web, `6b3ba040`);
    - Stream 2's card-actions PR (8c9312498, building);
    - Stream 3's invite-link fixes (30e39e566);
    - Stream 4's next native fixes.
- **Update 2026-10-01T08:59Z (Stream 1).**
  - **Merged:** batch 280 (#1291, 08:58:20Z): Stream 2's #1284 + **#1287 (stacked)**; Stream 5's **#1289** (the Trains web "Sign up for this slot" dialog portals over the header/sidebar; I delegated and approved it as owner), #1285, #1288. Master is **`b91b6e8d1`**; the next batch is **281**.
  - **Trains cells sealed:**
    - **iOS lifecycle** (`7e842b1f`): E1/E3 for pause, resume, back to draft, archive and delete, plus E2 for resume, back to draft and archive. Each sends one request, and every retry is a server no-op.
    - **Android lifecycle** (`42c3f579`): E1/E3 for all five. iOS retries an idempotent DELETE after a single 503; Android doesn't.
  - **Defect found and repaired (mine, [#1292](https://github.com/WangPantopus/skinny-pantopus/pull/1292), `0fc61cf56`):**
    - **Dead end:** "Unpublish (back to draft)" left no way back to published in any app.
    - **Duplicate room:** re-publishing created a second active chat room, splitting the conversation (probe: 2 rooms).
    - **Fix:** organizers get "Publish train" while the train is a draft (existing pill, iOS + Android), and publish reuses the train's room.
    - **Verified so far:** the backend after-check (1 room, same thread, history kept). The app after-runs follow on candidate `f23581348`, which is building.
    - **Decision recorded:** a draft is reversible in the app, and publishing again continues the same conversation.
  - **Runtime:**
    - My backend now runs `0fc61cf56`, from the `stream1-peer-takeover` worktree at that commit, detached.
    - I released device slot 4 for Stream 2's Android run; I'll re-acquire it for #1292's Android after.
- **Update 2026-10-01T08:29Z (Stream 1).**
  - **Merged:** each seal verified, each PR's failed CI jobs read, verify-batch RESULT OK or proved by hand.

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 277 | #1280 | 07:58:54Z | #1249 (FAB clearance; its one red Android job is the pre-#1254 PulseCompose golden, base predates #1254), #1259 (post-screen save/like reaches the feed; my iOS cell `f76dbc3a`) |
    | 278 | #1283 | 08:03:31Z | #1270 (security link → Devices; my devices `f842449d`), #1274 (push switch honoured by briefings/alerts/reminders), #1273 + **#1279 stacked** (proved file-for-file against #1279's head), #1277 (dialogs portal), #1278 (profile "More actions") |
    | 279 | #1286 | 08:27:55Z | **my #1276**, #1275 (my iOS cell `137f8d82`), #1281 (phone width), #1282 (checklist headline) |

    Master is **`5e5bf32d3`**; the next batch is **280**.
  - **Mine:**
    - **#1276 (`0170af7b`): the Support Train page keeps its place after a helper action.**
      - The defect: after Mark delivered, Confirm delivery, Leave slot or a signup's Done, the page reloaded through its skeleton and came back at the top, with the changed row off screen.
      - Both platforms now keep loaded content while reloading, as Manage already did.
      - Verified on iOS and Android, before and after.
      - Android rotation no longer flashes the skeleton.
      - A reload that persistently fails still shows the existing error with Try again.
    - **Trains cells sealed:**
      - Android E3 for sign-up/leave and for delivery/confirmation (`e5894f97`, 6 runs, one request each);
      - iOS organizer dates remove E1/E2 (`8a6f0b6d`). E1: a 503 keeps the date and the retry removes it. E2: after a lost reply, the retry is a safe no-op.
  - **Peer device cells:**
    - #1259 iOS (`f76dbc3a`);
    - #1270 iOS + Android (`f842449d`);
    - #1275 iOS (`137f8d82`). On iOS no tried path keeps a Pulse card alive under My posts → Saved, so the change is defensive parity there.
  - **Notes:**
    - **Fixture area:** Alice's iOS Pulse needed a fixture saved place. Loading the Place tab with it made the local backend fetch public Open-Meteo/NOAA data for the fixture coordinates. Those cache rows were deleted with the fixture.
    - **Pulse card actions:** the iOS Pulse card's custom actions can't be verified here (no VoiceOver on the Simulator, and the AX bridges don't expose custom actions). Stream 2 is making them explicit (c2c6ce1d1).
  - **Delegated:** Stream 5, which has capacity, will portal the web "Sign up for this slot" dialog (`support-trains/[id]/page.tsx`, #1277 pattern; I approved it as owner). Stream 5 may also take the Payments tab-row overflow, after asking Stream 2.
  - **Queue:**
    - #1284 (Stream 2 web, sealed `a626489b`).
    - Next from Stream 2: c5ad8840e (native My posts refresh; my iOS cell) and c2c6ce1d1 (Pulse card actions).
    - Stream 4's next two native fixes.
- **Update 2026-10-01T07:25Z (Stream 1).**
  - **Trains cells closed (iOS, sealed):**
    - `20261001-stream1-ios-u03-signup-e3-r1` (`f161eeee`): **Helper sign-up, cancel, leave — E3.**
      - A double tap on "Confirm signup" makes one signup, both at normal speed and with the reply held 5 s; the button reads "Signing up…" and is disabled.
      - A double tap on the "Leave slot" alert sends one cancel.
      - Fixtures removed: 351/353 tables equal the baseline, then 353/353.
    - `20261001-stream1-ios-u03-delivery-e3-r1` (`d440ae05`): **Delivery and organizer confirmation — E3.** Each double tap sends one POST, with every reply held 5 s:
      - Mark delivered;
      - Confirm delivery on the train page;
      - Manage's Confirm delivery for another helper.

      353/353 tables equal the baseline.
  - **Defect found, repair in progress (mine):**
    - **The defect:** after any helper action (Mark delivered, Confirm delivery, Leave slot, or closing the sign-up sheet), the train page reloads through its skeleton and comes back at the top. The row just changed is off screen.
      - Reproduced on iOS: YOUR COMMITMENT is at y=363 before Mark delivered and y=846 after.
      - Android uses the same `load()` pattern.
    - **The repair:** both train-page view models now keep loaded content while reloading, as both Manage view models already do. It's one guard per platform, with the skeleton kept for the first load and after errors.
      - Branch `codex/trains-detail-keeps-place-20261001`, commit `be27fb16f`.
      - Build queued in the heavy slot behind candidate 20 and Stream 3.
      - An Android before and both afters will follow.
  - **Noted for the backlog (not fixed):** when an organizer confirms their own delivery, they get a "Delivery Confirmed" notification about themselves. Their own signup and their own "delivered" don't notify them.
  - **Queue:**
    - Stream 2's #1273 (web My pulse → feed cache, head `6200b4b37`, seal `568930b2`) goes into the next batch.
    - Candidate `3326f3ecc` (#1249, #1259, #1270) is first in the heavy slot.
- **Update 2026-10-01T07:12Z (Stream 1).**
  - **Merged:** each seal verified, each PR's failed CI jobs read, verify-batch RESULT OK.

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 274 | #1266 | 06:50:25Z | #1261 (the monthly summary email honours the opt-out and fails closed; merged before today's 17:00Z job) |
    | 275 | #1268 | 06:57:28Z | #1267 (web "My posts" sidebar entry, as decided) |
    | 276 | #1272 | 07:06:14Z | #1265 (crew page editor row names), #1269 (End Lease asks first), #1271 (landlord wizard copy) |

    Master is **`dc878ddb5`**; the next batch is **277**.
  - **Mine, verification only (sealed):**
    - `20261001-stream1-ios-u04-l1-r1` (`a8bf8e36`): **U04 L1 on iOS.** The sign-up sheet's details, Manage's update draft and Start's short note survive going to the background and back (same pid).
    - `20261001-stream1-ios-u03-lists-detail-r1` (`5a740586`): **iOS lists R1/R2 and detail R1.** Injected 500s give errors with Try again, which recover; empty states are truthful.
    - `20261001-stream1-ios-1248-1249-1250-r1` (`342ba49e`): Stream 2's iOS cells.
  - **In flight:** candidate `3326f3ecc` (master `008613b81` + #1249 + #1259 + #1270). It covers #1249's Android compile and Paparazzi verify, the #1259 iOS cell, and #1270 on both apps. The iOS before for #1270 is recorded: the deep link does nothing.
    - The simulated push can't run: the app has no notification permission on the test sim, and I don't grant OS permissions.
  - **Infrastructure:**
    - macOS's tmp_cleaner (local midnight, **07:00Z**) deletes files under `/private/tmp` untouched for 3 days. At 07:00Z it removed `tools/verify-bundle.py`; it's rewritten and now accepts Stream 5's manifest format too.
    - My kit is copied (no secrets) to `.pantopus-recovery/stream1-runtime-kit`. My runtime's and `/private/tmp/pantopus-tools`' timestamps are refreshed. All streams are warned.
    - Changing the system job is the user's call.
- **Update 2026-10-01T06:55Z (Stream 1).**
  - **Merged:** each seal verified, each PR's failed CI jobs read, verify-batch RESULT OK.

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 270 | #1255 | 06:03:56Z | **#1254 first** (re-records the edit-form golden; master's Android unit tests green again), #1237 (iOS: one pop after a save; my cells `e516402f`), #1238 (Android View as "Not shown"; my device run `a7d17231`), #1241 + #1242 (Android ListOfRows paging and top rows; my My trains run `a7d17231`) |
    | 271 | #1258 | 06:16:58Z | #1253 (web profile Connect, parity), #1257 (web post page save/like reaches the feed card) |
    | 272 | #1263 | 06:39:05Z | #1256 (crew Stripe return URLs, backend; URLs only), #1260 (dead claim link), **my #1262** |
    | 273 | #1264 | 06:47:20Z | #1248 (no category preselected in edit), #1250 (iOS row labels); my iOS cells `342ba49e` |

    Master is **`f247a3e69`**; the next batch is **274**.
  - **Mine, merged — #1262: the Android sign-up sheet keeps its draft** (bundle `20261001-stream1-android-signup-draft-r1`, 99 files, `96676bc0…d9a6ae76`).
    - Before (master's sheet): a rotation lost the choices and "Soup".
    - After: the details step and "Soup" survive landscape, portrait after the reload, and dark mode on and off. Reopening starts a new draft.
    - The draft is a saveable holder in the detail screen, outside the sheet's window and the loaded check.
  - **Mine, verification only:** `20261001-stream1-android-u03-lists-r1` (`f439d4b5`).
    - R1: an injected 500 shows "Couldn't load your support trains. Try again.", and Try again recovers.
    - R2: Invitations shows its empty state, and Nearby asks for location.
  - **In flight:** candidate `96bc366d3` (master `f247a3e69` + #1249 + #1259) is queued in the heavy slot. It covers #1249's Android compile with #1241/#1242, a Paparazzi verify of ListOfRows, and the #1259 iOS cell.
    - verify-batch couldn't prove `ListOfRowsScreen.kt`: #1249's context changed under #1241's new comment.
    - A manual proof (`cand19-manual-proof.txt`) shows master→tip's changed lines equal #1249's exactly (sha `88334de0…`).
  - **Decisions:** web "My posts" will be a sidebar footer button above Settings, on desktop and in the mobile drawer. It's parity with native, keeps the wedge's primary nav, and the saved list needs an entry point. Stream 2 is implementing it.
  - **Lessons:**
    - Under heavy host load, uiautomator `dump` stalls until the UI is idle, and the emulator can hit System UI or GPU ANRs. Use retry loops, and reboot the emulator if needed.
    - After an emulator reboot, auto-rotate comes back on, so set `accelerometer_rotation 0` before `user_rotation`.
    - Deleting caches doesn't free space while Time Machine local snapshots hold the blocks. macOS thins them under pressure.
- **Update 2026-10-01T05:58Z (Stream 1).**
  - **Merged:** each seal verified, each PR's CI checked for failed jobs, verify-batch RESULT OK.

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 267 | #1246 | 05:25:37Z | #1243 (Stream 5: the name card asks before removing a connection, opens the conversation, toasts failures), #1245 (Stream 3: the shared SlidePanel ignores a double-click's second click, 11 callers) |
    | 268 | #1247 | 05:32:04Z | #1244 (Stream 5: Discover's people results ask before removing a connection) |
    | 269 | #1252 | 05:50:12Z | #1251 (Stream 5: crew forms, part 2, fields named) |

    Master is **`a411def0e`**; the next batch is **270**.
  - **Master's Android unit tests have been red since batch 264.**
    - #1209 changed the edit form, but the Paparazzi golden `PulseComposeSnapshotTest.pulse_compose_edit_prefilled` wasn't re-recorded, and its own CI job showed it. I merged without reading that job.
    - Stream 2 is re-recording the golden; it merges first.
    - **Queue rule from now on:** read every failed job on a PR's latest run before batching, even with required CI off. Master's own CI runs are cancelled by later pushes, so the PR runs are the only signal.
  - **Device runs for peers** (sealed):
    - `20261001-stream1-ios-1237-r1` (`e516402f`): #1237 iOS. Saves from My posts, from a post's page, and from Hub and Pulse compose each go back one screen; Close is one pop.
    - `20261001-stream1-android-1238-1242-r1` (`a7d17231`):
      - #1238: TalkBack reads "Not shown. Verified neighbor" when the badge is hidden and "Verified neighbor" when it's shown.
      - #1242: My trains shows a new train as the first visible row after a revisit.
  - **Next native batch:** the golden fix, then #1237, #1238, #1241 and #1242 once their seals carry my bundles. Stream 2's #1248, #1249 and #1250 need my iOS cells; candidate `9b4ff70c6` is queued.
  - **Mine, in progress: the Android sign-up sheet keeps its draft** (`2ef2925ea`, local; bundle `20261001-stream1-android-signup-draft-r1` open).
    - **Before** (master sheet, `ee2de35da`): choose Takeout, type a dish name, rotate. The sheet comes back at "How would you like to help?" with nothing kept.
    - **First attempt** (`542bd71b0`): it held the draft in the screen, but inside the loaded check. The screen reloads after a recreation, which took the draft out of composition, so it still reset (cand16 run).
    - **The fix:** the draft is remembered unconditionally and keyed to each opening of the sheet. Its build is cand17 `89d58648f`, queued.
  - **Routed:**
    - landlord "End Lease" and staff "Remove" with no confirmation (Stream 5's scan) → Stream 3;
    - the post screen's save/like don't reach the Pulse feed cards → Stream 2 (fix queued).
  - **Host:**
    - Load averages reached 141 during parallel builds and Spotlight indexing.
    - The emulator hit a GPU-hang ANR ("stuck fence"), an environment fault.
    - Disk is at 16–20 GiB free; I removed 3.5 GB of my old candidate apps.
- **Update 2026-10-01T05:00Z (Stream 1).**
  - **Merged since 03:25Z** (each seal verified at the PR head; build-batch/verify-batch RESULT OK; SwiftLint/SwiftFormat on every changed Swift file):

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 260 | #1218 | 03:38:53Z | #1206 (Stream 5 web: tab bars say which tab is selected), #1208 (Stream 5 web: fields announced by their labels) |
    | 261 | #1224 | 03:43:22Z | Stream 4 native: #1219 (Today's Pulse greets by the device clock), #1220 (Android Block Founders form clears after a send), #1222 (iOS invite budget plural), #1223 (a failed document delete says so) |
    | 262 | #1225 | 03:44:26Z | #1221 (Stream 2 web: Saved paging tells the truth after Remove) |
    | 263 | #1227 | 04:03:08Z | #1216 (Stream 5 backend: `verified_resident` means a verified residency), #1217 (Stream 5 web crew-tool fields labelled) |
    | 264 | #1233 | 04:32:33Z | #1209 (Stream 2 native: an edit keeps the post's audience; my iOS run `4898d3ff`), #1226 (post media viewer above the header), #1228 (mail list Star by keyboard), #1229 (My pulse cards stay in step), #1231 (one residency letter per double-click), #1232 (landlord Approve modal survives a double-click) |
    | 265 | #1235 | 04:34:30Z | #1210 (Stream 2 native Saved tab; my iOS run `4898d3ff`) |
    | 266 | #1240 | 04:57:56Z | #1230 (chat Report usable from Chat details), #1234 (ModalShell semantics), #1236 (five Stream 5 dialogs), **my #1239** |

    Master is **`2abd0edd4`**; the next batch is **267**. No migrations.
  - **Mine, merged — #1239, Trains U02 A4, part 2** (bundle `20261001-stream1-android-u02-trains-r2`, 103 files, `f6db8244…ffade7bb`):
    - **Android sign-up sheet** (TalkBack speech probes, before → after):
      - the help options are radio buttons with their state ("Selected. Takeout / delivery. Radio button");
      - Back, Next, Review and Confirm signup are Buttons;
      - fields are named by their labels ("Edit box. Dish name. e.g. Chicken soup");
      - each review row is one stop.
    - **Web Start a train:** the story field, the chip ✕ ("Remove peanuts") and special instructions are named. Found by role and name: 0 → 1.
    - Inside the sheet the pixels are identical. The before shots' larger differences are TalkBack's own overlays.
  - **Trains backlog, seen and not fixed yet:** on Android, the sign-up sheet starts over when the activity is recreated (rotation, dark mode, font). Its `rememberSaveable` draft sits inside `ModalBottomSheet` and isn't restored. Fix: keep the draft in `SupportTrainDetailViewModel`. This is on master; it's my next Trains repair.
  - **Device runs for peers:** `20261001-stream1-ios-1209-1210-r1` (`4898d3ff`): #1209 and #1210 pass on iOS. The 53-save case loads all 52 rows. Four iOS findings went to Stream 2:
    - an empty first segment in row labels;
    - the FAB covers the last row's trailing control;
    - "Handyman" preselected for an Ask with no category;
    - **after a save, the composer pops twice**: `onPosted` and then `onCancel`, in four hosts. Stream 2's fix is #1237.
  - **In flight:** candidate `e8f91e70e` (master `2abd0edd4` + #1237 + #1238) is building. Then:
    - Stream 5's #1238 Android View-as "Not shown" check;
    - Stream 2's #1237 iOS cells: My posts → Edit → Save lands on My posts; the post → Edit → Save lands on the post; Hub compose returns to the Hub; Cancel is still one pop.
  - **Decisions (standing direction):**
    - Stream 2's Android `ListOfRows` fixes are approved as their own PRs: the `rememberUpdatedState` paging fix, and keeping the list at the top after a re-read *only* when it was at index 0, offset 0. I verify My trains during review.
    - Stream 5's ModalShell PR was approved on three conditions: semantics only; verified only through StepUpPasswordModal (the gig-detail modals are launch cut #4); no focus change unless every caller gets it.
    - At 04:16Z I freed device slot 1 for Stream 2's Android runs, then swapped my simulator for my emulator inside slot 2.
    - The mailbox's My Mail Day summary GET writes a MailEvent (cut #8). Routed to Stream 4, which recorded it for the user's cut flags.
  - **Lessons:**
    - The TalkBack probes now refuse to run unless TalkBack is on. With TalkBack off, their touches are real taps: one closed a sheet, with no write.
    - In zsh, `$H:path` is a modifier; use `"${H}:path"`.
    - `api.py` cuts its output at about 3 KB, so take ids from the text, not from parsed JSON.
- **Update 2026-10-01T03:25Z (Stream 1).**
  - **Merged** (each seal verified at the PR head; build-batch/verify-batch RESULT OK; SwiftLint/SwiftFormat on every changed Swift file; `node --check` on changed backend files):

    | Batch | PR | Merged | Contents |
    |---|---|---|---|
    | 241 | #1157 | 01:04:13Z | #1149 (Stream 5 crew setup checklist links), #1156 (Stream 2 web Visitor badge note) |
    | 242 | #1160 | 01:19:20Z | #1150 (Stream 5 business trust step: document-verified crews only) |
    | 243 | #1164 | 01:31:45Z | #1163 (Stream 4 SwiftFormat leftovers), #1162 (Stream 3 refused viewer gets no invite), #1121 + #1119 (Stream 5 page editors; my device run `e5c7c502`), #1155 (Stream 5 dead hero upload box) |
    | 244 | #1171 | 01:52:01Z | **security** #1169 (Stream 2: people lane listed every account; now `[]`), #1166 (Stream 2 composer date labels) |
    | 245 | #1175 | 01:58:52Z | #1172 (Stream 4 Pulse honesty: no all-clear when alerts weren't checked), #1173 (web Documents download), #1174 (Uploaded day only) |
    | 246 | #1178 | 02:06:12Z | #1176 (Stream 3 postcard notice names the newcomer, never the e-mail), #1177 (web Home chip rename) |
    | 247 | #1180 | 02:08:29Z | #1179 (Stream 2 web Place composer drops Service/Announce) |
    | 248 | #1184 | 02:20:23Z | #1165, #1167, #1168, #1170 (Stream 5 web a11y/copy), #1181 (Place brief greeting by the viewer's clock), #1183 (one profile card) |
    | 249 | #1187 | 02:34:08Z | #1159 (Hub Discover Posts → Pulse; backend lane removed), #1161 (native Visitor meta), #1185 (Today sources credit only answering providers), #1186 (web distances in miles); my iOS run `dd21f9b4` |
    | 250 | #1189 | 02:39:21Z | #1158 (Stream 5 native: no dead Padding/Background chips; my device run `dd21f9b4`), #1188 (Stream 2: empty Alerts filter is never an all-clear) |
    | 251 | #1191 | 02:45:36Z | #1182 (Stream 5 chat overlays portaled to body, 10 controls named) |
    | 252 | #1194 | 02:48:16Z | **security** #1193 (Stream 2: Saved lists only posts the viewer can still open, fail closed) |
    | 253 | #1197 | 02:56:48Z | #1190 (Stream 5 settings switches named with state) |
    | 254 | #1199 | 03:00:28Z | #1198 (Stream 2 web Saved tab on My pulse; paging by raw offset) |
    | 255 | #1202 | 03:04:13Z | #1201 (Stream 2: moderation-removed post opens only for its author), #1195 (Stream 5 page editor keyboard access) |
    | 256 | #1205 | 03:07:58Z | #1203 (Stream 4 Block Founders invitations: reserve as `created`; code-only), #1204 (iOS byte sizes) |
    | 257 | #1207 | 03:13:05Z | #1200 (Stream 5 notification Remove on keyboard focus) |
    | 258 | #1212 | 03:24:13Z | #1192 (hidden block announces "Hidden from visitors"), #1196 (iOS Pages labels; my run `74673a4a`), **my #1211** (Trains U02 A1–A4 on Android) |

    Master is **`58797e34c`**; the next batch is **259**. Since then, batch 259 (#1215, 03:29:40Z): Stream 3's #1213 (web guest-pass draft survives the access re-check) and #1214 (**shared** ConfirmDialog ignores a double-click's second click; accepted as a cross-stream fix). Master **`61d710fed`**, next **260**. No migrations. Migration 20261001020000 was reserved for Stream 4 and **released** (code-only fix).
  - **Mine, merged — #1211, Trains U02 A1–A4 on Android** (bundle `20260930-stream1-android-u02-trains-r1`, 294 files, `ac43ecdb…d172a463`):
    - TalkBack (speech probes, before → after):
      - calendar days say their state;
      - coverage is one phrase;
      - the recipient card is one stop;
      - duplicates removed;
      - Manage's field, switch and chips are named with state;
      - Start's reason tiles are radio buttons.
    - Font 2.0:
      - the legend wraps;
      - "pm" and the end date are kept;
      - the pills grow;
      - names get an ellipsis;
      - stat labels grow up to 1.5×.
    - Default size: the train page and Start are pixel-identical. Manage's stat row **already clipped its labels in half on master** and now fits them, about 12dp taller; kept as a clipped-text repair.
    - A3: no defect. The old "Android HOME chip 4.42" is the scanner's 8-step colour binning; the tokens give 4.57:1.
  - **Device runs for peers** (sealed bundles):
    - `20261001-stream1-native-1119-1121-devices-r1` (`e5c7c502`);
    - `20261001-stream1-native-1158-1159-1161-devices-r1` (`dd21f9b4`). iOS #1159's Back lands on the Nearby root, the same as the existing Pulse pillar, so it is existing navigation;
    - `20261001-stream1-native-1192-1196-devices-r1` (`74673a4a`);
    - `20261001-stream1-ios-edit-audience-r1` (`76f097b7`): the before for Stream 2's #1209. A text-only edit of a Connections post → 400. The red toast shows raw validation text for about 2 s; my first "no feedback" reading came after the toast had gone and was corrected.
  - **Decisions (standing direction):**
    - **Saved posts:** Stream 2's three-step plan is approved:
      1. `/saved` re-checks `canViewPost` and fails closed;
      2. a web Saved tab on My pulse;
      3. native Saved segments.
      All three use existing surfaces, posts only and raw-offset paging. Save existed everywhere, but its results were unreachable.
    - **Native post edit:** the audience is fixed after posting, like identity. Edit sends no visibility, and the selector is hidden in edit, as on web. Accepting 'connections' on edit is rejected as a privacy lie. `serviceCategory` is sent only when changed (#1209).
    - **Large text:** repair only lost content or clipped control labels, keeping the default design. This follows the user's 2026-09-29 "keep the current layout" ruling.
    - Accepted presentation fixes for accessibility failures: #1166 (date labels) and #1179 (hide Place-refused intents). #1188: never imply an all-clear from the absence of posts.
  - **Routed:**
    - Block Founders 'reserved' CHECK → Stream 4 (fixed, #1203).
    - The native Today's Pulse greeting on the server clock → Stream 4 (in progress).
    - `verified_resident` badge = email verified (a false trust signal) → Stream 5.
    - Portal-less fixed overlays in AppShell `<main>` (web) → Stream 2 for the post image viewer, Stream 5 for the seat/member modals.
    - Stream 2's latent "visibility-only edit can't hide a Place post" became #1209.
  - **Open queue:**
    - #1209 (edit audience) and #1210 (native Saved segment): Stream 2, need my iOS after-runs once sealed.
    - #1206 (tab bars) and #1208 (form labels): Stream 5 web, in CI.
    - Stream 4's next three: the Pulse device greeting, invite form clearing, and Documents delete honesty.
  - **Lessons:**
    - A font-scale or uimode change recreates the Android screen at the top, so scroll *after* each mode change.
    - iOS AX can stall after a reinstall; a simulator reboot fixes it.
    - An iOS 26 confirmation popover has no Cancel button; HID Escape (`{"op":"key","code":41}`) dismisses it.
    - Compose `clearAndSetSemantics` also clears semantics *after* it in the same chain, so put `clickable` and `testTag` before it.
    - zsh doesn't word-split `$var`; use `${=var}`.
    - Re-queueing a heavy job keeps its place only if nobody joined behind it.
- **Update 2026-10-01T01:00Z (Stream 1).**
  - **Merged** (each seal verified at the PR head; build-batch/verify-batch RESULT OK):

    | Batch | PR | Time | Contents |
    |---|---|---|---|
    | 228 | #1130 | 00:21:13Z | #1126 (Stream 5 web portfolio, Services tab removed), #1127 (Stream 2 post band in dark). `ServicesTab.tsx` was deleted, so it was proved by hand (verify-batch can't reverse-apply a deletion) |
    | 229 | #1132 | 00:23:16Z | #1131 (Stream 4 Document detail: no dead Open/Share) |
    | 230 | #1136 | 00:28:17Z | #1134 (Stream 2 toast live regions) |
    | 231 | #1137 | 00:34:21Z | #1116 (Stream 4 HubTabRoot trailing closure; master SwiftLint green again; compiled in candidate `68b8ac1ec`) |
    | 232 | #1141 | 00:40:39Z | **security** #1140 (Stream 4): the public home-files listing returns an allowlist of columns, not `select('*')` |
    | 233 | #1142 | 00:41:27Z | #1133 (Stream 5 dead block Appearance controls) |
    | 234 | #1145 | 00:44:30Z | my #1117 (T9) + my #1144 (Start default Meal train, banner copy, iOS Home chip dark 3.06 → 8.80); bundle `20260930-stream1-trains-start-banner-chip-r1` `aba8772c` |
    | 235 | #1146 | 00:45:44Z | **security** #1135 (Stream 5): the anonymous portfolio returns an allowlist of columns |
    | 236 | #1147 | 00:46:21Z | #1138 (Stream 2 Visitor badge; change requested and made: trusted homes via `getAccessibleHomeIds`, not bare `is_active`) |
    | 237 | #1151 | 00:57:06Z | #1129 (Stream 2 iOS Today Manage → Notification settings; my simulator run `20261001-stream1-ios-1129-today-manage-r1` `976a017c`; path A not reachable on my stack) |
    | 238 | #1152 | 00:57:59Z | #1128 (Stream 5 test-only: date-proof maintenance snapshot; unblocks Android CI after midnight) |
    | 239 | #1153 | 00:58:46Z | #1139 (seat menu by keyboard/tap), #1143 (builder preview truth) |
    | 240 | #1154 | 00:59:57Z | #1148 (Stream 2: verified residents recognised for Place posting via the household rule) |

    Master is **`2dc6b9747`**; the next batch is **241**. No migrations.
  - **Decisions (per the user's standing instruction):**
    - Post page band in dark: option B (type colour at 10%).
    - Fridge "Revoke" left at 4.54:1 (passes).
    - Hub Discover Posts → "Browse Pulse" (Stream 2), with the unfiltered backend lane removed.
    - #1138's change request (pending claims mustn't hide the Visitor badge).
    - Schema-drift candidates routed to their owners: mail → 4, home access → 3, businesses → 5, earn → 2.
  - **Lessons:**
    - verify-batch can't reverse-apply a deleted file; prove it by hand (base blob == merge-base blob, absent at the head and the tip).
    - In zsh, `"$TIP:frontend/…"` hits the `:f` modifier, so always write `"${TIP}:…"` (a lint ran on empty files once).
    - Run swiftlint --strict on every changed Swift file of a batch; #1103's error slipped through when only shared files were linted.
  - **Next:** Stream 5's device run (#1119 + #1121 on the combined candidate, crew fixtures), then the Android Trains TalkBack fix PR (calendar tile states, duplicate speech, unnamed Manage field/switch, reason tiles' selected state).
- **Update 2026-10-01T00:09Z (Stream 1).**
  - **Merged** (every seal verified at the PR head; build-batch/verify-batch RESULT OK, all files blob-equal):

    | Batch | PR | Time | Contents |
    |---|---|---|---|
    | 224 | #1114 | 23:32:43Z | #1113 (Stream 2): web Place deal needs an end date before sending |
    | 225 | #1120 | 23:48:30Z | #1118 (Stream 3): unsaved Home settings survive the access re-check; #1115 (Stream 5): crew page without placeholder blocks, real contact form, safe embeds |
    | 226 | #1123 | 00:07:33Z | #1122 (Stream 2): composer location chip readable in dark |
    | 227 | #1125 | 00:08:13Z | #1124 (Stream 2): Pulse map popup opens below the "Search this area" pill |

    Master is **`e7fc87cda`**; the next batch is **228**. No migrations.
  - **Open, mine:**
    - #1117 T9: your own slot isn't listed again as a neighbor's (iOS, Android). Sealed `6c3137e6` (44 files), with before/after on both apps and a shared-slot case.
    - Branch `codex/trains-start-default-banner-20260930` (`8735ef6db`, PR not opened yet):
      - Start's reason picker starts on Meal train (was Surgery; the choice is never sent);
      - the covered banner says "Thanks, neighbors. No more sign-ups are needed right now.";
      - the iOS recipient Home chip in dark goes from 3.06 to 8.80 (`home` token, light unchanged).
      - Before shots are in `20260930-stream1-trains-start-banner-chip-r1`.
  - **Combined candidate** `e12254b59`: master + #1117 + that branch + Stream 4's #1116 (SwiftLint `trailing_closure` on master since #1103) + Stream 5's #1119/#1121 (page-blocks editor accessibility and truth; my device run). It's queued in the heavy slot, saving one full build.
  - **Decisions (per the user's standing instruction):**
    - Composer chip palette (#1122): light keeps every value except Safety Alert's text; dark uses the existing `darkTextColor`; Lost & Found dark ink is amber. New tokens and darker fills were rejected.
    - The "Android HOME chip 4.42" note doesn't reproduce: Android draws 4.57:1. The real defect was iOS dark (3.06), fixed in the branch above.
    - **Disk guard:** the data volume dropped to 14 GiB free at 23:55Z (it recovered to ~80 GiB at 23:57Z when the OS released purgeable space). `heavy-slot.sh` now refuses new acquires under 10 GiB free. Every stream deletes its DerivedData and app/build after copying artifacts.
    - The stale 12 GB `/private/tmp/launchcut-ios-dd` (the feature-flags worktree's cache) is left for the user.
  - **Android Trains U02, in progress** (bundle `20260930-stream1-android-u02-trains-r1`, fixture train `b735c427…`, baseline 23:42:55Z):
    - **TalkBack-level method found:** emulator console touches (`adb emu event mouse x y 0 1|0`) go through TalkBack's touch exploration, while `adb shell input` bypasses it. TalkBack's developer setting at VERBOSE logs every utterance. Scratchpad `tbtouch.sh`/`tbscreen.py`.
    - **First findings on the detail screen:**
      - calendar tiles speak only the number ("8"), not "8, filled";
      - "1" and "of 2 slots covered" are separate stops;
      - the dock says "Sign up for a slot" twice;
      - the Hosted-by row reads its parts twice;
      - weekday initials read "capital S".
- **Update 2026-09-30T23:15Z (Stream 1, new session "Stream 1 resume: Support Trains and merge queue").**
  - Resumed from the 21:55Z handoff (amended 22:22Z). Checked live: master `a211e1f48`, no Stream 1 PR open, only #46/#429/#430/#625 (unrelated) and draft #842 open. Backend :18132 (pid 49108) and proxy :18138 healthy, Next :18139 answering, DB 64562 up. Heavy slot free; device slots 1 and 2 still held by `stream1:`, both devices shut down. Disk at 92% (33 GiB free).
  - Peers online since ~23:12Z: Streams 2, 3, 4 and 5 (new sessions). None has a PR for the queue yet. Stream 4 keeps the native Pulse hero ("All clear on your block today.") as its item 5.
  - **Review page moved:** the old page (WFpmhCwcUyLyakPRLjxJCu) can't be read or updated from this session's account ("not found"), so it's republished at **https://claude.ai/artifact/FQw1gNR2vwNNKw9cGSxsT2** from coordination `2a615b108` (Stream 2's U03 web post edit flip included). Decided per the user's standing instruction: a current page at a new URL beats a stale page nobody can update. `checklists/README.md` points at it; Stream 2 was told to pass the new URL to `gen.py md 2`.
  - Next: T9 (the viewer's own slot listed again under "Already on the train" as "a neighbor"), then Android Trains U02.
- **HANDOFF 2026-09-30T21:55Z (Stream 1), amended 22:22Z after batch 223. Start here.** The resume prompt is [`NEXT-STREAM1-PROMPT-2026-09-30-evening.md`](NEXT-STREAM1-PROMPT-2026-09-30-evening.md).
  - **Queue:** empty. No Stream 1 PR is open, and every sealed peer PR is merged. Master is **`a211e1f48`** (batch 223, 22:20:56Z), and the next batch is **224**. No migrations since `20260930184000`.
  - **Merged this session:**

    | Batch | PR | Time | Contents |
    |---|---|---|---|
    | 218 | #1094 | 21:10Z | #1061 (iOS primaryInk/primarySolid), #1093 (Trains U02), #1075, #1085, #1086, #1088, #1091 (Stream 2), #1087, #1089, #1090 (Stream 5) |
    | 219 | #1095 | | #1092 (Stream 5) |
    | 220 | #1098 | 21:37Z | #1058, #1064, #1065, #1067, #1070 (Stream 3); #1096 web post edit (Stream 2); #1097 (iOS primaryInkStrong sweep) |
    | 221 | #1100 | 21:40Z | #1081 (Stream 5 native crew links/Directions; Stream 1 ran the four device checks) |
    | 222 | #1101 | 21:52Z | #1099 (Trains T7/T8 tiles and status, banner identity chip, Manage chip shade, #1067's Try again ink) |
    | 223 | #1112 | 22:20Z | Stream 4's #1102–#1111: no invented value trend; Place verify actions open the verify sheet; document uploader names; maintenance empty tabs; fridge remove-row name; Android monogram; Android large text; warranties chip AA; civic copy; unchecked weather alerts aren't an all-clear. Seals F `5de362b2`, V `d8e02bba`, U02 `9e375256` |

    - Every head was checked against its seal. build-batch/verify-batch passed for each batch. The stacked #1093 was proved in two steps: master → #1061, then the rest.
  - **Evidence** (all under `.pantopus-recovery/audits/`):

    | Bundle | MANIFEST | Covers |
    |---|---|---|
    | `20260930-stream1-ios-primary-ink-r1` | `3be31394` | #1061 |
    | `-ios-u02-trains-r1` | `819b1c4f` | #1093 and the fixture cleanup |
    | `-ios-u02-stream2-r1` | `e3137445` | #1085 after-checks F1–F8 |
    | `-native-1081-devices-r1` | `a33acbb7` | |
    | `-ios-primary-ink-strong-r1` | `1210fded` | |
    | `-ios-slot-tile-ink-r1` | `087226fa` | |
  - **Checklist:** Stream 1's U02 iOS Trains rows are flipped in `checklists/data_s1.py` (U02 done 6 → 14, including T7/T8 via #1099), and the review page is republished (v11).
    - Android U02 A1–A4 for Trains is still to do. Only T1/T2 were verified on Android.
  - **Runtime** (all Stream 1's):
    - DB `supabase_db_pantopus-stream1-resume-20260923` (64562).
    - Backend :18132 on master `a211e1f48`, pid 49108 at handoff, log `logs/backend-a211e1f48-222110.log` (see `logs/backend-current-log.txt`). The Stripe guard is active.
    - Fault proxy :18138, with no rules.
    - Next dev :18139, served from worktree `stream1-peer-takeover-d2cb25`, now detached at `a211e1f48`.
    - Device slots 1 (`emulator-5558`) and 2 (simulator `A189976E`) are held by `stream1:`. The simulator has candidate `1d6e40d3d` installed, and the emulator its APK.
    - **Both devices were shut down at 22:45Z to free memory.** Installed apps and Alice's sign-in persist. Boot the simulator with `xcrun simctl boot A189976E-697E-4DE7-8EE3-6E355B990FAD`, and the emulator with `~/Library/Android/sdk/emulator/emulator -avd pantopus_s1 -port 5558 -no-window -no-audio -no-boot-anim -no-snapshot-save -crash-report-mode disabled -no-metrics &`, then `adb -s emulator-5558 wait-for-device`.
    - **Resources released at 22:45Z:**
      - my session scratchpad (9.7 GB), including 8 clean session worktrees removed with `git worktree remove` (every branch kept);
      - the old clean worktree `/private/tmp/pantopus-stream1-web-trade` (branch on origin);
      - old app copies in the runtime folder (`ios-builds/`, `preserved-products/`, three APKs);
      - the iOS cache's compiled `Build/`. Its `SourcePackages` and module caches are kept.
    - Small helper scripts were saved to `tools/s1-kit/extra/`.
    - Heavy slot: free.
  - **Fixtures:** none live. The Trains, money and crew fixtures were all removed by exact ids; 350/353 tables equal the 19:33:34Z baseline, and the rest is sign-in bookkeeping.
  - **Peers:**
    - Streams 2, 3 and 5 handed off this evening. Their successors will message the queue owner with sealed heads.
    - Stream 4 is still active; its ten PRs merged in batch 223.
    - Open design question from Stream 4: with nothing known, the native Pulse hero says "All clear on your block today.", and there's no neutral variant.
  - **Next for Stream 1:**
    - Batch whatever the peers send.
    - Recorded follow-ups:
      - **T9:** the viewer's own reservation is listed again under "Already on the train" as "a neighbor" (iOS and Android).
      - About 311 switch-returned `primary600` sites.
      - Android Trains U02 A1–A4 at TalkBack level.
      - Android HOME chip 4.42.
      - The Surgery wizard default.
      - The celebration banner copy.
      - The unscheduled SQL twin `auto_archive_expired_posts()`.
      - Stream 4's launch-cut #8 invented-data findings, for the user's flag decisions.
    - **For Stream 5's backlog:** in the iOS page-blocks editor, the controls are unnamed and the action chips have no Selected trait.

- **Update 2026-09-30T20:33Z (Stream 1).**
  - **Merged:**
    - **Batch 215** (20:10:38Z, PR #1079), **security**: #1076 (Stream 5).
      - Crew page buttons follow the owner's action.
      - The API rejects non-http(s) links. Before, `window.open` ran a stored `javascript:` URL.
      - No Directions to a home-based crew.
    - **Batch 215**, same PR: #1078 (Stream 2), the Place eligibility race.
    - **Batch 216** (20:23:04Z, PR #1083): #1077 (Stream 5), light cards get dark stops; and my **#1082**:
      - dark `--app-surface-sunken` is a step below the surface. That's the last piece of the 09-30 token decision;
      - the AI assistant is themed. #1052's hue flip had left its draft card label at 1.79:1. Seal `813666aa`.
    - **Batch 217** (20:29:26Z, PR #1084): #1080 (Stream 5), the real profile-completion percentage; it no longer console-logs the profile's PII.
    - Master is `e514e033b`.
  - **#1061 (iOS primary ink) is verified on build `7e01e77f2`:**
    - in dark: the tab strip 4.13 → 7.99; dock/Share/"Sign up" fills 4.08 → 5.67; the task "AS" initials 2.74 → 5.67 in both schemes;
    - Start "Sign in" 4.44 → 8.59; the preview's "Save it" 4.13 → 7.99;
    - My trains light is pixel-identical below the status bar.
    - Added since: `273ac93f4` (the list FAB uses the Solid twins: sky 4.08, home ≈1.9 in dark) and `3a0cfbd03` (the Today hero kicker). Both are verified in candidate 1.
  - **In the heavy slot:**
    - **Candidate 1** `63585f622` = #1061 + my Trains U02 branch `ba476f213` + Stream 2's #1075 + F-branch `35a9f5f1c`. iOS app, APK and Android lint.
    - **Candidate 2** `f002e2a9e` = my `primary700` sweep `0862b1a65` + Stream 5's #1081.
  - **My Trains iOS U02 pass** (`20260930-stream1-ios-u02-trains-r1`, before build `5ab430ed2`), found:
    - T1: the organizers stood in as helpers in the signup strip ("1 neighbors", "All neighbors confirmed"). iOS and Android.
    - T2: raw "17:00:00" times in Manage. iOS and Android; Android before-shots are in the bundle.
    - T3: a dimmed "Hosted by".
    - T4: placeholder-only fields: search, wizard, sign-up sheet, Manage.
    - T5: dark Manage chip 2.88 and date line 3.40.
    - The fixes are on branch `codex/trains-u02-a11y-20260930`. The PR comes after candidate 1's after-run.
  - **New sweep:** `primary700` text is about 2.9:1 in dark. A new `primaryInkStrong` token (#075985 / #7dd3fc) covers 78 sites; launch-cut areas are excluded.
  - **Decisions:**
    - Stream 2 builds web post edit (author-only, reusing the composer and `updatePost`).
    - Event and deal dates render in UTC wall-clock on web.
    - Deal auto-archive keeps a deal through its stated day in US Pacific (`+32h`). True instants come after launch.
    - `NearbyProvidersCard` is launch cut #6 (a Pulse entry point into the directory) and stays untouched.
  - **Held for seals:** Stream 3's #1058, #1064 with #1065, #1067 and #1070.
  - **The U02 bundle for Stream 2 is resealed** at `e43f4f13`. The addendum shows F1/F2 are unnamed Buttons (VoiceOver says "Button"), not invisible.

- **Update 2026-09-30T19:32Z (Stream 1).**
  - **Merged** (every seal verified against its PR head; build-batch/verify-batch RESULT OK):
    - **Batch 208** (18:35:23Z, PR #1057): #1036 (Stream 3, Home names at large text) and my #1052 (web hue contrast).
    - **Batch 209** (18:37:55Z, PR #1059): #1040 (Stream 4, native pickup editors send the version they opened).
    - **Batch 210** (18:52:46Z, PR #1063): #1060 (Stream 5, an unpublished business stays hidden from outsiders).
    - **Batch 211** (19:18:22Z, PR #1069):
      - #1051 (Stream 3): the landlord Notices/Settings tabs are hidden (seal `6df5bff9`).
      - #1055 (Stream 5): endorse works and only a verified resident can endorse (`43d8bc14`).
      - #1038 (Stream 2): Today truth and share allowlist (r2 `88bd4642`).
      - #1047 (Stream 2): posts follow-ups (`a67de577`).
      - #1038 and #1047 each added only a test fix since the candidate Stream 1 verified on iOS.
    - **Batch 212** (19:21:59Z, PR #1071):
      - #1062 (Stream 4): Recent activity reads sentences (`6162da25`, `383cbde5`).
      - #1066 (Stream 5): the 14-day endorse rule counts from `verified_at`. Its seal `3498c08b` is at `f1afa2cff`; the merged head `42a46ab58` is a patch-identical rebase (range-diff `=`). Re-sealed at the merged head: `77e1fc82`.
      - My #1056: iOS system dialogs readable in dark mode (`a539f271`).
    - **Batch 213** (19:29:10Z, PR #1072): #1068 (Stream 5): web chat initials on the 700 steps; dark Assistant row (`d752d68d`).
    - **Batch 214** (19:30:23Z, PR #1074): #1073 (Stream 2): Recommendation text #92400E (`a0260faa`).
    - Master is `20e7b4768`. No migrations since `20260930184000`.
  - **Stream 2's U02 iOS pass is done and sealed:** `20260930-stream1-ios-u02-stream2-r1`, 295 files, `3df1ecfb`. It covers 17 screens × light/dark/AX5, with bindings in `source/SOURCE.txt`.
    - Pass: the Pulse feed, post detail, composer and Hub; the Report dialog after #1056.
    - For Stream 2 (taking F1–F3, F7, F8):
      - F1: the Place preview Back is unlabelled, so VoiceOver can't reach it.
      - F2: the Start clear ✕, the same.
      - F3: three fields are named only by their placeholder.
      - F7: refund "Check status" gives no feedback.
      - F8: the Reason picker truncates at AX5.
    - Stream 2 decided F6: the tip sheet gets an opaque surface (the glass put "Not now" at 2.32:1 in dark).
    - F4 and F5 are in my #1061.
    - **Boundary:** Payments & payouts and Wallet sit behind the OS device-passcode prompt, which I don't type into.
    - The fixtures were removed: 350/353 tables equal the baseline, plus auth bookkeeping.
  - **Open, Stream 1: #1061** (iOS primary text readable in dark; head `7e01e77f2`, master merged in, one Colors.swift conflict kept both tokens).
    - Commit `6298d81dd`: five white-initial circles move from primary500 (2.77:1) to `primarySolid` (5.93:1).
    - Commit `4a87a81f7`: 11 multi-line ternary text colours the first pass missed, including the shared ListOfRows tab strip. On the dark card `primary600` is 4.22:1; `primaryInk` is 8.07:1.
    - The verification build is queued in the heavy slot behind Streams 3 and 4.
  - **Held for seals:** #1058, #1064 with #1065, #1067 and #1070 (Stream 3).
  - **Decision recorded (S3-22, Stream 5):** hide the crew page's Directions for home-based businesses; their public point is fuzzed.
  - **Launch-scope note for the user (Stream 4):** four launch-cut #8 mail screens show invented data if reachable in the release:
    - My Mail Day's sample fallback;
    - the Stamps sample wallet;
    - certified mail's "Postmark verified" with no data;
    - the mailbox map's fixed "You are here".
    - Stream 4's fix branches are kept local.
- **Update 2026-09-30T18:35Z (Stream 1).**
  - **Merged:**
    - **Batch 204** (17:57:47Z, PR #1048): #1043, Stream 5. Business Profiles names each business, not the seat.
    - **Batch 205** (18:00:11Z, PR #1049): my #1044, web primary/emerald tints in dark mode plus the Home health and Issues badges.
    - **Batch 206** (18:02:07Z, PR #1050): #1046, Stream 5. One alert per post report; no Home field on the public crew page.
    - **Batch 207** (18:29:47Z, PR #1054), **security**: #1053, Stream 5. A business's private data stays with its team.
      - Before, `GET /api/businesses/:id` gave any signed-in user the business account's full User row: email, phone, address, date of birth, security settings. It also gave the owner's `personal_user_id` and exact home-based locations.
      - The public crew routes leaked exact private home points.
      - **Hosted:** backend-only; ship with the next deploy.
    - Master `60636ee9c`.
  - **Opened by Stream 1:**
    - **#1052**, web contrast phase B. Every raw hue's text 500–950, tints 50/100 and borders 100–300 are theme-aware (the user's decision 3). 320 token-test cases. In dark, error text goes 3.70 → 6.45 and app text on `bg-amber-100` goes 1.11 → 13.02. Seal `e296bbbc`.
    - **#1056**, an iOS dark-mode regression I introduced in #1029. System dialogs drew their buttons in `#0369a1` on the dark pill at 1.57:1: the report reasons, confirmations. Fix: a dynamic `primaryTint` (`#7dd3fc` in dark, 5.57:1) at the root, and the ten white-label `.borderedProminent` fills pinned to `primarySolid`.
  - **Stream 2's iOS cells:** 8/8 done (the comment photo is N/A on iOS).
    - #1038 passes on iOS (seal `aeb2d308`). It's held on a red iOS test-bundle build (`TodayDetailMappingTests` initializers); Stream 2 is fixing it.
    - #1047's four items pass on iOS (seal `47c730f8`).
    - U02 A1–A4 is in progress on the candidate master + #1038 + #1047 + #1056.
      - **A1:** iOS text doesn't grow (the fixed type ramp, a recorded decision), so nothing clips.
      - **A3 dark:** feature-level `primary600` as text or white-text fill reads about 4.1:1: selected tabs, "List"/"All" chips, links, the "Post task" pill. That's the known classification follow-up and becomes Stream 1's next iOS PR.
  - **Routed:** the landlord Notices/Settings tabs call missing routes. Stream 3's #1051 hides them (the 09-23 decision) and waits for its seal.
- **Update 2026-09-30T17:55Z (Stream 1).**
  - **Batch 203** (17:50:15Z, PR #1045): **#1042**, Stream 5's N04 report review queue. Master `1bc136f69`.
    - An admin-only queue at `/api/admin/reports` plus the web page.
    - Alerts carry only kind, category, id and link. No table.
    - DM reports are included; neighbor-message flags are view-only; Marketplace listing reports are left out.
    - Seal `d641c192`.
  - **Opened #1044 (Stream 1):** web primary/emerald 50/100 tints deepen in dark mode. The Home health ring and Issues badges use theme tokens, with the ring on the iOS/Android bands (75/40).
    - Measured in the running app: the Owner chip goes 1.34 → 8.80:1 in dark; app text on `bg-emerald-50` goes 1.18 → 12.28.
    - The token test pins 72 new pairs.
    - Bundle `20260930-stream1-web-dark-tints-r1`, seal `a00532fb`.
    - **Next Stream 1 pass:** raw `text-{red,amber,green,blue,violet}-600…800` on dark surfaces (about 1,100 uses), a token-level design like #979's.
  - **Stream 2's iOS cells:**
    - The comment photo failure is **not offered on iOS**: the composer is text-only, the same as Android (seal `e4825b97`).
    - **Found:** tapping a cold-start "Pantopus" tip (`is_seeded`) opens "Couldn't load this post" (404) on iOS. Android and web wire the same tap. Stream 2 owns the fix: the facts become info cards on all three clients with the existing dismiss.
    - 7 of 8 are done. U02 A1–A4 (11 screens) runs on the next iOS build.
  - **#1038:** head `71cf7309a`, r2 seal `32cf8dfc`. It carries the share allowlist and a decode fix: an `action` object on a signal made the whole Today screen fail on both apps.
    - Stream 1's iOS runtime run is set up: the runtime backend is on batch tip `6a8d904e5` (master plus #1038). Alice has a viewing location (Vancouver) and a synthetic time-sensitive notice.
    - The payload has sunrise 14:07Z / sunset 01:52Z, a `mail` signal carrying an action, and `seasonal` "Smoke season".
    - The iOS build waits for the heavy slot.
  - **#1036:** Android lint/test/assemble passes (Paparazzi against #1029's goldens). Its iPhone SE unit job failed one unrelated timing test, `BlockedUsersViewModelTests.testDuplicateTapAndDelayedReadCannotUndoSuccessfulUnblock` (a request timeout). The job was re-run.
  - **#1040:** Stream 4 fixed the Android 409 loop (`ced76d805`). The r3 seal comes after their device rerun.
  - **Tooling:** `heavy-slot.sh` now exits a waiting acquire on SIGINT/SIGTERM and removes its ticket. It was deployed by atomic rename, and an orphaned ticketless Stream 5 waiter (6h40m) was stopped.
    - **Lesson:** never rewrite a running bash script in place. Bash reads scripts incrementally, so write a new file and `mv` it over.
- **Update 2026-09-30T17:25Z (Stream 1).**
  - **Batch 201** (17:18:42Z, PR #1039): **#1037** (Stream 5, migration `20260930184000`). Master `ed08ad438`.
    - Owners get a seat when they create a business; add-member writes the seat; leaving one business keeps seats at the others; a member of two businesses no longer gets 403.
    - The backfill only inserts, for active team members with no seat binding anywhere. A rerun writes `INSERT 0 0`.
    - Before applying on hosted: run the read-only preview in the migration header. People who already hold a binding are a follow-up once this API is live.
    - Seal `61fefcd1`, verified. The seat tables are service_role-only (checked on Stream 1's DB).
    - Stream 1's DB is now at `20260930184000` (file sha `37120dd8…`, nothing to backfill there).
  - **Batch 202** (17:21:22Z, PR #1041): **#1034** (Stream 2, Android a11y: Start "Sign in", task steps, refund reasons; seals `607283e7`/`1e9293bd`). Master `416898752`. No golden covers those screens, so #1029's goldens can't interact.
  - **Stream 2's iOS cells run by Stream 1: 6 of 8 done, all PASS on master code.** Beyond the three listed at 16:56Z:
    - Edit E1/E2/E5: `20260930-stream1-ios-post-edit-r1`, `4b8ed58a`;
    - Posts L4: `…-ios-posts-session-refresh-r1`, `dd4939ee`;
    - Create E6: `…-ios-create-e6-r1`, `3ee82fc9`.
    - Still to do: the comment photo failure and U02 A1–A4, which need a master iOS build with #1027.
  - **Found for Stream 2** (not changed by Stream 1):
    - iOS My posts → "Write a post" opens only the Ask form (`YouTabRoot.swift:1505` passes `PulseComposeIntent.ask`).
    - The iOS editor refuses a general post with no title ("Title is required.").
  - **Held with fixes requested:**
    - **#1040** (Stream 4, native pickup E5). Android keys `openedVersion` only on the schedule's content, but `pickup_version` hashes rule ids. After a same-content save elsewhere, every retry gets 409 until the screen is left. Fix: key on `pickupVersion` too.
    - **#1038** (Stream 2, Hub Today truth). The Share text joins every Today signal, including private `bill_due`, `task_due`, `calendar`, `mail` and `gig` labels. **Decision:** share only place-level kinds (alert, precipitation, aqi, temperature, seasonal, local_update, address_calendar) on both clients and in the push path. Stream 1 runs the iOS runtime checks on the fixed head.
  - **Waiting on CI:** #1036 (Stream 3, U02 large-text Home repairs). Seal `732b0e5d` is verified and the review passes. It waits for iOS build and Android lint/test/assemble (Paparazzi against #1029's goldens).
  - **N04 "who processes reports" → Stream 5, approved with conditions.** The gap is verified: reports are write-only and nothing reads them.
    - **Decision:** the platform admin processes reports, target within 24 hours.
    - An admin queue plus a web page, reusing the admin-route pattern. No table and no migration.
    - Notifications carry only kind, reason category, id and link.
    - DM reports are included, and ListingReport is out (cut). One-line hooks in posts.js/gigs.js are approved; Stream 2 gets told first.
    - Takedown is a follow-up.
  - **Schema-drift candidates routed** (132 from Stream 5's rebuilt scanner, `builds/schema-drift-scan.txt` in `20260930-stream5-business-seat-writers-r1`):
    - posts.js, trustState.js and public.js (Post/Gig parts) → Stream 2;
    - mailbox*/mailCompose → Stream 4;
    - landlordTenant, homeOwnership, homeSecurityPolicy → Stream 3;
    - offers, marketplace, businessDiscovery, BusinessBooking: none (cut).
    - Candidates only; verify before fixing.
  - **Decision (public crew page badge):** never publish the owner's county or any Home field. If repaired, the route returns only a server-computed "verified resident" boolean. Stream 5 owns it, below N04.
- **Update 2026-09-30T16:56Z (Stream 1).**
  - **Batch 200** (16:54:39Z, PR #1035): **#1029**, the native accents AA plus iOS dark-mode fills. Master `1e1b6bacc`.
    - Light primary600 `#0369A1` / primary700 `#075985` on iOS and Android.
    - The iOS `*Solid` fill twins (new `primarySolid`) are used in the shared buttons and chips and in 11 feature fills.
    - 485 goldens were re-recorded. All native streams were told to rebase and re-record only their own snapshots.
    - Seal `1bdf366a`, including Stream 3's Approve check at 1.92 → 5.48:1.
  - **Stream 2's iOS cells run by Stream 1: 5 of 8 PASS on master code.** Each has a sealed bundle:
    - Hub R1: `20260930-stream1-ios-hub-reads-r1`, `7a50ea0a`;
    - Hub L3/L2: `…-ios-hub-account-switch-r1`, `3280a64f`;
    - Start L2/L3: `…-ios-start-lifetimes-r1`, `be19dced`. iOS sign-out, including Remove account, clears the pending preview, and the Start screen is rebuilt on every sign-out, so iOS has no Android #989-class leak.
    - Next: Edit E1/E2/E5, Posts L4, Create E6, comment photo failure, then U02 A1–A4.
  - **Queue:**
    - #1034 (Stream 2, Android a11y follow-up; seals `607283e7` and `1e9293bd`): waits for its Android CI job, because it changes layout on screens with goldens.
    - Stream 5 has **184000** for the business seat repair: owners get no seat; add-member's seat write is broken; leaving one business unbinds seats elsewhere; users with seats at two or more businesses are locked out. It's a production data backfill, so the PR must say in plain words what rows it creates and rebinds, with a read-only preview query for the founder.
  - **Tooling:** `tools/ios-ui-s1.py private … --chunked` sends 4 characters at a time. Under load, a one-burst password dropped characters, and the login got 401.
- **Update 2026-09-30T16:20Z (Stream 1).**
  - **Batch 197** (16:07:41Z, PR #1031): #1024 + #1028 + #1023. Master `a318010a2`.
    - **#1024** (Stream 3): master's red iOS SwiftLint is fixed.
    - **#1028** (Stream 5, `20260930182000`): authenticated holds no table or sequence privilege; check-migrations refuses authenticated table grants; the chat read policies stop recursing through the caller-only DEFINER helper `is_active_chat_participant`. CI database job green: 67/67 pgTAP files, baseline 6/6.
    - **#1023** (Stream 5): iOS Delete My Account is reachable with the keyboard up. Stream 1 ran it on iOS at `e8a85d6c4`; seal `26bcf241`, bundle `20260930-stream1-1023-ios-delete-keyboard-r1`.
  - **Batch 198** (16:10:38Z, PR #1032): #1027 (Stream 2, U02 a11y for Posts and Hub on Android plus two iOS names; seal `a966aa19`). Master `a60e276bb`.
  - **Batch 199** (16:18:39Z, PR #1033): #1030 (Stream 5, `20260930183000`). Master `f7373d0cd`.
    - EXECUTE revoked on `business_get_user_permissions`, which answered for any user, anon included, and `apply_business_role_preset`, a direct path around the API's role rules.
    - check-migrations refuses client grants of DEFINER functions with an `auth.uid()`-default parameter unless they're reviewed caller-bound helpers.
    - The new `client-rpc-surface` contract pins the client RPC surface: 12 caller-only RLS helpers (the 9 Home helpers, `home_bill_has_finance_permission`, `gig_creator_has_current_authority`, `is_active_chat_participant`) plus 5 trigger functions PostgREST can't call.
  - Stream 1's runtime DB now has 181000–183000, and signed-in API reads return 200.
  - **Open, Stream 1: PR #1029** (native accents AA plus iOS dark-mode fills, head `fb2b71d8c`). Bundle seal `1bdf366a` includes Stream 3's Approve check: 1.92:1 → 5.48:1 on Stream 1's own claim fixture. It waits for its Android CI job (Paparazzi on CI); its iOS lint failure is master's inherited one, cleared since batch 197.
  - **Follow-ups recorded:**
    - iOS feature-level `primary600` fills (about 255 sites, for example the Hub filter chips; 4.10:1 in dark);
    - dark-mode green FABs under white glyphs on Members "Invite member", Owners "Invite owner" and My homes "Add a home" (Stream 3 spotted them);
    - web tint pairs in dark mode and inline hexes (Stream 4's A3 residuals).
  - **Next for Stream 1:** merge #1029, then Stream 2's eight iOS runtime cells, then the web tint/inline-hex pass.
- **Update 2026-09-30T15:45Z (Stream 1).** **Batch 196** (15:25:11Z, PR #1026): #1022 and #1025. Master `8099b65162ba897b3efa3fdc254b51cc56190fd1`.
  - **#1022** (Stream 5, migration `20260930181000`): anon holds no privilege on any public table or sequence. check-migrations now refuses anon/PUBLIC table grants from 181000. my-bid reads the caller's own bid through the service client. CI database job green on `ba22fad27`, including baseline PostgREST 6/6.
    - At Stream 1's review, Stream 5 corrected the migration comment before merge: the anon client is still used by 3 gigs.js routes (launch cut #4 or unused), `routes/offers.js` (its lowercase tables don't exist) and `debug.js` (404 in production).
    - Applied to Stream 1's runtime DB; signed-in reads return 200.
  - **#1025** (Stream 1): 64 logger calls log error codes as `errorCode`. Before, the PRV-09 redactor turned every `code` key into `[redacted]`. Runtime proof: `"code":"[redacted]"` became `"errorCode":"HOME_NOT_FOUND"`.
    - Left on purpose: the join code, the mock postcard code, and 14 launch-cut sites.
    - Bundle `20260930-stream1-log-error-codes-r1`, seal `06cfb207`. This closes the backlog item "redactLogMeta redacts every code key".
  - **Decision (Stream 1, after batch 196): authenticated SELECT default-deny.** Size first, then implement only if the inventory is clean.
    - Stream 5's inventory is clean: no backend user-JWT data path; no Realtime, Storage policies or hooks in the repo.
    - Stream 5 is implementing `20260930182000`. Merge conditions: CI database job green; check-migrations extended to authenticated; hosted note (dashboard Storage policies, hooks, pg_graphql); one signed-in API journey per stream plus direct PostgREST refusals; the finance matrix keeps its coverage through the DEFINER helpers.
  - **In the heavy slot (Stream 1): native accents AA**, branch `codex/native-accents-aa-20260930`, head `fb2b71d8c`.
    - Light primary600 `#0369A1` (5.93:1) and primary700 `#075985` on iOS and Android.
    - Android: 485 Paparazzi goldens re-recorded. A control record with only the two primary values reverted shows 99.98% of changed pixels are the primary shift. The rest predates this branch: the goldens were last recorded before 4c15f4b70's 09-03 token split, inside Paparazzi's 0.1% tolerance.
    - **iOS dark-mode fills:** the label-ink tokens lighten in dark mode, so white text on them measured 1.67–4.10:1 (for example Delete My Account: white on `#F87171`, 2.77:1). A new `primarySolid` token plus the existing `*Solid` twins now fill the shared buttons and chips, and 11 feature sites with white content. Light mode is unchanged by construction.
    - **Follow-up:** feature-level `primary600` fills (about 255 sites; the Hub chips are one) need per-site classification.
  - **Queue:**
    - #1024 (Stream 3: master's red SwiftLint; lint green, build running) goes first.
    - #1027 (Stream 2: U02 Android a11y; waits for its Android job).
    - #1023 (Stream 5: delete-sheet keyboard): Stream 1 verifies it on iOS in this slot hold.
  - **Taken on:**
    - Stream 2's eight iOS runtime cells (ordered: account boundaries, then failures, then create, then U02).
    - Stream 4's web A3 residuals: inline hexes, plus the dark-mode `bg-*-100` tint paired with lightened `text-*-700`, fixed once at the token level. That pass is next after the accents PR.
- **Master** `0c95b18ca` (batch 184, 2026-09-30T13:13:04Z, PR #991: #979 #982 #983 #984 #988 #989 #990; batch 183, 13:04:38Z, PR #987: #985 alone, RLS on for 73 server-only tables, merged ahead of the queue as a security fix; batch 182, 13:03:26Z, PR #986: decision-9 trio #968 (renamed to 172000) + #976 containing #974; batch 181, 12:50:47Z, PR #981: #977 + #978, which drop RLS write policies on chat, account and social tables (`user_update_self` let a signed-in anon-key holder set their own role to admin); batch 180 #970–#973; batch 179 #966 #967 #950; batch 178 #964). Newest migration `20260930173000`. Merged since: batch 188, 13:50:33Z, PR #1004: #980 (My posts failure toasts; iOS Delete had sent nothing, fixed in 06ffc83fb after Stream 1's iOS run), #997 (pickup schedule changed-meanwhile, migration 177000), #999 (scheduled guest passes current), #1000 (check-migrations DEFINER-revoke rule). Batch 189, 13:51:20Z, PR #1006: #1001 (revoke client access to 6 owner-rights views, 178000) and #1002 (revoke SELECT on FileThumbnail, TransactionReview and ReputationScore, 179000). Master `63e409b89`. Batch 190, 13:52:26Z, PR #1007: #1003. Batch 191, 13:57:34Z, PR #1010: #1008 (deleted Homes notify applicants) + #1009 (posts.js off the anon client). Batch 192, 14:16:51Z, PR #1014: #1005 (native Lost & Found contact line + FOUND chip; iOS run by Stream 1), #1011 (PostLike/PostComment SELECT revoke, 180000; hosted deploy order: backend with #1009 first), #1012 (availability checks through the service client), #1013 (Stream 1: Android dialogs/sheets readable in system dark mode). Master `a5f21354a`. Batch 193, 14:27:09Z, PR #1017: #1015 (/health checks the DB via the service client without reading rows). Batch 194, 14:47:26Z, PR #1020: #1016 (archived posts stay in My posts after a reload; iOS run by Stream 1) + #1019 (Stream 1: iOS portfolio delete sends). Master `ed8f7d539`. Open: none. iOS dialog-bug class (found by Stream 1 in #980 and the portfolio): a dialog clears its target on dismissal before `Task { await vm.confirmX() }` reads it, so the action silently does nothing. A static scan of every iOS alert and dialog finds 8 sites: My posts and portfolio (fixed), plus Mail task "Post as Task" (launch-cut #4; server 409), Offers accept/reject/withdraw (launch-cut), and Scheduling availability delete/rename and the templates library (launch-cut #5 / hidden). Recorded, not fixed. Fix shape: `presenting:` + pass the item. Stream 5 native pass: (b) #950 delete-sheet copy verified on iOS and Android; (c) portfolio delete OK on Android, fixed on iOS (#1019); (a) account deletion with a private-setup Home PASS on Android (iOS next). Batch 195, 15:02:29Z, PR #1021: #1018 (4 SQL contracts follow the API-only write model; CI database job success on 54fe24992, run 36731856487). Master `134dfb1ed`. EVIDENCE CORRECTION (batches 185, 187, 189): the "67/67 contracts" lines in #992/#996/#1001/#1002 came from a local run whose Postgres had crashed (the loop recorded basename's exit status). Stream 5 resealed the four bundles with CORRECTION.md: #992 28040cc7→806af1c9, #996 ac9b751b→b7d2cb7d, #1001 561db4f8→184fbe4f, #1002 d2b72eee→0ea52d29. The API/PostgREST probes stand; contract validity is now proven by CI (batch 195). Stream 5 native pass complete: (a) account deletion with a private-setup Home PASS on iOS and Android (bundle 59a816d0), (b) #950 copy (98052602), (c) portfolio (#1019). Stream 5 next: anon SELECT default-deny, migration 20260930181000 reserved, CI-verified.Stream 1 found (while running #980): archived posts vanish from My posts after reload; Stream 2 owns the fix (owner-only include_archived). Stream 1 owns: Android PantopusTheme follows the system into the dark Material scheme while the app tokens stay light (unreadable dialogs); the fix pins the light scheme. Batch 186, 13:24:31Z, PR #995: #994 (check-migrations rule, new public tables must ENABLE RLS in the same file from 174000). Batch 187, 13:27:31Z, PR #998: #996 alone, `20260930176000`, which revokes client EXECUTE on 10 SECURITY DEFINER functions that trusted caller ids (for example any user's chat list with previews). Master `8ed5085bf`. Batch 185, 13:15:43Z, PR #993: #992 alone (REVOKE INSERT/UPDATE/DELETE/TRUNCATE on public from anon and authenticated, plus default privileges; writes only through the API); master `dd8090e17`. Decision recorded 12:52Z: Stream 5 owns DB-access hardening. #985 is done. Next, a grant-level default-deny evaluation for anon/authenticated writes (table lists to owning streams before any PR), and a check-migrations rule for CREATE TABLE without ENABLE RLS. Stream 1 backlog: `redactLogMeta` redacts every `code` key, so no error code reaches the logs (Stream 3's lead).
- **Docker is back but was reset (2026-09-30T05:57Z):** every local stack, the founder's included, was lost with Docker's data; the Android SDK, all AVDs, `~/.gradle` and every iOS simulator runtime and device were deleted too. Stream 1's stack is rebuilt on the same ports with fresh fixtures (Alice/Bob/Dana, original ids and password); backend and web work. Native checks, including #841's last iOS run, wait for the iOS runtime and Android SDK downloads (needs the user's OK).
- **Open PR #841** (`codex/train-native-start-retry-20260929`, head `7ef7d3010`): native Start a train finishes, and a failed or retried launch leaves one train; plus "Household of ?" removed. Android is fully verified; left: one iOS run on the final build (dylib `fd5a402a`: launch, publish-503 retry, double tap), then seal bundle `20260929-stream1-train-native-start-retry-r1` (its `RESULT.md` is drafted with two placeholders; product-delete round-2 train `e5121131` and rediff against the 01:44:29Z baseline) and batch it.
- **Queue:** #843 and #844 merged in batch 135, #846 in batch 136, #848 in batch 137, #850/#851/#852 in batch 138, #854 in batch 139, #856 in batch 140, #858 in batch 141, #860 in batch 142, #862/#863 in batch 143, #865 in batch 144, #867 in batch 145, #869 in batch 146, #871–#874 in batch 147, #875/#877 in batch 148, #879 in batch 149, #881/#883/#884 in batch 150, #882/#885 in batch 151, #888/#889/#890 in batch 152, #892 in batch 153, #894 in batch 154, #896 in batch 155, #898/#899/#900 in batch 156, #902 in batch 157, #904 in batch 158, #906/#907 in batch 159, #908 in batch 160, #912 in batch 161, #841/#910/#914/#915/#916/#917/#918/#919/#920 in batch 162, #922–#925 in batch 163, #927/#928 in batch 164, #930 in batch 165, #931/#933 in batch 166, #935/#936/#937 in batch 167, #939 in batch 168, #941 in batch 169, #944/#945 in batch 170, #943/#947 in batch 171., #948–#967 in batches 172–179, #970–#973 in batch 180, #977/#978 in batch 181, #968/#974/#976 in batch 182, #985 in batch 183, #979/#982/#983/#984/#988/#989/#990 in batch 184. Open: #980 (Stream 2, My posts action-failure toasts; waits on Stream 1's iOS after-run at `bed19b524`, which Stream 2 accepted because that session has no simulator). Stream 1 is verifying its native Start-wizard repair (`d1c97969a`) and sharing-modes repair (`cc32bd5d1`, migration renumbered to `20260930135000`), which ship together. Stream 5's [#842](https://github.com/WangPantopus/skinny-pantopus/pull/842) is a DRAFT — don't batch it until it is verified or the user approves. Unrelated #46, #429, #430 and #625 stay untouched.
- **Parked launch-cut branches** (pushed 2026-09-30 so nothing is lost; no PR by design) belong to Stream 2's cut areas; they are listed in Stream 2's file.

## Scope

- **Support Trains, end to end on web, iOS and Android:** lists and search; Start a train; detail and share link; helper sign-up, cancel and leave; delivery and organizer confirmation; organizer dates; send update and push choice; signups (edit, remove a helper, share the address); pause, resume, back to draft, archive, delete and close; co-organizers; Remind helpers (AI-provider boundary); gift fund on/off (contributions are a money boundary).
- **Coordination for all five streams:**
  - The only merge-queue owner: review each exact PR head and its sealed evidence, build combined batch PRs (`build-batch.sh`, `verify-batch.py`, `lint-batch.sh` in `coordinator-state-2026-09-23/scratchpad/`), and merge with `gh pr merge <batch> --merge --match-head-commit <tip>`. Required CI is off (user, 2026-09-27); CI is informational.
  - The shared hub status: this directory's `README.md` and `docs/PROJECT_HANDOFF.md`.
  - Cross-stream runtime, device and heavy-build conflicts.
- **Release-readiness rows:** G01–G05, O01–O06 and L01–L04. For U05, each stream inventories its own screens and Stream 1 assembles the final release manifest (O04).
- **Launch-scope cuts owned:** none. Support Trains are fully in scope; the former Stream 1's cut areas (#3, #4, #6 and their entry points) went to Stream 2.

## Acceptance rows owned

Copied from the frozen accounting in `former-stream1-gigs-payments.md`; update them here from now on. The hosted, production and real-user parts need the user's environments and decisions.

| Row | Accepted work to preserve | Exact remaining boundary / disposition |
|---|---|---|
| G01 | PR32/34/47 merged; reviewed queue PR192–196 merged serially at fresh exact-head CI (final master `b36d379b2`) | Original Home/payment acceptance rows remain; merge count is not feature acceptance. |
| G02 | Both original payment heads/merge are master ancestors; main index clean, unrelated work preserved | Closed with the dedicated Git evidence bundle. |
| G03 | Final canonical source on master `b36d379b2` ends public230 `20260922023000` → public231 `20260922023100` with no rewrite of applied history. Retained ledger88 is explicitly a candidate ledger (same payment migrations under pre-renumbering versions plus private prototypes). | Reconcile each hosted ledger against the final ordered source. Do not copy retained prototype rows into canonical history. |
| G04 | Complete-schema CI plus a populated Home/payment rehearsal preserving15,232 rows across387 tables and two affected SQL workflows | Final combined queued-forward adoption/deletion dependencies and hosted preservation remain open. Retained private224/228/229 are noncanonical; preserve their original ledger rows and SQL. |
| G05 | Each merged PR passed its own fresh exact-head CI (192–196 run IDs in the current summary). **Aggregate master CI passed every job**: run `35791805610` on `ce690c375` (code `b36d379b2` + docs), including iOS on iPhone SE/16/16 Pro, Android instrumented tests and schema replay. | Current direction: CI informational, one takeover master snapshot already checked (35c5434df/run36316539221success). Do not repeat CI/unit/lint campaigns after every merge; investigate only a concrete application break. Cancelled superseded runs are not acceptance. |
| O01 | Local ledger inventories and preserved migration history | Named hosted environments and their actual ledgers/adoption plans; no historical ledger rewrite. |
| O02 | Bounded owned database restore plus independent local object-byte recovery | Recovery from the actual external file store, production backups and approved recovery objectives. Local bytes do not establish hosted recoverability. |
| O03 | Repository config/secret inventory and local contracts | Actual hosted Auth/Storage/queue/provider configuration and least-privilege checks for the release candidate. |
| O04 | Source/build/flags recorded per accepted milestone | One final cross-client release manifest after integration, including geography and actual deployed worker/schema versions. Can prepare locally; deployed drift needs environment access. |
| O05 | Existing deployment/support/runbook artifacts | Validate exact production routing, certificates, observability, rollback and post-deploy procedure; actual cutover remains a later concrete approval. |
| O06 | Existing debug builds and bounded worker/retention proofs | Distribution signing/store builds and production APNs/FCM plus deployment-sized capacity. Debug simulator success is not store delivery. |
| L01 | Consolidated source/pricing/activation draft in existing release checklist | Account entitlements, AWS sizing/traffic, vendor allowances and founder policy inputs before final priced review. No services purchased. |
| L02 | Local real-provider TEST subjourneys | Approved-provider scenarios and final release-specific Home/Pulse matrix after that bundle. **(LAUNCH SCOPE 2026-09-27: Beacon is out, #1.)** |
| L03 | No production cutover claimed | Approved deployment, actual post-deploy checks and rollback readiness. |
| L04 | No pilot/product-market fit claim | Consenting users, pilot outcomes and fixes from real usage after readiness. |
| U02 | Sep28 iOS Post body/composer fixed text reproduced at largest Dynamic Type; [20-file7cb37839 evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260928-stream1-ios-post-accessibility-r1/RESULT.md), presentation change REJECTED by the user 2026-09-29T18:29Z (keep the current layout; accepted as-is). No code change/full contrast claim. Sep27 #667 bounded Android Post comment repair accepted at default/2×font/light-dark with preserved frame; actual Chrome keyboard and487px narrow viewport,52-file6d337d63…. Full matrix remains partial. Workflow-level visual checks. **Sep22 Android payment screens** (payment card, refund sheet, tip sheet) at font scale 2.0 and in dark mode: all reflow and stay usable. A dark-mode **tip-sheet contrast defect** (title nearly invisible) is repaired and merged in PR198 (`6f3436bf3` → `4cc024ba3`, exact-head CI `35795454198`; light mode pixel-identical, dark legible). Audit `20260922-stream1-u02-android-payment-a11y-r1`, MANIFEST `26ca2ea8…b33b`. | Remaining reachable-screen large text/zoom/keyboard/screen-reader/contrast/dark-mode matrix. Layout proposals needing design approval: the "WINNER" badge squeezes at 2.0, and task-progress labels break mid-word. Other GigDetail sheets may share the dark-mode pattern (not exercised). |
| U03 | Sep29 #789 (batch114) native Manage → Delete leaves the deleted train's dead detail and lands on a re-read My trains / Train search on actual Android 5558 and iOS C2 (list, search, lost-reply retry: Android manual, iOS automatic), 70-file `0f1bb844…`, 11 Trains exact cleanup. Sep29 #787 (batch113) native My trains/search chips truthful for paused/completed/archived on actual Android 5558/iOS C2, 34-file `5e9b44cf…`, exact cleanup. Sep29 #783 (batch111) Support Train pause/resume/unpublish/archive/delete committed-lost reply → retry now acknowledged on actual Android 5558 (5 commands), iOS C2 (pause, auto-retried delete) and Chrome (delete); API 18/18, 9 Trains cleaned, 19 fingerprints equal; 108-file `a8db546c…`. Co-organizer/nudge unverified. Sep29 #718 (batch109) Post create committed-lost reply → manual retry keeps one Post on actual Chrome, Android 5558 and iOS C2, with changed payload 409 and concurrent sends one row; its create-retry fingerprint is now keyed so viewers cannot confirm hidden tagged places (0/401 guesses). 49-file `b916f286…`; photo cases reuse 263-file `6535202a…`; one trashed C2 Photos asset awaits local authentication. Sep28#778 native per-updatepush301-file7915aa9b: bothnative503/lost201/duplicate/changed-setting409/malformed-choice/recovery;72whole-row checks, exact16scopes0/18hashrestore. No physical/provider claim. Sep28#776 header108-file16d79acc reuses unchanged sealed real native error/Retry/empty;36full-row read equalities/16scopes0/18hashrestore. Sep28#774 native elapsed-coverage repeated503/real Try again/recovery/Cancel accepted278-filea335aabc;83 valid scoped full-row comparisons,16chat placeholders excluded,32scopes0/18hashrestore. Driver/setup limits explicit. Sep28#771 native distinct-helper repeated503/malformed-read/recovery/Cancel accepted within207-filee95cb74f;72 full-row equalities,16 scopes0/18 fingerprints restored. iOS malformed Close and numeric command toast excluded. Sep28#767 native count503/malformed/read recovery and Cancel/no mutation accepted,175-filee864bdd2/26 bindings/72 full-row equalities;16 scopes0/18 hashes restored. No web-equivalent count or unreachable Android Review acceptance. Sep28#765 native Close & thank repeated failures/malformed replies/actual timeouts/original retry/pending duplicate accepted;342-file8094e494/19 bindings/125 full-row checks; Chrome read parity,48 scopes0/18 hashes restored. Exact source/driver/provider limits in seal.  Sep28#762 native Send update repeated503/malformed201/lost201/originalretry/pendingduplicate accepted,206-file735d2c8c/15bindings; Chrome helper readback;16scopes0/18hashrestore. Provider/push/edited-draft cases remain explicit; Close-and-thank accepted separately by#765 within its limits. Sep28#759 native date Add/Edit503/malformed/lost201/originalretry/duplicate/discard/localdate/cold accepted,441-file906a79fb/22bindings; AndroidRemove affected-route503/retry, Chrome read parity. Exact16scopes0/18hashrestore; driver/abandoned-draft/concurrency/timezone/guest/provider limits explicit. Sep28 organizer removal verification-only119-fileaa5e: both native Cancel/503/lost200/retry/pending duplicate/cold, Chrome roster/reload;42fullrow checks,16scopes0/18retainedhashes restored. #747 address-sharing179-fileb9bcc: bothnative repeated503/lost200/retry/pendingduplicate/helpercold/Leave withdrawal; Chrome per-helper privacy/reload/truthful copy. Exact limits in seals. Sep28#741 actual iOS organizer signup edit503/lost200/retry/duplicate/invalid/discard/stale409/refresh/clear/helper403 accepted;156-file0226862e/21bindings,17ownedscopes0/18retainedhashes restored. Web/Android read parity/no Edit affordance; broader scope explicit. Sep28#733 native helper delivery/organizer confirmation repeated503/lost200/manual retry/persistence accepted,123-file5dae628e/49bindings; web read-only parity;16 owned scopes0/18 retained hashes restored. Sequential retry only; guest/concurrent/partial event-slot/provider boundaries remain. #730 main-entry503/404/retry accepted73-file9ce52fb8, no fixture/mutation. Sep28#725 bounded organizer nonempty/read503/recovery/cold accepted on actual Chrome/iOS/Android;104-file446d7678/30bindings, exactTrain/referral cleanup and17pre-run fullhashes restored. No other organizer-command/delivery/provider acceptance. Sep28#720 Train meal signup503/lost201/retry accepted on Chrome/iOS C2/Android5558, native cancellation503/lost200/retry/cold;131-file0ca6a015/16bindings, exact Train/3slots/4reservations/chat/8notices0 and17fullhashes restored. Web has no helper cancel; no delivery/edit/guest/funds/concurrency acceptance. Sep27#699 later-draft/reply-cancel/repeated503/retry accepted across all clients,107-filec9b5f951 and exact15comments/post cleanup. Sep27#691 image deletion/lost-delete and #695 target lifetime accepted in91-file6c65bbad/107-fileec69319a seals. Recorded per-workflow checks; Sep27 #671 plain-text Post comments: actual web/iOS/Android committed-lost-reply recovery, Android overlapping retries/new identical intent, repeated iOS503 and exact cleanup (113-file1bf8a689…) | Apply missing cases to each actual affected client; PR193/196 booking receipt/cancellation failures are now repaired within their recorded scopes. No claim of all-app edge-case coverage. |
| U04 | Sep29 #789 native lists re-read after a delete (Android on return; iOS via `supportTrainDeleted`); iOS non-delete staleness after a two-level/Search/deep-link return remains open. Sep29 S3 #785 (batch112) web stale session: one refresh and at most one sign-out across invalid/revoked/valid/transient cases, 52-file `799180dc…` (reusable). Sep28#778 bothnative cold read/persisted channel choice, same-command retries preserve single notice;301-file7915aa9b. Web tab19-filedbadacae settled/reload verified without code change,150ms transition qualified. Sep28#776 bothnative cold headers same-date1/different-date2;108-file16d79acc, no clock-change claim. Sep28#774 real native cold reads show correct empty/future/current/finished coverage;278-filea335aabc. No clock-change or early-completed-history claim. Sep28#771 actual native cold reopening preserves distinct helper counts1/2/1/0 after fixture changes;207-filee95cb74f. No command-durability or account-race claim. Sep28#767 actual native cold reopening restores correct delivered count;175-filee864bdd2. Count-only scope, no command durability claim. Sep28#765 actual iOS/Android cold completion and Chrome helper Updates/reload pass;342-file8094e494. No abandoned uncertain-command durability claim.  Sep28#762 cold native sender/detail and Chrome full Updates/reload pass,206-file735d2c8c; no full native update feed or abandoned-draft/account claim. Sep28#759 actual final iOS/Android cold reads preserve saved dates; Chrome calendar/reload parity,441-file906a79fb. No abandoned-editor or process-death command identity promise. Sep28 organizer removal119-fileaa5e preserves canceled roster/open slots across actual native cold restart; address-sharing179-fileb9bcc preserves helper address across cold restart and withdraws after actual Leave. No in-flight account or durable-draft claim. Sep28#741 actual iOS cold saved fields/assigned arrival/cleared note persist, restored Alice after Bob denial;156-file0226862e. No in-flight account-change/durable-draft claim. Sep28#733 iOS helper process-reopen and Android organizer process-reopen preserve completed Train results;123-file5dae628e, no pending-command account/process guarantee. Sep28 #709 whole-post image deletion manual web/Android and automatic iOS lost-reply retry/cold absence accepted119-file214a; all owned5Posts/onecomment/File/21objects0. Broader upload/concurrency limits remain. Sep28 iOS Post unsent draft survives actual Settings background/foreground and size/theme change; cold return discards in-memory text without a Send. [20-file7cb37839 evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260928-stream1-ios-post-accessibility-r1/RESULT.md); no durable-draft promise. Sep28 ordinary Post account isolation accepted on actual Chrome/iOS/Android,46-file3f832a8c, exactPost/3comments0/full retainedhashes equal; no old-subscriber or durable-unsent promise. Sep27#699 preserves later pending drafts on actual web/iOS/Android,107-filec9b5f951; account/process-death unsent retention remains open. Sep27#695 web panel target-generation repair and unchanged native delayed-read/write navigation/cold persistence accepted,107-fileec69319a; account/process-death drafts remain open. Sep27 #671 all-client Post comment persistence after reload/cold reopen (113-file1bf8a689…); successful late old-account Hub200 after real logout/login accepted on Chrome (23-file79e9382e…), full cache/native lifetime remains separate. Accepted Home/account-switch and session lifetimes; Sep27 #667 actual Android deep-linked Post draft survives font/theme recreation, cold/warm new links and Back pass (52-file6d337d63…); #648 native Not-you lifetimes reused unchanged | Remaining multi-client foreground/background/cold-process and concurrent-account journeys; no process-death draft retention promise accepted. Physical-provider receipt is only one separate boundary. |
| U05 | Existing screen and action catalogs | Final integrated release-build inventory on all three clients after repair integration; keep every unfinished reachable action explicit. **(LAUNCH SCOPE 2026-09-27: exclude the flagged-off screens; see the shared cut table.)** |

For the shared U rows, Stream 1 owns only the Support Trains cells (checklist below) and the U05 assembly; Stream 2 owns the rest.

## Open work at the split

1. **PR #841** — the final iOS run, seal and batch (see CURRENT STATE). Then flip the U03 Start-a-train native cells to done.
2. **Train lists R1/R2 (iOS and Android) — candidate, reproduce first.** `SupportTrainsViewModel` on both apps shows the error state only when *both* the "My trains" read and the Nearby read fail. If only "My trains" fails (Nearby succeeds or there's no location), the tab shows its empty state ("No support trains yet"), and a failed Nearby read clears the rows into "No trains nearby right now". Reproduce with a fault-proxy rule on `GET /api/activities/support-trains/me/support-trains`, then repair in place (per-source failure → that tab's error with Try again).
3. **The checklist's other to-do cells** (below): detail R1 (iOS); helper E3 and delivery E3 (both apps); organizer dates remove E1/E2; lifecycle E1/E3 (and iOS E2 for resume, back to draft and archive); co-organizers E1–E5; gift fund E1–E3; U04 L1/L3/L4; native U02 on six screens and the web Signups tab.
4. **Observations to confirm:**
   - iOS: after a non-delete change (for example Pause from Manage), Back to a deep-link-pushed list or from Train search can show the old state (inventory; delete is covered by `supportTrainDeleted`).
   - ~~A signed-in non-organizer can open a *draft* train's detail by its id~~ — **confirmed and fixed in #883** (batch 150): a draft or back-to-draft train is closed to link and invite readers, signed out included, matching the apps' "neighbors stop seeing it".
   - ~~Web Start: after "Edit manually", the "Every dinner" preset shows as selected while no weekday is~~ — **confirmed and fixed in #890** (batch 152). The preset chips' missing `aria-pressed` is fixed in #892 (batch 153).
5. **Boundaries:** Remind helpers needs an AI provider (Send appears only after an AI draft); gift-fund contributions move money (never run them).
6. **Needs the user:**
   - Restart Docker Desktop (and, optionally, remove the 03:33Z local snapshot).
   - Web Manage "Send invite" delivers nothing. Recommendation: hide it on web and keep Copy link, the path iOS and Android use.
   - The app-wide design-token decision (5 of its 12 checklist cells are Stream 1's web A3 cells).
7. **Coordinator:** review and batch #843; keep #842 out of batches; post each batch in `README.md`; route Stream 2's PRs through the same review.

## Runtime and devices (Stream 1 keeps the former Stream 1's)

- **Runtime** `/private/tmp/pantopus-stream1-runtime-20260925`: backend **18132** (`start-backend.sh`; stop it with SIGINT only), fault proxy **18138** (`fault-proxy.cjs`, `tools/fp.sh`), Next **18139** (`start-web.sh`). Helpers: `api.py`, `q.sh` (read-only SQL), `snapshot.sh`, `seal.py`, `tools/verify-bundle.py`, `tools/android-login.py`, `webcap.mjs`, `a11ycap.mjs`, `build-ios-held.sh`, `build-android-static.sh`. Database stack `pantopus-stream1-resume-20260923` (Kong 64561, Postgres 64562).
- **Worktrees:** PR branches in `stream1-peer-takeover-90c36e`; the runtime runs `stream1-peer-takeover-d2cb25` (at the split: `verify/train-native-start-20260930` = `7ef7d3010`).
- **Devices:** slot 1 = iOS simulator C2 (`C2BCF36A-F300-48C1-9BA7-876CA9F61E55`), slot 4 = Android `emulator-5558` (AVD `Pantopus_Stream1_Start_R2`). Stream 2 may borrow them through `device-slot.sh` leases until it has its own; announce every hand-over with exact times.
- **After Docker returns:** check the stack, restart the backend if needed, and sign the Android fixture in again (`tools/android-login.py alice`; its session ended at 03:29Z when the refresh failed during the outage). Check focus before typing any credential.
- **Leases:** `zsh /private/tmp/pantopus-tools/device-slot.sh …` and `bash /private/tmp/pantopus-tools/heavy-slot.sh acquire "stream1: <purpose>"` (one argument). One heavy native build at a time across all streams.

## Hard limits (unchanged, verbatim where given)

- "Do not modify the protected primary checkout for Stream 1 work." Never touch founder 64521/64522, backend :8000 or simulator EB5AD759.
- "Keep credentials, raw tokens, database archives, and operator logs out of Git and chat." Never dump the fixture credentials file; redact its path in bundle copies of runners.
- "Respect the no-capture money boundary, no-founder/no-hosted/provider boundary, and no physical-device boundary." Stripe TEST only, no capture.
- "Acquire exact runtime/device/heavy-build leases before use. One heavy native build at a time."
- "Use only owned synthetic fixtures and clean them completely."
- "As coordinator, preserve peer work and review exact PR heads before merging. Do not merge unrelated PRs."
- "Do not claim whole-Train, whole-Posts, whole-payment, full-client, provider, hosted, physical-device, or launch-ready acceptance from a bounded result."
- No bare stash, gc, maintenance, repack or worktree removal. Times from `date -u`, SHAs from `git rev-parse`; never estimate them.
- Launch-cut features: never verify, test or fix them. Design changes need the user's approval (AGENTS.md); otherwise follow the recommendation and record the decision.

## Stream 1 exit checklists (U02–U04) — split from the former Stream 1 on 2026-09-30, updated 2026-10-01T13:45Z

**Stream 1: Support Trains and coordination.** Review page: https://claude.ai/artifact/FQw1gNR2vwNNKw9cGSxsT2. This section is Stream 1's canonical copy; progress is tracked here only.
These rows came from the former Stream 1's approved checklists (2026-09-29). With the other stream's section they add up exactly to the pre-split totals; the reconciliation is frozen in `former-stream1-gigs-payments.md`.
Legend: ✅ done (sealed evidence) · ❓ confirm from existing evidence before any rerun · ⬜ to do · 🔷 user decision · ⛔ named boundary · – not offered on that client.
A row closes when every client cell is ✅, –, ⛔ with its named boundary, or 🔷 decided. Anything found broken gets the smallest fix with real-app before/after evidence and exact cleanup; visual changes go to the user first.

**U03 edge cases** — E1 server error; E2 lost reply; E3 double tap; E4 not allowed; E5 changed meanwhile; E6 bad input; R1 read failure; R2 empty.

| Workflow | iOS | Android | Web |
|---|---|---|---|
| **Support Trains** | | | |
| Train lists and search (My trains, Nearby, Invitations, search) | ✅ E5 (#789)<br>✅ R1 an injected 500 shows Couldn't load the list with Try again, which recovers; R2 Invitations empty state, Nearby asks for location (5a740586) | ✅ E5 (#789)<br>✅ R1 an injected 500 shows Couldn't load the list with Try again, which recovers; R2 Invitations empty state, Nearby asks for location (f439d4b5) | ✅ R1 (#662)<br>✅ E5 (#783)<br>✅ R2 (#662) |
| Start a train (Wizard: create and publish) | ✅ E6 recipient search and no match (Sep23 Train UX)<br>✅ E1 failed step deletes its draft; E2 lost create reply reuses it; E3 double tap makes one train (#841, f98672ab)<br>✅ E4 lost publish reply keeps the live train and shows it launched; E5 the next launch opens it (#1352, c6919ebd) | ✅ E6 recipient search and no match (Sep23 Train UX)<br>✅ E1 publish 503 retry, E2 lost create reply, E3 double tap: each ends with one train (#841, f98672ab)<br>✅ E4 lost publish reply: the re-sent publish answers 200 and the train stays live (#1352, c6919ebd) | ✅ E1 failed publish removes its draft (#817)<br>✅ E3 double-click publish; E6 missing fields (U03 web bundle bbdbf2d2)<br>✅ E6 Edit Manually selects the preset's days (#890)<br>✅ E2 lost create reply reaches the same draft (#836)<br>✅ E4 lost publish reply keeps the live train and opens its page (#1352, c6919ebd) |
| Train detail and share link | ✅ E4 share link and privacy (Sep24)<br>✅ E5 (#789)<br>✅ R1 an injected 500 shows Couldn't load support train with Try again, which recovers; no partial train (5a740586) | ✅ R1 E4 (Sep24)<br>✅ E5 (#789) | ✅ R1 E5 on Manage (Sep28)<br>✅ E4 public page privacy (Sep24, PR402)<br>✅ E4 a draft or back-to-draft train is closed to its link (#883)<br>✅ R1 on detail (U03 web bundle bbdbf2d2) |
| Helper: sign up, cancel, leave | ✅ E1 E2 sign up and cancel (#720)<br>✅ Leave (#747)<br>✅ E3 double tap on Confirm signup (also with the reply held) and on Leave slot: one request each (f161eeee)<br>✅ E4 greyed button with the reason on non-live trains (#811) | ✅ E1 E2 sign up and cancel (#720)<br>✅ Leave (#747)<br>✅ E3 double tap on Confirm signup (normal and held) and on the Leave slot dialog: one request each (e5894f97)<br>✅ E4 greyed button with the reason on non-live trains (#811) | ✅ E1 E2 sign up (#720)<br>– Cancel and leave not offered<br>✅ E3 double-click sign-up (U03 web bundle bbdbf2d2)<br>✅ E4 greyed button with the reason on non-live trains (#811) |
| Delivery and organizer confirmation | ✅ E1 E2 E5 (#733, Sep28)<br>✅ E3 double tap on Mark delivered, Confirm delivery and Manage's Confirm delivery, reply held: one request each (d440ae05) | ✅ E1 E2 E5 (#733, Sep28)<br>✅ E3 double tap on Mark delivered, Confirm delivery and Manage's Confirm delivery, reply held: one request each (e5894f97) | – Read-only on web |
| Organizer dates: add, edit, remove | ✅ Add and edit: E1 E2 E3 E6 (#759)<br>✅ Remove: E1 503 keeps the date and the retry removes it; E2 lost reply, the retry is a safe no-op (8a6f0b6d) | ✅ Add and edit: E1 E2 E3 E6 (#759)<br>✅ Remove: E1 (#759)<br>✅ Remove: E2 lost reply, the retry is a 200 no-op and the list is truthful (Remove cancels the date by PATCH) (a9bd2b8b) | – Calendar is read-only on web |
| Send update and push choice | ✅ E1 E2 E3 (#762)<br>✅ Push choice (#778) | ✅ E1 E2 E3 (#762)<br>✅ Push choice (#778) | – Updates are read-only on web |
| Signups: edit, remove helper, share address | ✅ Edit: E1-E6 (#741)<br>✅ Remove: E1 E2 E3 (Sep28)<br>✅ Address: E1 E2 E3 E4 (#747) | ✅ Remove: E1 E2 E3 (Sep28)<br>✅ Address: E1 E2 E3 E4 (#747)<br>– Edit not offered | ✅ Roster and per-helper privacy (#747)<br>– Edit, remove, address are app-only |
| Pause, resume, back to draft, archive, delete, close | ✅ E2 pause and delete (#783)<br>✅ E5 after delete (#789)<br>✅ Close: E1 E2 E3 (#765)<br>✅ E1 E3 pause, resume, back to draft, archive, delete; E2 resume, back to draft, archive: one request each, retries are no-ops (7e842b1f) | ✅ E2 all five (#783)<br>✅ E5 after delete (#789)<br>✅ Close: E1 E2 E3 (#765)<br>✅ E1 E3 pause, resume, back to draft, archive, delete: one request each (42c3f579) | ✅ Delete: E2 E5 (#783)<br>✅ Delete: E1 E3 (U03 web bundle bbdbf2d2)<br>– Close, pause, resume, back to draft, archive not offered |
| Co-organizers (People picker (approved)) | ✅ Picker add, remove, empty state, invite share (#812)<br>✅ E1 E2 E3 E4 E5: retries are upserts or no-ops, one request per double tap, a co-organizer sees no add or remove (c3bf7bcc) | ✅ Picker add, remove, empty state, invite share (#812)<br>✅ Remove no longer crashes the app (#813)<br>✅ E1 E2 E3 E4 E5: retries are upserts or no-ops, one request per double tap, a co-organizer sees no add or remove; OkHttp re-sends a POST after a dropped connection (safe here) (0ba9c231) | – No co-organizer editor on web |
| Remind helpers (Nudge draft and send) | ⛔ Needs an AI provider | ⛔ Needs an AI provider | ⛔ Needs an AI provider |
| Gift fund: turn on, turn off | ✅ E1 E2 E3: one request per double tap, honest lost-reply error, idempotent retry; goal stored in cents (0b082b86)<br>⛔ Contributions move money | ✅ E1 E2 E3: one request per double tap, honest lost-reply error, idempotent retry; goal stored in cents (6e5cc551)<br>⛔ Contributions move money | ✅ Turn on from Start a train; the pages follow on/off; a failed fund step removes the draft (#877)<br>– Turning it off or on later is app-only<br>⛔ Contributions move money |

**U04 lifetimes** — L1 background and return; L2 cold restart; L3 switch account; L4 session refresh.

| Area | iOS | Android | Web |
|---|---|---|---|
| Support Trains (Lists, detail, Manage, signups) | ✅ L2 (#733-#778)<br>✅ L1 typed text survives background and return: sign-up sheet details, Manage update draft, Start short note (a8bf8e36)<br>✅ L3 switch account: nothing of the previous account in My trains or train pages (0f496730)<br>✅ L4 expired-token 401 on a signup and Send update: refresh, one replay, one row each (0f496730) | ✅ L2 (#733-#778)<br>✅ L1 Manage update draft, sign-up details and Start short note kept across Home and return (8d76b60a)<br>✅ L3 switch account: nothing of the previous account in My trains or train pages (8d76b60a)<br>✅ L4 expired-token 401 on a signup and Send update: refresh, one replay, one row each (8d76b60a) | ✅ L2 reload (Sep28)<br>✅ L4 (#785)<br>✅ L3 switch account: nothing from the previous account shows (20260930 web switch 73f2bc13) |

**U02 accessibility** — A1 largest text; A2 dark mode; A3 contrast; A4 screen reader; A5 keyboard (web).

| Screen | iOS | Android | Web |
|---|---|---|---|
| **Support Trains** | | | |
| My trains, Nearby, Invitations | ✅ A1 A2 A4; A3 selected tab and FAB fixed in dark (#1061) (#1061, #1093, 054245b5) | ✅ A1 A2 A3; A4 tabs say selected, rows read once (#1211, ac43ecdb)<br>✅ A4 shared ListOfRows tabs, FAB and top-bar action, and every PantopusButton, read once (Stream 4) (#1354, d52978cb) | ✅ A1 A2 A4 A5; chip contrast fixed (#814)<br>✅ A3: 0 axe contrast findings light and dark (AA accent utilities) (749e0d21) |
| Train search | ✅ A1 A2 A3; A4 search field named (#1093, 054245b5) | ✅ A1 A2 A3 A4: field named, results read once (#1211, ac43ecdb) | – No Train search on web |
| Train detail and sign-up sheet | ✅ A1 A2; A3 Hosted by at full strength; A4 sheet fields named; signup strip truthful (#1093, 054245b5)<br>✅ A3 covered slot date tiles (T7) and A4 card status (T8) fixed (#1099, 087226fa) | ✅ Detail: A1 legend wraps, times and end date kept, pills grow, names ellipsize; A2; A3 (HOME 4.57, the 4.42 was the scanner); A4 day states, one-stop cards, no repeats (#1211, ac43ecdb)<br>✅ Sign-up sheet: A4 options are radio buttons with their state, Back/Next/Review/Confirm are buttons, fields named by their labels, review rows one stop; A1 wraps at 2.0 with nothing cut; A2; A3 only the disabled Next and the scrim (#1239, f6db8244)<br>✅ Sign-up sheet keeps its draft through rotation, dark mode and font changes: held outside the sheet, one per opening (#1262, 96676bc0) | ✅ A1 A2 A4 A5; dark selection fixed (#814)<br>✅ A3: 0 axe contrast findings light and dark (AA accent utilities) (749e0d21) |
| Start a train | ✅ A1 A2 A3; A4 recipient and short note named (#1093, 054245b5) | ✅ Step 1: A1 A2 A3; A4 reason tiles selected, fields named (#1211, ac43ecdb)<br>✅ Steps 2-5: the shared WizardShell CTA reads once; the title gets its own row from 1.3x text (Stream 4) (#1354, d52978cb) | ✅ Step 1: A1 A2 A3 A4 A5; dark selection fixed (#814)<br>✅ Later steps: A1 A2 A4 A5; field and weekday names added (#829)<br>✅ Schedule shortcuts expose their chosen state (A2) (#892)<br>✅ A4 story field, restriction chip remove buttons and special instructions named (#1239, f6db8244)<br>✅ A3: 0 axe contrast findings light and dark (AA accent utilities) (749e0d21) |
| Manage train | ✅ A1 A4; A2 A3 chip and date line fixed in dark; times formatted (#1093, 054245b5) | ✅ A1 stat labels whole (default-size clipping fixed), pills grow; A2; A3; A4 Back, tiles, field, switch and chips named with state (#1211, ac43ecdb) | ✅ A1 A2 A4 A5; share-link label added (#814)<br>✅ A3: 0 axe contrast findings light and dark (AA accent utilities) (749e0d21) |
| Review signups, edit signup | – Not reachable on iOS since 70d2a8822: organizers manage signups in Manage (covered there) | – Not reachable on Android: the route has no caller or deep link; organizers manage signups in Manage (covered there) (4b48bf0a) | ✅ Signups tab: A1 A2 A4 A5 (20260930 web a11y 73f2bc13)<br>✅ Signups tab A3: 0 axe contrast findings light and dark (AA accent utilities) (749e0d21) |
| Updates and details tabs, calendar | – Web-only screens | – Web-only screens | ✅ A1 A2 A4 A5; calendar button names added (#814)<br>✅ A3: 0 axe contrast findings light and dark (AA accent utilities) (749e0d21) |

**Outside this plan:** Remind helpers: Blocked until an AI provider is available: Send only appears after an AI draft. U01 and U05: U01 has no cells in either stream (it belongs to the former Stream 2). U05 starts once your launch flags are on master: each stream inventories its own screens, and Stream 1 assembles the final release manifest.

**Decisions:** (1) Approved 2026-09-29: these checklists, the greyed sign-up button (merged, #811), and the people picker for co-organizers (merged, #812). [both streams] (2) Co-organizer email invites: not now (my recommendation; the existing share link covers people not on Pantopus). (3) Open for you: one design-token decision for every accent under AA's 4.5:1. That covers white on primary-600 (4.09:1) and primary-600 text on greys (3.8-4.35:1); emerald-600 fills and text (3.51-3.77:1); and the post-type accent fills with white text, meaning avatar initials, the composer's submit button (amber-500 is 2.15:1), the active feed-filter chips (2.15-4.23:1) and map pins. Stream 2 adds the header badge (3.76) and the Members tab (3.52). My recommendation: one step darker per fill, keeping each hue (primary-700 is about 5.9:1). It's app-wide and visible, so it needs your approval. [both streams] (4) Open for you: web Manage 'Send invite' delivers nothing. Email invites have no sender, and user-id invites on a live train notify no one. My recommendation: hide Send invite on web and keep Copy link, the path iOS and Android already use.

- U03 items: done 75, confirm from existing evidence 0, to do 0, your call 0, boundary 6, not offered 9
- U04 items: done 11, confirm from existing evidence 0, to do 0, your call 0, boundary 0, not offered 0
- U02 items: done 30, confirm from existing evidence 0, to do 0, your call 0, boundary 0, not offered 5

## History

Everything before the split — every batch, bundle, decision and lesson of the former Stream 1 — is in [`former-stream1-gigs-payments.md`](former-stream1-gigs-payments.md) (frozen) and the living inventory `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260925-stream1-domain-inventory-r1/INVENTORY.md`, which Stream 1 keeps for Support Trains and coordination rows from 2026-09-30 (Stream 2 keeps its own inventory).
