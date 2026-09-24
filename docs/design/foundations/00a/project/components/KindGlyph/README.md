# KindGlyph

One drawn glyph per dated kind, used in picker tiles, rows, the pickup card and the widget.

**Provide:** `kind` (17 keys: `garbage`, `recycling`, `garbage-recycling`, `bulk`, `move-in`, `lease-ends`, `notice-deadline`, `insurance-renews`, `warranty-ends`, `hoa-dues`, `property-tax-appeal`, `property-tax-due`, `voter-registration`, `bill`, `home-event`, `task`, `package`) and `variant` (`row` 24, `tile` 42 with a 24 glyph, `widget` 16 at a 1.5pt stroke, `tray` 16 monochrome).

**Rules**
- Line icon on a 24 grid, 2pt stroke, round caps and joins, `app-text-strong`. No fills and no hue: a silhouette plus a label is the class cue.
- Decorative and hidden from assistive tech whenever a text label sits beside it; labelled with the kind otherwise.
- The tile-plus-label cell is the target, never the 42px tile and never the glyph.
- Ten of the seventeen have a picker tile; the rest appear only in rows, the card, the widget and the tray.

**Relates to:** `IconTile` is the tinted tile that hosts a category icon, where the tint carries category. A KindGlyph tile is untinted `app-surface-sunken`, because the kind is already named underneath it.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-07. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.