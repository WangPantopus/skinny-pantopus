# Building Pantopus on a physical Android phone

How to get a Debug build onto real hardware talking to a backend running on
your Mac. The [README](../README.md) covers the emulator basics; this covers
the parts that are different — and easier to get subtly wrong — on a device.

If you have done the [iOS equivalent](../../ios/docs/device-build-runbook.md):
**none of that applies here.** There is no team ID, no App ID registration, no
provisioning profile, no device enrolment, no "trust this developer", and no
paid developer account. Gradle auto-signs debug builds with
`~/.android/debug.keystore`, which the SDK creates for you. The Android
difficulties are elsewhere.

---

## Two commands that will scare you

**`./gradlew build` and `./gradlew check` fail on master.** `check` depends on
`verifyPantopusTokens` (`app/build.gradle.kts:536`) and `verifyPantopusIcons`
(`:382`); the token gate currently fails with a large batch of design-token
violations in feature code. It is pre-existing repo debt, not something you
broke — and `build` pulls `check` in.

**The install path is `assembleDebug` / `installDebug` only.** `build`,
`check`, `make lint`, and `make test` are *not* prerequisites for running the
app.

**`make validate-env` gives false confidence.** It only checks that
`PANTOPUS_API_BASE_URL` and `STRIPE_PUBLISHABLE_KEY` are non-empty. It will
happily bless a `.env` whose socket URL still points somewhere else — see the
next section.

---

## The two-line trap

`.env` holds the backend host **twice**:

```
PANTOPUS_API_BASE_URL=http://10.0.2.2:8000   # REST
PANTOPUS_SOCKET_URL=http://10.0.2.2:8000     # Socket.IO realtime
```

Change only the first and the app *looks* fine — screens load, sign-in works —
but `SocketManager` still dials the old host, so **realtime chat and live
updates die silently** with nothing on screen to say so.

The tell is in logcat: an unreachable socket URL logs `Socket connect error`
every two seconds, forever (`setReconnectionAttempts(Integer.MAX_VALUE)` in
`data/realtime/SocketManager.kt`). Always change both.

---

