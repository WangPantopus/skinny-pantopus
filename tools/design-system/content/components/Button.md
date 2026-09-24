One button with the web's repeated recipe: 14px/600 label, 12px radius, primary, ghost or tonal fills.

**Intentional addition.** The web has no standalone button component; this is hand-written from the class recipe repeated in `ArchetypePageHeader` (ActionButton), `StickyFooter` and `ArchetypeEmptyState`. Native has the real thing: `PantopusButton` / `PrimaryButton` / `GhostButton` / `DestructiveButton` (full width, min height 44, `Radii.lg`, `body` label, disabled opacity 0.5).

**Provide:** `children` (the label), `variant` (`primary` default, `ghost`, `danger`, `success`, `warning`), `size` (`md` 40px with 16px side padding for page headers and empty states; `lg` 44px with 24px padding for sticky footers and forms), optional `icon` (a Lucide component, 16px), `loading` (spinner, disabled), plus any native button attributes.

**Rules**
- One `primary` per view, for the thing the screen is for. Everything else is `ghost`.
- Labels are verbs first, sentence case: "Verify address", "Claim home", "Add a place". Never "Unlock".
- `danger`, `success` and `warning` use the `-solid` fills, which hold white text at 7.43, 5.48 and 6.26:1 in every theme.
- Disabled is 50% opacity; don't also gray the label.

**Contrast flag:** white on `color-primary-600` measures 4.10:1, under AA for a 14px label. Hover (`color-primary-700`) measures 5.93:1. Kept as the source has it.
