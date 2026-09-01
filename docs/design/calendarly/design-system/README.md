# Pantopus Design System

> A neighborhood super-app where verified-identity people get real things done with each other — tasks, marketplace, home command, and a digital mailbox.

## The product

**Pantopus** is pitched as the **Verified People Platform**: "Get real things done with real people." It's a single app that rolls together what would normally be five separate products:

1. **The Pulse** — an intent-driven local feed (Ask, Recommend, Event, Lost & Found, Announce).
2. **Tasks / Gigs** — the full hire / earn lifecycle (post → bid → chat → pay → review).
3. **Marketplace** — goods, rentals, vehicles, and free/wanted listings with a map layer.
4. **Home / Household** — a per-address command center for tasks, packages, access, emergency info, members.
5. **Digital Mailbox** — package tracking, civic notices, permits, delivery pins on a map.

The glue is **address verification**. Every user proves their address via physical mail, property records, or document upload — so interactions happen between neighbors whose identity is real, not anonymous handles. Privacy is granular: verification builds trust without forcing exposure.

Three **identity pillars** surface throughout the product:

- **Personal** (sky blue) — individual accounts
- **Home** (green) — household contexts
- **Business** (violet) — verified business profiles with team roles

## Products in scope

| Surface | Path in codebase | Stack |
|---|---|---|
| Web app + marketing site | `pantopus/frontend/apps/web` | Next.js 14 App Router, Tailwind, `@pantopus/theme` tokens |
| iOS/Android app | `pantopus/frontend/apps/mobile` | React Native / Expo |
| Shared theme | `pantopus/frontend/packages/theme` | Colors, typography, spacing, radii, shadow tokens |

## Sources read

- **Codebase**: mounted at `pantopus/` via File System Access API.
  - Theme tokens: `pantopus/frontend/packages/theme/src/{colors,typography,spacing,radii,shadows}.ts`
  - Global CSS: `pantopus/frontend/apps/web/src/app/globals.css`
  - Landing page: `pantopus/frontend/apps/web/src/app/page.tsx` + `_components/*`
  - App surfaces: `pantopus/frontend/apps/web/src/app/(app)/app/**`
  - Mobile: `pantopus/frontend/apps/mobile/src/**`
- **Landing art & badges**: `pantopus/frontend/apps/web/public/landing/*` (copied into `assets/`).
- **GitHub repo** `wypgitt/pantopus` — not separately browsed; same source tree.

---

## CONTENT FUNDAMENTALS

The voice is **plainspoken, confident, slightly warm, never cutesy**. It sounds like a real person telling you what the product does, not a growth-hacked AI blurb.

### Tone rules

- **Short declarative sentences.** "Post a task, get bids, chat, pay — done." Em-dashes and ellipses carry rhythm.
- **Second person ("you"), never first-person plural ("we")** in product copy. Marketing landing uses "you" for actions, "Pantopus" (never "we") as the doer.
- **Verbs first on CTAs.** "Post a task", "Claim your home", "Create your page", "Get started free", "See how it works". Never "Click here" / "Learn more" alone.
- **Concrete over abstract.** "Repeat clients who know you" beats "build lasting relationships." Always lead with the outcome, not the feature.
- **Trust language is a motif.** "Verified", "address-proven", "real people", "private by default". These repeat intentionally.

### Casing

- **Headlines**: sentence case. "Get real things done with real people." Never title case.
- **Section titles**: sentence case.
- **Buttons / CTAs**: sentence case. "Create your account", "Browse tasks".
- **Nav items, stat labels, overlines**: **Title Case** ("How It Works", "Trust & Identity").
- **Badge pills / eyebrow kickers**: Title Case. "Feed", "Work", "Messaging".
- **Overline/kicker text**: UPPERCASE with letter-spacing (from `.overline` style).

### Emoji

Emoji **are** used — sparingly, as section-category markers, not inline decoration. Specifically:
- First Win cards: 🙋 💸 🏠 🏪 (one per card, big).
- Pillar cards: 🌐 💼 💬 🗺️ 🏪.
- Trust cards: 🔒 🎯 ⭐ 🛡️.
- Never in body copy or button labels.

Lucide icons carry the functional load; emoji carry the vibe on marketing surfaces.

### Examples pulled from production copy

- Hero: "Get real things done with real people."
- Sub: "Pantopus connects you with verified, address-proven people — to hire, sell, buy, coordinate, and manage the real-world stuff that apps built for strangers can't handle."
- Trust tag: "Private by default. Verification builds trust, not exposure."
- First Win body: "Post a task, get bids, chat, pay — done."
- Step copy: "Verify your identity — Create an account and verify your address. This is what makes everything else trustworthy."

