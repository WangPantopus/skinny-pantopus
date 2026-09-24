# Foundations 00a — handover

Eight components drawn on the Foundations 00a specimen board, as published to the Pantopus design system on 22 September 2026 (version 6). This pack is the same content as files, so it can be committed.

**ProvenanceMark · SourceCaption · ScopeChip · FreshnessLine · OfflineNotice · StatusChip · KindGlyph · ChoiceChip.** AddressChip is the board's ninth component; its anatomy is drawn but its variants, states, crops and scaling are not, so it is not in this pack.

---

## What's in here, and where it goes

```
components/<Name>/README.md      → project/components/<Name>/README.md
components/<Name>/preview.html   → project/components/<Name>/preview.html
foundations-00a.md               → project/foundations-00a.md   (a brand-book section)
```

The paths mirror the design system's own layout, so the tree can be copied straight over `project/`. `foundations-00a.md` was published alongside the eight cards; it carries the rules they share, the open decisions and the token-correction note. It is included here so a commit of "what we published" is complete — drop it if you only want the components.

Previews are **self-contained static HTML**. They do not use `window.Pantopus`, unlike the other 54 previews, because these components are not in `components/bundle.js`. They read tokens through `var(--token)` so they theme correctly as they are. Rewrite them in the React form once the components join the bundle.

---

## The thing to decide first

The design system's index records its last change as *"GitHub · WangPantopus/skinny-pantopus@824309540 — Rebuilt by tools/design-system"*, and all 54 existing cards end with a `Source:` line pointing at a file in that repo. **These eight have no source file, so the next rebuild deletes them.** Each card says so in its own `Source:` line rather than pretending otherwise.

Two ways forward:

1. **Add the source files, then let the pipeline regenerate.** Preferred. The cards here become the guidelines text the tool emits.
2. **Teach `tools/design-system` to preserve unmatched cards.** Cheaper now, and it means the system can hold design-led components that lead the code — which is the whole point of drawing a foundations board before any screen.

For each component below: where it probably belongs, its props, and the rules that have to survive the trip.

---

## Per component

### ProvenanceMark
`frontend/apps/web/src/components/archetypes/place/primitives.tsx` — it sits with `StatusDot` and `SourceNote`.

- **Props:** `kind`: `official` | `unconfirmed` | `you-added`; `size`: XS 12 | S 16 | M | L.
- **Drawing:** one 56-unit artwork scaled by width; stroke width D/8 at every size, so the ring weight is identical from 12px to 96px. `official` is a filled disc; `unconfirmed` a ring at r 24.5 with a 7-unit stroke; `you-added` a filled disc with a tick cut out through a `userSpaceOnUse` mask.
- **Token:** ink `app-text-secondary`. Never a semantic hue.
- **Encode, don't just document:** filled vs hollow means provenance and nothing else. Worth a shared disc primitive only this component may use, or a lint rule — the invariant is unenforceable by prose once other people start drawing circles.

### SourceCaption
Same file as ProvenanceMark.

- **Props:** `mark` (a ProvenanceMark kind), `legend`, `source`, `scope`, `asOf`.
- **Type:** caption 12/16 `app-text-secondary`; legend word `app-text-strong` weight 500; links `color-primary-700`.
- **Needs a provider:** "the legend prints once per surface" is surface state, not component state. A prop each caller remembers to set will be wrong within a month.
- `SourceNote` stays as it is, for public-record readings with no mark.

### ScopeChip
`frontend/apps/web/src/components/archetypes/primitives/`

- **Props:** `variant`: `default` | `saved-place` | `named-home` | `claimed-home` | `pending` | `declined` | `scope-change-pair` | `struck`; plus the `footer-sentence` form.
- **Copy:** "Only you", "Your household", "<Home name> · Your household". Sentence: "Only you will see this."
- **Type:** chip caption 12/16 on `app-surface-sunken` with a 16px scope glyph; sentence 14/20 `app-text-secondary` with the same glyph.
- **Open:** the decline wording — "Keep them private to me" as sourced, or "Just me". Board entry 03.D1, unanswered.

### FreshnessLine
`frontend/apps/web/src/components/archetypes/place/primitives.tsx`

- **Props:** `state`: `fresh` | `updated` | `updating` | `refreshing` | `stale` | `fact-stale` | `offline` | `failed` | `widget-horizon`.
- **Copy:** "Updated just now", "Updated 12m ago", "Updating…", "as of 7:04 AM".
- **Behaviour:** `updating` uses the platform indeterminate hairline, not a spinner of ours. A date falling today carries no weekday; past dates show the date only.
- **Two gaps that belong in code, not docs:** precedence when states overlap (offline + stale + refreshing all apply at once), and how long "Updating…" may run before it becomes "failed". Neither is decided on the board, so whoever builds this will decide them by accident unless they are settled first.

### OfflineNotice
`frontend/apps/web/src/components/archetypes/primitives/`

- **Props:** `state`: `offline` | `reconnecting` | `back-online` | `cached-screen` | `queued-writes` | `form`.
- **Copy pattern:** name the blocked thing — "Compare needs a connection." Not "No internet".
- **Rules:** neutral surface, no error hue; cached content stays visible behind it; a form draws no FreshnessLine, because a form has no content age.
- **Open:** whether "Reconnecting" belongs here or to FreshnessLine — both currently draw it — and `back-online`, which names a state with nothing in it.

