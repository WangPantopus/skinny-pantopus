# ListOfRows · iOS

The shared shell every list-of-rows screen on iOS ships on top of.

| File | Role |
|---|---|
| `ListOfRowsView.swift` | The view shell — top bar, optional search / chip strip / tab strip / banner, scroll body, FAB, four lifecycle states. |
| `ListOfRowsState.swift` | `ListOfRowsUiState`, `ListOfRowsTab`, `TopBarAction`, `FabAction`, `FabVariant`, `SearchBarConfig`, `ChipStripConfig`, `BannerConfig`, `ListingContextConfig`. |
| `RowModel.swift` | `RowModel`, `RowTemplate`, `RowLeading`, `RowTrailing`, `RowChip`, `RowFooter`, `RowEngagement`, `RowSection`, `SectionStyle`, `RowHighlight`. |

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
`RowLeading` case, a new `RowTrailing` case, a new optional `RowModel`
field with a `nil` default) — never widen an existing case in a way that
breaks v1 callers.

## Anatomy

```
┌───────────────────────────────────────┐
│ ◀  Title              Action / icon   │  TopBar          (52pt)
├───────────────────────────────────────┤
│  🔍  Search…                          │  SearchBar (opt) (44pt)
├───────────────────────────────────────┤
│ [All] [Tab] [Tab]                      │  TabStrip  (opt) (44pt)
│ or                                    │   — OR —
│ • Chip · Chip · Chip                  │  ChipStrip (opt) (44pt)
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

## RowModel contract

```swift
public struct RowModel: Identifiable, Hashable {
    // Identity
    public let id: String                      // stable, dedup, scroll-restore
    public var template: RowTemplate           // .statusChip / .fileChevron / .avatarKebab

    // Slots
    public var leading: RowLeading             // .none / .icon / .avatar / .typeIcon / .categoryGradientIcon
                                               // / .avatarWithBadge / .thumbnail / .bidderStack
    public var trailing: RowTrailing           // .none / .chevron / .kebab / .statusChip / .circularAction
                                               // / .verticalActions / .priceStack / .amountWithChip
                                               // / .footerSlot — see `RowFooter`

    // Content
    public var title: String?
    public var subtitle: String?
    public var body: String?                   // 2-line meta block under the title
    public var bodyEmphasis: RowBodyEmphasis = .secondary // T5.3.3 — My posts uses .primary

    // Chips / meta
    public var headerChips: [RowChip] = []     // T5.3.3 — above the body (My posts intent)
    public var chips: [RowChip] = []           // status / category chips on the meta line
    public var metaTail: String?               // trailing text on the meta line ("· 3 others bid")
    public var inlineChip: RowChip? = nil      // T5.2.1 — chip on the title line (Pets species)

    // Highlight / footer / engagement
    public var highlight: RowHighlight = .none // .unread / .leading / .archived / .muted
    public var footer: RowFooter? = nil        // 1–3 buttons below the row (CompactButton.footer)
    public var engagement: RowEngagement? = nil // T5.3.3 — comment + like counters + Edit CTA
    public var note: String? = nil             // T5.3.4 — italic quote line at the bottom

