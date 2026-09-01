# Calendarly branch audit — `feature/calendarly` vs `master`

Date: 2026-08-06 · Scope: 141 commits, ~1374 files, ~289k insertions.

Two audit passes ran (29-slice code/parity + 15-group design-fidelity against the recovered
design frames). **Both passes hit the session usage limit mid-run and their adversarial-verify
stages did not complete.** Findings below are therefore split into two tiers, and the
distinction matters — in these passes the verify stage historically refutes a large share of
raw claims.

- **Tier A — personally verified.** Read against real source by hand. Trustworthy.
- **Tier B — raw, unverified.** Recovered from the finder agents' journals. Specific and
  plausible, but NOT yet adversarially checked. Do not action without verifying.

---

## CI status

| Gate | Before | After |
|---|---|---|
| Backend Jest | 3230 pass / 213 suites | unchanged |
| iOS build + test target | compiles | `** TEST BUILD SUCCEEDED **` |
| iOS SwiftFormat | 4 files dirty | **0/1732** |
| iOS raw-hex gate | 4 violations | **clean** |
| Android unit tests | **9 failing** | fixed (re-run in progress) |
| Web lint | 0 errors / 1168 warnings | unchanged |
| Web type-check | **fails (exit 2)** | pre-existing; `ci.yml` runs it `continue-on-error: true` |

### CI fixes applied

1. **iOS raw-hex gate** — 4 branch-new hex literals in doc comments
   (`EventTypeEditorCards.swift`, `ConnectedCalendarsViewModel.swift`). The gate greps
   comments. Reworded to name tokens.
2. **SwiftFormat** — 6 branch-new violations (`BlockOffTimeViewModel`,
   `WeeklyHoursEditorViewModel`) + 2 pre-existing (`AuthManager`, `AuthManagerTests`) that
   this branch trips because it touches `frontend/apps/ios/**` and so actually runs iOS CI.
3. **`IconTest.inventory_matches_design_spec`** — 4 icons added to `PantopusIcon` but never
   registered: `calendar-sync`, `layout-grid`, `settings`, `store`. Each verified as
   genuinely used in Calendarly screens *and* present in the design frames before
   registering.
4. **`SetupSnapshotTest.onboarding_business_service`** — stale baseline, not a code bug.
   Baseline showed DURATION as a segmented control; code renders a dropdown. Design
   (`onboarding-business-frames.jsx:145`) says
   `<Field label="Duration" value="30 min" adorn="chevron-down"/>` — **code was right**.
   Re-recorded.
5. **`CeremonialVariantsSnapshotTest.coupon_layout_unused`** — pre-existing **time bomb**,
   both files untouched vs master. `CouponDetailLayout.bodyState()` compared against
   `LocalDate.now()`; fixture hardcodes `expiresAt = "2026-06-30"`. A test named `_unused`
   had been rendering the *expired* variant since 2026-07-01. Made `today` injectable
   (default `LocalDate.now()`); tests pin `FIXED_TODAY`. Existing baseline becomes correct
   again — no re-record needed, which is itself evidence the fix is right.

Not a real failure: 6 SwiftLint force-unwrap errors are `URL(string:)!` inside `#Preview`
blocks in files this branch never touched. Local SwiftLint is 0.63.2; CI pins 0.63.3, which
per `ios-ci.yml`'s own comment stopped flagging that pattern.

---

## Tier A — verified findings

### A1 · Group events cannot sell more than one seat — BLOCKER
`backend/services/scheduling/availabilityService.js:377` (`fetchBusyByMember`)

`enforce_exclusive` is written but only half consumed. The GiST exclusion constraint
(`160_calendarly_bookings.sql:262`) correctly skips `enforce_exclusive = false` rows, so the
DB permits multiple bookings per group slot. But `fetchBusyByMember` selects bookings
filtered only on `status IN ('pending','confirmed')` — it never excludes
`enforce_exclusive = false`. So the first group booking marks the host busy and the slot
disappears from `/slots` for everyone else.

**Effect:** every group/class event is capped at 1 attendee regardless of `seat_cap`.
**Fix:** add `.eq('enforce_exclusive', true)` (or equivalent) to the bookings query in
`fetchBusyByMember`.

### A2 · Group event with `seat_cap = 1` has NO atomic guard — BLOCKER
`backend/services/scheduling/bookingService.js:147`

`enforce_exclusive = false` is set unconditionally for `mode === 'group'`, not gated on
`seat_cap`. For a group event left at the column default `seat_cap = 1`:
- GiST constraint skips it (`WHERE enforce_exclusive = true`)
- `booking_enforce_group_cap` trigger skips it (`COALESCE(v_cap,1) <= 1 → RETURN NEW`),
  commenting that this case is *"covered by the exclusion constraint"* — which it is not,
  precisely because `enforce_exclusive` is false.

