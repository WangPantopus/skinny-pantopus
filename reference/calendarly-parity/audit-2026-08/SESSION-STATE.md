# Calendarly audit — live session state (2026-08-11, rev 7)

Durable copy (tmp scratchpad got wiped once — everything critical now lives here).
Continuation of ../BRANCH-AUDIT-2026-08.md. Verdict JSONs in this directory are the
authoritative audit record (some entries carry note: reconstructed-from-digest).

## Verification: COMPLETE
- v1 backend 36 claims → 31 CONFIRMED / 3 already-fixed / 2 refuted (file here holds 23 of 36
  entries — the 13 absent ones were all ALREADY-FIXED/refuted/stale-dupes; every actionable
  item is present).
- v3 iOS 56 → 51 CONFIRMED / 4 already-fixed / 1 refuted (52 entries; missing 4 minors all
  handled: balancelabel test-gap skipped per user, slug+danger fixed in main loop, 1 refuted).
- v4 Android 51 → 49 CONFIRMED / 2 refuted (49 entries incl. digest reconstructions).
- v2 shared 24 → all CONFIRMED (most now ALREADY-FIXED; statuses tracked in file).
- v5 automations 9 findings; v6 home parity 22 findings (F9-F15 partially audited — residual
  coverage gap to note in final report).
- design-verified set (prior session): 12 majors + 41 minors; hub/setup majors fixed via
  stabilizers (iOS complete; Android hub mostly landed, remainder in followups list below).

## Fixed and validated so far (uncommitted working tree)
Backend (Jest scheduling suites 58/58 green): all 8 confirmed blockers + 14 majors + minors —
guarded-CAS transitions, owner-scoped suppression, wallet CHECK, patch schemas, cancellation
jsonb (166), one-off null expiry, poll insert-only, booking limits (app+trigger 167+grid),
ics_sequence, completed sweep, payment sweeper, currency threading, public questions,
check-slug, credit CAS ×2, schedule scoping, DST grid, member order, limiter exemption,
query validation, resource pre-delete trigger.
Mobile main-loop: is_live ×4, wizard hours+tz ×2, HAS_BOOKINGS ×2, onboarding defaults,
share-link from real slug ×2, slug charset+error state ×2 wizards, settings danger toast.
Web: COMPLETE — types retypes (tsc now 0 errors), insights rewrites, summary card, ET-01
reorder, ET-02 gated, AVAIL-08 multi-block.

## In flight: wave B workflow wf_b69cc5ea-93e (8 agents, relaunched 2026-08-10)
be-remainder / android-routing / android-share-business / android-invitee /
ios-invitee-bookings / ios-editors-business / home-parity / automations-parity.
Inputs restored after tmp wipe (verdict JSONs in this dir + scratchpad).

