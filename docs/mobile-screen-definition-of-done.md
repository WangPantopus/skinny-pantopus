# Mobile screen — universal Definition of Done

Every mobile screen — iOS and Android — must clear this checklist before it
is considered done. The acceptance gate is binary: a screen either meets
every box or it doesn't ship.

Per-platform conventions (file paths, naming, helpers) are in
`frontend/apps/ios/CLAUDE.md` and `frontend/apps/android/CLAUDE.md`. This
doc covers what must be **true** of the finished surface, not how to write
it.

---

## 1. Visual fidelity

- Pixel-accurate against the designer-supplied frame(s) at the canonical
  device width (iPhone 15 / Pixel 6 by default).
- All chrome (top bar, search, chip rows, dock, FAB) sits at the exact
  inset, height, and padding the design specifies.
- Typography matches the design's size + weight + leading + tracking; no
  inline overrides that drift from spec.
- All gradients, shadows, blurs, and tinted overlays match the design.

## 2. Token discipline

- **Zero** hardcoded hex colours, raw `.dp` / `.sp` / point literals in
  feature code (`ui/screens/**`, `Features/**`).
  - Permitted exceptions: width/height for fixed-geometry shapes that are
    not on the design-token scale (e.g. a 22 dp pin dot whose value is part
    of a design spec encoded on the model).
- Colour → `Theme.Color.<token>` (iOS) / `PantopusColors.<token>` or
  `PantopusTheme.tokens.…` (Android).
- Spacing → `Spacing.s<n>` on both platforms.
- Radii → `Radii.<step>` on both platforms.
- Icons → `Icon(.<case>, …)` / `PantopusIconImage(icon = PantopusIcon.<Case>,
  …)`. Direct SF Symbol / Material icon imports in feature code are
  rejected by CI.
- The CI hex-grep guard passes (`make lint` / `./gradlew detekt`).

## 3. Four states

Every fetchable surface renders **all four** states cleanly:

1. **Loading** — shimmer skeleton that mirrors the loaded geometry. The
   first paint must not pop on data arrival. **Never** a screen-level
   `ProgressView` / `CircularProgressIndicator` "Loading…" spinner.
2. **Empty** — shared `EmptyState` (iOS) / `EmptyState` (Android) with
   icon + headline + body + primary CTA. Include scope / radius hint pill
   when the filter implies one.
3. **Loaded** — the content.
4. **Error** — recoverable. Headline + body + `Retry` button wired to
   `viewModel.refresh()`. Errors are surfaced as readable copy, never raw
   exception text.

Plus the cross-cutting **Offline** banner: wrap the screen body in the
shared `OfflineBanner` modifier / composable so the strip auto-appears
when `NetworkMonitor` / equivalent flips false.

## 4. Archetype reuse

Before building bespoke, check the four shared shells in
`Features/Shared/*` (iOS) and `ui/screens/shared/*` (Android):

- **ListOfRows** — `ListOfRowsDataSource` (iOS) / `ListOfRowsUiState`
  (Android). Use for any single-list-of-cells screen.
- **Wizard** — `WizardShell` + `WizardState` / `WizardModel`. Use for
  multi-step linear flows.
- **Form** — `FormShell` + `FormState` + validation helpers. Use for
  single-page editors.
- **ContentDetail** — `ContentDetailShell` slot generic. Use for read-only
  detail surfaces. (Transactional details — gig / listing / invoice — use
  the bespoke T2.6 shell with the sealed `ContentDetailModule` so backend
  `jsonb_modules[]` can extend without touching the shell.)

A new bespoke shell is only acceptable when the design's geometry or
state machine can't fit into one of the above. Justify in the commit
message.

## 5. Full wiring

- Every interactive element (back chevron, top-bar action, chip, FAB,
  sticky CTA, row tap, sheet) does something — either calls a real backend
  or pushes a typed route. No dead taps.
- Optimistic mutations (likes, sends, saves, RSVPs, bid placement) roll
  back on failure with a user-readable error.
- No `print` / `Timber.d` log spam in feature code beyond intentional
  observability calls (`Analytics.track(…)`, `observability.capture(…)`).

