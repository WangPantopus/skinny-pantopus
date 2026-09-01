# Building Pantopus on a physical iPhone

How to get a Debug build of the native app onto a real device, talking to a
backend running on your Mac. Simulator-only workflow is in the
[README](../README.md); this covers the parts that are different — and harder —
on hardware.

Assumes an Apple Developer Program account already set up on the machine.

---

## The trap to know before you start

**`Pantopus.xcodeproj` is generated, not committed.** XcodeGen builds it from
`project.yml`, and it's listed in `.gitignore`.

Critically: **`make open`, `make build`, and `make test` all run `make bootstrap`
first**, which runs `xcodegen generate` and overwrites the whole project file.

So if you set your Team in Xcode's *Signing & Capabilities* panel, it works —
until the next `make` command silently discards it and you're back to
*"Signing for 'Pantopus' requires a development team."*

**`project.yml` is the source of truth. Never trust a setting you clicked in
Xcode's UI to survive.**

---

## 1. Set your Development Team

`project.yml` ships with `DEVELOPMENT_TEAM: ""`. Without a real value, Xcode
cannot code-sign for a device at all.

Find your 10-character Team ID — it's the `OU` field of your signing certificate:

```bash
security find-certificate -c "Apple Development" -p | openssl x509 -noout -subject
```

Then set it in `project.yml`:

```yaml
settings:
  base:
    DEVELOPMENT_TEAM: "YOURTEAMID"
```

**Why here and not in an xcconfig:** project-level settings in the generated
`.pbxproj` *override* xcconfig values, so putting the team in
`Config/Secrets.xcconfig` will not work while `project.yml` sets it to `""`.

**Do not commit the team ID.** Keep the edit local:

```bash
git update-index --skip-worktree frontend/apps/ios/project.yml
```

Undo with `--no-skip-worktree` when you need to change that file for real.

## 2. Point the app at your Mac, not localhost

A physical device resolves `localhost:8000` to *itself*, which runs nothing. It
has to use your Mac's LAN address.

```bash
ipconfig getifaddr en0
```

Put that value in `frontend/apps/ios/.env` (gitignored):

```
PANTOPUS_API_BASE_URL=http://<your-lan-ip>:8000
PANTOPUS_SOCKET_URL=http://<your-lan-ip>:8000
```

The value reaches the app through this chain:

```
.env  →  Config/Secrets.xcconfig  →  Config/Pantopus.Debug.xcconfig
      →  Info.plist (PantopusAPIBaseURL)  →  AppEnvironment.swift
```

That chain is why editing `.env` alone does nothing — the value only propagates
when the project is regenerated (step 3).

`NSAllowsLocalNetworking: true` is already declared in the Info.plist; that's
what lets App Transport Security permit plain `http://` to a private
`192.168.x.x` / `10.x.x.x` address. Without it every request fails with an ATS
error.

**Your Mac's IP will change.** DHCP renewals silently break the build you
installed yesterday, and the symptom is every screen spinning forever. When that
happens: update `.env`, re-run step 3, rebuild.

## 3. Regenerate the project

```bash
cd frontend/apps/ios && make bootstrap
```

Runs `env-to-xcconfig` (rewrites `Config/Secrets.xcconfig` from `.env`), then
`xcodegen generate`. One command reconciles the API URL, team ID, targets,
entitlements, and package dependencies.

Verify it took:

```bash
grep -m3 DEVELOPMENT_TEAM frontend/apps/ios/Pantopus.xcodeproj/project.pbxproj
```

## 4. Open Xcode and let it create the App IDs

```bash
open frontend/apps/ios/Pantopus.xcodeproj
```

Use `open` directly, **not `make open`** — that re-runs bootstrap needlessly.

First launch takes 5–15 minutes resolving the SPM dependencies (Stripe,
Socket.IO, KeychainAccess, SwiftLog, Sentry, PostHog). Don't build until it
finishes.

Check **Xcode → Settings → Accounts** has your Apple ID with the team listed.
Then on the **Pantopus** target → **Signing & Capabilities**: "Automatically
manage signing" checked, Team selected. **Repeat on the `PantopusWidgets`
target** — it's a separate app extension (`app.pantopus.ios.widgets`) with its
own provisioning profile.

### What automatic signing is doing, and why it may fail

The app declares three capabilities in `Pantopus/Resources/Pantopus.entitlements`:

| Capability | Value |
|---|---|
| Push Notifications | `aps-environment` (`development` for Debug) |
| Associated Domains | `applinks:pantopus.com`, `applinks:pantopus.app` |
| App Groups | `group.app.pantopus.ios` |

Xcode has to create the App IDs `app.pantopus.ios` and
`app.pantopus.ios.widgets`, enable those capabilities, register the app group,
register the device UDID, and issue two profiles.

