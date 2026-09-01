# ListOfRows · Android

The shared shell every list-of-rows screen on Android ships on top of.

| File | Role |
|---|---|
| `ListOfRowsScreen.kt` | The composable shell — top bar, optional search / chip strip / tab strip / banner, scroll body, FAB, four lifecycle states. |
| `ListOfRowsUiState.kt` | `ListOfRowsUiState`, `ListOfRowsTab`, `TopBarAction`, `FabAction`, `FabVariant`, `SearchBarConfig`, `ChipStripConfig`, `BannerConfig`, `ListingContextConfig`. |
| `RowModel.kt` | `RowModel`, `RowTemplate`, `RowLeading`, `RowTrailing`, `RowChip`, `RowFooter`, `RowEngagement`, `RowSection`, `SectionStyle`, `RowHighlight`. |

T5 added 10 row shapes, 4 trailing variants, a leading-thumbnail size, a
bidder-stack primitive, a chip-strip slot, a banner slot, a hero-card slot,
two FAB variants, and the `primary25` background tint. Every extension is
**additive** — the original Notifications v1 / MyHomes / MyClaims / Mailbox
call sites compile untouched.

## When to use this shell

Reuse the shell whenever the design is:

> a vertically scrolling list of cells, with optional chrome
> (top bar, search, tabs, chip strip, banner, FAB) above it.

T1–T5 ship 13 screens on this shell. Tier 5 alone added 12. The 13th screen
should use this shell too — keep going until a design pushes us past what
the contract can express **without** breaking an existing call site. **If
the row contract is too narrow, propose an additive extension** (a new
`RowLeading` subtype, a new `RowTrailing` subtype, a new optional
`RowModel` field with a default) — never widen an existing case in a way
that breaks v1 callers.

## Anatomy

```
┌───────────────────────────────────────┐
│ ◀  Title              Action / icon   │  TopBar          (52dp)
├───────────────────────────────────────┤
│  🔍  Search…                          │  SearchBar (opt) (44dp)
├───────────────────────────────────────┤
│ [All] [Tab] [Tab]                      │  TabStrip  (opt) (44dp)
│ or                                    │   — OR —
│ • Chip · Chip · Chip                  │  ChipStrip (opt) (44dp)
├───────────────────────────────────────┤
│ ┌──────── BannerConfig ─────────────┐ │  Banner    (opt)
│ └───────────────────────────────────┘ │
├───────────────────────────────────────┤
│  ┌────── Row ───────────────────────┐ │
│  │ leading  title              tail │ │
│  │          subtitle                │ │
│  │          chips · metaTail        │ │
│  │          ─── inline footer ───── │ │
│  └──────────────────────────────────┘ │
│  ┌────── Row ───────────────────────┐ │
│  └──────────────────────────────────┘ │
│                                       │
│                                  ⊕    │  FabAction (opt)
└───────────────────────────────────────┘
```

## T6 additions (strictly additive — no v1 / T5 call site changes)

T6 layered eight new surfaces onto the same shell. Every addition is
optional / defaulted / a new sealed-subtype, so screens that don't opt
in behave exactly as they did at the end of T5.

| Addition | Cluster | Use |
|---|---|---|
| `RowLeading.MagicArchetypeTile(...)` | `RowLeading` sealed type | 44dp rounded gradient tile + 18dp sparkles disc overlay (T6.0b My tasks V2 magic chrome). |
| `RowModel.archetypeOverline: String?` | `RowModel` field | 10sp lavender uppercase overline above the title (T6.0b). |
| `FabVariant.MagicCreate` | FAB enum | 60dp gradient FAB with sparkles disc (T6.0b). |
| `FabTint` + `FABAction.tint` | `FABAction` field | per-identity colour-ramp (`Personal` / `Home` / `Business`). Defaults to `None`. |
| `RowModel.splitWith: SplitStackData?` | `RowModel` field | 18dp overlapping avatars at the right edge (Bills T6.0a). |
| `BannerConfig.cta: BannerCTA?` + `BannerConfig.tint: BannerCTATint` | banner slot | adds a primary CTA + tint enum (Bills T6.0a "Pay all"). |
| `RowTrailing.IconActions(primary, secondary)` | `RowTrailing` sealed type | 32dp icon pair when a row needs two trailing actions (Access codes T6.4a). |
| `ListOfRowsDataSource.topBarSubtitle: String?` | data-source field | optional 2-line top bar (Access codes T6.4a). |
| `customHeader: @Composable () -> Unit` slot | shell chrome | optional composable slot between chrome and state body (Home calendar T6.4c). |

### Per-feature palette files (documented hex-exception locations)

T6 added more category palettes — each feature owns a `*Palette.kt`
file. Direct hex usage anywhere **else** in `ui/screens/**` trips the
CI hex-grep guard via `./gradlew detekt`.

