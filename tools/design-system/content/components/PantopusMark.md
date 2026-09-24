The perforation mark: a postage-stamp body with a knocked-out window and a verification check (mail, what is shown, and proof).

**Provide:** `size` (edge length in px, minimum 16), optional `variant` (`auto` resolves light/dark; `reverse` paints body and check white for colored grounds) and `title` (the accessible name; omit it when the wordmark sits beside the mark).

**Geometry (viewBox 64):** body 4,4 56×56 r13; eight r4.5 perforations punched out at (23.5,4) (40.5,4) (23.5,60) (40.5,60) (4,23.5) (4,40.5) (60,23.5) (60,40.5); window 20,20 24×24 r4, also a knockout; check `M26 32.4 30.2 36.6 38.2 26.8`, stroke 4.4, round caps and joins. At 20px and below a 12×12 r3 plug replaces the check.

**Color:** body `color-primary-600` in light, `color-primary-400` in dark; check `color-brand-check` in both. `reverse`: white body and white check, which reads because the window shows the ground through it.

**Never** rotate it, fill the window, move the check out of the window, recolor it to a pillar (violet and amber are product states, not brand), or "fix" `reverse` to a colored check.

Native: `PantopusMark(size:variant:)` (iOS `Core/Design/Components/PantopusMark.swift`) and `PantopusMark(size, variant)` (Android `ui/theme/PantopusMark.kt`) share this geometry; `scripts/build-icons.mjs` rasterizes it for every app icon. Source: `frontend/apps/web/src/components/brand/PantopusMark.tsx`.
