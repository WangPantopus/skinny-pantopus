# Verification kit

How every stream runs the real apps against a real local backend and database without colliding with the others, and what "verified" means for this build.

**What was tested.** On October 13, 2026, on the founder's Mac (Intel, macOS 26), the coordinator ran: the runtime script and the accounts script; the backend on a stream's database with an authenticated API call; creating and deleting a private iOS simulator; creating and headless-booting a private Android emulator (about 50 seconds). **Not run end to end:** the iOS and Android app build-and-install steps below. They follow the repo's Makefiles and Gradle setup, but a first iOS and Android compile was started and stopped before finishing. Expect small fixes on your first build and record them in your status file.

## Tools

Installed under `~/.local/opt` (no shell profile was edited): Node 22.23.3, pnpm 9.15.4 (through corepack, as `package.json` pins), Supabase CLI 2.116.0 (pinned in `supabase/migration-policy.json`), Temurin JDK 17.0.20.1, XcodeGen 2.46.0, SwiftLint 0.63.3 and SwiftFormat 0.61.1 (pinned as in `ios-ci.yml`). Docker Desktop is installed; Xcode 26.5 and the Android SDK (API 35, build-tools 35.0.0, x86_64 system image) were already there.

**Put them on the PATH at the start of every shell command that needs them** (shell state does not persist between commands):

```bash
source ~/.config/pantopus/dev-env.sh
```

If that file or a tool is missing, stop and tell the founder; do not install a different version. Every worktree needs its own dependencies once: `pnpm install --frozen-lockfile` at the repo root.

## Runtime (one isolated stack per stream)

```bash
source ~/.config/pantopus/dev-env.sh
scripts/pulse/stream-runtime.sh start <stream> --env backend/.env   # stream: pb pi pa ps pc pv
scripts/pulse/stream-runtime.sh status <stream>
scripts/pulse/stream-runtime.sh stop <stream>
```

It starts only the services the backend needs (Postgres 17 with every migration in **your** checkout, Auth, REST, Storage, Realtime and a mail inbox) under its own project name `pantopus-pulse-<stream>` and ports, so it cannot touch another session's database. It takes about a minute. `--env` writes a gitignored `backend/.env` for it (background jobs off, no Stripe key needed).

| Stream | Supabase API | Postgres | Mail inbox | **Backend** | **Web** |
|---|---|---|---|---|---|
| pb | 55001 | 55002 | 55004 | **55100** | 55101 |
| pi | 56001 | 56002 | 56004 | **56100** | 56101 |
| pa | 57001 | 57002 | 57004 | **57100** | 57101 |
| ps | 58001 | 58002 | 58004 | **58100** | 58101 |
| pc | 59001 | 59002 | 59004 | **59100** | 59101 |
| pv | 60001 | 60002 | 60004 | **60100** | 60101 |

Start the backend and (if you need it) the web app from your checkout:

```bash
source ~/.config/pantopus/dev-env.sh
(cd backend && node app.js)                                   # health: curl http://127.0.0.1:<backend>/health
cd frontend/apps/web && NEXT_PUBLIC_API_URL=http://127.0.0.1:<backend> NEXT_PUBLIC_APP_URL=http://127.0.0.1:<web> \
  ./node_modules/.bin/next dev -p <web> -H 127.0.0.1
```

Run long servers in the background, check `/health`, and stop them when you are done. **Re-restart the backend after you merge `master`** so you are running the latest routes. If you use the browser preview tool, add a local launch entry to `.claude/launch.json` and **never commit that file's changes**. Email (sign-up, codes) lands in the stream's mail inbox at `http://127.0.0.1:<mail inbox>`.

## Accounts and fixtures