## 1. Pick your JDK

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17) && java -version
```

CI pins Temurin 17 (`.github/workflows/android-ci.yml`), and AGP 8.5.2 is not
certified on JDK 21. **JDK 21 does build this project successfully** — verified
— so this is about matching CI, not fixing a break.

There is no Gradle toolchain pin in the build files, so the JVM is selected in
this order: `org.gradle.java.home` (not set) → `JAVA_HOME` → `java` on PATH.
Whatever your shell default is will leak through unless you export.

The configuration cache is keyed on the daemon JVM, so switching JDKs spawns a
second Gradle daemon and discards the cache. With `-Xmx6144m` for Gradle and
`-Xmx8192m` for Kotlin (`gradle.properties`), two live daemon pairs reserve a
lot of heap. Run `./gradlew --stop` after switching.

**Android Studio undoes this.** Studio bundles its own JBR 21, and with no
toolchain pin and no committed `.idea/`, a fresh import defaults to it — giving
you 17 in the terminal and 21 in the IDE. Set it at *Settings → Build,
Execution, Deployment → Build Tools → Gradle → Gradle JDK*. Also **open
`frontend/apps/android/`, not the monorepo root** — there is no Gradle build
file at the repo root.

## 2. Put the phone into developer mode

The phone must run **Android 8.0 (API 26) or newer** (`minSdk = 26`).

1. **Settings → About phone → tap "Build number" seven times.** The path varies
   by manufacturer: Samsung buries it under *Software information*; Xiaomi uses
   *MIUI version*.
2. **Settings → System → Developer options → USB debugging** on.
3. Connect with a cable that carries **data**, not just power.
4. Unlock the phone and accept the **"Allow USB debugging?"** prompt.

Wireless (Android 11+) works too. The common mistake is collapsing two
different ports into one:

```bash
adb pair 192.168.0.50:37123    # port + 6-digit code from the PAIRING dialog
adb connect 192.168.0.50:41234 # port from the MAIN wireless-debugging screen
```

## 3. Confirm adb sees it — before building

```bash
adb devices -l
```

You want a line ending in `device`. `unauthorized` means the RSA prompt was not
accepted (revoke USB debugging authorisations and replug if it never appears).

**Do this first.** `installDebug` does *not* fail fast — with nothing attached
Gradle runs the entire build and only then errors with
`DeviceException: No connected devices!`, costing you the full build time. The
APK is still produced, so you can `adb install -r` it afterwards.

With **both** a phone and an emulator attached, `installDebug` installs to
both. Target one with `ANDROID_SERIAL` — there is no Gradle flag:

```bash
ANDROID_SERIAL=<serial> ./gradlew installDebug
```

An `unauthorized` or `offline` device is silently *skipped* while the build
still reports `BUILD SUCCESSFUL`, which reads exactly like a successful
install.

## 4. Wire the app to your Mac

Two options. The first is better and is not mentioned anywhere else in the
repo.

### Recommended: port-forward over adb

Leave `.env` pointing at `localhost` and let adb tunnel the phone's
`localhost:8000` back to the Mac:

```
PANTOPUS_API_BASE_URL=http://localhost:8000
PANTOPUS_SOCKET_URL=http://localhost:8000
```

```bash
adb reverse tcp:8000 tcp:8000
```

**Why:** the host is baked into `BuildConfig` at Gradle *configuration* time,
so the LAN-IP approach costs a full reconfigure, rebuild, and reinstall every
time DHCP moves your Mac. With `adb reverse` the URL never changes. It works
identically on a phone and the emulator, over USB and over wireless debugging.

**Cost:** the mapping dies on unplug, reboot, or `adb kill-server` — re-run the
one-liner, no rebuild needed. The phone cannot reach the backend while
untethered from adb.

### Alternative: your Mac's LAN IP

Use this if the phone needs to work without adb attached. Rewrite **both**
lines at once:

```bash
sed -i '' "s|http://10\.0\.2\.2:8000|http://$(ipconfig getifaddr en0):8000|g" .env && grep '^PANTOPUS' .env
```

Phone and Mac must be on the same non-guest Wi-Fi; client isolation breaks it.

Either way, no regeneration step is needed. **Gradle tracks `.env` as a
configuration-cache input** — verified: editing it prints *"configuration cache
cannot be reused because file '.env' has changed"* and regenerates
`BuildConfig`. Do **not** pass `--no-configuration-cache` or run `clean` after
an `.env` edit.

`android:usesCleartextTraffic="true"` is already in the manifest, so plain HTTP
to a private address needs no extra network-security config — and unlike iOS
there is no runtime local-network permission prompt.

## 5. Build and install

```bash
./gradlew installDebug
```

Compiles, runs KSP/Hilt, dexes, packages, signs with the debug keystore, and
pushes to the device. A cold build on an Apple Silicon Mac is around **6
minutes**; warm rebuilds are **1–2.5 minutes**. The module is ~1,600 Kotlin
files in a single Gradle module built serially (`org.gradle.parallel=false`),
so the README's "second build ~30s" is optimistic.

Each install pushes **~92 MB** — the debug APK carries all four ABIs, so most
of that payload is code a physical phone will never run.

Every build prints a **"compileSdk 35 … tested up to compileSdk 34"** warning.
It is deliberate (`compileSdk` was raised for an `androidx.core` requirement
while `targetSdk` stays at 34) and is never the cause of a failure.

## 6. Start the backend

From the repo root, in a terminal you leave running:

```bash
pnpm dev:backend
```

Binds `0.0.0.0:8000` — LAN-reachable — and points at the hosted dev Supabase,
so no local Docker stack is needed.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/health
```

Any HTTP status proves it is listening. `/health` also queries Supabase, so a
`503` means "backend up, database unhappy", not "not running". On the LAN-IP
route, load the same URL in the **phone's browser** too — that separates
"backend down" from "network won't route".

## 7. Launch it and read the logs

```bash
adb shell monkey -p app.pantopus.android.debug -c android.intent.category.LAUNCHER 1
```

Or explicitly. Note the package carries a `.debug` suffix but the activity
class does **not** — the dotted shorthand `…debug/.MainActivity` will not
resolve:

```bash
adb shell am start -n app.pantopus.android.debug/app.pantopus.android.MainActivity
```

There is no app-wide log tag (Timber tags each line with the calling class), so
filter by **process**:

```bash
adb logcat --pid=$(adb shell pidof -s app.pantopus.android.debug)
```

> **Debug logcat contains live credentials.** `di/NetworkModule.kt` sets
> `HttpLoggingInterceptor.Level.BODY` for debug builds, and the logging
> interceptor runs *after* the auth interceptor with no `redactHeader` call.
> Every debug log carries bearer tokens and complete request/response bodies.
> Redact before attaching one to a ticket or PR.

## 8. Sign in

Use a hosted-dev test account (credentials are not committed — ask the team).
On first launch the notification permission dialog fires immediately, before
sign-in and with no explanation; that is expected. Other permissions are
requested lazily at their features.

Request logs appearing in the `pnpm dev:backend` terminal as you tap is the
proof the device is reaching your Mac.

---

## Reading the signals

