# Running Pantopus on a physical iPhone

How to get a Debug build of the native iOS app onto real hardware, talking to a
backend running on your Mac. The [README](../README.md) covers the simulator
workflow; this covers the parts that are different — and harder — on a device.

Every fact below was checked against a real machine on **4 September 2026**:
Xcode 26.6 (17F113), iOS SDK 26.5, XcodeGen 2.45.4, an iPhone 16 Pro on
iOS 26.5.2 (23F84). Where a value is machine-specific it is called out as such.

> **Companion:** the Android equivalent is
> [`frontend/apps/android/docs/device-build-runbook.md`](../../android/docs/device-build-runbook.md).
> The two platforms fail in completely different places — see the comparison
> table at the end.

---

## Already true — don't redo these

Signing is **done**. There is no Apple Developer portal work to do, no
certificate to request, no App ID to register.

| | |
|---|---|
| Signing certificate | `Apple Development: Yingpeng Wang` |
| Team ID | `6UYZBA546R` (Pantopus, Inc.) — **committed** in `project.yml` |
| App profile | `iOS Team Provisioning Profile: app.pantopus.ios` |
| Widget profile | `iOS Team Provisioning Profile: app.pantopus.ios.widgets` |
| Profiles valid to | 2027-06-12, and both already list the test device's UDID |
| Developer Mode | Enabled on the device |

Skip any guide — including older revisions of this one — that tells you to set a
Development Team or create App IDs first.

---

## The trap: nothing you click in Xcode survives a `make` command

`Pantopus.xcodeproj` is **generated, not committed**. XcodeGen builds it from
`project.yml`, and it is in `.gitignore`. Critically, `make open`, `make build`
and `make test` *all run `make bootstrap` first*, which runs `xcodegen generate`
and rewrites the whole project file.

Set a Team in Xcode's Signing & Capabilities panel and it works — until the next
`make` silently discards it. **`project.yml` is the source of truth.**

Good news specific to this repo: `DEVELOPMENT_TEAM: "6UYZBA546R"` is already
committed in `project.yml`, so the classic *"Signing for 'Pantopus' requires a
development team"* failure is already fixed. The inline comment beside it still
reads *"do not commit a team ID"* — **that comment is stale; ignore it.**

---

## Step 1 — Reclaim disk space before you compile anything

Start here. A build that dies at 80% from a full disk costs twenty minutes and
gives a misleading error (a linker or "couldn't write" failure that reads like a
code problem). Xcode does not check free space first.

A cold device build wants roughly **9 GB** — ~2.2 GB of Swift package checkouts
plus ~7 GB of DerivedData.

The first two rows are free money: stale output from old
`xcodebuild -derivedDataPath` runs that Xcode itself never reads.

| Delete | Frees | What it costs you |
|---|---|---|
| `frontend/apps/ios/DerivedData` | ~7.0 GB | Nothing. Xcode uses the *global* DerivedData, not this one. |
| `frontend/apps/ios/build` | ~6.0 GB | Nothing. Stale command-line build products. |
| `~/Library/Caches/org.swift.swiftpm` | ~3.7 GB | SwiftPM re-downloads package sources once. |
| `~/Library/Developer/Xcode/iOS DeviceSupport` | ~5.7 GB | Re-fetches device symbols on next attach. |
| `~/Library/Developer/Xcode/DerivedData` | ~13 GB | Last resort — your next Xcode build of *every* project is cold. |

```bash
rm -rf ~/skinny-pantopus/frontend/apps/ios/DerivedData \
       ~/skinny-pantopus/frontend/apps/ios/build
df -h /
```

**Do not reach for `make clean`.** It also deletes `SourcePackages/`,
`Package.resolved`, `Config/Secrets.xcconfig` and the generated project in one
shot — costing you the 2.2 GB package download you most want to keep, and
putting you back at Step 2.

Keep `SourcePackages/`. It is the one cache that is genuinely expensive to
rebuild.

---

