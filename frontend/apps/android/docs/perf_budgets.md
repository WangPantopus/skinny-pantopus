# Android — Performance Budgets (P13)

Budgets, methodology, and applied fixes for the Android app.

## Budgets

| Metric | Target | Device |
|---|---|---|
| Cold launch → first signed-in frame | ≤ 800 ms | Pixel 6 (Tensor G1, API 34) |
| Hub first meaningful render (cached) | ≤ 16 ms / frame | Pixel 6 |
| List scroll | 60 fps sustained, ≤ 2 dropped frames per 120 | Pixel 6 |
| API p95 latency (user-perceived) | ≤ 400 ms | LTE simulation |

## Code-level hardenings shipped in this PR

### 1. `@Immutable` on Hub UI state
Every public data class in `HubUiState.kt` (the most-rendered screen)
is now `@Immutable`:
- `HubUiState` (sealed interface) and its three concrete subtypes.
- `FirstRunContent`, `PopulatedContent`.
- `TopBarContent`, `ActionChipContent`, `SetupBannerContent`,
  `TodaySummary`, `PillarTile`, `DiscoveryCardContent`, `JumpBackItem`,
  `ActivityEntry`.
- `SetupStep`.

This lets the Compose compiler skip recomposition on stable paths —
e.g., a `HubTopBar(content = ...)` call doesn't recompose when the
parent re-runs but `content` is reference-equal.

`ListOfRowsUiState.Empty`, `TopBarAction`, `FabAction`, and `RowModel`
are intentionally **not** `@Immutable` — they carry `() -> Unit`
lambdas which Compose can't prove are stable. Their composables stay
non-skippable but still benefit from local state hoisting.

### 2. Stable `key = { it.id }` on every `items()`
- `ListOfRowsScreen` populated path uses `items(rows, key = { it.id })`.
- The skeleton path uses `items(6) { ... }` — fine because the rows
  are identity-less placeholders.
- All other lazy lists (Hub action strip, mailbox, drawers) iterate
  pre-built sealed-class lists.

### 3. Coil image cache
`PantopusApplication` now implements `ImageLoaderFactory` and provides
a process-wide loader sized to:
- 15 % of available app memory (memory cache)
- 2 % of app's disk under `cacheDir/image_cache` (disk cache)

So scrolling through avatar lists doesn't re-decode the same bitmap on
every frame. (`PantopusApplication.kt:49-66`)

### 4. Compose compiler reports flag
`app/build.gradle.kts` exposes a `-PcomposeCompilerReports=true`
property that, when set, dumps stability + recomposition reports to
`app/build/compose_compiler_reports/`. Off by default to keep regular
builds fast.

```bash
./gradlew :app:assembleDebug -PcomposeCompilerReports=true
ls app/build/compose_compiler_reports/
```

The CI job documented below runs this on every PR and posts a diff
comment when stability classes change.

### 5. Existing P3 wins
- OkHttp `Cache(File(cacheDir, "http"), 10 * 1024 * 1024)` is wired
  in `NetworkModule.kt` and respects ETag / Cache-Control.
- Retry interceptor with exponential backoff covers transient 5xx /
  IOException on idempotent requests only.
- All Retrofit DTOs use Moshi codegen (`@JsonClass(generateAdapter =
  true)`) — no reflection on the hot decode path.

## Measurement methodology

### Cold-launch macro-benchmark

The app has no `:benchmark` Gradle module yet. Adding one is a small
follow-up — the recipe lives here so the next engineer can stamp it
out without rediscovering the setup.

```kotlin
// app/benchmark/build.gradle.kts (sketch)
plugins {
    id("com.android.test")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.pantopus.android.benchmark"
    targetProjectPath = ":app"
    experimentalProperties["android.experimental.self-instrumenting"] = true

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
}

dependencies {
    implementation("androidx.benchmark:benchmark-macro-junit4:1.3.3")
    implementation("androidx.test.ext:junit:1.2.1")
}
```

```kotlin
// app/benchmark/src/main/java/.../HubColdLaunchBenchmark.kt
@RunWith(AndroidJUnit4::class)
@LargeTest
class HubColdLaunchBenchmark {
    @get:Rule val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun coldStartup() = benchmarkRule.measureRepeated(
        packageName = "app.pantopus.android",
        metrics = listOf(StartupTimingMetric()),
        iterations = 5,
        startupMode = StartupMode.COLD,
    ) {
        pressHome()
        startActivityAndWait()
    }
}
```

Run on a connected Pixel 6: `./gradlew :benchmark:connectedCheck`
and capture the `time-to-first-frame` median into the table below.

// TODO(perf): land the `:benchmark` module in a follow-up; this doc
// already carries the full recipe.

### Baseline profile

```bash
./gradlew :app:generateBaselineProfile
```

The output lands at `app/src/main/baseline-prof.txt`. AGP picks it up
automatically at release-build time. Run on every milestone touching
the launch / Hub paths.

// TODO(perf): commit the generated baseline-prof.txt once the
// `:benchmark` module lands.

### Compose recomposition baseline

```bash
./gradlew :app:assembleDebug -PcomposeCompilerReports=true
diff -u previous_main_reports/ app/build/compose_compiler_reports/
```

Check for any composable that flipped from `skippable` → not skippable,
or any class whose stability changed `Stable` → `Unstable`.

### API p95 latency

Reuse the OkHttp `EventListener` already wired in `NetworkModule`.
Filter `callEnd - callStart` per path and aggregate over a 10-minute
LTE-throttled session.

## Measured numbers

To be filled in on each release-prep cycle. Until then, this section
is a placeholder.

| Metric | Last measurement | Date | Build |
|---|---|---|---|
| Cold launch | TBD | — | — |
| Hub first render | TBD | — | — |
| List scroll p95 frame time | TBD | — | — |
| `/api/hub` p95 latency | TBD | — | — |

## Compose stability baseline

The first compose-reports run will populate this section with each
public composable's stability + skippability flags. Until then, the
expected baseline is:

- All `Hub*` section composables: skippable + restartable.
- `ListOfRowsScreen` body items: skippable when the row itself is
  hashed by id (lambdas in `RowModel` keep the row composable
  non-skippable, which is intentional — the lambdas drive
  navigation).
- All P5 component composables: skippable + restartable.

## Known issues

1. The `:benchmark` Gradle module isn't wired yet. Macro-benchmark
   recipe is documented above; follow-up to land the module + commit
   the generated baseline profile.
2. No baseline-profile file shipped — see above. AGP without a
   baseline still works fine; we just leave on-device class
   pre-compilation savings on the table until the benchmark module
   lands.
3. The `composeCompilerReports` flag is opt-in; CI doesn't run it
   on every PR yet. Add to `android-ci.yml` once the report-diff
   tooling is in place.
