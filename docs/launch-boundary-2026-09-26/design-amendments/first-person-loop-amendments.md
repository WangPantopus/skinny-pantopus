# First-person loop: amendments, September 26

**Amends:** [`docs/first-person-loop-design-2026-09-16.md`](../../first-person-loop-design-2026-09-16.md). Sections not mentioned here stand.
**Order and scope:** [launch order](../next-steps/launch-order-and-journeys.md). **Index:** [README](../README.md).
**Checked at:** `origin/master` `7bdef3e8c`, 2026-09-27T04:11Z. Nothing here is built.

## A1. Four kinds of dates (applies to F4, F5 and every calendar surface)

Every calendar entry shows where its date came from, and the four kinds never share one look.

| Kind | Source today | Shown as |
|---|---|---|
| Official | `AddressCalendarRule` with `confidence = 'official'` plus `source` / `source_url` | "Official · {source}" |
| Public source, unconfirmed | `confidence = 'unverified'`, e.g. city pickup defaults and the statewide property-tax seeds | "Unconfirmed · {source} · Confirm". Pushes keep the September 16 caveat. |
| Suggested | A suggestion card (A2) or a seasonal-engine window | "Suggested · why this applies". Not on the calendar until accepted. |
| Yours | Owner-entered dates and accepted suggestions | "You" |

## A2. F5 becomes "fact to action"

The September 16 F5 covers dates the user types. It does not take a discovered fact to a tracked action. Amended scope for the pilot:

**Flow.** Fact → suggestion card showing why it applies and its source → applicability question → date → save → reminder → done, already handled or dismissed. Saving an address never accepts a suggestion.

**Catalog.** One static entry for the pilot, `radon_test`: copy, source link, applicability question and default lead time. No suggestion engine.

**Storage, no new tables:**
- **Home (claimed or private setup):** an accepted action becomes a `HomeTask` with a due date. Private-setup homes already keep "My tasks" (H08), and `pantopus-seeder/src/handlers/home_reminders.py` `_process_tasks_due` already reminds on the due day. Verify both for private-setup homes before relying on them.
- **Saved place (T1):** an accepted action becomes an `AddressCalendarRule` with scope `saved_place` and a new kind `radon_test`, added in the same F5 migration that extends the kind list. Kind `other` would collide with F5's one-row-per-kind index. This also needs F5's reminder pass in `home_reminders.py`.
- **Dismissed or already handled** (plus any optional date or result): `HomePreference.settings.suggestions.{id}` for homes (the column exists, `20260911010000`). For saved places, use the `UserNotificationPreferences.settings` jsonb column that the F5 migration already adds for F11.

**Signup.** The web entry-continuity draft ([entry continuity](../../entry-continuity-implementation-2026-09-06.md): device-local, 24-hour expiry, only an identifier in auth URLs) gains the chosen suggestion id, so "Add this reminder" survives signup, email verification and login. That increment covered web only; check the native preview-to-signup path before promising it there.

**Acceptance:**
- A web visitor taps "Add this reminder" on the radon card, signs up, and finds the reminder saved, dated and marked "You".
- An owner with a home gets a Home task that an invited member can see and complete.
- "Already handled" and "Not now" persist across devices and do not reappear until reopened from Place.
- Nothing is saved without an explicit tap.

## A3. Radon copy (shipped)

In `lead_radon` in `backend/services/placePreviewService.js`:

| Line | Current text | Change |
|---|---|---|
| Headline, zone 1 (`:309`) | "This county is in the EPA's highest radon band" | Keep |
| Detail, zone 1 (`:310`) | "Zone 1 means the predicted average indoor level is above the EPA action level. Only a test tells you about this home." | Keep |
| Follow-up, both branches (`:311`, `:320`) | "Claim it and we'll remind you when a test kit is due." | Remove. The seeder, calendar service, AI services, routes and jobs contain no radon reminder, and the line asks for a claim before offering anything. |

