Pantopus is a verified-home-address platform: look up any U.S. address, save your place, claim it, verify it, then get what is true about it every day (public records, local risks, mail, and who is verified nearby). The product runs on web (Next.js, the reference implementation), iOS (SwiftUI) and Android (Compose), and all three share this system. Its stated direction is **clean, trustworthy, warm**: neutral grounds, one sky-blue brand hue, a home green for the Place, and color only where it carries meaning.

## Content fundamentals

**Speak to the person at their address.** Use "you" and "your": "Your Place", "your block", "Verify your address to message neighbors and get your badge." Pantopus is "we" when it owns an outcome: "We couldn't find that address".

**Sentence case everywhere**: titles, buttons, chips, tabs, sheet titles ("Risk & readiness", "Pickup days, tax dates, hearings", "Coming soon"). Capitals come only from the `overline`, `groupLabel` and `pulseEyebrow` styles, never from typed text.

**Verbs first on every action.** "Verify address", "Claim home", "Add a place", "Try another address", "Be one of the first to verify on your block". Locked content says what you get or keep, tied to the next trust step ("Save this place to…", "Claim your place to…", "Verify your address to…"). Never write "Unlock".

**Say what is true, and how sure it is.** Every reading names its source and age: "FEMA National Flood Hazard Layer · May 2026", "as of 9:40 AM". Qualify screening data plainly: "Screening, not a diagnosis." Empty and missing data are honest, not apologetic: "Nothing here yet" / "We'll show this once it's available."; "Not available for your area yet." / "Coverage is expanding. Check back later."

**Privacy promises are explicit and specific.** "Never your house number." "Continue to save. Your preview stays on this device for 24 hours." Neighbor density is a qualitative bucket ("A few verified homes nearby"), never a count, on every surface.

**Errors say what failed and what to do.** "We couldn't look up that address. Try again." "Couldn't load this" + "Try again". No apologies, no blame, no exclamation marks.

**Confirmations are past tense, without symbols.** "Added to wallet", "Signed", "Locked in", "Address verified". Don't append ✓: the chip color and the word carry it, and screen readers stop announcing "checkmark".

**No emoji in product UI.** Glyphs come from the icon registries (see Iconography). Ratings show the number as text ("4.0 · 38 reviews"), not ★ characters.

**Numbers:** money with cents in lists (`$142.18`), counts in parentheses on tabs ("Upcoming (3)"), badge counts cap at "99+".

## Visual foundations

### Color

- **Neutrals carry the interface.** Paint the page `app-bg`, every card and sheet `app-surface`, recessed wells `app-surface-sunken`. Set text in four tiers: `app-text` (titles, values), `app-text-strong` (labels, nudge copy), `app-text-secondary` (subtitles, overlines), `app-text-muted` (captions, timestamps, placeholders). All four clear 4.5:1 on every surface in all three themes; the secondary and muted tiers were darkened in Sept 2026 to get there.
- **One brand hue.** `color-primary-600` is the brand: primary button fills, active tab underlines, progress fills, the mark body, the app icon ground. For interactive *text* and meaningful icons use `color-link` (5.93:1 on white; `color-primary-600` is only 4.10:1). Use tints (`color-primary-50` to `color-primary-200`) for sky callouts such as the verify banner.
- **The Place accent is home green.** Place icon tiles, the sparkline and density dots use `color-identity-home` on `color-identity-home-bg`. Calls to action inside Place cards stay sky (the CTA voice), never green.
- **Label and fill are different tokens.** Each semantic and identity family has a base token (a *label* ink that reads on its own tint and lightens in dark themes) and a `-solid` token (the *fill* that white text sits on, frozen across themes). Write `color-success` text on `color-success-light` or `color-success-bg`; fill a success button or dot with `color-success-solid`. Never put white text on a base token: in dark themes it turns pale.
- **Semantic meaning is fixed.** success = good or done, warning = needs attention or stale, error = broken or destructive, info = worth knowing. Always pair status color with a word (and an icon where it helps). A lost-item post is `color-rose`, not error; a rating is `color-star`, not warning.
- **Identity pillars are product states, not brand colors.** `color-identity-personal` (sky), `color-identity-home` (green), `color-identity-business` (violet) mark which self a surface belongs to. Native adds `color-warm-amber` for warm wizards and `color-magic` for AI-resolved metadata, so automation never looks like a primary control.
- **Color lives in chips, dots and icon tiles.** Never flood a card with a status color, and never add a colored left border to a card.
- **Category accents** (`cat-handyman` … `cat-vehicles`) are for map pins and category badges only. Several can't hold white text (see each note); keep text off them.
- **The marketing homepage is its own world**: `paper` ground, `ink-1` / `ink-2` text, `rule` hairlines and a serif display. It does not theme and it never appears inside the product.
- `color-live-badge` (the Live Photo dot) and `color-brand-check` (the check in the mark) never change between themes.

