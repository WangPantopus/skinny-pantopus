# Three-stream coordination

> **▶ START HERE:** [`HANDOFF-2026-09-23.md`](HANDOFF-2026-09-23.md) — full end-of-session handoff (all three
> streams, the pushed-but-no-PR P04/P05 fee work, the queue, and the search-filter security area the next agent
> must NOT resume). The blocks below are the running history it summarizes. Read the 06:52 block first; it
> records what the next coordinator session (`92cc4526`) did with the handoff.

## CURRENT RESUME POINT — September 23, 2026, 11:34 UTC (coordinator session `92cc4526`)

This updates the 11:01 block below; read both.

### Count: **13 closed / 67 partial**
P04 and P05 closed at 11:2x UTC, after the fee merged:
- #253 → `1d791906c`;
- #254 → `63953ccd8`;
- bundle r2, MANIFEST `57092fbf…`.

### Merged since the last block
- #254 (fee line on the clients).
- **#288:** magic post works again. `task_format` defaults to `in_person`, and the web composer shows a failure instead of swallowing it.
- **#294:** the classic web post form accepts empty optional fields.

### Queue
296 297 255 278 280 283 291 290 289 221 236 219 214 215 224 199 208 251 252 257 279 262 264 287 266 285 286.
Core-flow and security fixes go first.

### New PRs
- **#296 (Stream 2):** `GET /api/gigs/:id` resolves the viewer through `optionalAuth`.
  - Before: web cookie sessions were anonymous there, so the owner's edit form lost the exact address and Save failed with "Please choose an exact address".
- **#297 (Stream 2, security):** posting from a Home requires `home.view`.
  - Before: strangers and moved-out members could tag any Home, and the task appeared on that household's list.
- **#298 (Stream 2, privacy):** `GET /api/gigs`, `/in-bounds` and `/browse` use `optionalAuth` and now **filter blocked users' tasks in both directions**, matching on `user_id` or `created_by`.
  - Before: blocked users' tasks were listed on every transport.
  - A failed block read now returns 503 rather than an unfiltered list.
  - **Recorded follow-up:** a block rule for direct-link task detail needs a participant exception (owner, assigned worker, existing bidder).
- **#291 (Stream 2):** web "My Home" reads the Home list's coordinates. Before, every post ran a geocode and a Home PATCH.
- **#289 (Stream 1):** the approve route claims only a still-pending order, checks the price write, and returns 409 on a repeat.
- **#290 (Stream 1):** the web Change Orders banner is worded from the viewer's side, and one click sends one approve.
- **#292 (Stream 3):** the native routers accept `?ot=&oid=` host booking links. This fixes the #245 regression; the device checks are pending.
- **#286:** native 5xx copy. It was re-greened after a one-line update to a test expectation.

### Agents
- **Five running:** Streams 1, 2 and 3; the fee agent is done; the new shared-UX agent (C-items).
- **Shared-UX progress:** it reproduced C-01, C-02, C-04, C-11 and C-22 on iOS master. Its fix branches are written, and the iOS integration build is waiting for the heavy slot.

### Disk
- Disk reached 98%, about 11 GiB free.
- **The coordinator** deleted its own 8 GB of derived data. **Streams 2 and 3** pruned about 11 GB of their own regenerable outputs.
- **Time Machine local snapshots** still hold the deleted blocks, and the OS purges them under pressure. Nobody touches them; the founder can thin them.
- **Shared-UX agent:** it gets its own AVD only at 20 GiB or more free.

## Resume point history — September 23, 2026, 11:01 UTC (coordinator session `92cc4526`)

This updates the 10:33 block below; read both. The count is **11 closed / 69 partial**.

### Merged
- #282 (business-account notifications go to owners/admins).
- **#253, the P04/P05 poster-fault fee backend,** merged 10:38 → `1d791906c`.

### Queue
254 (clients) 288 (magic post) 255 278 280 283 221 236 219 214 215 224 199 208 251 252 257 279 262 264 287 266 285.
- The coordinator merged master into #255 (import conflict with #253) and ran the full backend suite: 341 suites pass.
- #280 and #283 were rebased, and #257 was rebased and now runs before #279.

### UX inventory (U05/U03), done
- **File:** `/private/tmp/pantopus-tools/ux-inventory-2026-09-23.md`. A code read on `4f2983c5d`.
- **Totals:** 155 items: 48 dead ends, 60 misleading, 37 weak, 10 cosmetic.
- **By stream:** Stream 1: 25, Stream 2: 24, Stream 3: 69, shared: 37.
- **Top items:**
  - iOS profile cover with no way back (C-01);
  - native bid errors hide "set up payouts first" (S1-06);
  - native "Make offer" creates an inquiry the seller never sees (S1-01);
  - web business creation always fails (S3-01);
  - native mail buttons claim "Payment started" when nothing happened (S2-07);
  - native privacy controls don't save (S3-29);
  - web Settings: a failed load, then Save, can make a private profile public (S3-28);
  - **a #245 regression:** Home- and Business-owned booking notifications open nothing on native (S3-02, being fixed first);
  - every native listing shows a verified "Seller" (S1-07);
  - Hub pills and You → Home rows open placeholders (C-02, C-04);
  - native Home dashboard tabs never show content (S2-09);
  - iOS Messages stops updating (S3-30);
  - one-tap payment release with no confirm (S1-19).
- **Dispatch:** each stream got its section in impact order.
- **New shared-UX agent** for the 37 shared items: navigation shells, Hub/You/Settings, shared error components, feed, support trains. It uses API 18138 / Next 18139 and its own fixtures on 64561/64562.
- **Device slots raised to 4.** The memory gate stays at 20% free.

### Privacy fixes approved (Stream 3)
- The relationships list omits blocked rows the caller didn't create, and unblock returns a uniform 404 to anyone but the blocker.
- The neighbor reply copy stays true for the blocker and is neutral for the blocked party.

## Resume point history — September 23, 2026, 10:33 UTC (coordinator session `92cc4526`)

This updates the 08:34 block below; read both. The count is **11 closed / 69 partial**.

### Usage-limit pause
- All four agents stopped at about 09:35 UTC on the account's session limit: Streams 1, 2 and 3, and the UX inventory agent.
- The merge queue kept running.
- The agents were resumed at 10:33 UTC with their context intact.

### Merged by the queue (09:17–10:30)
#274, #276, #256, #260, #263, #265, #275, #267, #268, #270, #272, #284, #277, #245, #281. Master is `4f2983c5d`.

### Queue
282 253 254 255 278 280 221 236 219 214 215 224 199 208 251 252 279 257 262 264 287 266 285.

### Conflict plan
- **#255 (search escaping):** it collides with #253 in the gigs.js import lines. The coordinator merges master into #255 right after #253 lands.
- **#283 (no-show reasons):** it collides with #253's eligibility rule. Stream 1 rebases it after #253 and aligns the copy with the new scheduled-start rule.
- **#257 and #280:** both now conflict with master. Stream 2 is rebasing them first.
- **#279:** queued ahead of #257, which absorbs #279 in its rebase.
- **#286:** red CI. An existing Android test asserts the old 5xx copy; Stream 1 is updating that expectation.

### Findings since the last block
- **Magic post (core flow):** `POST /api/gigs/magic-post` returns 500 for every in-person task on all clients.
  - Cause: `magicTask.js` inserts `task_format: null` into a NOT NULL column.
  - Web `MagicTaskComposerV2` swallows the error.
  - Stream 2 is fixing it as the top priority.
