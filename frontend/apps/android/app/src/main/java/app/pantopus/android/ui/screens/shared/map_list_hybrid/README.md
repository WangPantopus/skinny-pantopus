# MapListHybrid · Android

The shared shell every full-bleed-map + draggable-bottom-sheet
screen on Android ships on top of. Introduced in T6.6a (P24) to
express the **Nearby map** redesign — and built to be reused by
Marketplace (gig location) or Discover Businesses (business
location) when those want the same pattern.

| File | Role |
|---|---|
| `MapListHybridShell.kt` | The composable shell — wraps a full-bleed Google Maps layer + a `BottomSheetScaffold` with custom 3-detent anchors (160 / 296 / 518 dp) + 6 floating slots. |
| `MapListHybridContent.kt` | `MapListHybridContent`, `MapPin`, `MapListHybridDetent` (`Collapsed` / `Standard` / `Expanded`), `resolveMapListHybridDetent` (the snap-to-nearest + velocity-nudge math shared with iOS + web). |
| `MapListHybridPreview.kt` | Paparazzi-friendly static canvas with sample pins. One snapshot per detent. |

## When to use this shell

Reuse the shell whenever the design is:

> a full-bleed map with a draggable bottom sheet that snaps between
> a header-only collapsed state, a header + carousel standard state,
> and a header + full list expanded state.

T6.6a is the only consumer today (`NearbyMapScreen`). Future
candidates: Marketplace map mode, Discover Businesses map view,
gig-location preview from a Gig detail.

**If a future map-list consumer needs a 4th detent** or a different
sheet anchor scheme, propose an additive extension to
`MapListHybridDetent` here first — never change the existing
absolute heights (160 / 296 / 518 dp) without coordinated iOS +
Android + web changes.

## Anatomy

```
┌──────────────────────────────────────────────────────┐
│ ◀  Title  · filters                                  │  TopPill   (floating, blur bg)
│                                                      │
│ [All] [Handyman] [Cleaning] [Pet care] [Plumbing]    │  CategoryChips (overlay)
│                                                      │
│       ⊙ pin   ⊙ pin                                  │  MapLayer  (full-bleed,
│                                                      │             shell-owned)
│                       ⊙ pin                          │
│                                                      │
│                                            🎯        │  MapControls (right edge,
│                                            ▦         │   floating above sheet)
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ╭───── Sheet header ─────────────────────────────╮ │  SheetHeader (sticky)
│  │ 12 · Sort: Nearest                              │ │
│  ╰─────────────────────────────────────────────────╯ │
│  ╭───── Sheet body ───────────────────────────────╮ │  SheetBody (carousel
│  │ [card] [card] [card] [card] (standard)         │ │   or list)
│  ╰─────────────────────────────────────────────────╯ │
└──────────────────────────────────────────────────────┘
```

## Slot contract

Each slot is a `@Composable () -> Unit` prop; consumers supply
whatever chrome they need.

| # | Slot | Role |
|---|---|---|
| 1 | Map layer | Shell-owned. Android uses Google Maps via `google-maps-compose`. Renders supplied `List<MapPin>` with the design's coloured-disc + white-ring (confirmed) or dashed-outline (pending) treatment, plus an optional "you are here" anchor disc. |
| 2 | Top pill | Floating back / title / filter pill on the top edge (blur background). |
| 3 | Category chips | Overlay horizontal strip sitting under the top pill. |
| 4 | Map controls | Locate-fixed / layers buttons stacked on the right edge, automatically anchored above the current sheet height. |
| 5 | Sheet header | Count label + sort selector inside the sheet. |
| 6 | Sheet body | The variable part — carousel for `Standard`, list for `Expanded`, drag-up prompt for `Collapsed`. |

## Detent contract

Three detents, absolute heights (per Q9 of the buildout-plan
decisions doc — same numbers on iOS, Android, web):

| Detent | Height | Behaviour |
|---|---|---|
| `Collapsed` | 160 dp | header + drag-to-expand prompt |
| `Standard`  | 296 dp | header + horizontal card carousel |
| `Expanded`  | 518 dp | header + full vertical list |