    // Callbacks
    public var onTap: (() -> Void)? = nil
    public var onSecondary: (() -> Void)? = nil  // .kebab → action sheet
}
```

## Leading variants

| Case | Geometry | Used by |
|---|---|---|
| `.none` | 0pt — no leading column | My posts (header-chip + body only) |
| `.icon(PantopusIcon, tint:)` | 40pt icon disk, no background | legacy v1 |
| `.typeIcon(icon, background, foreground)` | 40pt circular tile with tinted fill | Notifications · Bills |
| `.categoryGradientIcon(icon, gradient)` | 40pt circular tile with two-stop gradient + white icon | My bids · My tasks · Offers · Discover hub Gigs |
| `.avatar(name, imageUrl, identity, ringProgress)` | 40pt avatar with identity-pillar ring | Connections v1, Mailbox |
| `.avatarWithBadge(name, imageUrl, background, size, verified)` | 36 / 40 / 44pt avatar with `VerifiedBadge` overlay | Connections · Discover hub People · Listing offers · Review claims |
| `.thumbnail(image, size)` | 56pt or 64pt rounded-square | Offers · Pets · Listing offers hero |
| `.bidderStack(bidders, overflow)` | 22pt overlapping mini-avatars + "+N" tile | My tasks V2 |

## Trailing variants

| Case | Geometry | Used by |
|---|---|---|
| `.none` | none | when the row is fully self-contained |
| `.chevron` | 16pt right-chevron | drill-down |
| `.kebab` | 36pt more-vertical icon button → `onSecondary` | My posts · Pets |
| `.statusChip(RowChip)` | a single chip aligned trailing | v1 |
| `.circularAction(icon, accessibilityLabel, handler)` | 38pt round button | Connections (message CTA) |
| `.verticalActions(primary, secondary)` | 30pt primary + 28pt ghost stacked | Connections pending tab (Accept / Ignore) |
| `.priceStack(amount, sublabel?)` | right-aligned $ + sub-line | My bids · My tasks · Offers · Listing offers · Discover hub Gigs / Listings |
| `.amountWithChip(amount, chip)` | $ stacked vertically over a chip | Bills |

## RowSection extension

```swift
public struct RowSection: Identifiable, Hashable {
    public let id: String
    public let header: String?       // existing
    public let count: Int?           // T5.4.1 — bumped count under the title
    public let onSeeAll: (() -> Void)? = nil    // T5.4.1 — trailing CTA
    public let style: SectionStyle = .plain     // .plain / .card (hairline rows in one rounded card)
    public let rows: [RowModel]
}
```

`SectionStyle.card` renders the section's rows inside a single rounded
card with hairline dividers — no inter-row gap. Discover hub and Discover
businesses are the two consumers today.

## Chrome slots

| Slot | Type | Geometry |
|---|---|---|
| `topBar.title` | `String` | required, centred |
| `topBar.action` | `TopBarAction?` | trailing icon-or-text button (Notifications "Mark all read", Discover businesses sliders) |
| `searchBar` | `SearchBarConfig?` | 44pt sunken pill above tabs (Connections, Discover businesses) |
| `tabs` + `selectedTab` | `[ListOfRowsTab]` + `Int` | shrink-to-fit chip-row tabs (mobile) |
| `chipStrip` | `ChipStripConfig?` | alternative to `tabs` — horizontally scrollable filter pills (Discover hub, Discover businesses) |
| `banner` | `BannerConfig?` | primary / amber tinted summary card above the first row (My bids, My tasks, Offers, Review claims) |
| `listingContext` | `ListingContextConfig?` | sticky hero card with image + meta + ask price (Listing offers only) |
| `fab` | `FabAction?` | 56 / 52 / 48pt — see `FabVariant` below |

## FAB variants

| Variant | Diameter | Use |
|---|---|---|
| `.canonicalCreate` | 56pt round | the screen's primary create action (My tasks V2 "Post a task") |
| `.secondaryCreate` | 52pt round | non-canonical create (My posts, Connections, Bills, Pets) |
| `.extendedNav(label:)` | 48pt pill | navigation FAB — "Browse tasks" on My bids |

## Lifecycle states

Every fetchable surface ships **four**:

1. **`.loading`** — `LoadingRows` shimmer that mirrors the loaded geometry.
2. **`.empty(EmptyConfig)`** — shared `EmptyState` with icon + headline + body + optional CTA. The Notifications empty-Unread CTA re-keys the tab to `All` in place — no route push (per F2 in the buildout plan).
3. **`.loaded(sections:, hasMore:)`** — content.
4. **`.error(message:)`** — `ErrorBanner` with `Retry` wired to `viewModel.refresh()`.

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
`frontend/apps/ios/PantopusTests/__Snapshots__/t5/<screen>-ios.png` —
12 of them, one per T5 screen.

Platform-rendered baselines (generated on first Mac CI run with
`xcrun simctl` available, then committed):
`frontend/apps/ios/PantopusTests/__Snapshots__/t5/platform/<screen>-ios.png`.

Drift is caught by `T5ScreensSnapshotTests.swift` under
`frontend/apps/ios/PantopusTests/Features/Shared/ListOfRows/`. CI runs
the snapshot suite on every PR — record new baselines with `--record`
locally before pushing.

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
4. **Wire the screen.** New feature folder under `Features/<Feature>/`
   with `<Feature>View.swift` + `<Feature>ViewModel.swift`. The view is a
   thin wrapper around `ListOfRowsView(dataSource: viewModel)`. The
   view-model exposes `state: ListOfRowsUiState`, mutates it on `load() /
   refresh() / loadMoreIfNeeded()`, and conforms to `ListOfRowsDataSource`.
5. **Wire the tests.** `<Feature>ViewModelTests.swift` covers loading /
   empty / loaded / error transitions and the row-mapping logic. Add the
   screen to `T5ScreensSnapshotTests.swift` (or its T6 successor) so the
   snapshot baseline lands in CI.
6. **Wire the parity audit** at `docs/mobile-parity-audit.md` and the
   wiring audit at `docs/mobile-wiring-audit.md`.

The longer doc-of-record for the archetype evolution lives at
`docs/t5-buildout-plan.md`; the prompt-style notes are at
`docs/mobile/pantopus-t5-notes.md`. T6 additions are documented in
`docs/t6-buildout-plan.md` + `docs/t6-prs/T6-summary.md`.

— Pantopus T5

---

## T6 additions (strictly additive — no v1 / T5 call site changes)

T6 layered eight new surfaces onto the same shell. Every addition is
optional / defaulted / a new enum case, so screens that don't opt in
behave exactly as they did at the end of T5.

| Addition | Cluster | Use |
|---|---|---|
| `RowLeading.magicArchetypeTile(...)` | `RowLeading` enum | 44pt rounded gradient tile + 18pt sparkles disc overlay (T6.0b My tasks V2 magic chrome). Distinct from `categoryGradientIcon` so the magic signal is scannable. |
| `RowModel.archetypeOverline: String?` | `RowModel` field | 10pt lavender uppercase overline above the title, truncated at 24 chars (T6.0b My tasks V2). |
| `FabVariant.magicCreate` | FAB enum | 60pt gradient FAB with sparkles disc (T6.0b "Post a task with Magic Task"). Adds to the existing `canonicalCreate (56pt)` / `secondaryCreate (52pt)` / `extendedNav (48pt)` set. |
| `FabTint` + `FABAction.tint` | `FABAction` field | per-identity colour-ramp on the FAB (`.personal` / `.home` / `.business`). Defaults to `.none` for backwards compat. |
| `RowModel.splitWith: SplitStackData?` | `RowModel` field | 18pt overlapping avatars at the right edge of the chip row (Bills T6.0a split-bill members). |
| `BannerConfig.cta: BannerCTA?` + `BannerConfig.tint: BannerCTATint` | banner slot | adds a primary CTA (text + handler) inside the existing banner slot + tint enum for per-identity ramps (Bills T6.0a "Pay all"). |
| `RowTrailing.iconActions(primary:secondary:)` | `RowTrailing` enum | 32pt sunken icon pair (e.g. copy + kebab) when a row needs two trailing actions without going full footer (Access codes T6.4a). |
| `ListOfRowsDataSource.topBarSubtitle: String?` | data-source protocol | optional 2-line top bar (title + subtitle) — defaults to `nil` (Access codes T6.4a). |
| `customHeader` view-builder slot | shell chrome | optional `@ViewBuilder` slot between the chrome (search / chip / tabs) and the state body. Carries feature-local headers like Home calendar's `MonthStripHeader` (T6.4c). |

### Per-feature palette files (documented hex-exception locations)

T6 added more category palettes — each feature owns a `*Palette.swift` /
`*Palette.kt` / `*-palette.ts` triple. These are the **documented**
hex-literal locations per `CLAUDE.md` / `make verify-icons`:

- `UtilityCategoryPalette` — Bills (8 utilities)
- `CourierPalette` — Packages (8 carriers)
- `MaintenanceCategoryPalette` — Maintenance (12 task categories)
- `HouseholdTaskCategoryPalette` — Household tasks (8 chore categories)
- `PollKindPalette` — Polls (4 kinds)
- `AccessCategoryPalette` — Access codes (7 categories)
- `EmergencyCategoryPalette` — Emergency info (4 buckets)
- `DocumentCategoryPalette` + `DocumentFileTypePalette` — Documents (7
  categories + 6 file types)
- `OwnerProofPalette` — Owners (4 tones)
- `MemberRolePalette` — Members (5 roles)
- `CalendarEventCategory` — Home calendar (12 categories)
- `MailboxVaultFolderIcon` + `MailboxVaultMailType` — Vault (7
  folders, 7 mail types)
- `SpeciesPalette` — Pets (T5, carried over)

These are not violations — they're the canonical place where category
swatches live. Direct hex usage anywhere **else** in `Features/**`
trips the CI hex-grep guard.

### Cross-reference — sibling shells added in T6

- `Features/Shared/MailItemDetail/` — A17 mailbox detail shell. See
  `MailItemDetail/README.md` for the slot contract.
- `Features/Shared/MapListHybrid/` — full-bleed-map + 3-detent sheet
  shell. See `MapListHybrid/README.md` for the detent contract.

— Pantopus T6