| Signal | What it means |
|---|---|
| `Can't reach Pantopus. Check your connection.` | Sign-in cannot reach the host. **Takes ~45s to appear** — a 15s connect timeout plus two retries — so it reads as a hang, not a failure. Wait it out. |
| `Socket connect error` every 2s in logcat | The two-line trap: API URL changed, socket URL not. Never surfaces in the UI. |
| Requests in the backend terminal | The positive signal. OkHttp also prints full URLs in logcat. |
| *(nothing in Settings)* | **There is no in-app display of which backend the APK points at.** The About screen shows only the version string. Logcat or a rebuild are the only ways to confirm. |

---

## What will not work on a dev build

Missing credentials, not bugs:

- **Maps are blank.** `MAPS_API_KEY` is empty by default. Six screens use the
  Google Maps composable (Explore, Nearby, Tasks map, Feed map section,
  content/gig detail location, Property Details). No crash.
- **Payments fail.** The default `STRIPE_PUBLISHABLE_KEY` is a placeholder.
- **Push never arrives.** `app/google-services.json` is a committed
  placeholder. The FCM code *is* fully wired — service, token rotation,
  dispatcher — so swapping in the real Firebase file is the whole fix. (The
  README's claim that FCM "is not included in this scaffold yet" is stale.)
- **`https://pantopus.com` links will not open the app.** App Links
  verification needs `assetlinks.json` for the debug signing fingerprint. The
  custom scheme still works:
  `adb shell am start -a android.intent.action.VIEW -d "pantopus://gigs/<id>" app.pantopus.android.debug`
- **Screenshots come out black on some screens.** `FLAG_SECURE` is set on
  Wallet, Payments, the mail Vault, and Access Codes — and across the whole app
  when the signed-in user has app lock enabled.
- **The debug app looks identical to a production install** — same name, same
  icon, only the package id differs. Tell them apart via the About screen
  (`-debug` version suffix) or `adb shell pm list packages | grep pantopus`.

Note also that setting `PANTOPUS_ENV` explicitly in `.env` overrides **both**
the debug and release defaults. Setting it to `production` locally turns off
paid scheduling surfaces, which reads as a broken install.

---

## Emulator instead of a phone

Skip steps 2 and 3 entirely. `adb reverse` works on the emulator too, so step 4
is unchanged; if you would rather not use it, `10.0.2.2` is the emulator's
built-in alias for the host Mac.

```bash
$ANDROID_HOME/emulator/emulator -list-avds
$ANDROID_HOME/emulator/emulator -avd <name> &
adb wait-for-device && adb shell getprop sys.boot_completed
```

If boot fails with `Cannot find AVD system path. Please define ANDROID_SDK_ROOT`
**the message is misleading** — `ANDROID_SDK_ROOT` is usually set fine and the
real cause is a missing system image. Install it:

```bash
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "system-images;android-34;google_apis;arm64-v8a"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DeviceException: No connected devices!` after a full build | Nothing attached; `installDebug` does not fail fast | `adb devices -l` first; the APK is in `app/build/outputs/apk/debug/` — `adb install -r` it |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Same package, different signature — commonly the CI artifact (signed with the runner's keystore) or a teammate's build | `adb uninstall app.pantopus.android.debug` — the `.debug` suffix matters |
| `BUILD SUCCESSFUL` but the app did not change | Device was `offline`/`unauthorized` and got silently skipped | Confirm `adb devices -l` reads `device` |
| REST works, realtime is dead | Only `PANTOPUS_API_BASE_URL` was changed | Change `PANTOPUS_SOCKET_URL` too |
| Screens hang ~45s then error | Wrong host — that is the timeout plus retries, not a freeze | Re-run `adb reverse`, or fix both `.env` lines |
| Worked yesterday, dead today | DHCP moved the Mac, or the reverse mapping died on unplug | `adb reverse tcp:8000 tcp:8000` |
| Odd Kotlin/KSP errors after a JDK switch | Daemon cached the old JVM | `./gradlew --stop` |
| A wall of red from `./gradlew build` | Pre-existing token-lint debt | Use `installDebug` |

`make clean` reclaims very little — it deletes only the root build directory,
not `~/.gradle/caches`, which is where Android build storage actually
accumulates (tens of GB).

---

## Day-to-day loop

| Changed | Run |
|---|---|
| Kotlin / Compose source | `./gradlew installDebug` |
| `.env` | Same command — Gradle detects it and reconfigures |
| Backend code | Nothing — nodemon hot-reloads |
| Replugged the phone | `adb reverse tcp:8000 tcp:8000` |
| Switched JDK | `./gradlew --stop` first |