## Queue after wave B
1. android-hub-followups (single agent or main loop): warmAmber swap HubComponents.kt:403/413/591,
   SetupSteps.kt:109 rail check-all, pause-banner copy + booking-request relabel+default
   (NotificationPrefsViewModel.kt:121), hub-agenda-future-day-header, agenda duration from
   booking not type, notif-prefs unknown-key preservation, roundrobin-balanced explicit rule
   (verify android-share-business didn't already do the RR one).
2. ET-01 reorder iOS + Android list screens (spec: event-types-frames.jsx FRAME 6; ids
   schedulingEventTypes_reorderEntry/Done/Row_<id>; web implementation is the reference).
3. Paparazzi re-record (arm64 local OK per memory) after ALL Android UI fixes.
4. Validation (whole jobs per pantopus-ci-hidden-failures memory): backend full Jest;
   Android ktlintCheck detekt test paparazziVerify assembleDebug; iOS SwiftFormat/SwiftLint/
   icon+hex gates + xcodebuild test (BLOCKED until user runs `sudo xcodebuild -license accept`);
   web tsc (0 baseline) + targeted vitest.
5. Update ../BRANCH-AUDIT-2026-08.md final statuses + user report. Note deferrals: backend
   paused_until DTO gap, poll viewer-scoped myVotes server half, GiST cross-type race
   (theoretical), v6 F9-F15 coverage tail, A9 test-id parity (user deprioritized tests).

## Environment notes
- git: use DEVELOPER_DIR=/Library/Developer/CommandLineTools (Xcode license invalidated).
- xcodebuild blocked on user running `sudo xcodebuild -license accept` (user informed).
- /private/tmp scratchpad is VOLATILE across multi-day sessions — keep durable state here.


## Rev 6 (2026-08-10 late)
- Xcode license accepted by user — system git + xcodebuild verified working (Xcode 26.6).
- Memory file pantopus-calendarly-audit-protocol.md saved (durable-resume protocol).
- Wave B RESTRUCTURED to sequential pairs (script rewritten in place; resume wf_b69cc5ea-93e).
  Pair order: [be-remainder + android-routing] → [android-share-business + android-invitee] →
  [ios-invitee-bookings + ios-editors-business] → [home-parity + automations-parity].
- Hub-followups fixed in main loop (files no agent owns):
  * NotificationPrefsViewModel: booking_request relabeled "Booking request"/approval copy +
    default true; no_show default true (both mirror backend DEFAULT_NOTIFY_ME); persistPrefs
    now MERGES nested maps (unknown-key preservation).
  * NotifPauseBanner Resume pill wired (onResume param + clickable + testTag notifResume);
    VM.resume() optimistic un-pause via UpdateBookingPageRequest(isPaused=false).
  * Hub amber family completed: new tokens warmAmberSoft #FFFBEB + warmAmberBorder #FDE68A in
    ui/theme/Color.kt (hex allowed in theme); HubPausedBanner + paused pill fully on the
    warm-amber trio; zero PantopusColors.warning left in hub files.
  * Verified already-done by dead stabilizer: WizardStepRail done-set param + both success
    call sites; pause-banner duration/resume labels.
- STILL DEFERRED (blocked on running agents): hub VM availability summaries ×2 + agenda
  future-day header + agenda duration-from-booking + hub topbar settings action (after
  android-routing finishes with hub VM call sites); NotificationPrefs OWNER threading
  (route args — routing agent owns route files; add after it completes, mirroring settings);
  roundrobin-balanced explicit rule (align with iOS agent's encoding choice after ios pair).
- Then: reorder iOS+Android, Paparazzi re-records, full validation, report.


## Rev 7 (2026-08-11)
- PAIR 1 COMPLETE (cached in wf_b69cc5ea-93e — resume never re-runs them):
  * be-remainder 10/10: collective co-host sibling reservations (Booking.cohost_of_booking_id,
    167 §4 + cap-trigger superseded cohost-exempt, sibling lifecycle sync + reschedule move +
    metrics/list/cap exclusions), recurring-block DST timezone columns (167 §5 + zone-aware
    expandRecurrence + write defaults), ics escapeParam, optionalAuth-before-limiter,
    reminder catch-up band + failed-send log release + reminder_lead_times prefs wiring,
    resources maybeSingle 404, poll options rollback, same-date split overrides. Jest 58/58.
    (In passing: fixed latent missing normalizeEmail import in bookingService.)
  * android-routing 10/10: owner/home args on booking-page, manual-booking, onboarding
    (+paid-flag gate), event-type list, all 5 automations routes (AUT-001), quiet-hours
    route registered with homeId (HOME-F8-01/02), resources/visits homeId args (F9-05),
    booking-union deep-link owner (F1-01). BookingPageOwnerRelay DELETED. Tests updated.
- Backend Jest scheduling suites re-verified green post-pair-1 (58/58).
- Wave B resumed: pairs 2-4 in flight ([android-share-business + android-invitee] →
  [ios pair] → [home-parity + automations-parity]).
- Main-loop now doing previously-deferred hub items (routing agent released the files):
  hub availability summaries, agenda future-day header + duration-from-booking, hub topbar
  settings action, NotificationPrefs owner threading.


## Rev 7b (2026-08-11) — hub follow-ups COMPLETE in main loop
All previously-deferred hub/notif items landed (files released by the routing agent):
- availabilitySummary ported from iOS summarizeRules (real day label + earliest-latest hours
  via new shortTime helper) — hub-hardcoded-availability-summary + android-hub-availability.
- Agenda row duration now from the booking's own start->end (bookingDurationMinutes), event-type
  default only as fallback — android-hub-agenda-duration-from-type.
- Hub top-bar overflow glyph wired to Settings (settingsRoute(), clickable when canEdit) —
  android-hub-topbar-settings-inert. (future-day header already done by routing agent.)
- NotificationPrefs owner threading: NOTIFICATIONS route gains owner args + notifications()
  builder; VM reads SavedStateHandle via SchedulingOwner.fromRoute; getBookingPage/reminder/
  pause writes use owner not hardcoded Personal; RootTabScreen composable + settings VM
  notificationsRoute() + test updated. (reminder minutes + pause were editing the personal
  page from Business/Home hubs — same wrong-owner data class as the settings blocker.)
Backend re-verified: all 12 touched files node --check clean; Jest 58/58.
STILL LEFT: mobile pairs 2-4 (running), reorder iOS+Android, Paparazzi re-records, full
validation, report. roundrobin-balanced explicit rule deferred to ios-editors pair.


## OPEN GAP flagged rev 7b — design-polish minors (do as a dedicated pair AFTER current pairs)
The design-verified.json editor/availability/connected-calendars/round-robin visual MINORS were
assigned to wave-A design fixers that died; wave-B works from the CODE verdict files, so these
were NOT picked up (except where they coincide with a code finding). Remaining to sweep once the
current pairs release the files (they touch editor/availability/CC/household right now):
  iOS:  ED-03 (field labels strong token), ED-04 (location field bare→label+border),
        ED-05 (Basics copy), ED-06 (link rows show current value), AVAIL-02 (12px gaps),
        AVAIL-03 (leading 30px icon tile), AVAIL-04 (member-hours tz chip), AVAIL-05 (wrap
        time chips), AVAIL-08 done(web only was mine; check iOS), AVAIL-09 (9.5pt overlines),
        AVAIL-10 (segmented control vs native Picker), AVAIL-13 (no-hours card colors),
        AVAIL-16 (Save/Saving top bar), AVAIL-17 (max-per-week placeholder), CC-01/CC-02,
        ET-03 (N-hosts badge on list row).
  Android: ET-04/05/06 (list filter seg / overflow highlight / empty CTA hug), RR-02 (overline
        grey), RR-03 (shimmer loading), CO-01 (collective glyph), AVAIL-06 (override icons),
        AVAIL-07 (holiday footnote), AVAIL-11 (block-off saving frame), AVAIL-12 (remove
        Applies-to card), AVAIL-13, AVAIL-14 (household mini-toggle 36×20 — reuse
        PantopusMiniToggle), AVAIL-15 (tz globe grey), AVAIL-16/17, CC-01/CC-02.
  Verify each against tree first — some may be incidentally fixed by the running share-business/
  editor agents (CC-02=connected-calendars-fake-sync-time, AVAIL-14 mini-toggle, ET-03 badge).
Source buckets: reference/calendarly-parity/audit-2026-08/ + scratchpad fix-{ios,android}-design.json.


## Rev 8 (2026-08-11) — pairs 1-2 DONE; pair 5 appended; resumed
- PAIR 2 COMPLETE: android-share-business 20 fixed + 3 verified-already-landed (incl. fake-qr
  zxing encoder, invoice line-item quantity, price-field decimals); android-invitee 12/12
  (10 fixed + slotpicker-month BLOCKER & conflict-sheet verified already-landed). Details in
  wgxtwtkrn.output + journal.
- Pair 5 APPENDED to script (cache prefix intact): android-list-polish + ios-list-polish —
  each builds ET-01 reorder (shared ids schedulingEventTypes_reorderEntry/Done/Row_<id>, web
  impl as reference) + sweeps that platform's design-polish minors (verify-first), and
  android side mirrors iOS's roundrobin-balanced rule encoding.
- Workflow resumed (task wve9j1axv): pair 3 (iOS invitee+editors) now, then pair 4
  (home+automations), then pair 5.
- Main loop: unclamped-from-truncates-window FIXED (computeSlots clamps from to now);
  availability tests 21/21. Android :app:compileDebugKotlin + ktlintCheck canary launched in
  background (validates pairs 1-2 edits).
- REMAINING after pair 5: Paparazzi re-record + full validation suite (task 5), BRANCH-AUDIT
  final statuses + report (task 6). Deferred-by-design list unchanged (paused_until DTO,
  poll myVotes server half, GiST cross-type race, v6 F9-F15 tail, A9 test-ids).

- Rev 8a: FULL backend Jest green — 213/213 suites, 3236 passed (baseline was 3230; +6 from new regression tests), 16 pre-existing skips. Backend validation (task 5 backend half) DONE.
- Rev 8b: Android :app:compileDebugKotlin + ktlintCheck GREEN (exit 0) over all pairs-1/2 edits + main-loop hub/notif changes. :app:testDebugUnitTest launched in background.
- Rev 8c: Android :app:testDebugUnitTest GREEN (exit 0) — full unit suite passes over pairs-1/2 + main-loop edits. Android validation remaining: detekt + paparazziVerify/re-record + assembleDebug AFTER pairs 4-5 land their UI changes.


## Rev 9 (2026-08-12) — PAIR 3 (iOS) COMPLETE; pairs 4-5 resumed (task w8sc2p9ud)
- ios-invitee-bookings: 19 fixed + 3 blockers verified ALREADY-FIXED in tree (price-int trap
  Int(exactly:) clamp, filter-today exclusive bounds in shared dateBounds, d2 state=.ready
  before push + test).
- ios-editors-business: 16 fixed (incl. onboarding success-on-failure w/ submitError footer,
  roundrobin-rule-roundtrip, reminders 5-cap, one-off explicit-null Never, booking_request
  relabel iOS half).
- The 5 hub majors absent from agent output (summary-dto, hub-error-vs-empty, canEdit reset,
  pillar-switch guard ×2, error-code carry) — ALL verified fixed in current tree by direct
  read (landed via earlier partial runs). No action needed.
- Backend full Jest 213/213 + Android compile+ktlint+unit ALL GREEN (rev 8a-8c).
- Remaining agents: pair 4 (home-parity + automations-parity) then pair 5 (android-list-polish
  + ios-list-polish) — resumed and running.
- Now running iOS lint gates + background build over the stable iOS tree.
- Rev 9a: iOS lint gates ALL GREEN — SwiftLint (only pre-existing force-unwrap warnings in untouched Mailbox/Media files, the documented 0.63.x version-skew non-failures), verify-icons clean, hex gate clean, SwiftFormat 0/1732 after auto-fixing 3 numberFormatting violations (43200-style literals from the reminders-cap fix; DefaultRemindersViewModel + test + BusinessKit). iOS make build still running in background; workflow pairs 4-5 running.


## Rev 10 (2026-08-12) — 8/10 agents CACHED; pair 5 is all that remains
- PAIR 4 COMPLETE (cached): home-parity + automations-parity. Files confirmed on disk
  (homes/calendar/* AddEventForm/EventDetail/HomeAgenda/HomeCalendar*, scheduling/automations/*
  MessagePreview/MessageTemplateEditor/RemindersQuickSetup...).
- PAIR 5 = ONLY remaining fix work. Both failed for NON-CODE reasons:
  ios-list-polish = transient API 529; android-list-polish = Fable 5 usage limit (user has
  since switched session model to Opus 5, which clears it). RESUMED as task w5rtjjjm3.
  * android-list-polish PARTIALLY LANDED before dying: EventTypeListViewModel has reorder
    state machine (_reordering/startReorder/doneReordering/moveRow/persistOrder) and
    EventTypeListScreen has REORDER_ENTRY/REORDER_DONE testTags. Re-run will verify-first
    and continue with the design-polish minors.
  * ios-list-polish landed NOTHING (529 before any edit) — iOS reorder still absent.
- VALIDATION STATUS (corrected):
  * backend full Jest 213/213 (3236 tests) GREEN.
  * Android compileDebugKotlin + ktlintCheck + testDebugUnitTest GREEN.
  * iOS lint gates GREEN (SwiftFormat 0/1732 after 3 auto-fixes, SwiftLint pre-existing-only,
    verify-icons clean, hex gate clean).
  * iOS BUILD **NOT** VERIFIED YET — `make build` FAILED with Error 70, but for an ENVIRONMENT
    reason, not code: Makefile:8 DESTINATION_SIM defaults to
    `platform=iOS Simulator,name=iPhone 17,OS=latest`; OS=latest resolves to iOS 26.5 which is
    NOT installed after the Xcode 26.6 update (installed runtimes: iOS 18.5 and iOS 26.0), so
    xcodebuild fell back to a generic "Any iOS Device" destination and bailed.
    ==> RE-RUN AS: cd frontend/apps/ios && make test DESTINATION_SIM="platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0"
    (do this AFTER ios-list-polish finishes editing, to avoid racing a half-written file).
- Remaining after pair 5: iOS build+test w/ the destination override; Android detekt +
  paparazziVerify → paparazziRecord (arm64 local OK per memory) + assembleDebug; web vitest;
  then BRANCH-AUDIT-2026-08.md final statuses + user report (task 6).


## Rev 11 (2026-08-12, Opus 5 session) — validation corrections + commit prep
CORRECTIONS to earlier claims (both were MY reporting errors, not code defects):
- "iOS build passed" was WRONG: `make build` returned Error 70. Cause = env, not code —
  Makefile:8 DESTINATION_SIM = `name=iPhone 17,OS=latest`; OS=latest wants iOS 26.5 which is
  NOT installed (have 18.5 + 26.0), so xcodebuild fell back to a generic device and bailed.
  FIX: make build/test DESTINATION_SIM="platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0"
- "web tests pass" was WRONG the first time: I ran `npx vitest run`, but this app uses JEST
  (package.json test = "jest --forceExit"); vitest had no config so all 50 files failed to
  resolve `@/` aliases. RE-RAN CORRECTLY: **43 suites / 523 tests GREEN**.
STATUS NOW:
- backend Jest 213/213 (3236) GREEN | web Jest 43/43 (523) GREEN
- Android compile+unit+ktlint+detekt: running (task b1w475njl)
- iOS build w/ correct destination: running (task bj7bp93ad)
- Android reorder (ET-01) VERIFIED COMPLETE on disk: VM state machine + REORDER_ENTRY/
  REORDER_DONE/REORDER_ROW_PREFIX testTags all wired in EventTypeListScreen.
- iOS reorder (ET-01) still ABSENT — ios-list-polish never ran (529 then session limits ×2).
- 314 files uncommitted → COMMIT+PUSH once the two validations return (user authorized).
REMAINING: iOS reorder + iOS/Android design-polish minors (pair 5), Paparazzi re-record,
BRANCH-AUDIT final statuses + report.
- Rev 11a ENV GOTCHA: this shell has NO ANDROID_HOME and the repo has no local.properties
  (SDK lives at ~/Library/Android/sdk). Earlier gradle runs only worked off a warm
  configuration cache; any run with a NEW task set re-configures and fails with
  "SDK location not found". ALWAYS run gradle as:
    cd frontend/apps/android && ANDROID_HOME="$HOME/Library/Android/sdk" ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" ./gradlew <tasks>

## Rev 11b — iOS BUILD BLOCKED ON USER ACTION (environment, not code)
`xcodebuild -showdestinations` for scheme Pantopus lists ZERO eligible destinations; the only
entry is the ineligible device placeholder with: "iOS 26.5 is not installed. Please download
and install the platform from Xcode > Settings > Components."
Tried and ruled out: name=iPhone 17 Pro,OS=26.0 (echoed but unmatched — runtime is 26.0.1),
explicit device UDID, and `generic/platform=iOS Simulator` — all fail identically.
SDKs ARE present (iphoneos26.5 / iphonesimulator26.5) and deployment target is only 17.0, so
this is purely the missing downloadable iOS platform component for Xcode 26.6.
USER ACTION REQUIRED (either):
  * Xcode > Settings > Components > install iOS platform, or
  * `xcodebuild -downloadPlatform iOS`   (multi-GB; not run without approval)
Until then iOS is validated by: SwiftFormat 0/1732, SwiftLint (pre-existing warnings only),
verify-icons, hex gate — parse+style level, NOT compile. Historically this branch's iOS target
DID compile ("** TEST BUILD SUCCEEDED **" in BRANCH-AUDIT) before the Xcode 26.6 update.


## Rev 12 (2026-08-12) — iOS reorder BUILT in main loop; validation sweep
- ET-01 iOS REORDER implemented by me (ios-list-polish agent never ran — 529 + limits):
  * EventTypeListViewModel: isReordering, canReorder (canEdit && >1 row), startReordering(),
    doneReordering() -> persistOrder(), moveRows(fromOffsets:toOffset:) that splices the moved
    row inside the FULL catalog via id translation so hidden rows stay put; persistOrder()
    PUTs sort_order for every row whose index != stored sortOrder, then refetches (failure =>
    actionError + refetch, never a lying local order).
  * UpdateEventTypeRequest gained sortOrder end-to-end (property + CodingKey "sort_order" +
    init param + encodeIfPresent) — it genuinely lacked it.
  * EventTypeListView: top bar retitles to "Reorder", back/+ hidden while reordering, new
    reorder entry (Icon .move) with a11y id schedulingEventTypes_reorderEntry; FRAME 6 hint
    bar (primary50 bg, primary100 hairline, .move glyph, "Drag to set the order people see",
    Done -> schedulingEventTypes_reorderDone); reorderList = plain List in constant .active
    editMode with .onMove -> viewModel.moveRows, rows get
    schedulingEventTypes_reorderRow_<id>; EventTypeRowCard gained isReordering (leading
    .gripVertical, overflow hidden, toggle inert).
  * Icons .move and .gripVertical already existed in Core/Design/Icons.swift.
  * SwiftFormat 0/1732 clean after edits.
- ANDROID fix: BookingPageSnapshotTest called QrCanvas() without the new `url` param (the
  fake-qr fix changed the signature) -> test-compile FAILED. Fixed by passing a pinned URL.
- ktlintFormat auto-fixed 34 style violations across the agents' files (SchedulingRoutes,
  TimezonePicker, MessagePreview/MessageTemplateEditor/WorkflowEditor, ShareLinkSheet unused
  import, EventTypeListViewModel, SchedulingHubViewModel, NotificationPrefsViewModel...).
- VALIDATION: backend 213/213 (3236) GREEN | web Jest 43/43 (523) GREEN | Android
  compile+testCompile GREEN (gate re-running post-format) | iOS lint gates GREEN |
  iOS BUILD still blocked on the missing Xcode iOS platform (rev 11b).


## Rev 13 (2026-08-12) — post-agent regression sweep (found by validation, fixed by me)
The agents' work left 4 real breakages that only the full gate surfaced:
1. BookingPageSnapshotTest called QrCanvas() without the new `url` param (fake-qr fix changed
   the signature) -> test-compile failure. Fixed with a pinned URL.
2. IconTest inventory drift: `calendar-search` (home-calendar filtered-empty state, present in
   design frames) was added to PantopusIcon but never registered. Registered.
3. RoundRobinAssignmentViewModelTest ×2 asserted the OLD priority encoding {0,1}. The new
   encoding is deliberate and is the roundrobin-balanced-infers-as-strict FIX:
   Strict=priority 0 / Priority=1-based rank / Balanced=-1 sentinel, so Balanced-with-default-
   weights no longer round-trips as Strict. Updated the TESTS (code was right) and made the
   companion `internal` so tests assert the real constant instead of re-hardcoding -1.
4. detekt 6 issues in agent code, all genuinely refactored (not suppressed):
   - RemindersQuickSetupViewModel: 3 MagicNumbers -> named constants (MINUTES_PER_HOUR,
     MINUTES_PER_DAY, MAX_CUSTOM_MINUTES_ENTRY); ComplexCondition -> named `rejected` val
     using `minutes !in 1..MAX_REMINDER_MINUTES`.
   - BookingLimitsViewModel.save(): CyclomaticComplexMethod 19/18 -> extracted buildPatch()
     with a local `ifMoved` helper preserving the per-field dirty semantics exactly.
   - EventTypeListScreen ContentBody: NestedBlockDepth 4/4 -> drag handler flattened by
     computing the swap `neighbour` up front (depth 3).
Also ktlintFormat auto-fixed 34 style violations + 2 hand-fixes in my own onboarding edits.


## Rev 14 (2026-08-12) — COMMITTED + PUSHED
5 commits on feature/calendarly (72c9c592..b3018f89), pushed to origin:
  71499c34 docs(calendarly): design frames + full audit record
  d8874d6f fix(calendarly-backend): 8 blockers + 14 majors
  cb119c4c fix(calendarly-web+types): wire contract + catalog screens
  c6f8c270 fix(calendarly-android): owner threading, 7 blockers, design gaps
  b3018f89 fix(calendarly-ios): 3 blockers, hub/editor majors, reorder mode
Working tree CLEAN (0 files).

FINAL GATES: backend Jest 213/213 (3236) | web Jest 43/43 (523) | web tsc 0 errors |
Android compile+unit+ktlint+detekt BUILD SUCCESSFUL | iOS SwiftFormat 0/1732 + SwiftLint/
icons/hex clean. iOS COMPILE still unverified — needs `xcodebuild -downloadPlatform iOS`.

REMAINING (small, non-blocking):
1. Android Paparazzi baselines for changed scheduling screens (./gradlew paparazziRecord;
   arm64-local records pass CI's Linux verify per pantopus-paparazzi-apple-silicon memory).
   NOT yet re-recorded — paparazziVerify was deliberately excluded from the gate runs.
2. iOS compile/test once the platform is installed.
3. Residual design-polish minors listed under "OPEN GAP" (rev 7b) — cosmetic only.


## Rev 15 (2026-08-12) — Paparazzi baselines re-recorded (verified, minimal)
paparazziVerify surfaced exactly 3 failures; each diff was inspected VISUALLY before
re-recording (never blind-accepted):
  · bookingpage share_targets_and_qr (1.96%) — old baseline was the fake noise grid with no
    finder patterns / no quiet zone; new one is a real scannable QR. Proof of the fake-qr fix.
  · hub hub_loaded_pieces (0.20%) — bulky M3 Switch -> the design's 32x18 mini toggle.
  · eventtypes list_empty_templates (0.92%) — full-width CTA -> hugging CTA (ET-06).
`paparazziRecord` rewrote 11 baselines, not 3. The extra 8 were sub-tolerance drift; 6 of them
(homes.maintenance, mailbox CertifiedDetail x3, place.messaging x2) are screens this branch
NEVER touched = arm64 re-render noise. Those 6 were REVERTED and paparazziVerify still passes
(BUILD SUCCESSFUL), which confirms they were noise. Committed only the 5 scheduling baselines.
Rule for future records here: revert any rewritten baseline on a screen you didn't change.


## Rev 16 (2026-08-12) — REAL toolchain verification (user approved the 8.5GB platform download)
iOS PLATFORM INSTALLED (`xcodebuild -downloadPlatform iOS` -> iOS 26.5 sim, 8.52GB). Destinations
now resolve. THE FIRST REAL iOS COMPILE FOUND A HARD BUILD FAILURE that every lint gate passed:
  InviteeConfirmedView.swift:414 "the compiler is unable to type-check this expression in
  reasonable time" — ConfettiBurst's ForEach body was one chained SwiftUI expression
  (.fill/.frame/.position/.rotationEffect/.opacity/.animation) with untyped numeric literals.
  FIXED: extracted `piece(index:containerWidth:)` with fully annotated locals (CGSize, Double,
  CGFloat). Rebuild in progress.
  LESSON: SwiftFormat/SwiftLint/icon/hex gates do NOT substitute for a compile. Never again
  report iOS as "validated" on lint alone.
  Build gotcha: two concurrent xcodebuild runs on the same DerivedData => "database is locked"
  (error 65) which LOOKS like a compile error. Run one at a time.

MIGRATIONS PROVEN ON REAL POSTGRES (docker postgis/postgis:16-3.4 — the stock postgres image
lacks postgis and the schema uses geography in 44 places; shims needed: auth schema + auth.uid()/
auth.role(), roles authenticated/service_role/anon, uuid-ossp, pgcrypto, btree_gist):
  schema.sql (frozen snapshot) then 159..167 ALL APPLY CLEAN (9/9).
  Objects verified: cancellation_policy=jsonb, cohost_of_booking_id=uuid, ics_sequence=int
  default 0, AvailabilityBlock.timezone + HomeCalendarEvent.timezone=text, triggers
  booking_daily_cap_trg + booking_group_cap_trg + homeresource_predelete_trg present,
  WalletTransaction_type_check includes withdrawal_reversal, EmailSuppression has owner_type
  + owner_id.
  FUNCTIONAL PROOF (live DB, rolled back):
    · group seat_cap=2 -> seat1 OK, seat2 OK (IMPOSSIBLE before this audit), seat3 rejected
      "GROUP_SLOT_FULL: 2 of 2 seats taken".
    · daily_cap=1 -> 1st OK, 2nd same-UTC-day rejected "DAILY_CAP_REACHED: 1 of 1",
      co-host shadow (distinct host_user_id) STILL accepted on a full day (exemption works),
      next day free again.
    · Booking_no_overlap correctly rejected a malformed test that reused one host_user_id for
      the shadow — the constraint is live and doing its job.
  NOTE: numbered migrations are INCREMENTAL patches, not a from-scratch schema; a bare DB needs
  backend/database/schema.sql applied first (base tables like "User"/"Home" live only there).


## Rev 17 (2026-08-12) — design-polish tail DONE + a CI-breaker I introduced, caught
POLISH SWEEP (workflow wf_7b06f769-77b, sequential pair, both agents completed):
- android-polish: 12 fixed (RR-02 overline grey, RR-03 shimmer loading, CO-01 git-merge glyph,
  AVAIL-06 four override glyphs, AVAIL-07 holiday footnote, AVAIL-11 saving frame, AVAIL-12
  removed the "Applies to" card + its dead plumbing, AVAIL-13 warningStrong/warningDeep,
  AVAIL-14 mini-toggle 36x20, AVAIL-15 globe grey, AVAIL-16 Save/Saving action, CC-01 split
  coming-soon vs none-connected). 5 verified ALREADY-CORRECT and left untouched (ET-04/05/06,
  AVAIL-17, icon registration). Android gate BUILD SUCCESSFUL; no Paparazzi drift.
- ios-polish: ED-03/04/05/06, AVAIL-02/03/04/05/08/09/10/13/16/17, CC-01/CC-02 fixed.
  ET-03 correctly NOT done — DATA-BLOCKED: GET /event-types returns no assignee/host count, so
  an "N hosts" badge needs a backend field; neither Android nor web renders it either. Route as
  a backend+3-client item, not iOS polish. (Good call by the agent; agreed.)

CI-BREAKER I CAUSED (found via the agent's report, then confirmed myself):
  .github/workflows/ios-ci.yml:60 runs `swiftlint lint --strict` — warnings are ERRORS there.
  My committed reorder work took EventTypeListViewModel.swift from 496 -> 560 lines (limit 500)
  and both List VM + View past type_body_length 300. That would have failed CI.
  FIX: tried extracting reorder into EventTypeListViewModel+Reorder.swift, but a cross-file
  extension cannot touch `private` members (eventTypes/client/fetch) nor set `private(set)
  isReordering` — it would have required widening 5 members to internal, trading real
  encapsulation for a line count. REVERTED that and used the project's existing opt-out
  (`// swiftlint:disable file_length` + `disable:next type_body_length`), which sibling
  scheduling files already use. EventTypes now strict-clean.
  Remaining --strict errors are 6 pre-existing force_unwrap hits in Mailbox/Media files this
  branch never touched (local SwiftLint 0.63.2 vs CI-pinned 0.63.3 skew, documented in the
  workflow).
ALSO: swiftformat had 4 violations in my ConfettiBurst fix (spaceAroundOperators/docComments)
  — formatted; whole app back to 0/1732.
IN FLIGHT: full iOS build+test (first ever with the polish changes) + full Android gate.

## Rev 18 (2026-08-17) — resume after 5-day cutoff; final gate re-run
Previous session died mid-iOS-test-suite (** BUILD INTERRUPTED ** in /tmp/ios-test2.log after
291 suites / 0 failures — no final verdict). State on resume:
- 29 files UNCOMMITTED (16 iOS + 13 Android): the whole design-polish tail (12 Android + 16 iOS
  fixes), my swiftlint --strict CI-breaker fix (EventTypeList disables), ConfettiBurst
  type-check fix. HEAD still be81a1fb.
- ALREADY VERIFIED on this exact batch (do not redo): Android full gate BUILD SUCCESSFUL
  (compile+unit+ktlint+detekt+paparazziVerify — no snapshot drift); iOS make verify-icons clean;
  no raw hex in either diff; swiftformat 0/1732; EventTypes strict-lint clean; iOS
  BUILD SUCCEEDED (build w/o test, ios-build3.log).
- ONLY REMAINING GATE: full iOS test suite → /tmp/ios-test3.log (relaunched this rev).
- THEN: commit all 29 files + SESSION-STATE + push. Nothing else outstanding.
- Docker pantopus-migtest (postgis 16) still up 5 days — remove after push (migration proof
  already recorded in rev 16; container no longer needed).
- Known one-flaky-per-run Android unit tests (dispatcher leakage, pre-existing, pass isolated):
  OneOffLink/PayoutsEarnings/Me/MemberPollResponse VMs — do NOT chase.

## Rev 19 (2026-08-17) — CLOSED. Everything landed and pushed.
- 29-file polish batch committed (android f/b by platform) after the REAL iOS gate: the full-app
  suite HANGS on PulseFeedViewModelTests (socket wait, pre-existing, non-scheduling) — switched
  to -only-testing over all 91 scheduling test classes = 509 cases, 0 failures. zsh gotcha:
  ${=classes} needed, or all -only-testing filters pass as ONE arg and 0 tests run (a false
  TEST SUCCEEDED — caught by asserting a non-zero case count).
- ET-03 done end-to-end: backend assignee_count aggregate + web (7dea15d1), iOS + Android pills
  (this rev). All 4 platforms verified green.
- pantopus-migtest docker container removed (migration proof stands in rev 16).
- NOTHING OUTSTANDING. Remaining user-only items: apply migrations 166/167 to real dev/staging
  DB, manual smoke of core flows.
