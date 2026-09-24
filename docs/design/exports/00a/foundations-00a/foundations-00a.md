# Foundations 00a

Eight components drawn on the Foundations 00a specimen board before any screen was designed: ProvenanceMark, SourceCaption, ScopeChip, FreshnessLine, OfflineNotice, StatusChip, KindGlyph and ChoiceChip. Each was drawn once, at every variant, state, platform and text size, so that later screens copy a decision instead of making a new one.

They are not in the code yet. Every other card in this system ends with a `Source:` line pointing at a file in `skinny-pantopus`; these eight say so plainly instead. `tools/design-system` rebuilds this system from that repo, so **the next rebuild will delete these eight cards unless the repo gains the components first.** The handoff that goes with this batch lists what each one needs.

## The rules they share

**Provenance is one language.** A filled disc, a hollow ring and a ticked disc mean official, on record but not confirmed, and you added it. Nothing else in the product may use a plain disc or ring to mean anything, because a reader who has learned this alphabet will read every circle through it. On a standalone surface — a widget, a tray, a notification — every mark carries its word.

**The word carries the state, not the colour.** StatusChip, FreshnessLine and ChoiceChip all state their condition in words on a neutral fill. Hue is allowed on a glyph, never as the only signal. Each of the eight was checked in greyscale and each cell carries its verdict on the board.

**Scope is separate from ownership.** ScopeChip says who can see a thing. The identity variants on `Chip` say whose thing it is. They must not appear in the same chip.

**Offline is not an error.** OfflineNotice names the thing that needs a connection and keeps cached content readable. It does not borrow the error tone, which the real errors need.

**The target is the row, not the ornament.** A StatusChip is never tappable; its row is. A KindGlyph is never tappable; its tile-and-label cell is. Every target meets 44pt on iOS, 48dp on Android and 44px on the web, around a smaller visual.

**Selection is fill plus outline plus a mark.** A primary.50 fill on its own is about 1.07:1 — invisible as a shape. Wherever something is selected (ChoiceChip, the kind picker, the address chip) the fill is joined by a 1px `color-primary-700` outline and a check or dot, so the state reads without colour and without the fill.

**Large text becomes rows.** Below roughly 360px of effective width every chip group becomes one column of full-width rows: a trailing check on iOS and the web, a Material 3 radio on Android. Truncated choices cannot be told apart, so nothing truncates.

## Open decisions

These were raised on the board and are not settled. Each one changes drawn work:

- Whether ChoiceChip's Android rows keep the platform radio (whose unselected state is an empty ring, the same silhouette as the unconfirmed provenance mark) or use the trailing check on all three platforms.
- Whether a selected ChoiceChip label is weight 600 with an ink change, or 700.
- Whether the StatusChip deadline leads with the count or the date.
- Whether KindGlyph's "Pickup day" tile is fixed at the two-cart glyph or tracks the household's actual pickup.

## A note on token values

These cards name tokens, not hex values, and the previews read them through `tokens.css`, so they show this system's current values. The board itself was drawn against the house-style palette, which still carries the pre-correction `#6B7280` and `#9CA3AF` for `app-text-secondary` and `app-text-muted`. This system corrected both in September 2026. Where a contrast ratio matters, trust the token and re-measure; the ratios printed on the board are against the older pair.

## Not here yet

AddressChip is the ninth component of the board. Its anatomy is drawn; its variants, states, crops and scaling are not. It will be added once that batch is complete.
