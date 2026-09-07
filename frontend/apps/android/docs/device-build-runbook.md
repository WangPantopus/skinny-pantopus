# Running Pantopus on a physical Android phone

How to get a Debug build onto real hardware talking to a backend running on your
Mac. The [README](../README.md) covers the emulator basics; this covers the
parts that are different — and easier to get subtly wrong — on a device.

Every fact below was checked against a real machine on **4 September 2026**:
Gradle 8.9, AGP 8.5.2, Kotlin 2.0.21, OpenJDK 21.0.10 (default) and Temurin
17.0.19, adb 36.0.2, emulator `Pantopus_CI_API_34` on Android 14. Both of the
cold-build failures below were reproduced there.

**If you have done the [iOS equivalent](../../ios/docs/device-build-runbook.md):
none of that applies here.** There is no team ID, no App ID registration, no
provisioning profile, no device enrolment, no "trust this developer", and no
paid developer account. Gradle auto-signs debug builds with
`~/.android/debug.keystore`, which the SDK creates for you. The Android
difficulties are somewhere else entirely.

---

## Three things that will bite you

### 1. The first build in a fresh checkout is *not* reliably green

Two distinct failures, both reproduced, both after ten-plus minutes of
compiling, neither with an error that points at its cause:

- **Kotlin daemon OOM** — `Not enough memory to run compilation` after 9–12
  minutes. The committed `kotlin.daemon.jvmargs=-Xmx8192m` is not enough for a
  full non-incremental Compose compile of a module this size (1,635 Kotlin
  files, 473k lines, 5,266 composables, 274 Hilt view-models).
- **Shared build-cache dex bug** —
  `mergeProjectDexDebug > Directory does not exist: …/mixed_scope_dex_archive/debug/dexBuilderDebug/out`.
  The ~6.4 GB local build cache restores `dexBuilderDebug` as *FROM-CACHE* but
  never recreates its output directory.

Step 5 has the one-line fix for each.

### 2. The default backend URL points at the emulator, not a phone

With no `.env`, `app/build.gradle.kts` falls back to `http://10.0.2.2:8000` for
*both* the REST and socket URLs. `10.0.2.2` is an alias that only exists inside
an AVD — a real phone can never reach it.

The checked-in developer `.env` files have the same two emulator addresses, so
copying one verbatim gives you a phone that hangs on every screen.

### 3. Android work burns disk fast, and `~/.gradle` is ~29 GB

Free space dropped from 18.7 GiB to 12.6 GiB in about 90 minutes of building
this project — roughly 6 GB, most of it into `~/.gradle` rather than the
project. The iOS culprit is DerivedData; here it is the Gradle cache, and the
reclaim targets are completely different (Step 4).

---

## Never run these

**`./gradlew build` and `./gradlew check` fail on this repo.** Both pull in
`verifyPantopusTokens`, which currently fails with roughly **986 violation
lines** of pre-existing design-token debt. `verifyPantopusIcons` passes. It is
repo debt, not something you broke.

**`assembleDebug` and `installDebug` are the entire path to a phone.** If you
see a wall of red, confirm the cause before chasing it:
`./gradlew verifyPantopusTokens` on its own.

**`make validate-env` gives false confidence.** It only checks that
`PANTOPUS_API_BASE_URL` and `STRIPE_PUBLISHABLE_KEY` are non-empty (at least one
character). It will happily bless a `.env` whose socket URL points somewhere
else — see the two-line trap below.

---

## The trap: the backend URL is frozen into the APK at Gradle *configuration* time

There is no regeneration step here and no `xcodegen` equivalent — but
`app/build.gradle.kts:22-28` reads `.env` while Gradle is *configuring* and
bakes the values into `BuildConfig`. The app has **no runtime host override and
no in-app display of which backend it points at**; the About screen shows only a
version string.

So changing where the app talks costs a reconfigure, rebuild and reinstall —
which is exactly why Step 2 recommends `adb reverse` over a LAN IP.

Gradle *does* track `.env` as a configuration-cache input (editing it prints
*"configuration cache cannot be reused because file '.env' has changed"*), so
you never need `clean` or `--no-configuration-cache` after an `.env` edit.

