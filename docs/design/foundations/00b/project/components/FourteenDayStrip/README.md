# FourteenDayStrip

The next two weeks at this address drawn as a shape, above list rows that are the real tap targets.

14 equal cells, today on the left, in one track at radius 6 with a 1px `app-text-secondary` keyline
and 1px separators. At 326pt of content the pitch is 23.3pt.

## Anatomy

- **Cell** — 76pt: 6pt padding, up to three 12pt provenance marks with 4pt gaps, a 4pt gap, a 16pt
  line reserved for "+N", 6pt padding. "+N" appears at four or more items and is `caption`
  `app-text-strong`, because `app-text-secondary` on sunken is only 4.39:1.
- **Cell fill** — weekdays `app-surface-sunken`, weekends the same at 40%. Opacity marks the weekend,
  never hue, and the initials name it too.
- **Rules** — a civic, state or county rule is a solid 4pt bar at full cell height in
  `app-text-strong`, never a dot. It never counts toward the three-mark limit or "+N".
- **Holiday move** — the mark sits on the moved day; the usual day keeps a struck ghost at full ink.
- **Marks** — one ink, `app-text-secondary` at full opacity. Marks never dim, in any state.

Below the strip: one date row per item and a persistent 48pt "+ Add a date" in `color-primary-700`.

## Variants and states

Variants: today-card · widget-medium · window-crop · empty. States: loading · ready · empty · stale ·
permission-denied · t1 · error · highlighted-row.

## Accessibility

The strip is one adjustable element whose label is the summary; iOS steps one day per swipe and
Android adds "Next day" and "Previous day". Cells are targets only at 1440, where each is a 44px
button. On phones a 23pt cell fails 44pt, so the rows carry the targets.

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