### StatusChip
`frontend/apps/web/src/components/archetypes/primitives/`

- **Props:** `state`: `upcoming` | `due-today` | `overdue` | `paid` | `expires` | `declined` | `waiting` | `deadline` | `deadline-today`.
- **Type:** captionMedium 12/16/500 `app-text-strong` on an `app-surface-sunken` pill, no border, 24px high, 12px leading glyph.
- **Hue:** glyph only, and only where it clears 3:1 on its fill. In dark mode `color-error` clears by 0.03 — widen it before this ships.
- **Keep distinct from `Chip` in the type system.** Chip is the semantic hue-coded label; StatusChip is the neutral one. If they are interchangeable, someone will reach for the wrong one.
- **Open:** deadline leads with the count or the date. Board entry 06.D, unanswered, and every consuming surface copies this chip.

### KindGlyph
`frontend/apps/web/src/components/archetypes/primitives/`

- **Props:** `kind` (17 keys: `garbage`, `recycling`, `garbage-recycling`, `bulk`, `move-in`, `lease-ends`, `notice-deadline`, `insurance-renews`, `warranty-ends`, `hoa-dues`, `property-tax-appeal`, `property-tax-due`, `voter-registration`, `bill`, `home-event`, `task`, `package`); `variant`: `row` 24 | `tile` 42 | `widget` 16 | `tray` 16.
- **Drawing:** 24-unit grid, 2pt stroke, round caps and joins, `app-text-strong`. The widget variant drops to a 1.5pt stroke and must be silhouette-safe for one-colour accented rendering.
- **The tile map is data.** Ten kinds have a picker tile; seven do not. Put that in the component, not in each caller.
- **Two known limits:** the two-cart `garbage-recycling` glyph does not survive 16px — consider the single-cart glyph in the widget and tray. And `recycling` is drawn as a chasing-arrows triangle with one head rather than three separate arrows, because three arrowheads cannot separate at a 2pt stroke on a 24 grid.

### ChoiceChip
`frontend/apps/web/src/components/archetypes/primitives/`

- **Props:** `variant`: `channel` | `role` | `time` | `filter` | `segment`; `state`: `default` | `selected` | `disabled` | `focus`; plus a reason string for `disabled`.
- **Geometry:** 32px visual inside a 44 / 48dp / 44px target, radius pill, padding 12 horizontal, 8 gap, label 13/18/600.
- **Tokens:** selected `color-primary-50` fill + 1px `color-primary-700` outline + `color-primary-700` label + leading check; unselected 1px `app-text-secondary` outline; disabled `app-text-muted` on both. The fill alone is 1.07:1, so the outline and the check are what make selection visible.
- **The responsive rule lives in the component:** below ~360px of effective width the group becomes one column of full-width rows — trailing check on iOS and web, Material 3 radio on Android.
- **Third shape, not an extension.** `Chip` is status and not tappable; `Pill` is a filter toggle with a solid active fill. Building ChoiceChip by extending either will drag the wrong behaviour along.
- **Known limit:** the `filter` variant's only label, "Photographed", is one word. At AX5 it needs about 382px and an iOS 393 row gives 329, so it overflows — a single word cannot wrap. Either the AX5 label shrinks or the label becomes two words.

---

## Token correction to reconcile

`tokens.json` records that `app-text-secondary` and `app-text-muted` were AA-corrected in September 2026 — `#6B7280` → `#4e5563`, `#9CA3AF` → `#5f6775`. The house style the board was drawn against still carries the old pair, and **every contrast ratio printed on the board is measured against it.** Decide which palette is canonical before any of this ships; if it is the corrected one, the board's ratio tables need re-measuring, and several "fails" and "exempt" notes change.

The cards in this pack name tokens rather than hexes, and the previews read them through `tokens.css`, so they already show the corrected values.

---

## Relationships to what already ships

Nothing existing was renamed or edited. Each new card names what it relates to:

| New card | Names | Difference |
| --- | --- | --- |
| SourceCaption | SourceNote | SourceNote for readings with no mark; SourceCaption wherever there is one |
| StatusChip | Chip, StatusChipRow, StatusDot | Chip's colour is part of the message; StatusChip stays neutral so the word carries the state |
| ChoiceChip | Chip, Pill | Chip is not tappable; Pill fills solid when active; ChoiceChip never fills solid and always adds the check |
| ScopeChip | Chip (identity variants) | Identity says whose it is; scope says who can see it |
| KindGlyph | IconTile | IconTile's tint carries category; a KindGlyph tile is untinted |
| ProvenanceMark | StatusDot | StatusDot is semantic; ProvenanceMark's fill means source — never in the same row |

---

## Still open across the board

These change drawn work, so they are worth closing before the components are built:

- ChoiceChip and KindGlyph on Android at 200%: keep the platform radio, whose unselected state is an empty ring — the same silhouette as the unconfirmed provenance mark — or use a trailing check on all three platforms.
- A selected ChoiceChip label: weight 600 with an ink change, or 700.
- StatusChip's deadline: count first or date first.
- KindGlyph's "Pickup day" tile: fixed at the two-cart glyph, or tracking the household's actual pickup.
- ScopeChip's decline wording.
- AddressChip's sender label: whether it may drop the scope sentence.
