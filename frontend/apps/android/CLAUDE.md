# Pantopus Android — build context

Conventions for screens, networking, DI, and shared archetypes. Keep this
short and current; longer prose lives in `README.md` and
`docs/07-frontend-mobile-app.md`.

## MVVM + Hilt + StateFlow

- Each feature folder is `ui/screens/<feature>/` with a `…Screen.kt` and a
  `…ViewModel.kt`. Content + state types live alongside (or in a
  `…Content.kt` file when they get large).
- View-models are `@HiltViewModel class … @Inject constructor(...) :
  ViewModel()`. Inject repositories (and `SavedStateHandle` when reading
  nav args). Never inject Retrofit or DataStore directly.
- UI state is a `sealed interface <Feature>UiState` with `Loading / Empty /
  Loaded / Error` cases. Expose via `private val _state = MutableStateFlow(…);
  val state: StateFlow<…> = _state.asStateFlow()`. Same shape for any
  per-screen mutable signals (`activeCategory`, `searchText`, …).
- Screens collect with `viewModel.state.collectAsStateWithLifecycle()` and
  kick `viewModel.load()` in a `LaunchedEffect(Unit) { … }`.
- Coroutines launch on `viewModelScope`. Parallel work uses explicit
  `async { … }.await()` pairs — avoid `awaitAll(...)` over heterogeneous
  `Deferred` types.

## Adding an endpoint

1. Add a method to (or create) `data/api/services/<Feature>Api.kt`, a
   Retrofit interface. Each method carries a doc-comment with the backend
   route file + line (e.g. `Route backend/routes/gigs.js:3608`). Query
   params are `@Query("snake_case")`, path params `@Path("id")`, JSON body
   `@Body`.
2. DTOs live under `data/api/models/<feature>/<…>Dtos.kt`. Use
   `@JsonClass(generateAdapter = true) data class …` with `@Json(name =
   "snake_case")` on every field that differs from camelCase.
3. Wrap call sites in a `<Feature>Repository` under `data/<feature>/` that
   uses `safeApiCall { api.…() }` to map throwables into the
   `NetworkResult<T>` taxonomy (`Success / Failure(NetworkError)`).
4. Register the API in `di/NetworkModule.kt`:
   ```kotlin
   @Provides @Singleton
   fun provideXApi(retrofit: Retrofit): XApi = retrofit.create(XApi::class.java)
   ```
   The repository is `@Singleton` and `@Inject constructor(api: XApi)` — no
   extra Hilt module needed beyond the API provider.

## Snake_case → camelCase

- **REST DTOs:** explicit `@Json(name = "snake_case")` per field. Moshi's
  `KotlinJsonAdapterFactory` reads property names directly otherwise.
- **Socket payloads:** read `JSONObject` via `socket.eventsOf(event)` →
  `Flow<JSONObject>`. Decode by hand or pass through Moshi with the same
  `@Json` annotations.

## Shared archetypes

Reuse before building bespoke. The four shells live under
`ui/screens/shared/`:

| Archetype | Contract | When to reuse |
|-----------|----------|---------------|
| **ListOfRows** | `ListOfRowsScreen` + `sealed interface ListOfRowsUiState` (`Loading / Loaded(rows, tabs, selectedTab) / Empty / Error`). Rows are `RowModel`s with sealed `RowLeading` / `RowTrailing`. `TopBarAction` + `FabAction` plug into the top bar / FAB. | Any single-list-of-cells screen: My Homes, My Claims, Mailbox list. |
| **Wizard** | `WizardShell` + `WizardState` + `WizardModel`. Carries the leading control, progress label, secondary CTA, and `WizardStep`s. | Multi-step linear flows: Add Home, Claim Ownership, Invite Owner, Disambiguate. |
| **Form** | `FormShell` + `FormState` (per-`FormFieldState` `original / current / error`) + validation helpers. | Single-page editors. |
| **ContentDetail** | `ContentDetailShell` (composable). Takes header / body / CTA slot composables and renders them in the right shell geometry. | Read-only detail surfaces that aren't transactional. |

T2.6's transactional shell (`ui/screens/contentdetail/ContentDetailShell.kt`)
is **bespoke** — a separate gig/listing/invoice canvas with a sealed
`ContentDetailModule` rendering `description / detailRow / captionedText /
photoStrip / similarItems / bids / fromTo / lineItems / summary` so the
backend's `jsonb_modules[]` can grow without touching the shell. Reuse that
one for new transactional surfaces (gigs / listings / invoices / payments).

