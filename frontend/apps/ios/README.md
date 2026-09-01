# Pantopus iOS

Native iOS app for Pantopus, built with Swift 5.10, SwiftUI, and the iOS 17 Observation framework.

## Stack

| Layer          | Choice                                                           |
|----------------|------------------------------------------------------------------|
| Language       | Swift 5.10 (strict concurrency)                                  |
| Minimum iOS    | 17.0                                                             |
| UI             | SwiftUI + `@Observable`                                          |
| Navigation     | `NavigationStack` / `TabView`                                    |
| Networking     | URLSession + async/await                                         |
| Realtime       | [Socket.IO-Client-Swift](https://github.com/socketio/socket.io-client-swift) |
| Payments       | [Stripe iOS SDK](https://github.com/stripe/stripe-ios) (PaymentSheet, Apple Pay) |
| Secure storage | [KeychainAccess](https://github.com/kishikawakatsumi/KeychainAccess) |
| Logging        | [swift-log](https://github.com/apple/swift-log)                  |
| Project gen    | [XcodeGen](https://github.com/yonaskolb/XcodeGen) via `project.yml` |
| CI/CD          | Fastlane (`beta`, `release` lanes)                               |
| Lint / format  | SwiftLint, SwiftFormat                                           |

## Layout

```
frontend/apps/ios/
├── project.yml                   # XcodeGen — source of truth for the Xcode project
├── Makefile                      # bootstrap, build, test, lint, format
├── Gemfile                       # Fastlane + xcodeproj gems
├── .env.example                  # Local env template (copy to .env)
├── .swiftlint.yml, .swiftformat  # Lint / format configs
├── fastlane/
│   ├── Appfile                   # Bundle ID, Apple ID, team IDs
│   └── Fastfile                  # test / beta / release lanes
├── Pantopus/                     # App source
│   ├── App/                      # Entry point, AppDelegate
│   ├── Core/                     # Environment, Networking, Auth, Realtime, Logging
│   ├── Features/                 # Auth, Home, Feed (add feature folders here)
│   ├── Resources/                # Info.plist, entitlements, Assets.xcassets
│   └── Preview Content/          # Debug-only assets for #Preview
├── PantopusTests/                # Unit tests
└── PantopusUITests/              # UI tests
```

The `Pantopus.xcodeproj` is NOT committed. It's generated from `project.yml` by XcodeGen. Run `make bootstrap` before opening in Xcode.

## Prerequisites

- macOS (Xcode is macOS-only)
- **Xcode 15.4+** (Swift 5.10, iOS 17 SDK)
- Homebrew

```bash
brew install xcodegen swiftlint swiftformat fastlane
```

## First-time setup

```bash
cd frontend/apps/ios
cp .env.example .env
make bootstrap
make open            # opens Pantopus.xcodeproj in Xcode
```

Then in Xcode:
1. Select the `Pantopus` target → **Signing & Capabilities**.
2. Set **Team** to your Apple developer team. Bundle ID stays `app.pantopus.ios`.
3. Pick an iPhone simulator (e.g. iPhone 15).
4. ⌘R to run.

## Common tasks

| Task                            | Command                                |
|---------------------------------|----------------------------------------|
| Regenerate Xcode project        | `make bootstrap`                       |
| Open in Xcode                   | `make open`                            |
| Build for simulator             | `make build`                           |
| Run unit + UI tests             | `make test`                            |
| Lint                            | `make lint`                            |
| Format in place                 | `make format`                          |
| Clean build + generated project | `make clean`                           |
| TestFlight upload               | `make beta` (needs Apple cert setup)   |
| App Store submission            | `make release`                         |

## Architecture

The app follows an MVVM structure with strict concurrency and the new `@Observable` macro (no more `ObservableObject` + `@Published`).

- **`AppEnvironment`** — resolves the API/socket base URLs and Stripe key. Honours the scheme env var `PANTOPUS_API_ENV` (`local` / `staging` / `production`) when set, otherwise falls back per build configuration: Debug → `.local`, the `Pantopus (Staging)` scheme → `.staging`, Release → `.production`. Per-config values come from `Config/Pantopus.{Debug,Staging,Release}.xcconfig` (overlaid by the gitignored `Secrets.xcconfig`); staging/prod URLs are `https://`-guarded so a stray localhost value can't reach a shipped build. See [`docs/release/prod-config-checklist.md`](../../../docs/release/prod-config-checklist.md).
- **`APIClient`** — URLSession-based, async/await. Auto-attaches `Authorization: Bearer <token>` to authenticated endpoints, decodes JSON with snake_case → camelCase conversion, maps `401` → `AuthManager.handleUnauthorized()`.
- **`AuthManager`** — `@Observable` `@MainActor`. Owns `State { unknown | signedOut | signedIn(user) }`, persists tokens to the Keychain via `KeychainStore`, restores the session on launch.
- **`SocketClient`** — Socket.IO wrapper. Exposes events as `AsyncStream<T: Decodable>` for clean `for await` usage in view models.
- **`Features/*`** — feature-scoped folders. Each screen has a `View` + a view model (`@Observable final class`). Keep side effects in view models; keep views pure.

## Adding a new feature

1. Create `Pantopus/Features/YourFeature/` with `YourFeatureView.swift` and `YourFeatureViewModel.swift`.
2. Add the relevant DTO to `Pantopus/Core/Networking/Models/Models.swift`.
3. Hit the API through the shared `APIClient.shared.request(…)` — don't spin up new URLSessions.
4. If you introduce a new SPM package, add it to `project.yml`'s `packages:` section and the target's `dependencies:`, then run `make bootstrap`.

## Push notifications

`AppDelegate.didRegisterForRemoteNotificationsWithDeviceToken` forwards the APNs token to `POST /api/notifications/register` with `platform: "ios"`. The backend currently routes through `expo-server-sdk` for historical reasons — see [`docs/push-native-migration.md`](../../../docs/push-native-migration.md) for the migration plan to direct APNs.

## Device-on-LAN testing

Running the app on a physical device but the backend on your Mac? The simulator's `localhost` won't work. Options:

1. Set `PANTOPUS_API_BASE_URL` and `PANTOPUS_SOCKET_URL` in `.env` to your Mac's LAN IP, then run `make bootstrap`.
2. Use [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) to expose the backend.

For the full device workflow — code signing, the App IDs automatic signing has
to create, and why a UI-set Team doesn't survive `make` — see
[`docs/device-build-runbook.md`](docs/device-build-runbook.md).

## Release checklist

See `fastlane/Fastfile`. At minimum, before `make beta`:

- [ ] `match` is set up for code signing (`fastlane match init`).
- [ ] `.env` has the production Stripe key.
- [ ] `CURRENT_PROJECT_VERSION` and `MARKETING_VERSION` in `project.yml` are bumped.
- [ ] `make test` passes locally.

## CI

PRs touching `frontend/apps/ios/**` trigger
[`.github/workflows/ios-ci.yml`](../../../.github/workflows/ios-ci.yml).
Three jobs run in parallel:

1. **Lint** — SwiftLint `--strict`, SwiftFormat `--lint`, and the
   raw-hex grep guard from P1.
2. **Tests** — matrix over **iPhone 15 / iPhone 13 / iPhone SE (3rd gen)**.
   Each leg runs `make test` with code coverage on. The leg uploads
   the `.xcresult` bundle plus a JSON coverage report; the per-target
   coverage summary is also written to the workflow's step summary so
   PR reviewers see it inline.
3. **Build** — clean Debug build for the simulator. Gated on Lint.

Local equivalents: `make lint`, `make test`, `make build`.