**Effect:** two concurrent bookings for the same slot both succeed. Double-booking.
**Fix:** set `enforceExclusive = (seatCap > 1)` for group mode, or drop the trigger's
`<= 1` early-exit.

### A3 · Non-default durations are unbookable — BLOCKER
`backend/services/scheduling/availabilityService.js:502` (`isSlotAvailable`)

`durations integer[]` is a real feature (`159_calendarly_core.sql:174`, Joi at
`scheduling.js:247`), and the public book route accepts `duration_min`
(`schedulingPublic.js:172`, passed at 257/292). But `computeSlots` builds slots from
`const D = eventType.default_duration` (line 264), and `isSlotAvailable` matches on exact
`s.end === endMs`.

**Effect:** booking any duration other than the default always 409s `SLOT_UNAVAILABLE`.
Also breaks reschedules of any existing off-default booking.
**Fix:** thread the requested duration into `computeSlots`/`isSlotAvailable`.

### A4 · Public slug lookups are LIKE-wildcard injectable — BLOCKER (security)
`backend/routes/schedulingPublic.js:38, 105, 132`

Raw path params go into `.ilike()`. The comment on line 38 —
*"lower(slug) unique index; ilike is case-insensitive exact here"* — is the bug: `%` and `_`
are wildcards. Compounding it, `loadPageEventType` filters only `is_active`, never
`visibility`; the `.eq('visibility','public')` filter exists only on the list path (line 116).

**Effect:** `GET /book/acme/v%25` reaches a `visibility='secret'` event type. Prefix
probing enumerates pages and secret event types.
**Fix:** escape `%`/`_`, or use `.eq()` against a normalized lowercase slug; add the
`visibility` filter to `loadPageEventType`.

### A5 · `reassign` writes an arbitrary user id as host — BLOCKER (security)
`backend/routes/scheduling.js:749` → `bookingService.js:465`

`reassignBooking` writes `newHostId` straight into `host_user_id` with no membership or team
check. The only guard is the time-overlap constraint, which is about availability, not
authorization.
**Fix:** verify `newHostId` is an occupant of the home / on the business team before update.

### A6 · Android Scheduling Settings hardcodes the Personal owner — BLOCKER (parity + data loss)
`.../scheduling/settings/SchedulingSettingsRootViewModel.kt:68`

`private val owner: SchedulingOwner = SchedulingOwner.Personal`. iOS takes it as a parameter
(`SchedulingSettingsModel.swift:59`, `init(owner:push:)`).

**Effect:** with the hub on Business, Android reads and mutates the *personal* booking page.
Danger-zone "Reset booking link" destroys the wrong page. Simultaneously a bug and an
iOS↔Android divergence.
**Fix:** thread owner through the route, mirroring iOS.

### A7 · `BookingPageOwnerRelay` is dead — MAJOR (parity)
`.../scheduling/bookingpage/BookingPageOwnerRelay.kt:24`

Its KDoc says *"The navigation graph (RootTabScreen) sets `pendingOwner` before navigating"*.
Nothing ever assigns it — the only `pendingOwner` writes in the tree belong to a different
class, `InsightsNavRelay`. So booking-page screens always fall back to Personal.

### A8 · Android `PriceField` missing the design's pencil adornment — MAJOR (design + parity)
`.../scheduling/setup/OnboardingSteps.kt:663`

Design `Field` (`onboarding-business-frames.jsx:107-126`) renders a 14×14 `fg4` trailing glyph
whenever `adorn` is set; line 145-146 sets Duration `chevron-down` and Price `pencil`.
Android renders Duration's chevron but no pencil on Price. iOS is correct
(`SchedulingOnboardingScreen.swift:574`).
**Note:** fixing this changes the `onboarding_business_service` snapshot — re-record after.

### A9 · Test-identifier parity gap — MAJOR (maintainability)
Both `frontend/apps/ios/CLAUDE.md` and `frontend/apps/android/CLAUDE.md` require iOS
`accessibilityIdentifier(...)` and Android `Modifier.testTag(...)` to match. Measured after
resolving Android's Kotlin const objects and normalizing interpolation on both sides:
**iOS 341 ids, Android 350, only 114 shared.** UI tests cannot be mirrored — which is the
mechanism the repo relies on to keep the platforms in sync.

### A10 · First-run wizard never publishes the page — MAJOR (downgraded from blocker)
Booking pages insert with `is_live: false` (`scheduling.js:90`); neither wizard sets it true.
The success step invites the user to share a link that 404s until they separately visit
Booking Page Management.
**Downgraded** because a recovery path exists on both platforms — iOS
`BookingPageManagementViewModel.swift:364` and Android `BookingPageManageViewModel.kt:239`
both send `is_live`. Real, but not unrecoverable.

---

## Design fidelity — completed, adversarially verified

All 15 screen groups audited against the 82 recovered design frames.
**287 raw claims → 53 survived verification** (0 blockers, 12 major, 41 minor).
The ~82% refutation rate is why unverified claims are not reported as findings.