### Anti-patterns

- No exclamation points in product copy.
- No em-dash-heavy AI cadence ("not just X, but Y").
- No "revolutionary", "seamless", "reimagine", "unlock". Say what it does.
- No "Loading…" — use shimmer skeletons instead.

---

## VISUAL FOUNDATIONS

### Palette

- **Primary**: sky blue scale, canonical `#0284C7` (primary-600). Used for CTAs, links, active states, the logo wordmark, and the Personal identity pillar.
- **Neutrals**: true grays (`#111827` → `#9ca3af` → `#f6f7f9`). App background is `#f6f7f9`; surfaces are pure white.
- **Semantic**: emerald `#059669` (success), amber `#D97706` (warning), red `#DC2626` (error). Each has a `-light` (tint) and `-bg` (very pale wash) variant for backgrounds.
- **Identity pillars**: Personal sky `#0284C7`, Home green `#16A34A`, Business violet `#7C3AED` — each with a pale `-bg` for chip backgrounds.
- **Category accents** (map pins, category chips): handyman orange, cleaning green, moving purple, pet-care red, child-care amber, tutoring blue, delivery gray, goods violet, rentals green, vehicles red.

### Type

System font stack — no custom webfont. Sizes from `@pantopus/theme` typography.ts: h1 30/36/700, h2 24/32/600, h3 20/28/600, body 16/24/400, small 14/20, caption 12/16, overline 11/16/600 uppercase. Landing hero uses a display scale (clamp 48–72px / 800) that isn't in tokens — marketing-only.

**Letter-spacing**: tight on large type (-0.02em on h1, -0.03em on display), neutral on body, +0.06em on overlines.

### Spacing

A small strict 4-based scale: 0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64. Used consistently for both padding and gap.

### Radii

`xs 4 / sm 6 / md 8 / lg 12 / xl 16 / 2xl 20 / 3xl 24 / pill 9999`. Buttons use `lg` (12) or `xl` (16 on hero CTAs). Cards default to `xl` (16) or `2xl` (20). Pills for intent tags and badges.

### Shadows

Soft, low-opacity elevation system (0.04–0.10 alpha). Five steps: sm / md / lg / xl. Shadow color is black; no colored shadows except a brand-tinted `shadow-primary: 0 6px 16px rgba(2,132,199,.18)` used under primary CTAs. Modals use xl. Map pins use a tight `0 2px 8px rgba(0,0,0,.25)`.

### Backgrounds

- App shell: flat `#f6f7f9` — no patterns, no textures, no repeating illustrations.
- **Hero uses a soft radial gradient**: blue-50 → white vertical gradient with two blurred "blob" highlights (primary-100/60 top-center, emerald-100/40 top-right). This is the *only* gradient in the system and only appears on the marketing landing hero.
- No grain, no tilt textures, no hand-drawn illustrations.
- Marketing page imagery is **product screenshots** (see `assets/magic-task-*.png`, `assets/explore-map.png`, `assets/marketplace-hero-sofa.webp`).

### Imagery

Product screenshots on clean backgrounds. Color vibe: **cool, crisp, neutral** — no warm filters, no b&w, no grain. Real product captures rather than stock photography. One product video (`demo-video.mp4`) drives the hero phone mockup.

### Cards

Border + subtle shadow, not heavy shadow + no border. Standard card: `bg-white border border-gray-200 rounded-2xl shadow-sm`, padding 16–24. Hover lifts to `shadow-md` with a tiny translateY. **No left-border color accents**; color lives in chips, icons, and pills inside the card.

### Borders

1px default (`#e5e7eb`), 1.5px on interactive emphasis, 2px on map-pin outlines. Dashed borders reserved for "in progress / pending" states (map pins, drop zones).

### Hover & press