Android implementation: `BottomSheetScaffold` with three
`SheetValue.PartiallyExpanded` snap points (custom anchors via
Material3's `anchoredDraggableState`). The
`resolveMapListHybridDetent` is the pure function that maps a
release height + velocity to the snapped detent.

Sign convention (matches iOS + web):

- positive velocity = downward flick → shrink one detent
- negative velocity = upward flick → grow one detent
- magnitudes equal to the threshold do **not** nudge — strict `>` /
  `<` only — so the threshold edge defers to snap-to-nearest
- snap-to-nearest by absolute distance to the released height when
  neither flick branch fires

Velocity units differ by platform; the resolver threshold is
calibrated per-platform so the same physical flick crosses it on
every device:

| Platform | Units | Threshold |
|---|---|---|
| iOS | UIKit points / second | 600 (`velocityThreshold`) |
| **Android** | **raw pixels / second (Compose `draggable`)** | **1 200 (`VELOCITY_THRESHOLD`)** |
| Web | CSS pixels / second (pointer events) | 600 (`MAP_LIST_HYBRID_VELOCITY_THRESHOLD`) |

## Pin↔list selection sync

Same contract as iOS: shell fires `onPinTap(id: String)` when a pin
is tapped; consumer updates its own selection state and snaps
`detent` to `Standard`. The active pin draws a static double-halo
on Android (Paparazzi diffs cleanly).

## Test tag parity (root container)

All three platforms expose the same set of test identifiers on the
shell-owned wrappers:

| Test tag | Wraps |
|---|---|
| `mapListHybridShell` | full canvas root |
| `mapListHybridMap` | the live map layer |
| `mapListHybridTopPill` | top-pill slot wrapper |
| `mapListHybridChips` | category-chips slot wrapper |
| `mapListHybridMapControls` | map-controls slot wrapper |
| `mapListHybridSheet` | the rounded bottom-sheet container |
| `mapListHybridSheetHeader` | sheet-header slot wrapper |
| `mapListHybridSheetBody` | sheet-body slot wrapper |
| `mapListHybridPin_<id>` | per-pin marker |

iOS uses `accessibilityIdentifier`; Android uses `Modifier.testTag`;
web uses `data-testid`. Slot contents carry their own consumer-
supplied identifiers.

## Lifecycle states

Every fetchable map-list surface ships **four**:

1. **`Loading`** — map renders empty; sheet shows a shimmer skeleton.
2. **`Empty`** — "Nothing nearby" + radius-widening CTA in the sheet.
3. **`Loaded`** — pins on the map + carousel / list in the sheet.
4. **`Error(message)`** — `ErrorBanner` with `Retry` wired to
   `viewModel.refresh()` inside the sheet header.

## See it rendered

Locally: Paparazzi snapshot baselines under
`app/src/test/snapshots/images/app.pantopus.android.ui.screens.shared.map_list_hybrid_MapListHybridShellSnapshotTest_*` —
one PNG per detent (collapsed / standard / expanded). Run
`./gradlew app:paparazziVerify --tests "*MapListHybridShellSnapshotTest*"`
to verify against the committed baselines, or `paparazziRecord` to
re-record after a deliberate visual change.

Web has `/map-list-hybrid-preview` for the designer-facing sanity
check (every detent rendered side-by-side with live Mapbox tiles +
sample pins).

## Snapshot baselines

Paparazzi PNGs at
`frontend/apps/android/app/src/test/snapshots/images/app.pantopus.android.ui.screens.shared.map_list_hybrid_MapListHybridShellSnapshotTest_*`.

Design-reference PNG (the visual contract) lives alongside the iOS
baselines under `__snapshots__/t6/map-list-hybrid.png`.

## Adding a new map-list consumer

1. **Compose** a `ViewModel` that exposes the map-list state
   (`List<MapPin>`, list rows, selected pin id) + four lifecycle
   states.
2. **Wrap** the screen in `MapListHybridShell { … }` and supply the
   6 slots. The shell handles the map layer + detent gestures.
3. **Wire** `onPinTap(id)` to update the selected state and snap
   `detent` to `Standard`.
4. **Tests.** `*ViewModelTest.kt` covers
   load → loaded / empty / error + selection sync. Paparazzi
   snapshot baseline records via `paparazziRecord` per detent.
5. **Parity audit + wiring audit** rows for the new consumer.

The longer doc-of-record is in `docs/t6-buildout-plan.md` §E.2 and
`docs/mobile-parity-audit.md` "T6.6a — MapListHybrid archetype
shell (P24)" preamble.

— Pantopus T6.6a