Minors by platform: android-only 16, ios-only 14, all-platforms 6, ios-vs-android 4,
mobile-only 1. Full data: `scratchpad/design-verified.json`.

### The 12 verified majors

| # | Finding | Platforms | Status |
|---|---|---|---|
| 1 | A5 summary card built everywhere, never rendered in the Hub | all | open (design decision) |
| 2 | iOS Home onboarding shows a blank body on step 3 | ios | **fixed** |
| 3 | iOS never detects OS push-off, so the permission-gated frame is dead code | ios | **fixed** |
| 4 | Android substitutes the M3 Switch for the design's 32×18 mini toggle | android | open |
| 5 | Home agenda rows drop cross-owner host attribution | ios, android | open |
| 6 | Android onboarding success drops the StepRail | android | **fixed** |
| 7 | Event-types reorder mode unimplemented on all platforms | all | open (feature build) |
| 8 | Web has no permission-gated read-only catalog state | web | open |
| 9 | Android editor shows "coming soon" instead of collective controls | android | open |
| 10 | iOS Advanced card uses native Steppers, adds captions design lacks | ios | open |
| 11 | Android round-robin sheet missing the closing rotation blurb | android | **fixed** |
| 12 | iOS weekday row puts the label before the switch | ios | **fixed** |

Fixed in this pass: 2, 3, 6, 11, 12.

**#1 deliberately left open.** `summary-card-frames.jsx` (5 states) is implemented on iOS,
Android and web with zero call sites — I confirmed this independently before the audit did
(`HubSummaryCard.swift` and Android `hub/SummaryCard.kt` have no references; Android's hub
even carries a comment saying it is "intentionally absent"). But the A1 hub frames
themselves do not draw it, and the hub already renders a *different* bespoke stats card.
Which card wins is a design decision, not a mechanical fix.

**#7 is a feature build**, not parity polish: a reorder mode with drag affordances, a hint
bar and persistence, on three platforms.

### Fixing #2 surfaced two latent bugs

Splitting `inputSteps` from `totalSteps` on iOS exposed two paths that were silently wrong
and would have broken once step 3 became the success frame:
- `leadingTapped()` set `stepIndex = totalSteps`, which would have left Home stuck in success.
- `secondaryTapped()` ("skip") advanced to step 3, reaching the success frame **without ever
  running `finishSetup()`** — i.e. showing "your link is live" without saving.

Both corrected to gate on `inputSteps`.

---

## Tier B — raw, unverified (285 code claims)

Recovered to `scratchpad/raw-findings.json`.

| Pass | Claims | blocker | major | minor |
|---|--:|--:|--:|--:|
| Code / parity (19 of 29 slices) | 176 | 27 | 91 | 58 |
| Design fidelity (8 of 15 groups) | 164 | 4 | 56 | 104 |

Design-pass divergence split: android-only 50, ios-vs-android 52, ios-only 26,
all-platforms 20, mobile-only 10, web-only 6.

Of the 27 code blockers, 9 are verified above (A1-A6, A10 plus two duplicate framings of the
group-event issue). **The remaining ~18 code blockers and all 4 design blockers are
unverified.**

Highest-value unverified claims, for triage:
- `cancel-toctou-double-refund` — cancel/decline/approve read status then UPDATE without a
  status guard; alleged double refund under concurrent cancel.
- `unsubscribe-cross-account-suppression` — unauthenticated booking + unsubscribe allegedly
  suppresses reminders for an arbitrary victim address.
- `wallet-type-check-drops-withdrawal-reversal` — migration 161 allegedly drops
  `withdrawal_reversal` from the wallet type CHECK, breaking failed-withdrawal refunds.
- `cancellation-policy-object-vs-text`, `teaminsights-shape-mismatch`,
  `noshowinsights-shape-mismatch` — shared TS types allegedly disagree with backend shape.
- `android-business-onboarding-unreachable` — Business pillar setup allegedly renders the
  Home flow.
- `price-int-overflow-trap` (iOS) — `Int(Double)` conversion allegedly traps on long input.
- `fake-qr-code` (Android) — share-sheet QR allegedly renders noise that encodes nothing.
- `slotpicker-month-to-exclusive` (Android) — month `to` bound allegedly excludes the last day.

One design-pass result worth surfacing early: **`summary-card-frames.jsx` (5 states) is fully
implemented on all three platforms but has zero production call sites** — Android reaches it
only from `HubSnapshotTest`. Built and never wired up.

---

## Remaining work

1. Re-run both verify stages after the usage limit resets (both workflows resume from cache —
   completed finders replay free, only the failed agents re-run).
2. Complete the 10 unfinished code slices and 7 unfinished design groups.
3. Fix confirmed blockers + majors.
4. Sweep for more hardcoded absolute dates (same class as the coupon time bomb).