## Step 2 — Point the app at your Mac, not at localhost

A physical iPhone resolves `localhost:8000` to *itself*, where nothing is
listening. It has to use your Mac's LAN address.

> **Machine-specific:** on the reference Mac the Wi-Fi address is on **`en1`,
> not `en0`**. The usual incantation `ipconfig getifaddr en0` prints nothing and
> looks like a broken command. Ask the routing table which interface is live
> instead — that works regardless of which one it is today.

```bash
ipconfig getifaddr $(route -n get default | awk '/interface:/{print $2}')
```

Put the result in `frontend/apps/ios/.env` (gitignored):

```
# Physical iPhone + simulator: use the Mac's LAN IP.
# localhost only ever works in the simulator.
PANTOPUS_API_BASE_URL=http://192.168.0.176:8000
PANTOPUS_SOCKET_URL=http://192.168.0.176:8000

STRIPE_PUBLISHABLE_KEY=pk_test_…
SENTRY_DSN=
```

### How the value reaches the app

```
.env  →  make bootstrap (env-to-xcconfig)  →  Config/Secrets.xcconfig
      →  Config/Pantopus.Debug.xcconfig  →  Info.plist (PantopusAPIBaseURL)
      →  AppEnvironment.apiBaseURL
```

That chain is *why editing `.env` alone does nothing* — the value only
propagates when the project is regenerated (Step 3).

`NSAllowsLocalNetworking: true` is already in the Info.plist; that is what lets
App Transport Security permit plain `http://` to a private `192.168.x.x`
address. Without it every request fails with an ATS error.

**Your Mac's IP will change.** A DHCP renewal silently breaks yesterday's build
and the symptom is every screen spinning forever. Re-run the command above,
update `.env`, redo Step 3, rebuild.

---

## Step 3 — Regenerate the Xcode project

One command reconciles the API URL, the team ID, all four targets, the
entitlements and every package dependency.

```bash
cd ~/skinny-pantopus/frontend/apps/ios
make bootstrap
```

You want two lines: `✓ Config/Secrets.xcconfig written from .env` and
`Created project at …/Pantopus.xcodeproj`.

Verify both the team and your IP landed:

```bash
grep -m1 -o 'DEVELOPMENT_TEAM = [^;]*;' Pantopus.xcodeproj/project.pbxproj
grep PANTOPUS_API_BASE_URL Config/Secrets.xcconfig
```

Expect `DEVELOPMENT_TEAM = 6UYZBA546R;` and
`PANTOPUS_API_BASE_URL = http:/$()/192.168.0.176:8000`.

**That `$()` is not a typo.** xcconfig files treat `//` as a comment, so the
Makefile rewrites `://` as `:/$()/` — an empty variable expansion that breaks up
the slashes. Xcode resolves it back to a normal URL. Leave it alone.

---

## Step 4 — Open Xcode and let the packages resolve

```bash
open ~/skinny-pantopus/frontend/apps/ios/Pantopus.xcodeproj
```

Use `open` directly, **not `make open`** — that re-runs bootstrap for no reason.

Six Swift packages must resolve before anything compiles: **Stripe, Socket.IO,
KeychainAccess, swift-log, Sentry, PostHog**. In a warm checkout this is quick;
in a cold tree it is 5–15 minutes. **Do not build until it finishes** — building
mid-resolve produces errors that vanish on retry.

While you wait, confirm **Xcode → Settings → Accounts** lists your Apple ID with
the Pantopus, Inc. team under it.

If Xcode shows a signing error anyway, check the **PantopusWidgets** target as
well as **Pantopus** — the widget is a separate app extension with its own
bundle ID (`app.pantopus.ios.widgets`) and its own profile, and it is the one
people forget.

---

## Step 5 — Connect the phone and select it as the destination

- Plug in a **cable** for the first device install. Wireless works fine
  afterwards, but the first build stalls less over USB.
