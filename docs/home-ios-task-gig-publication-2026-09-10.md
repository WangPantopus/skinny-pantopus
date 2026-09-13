# iOS Home task-to-Gig publication — September 10, 2026

## Result and next action

Saved editable household tasks now open an explicit native public Gig review.
The app retains the original command in device-only Keychain before POST and
keeps a confirmed receipt until explicit acknowledgement. Current task access
is checked before publication, retry, acknowledgement and opening the linked Gig.
Android conversion and its installed acceptance are next, followed by the
remaining ordered Home/payment scope. Both PRs remain unfinished drafts; final
combined migrations and the single paid launch-preparation bundle remain open.

## Behavior and boundaries

- Public title and description begin empty. Copying the private task title is
  an explicit action. Public fields include title, description, positive USD
  budget with at most two decimals, category, an explicitly selected work
  address and cancellation policy. Field edits invalidate the review toggle.
- Publication uses the canonical Gig route and the previously verified atomic
  private source link, receipt and audit. It does not charge, assign a helper,
  complete the household task or activate recurrence. Private descriptions,
  attachments, mail, Home coordinates and access data are not copied into the
  public payload. Visibility is city-wide; exact address reveal is after assignment.
- The Keychain service is `app.pantopus.ios.pending-home-task-gig`, unlocked-only,
  device-only and non-synchronizing. Origin/actor/Home/task scope is hashed for
  the storage key. Original and confirmed records validate their identities,
  timestamps and receipt shape. Credentials and session proof are not retained.
- Main-actor compare-before-save/clear and per-scope active operations protect
  competing scenes in this app process. The current protected original is checked
  again immediately before dispatch, after the asynchronous authority preflight.
- Original retry deliberately permits a task already linked by a lost successful
  request. Confirmation validates the original receipt but allows later current
  Gig state/price changes. Opening the destination rechecks current Home access
  and the exact server link. Backgrounding hides source/recovery state and
  invalidates unfinished work; a changed account also clears typed fields.
- Corrupt/unreadable retained data blocks publication without clearing it. Storage
  write failure before POST preserves the no-new-publication boundary. These
  native fault paths have source review; they are not installed fault-injection
  acceptance in this checkpoint.

## Findings resolved

The installed keyboard journey found that a keyboard-toolbar Done button was
visible but absent from the actual accessibility hierarchy. The dismiss action
now appears in the navigation bar while editing and is reachable in the installed
app. The ordinary form and keyboard interactions are exercised by the journey.

Earlier driver attempts also corrected expired-login handling, empty-field
placeholder expectations, SwiftUI Form virtualization and native switch thumb
targeting. A later attempt reached the exact persisted Gig but failed decoding
because the local fixture exposed raw PostGIS geometry. The fixture now removes
raw geometry and derives the owner coordinate object from SQL, matching that
boundary of the real GET response. These failed runs are not claimed passes and
did not justify weakening the app's decoder or skipping its destination screen.

Screen review of the first passing scripted journey then found a real existing
Gig detail defect: the cancelled SQL row rendered as "Open", offered "Place bid",
and displayed an unconditional "Verified address" badge. The V1/V2 projections
now share current lifecycle status and action gates. Owners cannot bid on their
own open task; assigned/in-progress/completed/cancelled/unknown states cannot
offer a new bid. Delivery and tip affordances retain their applicable lifecycle
gates. Bid submission and sheet presentation also check current eligibility.
Unsupported address/local badges, cash-or-transfer instructions and fabricated
hire/viewer/ranking claims were removed. The installed journey now asserts and
captures five actual persisted statuses in both detail layouts, rather than
accepting only a matching destination title. These are state projection checks,
not end-to-end payment or assignment mutation acceptance. The layout selector
is synthetic (`is_v2` is not a canonical SQL column); statuses and prices are
actual SQL data. An initial matrix attempt found and corrected that fixture
assumption. The detail now also retains the actual category label instead of
turning "General" into "Handyman", and renders "Just posted" rather than "now ago".

Browser head `b9062fb03` passed every required job except the iPhone SE job. Its
single failure was an existing DiscoverHub filter check asserting before its
asynchronous fetch completed after a fixed 150 ms delay. Four related fixed waits
now observe actual filter results/request completion with a bounded deadline.
No DiscoverHub app behavior or expected results were changed. All 19 affected
cases passed three repetitions locally (57 executions); the new head's remote
iOS 18.5 gates remain required.

## Actual acceptance and evidence

The opt-in `HomeTaskGigJourneyUITests` uses the installed signed app, normal login,
OS routes and actual Keychain. `scripts/ios/home-task-gig-ui-fixture.cjs` runs
the production Express/Joi publication route and service against the isolated
33-migration local PostgreSQL database. Task reads and authority use the actual
SQL RPCs; changes, revocation and cancellation affect actual persisted rows.

Final installed run `r9` passes on the dedicated iPhone 17/iOS 26.5 simulator:

