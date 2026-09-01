# Pantopus iOS

Native iOS app for Pantopus, built with Swift 5.10 (strict concurrency),
SwiftUI with `@Observable`, and iOS 17+.

## Design tokens

All Pantopus design-system tokens live in `Pantopus/Core/Design/`:

| File               | Entry point                                          |
|--------------------|------------------------------------------------------|
| `Theme.swift`      | Top-level namespace: `Theme.Color`, `Theme.Font`     |
| `Colors.swift`     | `Theme.Color.primary600`, …                          |
| `Spacing.swift`    | `Spacing.s4` (= 16 pt), …                            |
| `Radii.swift`      | `Radii.xl` (= 16 pt), …                              |
| `Shadows.swift`    | `.pantopusShadow(.md)` view modifier                 |
| `Typography.swift` | `.pantopusTextStyle(.h1)`, `Theme.Font.h1`           |

Colors live in the asset catalog under
`Pantopus/Resources/Assets.xcassets/Colors/` — each `.colorset` ships with
identical light and dark appearances so designers can layer real dark
overrides later without touching call sites.

**Call sites MUST use tokens.** PRs that add raw hex (`Color(red: …)`), raw
point literals (`.padding(12)`), or `.font(.system(size: …))` to feature code
will be rejected. The CI check
`grep -rnE '#[0-9a-fA-F]{6,8}' Pantopus/Features` must return no hits.

**Preview the gallery** in debug builds by tapping the Home screen title five
times — opens `TokenGalleryView` showing every token side-by-side. The view
is compiled only when `DEBUG` is defined. From the token gallery, tap the
"Icon gallery" row to reach [IconGalleryView](Features/_Internal/IconGalleryView.swift).

## Icons

All icons route through the typed [`PantopusIcon`](Core/Design/Icons.swift)
enum and the [`Icon`](Core/Design/Icons.swift) view — never through
`Image(systemName:)` directly. The rendering layer currently maps each case
to the closest SF Symbol; swapping to real Lucide SVGs touches
`Icons.swift` only.

`make verify-icons` (wired into `make lint`) fails if feature code calls
`Image(systemName:)`.

## Networking

All HTTP calls route through [`APIClient`](Core/Networking/APIClient.swift).
Feature code never constructs `URLSession` itself; `grep -n
"URLSession.shared" frontend/apps/ios/Pantopus/Features` must return
nothing.

- **Endpoints** are typed, per-feature builders under
  [Core/Networking/Endpoints/](Core/Networking/Endpoints/) — `AuthEndpoints`,
  `UsersEndpoints`, `HubEndpoints`, `HomesEndpoints`, `MailboxEndpoints`,
  `MailboxV2Endpoints`. Each function cites the exact backend route it
  targets.
- **DTOs** live under [Core/Networking/Models/](Core/Networking/Models/)
  grouped by feature. Every struct carries a route-file citation on its
  doc comment so renames/removals can be traced. Untyped payloads
  (provider-dependent, e.g. hub/today, ATTOM suggestions) use
  [`JSONValue`](Core/Networking/Models/Common/JSONValue.swift) rather than
  invented shapes.
- **Errors** are the typed [`APIError`](Core/Networking/APIError.swift)
  enum: `invalidURL`, `invalidResponse`, `unauthorized`, `forbidden`,
  `notFound`, `clientError(status:message:)`, `server(status:body:)`,
  `transport(URLError)`, `decoding(Error)`, `retriesExhausted`. Switch
  on cases in the UI rather than inspecting status codes.
- **Retry.** Idempotent GETs are retried up to 2 additional times on 5xx
  / transient `URLError`s with 300ms and ~900ms jittered delays. POST/
  PATCH are never retried.
- **Cache.** The client owns a dedicated `URLSession` with a 10MB memory
  / 50MB disk `URLCache`; ETag and `If-None-Match` handling is automatic.
  Pass `cachePolicy: .reloadIgnoringLocalCacheData` on the `Endpoint` to
  opt out (e.g. `GET /api/hub` which is no-store server-side).

## Building

- `make bootstrap` — generates `Pantopus.xcodeproj` from `project.yml`.
- `make build` — compiles the app for the iPhone 15 simulator.
- `make test` — runs unit + UI tests.
- `make lint` — SwiftLint.

`xcodegen` must be installed (`brew install xcodegen`). The project file is
regenerated from `project.yml` and is **not** committed.