- Unlock the phone and leave it unlocked. Tap **Trust** if asked.
- Pick the device as the run destination in the toolbar.
- Scheme must be **Pantopus** — *not* "Pantopus (Staging)". Configuration
  **Debug**.

### Why Debug specifically

`AppEnvironment` picks its API target from the compilation condition. `#if DEBUG`
resolves to `.local`, which reads your LAN IP out of the Info.plist.

Staging and Release go through `secureBundleURL`, which **hard-rejects any
non-`https://` URL** and silently falls back to the hosted backend. A Release
build *cannot* talk to your Mac — that is deliberate, so a stray localhost value
can never ship. If you build Staging by accident the app looks fine and quietly
talks to `staging.api.pantopus.app` instead of you.

---

## Step 6 — Build and run

`⌘R`.

The first cold compile of the app plus the widget extension takes **5–15
minutes**; incremental builds after that are seconds. Strict concurrency and
whole-module settings make the first pass slow — that is expected, not a hang.

Two bundles get installed: `Pantopus.app` and the embedded `PantopusWidgets`
extension (Live Activity + Tasks-near-me widget).

If the build reports "(N failures)" with no visible error, that is a known
transient Xcode frontend crash. Build again — don't start deleting things.

---

## Step 7 — Answer the two prompts on the phone

Both are one-time, and both cause confusing failures if missed.

**1. Untrusted Developer.** If the app installs but refuses to launch, the
certificate is not trusted on the device yet:

> Settings → General → VPN & Device Management → Pantopus, Inc. → **Trust**

**2. Local Network access.** On first launch iOS asks *"Pantopus would like to
find and connect to devices on your local network."* Tap **Allow**. Denying it
makes every request fail with no useful error — the app just spins.

> Undo a mistaken Deny: Settings → Privacy & Security → Local Network → Pantopus

---

## Step 8 — Start the backend, and pick your database deliberately

The backend binds `0.0.0.0:8000` by default, which is what makes it reachable
from the phone. But *which database it talks to* depends on a file-existence
check in `backend/app.js`:

```js
const dotenvPath = fs.existsSync('.env') ? '.env' : '.env.dev';   // line 9
```

`backend/.env` exists on the reference machine, so **`.env.dev` is ignored** —
and `.env` points `SUPABASE_URL` at `http://127.0.0.1:54321`, a local Supabase
that needs Docker. The backend will start and look healthy while every data call
fails.

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

Verify from the **Mac**:

```bash
curl -s http://192.168.0.176:8000/health
```

Then verify from the **phone** — open Safari on the device and visit the same
URL. If the Mac answers but the phone doesn't, it is the network, not the app:
different Wi-Fi networks, or the router has AP/client isolation on (common on
guest networks).

---

## Step 9 — Sign in and confirm

**The proof is the terminal, not the screen.** Watch the `pnpm dev:backend`
window as you tap through the app. Request logs appearing in step with your taps
is the only real confirmation that the device is hitting your Mac.

If screens load but the log stays silent, the app is talking to something else —
check that you built **Debug** and not Staging (Step 5).

---

## Command-line alternative

Xcode must have built at least once so the profiles are installed and the device
is prepared. After that the whole cycle runs headless.

```bash
cd ~/skinny-pantopus/frontend/apps/ios

# Get the id with: xcrun devicectl list devices
DEVICE=<device-udid>

xcodebuild -project Pantopus.xcodeproj -scheme Pantopus -configuration Debug \
  -destination "platform=iOS,id=$DEVICE" \
  -derivedDataPath build -clonedSourcePackagesDirPath SourcePackages build

xcrun devicectl device install app --device $DEVICE \
  build/Build/Products/Debug-iphoneos/Pantopus.app

xcrun devicectl device process launch --device $DEVICE app.pantopus.ios
```

`make build` is **simulator-only** — it hardcodes `platform=iOS Simulator`, so
the explicit `-destination` is required. `-clonedSourcePackagesDirPath` reuses
the package cache and keeps ~12k third-party files out of `git status`.

