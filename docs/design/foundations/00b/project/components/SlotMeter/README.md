# SlotMeter

An honest, dated Founding Neighbor window that fails closed whenever anything is uncertain.

Five bounded capsules, 40 × 12pt at radius pill with 4pt gaps — 216pt in total — taken first from the
left.

## Anatomy

- **Taken** — solid `color-primary-600` with a 1.5px `color-primary-700` edge.
- **Open** — `app-surface` with a 45° hatch, 1.5px lines every 4pt, in `app-text-secondary`, and a
  1.5px `app-text-secondary` edge. Never hollow: hollow means "on record, not confirmed".
- **Numeral** — "3 of 5 open" in `label` `app-text`, 8pt right of the segments. It counts what is left
  and never measures progress.
- **Elapsed bar** — 4 × 216pt, radius pill: a solid `app-text-secondary` elapsed part and a 1px
  `app-text-secondary` outline for the remainder, never a border token. Decorative and hidden from
  assistive tech.
- **Date pill** — a neutral 24pt pill on `app-surface-sunken` with a 12pt calendar glyph and
  "Closes Tue 27 Oct" in `label`, both `app-text-strong`. A date, never a countdown.
- **RankBadge** — a separate 128 × 64pt squared shape at radius 8, published only with SlotMeter. It
  sits at least 24pt below the meter and never shares a row or a sentence with the tier. Squared,
  because discs and rings mean provenance.

At zero open slots, or after a failed lookup, nothing renders: the meter must never promise a slot the
system cannot honour.

## Variants and states

Variants: preview-card · block-founders-panel · wall-line. States: open · closed · lookup-failed.
Closed and lookup-failed are absence specimens — the host context is drawn around the gap.

## Accessibility

The meter is one element and is not a target; card actions are 44pt / 48dp / 44px. Absent states are
silent. Never write "permanent" unless the data model guarantees it.

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
