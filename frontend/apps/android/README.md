# Pantopus Android

Native Android app for Pantopus, built with Kotlin 2.0, Jetpack Compose, and Material 3.

## Stack

| Layer          | Choice                                                                    |
|----------------|---------------------------------------------------------------------------|
| Language       | Kotlin 2.0 (K2 compiler)                                                  |
| Min / Target   | minSdk 26 (Android 8.0), compileSdk 34, targetSdk 34                      |
| UI             | Jetpack Compose + Material 3                                              |
| Navigation     | Navigation Compose                                                        |
| DI             | Hilt (Dagger 2)                                                           |
| Networking     | Retrofit + OkHttp + Moshi                                                 |
| Async          | Kotlinx Coroutines + Flow                                                 |
| Persistence    | DataStore (Preferences) for tokens                                        |
| Realtime       | [socket.io-client](https://github.com/socketio/socket.io-client-java)     |
| Payments       | [Stripe Android SDK](https://github.com/stripe/stripe-android)            |
| Maps           | Google Maps Compose                                                       |
| Image loading  | Coil                                                                      |
| Logging        | Timber                                                                    |
| Build          | Gradle 8.9 + Kotlin DSL + version catalog (`libs.versions.toml`)          |
| Lint / format  | detekt, ktlint                                                            |
| Testing        | JUnit4, MockK, Turbine, Compose UI Test, Espresso, Paparazzi (snapshots)  |

## Design tokens

All Pantopus design-system tokens live in `app/src/main/java/app/pantopus/android/ui/theme/`:

| File              | Entry point                               |
|-------------------|-------------------------------------------|
| `Color.kt`        | `PantopusColors.primary600`, …            |
| `Spacing.kt`      | `Spacing.s4` (= 16.dp), …                 |
| `Radii.kt`        | `Radii.xl` (= 16.dp), …                   |
| `Shadows.kt`      | `Modifier.pantopusShadow(PantopusElevations.md)` |
| `Typography.kt`   | `PantopusTextStyle.h1`, `PantopusTypography` (Material 3) |
| `Theme.kt`        | `PantopusTheme { … }` — wraps Material 3 + provides `LocalPantopusTokens` |
| `LocalPantopus.kt`| `PantopusTheme.tokens.category.handyman`, `.identity.personal`, … |

Plus `app/src/main/res/values/colors.xml` mirrors every token as an Android
color resource (`@color/pantopus_primary_600`) for status-bar tinting,
drawable XML, and splash screens.

**Call sites MUST use tokens.** PRs that add raw hex (`Color(0xFF…)`), raw
`.dp` literals, or raw `.sp` font sizes to feature code will be rejected.
The CI check `grep -rnE '#[0-9a-fA-F]{6,8}' app/src/main/java/app/pantopus/android/ui/screens`
must return no hits.

**Preview the gallery** in debug builds by tapping the Home screen title five
times — opens `TokenGalleryScreen` showing every token side-by-side.

**Snapshot tests** (Paparazzi) lock in the visual contract. Record new
baselines with `./gradlew paparazziRecord` after intentional changes, then
commit the updated PNGs under `app/src/test/snapshots/`.

## Networking

All HTTP calls go through the per-feature Retrofit interfaces under
[app/src/main/java/app/pantopus/android/data/api/services/](app/src/main/java/app/pantopus/android/data/api/services/):
`AuthApi`, `UsersApi`, `HubApi`, `HomesApi`, `MailboxApi`, `MailboxV2Api`.
UI code never imports `retrofit2.*` directly — inject one of these
interfaces (or a repository around it). The aggregated legacy
`ApiService` is retained only for the existing AuthRepository and
feed screens; new code should depend on the smaller feature APIs.

- **DTOs** live under [data/api/models/](app/src/main/java/app/pantopus/android/data/api/models/)
  grouped by feature. Every class carries a route-file citation on its
  doc comment. Untyped payloads (provider-dependent) use
  [`JsonValue`](app/src/main/java/app/pantopus/android/data/api/models/common/JsonValue.kt).
- **Error taxonomy.**
  [`NetworkError`](app/src/main/java/app/pantopus/android/data/api/net/NetworkResult.kt)
  is a sealed hierarchy: `Unauthorized`, `Forbidden`, `NotFound`,
  `ClientError`, `Server`, `Transport`, `Decoding`, `RetriesExhausted`.
  Wrap calls in
  [`safeApiCall { api.foo() }`](app/src/main/java/app/pantopus/android/data/api/net/SafeApiCall.kt)
  to get a typed
  [`NetworkResult`](app/src/main/java/app/pantopus/android/data/api/net/NetworkResult.kt).
- **Retry.** OkHttp
  [`RetryInterceptor`](app/src/main/java/app/pantopus/android/data/api/net/RetryInterceptor.kt)
  retries idempotent GET / HEAD up to 2 additional times on 502/503/504
  and `IOException`, with 300ms and ~900ms jittered delays.
  Non-idempotent methods are never retried.
- **Cache.** A 10MB on-disk OkHttp `Cache` lives at `cacheDir/pantopus-http/`;
  OkHttp honours `ETag`, `Cache-Control`, and `If-None-Match` automatically.

## Icons

All icons route through the typed
[`PantopusIcon`](app/src/main/java/app/pantopus/android/ui/theme/Icons.kt)
enum and the `PantopusIconImage` composable — never through
`Icons.Filled.*` or `painterResource(R.drawable.ic_lucide_*)` directly.
The rendering layer maps each case to the closest `material-icons-extended`
vector, falling back to hand-authored drawables in
[`res/drawable/ic_lucide_*.xml`](app/src/main/res/drawable/) where Material
has no close match.

The `./gradlew verifyPantopusIcons` task (hooked into `check`) fails if
feature code reaches for a Material icon or an `ic_lucide_*` drawable
directly.


## Layout

```
frontend/apps/android/
├── settings.gradle.kts           # Multi-module declaration, repo config
├── build.gradle.kts              # Top-level plugins, detekt + ktlint
├── gradle.properties             # JVM args, AndroidX flags, Kotlin style
├── gradle/
│   ├── libs.versions.toml        # Version catalog — single source of truth
│   └── wrapper/                  # Gradle wrapper (committed)
├── gradlew, gradlew.bat          # Wrapper launchers
├── config/
│   └── detekt.yml                # Detekt rules
├── .env.example                  # Local env template (copy to .env)
├── app/
│   ├── build.gradle.kts          # App module build script
│   ├── proguard-rules.pro        # R8 keep rules for release builds
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/app/pantopus/android/
│       │   │   ├── PantopusApplication.kt   # Hilt entry
│       │   │   ├── MainActivity.kt          # Single-activity Compose host
│       │   │   ├── ui/                      # Compose screens, theme, nav
│       │   │   ├── data/                    # Retrofit API, auth, realtime
│       │   │   ├── domain/                  # Domain models (add as needed)
│       │   │   └── di/                      # Hilt modules
│       │   └── res/                         # Resources, themes, icons
│       ├── test/                            # Unit tests (JVM)
│       └── androidTest/                     # Instrumented tests (device/emulator)
└── README.md
```

## Prerequisites

- **JDK 17** (Temurin recommended)
- **Android Studio** Hedgehog (2023.1.1) or later
- **Android SDK 34** (installed via Android Studio's SDK Manager)

On macOS:
```bash
brew install --cask temurin@17 android-studio
```

## First-time setup

```bash
cd frontend/apps/android
cp .env.example .env                # Edit with your backend URL + Stripe key
./gradlew --version                 # Downloads Gradle 8.9 wrapper
./gradlew assembleDebug             # First build (~3-5 min on a clean machine)
```

Or open `frontend/apps/android/` in Android Studio and let it sync.

Installing on a **physical phone** — USB debugging, the two host lines in
`.env`, `adb reverse`, and which Gradle tasks to avoid — is covered in
[`docs/device-build-runbook.md`](docs/device-build-runbook.md).

## Common tasks

| Task                              | Command                                                      |
|-----------------------------------|--------------------------------------------------------------|
| Build debug APK                   | `./gradlew assembleDebug`                                    |
| Install on running emulator/device| `./gradlew installDebug`                                     |
| Build release bundle (AAB)        | `./gradlew bundleRelease`                                    |
| Run unit tests                    | `./gradlew test`                                             |
| Run instrumented tests            | `./gradlew connectedAndroidTest`                             |
| Lint (detekt)                     | `./gradlew detekt`                                           |
| Lint (ktlint)                     | `./gradlew ktlintCheck`                                      |
| Format (ktlint)                   | `./gradlew ktlintFormat`                                     |
| Clean                             | `./gradlew clean`                                            |

## Architecture

The app follows a pragmatic 3-layer MVVM split:

- **`ui/`** — Composable screens and Hilt-injected ViewModels. Each screen owns a `UiState` data class exposed via `StateFlow`. ViewModels never import Retrofit or DataStore directly — they go through the data layer.
- **`data/`** — `ApiService` (Retrofit interface), `AuthRepository` (session orchestration), `TokenStorage` (DataStore-backed token persistence), `AuthInterceptor` (OkHttp interceptor that attaches the bearer token and handles 401s), `SocketManager` (Socket.IO wrapper).
- **`di/`** — Hilt modules. Currently just `NetworkModule` wiring Moshi / OkHttp / Retrofit / ApiService. Add module-scoped bindings as the app grows.

### BuildConfig fields

`app/build.gradle.kts` reads `.env` at configure time and injects these into `BuildConfig`:

- `BuildConfig.PANTOPUS_API_BASE_URL`
- `BuildConfig.PANTOPUS_SOCKET_URL`
- `BuildConfig.STRIPE_PUBLISHABLE_KEY`

The Maps API key goes into the manifest via `${MAPS_API_KEY}` placeholder — it never hits BuildConfig because the Maps SDK reads it from `AndroidManifest.xml`.

### Networking to localhost from the emulator

The Android emulator cannot reach `localhost` — that points at the emulator itself. Use `http://10.0.2.2:8000` to hit the host machine. The `.env.example` already sets this. For a physical device on the same LAN, use your Mac's LAN IP. For the default debug config we enable cleartext HTTP (`usesCleartextTraffic="true"` in the manifest) — turn this off for release builds, which should only hit HTTPS anyway.

## Adding a new feature

1. Create `ui/screens/your_feature/` with `YourFeatureScreen.kt` and `YourFeatureViewModel.kt`.
2. Add the Retrofit endpoint to `data/api/ApiService.kt` and any DTOs to `data/api/models/Models.kt`.
3. Add a route to `ui/navigation/PantopusNavHost.kt`.
4. If a new library is needed, add the version to `gradle/libs.versions.toml` under `[versions]`, the library under `[libraries]`, and reference it in `app/build.gradle.kts`.

## Push notifications

FCM is wired in code. The `com.google.gms.google-services` plugin is applied in [`app/build.gradle.kts`](app/build.gradle.kts), and [`PantopusMessagingService`](app/src/main/java/app/pantopus/android/push/PantopusMessagingService.kt) is registered for `com.google.firebase.MESSAGING_EVENT` in the manifest. It handles token rotation (`onNewToken` → `POST /api/notifications/register` with `{token, platform: "android"}`) and incoming payloads (`onMessageReceived` → `NotificationDispatcher`).

The one thing still missing is the real credential. `app/google-services.json` is a committed **placeholder** — stub values that satisfy the Gradle plugin so builds compile, marked with a `_TODO` key at the top of the file. Until it's replaced, FCM will not deliver messages.

To finish the setup, download the real `google-services.json` from the [Firebase console](https://console.firebase.google.com/) (Project Settings → General → "Your apps") and drop it in at `app/google-services.json`, replacing the placeholder. Register **both** application IDs in the Firebase project, or debug builds won't receive pushes:

| Variant | Application ID              |
|---------|-----------------------------|
| Release | `app.pantopus.android`      |
| Debug   | `app.pantopus.android.debug`|

Backend-side, see [`docs/push-native-migration.md`](../../../docs/push-native-migration.md) for the plan to migrate from Expo's push infrastructure to direct FCM + APNs.

## Release signing

Don't commit your keystore. The `signingConfigs { release { … } }` block already exists in [`app/build.gradle.kts`](app/build.gradle.kts) — you only need to supply the credentials:

1. Generate a keystore: `keytool -genkey -v -keystore pantopus.jks -keyalg RSA -keysize 2048 -validity 10000 -alias pantopus`.
2. Put the path + passwords in `frontend/apps/android/.env` (the same file you copied from `.env.example`, which is gitignored and already documents these four keys):
   ```
   PANTOPUS_KEYSTORE_FILE=/absolute/path/to/pantopus.jks
   PANTOPUS_KEYSTORE_PASSWORD=...
   PANTOPUS_KEY_ALIAS=pantopus
   PANTOPUS_KEY_PASSWORD=...
   ```
   Real environment variables work too — the build's `envOr` helper reads `.env` first, then `System.getenv`. It does **not** read `~/.gradle/gradle.properties`; values placed there are silently ignored.
3. `./gradlew bundleRelease` produces a signed AAB.

> **Check your release build is actually signed.** The `release` signing config is only created when `PANTOPUS_KEYSTORE_FILE` is set *and* the file exists at that path. Otherwise the release build silently falls back to the **debug** keystore (`signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")`) so smoke-test builds still work. A typo'd path produces an artifact that looks fine but is debug-signed and will be rejected by the Play Store. Verify with:
>
> ```bash
> keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab
> ```

For automated Play Store uploads, add the [Gradle Play Publisher](https://github.com/Triple-T/gradle-play-publisher) plugin and a service account JSON (also not committed).

## Troubleshooting

| Symptom                                            | Fix                                                                   |
|----------------------------------------------------|-----------------------------------------------------------------------|
| `SDK location not found`                           | Create `local.properties` with `sdk.dir=/absolute/path/to/Android/sdk`|
| `Unable to load class 'io.socket.client.IO'`       | Confirm JitPack is in `settings.gradle.kts` (it is)                   |
| Emulator can't reach backend at `localhost:8000`   | Use `http://10.0.2.2:8000` in `.env`                                  |
| `Cleartext HTTP ... not permitted`                 | Keep `usesCleartextTraffic="true"` for debug, hit HTTPS in release    |
| First build is very slow                           | Expected — BOM + Kotlin + KSP first-time compile. Second build ~30s.  |

## CI

PRs touching `frontend/apps/android/**` trigger
[`.github/workflows/android-ci.yml`](../../../.github/workflows/android-ci.yml):

1. **Quality** (Ubuntu) — ktlint, detekt, Android Lint, the raw-hex
   grep guard, JVM `test` (incl. Paparazzi snapshot tests via
   `paparazziVerify`), and a Debug APK build. Uploads the test
   reports, Paparazzi diffs (when failed), detekt report, and the
   Debug APK as artifacts.
2. **Instrumented** (Ubuntu + KVM emulator) — `connectedDebugAndroidTest`
   on a Pixel 6 image (API 34). Runs only on PRs and manual dispatch.

A separate
[`.github/workflows/android-benchmark.yml`](../../../.github/workflows/android-benchmark.yml)
runs **nightly at 09:00 UTC** and exercises the macrobenchmark suite
once the `:benchmark` Gradle module lands (recipe in
[`docs/perf_budgets.md`](docs/perf_budgets.md)). Until then it logs a
"skipped" diagnostic so the schedule keeps the slot warm.

Local equivalents: `./gradlew ktlintCheck detekt test paparazziVerify
:app:assembleDebug` and `./gradlew :app:connectedDebugAndroidTest`.

### Recording new Paparazzi baselines

When a deliberate visual change lands, regenerate baselines:

```bash
./gradlew paparazziRecord
git add app/src/test/snapshots
```

The CI's `paparazziVerify` step will fail any uncommitted snapshot
divergence — so a deliberately-broken colour change in a screen
trips the build until baselines are updated.
