# Foundations 00a → skinny-pantopus: repo handoff

**Why this file exists.** Nine components from Foundations board 00a are now published in the Pantopus design system as cards with previews. They have no source files in `skinny-pantopus`, and the system's index records that it was last rebuilt by `tools/design-system` from the repo. **The next rebuild will delete all nine** unless the repo gains them first. This lists what each one needs.

The components: ProvenanceMark · SourceCaption · ScopeChip · FreshnessLine · OfflineNotice · StatusChip · KindGlyph · AddressChip · ChoiceChip. The board is complete — 49 artboards, 387 named specimens.

---

## What the pipeline needs, in general

Every existing card in the system ends with a line like `Source: frontend/apps/web/src/components/archetypes/primitives/Chip.tsx`, so `tools/design-system` is reading component files from a known root and emitting one card per component. For these nine to survive a rebuild, each needs:

1. **A source file** at the path the tool scans. The existing primitives live under `frontend/apps/web/src/components/archetypes/primitives/`; three of them (ProvenanceMark, SourceCaption, FreshnessLine) are closer in kind to `frontend/apps/web/src/components/archetypes/place/primitives.tsx`, which is where `StatusDot` and `SourceNote` sit.
2. **An export from the bundle** — these must reach `window.Pantopus` the way `P.Chip` and `P.Overline` do, or their previews have to stay static HTML as they are now.
3. **Guidelines text** the tool can pick up (the existing cards read like hand-written prose with a `**Provide:**` block and a `**Rules**` list, so the tool is either reading doc comments or a sidecar file — whichever it is, the text in the published cards is the text to carry over).
4. **A `preview.html`**. The nine published previews are self-contained static HTML that read tokens through `var(--token)`. They work as they are; if the components join the bundle, rewrite them in the React form the other 54 use.

If the tool only emits cards for components it finds in code, the simplest safe path is to add the source files first and let the next rebuild replace these cards with generated ones.

---

## Per component

### ProvenanceMark
- **Props:** `kind`: `official` | `unconfirmed` | `you-added`; `size`: XS 12 | S 16 | M | L.
- **Drawing:** one 56-unit artwork scaled by width; stroke width is D/8 at every size, so the ring weight is identical from 12px to 96px. `official` is a filled disc; `unconfirmed` is a ring at r 24.5 with a 7-unit stroke; `you-added` is a filled disc with a tick cut out through a `userSpaceOnUse` mask.
- **Tokens:** ink `app-text-secondary`. Never a semantic hue.
- **Invariant to encode in code, not just docs:** filled vs hollow means provenance and nothing else. Worth a lint rule or a shared `<Disc>` primitive that only ProvenanceMark may use.

### SourceCaption
- **Props:** `mark` (a ProvenanceMark kind), `legend`, `source`, `scope`, `asOf`.
- **Type:** caption 12/16 `app-text-secondary`; legend word `app-text-strong` weight 500; links `color-primary-700`.
- **Behaviour:** the legend prints once per surface. That's surface state, not component state — it needs a provider or a per-screen flag, not a prop each caller remembers to set.
- **Relation to ship:** `SourceNote` stays as-is for public-record readings with no mark.

### ScopeChip
- **Props:** `variant`: `default` | `saved-place` | `named-home` | `claimed-home` | `pending` | `declined` | `scope-change-pair` | `struck`; plus a `footer-sentence` form.
- **Copy:** "Only you", "Your household", "<Home name> · Your household"; the sentence is "Only you will see this."
- **Type:** chip caption 12/16 on `app-surface-sunken` with a 16px scope glyph; footer sentence 14/20 `app-text-secondary` with the same glyph.
- **Open:** whether the decline wording is "Keep them private to me" or "Just me" (board entry 03.D1, unanswered).

