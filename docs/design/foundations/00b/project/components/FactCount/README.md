# FactCount

States how much is on file for an address without implying that anything is missing.

An integer and the words "on file", then one labelled pip per category that has anything known — in
the fixed order Place · Dates · Money · People · Proof. The block is at most 160pt wide.

## Anatomy

- **Line 1** — the integer in `heading3` 20/28/600 `app-text`, a 4pt gap, then "on file" in `caption`
  12/16 `app-text-secondary`, sharing one baseline.
- **Line 2** — pips 6pt below: height = text line height + 4pt, radius pill, `app-surface-sunken`
  fill, `captionMedium` `app-text-strong` at 9.37:1, 8pt horizontal padding, 4pt gaps. Pips wrap 4pt
  below the previous pip line. A pip is always a word, never a bare dot, so categories are carried by
  words and not colour.
- **Unknown categories draw nothing** — no greyed placeholders, no outlines, no "0". An empty slot
  reads as a task left undone, and the host place file owns any "You can also add" list.

No ring, no progress bar, no level, no percentage and no count-up animation in any state: the count
states what is held, not how far someone has come. Never "X of Y" — fractions imply incompleteness.

## Variants and states

Variants: place-file-header (left-aligned) · keeper-strip (right-aligned in 160pt) · t1 (Place and
Dates only) · wall-line. States: default · loading · offline.

## Accessibility

The whole block is one target of at least 44pt, extended beyond the visible block if needed. Its
spoken label starts with the visible text — "14 on file: place, dates, money, people." — so the
accessible name contains the label (WCAG 2.5.3).

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