### Themes

Three themes ship here:

| Theme | Where it's used |
| --- | --- |
| **Light** | All three platforms, identical values. Android renders light only in practice. |
| **Dark** | The web, via `prefers-color-scheme` (slate grounds `#020617` / `#0f172a`). |
| **Dark · iOS** | The iOS asset catalog's dark appearances (`#0d1117` / `#161b22`). Android's dark Material scheme uses the same neutrals. |

Design new dark screens per platform with the matching theme. The two dark palettes diverge on neutrals, tints and `app-text-inverse`, and only the web has `color-link`.

### Type

- **System faces only.** SF Pro on Apple, Roboto on Android, the OS UI font on the web (`sans`). No webfont ships. Use `mono` for IDs and codes, and `serif` only on the marketing homepage and ceremonial "letter" surfaces.
- **The shared ramp** is `heading1` 30/36 bold, `heading2` 24/32, `heading3` 20/28, `body` 16/24, `bodySmall` 14/20, `caption` 12/16, `overline` 11/16 semibold with 0.06em tracking, plus medium variants and `label` 13/18. Native names: `h1`, `h2`, `h3`, `body`, `small`, `caption`, `overline`.
- **Titles track tight**: −0.02em on `heading1` and `placeTitle`, −0.015em on `heading2`, −0.01em to −0.012em on card titles and headlines. Uppercase labels track wide: 0.06em (overline), 0.07em (card eyebrows), 0.08em (group labels).
- **The Place dashboard runs denser**: `placeTitle` 28/32, card titles 15px semibold, values `cardValue` 15/21 medium, nudges 13.5/19, captions 12.5/18.
- Web buttons, tabs and row titles are 14px (`button`, `tab`, `bodySmallMedium`); native full-width buttons use `body`.

### Space, radius and layout

- **4px base** with jumps: `spacing-1` (4) … `spacing-16` (64). Pad cards and rows `spacing-4` (16px, 14px on compact and inline Place cards). Place pages keep a 16px side gutter on phones (20px from 640px). Separate dashboard groups by `spacing-6` and form groups by `spacing-8`.
- **Radii by role:** cards and sheets `radius-2xl` (20px), nudge rows, info notes and hero tiles `radius-xl`, buttons and icon buttons `radius-lg`, inputs `radius-md`, chips and pills `radius-pill`, avatars and dots `radius-full`. Place icon tiles use an off-scale 9px.
- **The card is one object**: `app-surface`, a 1px `app-border` hairline and a light shadow, and nothing else. Tappable row cards lift on hover (a larger shadow and 1px up). Group cards with an overline above them instead of nesting cards; use a sunken well for an inner group.
- **Shell:** a 56px top bar; on tablet and desktop a persistent sidebar (240px, collapsing to a 64px rail that expands on hover); on phones a 288px drawer and a four-tab bottom bar (Place · Today · Nearby · Mail, 24px icons, 11px labels). Place groups stack on phones and pair two across from 1024px, and a lone or odd card spans the row. Forms and wizards end in a sticky footer with one primary action. Choices open as bottom sheets on phones and centered dialogs on wider screens.

### Elevation

Use the `shadow-*` scale sparingly: `shadow-sm` on resting cards (always with the hairline), `shadow-md` for hover lift, `shadow-lg` for toasts and popovers, `shadow-xl` for drawers and dialogs, `shadow-primary` under native primary buttons. Shadows don't change in dark themes. Native draws them through `.pantopusShadow` / `Modifier.pantopusShadow`, never the platform default. On web, Tailwind's own `shadow-*` utilities still render instead of these tokens: `shadow-sm` there is `0 1px 2px 0 rgb(0 0 0 / 0.05)`.

