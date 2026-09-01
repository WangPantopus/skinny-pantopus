# Calendarly branch audit — FINAL report

Branch: `feature/calendarly` vs `master` · 141 commits, ~1,374 files, ~289k insertions.
Audit + remediation window: 2026-08-06 → 2026-08-12.
Supersedes the interim `BRANCH-AUDIT-2026-08.md` (kept for its Tier-A/Tier-B history).
Machine-readable record: `audit-2026-08/v1..v6 *-verdicts.json` · live log: `audit-2026-08/SESSION-STATE.md`.

---

## 1. What this audit was

The branch builds Calendarly — a Calendly-class scheduling product — across backend, iOS,
Android and web, against a designer-supplied frame set (`docs/design/calendarly/frames/*.jsx`,
169 HTML frames + 91 screenshots). The brief: make every feature, behaviour and screen match
the design and work correctly on both mobile platforms; unit-test volume explicitly *not* a goal.

Two earlier audit passes had produced ~285 raw claims but their adversarial-verification stages
died mid-run, so nothing was trustworthy. This effort re-verified everything against real source
and then fixed what survived.

**Verification outcome (179 verdicts):**

| Verdict | Count |
|---|--:|
| CONFIRMED (real defect) | 122 |
| ALREADY-FIXED in tree | 26 |
| REFUTED (claim was wrong) | 5 |
| Parity findings (home/automations sweeps) | 31 |

Of the confirmed set: **13 blockers**, 67 majors, the rest minors. The ~82% refutation rate the
earlier passes warned about did *not* hold up — most claims were real, which is why this took a
full remediation cycle rather than a triage pass.

---

## 2. The blockers (all fixed)

**Data-loss / correctness**
1. **Group events could never sell a second seat.** The availability engine counted a group
   booking as making the host busy, so seat 1 removed the slot for everyone — a `seat_cap` of 10
   sold 1. *Fixed:* group seats are counted per instant, not treated as host-busy.
