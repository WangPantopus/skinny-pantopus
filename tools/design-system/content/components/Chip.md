A pill that states intent, status or identity in one or two words.

**Provide:** `label`, `variant` (`neutral` default, `primary`, `personal`, `home`, `business`, `success`, `warning`, `error`, `info`), optional `icon` (a Lucide component), `size` (`sm` 11px default, `md` 12px).

**Color pairs:** semantic chips are the label token on its `-light` fill (`color-success` on `color-success-light`: 4.84 to 5.70:1 in Light, 4.64 to 5.69:1 in Dark, 5.39 to 7.89:1 in Dark · iOS). Identity chips are the label token on its `-bg` fill. `primary` is `color-primary-700` on `color-primary-100`. `neutral` is `app-text-strong` on `app-surface-sunken`.

**Rules**
- Color means something: success is good, warning needs attention, error is broken, info is worth knowing. Never pick a variant for decoration.
- Pair status color with a word, and an icon where it helps. Color is never the only signal.
- Sentence case: "Coming soon", "Verified", "High". No emoji and no ✓ characters.
- Color lives in chips, dots and icon tiles. Don't flood a card or add a colored left border instead.

Native: `StatusChip` (iOS and Android) with the same variant names; it uses the `…Bg` token as fill. Source: `frontend/apps/web/src/components/archetypes/primitives/Chip.tsx`.
