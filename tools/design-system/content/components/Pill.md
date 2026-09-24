A rounded filter toggle for horizontal filter rows.

**Provide:** `label`, optional `icon` (a rendered 14px icon), `active`, and `color` (the active fill, required for the active state to show; pass a token such as `var(--color-primary-700)`), plus button attributes (`onClick`).

**Rules:** one row, one active pill (single select). Inactive pills are `app-surface-muted` with a hairline and `app-text-muted` label (5.45:1). Active pills are filled with white text: pick a fill that holds white at 4.5:1 or better (`color-primary-700` 5.93, the `-solid` tokens 5.0 to 7.6). `color-primary-600` only reaches 4.10:1.

Native equivalents: `ChipPicker` (filled or tinted selection, 36pt min height, 44pt hit area) and `ActionChip`. Source: `frontend/apps/web/src/components/ui/Pill.tsx`.