- **Security, decided:** posting a task with another household's `location.homeId` (the `origin_home_id` field) was accepted from a non-member. Setting it now requires `home.view` on that Home. Stream 2 is implementing this.
- **Web Change Orders banner** shows the owner "The worker has requested changes" when the pending orders are the owner's own. Fix approved (Stream 1).
- **iOS gig deep link** doesn't navigate while another gig detail is open. Fix approved (Stream 1).
- **Fee follow-ups:**
  - payer history labels a fee "Captured hold" → "No-show fee" / "Cancellation fee" (Stream 1, after #253/#254);
  - iOS `pantopus://settings/payments` shows two back buttons (Stream 3).
- **Founder: draftBusinessReminder email.** Its email path calls a `sendTransactionalEmail` that doesn't exist, so the reminder email has never been sent. It is left off, because enabling it would start emailing business contacts.

## Resume point history — September 23, 2026, 08:34 UTC (coordinator session `92cc4526`)

This updates the 08:19 block below; read both. The count is **11 closed / 69 partial**.

### Merged
- #259 → `780f2d4fd`: a repeated change order returns the existing order.

### Queue
231 271 269 273 274 255 256 260 263 265 267 268 270 272 253 221 236 219 214 215 224 199 208 251 252 257 262 264 266.
- Fast backend/web PRs run ahead of native ones.
- Safety and privacy fixes are first: #271, #269, #273, #274.
- #254 joins right after #253 when its native CI is green.

### Fee (#253 ready; #254 pending native CI)
- **Re-review items fixed in `a1e3b111e`.** The DB was rebuilt from the amended migration before re-verifying with real Stripe TEST:
  - payer spending and "paid" now use the captured fee: 313, and 213 after a 100 refund;
  - the single-payment read carries `gig_fee`;
  - the replay captures only while `capture_pending`;
  - guard reasons are specific (`STOP_ACTIVE` / `NO_SHOW_REPORT_ACTIVE`), with no stray incident;
  - the dispute branch rethrows, so redelivery records the fee;
  - replays park after 3 definitive failures (`REPLAY_EXHAUSTED`, one alert).
- **Follow-up in #253's Limits:** the support "release" action.
- **Bundle r2:** 492 files, MANIFEST `8210feb6c0ad73a3662adf078205761a87984f5fff63ef39c71a46bac20a8758`.
- #253 CI OK; marked ready and queued.

### New safety and privacy PRs
- **#269:** interim guard. A price change on a task with a live payment hold returns 409 `PAID_PRICE_CHANGE_UNAVAILABLE`.
  - Android: the error shows as a toast and inline in the sheet.
  - iOS: inline, in red.
  - The paid task still starts, completes and captures.
  - Bundle `…-paid-price-change-guard-r1`, MANIFEST `83ad5959…`.
- **#271:** the account-delete guard returns 409 `PAYMENT_HISTORY_RETAINED` before any destructive step.
  - Records are byte-identical before and after, and a user with no payment records still deletes.
  - MANIFEST `a09a5474…`.
  - The native UI check needs a step-up, so it runs in Stream 3's setup after merge.
- **#273 (privacy):** business_team mail keeps its attention person. The Business list uses the Home mail rule, where it used to return other members' attn_only letters with `select *`.
- **#274:** an attn_only bill letter no longer creates a household HomeBill.
  - **Decision:** attn_only letters skip ALL household fan-outs (the HomeDocument visible to members, HomePackage, HomeTask). This is a follow-up PR.
- **#272:** the web Owners and Emergency pages show a load failure with Retry, not a false empty list.
  - The same flaw on the unreachable docs/maintenance/share/access/settings pages is recorded.
- **#264 (Stream 1):** Android sheet errors inline. **#266 (Stream 3):** iOS menu bottom inset.

### Cross-cutting
- A read-only UX inventory agent is compiling `/private/tmp/pantopus-tools/ux-inventory-2026-09-23.md`. It covers placeholder/dead-end actions and weak states on all three clients, routed by stream (backlog rows U05/U03).
- **Watch script:** `/private/tmp/pantopus-tools/coord-watch.sh` combines merge-queue events with CI OK results for the PRs in `ci-watch.txt`.

## Resume point history — September 23, 2026, 08:19 UTC (coordinator session `92cc4526`)

This updates the 07:52 block below; read both. The count is **11 closed / 69 partial**; P08 closed at 07:5x.

### FOUNDER DIRECTION (08:15 UTC, in chat)
*"keep working on all 3 workstreams until all features, functions, workflows within the app are verified, tested with
all cases … errors are handled properly, with great best user experience … think carefully whether the user
experience is good enough or not. if not, fulfill it. We do not care about unit test … launch the apps in iOS,
Android, simulator and emulator, web app, test everything end to end, and fix anything you find … merge whenever you
think they are ready."*

- **UX improvements are authorized**, within the existing design system, with before/after on the real app.
- **No new unit tests.** CI must stay green.
- **Rules:** `/private/tmp/pantopus-tools/AGENT-RULES-2026-09-23.md` (UPDATE 08:20).
- **Consequence:** the coordinator decided the items that had been waiting on the founder, as listed next. Each
  decision is recorded here so the founder can override it.

### Coordinator decisions (formerly founder questions)
- **Stream 1:**
  - Error toasts go red and are drawn above sheets.
  - Copy: "Server error N…" → "Something went wrong on our side. Please try again." on native; the 409 no-show copy
    gets a specific reason.
  - **Paid price changes:** option 1. The interim server guard in #269 stays, and the UI stops offering price types on
    paid tasks.
  - iOS tip dock parity and tip-limit copy.
  - Back from a notification-opened gig returns to the list.
  - P06 native dispute presentation.
  - P07 copy. The P07 recovery job is escalated first, because it moves money.
  - **Account delete:** an interim 409 before any destructive step. **Retention/anonymise stays a founder/legal
    question**, and production accounts may already have lost Refund/Wallet/Payout rows this way.
- **Stream 2:**
  - **v1 sender gate:** the Home mail rule.
  - **Route item 6 (package unboxing on web):** built by reusing the native two-step upload.
  - **Route item 8:** a read-only `GET /api/homes/:id/gigs` (`origin_home_id`, `home.view`).
  - **Route item 9 (landlord Notices/Settings):** an honest "not available yet" state.
  - **`business_team` drawer:** honours attention.
  - **v1 bill send:** no fan-out for attn_only letters.
  - **HomeAsset CHECK:** extended by a forward migration.
  - **Landlord dispute route:** left as recorded.
- **Stream 3:**
  - "N businesses", dropping "verified".
  - The "Business · Verified" chip shows the real status.
  - Email support with no mail app shows an alert and a Copy action.
  - Sending to a blocker shows the server copy, with no Retry on 403.
  - The hub bell dot means unread notifications.
  - The iOS "EARLIER" header overlap is fixed.
  - A blocked business can't invoice the person who blocked it.
  - Business-scheduled notifications go to owners/admins.
  - One-on-one business host notifications go to the owner or the assignee.
- **Fee (FYI):** fees under $0.50 are waived.

### Fee PRs (#253/#254)
- **Second review:** "safe to merge on money safety"; F1–F4 and F7/F8 are closed.
- **Before merge:**
  - payer spending totals (Medium);
  - replay capture only on `capture_pending`;
  - poster guard reasons and incident ordering;
  - dispute-branch rethrow;
  - replay parking.
- **Bundle r2:** 364 files, MANIFEST `5abf2216…`. #253 CI OK.
- Both PRs stay in draft until those items are done.

### Merged since the last block
- #213 → `348ccb638`
- #261 → `327364fa1` (privacy)
- #258 → `27d45c027`

### Queue
259 231 221 236 219 214 215 224 199 208 251 252 255 256 260 257 263 265 267 268 262 270 264.
- #269 goes right after #259 once its iOS check lands.
- #264 is new: Android sheet errors are inline, with an in-flight guard; idle states are pixel-identical. Bundle
  `…-sheet-error-feedback-r1`, MANIFEST `60cc03f4…`.

## Resume point history — September 23, 2026, 07:52 UTC (coordinator session `92cc4526`)

This updates the 07:24 block below; read both. The count is **10 closed / 70 partial**.

### Merged
- #218 → `4f41c4217` at 07:28 UTC.

### Queue
213 261 258 259 231 221 236 219 214 215 224 199 208 251 252 255 256 260 257 263.
- #261 (a privacy fix) goes right after #213.
- #260, #257 and #263 were added as their CI went green.

### New PRs
- **#260 (Stream 2): web route-drift cleanups.**
  - Item 5: the Mail Day banner stays dismissed for the rest of the day in this browser.
  - Item 7: the dead hub-context calls are removed.
  - Item 8: the error copy now says "home help" instead of the internal key.
  - Bundle `…-web-route-drift-cleanups-r1`, MANIFEST `71e127e7…`.
- **#261 (Stream 2, PRIVACY): the `mail_extracted` compatibility retry is narrowed.**
  - Before: the retry fired on any error that named a new column. An attn_only Home letter whose attention user had
    been deleted hit `Mail_attn_user_id_fk` (23503). The retry dropped the attention and visibility fields, the send
    returned 201, and every household member was notified and could open the letter.
  - Now: the retry fires only on PGRST204 or 42703.
  - Bundle `…-mail-compat-retry-narrow-r1`, MANIFEST `23d0f339…`.
- **#263 (Stream 2):** a malformed Home id now gets 400, not 500, on the intelligence and systems routes. MANIFEST
  `e245c1a7…`.

### Fee repair: every review finding reproduced on #253's head with real Stripe TEST (harness 18136)
- **F1a:** the poster's worker-no-show report arrives during the worker's fee capture. The fee is captured and the
  payment stays stuck in `capture_pending`.
- **F1b:** a Start Work in the same window produces `in_progress` with 25% captured.
- **F3:** a report 3 h before the scheduled start charged 313.
- **F4:** a lost capture followed by hold expiry leaves the gig `assigned` forever.
- **F2:**
  - the admin refund returns 409;
  - a dashboard refund makes the webhook fail with 500 forever;
  - the worker is still credited 266.
- **F6:** Stripe TEST refuses `amount_to_capture` below 50¢ (`amount_too_small`).
- **F5:** history shows the full 1250/1063 amounts.
- **F8a:** a fee the webhook records sends no notice to the poster.

The repairs are in progress. **FYI for the founder (coordinator-approved, revisitable):** fees under Stripe's $0.50
minimum are waived. The owner's late cancel becomes a fee-free release; a worker no-show report cancels and releases
the hold.

### Coordinator-approved functional repairs (Stream 2)
- **Defect A:** v1 "Person @ Home" failed for every non-owner resident. `isUserLinkedToHome` needs `finance.view`,
  which only owners have, so the user saw the false "That person doesn't live at the selected home address".
  - Fix: the Home mail rule, in the same PR as the attention-user validation (a clear 400).
- **Defect B:** web compose errors render behind the modal overlay, so they are invisible. The error moves inside the
  modal with the existing banner styling, and the modal is pixel-identical when there is no error.

### Founder decisions added (not implemented)
- **v1 mail sender gate:** `hasHomeAccess` needs `finance.view`, so a verified lease resident gets 403 sending a
  household letter to their own Home. Options: owner-only (today), `mailbox.view`, or the Home mail rule.
- **"N verified businesses" banner:** it counts pending and unverified businesses by design (the A08 mockup and the
  tests), so an unverified owner sees "1 verified business". Options:
  - (a) count only verified businesses;
  - (b) drop the word "verified".
- **Recommended:** the owner dashboard chip "Business · Verified" is hard-coded on iOS (`OwnerHeader.swift:258`) and
  Android (`OwnerHeader.kt:253`) and shows for unverified businesses. Hide it unless the business is verified; no new
  copy.

## Resume point history — September 23, 2026, 07:24 UTC (coordinator session `92cc4526`)

This updates the 07:21 block below; read both. The count is **10 closed / 70 partial**.

### New agent PRs (each queued only after CI OK)
- **#257 (Stream 2): native mail/mailbox/neighbor notification links.**
  - Android re-verified on a dex-checked APK against 18142: the mail notice opens the letter, the summary notice opens
    the Mail tab, the neighbor notice opens the message, and a deleted target shows a clear not-found.
  - The master baseline drops the mail and summary taps, and the neighbor tap shows "Server error 500".
  - Bundle `20260923-stream2-native-notification-links-r1`, MANIFEST `4f7ae017…`.
- **#258 (Stream 3): invoice_received notification.**
  - The route now uses `createNotification`, so the payload goes to `metadata` and badge/socket/push fire.
  - It skips the notification when blocked, and fails closed.
  - The link is `/app/invoice/:id`.
  - Verified through the real iOS create-invoice caller. Bundle `…-invoice-received-notification-r1`, MANIFEST
    `ddae007a…`.
- **#259 (Stream 1): repeated change orders.**
  - On master, a double tap made two "+$10" orders, and approving both took the price from 0 to 10 to 20.
  - The route now returns the existing pending order: `already_requested`, a derived id and the primary key close the
    race.
  - Bundle `…-change-order-repeat-r1`, MANIFEST `2f8f87d3…`.

### Decisions made by the coordinator (functional; no visual change at rest)
- **Stream 1:**
  - Android lifecycle sheets get an inline error, reusing EditBidSheet's treatment, plus an in-flight guard. Idle
    states must stay pixel-identical.
- **Stream 2:**
  - Android bottom bar: highlight the tab on child screens, and make a tap on Place work. This starts after
    #251/#252/#257.
  - `/api/homes/:id/intelligence` returns 400 instead of 500 for a malformed id.
  - Route item 5: Mail Day dismiss is kept client-side as "dismissed today", and the dead POST is dropped.
  - Route item 7: the dead hub-context calls are removed.
  - Route item 8: the section error copy must not expose internal keys like "homeGigs".
- **Stream 3:**
  - The iOS half of decision 5 (chat link → person thread) gets its own PR.
  - Hub side menu: "Help & Support" sits under the tab bar; the fix is bottom padding only.
  - The "1 verified business" count is fixed if its logic is wrong; if only the wording is wrong, it goes to the
    founder.

### Founder decisions added (not implemented)
- **Route item 6:** the web package unboxing panel has never rendered.
  - (A) Map the package fields and reuse the native two-step upload. The panel would appear.
  - (B) Leave it hidden.
- **Route item 8:** Home dashboard gigs.
  - (A) A small read-only `GET /api/homes/:id/gigs` from `Gig.origin_home_id`, gated on `home.view`.
  - (B) Stop requesting it.
- **Route item 9:** landlord Notices/Settings.
  - (A) Hide the tabs. (B) Show an honest "not available yet". (C) Build 3 tables and routes.
  - The agent recommends A or B.
- **Paid gigs:** an approved price change on a PAID gig never changes the hold. Stream 1 is documenting what each
  party sees.
- **Presentation (from Stream 1):** red error toasts drawn above sheets, and copy for "Server error 503…" and
  "No grounds for no-show report".

### Queue (08:00 ETA for #213)
- Order: 218 213 231 221 236 219 214 215 224 199 208 251 252 255 256.
- #213 was moved up because Stream 3's #245 native tap check needs it.
- Each native PR takes about 35 minutes of Android CI after its update.

### Process notes
- **iOS sign-in:** Stream 3 now signs in through a local DEBUG launch-env build, then installs the master build over
  it. No credential is typed. The simulator pasteboard mirrors the Mac clipboard, so `simctl pbcopy` is unsafe for
  secrets.
- **CI watcher:** `/private/tmp/pantopus-tools/ci-watch.sh` watches the PR numbers listed in `ci-watch.txt`.

## Resume point history — September 23, 2026, 07:21 UTC (coordinator session `92cc4526`)

This updates the 06:52 block below; read both. The count is **10 closed / 70 partial**.

### Fee PRs #253/#254 are back in DRAFT; they are not safe to merge
A read-only coordinator review of #253 found must-fix defects. The full list is in
`/private/tmp/pantopus-tools/fee-review-253-2026-09-23.md`.
1. A worker-no-show report or Start Work that runs during the fee capture leaves a captured fee unrecorded, with the
   payment stuck in `capture_pending`.
2. Fee refunds can't be reconciled, and the worker share still settles after a refund.
3. A worker could charge the no-show fee before the scheduled start, although the existing UI copy says "only after
   the agreed start time".
4. A stalled reservation has no recovery path.
5. History and pending earnings show the full task amount.
6. Sub-50¢ partial captures are unverified.
7. Settlement routes on the mere presence of `metadata.gig_fee`.
8. Several low items.

Both PRs were taken off the queue and marked draft. A dedicated fee-repair agent owns them now: disposable project
64571/64572, ports 18134/18135, iOS sim C2BCF36A. It reproduces each finding, repairs it, re-verifies with Stripe
TEST, and writes bundle `…-poster-fault-fee-r2`.

### Other changes since 06:52
- **#256 (new): web transport errors show plain copy.**
  - Reproduced on `/login`: "Request failed with status code 500" when the API was down, and "Network error: cannot
    reach API at /api/users/login" when offline.
  - Both now show the app's existing plain copy.
  - Bundle `20260923-coord-web-transport-error-copy-r1`, MANIFEST `d16e9c0f…`.
  - CI OK. Queued before the fee PRs were pulled.
- **Queue:** 218 231 221 236 219 213 214 215 224 199 208 251 252 255 256. #218's Android CI is running.
- **Stream 1: Android gig-detail sheet failures are invisible.** The toast is drawn under the sheet's scrim, in the
  success colour, for 2.5 s. Seven lifecycle sheets are affected; confirmed on emulator-5558 in bundle
  `20260923-stream1-sheet-error-feedback-r1`.
  - **Approved functional repair:** an inline error that reuses EditBidSheet's treatment, plus an in-flight guard. The
    idle state must stay pixel-identical.
  - **New defect:** a double tap on "Send request" created two identical pending change orders. It is being
    reproduced end to end (approve both, check the price delta); a server guard comes first.
- **Founder question (presentation):**
  - Colour `isError` toasts red and draw them above sheets (iOS and web already do both).
  - Copy: "Server error 503. Please try again." → "Something went wrong on our side. Please try again."
  - Copy: "No grounds for no-show report" → "The worker has already started, so this can't be reported as a no-show."

## Resume point history — September 23, 2026, 06:52 UTC (coordinator session `92cc4526`)

The count is now **10 closed / 70 partial**: P03 closed, because #241 (its last recorded iOS observation) merged after
its installed-simulator verification. The row text in `REMAINING_WORK_2026-09-11.md` carries the evidence.

### Merged since the handoff (serial queue, exact-head CI)
- #241 → `fa647f69a`
- #248 → `c6f7db9c0`
- #247 → `019fb0b03`
- #249 → `c4a538e2a`
- #250 → `35391f59e`

The runner (pid 6029) is alive. #251 and #252 were appended at 06:35 UTC. Queue at 06:52: 218 231 221 236 219 213
214 215 224 199 208 251 252.

### New PRs (not queued until CI OK)
- **#253 — P04/P05 fee, backend and migration** (`claude/stream1-poster-fault-fee` @ `be92a0f71`).
- **#254 — fee line on web, iOS and Android** (`…-clients` @ `b0a5f9e70`), stacked on #253. Merge #253 first.
- **Fee bundle.** The coordinator sealed it from the fee agent's evidence:
  - 160 files, MANIFEST `18db9ac4ba6a71ff7fe95be3fce323bfffa2a4f12882f5dc8df01fca9113d024`;
  - journeys J1–J8 plus settlement, on real Stripe TEST.
- **Android pixel identity is complete.** The tall captures of the card and the stop sheet differ only in the
  status-bar clock (re-compared at 06:38 UTC). The handoff's "Android pair in progress" item is closed.
- **Migration policy re-checked.** `20260923000100` sorts after master's newest `20260922023100`, and no queued PR
  adds a migration.
- **#255 — search terms escaped before ILIKE filters** (`claude/search-terms-escape-ilike` @ `45f114cdf`).
  - This is the plain defensive edit from HANDOFF §0: `escapeIlike()` is lifted to `backend/utils/escapeIlike.js`
    and applied at the eight listed call sites.
  - Backend Jest: 341 suites pass. Privacy gates pass.
  - **No probing and no write-up.** The search-filter audit stays closed.

### Evidence location changed (this session only)
- This coordinator runs in an isolated worktree. A hook blocks writes into the founder's main checkout, and the
  legacy store `skinny-pantopus/.pantopus-recovery/audits/` lives there.
- **New and resealed bundles go in the worktree store** (gitignored by its own `.gitignore`):
  `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`.
- **Copy them into the legacy store before this worktree is removed.** The legacy store stays read-only for this
  session's agents.

### Stream agents respawned (06:50 UTC)
- Stream 1 (gigs & payments), Stream 2 (Home) and Stream 3 (accounts & social) are running as background agents
  of session `92cc4526`. Their shared rules are in `/private/tmp/pantopus-tools/AGENT-RULES-2026-09-23.md`.
- **New shared limiter:** `/private/tmp/pantopus-tools/device-slot.sh`.
  - At most 3 booted test devices at a time. The founder's simulator EB5AD759 is excluded and never touched.
  - No slot is handed out below 20% free memory.
  - This sits alongside the existing heavy build slot.
- **Stream 2 incident (05:57–05:59 UTC, previous session).**
  - What happened: an Android APK built without `PANTOPUS_API_BASE_URL`/`PANTOPUS_SOCKET_URL` fell back to
    `http://10.0.2.2:8000`. It sent two requests to the founder's `:8000` backend: a refresh (401 TOKEN_REUSE) and a
    login for a synthetic account (401).
  - Likely effect: log lines and limiter counts only. The founder's stack was not queried.
  - The rules now require explicit URLs and a dex check (the APK must contain its own port and no `:8000`) before
    any install.
- **Load shed.** The coordinator shut down its idle simulators (F4DBD47E, C2BCF36A and Stream 3's 0AE16FA0; the
  apps stay installed) and `docker stop`ped the finished fee project `pantopus-stream1-fee-r1` (volumes kept).

### New Stream 1 observation (being verified by the Stream 1 agent)
- **Where:** Android gig detail draws its lifecycle toast in the screen content, under any open `ModalBottomSheet`.
- **Colour:** always `success`, even for `isError` toasts.
- **Evidence:** in the fee J3 run, "Report no-show" returned 503, the sheet stayed open, and no message was visible.
- **Next:** device check first. Any colour change is presentation and goes to the founder.

## Resume point history — September 23, 2026, 05:07 UTC

This updates the 04:40 block below; read both. The count is still **9 closed / 71 partial**.

### Merged since 04:40 UTC
- #226, #227: Stream 2 web error reasons.
- #242: v1 send keeps attention and visibility fields.
- #240: business Contact works again (block/curator gates added first).
- #209: D07 role change independent of expiry.

### Stream 1 (coordinator)
- **#244, money safety, queued.** A Stripe webhook whose Payment write failed was still acknowledged with 200 and marked processed, and redelivery was skipped as a duplicate. Reproduced with a **real TEST dispute** and an injected write failure on master: the Payment stayed `captured_hold` with no `dispute_id` while both parties were told of a dispute. Settlement gates on the database's `dispute_id`, so it would still credit the worker.
  - Fix: 18 money-state writes now use the file's existing `assertSupabaseOk`. The event returns 500 and Stripe redelivers it. Verified: 500, event unprocessed, no notifications; then the healthy redelivery records `disputed` + `dispute_id`.
  - Bundle `20260923-stream1-webhook-write-failures-r1`, MANIFEST `f64e89c13eb0f4ae22a7873b4835075ca492b14149be014c60aff613c51abf49`.
  - Found by the new unchecked-write scan (`/private/tmp/pantopus-coord-schema/unchecked-writes.cjs`). The 17 non-webhook hits and the StripeAccount writes are recorded.
- **#241 (iOS tip refresh):** built in its own derived data. The simulator run is deferred until swap recovers.
- **Parity check:** Android refetches after 16 gig actions. iOS refreshes or updates in place for all of them except tips, which #241 fixes. Web `/confirm-completion` and native `/cancel` share the same services as `/complete` and the stop flow.
- **Fee agent:** web and iOS pixel identity done (fee line, card and stop sheet identical apart from the clock and blur); Android pair in progress. Migration pre-read by the coordinator: the 24h worker-reports-poster rule matches the route.

### Notification-return audit (coordinator)
- **Web:** gig links are fine (middleware `/gigs/:id` → `/app/gigs/:id`). Broken: booking host lifecycle `/app/profile/schedule/bookings/:id` (404); `invoice_sent` → the recipient page `/app/invoice/:id` (Stream 3 corrected the coordinator's target); four `/homes/…` subpaths (Stream 2).
- **Native:** mail item and `mail_summary` links are discarded; neighbor-message opens Place with homeId "neighbor-message"; landlord, `connection_accepted`, `marketplace` and audience links are discarded.
- Dispatched: Stream 2 (mail, Place, landlord, homes); Stream 3 (booking host link + invoice PR in progress, connection/marketplace/persona).

### Stream 2
- **#243 queued:** the web Counter uses the existing `drawer/*?tab=counter`.
- **Six web mailbox pages ran on a hard-coded stub Home `home_1`** (Camas, WA coordinates). Records create and list crash, Tasks falsely empty, Travel 400. One PR is in progress, reusing an existing Home source with an unmask check.
- Recorded:
  - records category options vs the HomeAsset CHECK (a visible change; founder);
  - the p3 records reader field mapping (a small follow-up PR);
  - the `mail_extracted` compatibility retry, to be limited later;
  - the v1 residency test uses `finance.view`, pending a comparison with v2.

### Stream 3
- Deletion 409 is correct on both native apps (M18).
- Android You → Help/Legal/Privacy opened "isn't here yet" placeholders although the screens exist; a wiring fix is approved.
- Booking-link + invoice PR in progress.
- Invoice notifications failed silently (a `data` column); fix approved with a block gate.
- Combined per-platform verification builds are approved (exact heads recorded per bundle).

### Host overload incident (~05:00 UTC)
- Load reached about 660 and swap about 23.5 of 24.6 GB. Emulator input stalled.
- Each stream shed only its own load:
  - the coordinator's schema DB and simulator;
  - Stream 3's emulator-5554, sim 0AE16FA0 and mail-r3 stack;
  - Stream 2's emulator-5556, sim 6F914A30 and Next.
- **The founder's live environment was identified and left alone:** Docker stack `pantopus-home-gig-replay` (64521/64522), backend :8000 and simulator iPhone 17 `EB5AD759`. Never stop these.
- Native work is serial until swap recovers. At 05:07 load was about 240 and swap had 2 GB free.

### Founder questions added (not implemented)
- **Business drawer:** should a `business_team` letter keep honouring attn and recipient? Today a member who files an attn_only letter into Business exposes it to the household.
- **Records:** extend the HomeAsset CHECK, or align the categories?
- **Blocks and invoices:** may a blocked business still create or list invoices to the blocker?
- **Business-scheduled notifications:** notifications to business User rows (draftBusinessReminder, expirePopupBusinesses) are unreadable. Reroute them to owners?
- **iOS tip dock:** label parity ("Check tip status") and tip-limit copy (UX proposals).

### Queue
243 211 244 210 218 231 221 236 219 213 214 215 224 199 208.

## Resume point history — September 23, 2026, 04:40 UTC

This updates the 04:17 block below; read both. The count is still **9 closed / 71 partial**. P03 closure is proposed once #241 is verified on a simulator (below).

### Timestamp correction (coordinator)
- Four earlier block labels were ahead of their actual commit times. They are now labelled with the real UTC commit time, and each keeps its first label.
- Three Stream 1 bundle headers stated windows later than their runs. They are corrected from the harness request logs and resealed, with a `## Correction` note in each RESULT.md:
  - `retire-gig-status-route-r1`: 04:15–04:17, MANIFEST `bbabd6aabf152dd5229c59794a5ccfc0d8cf21e1b9834a43f48b903829e548b4`;
  - `schema-drift-reads-r1`: 04:09–04:13, MANIFEST `63d582a83e83a78db95fda2f4a74c285829eac3559820c73dfa4fa2d4809849f`;
  - `account-delete-money-guard-r1`: 03:58–04:02, MANIFEST `6e12133bcbcec40f21641c03eadf66caccdc6caf58bf5c9efd55e243cf386ac6`.
- Eight other Stream 1 manifests had `updatedAt` rounded 2–11 minutes past their real seal. Each is set to its actual write time with a `corrections` entry; file hashes are unchanged. The hub citations now carry the new MANIFEST hashes.
- Commit times and harness request logs are authoritative.

### Merged since 04:17 UTC
- #230: Hub mail counts (Stream 2).
- #237 (Stream 1): schema-drift reads.
- #238 (Stream 1): retires `PATCH /api/gigs/:id/status`.
- #216: booking invitee notification link (Stream 3).
- **#239: M01 privacy fix, merged `7855e7c7d`.**
  - Members see only the Home letters the Home rule allows. The rule is one definition in `utils/homeMailAccess`, shared by the v1/v2 lists, the per-item gate, drawers, pending, Mail Day and the badge.
  - The v1 delivery notice now reaches only members who may open the letter.
  - Bundle `20260923-stream2-m01-home-mail-visibility-r1`: 57 files, MANIFEST `739617a1e8752fd3ecf07c6db86a40994f28c97d23533eec0141257cccf46e61`, verified by the coordinator.

### Client-route drift scan (coordinator, new tool)
`/private/tmp/pantopus-coord-schema/routes-scan.cjs` builds Express 5's route table in registration order. It covers `app.js` mounts, routers, nested and helper-registered routes, and loop-generated paths: 1,229 routes. It matches all 2,734 client calls against it (web 1,060, iOS 794, Android 880).
- **Result:** 2,696 calls resolve. Triage is in `/private/tmp/pantopus-coord-schema/route-findings-2026-09-23.md`.
- **Stream 2, dispatched:** nine live **web** screens call backend routes that never existed; `git log -S` finds none ever. Each item is reproduce-first; repairs go through an existing route where the semantics match, otherwise a build-vs-hide proposal for the founder:
  - Mailbox Counter page and nav badge;
  - Records create asset and add photo;
  - map pin "add to calendar";
  - Mail Day summary dismiss;
  - package condition photo;
  - Hub context sync;
  - Home dashboard gigs;
  - landlord property **Notices** and **Settings** tabs (no tables exist).
- **Recorded, no UI caller:**
  - web chat room leave/search/mute/pin/archive;
  - files metadata, get and portfolio reorder;
  - `PUT /users/location`;
  - native listing `DELETE …/save` (the backend POST toggles);
  - web ad-campaign functions (`GET /api/mailbox/campaigns` is also shadowed by `/:id`);
  - `updateMagicSettings` sends PUT where the backend has PATCH.
- **Informational:** 147 calls reach only routes behind `IDENTITY_FIREWALL_ENABLED`, `PERSONA_ENABLED` or `PERSONA_BROADCAST_ENABLED`, which is deployment configuration.
- **Stripped-body scan** (`body-scan.cjs`): `validate()` uses `stripUnknown`. Across 274 validated routes, 175 read the body, and only one reads an undeclared field: listing `source_type`/`source_id`, which no client sends. Of the web literal bodies, 79 were checked against their Joi schemas: no enum mismatch, and 4 stripped keys that no handler needs. No repair.

### Stream 1
- **#241, awaiting simulator verification:**
  - Fix: iOS gig detail refetches after a terminal tip. The P03 iOS bundle recorded a stale payment card until reopen; Android refetches on its receipt.
  - Verification plan: its own simulator, derived data and port 18152, on the heavy slot after the fee agent's iOS pair and Stream 3's chat-link builds.
  - With it, every item in P03's recorded "Remaining" list is covered:
    - iOS create/cancel/3DS: `20260923-stream1-p03-ios-tip-r1`;
    - storage loss on both platforms: `20260923-stream1-p03-storage-loss-r1`.
- **Fee agent (P04/P05):**
  - Backend and all three clients are implemented locally.
  - Checks pass:
    - CI schema replay reproduced with CLI 2.116.0 (2.98.2 segfaults on unchanged contracts);
    - 67/67 pgTAP;
    - migration `20260923000100_gig_fee_capture.sql` sorts after master's newest;
    - backend Jest 238 suites.
  - The Stripe TEST hold-unavailable no-show converges.
  - Native pixel-identity pairs and the payer journeys are next. It holds C2BCF36A, `/private/tmp/pantopus-stream1-ios-dd`, port 18132 and emulator-5558.

### Disk
The data volume hit ENOSPC twice around 04:25 UTC. Each stream deleted only its own regenerable build output:
- Stream 1: the 3DS-run derived data and packages, plus an old worktree's Android build;
- Stream 2: about 19 GiB of stale iOS derived data;
- Stream 3: about 3 GiB.

About 32 GiB was free afterwards. Shared caches (`~/Library/Developer/Xcode/DerivedData`) were not touched.

### Founder questions added (not implemented)
- **Mailbox:**
  - who sees `business_team` mail;
  - whether admins see `attn_plus_admins` letters;
  - whether a v1 bill send on an `attn_only` letter should still fan out a HomeBill (provider and amount) to finance viewers.
- **Route drift:** build-vs-hide decisions for the Stream 2 items without a backend, once Stream 2 posts its proposals. The landlord Notices/Settings tabs have no tables at all.

### Queue
226 227 209 211 210 218 231 221 236 219 213 214 215 224 199 208. #240 (Stream 3 business inbox) is queued after review of its bundle, and #241 after simulator verification.

## Resume point history — September 23, 2026, 04:17 UTC (first labelled 05:00)

This updates the 03:45 block below; read both. The count is still **9 closed / 71 partial**.

### Whole-backend schema-drift scan (coordinator, new tool)

`/private/tmp/pantopus-coord-schema/scan.cjs` parses every supabase-js chain in `backend/`: 478 files, 3,129 chains
and 135 RPC calls. It checks them against a DB-only replay of master's 86 migrations (`supabase db start`, project
`pantopus-coord-schema`, SQL 64592; maps in `columns.json` / `fks.json` / `functions.json`). It found 148 candidates:
queries naming tables, columns or RPCs that don't exist, which usually fail silently as false-empties or failing
writes.
- **Per-stream lists:** `findings-stream{1,2,3}.md` in the same folder. Streams 2 and 3 are working theirs by user
  impact.
- **Rule for every repair:** check whether the fix unmasks data (the #212 → #217 lesson), and gate first if it
  does. Rerun the scan after merges to see what remains.

Stream 1 results:
- **#235: money-safety repair, merged `02bdef415`.** Account deletion's escrow guard filtered a nonexistent
  `Payment.status`, so deleting an account erased in-flight payments for both parties: held escrow, live holds,
  owed partial-refund earnings and payouts in transit. Bundle `20260923-stream1-account-delete-money-guard-r1`.
- **#237:** gig-search title suggestions and the AI assistant's activity counts were always empty. Verified in the
  web UI.
- **#238:** retires `PATCH /api/gigs/:id/status`, a dormant bypass that let owners write completed/in_progress
  without Start Work, capture or settlement. It was blocked only by the drift 404.
- **Recorded, no change:**
  - the dead public previews `/api/public/gigs|listings|posts` (if revived they must honour visibility);
  - urgent-task neighbor fan-out, which never worked (missing `find_homes_nearby`; enabling it is a founder
    decision);
  - the legacy `/api/offers`;
  - the unused geo helpers;
  - the anomaly-job fallback.

### Merged since 03:45 UTC
- #222 / #223 / #225 / #228: mailbox Home scope, readers, settings and Hub Today calendar.
- #232: blocked viewers can't open the blocker's profile.
- **#233: critical v2 mailbox IDOR; outsiders could read, mark opened and take any letter.**
- #234: party join Home gate.
- #235: account-deletion money guard.
- #229: bids refused across personal blocks.

### Founder questions added (not implemented)
- **Account deletion:** retain terminal payment history and the wallet ledger? Require withdrawing a positive
  wallet balance first?
- **Urgent-task fan-out:** build `find_homes_nearby` and start neighbor pushes?
- **Mailbox:** should admins see `attn_plus_admins` letters? `/party/assign` assignee membership.

## Resume point history — September 23, 2026, 03:34 UTC (first labelled 03:45)

This updates the 01:55 block below; read both. The count is still **9 closed / 71 partial**.

### Operating model
- The coordinator session reviews, merges and edits this hub.
- Four Claude agents, one PR per reproduced defect, each with an evidence bundle:
  - Stream 2 (Home);
  - Stream 3 (accounts/social);
  - Stream 1 fee agent: P04/P05 poster-fault fee execution, working in its own worktree `/private/tmp/pantopus-stream1-fee` and a private disposable full-schema DB. It uses Stream 1's port 18132, emulator-5558 and simulator C2BCF36A; the coordinator no longer uses them.
- **Merge queue:** `/private/tmp/pantopus-tools/merge-queue/run.sh` runs detached.
  - It reads `queue.txt` in order, updates each branch, waits for "CI OK" on that exact head, then merges with `--match-head-commit`.
  - It logs to `log.txt`. Append a PR number to `queue.txt` to add it.
  - It stops a PR on a conflict, CI failure or 90 min timeout.
  - Only coordinator-reviewed PRs go in.

### Founder decisions (2026-09-23, second round)
- **P04 worker share: 85% of the fee**, the normal split (`floor(fee*amount_to_payee/amount_total)`).
- **Late-cancel scope: before work starts only.** After-start stays `STARTED_POLICY_REVIEW`.
- **Fee display: a minimal fee line is approved** on web, iOS and Android. Every other state stays pixel-identical.
- **D07 "Set expiry": hide the control.** Stream 2 is implementing it.

### Merged since 01:55 UTC
- #206 (`7e728e081`)
- #212 (`d3bbfee06`, hub Home columns)
- #207 (`f0cbe9971`)
- #217 (`c0dee7a08`): the hub household gate. It closes a privacy leak that #212 had unmasked: applicants and members without `finance.view` saw household bills.

### Queue (in merge order at 03:45)
- 220 / 222: phase-3 mailbox Home-scope privacy fixes. The outsider read and write leak is **live in production**.
- 223 / 225: Mail Day readers and settings.
- 228: Hub Today calendar.
- 229: **bids refused across a personal block** (Stream 1). Verified on Android.
- 216: invitee booking link.
- 226 / 227 / 209: web error surfacing and role payload.
- 211 / 210: Stream 1 no-show release and Android a11y.
- 218: Android verify banner.
- 221: **iOS decodes null names**; every new iOS email signup could not open You.
- 219: iOS verify banner.
- 213 / 214 / 215 / 224 / 199 / 208: native routing, cold-start, blocked count, Face ID sequencing, block state and letter errors.

### New privacy findings in progress (coordinator-approved)
- **v2 mailbox per-item IDOR (Stream 2, live):** `GET /api/mailbox/v2/item/:id` and five other v2 handlers read or change any mail by id. The item read also marks it opened for the real recipient. The fix reuses v1 `canAccessMail`, with 404 denials.
- **M01 (a) (Stream 2):** members could read other members' `private_to_person` / `attn_only` home mail. The fix applies the dashboard's existing visibility predicates. v1 no-recipient letters are treated as household mail.
- **Blocked viewer can open or search the blocker's personal profile (Stream 3):** directional refusal on `GET /api/users/id/:id` and people search. Persona surfaces stay a founder call.
- **Android DM block/report failures show nothing (Stream 3):** existing AlertDialogs with the iOS copy.

### Open questions for the founder (not implemented)
1. **M01 (b):** require `mailbox.view` for home mail. This is the DB policy, and it would remove lease residents' home mail.
2. **Mailbox records:**
   - Unlink scope: any member of the asset's Home (current #222), or only the member who linked it?
   - Pin `visible_to` is not enforced among members.
   - Canonical Mail Day defaults.
3. **D10 household delete:**
   - Should members be notified or given a consent window?
   - A deletion receipt outside the cascade.
   - Revoke letters/passes with a reason instead of deleting them.
   - Retention of household mail and bills.
4. **iOS:**
   - The "You" cover has no close control.
   - Dynamic Type adoption: 4,746 fixed-size fonts, so AX5 is ignored.
   - The dark-mode BEST MATCH pill is about 2.9:1.
5. Carried over: persona surfaces vs personal UserBlock; R06 native Identity entry, letter PDF, guest copy and manager role; tips on disputed tasks; the viewer bid count during payment; duplicate PostReport rows; the booking host lifecycle link is a 404 on web.

### Stream 1 evidence since 01:55 (cleanup verified in each)
- `20260923-stream1-p08-ios-account-r1`: iOS checkout lifetime.
- `20260923-stream1-u02-ios-a11y-r1`: iOS dark mode is fine; Dynamic Type proposal.
- `20260923-stream1-p03-storage-loss-r1`: native tip recovery after local-storage loss. Android pays and iOS cancels, both on the same intent.
- `20260923-stream1-bid-block-gate-r1`: PR229.

## Resume point history — September 23, 2026, 01:44 UTC (first labelled 01:55)

The operating model from 23:50 UTC (below) still holds:
- Claude coordinator session: Stream 1 developer and coordinator.
- Claude background agents run Streams 2 and 3.
- Agents open one PR per reproduced defect and never merge or edit this hub.
- The coordinator reviews every PR and merges serially at fresh exact-head CI. Branch protection is strict, so every merge sends the other PRs behind; run `gh pr update-branch`, then wait for CI again.

The count is still **9 closed / 71 partial**. No merged PR closes a whole row.

### Merged since 23:50 UTC (master `8d3ab8810`)

| PR | Stream / row | Merge commit | Evidence (private bundle, MANIFEST sha256) |
|---|---|---|---|
| 200 letter verification requires current residency | 2 / R06 | `d718cc4e9` | `20260923-stream2-r06-residency-letters-r1`, `50d34d0c1318…` |
| 201 public page shows revoked/expired letters as such | 2 / R06 | `7321e7a54` | same bundle |
| 202 personal block refuses connection requests | 3 / N03–N04 | `896e15ba5` | `20260923-stream3-connection-request-block-gate-r1`, `3d6bf7393553…` |
| 203 web hides Follow after a personal block | 3 / N03–N04 | `2ac88e90b` | `20260923-stream3-web-profile-block-follow-r1`, `a52fac3a451f…` |
| 204 **P06 record + freeze** (founder decision) | 1 / P06 | `dd59f811b` | `20260923-stream1-p06-disputed-capture-freeze-r1`, `e83baeae267b…` |
| 205 only resident roles issue letters/passes | 2 / R06 | `8d3ab8810` | `20260923-stream2-r06-native-letters-passes-r1`, `abc109142f59…` |

P06 detail:
- A charge already disputed at capture is now recorded, confirmed and frozen as `disputed`, whether the capture or the dispute webhook comes first.
- Verified on installed apps with real Stripe TEST events:
  - Android won: settlement credited the worker 1063.
  - iOS lost: `refunded_full` 750 with no credit.

### Open queue (merge in this order)

1. **206** web letter/pass errors (Stream 2)
2. **212** `/api/hub` read nonexistent `Home.latitude/longitude`; every resident's hub showed "no homes" (2, D09/H08; evidence `20260923-stream2-hub-home-columns-r1`, MANIFEST `7e5620a41ad4…`). Highest impact.
3. **207** Android letter errors (2)
4. **210** Android large text + dark sheets (Stream 1, U02, founder-approved)
5. **211** worker no-show releases the poster's hold (1, P04)
6. **209** web role change without access dates (2, D07)
7. **199** iOS Local profile block state (3)
8. **208** iOS letter errors (2)

Hold the next hub docs PR until this queue is empty.

### Founder decisions (2026-09-23) and implementation state

- **P04/P05 "poster-fault pays worker":**
  - Worker no-show → poster refunded in full, worker not charged. **PR211** releases the hold; verified on installed Android.
  - Poster no-show or late cancel → the worker gets the recorded % from the held funds and the rest is released. **Not built yet.**
  - Stripe TEST probe: a partial capture (`amount_to_capture`) leaves the remainder released with `amount_refunded` 0 and no refund object. The existing settlement also requires a completed and confirmed gig.
  - Fee execution therefore needs a forward migration: a fee-capture record plus a cancelled-gig settlement path. Late cancel also needs the stop command and all three clients (their stop-receipt fences accept only `released`/`refunded`/`none`).
- **P06 record + freeze:** done (PR204).
- **Large text / dark mode:** approved when default light mode stays pixel-identical. Android gig detail is done in PR210 (proof in the bundle). iOS and web are not audited yet.

### Decisions still needed from the founder

1. **P04 fee share.** Does the worker get the whole fee, or the fee after the normal 15% platform share (what the existing refund-proportional settlement would pay)?
2. **D07 "Set expiry".**
   - No endpoint can change member access dates.
   - Options: (a) remove or disable the control (a design change), or (b) add a shorten-only access-window operation (product/security decision plus a migration).
   - Related: lease residents are badged "MEMBER", and Change Role has no "Lease resident".
3. **R06.**
   - Native Identity entry: a native dashboard link to letters and passes.
   - Native letter PDF: view or download on native.
   - Guest copy: a verified guest still reads "Verified resident".
   - Manager role: it may still issue letters and passes.
4. Tips can still be sent on a task whose payment is disputed (tips are separate payments).
5. From earlier: non-owner viewers see "No bids yet" while a bid is mid-payment.

### New evidence (all cleanup verified: owned SQL rows 0, TEST objects refunded/canceled/deleted, ledgers unchanged)

- Stream 1:
  - `20260923-stream1-p03-ios-tip-r1` (MANIFEST `df1187bf0648…`): P03 **iOS** native tips.
    - Covered: new card; dismiss → Cancel tip; 3DS success; 3DS failure → same-intent recovery; three-tip limit; reload total $30.
    - iOS adds the Tip line only after a reload (Android updates it in place).
  - `20260923-stream1-p06-disputed-capture-freeze-r1` (PR204).
  - `20260923-stream1-u02-android-sheets-a11y-r1` (MANIFEST `b6c055ad4483…`, PR210).
  - `20260923-stream1-p04-no-show-release-r1` (MANIFEST `a4182bfcacaa…`, PR211).
- Stream 2: `20260923-stream2-d07-member-expiry-r1` (MANIFEST `aa8764195…`, PR209). Its R06 bundles are in the table above.
- Stream 3: the bundles in the table above.

### Next actions

- **Stream 1:**
  1. Poster-fault fee capture: no-show 25% first, then the stop-command late cancel.
  2. iOS equivalents of the P08/P09 Android journeys.
  3. U02 audits on iOS and web.
- **Stream 2:** D09 malformed-success readers → D02 unknown-save → D10 household delete cleanup.
- **Stream 3:** iOS Settings "Blocked users" count (PR pending) → booking notification routing (iOS/Android) → cold-start link binding.

## Resume point history — September 22, 2026, 23:44 UTC (first labelled 23:50; superseded by the block above)

### Operating model from 23:50 UTC — founder direction: "resume all work, all 3 streams"

The founder asked this Claude coordinator session to run **all three streams** and finish every locally actionable criterion with real simulator/emulator verification.
- **Streams 2 and 3** are now run by Claude background agents, not the idle Codex tasks `01a0c0d4…`/`01a0a824…`. **Do not resume those Codex tasks on these worktrees** unless the founder reassigns them.
- Each agent writes only its own new work checkout, runtime, devices and evidence bundles. The agents do **not** edit or commit this hub. The coordinator integrates status here, reviews every PR and merges serially after exact-head CI.
- **One heavy native build at a time across all streams:** `/private/tmp/pantopus-tools/heavy-slot.sh acquire "<stream>: <purpose>"`, then `release` right after the build and install.
- Shared Android UI helper: `ANDROID_SERIAL=<own emulator> /private/tmp/pantopus-tools/aui.py dump|tap|has|shot`.
- Device/port ownership is unchanged:
  - Stream 1: `emulator-5558`, `C2BCF36A…`, ports 18132/18133, SQL 64562.
  - Stream 2: `emulator-5556`, `6F914A30…`, ports 18143/18142 (+18144–18149 for new runs), SQL 64554.
  - Stream 3: `emulator-5554`, `0AE16FA0…`, ports 18130/18131 (+18134–18139), SQL 64532, Mailpit 64535/36.
  - `iPhone 17 EB5AD759` and `:8000` stay the founder device session; do not touch them.


The coordinator role moved at about 21:05 UTC to the Claude Code session "Pantopus Stream 1 coordinator handoff" (Stream 1 developer + coordinator). Before any writing it verified that the previous Codex coordinator thread `01a0c897-33be-7011-b55b-b82291ba9fd2` had completed at 20:35 UTC, and that the Stream 2 (`01a0c0d4-2278-71d3-bc23-a9d789d2afeb`) and Stream 3 (`01a0a824-301b-74e3-a1d9-b205714ed7a1`) Codex tasks had been `task_complete` since 20:07/20:15 UTC. **The coordinator cannot message Codex tasks.** The founder relays the peer assignments below, or authorizes the coordinator to act for those streams. No duplicate agent was started for a peer worktree. The 20:00 UTC consolidation is preserved below as history.

### Integration queue — complete

| PR | Exact merged head / fresh CI | Merge commit |
|---|---|---|
| 192 Emergency edit | `ea044ebea7` / `35776302859` (all jobs incl. Android) | `37cb6d2167b1a59e7e77406feda59ca97873927c` |
| 193 booking receipt/notice | `4d38c43ec4` / `35785266136` | `6f7c700e6cfefa8fd070b74b354160b921e80b68` |
| 194 registration return | `e8ccf56e51` / `35785918190`. The coordinator resolved the single `ConfirmedView.tsx` import conflict by keeping both imports. | `094ed5826bcfd36a6f956984103e861e484dbd93` |
| 195 Android Local block state | `7f557a0069` / `35786420151` | `86f63a0eaf70dfc808950649aae34ef45015c985` |
| 196 booking cancellation/refund | `46330f275a` / `35790106402`; PR193 labels already cover its `capture_pending`/`refund_pending` states | **`b36d379b2362cd35b2a15d86892400796304b46e`** (final master) |

Final canonical migrations end `20260922023000` (public230) → `20260922023100` (public231). Applied history was not rewritten; retained prototype ledgers are untouched. Docs PR161 (`1a9317245`, only three superseded summary lines not carried) and PR170 (`815b6e495`, 117-line `native-social-r1` history appended verbatim) are merged into this hub branch and land with PR174. **Master merges do not deploy:** in Deploy Backend run `35789209741`, the check passed and every build, migration and deploy step was skipped (backend deployment disabled). **Aggregate master CI passed:** run `35791805610` on `ce690c375` (the code at `b36d379b2` plus PR174 docs) passed every job: backend, web, E2E, schema replay, seeder, Android lint/test/assemble and instrumented tests, and iOS on iPhone SE/16/16 Pro. Run `35791178691` on `b36d379b2` was cancelled when PR174 merged; that is not acceptance. The earlier `2048d971` iOS iPhone 16 CeremonialMail timeout did not recur.

### Stream 1 milestones since takeover (heavy native slot released at 22:13 UTC)

All three run on APK `db303e5bbe782a089715f8b91808b4f37c5fa3c96841edb37d23f8ac29365077` (master `094ed5826`; later merges touch no gig refund/tip path), the owned `emulator-5558`, real Stripe TEST and the retained wallet-read-r1 candidate ledger (88 rows, unchanged). Cleanup was independently verified (TEST intents refunded/canceled, customers deleted, owned SQL rows 0):

- **P09 Android payer** — audit `20260922-stream1-p09-android-r1`, MANIFEST `670186c9170493fa9b2caf7e72c6d6136c58a13f64508aea7b124d8decaed5e9`. Covers: authorization, owner capture, partial refund, lost committed reply → Check status (no duplicate), disabled over-limit Continue and hold release. Post-refund wallet release credited exactly the refund-aware 213 of 1063.
- **P09 Android refund failures/denial** — audit `20260922-stream1-p09-android-faults-r1`, MANIFEST `7a38ecf7a58fb0897e8a81ddb0e4984695a8cd2d0db63de980484ff96c6d4fce`. Covers: provider down → one refund after the one-minute lease; provider-created refund with lost reply → adopted on retry with no second create; worker/stranger 403 with no worker controls.
- **P03 Android native tips** — audit `20260922-stream1-p03-android-tip-r1`, MANIFEST `f81b0244a24f64dfc610e02d55ea3beb399f29bbddd4d627dd0f7ff1457237ec`. Covers: new-card tip, sheet-dismiss pending → Cancel tip, 3DS success, 3DS failure → recovery on the same intent, and the three-tip limit.
- Harness gaps found and fixed inside the bundles (not app defects): the Android bid panel needs the real `offersV2` router, and Android paid-bid admission needs the login `sessionId` that the real bearer login returns.
- Observations (UX proposals, no reproduced production failure):
  - A credential without `sessionId` makes Accept a silent no-op. Check whether the server returns one for unbound sessions.
  - A refund retry inside the one-minute lease returns "pending" without explaining the wait.
  - The tip-limit message is generic.
- **P06 Android dispute (22:20–22:33)** — audit `20260922-stream1-p06-android-dispute-r1`, MANIFEST `58aff8a5a1001c9c9fe8154a138b3721f7c37d3231b35cd4abe1a961a16b3e73`. Stripe's immediate-dispute TEST card reproduces the documented capture-proof boundary (`stripeService.js:1109-1113`, deferred by `0654e856e`):
  - Confirm completion returns 409 "Captured charge needs reconciliation" and the Payment stays `capture_pending`; the dispute is recorded but not frozen.
  - The payer sees Authorized/Capturing, not the dispute; refund returns 409 DISPUTED.
  - A won dispute restores `captured_hold` without `captured_at`.
  - Settlement refuses payout even after 48h, so money is safe but stuck.
  - **Founder/design decision needed**: record the capture and apply the existing dispute freeze, or build operator reconciliation. No code change was made.
- **P08 Android checkout lifetime (22:32–22:44)** — audit `20260922-stream1-p08-android-account-r1`, MANIFEST `75f3381e09f32c11ea8570cb112f8bf52f2dc4e95d1d1b381720d6cdf0a1c162`. Covers:
  - Sheet dismissal cancels the setup.
  - After process death the owner is offered Resume/Cancel for the same bid.
  - Remote revocation (fixture 401) signs out with "Your session has expired".
  - Another account on the same device sees no checkout (owner reads 403).
  - The owner's cancel voids the intent.
- **U02 Android payment screens (22:48–23:03)** — audit `20260922-stream1-u02-android-payment-a11y-r1`, MANIFEST `26ca2ea80ad573a40310398304d854b158c612df1e99cea3d90035f922aeb33b`. Font scale 2.0 and dark mode are usable, except that a dark-mode tip-sheet title was nearly invisible. That is **repaired and merged in PR198** (`6f3436bf3` → master `4cc024ba3`, one file, theme-aware sheet text; light mode pixel-identical; APK `d95cbe13…` now on emulator-5558). Layout proposals needing design approval: the WINNER badge and progress-label wrapping at 2.0.
- Rows: P03, P06, P08, P09 and U02 stay partial.
  - P03: iOS native tips and unavailable local-storage recovery.
  - P06: the capture-proof decision, normal-path native presentation, and Connect/hosted operation.
  - P09: historical Connect reversal and broader close/release.
  - The count is unchanged.

### Owners, checkouts and reservations

| Stream | Application checkout | Runtime / devices | Next |
|---|---|---|---|
| 1 + coordinator (Claude) | `/private/tmp/pantopus-paid-gig-integration` on local `codex/stream1-verification-20260922` at final master `b36d379b2` (clean, no commits). Coordinator checkout `/private/tmp/pantopus-pr192-integration` detached at `094ed5826` is the APK source (ignored build outputs/backend deps only). The historical `codex/paid-gig-integration` ref is preserved. | No API/Next running. Retained SQL64562/PostgREST64561 ledger88. `emulator-5558` keeps the P09/P03 APK with app data cleared; iOS `C2BCF36A…` idle. Heavy slot **unassigned**; Stream 3 has the next claim. | Next Stream 1 criterion: iOS equivalents of the P03/P08/P09 Android cases, once the heavy slot is free after Stream 3's iOS parity build. The P06 capture-proof boundary waits on a design decision. |
| 2 Home (Codex `01a0c0d4…`, idle) | `/private/tmp/pantopus-workstream-home` at `ee69cbd8d` (now merged through PR192). When starting R06 the owner moves to a fresh branch from master, preserving `.next-stream2`. | API18143/LAN18142 retained; its `home.js` runtime patch is **identical** to merged PR192 (47 added lines), so adopt master at the next restart and keep the backup. `:8000` from the Home worktree is the founder device backend. SQL64554/PostgREST64553, emulator-5556, iOS `6F914A30…`. | **R06**, below. |
| 3 Accounts/social (Codex `01a0a824…`, idle) | iOS `/private/tmp/pantopus-workstream-accounts-social` `b956a0076` (preserve `publicShare.ts`/tsconfig edits, `.next-stream3`). Android `/private/tmp/pantopus-stream3-android` fast-forwarded by the coordinator to merged `7f557a006` (clean). | SQL64532/PostgREST64531, Mailpit64535/36. **Correction:** Next `[::1]:18131` is running (pid 15494 from the Stream 3 worktree), contrary to the 20:00 note; left untouched. iOS `0AE16FA0…`, emulator-5554. | **iOS parity of PR195**, below. Gets the heavy slot next. |

### Peer assignments (existing tasks; founder relays)

**Stream 2: R06, residency letters.** Backlog criterion: "Residency passes/letters are separate from household admission: verify issue, view, revoke and public-verification access independently." Existing implementation: `backend/routes/residencyLetters.js` mounted at `/api/homes` (`POST/GET /:id/residency-letters`, `GET …/:letterId/pdf`, `POST …/:letterId/revoke`), public check `GET /api/public/residency-letters/:code` (`backend/routes/public.js:730`), `backend/services/residencyLetterService.js`, legacy migrations 157/189, web Identity → Residency letter controls, iOS `ResidencyLettersEndpoints.swift`, Android `ResidencyLettersApi.kt`/`ResidencyLetterDtos.kt`. Reuse PR45 (merged 2026-09-14) expiry projection/labels and its Chrome evidence; do not repeat expiry-label checks. Remaining work: real web UI→API→SQL issue by an authorized member; view/download; public verification by code showing only the intended fields; revoke; the public check then showing revoked/invalid; denial for non-members, removed members and unauthorized roles; letter issue/revoke not changing household admission, and admission changes not silently validating letters. Then the installed Android/iOS callers on the retained devices. Repair only a reproduced defect, in place. Hand off with a durable bundle plus manifest, an in-place update to row R06 in live 02, and a PR only for a repair. The coordinator merges.

**Stream 3: iOS parity of the PR195 defect (N04/N03).** PR195 fixed Android only. iOS `frontend/apps/ios/Pantopus/Features/Profile/PublicProfileViewModel.swift` `loadRelationship(id:)` (about line 630 on master) reads only `GET /api/users/:id/relationship`, which excludes personal `UserBlock` rows (`GET /api/users/blocked`, `backend/routes/blocks.js:138`). On a read error it leaves `canFollow` true. Remaining work: on installed iOS `0AE16FA0`, after a personal block from a Local-profile neighbor, a fresh profile open must not restore Follow/Connect, unblock must restore them, and a failed blocked-list read must fail closed. Also check the web public profile reopen. Reuse the PR195 fixture recipe (Home `2ca4bc33…`, Bob owner/Evan member, LocalProfile overlay) and its Android evidence; do not rerun Android. If reproduced, mirror PR195 minimally: Local scope only, Persona/Relationship policy separation preserved, no layout change, no new tests. The iOS build needs the heavy slot after Stream 1 releases it. Hand off with a PR, a bundle and an update to live 03.

### Unchanged rules

One writer per application worktree. The coordinator owns shared status, the backlog and merges. Preserve designs, fixtures, retained ledgers and runtime patches. No new unit tests, trackers or speculative rebuilds. The count stays **9 closed / 71 partial-open**; nothing since the takeover closes a whole row.

---

## Historical coordination and grants — preserved

## Consolidation checkpoint — September 22, 2026, 20:00 UTC (superseded by the current resume point above)

The founder requested that all three streams summarize **all implemented fixes, verification, evidence, cleanup and next actions** so another agent can resume without losing or repeating work. That consolidation is now the active documentation milestone. These current summaries supersede older chronological checkpoints; original reports/history remain preserved.

Read the current summary at the top of each existing status file:

- [Stream1 current summary](01-gigs-payments.md), [Stream2 current summary](02-home-household.md), [Stream3 current summary](03-accounts-social.md).
- [Shared handoff](../PROJECT_HANDOFF.md), [authoritative80-row backlog](../REMAINING_WORK_2026-09-11.md), [verification-first rules and preserved reports](../VERIFICATION_FIRST_2026-09-13.md).

### Single live location and existing owners

Live hub: `/Users/yingpengwang/pantopus-coordination`, `codex/workstream-coordination`, PR174. Stream files here are live; supplemental docs161/170 retain history and must not overwrite current summaries during merge. No new tasks, agents, tracking documents or accepted-journey reruns were needed for consolidation.

| Existing task / owner | Application checkout and source | Current owned runtime |
|---|---|---|
| Stream1/coordinator `01a0c0d1-0703-70c3-b842-6d01bc8ca48b` | `/private/tmp/pantopus-paid-gig-integration`, `codex/booking-cancellation-recovery`,3f82ae4786 clean/pushed. Separate PR192 integration checkout detachedea044ebea; PR190 checkout7a555c92e preserved. | API18132/Next18133/browser stopped. Retain SQL64562/PostgREST64561 ledger88; Stream1 simulatorC2BCF36A… and own AVD. |
| Stream2/Home `01a0c0d4-2278-71d3-bc23-a9d789d2afeb` | `/private/tmp/pantopus-workstream-home`, `codex/native-emergency-edit-20260922`,ee69cbd8d; untracked Next cache preserved. Docs161 at4d33f5f53 incorporated into live02. Original checkout remains behind integration intentionally. | API18143/LAN18142, SQL64554/PostgREST64553 retained. Backend detachedcc885ab23 has accepted local home.js patch/backup; preserve. Android5556/iOS6F914A30…; physical iPhone unavailable4016. |
| Stream3/accounts-social `01a0a824-301b-74e3-a1d9-b205714ed7a1` | `/private/tmp/pantopus-workstream-accounts-social`, local/stream3-ios-integration b956a0076; existing unrelated web edits preserved. Android `/private/tmp/pantopus-stream3-android` clean3b374454a. | API18130/Next18131 stopped; SQL64532/PostgREST64531 and Mailpit64535/36 retained. Android5554/iOS0AE16FA0… preserved. |

**Heavy native slot: unassigned.** Stream2 released it in its published handoff. Do not infer a Stream3 N03 grant or launch a build during this documentation task. Before any later build/install, coordinator records the owner, actual process check and resource reservation; idle daemons are not permission to kill caches or peer processes.

One writer per application worktree. Stream1 owns P/G/O/L and shared integration; Stream2 H/R/I/D/F/M; Stream3 N/A; U checks accompany each. Coordinator owns shared handoff/backlog/README and merges. Preserve source/fixtures, compare existing and archived implementations first, reproduce before a minimal repair, and preserve all visual/navigation designs. No new unit tests or unit coverage target.

### Current integration order

| Item | Current source / evidence | Next action |
|---|---|---|
| Master | `2048d971396a4a2e83e4d61bb612b395760cf97c`, PR191 merged;189/190/191 exact-head CI passed | Recheck remote and aggregate master CI; never infer aggregate success from canceled older runs. |
| PR192 | `ea044ebea7aedfae5c939e65ac1bccd841fc9e47`; CI35776302859 native jobs pending. Preserves both accepted Edit and Delete; original installed source `ee69cbd8d` retained. | Finish fresh CI, then merge reviewed head. No repeat native build/journey needed for unchanged preserved behavior. |
| PR193 | `877ad94f6802227bc02f654d26a617203874227c`, CI35759729609 passed; booking payment wording/notice destination | Update after192; require fresh exact-head CI. |
| PR194 | `8b2bd6e05f871d0f9ac501601313cece64abaa8e`, CI35761158118 passed; registration return | Update after193; require fresh exact-head CI. |
| PR195 | `3b374454ad07060cf5dcaa1ce02fc48b3be4c88e`, CI35768401037 passed; Android Local block state on reopen | Update after194; preserve Persona/Relationship policy separation. |
| PR196 | `3f82ae4786362a31069539080bff28f603e68f2d`, CI35771063543 passed; booking atomic cancellation/recovery and stale-capture guard | Update after195; public231 must follow230 without rewriting applied history. |
| Docs161/170/174 | Open. Home summary through4d33f5f53 is incorporated in live02; social summary is in live03; full history preserved. | Integrate docs last, preserving the current summaries and all original evidence/history. PR46 remains untouched. |

### Resume safely

Each current stream summary contains completed code groups, precise source/CI, existing evidence paths and hashes, row-specific open criteria, cleanup and next action. Coordinator checked96 manifests/2,084 listed hashes without repeating product journeys. Home's pushed summary existed despite empty task replies and is now incorporated; use it instead of recreating work. The all-app count is9 closed/71 partial-open; no new closure from this handoff.

Do not overwrite applied ledger rows, promote private prototype histories into canonical migrations, clear untracked user work, reset dirty runtime patches, or reuse another stream's ports/device/fixtures. Refresh exact Git/PR/CI state before acting; read private operational notes without exposing credentials or raw logs. Accepted unchanged evidence is reusable. Skipped CI jobs and unavailable provider/device boundaries remain explicit; no silent assumption of end-to-end success.

The original working agreement and historical grants remain below for context. Their dated branch/slot/port snapshots are superseded by this summary, while preservation and single-writer rules continue to apply.

## Current coordinator checkpoint — September22, 19:05 UTC

PR189 merged6bec1e878 after exact073f0806a fullCI35766200401. PR190 integration7a555c92e
retains tip and won-dispute worker guards;128 existing regressions pass. Migration guard
caught225 sorting behind merged226; public230 preserves the original225 SQL/ledger and
accepts its exact prior transformation. RealSQL preservation and fullCI35771059661 pass.190 merged ea43d92b3 at19:04:59UTC.
191 merged2048d9713 after exact1b9e43788 fullCI35771470998 at19:49:24UTC.
192 integrationea044ebea is pushed to the existing PR; fresh checks are required. Three
conflicts retain both accepted PUT/Edit and DELETE behavior; API/repository members and
shared comment reconciled. Merge of191 caused no additional source delta. Original Stream2
worktree and installed evidence remain untouched; no native build or accepted journey rerun.
Queue192→193→194→195→196, then docs161/170/174;46 untouched.

PR1963f82ae478 is published with real booking cancellation/refund recovery and capture-race
repairs. Seven StripeTEST bookings covered database rollback, pending recovery, manual worker,
captured refund, both approval/cancel race orderings, forbidden actor/concurrent retry and lost
reply.107 existing checks pass; no new unit tests. FullCI35771063543 passes, including full schema replay and production web build.31-file evidence
MANIFESTe0619dec00aa1c562cf52de7e8793e23671ebf0b4cf55dc7a35db5b4c258226f.
All owned provider/SQL/auth fixtures cleaned; API18132/Next18133 stopped and Chrome closed.
Retain ledger88 unchanged: original84 plus private228/229, public230/231; earlier224 remains
as previously archived. Public231 matches the tested cancellation function exactly. No
hosted deployment, natural scheduler delivery or whole-row closure is claimed.

Coordinator recovered Stream2's completed11-file ee69cbd8d preservation evidence and copied
it unchanged to durable20260922-stream2-native-emergency-edit-preservation-r1; all hashes
verified, original MANIFEST224096ef2d8be6fc42133397140131aef8f663eb7c8e0c58c0170d96e6e4521e.
Adding the integration receipt yields12 files, MANIFEST9993d82400671c7a5249ac0e8cb159a5c303cfda2b4ba013b663212226ffa5d0.
Installed title-only preservation,403/retry, malformed type and wrong id/home retain the form;
coordinator independently confirmed HomeEmergency/override/audit counts0.192 fullCI35764090022
passed. Its prior bundle claim was missing; this recovered bundle is the actual durable owner.
Last four Stream2 follow-up turns completed with no output; no new progress/slot release or
40-row accounting is inferred. Existing backend/LAN runtime is preserved. 192 is accepted within its recorded preservation scope and remains queued after191;
its completed journeys must not be rerun. Outstanding row accounting does not block this repair.

Stream3's198-file bundle hashes pass, MANIFEST1fa796d1b6f08e89b549f0aadf0f6986241fbd511184ff2825dc889071957f26.
A04 actual installed AddHome/API unavailable response retains draft, offers Retry/Edit and
disables Continue. Retry and discard/logout pass; no application repair. Literal%20 street
input limits normal-address claims; successful external geography/unit resolution is unverified.
Installed profile readback503 preserves2 unsaved; restored grant/retry200 shows saved;
exact cleanup/logout/API stop recorded and XMLs independently checked.
Android cold-process session/profile200 and logout200 are accepted within local scope;
portfolio chooser reaches actual upload500 due invalid storage credentials, no partial File.
iOS installed destination remains a precise UI-control boundary.1953b374454a fullCI35768401037
passes; remains queued after194. Stream3 corrected its authoritative mapping: N02 is physical
Android acceptance and A04 is address/Smarty coverage; OAuth belongs toA01. The older current
table is corrected too. Stream3 continues the next genuinely unverified local criterion or
records exact remaining device/provider/policy prerequisites; no repeated outage variants.
Count remains9closed/71partial-open; P01 is a separate bounded milestone.


## Active cancellation repair — September22, 18:30 UTC

Actual Chrome cancellation under a45-second refund-queue SELECT denial returned200 and a
terminal success page while TEST1250 remained authorized and no refund request existed.
Reload offered no recovery. Exact original grant restored; reproduction.json/provider/SQL
receipts retained privately under stream1-booking-cancel-r1. Normal A release passed.

Root candidate extends existing booking service/public route/refund orchestration and web
cancel/manage screens. Forward20260922022800 atomically reserves the existing refund request
with Booking cancellation and a frozen decision in existing Payment metadata; no new table,
column, screen, service or unit test. Applied only to retained owned SQL64562: ledger84→85,
all84 prior rows exact, anon/authenticated execution denied and service_role allowed.
Source SHA2561f04aee96c7a34586d1f6b6d91b88430d5fab3c3d8d6ce4223af2f3596550d3b.
Candidate remains uncommitted and NOT accepted.64 existing relevant checks and web typecheck
pass; real fresh transaction-failure/provider-failure/retry/worker verification is underway.
Legacy B now truthfully displays payment-needs-review; no historic cancellation policy is
invented. B's real held TEST authorization still needs explicit cleanup. API restarted at
owned PID/session72039, Next50617, Chrome257777434 active. No fault currently active.

PR188 merged715d62fed after exact e18fab7ae CI35765718055.189073f0806a runs fresh
CI35766200401.192 remains held for installed preservation;195 Android lint/test/assemble
failed35763514679 and its owner is assigned the exact-job repair. Stream2 retains native slot.
No whole-row closure;9closed/71partial-open. Prior checkpoint/runtime paragraphs are history.


## Current checkpoint — September 22, 18:15 UTC

PR186 merged d845ed22d after fresh CI35764010625; PR187 merged 7c4a2702f after
fresh CI35765132114. PR188 now e18fab7ae runs CI35765718055. Current-master
aggregate remains pending; paid integration retains previously accepted a460.
Queue188→189→190→191→192(preservation hold)→193→194→195, then docs161/170/174.

Stream1 cancellation fixture f9220541 is active on API18132/Next18133 against
retained SQL64562/API64561, branch codex/booking-cancellation-recovery at96356ea80.
Actual Chrome checkout and real Stripe TEST authorization followed by ordinary invitee
cancellation passed: Booking cancelled, provider authorization cancelled, one successful
PaymentRefundRequest release; no capture or cash-refund claim. Second failure fixture is
not yet created; Chrome controls are intermittently timing out. No database fault or app
repair has been applied. Existing receipt/account-link findings remain owned by193/194.
Stream2 owns the native slot for192 preservation and malformed-response verification.
Stream3 continues its next local boundary;195 remains its one-file current-master repair.
Retain ledger84 and fixture/provider cleanup references privately. Count9closed/71partial-open.


## Stream1 runtime reservation — booking cancellation, September22

Reserve API18132/Next18133 and one new Chrome tab for owned fixturef9220541 against retained
SQL64562/API64561. Branchcodex/booking-cancellation-recovery starts at currentmaster96356ea80;
its master aggregate remains pending, and no application change is made. Verify existing real
booking cancellation/refund failure recovery using actual Stripe TEST, synthetic identity and
page/availability; no hosted mail/push/native build. Prior39/40 fixtures remain cleaned.
Stream2 owns the heavy native slot. Preserve the original84-row ledger and all peer resources.


Current checkpoint: PR184/185 merged after exact-head full checks;186933b60326 runs freshCI35764010625. Currentmaster963 aggregate remains pending. Root's populated two-Home-forward rehearsal preserved15,232 rows across387 tables and existing financial/document records; two affected SQL workflows passed, scratch fixtures removed, original ledger84 and all table fingerprints unchanged. No G03/G04 closure or hosted adoption. Root source-reviewing booking cancellation recovery; no active API/browser. Stream2 owns native slot for192; Stream3's195 now has only its profile repair. Details/evidence in newest01 section;9closed/71partial-open unchanged.


## Native slot update — September22, 17:50 UTC

Stream3 explicitly released the slot after N02 HTTP500/retry and N03 profile-block reopen
verification, exact cleanup and API shutdown. All181 bundle hashes verified. Stream2 now owns
one focused PR192 preservation build/install; Stream1 continues source/SQL review only.
PR195 publication must use current master plus its one-file repair, retaining the installed
integration build and reusing unchanged source evidence. No extra verification-only PR.


## Current checkpoint — September 22, 17:44 UTC

PR closure audit verifies that171/172 reused fixes already merged through164–168;38–42
were incorporated through43.159's full history and158's documentation are preserved in open
replacement PRs174/170; those documents are not yet merged. All nine current closed-without-
merge PRs were checked, with no discarded application changes found. Exact descriptions and
replacement links are corrected; see the newest Stream1 section for evidence and process limits.

PR183 merged3e8d11dfd after exact-head full CI35757736325.184's update is requested; fresh-head
CI is required. Paid integration is pushed at previously acceptedmastera460, fullCI35757725186
and migration guard passed. PR194 fullCI35761158118 passed;193/194 remain queued for integration.
Stream1 has no API/Next/browser/native runtime; all booking fixtures cleaned, ledger84 unchanged.
Stream3 owns the native slot;192 remains held for preservation review. Docs161/170/174 last;
9closed/71partial-open unchanged. Earlier runtime snapshots below are historical.

Current September22 checkpoint: PR193 passed fullCI35759729609; PR1948b2bd6e05 is published with real free-booking → registration → existing-account → saved-booking proof, exact cleanup and freshCI35761158118 running. Stream1 now has no API/Next/browser runtime; ledger84 retained unchanged. Queue183 waits only Android lint/test/assemble.192 remains held for data-preservation review. See newest Stream1 status for evidence and limits; count9closed/71partial-open unchanged.

Current runtime override, September22 17:20UTC: Stream1 uses only API18132/Next18133 and IAB13 for owned free-booking signup fixturef9220540, provider creation forbidden. Branchcodex/booking-account-continuation frommastera460; no application change yet. The receipt links to /signup while the existing auth route is/register; actual link verification underway. Previous193 paid fixtures remain cleaned. Stream3 retains heavy-native slot.


## Current coordinator checkpoint — September 22, 17:18 UTC

Booking PR193 `877ad94f6` is published; real Chrome/Stripe TEST/host approval/worker/web
notification/SQL verification and exact cleanup passed. Required CI35759729609 passed.
Three existing files fix uncaptured “Payment received” wording and the `/gigs/null` booking
release link.21-file evidence MANIFEST `615be4471455d0bbfb91dbe03aab918820b119534149189418cf53cc80f8a526`;
full details and limits are in Stream1 status. No whole-row closure. API18132/Next18133 and
owned tabs are stopped/closed; retain ledger84 unchanged. Stream1 app is clean/pushed.

PR182 merged as `a460fd5d1`; PR183 `990d05e9d` still runs fresh Android checks. Continue
184→185→186→187→188→189→190→191→192→193 after each predecessor, with192 held for
its precise data-preservation review. Stream3 holds the sole heavy native slot for the new
reproduced N03 reopen defect. Stream2/3 row accounting is underway. Stream1's25 P/G/O/L rows
and5 U rows are reconciled in the existing status file. Count9 closed/71 partial-open;
P01 remains a separate bounded milestone. Docs161/170/174 remain last.


## Active native reservation — September 22, 17:13 UTC

Stream3 owns one focused Android assemble/install for the reproduced N03 local-neighbor
block state lost on fresh reopen. Existing fixtures/device only; no schema or redesign.
Stream2 continues PR192 preservation review and accounting without another native build.
Stream1 uses only its web/API/SQL booking runtime. Release the slot explicitly when done.

## Current reconciliation — September 22

The founder requested an accurate account of days of work after the closed count remained
unchanged. G02 is now closed on verified Git ancestry and preservation evidence: PR34 and
PR47 are merged, both original histories remain in master, and unrelated local work is intact.
Current inventory: **9 closed / 71 partial or open**, with P01 still a separate completed
bounded milestone. This is a stale-accounting correction; the founder performed the merge.
[G02 evidence](../../../skinny-pantopus/.pantopus-recovery/audits/20260922-stream1-backlog-g02-closure-r1/RESULT.md),
MANIFEST `659f9f4761c1adbfd0d7e20419afed8f4324b6ea83b88808e50e98db0720717d`.

Streams2/3 are reconciling exact unmet criteria and closure candidates in their existing
status files while safely completing current milestones. Stream1 owns the matching payment,
integration and launch accounting. Do not equate partial workflows or merged repairs with
whole-row closure; do not impose unrelated hardware/provider gates. The founder reaffirmed
real client/API/SQL success, failure, recovery and edge-case verification, with no new unit
tests or coverage target. Preserve designs and accepted evidence.

PR177 merged `50b1ee8d7` after CI35751227114; PR179 merged `1313ea68b` after CI35755064344;
PR180 merged `fc29902ca` after CI35755564437. PR182 merged `a460fd5d1` after full
CI35756333346. PR183 `990d05e9d` now runs fresh CI. PR191/192 are published for coordinator
review after190; docs161/170/174 remain last. Current master aggregate CI is pending.

Booking verification reached real Chrome checkout, actual TEST1250 authorization, real host
Approve200/capture and confirmed SQL. Controlled maturity plus the existing worker credited
1063 to the host wallet. Reproduced: confirmation said Payment received before capture;
payer release notice says a gig and points to /gigs/null, which returns realAPI404/Gig not found.
Candidate branch codex/booking-payment-receipt now repairs status wording and the booking
notification destination in three existing files; verification is underway. IAB's
blank Stripe frame is a separate browser boundary; Chrome card checkout succeeded. Owned
f9220539 provider objects, two bookings and three synthetic identities are still retained
for repair verification/explicit cleanup; ledger84 unchanged. API18132/Next18133 and two
owned browser tabs are active. No native build. Earlier runtime/count checkpoints are history.


## Active coordinator checkpoint — September 22, booking verification

Stream1 reserves API18132/Next18133 against its retained wallet-read-r1 SQL64562/API64561
for owned f9220539 priced booking verification. Existing ConfirmFlow/CheckoutPanel →
public booking route → bookingService/schedulingPaymentsService/stripeService →
Booking/Payment is the current source trace; no application defect or repair yet.
Synthetic fixture identity and page/availability; actual Stripe TEST only. No hosted mail/push,
new schema or native build. Original ledger84 is snapshotted and preserved; prior tip fixtures
remain cleaned. Stream1 API/Next process details and provider cleanup references stay private.

Stream2 is assigned the reproduced single-file Emergency create dismissal repair, followed by
existing Emergency Edit persistence: compare all refs/archives and extend the existing Home
emergency route only if no update contract can be reused. No parallel service/table, new unit
tests or redesign; real client/API/SQL and permission/failure/retry required. It completed an
owned build for the dismissal candidate and is cleaning its fixture. Reserve before next build.
PR171/172 are closed without merge; their verification branches/evidence remain preserved.
Queue177 still awaits final iOS CI, then179→180→182→183→184→185→186→187→188→189→190;
docs161/170/174 last. Counts8closed/72partial-open remain unchanged.


Provider preparation2026-09-22: current consolidated L01 pricing/activation draft is in [the existing release checklist](../release/prod-config-checklist.md). No purchases/activation; exactAWS/entitlement/policy components remain. See newest Stream1 checkpoint; counts8closed/72partial-open unchanged.

## Current coordinator checkpoint — September 22, 16:13 UTC

PR1906c49692d6 completes bounded tip wallet release delivery: fresh actual TEST/web/API/SQL,
atomic notification fault rollback, concurrent/repeated release, tip refund/debt/proof/lease
controls,125 existing tests and full CI35751529326 pass.22-file MANIFEST
9832f273d1653f4c7ebb7e2c981f18e6e47374cd44154436800e17f206560f65 independently verified.
Both TEST1250charges refunded/customers deleted;22 cleanup checks0 each; owned browser
sessions, API18132/Next18133 and Next artifacts cleaned. App branch clean.
PR185 e4e552075 additionally repairs the reproduced40P01 stop lock-order regression:
forward226 restores20900 wrapper and won inner guard; actual concurrent SQL plus27 guards
and full CI35751454258 pass. Existing won-release proof preserved in19-file updated MANIFEST
e0447e564e236c0fb24709319299cfa2704d483cdd9f401e968c4a55dab97c48.
Retain owned SQL64562 ledger84/original79 unchanged. Applied224 is superseded private
candidate-only history, exact archived SQL;225/226/227 forward repairs preserve all prior
rows. This is not hosted/canonical ledger adoption. No native/hosted/Connect/push/full-row
closure. PR bodies and private RESUME updated. Heavy native slot free.
PR168 merged b30e0d395; PR1775129406fd freshCI35751227114 still runs iOS.
Queue177→179→180→182→183→184→185→186→187→188→189→190; docs161/170/174 last.
Eight closed/72partial-open unchanged. Earlier runtime checkpoints are historical.


## Active coordinator checkpoint — September 22, 16:04 UTC

PR168 exact142220190 passed CI35746647258 and merged b30e0d395; PR177 refreshed
5129406fd with fresh CI pending. Prior master3c1e4a47d aggregate35746635358 passed.
Paid integration retains last accepted f9176 while repair branches remain separate.
PR185 reopened for a concrete regression:22300 replaced the20900 stop wrapper;
actual concurrent settlement versus Gig→Payment locking reproduced40P01. Forward226
restores the exact20900 wrapper and applies the won guard to its inner function.
Candidate e4e552075 passes the real lock check and27 existing rollback guard cases;
fresh CI pending. Do not merge185 until its repaired head passes review and CI.
PR190 candidate6c49692d6 renumbers unmerged224→227 and targets the canonical inner
function after clean-schema CI exposed the wrong target. Applied224 is retained as
an explicitly superseded private candidate-only ledger entry, exact archived SQL;
no applied rows changed.225 refund proof remains. Retained SQL64562 ledger84 with
all prior entries unchanged; canonical full replay remains CI-owned/pending.
Fresh ownedf9220538 actual TEST1250 tip has one income/settlement, two delivery rows,
and three notices after atomic failure/concurrent-worker controls. API18132 resumed,
Next18133 PID3909 and CUA tab11 active; provider/customer/SQL cleanup pending.
No native, hosted, provider-push or row closure claim. Heavy native slot free.
Queue177→179→180→182→183→184→185→186→187→188→189→190; docs161/170/174 last.
Eight closed/72partial-open unchanged. Earlier runtime checkpoints are historical.


Runtime update 2026-09-22 15:34 UTC: Stream1 API18132 PID3240/Next18133 PID3909 and CUA tab10 are active for owned f9220537 legacy tip release notification failure. Actual TEST1250 tip proof seeded as historical row; real worker credited1250 but lost both notices under INSERT denial and normal retry did not repair. New branch codex/tip-wallet-release-delivery based currentmaster3c1e4a47d (masterCI still pending); small existing-worker candidate plus reserved forward20260922022400 extends existing settlement/delivery functions to tips. Migration not yet applied; ledger80 retained. Provider charge/customer cleanup pending. Completed188 remains accepted. Heavy native slot free; Stream2/3 continue their existing assignments. Earlier runtime snapshots below are historical.

## Current coordinator checkpoint — September 22, 15:25 UTC

PR188cd6d6876c completes bounded won-after-wallet-income state repair: actual TEST baseline,
fresh first-delivery web/API/SQL, three truthful privilege failure/retry controls and51existing
tests/CI35745486220 pass.14-file MANIFEST4198e8d08fa19d016fef54dae9f30cf77b63852a47898f5a53851fa437b63057.
Both TESTcharges refunded/customerdeleted;22 SQL/auth/event checks0 each. API18132/Next18133
stopped/tabsclosed/appclean; retain SQL64562 ledger80 and original79 entries unchanged.
PR167 merged3c1e4a47d after766feed passed CI35740330734 and final installed notification-tap
proof; sanitized Stream3 156-file MANIFEST99bf0cb46f5127210137e35290932978fd914d2cca950d78e384ac50d41fa3c1 verified.
PR168142220190 runs freshCI35746647258; merged-master3c1e4a47d CI pending. Paid integration
retains last acceptedf9176. Stream2 completed189EmergencyDelete candidate0cbb505fe and
released heavy native slot;189CI35746587131 pending, coordinator evidence review next.
Queue168→177→179→180→182→183→184→185→186→187→188→189; docs161/170/174 last.
Verify-only171/172 never merge. Eight closed/72partial-open remain. Earlier checkpoints
below are historical; exact evidence/limits/runtime state are in the stream status files.

## Current coordinator checkpoint — September 22, 15:00 UTC

PR1878b4573cb9 completes bounded lost-dispute wallet recovery: actual TEST first-delivery
and retry web/API/SQL, truthful database errors, debt/proof controls,51 existing tests and
full CI35743104345 pass. Sixteen-file MANIFESTd42a9fedd0ce85fe1e325e5d5a75d02f0073341924f16e8b0c04a1e13a90152a.
Both fixture sets cleaned, customers deleted, lost TEST charges nonrefundable/no duplicate
refund; API18132/Next18133 stopped, browser tabs closed, app tree clean. Retained ledger80.
Current masterf9176cc2c full CI35740318739 passed; paid integration fast-forwarded/pushed
to that head after migration-policy check. Active app branch codex/lost-dispute-wallet-recovery
is based there. PR167766feedca still waits for Android lint/test/assemble. Queue167→168→177
→179→180→182→183→184→185→186→187; docs161/170/174 last. PR186cf34d604d is green; Stream3
146-file MANIFEST51339e601abe137bf8c636133d25d37b4cfddacd0a28a36ef7257515cdde3de0 verified.
Stream2 candidate183 Later/Share verification is in docs55bf17370; final durable/body/RESUME
handoff and heavy-slot release requested. Eight closed/72partial-open remain. Earlier
runtime snapshots below are historical; exact boundaries are in each stream's status.

Current runtime override, September22 14:44UTC: Stream1 reopened owned API18132/Next18133 for a fresh lost-dispute-after-income check, prefixf9220533, tab6. Provider cleanup pending; retainedledger80. Completed185 evidence/cleanup remains accepted. See newest Stream1 status. PR186 is now queued after185. Earlier runtime snapshots below are historical.

## Current coordinator checkpoint — September 22, 14:37 UTC

PR185 ae5364db9 is a completed bounded won-dispute release milestone: actual TEST
won event, real worker/web wallet1062 once,27 SQL guard cases, timeout/recovery checks,
80 existing tests and full CI35740929536 including fresh schema/SQL contracts passed.
Thirteen-file durable MANIFEST367a6a9418d85e5f735c62aa6b40024fb8d800731d1e4cd4eac857790c907a81.
TEST1250 refunded, customer deleted,22 owned SQL/auth/event checks zero; web tab closed,
API18132/Next18133 stopped; application worktree clean. Retained SQL64562 ledger80,
original79 entries unchanged. No native/hosted/Connect/bank or full P-row closure.
PR166 mergedf9176cc2c; PR167766feedca fresh Android checks pending. Current merged-master
CI35740318739 runs; older2b aggregate cancelled after superseding merge. Queue167→168
→177→179→180→182→183→184→185; docs161/170/174 last. Stream2 owns the heavy native build
slot; Stream3 continues feasible N/A verification. Eight closed/72partial-open remain.
Earlier checkpoints below are historical. See Stream1 for exact evidence and limits.

## Current coordinator checkpoint — September 22, 14:28 UTC

PR166 merged f9176cc2c after exact ae03e34d2 passed CI35735947354; PR167 is
refreshing for fresh checks. Master aggregate2b7378aa4 still has an Android job
pending; do not equate the successful PR checks with merged-master acceptance.
Queue167→168→177→179→180→182→183→184→active won-release repair, docs161/170/174
last. Stream1 actual TEST won-dispute failure is reproduced and its candidate now
credits1062 cents exactly once across concurrent/repeated workers; real web wallet
shows10.62. Candidate branch codex/won-dispute-wallet-release is uncommitted.
Owned DB64562 ledger80 includes forward20260922022300; original79 rows unchanged.
API18132/Next18133 and owned test provider fixture remain active for negative
controls and cleanup. See newest Stream1 section; no native/hosted/Connect claim.
Stream2 holds the heavy native build slot. Stream3 N02 Mark-all mutation/restore
is accepted as a bounded Android journey and continues feasible N/A cases.
Eight closed/72partial-open counts remain. Earlier checkpoints are historical.

## Current coordinator checkpoint — September 22, 14:00 UTC

Current master2b7378aa4 incorporates PR165/181 after their fresh passing checks;
merged-master aggregateCI35735938178 remains pending. PR166ae03e34d2 runs fresh
CI35735947354. Queue166→167→168→177→179→180→182→183→184, docs161/170/174 last;
verify-only171/172 never merge. PR184b0986380b is ready with CI35736547362 passed:
real TEST dispute evidence and won/lost web/API/SQL,26-file MANIFEST
fbc00aebb22595d4d3a8f098f15af2623633f168506a32b58b2301c299062ed2. Both fixture sets
clean, both test customers deleted, API18132/Next18133 stopped, app worktree clean.
No native/hosted/Connect claim; see newest Stream1 section for exact boundaries.
Stream2 owns the exclusive heavy native build grant for PR183 guest-pass return
verification on5556; Stream3 continues feasible retained-binary N/A cases. Eight
closed/72partial-open counts remain. Earlier snapshots below are historical.


## Current coordinator checkpoint — September 22, 13:50 UTC

PR165 merged39492cd52 after full fresh CI35732209909; PR181 merged2b7378aa4
after fresh CI35735581542. Current master2b7378aa4; aggregate merged-master checks
pending. Queue166→167→168→177→179→180→182, then the active dispute repair;
docs161/170/174 last, verify-only171/172 never merge. Current Stream1 branch
codex/dispute-evidence-contract has one focused existing-service repair in verification;
API18132/Next18133 and owned real Stripe TEST dispute fixture are active. Stream3
released the heavy build slot. See the newest Stream1 section for exact source,
evidence, provider cleanup requirements and native-control limits. Eight closed/72
partial-open counts remain. The older runtime and merge snapshots below are historical.


## START HERE — September 22, coordinator resumed after the paid merge

The founder resumed all three existing streams and requested current-master adoption.
The older founder STOP and draft dispositions below are historical: PR47 merged as
`69be3c11dc8520aed91228570460487d5579c82d`; PR34 is also merged. PR46 remains untouched;
PR158 was already closed, and PR159's reconciliation is incorporated into this live hub.

- **Integration:** PR173 P10 pagination merged `662ab04b5`; PR163 social privacy/cache
  merged `e5335f584`; PR164 push-tap isolation merged `3b4404ed3`. Each passed exact-head
  CI before merge. PR164 tests initially passed but artifact upload timed out; the failed
  job rerun passed on unchanged source. Master3b4404ed3 CI35724702512 passed. PR160
  merged as `6e24aef59` after current4cca0a CI35724788993 passed all checks. Its previous
  exact ede5b72b full CI35719644248 passed. PR175 merged0b1a26cc1 after exact
  5c5c91b9d CI35728607795 passed. PR176 merged95016cdbb after fresh CI35729368796 and reviewed cleanup.
  PR178 merged715ccd8c0 after CI35731690811.
  Serial code order:165 →181 →166
  →167 →168 →177 →179 →180; update each branch and require fresh checks. Docs161/170/174 last;
  verify-only171/172 never merge, close after their fixes land.
- **Stream 1:** paid integration adopted/pushed `715ccd8c0`; tree exactly matches accepted
  PR1780f1a00b16, aggregate master CI35732165373 runs. Original guard also stalled onNode20;
  PR181037421e1d fixes its input pipe, actual guard passesNode20/24 and CI35732925365 passes.
  Paid worktree is clean at `codex/migration-file-hashing`037421e1d. PR18009a878d38;
  real ranked/fallback web amounts and identity now correct,99existing tests and
  CI35730870955 pass.10-file MANIFEST109eb987ba8896e22c4a39db3150863f40a681634380952bee62816020e087c1. PR179 at924ac3299 remains ready. Ranked offers return200 on both native apps and web;
  15 existing scoring tests and CI35728227377 pass, 12-file manifest
  `d6e38fbfba28f4a1f4914e5bd41ac8b4ef1ceef53842badac122e56a3c67fcf1`.
  PR177ad20c667d remains ready in the queue. Installed iOS failed/successful3DS now returns automatically;
  iOS and Android cancellation restores pending bid/open gig; same-intent retries
  reconcile with real API/SQL/Stripe TEST. Build +77 existing focused tests and exact
  CI35723156495 pass. The26-file owner bundle MANIFEST is
  `2560b7c78a9971316680390b8225b120e00f427c2f8cc52f9ab100a90659b9de`.
  Earlier P10 workload, local O02 recovery, ledger and release-link evidence is retained.
- **Stream 2:** existing task `01a0c0d4-2278-71d3-bc23-a9d789d2afeb` continues Home
  native verification; PR160/175/176/178 are merged. Seven-file176 durable evidence verified;
  changed occupancy fields restored, generated audit/notice and3later matching notices removed.
  PR1789ff513826 moves unchanged mailbox GET/PATCH preferences before generic /:id;
  its4-file durable evidence is verified and merged after current-head CI; full preference
  snapshot equality is peer-reported, coordinator requested concrete hashes or narrower claim;
  no current frontend preferences caller or UI edit is assumed. Docs161/private RESUME
  remain its reporting locations; preserve its owned runtime and fixtures.
- **Stream 3:** existing task `01a0a824-301b-74e3-a1d9-b205714ed7a1` finished native
  follow/block/message checks and exact cleanup/password restoration, and continues A05
  native profile editing after bounded A03/N05/A04/N02 web/API/SQL checks.
  All126 durable file hashes verified; MANIFEST
  `c84f26b102a99957228616fc4644ce60437aa8f600839b1d2bf0cfdb0c4df681`.
  Delivery/provider/physical-device boundaries remain explicit.
  See newest03 sections for limits and direct hub commits; preserve docs170 history.
- **Counts:** 8 closed (H01–H06, R01–R02), 72 partial/open. P01 is a completed bounded
  tip-reservation milestone, not a ninth closed row. Partial journeys/green CI do not
  close a row. Earlier234 Stream1 and149 Home evidence hashes were verified and reused.

Runtime: retained Stream1 SQL64562/API64561 stays up, ledger79. Native3DS owned SQL
fixtures from that milestone are zero; all test intents canceled/customers deleted.
Price-check exact fixtures are now0; API18132/Next18133 stopped, browser logged out/closed.
The detached04:02UTC completion File was recovered through the real worker/local Storage
after natural retry delay, then exact own tombstone/bucket cleaned; broad metadata matches0.
Stream1 native apps terminated; C2BCF36A/emulator5558 retained.
Stream3 holds the exclusive heavy native build grant for A05 if artifact review requires it;
release promptly if unused or after build. Coordinator stopped only its retained Maestro
xcodebuild driver on C2 and verified no xcodebuild before issuing this grant. Peer devices, databases and processes remain owned
by their streams. Private coordinator continuation:
`/private/tmp/pantopus-stream1-wallet-read-r1/RESUME-2026-09-22.md`.

Next: native dispute/remaining P10/provider boundaries; CUA rejects Simulator, explicit
Maestro/ADB-driver question pending with user; independent API/SQL/web work continues;
continue peer row orders and serial merges. Hosted/Connect/live, physical-device,
production recovery and release association/configuration remain unverified. P04/P05
fee payer/recipient and the recorded founder decisions remain unresolved.

## September 22 09:30 UTC — founder STOP; exact state of the parallel Stream 2/3 session (START HERE for Streams 2 and 3)

Both stream agents were stopped mid-batch on the founder's instruction. Everything is
committed and pushed; nothing is merged. Runtimes were deliberately left running so the
next agent can continue without a rebuild. All PRs below need `gh pr update-branch`
before CI is final (they are BEHIND master 39fd33433).

**Stream 2 (Home)** — code [PR160](https://github.com/WangPantopus/skinny-pantopus/pull/160)
`codex/stream2-home-batch1-20260922` head 417a46465 (CI rerunning after a ktlint fix; the
prior head was green except that rule); docs [PR161](https://github.com/WangPantopus/skinny-pantopus/pull/161)
`codex/stream2-home-docs-20260922` edf9dabd4 (five newest-first sections in
02-home-household.md). Web milestones done and cleaned: D02 attachments/silent write
errors (6ce4dbfc2), D03 standalone bill units (340185123), package `delivered_at`
clearing + vendor_name (bfa286b24), D09 false-empty pets/polls readers (f05d2c5b7).
Native batch 1 (installed iOS + Android, real GoTrue logins on disposable project
`pantopus-stream2-native-r1`): Android bill date off-by-one, Android Mark paid/Remove Moshi
NPE, "cancelled"→"canceled" on both, backend `paid_by`, iOS due-date UTC parse, D05
hard-coded "Owner"/"Verified" settings labels now derived from the real role/verification
(27b0fcf82, 46b7df6bd). Bundles: `20260922-stream2-{media-discard,bill-units,
package-delivered-at,false-empty-readers,home-native-batch1}-r1`. Runtime left running:
project 64553/64554 (ledger 59), backend pid 45479 :18143, logging proxy pid 52633
:18142, emulator-5556 (pid 37281, app r5, viewer logged in), simulator 6F914A30 (iOS r4,
viewer logged in), fixture rows HomeBill 3 / HomeOccupancy 3. Open founder calls: issue/
bill/package attachments have no server contract; Android has no Issues entry point for a
member without a Local Profile; Docs "Upload document" shown to docs.view-only; hub
"Verify your home" shown to verified lease residents; web bill edit panel unreachable and
PUT drops bill_type/period/currency; issue PUT requires home.edit while RLS allows the
reporter. Next: PR160 CI green → native Issues, tasks, members, settings/notifications,
guest passes, docs, emergency, calendar, pets, residency; then D remainder → R03–R06 →
I → F → M → H07/H08. Resume note: `/private/tmp/pantopus-workstream-home/.stream2-verification/RESUME-2026-09-22.md`.

**Stream 3 (accounts/social)** — fix PRs from master c1280e078, one each:
[163](https://github.com/WangPantopus/skinny-pantopus/pull/163) backend UserBlock gate on
follow/feed/post/comments (Gate 3a fails because an added import shifted an allowlisted
`users.js` line; remedy in the PR body), [164](https://github.com/WangPantopus/skinny-pantopus/pull/164)
iOS background push-tap crash (green), [165](https://github.com/WangPantopus/skinny-pantopus/pull/165)
iOS sheet dismissal + `new_follower` rewrite (green), [166](https://github.com/WangPantopus/skinny-pantopus/pull/166)
iOS Beacon follow fallback / Follow hidden after block / refused-send banner (green),
[167](https://github.com/WangPantopus/skinny-pantopus/pull/167) and
[168](https://github.com/WangPantopus/skinny-pantopus/pull/168) Android twins (ktlint findings
listed in the PR bodies; 168 not yet re-verified on device). Docs
[PR170](https://github.com/WangPantopus/skinny-pantopus/pull/170) `codex/stream3-social-docs-20260922`
3ae65c3e6 (appended sections in 03-accounts-social.md). Verification-only integration
branches `codex/stream3-verify-{ios,android}-integration` (PR171/172) are never for merge;
close them once the fix PRs land. Verified on installed iOS (Evan) and Android (Bob):
N03 feed/empty/503-retry/post/reply/follow/identity, N04 report post+user, block, blocked
list/unblock/re-block, DM 403 both directions, block-in-DM, held reply; N01 list/unread/
tap destinations, simctl push foreground+background, Android background/cold-start links,
permission denial, login continuation and account switch. Bundle
`20260922-stream3-native-social-r1` (100 files, MANIFEST 9ff965be…faf4). Runtime left
running: API pid 49623 :18130 (running PR163 code), Next 36139 :18131, stream3
containers, simulator 0AE16FA0 (Evan, build e86b9fe5b), emulator-5554 (Evan, APK
827f28a08, location permission revoked). NOT yet cleaned: 2 Posts, 2 PostComments, 1
PostReport, 2 UserReports, 2 UserBlocks, 1 UserFollow, 5 Notifications
(`cleanup-social-r4-rows.py`); Evan has 2 active sessions and a throwaway password
(`restore-evan-password.py`). Founder calls: persona surfaces are not gated by a personal
UserBlock; no report-outcome notification producer exists; "PERSONA · VERIFIED" chip
semantics. Next: fix CI on 163/167/168, install the 10c4368c6 APK and finish the four
Android re-verifications, rerun the touched iOS/Android suites, cleanup + password
restore, then batch 2 A05 → A03 → N05 → A02 → A01 → A04/N02. Resume note:
`/private/tmp/pantopus-stream3-20260920-r1/RESUME-2026-09-22.md`.

**Coordinator**: PR159 (this branch) carries the P01 relabel and these handoffs; merge
order is the founder's/coordinator's call. PR158 is a stale duplicate of merged PR157 —
close it. PR47 is ready for review at the founder's discretion; PR34 draft; PR46 separate.

## September 22 — peer PRs 149/151/152/154 merged; P10 durable-checkout worker check; PR47 ready for review

All four peer PRs are merged after branch updates and fresh required checks: PR149
(8e04c4db9), PR154 (b56fad654), PR151 (b936f8318), PR152 (c1280e078, repaired by Stream3
with a deliberate-sign-out flag: AuthManager remembers the app's own sign-out, ignores the
racing 401 while signed out, and the next sign-in clears it; both previously failing
suites pass). Branch protection requires each head to be up to date with master, so
merges were serialized; two unrelated simulator flakes appeared on the way
(TokenAcceptViewModelTests.testLeasePreviewDenialOrFailureNeverShowsAnOffer on iPhone16Pro,
HomeTaskMediaViewModelTests.testDelayedDownloadCannotRestorePreviewAfterLeaving on iPhoneSE)
and passed on rerun without code change; recorded, not repaired.

Stream1 P10 bounded worker check (owner audit20260922-stream1-p10-worker-r1, MANIFEST
17630656c1c5981799b1ee307eaf7f9cf4295f86164804526d6800874abb4f39): an iOS checkout abandoned with the PaymentSheet open
left a real requires_payment_method intent and a pending_payment bid with a 10-minute
expiry; expirePendingPaymentBids run before and after the natural expiry made no change,
by its documented rule that durable acceptance attempts are never discarded by a timer;
reopening the gig offered the existing Resume payment / Cancel payment setup controls and
Cancel released the real intent (canceled), attempt/payment canceled, bid pending. No
defect. Remaining P10 scope: workload/retention (stale durable attempts keep uncaptured
intents until the owner acts or the provider expires them), worker capacity/retry limits
under load, notification volume, fixture retention.

The founder marked PR47 ready for review (06:30 UTC) and updated its branch from GitHub;
paid then re-adopted master c1280e078 as2d238f0b4 (no new migrations; policy check passes)
and its exact CI is running. Remaining Stream1 scope before PR47 can be called complete:
P04/P05 cancellation-fee payer/recipient decision (founder), native dispute/3DS, P10
workload/retention, hosted/Connect/live boundaries. PR34 stays draft with older migration
names; PR46 separate.
## September 22 07:20 UTC — second session resumed Streams 2 and 3 in parallel (START HERE if taking over)

A second Claude session (cwd `~/skinny-pantopus`) resumed the backlog while the
original Stream 1 coordinator session was still live in
`/private/tmp/pantopus-paid-gig-integration`. Division of work, so nobody duplicates:

- **Stream 1 / hub / merges** stay with the live coordinator session: paid branch, all P
  rows, PR merge order 149 (merged) → 154 → 151 → 152, the hub worktree
  `~/pantopus-coordination`, README/handoff/backlog publication. The second session did not
  touch that worktree or merge anything. PR47 was marked ready by the founder (CI green on
  043ca750e); merging it is the founder's call. PR158 duplicates merged PR157 and is DIRTY:
  close it, do not merge. PR159 (this branch) reconciles the P01 checkmark with the
  8-of-80 count and carries this handoff.
- **Stream 2** runs as a background agent in `/private/tmp/pantopus-workstream-home`.
  Scope, in order: D02 media discard / silent write errors (issue, bill, package panels),
  D03 bill amount units, package `delivered_at` clearing, D09 false-empty readers, then
  installed iOS (simulator `6F914A30-8585-4B05-9E05-94441675F10A` "Pantopus Stream2
  Packages") + Android (AVD `Pantopus_Home_Recurrence_Acceptance`, emulator-5556) Home
  journeys for every owned row (D, R03–R06, I, F, M, H07/H08 remainder) against the
  disposable full-schema project `/private/tmp/pantopus-stream2-native-r1` with the
  worktree backend on 18142. Code branches `codex/home-*`, one PR each, never merged by
  the agent. Live status sections go to the TOP of `docs/workstreams/02-home-household.md`
  on docs branch `codex/stream2-home-docs-20260922` (worktree
  `/private/tmp/pantopus-stream2-docs`, its own docs PR). Private resume note:
  `/private/tmp/pantopus-workstream-home/.stream2-verification/RESUME-2026-09-22.md`.
- **Stream 3** runs as a background agent in
  `/private/tmp/pantopus-workstream-accounts-social` on the retained runtime (API 18130,
  Next 18131 at `stream3-auth.localhost`, Supabase `pantopus-stream3-block-r1` 64531–37,
  Mailpit 64535/36, simulator `0AE16FA0-E244-414F-86C8-24893BDFD979`, emulator-5554 AVD
  `Pantopus_Stream3_Accounts_R3`, fixtures Bob/Dana/Evan). Scope, in order: installed
  iOS+Android N03/N04/N01, then A05 native sweep, A03 local media, N05 direct worker
  reminder delivery, A02/A01 remainders, A04/N02 boundary notes. Code branches
  `codex/stream3-*`, one PR each, never merged by the agent. Status sections are APPENDED
  to `docs/workstreams/03-accounts-social.md` on docs branch
  `codex/stream3-social-docs-20260922` (worktree `/private/tmp/pantopus-stream3-docs`).
  Private resume note: `/private/tmp/pantopus-stream3-20260920-r1/RESUME-2026-09-22.md`.
- Rules in force for both agents: reproduce on the real app before changing code; smallest
  repair inside the existing implementation; no redesign, no unit tests; every milestone
  committed and pushed before the next; one heavy native build at a time; only owned
  fixtures/devices/containers; evidence bundles under
  `~/skinny-pantopus/.pantopus-recovery/audits/20260922-stream{2,3}-<slug>-r1/` with
  `MANIFEST.json`; founder/provider/hosted/physical-device boundaries recorded, never
  blocking. Founder direction: every owned row must be verified from the real installed
  iOS and Android apps, not only web.
- How to take over: `gh pr list --state open` for `codex/home-*`, `codex/stream3-*`,
  `codex/stream2-home-docs-20260922`, `codex/stream3-social-docs-20260922`; read the two
  RESUME notes and the newest 02/03 sections; check `list_sessions` for a still-running
  coordinator or agent before touching Stream 1, the hub, or the stream runtimes.

## September 22 — peer PR review: 149/151/154 approved pending refreshed CI; 152 blocked

Coordinator reviewed the four PRs opened while Stream1 ran the native journeys.
- PR149 (Stream3, iOS APIClient +8): skip the APNs registration POST until signed in and
  keep the token for the existing post-login device registration. Minimal, matches the
  fresh-install 401→"session expired" reproduction. Approved; branch updated to master,
  fresh CI running, merge when CI OK.
- PR151 (Stream3, users.js +12/−1): /verify-email retries a hashed token with the
  alternate purpose (signup↔magiclink) so resent links opened from native deep links
  verify. Minimal, web unchanged, invalid tokens still 400. Approved; merge after PR149.
- PR154 (Stream2, native packages, 4 files): iOS list reload on reappearance, Mark picked
  up enabled for delivered packages on both platforms, iOS Remove closes only after a
  confirmed write, Android clears the stale error on success. Approved; branch updated,
  fresh CI running, merge when CI OK. It edits docs/workstreams/02 on the feature branch:
  merge order handles it this time, but the rule stands (status edits belong in the hub).
- PR152 (Stream3, AuthManager+Session +6/−1): **blocked**. Its CI fails two existing iOS
  regressions on every simulator: AuthManagerTests.testHandleUnauthorizedTransitionsToSignedOut
  expects a plain 401 with no local token to publish sessionEndReason .expired, and
  DeepLinkRouterSessionReturnTests.testOriginalAccountReplaysAfterServerRejectionAndConcurrentTeardown
  expects endSession(reason) called after a concurrent teardown to still publish the
  reason (accepted session-return contract). Gating the reason on "had a local token"
  breaks both accepted behaviours. Stream3: reproduce the deliberate-sign-out race and
  repair it without changing those contracts (for example suppress the reason only while
  the app's own logout is in flight, or let logout clear the reason it just caused), then
  push to the same PR; no new tests, existing suites must pass. Not merged.

## September 22 — paid81fa83103 adopted master111580dfa; exact full CI green

Paid `codex/paid-gig-integration` merged master111580dfa (PR142–PR153: Home package
permissions and In Transit migration20260922010000, Stream3 unverified-login403, all
coordinator docs) as ac26fdf1a, then renamed the22 still-unmerged paid migrations
20260921020100–022200→20260922020100–022200 in unchanged order with identical bytes
(gig-tip contract reference follows; policy check against origin/master passes,72
infrastructure tests,67 SQL wrappers) as81fa83103. Exact CI35686792990 completed SUCCESS
on every job (backend, Docker, web lint/typecheck/Jest, web E2E, complete schema replay/
lint, migration safeguards, Android lint/test/assemble and instrumented tests, iOS lint/
build and three simulators; Seeder skipped by change detection). PR47 is MERGEABLE and
stays draft; PR34 keeps the older names and stays draft;46 separate. No application or
unit-test change in this batch. Stream1 P02/P03/P08/P09 native acceptances published above;
remaining Stream1 scope: P10 workload checks, P04/P05 fee policy pending the founder's
payer/recipient decision, native dispute/3DS and hosted/Connect/live boundaries.

## September 22 — P09 installed iOS refund / hold-release journey accepted (bounded)

Same native harness and both installed clients re-ran the paid journey to capture, then
exercised the existing owner Refunds and hold releases sheet against real Stripe TEST:
partial $5.00 refund (real refund, Refund row, refunded_partial, History copy); a second
$5.00 request with the committed reply lost showed "The result is not confirmed. Check
status to recover this request." and Check status recovered both refunds with no
duplicate provider call; an over-limit amount (5.00 with $2.50 remaining) disables
Continue; gig 0102 Accept→authorize→Release authorization hold cancelled the real intent,
Payment canceled, gig stays assigned per the dialog copy. One fixture remnant surfaced:
an orphaned completion File row from the earlier run's Gig delete made the deterministic
proof-file reserve return 409 (UI "Couldn't send your proof…", draft kept); removed under
replica mode and the harness cleanup now deletes owned File rows. Not a reproduced
production defect; recorded as a source observation for retries with identical proof
bytes after a failed/soft-deleted file. Limits: synthetic identity/Connect, local Storage
bucket, no socket push, no dispute/3DS, remaining $2.50 refunded by cleanup. Cleanup: full
refund of the capture, release intent canceled, customer deleted, owned rows0, bucket
removed, devices stopped. Owner audit20260922-stream1-p09-native-r1 (66 files),
MANIFEST46227a8c58c06f44198bba35a796b019ee5e2ebab7f759196303d29881a07c70. Master CI on d2c2ea62c still queued/running; paid adoption waits for it.

## September 22 — P08 installed iOS+Android paid-gig journey accepted (bounded); PR145 merged

Stream3 PR145 (unverified-login403 feedback, reviewed with its a01-fix-verification
receipt, CI green) merged57d6beb7d after a branch update. Stream1 then ran the accepted
September21 wallet-release harness against both installed clients on the retained
wallet-read-r1 stack with real Stripe TEST: iOS poster Accept→real PaymentSheet4242→
finalize-accept (authorized1250c, intent requires_capture); Android worker deep link→
Start task200; Android photo-proof delivery through the real files router (real File row
and Storage object in an owned private bucket; the earlier shim path and a missing
GIG_COMPLETION_BUCKET produced400/503 with the existing "Couldn't send your proof" copy
and a kept draft); iOS Confirm completion→captured_hold1250/1063/187; owned cooling-off
advance→existing processPendingTransfers→wallet_credited, WalletTransaction1063,
Android wallet shows$10.63 available and the cleared income row; gig0102 cancel-before-
pay and declined-card→abort both released their real intents (canceled) and reopened
the bid. Synthetic identity/Connect, local Storage bucket for hosted S3, no socket push,
emulator/simulator only. Cleanup: real refund of the1250 capture, both750 intents
canceled, customer deleted, owned rows0, bucket removed, devices shut down. Owner audit
20260922-stream1-p08-native-r1 (84 files,42 screens), MANIFEST5590f05258babb98d27b2fd420382154a68e5405f9e8a5a21e8bdef98ee1b76c.
Paid adoption of master57d6beb7d waits for its running CI. PR34/47 remain drafts.

## September 22 — P03 installed Android aged tip discovery accepted (bounded); Android control recipe

Owned AVD Pantopus_Stream1_Start_R2 now runs headless (-no-window, ports5568/5569) and is
driven with adb screencap/input/am start, so the earlier "supported window control
unavailable" limit is superseded. Installed app.pantopus.android.debug (a65411758
candidate, API10.0.2.2:18132) reopened the restored aged originals from
preview.activeRequestId, discovered the real refunded (500c) and canceled (50c) Stripe TEST
intents by customer list, recorded refunded_full/canceled receipts, kept the retained
original after an injected provider failure ("Check tip status" dock), sent exactly one
POST for two rapid taps with the committed reply lost ("The tip result is unconfirmed…"),
and resolved the stale retry read-only; zero provider writes. Limits: synthetic
/api/hub shell breaks the Android hub screen (harness only), snackbars not captured, adb
text entry needs chunking on a cold emulator, emulator only. Owner audit
20260922-stream1-tip-age-discovery-r1 now64 files (8 Android screens), MANIFEST
a6e561d352e3a4e30905311e2a31b44d0c429ddbedb2c6fe3644a4afe4762715 (supersedes0b162fcf).
Emulator killed after the run; peer emulators5554/5556 untouched. Documentation147 merged
d4c044920; master CI on it is running and paid adoption still waits for that exact CI.
P03 native tips are now accepted on iOS and Android for the bounded aged-discovery,
failure, lost-reply, duplicate-tap and stale-retry paths; remaining P03 limits are
cancel-tip natively, checkout/3DS natively, physical devices and hosted/Connect/live.

## September 22 — P03 installed iOS aged tip discovery accepted (bounded); manifest updated

Supported simulator control is now available headlessly (screenshot/tap/text on owned
C2BCF36A while Simulator.app is still absent under Xcode27), so Stream1 ran the same
aged-discovery harness against the installed a65411758 candidate (binaries byte-equal to
September20 provenance): fixtures2/3 (1000c/2000c refunded Stripe TEST intents,27h old)
through the real installed GigDetail→Send a tip→Continue original tip→real routes→real
Stripe TEST reads→SQL. Success, injected provider failure, lost committed reply with two
rapid taps (exactly one POST), device-retained-original recovery and post-terminal
reopen all behaved as designed; zero provider writes. Cancel-tip natively, toasts,
physical device, Android, hosted/Connect/live remain limits. Owner audit
20260922-stream1-tip-age-discovery-r1 now40 files, MANIFEST
0b162fcf2d6d8494cca4ba7378e5234c187187f0e6f454fd09dc94e8d90159d2 (supersedes8a053009).
Owned simulator shut down after the run; EB5AD759 untouched (Stream2). Documentation146
merged5d398aaeb; its master CI is running and paid adoption of708b0a931/5d398aaeb waits
for it. Native Android tips remain the open P03 remainder; P04 no-show/cancellation-fee
still needs the founder's payer/recipient decision.

## September 22 — coordinator resumed; P02 >24h discovery accepted on web; PR143/144 merged

Stream1 coordinator resumed in a new session (prior coordinator session idle since
06:55 PDT; Stream2/3 handoffs waiting). Paid53e738cfc exact CI35607497359 completed
SUCCESS in full (previously recorded as running). PR143 (Stream3 A02 two-context
remote sign-out + A01 proposal) reviewed: 707 durable hashes verified, merged
2201ceabd. PR144 (Stream2 package edit permissions repair; 33/33 hashes verified,
CI35676049112) then received the founder's In Transit decision (migration
20260922010000 strict superset, PUT status400, control gating) with CI on
d4f33b930 green; merged 708b0a931 after branch update. Master CI35678148827 on
708b0a931 is running; paid adoption waits for it. PR34/47 remain drafts, 46 separate.

Stream1 P02: the four owned Stripe TEST tip intents (2026-09-20 22:24–22:40 UTC) are
now 27h old, so the natural >24h cold discovery that the 07:17 UTC receipt could not
prove was run through the real web UI on the retained owned wallet-read-r1 stack:
fresh browser reopened the aged originals, Retry same tip discovered the real
succeeded (fully refunded) and canceled intents by customer list with the −24h
window, recorded refunded_full/canceled receipts, zero provider writes; injected
provider failure, lost committed reply, duplicate tap, stale retry, reload and
worker-permission 403 all behaved as designed. Details/limits in
[Stream1](01-gigs-payments.md); owner audit20260922-stream1-tip-age-discovery-r1
(22 files, MANIFEST 8a0530095c1ed0877bb758b231e63a5c3c0436534e1cb045e5d8c3b78fac7039).
No app edit/new test. P02 stays open only for hosted/L01 provider boundaries.

Stream2 next (after master708b0a931): D02 browser media-discard baseline on the same
owned18141/18142/64550–59 runtime and current master source. Reproduce in the actual
issue/bill/package panels whether attached media is discarded or a write error is
silently swallowed: one synthetic record each, real routes/SQL/storage or its explicit
local limit, exact before/after state, no repair until reproduced; hand off the smallest
existing-handler proposal. Exact child-first cleanup; preserve ledger56/approved
migrations. The Home iPhone17 simulator EB5AD759 and backend8000 Stream2 started for
the founder's device session remain Stream2-owned: shut both down when the founder is
done; Stream1 will not touch them. No native acceptance claim from that build.

Stream3 grant: A01 signup/verification/reset proposal (durable708 f967e080) is granted
as written: exactly one synthetic stream3-auth-r3-*@example.com created only through
the real register form and deleted at cleanup; Evan d3671605 as reset target with the
recorded password restored by a second real reset; retained Mailpit64535/36 as the only
mail sink; journeys as proposed (success, duplicate400, pre-verification login, consumed
link reuse/resend, reset success/old-password failure, consumed reset reuse, unknown
email). No provider/hosted mail, limiter exhaustion, lost-response hook, clock/config
change or app edit; expired-token cases stay a recorded limit. Retained36126/36139/DB
only; record exact GoTrue/User/session/mail rows before and after and clean exactly.

Stream1 next: adopt master708b0a931 into paid after its CI, then P03 installed native
tips on owned simulator C2BCF36A via headless simctl plus the supported simulator
control tool (Simulator.app is still absent under Xcode27; EB5AD759 is Stream2's).

## Stream2 D01 package-edit entry baseline assignment

Coordinator verified12 source artifacts (manifest61d14626),54 Git bindings with53
present/one historicalmissing. All six compared dashboard variants give existing
clickable Deliveries rows a no-op callback. Existing package-aware panel opener,
editpanel/savehandler/SDK PUT/permissionroute/HomePackage contract already exist.
This is a source lead, not yet an observed UIdefect; no replacement is justified.

Assign one baseline on Stream2 owned18141/18142/64550–59/retainedledger56, current
source rebound before runtime. Reuse existing ownedfixture/syntheticidentity only;
relevant packageGET/POST/currentauthority/readprojection must run actual existing
routes/services/SQL, including truly emptyGET200 and rendered createdrow. Label
unrelated scaffoldcollections; do not synthesize the package list/editor result.
Existing TrackPackage UI creates exactly one clearly synthetic expected package
(description/carrier only; no media/tracking/provider). Record real201/fullrow and
unrelatedfullstate. ExpandDeliveries and click that exact row once; capture actual
panel/URL/controls/requests/fullstate. If editor opens, record then close unsaved.
No PUT/status/pickup/repeatedcreate/fault or applicationedit is assigned. InTransit
schema/read-filter mismatch is a separate later requirement, not part of this repair.

Clean exact newlycreatedpackage and ownedbasefixture child-before-parent; verify
allcounts0/fullunrelatedstate/RPCprovenance/ledger56 unchanged. Close newtab/ownAPI/
Next/fivecontainers and releaseports; preserve otherdata/caches/devices/peers.
No new appfile/helper/table/migration/design/unit test. Hand off reproduced outcome
and smallest existing-opener wiring proposal only if rowno-op actually occurs.
Reuse accepted dashboard-read/current-authority/panel-retirement evidence within
source/runtime limits; no guest/member/Settings journey replay.

## Current paid head fixed; one A02 browser reconnect retry

Paid53e738cfc is published, CI35607497359 safeguards/freshschema replay pass; fullCI
pending. No further paid/master adoption until that run completes; ongoing peer
work remains separate. Detailed current state/cleanup is in [Stream1](01-gigs-payments.md).

A02 first browser creation timed out beforeauth;697 artifacts/fullEvanstate equality/
authHTTP[] reviewed. One clean retry within the existing exactEvan/two-browser grant
is assigned: reread supportedCUA docs afterreset, rebind current namedChrome surface
(currentinventory2), confirm no ownedtargettab was created, and recheckEvan0. Reuse
an existing confirmedownedtargettab if present; do not blindlyduplicate. One bounded
Chrome target-tab creation attempt may precede newIABtab/login. On timeout or lost
surface, inspect only ownedtargettabs/cleanup and stop, no alternateprofile/browser,
extensioninstallation, cookieedit or authattempt. If successful, continue original
distinct-current-session/Astepup/Bretirement/fullstate/cleanup scope without asking
again. No applicationfailure claim from capability errors; no third blind retry.

## Stream3 A02 two-browser remote sign-out assignment

Coordinator verified695 artifacts (MANIFESTc772d3d0) and all12 remote-action source
bindings against masterc689c617. This is source-bound peer acceptance, not a claim
that every paid application file matches master. Known owned local AuthEvan
 d3671605-b8cc-4e92-8c82-99aa5041ff48 exists/confirmed, with zero unrevokedapp/GoTrue
sessions/devices/resumegrants at preflight. Bob/Dana retainedsessions are excluded.

Assign one visible secondary-browser journey using existing IAB1 and Chrome4, both
on http://stream3-auth.localhost:18131, existingAPI18130/Next/DB. Immediately recheck
Evanzero and full baseline; stop on drift. Create only two newownedtabs; no profile,
account, env, APIrestart or cookie/storage edit. One ordinary UIlogin perbrowser.
After BOTHlogins, verify each browser's current actor/session through its real
requests: distinct storedcontexts cannot be inferred from two loginrecords alone.
If either context changes the other's current session, stop before revocation and
report limitation. No retainedtabs (including oldtab4) or otherstores touched.

ClientA existingSecurity passwordstepup→signoutothers; clientB stays visible on
existingpersonalSettings. Capture actual Aretained/Brevoked, fullotherownmetadata/
preferences unchanged and temporaryGoTruestepup session removed. Account for that
transientsession; do not claim onlytwo GoTruecreations. Observe B's nextrealread/poll
or existingrevokeevent, privateUIretirement/safe logincontinuation. If no request
occurs, one existing visible read-only Settingscontrol may trigger it; no workaround
login, fabricatedAPIrequest or alteredtimer. Claim socketdelivery only with actual
connection/event evidence. Stop on unexpected other-session change. No duplicate
cancel/wrongpassword/local-logout or global/offline/native/hosted provider matrix.

After proof, ordinary local logout of only newlycreated remainingA is assigned;
if baseline aborts, normal cleanup of only identifiednewfixture sessions is allowed.
Retain natural revocations/audits; close only newtabs. Existing private snapshot
observer may be scoped to knownEvan/newsessionIDs; no APIhook/responsefault/sessionDB
mutation. Preserve runtime and otherfixtures. No appedit/newunit test assigned.

## Stream3 A02 open-secondary-browser preflight

Reviewed692-artifact source proposal (MANIFESTb5d2ea6b); accepted82 auxiliaryHTTP401
and later local-logout flows do not prove remote open-browser retirement. Stream3
may narrowly rebind existing Security UI/SDK/revoke-others route/step-up/services/
verifyToken contracts to currentmaster. Reuse unchanged auth client evidence; do
not repeat accepted broad searches or journeys. No application writer grant yet.

Read-only preflight may inspect only known owned synthetic fixture accounts for
zero active app/GoTrue sessions and supported independent browser contexts. Do not
revoke retainedBob/peer sessions, create accounts, log in, change cookies/storage,
or restart runtime. Two tabs in one context do not prove isolation. Existing IAB
and a distinct supported browser may be evaluated for separate stores without app
input; verify actual session IDs only in a later assigned journey. Report exact
candidate fixture/account scope, browser/host/cookie/socket configuration and
remote-action source bindings. If unavailable, report the concrete limitation;
no workaround or new runtime scope. Keep current signedout/runtime/evidence intact.

## Home lifetime timing limitation reviewed; one bounded follow-up assigned

Coordinator verified35 baseline artifacts (manifest22fe382e), full held/before-release/
after state equality, oneaudit/noBwrite, unchangedRPCprovenance/ledger56 and exact
cleanup/freeports/stoppedfivecontainers. Corrected original200 was attempted56221ms
after commit on an already destroyed socket/no finish. B was entered after42seconds;
unchangedSDK timeout is30seconds, but exact timeout causality was not independently
captured. No successful-late-response acceptance or applicationdefect. Earlier missed-
matcher ordinary200 is excluded and separatelycleaned. Frozenlive02 hash26a1b0c3.

Stream2 is assigned one shorter attempt from its reviewed next-proposal.md, same
unchanged source/ownedfixtures and ports18141/18142/64550–59. Prepare A/observed
controls before arming; one supported CUA invocation Save→freshpendingAX→Share→
freshAX→Settings→freshcommittedA/readback→unsavedB/readback. No intervening shell/API
roundtrip. Add only private request-arrival and close/finish observation at capture;
automatically send untouched original200/body on originalsocket20seconds after
commit regardless of UIprogress. Keep SDK30seconds unchanged. Stop interactions if
A/readback/ordering fails or deadline passes; do not repeatwrite or manufacture
success. Accept only freshGET200/readbackA and unsavedB before intact200 delivery,
with onePATCH/oneaudit/fullsavedA. Observe B without newnavigation/focus/reload.
No applicationrepair unless a defect is reproduced and handedoff. No schema/session/
provider/native/newtest or duplicateatomicity/errorjourney. Exactcleanup as before.

## September 21 — committed local sign-out response loss reviewed

Coordinator independently verified691 Stream3 artifact hashes and complete own-session
metadata comparisons. One ordinary local login added only its current session. Actual
Settings logout retired that app/GoTrue session, with all other own metadata and full
preferences unchanged, while original200 and four clearing-cookieheaders were held.
After proof, only the original socket was destroyed at149ms; headersSent=false,
close/destroyed=true and no finish. Final state exactly equals commit proof: no
resurrection/newsession. Actual browser reachedlogin with original Settings redirect;
one automaticrefresh401, no GoTrue token call or429. InitialAX retainedSettings/Bob.
Browser-facing failure status and intermediate toast were not captured: no502/toast
or zero-frame retirement claim. Manualretry was unavailable after Logout retired;
no relogin/workaround performed. This accepts this bounded local upstream-response
loss/recovery only, not physicaloffline/native/hosted or broad auth closure.

Originalhook/env/argv/cwd restored; API48548/session80449, Next42165/42493 and DB
retained. Fault/descriptors/tab30 removed, natural signedout/revoked state preserved.
No applicationedit/newtest/acceptedjourney replay. Root review receipt is in owner
audit20260921-stream1-migration-order-r3/logout-loss-reviewed.json. Frozenlive03
745697b8 supplies owner details. Shared documentation140 passedCI and merged as
 a5ef4d49ceb986a6655ae1ea5f8404bbf7a3cded. Paid localeb56ab2a1 adds only its three
documents to verified renameeb6d612; actual-base guard still passes. Publication
waits for prior99baa CI native jobs; fresh repaired-head replay/CI not yet accepted.

## Stream3 local logout lost-response runtime assignment

Coordinator verified677 durable artifacts (MANIFEST06df0aa1), all eight bindings
against masterf4b277861, and frozenlive03 hash13ccd0c6. Seven also match paid; paid
next.config.js differs only by existing /status/:token privacy headers. Auth/API
proxy source is unchanged. An initial overbroad eight-paid-matches assertion failed;
the premature runtime message was immediately withdrawn before this corrected grant.
Stream3 confirmed no login/logout/refresh, hook write or APIrestart occurred before
the correction; only read-only source/process inspection had run.
Accepted82/136/138 do not cover same-account local logout with original reply lost
after retirement. Existing implementation/instrumentation suffices; no defect yet.

Stream3 reserves only retainedAPI18130/Next18131/ownDB and one new browser tab.
One ordinary real local Bob login is assigned because browser is signedout; record
new exact ownsession, full own app/GoTrue metadata/preferences. Rebind source and
original hook/env/argv/cwd. Extend only existing private end-hook for one exact
owned POSTlogout, loopback/aliasOrigin/cookie transport/SettingsReferer, expiring
atomic descriptor. Hold original200 only with headersSent=false, at most8seconds
below client timeout. On original pending socket prove currentapprevoked/GoTrueabsent
and unchangedotherownmetadata/prefs before destroying only that original socket.
Mismatch, non200, sentheaders, incomplete proof or deadline must release original
untouched response if possible and stop; early disconnect gets its actual label.
No manufacturedresponse/cookie/session, authDBwrite or secret logging.

Observe actual Nextproxy/browser result and automaticauth; stale sessionflag can
cause refresh. One samebutton retry is included only if currentLogout remains usable
and identity is unchanged; no relogin/workaroundnavigation/resurrection. Verify actual
recovery/no new or other-session changes; retain natural revocations/audits. Stop on
unexpectedmutation/accountswitch. Restore exact hook/descriptor/APIconfiguration,
close newtab, preserveNext/DB/peers. No newtests, native/hosted/externalprovider or
applicationedit. Local API-to-Next reply loss does not establish physicaloffline.

## Next independent verification while paid CI finishes

The migration filename repair is localeb6d612beb96377c37ea546190e0d85f78529d7d:
22 exact SQL renames and existing gig-tip contract references only. All58 master
SQL files unchanged, actual-base guard passes,67 wrappers verify,72 existing
infrastructure checks pass; no new tests. Preserved local ledger digest unchanged.
Six artifacts in owner audit20260921-stream1-migration-order-r3. Publish once old
CI35603240733 finishes so its running native checks are not cancelled; fresh replay
and exact repaired-head CI remain required. No new schema scope in this batch.

Stream2 may now run its previously reviewed10-artifact Home save-lifetime baseline
on finalmasterf4b277861 after rebinding original Settings/SDK/backend/RPC bytes.
Reserve only its owned prior ports18141/18142/64550–59 and stopped five-container
stack; no native build. Preserve originald225 branch and accepted evidence, use
an independent follow-up branch in its own application worktree. Existing exact
owned fixture and private transport isolation only: hold one real settings200
on the original socket after actual SQL commitA; Share→Settings loads committedA,
enter unsavedB, release oldreply, observe currentdraft and full savedstate/oneaudit.
Record UI/SDK/realAPI/SQL and socket delivery; do not manufacture success or mutate
ledger/schema/provider/session. No app repair is assigned until failure is observed.
Stop/restore exact instrumentation and owned fixtures; preserve approvedmigration56,
other data and all peer resources. No duplicate atomicity/normal/error journey or
new unit test. Existing source-only proposal remains the scope and evidence map.

Stream3 next bounded work remains source-only: select the existing logout lost-
committed-response boundary, bind accepted82/136/138 evidence to current source,
compare UI handler/SDK/session retirement/API/GoTrue calls and distinguish lost
response after retirement from acceptedpre-forward503. Report a precise existing-
implementation gap or bounded real-response isolation proposal before runtime or
code changes. No additional login/logout/refresh/provider/native action. Preserve
current browser signed-out state, own source/evidence and retained runtime.

## September 21 — migration ordering repair; native reservation released

Current paid head99baa92b6 is clean/pushed, but CI35603240733 failed the migration
history guard; fresh database replay was consequently skipped. Master now contains
Home20260921010000, ahead of all22 still-unmerged paid migrations16020100–16022200.
This is reproduced integration ordering failure, not a proven SQL execution defect.
Existing runbook and prior3657af97d prescribe renaming unmerged files after master.
Stream1 is sole writer for these22 filenames and their existing gig-tip contract
references: reserve20260921020100–20260921022200 in unchanged dependency order.
216 Git branch refs checked without destination collision. Preserve every SQL byte,
all master migrations and every retained database/ledger. No include-all, ledger
repair, schema mutation, hosted rollout, guard weakening or new unit test. Required
checks: exact22 byte bindings/master immutability, actual-base policy, existing
infrastructure contracts and fresh schema replay in required CI. Original failed CI
remains failed; do not replay unchanged UI journeys for a filename-only repair.

Native readiness ended without acceptance: installed iOS candidate hashes match
prior evidence, but Simulator.app is missing and registered bundle attachment fails.
Android owned AVD starts, but supported window listing/control is unavailable. Both
owned devices are now stopped and ports5568/5569 free; no app input, build/install,
fixture/provider or cache change. Native tips remain unverified. Three safe readiness
artifacts are preserved in owner audit20260921-stream1-native-tip-readiness-r3.
Stream2 remains stopped with its approved local migration retained; Stream3 restored
API/Next/DB retained, later proposals source-only. PR34/47 stay draft,46 separate.

## Stream1 Android control-readiness reservation

Owned iOS readiness check ended: simulator booted but Simulator.app is absent;
only owned C2BCF36A device was shut down, no fixture/build/provider or cache changes.
Stream1 now reserves only existing AVD Pantopus_Stream1_Start_R2 and free ports5568/5569
for a bounded window-control check using the supported native window-id entry point.
Prior app-name/executable attachment failed; do not repeat those paths or use unsupported
input automation. No APK build/install, API/fixture/provider operation or acceptance yet.
Preserve other AVDs/data/snapshots; shut down only this owned emulator after readiness.

## Stream1 native-tip readiness reservation after batch publication

Published paid99baa92b6/CI35603240733 stays fixed. Stream1 reserves only its existing
simulator C2BCF36A-F300-48C1-9BA7-876CA9F61E55 (Pantopus Stream1 Start R2) for a bounded
boot/GUI/control-readiness check. No native build, application edit, fixture/API start,
provider operation or tip acceptance yet. Other simulators were shutdown in read-only
inventory; preserve their state and all caches. Existing installed a654 binary hashes
match earlier evidence; source comparison must bound any later reuse. Only owned-device
boot/GUI access; no global daemon/cache reset, license acceptance or other-device work.
Record exact readiness outcome and owned-device cleanup before further runtime scope.
All peer native resources remain free; Stream2 stopped, Stream3 restoredAPI/Next retained.

## September 21 — reviewed application batch ready for final publication

The application batch is merged through master
`b946eb9ea99819ffb27f42252cdaab237d02dea0`. Paid branch
`codex/paid-gig-integration` has a clean local integration commit
`1f1c353cf529e7df4acdb1a1c5e84f13036e9479`; it is not pushed yet. Seven incoming
application paths match their reviewed candidates exactly, including earlier Audit133.
Financial backend and native source are unchanged. Remote paid48702 retains its
successful full CI35596223401 (15 applicable passes, one Seeder skip).

- SDK136 merged `2d66626c058ca6d57232fc0dd57311c58086fcf5` after original
  CI35599880117 and updated CI35600453583 passed. Actual logout no longer causes
  the automatic refresh burst; real login returns to the exact protected destination.
- Atomic Settings137 merged `274e6e1c91c9049e855f6fe91e0484deebaedb2c` after original
  CI35600568312 and updated CI35601168238 passed, including fresh schema validation.
  One UI command saves name/type/settings/preferences together. Actual RPC denial
  and final audit-insert failure left complete state unchanged; retry saved all
  intended fields and one audit. Compatibility and validation evidence was reviewed.
- Logout feedback138 merged `b946eb9ea99819ffb27f42252cdaab237d02dea0` after original
  CI35601204534 and updated CI35601772751 passed. Actual pre-forward503 stays on
  Settings with a usable error/retry; real retry200 retires only the current session
  and reaches login without refresh/429. The original toast AX observation was
  recovered from the recorded tool output, without another browser journey.

Combined local verification passed: web type gate zero errors; scoped web lint zero
errors/22 existing warnings; SDK lint zero errors/80 warnings; 57 existing auth checks;
backend syntax and whitespace. No new unit tests. Existing page ts-nocheck and standalone
SDK type diagnostics remain explicit limits; the latter was not rerun or claimed green.
No accepted UI journey was replayed for this source-identical integration.

Evidence: root owner audit `20260921-stream1-payment-method-removal-late-r2` now holds
23 verified artifacts, including cohort-review.json, combined-source-bindings.json,
combined-validation.json and check logs. Home candidate36 and Stream3 durable676 hashes
were reviewed independently, including full rollback/session comparisons and cleanup.
Final live02 hash44293645 and live03 hash32f46a2d were captured in f9b9b82ea; the earlier
incorrect provisional live02 hash was rejected before staging and corrected by its owner.

No private fault remains active. Root API/tab are closed; Next18133/PID47970 and owned
Supabase are retained. Stream2 fixtures/constraint/ports are clean, five containers
stopped/preserved; its approved forward migration and ledger56 intentionally remain.
Stream3 restored API7948/session60505, Next42165/42493 and DB are retained, browser signed
out and natural revocation records preserved. No local native build or provider send.
Root retained DB has not applied the new Home migration: no combined local Home schema
or runtime claim is made. Required rollout is migration, updated backend, then web;
the old backend ignores profile keys. No hosted rollout is authorized or performed.

Next: publish this documentation separately, adopt only its final documentation delta
into the checked paid integration, verify source bindings again and push once for full
CI. Reuse these local checks when that delta is docs-only. PR34/47 remain drafts and46
separate. Later Home save-lifetime and other proposals remain outside this fixed batch.
All three streams are incomplete; provider/device, unknown-commit, concurrency and wider
acceptance limits remain in the existing backlog. Do not equate this batch with closure.

## Fixed next integration batch

Next paid integration is limited to reviewed136 signed-out refresh gate,137 atomic
Settings command and the currently assigned profileSettings logout-error repair.
After their exactCI/review/merge and a separate final documentation publication,
adopt finalmaster once into clean paid48702, bind testedsource and run affected
combined checks/requiredCI. No further runtime/feature expansion is added to this
batch; later peer findings stay source-only proposals until separately assigned.
Current137 updatedbba09eefda263c1d8cdf8fc4c785fa18acfa67fe adds only five docs and
reviewed136 SDKclient; all four candidatepaths unchanged. OriginalCI35600568312
passed; updatedCI35601168238 pending. PR34/47 remain drafts,46 separate.

## Later-batch profile Settings logout-error repair grant

PR136 merged2d66626c058ca6d57232fc0dd57311c58086fcf5 after updated0d5ee430 CI35600453583
passed; SDK scope complete only within recorded limits. Coordinator verified662
logout-failure artifacts and full ownsession/prefs equality: matchedpre-forward503
silently returned to authenticated Place, noerror/retry. No session retirement occurred.
Original privatehook/env restored; API3800/session20593, Next42165/42493/DB retained.
Frozenlive03 187551b captured769917ca0; original136 branch/evidence preserved.

Stream3 sole writer existing profile/settings/page.tsx handleLogout only. Adopt final
master2d66626c on separate follow-up branch and rebind existingpage/callers. On API
rejection use alreadyimported toast.error with safe cannot-confirm-signout/retry
wording and return before clearPendingPlaces/clearAuthToken/navigation. Preserve
successful path and all otherhandlers/layout/styles. Do not assert session is active
for every failure (lost successful replies remain another boundary). No newfile/helper/
SDK/backend/limiter/schema/unit test or unrelated refactor/pending-state redesign.

Use same exactowned current507ef9ec preflight and reviewed private503 isolation with
completehook/env/source restoration. Actual keyboardlogout503 must keep Settings and
currentidentity, show error, retain fullownsession/prefs; repeatcurrentfailure at most
once if needed for reusablecontrol. Removefault/sameUIretry must call realbackend200,
retire onlythatcurrent app/GoTrue session, reachlogin withoutrefreshburst/429, keep
otherownmetadata/prefs unchanged. Reuse136 successfulloginreturn/explicitrefresh evidence
with source/controlflow limits; no duplicate loginjourney. Restorehook/descriptors/API,
close ownedtab, retain natural signedout/revocation state and DB/Next. Scopedchecks/
requiredCI/draftPR/exactcleanup handoff; no native/hosted/lostcommit/session-lifetime
claim. Keep137 and paid48702 independent until next reviewedbatch.

## Later-batch pre-forward local logout failure baseline grant

Coordinator verified654 hashes and existing five-file source/contract comparison.
PR82 after-revocation failure and136 successful logout do not cover this boundary.
Stream3 may extend only existing private pre-Express one-shot hook for exact owned
POST/api/users/logout, port18130/loopback/aliasOrigin/cookie transport/exactSettings
Referer with short expiry/atomicconsume. No forwarding/SetCookie; record safe match
booleans/time/path/status only. Preflight exact Bob/current507ef9ec session; otherwise
stop. Preserve original hook hash/env/argv/cwd and auth-source bytes, restart only own
API to load instrumentation; do not use restart to bypass rate limits. Next/DB retained.
One actual existing Settingslogout, observe UI/error/navigation and full own session/
prefs metadata; do not force an expected outcome. Record any automatic auth activity
and stop if unexpected; no manual retry/login/logout or application repair yet.
Restore exact original hook/remove descriptors/restart only ownAPI sameconfiguration,
verify restoredprocess provenance, close newtab, preserve actualsession state. No
cookie/JWT/clock/device/grant mutation, newtests/native/hosted/realoffline/lost-commit
claim. Separate later baseline; PR136 source/evidence and current integration stayfixed.

## Later-batch SDK signed-out refresh repair and scoped rollback fault

Stream3 sole writer: existing frontend/packages/api/src/client.ts response401 gate.
Coordinator verified637 artifacts, full logout retirement/failure snapshot and inspected
existing canRefresh/hasActiveSession/clear paths. Source plus captured repeated private
reads/refreshes supports a feedback loop; historical tab initiator remains unproven.
Use existing active-session signal for automatic web401 refresh; logged-out401 must
reject without refresh/repeatedsessionclear. Preserve mobile refresh, explicit refresh
page, stale-access sessionflag, singleflight/generationguards and privacy retirement.
No limiter/QueryProvider/layout/backend/schema change or newfile/unit test.

Only owned Stream3 runtime and synthetic Bob: after natural limiter window expires,
ordinary login to establish new owned current session if needed; apply exactSDK repair
and verify loaded source, then actual Settingslogout→protected own settings query→
login/currentdestination. Capture bounded private-read/refresh/status counts and safe
session metadata before/after, no burst/429, expected local retirement/newlogin only,
all other own metadata/fullprefs unchanged. If errors persist stop attribution before
furtherpatching. Relevant existing SDK/web regression checks required; accepted
explicitrefresh/naturalexpiry paths can be reused only with source/controlflow limits.
No cookie/clock/JWT/devicebinding/limiterbypass/restart to clear counters, hosted/native
claim. Close newtabs/descriptor; retain natural session records/runtime. Hand off draft.

Stream2 midtransaction rollback fault approved only on ownedr1DB and exact Home
f0e51100-0000-4000-8000-000000000100: uniquelynamed NOT VALID HomeAuditLog CHECK rejects
only that home_id AND action=home_settings_updated. First prove name absent and capture
full constraint definitions/validatedflags/tableowner/ACL. No trigger/function/privilege
changes. One actual UI one-command save fails at finalauditinsert; compare fullHome/
Preference/Audit/ancillary state unchanged. Immediately drop only exactnewconstraint,
prove complete catalog/provenance restored, UIretry200/oneaudit/intendedfields. Other
homes/actions unaffected; candidate function/forwardmigration remains installed and
recorded. Do not run broader existing contract trigger fault without isolated review.
No new unit tests; coordinate any further shared SDK edits with Stream3 currentwriter.

## Later-batch D05 atomic Settings repair ownership

Coordinator verified17 baseline artifacts and independently compared full failure
state: only Home.name/updated_at changed after profile200/settings503; all other rows/
counts unchanged, originalRPC provenance restored, same-draft200/200 recovery and
exactfixture/runtime cleanup reviewed. Source11/56bindings and existing applied
20260911010000_home_settings_preferences function show reuse is appropriate.

Stream2 is sole writer for existing HomeSettingsTab.tsx, API homeProfile.ts settings
payload, backend homeIam.js settingsPATCH, and one compatible forward migration that
CREATE OR REPLACEs existing update_home_settings(uuid,uuid,jsonb,jsonb). No new table/
service/functionsignature or rewriting appliedmigration; new migration is necessary
only to extend existing applied transaction safely. No other application file writer.
Add optional canonical name/home_type to existing command; validate same existing
profile name string<=120/empty/null and exact HOME_TYPES/no nulltype, including DB
boundary. Preserve omission/settings-only clients, field clearing/defaults/preferences,
current authorization/lock/audit and updated_at semantics. Existing screen sends one
settingsPATCH containing original draft; preserve all controls/layout/navigation.
Existing safe failureMessage may replace generic failure extraction in same handler.
Do not change other profile callers or introduce a fallback two-write path.

Verify actual UI original changed-name/welcome scenario: deniedRPC leaves all fields/
rows unchanged, exactrestore/currentretry onePATCH200 saves intended fields and one
audit, reload; canonical invalid/permissiondenied calls leave fullstate unchanged.
Verify settings-only compatibility and affected existing112 clearing behavior within
source limits; no broad replay/newunit tests. Before injecting a midtransaction failure,
propose exact fixture-only SQL fault/provenance/cleanup to demonstrate rollback after
Home write; do not alter shared permissions/triggers indiscriminately. Run relevant
schema replay/checks/requiredCI, document local forwardmigration persistence, clean
exactfixtures/resources and hand off draftPR; no native/hosted activation or broader
concurrency/session/save-lifetime closure. Keep paid48702/docs134 prior batch separate.

## Later-batch ordinary local logout and destination-return runtime grant

Coordinator verified629 Stream3 durable hashes and nine unchanged auth source
bindings against retained c3f runtime/current de0ac master. Existing profile Settings
calls default local SDK logout; backend resolves proof before local GoTrue revocation
and current registry retirement. Existing login uses safe relative redirectTo.
Reuse PR82 and natural/transient evidence; do not replay others/global/partialfailure.

Stream3 may use only retained API73610/Next42165+42493/ownedDB and real synthetic Bob
browser session for one ordinary Settings Log out, direct own scheduling-settings URL
with harmless query, unauthenticated login redirect and actual Bob login return.
Preflight current actor/session must exactly match owned fdbea9cf; otherwise stop and
report changed identity rather than selecting another session. Record safe HTTP and
own GoTrue/AuthSession before/after metadata, full preferences and exact destination.
Require old current GoTrue removal/registryrevocation, all other own session metadata
unchanged, no unauthenticated private settings content, expected new login/session and
current actor preference read. Do not claim these outcomes before observation.
Retain naturally revoked/audit/newlogin records; no session resurrection or database
reset. Close only new tabs/remove observation descriptor; preserve runtime and caches.
No others/global action, devicebinding/cookie/JWT/clock/grant mutation, private failure
hook, app edit/newtest/native/hosted or negative-destination authorization claim.
Report any actual mismatch before repair. Current paid48702 and docs134 CI fixed.

## September21 — transient session retry reviewed

Coordinator verified628 durable Stream3 artifact hashes (MANIFEST18bb02a8) and
independently compared full own-session snapshots: synthetic pre-Express503 made
no preference/app/GoTrue metadata or grant-receipt change. Keyboard retry reached
real backend200/GoTrue200 and exact original settings query/Bob. Same73 app and4
GoTrue session IDs retained; only current fdbea9cf session metadata changed, one new
GoTrue200. Full preferences[] unchanged; identity-bound GET304 is cache revalidation,
not a fresh200. Actual UI transient failure and recovery snapshots reviewed.

Private hook restored exactly d7c8b953; descriptor/metadata flag absent, faultAPI63469
stopped, restoredAPI73610/session69695 retains exact original argv/env/backendcwd.
Next42165/42493 and DB retained, tab25 closed, successful natural session rotation
retained. Manual refresh-page entry and synthetic pre-forward503 do not establish
natural expiry/provider outage/native/hosted/OAuth/cross-account acceptance. No app
edit/newtest. Frozen live03 4acfa26c captured in6a3c7c692; details/evidence remain in
existing accounts-social-r3 durable mirror. Next Stream3 assignment is source-only
logout/revocation/current-destination reconciliation after accepted-evidence review;
no new auth mutation/device association or runtime expansion granted. All streams
remain incomplete. Paid48702 currentCI unchanged and pending.

## Later-batch D05 changed-profile partial-save baseline grant

Coordinator verified11 source-artifact hashes/56bindings and accepted112 reuse.
PR133 merged de0ac6ef3 after exact updated CI35597307862 passed; live02 captured
in a5357f314. Stream2 may adopt final master on separate follow-up branch and rebind
relevant source, then use only owned18141/18142/64550–59 and existing privatefixture.
Runtime-only: actual dashboard Settings changes one valid name plus one textsetting;
only exact ownedHome profilePATCH/settingsPATCH allowed, no provider/other writes.
Capture full Home/Preference/Audit/Occupancy and ancillary state plus complete existing
update_home_settings definition/owner/ACL/effectiveEXECUTE. Transactional directEXECUTE
fault only if effectivefalse; otherwise rollback. One UI Save, actual both replies,
SQL per-field state and retained draft/error. Restore complete original provenance
immediately, inspect same UI retry and verify intended values/reload. Clean exact
fixtures/processes/ports, preserve containers and report actual baseline before edits.
No app/schema/service/newfile/test/migration grant or atomicity claim from source alone.
Reuse108/109/112 within limits; do not replay accepted clearing/validation journeys.
Current paid48702/CI35596223401 remains fixed and independent.

Root late-removal r2 reservation released: API68546/tab29 closed, exact fixture/RPC
restored. Next18133/PID47970 and ownedSupabase retained. Late-error receipt/UI evidence
is recorded in live01; no new shared application file writer or native build.

## Later-batch standalone Audit read repair grant

Coordinator verified15 frozen baseline hashes and actual audit500 while members/me/
requests200. Existing Audit Log falsely displayed no entries; full fault-state rows/
counts independently equal. Exact owner/tableACL/columnACL/RLS/effectiveSELECT
restored, Refresh recovered exact seeded row200, cleanup/runtime release verified.
Source12/63bindings and accepted102 dashboard evidence reused; no replacement needed.
Stream2 is sole writer for existing standalone members/page.tsx Audit read state only:
auditError reset byretire, rejected auditRes mapped with already imported failureMessage,
existing ErrorState/onRetry(fetchData) before empty branch. Preserve successful Audit
rows/styles/navigation, current access/generation and all Requests/mutation handlers.
No new app file/helper/schema/test or other-tab refactor.
Use owned existing runtime/fixture and directSELECT fault with complete provenance
restoration. Verify genuineempty200, repeatedactual500/keyboardretry, restored exact
row200/fullstate and optional isolatedcurrent403/restore. No application mutations,
provider sends/dashboardreplay/native/session/stale-read claims. Exact fixture/privilege/
process cleanup and draft source/evidence/checks handoff required. This later repair
stays outside published131/132 and paid48702bc9d; current paidCI remains fixed.


## Later-batch Stream3 synthetic transient refresh retry grant

Coordinator verified619 hashes and actual associationPresent=false; earlier PRESENT
handoff was a reporting mistake and is not accepted evidence. Do not apply AuthDevice
SELECT faults or manufacture a device binding. Existing post-GoTrue hold is also
unsuitable for a pre-forward failure. Grant only private http-probe emit-hook extension,
not repository code: one-shot descriptor matches exact POST/api/users/refresh, owned
18130 loopback, exact alias Origin, cookie transport and full unique-marker Referer.
Use short expiry and consume atomically before synthetic503; nonmatches untouched.
No original Express/GoTrue forwarding, no Set-Cookie/logout; record safe match booleans/
method/path/status/time only, never credentials/cookievalues/tokenhashes.

Verify current API process ownership, preserve exact private environment/port/cwd and
relevant auth-source bytes, restart only ownedAPI to load privatehook. Preserve Next/
DB/browser session. One manual existing refreshpage navigation with safe relative
settingsdestination, explicitly manual/synthetic rather than naturalexpiry. Verify
transientUI and keyboard Tryagain, no first-attempt GoTrue/registryrotation/logout,
then actual forwarded retry200/GoTrue/currentBobdestination. Fullprefs unchanged;
only owned successful session rotation may persist. Restore original privatehook
bytes/remove descriptor and restart only ownAPI to restored configuration, close tab,
verify exact process/resources/env/source provenance. No app edit, devicebinding,
clock/cookie/JWT/DB/grant mutation/newtests/native/hosted scope. Keep current131/
documentation132/paid integration batch fixed; later findings are separate.


## Later-batch standalone Audit runtime-only grant

Coordinator verified12 source artifacts/63 bindings (59 present,4 historical missing).
All seven standalone variants handle only fulfilled audit reads, then share the same
empty display. Accepted dashboard102 and exact homeIam audit handler remain source-
identical and reusable within prior limits; no new standalone defect accepted yet.
After131 merges, adopt final master on separate follow-up branch. Use only owned
18141/18142/64550–59 and existing fixtures with one explicitly seeded synthetic audit
row, no application mutation/provider send. Actual standalone Audit200/exact row first.
Capture HomeAuditLog owner/tableACL/columnACL/RLS/effective service_role SELECT.
Temporarily revoke direct SELECT only inside a transaction that verifies effective
access becomes false; rollback if inherited/column privileges prevent isolation.
Actual existing Refresh must yield audit500 with members/me/requests200; inspect
false empty and full retained request/invite/occupancy/audit/ancillary state unchanged.
Immediately restore original privilege and full provenance, then recover exact row200
through Refresh. Clean exact fixtures and release owned runtime, preserve containers.
Report actual baseline before application edit. No dashboard replay, design/change
of navigation, new tests/schema/service/invalid-payload policy/native/provider scope.
This work is separate from fixed131 and previously published128/129/130.


## Later-batch Stream3 natural session continuation grant

Coordinator verified608 durable hashes and existing session-natural-refresh-plan.
Use only existing synthetic Bob account's real retained local GoTrue/browser session.
Recorded login10:40:13.684UTC and existing access-cookie lifetime3600s permit an initial
natural-expiry observation after11:40:20UTC, only if safe receipt history confirms no
new successful login/refresh. Recompute window on renewal; never delete cookies,
change JWT lifetime/clock/auth DB or manually enter refresh route as a substitute.
Keep testtabs closed while waiting and use interruptible bounded waits.

Snapshot full actor scheduling preferences and only actor-scoped whitelisted nonsecret
auth registry metadata; no token/hash/cookie/header/body export. Open one existing
protected scheduling-settings URL with harmless query on corrected alias. Observe
middleware recovery, same-origin refresh POST/status, destination/query and exact Bob
identity with existing zero-delay metadata-only GET instrumentation. Read only narrowly
parsed GoTrue method/path/grant_type/status/time; if unavailable, label that boundary
source-inferred. Reload once for absence of a recovery loop, compare unchanged prefs.
Natural expiry is timing-based unless direct safe expiry metadata exists; no revoked-
access/crossaccount/native/hosted/OAuth acceptance. If recovery does not occur or fails,
preserve evidence/session and report; do not silently re-login or force missing cookies.
Close owned tab/remove unused metadata flag, retain rotated session and natural auth
registry changes; no auth DB restoration claim. No app edits/provider sends/new tests.
Keep this later scope outside published128/129/130 and fixed paid1aecd.


## Later-batch Home Requests read error repair grant

Coordinator verified16 frozen baseline hashes, actual list503 with members/me200,
false No pending requests, independent full-state equality and exact function
owner/definition/ACL/EXECUTE restoration. Existing Refresh restored pending applicant.
Exact fixture cleanup/runtime release recorded; one request notification suppressed,
no provider calls. Source12/63 bindings establish an in-place existing-page repair.
Stream2 is sole writer for Requests read state in existing members/page.tsx only.
Add requestsError cleared by existing retire, record rejected reqRes with existing
safe failureMessage, and use existing ErrorState/onRetry(fetchData) for this failure.
Omit false numerical zero while error is present; successful tab/count/empty/pending
rows and all styling/navigation remain unchanged. Preserve current canManage and
owner-generation guards, approval/decline/role handlers and all service contracts.
No new app file, schema, helper, tests, invalid-payload policy or other-tab refactor.

Reuse exact owned runtime/fixture/RPC fault and cleanup guards. Verify genuine200empty,
actual repeated503 plus keyboard retry, exact pending200 recovery and unchanged full
rows/counts/function provenance. A fixture current authority denial/restoration may
be checked if it follows existing isolated permission controls; do not broaden grants
or reinterpret current-access policy. Reuse accepted departure/role/decline/approval
source-bound evidence; no new session/native/provider claim or broad replay. Commit/
push a draft with exact source/evidence/checks and cleanup; coordinator owns merge.
Keep completed128/129/130 and fixed paid1aecd batch separate from this later repair.


## Later-batch Stream3 owned Next hostname correction

Coordinator verified604 durable hashes and two no-token/no-follow HTTP307 probes:
alias and localhost Host both redirect to localhost with exact query preserved and
no Set-Cookie. Existing Next15.5.15 startup binds --hostname127.0.0.1; alias resolves
to loopback. This is local configuration evidence, not a production auth defect.
Stream3 may replace only its owned Next parent14400/listener14742 after verifying
current PID identity, preserving port18131, existing distDir, API proxy/environment
and browser alias session. Change startup hostname to stream3-auth.localhost only
if OS resolution is still exclusively loopback; retain API18130/Supabase and caches.
Do not kill unrelated processes or reset cache/DB/cookies. Record old/new commands
without secrets, process cleanup and retained resources. Repeat only non-mutating
redirect probes with synthetic marker/no auth tokens; no real expiry/refresh/browser
session mutation or application edit. If alias startup fails, restore original owned
startup and report. Subsequent real-session verification requires a bounded scope.
Keep fixed128/129 and merged documentation130/d8657ee7 outside this later work.


## Later-batch Stream3 session redirect origin observation

Coordinator verified603 durable hashes and source-only35 bindings including installed
Next15.5.15 middleware URL construction. Prior incidental alias-to-localhost refresh
failure is reused only as a lead. Use retained Next18131 for non-mutating HTTP requests
to the same existing protected settings path with a synthetic pantopus_session=1
marker, no access/auth tokens, comparing stream3-auth.localhost and localhost Host.
Record redirect Location origin and preserved target query, actual server hostname/
startup configuration and existing proxy contract. No automatic following into real
auth, browser cookie/session changes, credential logging, runtime restart or app edit.
If runtime configuration explains the difference, propose the smallest local change
before applying it. No auth rewrite, real expiry/refresh acceptance, native/provider
or new tests. Findings stay outside fixed128/129/documentation130.


## Later-batch Home Requests list runtime verification

Coordinator verified12 source artifacts/63 bindings (57 present,6 historical missing).
Six refs have fulfilled-only request handling; historical place variant explicitly
clears rows on failure, with the same empty display. This is still a source lead.
After129 merges, adopt final application master on a separate follow-up branch.
Use owned18141/18142/64550–59 after checks and existing actual request fixture with
process-lifetime notification/email interception. Permit exact request creation only,
no approval/decline/provider sends. Verify pending applicant rendered from real list200.
Capture exact list_home_household_requests(uuid,uuid,text) definition/owner/ACL and
effective service_role EXECUTE before fault. Revoke only original direct service_role
EXECUTE in owned DB if it actually isolates this RPC; do not broaden privilege changes
when inherited access prevents fault. Actual UI reload/Refresh must show real list503
while members/me200; inspect false-empty and confirm full request/invite/occupancy/
audit/ancillary state unchanged. Restore exact original function provenance/ACL/
privilege immediately, recover applicant through existing Refresh and clean fixtures/
runtime. Report actual failure before any app edit. Preserve current screen/design,
all accepted role/decline/approval/sender evidence; no new tests/native/provider scope.
This later verification stays outside fixed128/129/documentation batch.


## Next batch fixed to reviewed Home approval and host reminder email

PR128 is mergedb412b1b58 after exactd34ca7e341 CI35592633526. PR129 originalc3f1bd038
passedCI35592896635; updated03a2dac07f1f17df9222c0a9fc1e0f5b1984b6ac adopts only
accepted128 Home source plus five documents. Service source is identical; updated
CI35593202158 must pass before merge. Coordinator verified602 Stream3 durable hashes,
15 delivery/failure/retry cases, full retained-row equality and exact cleanup. Keep
this batch limited to128/129 and its documentation publication; no later findings.

Paid1aecd remains fixed while fullCI35592232217 finishes native jobs. Backend privacy/
Jest and canonical Following contract passed; isolated Following setup failed pulling
pinned PostgREST from Docker Hub due connection reset. Single-job rerun was rejected
while the workflow remains active. Retry only the failed job after completion; retain
failure provenance and do not change product code for this infrastructure failure.
After the paid gate is resolved, adopt final reviewed master once and run the affected
combined checks before one new paid publication. PR34/47 drafts,46 separate.

Home runtime remains released. Stream3 children/tabs closed, API18130/Next18131/DB/
auth session retained. Root API/tab closed, Next18133/DB retained. No native local
build reserved; no shared caches/devices/databases were cleaned or reset. All streams
remain incomplete; no new unit tests or expanded provider/native acceptance.


## Next-batch Stream3 host reminder Email repair grant

Coordinator verified568 durable hashes, the actor-bound Emailon/Pushfalse PUT/SQL/
reload baseline, one guarded real worker with hostmail0/inviteemail1, and exact six-
table/mail restoration. Seven refs/42 additional bindings establish reuse in existing
bookingNotifyService.js. Stream3 is sole writer only for sendBookingReminder there.
Read existing prefs; require strict scheduling.host.reminder_sent.email===true and
scheduling.paused!==true for exact assigned host, independent of push. Check exact
User lookup result/error and nonempty email; no owner fallback. Fail before recipient
email fanout on missing/error contact. Reuse existing formatting/template/emailService;
require success===true and preserve existing worker receipt-release retry behavior.
Keep current host notice idempotency and invitee branches unchanged. Host email may
precede invitee; host success followed by invitee failure can repeat host mail on retry.
Record this at-least-once limitation, including untested lost SMTP acknowledgement;
no new ledger/schema/service or exactly-once claim.

Existing invitee unsubscribe suppression is scoped to guest-provided address/owner,
not an authenticated host opt-out; do not apply it to host. Leave gigs/bids email
setting and all other channel/default/recipient policies unchanged. Strict existing
scheduling opt-in and pause govern this repair; no new global-email policy. Preserve
all UI, shared helpers/notification services and native code; no new application file
or unit tests. Reuse accepted baseline and paused notice/timer evidence.

Use retained owned runtime with exact fixture/query/sweep/write/recipient guards and
local SMTP only. Verify actual UI opt-in plus host/invitee mail, off/absent/paused host
negatives, real host lookup denial/restored retry, rejected host SMTP/claim release/
retry/completed-attempt dedupe, and partial-recipient failure with exact repeat counts.
Label synthetic missing-contact/fault injection separately from real SQL/SMTP. No
provider/native/natural-timer replay. Restore all exact rows/messages/grants; close
private child/tab and retain shared runtime. Commit/push reviewable draft for next
batch; current paid1aecd/CI35592232217 and closed125/126/127 remain fixed.


## Next-batch Stream3 host reminder Email runtime check

Coordinator reviewed551 durable hashes and existing channel source map. Web Push
writes notify_me plus nested scheduling; Email writes nested host-row email. Existing
fanout's nonuser invitee mail and host saved-notification/push gates are distinct.
Source absence of a host-email consumer is a lead, not runtime acceptance.
Use retained owned runtime and exact temporary unpaused preference/due booking.
Through actual web Reminder sent controls change Email off to on while Push/reminder
is false; require exact actor/host and PUT/GET/SQL/reload representation binding.
Run unchanged worker once with fixture-only read/write/completion-sweep guards and
local SMTP restricted to exact synthetic host/invitee recipients. Observe host email,
saved host notice and invitee transactional email independently. No natural timer
rerun, new native/provider acceptance, application edit or invented recipient policy.
Preserve original preference absence/full JSON and retained tables/mail snapshots;
clean exact fixture/messages/child/tab and retain existing API/Next/DB. Any repair
requires actual failure and comparison of existing email/fanout implementations.
This later scope must not alter closed125/126/root-removal or documentation127.


## Next-batch Home Send invitation repair grant

Coordinator reviewed12 frozen baseline artifacts and source13/77 bindings. Real
request/list/rendered applicant and current Cancel/noPOST/full-state equality precede
the actual post-departure approval200: exact request approved, one targeted pending
invite/source link/audit, full occupancy unchanged. Three notification/email methods
were suppressed and provider/Notification/capability/command counts0; exact fixture
cleanup/runtime release verified. Do not repeat this baseline or sender/recipient
acceptance. Existing success toast is not delivery proof.
Stream2 is sole writer for handleApproveAccessRequest in existing
`frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx` only. Reuse current
pageConfirmation ownership and generation/token/origin/session checks before POST
and success/error/finally; existing retire already clears busy state. No other handler
refactor, shared store/global UI/copy/backend/schema/new application file/tests/native.
Use owned18141/18142/64550–59 after checks and existing exact-route/transport guards.
Verify ordinary approval once, pending confirmation departure closes/noPOST/full
request/invite/occupancy/audit/counts unchanged, fresh return and current denial/retry.
Reuse shared-ref role/decline regressions because those implementations stay unchanged.
Capture safe transport attempt counts, never raw tokens/email bodies; no delivery or
membership acceptance claim. Clean exact fixtures/grants/runtime and publish draft
for next batch, keeping current127/paid publication scope fixed.


## Next Stream3 source-only scope after pause repair integration

PR126 is merged5b8027964 after exact49becdb41 CI35591151829. Stream3 may adopt
that final application master on a separate follow-up branch, preserving prior refs,
evidence and retained runtime. Reuse existing pause/source maps and inspect the
existing host per-channel push/email controls, their saved JSON keys, notify_me gates
and actual delivery consumers. Separate in-app persistence from push/email delivery
and already defined recipient policy; identify one bounded verification proposal.
No runtime expansion/application change/new tests/native/provider send or invented
channel policy. Do not rerun accepted paused/Resume/manual/natural timing journeys.
Later findings stay outside the completed125/126/root-removal integration batch.


## Integration batch boundary and Home approval runtime scope

Current integration batch is limited to merged125, reviewed126 host pause repair
and root e167 saved-card removal lifetime repair, followed by documentation publication
and one paid update. Later findings/PRs belong to the next batch; keep current heads
fixed under required CI and do not continually extend this integration.

Coordinator reviewed13 Send invitation source artifacts/77 bindings and the existing
transaction/notification side effects. PR125 mergedbc2bec5ad after exact1c9181a59 CI.
Stream2 may adopt that master on a separate follow-up branch, preserve125 refs and
reacquire only owned18141/18142/64550–59 after checks. Runtime-only: real request
creation/list200/rendered applicant without membership, current Cancel/no approval
POST/full snapshots equal, then pending Send invitation across same-document Settings
departure. If confirmation survives, record actual approvalPOST/status/exact request,
one targeted pending invite/audit and unchanged occupancy before proposing repair.
Keep real service/SQL and process-lifetime dynamic notification/email interception;
block external transports/unexpected mutations. Record safe method counts only,
never raw invite tokens or email bodies. Notification/inbox/provider delivery and
sender-recovery semantics are not established by this route or its success toast.
Reuse accepted invitation/role/decline evidence; no replay or new shared store/UI/
service/schema/app file/tests/native scope. Capture full request/invite/occupancy/audit
and fixture notification/capability/command counts, restore exact data/grants and
release owned runtime. Report actual failure before application edits.


## Home next source-only task while PR125 integration finishes

Keep125's application source/runtime frozen. Compare the remaining existing Requests
Send invitation confirmation with the accepted role/decline lifetime implementation,
its SDK/route/transaction and notification side effects. Map current/archive/open
variants and reusable accepted invitation fixtures/evidence. Source-only reads are
authorized while updated125 CI runs; no runtime or application change. Identify a
bounded local UI/SQL proposal that blocks all external transports and preserves
request/invite/membership state, without replaying accepted sender/recipient journeys.
Report any policy distinction before expanding scope. After integration, adopt final
master on a separate follow-up branch before runtime work. No global dialog/store,
new invitation system/schema/UI/tests/native or provider sends.


## Stream3 host pause repair grant — actual UI/delivery failure

Coordinator reviewed526 durable hashes, actual paused web banner/GET200 and cached
304 identity binding, exact paused=true SQL preference and one guarded manual worker
that saved a host reminder despite pause. Local invitee SMTP was observed separately.
Six tables/original mail IDs restored, preference absence0, child/tab closed; ordinary
browser login retained and auth tables explicitly outside cleanup claim.
Stream3 is sole writer only for existing
`backend/services/scheduling/schedulingNotifyPrefs.js` hostWants and hostWantsKey:
after getPrefs, return false for strict prefs.scheduling?.paused === true before
existing notify_me checks. Preserve read-error behavior, defaults, invitee transactional
branches, BookingPage.is_paused/new-booking behavior, reminder offsets and all UI.
No new policy for emergency/host email/attendee channels, no shared notification
service/SDK/schema/new app file/tests/native or provider scope.
Verify exact paused host notice absence with unchanged transactional local mail,
actual existing web Resume persistence followed by a fresh fixture reminder producing
a host notice, and an existing lifecycle consumer of hostWants with exact local
fixtures. Reuse natural timer/Resume baseline, do not repeat scheduler timing. Retain
fixture-only guards across every query/write/sweep/recipient and local SMTP. Relevant
existing checks only. Report actual exercised paths and limits, full original data/
mail/grant cleanup, exact source commit/push/draft; coordinator owns integration.


## Stream3 runtime-only grant — web notification pause delivery

Coordinator reviewed510 durable hashes and the seven-ref/49-binding pause map.
Existing web banner says Notifications paused with emergency exception and reads
scheduling.paused. Native page.is_paused controls a distinct new-booking contract;
no parity repair or broader recipient/channel policy is authorized by this check.
Use only retained18130/18131/64531–37 and one exact temporary booking/preference.
Capture original preference absence/full JSON and all retained booking/page/log/
notification/event/preference rows plus local mail IDs. Seed scheduling.paused=true
and notify_me.reminder=true, verify actual web banner/current GET/SQL identity, then
invoke the unchanged existing reminder worker once through the accepted private
fixture-only query/write/transport guards. This is a manual worker check; do not
repeat or relabel the accepted natural timer. Scope every Booking read/PATCH including
completion sweep, every downstream write and recipient to exact owned fixture IDs;
reject unexpected writes/providers, local SMTP only. Observe host saved notice and
transactional invitee mail separately, preserving existing recipient policy.
No application changes until actual failure/precise proposal. No daily agenda,
new pause UI/native run, all-jobs activation, provider send or new tests. Restore
exact original preference/data/mail state, stop private child/owned tab and retain
existing API/Next/DB. Report full unchanged snapshots and explicit SQL-seeded pause,
manual-worker/local transport limits; this does not verify creating a pause via UI.


## Stream3 next source-only scope — pause/resume delivery contract

The isolated natural reminder timer is accepted within its recorded source/runtime
limits; do not repeat it. On a separate follow-up branch adopt current master after
checking source bindings, preserve scheduler/private evidence and retained runtime.
Trace existing web/native pause/resume controls, saved scheduling.paused and actual
notification/worker consumers across current/archive/open implementations. Separate
visible product promise from unspecified channel/recipient policy; reuse accepted
Resume persistence and reminder timing evidence. Identify one concrete runtime
scenario and exact isolated fixture proposal before execution or application edits.
No new daily-agenda system, invented pause policy, worker/SDK/schema/UI change,
provider send, native build or unit tests. Keep owned runtime retained and clean;
source-only reads require no user prompt. Coordinator retains shared-file ownership.


## Home Requests decline repair grant — verified departure failure

Coordinator reviewed11 frozen baseline artifacts and actual creation/list/rendered
applicant/Cancel/departure/rejection200/SQL evidence, plus the reused10-file source
map. Cleanup restored all base and extra request/applicant/audit/invite/member counts0,
no grants changed, two notification methods suppressed, no provider/network writes;
owned tab/API/Next closed and five containers stopped/preserved. Baseline is accepted
within synthetic identity/transport limits and must not be rerun.
Stream2 is sole writer for decline-confirmation lifetime in existing
`frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`.
Reuse the existing role dialog ownership ref for role plus decline (rename locally
if needed), and the current retire/generation/token/origin/session guard. Close only
the still-owned dialog on retirement; reject stale continuation before rejection
POST and guard success/error/finally UI. Ensure retire clears stale request-busy state
if guarded completion can no longer do so. Preserve existing role behavior and other
dialog ownership, policy, controls/navigation. Approval remains outside this repair.
No shared store/global UI/backend/schema/new application file/unit tests/native.
Reacquire only owned18141/18142/64550–59 after checks; retain fail-closed local fixture
transport/mutation limits. Verify current decline once, departure closes/noPOST/full
rows unchanged, fresh return, current denial/retry, and a focused role confirmation
check because the ownership ref is shared. Reuse123/121 broader role evidence. Report
only actual exercised session/late/other-dialog cases. Complete exact rows/grants/
transports/runtime cleanup and publish a reviewable draft for coordinator integration.


## Home Requests runtime-only grant — after source review

Coordinator reviewed the10-artifact source bundle on55856362b: existing Requests
Decline→SDK→homeInvitationService→write_home_invitation and canonical request/list
contracts,48 reference bindings. Earlier ancillary queue503 was a private service
stub and is not a production failure. No decline defect is yet reproduced.
Stream2 may reacquire only owned18141/18142/64550–59 after ownership/listener checks.
Reuse existing private fixture with real invitation service/PostgREST; preserve the
accepted process-lifetime interception of dynamic notification transports. Block all
external provider calls and unexpected mutating routes; record transport attempts.
Only exact synthetic applicant/no occupancy, owned Home/current owner, request creation
and rejection. Real creation/list200 and rendered applicant are required before the
lifetime check. Verify current Cancel/noPOST/full request/audit/occupancy/invite rows
unchanged, then pending Decline with actual same-document departure. If it survives,
record actual old confirmation POST/status/SQL and report before application edits.
Reuse invitation/role evidence; no broader replay, approval, provider delivery, shared
store/global UI, schema/new application file/unit test/native work. Capture full
snapshots, remove exact owned rows/overrides, close tab/API/Next and stop/preserve only
owned containers; report complete cleanup. Current candidate scopes need separate
review after an actual failure. This extends runtime verification only.


## Next Home source-only reconciliation after PR123

PR123's existing role-confirmation repair is merged55856362b after exact178b4a1
CI35588215044 and coordinator evidence review. Stream2 may adopt that master on a
separate follow-up branch, preserve prior feature refs and keep runtime released.
Map the existing standalone Requests decline confirmation, its actual SDK/route/
service/SQL and current/archive/open implementations. Identify whether accepted
request fixtures/callers can verify lifetime without the earlier ancillary queue
stub. Reuse role and invitation acceptance; do not repeat successful journeys.
Report exact scope and an actual-UI/local-SQL fixture proposal before runtime use
or application edits. No shared store/global dialog, new request implementation,
provider sends, schema/UI/new file/unit test/native work. Source similarity alone
is not a reproduced decline defect. Preserve the existing original backlog limits.


## September21 — confirmation repair and isolated scheduler verification

Paid head e970ea26a is published and fixed under CI35586627926. It contains the
verified d1da default-card repair and final master b409 from documentation119.
PR34/47 stay draft;46 remains separate. No new unit tests or heavy native build.

Stream2 is sole writer for role-confirmation lifetime in existing
`frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`.
Coordinator reviewed the actual post-departure POST200/SQL role change and the
15-artifact durable baseline, including five current sources/25 reference bindings
and exact fixture/runtime cleanup. Do not reproduce that baseline again. Reuse
existing retire/generation and MemberDetail guards: track identity of this caller's
role dialog, dismiss it with false on retirement only while still owned, capture
revision/token/API origin/session marker before await, reject stale confirmation
before POST, and guard stale completion UI. Preserve other dialogs, permissions,
role cycle, controls and navigation. No shared confirmStore/global dialog, backend,
schema, new application file or selector change. Reacquire only owned18141/18142/
64550–59 after ownership checks. Verify normal current confirmation once, departure
closes/noPOST with full member/audit rows unchanged, return/new confirmation works,
and current error/retry where affected. Reuse121 cancellation/role/permission evidence.
Session or other-dialog races require actual UI evidence before claiming acceptance.
Restore exact fixtures/grants and release owned runtime afterward; publish a draft.

Stream3 may perform the proposed private, isolated natural-cadence check on b409.
Coordinator reviewed495 durable hashes and the existing registration/worker: real
node-cron schedules bookingReminders at UTC `3,18,33,48 * * * *`; the worker begins
with a global completion sweep. Never enable all jobs on the retained database.
Load unchanged jobs/index.js in a private child and allow only the bookingReminders
wrapped jobName through to real node-cron; record skipped registrations. Install
fail-closed guards before imports and check module-load side effects. Every Booking
read/PATCH must include the exact temporary booking ID, including completion sweep;
all downstream writes must be tied to its exact reminder/notification identity.
Reject unexpected writes and external provider transports; allow only owned local
SQL and SMTP127.0.0.1:64535. Keep existing page/event/account/preferences read-only.
Snapshot retained Booking/Page/ReminderLog/Notification rows and check no unrelated
change or addition. Wait for original wall-clock schedule, with no time advance or
manual worker call; record registration, callback, SQL receipt/notice and local SMTP.
Stop the task/child after one callback, remove exact temporary rows/messages, verify
retained snapshots and report cleanup. Keep existing18130/18131/64531–37 reservation;
no new database/runtime allocation, application edit, provider send or native build.
This proves selected-job natural timer execution under synthetic isolation, not
unmodified all-jobs app startup, hosted delivery or daily-agenda acceptance. If guards
cannot establish isolation, stop this check and report the concrete boundary.

## Next bounded work after PR119 publication

PR120/121 are merged; paid a795 fullCI passed. Coordinator will adopt final master
with the verified local default-card repair and keep the next published paid head
fixed under its own required CI. Existing scopes/refs remain preserved.

- Stream2 runtime verification only: existing standalone Members role confirmation
  lifetime. Compare confirmStore/global navigation cleanup and accepted MemberDetail
  guards, then verify actual departure/cancellation behavior with the existing
  confirmation and caller. Reuse121 role-cycle/permission evidence; do not rerun it.
  Reacquire only owned18141/18142/64550–59 after ownership/listener checks. Restore
  exact fixture/member/audit state and report any actual post-departure command before
  proposing an exact in-place repair. No application edit, replacement selector,
  backend/schema/new file/test, broader permission or native scope is granted yet.
- Stream3 source-only N05 reconciliation: map the actual scheduler registration,
  its existing reminder worker/preferences consumers and the advertised daily-agenda
  control. Compare current/archive/open implementations before calling a feature
  absent. Identify whether a bounded natural-cadence check can use only exact owned
  fixtures and local transport without touching retained bookings or other jobs.
  Report a concrete existing contract and isolation proposal before scheduler/runtime
  expansion or application changes. Earlier manual-worker/SMTP evidence remains
  valid within its limits and is not natural-scheduler or daily-agenda acceptance.

No heavy native build is reserved. Existing Stream3 runtime may remain retained;
Stream2's previous role fixtures/runtime were cleaned and released. No new agents,
duplicate tasks, provider sends, speculative daily-agenda system or unit tests.

## Integration sequencing update — independently verified web fixes

Coordinator may integrate PR120 then PR121 while the existing paid a795 native
run finishes. Both bounded web changes have reviewed actual UI/SQL evidence and
passing exact original-head CI; they touch separate notification/member components
and no paid/native contracts. This supersedes the earlier blanket peer-merge hold.
Require each peer's current-master source comparison and exact updated-head gate.
Keep published paid a795 fixed: do not push the local d1da default-card repair until
its current fullCI35582693975 completes and final master is adopted. This permits
independent integration without cancelling that native run or weakening any merge
gate. Publish doc119 after the peer batch; do not merge unfinished broader scopes.


## Home standalone role-cycle repair grant — September21, 09:23 UTC

Stream2 is sole writer only for existing
`frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx` role-cycle logic.
Actual UI/SQL baseline cycled Guest→Admin→Manager→Admin. After correcting only
its private mounted-router log filter, two exact POST200/response/SQL receipts
reproduced Admin→Manager→Admin; current page hash7cadcd28 matches the source map.
The initial UI/SQL observations retain their missing-HTTP-receipt limitation.
An unrelated fixture request-queue503 is not a role-flow application defect.

Exclude owner only from the existing role cycle, locate the current role, then
advance through the same role order. Preserve the existing button, confirmation,
layout/navigation, members.manage gate and canonical server authority. Existing
MemberDetail is not a drop-in replacement because its action permission differs.
No replacement selector or explicit-role-choice product expansion, backend, SDK,
schema, new file or unit test. Verify all five roles via actual UI/request/SQL,
Cancel with no POST, current permission denial/retry and the existing nonowner
manager boundary; reuse accepted role-route checks. Clean exact owned rows/audits/
grants afterward and publish bounded evidence/commit. Only owned18141/18142/64550–59;
no native build. Hold integration behind paid a795 fullCI and coordinator review.

## Scheduling Resume repair grant — September21, 09:21 UTC

Stream3 is sole writer only for existing
`frontend/apps/web/src/components/scheduling/hub/NotificationPrefsForm.tsx`.
Actual keyboard Resume hid the paused banner/enabled controls without a preferences
PUT; SQL remained paused:true and full reload restored the banner. Exact temporary
row was removed, original absence restored. Four new evidence hashes and the seven
unchanged current/archive/open callback comparisons were reviewed.

Reuse the existing serialized preference persist/rollback path with a nested
scheduling spread and paused:false. Derive rendered paused state from the existing
optimistic/confirmed preference state so failure rollback and owner-generation
retirement remain effective. Preserve unrelated keys, controls, layout and normal
navigation. Verify actual UI PUT/SQL/full reload, real write-failure rollback and
retry, and exact fixture/grant cleanup. No SDK/backend/schema/new file/unit test,
worker pause/delivery-policy change or new native acceptance. Use only the existing
owned runtime. This is a bounded repair grant, not merge approval or broad closure.
Paid a795 remains fixed under full CI35582693975; hold the next feature merges until
that gate and the next batch review. Stream2's newly reported role-cycle baseline
remains under review; its corrected HTTP receipt capture is not application work.

## Current integration checkpoint — September21, 09:12 UTC

PR114–118 are merged into master27cd8b112 after source review, actual bounded
UI/HTTP/SQL evidence and exact updated-head CI. Paid2ea9 fullCI35576926687 passed
all15 applicable jobs/oneSeeder skip, including native jobs. Detailed merge SHAs,
source bindings and acceptance limits are in the current handoff/live01.
Documentation-only PR113 publishes this batch before paid adopts final master.
No new application edits or runtime acquisition until the coordinator releases
the following verification scopes. All three streams remain incomplete; PR34/47
stay draft and unrelated46 remains separate.

## Next bounded verification after the privacy integration batch

These scopes begin only after PR114–118 and documentation PR113 are merged and
the coordinator releases the existing tasks. Until then, preserve frozen feature
refs and the application/runtime hold. All three streams remain incomplete.

- Stream2: verify the existing standalone Home Members role action through its
  current screen, SDK role POST, Home IAM/authority service and canonical SQL
  transaction. The source-only comparison predicts incorrect role cycling; it
  does not establish a reproduced failure. Reuse accepted MemberDetail evidence,
  while preserving the standalone members.manage permission and existing designs.
  Reacquire only owned18141/18142/64550–59 after current ownership/listener checks.
  Verify real UI/request/persisted role and relevant denied/retry behavior, then
  report any failure and the smallest exact-path proposal before application edits.
  No replacement role selector, broader permissions or new UI/file/schema/test.
- Stream3: verify the existing scheduling notification settings Resume action in
  `frontend/apps/web/src/components/scheduling/hub/NotificationPrefsForm.tsx`.
  Source shows the existing PauseBanner callback changes local paused state only;
  verify actual UI → SDK/preferences route → saved JSON and full reload before
  calling it a defect. Reuse PR103 read/save/retry and the accepted reminder-offset
  evidence. Use an exact temporary preference row with original state captured,
  preserve unrelated keys, and restore it afterward. Existing18130/18131/64531–37
  reservation only. Worker delivery/pause policy is a separate boundary, without
  a repair grant or notification-delivery acceptance. Report the reproduced case
  and exact in-place proposal before editing any application path.

Neither scope authorizes new unit tests, native builds, screen redesigns, shared
helpers or application files. No heavy native slot is reserved. Shared ownership
remains with the coordinator; retain accepted source/runtime limits and exact
fixture/grant/session cleanup in the existing live stream status.

## September 21 confirmed privacy follow-ups — exact repair grants

Stream3 is sole writer only for `canViewProfessionalProfile` in existing
`backend/utils/visibilityPolicy.js`. Actual active private housemates returned200
with either-direction blocked Relationship; inactive/ended occupancy controls403.
Five temporary rows cleaned and four original table counts0, auxiliary logout200;
473 durable hashes verified. Existing getProfileVisibility already puts blocking
before shared-home visibility; compared helper variants retain the defective public-
only guard. Move the existing block check after owner/inactive guards and before
public/private branches. Preserve all other helper/safety scopes, connection/home
policy, middleware, schemas and presentation. Verify both block directions refuse
profile data, legitimate unblocked housemates still work, read-failure/retry and
existing owner/public/private controls, exact rows/grants/session cleanup. HTTP/SQL-
only; no new screen/native acceptance or unit tests.114/115 remain separate/frozen.

Stream2 is sole writer only for existing `backend/routes/homePrivacy.js` PATCH's
read-error check and stale fallback comments. Actual persistent SELECT denial
prevented writing (negative control). A real failed PostgREST SELECT403 followed by
restoring the original privilege before the route consumed that failure let the
unchanged PATCH200 reset three unrelated saved true settings to defaults. Controlled
recovery timing, real database replies/SQL persistence, synthetic identity; API-only.
Capture/throw the read error before merging/upsert; successful absence keeps defaults,
existing permissions/validation/error envelope remain. No service/schema/UI/new file/
unit tests. Verify repeated recovered-read failure causes no write, retry preserves
unrelated settings, true/false partial write, absence, validation/denial controls and
exact cleanup. This does not close concurrent partial-write or native UI boundaries.
116 stays frozen on its own branch. Both scopes use existing separate owned runtimes;
no native build or shared-file overlap. Paid2ea9 stays fixed while nativeCI completes.


## Next verification window while the paid integration gate runs

Root saved-method read verification passed without an application repair; detailed
source/runtime/cleanup and excluded initial attempts are in live01. Paid2ea9 remains
fixed under35576926687; no native build slot. Peer114/115/116 original-head CI passed,
source-bound evidence reviewed; hold merges for the next coordinated batch.

Stream2 may verify only the existing HomePrivacy PATCH ignored-read lead over actual
HTTP/SQL after comparing existing routes/contracts. Reacquire only owned released
18141/18142/64550–59 after listener/ownership checks. Prove before/after persistence
and restored grants/fixtures; a read denial that also blocks the write is not proof
of overwritten settings. No existing web toggle caller/native control is available:
label this API-only, do not invent UI. No application edit until a reproduced failure
and exact route proposal;116 source stays frozen on a separate follow-up branch.

Stream3 may verify only the existing private professional-profile blocked-housemate
boundary over actual HTTP/SQL. Read canViewProfessionalProfile/shareHome contracts,
reuse exact owned rows or narrowly scoped temporary fixtures, restore original state.
Owner/anonymous/public/connection behavior accepted in115 is reused. Source suspicion
alone does not authorize a helper edit; report a demonstrated failure and exact repair
proposal before expanding.114/115 refs stay frozen; separate follow-up branch and
existing owned18130/18131/64531–37, no new UI/schema/helper or native build yet.


## September 21 next bounded privacy repairs

Stream2 is sole writer for existing `backend/services/homePrivacyService.js` read
behavior and its stale fallback comments. Actual saved address_precision=true hid
an owned fixture unit; HomePrivacy SELECT denial made real Place/intelligence200
expose the unit and GETprivacy200 falsely report false while SQL remained true.
Thirty source/ref comparisons and both production callers were reviewed. Propagate
database/transport failures through their existing error paths; only successful
absence retains existing defaults. No route, PATCH, schema, new file or UI change.
Verify real Place error/retry without unit exposure, GET error, saved true/false and
genuine absence, affected existing regressions and exact grant/fixture cleanup.
Native fallback and PATCH ignored reads remain separate, unaccepted leads.

Stream3 PR114 at59b67ee84 has reviewed scope, all461 durable hashes and5 source
bindings verified, including unchanged-row/original-empty cleanup and restored SELECT.
Actual self-editor failure/retry/absence evidence is accepted within its recorded
local-runtime limits; held-response/session/native boundaries remain unverified.
Its currentCI35577190208 and paid2ea9 fullCI remain required; do not merge yet.

Stream3 next sole writer, separate branch with114 frozen: existing
`backend/routes/professional.js` GET /:username optional viewer authentication only.
Actual authenticated blocked viewer received public200 and accepted connection got
private404 because viewerId was always null. Compare existing/archive/open route
implementations before editing; reuse existing optionalAuth plus req.user identity
and current canViewProfessionalProfile policy. No middleware/helper/global-auth/UI/
schema/new file/unit test changes. Verify real bearer and cookie identities,
owner/connection/blocked/anonymous controls and relationship read failure/retry;
report any newly exposed helper-policy defect separately before changing that helper.
No current public-screen caller was found: this milestone is HTTP/SQL-only, without
inventing a screen or claiming UI acceptance. Exact temporary rows/session cleanup.
Existing stream runtimes stay separately reserved; no native slot. Hold new merges
until the current paid full gate completes and the next batch is reconciled.


## September 21 integration checkpoint

All three streams remain incomplete. The current bounded Home/social repairs are
being integrated before the next application work; do not start duplicate tasks.
Paid branch `codex/paid-gig-integration` is clean/pushed at
`b75637fd82f4554ffbd51fb85a3115cf97aa9d17`. Its full
[CI35572520685](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35572520685)
passed all 15 applicable jobs, including iOS and Android, with one Seeder skip.
The updated PR47 body and final CI receipt are mirrored with 33 verified vote-phase
artifacts. Completion-proof phases remain separately verified at 11 and 14 files;
no new application repair or unit tests were needed for those journeys.

PR110 merged `adfe78b5ded941f55c5f20ccdbad0f572c445a0a` after exact
`33414dda8` [CI35574554620](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35574554620).
PR111 merged `4b6b8e21157839eb71252647222702240c7b79af` after exact
`23b33833a` [CI35575532878](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35575532878).
Both integrations preserve their reviewed source bytes and acceptance limits.
PR112 merged `3d1672d0d2727b37e074020b871a04fc213e3919` after exact
`529f19aae` [CI35575801501](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35575801501).
The clearing component is unchanged from reviewed22d2; its originalCI also passed.
The corrected keyboard/DOM-empty clearing baseline is accepted; earlier no-op
fill('') textarea attempts remain explicitly excluded. Live02 final original-head
CI snapshot869ebd99 was captured in11f601d87; all17 clearing artifacts verified.

Next: publish the separate five-document PR106, then adopt final master
once into the paid branch and run relevant combined checks. PR34/47 stay draft;
unrelated46 is untouched. Root API18132 and completion tabs are closed, exact
fixtures/grants restored; owned Next18133 and79-migration Supabase64561–67 retained.
Stream2 released its runtime with12 zero counts; Stream3 retains only its owned
18130/18131/64531–37 runtime and original fixtures, with new temporary rows removed.
No native build is reserved. Provider/device limits and the unanswered cancellation/
no-show fee policy remain open; no broad acceptance row is closed.


## Next bounded work after this documentation publication

After PR106 merges, coordinator releases both existing tasks to adopt that final
master in their own application worktrees on separate follow-up branches. Preserve
all prior feature refs and evidence; do not overwrite remote integration heads.

- Stream3 sole writer: existing `frontend/apps/web/src/app/(app)/app/professional/page.tsx`
  load/error/retry path. Actual saved profile plus SQL SELECT denial returned500,
  but this page showed an enabled create form. Seven existing/archive/open refs have
  identical failure-to-create behavior. Reuse existing ErrorState and established
  session lifetime; show creation only after confirmed absence, preserve the normal
  screen/forms/navigation. Verify real denied load/repeated retry/restoration and
  genuine absent profile, with exact fixture/grant cleanup. No new route, schema,
  service, file, unit test or public-profile optional-auth repair in this grant.
  Existing owned18130/18131/64531–37 reservation continues; no native slot.
- Stream2 runtime verification only: existing D06 restrictive Home address privacy
  through its actual Place consumer and caller, including database read denial/retry.
  Reacquire only its released18141/18142/64550–59 resources after checking ownership
  and listeners. Compare existing policy/service/route/SQL and preserved evidence;
  no application repair until a reproduced failure and exact path proposal. Existing
  web settings/security uses ownership policy, not HomePrivacy toggles; do not
  conflate these. D05 partial-save and D07 standalone-member leads remain separate.

Both streams preserve design and report source-bound UI/API/SQL evidence, limitations,
cleanup and a reviewable commit/PR. Coordinator holds new merges for the next batch;
current paid full CI and unchanged accepted journeys must not be duplicated.

Updated September 16, 2026. The user authorized three concurrent streams. This
folder coordinates their next bounded milestones; it does not replace the existing
backlog, acceptance evidence, or verification-first instructions.

## September21, 07:49 UTC — completion-proof UI verification complete

Paid source remains **b75637fd82f4554ffbd51fb85a3115cf97aa9d17**, clean/pushed,
fullCI35572520685 application/web/schema gates passed; native jobs still running.
No application edit or new unit test in the completion-proof milestone. Existing
CompletionFlow/FileUpload→SDK→upload.js/gigs.js→s3Service→File/mark_gig_completed
and local private Supabase Storage verified, with9source bindings including existing
21600/21700 contracts. Reuse prior32/32 completion/review/stop HTTP/SQL and paid
capture evidence; do not repeat their unchanged policies.

Actual IAB22–24, two independently cleaned phases:
- Mismatched PNGbytes/jpg declaration returns400; note/file retained, File0 and
  Gig stillin_progress. Exact owned bucket absence makes valid upload503 with same
  retained draft/no completion command. Restore private bucket, keyboard Enter
  uploads200→mark-completed200, one File/object and exact note/private reference.
- Separate requester existing Review & Confirm/Review Work shows exact note and
  one real image (complete/natural192×192/displayblock) and blob proof link. Owner/
  worker protected GET200 bytes match storedSHA; unrelated403/anonymous401;
  direct public Storage URL400, protected response private,no-store.
- Second phase destroys only successful upload reply after actual File/object
  persistence. UI error retains draft; no completion command. Enter retry reuses
  exact File/object1 and completes once.
- Second task uploads two files; after first actual save, private harness revokes
  service-role completion RPC execution. Second file fails503, two UI attachments
  retained, first File stays and Gig in_progress. Restore grant, Enter retry reuses
  first and adds only missing second, then completes once. Final3Files/3objects/
  2owner notices across phase2, one completion POST per task; protected reads match.

No demonstrated application defect requiring repair in this bounded sequence.
Synthetic fixture sign-in/ancillary shell and preassigned free gigs; real UI/SDK/
routes/SQL/local Storage, controlled reply loss/privilege change. Existing generic
completion error toast observed; no specific-message improvement claim. No provider
writes, owner approval, native/hosted storage, or whole attachment/financial closure.

Exact final cleanup for each phase: User/authUser/Gig/GigBid/GigQuestion/Payment/
File/Notification/storage.objects/storage.buckets all0; original service-role EXECUTE
restored. APIs stopped, tabs22–24closed, fault markers consumed; Next18133 and owned
79schema Supabase64561–67 retained. Peer resources untouched. Private originals
/private/tmp/pantopus-stream1-completion-proof-r1 and-r2; durable owner audits
20260921-stream1-completion-proof-r1 **11files** and-r2 **14files**, each manifest
verified,9source bindings, final cleanup. Credentials/operator logs excluded.

Integration: PR103 merged74ab0f74e on7a9bea32d CI35572773645; PR105 mergeda0b952379
ona8941dd1e CI35573070220; PR107 merged4e69c23b8 on55ef4c6ab CI35573379836;
PR108 merged12eddf992 ona18a26ea4 CI35573732930; PR109 mergedc7755c345 oncad6ba789
CI35574099206. All guarded exact heads, source/evidence reviewed, no override.
PR110 master update requested after originale50ed CI passed; PR111 original36fb
CI35574234363 passed and4source bindings/448durable files reviewed. Live02/03 frozen
coordinate/relationship handoffs captured05fa6f0b9. Doc-only106 remains unmerged.

Stream2 completes only current optional-clearing grant before another repair:
initial fill('') text-clear attempts were invalid and excluded; candidate reverted.
Corrected keyboard deletion plus DOM-empty readback proves5text fields and empty
trash select omitted by unchanged payload, then restored by save. Only six payload
lines may change after each actual baseline/contract. No schema/transaction expansion.
Coordinate parser grant remains a separate frozen3-line milestone. Stream3 may run
professional self-editor verification with exact temporary actor profile/restoration;
no new app repair granted while111 integrates. Public endpoint without a screen caller
can be HTTP-only; no fabricated UI. Fee-policy question remains unanswered.

## September21 completion-proof runtime reservation

Root reserves existing18132/18133/64561–67 for private completion-proof-r1/f9200360.
Phase1 cleaned to0, bucket deleted/tabs22–23closed. Follow-up r2/f9200370 verifies
lost upload acknowledgement and partial multi-file retry using the same source,
new private bucket stream1-completion-proof-r2; no provider writes/native build.
Existing CompletionFlow→upload SDK→upload.js/s3Service→File/mark_gig_completed and
private local Supabase bucket stream1-completion-proof-r1. Reuse prior32/32 completion/
review/stop HTTP/SQL and later paid capture; focus on existing UI attachment upload,
storage-error/retry and authorized private read. No application repair before a
reproduced gap, no new unit tests, no financial provider writes/native build. Synthetic
local identity and preassigned free fixture; actual upload/router/SQL/local Storage.
Copy existing private harness; unique bucket/rows cleaned exactly afterward, peer
resources untouched. Published b756 stays fixed under CI35572520685.

## September 21, 07:26 UTC — paid publication and Home integrations

Paid **b75637fd82f4554ffbd51fb85a3115cf97aa9d17** is pushed to draft47, including
verified atomic vote e2b03de6b and reviewed master f273712ec. Prior3025 full
CI35570109862 passed15/oneSeeder skip, all iOS/Android included. New automatic
**CI35572520685** is running; keep this head fixed. Combined TypeScript passes,
all3vote and2integrated peer source bindings match. PR47 description updated;
32durable vote-phase files include final prior CI, integration and published body.
No new root runtime fixtures/provider writes; existing Next/79schema runtime retained.

Home audit PR102 merged **f273712ec4b31e08cbcb10be05661f7e7a463ba4** at07:19:35Z
on exact3de541d72 CI35571953892. Member PR104 merged
**0cca2d4e2d6f902dc19677e96dee4443dd31b72f** at07:23:53Z on exactd304f08df
CI35572440658. Both updated heads changed only reviewed booking worker relative
to their accepted candidates; component bytes/evidence unchanged. No overrides.
PR103 updated to **7a9bea32d373cac5e849a1a5ce2123eac2a46f2f**, only reviewed worker
and two Home components added; pending current-head gate. Then105→107→108 integrate
in sequence after exact source/evidence and up-to-date CI. Docs-only draft106 remains
held behind this feature batch. Paid34/47 remain draft; unrelated46 untouched.

PR107 frozen7e91907a on105: checked UserProfileBlock error in isScopedBlocked;
all440durable hashes/4source bindings reviewed, actual UI and10REST routes fail
without exposing blocked data and recover after restored query access. Scope/direction,
self/anonymous controls retained; no new policy. OriginalCI35572584966 passes.
Live03 c9b9022f captured871ec4885. Legacy Relationship blocked-read error is a separately
granted runtime verification, no global helper edit yet; exact fixture cleanup required.

PR108 frozen39ced0c27 on member branch: existing settings error/retry hides Save
until known values arrive. Actual503/repeated retry, saved24h/text/false preferences,
genuine absent-row defaults,403/departure/current reload proof reviewed. Component
bytes and15durable hashes match. First coordinator manifest parser expected another
bundle format and failed; corrected flat-map validation passes before acceptance.
Live02 c3eaa722 captured1916b8f6f; peer may update. OriginalCI35572724323 pending.
No same-mounted Home/account reversed-response or successful-save claim.

New Stream2 sole-writer grant: existing SDK homes.ts updateHome PUT→PATCH plus
canonical name input and existing HomeSettingsTab name payload. Actual UI Save404;
canonical PATCH already accepts name/home_type with home.edit/location guards.
Five callers enumerated including two paid location fallbacks; preserve their existing
provenance and authorization and verify affected route payloads. No backend/schema/
migration/newtests. Legacy nickname public_info lead needs actual failure before any
extra caller edit; optional clearing/lifetime remain separate. Stream3 notified of
SDK ownership. Pending product question asks cancellation/no-show payer, recipient,
amount and trigger; no answer or fee execution inferred. Other work continues.

## September 21, 07:19 UTC — search handoff and historical-tip boundary

PR105 frozen **f43b9664a319935a4e03553fa14a568e033fb2d4** has exactCI35571949622
passing; coordinator reviewed its two-line existing identitySearch helper repair,
all429durable hashes and4source bindings. Live03 frozen6f10a681 captured in939233cf7.
Original PR104 deda CI35571776785 also passes; its stack still waits for102 integration.
No source/retest duplication or broad row closure. Shared publication remains doc-only
and should not merge ahead of the current feature integration sequence.

New Stream3 grant: existing visibilityPolicy.js isScopedBlocked UserProfileBlock
query only. Actual saved search_only block hid a Beacon; SELECT denial returned200
and exposed it again. Propagate failed block checks through existing REST error paths,
preserve current scopes/direction and legacy Relationship policy. Verify affected
identitySearch/users/localProfiles callers and exact fixture/grant cleanup. No other
helper/schema/newtests granted. Original baseline temporary row removed/grant restored.

Root P02 source reconciliation confirms existing SQL discovery is age-unbounded;
provider discovery starts before original provider_started_at and paginates, while
new provider creation refuses aged23h originals. Four exact prior owned Stripe TEST
tip intents were read without writes at07:17UTC: only8.62–8.87h old, created September20
22:24–22:40UTC. They cannot prove actual beyond24h provider discovery. Reuse accepted
synthetic-age checks; do not backdate a local clock and claim real provider-age proof.
P02 remains open at this boundary. Receipt added to vote mirror, now29files. No new
root runtime fixture, provider/customer/charge or application change for this check.

## September 21, 07:15 UTC — verified repairs and current integration queue

Stream1 local **e2b03de6b0fa17c15199ead374fce57959b0fb79** atomically toggles
question votes and their count in the existing handler plus reserved forward22200
function. Actual UI late-write failures roll back both records, error/retry recovers;
real concurrent actors, same-actor toggles, wrong-gig404, denied access and lock timeout
pass. Existing250 regressions and pinned2.116 schema-function gate pass. Detailed
28-file evidence and limits are in live01. Published3025 remains fixed while its full
CI35570109862 native jobs finish; e2b is not yet pushed. PR34/47 remain draft.

PR101 is merged **944489d5449286d2b362cd96334bcd771636f0fc** after exact CI.
PR102 original50289 CI35570755239 passed; guarded master update produced
**3de541d72295f98ed905df32d2d7ec87eaf86ca4**. Only the already-reviewed booking worker
changed during integration; Home source/evidence remain identical. Await new exact-head
checks before merge. PR103 frozen7e165 CI35571103116 passed; one-line getPrefs repair
and4source bindings reviewed. Its required master update follows102 to avoid redundant
CI. PR104 frozen **deda07ecf57f5cf9d8e052e1215782afd60db790**, stacked on102, is reviewed
within member read/retry and delayed-response limits; all14durable hashes/7source
bindings match. ExactCI35571776785 still required. Live02 frozen d209c063 captured in
**96047e4f5**; peer may continue status updates. No broader acceptance-row closure.

Current sole-writer grants after actual failures:
- Stream2 existing HomeSettingsTab.tsx only: actual settings503 rendered false48h/
  blank defaults despite saved24h/text and left Save enabled. Existing error/retry,
  loading and current Home/authority lifetime; no save-protocol/backend/schema changes.
  Separate follow-up branch preserves PR104. Own18141/18142/64551–59; no native slot.
- Stream3 existing identitySearch.js searchTableFields only: actual PublicPersona
  SELECT failure returned200/false empty search. Surface failed field queries through
  existing error path, preserve auth/visibility/ranking/shape. Five variants compared;
  following failure/retry works and is reused. Own18130/18131/64531–37; no native slot.
- Previous Stream3 schedulingNotifyPrefs.js getPrefs-only grant produced PR103:
  preserve saved scheduling keys before canonical normalization. Actual save/reload,
  UPDATE500 rollback/retry and peer-account HTTP isolation verified. Original no-row
  state restored, grant restored, no worker/provider delivery claim.

Root retains Next18133 and own79-migration Supabase64561–67; API18132 stopped after
exact8table cleanup0,5privileges restored and temporary constraints removed. IAB21 closed.
Peer runtimes/evidence remain owned and untouched. No heavy native build is active.
Continue bounded verification and integration; no new unit tests or design changes.

## September 21, 06:54 UTC — atomic question-vote repair reserved

Root reproduced actual UI upvote200 with saved vote1/count0 when count UPDATE fails;
UI keyboard removal200 with vote1/count0 when DELETE fails. Direct wrong-gig path
also removed the question's vote200. Parallel real HTTP from two fixture actors
returned200 twice but SQL held2votes/count1, without forced interleaving. Existing
six current/master/staging/place/archive handlers are byte-identical and have no RPC.
No existing question-vote transaction/trigger was found in canonical schema.

Root sole writer: existing backend/routes/gigs.js upvote handler plus one forward
**20260916022200_gig_question_vote_atomic.sql**, version collision absent across the
compared refs. Reuse GigQuestion/GigQuestionUpvote and unique/FK contracts, lock the
parent question scoped to gig, toggle and update exact count in one transaction.
Keep public response shape and current authenticated toggle policy; no new table,
service/UI/design/unit tests. Separate PostgREST writes cannot safely roll back or
serialize this operation; applied baseline cannot be rewritten, requiring one new
forward function migration. Service-role execution only, no anonymous/authenticated
RPC grant. Verify real UI denial/retry, rollback, wrong-gig/missing question, parallel
actors and same-actor toggles, relevant existing regressions and full schema replay.
Fixture f9200350, own18132/18133/64561–67; baseline evidence retained before cleanup.

## September 21, 06:51 UTC — reminder stale-scan repair grant

Stream3 sole writer for existing backend/jobs/bookingReminders.js: actual host UI
cancellation persisted before a held confirmed-booking scan was released; the worker
then created reminder log/notice and local SMTP after cancellation. After existing/
archive/open comparison, re-read booking before claim/send and skip terminal or
changed relevant start/end/host versus scan. Preserve dedupe/retry/offset policy.
Verify cancellation/reschedule/unchanged/error boundaries; no new schema/service/tests.
This narrows stale-scan behavior, not atomic cancellation versus provider delivery.
Original fixtures preserved; temporary exact IDs cleaned by Stream3. Scope stays owned
18130/18131/64531–37; no shared notificationService edit or native build.

## September 21, 06:49 UTC — all streams resumed; integration candidate published

User explicitly resumed all three existing tasks beyond single milestones. Paid
**3025ded4b3eda6d9cf96401ba033f69143fe2f24** integrates reviewed master0f6e55e01;
prior exactdd0 CI35567323534 passed15/oneSeeder skip including all native jobs.
201of202 tracked source bindings unchanged; only reviewed posts SDK persona target
union differs, and all6persona hashes match1d835. Paid services/UI/migrations unchanged;
combined TypeScript passes. New automatic CI pending. PR34/47 stay draft; PR46 separate.

Root next bounded verification: existing QASection upvote→SDK→gigs route→GigQuestion/
GigQuestionUpvote count consistency and write-failure behavior. Separate row/count
writes and unchecked reads/deletes are source leads, not runtime findings. Reuse prior
question creation/read/identity/action evidence; no new unit tests or presentation work.
Root reserves18132/18133/64561–67 using owned cleaned wallet-read-r1 database and new
private gig-qa-vote-r1/f9200350 fixtures. Apply only missing reviewed schema to this
owned runtime; no shared database/cache cleanup. Compare existing/archive/open source
before any new artifact/migration; repair only reproduced gaps.

Stream2 owns18141/18142/64551–59. Native control remains unavailable on read-only
check; heavy native slot released without rebuild. Proceed D07 Home Members/Security
browser role/error-vs-empty journey, preserving PR60 evidence. Stream3 owns18130/18131/
64531–37 for N05 cancellation/reschedule versus reminders, existing UI/API/SQL/manual
worker/local SMTP; no shared worker edits granted until a concrete failure/request.
No active local native build. Streams continue independent work while peer CI runs.

## September 21, 06:19 UTC — persona repair integrated on master

PR99 exact1d8357330 passed [CI35567483902](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35567483902)
with8 applicable checks passed/3 path skips. After reviewed source/evidence and CLEAN
mergeability, coordinator merged **dd24f0029c58dd38e201a9fe6b349eda317361d7** at06:19:04Z.
No protection override or whole-row closure. Reserved enum13000 replay passes; hosted
activation/native/intact-account-switch limits remain open. Coordination includes this
master; documentationPR100 still changes only five existing live documents.

Paid **dd0ee04b5** stays fixed for fullCI35567323534; web/backend/schema/identity passed,
native jobs pending. PR34/47 remain draft and PR46 separate. Adopt new master into paid
after its current gate completes; preserve exact evidence and do not repeat unchanged
journeys. Root runtime/fixture cleanup remains complete; peer resources retained.
Q&A mirror38files includes final persona source review/CI. Finish current gates and
publish final shared disposition before another application scope.

## September 21, 06:15 UTC — persona handoff captured, gates pending

Stream3PR99 frozen1d8357330 reviewed:6changed/3session source hashes and387durable
artifacts verified; live03c09d8f4a captured. ExactCI35567483902 still running, no merge
or next grant. Temporary persona/posts/mutes cleaned; original fixtures/owned runtime
18130/18131/64531–37 and handofftab7 retained. Rootdd0ee04b5 fixed under35567323534;
root runtime remains released. Finish gates and documentation-only publication;
no duplicated journeys, shared writer conflict, native build or broader row closure.

## September 21, 06:10 UTC — paid milestone published separately

Paiddd0ee04b5 publishes verified Q&A actions with master027afc13a; app bytes match6a.
Priorc426 fullCI35564679691 passed15/oneSeeder skip; new automatic scheduling pending.
No root runtime/native reservation; exact cleanup remains recorded in live01.
Stream3 continues only its existing persona grant, final cleanup/commit/handoff;
its uncommitted source is excluded from paid. Its completed race and regression
receipts are reused, not rerun solely because the prior task ended. Coordinator will
review the frozen source, migration13000 and durable evidence before integration.

## September 21, 05:57 UTC — Stream1 runtime released

Local6a0858690 Q&A action repair is verified within live01 limits. Exact f9200340
rows0, three privileges restored; API18132/web18133/Supabase64561–67 stopped, phase
IAB tabs17–20 closed, cache preserved. No provider writes or native reservation.
Publishedc426 stays fixed for CI35564679691. Stream3 persona grant and owned runtime
remain active; root has no shared writer conflict. Map97/96 integration is complete.

## September 21, 05:41 UTC — Q&A mutation verification reservation

Root reserves18132/18133/64561–67, reusing cleaned owned wallet-read-r1/full77 schema,
private gig-qa-mutation-r1/f9200340. Existing QASection vote/pin/delete → SDK → gigs
routes → SQL; source catch blocks silently discard failures, not yet runtime proof.
Verify actual denial/retry before any in-place repair. Reuse recent question creation,
identity and read-recovery evidence; synthetic saved question reader fixture, no provider
writes/native build/newtests. Publishedc426 stays fixed for CI35564679691. Stream3
persona grant remains separate; no shared application file or runtime conflict.

## September 21, 05:39 UTC — persona feed-mute repair grant

Map97/96 integrated027afc13a after exact9b CI35564770177; prior4c6f full native CI
passed and all3map hashes match paidc426. Live03c31f1ba2 captured before master merge.
Paidc426 remains fixed for automatic35564679691; no new Stream1 application scope.

Stream3 sole writer, new branch from current master: existing posts.js mute route,
feedService filter sets, SDK posts.ts target union, PostCard and existing hook/page
wiring for the reproduced persona mute that vanishes locally but returns on reload.
Use canonical public persona type/id and match only persona identity_context_id;
never expose the private actor or broaden mute to the owner's other profiles.
Preserve user/business/topic rows, current own-post policy, notification-only membership
mute, visibility and presentation. Compare existing/archive/open implementations and
report any additional required caller before editing beyond these existing paths.

One forward enum migration reserved **20260916013000_persona_feed_mute.sql**: after
master's12000 and before the paid branch's20100..22100, matching the existing allocation
scheme. No tracked branch has this version. Existing enum lacks persona, and applied
baseline cannot be changed; extend that type only. No new table/index/service or unit
tests, no applied migration rewrite. Verify retained rows and actual UI/API/SQL mute,
reload, unmute, denial/retry, repeat/concurrent behavior and public-persona isolation
with exact cleanup. Native compatibility is a separate recorded boundary; no local
native build grant. Own18130/18131/64531–37 only; root/peer resources preserved.

## September 21, 05:28 UTC — published candidate, source frozen

Paidc426f4729 clean/pushed; prior42d fullCI35562351562 green, currentautomaticpending.
MapPR97 updated9b contains onlydocs beyond full-green4c6f35562416370; currentgate/merge
pending. Docs98 merged63a27fd24 after exact60da CI35564213230. Stream3 latest03
d28fd087/364-file manifest791cbe2b captured. No further app grant until batch closes.
Root18132/18133/64561–67 stopped, tabsclosed/rows0/grantsrestored/cachepreserved;
peer runtime/fixtures retained, no native reservation. RedundantCI35562211102 and
35562395559 are canceled, not passed; allow delayed automatic scheduling before
another manual dispatch. Source/evidence details remain in live01 and03.

## September 21, 05:00 UTC — root runtime released; batch frozen

Local795ad998d PaymentSection error/retry verified within live01 limits, all owned
f9200330 rows0/identity+SELECTrestored; API18132/web18133/Supabase64561–67 stopped,
threeIABtabsclosed/cachepreserved, no native reservation/provider writes. Published42d
CI35562351562 runs. Stream3 current96/97 refs remain frozen, no further app grants;
its363-file reconciliation captured. Complete current integration and documentation
batch before new feature scope. PR98 only four live docs, no application diff.

## September 21, 04:52 UTC — gig payment reader reservation

Root reserves18132/18133/64561–67 using clean isolated wallet-read-r1/full77 schema,
private gig-payment-read-r1/f9200330. Existing PaymentSection → SDK getPaymentForGig
→ gigs/:id/payment → SQL, with one synthetic saved financial reader record. No new
charge/provider/mutation/settlement claim. Verify real failure before existing-component
repair; no backend/schema/newfile/style/tests. Published42d/currentCI35562351562 stays
fixed while local verification runs. Peer96/97 refs frozen/currentCI pending; root
reviewed popup one-line diff and captures03, no peer application edits.

## September 21, 04:45 UTC — conditional next map destination grant

After Stream3 freezes its current three-file map error milestone, it owns a separate
existing DiscoverMap popup href repair only for actual /app/posts/:id404. Confirm
canonical existing full-post screen/API and compare archived/open variants; reuse
/app/feed/post/:id if confirmed. Verify popup→authorized detail and missing/deleted
boundary. Preserve visibility/styles; no new route/file/schema/SDK/tests/persona edit.
Root local42dbe4b2c integrates reviewed master through95; published24c remains fixed
until CI35560003741 finishes. No active root runtime/native reservation.

## September 21, 04:41 UTC — root Q&A runtime released

Local4b8296f10 read-error/retry milestone is verified within live01 limits. Exact
f9200320 rows0/SELECTrestored/faultconsumed; API18132/Next18133/Supabase64561–67 stopped,
oneIABtabclosed/cachepreserved. No native reservation/provider writes. Published24c
CI35560003741 remains running only Androidquality; do not supersede before completion.
PR95 merged4e58b0bc after exact378c CI35561104880; map branch remains separate.

## September 21, 04:33 UTC — gig Q&A read verification reservation

Root reserves18132/18133/64561–67 for gig-qa-read-r1/f9200320, isolated retained
wallet-read-r1 full77 schema. Existing QASection read error/retry/lifetime only after
real failure reproduction. Reuse just-accepted question/answer creation and identity
navigation; synthetic saved question reader fixture, no provider/native writes/newtests.
Local7ad896338 retained; published24c fixed until current native CI completes.
Stream3 map reservation remains separate, no shared files or runtime overlap.

## September 21, 04:31 UTC — posts-only map error grant

Stream3 sole writer existing posts.js posts-only map error handling and existing
FeedMap error/retry/known pins. Extended04:39UTC to existing DiscoverMap.tsx posts-only
error/retry after actual ShowPosts GET500 rendered blank without error; preserve other
layers. FeedMap request-generation retirement included after intact old Askempty
replaced newer Updates marker. Verify actual boundaries, no newfiles/tests. Original scope after actual Search this area under Post SELECT denial
returned200/0 in view, then restored SELECT/filter recovered1 owned public post.
Preserve normalized mixed-layer contract and current map visuals/viewport/filter/
private-location policy; mixed partial-error reporting remains separate. Verify
FeedMap and DiscoverMap posts-only callers; report additional caller repairs before
expansion. No SDK/schema/new files/tests/persona edits. PR95 updated378c source hashes
match accepted436a; exact-head CI pending. Separate map branch and exact cleanup.

## September 21, 04:30 UTC — root runtime released

Local paid7ad896338 canonical poster/Q&A identity journey verified; live01 contains
source,26-file evidence, no-code-provider limits and cleanup. API18132/web18133/
Supabase64561–67 stopped; exactf9200310 rows0/identitiesrestored/twoIABtabsclosed/cache
preserved, no native reservation. Published24c retained until its currentCI finishes.
DocsPR92 merged b67b32d0 after exactddaa CI35560752881; PR95 four source hashes and
bounded actual failure/retry/cleanup reviewed, updated-master CI pending. Live03
1d0b647e captured atc7cc2c8c0/writerreleased; map read-only, persona schema ungranted.

## September 21, 04:22 UTC — gig identity baseline reservation

Root reserves owned API18132/web18133/Supabase64561–67, reusing clean isolated
wallet-read-r1 full77 schema for gig-identity-r1/f9200310. Verify existing poster/Q&A
identity contracts and real UI before repair. Actual saved question/answer and canonical
API identities reproduced poster/asker/answerer false anonymous labels. Root now owns
local in-place page.tsx, QASection.tsx and optional canonical href/locality fields in
existing types/gig.ts. Published paid24c remains fixed until current CI completes;
prepare/verify locally without cancelling that gate. No shared UserIdentityLink,
backend/schema/new files/tests/design changes. No provider writes or native reservation.

## September 21, 04:19 UTC — checked feed reads and unmute grant

PR94 exact1fb5a58adc passed CI35560095912 and merged
b463ee3850e089b523426317b90d9bb246f82c89 after source hash, real UI failure/retry,
persistence, concurrent repeat and cleanup review. Live03 bd13b1ec captured at7df79730e;
writer released. Paid24c519653 remains unchanged while combined native CI runs.

Stream3 sole writer on a separate branch: existing posts.js DELETE mute handler and
feedService.getMuteAndHideFilters checked reads, plus existing useFeedData.ts and
feed/page.tsx error/retry. Reproduced DELETE200 with row retained under denial,
GET/feed200 exposing persisted hidden post under filter-read denial, and cold feed500
rendering false empty. Preserve all five filters, access policies, current-owner rows,
cache ownership and existing visual treatment/ErrorState. Verify real denied reads,
retry, feasible session retirement and exact cleanup. No new files/tests/schema.
Persona mute enum extension remains read-only proposal, separate from this grant.

## September21,04:10UTC — bounded Pulse hide persistence grant

Stream3 sole writer existing backend/routes/posts.js /hide/:id handler only, after
actual PostHide INSERT denial returned200/toast/card removal while SQL remained0
and reload brought the card back. Check lookup/upsert errors through existing500,
preserve nonexistent404 and current access policy/styles; reuse frontend rejection
behavior. Verify realUI500/card retention, restore/retry/persistence/reload, duplicate
idempotency and exact owned hide cleanup. No new files/tests or filter/unmute changes.
PR93 frozen/coordinator-owned; separate branch. Root includes PR93 in the imminent
paid batch and holds its source/CI stable while later peer scopes remain separate.

## September21,04:08UTC — root bidder runtime released

Existing OffersPanel canonical identity repaired locally ata3ff82a01 and actual
profile/fallback/Refresh/keyboard journey verified; live01 evidence/limits apply.
Owned18132/18133/64561–67 released, rows0/identityrestored/cachepreserved/tabclosed;
provider writes0, no native reservation. PR93 source and evidence reviewed/current
CI pending; no additional root app edits before the combined gate. Stream3 existing
runtime and bounded verification remain separate; request grant before new repairs.

## September21,04:01UTC — bidder identity verification and message destination grant

Documentation PR87 exactc3e116a91 passed CI35559237804 and merged9f14a638a529dd272817b08c797fd11e79047ae6.
Root reserves18132/18133/64561–67 for private bidder-identity-r1/f9200300, reusing clean
owned wallet-read-r1/full77 schema. Existing OffersPanel canonical bidder identity only:
previous actual UI Anonymous; API serializer publishes displayName/handle/avatarUrl/href.
Verify the concrete mismatch and navigation before repair. No backend/private-field/
newfile/schema/style/test change, no provider writes, no native reservation.

Stream3 sole writer existing marketplace useListingDetail send-success destination,
PublicProfileClient.handleMessage navigation and ChatRichCard listinghref for reproduced
message201→ignored roomquery/inbox and ViewListing404. Compare existing/archive/open;
reuse canonical conversation/marketplace screens, preserve other cards/styles/policy and
draft/error behavior. Verify actual send/persisted message/destination, profile Message,
card navigation and missing/deleted boundaries. No new routes/files/backend/schema/tests.
UserIdentityLink remains an unverified source lead; neither stream edits that shared file.
Live03 writer released after publication; peer runtime retained.

## September21,03:57UTC — Stream1 runtime released; integration batch closing

Paid2a05e797e includes verified wallet history-refresh repair02706ba39 and reviewed
masteref7382ea1 through PR91; combinedCI35559173441 pending. Owned18132/18133/64561–67
released, wallet-release-r1/f9200290 rows0/grantrestored/tabsclosed/cachepreserved;
two test captures refunded/customerdeleted. No native reservation.
Stream3 no-code message entry evidence captured; resolver PR91 merged. Next concrete
message destination findings remain read-only during documentation PR87 publication.
Root owns shared status/publication; Stream3 retains its existing runtime/fixtures.

## September21,03:43UTC — marketplace notification destination grant

Stream3 sole writer existing web lib/notificationRoutes.ts for supported listing,
listings and marketplace links to existing /app/marketplace/:id. Actual question
notification opened public preview lacking Q&A; native handoff was blocked and is
not to be retried/bypassed. Compare existing/archive/open source, preserve URL validation,
query/fragment, other domains/entities and authorization. Verify actual notification
click to authorized detail/reply and missing/deleted destination; reuse question CRUD.
No public share/native/backend/provider changes or new files/tests. PR90 frozen at
fdb37a904 remains coordinator-owned; separate branch. Root wallet-return verification
uses existing resolver without editing it, so no shared writer conflict.

## September21,03:40UTC — Stream1 wallet release and notification return

Root reserves owned18132/18133/64561–67, reusing cleaned wallet-read-r1 Supabase/full77
schema. Private wallet-release-r1/f9200290 on paid03bf9; fresh actual Stripe TEST
payment followed by existing settlement worker, wallet and notification UI/API/SQL.
Synthetic local identity/ancillary transport and controlled cooling-clock advancement;
no live funds/Connect bank payout/native claim. Reuse accepted authorization/worker
concurrency evidence where unchanged. No application edit/new tests without failure.
Stream3 runtime and Q&A ownership remain separate; no native build reservation.

## September21,03:35UTC — bounded marketplace Q&A read grant

Stream3 is sole writer of the existing marketplace detail useListingDetail.ts questions
loader, page.tsx prop wiring and QASection.tsx read error/retry and canonical safe asker
identity/href. Actual question creation persisted, but ListingQuestion SELECT denial
returned500 and displayed Questions(0)/No questions without retry; canonical safe asker
identity was also ignored. Reuse accepted question creation/save evidence. Preserve
forms, actions, styling and prior report fixes. No new files/tests/backend/schema/type
or unproven mutation changes. Compare existing/archive/open branches; verify cold/warm
failure, retry, genuine empty, persisted question/public navigation and feasible request
retirement. Restore exact SQL privileges and clean owned question/notification fixtures.
PR89 remains coordinator-owned/frozen at216e533af; use a separate branch for Q&A.

## September21,03:25UTC — canonical marketplace seller grant

Stream3 sole writer existing SellerSection.tsx canonical displayName/handle/avatarUrl/
href reads, and optional href only in existing types/listing.ts ListingUserSummary.
Actual detail displayedUser/disabledprofile while canonical API displayName/handle/
href and direct publicprofile worked. Preserve otherconsumers' optionallegacyfields,
safe absent/redactedidentity fallback, existingstyles and canonical publicrelative
navigation. No backend/privateUserfield restoration/schema/newfiles/tests. Verify
real detail→publicprofile and unavailable/redacted cases with exactfixturecleanup.
Separate from PR88 report repair; source comparison supplied. Root has no typeconflict.

## September21,03:20UTC — bounded marketplace report grant

Stream3 sole writer existing useListingDetail.handleReport catch/rethrow and shared
ReportModal entity-specific listing reason data only. Actual Safety concern UI sent
POST400 because canonical listing Joi/SQL does not accept it; Other/details under
ListingReport INSERTdenial returned500 and lostdraft. Reuse supported listing choices
and existing rejection contract; preserve valid choices, other entities and layout.
Verify all offered reasons UI/API/SQL, invalidboundary, error/draft/retry and exact
ownedlisting/reportcleanup. No backend/schema/newtests; sharedmodal writer belongs
only toStream3 for this bounded repair. Sellerprofile lead remains unverified/separate.

## September21,03:08UTC — root wallet runtime released

Pending-balance phase completed within live01limits; paid03bf9bd1b/currentCI35556379254.
Owned18132/18133/64561–67 released, exactrows0/SELECT+EXECUTE restored; ownIABtabclosed,
cachepreserved/tsconfigrestored. No native reservation/providerwrites. Stream3's
existing notification mutation/NotificationRow grant and live runtime remain active.

## September21,03:00UTC — next pending-release read verification

Root reserves18132/18133/64561–67 for private wallet-pending-r1/f9200280 on paid75f372.
Reuse clean owned wallet-read-r1 Supabase volume/full77 schema; no repeat migration
acceptance. Synthetic500c wallet adjustment/two captured-hold reader fixtures only,
no provider writes or actual-release claim. Verify existing WalletBalanceCard caller,
wallet/pending-release route and persisted amounts under read failures before repair.
Current paidCI35555446600 continues; no native reservation/peer resource use.

## September21,02:52UTC — runtime release and next notification grant

Extension02:54UTC: Stream3 also owns existing NotificationRow.tsx for reproduced
nested Remove Enter bubbling into parent read/navigation, plus optional pending disabled
prop. Verify Enter/Space only intended DELETE and preserve row activation, no style
change. Exact disposable fixtures only; existing13records retained. PR85 reviewed/green
and mergedd2b833049; mutation milestone remains separate.

Root wallet-read-r1 complete within live01 limits; paid75f372833 pushed/currentCI
35555446600 running. Owned18132/18133/64561–67 released, rows0/grant restored/tabs
closed/cache retained. No provider writes or native reservation.
Stream3 sole writer next separate notification mutation feedback in existing
NotificationBell.tsx and app/notifications/page.tsx only after actual Mark all read/
Remove HTTP500 silently failed in both UIs. Reuse existing toast/owner/query guards;
verify pending/retry/duplicate/delayed behavior with exact disposable rows and preserve
retained records/readflags. No backend/socket/provider/SDK/newtests; preserve unknown
committed-write semantics. PR85 read milestone stays frozen/coordinator-owned.

## September21,02:38UTC — current ownership and runtime

Latest02:44UTC: root reserves18132/18133/64561–67 again for isolated
wallet-read-r1/f9200270, full77SQL/sourcecfb9. Existing wallet page/components,
wallet routes/service/RPC under Stream1 ownership; verify before any repair, no
new tests/design change. Only synthetic history fixture, no withdrawal/provider writes.
PR84 mergedc1c03a3c6; paid integrationcfb9 pushed/currentCI35555007933 running.

Stream1 refund-session-r2 completed on unchanged6d40: intact old refund200 after
new login, owner receipt recovery, actual Stripe TEST/SQL accepted within live01 limits.
Owned18132/18133/64561–67 now released; own rows0/customer deleted/cache retained,
both owned Chrome tabs closed. No native reservation. Stream3 runtime remains active.

N04 visibility grant: Stream3 owns only posts.js POST_VISIBILITY_SELECT existing
archived_at/post_metadata fields after archived child reads/actions bypassed existing
canViewPost checks. PR84 source and staleUI403/draft-retention,11-caller archive/draft
matrix, owner reads, published recovery and exact cleanup reviewed. No new schema or
policy/atomic-concurrency claim; strict updated-head CI required before merge.

N01/N02 next bounded grant: Stream3 sole writer existing NotificationBell.tsx and
app/notifications/page.tsx read/error/retry/lifetime only, after actual SELECT500
showed false empty on cold page/bell and silently retained warm rows. Compare existing,
archived/open implementations; preserve known same-owner rows and styles. Verify
cold/warm failure, retry, genuine empty, session retirement and cleanup. No routes,
BadgeContext, sockets, shared SDK, provider changes or new tests. Separate milestone.

## September21 current bounded grants and runtime update

Root resumes P09 held-refund session attempt only after fresh Chrome control works.
Private /private/tmp/pantopus-stream1-refund-session-r2, f9200260, API18132/web18133,
owned Supabase64561–67 reserved/starting; source6d40 green. Reuse accepted prior
journeys; no native build/shared runtime/cache use. Test auth/ancillary transport,
actualStripeTEST/full77SQL; no new acceptance yet. Source unchanged.

N04 report retry grant: Stream3 owns only existing full postpage handleReport and
useFeedData.handleReport after actual PostReport INSERT500 closed modal/lost details.
Shared ReportModal already preserves draft on rejected promise; reuse that contract,
check all callers, preserve toast/layout/backend. Verify fullpage/feed-card failure,
retry/SQL and exact cleanup; separate milestone after82, no new tests. Older stack
refs remain coordinator-owned. Refresh500 triage identified rejected localhost18131
origin before auth, not auth-result500. Root Chrome/IAB inventory has no such tab;
exact originating client remains unknown. No CORS broadening or shared cleanup.
Root refund-session owned Chrome tab is now absent from fresh inventory; earlier
closure-unconfirmed limit resolved for that tab only.

New A02 bounded grant after real Security Refresh returned200/false empty activity
under owned AuthSecurityEvent SELECT denial: Stream3 owns existing authSessionService
listSecurityEvents/listActiveSessions, authDeviceService listDevices/listActiveDevices,
and web settings/security/page.tsx loader/lifetime/error handling only. Inspect all
callers including revokeOtherDevices before checked-read changes; preserve mutation
failure semantics, existing route500, known rows/error/retry and owner scope. No
schema/provider/interceptor redesign/new tests. Separate milestone after81; exact
SQL grants restored and owned session cleanup required. Coordinator owns stack refs.

Coordinator inspected PR81 two-file diff, both source hashes and durable200file manifest.
UI/SQL/worker opt-out proof accepted within local scope; requiredCI pending.
The45000ms account-switch hold exceeds SDK30000ms timeout: new login preceded
server release, but this does not prove an old successful reply reached the client.
Author asked to qualify evidence or verify an intact reply within timeout. No
application change requested for this evidence limitation.

Stream3 released the sole native slot after owned0AE boot but unavailable Simulator/
DeviceHub UI control; exact simulator stopped, no build/install/source edit. New
bounded N05 grant: existing web scheduling `hub/notificationPrefs.ts` and
`NotificationPrefsForm.tsx` only, after actual Reminder sent push save returned200
but reverted and worker still notified. Reuse canonical notify_me host keys,
serial/owner-bound writes and confirmed rollback; preserve visuals. Email, attendee,
pause and daily agenda policy gaps remain unresolved. Separate milestone after80.
Root refund-session phase stopped/cleaned0 after browser checkout control failure;
its original account-switch scope is unverified. Actual cancellation exposed stale
Offers; existing page refresh callback repaired at6d40d8b2a and verified UI/API/Stripe/
SQL. Two unpaid intents cancelled/customer deleted. Paid CI35551123265 runs.
Test launcher publishable key omission corrected privately. PR70 strict-head CI runs;
keep further documentation merges frozen until feature integration.

## Active sessions and runtime ownership — September 20, 2026

This table supersedes historical session/runtime rows below. No work is dispatched
to the retired September16 coordinator or older Stream1 session.

| Stream | Active task | Current work / sole writer | Local browser and API | Database |
| --- | --- | --- | --- | --- |
| 1 / coordinator | `01a0c0d1-0703-70c3-b842-6d01bc8ca48b` | Actual Stripe TEST tip/paid capture milestones complete on9ae1edb3b; combinedsession/actualstop verified; OffersPanel stale status repair8825c1928; CI pending | `localhost:18133` → HTTP18132 | Isolated `pantopus-stream1-tip-ui-r1`, API64561/SQL64562 |
| 2 | `01a0c0d4-2278-71d3-bc23-a9d789d2afeb` | PR60 merged as ebeea43d5; combined browser check and CI accepted; runtime released | `[::1]:18141` → HTTP18142 | Adopt existing `pantopus-stream2-guest-r1`, API64551/SQL64552; ports64550–64559 granted |
| 3 | `01a0a824-301b-74e3-a1d9-b205714ed7a1` | PR64 safety merged as2d6ff2069; author owns separate granted Settings/SDK deletion and UserBlock forward migration | `stream3-auth.localhost:18131` → HTTP18130 | Existing `pantopus-stream3-block-r1`, API64531/SQL64532 |

Stream3 runtime extension64534–64537 is granted for local GoTrue/Kong/mail only.
Stream3 single-writer grants: existing Settings deletion UI and SDK users endpoint;
`frontend/packages/api/src/client.ts`, `endpoints/auth.ts` and mounted web
`lib/query-provider.tsx` for reproduced cookie-login cross-tab account retirement
(preserve same-account refresh/drafts). Extension granted after admitted held401
replayed Bob's block as new Dana after refresh: bind shared interceptor requests
to session generation, recheck across awaits, prevent stale retry/session cleanup. Intact delayed old refresh200 then new login
reproduced browser cookie rollback; granted same client AbortController and
origin-bound mutex repair, with intact-header UI acceptance required.
Existing `UserBlock` incoming/outgoing
NO ACTION FKs caused admitted real-auth/step-up DELETE500: forward migration
20260916012000 is granted for only those two CASCADE constraints, after canonical
comparison. No applied migration rewrite or auth/socket redesign. Stream3 also owns a separate,
reproduced N03 follow404 repair in existing `backend/routes/personaBlocks.js`:
move auth/feature guards onto its actual three block routes so the supported
flag-off legacy follow route can run. Verify follow persistence and block denial;
no feature-flag activation, backend policy widening or new application file.
The same separate N03 scope includes existing `personas.js` DELETE-follow only:
repeated unfollow passed a non-UUID sentinel to SQL and returned500. Use a checked
membership read, preserve paid-tier guards, return success only for confirmed
absence and failure for an unavailable read. Stream3 reports
exact paths and real UI/API/SQL proof before integration.
Subsequent N03 privacy grant: existing personas.js owner followers GET/PATCH must
reuse canonical serializeFanForCreator after actual creator UI exposed protected
local identity; existing frontend/packages/types/src/identity.ts follower display
shape may narrow to safe handle/displayName/avatarUrl. Preserve layout, no new
profile system/schema. Commit follow/retry separately before this repair. Existing
post detail page and PostDetailModal caller may subsequently repair the reproduced
Beacon author destination using the canonical typed href; preserve personal/business
destinations, exact caller is frontend/apps/web/src/components/feed/PostDetailPanel.tsx
(not Modal); no shared UserIdentityLink rewrite. Subsequent persona-comment privacy
grant: existing backend/routes/posts.js four comment response paths and comment/reply
notifications, plus existing frontend/apps/web/src/components/feed/CommentThread.tsx.
Use canonical fan/Beacon identities per protected-fan policy; preserve internal
recipient/self/duplicate handling and ordinary personal/business posts. Confirm own
versus other-actor edit controls and native DTO/caller compatibility before choosing
redacted id shape; no schema/new identity system. Separate milestone after owner-fan repair. Narrow iOS/Android PulsePostDetailViewModel
mapper grant maps intentionally blank safe author IDs to nil/null, preventing invalid
private-profile actions while preserving layout/personal navigation. Existing post
page/Panel/CommentThread submit-success contract may retain composer text/files/reply
after reproduced SQL500; inspect all void/boolean callers, no newfile/schema.

Browser hostnames deliberately differ because cookies are shared across ports.
No shared cookie clearing, retained database mutation, cache cleaning or physical
device use. Native slot **released** after Stream1's iOS and Android attempts. Android AVD
boots but current computer-use cannot attach its qemu window; no native tip
acceptance claimed. Owned emulator stopped; no rebuild/install. exact
owned simulator shut down. Local Simulator became unavailable after an external
shutdown/XPC/display failure; no build or system-service reset. Recheck actual
availability before reserving. Stream1 HTTP18132/web18133 and isolated64561/64562
project stopped after both actual Stripe TEST phases. Combined-session project `pantopus-stream1-session-integration-r1` replayed77migrations
and verified account-switch recovery onf0a98a974; exactrows0. Stream1 now reserves
18132/18133 and64561–64567 for isolated `pantopus-stream1-stop-stripe-r1` actual
TEST authorization release via existing reopen/cancel UI finished/cleaned0. New
`pantopus-stream1-refund-stripe-r1` uses the same ownedports for actual captured-payment
partial/full refund UI completed. All Stream1 exact rows0 and ownports released;
five actual test captures fully refunded, five unpaid intents cancelled, four owned
customers deleted across the session. No native build or retained DB mutation. Exact owned rows0; four test
captures fully refunded, two intents canceled, two owned customers deleted. Provider
history remains.
Stream3 and Stream2 own their dirty live status files; coordinator stages
only handed-off snapshots. Stream1 source changes remain confined to its assigned
paid worktree, Stream2 to its Home worktree, Stream3 to its accounts/social worktree.

## Where to start

| Document | Purpose | Writer |
| --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | Rules for preserving existing work and designs | Coordinator, when an agreed rule needs recording |
| [Project handoff](../PROJECT_HANDOFF.md) | Current integrated state and next decisions | Coordinator |
| [Remaining work](../REMAINING_WORK_2026-09-11.md) | Authoritative requirements and acceptance rows | Coordinator, using stream evidence |
| This guide | Ownership, dependencies, integration and shared resources | Coordinator |
| [1. Gigs/payments](01-gigs-payments.md) | Current gig/payment milestone and handoff | Stream 1 |
| [2. Home/household](02-home-household.md) | Current Home milestone and handoff | Stream 2 |
| [3. Accounts/social](03-accounts-social.md) | Current account/social/notification milestone and handoff | Stream 3 |
| [Verification report](../VERIFICATION_FIRST_2026-09-13.md) and linked reports | Source-bound results, failures and limitations | Coordinator integrates stream report contributions |

The coordinator is also Stream 1; there is no fourth implementation stream.
Each stream owns the affected backend, database contract and clients for its
milestone. Platform boundaries do not split ownership of one user journey.

Backlog ownership: Stream 1 handles P (gigs/payments); Stream 2 handles H/R/I/D/F/M
(Home, residency, intelligence, records, bills, mail/guests); Stream 3 handles N/A
(social, notifications, accounts/providers). A03 shared storage changes require
explicit ownership, and A05 routes each feature-specific finding to its domain
owner. U (UI/accessibility/lifetime) checks accompany each affected journey; G/O/L
(integration, operations and launch) stay coordinated centrally with stream input.
These categories assign responsibility, not permission to reopen accepted work.

## Shared publication, live location and Git branches

Shared instructions and coordination snapshots belong on `master`, published
through documentation-only PRs from `codex/workstream-coordination`. They do not
depend on approval or integration of the gigs application branch. Each application
stream receives those instructions by integrating current master into its branch.

The live coordination folder on this Mac is:
`/Users/yingpengwang/pantopus-coordination/docs/workstreams/`.
All three agents read that exact directory, even while editing application code
in another worktree. A copy in a different branch is a committed snapshot, not a
live message channel. This is a neutral documentation worktree of the same
repository, on `codex/workstream-coordination`; it is not a fourth application
stream. The owner's main checkout remains separate. The previous live folder in
the gigs worktree is retired after this transfer; do not update status there.

| Stream | Application worktree | Branch / starting state |
| --- | --- | --- |
| 1 | `/private/tmp/pantopus-paid-gig-integration` | `codex/paid-gig-integration`; current source/CI in Stream1 status |
| 2 | `/private/tmp/pantopus-workstream-home` | `codex/workstream-home`; PR53 merged into master `4cc9d3787`; branch re-based on master |
| 3 | `/private/tmp/pantopus-workstream-accounts-social` | `codex/workstream-accounts-social`; PR51 merged into master `c14657e35`; integrate master before the next milestone |

Streams 2 and 3 compare relevant pending Stream 1 changes before editing shared
code. They start from master because their first scoped implementations are
unchanged in the paid candidate. This permits small independent PRs to master.
The coordinator then integrates merged master into the paid candidate and checks
the combined behavior. Do not merge the entire unfinished paid branch into a new
stream just to obtain its status documents.

One writer per application worktree. Two Stream 1 sessions shared
`/private/tmp/pantopus-paid-gig-integration` on September 15/16; the older session
(`pantopus-paid-gig-integration-c8`) is retired from writing and the coordinator session
is the sole Stream 1 writer. No WIP commits on a branch with an open PR.

Feature branches carry `docs/workstreams/*`, `docs/PROJECT_HANDOFF.md` and
`docs/REMAINING_WORK_2026-09-11.md` only as merged from master, never as their own
edits: a branch whose copies diverge becomes a conflicting PR, GitHub cannot build its
merge ref, and pull_request CI silently never schedules (PR47 lost all checks at
`f437dfd20` until master was merged in). Publish through the coordination branch only.

Each agent writes only its own status file in the live folder. It commits code
only from its own application worktree. The coordinator commits/pushes shared
status snapshots from the neutral documentation worktree after the author finishes
an update and publishes them through a separate PR to master; no blanket `git add .`.
Before publishing, verify the diff contains only the intended instructions and
status changes. Do not copy a feature branch's complete handoff or backlog over
master: link branch-specific evidence and carry over only the relevant updates.
Remote workers must send their source-bound handoff to the coordinator instead
of treating a stale local copy as the live folder.

## Working agreement

The user's clarified priority is accuracy and efficient reuse. All three streams
must preserve mobile (iOS/Android) and web screen designs, layouts and appearance.
Verify existing journeys before application edits; repair demonstrated failures
and repeat the affected end-to-end checks until they pass within an explicit scope.
Use the new-file/database comparison rule in [AGENTS.md](../../AGENTS.md): missing
evidence or disliked code is not permission to rebuild. Document why existing work
cannot meet the requirement before adding or replacing implementation. Preserve
accepted evidence and clearly label any unverified runtime/provider boundaries.

1. Select one bounded milestone from an existing inventory row. Locate its screen,
   caller, endpoint, service and database contract. Read relevant accepted evidence
   and compare source/configuration before choosing verification to repeat.
2. Record the milestone, exact candidate files, reused evidence, unknowns, next
   verification and completion criterion in the stream file. Source suspicion is
   not a reproduced bug; an open row is not a missing implementation.
3. Before changing a shared file or acquiring a shared runtime, send the coordinator
   a request identifying the purpose and affected streams. The coordinator records
   one owner here and acknowledges it before work starts. An empty row is not a
   lock that multiple workers may independently claim.
4. Reproduce the failure or document a concrete unmet requirement. Repair the
   existing implementation, preserve layouts and reuse existing services/schema.
   New tables, migrations, services or screens require the comparison in AGENTS.md.
5. Verify affected behavior and meaningful regressions. Actual UI/HTTP/persistence
   evidence is required where the milestone calls for it. Label synthetic auth,
   provider responses and transport; do not equate saved state with delivery.
6. Commit/push a reviewable milestone and hand off its SHA, changed paths, baseline,
   final evidence, limits, cleanup and remaining decisions. The coordinator reviews,
   reconciles shared changes/migrations and runs required CI before merging.

Update status when starting, changing scope/ownership, reproducing a defect,
finishing verification, becoming blocked, or handing off. Do not append a diary of
every command. Keep the current snapshot short; link detailed evidence/history.
Notify an affected peer through the coordinator when a finding changes its contract
or priority. Merely writing a note in another branch does not notify anyone.

Use states: discovery, verification, repair, ready for review, CI, merged, blocked.
Record the blocker and independent work that can continue. Local acceptance of a
small milestone does not close a broad inventory row or establish launch readiness.
No fixed completion percentage follows from row counts or numbers of tests.

## Shared ownership and requests

The current stream status files name candidate ownership for their first milestones.
These cross-cutting files/contracts require coordinator assignment for each edit:

- Authentication/session helpers; notification services, workers and sockets;
  generic File/upload/storage; shared navigation and SDK exports; CI/build manifests.
- `backend/routes/gigs.js` and payment services are initially Stream 1's scope.
  Home-related callers must coordinate before changing them.
- Migration versions, replay/adoption, shared permission/RPC contracts and release
  configuration are coordinated centrally. Never rewrite applied migration history.

| Request / decision | Owner | Status / next action |
| --- | --- | --- |
| Transactional direct-message block admission | Stream 3 | Granted `supabase/migrations/20260916010000_direct_message_block_admission.sql`, source `scripts/db/contracts/direct-message-block-admission.sql`, generated `supabase/tests/direct-message-block-admission.test.sql` through existing sync pipeline, and existing chats.js denial mapping. Apply/test only isolated64532; details below |
| `frontend/apps/ios/PantopusTests/Support/SequencedURLProtocol.swift` | Stream 3 | May import the exact already-tested paid-branch gate/release delta from41c75d49a for deterministic lifetime tests; no competing helper design |
| N05 booking reminder failure contract | Stream 3 | Sole writer for `backend/services/scheduling/bookingNotifyService.js` after2 reproduced failures/23 passes. `backend/jobs/bookingReminders.js` may change only after a separate worker regression proves need; preserve retry/partial-recipient limits. No notificationService/emailService/schema/provider changes; Home UI/fixtures remain coordinated with Stream2 |
| `backend/jest.config.js` chat-access regression inclusion | Stream 3 | Granted only for the existing excluded chat-access suite; run regressions, no broad CI rewrite |
| `backend/routes/chats.js` block/retry repairs | Stream 3 | Sole writer; includes reproduced cross-room clientMessageId leak: scope initial/recovery lookup to authorized room, sender and human business actor; reported repair awaits coordinator review |
| SDK guest-pass status type / block exports | Streams 2 / 3 respectively | Additive candidates reviewed for conflict; no Stream1 overlap; broader SDK/auth changes still require assignment |
| `backend/services/blockService.js` error/cache repair | Stream 3 | Sole writer granted after baseline reproduction; verify all callers before changing the error contract |
| `backend/socket/chatSocketio.js` direct-chat admission/send checks | Stream 3 | Overlap reviewed: paid branch only adds `emitPrivateGigUpdate` plus its export; preserve that helper, `connectedUsers`, revocation and gig tracking behavior |
| Start Work displayed-terms binding: `backend/routes/gigs.js` start handler, `frontend/packages/api/src/endpoints/gigs.ts` `startGig`, iOS `GigsEndpoints.startGig`/`GigDetailViewModel.startTask`, Android `GigDetailViewModel.startTask` and its repository call, web `CompletionFlow.handleStartWork` | Stream 1 (coordinator), sole writer | Delivered at `a65411758` (detail entry, all three clients + SDK) and `4ad88ec11` (my-bids card + list projection guard), draft PR47; verified locally, over real HTTP/SQL and on the installed iOS and Android candidates. Additive optional expected-assignment body; clients that send none keep current behavior. Streams 2/3 do not touch these paths |
| Stream 2 PR for `70e079543..88d076e56` | Coordinator | **Merged** as `4cc9d3787` after coordinator source review and green CI (branch updated with master first). Streams integrate current master before further web share edits. Stream 2's SQL 64552 disposable project is reported stopped; its Emergency-page value finding is routed to Home ownership (Stream 2) as a separate bounded row |
| Direct-message block admission implementation | Stream 3 | **Merged** as `c14657e35` (PR51 at `6e1758234`) after coordinator source review, the author's passing PostgREST smoke check and green CI on the master-updated head. N04/N05 rows remain open per Stream 3's status |
| Cancellation/no-show fee payer and recipient | Product decision, recorded by Stream 1 | Still unspecified; independent Start Work verification can proceed |
| Home Emergency form-type migration (Stream 2 request, 2026-09-16 evening) | Coordinator → Stream 2 | **Granted version `20260916011000_home_emergency_form_types.sql`** (not `030000`): it sorts after master's newest `20260916010000` and *before* the paid branch's unmerged `20260916020100..022100` block, so a Stream 2 merge does not force another paid renumbering under the migration policy. Scope as proposed: drop and re-add `HomeEmergency_type_chk` with the nine current values plus the six form categories, `SET lock_timeout`, "backwards compatible: yes", `HomeEmergencyType` in `@pantopus/types` widened to match; contract source under `scripts/db/contracts` synced through the existing pipeline; apply/test only in Stream 2's own disposable project. No server-side type mapping. |
| User's Place redesign, PR #46 | User's separate scope | Preserved outside these verification milestones |

Transactional admission grant evidence: actual socket/HTTP/SQL baseline allowed a
message to persist and broadcast after the counterparty's block had committed.
Existing UserBlock/ChatMessage tables, archives034/037/072, membership-only RLS and
unread trigger do not enforce this boundary; service-role writes bypass RLS. No
existing direct-message SQL contract can safely substitute. Use existing tables
and an additive forward migration; no applied history rewrite or parallel table.
The scoped proposal uses unordered-pair transaction advisory locks for UserBlock
INSERT/UPDATE/DELETE and BEFORE ChatMessage INSERT in direct rooms, checking
COALESCE(actor_user_id,user_id) against active participants. Verify deterministic
old/new-pair ordering and actual two-connection commit/wait/rollback, reverse,
business/nonmember/service-role, grants/search_path and isolation boundaries.
Deny before side effects. No gig/group/read-policy or direct-create RPC changes
without separate reproduction/assignment. Preserve the paid private-gig socket
helper/export. This is permission to implement and verify, not merge approval.

## Runtime reservations

One heavy native build runs on this Mac at a time. Remote CI uses its own runners.
Acquire a reservation before a build, simulator install, shared cache write,
database fixture/migration or server bind. Record process/lease and evidence paths
privately; never put credentials, raw device tokens or operator logs in Git/chat.
Check actual processes and the existing private leases before reuse. A stale note
or elapsed time is not proof a resource is free.

| Resource | Current reservation | Rule |
| --- | --- | --- |
| Local heavy native build | **Released** by Stream1 at 11:02 PDT September 16 after the Android APK build and installed emulator journeys; own Gradle daemon stopped; no xcodebuild/Gradle/emulator running at release | Reacquire before the next heavy native build; check actual processes, not this note |
| iOS/Android test devices | Stream3 retains `0AE16FA0-E244-414F-86C8-24893BDFD979` (Shutdown); Stream1 isolated `Pantopus Stream1 Start R2`, iOS26.5, `C2BCF36A-F300-48C1-9BA7-876CA9F61E55` (Shutdown; candidate app left installed) and new owned Android AVD `Pantopus_Stream1_Start_R2` (android-34, stopped; candidate APK left installed). The existing `Pantopus_Home_Recurrence_Acceptance` AVD was not used | Preserve owner iPhone17 (currently Booted, untouched) and all existing acceptance devices; no physical-device install granted |
| Databases / fixture ports | Stream3 reports exact `f9150300` cleanup zero and HTTP18130/web18131 stopped at cutoff. Stream1 `f9150410` (September 15), `f9150420` and `f9150430` (September 16) rows cleaned to zero by direct SQL; HTTP18132 stopped. Stream2 reports its disposable SQL 64552/API 64551 project stopped | Stream3/Stream2 cleanup is author-reported; retain their evidence. No retained schema/reset/container mutation; preserve other fixtures; 18089 is not granted |
| Stream3 isolated transactional-block database | New private `/private/tmp/pantopus-stream3-block-db-r1`, project/container prefix `pantopus-stream3-block-r1`, SQL64532/API64531 (64533 reserved) | Docker responsive at grant; replay canonical schema into empty owned database. No retained data copy or existing container changes. Canonical-empty SQL64532 retained healthy; API not started. Exact forward migration/contract assignment granted above, but no repair files written before cutoff; never apply to retained64522 |
| Stream 1 full-schema completion/reopen project | Private `/private/tmp/pantopus-stream1-complete-r1`, project/container prefix `pantopus-stream1-complete-r1`, SQL 64562 / API 64561 (64563-64567 reserved), taken 2026-09-16 ~17:00 PDT, **RELEASED 17:20 PDT** | Created with `supabase start --workdir` from the paid branch's 75 migrations (the retained 64522 database predates the paid functions). Only db, kong, postgrest, gotrue, storage started. Fixture prefixes `f9150450`/`f9150460`; exact cleanup verified 0 before `supabase stop --no-backup`; no container remains, ports free, retained 64521-64527/64532 containers still up. Workdir kept for cheap recreation. |
| Existing SQL port 64522 and REST port 18089 | Retained prior rehearsal resources | Never assume available or change their schema from another stream |
| Physical iPhone | Owner's installed build 3 | No test install or device mutation without a concrete authorized task |

Dependencies and accepted products are reused after checking their contracts.
Do not run three package installations or cache cleans. Low disk space is a reason
to sequence builds and request precise cleanup, not erase another stream's evidence.
Streams release resources on handoff after verifying processes and exact cleanup.

## Integration and completion

Only the coordinator updates shared handoff/backlog disposition or merges these
streams' PRs. A handoff includes source SHA/base, current PR/CI, reused and new
evidence, remaining limits, shared impacts and runtime cleanup. Run current-head
required checks; additional end-to-end repeats need a changed contract or identified
integration risk. Batch documentation-only publication to avoid canceling useful CI.

At setup, PR #34 is still draft at `c9cb69825` with
[CI34998717315](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34998717315)
passing 15 applicable jobs/one Seeder skip. Integration `3e93cd167` only adds the
verified iPhone-install documentation. Green CI does not finish the paid scope.
PR #46 (`place-design`) is a separate open user PR. Refresh live state before action.
PR #47 (`codex/paid-gig-integration`) also contains unfinished gigs application
changes. Neither paid PR is the vehicle for publishing the shared instructions.

This setup creates no recurring background automation. Status files distinguish
completed discovery from running verification; agent work is dispatched in bounded
milestones. The first milestones are assigned in the three linked status files.

Stream1 released18132/18133 and64561–64567 after isolated
`pantopus-stream1-offers-race-r1`: held real offers GET across existing free-bid
acceptance ended accepted with11 entity counts0. Identical reads serialized in this
browser; no reversed-response or new app-repair claim. No Stripe transaction/native build.

September21 bounded Stream3 grants after actual UI/API failures:
- N05 `backend/services/scheduling/bookingNotifyService.js` remains sole-writer:
  SMTP outage/retry duplicated host notices and reminder host link404. Existing
  notification idempotency/readback and canonical destinations only. Existing
  `backend/services/scheduling/schedulingShared.js` authorization-error construction
  may also carry status403 alongside statusCode403 for the actual mounted handler;
  no global error-handler change. Verify owner200, otheractor403/no data.
- N03 sole writer for existing `backend/utils/identityProfiles.js` ensureLocalProfile
  persisted canonical columns/checked error/concurrent duplicate reread; existing
  `frontend/apps/web/src/components/feed/PostComposer.tsx`,
  `frontend/apps/web/src/hooks/useFeedData.ts`, `frontend/apps/web/src/app/(app)/app/feed/page.tsx`
  and `frontend/apps/web/src/components/AppShell.tsx` global composer submission callback: propagate failure
  and preserve draft, reset only on success.
  Same feed page may consume only compose query parameter, retaining surface and
  other parameters after reproduced modal Connections→Place diversion. Preserve
  read-only legacy profile behavior, current UI and all unrelated session code.
  Separate PR from70 and N05; no new schema/profile system/files/tests.

September21 N05 follow-up: Stream3 is sole writer for existing scheduling.js
GET/PUT notification-preferences and schedulingNotifyPrefs.js getPrefs, now
committed5e3a8b963 in dependent draft PR75. Actual denied reads/writes must surface
errors while genuine absence retains defaults. Existing UI/API/worker proof and
restored fixture/grant limits are in the live03 snapshot; CI still required.

Next bounded timing repair grant: only existing web
`components/scheduling/automations/RemindersQuickSetup.tsx`,
`components/scheduling/automations/WorkflowList.tsx`, and
`components/scheduling/hub/NotificationPrefsForm.tsx` reminder section, under
frontend/apps/web/src. Reuse SDK get/updateBookingPage(owner) and canonical
reminder_minutes already used by native, after real web save/read mismatch.
Preserve presentation, unrelated channels/pause, explicit[]/0 and existing5/43200
route limits. Bound timers/replies to the originating owner/mount and verify UI
save/reload, error/retry, rapid edits and owned owner transitions. No new storage,
helper/service/schema/test. Worker0/empty handling remains a separate verified
requirement and needs its own exact-file grant. Existing PR70/72/73/75 refs remain
separate; this is not approval to merge unfinished scopes.

## Current integration batching — September21

Master **e8b49c963** includes the final documentation batch through PR78. The
repository requires `CI OK` with strict up-to-date branches. PR70 at07827d2b0
passed every applicable check but was behind only on documentation. Stream3 owns
a single merge of this master into its isolated PR70 checkout and normal push,
completed as21b93aa62. Coordinator verified only five documentation files changed,
zero backend/frontend/supabase diff. Reuse unchanged application UI evidence while
required current-head CI runs.
**Hold further documentation merges while70→72→73→75→77 integrate.** Publish live
status/grants as unmerged documentation drafts meanwhile; do not invalidate another
long native run with status-only master changes. Coordinator alone merges feature
PRs after exact updated-head checks and bounded acceptance.

New N05 worker grant: Stream3 sole writer in existing backend/jobs/bookingReminders.js
and only formatLead in existing bookingNotifyService.js. Actual UI-saved[] sent a
reminder,0 omitted due delivery,43200 omitted long-offset delivery under controlled
owned booking timestamps. Honor explicit[], accepted integer0..43200 and30-day scan;
include recently-started only for zero, never send zero early. Preserve120-minute
catchup/completion/dedupe/retry-release. Check page/event-type read errors instead
of treating unavailable data as absence; label zero as now. No cron/schema/newservice/
provider/new tests. Verify actual worker/SQL/localSMTP/no duplicate receipts and
restore exact original settings/timestamps/new rows; manual cadence is not scheduler
or external delivery acceptance. Keep this separate from PR77 timing UI.

Stream1 reserves18132/18133 and isolated64561–64567 for
`pantopus-stream1-refund-session-r1`, source8825, owned f9200250 fixtures. Verify
retained/refund response ownership across logout/login using existing UI/API/SQL
and Stripe TEST, synthetic local identity/ancillary transport. No live funds or
native build. Preserve peer18130/18131/64531/64532/SMTP and shared caches. Release
only owned resources after exact cleanup. Current docs remain unmerged per gate.

Current sole heavy-native slot: Stream3 may use exact owned simulator
0AE16FA0-E244-414F-86C8-24893BDFD979 for bounded N04/N03 existing screens. A new
read-only capability check found simctl available, no booted devices. Verify CUA
control first; only if usable build/install existing current app for18130 using
private owned derived output. No other simulator/device/cache/system-service
changes or native source edits. Release after the bounded result. Stream1 browser
refund-session verification does not use the native slot.
