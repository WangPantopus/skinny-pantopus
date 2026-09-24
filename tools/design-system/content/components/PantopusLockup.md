The mark plus the "Pantopus" wordmark, for headers and sign-in screens.

**Provide:** `size` (the mark's edge in px), optional `variant` (`auto` or `reverse`).

**Proportions:** gap = size ÷ 3; the wordmark is 0.83 × size, weight 700, tracking −0.02em, lifted 0.04em so the mark sits on its x-height. The wordmark is live system-font text, never outlined, in `app-text` (white in `reverse`). The mark is decorative here; the word carries the name.

Use `reverse` only on `color-primary-600` or another saturated ground. Don't restyle the word, add a tagline inside the lockup, or swap in the retired octopus or the `LayoutDashboard` glyph (`PantopusBadge` still does; don't copy it).

Native: `PantopusLockup` on iOS and Android, same proportions. Source: `frontend/apps/web/src/components/brand/PantopusMark.tsx`.