### FreshnessLine
- **Props:** `state`: `fresh` | `updated` | `updating` | `refreshing` | `stale` | `fact-stale` | `offline` | `failed` | `widget-horizon`.
- **Copy:** "Updated just now", "Updated 12m ago", "Updating…", "as of 7:04 AM".
- **Behaviour:** `updating` uses the platform indeterminate hairline. A date falling today carries no weekday; past dates show the date only.
- **Unresolved, and it belongs in code:** precedence when states overlap (offline + stale + refreshing), and how long "Updating…" may show before it becomes "failed". Neither is decided on the board.

### OfflineNotice
- **Props:** `state`: `offline` | `reconnecting` | `back-online` | `cached-screen` | `queued-writes` | `form`.
- **Copy pattern:** name the blocked thing — "Compare needs a connection."
- **Rules:** neutral surface, no error hue; cached content stays visible; a form draws no FreshnessLine.
- **Unresolved:** whether "Reconnecting" belongs to OfflineNotice or FreshnessLine (both currently draw it), and `back-online` currently names a state with nothing drawn in it.

### StatusChip
- **Props:** `state`: `upcoming` | `due-today` | `overdue` | `paid` | `expires` | `declined` | `waiting` | `deadline` | `deadline-today`.
- **Type:** captionMedium 12/16/500 `app-text-strong` on an `app-surface-sunken` pill, no border, 24px high, 12px leading glyph.
- **Hue:** glyph only, and only where it clears 3:1 on the fill. In dark mode `color-error` clears by 0.03 — worth widening before it ships.
- **Relation to ship:** `Chip` stays the semantic hue-coded label. StatusChip is the neutral one. They should not be interchangeable in the type system.
- **Open:** deadline chip leads with the count or the date (board entry 06.D, unanswered). Every consuming surface copies this chip, so it should be settled before the component lands.

### KindGlyph
- **Props:** `kind` (17 keys: `garbage`, `recycling`, `garbage-recycling`, `bulk`, `move-in`, `lease-ends`, `notice-deadline`, `insurance-renews`, `warranty-ends`, `hoa-dues`, `property-tax-appeal`, `property-tax-due`, `voter-registration`, `bill`, `home-event`, `task`, `package`); `variant`: `row` 24 | `tile` 42 | `widget` 16 | `tray` 16.
- **Drawing:** 24-unit grid, 2pt stroke, round caps and joins, `app-text-strong`. The widget variant drops to a 1.5pt stroke and must be silhouette-safe for one-colour accented rendering.
- **Ten kinds have a picker tile**; seven do not. That map belongs in code as data, not in each caller.
- **Known issues:** the two-cart `garbage-recycling` glyph does not survive 16px — consider substituting the single-cart glyph in the widget and tray. The `recycling` glyph is drawn as a chasing-arrows triangle rather than three separate arrows, because three arrowheads cannot separate at a 2pt stroke on a 24 grid.

### AddressChip
- **Props:** `variant`: `held` | `recovery-row` | `duplicate` | `sender`; `state`: `default` | `selected` | `expired`.
- **Geometry:** a pill on `app-surface-raised`, 16px pin, street in bodySmallMedium 14/20 `app-text`, city in caption 12/16 `app-text-secondary`, padding 12 × 8, minimum height 44.
- **Copy:** "We're holding it for 7 days"; the recovery row "1107 NE Birchfield Ct, Camas — Save it"; the duplicate "You already saved this as 'Mom's house'" with a "Use for Today" action; on expiry "We're no longer holding this address." with "Search again".
- **Never a map, never coordinates.** It shows the address the server already holds so nobody retypes it between steps.
- **The scope sentence belongs to the component:** held, recovery and duplicate carry "Only you will see this." 8pt below — reused exactly from ScopeChip. A `sender` label describes someone else's place and carries none; the sentence moves under the recipient's own field. This is the one exception to the scope rule in the whole board, so enforce it in the type rather than by memory.
- **Two contrast facts:** on a selected `color-primary-50` fill the city goes to `app-text` (`app-text-secondary` there is 3.69:1 in dark), and in dark the chip has no border at all (`app-border` on dark `app-surface-raised` is 1.00:1). The selected outline stays, because it means something.
- **Expiry is not an error:** `app-surface-sunken`, `app-text-strong`, no warning hue, action reopens search prefilled.
- **No truncation:** street and city wrap. At large text the pill becomes a radius-lg rectangle, the pin grows to 32, and the action becomes a full-width button under the address.
- **Open:** whether the sender label may drop the scope sentence (board entry 08.D, unanswered).

