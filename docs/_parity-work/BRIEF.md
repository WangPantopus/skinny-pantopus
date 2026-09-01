# Shared brief — RN → native high-severity parity fixes

You are implementing ONE work package from
`docs/rn-functional-parity.md` (the "High-severity findings (64)" section).
**You implement BOTH platforms** — iOS (Swift/SwiftUI) and Android (Kotlin/Compose).
Parity between the two apps is your responsibility, not a later step.

## Repo map (absolute paths)

| What | Path |
|---|---|
| iOS app | `/Users/yingpengwang/pantopus/native/pantopus/frontend/apps/ios` |
| iOS source root | `…/frontend/apps/ios/Pantopus` |
| Android app | `/Users/yingpengwang/pantopus/native/pantopus/frontend/apps/android` |
| Android source root | `…/frontend/apps/android/app/src/main/java/app/pantopus/android` |
| **RN reference (behaviour truth)** | `/Users/yingpengwang/pantopus/native/pantopus/pantopus/frontend/apps/mobile` |
| RN typed API client | `/Users/yingpengwang/pantopus/native/pantopus/pantopus/frontend/packages/api/src/endpoints` |
| **Backend (endpoint truth)** | `/Users/yingpengwang/pantopus/native/pantopus/backend` |
| **Designs (visual truth)** | `/Users/yingpengwang/pantopus/native/pantopus/reference/all-designs2/all-designs 2` |
| iOS conventions | `frontend/apps/ios/CLAUDE.md` — **read it** |
| Android conventions | `frontend/apps/android/CLAUDE.md` — **read it** |

## Step 0 — verify the endpoint before you write a line of client code

The parity doc quotes endpoints in shorthand and **some of it is drift**. For every
route you are about to call:

1. Find the mount prefix in `backend/app.js` (`grep -n "^app.use('/api" backend/app.js`).
2. Find the route-relative declaration in `backend/routes/<file>.js`
   (`grep -nE "^router\.(get|post|patch|put|delete)" backend/routes/<file>.js`).
3. Compose the real full path and read the handler to learn the **real request body
   shape, query params, and response shape**. Decode exactly those field names.

Known drift already found: the doc says `GET /api/identity-search`; the real route is
`GET /api/identity/search` (`app.js:357` + `routes/identitySearch.js:370`).

**If a route genuinely does not exist in the backend, DO NOT invent it and DO NOT ship
fake data.** Implement everything else in your package, and report the missing route in
your result under `deferred` with the evidence (files grepped). Never replace a missing
endpoint with sample/fixture data.

## Step 1 — read the RN implementation

The parity doc gives you the exact RN file:line. Read it. RN is the truth for
*behaviour*: which actions exist, what they send, what states they render, what the
error/empty/confirm copy is, what is optimistic vs. awaited.

## Step 2 — read the design

Designs are static HTML frames under the designs path above, grouped by archetype
(A08 per-screen batch 1, A10 Detail: Content, A13 Form, A14 Settings list,
A17 Mailbox, A-12 Wizard, …). Some folders also carry `*-frames.jsx` — where a
`-frames.jsx` exists it is the higher-fidelity source and **1px = 1dp/1pt**.
Match layout, hierarchy, spacing, and states. If no frame exists for your screen,
follow the nearest archetype frame plus the shared archetype shells.

## Step 3 — implement

### iOS
- MVVM: `@Observable @MainActor public final class …ViewModel` + `public struct …View: View`.
- Endpoints: **create a NEW `Core/Networking/Endpoints/<Feature>Endpoints.swift`**
  when your package needs several routes, rather than piling into a heavily-shared
  existing file — it avoids merge contention with sibling agents. Each helper carries a
  doc-comment naming the backend route file + line.
- DTOs: `Core/Networking/Models/<Feature>/…DTOs.swift`, `Decodable, Sendable, Hashable`,
  explicit snake_case `CodingKeys` (APIClient does **not** convertFromSnakeCase).
- Call sites: `try await APIClient.shared.request(endpoint)`.
- Reuse the shared archetypes (`ListOfRowsView`, `WizardShell`, `FormShell`,
  `ContentDetailShell`) before building bespoke.
