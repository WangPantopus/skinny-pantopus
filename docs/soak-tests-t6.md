# T6 soak tests — protocol & results

60-second scroll + filter + pull-to-refresh interaction loop on every
new T6 list screen, run on all three platforms with their respective
leak-detection diagnostics enabled. Captures heap & DOM-node deltas
between t=0 (just-loaded) and t=60 s.

**Pass criterion** (per screen, per platform):

- Heap delta ≤ 8 MB
- DOM-node (web) / View-instance (mobile) delta ≤ 200
- LeakSanitizer (iOS) / LeakCanary (Android) / DevTools Heap profiler
  (web) reports **no** retained objects or leaked native allocations.

Same gate as `docs/soak-tests-t5.md` — duplicated here so each tier's
soak protocol is self-contained.

## Web (Playwright + Chromium)

Real, runnable harness at
`frontend/apps/web/tests/visual-regression/t6-soak.spec.ts` (mirror of
the T5 soak harness — one test per T6 list screen).

```sh
# From repo root
pnpm -F @pantopus/web install
pnpm -F @pantopus/web exec playwright install chromium

# Boot a seeded dev server in one terminal
pnpm -F @pantopus/web dev

# In another terminal:
PANTOPUS_LIVE_SCREENSHOTS=1 \
  pnpm -F @pantopus/web exec playwright test \
    tests/visual-regression/t6-soak.spec.ts \
    --reporter list
```

The harness:

1. Loads the screen at 400×900 mobile viewport.
2. Repeatedly scrolls down 900px → up 900px (one cycle / ~1 s).
3. Every 5 s, cycles the tab strip / chip filter to the next entry.
4. Every 10 s, scrolls to top and dispatches a synthetic
   `pantopus-pull-to-refresh` CustomEvent (the shell listens for it).
5. Samples `performance.memory.usedJSHeapSize` and the document's
   `*` node count every 500 ms.
6. Writes the samples to `docs/soak-tests-t6/<screen>-web.csv`.
7. Asserts `heapDelta ≤ 8 MB` and `domNodeDelta ≤ 200`.

### T6 screens covered (web)

- Hub refresh
- Me / Profile refresh
- Members (per-home)
- Packages (per-home)
- Owners (per-home)
- Access codes
- Home calendar
- MyHomes refresh
- MyListings
- Mailbox refresh (root list)
- Mailbox A17 generic detail
- Chat conversation refresh
- Nearby map (MapListHybrid)
- Support trains
- (Auth surfaces are form-only; soak protocol does not apply.)

## iOS (XCUITest + LeakSanitizer)

Real, runnable harness at
`frontend/apps/ios/PantopusUITests/SoakTests/T6SoakTests.swift` (mirror
of the T5 soak suite — one test per T6 list screen).

```sh
# Build for testing with LeakSanitizer enabled
cd frontend/apps/ios
xcodebuild test \
  -scheme PantopusUITests \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -enableAddressSanitizer YES \
  -enableUndefinedBehaviorSanitizer YES \
  -only-testing:PantopusUITests/T6SoakTests
```

The harness uses XCUIElementQuery to walk the new T6 screens and
re-uses the T5 `Soak.cycleListInteractions(view: , seconds: 60)`
helper for the interaction loop. LeakSanitizer surfaces leaked native
allocations as test failures; the heap snapshot deltas are written to
`docs/soak-tests-t6/<screen>-ios.csv`.

## Android (Espresso + LeakCanary)

Real, runnable harness at
`frontend/apps/android/app/src/androidTest/java/app/pantopus/android/soak/T6SoakTest.kt`
(mirror of the T5 soak suite — one test per T6 list screen).

```sh
cd frontend/apps/android
./gradlew connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=app.pantopus.android.soak.T6SoakTest
```

LeakCanary watches every `Activity` + `ViewModel` instance the run
creates. The instrumentation test asserts zero retained instances
after the 60-second loop completes. Heap deltas land in
`docs/soak-tests-t6/<screen>-android.csv`.

## Initial results

Pending the first CI lane that has the simulator / emulator + leak
diagnostics available. The remote-execution container at P27 landing
didn't carry iOS / Android toolchain; the harnesses + protocol are
checked in so the next CI run materialises the CSVs.

| Screen | iOS heap Δ | iOS leaks | Android heap Δ | Android leaks | Web heap Δ | Web DOM Δ | Date |
|---|---|---|---|---|---|---|---|
| Hub refresh | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Me / Profile refresh | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Members | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Maintenance | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
| Household tasks | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
| Packages | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Polls | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
| MyHomes refresh | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| MyListings | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| MyBusinesses | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
| Owners | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Access codes | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Emergency info | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
| Documents | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
| Home calendar | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Mailbox refresh | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Mailbox A17 generic | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Vault | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
| Chat conversation refresh | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| New message picker | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
| Nearby map (MapListHybrid) | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Support trains | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Review signups | _pending_ | _pending_ | _pending_ | _pending_ | n/a | n/a | — |