- **Interim, in launch-order step 1:** "The EPA recommends testing every home, whatever the zone." with a link to the [EPA page](https://www.epa.gov/radon/epa-map-radon-zones-0).
- **With J2:** the follow-up becomes the J2 entry, "Was it tested during your inspection? Add a radon test to your list.", with the "Add this reminder" action.

**Rules:**
- Never state or imply this home's radon level from the county zone.
- Don't prescribe a season; the EPA zone page gives none.
- The January radon headline (F8) is cut along with F8.

**Where the line appears:** web `frontend/apps/web/src/components/place/StartFunnel.tsx:416` (`followUp={aha.follow_up}`), iOS `PlacePreviewBody.swift`, Android `PlaceLaunchScreen.kt`. Two client decoding tests use the old string as a static fixture (`PlaceMoneyLeadDecodingTests.swift:90,103` and `PlaceWedgeDecodingTest.kt:49`). They test decoding, not server copy, so they need no change.

## A4. F12 appeal windows: computed from the owner's notice

**Correction.** F12 planned county rows with one "appeal window closes" date. That is wrong for Washington. The Clark County Board of Equalization states the deadline as "July 1 of the assessment year or within 60 CALENDAR DAYS of when your Notice of Value was mailed," and late appeals cannot be accepted under RCW 84.40.038 ([Clark County](https://clark.wa.gov/internal-services/board-equalization)).

**Amended design:**
- Store the rule, not a date: the state rule, the county's day count and the source.
- Ask the owner for the mailing date printed on their Notice of Value.
- Compute the deadline as the later of July 1 and the mailing date plus 60 days. Confirm "whichever is later" against RCW 84.40.038 before shipping.
- Show "Computed from your notice date · {source}", with reminders at the lead time, the day before and the day itself.
- Check each state's rule before seeding any other state.
- Drop the F8 headline "Assessment appeal window closes {date}".

**Timing:** phase 2, after the pilot.

## A5. F4: reminders people can act on, and holiday moves

**Notification buttons.** Neither app registers any today: no `UNNotificationCategory` or `UNNotificationAction` on iOS, and no notification actions on Android. Add:

| Reminder | Buttons |
|---|---|
| Pickup | "Bins out" |
| Task (including J2) | "Done", "Not now" |

A button posts a `reminder_action` event. "Done" also completes the task through the existing task status. "Bins out" changes no stored state, so the next occurrence is untouched.

**Holiday moves.** The calendar code has no holiday or exception handling. `AddressCalendarRule` has `rrule`, `dtstart` and `until` but no exceptions column. Inspect the rrule service first:
- If it parses RRULE sets, express each holiday move as an EXDATE/RDATE pair in the existing `rrule`.
- Otherwise, add exceptions to `AddressCalendarRule` in a forward migration. No new table.

For the pilot, confirm each pilot provider's holiday rule by hand before November 26, December 25 and January 1, and mark each rule Official or Unconfirmed under A1.

**Unchanged from F4:** the night-before pickup signal, the quiet-day gate and the unconfirmed caveat. At `7bdef3e8c` the evening briefing still does not use the address calendar.

## A6. F2, reduced

The pilot uses one prompt instead of the reordered checklist. After the first save, show this place's one relevant suggestion (J2) and "Set your pickup day" (J1).

## A7. F3: the smallest household journey

- **No home permission migration has landed since September 16.** At that point an invited `member` had `home.view`, `tasks.view` and `tasks.edit`. So the smallest journey runs on tasks: invite → the accepted action as a Home task → the partner sees and completes it.
- **Completion notification:** `task_assigned` is emitted today. `notifyTaskCompleted` exists (`backend/services/notificationService.js:532`) but nothing calls it; wire it as F3 specified.
- **Pickup and bills for members** need F3's permission-defaults migration. That is a founder decision: it changes existing members' effective permissions, and pending invites must be reissued.
- **F3b is deferred for the pilot; decision 8 stands.** Until F3b ships, accepting an invite still sets `verification_status = 'verified'` (September 16 finding), so invited members also pass the attested-resident gate. Revisit before any attested surface is promoted.

## A8. Measurement (amends §5)

- Week-four and week-eight retention means handling at least one responsibility, not opening the app.
- Reminder funnel: sent → acted → completed → reported helpful.
- Add new `FunnelEvent` types in one forward migration mirroring `196_funnel_event_aha_share.sql`; the CHECK allows six types today. The new types:
  - `session_open`, with its trigger (planned in F8)
  - `reminder_action`
  - `suggestion_decision`
- Record per household: observation time, due-date opportunities, founder support minutes and data-upkeep minutes.

## A9. Deferred sections

These are out of the pilot:
- F6: the voter step and just-moved ticks
- F7, F8, F10 and F11
- F12, as amended in A4
- F9's growth rows

See the launch order's cut list.
