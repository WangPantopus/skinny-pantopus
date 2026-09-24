# PublicPointMap

Shows exactly where neighbours see a post, drawn at true scale from the server's stable public point.

Never a ring around the home and never a home marker "for orientation": the real offset area is about
twelve times larger than a 150 m ring, and a ring centred on the home reveals it.

## Anatomy

- **Map thumb** — 16:9, 326 × 183pt, radius 8, a 1px `app-text-secondary` edge, centred on the public
  pin. Neutral tokens only, no brand tint: land is `app-surface-sunken`, streets are 4pt
  `app-surface` lines with a 1px `app-text-secondary` casing.
- **Public pin** — one 24pt teardrop in `app-text` with a 2px `app-surface` halo and a 6pt
  `app-surface` centre. Its chip reads exactly "What neighbors see".
- **Scale bar** — bottom left on an 80% `app-surface` plate, a 1.5px `app-text` line with end ticks.
- **Controls** — one two-row cluster at every size: a zoom column at the left edge and a 3 × 2 arrow
  pad at the right. Buttons are 44 × 44pt (48 × 48dp on Android) at radius 8 with a 1px
  `app-text-secondary` edge and a 20pt `app-text` glyph. Every movement has a labelled button, because
  gestures alone exclude switch and keyboard users. Six 48dp buttons do not fit one row in 326pt.
- **Cells map** — a square 326 × 326 map with a 3 × 3 grid of 108/110/108pt cells, each at 70%
  `app-surface` over the base map, printing its bucket label in every cell. Never a lightness-only
  ramp: adjacent steps are only 1.16 to 1.66:1 apart. The user's cell takes a 2px
  `color-primary-600` inner outline and the words "Your cell".

Nothing is blurred, fogged or locked: everything is drawn and the requirement is stated in words.

## Variants and states

Variants: privacy-mirror · composer-one-liner · cells-map. States: ready · loading · vector-fallback ·
offline (with and without a cache).

## Accessibility

The map carries a text equivalent naming the pin, the distance, that the home is not shown, and the
scale. On web the focused map also accepts +, − and the arrow keys. The pin and the cells are never
targets, and buttons never auto-hide while assistive tech is on.

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