- **Hover**: swap to the next-darker primary tone (`primary-600` → `primary-700`) or swap surface → `--app-hover` (#f3f4f6). Tiny translateY(-1px) on cards.
- **Focus**: `ring-2` at `primary-400/40` alpha, 2px offset. Always visible, never removed.
- **Press**: no scale transform in the web code; mobile RN uses `activeOpacity` defaults (~0.7).
- **Disabled**: 50% opacity, cursor-not-allowed.

### Animations

- Transitions are short and functional: 150–200ms ease-out.
- Custom keyframes defined: `slide-in-right`, `slide-in-left` (200ms ease-out, 100% translate), `pulse-ring` (teal halo around active map pins), `pin-fade-in` / `pin-fade-out` (150–200ms), `cluster-count-pop` (250ms, scale 1→1.18→1).
- Reduced-motion: globally honored — all animation & transition durations collapse to 0.01ms under `prefers-reduced-motion`.
- No bounces, no spring physics, no long flourishes.

### Transparency & blur

- Sticky navs: `bg-app-surface/90 backdrop-blur-md`.
- Map popups: `bg-white/96 backdrop-blur-14px` with soft shadow.
- Intent chips, identity chips, and semantic-bg fills are used *opaque* — no translucency.

### Layout rules

- Max width 1280 (`max-w-7xl`) on landing, 1024 on app content.
- Sticky top nav, 64px tall.
- App shell: left sidebar (desktop) / bottom tab bar (mobile) + top header + content.
- Hero and section padding: 96–128px vertical on desktop, 48–64 on mobile.
- "Protection gradients" for text over images are not used — the codebase prefers solid chips/cards on top of imagery rather than gradient scrims.

### Corner radii summary

Pills (intent, status, identity) use `9999`. Buttons use `12`. Cards and modals use `16–20`. Input fields use `8`.

### What it is NOT

- Not purple-indigo gradient-forward SaaS.
- Not dark-mode-first (dark mode exists but light is canonical).
- Not illustrated / handcrafted.
- Not playful — it's a *trust* product; the aesthetic is calm, practical, a little financial-services-adjacent but warmer.

---

## ICONOGRAPHY

**Primary icon system: [Lucide](https://lucide.dev/) via `lucide-react`** (web) and `lucide-react-native` (mobile). Used absolutely everywhere in the app — sidebar, headers, empty states, status indicators, form field adornments, inline row icons, map marker content. Default stroke width 2, default size 16–24px.

**Emoji** are used as decorative markers on marketing surfaces (First Win cards, Pillar cards, Trust cards) — never inside the product UI. See CONTENT FUNDAMENTALS › Emoji.

**Unicode glyphs** appear in a few legacy spots (`&#128176;` 💰 on the payments empty state, `&#128273;` 🔑 on verification center) but Lucide is the default and new code should use it.

**Logos & brand marks**:
- `assets/favicon.svg` — the single brand mark.
- Wordmark is set in the UI font (no custom logotype); the NavBar uses a Lucide `LayoutDashboard` glyph + "Pantopus" text.
- App Store and Play Store badges (light + dark variants) in `assets/badge-*.svg`.

**Category map pins** are code-rendered (styled divs) rather than icon assets — see `src/components/gig-browse/MapRail.tsx` for category color mapping.

**Substitutions flagged**: none. Lucide is CDN-available and is the same library the production app uses.

---

## Font substitution note

The production apps ship **no custom webfont** — both web and mobile fall back to the system UI stack. If a future brand designer introduces a proprietary typeface, drop the files into `fonts/` and update `colors_and_type.css`. Until then, system fonts *are* the spec and preserve perfect parity with the real product.

---

## Index / manifest

Root of this design system:

| Path | What |
|---|---|
| `README.md` | This file — brand, tone, visual foundations, iconography |
| `SKILL.md` | Invocation prompt for re-use as an Agent Skill |
| `colors_and_type.css` | CSS vars for colors, spacing, radii, shadows, type |
| `assets/` | Logos, store badges, product screenshots, QR codes |
| `preview/` | Small HTML cards powering the Design System review tab |
| `ui_kits/web/` | Web UI kit — landing + app shell recreations (React/JSX) |
| `ui_kits/mobile/` | Mobile UI kit — iOS-framed React Native-style screens |

### UI kits

- **Web** — `ui_kits/web/index.html` (landing + marketplace), components: `NavBar.jsx`, `HeroSection.jsx`, `FirstWinCards.jsx`, `MarketplaceListing.jsx`, `PulseFeed.jsx`.
- **Mobile** — `ui_kits/mobile/index.html`, components: `TabBar.jsx`, `HomeScreen.jsx`, `TaskScreen.jsx`, `ListingScreen.jsx`.

### Assets inventory

`assets/favicon.svg`, `assets/badge-appstore*.svg`, `assets/badge-playstore*.svg`, `assets/explore-map.png`, `assets/magic-task-{input,output}{,-light}.png`, `assets/marketplace-hero-sofa.webp`, `assets/snap-sell-photo.avif`, `assets/og-image.png`, `assets/demo-video-poster.jpg`, `assets/qr-ios.png`, `assets/qr-android.png`.