```bash
node scripts/pulse/accounts.cjs create <stream> alice bob carol     # real Auth users + public."User" rows, random passwords kept in a private file
node scripts/pulse/accounts.cjs token  <stream> alice                # a fresh access token for curl
node scripts/pulse/accounts.cjs login  <stream> alice                # email and password to type into an app's sign-in form
node scripts/pulse/accounts.cjs sql    <stream> "select …"           # SQL in your stream's database
node scripts/pulse/accounts.cjs cleanup <stream>                     # removes the accounts (posts and replies cascade)
```

Entering these generated test credentials into **your own local build** is fine; never use them anywhere else and never print or commit them. Creating a post as a user can be done through the API (`POST /api/posts`) or the app; seed extra rows with `sql` only to set up state, not to skip the behavior under test. A **verified resident** (a home with a verified address occupancy inside a town polygon) is a fixture PV adds to `scripts/pulse/` in its first PR; until then PB's S5 PR carries the SQL it needs. Remove everything you create when you finish a check.

## Devices

**Never use** the Android emulators `Pantopus2174Review`, `PantopusPRReview`, `pantopus-pr-review` or the iOS simulator `PantopusPRReview`: other sessions use them. Make your own.

**iOS** (stream PI uses the name `Pulse-PI`, PV uses `Pulse-PV`):

```bash
UDID=$(xcrun simctl create "Pulse-PI" com.apple.CoreSimulator.SimDeviceType.iPhone-17 com.apple.CoreSimulator.SimRuntime.iOS-26-5)
xcrun simctl boot "$UDID"
# frontend/apps/ios/.env (gitignored):  PANTOPUS_API_BASE_URL=http://localhost:<backend>  PANTOPUS_SOCKET_URL=http://localhost:<backend>  STRIPE_PUBLISHABLE_KEY=pk_test_local_placeholder
cd frontend/apps/ios && make bootstrap        # writes Config/Secrets.xcconfig and generates Pantopus.xcodeproj
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus -destination "id=$UDID" -configuration Debug \
  -derivedDataPath "$HOME/.config/pantopus/pulse-pi-runtime/dd" build
xcrun simctl install "$UDID" "$HOME/.config/pantopus/pulse-pi-runtime/dd/Build/Products/Debug-iphonesimulator/Pantopus.app"
xcrun simctl launch "$UDID" app.pantopus.ios
```

The first build resolves Swift packages from GitHub and compiles a large app, so it takes a while; later builds are incremental. Release builds (`-configuration Release`) are PV's sweep, and the only place R8/optimizer-only crashes show.

**Android** (stream PA uses AVD `pulse-pa` on console port **5574**, PV uses `pulse-pv` on **5576**):

```bash
source ~/.config/pantopus/dev-env.sh
echo no | avdmanager create avd -n pulse-pa -k "system-images;android-35;google_apis;x86_64" -d pixel_6
(nohup emulator -avd pulse-pa -port 5574 -no-audio -no-boot-anim -no-snapshot > ~/.config/pantopus/pulse-pa-runtime/emulator.log 2>&1 &)   # add -no-window for headless
until [ "$(adb -s emulator-5574 shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 5; done      # about a minute
# frontend/apps/android/.env (gitignored):  PANTOPUS_API_BASE_URL=http://10.0.2.2:<backend>  PANTOPUS_SOCKET_URL=http://10.0.2.2:<backend>  STRIPE_PUBLISHABLE_KEY=pk_test_local_placeholder  PANTOPUS_ENV=development
cd frontend/apps/android && ANDROID_SERIAL=emulator-5574 ./gradlew installDebug      # debug application id: app.pantopus.android.debug
```

The emulator reaches your Mac as `10.0.2.2`. Screenshots and accessibility reads work through `adb -s emulator-5574 exec-out screencap -p` and `uiautomator dump`. The MCP simulator tool (`mcp__Claude_Code_iOS_Simulator__control`) drives iOS; pass your device's name or UDID. Stop and delete your own devices when you finish a long stretch (`xcrun simctl shutdown|delete`, `adb -s … emu kill`, `avdmanager delete avd`).