### Motion

Motion confirms state; it is never decoration. Component state changes (chips, presses, focus, toasts) take 150ms ease-out and screen transitions 180ms ease-out. Under reduced motion both drop to 100ms (native `Motion` / `MotionTokens`), and the web collapses all animation to 0.01ms. Web entrances run 150–300ms ease-out (fade, fade-up 8px, slide-up 20px). Loading is a skeleton shimmer (1.5s web, 1.4s native), never a screen-level spinner.

### States

Every screen that fetches data has four states: loading (a skeleton in the shape of the content), empty (`ArchetypeEmptyState`), loaded, and error (with "Try again"). Place readings add **stale** (the "as of" stamp turns `color-warning` with a refresh glyph) and **unavailable** (coverage not there yet). Disabled controls are 50% opacity. Native screens show an offline banner on `color-warning-bg` when the network drops.

### Focus and touch

Web focus is `focus:ring-2 focus:ring-primary-500` (inputs use a 30% ring plus a `color-primary-500` border). Native minimum touch target is 44pt (buttons, fields, chip hit areas); Android's accessibility guide asks for 48dp. Web buttons and fields are 40–44px tall; icon buttons and the search input are 36–38px.

### Accessibility flags (kept as the source has them)

- White on `color-primary-600` is 4.10:1: primary buttons, the info toast and the default avatar disc miss AA for 14–15px text. `color-primary-700` (5.93:1) passes.
- `color-primary-600` *text* (text buttons, active tabs, section actions) is 4.10:1 on white; `color-link` is the AA replacement not yet adopted by those components.
- The `color-primary-500` focus ring is 2.77:1 on white, under the 3:1 floor for focus indicators; `color-primary-600` (4.10:1) would pass.
- Input and card borders (`app-border`) are 1.24:1: fine for decoration, weak as the only boundary of an input.
- Web toasts use raw Tailwind fills: success is 3.30:1, and the warning toast drops to 1.73:1 in dark mode.
- In the web Dark theme, `app-surface-sunken` equals `app-surface`, so nudge wells lose their edge and loading shimmer disappears.
- In Dark · iOS, iOS darkens the primary tints but not `color-primary-700` / `-900`, so sky chips and banners drop to 2.48 and 1.81:1. `color-warning-strong`, `-deep`, `color-magic`, `color-rose` and `color-warm-amber` also miss on their dark tints.

## Iconography

- **One vocabulary, three renderers, all named by Lucide.** The web uses `lucide-react` through the registries in `src/lib/icons.ts` (`NavIcons`, `HomeIcons`, `MailboxIcons`, `IdentityIcons` …, exported here on `window.Pantopus`). iOS calls `Icon(.chevronRight)`, which maps each Lucide name to an SF Symbol. Android calls `PantopusIconImage(icon = PantopusIcon.ChevronRight)`, backed by Material Icons Extended. CI rejects direct `Image(systemName:)`, `Icons.*` and raw drawables in feature code.
- **Defaults:** 20px at stroke 2 on native. On web, 16px inside buttons and chips (11–13px in small chips), 17–22px in rows and cards, 24px in the tab bar (stroke 2.25 when active, 1.75 at rest).
- **Icons inherit their text color** (`currentColor`) and take a semantic token only when they carry meaning: `color-identity-home` in Place tiles, `color-warning` on alert nudges.
- **No emoji, anywhere in product UI.** An icon that carries meaning gets a text label or an `aria-label` / `accessibilityLabel`.
- The **Icons** asset group holds the 16 primary navigation glyphs as SVG, drawn in `color-primary-600` for display (in product they take `currentColor`). The full set is the `lucide-react` package.

## The mark

The **perforation mark** is a postage-stamp body with eight punched perforations, a knocked-out window, and a verification check: mail, what is shown, and proof. Its geometry lives in one component per platform (`PantopusMark`) and a raster build script. Never redraw it.

