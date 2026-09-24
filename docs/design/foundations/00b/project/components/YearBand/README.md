# YearBand

Twelve months of dated rules in four source lanes — the same data as FourteenDayStrip at a longer zoom.

Lanes are always You · Your city · Your county · Your state, and they are never collapsed: the source
of a rule matters as much as its date.

## Anatomy

- **Columns** — 12 months, current month first. On phones each is 27.2pt of 326.
- **Lane** — a 16pt label line, a 24pt lane, a 4pt gap. At 768px and wider the labels move into a
  128px left column and items sit on exact days.
- **Paint order** — lane fill · window wash · keyline and separators · rhythm ticks · today rule ·
  marks, bars and numerals. Marks, bars and numerals carry a 1pt halo matching the fill beneath them,
  so the today rule stops short of them instead of cutting through.
- **Phones group by month**: one 12pt mark per month per lane, with a count numeral in `captionMedium`
  `app-text` 1pt to its right at two or more items. A mixed-provenance group shows the hollow mark.
- **Rules** — county and state rules are 4pt bars at full lane height in `app-text-strong`, the same
  rule as FourteenDayStrip, so the strip and the band encode the same data the same way.
- **Projected** — after the last published city calendar the remaining keyline turns dashed and a
  caption says so.

The shaded 14-day window is `app-surface-sunken` in light and raised `#1E293B` in dark, because dark
lanes are `#0F172A` and a sunken wash would vanish.

## Variants and states

Variants: place-file · widget-large · gallery-sample · empty-checked. States: loading · ready ·
empty-checked · error · offline.

## Accessibility

The summary sentence is the label; the rows below are the table and the caption says so. Native is one
element with adjustable month cells, one month per swipe. Marks are never targets.

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