---

## Step 1 — Make the SDK findable from everywhere, not just your Terminal

This is the one that makes a runbook look broken, because it works when you type
it and fails everywhere else.

> **Machine-specific:** `~/.zshrc` exports `ANDROID_HOME` and
> `ANDROID_SDK_ROOT`. `.zshrc` is sourced for **interactive shells only** —
> verified: `zsh -ic` sees the SDK, `zsh -c` and `zsh -lc` see nothing.

So Gradle finds the SDK when you type it in Terminal, and **fails from Android
Studio, any Makefile, any script**, with `SDK location not found` — in under a
second, at task-graph time, before compiling anything.

Write the file once per checkout and the asymmetry stops mattering:

```bash
cd ~/skinny-pantopus/frontend/apps/android
[ -f local.properties ] || printf 'sdk.dir=%s\n' "$HOME/Library/Android/sdk" > local.properties
cat local.properties
```

`local.properties` is gitignored, so it does not travel with a branch or a new
worktree. Expect to write it again in every fresh tree.

### Do not set `JAVA_HOME`

`JAVA_HOME` being unset is fine. Gradle picks Homebrew **OpenJDK 21.0.10**, and
AGP 8.5.2 builds on it — verified, repeatedly. Temurin 17 also works and is what
older revisions of this doc insisted on; switching costs you a second daemon
pair (6 GB + 8 GB heaps) and a discarded configuration cache for no benefit.

There is **no JVM toolchain pin** anywhere in the build files, so the JVM is
selected by `org.gradle.java.home` → `JAVA_HOME` → `java` on PATH.

**Android Studio disagrees with your Terminal.** Studio bundles its own JBR
21.0.9 — a third JVM — so building in both spawns two 6 GB daemons. Pick one;
this runbook uses Terminal. If you use Studio, set *Settings → Build, Execution,
Deployment → Build Tools → Gradle → Gradle JDK*, and open
`frontend/apps/android/`, **not** the monorepo root (there is no Gradle build
file at the repo root).

---

## Step 2 — Point the app at your Mac, both lines

Unlike iOS there is no gate to open: `android:usesCleartextTraffic="true"` sits
on the `<application>` tag at `app/src/main/AndroidManifest.xml:41`, app-wide,
with no network-security-config XML anywhere and no build-type override. Plain
HTTP to a private address just works, and **there is no runtime local-network
permission prompt**. The whole problem is which address gets baked in.

### Recommended: port-forward over adb

Leave the URLs on `localhost` and let adb tunnel the phone's `localhost:8000`
back to your Mac. The host never changes, so DHCP moving your Mac costs nothing
— whereas the LAN-IP route costs a full reconfigure, rebuild and reinstall every
time. Works identically on a phone and the emulator, over USB and wireless.

```
PANTOPUS_API_BASE_URL=http://localhost:8000
PANTOPUS_SOCKET_URL=http://localhost:8000
STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_ME
MAPS_API_KEY=
```

```bash
cd ~/skinny-pantopus/frontend/apps/android
[ -f .env ] || cp .env.example .env      # never clobber a working .env
sed -i '' 's|http://10\.0\.2\.2:8000|http://localhost:8000|g' .env
grep '^PANTOPUS' .env

adb reverse tcp:8000 tcp:8000            # re-run after every unplug/reboot
```

**Cost:** the mapping dies on unplug, reboot, or `adb kill-server` — re-run the
one-liner, no rebuild needed. The phone cannot reach the backend while
untethered from adb.

### The two-line trap

`.env` holds the host **twice**. Change only `PANTOPUS_API_BASE_URL` and the app
*looks* fine — screens load, sign-in works — but `SocketManager` still dials the
old host, so **realtime chat and live updates die silently** with nothing on
screen to say so. The only tell is `Socket connect error` every two seconds in
logcat, forever (`setReconnectionAttempts(Integer.MAX_VALUE)`).

Always change both. `make validate-env` will not catch this.

### Alternative: your Mac's LAN IP

Use this if the phone needs to work without adb attached.