## Design tokens — **never hardcode**

- Colour: `PantopusColors.<token>` for legacy fixed tokens, and
  `PantopusTheme.tokens.<category|identity>.<…>` inside a `PantopusTheme { }`
  scope for the token-bag flavour. Category accents live on the enum
  (`GigsCategory.color`).
- Spacing: `Spacing.s1 (4) / s2 (8) / s3 (12) / s4 (16) / s5 (20) / s10 (40)`.
- Radii: `Radii.xs / sm / md / lg / pill` (`Radii.kt`).
- Type: `PantopusTextStyle.<h1|h2|body|…>` (`Typography.kt`). Inlined
  `…sp / FontWeight.…` for one-off frames mirrors the iOS pattern; both are
  fine when they match a designer-supplied spec.
- Icons: `PantopusIconImage(icon: PantopusIcon.X, contentDescription:, size:,
  strokeWidth:, tint:)` only — `Icons.Filled.*` and direct
  `painterResource(R.drawable.ic_lucide_*)` are rejected by
  `./gradlew verifyPantopusIcons`.
- Raw `Color(0xFF…)` / `.dp` literals in `ui/screens/**` will trip the CI
  hex-grep guard. Tokens-only.

## State rule

Every fetchable surface ships four states:

1. **Loading** → shimmer skeleton that mirrors the loaded geometry
   (`ui/components/Shimmer.kt`, or feature-local skeleton like
   `FeedSkeletonCard`). **Never** a `CircularProgressIndicator` masquerading
   as a screen-level "Loading…" spinner.
2. **Empty** → `EmptyState` (`ui/components/EmptyState.kt`) with icon +
   headline + body + primary CTA. Include scope/radius hint pill when
   relevant.
3. **Loaded** → content.
4. **Error** → headline + body + `Retry` button wired to
   `viewModel.refresh()`.

Compose the screen body with the `OfflineBanner` (`ui/components/OfflineBanner.kt`)
in the chrome stack so the strip auto-appears when offline.

## Navigation

- Single-activity Compose host with a `NavHostController` rooted in
  `RootTabScreen`. Routes are flat strings declared in the private
  `ChildRoutes` object: every constant is documented, and string builders
  live alongside (`gigDetail(id:) = "gigs/$id"`).
- To add a destination:
  1. Add a `const val …` to `ChildRoutes` + (when needed) a string builder.
  2. Add a `composable(route, arguments = listOf(navArgument(KEY) { type =
     NavType.StringType }))` block inside `RootTabScreen.kt`.
  3. Wire callers via the builder helper, not raw string concat.
- Nav args reach Hilt view-models via `SavedStateHandle` — declare the key as
  a `companion object const val FOO_KEY` and read with `savedStateHandle.get
  <String>(FOO_KEY)` in the VM init.

## Parity

For every change, the iOS counterpart must:
- expose the same render states,
- carry the same `Modifier.testTag(…)` strings (mirror naming as iOS
  `.accessibilityIdentifier(…)`),
- hit the same backend endpoint with the same query params.

When in doubt, write the test first against the projection, mirror to iOS,
then mirror the screen.

## Testing

- VM unit tests run on the JVM (no Robolectric needed) under
  `app/src/test/java/.../<feature>/`. Use mockk + Turbine when you need to
  collect a Flow. Set `Dispatchers.setMain(UnconfinedTestDispatcher())` in
  `@Before`.
- Repositories take Retrofit interfaces directly — mock the interface and
  return `NetworkResult.Success / Failure(NetworkError.Server(500, …))` for
  control-flow tests.
- Snapshot tests via Paparazzi lock the visual contract; record new
  baselines with `./gradlew paparazziRecord`.

## Build

- `./gradlew assembleDebug` — first build ~5 min, incremental ~30 s.
- `./gradlew ktlintCheck detekt test paparazziVerify :app:assembleDebug`
  mirrors the CI quality job.
- `MAPS_API_KEY` is injected via `manifestPlaceholders` from `.env`;
  `STRIPE_PUBLISHABLE_KEY` goes into `BuildConfig`.
