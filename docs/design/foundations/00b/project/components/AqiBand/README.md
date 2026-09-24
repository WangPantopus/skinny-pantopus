# AqiBand

The one officially coloured scale: the EPA AQI with its category name, drawn the same way everywhere
air appears.

Six equal category segments in the EPA ColorVision Assist hues, 2px gaps in the host surface, and a
1px `app-text-secondary` keyline on every segment — some hues nearly vanish against their surface
(Good is 1.22:1 and Moderate 1.54:1 on white; Hazardous is 1.08:1 on dark raised).

## Anatomy

- **Segment height** — 16pt in the detail card, 12pt in the ScaleStrip row, 8pt in widget micro.
- **Marker** — the ScaleStrip capsule, 4pt wide, height = segment + 8pt. One of its two tones always
  clears 3:1 against every hue in both themes.
- **Position** — (value − segment low) ÷ (segment high − segment low). "301+" spans 301–500 for
  position only; above 500 clamps right and the number is still printed.
- **Value line** — `bodyMedium` `app-text`, always on the card and never on a fill: `app-text` on
  Hazardous is 1.31:1.
- **Health statement** — `body` `app-text`, verbatim from EPA. A paraphrase is a reporting error.
- **Threshold rule** — 1.5px dashed `app-text`, drawn at the user's chosen level, centred in the gap
  before the segment whose low value equals it.

The EPA hues are the one colour exception in Pantopus and are **not yet tokens** in this system; they
are literal values. Everything else on the band is a token.

## Variants and states

Variants: detail · instrument-row · widget-micro. States: ready · stale · no-reading · alert ·
still-above · offline.

## Accessibility

The value line is the summary and the band is one element. "category N of 6" appears in spoken labels
only. The band is never a target.

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