- `UtilityCategoryPalette` (Bills) · `CourierPalette` (Packages) ·
  `MaintenanceCategoryPalette` · `HouseholdTaskCategoryPalette` ·
  `PollKindPalette` · `AccessCategoryPalette` ·
  `EmergencyCategoryPalette` · `DocumentCategoryPalette` +
  `DocumentFileTypePalette` · `OwnerProofPalette` ·
  `MemberRolePalette` · `CalendarEventCategory` ·
  `MailboxVaultFolderIcon` + `MailboxVaultMailType` ·
  `SpeciesPalette` (T5).

### Cross-reference — sibling shells added in T6

- `ui/screens/shared/mail_item_detail/` — A17 mailbox detail shell.
  See `mail_item_detail/README.md` for the slot contract.
- `ui/screens/shared/map_list_hybrid/` — full-bleed-map + 3-detent
  sheet shell. See `map_list_hybrid/README.md` for the detent
  contract.

— Pantopus T6

---

## RowModel contract

```kotlin
data class RowModel(
    // Identity
    val id: String,
    val template: RowTemplate,                // StatusChip / FileChevron / AvatarKebab

    // Slots
    val leading: RowLeading = RowLeading.None,
        // .None / .Icon / .Avatar / .TypeIcon / .CategoryGradientIcon
        // / .AvatarWithBadge / .Thumbnail / .BidderStack
    val trailing: RowTrailing = RowTrailing.None,
        // .None / .Chevron / .Kebab / .StatusChip / .CircularAction
        // / .VerticalActions / .PriceStack / .AmountWithChip / .FooterSlot

    // Content
    val title: String? = null,
    val subtitle: String? = null,
    val body: String? = null,                  // 2-line meta block under title
    val bodyEmphasis: RowBodyEmphasis = RowBodyEmphasis.Secondary, // .Primary — My posts

    // Chips / meta
    val headerChips: List<RowChip> = emptyList(),   // T5.3.3 — above body (My posts intent)
    val chips: List<RowChip> = emptyList(),         // status / category chips on the meta line
    val metaTail: String? = null,                   // "· 3 others bid"
    val inlineChip: RowChip? = null,                // T5.2.1 — chip on the title line (Pets species)

    // Highlight / footer / engagement
    val highlight: RowHighlight = RowHighlight.None,  // .Unread / .Leading / .Archived / .Muted
    val footer: RowFooter? = null,                    // 1–3 buttons below the row (CompactButton.footer)
    val engagement: RowEngagement? = null,            // T5.3.3 — comment + like counters + Edit CTA
    val note: String? = null,                         // T5.3.4 — italic quote at the bottom

    // Callbacks
    val onTap: (() -> Unit)? = null,
    val onSecondary: (() -> Unit)? = null,            // .Kebab → action sheet
)
```

## Leading variants

| Subtype | Geometry | Used by |
|---|---|---|
| `RowLeading.None` | 0dp — no leading column | My posts (header-chip + body only) |
| `RowLeading.Icon` | 40dp icon disk, no background | legacy v1 |
| `RowLeading.TypeIcon` | 40dp circular tile with tinted fill | Notifications · Bills |
| `RowLeading.CategoryGradientIcon` | 40dp circular tile with two-stop gradient + white icon | My bids · My tasks · Offers · Discover hub Gigs |
| `RowLeading.Avatar` | 40dp avatar with identity-pillar ring | Connections v1, Mailbox |
| `RowLeading.AvatarWithBadge` | 36 / 40 / 44dp avatar with `VerifiedBadge` overlay | Connections · Discover hub People · Listing offers · Review claims |
| `RowLeading.Thumbnail` | 56dp or 64dp rounded-square | Offers · Pets · Listing offers hero |
| `RowLeading.BidderStack` | 22dp overlapping mini-avatars + "+N" tile | My tasks V2 |

## Trailing variants

| Subtype | Geometry | Used by |
|---|---|---|
| `RowTrailing.None` | none | when the row is fully self-contained |
| `RowTrailing.Chevron` | 16dp right-chevron | drill-down |
| `RowTrailing.Kebab` | 36dp more-vertical icon button → `onSecondary` | My posts · Pets |
| `RowTrailing.StatusChip` | a single chip aligned trailing | v1 |
| `RowTrailing.CircularAction` | 38dp round button | Connections (message CTA) |
| `RowTrailing.VerticalActions` | 30dp primary + 28dp ghost stacked | Connections pending tab (Accept / Ignore) |
| `RowTrailing.PriceStack` | right-aligned $ + sub-line | My bids · My tasks · Offers · Listing offers · Discover hub Gigs / Listings |
| `RowTrailing.AmountWithChip` | $ stacked vertically over a chip | Bills |

## RowSection extension

```kotlin
data class RowSection(
    val id: String,
    val header: String?,             // existing
    val count: Int? = null,          // T5.4.1 — bumped count under the title
    val onSeeAll: (() -> Unit)? = null,    // T5.4.1 — trailing CTA
    val style: SectionStyle = SectionStyle.Plain,  // Plain / Card (hairline rows)
    val rows: List<RowModel>,
)
```

