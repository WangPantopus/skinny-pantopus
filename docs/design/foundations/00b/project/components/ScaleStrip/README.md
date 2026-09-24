# ScaleStrip

The four-layer reading instrument: one row per authority, each on that authority's own ordered bands,
never adding up to a grade.

Row order is fixed — Flood · Wildfire · Air · Radon — and rows are never re-sorted, because people
compare rows by position.

## Anatomy

A row is the layer name (`label` 13/18/600 `app-text-strong`), the value line "Word · number"
(`bodyMedium` 16/24/500 `app-text`), the track zone, the band names, and a source caption. Row padding
is 12pt top and bottom; the gaps are 4 · 8 · 4 · 8. Each row is at least 48pt and is a single target.

- **Track** — equal-width bands, 12pt tall, filled `app-surface-raised`, 1.5px `app-text-secondary`
  separators, a 1px `app-text-secondary` keyline, radius 4. Least hazard on the left. The layers do not
  share an axis.
- **Occupied band** — a 2px `app-text` outline inside its edges.
- **Marker** — a vertical capsule 4 × 20pt, radius pill: `app-text` core with a 2px `app-surface` halo,
  8 × 24pt overall, extending 4pt beyond the track. Never a disc: discs and rings mean provenance.
- **Band names** — `caption` 12/16 `app-text-secondary`, up to two lines, never truncated. The occupied
  name is `captionMedium` `app-text` under the marker.
- **Air** is the one coloured row and uses AqiBand's instrument-row form.

## Variants and states

Variants: flood · wildfire · radon · air · compare · no-data · not-studied · non-burnable · frozen ·
collapsed. States: loading · ready · partial-loading · partial-failed · differs · stale · ax5.

Compare replaces the capsule with two identical labelled triangle pointers, one above and one below a
single track, and states the result as "Same band" or "Different band" — never better or worse.

## Accessibility

Each row is one element; on web each row is focusable. The spoken label is the value plus the scale
ends plus the source and the provenance word. Markers and cells are never targets — the row is.

## What the consumer provides

The readings with their authority, scope and as-of; the occupied band per layer; and the threshold
state. The component never fetches and never re-sorts.

### Token names

The 00b board writes tokens in the house-style shorthand; this system names them as the web's CSS
custom properties. They are the same values:

| board | this system |
| --- | --- |
| surface.base | `app-surface` |
| surface.app | `app-bg` |
| surface.sunken | `app-surface-sunken` |
| surface.raised | `app-surface-raised` |
| text.primary | `app-text` |
| text.strong | `app-text-strong` |
| text.secondary | `app-text-secondary` |
| text.muted | `app-text-muted` |
| border.default | `app-border` |
| primary.600 / primary.700 | `color-primary-600` / `color-primary-700` |