- Body `color-primary-600` on light grounds, `color-primary-400` on dark; the check is always `color-brand-check`. On `color-primary-600` or any saturated ground, use the **reverse** variant: white body, white check, the ground showing through the window.
- Minimum size 16px. At 20px and below, a solid plug replaces the check.
- **Lockup:** gap = one third of the mark, wordmark 0.83× the mark height in bold system type with −0.02em tracking, in `app-text`.
- **App icon:** the reverse mark centered on a `color-primary-600` tile, body spanning 9/16 of the tile (Android adaptive foregrounds use 0.9 of that).
- Never rotate it, fill the window, move the check, recolor it to a pillar, or put a colored check on the reverse mark. The old octopus illustration and the `LayoutDashboard` glyph are retired as brand marks.

## Platforms and naming

| Role | Web (CSS / Tailwind) | iOS | Android |
| --- | --- | --- | --- |
| Surface | `--app-surface` / `bg-app-surface` | `Theme.Color.appSurface` | `PantopusColors.appSurface` |
| Secondary text | `--app-text-secondary` / `text-app-text-secondary` | `Theme.Color.appTextSecondary` | `PantopusColors.appTextSecondary` |
| Brand primary | `--color-primary-600` / `bg-primary-600` | `Theme.Color.primary600` | `PantopusColors.primary600` |
| Home label / fill | `text-app-home` / `bg-app-home-solid` | `home` / `homeSolid` | `home` (no solid; light-only) |
| Spacing | `--spacing-4` / `p-4` | `Spacing.s4` | `Spacing.s4` |
| Radius | `--radius-2xl` / `rounded-2xl` | `Radii.xl2` | `Radii.xl2` |
| Type | Tailwind sizes | `.pantopusTextStyle(.h1)` | `PantopusTextStyle.h1` |
| Shadow | `shadow-sm` | `.pantopusShadow(.sm)` | `Modifier.pantopusShadow(PantopusElevations.sm)` |

Token names here follow the web's CSS custom properties (minus `--`). In `globals.css` the `app-*` neutrals are stored as `R G B` triplets so Tailwind opacity modifiers work (`bg-app-surface/95`); here they are hex. Raw hex and on-scale spacing or radius literals in feature code fail CI on iOS and Android.

## Components

`components/bundle.js` is the web's own component layer, compiled from `frontend/apps/web/src/components` (archetype primitives, the Place archetype, shared UI and the brand mark) into `window.Pantopus`, with the Tailwind styles they use in `components/bundle.css`. The web app runs React 19; these previews run on React 18. `dark:` variants follow the `data-theme` attribute here instead of the OS setting. Two Place components are renamed where names collide: `PlaceSectionCard` and `PlaceGroup`.

**Intentional addition:** `Button`. The web has no standalone button, only a class recipe repeated across page headers, sticky footers and empty states. It is packaged here as one component because every screen needs it; native has real `PantopusButton` components.

## Not synced

Taken from {{source}} ({{date}}).

- **Not placed as tokens:** the homepage texture and gradient variables (`--paper-grain`, `--porch-fall`, `--porch-grain`); the stationery, ink and wax-seal palettes (`@pantopus/ui-utils` `stationery.ts`, and design-export CSS that no code reads); membership tier colors (design export only); the native species and third-party scheduling palettes; iOS `stripeBrand`, `AccentColor` and `LaunchBackground`; and native duplicates of values already here (`successDk`, `homeDark`, `warmAmberSoft`, `warmAmberBorder`).
- **Fonts:** none to fetch; every platform uses system faces.
- **Imagery:** `public/landing/og-image.png` still shows the retired octopus illustration and is left out.
- **Components not built:** the page archetypes (`ListArchetype`, `FormArchetype`, `WizardArchetype`, `DetailArchetype`, `HubArchetype`, `MailboxItemDetailArchetype`); the app shell (`AppShell`, `MobileTabBar`, `UnifiedFAB`); store-driven singletons (`ConfirmDialog`, `ToastContainer`, `FloatingPromoModal`); `ReportModal`, `QRCode`, `LoadingSkeleton` and `ErrorBoundary`; the legacy `PageHeader` and `PantopusBadge`; the API-bound `ProBadge`; and the native component libraries (57 files on iOS, 56 on Android; for example `ChipPicker`, `TimelineStepper`, `BalanceHero` and `PerforatedStamp`), which are referenced by name where they mirror a web component.
- **Route:** `tools/design-system/build.mjs` builds every file here from the repository with its own TypeScript and Tailwind (no install step). Native components are documented by name only.