2. **Group events with `seat_cap = 1` had no atomic guard at all.** The exclusion constraint
   skipped them (`enforce_exclusive = false`) and the cap trigger also skipped them (`cap <= 1`,
   commented as "covered by the constraint" — it wasn't). Two concurrent bookings both won.
   *Fixed:* `enforce_exclusive` is now derived from the real seat cap.
3. **Non-default durations were unbookable.** `durations[]` is a real feature, but slots were
   always generated at `default_duration`, so any other choice 409'd forever — and every
   reschedule of an off-default booking failed. *Fixed:* the requested duration threads through.
4. **Double refunds under concurrent cancel.** cancel/decline/approve/no-show read the status,
   then refunded, then wrote — a classic read-then-act race. *Fixed:* a guarded status CAS
   (`transitionBooking`) is now the single serialization point; only the winner runs side effects.
5. **Restoring an archived package wiped its price; pausing a workflow zeroed its trigger offset.**
   The `PUT` routes validated partial bodies against *create* schemas, whose `.default()`s
   silently re-injected zeros. *Fixed:* defaults-free patch schemas for package/workflow/template.
6. **Collective bookings never reserved the co-hosts' time.** Both overlap guards key on
   `host_user_id` and neither can see attendee rows, so every co-host stayed bookable elsewhere.
   *Fixed:* sibling reservation rows (`cohost_of_booking_id`) with full lifecycle sync, excluded
   from caps/lists/metrics.

**Security / privacy**
7. **Public slug lookups were LIKE-injectable.** Raw path params went into `.ilike()`, where `%`
   and `_` are wildcards — `GET /book/acme/v%25` reached a `visibility:'secret'` event type, and
   prefix probing enumerated pages. *Fixed:* charset guard + the missing visibility filter.
8. **Reassign wrote an arbitrary user id as host** with no membership check. *Fixed:* eligibility
   set enforced.
9. **Unsubscribe suppressed reminders platform-wide for any address.** Anyone could book with a
   victim's email and mute their reminders everywhere. *Fixed:* suppression is owner-scoped.
10. **Poll votes could be overwritten by anyone** who typed a known email. *Fixed:* insert-only
    for unverified identities; voter names dropped from the public payload.

**Money / platform**
11. **A wallet migration dropped `withdrawal_reversal`** from the type CHECK, which would have
    broken every failed-withdrawal refund. *Fixed:* value restored.
12. **EUR-priced events were charged as USD** — currency was host-settable and surfaced in all
    three clients, but never reached Stripe. *Fixed:* threaded end-to-end.
13. **Mobile wrong-owner writes.** Scheduling Settings (and later Notification Preferences,
    manual booking, booking-page management, all five automations screens, event-type list)
    hardcoded the Personal owner, so acting from a Business/Home hub read and mutated the
    *personal* page — including a danger zone that resets the booking link. *Fixed:* owner is
    threaded through nav args everywhere; the dead relay class was deleted.

---

## 3. Notable majors (all fixed)

- **Booking limits were decorative.** `daily_cap` / `per_booker_cap` had columns, Joi validation
  and two client screens — and zero reads. Now enforced in the service, backed by an atomic
  trigger, with capped days removed from the public slot grid.
- **No-show rate was pinned at 100%.** Nothing ever wrote `completed`, so the denominator was
  always just no-shows. Now a sweep completes past bookings.
- **Calendar invites stopped updating.** `SEQUENCE` was computed as a boolean, so the 2nd+
  reschedule re-issued the same revision and clients ignored it. Now a real monotonic counter.
- **Abandoned paid checkouts held slots forever.** A pending priced booking occupies the slot;
  nothing ever released it. Now swept.
- **Custom intake questions never reached invitees** — the public payload omitted them entirely,
  so required questions were silently skipped.
- **Recurring blocks drifted an hour at every DST change** (RRULEs expanded in bare UTC).
  Now expanded in a stored wall-clock zone.
- **DST-day slot grids were misaligned** (elapsed-ms vs wall-clock minutes).
- **Insights were structurally broken on web**: `TeamInsights` / `NoShowInsights` /
  `BookingsSummary` types disagreed with the wire, so those screens rendered permanent empty
  states. Retyped to the real payloads and consumers rewritten.
- **First-run wizards never published the page** — the success screen invited you to share a
  link that 404'd. Now published on all four mobile paths.
- **Wizard "hours" were decorative** — toggled days and the user's timezone were discarded, so
  every schedule stayed on the seeded New-York 9–5.
- **Locale/format defects**: package prices inflated 100× on comma-decimal locales, `hh:mm`
  wire values emitted in localized digits, iOS date keys built without a POSIX locale.
- **A real QR code.** The share sheet drew a random noise grid and told the user to scan it.

## 4. Design fidelity

All 15 screen groups were audited against the frames; 53 verified findings (12 major, 41 minor).
Fixed across this cycle: the summary card that was built on all three platforms but never
rendered, the Android mini-toggle substitution, cross-owner host attribution on agendas, the
event-types **reorder mode** (FRAME 6) — previously unimplemented on *every* platform, now built
on web, Android and iOS with identical accessibility ids — the permission-gated read-only
catalog (web), multi-block date overrides, hub amber palette, wizard success rails, and the
long tail of spacing/icon/copy divergences.

Deliberately left open: the A5 summary card's placement is a design decision (the A1 hub frames
don't draw it, and the hub already has a bespoke stats card) — it is now wired, so this is a
question of taste, not absence.

---

## 5. Validation status

| Gate | Result |
|---|---|
| Backend Jest (full) | **213/213 suites, 3,236 tests green** (+6 vs pre-audit baseline) |
| Web Jest (full) | **43/43 suites, 523 tests green** |
| Web type-check | **0 errors** (was failing before this branch's retypes) |
| Android compile (main + unit-test) | green |
| Android ktlint / detekt | green after auto-format |
| iOS SwiftFormat | 0/1,732 files need formatting |
| iOS SwiftLint / icon gate / raw-hex gate | green (only pre-existing warnings in untouched files) |
| **iOS compile** | **BLOCKED — environment, not code** |

**iOS build blocker.** `xcodebuild -showdestinations` reports *zero* eligible destinations for
the Pantopus scheme; the only entry is the device placeholder with "iOS 26.5 is not installed."
The Xcode 26.6 update left the machine without its downloadable iOS platform component (the SDK
is present; the installed simulator runtimes are 18.5 and 26.0). Named destinations, an explicit
device UDID and `generic/platform=iOS Simulator` all fail identically, so this is not the
Makefile's pinned `iPhone 17` default alone.

To unblock, run either:

```bash
xcodebuild -downloadPlatform iOS
```

…or Xcode → Settings → Components → install the iOS platform. Then:

```bash
cd frontend/apps/ios && make test DESTINATION_SIM="platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0"
```

This branch's iOS target *did* compile earlier in the effort ("** TEST BUILD SUCCEEDED **"), so
there is no known iOS compile breakage — but the iOS changes made after the Xcode update are
verified only at parse/lint level, which I am flagging rather than papering over.

---

## 6. Known-remaining / deliberately deferred

- **Android Paparazzi baselines** need re-recording for the changed scheduling screens
  (`./gradlew paparazziRecord`, arm64-local is CI-compatible per prior verification).
- **Design-polish minors**: a residual set of iOS/Android editor, availability and
  connected-calendar visual minors (spacing, glyph choice, label tokens) is enumerated in
  `SESSION-STATE.md` under "OPEN GAP". None affect behaviour.
- **Backend `paused_until`** is not on the wire, so the notification pause banner shows untimed
  copy on mobile.
- **Poll "your votes"** needs a viewer-scoped server key to highlight own votes safely; the
  client-side name matching was removed rather than left wrong.
- **Home-parity sweep (F9–F15)** covered 22 findings; the tail of that stream was not exhaustively
  re-walked.
- **Test-identifier parity** (iOS 341 vs Android 350 ids, 114 shared) is untouched — deprioritized
  per the explicit "unit tests are not a goal" instruction.
- One theoretical GiST cross-type race (group vs 1:1 for the same host) is noted, not fixed.