> **Older revisions of this doc shipped a destructive one-liner.** It used
> `$(ipconfig getifaddr en0)`, and on the reference Mac `en0` has no address —
> the Wi-Fi address is on `en1`. The command substitutes an empty string and
> silently writes `http://:8000` into both lines. No error; the app then fails
> every request. Derive the interface instead, and refuse to write on empty:

```bash
IP=$(ipconfig getifaddr $(route -n get default | awk '/interface:/{print $2}'))
[ -n "$IP" ] || { echo "no LAN address — refusing to write"; exit 1; }
sed -i '' -E "s|^(PANTOPUS_(API_BASE|SOCKET)_URL)=.*|\1=http://$IP:8000|" .env
grep '^PANTOPUS' .env
```

Phone and Mac must be on the same non-guest Wi-Fi; client isolation breaks it.

### `.env` rules that cost people hours

- The file goes at **`frontend/apps/android/.env`** — the Gradle root, *not*
  `app/` and not the repo root. Anywhere else it is silently ignored.
- It is **not a shell script**. Bare `KEY=value`. No `export`, no quotes (a
  quoted value fails the build later), no backslashes.
- **An empty line beats your shell.** `envOr` reads `.env` first, and a bare
  `MAPS_API_KEY=` yields `""`, not null — so it *shadows* the same-named
  environment variable. Exporting in your shell will not work. Put the value in
  `.env`, or delete the empty line.
- Two comments in `app/build.gradle.kts` (:78-79 and :83) claim values can come
  from `~/.gradle/gradle.properties`. **They are wrong.** `envOr` reads `.env`,
  then `System.getenv()`, then the default — never Gradle properties.

Verify before you pay for a build — one second versus ten minutes:

```bash
./gradlew :app:generateDebugBuildConfig
grep -E 'PANTOPUS_API_BASE_URL|PANTOPUS_SOCKET_URL|APPLICATION_ID' \
  app/build/generated/source/buildConfig/debug/app/pantopus/android/BuildConfig.java
```

---

## Step 3 — Put the phone into developer mode, and confirm adb sees it first

The phone must run **Android 8.0 (API 26) or newer** (`minSdk = 26`).

1. **Settings → About phone → tap "Build number" seven times.** Samsung buries
   it under *Software information*; Xiaomi under *MIUI version*.
2. **Settings → System → Developer options → USB debugging** on. Some OEMs also
   need **Install via USB**.
3. Connect with a cable that carries **data**, not just power.
4. Unlock the phone and accept **"Allow USB debugging?"**.

```bash
adb devices -l
```

**Do this before building.** `installDebug` does *not* fail fast — with nothing
attached Gradle runs the entire build and only then errors with
`DeviceException: No connected devices!`, costing you the full build time. The
APK is still produced, so you can `adb install -r` it afterwards.

Worse: a device that is `unauthorized` or `offline` is silently **skipped**
while the build still prints `BUILD SUCCESSFUL`, which reads exactly like a
successful install.

With **both** a phone and an emulator attached, `installDebug` installs to
both. Target one with `ANDROID_SERIAL` — there is no Gradle flag:

```bash
ANDROID_SERIAL=<serial> ./gradlew :app:installDebug
```

Wireless (Android 11+) works too. The common mistake is collapsing two different
ports into one — the pairing port and the connect port are not the same:

```bash
adb pair 192.168.0.50:37123    # port + 6-digit code from the PAIRING dialog
adb connect 192.168.0.50:41234 # port from the MAIN wireless-debugging screen
```

---

## Step 4 — Clear the decks: disk and RAM, before the first build

| Delete | Frees | What it costs you |
|---|---|---|
| `~/.gradle/caches/<stale-version>` | ~1.5 GB | Nothing. A Gradle version this project doesn't use. |
| `~/.gradle/daemon` | ~172 MB | Nothing. Pure logs. |
| `~/.gradle/caches/build-cache-1` | ~6.4 GB | Rebuild time only — and it is the cache behind the dex bug. |
| `~/.gradle/caches/8.9/transforms` | ~19 GB | Re-runs dex/jetifier transforms. Does *not* re-download. |
| `./gradlew clean` | ~1.5 GB | Little. It **does** delete `app/build`, contrary to older revisions of this doc. |