`SectionStyle.Card` renders the section's rows inside a single rounded
card with hairline dividers — no inter-row gap. Discover hub and Discover
businesses are the two consumers today.

## Chrome slots

| Slot | Type | Geometry |
|---|---|---|
| `topBar.title` | `String` | required, centred |
| `topBar.action` | `TopBarAction?` | trailing icon-or-text button (Notifications "Mark all read", Discover businesses sliders) |
| `searchBar` | `SearchBarConfig?` | 44dp sunken pill above tabs (Connections, Discover businesses) |
| `tabs` + `selectedTab` | `List<ListOfRowsTab>` + `Int` | shrink-to-fit chip-row tabs |
| `chipStrip` | `ChipStripConfig?` | alternative to `tabs` — horizontally scrollable filter pills (Discover hub, Discover businesses) |
| `banner` | `BannerConfig?` | primary / amber tinted summary card above the first row (My bids, My tasks, Offers, Review claims) |
| `listingContext` | `ListingContextConfig?` | sticky hero card with image + meta + ask price (Listing offers only) |
| `fab` | `FabAction?` | 56 / 52 / 48dp — see `FabVariant` below |

## FAB variants

| Variant | Diameter | Use |
|---|---|---|
| `FabVariant.CanonicalCreate` | 56dp round | the screen's primary create action (My tasks V2 "Post a task") |
| `FabVariant.SecondaryCreate` | 52dp round | non-canonical create (My posts, Connections, Bills, Pets) |
| `FabVariant.ExtendedNav(label)` | 48dp pill | navigation FAB — "Browse tasks" on My bids |

## Lifecycle states

Every fetchable surface ships **four**:

1. **`Loading`** — `LoadingRows` shimmer that mirrors the loaded geometry.
2. **`Empty(...)`** — shared `EmptyState` with icon + headline + body +
   optional CTA. The Notifications empty-Unread CTA re-keys the tab to
   `All` in place — no route push (per F2 in the buildout plan).
3. **`Loaded(sections, hasMore)`** — content.
4. **`Error(message)`** — `ErrorBanner` with `Retry` wired to
   `viewModel.refresh()`.

## See it rendered

The web has a `/list-of-rows-preview` route that renders every row
variant against the design tokens. It's the canonical visual contract
that all three platforms target.

Path: `frontend/apps/web/src/app/(internal)/list-of-rows-preview/page.tsx`

Run `pnpm -F @pantopus/web dev`, navigate to
`http://localhost:3000/list-of-rows-preview`. Every leading / trailing /
chip / footer / highlight variant renders once with a label.

## Snapshot baselines

Design-reference PNGs (the visual contract):
`frontend/apps/android/app/src/test/snapshots/t5/<screen>-android.png` —
12 of them, one per T5 screen.

Platform-rendered baselines via Paparazzi:
`frontend/apps/android/app/src/test/snapshots/images/` — auto-named
`<package>_<ClassName>SnapshotTest_<methodName>.png`.

Drift is caught by `T5ScreensSnapshotTest.kt` under
`app/src/test/java/app/pantopus/android/ui/screens/shared/list_of_rows/`.
CI runs `./gradlew paparazziVerify` on every PR. Record new baselines
locally with `./gradlew paparazziRecord` before pushing.

## Adding the 13th screen

1. **Walk the design.** Identify which row shape it needs. If every cell
   maps to an existing `RowLeading` × `RowTrailing` combination, you're
   done — skip to step 4.
2. **If the design needs a new row variant**, propose an additive
   extension to `RowLeading` or `RowTrailing` here in this shell **first**,
   then use it from the feature. Existing call sites must keep compiling.
3. **If the design needs a new chrome slot** (e.g. a footer bar above the
   tab strip), discuss it before extending the shell. Two screens of demand
   is the bar for adding a slot.
4. **Wire the screen.** New feature folder under
   `ui/screens/<feature>/` with `<Feature>Screen.kt` +
   `<Feature>ViewModel.kt`. The screen is a thin wrapper around
   `ListOfRowsScreen(...)`. The view-model exposes `state: StateFlow<ListOfRowsUiState>`
   plus per-screen mutable signals (`activeTab`, `searchText`, …), mutates
   it on `load() / refresh() / loadMoreIfNeeded()`.
5. **Wire the tests.** `<Feature>ViewModelTest.kt` covers loading / empty
   / loaded / error transitions and the row-mapping logic. Add the screen
   to `T5ScreensSnapshotTest.kt` (or its T6 successor) so the snapshot
   baseline lands in CI.
6. **Wire the parity audit** at `docs/mobile-parity-audit.md` and the
   wiring audit at `docs/mobile-wiring-audit.md`.

The longer doc-of-record for the archetype evolution lives at
`docs/t5-buildout-plan.md`; the prompt-style notes are at
`docs/mobile/pantopus-t5-notes.md`.

— Pantopus T5