## 6. Networking

- Endpoint helper exists in `Core/Networking/Endpoints/<Feature>Endpoints.swift`
  (iOS) or `data/api/services/<Feature>Api.kt` (Android), with a
  doc-comment citing the backend route file + line.
- Repository (Android) or APIClient call (iOS) is invoked from the
  view-model — views never reach into networking themselves.
- All errors flow through `NetworkResult<T>` (Android) / `APIError` (iOS)
  and surface as a `.error(message:)` state, never an uncaught throw.

## 7. DTOs

- Live under `Core/Networking/Models/<Feature>/<…>DTOs.swift` (iOS) or
  `data/api/models/<feature>/<…>Dtos.kt` (Android), one file per feature.
- Field naming is camelCase with explicit snake_case → camelCase mappings
  per the platform's convention (`CodingKeys` on iOS, `@Json(name = …)` on
  Android). No reliance on `convertFromSnakeCase` for REST DTOs.
- `Sendable` (iOS) / `@Immutable data class` (Android). `Identifiable` /
  `id: String` on every row DTO that lands in a list.

## 8. Navigation

- Destination is added to the typed route enum (iOS `…Route: Hashable`,
  Android `ChildRoutes` const string).
- Pushed via a builder helper, not raw string concat (Android) or via
  `path.append(.case(…))` with a typed payload (iOS).
- Back behaviour returns to the originating list / map / hub without
  duplicating the route on the stack.
- Deep-link jumpBackIn / web-route inputs that already exist on either
  side are mapped (`route(forJumpBackIn:)` on iOS,
  `routeForJumpBackIn(…)` on Android).

## 9. Accessibility

- Headers carry `.accessibilityAddTraits(.isHeader)` (iOS) /
  `Modifier.semantics { heading() }` (Android).
- Interactive elements carry a spoken label
  (`.accessibilityLabel("…")` / `contentDescription = "…"`).
- Every test-targetable element carries a stable identifier:
  `.accessibilityIdentifier("featureName_subElement_…")` on iOS and
  `Modifier.testTag("featureName_subElement_…")` on Android. **The same
  string lives on both platforms** so cross-platform UI tests can mirror.
- Touch targets ≥ 44 pt (iOS) / 48 dp (Android).
- VoiceOver / TalkBack traversal order matches reading order.
- Decorative icons are accessibility-hidden.

## 10. Tests

- Projection / state-transition tests: the view-model under
  `PantopusTests/Features/<Feature>/<…>Tests.swift` (iOS) or
  `app/src/test/java/.../<feature>/<…>Test.kt` (Android) covers at minimum:
  - `load → loaded` when the backend returns rows
  - `load → empty` when it returns none
  - `load → error` when it 5xxes
  - any filter / sort / chip change that triggers a refetch
  - any optimistic mutation that rolls back on failure
- Snapshot tests (Android: Paparazzi) — every fixed visual frame the
  screen ships gets a baseline. Record with `./gradlew paparazziRecord`
  after intentional changes.
- iOS UI tests for the golden path of any screen that owns a multi-step
  flow.

## 11. Parity

- iOS and Android render the same set of states (`Loading / Empty /
  Loaded / Error`) for the same backend inputs.
- Both platforms call the same backend endpoint with the same query
  params and decode the same DTO shape.
- Test identifiers (`accessibilityIdentifier` ↔ `testTag`) match by
  string.
- Token usage is symmetric (same colour / spacing / radii token names,
  same icon glyphs).
- Same commit / branch contains both platforms' changes — never land one
  side without the other unless the brief explicitly says so.

## 12. Quality gates

- `make lint && make test` (iOS) and
  `./gradlew ktlintCheck detekt test paparazziVerify :app:assembleDebug`
  (Android) pass locally.
- CI green on both `ios-ci.yml` and `android-ci.yml`.
- No new `// TODO`s without a tracking link to the follow-up task they
  defer.
- Commit message names the tier + task (`T2.3 Gigs — …`), summarises
  per-platform changes in bullet form, lists explicit scope notes for
  anything intentionally deferred.