**Keep `~/.gradle/caches/modules-2`** (~814 MB) — that is the actual
downloaded-dependency store and the only expensive one to refetch.

```bash
cd ~/skinny-pantopus/frontend/apps/android
./gradlew --status          # never --stop while a build is in flight
./gradlew --stop
rm -rf ~/.gradle/daemon
df -h /
```

### RAM matters as much as disk

32 GB physical, but `gradle.properties` asks for **6144m for Gradle plus 8192m
for the Kotlin daemon**, and a running emulator holds another ~2.5 GB. Two
concurrent builds — Android Studio syncing while your terminal builds — is a
verified OOM. **Quit the emulator before the first build** if you are targeting
a phone; you do not need it.

---

## Step 5 — The first build, and the two ways it fails

In a warm tree, just build. In a **fresh** tree, skip the shared build cache on
the first run — that is what dodges the dex bug:

```bash
cd ~/skinny-pantopus/frontend/apps/android
./gradlew --no-build-cache :app:assembleDebug
```

Expect **6–12 minutes** cold, **1–2.5 minutes** warm. It is one enormous Gradle
module built serially (`org.gradle.parallel=false`, `workers.max=1`). The
README's "second build ~30s" is optimistic.

| If it dies with | Do this |
|---|---|
| `Not enough memory to run compilation`, ~10 min in | Quit the emulator, `./gradlew --stop`, retry with `-Pkotlin.daemon.jvmargs="-Xmx12288m -Xss16m -XX:+UseParallelGC"` |
| `mergeProjectDexDebug > Directory does not exist` | `mkdir -p app/build/intermediates/mixed_scope_dex_archive/debug/dexBuilderDebug/out` and rebuild |
| `Cannot access output property` / `Unable to delete directory` | Leftover from an interrupted build: `rm -rf app/build/intermediates/incremental/debug-mergeJavaRes` |
| A five-line warning about `compileSdk 35` | Ignore it. It prints on *every* build including successful ones, and is never the cause. (`compileSdk` was raised for an `androidx.core` requirement while `targetSdk` stays at 34.) |

The APK lands at `app/build/outputs/apk/debug/app-debug.apk` and is about
**87–91 MB** — it carries all four ABIs, so a phone will never run most of it.

---

## Step 6 — Install and launch: mind the `.debug` suffix

The debug build carries `applicationIdSuffix = ".debug"`, so the installed
package is **`app.pantopus.android.debug`** — it coexists with a Play install
rather than replacing it. But the *activity class* keeps the un-suffixed
namespace, which breaks the usual shorthand.

```bash
./gradlew :app:installDebug
# or, without re-running Gradle:
# adb install -r app/build/outputs/apk/debug/app-debug.apk

# Launch. The dotted shorthand /.MainActivity does NOT resolve.
adb shell am start -n app.pantopus.android.debug/app.pantopus.android.MainActivity
```

There is no app-wide log tag (Timber tags each line with its calling class), so
filter by **process**:

```bash
adb logcat --pid=$(adb shell pidof -s app.pantopus.android.debug)
```

> **Debug logcat contains live credentials.** `di/NetworkModule.kt` sets
> `HttpLoggingInterceptor.Level.BODY` for debug builds, and the logging
> interceptor runs *after* the auth interceptor with no `redactHeader` call.
> Every debug log carries bearer tokens and complete request/response bodies.
> Redact before attaching one to a ticket or PR.

On first launch the **notification permission dialog fires immediately**, before
sign-in and with no explanation — that is expected. On Android 12 and below no
prompt appears at all. Every other permission is requested lazily at its
feature.

---

## Step 7 — Start the backend, and pick your database deliberately

Identical to the iOS story. Older revisions of this doc said the backend "points
at the hosted dev Supabase, so no local Docker stack is needed." On the
reference machine that is inverted.

```js
const dotenvPath = fs.existsSync('.env') ? '.env' : '.env.dev';   // backend/app.js:9
```