That requires **Account Holder, Admin, or App Manager** role on the team. As a
plain "Developer" you'll get *"Failed to register bundle identifier"* or *"No
profiles for 'app.pantopus.ios' were found."* Fix: create both App IDs and the
app group by hand at
[developer.apple.com → Identifiers](https://developer.apple.com/account/resources/identifiers/list),
then hit **Try Again** in Xcode.

## 5. Connect the device

**Enable Developer Mode on the phone** (iOS 16+):
Settings → Privacy & Security → Developer Mode → on, then reboot.

**Use a cable for the first install.** Wireless debugging works afterwards, but
the first build is more reliable and faster over USB. Unlock the phone and leave
it unlocked; tap **Trust** if prompted.

In the toolbar, select the device as destination. Scheme must be **Pantopus**
(not "Pantopus (Staging)"), configuration **Debug**.

### Why Debug specifically

`AppEnvironment.swift` picks the API target from the compilation condition.
`#if DEBUG` resolves to `.local`, which reads the LAN IP from Info.plist.
Staging and Release go through `secureBundleURL`, which **hard-rejects any
non-`https://` URL** and falls back to the hosted backends. A Release build
*cannot* talk to your Mac — that's deliberate, so a stray localhost value can
never ship.

## 6. Build and run

⌘R. First cold compile of the app plus widget extension takes 5–15 minutes;
incremental builds after that take seconds.

## 7. Trust the developer on the phone

One time per certificate. If the app installs but won't launch with *"Untrusted
Developer"*:

Settings → General → VPN & Device Management → *your team* → **Trust**

## 8. Start the backend

In a separate terminal, from the repo root:

```bash
pnpm dev:backend
```

Runs `nodemon app.js`, loading `backend/.env.dev` and listening on
`0.0.0.0:8000`. **`0.0.0.0`, not `127.0.0.1`** — that's what makes it reachable
from the phone. It points at the hosted dev Supabase, so no local Docker stack
is needed.

Verify from the Mac:

```bash
curl -s http://<your-lan-ip>:8000/health
```

Then **from the phone** — open Safari on the device and visit the same URL. If
the Mac responds but the phone doesn't, it's the network: different SSIDs, or
the router has AP/client isolation enabled (common on guest networks).

If iOS prompts *"Pantopus would like to find and connect to devices on your
local network"*, tap **Allow**. Denying it makes every request fail; undo at
Settings → Privacy & Security → Local Network → Pantopus.

## 9. Confirm it's live

Sign in with a hosted-dev test account (credentials are not committed — ask the
team). Watch the `pnpm dev:backend` terminal: request logs appearing as you tap
through the app is the proof the device is reaching your Mac.

---

## Command-line alternative

Once signing works, the whole loop runs headless. Xcode must have run at least
once so the profiles exist.

Get the device UDID:

```bash
xcrun devicectl list devices
```

Build, install, launch:

```bash
cd frontend/apps/ios
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus -configuration Debug \
  -destination "platform=iOS,id=<UDID>" \
  -derivedDataPath build -clonedSourcePackagesDirPath SourcePackages build

xcrun devicectl device install app --device <UDID> \
  build/Build/Products/Debug-iphoneos/Pantopus.app

xcrun devicectl device process launch --device <UDID> app.pantopus.ios
```

Note `make build` is **simulator-only** — it hardcodes
`platform=iOS Simulator`, hence the explicit `-destination`.
`-clonedSourcePackagesDirPath SourcePackages` reuses the package cache and keeps
~12k third-party files out of `git status`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Signing for 'Pantopus' requires a development team" | A `make` command regenerated the project and wiped a UI-set team | Confirm the team is in `project.yml`, re-run `make bootstrap` |
| "Failed to register bundle identifier" / "No profiles were found" | Portal role can't create App IDs | Create `app.pantopus.ios`, `app.pantopus.ios.widgets`, `group.app.pantopus.ios` manually, then **Try Again** |
| App launches, every screen stuck loading | Backend down, or the Mac's IP changed | `curl http://<ip>:8000/health`; if the IP moved, update `.env` → `make bootstrap` → rebuild |
| "Untrusted Developer" | Certificate not trusted on device | Settings → General → VPN & Device Management → Trust |
| Device greyed out in the destination list | Phone locked, or Developer Disk Image not mounted | Unlock, replug USB, wait for "Preparing debugger support" |
| Build reports "(N failures)" with no visible error | Known transient Xcode frontend crash | Retry the build |
| Worked yesterday, dead today | DHCP assigned a new address | `ipconfig getifaddr en0`, update `.env`, rebuild |

iOS builds are disk-hungry — `DerivedData/` alone reaches several GB. `make clean`
reclaims it, at the cost of a full package re-resolve.

---

## Day-to-day loop

| Changed | Run |
|---|---|
| Swift source only | ⌘R |
| `.env` (IP change) or `project.yml` | `make bootstrap`, then ⌘R |
| Backend code | Nothing — nodemon hot-reloads |

Two commands cover most of it: `pnpm dev:backend` in one terminal, ⌘R in Xcode.