## What "verified" means here

- You used the **real app** on the platform your change touches, signed in as a real local account, against **your** backend and database. A second account sees the other side (the neighbor, the outsider, the asker). The state **survives relaunch or reload**.
- For anything about audience: run the **two-account privacy matrix** below for the paths you touched, including the old endpoints.
- A PR body says what you did and what you did not. Not verified usually means: hosted services, physical phones, live providers (Stripe, Lob, Anthropic, push delivery), real inboxes, store builds.

### Two-account privacy matrix (PV owns the runner; PB runs it on every audience PR)

Actors: **author** (verified resident of the town), **neighbor** (verified resident, same town), **new-here** (postcard pending), **nearby** (verified in a neighboring town), **visitor** (signed in, no home), **outsider** (signed out). Posts: public town post; `verified_town` post; `verified_area` post (when an area is open); held post; removed post; a post with `allow_external_share = false`; an older post with no `read_scope`.

Read paths to check for each: `GET /api/pulse/feed` (both views), `GET /api/posts/feed` (legacy, with chosen coordinates), `GET /api/posts/map`, `GET /api/posts/saved`, `GET /api/posts/:id`, its comments and likes, `POST /api/posts/:id/share`, `GET /api/pulse/posts/:id`, search (R3), a digest or notification that quotes the post (R3).

Expected: the author always reads; a restricted post never reaches a viewer who is not inside its audience through **any** path (including by choosing different coordinates); held reaches only the author and staff; removed only the author; signed-out reads succeed only for public posts with sharing on; the public share page shows no street, no distance and no unlabeled identity. Record the grid in the PR.

## Checks before you push

Run what your change touches; CI runs them again.

| Area | Commands |
|---|---|
| Backend | `cd backend && pnpm run test:privacy && pnpm test` · for migrations: `MIGRATION_BASE_SHA=origin/master node scripts/db/check-migrations.cjs`, `node scripts/db/check-function-lint.cjs`, `node scripts/db/sync-sql-contracts.cjs --check` |
| Web | `cd frontend/apps/web && npx eslint <changed files>` and `pnpm test` for the suites that cover them |
| iOS | `cd frontend/apps/ios && swiftlint lint --strict && swiftformat --lint . && bash Pantopus/scripts/verify-icons.sh && bash Pantopus/scripts/verify-overline.sh` · unit tests: `make test` (CI skips `PantopusUITests`; run the UI tests that cover tab ids by hand when you change the tab bar) |
| Android | `cd frontend/apps/android && ./gradlew ktlintCheck detekt :app:lintDebug test` and `paparazziVerify` when you change a screen that has snapshots |

No new unit tests; update or remove a test your intended change breaks, in the same PR.

## PR body format

The repo's recent PRs follow this and it is what the founder reads:

```
<One or two sentences: what changes for a person, and which slice (S#) it is.>

## What's in it        (files and behavior; migrations named)
## Privacy             (who can see what now; the matrix rows you ran)
## Verified            (real apps, accounts, platforms; what survived relaunch)
Not verified here: …   (always)
Checks: …              (what passed)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Release-candidate sweep (PV, before each founder cut)

On the merged `master`: **iOS Release** on a simulator and **Android Release** (R8-shrunk) on an emulator signed in as a homeowner, a household member and a new user: cold start online and offline, the five tabs (and four with `plans` off), every push and link route opens without a crash, signing out leaves nothing behind, large text, dark mode, VoiceOver and TalkBack name every control; the **production web build** with the same accounts; the privacy matrix against the release backend; a read of the staging logs after the founder's deploy. Findings go to the owning stream's status file as "Requests".

## Cleanup

Remove fixtures (`accounts.cjs cleanup`), stop servers and your runtime (`stream-runtime.sh stop`), delete your private devices when idle, and never leave credentials, tokens, `.env` files or evidence in the tree. `git status` must show only the files you meant to change.