`backend/.env` exists, so `.env.dev` is ignored — and it points `SUPABASE_URL`
at `http://127.0.0.1:54321`, a local Supabase that needs Docker. The backend
will start and look healthy while every data call fails.

**Lane A — hosted dev database (simplest):**

```bash
cd ~/skinny-pantopus
mv backend/.env backend/.env.local-supabase   # reversible
pnpm dev:backend
```

**Lane B — local database:**

```bash
open -a Docker && cd ~/skinny-pantopus && supabase start && pnpm dev:backend
```

**Probe identity, not the port.** "Any HTTP status proves it is listening" is
not enough — anything bound to :8000 satisfies that. Treat `/health` as the
*database* check: a `503` means "backend up, database unhappy", which is exactly
the Lane A/B question.

```bash
curl -s http://localhost:8000/ | head -c 120; echo
curl -s http://localhost:8000/health; echo
```

On the LAN-IP route, load the same URL in the **phone's browser** too — that
separates "backend down" from "network won't route".

Note that only a checkout with `node_modules` can run the backend; a fresh git
worktree has neither that nor any backend env file.

---

## Step 8 — Sign in and confirm

**The proof is the backend terminal, not the screen.** Request logs appearing in
step with your taps is the only real confirmation.

| Signal | What it means |
|---|---|
| `Can't reach Pantopus. Check your connection.` | Sign-in cannot reach the host. Takes **~15s** to appear (sign-in is a POST and `RetryInterceptor` only retries GET/HEAD), so it reads as a hang. |
| `Socket connect error` every 2s in logcat | The two-line trap. Never surfaces in the UI. |
| Requests in the backend terminal | The positive signal. OkHttp also prints full URLs in logcat. |
| *(nothing in Settings)* | There is **no in-app display of which backend the APK points at**. Logcat or a rebuild are the only ways to confirm. |

If the app is reaching the Mac but you cannot get in, that is Step 7's database
question, not a networking one.

---

## Step 9 — Know what's dead by design

Missing credentials, not bugs. Every one of these is expected on a dev build:

- **Maps are blank.** `MAPS_API_KEY` is empty by default. Seven screens call the
  Google Maps composable; only `NearbyScreen` degrades gracefully (it reads the
  manifest meta-data back at runtime and draws a flat cell grid). No crash.
- **Payments fail.** The default Stripe key is a placeholder — PaymentSheet
  errors rather than disabling cleanly.
- **Push never arrives.** `app/google-services.json` is a committed placeholder
  (`pantopus-placeholder`). It registers *both* package names, which is why the
  unconditional google-services plugin doesn't fail the build, and Firebase
  initialises fine — only the token fetch fails, caught and logged. The FCM code
  is fully wired, so swapping in the real Firebase file is the whole fix.
- **`https://pantopus.com` links open the browser, not the app.** App Links
  verification needs `assetlinks.json` for the debug signing fingerprint.
- **Screenshots come out black** on Wallet, Payments, the mail Vault and Access
  Codes — `FLAG_SECURE` — and across the whole app when app lock is enabled.
- **The debug app looks identical to a production install** — same name, same
  icon, only the package id differs. Tell them apart by the `-debug` version
  suffix or `adb shell pm list packages | grep pantopus`.

You can force App Links locally — verified end to end, no `assetlinks.json` and
no rebuild:

```bash
adb shell pm set-app-links --package app.pantopus.android.debug 1 all
adb shell pm get-app-links app.pantopus.android.debug

# The custom scheme works without any of that:
adb shell am start -a android.intent.action.VIEW -d "pantopus://gigs/123" app.pantopus.android.debug
```

One more: setting `PANTOPUS_ENV` explicitly in `.env` overrides **both** the
debug and release defaults. Setting it to `production` locally turns off paid
scheduling surfaces, which reads as a broken install.

---

## Emulator instead of a phone

Skip Step 3 entirely. `adb reverse` works on the emulator too, so Step 2 is
unchanged; if you would rather not use it, `10.0.2.2` is the emulator's built-in
alias for the host Mac and is already the default.

```bash
~/Library/Android/sdk/emulator/emulator -list-avds
~/Library/Android/sdk/emulator/emulator -avd <name> &
adb wait-for-device && adb shell getprop sys.boot_completed
```

