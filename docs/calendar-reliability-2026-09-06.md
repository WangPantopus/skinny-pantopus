# Household calendar reliability

Follow-up to B07 in the [release journey audit](v1-journey-audit-2026-09-06.md), implemented on `codex/entry-continuity-and-calendar` after entry checkpoint `29bcc3e02`.

## User behavior

Web, iOS, and Android now ask for the weekly garbage collection day and offer three recycling choices: **Not sure yet**, **Every week**, or **Every other week**. A known recycling schedule requires the next actual collection date. Recycling can fall on a different weekday from garbage. Selecting controls does not save; **Save schedule** confirms the change.

The date choices use the home's calendar date returned by the API, with a seven-day window for weekly collection and fourteen days for alternating weeks. A date means collection day, not the evening bins go outside. The controls explain holiday exceptions rather than adjusting dates without provider evidence.

Unknown recycling saves garbage only. Once a household sets its pickup schedule, unspecified pickup kinds no longer inherit city pickup guesses. Other calendar information, such as civic dates, remains available under existing precedence and provenance rules. Clearing the household schedule restores public defaults, which retain their existing unconfirmed labels. Existing stored rules are not rewritten by a migration; residents can review and update them in the editor.

Saved schedules are returned with the calendar so the editor can reopen the current choices. Failed writes retain the old calendar and selected inputs for retry. Web and iOS display the confirmed response immediately; Android refreshes its existing dashboard after a confirmed write. Save/reset actions are protected against duplicate taps.

The calendar no longer promises that reminders will start the night before. Its saved rules still supply the existing briefing signals. Actual push delivery and notification opt-out behavior remain release checks. Existing ATTOM/property, weather, AQI, sunlight, election/civic sections, and Home access rules are preserved.

## API and rollout

`PUT /api/homes/:id/calendar/pickup-day` accepts:

```json
{
  "weekday": "TH",
  "recycling_frequency": "biweekly",
  "recycling_next_date": "2026-09-11"
}
```

`recycling_frequency` is `not_set`, `weekly`, or `biweekly`. The date is omitted for `not_set`. Known schedules require a real date within the appropriate window starting on the home's current day. The date itself determines recycling's weekday and alternating-week anchor. Invalid input returns 400 before writing. A failed permission lookup returns 503 without writing; nonmembers remain forbidden.

Calendar responses add optional `pickup_schedule` metadata. New native clients still decode older calendar responses. Legacy weekday/boolean requests are accepted as garbage-only writes: the old `recycling_every_other_week` boolean cannot establish a known next collection date. This intentionally removes the guessed recycling week on subsequent legacy writes.

**Deploy the backend before the updated clients.** New clients send fields that older route validation does not accept. This change introduces no new database migration, but requires the existing `set_home_pickup_rules` function from backend migration 199 / Supabase migration `20260902000002_address_calendar_pickup_swap.sql`. Its deployed presence remains unverified.

## Validation

- Backend: 31 calendar service, route, signal, and seed tests pass. Coverage includes the actual alternating week, different collection weekdays, reload/replacement/reset, unknown recycling, validation before write, failed writes, unauthorized writes, home isolation, and UTC-midnight/DST boundaries.
- Real PostgreSQL: the existing table and RPC migrations pass checks for service-role-only execution, rollback after an insert constraint failure following deletion, repeat replacement, exact anchor preservation, and isolation of other homes/public rules. The test runs in a disposable local Docker container with no network or published ports; it does not inspect staging.
- Web: 20 tests pass across the new form suite and existing Home detail suite. Targeted ESLint passes. The 390px browser rendering has no horizontal overflow or page JavaScript errors.
- iOS: three calendar encoding/decoding contract tests and one phone-width render check pass. The app and test targets compile; targeted SwiftLint passes. The render attachment is reviewed visually.
- Android: two real emulator interactions cover explicit garbage-only saving and a required recycling date on a different weekday. A phone-width Paparazzi rendering is reviewed visually. Targeted ktlint passes.

The web type gate still reports the same six pre-existing signatures in Nearby map typing and incomplete calendar fixtures in two dev pages and `placeGroupDetail.test.tsx`. The baseline was not relaxed.

Reproducible focused commands:

```sh
# backend
pnpm exec jest --runInBand tests/unit/addressCalendar.test.js tests/unit/addressCalendarSeeds.test.js
bash scripts/test-address-calendar-pickup-local.sh

# frontend/apps/web
pnpm exec jest --runInBand --runTestsByPath tests/addressCalendarCard.test.tsx tests/placeGroupDetail.test.tsx

# frontend/apps/ios
xcodegen generate
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:PantopusTests/AddressCalendarContractTests test

# frontend/apps/android, with a running test emulator
./gradlew --no-configuration-cache :app:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=app.pantopus.android.ui.screens.place.PickupScheduleEditorTest
./gradlew :app:verifyPaparazziDebug --tests app.pantopus.android.ui.screens.place.PickupScheduleSnapshotTest
```

## Remaining release work

Staging verification of the installed RPC, email delivery and OAuth callbacks, real native authentication journeys, and notification delivery/preferences remain open. No staging account was designated for this pass. Pulse/Beacon discovery in sparse neighborhoods is the next product increment in the release audit. No deployment or live account mutation was performed.