### ChoiceChip
- **Props:** `variant`: `channel` | `role` | `time` | `filter` | `segment`; `state`: `default` | `selected` | `disabled` | `focus` | `passed` | `chosen-then-passed`; plus a reason string for `disabled`.
- **Geometry:** 32px visual inside a 44/48/44 target, radius pill, padding 12 horizontal, 8 gap, label 13/18/600.
- **Tokens:** selected `color-primary-50` fill + 1px `color-primary-700` outline + `color-primary-700` label + leading check; unselected 1px `app-text-secondary` outline; disabled `app-text-muted` on both.
- **Responsive rule that must be in the component, not the page:** below ~360px effective width the group becomes one column of full-width rows — trailing check on iOS and web, Material 3 radio on Android.
- **Relation to ship:** `Chip` is status and not tappable; `Pill` is a filter toggle with a solid active fill. ChoiceChip is the third shape and should not be built by extending either.
- **Known limit:** the `filter` variant's only label, "Photographed", is a single word. At AX5 it needs ~382px and an iOS 393 row gives 329, so it overflows. Either the AX5 label shrinks or the label becomes two words.
- **The two passed-lead states, from 00d.** A lead dated before today has passed and takes exactly one of two treatments. *Passed, never chosen*: ordinary disabled — `app-text-muted`, no check, still focusable, plus a written reason 8pt below in bodySmall 14/20 `app-text-secondary` naming only the never-chosen passed options. *Chosen, then passed*: `color-primary-50` fill, 1.5px `color-primary-700` outline, **no check**, label at 14/20 weight 400 in `app-text` and the word "passed" under it at 12/16 `app-text` (dark: `color-primary-900` fill, `color-primary-400` outline). Activating either shows the explanation and the suggestion instead of selecting; the suggestion is the longest lead still ahead and nothing saves until it is tapped, so displayed value and saved value diverge — component state, not page state.
- **Height consequence:** chosen-then-passed is 44 tall against ChoiceChip's 32, because two lines of 14/20 and 12/16 need 36. Any group sizing chips by a constant breaks; size by the tallest chip.
- **Two sizes doing one job:** ChoiceChip's offline reason is caption 12/16, 00d's passed explanation is bodySmall 14/20, both under the same control saying the same kind of thing. Settle on one.

---

## Token correction to reconcile

`tokens.json` in this system records that `app-text-secondary` and `app-text-muted` were AA-corrected in September 2026 — from `#6B7280` to `#4e5563`, and from `#9CA3AF` to `#5f6775`. The house style the board was drawn against still carries the old pair, and every contrast ratio printed on the board is measured against it. Before any of these nine ships, decide which palette is canonical; if it is the corrected one, the board's ratio tables need re-measuring and several "fails" and "exempt" notes change.

---

## Cross-references added to the published cards

Each new card that overlaps a shipped component names it and states the difference, per your instruction. Nothing existing was renamed or edited:

| New card | Names | Difference stated |
| --- | --- | --- |
| SourceCaption | SourceNote | SourceNote for readings with no mark; SourceCaption wherever there is one |
| StatusChip | Chip, StatusChipRow, StatusDot | Chip's colour is part of the message; StatusChip stays neutral so the word carries the state |
| ChoiceChip | Chip, Pill | Chip is not tappable; Pill fills solid when active; ChoiceChip never fills solid and always adds the check |
| ScopeChip | Chip (identity variants) | Identity says whose; scope says who can see |
| KindGlyph | IconTile | IconTile's tint carries category; a KindGlyph tile is untinted |
| AddressChip | Chip (identity variants), SearchInput | SearchInput takes an address typed; AddressChip shows one the server holds |
| ProvenanceMark | StatusDot | StatusDot is semantic; ProvenanceMark's fill means source — never in the same row |
