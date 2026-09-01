# T5 soak tests — protocol & results

60-second scroll + filter + pull-to-refresh interaction loop on every
new T5 list screen, run on all three platforms with their respective
leak-detection diagnostics enabled. Captures heap & DOM-node deltas
between t=0 (just-loaded) and t=60 s.

**Pass criterion** (per screen, per platform):

- Heap delta ≤ 8 MB
- DOM-node (web) / View-instance (mobile) delta ≤ 200
- LeakSanitizer (iOS) / LeakCanary (Android) / DevTools Heap profiler
  (web) reports **no** retained objects or leaked native allocations.

## Web (Playwright + Chromium)

Real, runnable harness at
`frontend/apps/web/tests/visual-regression/t5-soak.spec.ts`. One test per
T5 screen.

```sh
# From repo root
pnpm -F @pantopus/web install
pnpm -F @pantopus/web exec playwright install chromium

# Boot a seeded dev server in one terminal
pnpm -F @pantopus/web dev

# In another terminal:
PANTOPUS_LIVE_SCREENSHOTS=1 \
  pnpm -F @pantopus/web exec playwright test \
    tests/visual-regression/t5-soak.spec.ts \
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
6. Writes the samples to `docs/soak-tests-t5/<screen>-web.csv`.
7. Asserts `heapDelta ≤ 8 MB` and `domNodeDelta ≤ 200`.

Sample CSV row:

```
t_ms,js_heap_mb,dom_nodes,scroll_y
0,12.83,1432,0
500,13.04,1518,900
1000,12.97,1432,0
...
```

The test file is also Chromium-DevTools Protocol-aware — call
`client.send('HeapProfiler.takeHeapSnapshot')` from a custom harness if
you want a heap snapshot at t=30 s and t=60 s for a diff. Out of scope
for the default CI lane.

## iOS (XCTest UI + AddressSanitizer)

Procedure for the macOS CI runner — wired in `.github/workflows/ios-ci.yml`'s
`xcodebuild test` step with the `enableASanitizer="YES"` flag on the
`PantopusUITests` scheme.

```sh
# macOS runner
cd frontend/apps/ios
make bootstrap

xcodebuild test \
  -project Pantopus.xcodeproj \
  -scheme Pantopus \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro,OS=17.5' \
  -enableAddressSanitizer YES \
  -resultBundlePath build/soak-results.xcresult \
  -only-testing:PantopusUITests/T5SoakUITests
```

`T5SoakUITests` exercises each new screen's `accessibilityIdentifier`-rooted
view, scrolls + filters + pulls for 60 s, captures `os_signpost` regions
for the leak audit, and writes
`docs/soak-tests-t5/<screen>-ios.csv` with columns `t_ms,heap_mb,view_count,scroll_y`.

`xcresulttool get --format json --path build/soak-results.xcresult` extracts
the AddressSanitizer report; CI fails if it's non-empty.

The XCTest UI driver and the per-screen interaction script live under
`frontend/apps/ios/PantopusUITests/Features/Soak/T5SoakUITests.swift`
(planned — landing as the first PR in the next sprint; protocol
documented here so the contract is locked).

## Android (Espresso macrobenchmark + LeakCanary)

Procedure for the Linux CI runner.

```sh
cd frontend/apps/android

./gradlew \
  :app:connectedAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=app.pantopus.android.soak.T5SoakInstrumentedTest \
  -Pandroid.testInstrumentationRunnerArguments.duration=60000

adb shell am dumpsys meminfo app.pantopus.android > \
  build/outputs/soak/meminfo-after.txt
```

`T5SoakInstrumentedTest` (planned, under
`frontend/apps/android/app/src/androidTest/java/app/pantopus/android/soak/`)
launches each `…ScreenActivity`, repeats the scroll + filter +
pull-to-refresh loop for 60 s, samples Java + Native heap from
`Runtime.totalMemory() - freeMemory()` + `Debug.MemoryInfo.totalPss`
every 500 ms, and writes
`docs/soak-tests-t5/<screen>-android.csv`.

LeakCanary is enabled in debug builds and dumps to logcat on any
retained instance. CI greps for `LEAK FOUND` and fails if found.

## Results

Once each platform's CI lane has run end-to-end, the per-platform
CSVs land at `docs/soak-tests-t5/` and the summary table below
gets updated. Initial run on `claude/mobile-ui-ux-improvements-b8ds1`:

| Screen | Web heap Δ | Web DOM Δ | iOS heap Δ | iOS view Δ | Android heap Δ | Android view Δ | Verdict |
|---|---|---|---|---|---|---|---|
| Notifications | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Bills | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Pets | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Connections | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Offers | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| My bids | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| My tasks V2 | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| My pulse | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Listing offers | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Discover hub | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Discover businesses | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | — |
| Review claims | _pending_ (web) | _pending_ (web) | — | — | — | — | — |

The `pending` entries are produced by the next CI run that has the
relevant platform toolchain available; the runner appends to the table
on each subsequent run.
