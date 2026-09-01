# Pantopus iOS — build context

Conventions for screens, networking, and shared archetypes. Keep this short
and current; longer prose lives in `README.md` and `docs/07-frontend-mobile-app.md`.

## MVVM + `@Observable`

- Each feature folder is `Features/<Feature>/` with at minimum a `…View.swift`
  and a `…ViewModel.swift`.
- View-models are `@Observable @MainActor public final class`. Hold a
  `public private(set) var state: <FeatureState>` (a `Sendable` enum with
  cases like `.loading / .loaded(_) / .empty(_) / .error(message:)`) plus any
  fine-grained published fields the view binds to (`activeIntent`,
  `searchText`, …).
- Views are `public struct …View: View` with `@State private var viewModel:
  <ViewModel>` initialised by the caller. **No side effects in views** — kick
  load in `.task { await viewModel.load() }`, kick refetch in
  `.refreshable { await viewModel.refresh() }`.
- Concurrency is strict. Cross-actor work via `Task { @MainActor in … }` or
  `await` only.

## Adding an endpoint

1. Add a static helper to (or create) `Core/Networking/Endpoints/<Feature>Endpoints.swift`.
   Each helper returns an `Endpoint(method:, path:, query:, body:)` and **must**
   carry a doc-comment with the backend route file + line (e.g.
   `Route backend/routes/gigs.js:3608`).
2. DTOs live under `Core/Networking/Models/<Feature>/<Feature>DTOs.swift` —
   one file per feature. Each DTO is `public struct …: Decodable, Sendable,
   Hashable` (Identifiable when it has an `id`).
3. Call from a view-model via `try await APIClient.shared.request(endpoint)`
   — the assignment-target type drives `T` inference. Use the
   `_ = try await client.request(endpoint, as: T.self)` overload only when
   you need to discard the result.

## Snake_case → camelCase

- **REST DTOs:** declare an inner `enum CodingKeys: String, CodingKey` with
  explicit snake_case mappings on every field that differs. `APIClient` does
  **not** apply `convertFromSnakeCase`.
- **Socket payloads:** `SocketClient` **does** apply `convertFromSnakeCase`,
  so DTOs decoded from socket frames omit explicit `CodingKeys`. See
  `ChatDTOs.swift` for both shapes co-existing.

## Shared archetypes

Reuse before building bespoke. The four shells live under `Features/Shared/`:

| Archetype | Contract | When to reuse |
|-----------|----------|---------------|
| **ListOfRows** | `ListOfRowsView<DataSource: ListOfRowsDataSource>`. Data-source protocol exposes `title / topBarAction / tabs / selectedTab / fab / state` + `load() / refresh() / loadMoreIfNeeded()`. Rows are `RowModel`s with typed `RowLeading` / `RowTrailing`. | Any single-list-of-cells screen: My Homes, My Claims, Mailbox list, drawers. |
| **Wizard** | `WizardShell` + `WizardState` + `WizardChrome` (leading control, progress label, secondary CTA) + `WizardStep`. | Multi-step flows with linear progress: Add Home, Claim Ownership, Invite Owner, Disambiguate. |
| **Form** | `FormShell` + `FormState` (per-`FormFieldState` `original / current / error`) + `FormAggregate` (`isDirty / isValid`) + `FormValidation`. | Single-page editors: Edit Profile, simple settings. |
| **ContentDetail** | `ContentDetailShell<HeaderView, BodyView, CTAView>` + `ContentDetailTopBar`. Generic over three slot views. | Read-only detail surfaces that aren't transactional (Pulse post, public profile, mailbox item). |

Build bespoke only when the design's variable middle section or chrome can't
be expressed as a slot in one of these. The T2.6 Transactional Detail shell
(`Features/ContentDetail/ContentDetailShell.swift`) is a separate bespoke
shell for gig/listing/invoice — its sealed `ContentDetailModule` enum is the
canonical example of how to render a backend-driven `jsonb_modules[]`.

## Design tokens — **never hardcode**

- Colour: `Theme.Color.<token>` (`primary600`, `appText`, `successBg`,
  `business`, …). Listing/category accents that need a per-row swatch live on
  the category enum itself (`GigsCategory.color`).
- Spacing: `Spacing.s1 (4) / s2 (8) / s3 (12) / s4 (16) / s5 (20) / s10 (40)
  / s12 (48) / s16 (64)`.
- Type: `.font(.system(size: 14, weight: .semibold))` is the local pattern
  (we don't have a single `Typography` namespace yet — sizes are inlined per
  designer-supplied frame, kept under SwiftLint's eye).
- Icons: `Icon(.pantopusIconCase, size:, strokeWidth:, color:)` only — direct
  `Image(systemName:)` is rejected by `make verify-icons`.
- Radii: `Radii.xs / sm / md / lg / pill`.
- Hex literals in `Features/**` will trip the CI hex-grep guard. Tokens-only.

## State rule

Every fetchable surface ships four states:

1. **Loading** → `FeedSkeletonCard` (`Features/Shared/Feed/FeedComponents.swift`)
   or a hand-rolled shimmer that mirrors the loaded geometry. **Never** a
   `ProgressView` masquerading as a screen-level "Loading…" spinner.
2. **Empty** → `EmptyState` (`Core/Design/Components/EmptyState.swift`) with
   icon + headline + body + primary CTA. Include scope/radius hint when
   relevant.
3. **Loaded** → content.
4. **Error** → headline + body + Retry button wired to `viewModel.refresh()`.

Wrap the screen body in `.offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)`
so the offline strip auto-appears.

## Navigation

- Each tab owns a `…TabRoot` with a `NavigationStack(path:)` and a typed
  `…Route: Hashable` enum.
- To add a destination: extend the route enum, add a `case` in `destination(for:)`,
  and push from the appropriate callback. Keep the route enum case-free of
  closures — only `Hashable` payloads (ids, strings, small structs).
- Hub → pillar dispatch is in `HubTabRoot.swift`'s `hub` block; jumpBackIn
  string → route mapping lives in `route(forJumpBackIn:)`.

## Parity

For every change, the Android counterpart must:
- expose the same render states,
- carry the same `accessibilityIdentifier(…)` strings (mirror naming as
  Android `Modifier.testTag(…)`),
- hit the same backend endpoint with the same query params.

When in doubt, write the test first against the projection, mirror to
Android, then mirror the screen.

## Testing

- Networking-bound projections: drive `APIClient(retryPolicy: .none, session:
  SequencedURLProtocol.makeSession())` with `SequencedURLProtocol.sequence =
  [.status(200, body: …), …]`.
- Tests live under `PantopusTests/Features/<Feature>/<…>Tests.swift` and use
  `@MainActor final class … : XCTestCase`.

## Performance / build

- `make bootstrap && make open` regenerates the project from `project.yml`.
- `make test` runs the unit suite. CI also runs the SwiftLint hex-grep guard
  and per-target coverage report.