1. Normal sign-in and exact saved-task OS route; public title starts empty.
   Enter public fields, dismiss keyboards, search/select the explicit address
   and review. Change the source in SQL; publication rejects it without a Gig.
   Review the changed task and explicitly approve the public details again.
2. Commit publication but lose its reply. Exactly one SQL receipt/Gig exists.
   Cancel it and change its price to $30 separately in SQL. Terminate/relaunch
   the app and retry the original Keychain command, retaining its exact UUID.
3. Terminate/relaunch again with the confirmed receipt. Open the exact current
   Gig; its visible status is Cancelled, budget is $30, category is General and
   its dock is disabled. No new-bid, first-bid or unsupported address badge appears.
4. Exercise open/assigned/in-progress/completed/cancelled SQL statuses in each
   V1/V2 layout (ten screens). Status, budget and disabled owner/non-open bidding
   controls pass. V2 retains the selected General label. Named screenshots are
   retained; representative review, confirmation, denial, open, completed and
   cancelled screens were visually inspected.
5. Return to the original confirmation and acknowledge it. The server-linked
   Gig remains available without another Publish control. Revoke real SQL Home
   occupancy, background/return, and verify private source and Open controls
   disappear. Restore authority, reload and open the same Gig again.

Final evidence is **one receipt, one Gig, three POST attempts** (stale rejection,
lost committed reply, exact original replay), full JSON equality for the last
two commands, and current Cancelled/$30 preserved. The fixture's shutdown writes
private evidence and deletes exactly its synthetic actor/Home/Gig/receipt rows.

Private evidence:

- `/private/tmp/pantopus-home-gig-ios-ui-r9.xcresult` and adjacent `.log` — final
  installed journey, zero failures; `r9-attachments/` contains the named screens
  and typed SQL attachment. Full commands/events are in
  `/private/tmp/pantopus-home-gig-native-fixture-r9-final.json`.
- `/private/tmp/pantopus-home-gig-native-fixture-r9.log` — exact SQL cleanup.
- `/private/tmp/pantopus-home-gig-ios-conversion-build-r13.log` — final signed
  test build; the packaged API/socket are loopback 18083, telemetry keys empty.
  `verify-simulator-keychain-host.py` verifies its own Keychain application identity.
- `/private/tmp/pantopus-home-gig-ios-lint-final9.log` and
  `/private/tmp/pantopus-home-gig-ios-full-format-final9.log` — full Swift quality
  gates, zero violations or required formatting changes.
- `/private/tmp/pantopus-home-gig-ios-detail-recheck-r2.xcresult` — all 67 existing
  affected detail/projection/reassignment/tip checks pass. The earlier recheck
  caught the obsolete cash-or-transfer caption expectation; it now asserts budget.
- `/private/tmp/pantopus-home-gig-ios-discover-recheck-r2.xcresult` — the final
  observable-result synchronization repair, 19 cases repeated three times.

To reproduce, start the committed native fixture with a dedicated local database
containing the 33 Home migrations and an external private output path. Generate
the iOS project, build/sign the simulator app with API/socket set to loopback
18083 and empty telemetry keys, and run the opt-in UI class with
`RUN_HOME_GIG_UI=1` and `HOME_GIG_UI_ORIGIN=http://127.0.0.1:18083` in the
test bundle's xctestrun environment. Do not point this harness at hosted services
or an owner device. The fixture reserves its exact `ddf22600` identity namespace,
asserts its initial absence and performs exact cleanup. Existing regression
gates support actual workflow evidence; no unit-coverage target is used.

## Verification limits and integration

Identity/login/profile/session and geo-provider responses are synthetic. The
Gig detail fixture reads the persisted SQL row and shapes owner geometry with
synthetic creator enrichment; it is not production serializer/privacy acceptance.
Unrelated shell/ancillary APIs remain unavailable rather than invented successes.
This is simulator evidence, not physical-device or hosted-provider acceptance.
Native corrupt-Keychain, storage-write-failure, account-switch-during-preflight
and simultaneous-scene fault injection are not claimed by this journey. Browser
fault-injection and backend SQL races are separate evidence in their linked reports.

The core conversion form does not yet offer ordinary-composer media, shopping
lists, deadline, urgency, business posting or advanced options. Helper bidding,
assignment/payment/completion, durable fanout, Android conversion and final
cross-platform/provider acceptance remain open. All paid services stay in one
final launch-preparation bundle. Home 33 plus paid 21 migrations gives 42 distinct
versions without filename collision; final combined dependencies and replay
remain unfinished. Preserve the browser terminal cancellation guard when
reconciling paid #34's `CompletionFlow` changes. The paid branch also changes
native `GigDetailView`/`GigDetailViewModel`; preserve these status/eligibility fixes
alongside its payment/tip work during integration. No branch merge or deployment
is authorized by a local passing checkpoint alone.