- Tokens only: `Theme.Color.*`, `Spacing.s*`, `Radii.*`, `Icon(.case, …)`.
  **No hex literals, no `Image(systemName:)`** — CI greps for both.

### Android
- MVVM + Hilt: `@HiltViewModel class … @Inject constructor(...) : ViewModel()`,
  `sealed interface …UiState { Loading/Empty/Loaded/Error }`, `StateFlow`.
- Retrofit interface under `data/api/services/<Feature>Api.kt` (new file preferred, same
  contention reason), Moshi DTOs under `data/api/models/<feature>/…Dtos.kt` with
  `@Json(name = "snake_case")`, repository under `data/<feature>/` using `safeApiCall {}`.
- **Register every new Api interface** in `di/NetworkModule.kt` with a
  `@Provides @Singleton fun provideXApi(retrofit: Retrofit): XApi = retrofit.create(XApi::class.java)`.
- Tokens only: `PantopusColors.*` / `PantopusTheme.tokens.*`, `Spacing.s*`, `Radii.*`,
  `PantopusIconImage(icon = PantopusIcon.X, …)`.
  **No `Color(0xFF…)`, no `Icons.Filled.*`, no on-scale `.dp` literals** in `ui/screens/**`.

### Both
- Every fetchable surface ships four states: Loading (skeleton/shimmer, never a bare
  spinner), Empty (`EmptyState` with icon + headline + body + CTA), Loaded, Error
  (headline + body + Retry wired to `refresh()`).
- Mirror `accessibilityIdentifier(…)` (iOS) ↔ `Modifier.testTag(…)` (Android) strings.
- Destructive actions get a confirm (iOS `confirmationDialog`/`alert`, Android
  `AlertDialog`) naming the thing being destroyed, matching RN's copy.

## Shared files — edit discipline (IMPORTANT)

Sibling agents are working in the same tree at the same time. On any file you did not
create — and **especially** these:

- `frontend/apps/ios/Pantopus/Features/Root/HubTabRoot.swift`
- `frontend/apps/ios/Pantopus/Features/Root/YouTabRoot.swift`
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/root/RootTabScreen.kt`
- `frontend/apps/android/app/src/main/java/app/pantopus/android/di/NetworkModule.kt`

…you **must** use the `Edit` tool with a small, unique anchor string. **Never `Write`** a
file you did not create. If an `Edit` fails because the file changed under you, re-`Read`
it and retry — that failure means a sibling agent just edited it, and retrying is correct.
Keep each edit as small as possible.

## Compile traps that already cost a wave (do not repeat these)

1. **Kotlin block comments NEST.** A KDoc containing a path like
   `` `/api/v1/tenant/*` `` or `` `ui/screens/review_claims/*` `` opens a nested comment
   that is never closed, and the file fails with `Unclosed comment` at EOF — which then
   masks itself as a flood of Hilt/KSP `error.NonExistentClass` failures across every
   unrelated module. Write `` `/api/v1/tenant/…` `` instead. Never put `/*` inside a
   comment.
2. **iOS: a `public init` cannot take an internal type.** `APIClient` is internal, so
   view-model initialisers that accept `api: APIClient = .shared` must be declared
   `init(` — not `public init(`. Match `MembersListViewModel.swift:204`.
3. **Kotlin `when` over a `Long`** needs `0L ->` / `1L ->`, not `0 ->`.

## Do NOT

- Do **not** run `make build`, `./gradlew`, or `xcodebuild`. A compile gate runs after
  your wave; builds from parallel agents thrash the same DerivedData/Gradle caches.
- Do **not** `git commit`, `git checkout`, or `git stash`.
- Do **not** leave `TODO`/placeholder handlers where the finding asked for a real action.
- Do **not** invent backend routes or ship sample/fixture data as if it were live data.
- Do **not** touch files outside your package's scope.

## Report back (your final text IS the return value)

Return JSON only, matching the schema you were given: what you changed per platform,
which endpoints you verified (with backend file:line), anything deferred and why.