Paths are spelled out on purpose: `$ANDROID_HOME` is only set in an interactive
shell (Step 1), so `$ANDROID_HOME/emulator/…` expands to nothing in a script.

If boot fails with `Cannot find AVD system path. Please define ANDROID_SDK_ROOT`
**the message is misleading** — the real cause is usually a missing system
image:

```bash
~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager "system-images;android-34;google_apis;arm64-v8a"
```

Note that `cmdline-tools` and `system-images` may be Homebrew symlinks rather
than real directories under `~/Library/Android/sdk` — which means `du`
under-reports the SDK, and `brew uninstall android-commandlinetools` breaks
`sdkmanager` and the emulator.

---

## Two docs to ignore

`docs/android-release-guide.md` and `docs/android-release-review.md` document
`frontend/apps/mobile` — the Expo/EAS app, package `com.pantopus.app`, which has
**zero files in git today**. Every command in both is dead:
`pnpm --filter pantopus-mobile` matches no workspace. The real Android release
path is fastlane + Gradle Play Publisher against `app.pantopus.android`
(`frontend/apps/android/fastlane/Fastfile`, `make beta` / `make release`, or
`./gradlew publishReleaseBundle`).

Also: **there is no `.github` directory in this repo.** Every CI-workflow
citation across the Android docs points at files that do not exist.

---

## Troubleshooting

| Symptom | What's actually wrong | Fix |
|---|---|---|
| `SDK location not found`, instantly | No `local.properties`, and `ANDROID_HOME` only exists in interactive shells | Step 1 |
| `Not enough memory to run compilation` | Kotlin daemon OOM on a cold full compile | Quit the emulator, `--stop`, retry with `-Pkotlin.daemon.jvmargs="-Xmx12288m …"` |
| `mergeProjectDexDebug > Directory does not exist` | Shared build cache restored a task without its output dir | `mkdir -p` the path, or build with `--no-build-cache` |
| `DeviceException: No connected devices!` after a full build | `installDebug` doesn't fail fast | `adb devices -l` first; the APK exists, `adb install -r` it |
| `BUILD SUCCESSFUL` but the app didn't change | Device was `offline`/`unauthorized` and got silently skipped | Confirm `adb devices -l` reads `device` |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Same package, different signature | `adb uninstall app.pantopus.android.debug` — the suffix is required |
| Every screen hangs ~15s then errors | Wrong host baked in — often `10.0.2.2` on a real phone | Re-run `adb reverse`, or fix both `.env` lines and rebuild |
| REST works, realtime is dead | Only `PANTOPUS_API_BASE_URL` was changed | Change `PANTOPUS_SOCKET_URL` too |
| `.env` edited but nothing changed | Used `export`, quotes, or put the file in `app/` | Bare `KEY=value` at `frontend/apps/android/.env` |
| Exported a key in your shell; still ignored | An empty `KEY=` line in `.env` shadows the env var | Put the value in `.env`, or delete the empty line |
| `activity class does not exist` | Used the dotted shorthand | `app.pantopus.android.debug/app.pantopus.android.MainActivity` |
| ~986 lines of red from `./gradlew build` | Pre-existing token-lint debt | Use `installDebug`. Confirm with `./gradlew verifyPantopusTokens` |
| Odd Kotlin/KSP errors after switching JDK | Daemon cached the old JVM | `./gradlew --stop` |
| Worked yesterday, dead today | Reverse mapping died on unplug, or DHCP moved the Mac | `adb reverse tcp:8000 tcp:8000` |

---

## Day-to-day loop

| What you changed | What to run | Roughly |
|---|---|---|
| Kotlin / Compose source | `./gradlew :app:installDebug` | 1–2.5 min |
| Backend code | Nothing — nodemon hot-reloads | Instant |
| `.env` | Same command — Gradle detects it and reconfigures | +~1 min for the task graph |
| Replugged the phone | `adb reverse tcp:8000 tcp:8000` | Instant, no rebuild |
| Switched JDK or IDE | `./gradlew --stop` first | Next build is cold |