`devicectl` accepts either the hardware UDID or the CoreDevice id; Xcode's UI
shows the hardware UDID.

---

## Switching to a different iPhone

Xcode 26.6 with the iOS 26.5 SDK builds for any current iPhone with no project
change — the deployment target is iOS 17.0 and the device family already covers
it.

The one real difference: **the provisioning profiles list only the devices
already registered.** A new phone must be registered with the team first.
Connect it, enable Developer Mode (Settings → Privacy & Security → Developer
Mode → on, then reboot), and let Xcode's automatic signing add it — it registers
the UDID and reissues both profiles.

That registration needs **Account Holder, Admin or App Manager** on the team. As
a plain Developer you get *"Failed to register bundle identifier"* or *"No
profiles for 'app.pantopus.ios' were found"*, and you would add the device by
hand in the portal instead. Device slots reset once a year and cap at 100 per
device type.

---

## Troubleshooting

| Symptom | What's actually wrong | Fix |
|---|---|---|
| Build dies late with a write or link error | Disk full — not a code problem | Step 1, then rebuild |
| App installs, every screen spins forever | Backend down, or your Mac's IP changed | `curl http://<ip>:8000/health`. If the IP moved: update `.env` → `make bootstrap` → rebuild |
| Screens load but no requests hit your terminal | You built Staging or Release, which can't use http | Switch the scheme to **Pantopus** / Debug and rebuild |
| Requests fail instantly, no server log | Local Network permission was denied | Settings → Privacy & Security → Local Network → Pantopus |
| App installed but won't launch | Certificate not trusted on the device | Settings → General → VPN & Device Management → Trust |
| "Signing for 'Pantopus' requires a development team" | Something wiped the generated project, or you're in a tree without the team ID | Check `project.yml` has `6UYZBA546R`, re-run `make bootstrap` |
| Only *PantopusWidgets* fails to sign | The extension has its own bundle ID and profile | Set the team on the PantopusWidgets target too |
| Backend starts, but every data call errors | `backend/.env` points at a local Supabase that isn't running | Step 8 — Lane A or Lane B, not neither |
| Device greyed out in the destination list | Phone locked, or debugger support still mounting | Unlock, replug USB, wait for "Preparing debugger support" |
| Build reports "(N failures)" with no visible error | Transient Xcode frontend crash | Build again |
| `ipconfig getifaddr en0` prints nothing | Your Wi-Fi is on another interface | Use the routing-table command in Step 2 |
| Worked yesterday, dead today | DHCP assigned your Mac a new address | Re-run Step 2, then Step 3, then rebuild |

---

## Day-to-day loop

| What you changed | What to run | Roughly |
|---|---|---|
| Swift source only | `⌘R` in Xcode | Seconds |
| Backend code | Nothing — nodemon hot-reloads | Instant |
| `.env` (IP changed) or `project.yml` | `make bootstrap`, then `⌘R` | Under a minute |
| Added a Swift package | Edit `project.yml`, `make bootstrap`, let SPM resolve | Minutes |
| Just checking lint | `make lint` (icons, tokens, SwiftLint) | Seconds |

---

## iOS vs Android — where each one actually hurts

| Concern | iOS | Android |
|---|---|---|
| Code signing | Team ID, App IDs, two profiles, device registration, "Trust this developer" | **None of it.** AGP auto-signs with `~/.android/debug.keystore` |
| Plain HTTP to your Mac | ATS *plus* a runtime Local Network prompt that silently kills everything if denied | One manifest attribute, already set. No prompt. |
| Changing the backend URL | `.env` → `make bootstrap` → rebuild | `.env` → rebuild, or `adb reverse` and never change it |
| Disk hog | DerivedData, ~7 GB per tree | `~/.gradle`, ~29 GB shared across every project |
| The build command | `make build` is simulator-only and can't reach the phone | `./gradlew build` fails outright on token debt — use `installDebug` |
| Debug vs release coexisting | Same bundle ID; replaces | `.debug` suffix; installs alongside |
