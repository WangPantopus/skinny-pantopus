# Claude Code prompt set — Pantopus mobile new-design build-out

> **Companion to `docs/new-design-parity.md`.** Each prompt is a single
> Claude Code session producing one mergeable change. Copy-paste any
> single section between `---` markers into a fresh Claude Code session.
>
> **34 prompts total**, ordered to respect dependencies. Run sequentially
> by default; some pairs (P6.x, P7.x, P8.x) can run in parallel once their
> phase prerequisites are met.

---

## How to use this document

**Each prompt is self-contained.** It includes the context Claude Code
needs (paths, design references, conventions, acceptance criteria) so you
don't have to brief the session manually.

**Recommended workflow per prompt:**
1. Open a fresh Claude Code session in the monorepo root.
2. Paste the prompt body (the `---`-delimited block).
3. Let Claude Code run; review the PR it produces.
4. Merge, then move to the next prompt.

**If you hit a tricky one,** ask Claude Code to first produce a plan
before writing any code; the prompt's acceptance criteria become the
plan's success rubric.

---

## Universal conventions (every prompt assumes these)

Every prompt below assumes the following ground rules. Claude Code should
read these once per session and treat them as invariant.

**Repository layout:**
- iOS source — `frontend/apps/ios/Pantopus/`
  - Features — `Features/<Area>/`
  - Shared shells — `Features/Shared/{Wizard, Form, GroupedList, ContentDetail}/`
  - Design system — `Core/Design/{Colors, Typography, Spacing, Radii, Shadows, Motion, Components}/`
  - Snapshot tests — `PantopusTests/Features/<Area>/`
- Android source — `frontend/apps/android/app/src/main/java/app/pantopus/android/`
  - Screens — `ui/screens/<area_snake>/`
  - Shared shells — `ui/screens/shared/{wizard, form, grouped_list, content_detail}/`
  - Design system — `ui/theme/{Color, Typography, Spacing, Radii, Shadows, MotionTokens, Icons}.kt`
  - Components — `ui/components/<Name>.kt`
  - Snapshot tests — `app/src/test/java/app/pantopus/android/ui/screens/<area>/`

**Design tokens (the only allowed values):**
- Spacing — `Spacing.s0` through `Spacing.s16` (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 pt/dp).
- Radii — `Radii.xs / sm / md / lg / xl / xl2 / xl3 / pill` (4, 6, 8, 12, 16, 20, 24, 9999).
- Font sizes — `PantopusTextStyle.h1 / h2 / h3 / body / small / caption / overline` (30, 24, 20, 16, 14, 12, 11 pt/sp).
- Colors — `Theme.Color.<token>` (iOS) / `Theme.color.<token>` (Android). **No raw hex except** category-accent palettes and shimmer gradient stops (per existing `*CategoryPalette.{swift,kt}` files).

**Identity pillars (semantic recolor triggers):**
- Personal — sky `primary600 / #0284C7`, bg `personalBg / #DBEAFE`
- Home — green `home / #16A34A`, bg `homeBg / #DCFCE7`
- Business — violet `business / #7C3AED`, bg `businessBg / #F3E8FF`

**Cross-platform parity rules:**
- Every prompt produces **both** iOS and Android sides in the same PR. Snapshot tests on both platforms.
- View-model parity: same state machine, same loading/empty/populated/error states.
- Copy parity: error / empty / button labels are word-for-word identical.
- Component vocabulary parity: if iOS adds a primitive, Android adds the same one with the same name.

**Snapshot tests:**
- iOS — add to `PantopusTests/Features/<Area>/<Screen>SnapshotTests.swift`. Use the existing `pantopusSnapshot` helper.
- Android — add to `app/src/test/java/app/pantopus/android/ui/screens/<area>/<Screen>SnapshotTest.kt`. Use the existing paparazzi rig.
- One snapshot per designed state.

**Design references:**
- All design source HTML / JSX lives under `docs/designs/A{03,09,10,12,13,14,17,18,21}/`. Each design pack has a JSX file (`*frames.jsx` or `design-canvas.jsx`) that exhaustively spec'd every frame Claude Code needs to match.
- The Phase 0 audit at `docs/new-design-parity.md` lists the per-screen slot inventory and per-frame deltas — Claude Code should read the relevant entry before starting.

**Token verification:**
- After every prompt, run `frontend/apps/ios/Pantopus/scripts/verify-tokens.sh` (iOS) and the equivalent detekt-baseline check (Android). Zero new hex literals outside palettes; zero new off-scale spacing/radii/fonts.

---

# Phase 0 — Prep

## P0 — Audit verification + tooling smoke

```
You are starting work on the Pantopus mobile new-design build-out.

Before any code, do the following grounding pass and report back:

1. Read `docs/new-design-parity.md` end-to-end.
2. Read `docs/claude-code-prompts.md` (this file) — the "Universal
   conventions" section is your invariant rule set.
3. List the design packs extracted under `docs/designs/` and confirm
   every screen referenced in the audit has a matching HTML or JSX
   source file.
4. Verify the iOS scripts still pass on the current main:
   `cd frontend/apps/ios && ./Pantopus/scripts/verify-tokens.sh`
   `cd frontend/apps/ios && ./Pantopus/scripts/verify-icons.sh`
5. Verify Android lint baseline is green:
   `cd frontend/apps/android && ./gradlew detekt`
6. Confirm the iOS snapshot test target builds and the Android
   paparazzi test task runs.

Output:
- Sources of any drift you find between the audit and the current
  codebase (file paths that have moved, classes that have been
  renamed, etc.).
- A go/no-go signal for proceeding to Phase 1.
- Do not modify any source files in this session.
```

---

# Phase 1 — Shared primitives

Four PRs, each adding 2–4 related primitives to both `Core/Design/Components/`
(iOS) and `ui/components/` (Android). No screen changes in Phase 1 — just
primitives + previews + isolated snapshot tests.

## P1.1 — Visual hero primitives (BalanceHero, PaperStack, Postcard, ConfettiSpray)

```
Add four "hero" primitives to the design system on both platforms.
These are the heaviest visual elements in the new design pack and
unblock screens A10.10 Wallet, A17.9 Party, A17.10 Records, and
A12.7 Postcard verification.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A10.10, § A17.9, § A17.10, § A12.7
- docs/claude-code-prompts.md — § Universal conventions (this file)
- docs/designs/A10/A10.10*.{html,jsx} — Wallet design
- docs/designs/A17/A17.9*.{html,jsx} + A17.10*.{html,jsx} — Party + Records
- docs/designs/A12/A12.7*.{html,jsx} — Postcard
- Existing primitives for style reference:
  - frontend/apps/ios/Pantopus/Core/Design/Components/AvatarWithIdentityRing.swift
  - frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/AvatarWithIdentityRing.kt

PRIMITIVES TO BUILD

1. BalanceHero — dark sky gradient hero card for financial surfaces.
   - Surface: linear-gradient(135deg, primary800 → primary700 → primary600).
   - Decoration: 3 concentric arcs (radii 90/60/30, primary200 stroke, opacity 0.18, anchored top-right).
   - Slots: overline (in primary200), amount (Display $44pt heavy with $22pt baseline-aligned $ glyph), currency chip (glass), split-strip below (label + value pairs).
   - Variants: default, holdTone (yellow inset banner appended).

2. PaperStack — multi-page tilted paper sheets for Records-style hero.
   - 3 PaperSheet primitives z-stacked at rotations -3°, +1°, -1°.
   - Each sheet: 280×360pt, paper-white bg, hairline border, 6 shim lines as content preview.
   - Top sheet renders children (caller-supplied content overlay).

3. Postcard — postcard hero for verification flow.
   - 320×196pt, cream stock #FDF8EE (token: add `Theme.Color.paperCream` to Colors.swift).
   - Layout: recipient block (handwriting-flavor font — SwiftUI: use `.italic()` + serif; Compose: use `FontFamily.Serif` + italic), postage marks (3 rectangles top-right, sepia tone), divider line down the middle.
   - Variant: `delivered=true` adds a rotated red "DELIVERED" cancellation stamp (3px solid red border, rotate -8°, 60% opacity).

4. ConfettiSpray — animated dot pattern overlay for celebration heroes.
   - 200×140pt overlay, 60 dots randomly placed (seed-based for snapshot determinism).
   - Dots in 6 colors: rose (#DB2777), amber (warning), success, primary500, magicBg, business.
   - Static for tests; animate the y-drift in production builds (respect reduceMotion).

FILES TO CREATE
- frontend/apps/ios/Pantopus/Core/Design/Components/BalanceHero.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/PaperStack.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/Postcard.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/ConfettiSpray.swift
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/BalanceHero.kt
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/PaperStack.kt
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/Postcard.kt
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/ConfettiSpray.kt
- frontend/apps/ios/PantopusTests/Core/Design/Components/HeroPrimitivesSnapshotTests.swift
- frontend/apps/android/app/src/test/java/app/pantopus/android/ui/components/HeroPrimitivesSnapshotTest.kt

FILES TO MODIFY
- frontend/apps/ios/Pantopus/Core/Design/Colors.swift (add `paperCream` token)
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Color.kt (add `paperCream` token)

ACCEPTANCE
- Each primitive has a SwiftUI Preview and a Composable @Preview that renders all variants.
- Snapshot tests cover: BalanceHero (default + holdTone), PaperStack (single state), Postcard (pristine + delivered), ConfettiSpray (static seed).
- No off-scale spacing / radii / fonts; verify-tokens.sh clean.
- iOS and Android APIs are name-identical (same parameter names, same enum variants).
- Reduce-motion env reverts ConfettiSpray to static.

OUT OF SCOPE
- Wiring these primitives into screens — that's later phases.
- Animations beyond the reduce-motion gate (production polish later).
```

## P1.2 — Input + indicator primitives (CodeInput, StrengthMeter, ChannelChip, EnvelopeOcrBox)

```
Add four "input / indicator" primitives unblocking A13.14 password,
A12.7 postcard code, A14.5 notifications, and A13.15 disambiguate.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A13.14, § A12.7, § A14.5, § A13.15
- docs/designs/A12/A12.7*.{html,jsx}
- docs/designs/A13/A13.14*.{html,jsx} + A13.15*.{html,jsx}
- docs/designs/A14/A14.5*.{html,jsx}
- Existing inputs for style reference:
  - frontend/apps/ios/Pantopus/Core/Design/Components/PantopusTextField.swift
  - frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/PantopusTextField.kt

PRIMITIVES TO BUILD

1. CodeInput — 6-character monospace boxes for postcard/2FA codes.
   - 6 boxes, each 44×56pt, mono SF Mono / JetBrains Mono, sky border on focus, ring shadow.
   - States: empty / filled / disabled (with white-alpha overlay + lock icon + caption "Code unlocks on delivery").
   - Slot-by-slot binding (Binding<String> → 6 chars), auto-advance focus on type, backspace clears prior box.
   - Exposes `onComplete: (String) -> Void` when all 6 boxes filled.

2. StrengthMeter — 4-rule password strength indicator.
   - 4-segment bar (each segment fills as rule passes).
   - 4 rule pills below: `12+ characters`, `Mixed case`, `Number`, `Symbol`.
   - Each pill: check icon (success-fg) when met, x icon (errorLight + fg3) when unmet.
   - `breached` flag: bar becomes full red, prepended "Found in breach data" pill in error-tone.
   - Pure function: input password string → strength state struct.

3. ChannelChip — 22pt P/E/S monospace letter chip for notification matrix.
   - 22×22pt circle, mono `P` / `E` / `S` glyph centered (10pt bold).
   - States: on (primary600 fill + white fg), off (appBorder fill + fg3), locked (sky bg + lock micro-icon overlay).
   - Tap toggles unless locked.
   - Row layout helper `ChannelTriad(p: Bool, e: Bool, s: Bool)` that wires three chips.

4. EnvelopeOcrBox — overlay box on scanned envelope previews.
   - Variants: clean (2px solid primary500), unclear (2px dashed warning500 + water-stain bg texture).
   - Caller provides bounding rect; primitive renders the overlay only.
   - Useful for the disambiguate `EnvelopeCard` evolution.

FILES TO CREATE
- frontend/apps/ios/Pantopus/Core/Design/Components/CodeInput.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/StrengthMeter.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/ChannelChip.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/EnvelopeOcrBox.swift
- (same four under android/.../ui/components/, .kt)
- frontend/apps/ios/PantopusTests/Core/Design/Components/InputPrimitivesSnapshotTests.swift
- frontend/apps/android/app/src/test/java/app/pantopus/android/ui/components/InputPrimitivesSnapshotTest.kt

ACCEPTANCE
- StrengthMeter unit tests cover all 16 combinations of rule pass/fail + breached flag.
- CodeInput keyboard behavior tested via UITest (iOS) and androidTest (Android): auto-advance, backspace clears, completion callback fires once.
- ChannelChip locked state cannot be tapped (no callback fires).
- iOS + Android APIs name-identical.
- No off-scale tokens; verify-tokens clean.

OUT OF SCOPE
- Wiring into screens.
- Biometric / Face ID integration on CodeInput (later, A13.4 transfer).
```

## P1.3 — Calendar + map + date primitives (SlotCalendar, FuzzMap, DateSpan)

```
Add three spatial / temporal primitives unblocking A10.9 Support Train,
A14.7 Privacy, and A14.8 Vacation hold.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A10.9, § A14.7, § A14.8
- docs/designs/A10/A10.9*.{html,jsx}
- docs/designs/A14/A14.7*.{html,jsx} + A14.8*.{html,jsx}
- frontend/apps/ios/Pantopus/Features/Homes/Calendar/HomeCalendarView.swift — existing calendar idioms
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/HomeCalendarScreen.kt

PRIMITIVES TO BUILD

1. SlotCalendar — 4-week support-train slot grid.
   - 7×4 grid, each cell 40×40pt.
   - Cell states (caller-supplied per date):
     - past (fg4, no border, no fill)
     - today (primary600 fill + white text, ring shadow)
     - filled (homeBg fill + home-fg text + 1px home border)
     - open (dashed primary300 border + appText)
     - mine (primary50 fill + primary600 border + primary700 text)
   - Header row: 7 day-letter abbreviations (S M T W T F S) in fg3 11pt.
   - Legend strip pinned below (one chip per state).
   - Exposes `onSelectDate: (Date) -> Void` only for cells in `open` / `mine` state.

2. FuzzMap — animated concentric-circle privacy fuzz preview.
   - 280×140pt canvas with faint street-grid background (12 horizontal + 12 vertical hairlines in appBorderSubtle).
   - 5 stops: `exact` (8pt dot only) → `building` (18pt ring) → `block` (42pt ring) → `block(default)` (62pt ring) → `neighborhood` (110pt ring).
   - Ring: primary600 1.5px stroke + primary600 alpha-0.18 fill.
   - Mono corner tag shows current stop label uppercase (BLOCK, NEIGHBORHOOD).
   - Animates ring radius on stop change (300ms ease-in-out, respects reduceMotion).
   - Bound to a slider via `FuzzStop` enum.

3. DateSpan — mini-timeline strip between two date pickers.
   - Horizontal dashed sky line spanning between two date anchors.
   - Centered pill mid-line shows duration ("13 days").
   - Weekday labels below each anchor in fg3 11pt mono ("MON" / "WED").
   - Variant `tone=info|success|warning` recolors the dash line and pill.

FILES TO CREATE
- frontend/apps/ios/Pantopus/Core/Design/Components/SlotCalendar.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/FuzzMap.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/DateSpan.swift
- (same three on Android under ui/components/)
- frontend/apps/ios/PantopusTests/Core/Design/Components/SpatialPrimitivesSnapshotTests.swift
- frontend/apps/android/app/src/test/java/app/pantopus/android/ui/components/SpatialPrimitivesSnapshotTest.kt

ACCEPTANCE
- SlotCalendar snapshot per cell state.
- FuzzMap snapshot per fuzz stop (5 frames).
- DateSpan snapshot per tone variant (3 frames).
- iOS and Android render visually identical (compare snapshot PNGs).
- No off-scale tokens; verify-tokens clean.

OUT OF SCOPE
- Real address geocoding for FuzzMap (background grid is stylized, not real).
- Multi-month navigation for SlotCalendar (single 4-week view only).
```

## P1.4 — Status + banner primitives (HaloCircle, BeaconBanner)

```
Add two ceremonial primitives unblocking A18.1/.2/.3 status screens
and A21.1/.2 beacon profile banners.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A18.1, § A18.2, § A18.3, § A21.1, § A21.2
- docs/designs/A18/*.{html,jsx}
- docs/designs/A21/A21.1*.{html,jsx} + A21.2*.{html,jsx}
- frontend/apps/ios/Pantopus/Features/Status/StatusWaitingView.swift — existing illustration idiom

PRIMITIVES TO BUILD

1. HaloCircle — 96pt double-ring status halo.
   - Outer ring 96pt (success-bg fill, 4pt translucent ring outside).
   - Inner disc 72pt (success / info / warning / primary fill depending on tone).
   - Icon 32pt centered (PantopusIcon, white fg).
   - Tones: `success` (success bg + check icon), `info` (primary bg + clock icon), `warning` (warning bg + alert-circle), `celebration` (gradient sky bg + badge-check).
   - Optional pulsing glow ring (3s ease-in-out, scales 1.0 → 1.06 → 1.0, alpha 0.4 → 0; respects reduceMotion).
   - Caller specifies tone + icon symbol.

2. BeaconBanner — identity-tinted top banner for public profiles.
   - 120pt-tall band.
   - Variants by identity: personal (sky primary600), home (green home), business (violet business).
   - Each variant: linear-gradient(140deg, identityDark → identity600).
   - Optional decorative element (3 thin diagonal stripes in identity200 alpha 0.2 — design's signature).
   - Caller-supplied trailing chip slot (verified-neighbor shield, tier crown, etc).

FILES TO CREATE
- frontend/apps/ios/Pantopus/Core/Design/Components/HaloCircle.swift
- frontend/apps/ios/Pantopus/Core/Design/Components/BeaconBanner.swift
- (Android equivalents)
- frontend/apps/ios/PantopusTests/Core/Design/Components/StatusPrimitivesSnapshotTests.swift
- frontend/apps/android/app/src/test/java/app/pantopus/android/ui/components/StatusPrimitivesSnapshotTest.kt

ACCEPTANCE
- HaloCircle snapshot per tone (4 frames + 1 pulsing-static frame).
- BeaconBanner snapshot per identity (3 frames).
- Reduce-motion env disables pulsing glow.
- iOS + Android API parity.
- No off-scale tokens.

OUT OF SCOPE
- Owner-mode banner chrome (analytics + edit buttons) — that's A21.1 owner work, deferred per open question.
```

---

# Phase 2 — Wizards (BUILD batch A)

## P2.0 — WizardShell identity refactor (cross-cutting prerequisite)

```
The current WizardShell is hard-coded to sky-primary600. The new
designs require A12.10 Create Business wizard in business-violet
and A12.11 Start Support Train (already exists) in warm-amber.
Refactor WizardShell to accept an `identity` parameter that drives
progress rail color, identity chip, CTA shadow tint, and selected-
state accent. This is a small but cross-cutting change — every
existing wizard call site must compile unchanged with the default
identity = .personal.

CONTEXT TO READ FIRST
- frontend/apps/ios/Pantopus/Features/Shared/Wizard/WizardShell.swift
- frontend/apps/ios/Pantopus/Features/Shared/Wizard/WizardStep.swift
- frontend/apps/ios/Pantopus/Features/Shared/Wizard/WizardState.swift
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/WizardShell.kt
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/WizardModel.kt
- All existing wizard call sites (run `grep -r WizardShell --include="*.swift"`).

WORK

1. Add `WizardIdentity` enum (cases: personal, home, business, warm).
2. Add an `identity: WizardIdentity = .personal` parameter to
   `WizardShell.init(...)` (iOS) and the equivalent Composable
   parameter on Android. Default = .personal so every existing
   call site is unaffected.
3. Wire identity to:
   - Progress rail fill color (`primary600` / `home` / `business` / `warmAmber`).
   - Identity chip pill color.
   - Primary CTA background + shadow tint.
   - Selected-state accent for any inner step (caller passes identity down).
4. Add `warmAmber` (#B45309) and `warmAmberBg` (#FEF3C7) tokens to
   Colors.swift + Color.kt (warm identity is new). Per the audit's
   open-questions section, these are added as named tokens, not raw
   hex.
5. Update existing wizards' previews to confirm they still render
   identically with the default .personal identity.

FILES TO MODIFY
- frontend/apps/ios/Pantopus/Features/Shared/Wizard/WizardShell.swift
- frontend/apps/ios/Pantopus/Core/Design/Colors.swift
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/WizardShell.kt
- frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Color.kt
- (color asset catalogs — add warmAmber, warmAmberBg)

ACCEPTANCE
- All existing wizard call sites compile unchanged.
- New `identity` param is additive (default value preserves prior behavior).
- WizardShell snapshot tests now cover 4 identity variants.
- No new off-scale tokens; verify-tokens clean.
- iOS + Android API name-identical.

OUT OF SCOPE
- Migrating any existing wizard to a non-default identity (P2.2 will
  flip create-business to .business; P7.4 will flip start-train to .warm).
```

## P2.1 — A12.5 + A12.6 + A12.7 Verify Landlord trio

```
Build the 3-step verify-landlord flow on both platforms. Lives in a
new `Homes/VerifyLandlord/` (iOS) / `homes/verify_landlord/` (Android)
folder. Uses the existing WizardShell (post-P2.0).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A12.5, § A12.6, § A12.7
- docs/designs/A12/A12.5*.{html,jsx} (Start)
- docs/designs/A12/A12.6*.{html,jsx} (Details)
- docs/designs/A12/A12.7*.{html,jsx} (Postcard — note this is technically
  outside the 3-step wizard per the audit; it's a sibling status screen)
- Existing 3-step wizard as a template:
  - frontend/apps/ios/Pantopus/Features/Homes/ClaimOwnership/
  - frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/claim_ownership/
- Primitives required (must already exist): CodeInput, Postcard.

SCREENS

A12.5 — Verify Landlord Start
- Variants: canonical / fast-track (landlord-already-verified).
- See audit § A12.5 for full slot inventory.

A12.6 — Verify Landlord Details
- Variants: populated / validation-errors (with summary banner +
  per-field error chips).
- See audit § A12.6 for full slot inventory and the error-summary
  banner spec.

A12.7 — Postcard verification (sibling status screen)
- Variants: in-transit / delivered.
- Uses Postcard + CodeInput + StatusTimeline primitives.
- See audit § A12.7 for full slot inventory.

FILES TO CREATE — iOS
- Features/Homes/VerifyLandlord/VerifyLandlordWizardView.swift
- Features/Homes/VerifyLandlord/VerifyLandlordWizardViewModel.swift
- Features/Homes/VerifyLandlord/VerifyLandlordSteps.swift
- Features/Homes/VerifyLandlord/VerifyLandlordSampleData.swift
- Features/Homes/VerifyLandlord/Steps/VerifyStartStep.swift
- Features/Homes/VerifyLandlord/Steps/VerifyDetailsStep.swift
- Features/Homes/VerifyLandlord/Postcard/PostcardVerificationView.swift
- Features/Homes/VerifyLandlord/Postcard/PostcardVerificationViewModel.swift

FILES TO CREATE — Android
- Mirror structure under ui/screens/homes/verify_landlord/ + verify_landlord/postcard/

FILES TO MODIFY
- frontend/apps/ios/Pantopus/Features/Root/HubTabRoot.swift — add
  HubRoute cases `.verifyLandlord(homeId:)` and `.postcardVerification(homeId:)`.
- iOS DeepLinkRouter.swift — route `pantopus://homes/:id/verify-landlord`.
- Android NavGraph equivalent.
- Wire from HomeDashboardView's verification CTA (when the home's
  ownership-claim returns "verify via landlord" branch).

ACCEPTANCE
- All 3 designed states render: A12.5 canonical, A12.5 fast-track,
  A12.6 populated, A12.6 errors, A12.7 in-transit, A12.7 delivered.
- A12.7 uses StatusTimeline (existing component? if not, build inline) with
  3 stages and the pulsing animated dashed connector for current state.
- Snapshot tests cover all 6 frames on both platforms.
- View-model state machine: idle → submitting → submitted/error;
  iOS + Android share identical state shape.
- Validation errors per audit § A12.6: email format, lease-unit
  mismatch, PM-required-if-toggle-on. Error summary banner sums
  count ("Fix 2 things to submit").
- No off-scale tokens; verify-tokens clean.

OUT OF SCOPE
- Live backend wiring; use Sample Data for now and stub the network
  client to return success after 800ms.
- SMS / push notification on delivery (P-X.X push migration later).
```

## P2.2 — A12.10 Create Business wizard

```
Build the multi-step create-business wizard with violet identity
theming throughout. Uses WizardShell with `identity: .business`
(requires P2.0).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A12.10
- docs/designs/A12/A12.10*.{html,jsx}
- Existing claim-ownership wizard for shape: Features/Homes/ClaimOwnership/
- Primitives required (must already exist): all P1.x primitives, plus
  the BusinessProfile components in Features/BusinessProfile/.

SCREENS

A12.10 — Create Business
- Frame 1 (populated): Home Services tile selected, violet accent
  ring, "What you'll get" strip, next-steps preview, ~6 min meta.
- Frame 2 (search): focused typeahead with 3 ranked matches +
  "Add custom category" dashed-violet fallback.

See audit § A12.10 for full slot inventory.

FILES TO CREATE — iOS
- Features/Businesses/CreateBusiness/CreateBusinessWizardView.swift
- Features/Businesses/CreateBusiness/CreateBusinessWizardViewModel.swift
- Features/Businesses/CreateBusiness/CreateBusinessSteps.swift
- Features/Businesses/CreateBusiness/CreateBusinessSampleData.swift
- Features/Businesses/CreateBusiness/Steps/PickCategoryStep.swift
- Features/Businesses/CreateBusiness/Steps/PickCategorySearchStep.swift
- Features/Businesses/CreateBusiness/Steps/LegalInfoStep.swift  (stub for now — design only details frame 1+2)
- Features/Businesses/CreateBusiness/Steps/ProfileStep.swift     (stub)
- Features/Businesses/CreateBusiness/Steps/ConfirmStep.swift     (stub)

FILES TO CREATE — Android
- Mirror under ui/screens/businesses/create_business/

FILES TO MODIFY
- frontend/apps/ios/Pantopus/Features/Businesses/MyBusinessesView.swift —
  wire "+ New business" CTA to the wizard.
- Routing (HubTabRoot + DeepLinkRouter) — `pantopus://businesses/new`.

ACCEPTANCE
- Category picker renders 2×4 grid of 8 tiles (icons in their
  category accents).
- Selected tile gets accent ring (1.5px), check disc, business-tinted
  shadow.
- Search variant: typed "tutor" returns 3 matches with highlighted
  substring (violet bg) + "Add as custom category" dashed-violet row.
- "What you'll get" strip in business-soft bg with 3 rows.
- "Next: legal info · profile · confirm · ~6 min" mono meta below.
- Wizard chrome is violet (verifying P2.0 identity threading works).
- Snapshot tests cover frame 1 + frame 2.
- View-model state shape parity iOS ↔ Android.
- Custom-category submission posts to a stub endpoint (mark TODO if
  backend doesn't accept yet; per audit open question #3).

OUT OF SCOPE
- Steps 2–5 (legal info, profile, confirm) — stubs only, real build
  is in a follow-on prompt once design ships those frames.
```

---

# Phase 3 — Details (BUILD batch B)

## P3.1 — A10.9 Support Train detail

```
Build the support-train detail screen (the participant-facing view —
distinct from the existing organizer review-signups queue). Uses
the SlotCalendar primitive (requires P1.3).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A10.9
- docs/designs/A10/A10.9*.{html,jsx}
- Existing support-train infrastructure:
  - frontend/apps/ios/Pantopus/Features/SupportTrains/
  - frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/support_trains/
- Existing deep-link routing:
  - frontend/apps/ios/Pantopus/Core/Routing/DeepLinkRouter.swift:127
  - frontend/apps/ios/Pantopus/Features/Root/HubTabRoot.swift:358

SCREENS

A10.9 — Support Train detail
- Variants: populated (12/21 slots, 9 open) / fully-covered (green
  celebration banner, split dock).
- See audit § A10.9 for full slot inventory.

FILES TO CREATE — iOS
- Features/SupportTrains/Detail/SupportTrainDetailView.swift
- Features/SupportTrains/Detail/SupportTrainDetailViewModel.swift
- Features/SupportTrains/Detail/SupportTrainDetailContent.swift
- Features/SupportTrains/Detail/SupportTrainDetailSampleData.swift
- Features/SupportTrains/Detail/Components/RecipientCard.swift
- Features/SupportTrains/Detail/Components/TypeDatesCard.swift
- Features/SupportTrains/Detail/Components/SlotRow.swift

FILES TO CREATE — Android
- Mirror under ui/screens/support_trains/detail/

FILES TO MODIFY
- frontend/apps/ios/Pantopus/Features/Root/HubTabRoot.swift — re-route
  `.supportTrain(id:)` to land on SupportTrainDetailView; move
  ReviewSignups to a sub-action accessed from the dock overflow
  for organizers only.
- iOS DeepLinkRouter — `pantopus://support-trains/:id` now opens the
  participant detail; organizer queue moved to
  `pantopus://support-trains/:id/manage`.
- Android navigation equivalent.

ACCEPTANCE
- "For" overline + RecipientCard (avatar gradient, household name,
  Home identity chip, verified disc, address, quote block).
- "The train" overline + TypeDatesCard (icon tile in homeBg, title,
  date range, days-left meta, status pill, progress bar with sky
  gradient, 4-avatar stack + N).
- SlotCalendar (post-P1.3) with the 4-week grid and legend strip.
- "Open slots near you" overline (with "See all 9" action) + 3
  SlotRow stack — each row has inline `Sign up` sky pill.
- "Already on the train" overline + N SlotRow stack with bring-meta.
- HostedBy footer.
- Primary CTA in dock: `Sign up for a slot` (populated) / split dock
  with `Send a card` + `Join as backup` (covered).
- Fully covered variant shows green celebration banner above the
  hero card.
- Snapshot tests for both variants on both platforms.
- View-model state parity iOS ↔ Android.
- No off-scale tokens.

OUT OF SCOPE
- Organizer-mode chrome inside the detail (still accessed via the
  separate manage screen — that's A13.13, prompt P4.3).
- Slot-claim animation polish (slide-in confirmation).
```

## P3.2 — A10.10 Wallet

```
Build the Wallet screen as a top-level destination distinct from
Settings → Payments. Uses BalanceHero (requires P1.1).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A10.10
- docs/designs/A10/A10.10*.{html,jsx}
- Existing Stripe / payouts code:
  - frontend/apps/ios/Pantopus/Core/Networking/Endpoints/PaymentsEndpoints.swift  (if exists)
  - backend/stripe/ for the API shape

SCREENS

A10.10 — Wallet
- Variants: populated ($847.50 available, $186 pending) / hold (bank
  verification expired, withdraw locked).

See audit § A10.10 for full slot inventory.

FILES TO CREATE — iOS
- Features/Wallet/WalletView.swift
- Features/Wallet/WalletViewModel.swift
- Features/Wallet/WalletContent.swift
- Features/Wallet/WalletSampleData.swift
- Features/Wallet/Components/PayoutMethodCard.swift
- Features/Wallet/Components/TaxDocsRow.swift
- Features/Wallet/Components/HoldBanner.swift
- Features/Wallet/Components/ActivityRow.swift

FILES TO CREATE — Android
- Mirror under ui/screens/wallet/

FILES TO MODIFY
- Routing (HubTabRoot + DeepLinkRouter) — add `.wallet` case + route
  `pantopus://wallet`.
- Possibly expose the wallet as a tab or hub-card depending on
  navigation decision; for now route from Settings index Payments
  row and from a Hub action card.

ACCEPTANCE
- BalanceHero renders with the dark gradient + concentric arcs +
  the split-strip (Pending + This month w/ ▲22% vs Oct).
- Recent activity grouped by day with category-tinted icon tiles
  per audit § A10.10 (cleaning green sparkles, child-care amber
  baby, handyman orange wrench, pet-care red dog, bank indigo
  building-2, fee grey receipt).
- Payout method card: Chase debit-card tile (44×30, CHASE 8pt white),
  Instant payout meta with flash icon, Manage text button.
- Tax docs row with 1099 ready badge.
- Withdraw CTA in gradient-fade bottom bar (not solid frosted dock).
- Hold variant: amber HoldBanner at top + HoldTone applied to
  BalanceHero + greyed locked withdraw + footnote "Re-verify your
  bank above to unlock payouts" + Re-verify CTA in PayoutMethodCard.
- Snapshot tests for both variants on both platforms.
- iOS + Android state parity.
- No off-scale tokens.

OUT OF SCOPE
- Live Stripe Connect integration; use sample data with the existing
  PaymentsEndpoints DTOs.
- Withdrawal flow (separate screen, not yet designed).
```

---

# Phase 4 — Forms (BUILD batch C)

## P4.1 — A13.4 Transfer Ownership

```
Build the transfer-ownership form using FormShell + custom slider +
SplitDiff component. Includes Face ID confirmation sheet.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A13.4
- docs/designs/A13/A13.4*.{html,jsx}
- Existing owners infrastructure:
  - frontend/apps/ios/Pantopus/Features/Homes/Owners/

SCREENS

A13.4 — Transfer Ownership
- Variants: ready (Maya picked, 25% slider, before/after diff,
  TRANSFER typed) / final-confirm (Face ID sheet over dimmed form).

See audit § A13.4 for full slot inventory.

FILES TO CREATE — iOS
- Features/Homes/Owners/Transfer/TransferOwnershipView.swift
- Features/Homes/Owners/Transfer/TransferOwnershipViewModel.swift
- Features/Homes/Owners/Transfer/TransferOwnershipSampleData.swift
- Features/Homes/Owners/Transfer/Components/SharesSlider.swift
- Features/Homes/Owners/Transfer/Components/SplitDiff.swift
- Features/Homes/Owners/Transfer/Components/FaceIDConfirmSheet.swift

FILES TO CREATE — Android
- Mirror under ui/screens/homes/owners/transfer/
- FaceIDConfirmSheet → BiometricConfirmSheet (Android nomenclature)

FILES TO MODIFY
- Routing (HubTabRoot + DeepLinkRouter) — add
  `.transferOwnership(homeId:)` + route `pantopus://homes/:id/owners/transfer`.

ACCEPTANCE
- HomeStrip at top (home identity chip + address + "since 2019").
- Recipient search field + RecipientCard (44pt violet avatar, name,
  verified disc, 3-stat strip: Connection / Verified / Mutual homes).
- Custom SharesSlider (1–60% range, mono ticks at 10/25/33/50, max
  caption "max 60% (your stake)").
- SplitDiff visualizing before → after ownership splits with smooth
  width transitions per audit § A13.4.
- TRANSFER typed-confirmation field with mono `TRANSFER` chip inline.
- Amber warning block ("Mateo and Jin will be notified… cannot
  reclaim without Maya's signed transfer back.").
- Sticky CTA: "Transfer 25% to Maya".
- Tapping CTA opens FaceIDConfirmSheet bottom-sheet (78% max height,
  scrim + backdrop blur, scan-face icon tile, mini diff, legal copy,
  Cancel + Confirm with Face ID primary at flex 1.5).
- iOS uses LocalAuthentication for real Face ID; Android uses
  BiometricPrompt. Both fall back to passcode.
- Snapshot tests cover form-ready + confirm-sheet states.
- iOS + Android state machine parity.
- No off-scale tokens.

OUT OF SCOPE
- Backend transfer execution; stub the network call to return
  success after 1.2s.
- Reverting a transfer (different surface entirely).
```

## P4.2 — A13.10 Edit Business Page

```
Build the business-profile editor with dirty + setup variants. Uses
identity-violet chrome consistent with create-business wizard (P2.2).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A13.10
- docs/designs/A13/A13.10*.{html,jsx}
- Existing public business profile for slot reference:
  - frontend/apps/ios/Pantopus/Features/BusinessProfile/

SCREENS

A13.10 — Edit Business Page
- Variants: published (Roost Café, 3 unsaved tweaks, dirty bar) /
  setup (Patch & Paw, 3 of 7 sections, completion strip, "Publish ·
  4 to go" bar).

See audit § A13.10 for full slot inventory.

FILES TO CREATE — iOS
- Features/Businesses/PageEditor/EditBusinessPageView.swift
- Features/Businesses/PageEditor/EditBusinessPageViewModel.swift
- Features/Businesses/PageEditor/EditBusinessPageContent.swift
- Features/Businesses/PageEditor/EditBusinessPageSampleData.swift
- Features/Businesses/PageEditor/Components/IdentityStrip.swift
- Features/Businesses/PageEditor/Components/CompletionStrip.swift
- Features/Businesses/PageEditor/Components/BannerLogoEditor.swift
- Features/Businesses/PageEditor/Components/HoursEditor.swift
- Features/Businesses/PageEditor/Components/ServiceChipsEditor.swift
- Features/Businesses/PageEditor/Components/GalleryEditor.swift
- Features/Businesses/PageEditor/Components/MapPreview.swift
- Features/Businesses/PageEditor/Components/StickySave.swift

FILES TO CREATE — Android
- Mirror under ui/screens/businesses/page_editor/

FILES TO MODIFY
- Routing — `.editBusinessPage(businessId:)` + route
  `pantopus://businesses/:id/page-editor`.
- Wire from BusinessProfileView trailing edit button (owner-only).

ACCEPTANCE
- All sections render per audit § A13.10:
  IdentityStrip / CompletionStrip swap based on mode (published vs setup)
  BannerLogo (empty drop targets / filled with dirty rim)
  Name & tagline · Description (markdown + 247/600 char counter)
  Hours (7-row card with day/open/close/dirty-dot)
  Services (ServiceChip flow row with AddServiceChip)
  Gallery (3×N grid with drag-to-reorder hint, fresh-upload amber rim)
  Contact (phone +1 prefix · email · website https:// · booking link)
  Location (address + MapPreview with pin + "Hide exact address" toggle)
- BizLabel primitive on each field: label + required asterisk +
  dirty orange dot + optional hint italic.
- StickySave in two modes:
  - dirty: "3 unsaved" + Discard outline + Save primary
  - setup: Save draft outline + "Publish · 4 to go" primary (the
    "X to go" hint inside the publish button must render).
- Snapshot tests for both modes on both platforms.
- iOS + Android state parity.
- No off-scale tokens.

OUT OF SCOPE
- Live image upload backend; stub.
- Markdown preview tab (single edit-only field for now).
- Drag-to-reorder gestures (visual hint chip only; reorder via long-
  press menu in v1).
```

## P4.3 — A13.13 Manage Train

```
Build the manage-train form (organizer surface) with active edit
state + close-train bottom sheet. This is the dock-overflow
destination from A10.9 (P3.1).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A13.13
- docs/designs/A13/A13.13*.{html,jsx}
- A10.9 detail (P3.1) for adjacency

SCREENS

A13.13 — Manage Train
- Variants: active mid-edit (Murphy meal train, day 12/21, send-update
  enabled) / closing-sheet (3-cell summary stats + thank-you note +
  destructive Close & thank CTA).

See audit § A13.13 for full slot inventory.

FILES TO CREATE — iOS
- Features/SupportTrains/Manage/ManageTrainView.swift
- Features/SupportTrains/Manage/ManageTrainViewModel.swift
- Features/SupportTrains/Manage/ManageTrainSampleData.swift
- Features/SupportTrains/Manage/Components/TrainContextStrip.swift
- Features/SupportTrains/Manage/Components/StatCellRow.swift
- Features/SupportTrains/Manage/Components/SendUpdateForm.swift
- Features/SupportTrains/Manage/Components/OrganizeSection.swift
- Features/SupportTrains/Manage/Components/CloseTrainSheet.swift

FILES TO CREATE — Android
- Mirror under ui/screens/support_trains/manage/

FILES TO MODIFY
- Routing — `.manageTrain(trainId:)` + route
  `pantopus://support-trains/:id/manage`.
- Wire from A10.9 dock overflow (organizer-only).

ACCEPTANCE
- TrainContextStrip (title + days-progress + audience meta).
- 4-cell StatCellRow (18/21 Slots success · 12 Helpers · 9d Left · 1
  Dropout warn).
- SlotPreview mini-calendar (next 3 days).
- Send-update form: Message textarea (108pt, 168/500 char counter) +
  Audience chip row + push-to-phones row.
- Organize section: 3 rows (Edit dates & slots / Invite more
  helpers / Analytics).
- Wind down: destructive "Close train" row.
- Sticky CTA: Send update primary with send icon.
- CloseTrainSheet bottom sheet: red archive header, 3-cell summary
  (18 meals · 12 neighbors · 12d coverage), italic testimonial,
  thank-you textarea (66pt), Cancel + Close & thank red destructive
  (flex 1.4).
- Snapshot tests for both states.
- iOS + Android state machine parity.
- No off-scale tokens.

OUT OF SCOPE
- Analytics destination screen (separate prompt later).
- Editing the schedule itself (separate flow).
```

## P4.4 — A13.16 My Mail Day

```
Build the mail-day form — the mid-afternoon triage view + empty
"nothing new" hero.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A13.16
- docs/designs/A13/A13.16*.{html,jsx}
- Existing mailbox infrastructure:
  - frontend/apps/ios/Pantopus/Features/Mailbox/

SCREENS

A13.16 — My Mail Day
- Variants: mid-afternoon (8-piece stack, 6 routed, 2 pending,
  5-second undo on latest) / empty (mailbox illustration with "0"
  face, 12-day streak, Scan today's stack CTA, yesterday recap).

See audit § A13.16 for full slot inventory.

FILES TO CREATE — iOS
- Features/Mailbox/MailDay/MailDayView.swift
- Features/Mailbox/MailDay/MailDayViewModel.swift
- Features/Mailbox/MailDay/MailDayContent.swift
- Features/Mailbox/MailDay/MailDaySampleData.swift
- Features/Mailbox/MailDay/Components/DayHeader.swift
- Features/Mailbox/MailDay/Components/ScanMoreCard.swift
- Features/Mailbox/MailDay/Components/UnreviewedItem.swift
- Features/Mailbox/MailDay/Components/ReviewedRow.swift
- Features/Mailbox/MailDay/Components/UndoCountdown.swift
- Features/Mailbox/MailDay/Components/MailboxEmptyHero.swift

FILES TO CREATE — Android
- Mirror under ui/screens/mailbox/mail_day/

FILES TO MODIFY
- Routing — `.mailDay` + route `pantopus://mailbox/mailday`.
- Wire from Mailbox root header CTA.

ACCEPTANCE
- DayHeader (date + streak chip + ProgressRing 56pt).
- ScanMoreCard with "Scanned 22 min ago — drop more in?" + Scan CTA.
- "Needs a call · 2" overline + UnreviewedItem rows (56pt MailThumb +
  label + sender + AI-suggested-recipient pile + confidence pill +
  Route primary + Other secondary).
- "Reviewed today · 6" compact ReviewedRow stack.
- Latest row gets UndoCountdown (5-sec circular timer).
- "Undo all from today" text button below.
- FinishDay sticky footer (disabled until empty: "Finish day · 2
  remaining" / "Finish day · all done").
- Empty state: MailboxEmptyHero with bespoke 120×96 illustration
  (mailbox with shelf + body + flag + sparkles + "0" mono face),
  "Nothing new today" h2, "Drop today's stack on the scanner…" body,
  Scan today's stack primary CTA, streak chip, yesterday recap
  (stacked colored bar 5 routed / 2 junked / 1 returned), 2 setup-
  nudge cards.
- Snapshot tests for both states.
- iOS + Android parity.
- No off-scale tokens.

OUT OF SCOPE
- Scanner integration (CTA opens existing scanner flow).
- Backend AI-routing endpoint (use sample confidence values).
```

---

# Phase 5 — Settings BUILDs (BUILD batch D)

## P5.1 — A14.1 Home settings + A14.2 Home security

```
Build the per-home settings index + security toggles. Both use
GroupedListView pattern.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A14.1, § A14.2
- docs/designs/A14/A14.1*.{html,jsx} + A14.2*.{html,jsx}
- frontend/apps/ios/Pantopus/Features/Shared/GroupedList/GroupedListView.swift
- frontend/apps/ios/Pantopus/Features/Homes/HomeDashboardView.swift

SCREENS

A14.1 — Home settings index
- Variants: established home / newly claimed (Verifying chip + Not
  set subs + Cancel claim destructive).

A14.2 — Home security
- Variants: balanced (5 of 9 toggles on) / strict lockdown (all 9 on
  with helper text shifted to consequence language).

See audit § A14.1, § A14.2 for full slot inventories.

FILES TO CREATE — iOS
- Features/Homes/Settings/HomeSettingsView.swift
- Features/Homes/Settings/HomeSettingsViewModel.swift
- Features/Homes/Settings/HomeSettingsSampleData.swift
- Features/Homes/Settings/Security/HomeSecurityView.swift
- Features/Homes/Settings/Security/HomeSecurityViewModel.swift

FILES TO CREATE — Android
- Mirror under ui/screens/homes/settings/ + ui/screens/homes/settings/security/

FILES TO MODIFY
- Routing — `.homeSettings(homeId:)` + `.homeSecurity(homeId:)`.
- Wire from HomeDashboardView trailing settings button.

ACCEPTANCE — A14.1
- Identity card at top with home identity chip + address verified
  chip.
- 5 groups: Home identity (4 rows) / Access (3 rows) / Members (2
  rows) / Notifications (1 row) / Wind down (1 destructive row).
- Newly-claimed variant: amber Verifying chip on address, "Not
  set" / "Available after verification" subs, Cancel claim
  destructive replaces Leave home.

ACCEPTANCE — A14.2
- 3 toggle groups (Access control / Privacy / Documents), 3
  toggles each = 9 total.
- Helper line per card that changes based on which toggles are
  active (per audit — "Guest approval is on, so guests need an
  owner-tap to enter" vs "Guest approval is off — anyone with a
  code is in. Tighten this if you're away.").
- No chevrons; pure switchgear.
- Snapshot tests for all 4 variant frames.
- iOS + Android parity (helper-line copy is word-for-word identical).

OUT OF SCOPE
- Per-toggle backend persistence; stub to local state for now.
```

## P5.2 — A14.6 Payments (Settings → Payments)

```
Build the Settings → Payments screen — distinct from A10.10 Wallet
(this is payments-out / Stripe setup, Wallet is earnings-in).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A14.6
- docs/designs/A14/A14.6*.{html,jsx}
- Existing wallet (P3.2) for BalanceHero reuse.
- frontend/apps/ios/Pantopus/Features/Settings/SettingsView.swift:148-150
  — current placeholder

SCREENS

A14.6 — Payments
- Variants: populated (balance hero with next-payout chip, 3 methods,
  Stripe connected, payouts to Chase weekly, YTD activity) / empty
  (no balance hero, inline empty in Methods card, Stripe Connect
  primary, gated payout method + tax rows).

See audit § A14.6.

FILES TO CREATE — iOS
- Features/Settings/Payments/PaymentsView.swift
- Features/Settings/Payments/PaymentsViewModel.swift
- Features/Settings/Payments/PaymentsContent.swift
- Features/Settings/Payments/PaymentsSampleData.swift
- Features/Settings/Payments/Components/PaymentMethodRow.swift

FILES TO CREATE — Android
- Mirror under ui/screens/settings/payments/

FILES TO MODIFY
- Features/Settings/SettingsView.swift — replace `.paymentsPayouts`
  placeholder mapping with PaymentsView destination.
- Android settings nav graph equivalent.
- Routing — `.paymentsSettings` + route
  `pantopus://settings/payments`.

ACCEPTANCE
- BalanceHero (reuses P1.1 primitive) with next-payout-date pill +
  frequency on right slot.
- "Payment methods" card: Visa ····4523 (Default chip + Mar 24
  expiry) / Mastercard ····7892 (Apr 25) / Apple Pay (active default
  chip) / Add payment method (blue iOS-convention row at bottom).
- "Payouts" card: Stripe row (Connected · Verified chip / Connect
  primary chip in empty) / Payout method row (Chase ····7421 Weekly)
  / Tax info row (W-9 on file).
- "Activity" card: 3 rows (Lifetime $9,847 / YTD $3,184 / Last
  payout Nov 28).
- Empty state: no BalanceHero; Methods inline empty + Add row;
  Stripe shows Connect chip; payout-method + tax-info show lock
  glyph + "Available after Stripe connect" sub.
- Snapshot tests for both states.
- iOS + Android parity.
- No off-scale tokens.

OUT OF SCOPE
- Live Stripe Connect onboarding (deep link out to Stripe-hosted
  flow).
- Card-add bottom sheet (separate flow).
```

## P5.3 — A14.8 Vacation hold

```
Build the mailbox vacation-hold form (scheduling) + active-hold view.
Uses DateSpan primitive (requires P1.3).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A14.8
- docs/designs/A14/A14.8*.{html,jsx}

SCREENS

A14.8 — Vacation hold
- Variants: scheduling (13-day range, DateSpan strip, scope toggles
  all on, civic locked, forwarding, emergency contact, Save in top
  bar primary-600) / active (sky-gradient HoldStatusHero, 5 days
  left, 3-cell stats, held items ledger, top bar swaps Save for
  neutral End hold).

See audit § A14.8.

FILES TO CREATE — iOS
- Features/Mailbox/Vacation/VacationHoldView.swift
- Features/Mailbox/Vacation/VacationHoldViewModel.swift
- Features/Mailbox/Vacation/VacationHoldContent.swift
- Features/Mailbox/Vacation/VacationHoldSampleData.swift
- Features/Mailbox/Vacation/Components/HoldStatusHero.swift
- Features/Mailbox/Vacation/Components/HeldList.swift

FILES TO CREATE — Android
- Mirror under ui/screens/mailbox/vacation/

FILES TO MODIFY
- Routing — `.vacationHold` + route `pantopus://mailbox/vacation`.
- Wire from Mailbox root settings menu.

ACCEPTANCE — scheduling
- When card: From date picker + DateSpan strip (13 days pill, MON-WED
  weekday labels) + To date picker.
- What to hold toggles: Mail / Packages / Magic Task delivery /
  Civic notices (locked chip — civic always hold).
- Forwarding card: optional chevron row "Forward to Mom's place ·
  1456 Cedar Pkwy".
- Emergency contact card: optional chevron row "Sam (brother) ·
  (415) 555-0188".
- Top bar: back + "Vacation hold" + Save primary (disabled when
  invalid).

ACCEPTANCE — active
- HoldStatusHero: linear-gradient(140deg, primary600 → primary800)
  dark card, "Hold active" pulsing primary300-dot pill + mono "until
  Dec 12", "5 days left" 32pt heavy + 18pt secondary sub, 3-cell
  stats grid (4 letters / 1 package / 2 forwarded).
- "What's holding" overline + HeldList rows.
- Forwarding + Emergency contact still rendered, read-only.
- Top bar: back + "Vacation hold" + neutral "End hold" text button.
- Snapshot tests for both states.
- iOS + Android parity.
- No off-scale tokens.

OUT OF SCOPE
- Real date-picker UI (use native iOS DatePicker / Android
  DatePickerDialog).
- Backend vacation-hold endpoint; stub.
```

---

# Phase 6 — Mail variants (BUILD batch E)

iOS is behind Android here (3 of 10 vs 6 of 10 variants). Six PRs total.

## P6.1 — iOS catch-up: A17.5 Coupon variant

```
Add the Coupon variant layout for iOS. Android already has this
(mailbox/item_detail/bodies/CouponBody.kt) — port the design intent
and component structure to iOS.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A17.5
- docs/designs/A17/A17.5*.{html,jsx}
- Android reference:
  - frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CouponBody.kt
  - frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CouponHero.kt
  - frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/BarcodeView.kt
- iOS existing variant layout for shape:
  - frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/BookletDetailLayout.swift

FILES TO CREATE
- frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CouponDetailLayout.swift
- frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/Components/CouponHero.swift
- frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/Components/BarcodeView.swift

FILES TO MODIFY
- frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/MailDetailView.swift —
  add the `else if content.category == .coupon, let coupon =
  content.couponDetail` branch (mirroring the existing booklet /
  certified / community branches at lines 86–106).
- frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/MailItemSampleData.swift —
  add coupon sample data fixtures.

ACCEPTANCE
- CouponDetailLayout uses MailItemDetailShell (matching Booklet /
  Certified / Community pattern).
- CouponHero (gradient hero + brand + discount % + expiry · barcode)
  matches Android visual.
- KeyFacts: terms · valid through · redemptions left · where.
- BodyCard: fine print.
- Sticky dock: Redeem primary CTA.
- Snapshot test added.
- View visually matches Android side-by-side.
- No off-scale tokens.

OUT OF SCOPE
- Live barcode generation (use static image).
```

## P6.2 — iOS catch-up: A17.6 Gig mail variant

```
Add the Gig mail variant layout for iOS. Android reference at
mailbox/item_detail/bodies/GigBody.kt.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A17.6
- docs/designs/A17/A17.6*.{html,jsx}
- Android: ui/screens/mailbox/item_detail/bodies/GigBody.kt +
  components/GigCard.kt + components/BidCard.kt
- iOS Booklet variant as shape template

FILES TO CREATE
- Features/Mailbox/MailDetail/Variants/GigMailDetailLayout.swift
- Features/Mailbox/MailDetail/Variants/Components/GigCard.swift
- Features/Mailbox/MailDetail/Variants/Components/BidCard.swift

FILES TO MODIFY
- MailDetailView.swift — add `.gig` branch.
- MailItemSampleData.swift — add gig mail fixtures.

ACCEPTANCE
- Gig hero (job summary + estimated payout).
- KeyFacts: location · when · category.
- Other bids strip.
- Accept / Decline split dock.
- Snapshot test added.
- Visually matches Android.
- No off-scale tokens.

OUT OF SCOPE
- Live bid acceptance backend; stub.
```

## P6.3 — iOS catch-up: A17.7 Memory variant

```
Add the Memory variant layout for iOS. Android reference at
mailbox/item_detail/bodies/MemoryBody.kt + components/PolaroidFrame.kt.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A17.7
- docs/designs/A17/A17.7*.{html,jsx}
- Android references above.

FILES TO CREATE
- Features/Mailbox/MailDetail/Variants/MemoryDetailLayout.swift
- Features/Mailbox/MailDetail/Variants/Components/PolaroidFrame.swift

FILES TO MODIFY
- MailDetailView.swift — add `.memory` branch.
- MailItemSampleData.swift — add memory fixtures.

ACCEPTANCE
- Memory hero (polaroid frame + caption).
- Date-from line.
- Add to keepsakes CTA.
- Snapshot test added.
- Visually matches Android.
- No off-scale tokens.
```

## P6.4 — A17.8 Package variant (both platforms)

```
Build the Package variant on both iOS and Android. Neither platform
has this yet — fully BUILD on both sides.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A17.8
- docs/designs/A17/A17.8*.{html,jsx}

FILES TO CREATE — iOS
- Features/Mailbox/MailDetail/Variants/PackageDetailLayout.swift
- Features/Mailbox/MailDetail/Variants/Components/PackageTrackingTimeline.swift
- Features/Mailbox/MailDetail/Variants/Components/CarrierBadge.swift

FILES TO CREATE — Android
- ui/screens/mailbox/item_detail/bodies/PackageBody.kt
- ui/screens/mailbox/item_detail/bodies/components/PackageTrackingTimeline.kt
- ui/screens/mailbox/item_detail/bodies/components/CarrierBadge.kt

FILES TO MODIFY
- iOS MailDetailView.swift — add `.package` branch.
- Android MailDetailScreen.kt — add `.package` branch.
- iOS MailItemSampleData.swift + Android MailItemSampleData.kt —
  add package fixtures (carrier=UPS, tracking number, status=in
  transit / delivered).

ACCEPTANCE
- Package hero (carrier badge + tracking number mono + status pill).
- PackageTrackingTimeline (3+ stages: shipped / out for delivery /
  delivered).
- KeyFacts: carrier · service · dimensions · weight.
- Optional photo (front-door snapshot if delivered).
- Split dock: Track on carrier (opens browser to carrier URL) +
  Confirm pickup primary.
- Snapshot test on both platforms.
- iOS and Android render visually identical.
- No off-scale tokens.

OUT OF SCOPE
- Real carrier API integration; sample data only.
```

## P6.5 — A17.9 Party variant (both platforms)

```
Build the Party variant on both platforms. Uses ConfettiSpray (P1.1).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A17.9
- docs/designs/A17/A17.9*.{html,jsx}
- ConfettiSpray primitive (P1.1).

FILES TO CREATE — iOS
- Features/Mailbox/MailDetail/Variants/PartyDetailLayout.swift
- Features/Mailbox/MailDetail/Variants/Components/PartyHero.swift
- Features/Mailbox/MailDetail/Variants/Components/DateTile.swift
- Features/Mailbox/MailDetail/Variants/Components/GoingStrip.swift
- Features/Mailbox/MailDetail/Variants/Components/PotluckList.swift
- Features/Mailbox/MailDetail/Variants/Components/RsvpCluster.swift

FILES TO CREATE — Android
- ui/screens/mailbox/item_detail/bodies/PartyBody.kt + components/*.kt

FILES TO MODIFY
- MailDetailView.swift / MailDetailScreen.kt — add `.party` branch.
- MailItemSampleData files — add party fixtures.
- Colors.swift / Color.kt — confirm rose `#DB2777` is a token (add
  `categoryParty` if not — per audit open question #4, prefer named
  token over raw hex).

ACCEPTANCE
- PartyNav (mailbox back + Party eyebrow chip with rose dot +
  bookmark/more).
- PartyHero (festive title + date pill + location pill + ConfettiSpray
  overlay + state-specific copy: open shows headline / going shows
  "You're going on May 24" green check).
- PartyElf strip (3 AI bullets).
- HostCard (Priya, polaroid avatar with rose ring + Friend·neighbor).
- EventDetails (DateTile rose with SAT/MAY/24 stacked + VibeRows for
  dress / kids / weather / map).
- GoingStrip (overlapping avatar pile + +N stat + your-avatar prepended
  in going state).
- PartyNote (handwriting note + signature).
- PotluckList (4 BRING rows with item+emoji+claimedBy avatar+claim
  button).
- RsvpCluster (3-way Going/Maybe/Can't with state-specific styling).
- Snapshot test on both platforms.
- iOS + Android visually identical.

OUT OF SCOPE
- Real calendar integration; tapping Going stubs to local state.
```

## P6.6 — A17.10 Records variant (both platforms)

```
Build the Records variant on both platforms. Uses PaperStack (P1.1).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A17.10
- docs/designs/A17/A17.10*.{html,jsx}
- PaperStack primitive (P1.1).

FILES TO CREATE — iOS
- Features/Mailbox/MailDetail/Variants/RecordsDetailLayout.swift
- Features/Mailbox/MailDetail/Variants/Components/IssuerCard.swift
- Features/Mailbox/MailDetail/Variants/Components/VaultBreadcrumb.swift
- Features/Mailbox/MailDetail/Variants/Components/RelatedRecords.swift

FILES TO CREATE — Android
- ui/screens/mailbox/item_detail/bodies/RecordsBody.kt + components/*

FILES TO MODIFY
- MailDetailView.swift / MailDetailScreen.kt — add `.records` branch.
- MailItemSampleData files — add records fixtures (Q1 2026 Roth IRA
  statement + 3 quarterly siblings).
- Colors.swift / Color.kt — add `categoryRecords` slate `#475569`
  token (per audit open question #4).

ACCEPTANCE
- RecordsNav (slate dot eyebrow).
- RecordsHero (HeroCard with slate accent strip + statement title +
  mono reference + green "Filed in Vault" stamp when filed).
- RecordsElf strip ("Pantopus opened this for you" with DKIM-verified
  / +4.2% / suggested filing-path bullets).
- IssuerCard (institution avatar slate gradient + dept + CRD#/FINRA
  mono + "Sender domain DKIM-verified").
- PaperStack hero (multi-page tilted sheets with shim lines).
- KeyFacts grid (Account ····4421 mono / Period / Ending balance
  emphasis / Net change +$3,419.08 success / Statement date).
  Filed state prepends "Status · Filed in Vault" row.
- RecordsBody (statement excerpt).
- VaultDestination breadcrumb (Mailbox > Vault > Finance > Statements >
  2026).
- RelatedRecords strip (only in filed state).
- RecordsActions (File in vault primary in open / retention timer +
  PDF / Share / JSON in filed).
- Snapshot test on both platforms, both states (open / filed).
- iOS + Android visually identical.

OUT OF SCOPE
- Real vault filing backend; stub to local state.
- Actual PDF rendering (placeholder thumbnail).
```

---

# Phase 7 — RESHAPE batch

## P7.1 — A13.14 Change Password (reshape)

```
Reshape the existing PasswordChangeView to match the new design.
Currently uses FormShell with Save in top bar; new design requires
Update inline at bottom of body, plus StrengthMeter (P1.2),
ContextBand, FormBanner, and breach detection.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A13.14 (full per-frame deltas)
- docs/designs/A13/A13.14*.{html,jsx}
- Current iOS: frontend/apps/ios/Pantopus/Features/Settings/Password/PasswordChangeView.swift
- Current Android: ui/screens/settings/password/PasswordChangeScreen.kt
- Primitives: StrengthMeter (P1.2), PantopusTextField extension.

FILES TO MODIFY
- Features/Settings/Password/PasswordChangeView.swift (substantial
  rewrite — current 114 lines becomes ~250 lines)
- Features/Settings/Password/PasswordChangeViewModel.swift (add
  strength state + breach check + form-level error)
- (Android equivalents)

FILES TO CREATE
- Features/Settings/Password/Components/ContextBand.swift
- Features/Settings/Password/Components/FormBanner.swift  (could
  move to shared if reused)
- Features/Settings/Password/Components/PasswordField.swift (extends
  PantopusTextField with leftIcon, revealed mode, helper, error state)
- (Android equivalents)

ACCEPTANCE
- Layout: top bar = back chevron + "Change password" title only (NO
  top-right Save action).
- ContextBand at top (mail icon + "Signed in as `maria@pantopus.app`"
  + clock icon + "Last changed 84 days ago").
- "Verify it's you" overline + Current password PasswordField (lock
  leading icon + valid-state green check + reveal toggle).
- "Choose a new one" overline + new password PasswordField (mono-
  revealed when valid) + StrengthMeter (4-segment bar + 4 rule
  pills: 12+ chars / Mixed case / Number / Symbol).
- Confirm password PasswordField with "Matches new password" helper
  in success-fg when valid.
- Inline Update button at bottom of body (NOT in top bar).
- Info chip after CTA: primary50 bg + info icon + "You'll be signed
  out of other devices after updating." (primary-700 fg, 11.5pt).
- Cancel link below Update (primary600, underlined).
- Error state: FormBanner at top (error tone) + per-field errors +
  "Email me a reset link instead" shortcut on current pw +
  breach-detection on new pw (red ring + "Too common — appeared in
  2.3M public records.").
- Snapshot tests for ready + error states on both platforms.
- iOS + Android state machine parity.
- Copy is word-for-word identical between platforms.
- No off-scale tokens.

OUT OF SCOPE
- Real breach API (HIBP) — sample-data only with a hardcoded list of
  ~10 "common" passwords for now.
```

## P7.2 — A13.3 Review Claim (reshape)

```
Reshape ReviewClaimDetailView from Approve/Reject/Request-Info to
the new Accept/Challenge/Reject vocabulary with ChallengeComposerSheet
that includes reason chips.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A13.3
- docs/designs/A13/A13.3*.{html,jsx}
- Current iOS: frontend/apps/ios/Pantopus/Features/ReviewClaims/
- Current Android: ui/screens/review_claims/

FILES TO MODIFY
- ReviewClaimDetailView.swift (rewrite verdict bar; integrate
  challenge composer sheet — note current uses
  ReviewClaimNoteCaptureSheet for request-info; we keep the sheet
  but reshape it).
- ReviewClaimDetailViewModel.swift (rename `.requestInfo` action
  to `.challenge` with reasons + composer state).
- ReviewClaimDetailComponents.swift (rebuild ClaimantCard,
  EvidenceStrip, StatementBlock, TrustChip primitives).
- (Android equivalents)

ACCEPTANCE
- VerdictBar layout: full-width Accept primary on top
  (success-green bg + check-circle-2 icon + sky shadow), then split
  row of Challenge (warning-tinted ghost) + Reject (error-tinted
  ghost) below.
- ClaimantCard with 52pt avatar w/ gradient + Pending 3d amber chip +
  email + claim summary tile (`Claiming` overline + `25%` mono in
  primary700 + "ownership share") + trust chip row (Verified ID
  success / Phone verified success / No mutual owners warn).
- EvidenceStrip with 4 synthetic doc/photo/utility/signed-statement
  previews (bespoke SVGs per audit — deed with horizontal lines +
  sky stamp rect, photo with porch gradient, utility with shimmer-
  line preview).
- StatementBlock (italic statement in muted bg, prefixed with `"`).
- ChallengeComposerSheet: bottom sheet 78% max height, scrim +
  backdrop blur, drag-grabber + h2 "Challenge this claim" + reason
  chips (Identity unclear · Documents look altered · Ownership share
  disputed · Don't recognize claimant · Other) + question textarea
  + "Sent to claimant + 2 co-owners" + "14-day window" + primary
  "Send challenge" CTA.
- Snapshot tests for pending + challenging states on both platforms.
- iOS + Android parity (button labels, reason chip copy word-for-word).
- No off-scale tokens.

OUT OF SCOPE
- Real-time co-owner notification (backend stub).
```

## P7.3 — A13.15 Disambiguate (reshape)

```
Reshape DisambiguateMailFormView to add OCR bounding boxes, OcrStrip,
candidate match badges, and fallback-row vocabulary.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A13.15
- docs/designs/A13/A13.15*.{html,jsx}
- Current iOS: Features/Mailbox/Disambiguate/DisambiguateMailFormView.swift
- Current Android: ui/screens/mailbox/disambiguate/DisambiguateMailFormScreen.kt
- Primitive: EnvelopeOcrBox (P1.2)

FILES TO MODIFY
- DisambiguateMailFormView.swift (substantial rewrite of envelope
  card slot + candidate row + fallback section)
- DisambiguateMailFormViewModel.swift (add OCR confidence + candidate
  match scoring + quick-action chip handling)
- (Android equivalents)

FILES TO CREATE
- Features/Mailbox/Disambiguate/Components/OcrStrip.swift
- Features/Mailbox/Disambiguate/Components/CandidateRow.swift
- Features/Mailbox/Disambiguate/Components/MatchBadge.swift
- Features/Mailbox/Disambiguate/Components/QuickActionChip.swift
- Features/Mailbox/Disambiguate/Components/FallbackRow.swift
- (Android equivalents)

ACCEPTANCE
- Envelope card uses EnvelopeOcrBox overlay (clean = solid sky;
  unclear = dashed amber + water-stain texture on name area).
- OcrStrip below envelope: tone=good (success bg + check + name +
  confidence% mono + reassurance sub) / tone=warn (amber bg + alert
  + redacted name + lower confidence + re-scan suggestion).
- "Who is this for?" overline + QuickActionChip row: This is me
  (user-check, sky chip) + Route to… (forward icon, neutral).
- CandidateRow with 44pt identity-gradient avatar + name + role chip
  (Owner/Resident/Guest with identity-tinted bg) + grant line + match
  badge (Strong 97% success / Partial 41% amber / Weak 22% neutral) +
  radio-style selected ring.
- "None of these — add new person" text button.
- Unclear frame: "Or resolve another way" overline + fallback card
  with 4 rows (Re-scan envelope / Type recipient name / Return to
  sender / Mark as junk — last row error-tinted).
- StickyConfirm: Confirm recipient primary (active in strong /
  disabled with hint in unclear).
- Snapshot tests for strong + unclear states.
- iOS + Android parity.
- No off-scale tokens.

OUT OF SCOPE
- Real OCR pipeline; sample data with hardcoded confidence values.
```

## P7.4 — A12.11 Start Support Train (reshape)

```
Reshape StartSupportTrainWizardView to apply warm-amber identity
theming (requires P2.0) and replace the existing flow vocabulary
with the new ReasonPicker tiles + InviteRecipientCard branch.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A12.11
- docs/designs/A12/A12.11*.{html,jsx}
- Current iOS: Features/SupportTrains/StartTrain/StartSupportTrainWizardView.swift
  (~1100 lines)
- Current Android: ui/screens/support_trains/start_train/

FILES TO MODIFY
- StartSupportTrainWizardView.swift (use WizardShell with
  identity=.warm; replace existing reason picker; wire mutuals
  strip; add invite branch)
- StartSupportTrainWizardViewModel.swift (add invite-recipient
  state branch)
- StartSupportTrainContent.swift (extend with InviteCandidate +
  Mutuals types)

FILES TO CREATE
- Features/SupportTrains/StartTrain/Components/TrainChip.swift
  (warm-amber pill, replacing whatever sky variant exists)
- Features/SupportTrains/StartTrain/Components/ReasonPicker.swift
  (6-tile 3×2 grid: meal-train / ride / errand / surgery / baby /
  loss)
- Features/SupportTrains/StartTrain/Components/RecipientCard.swift
  (with mutuals strip)
- Features/SupportTrains/StartTrain/Components/InviteRecipientCard.swift
- Features/SupportTrains/StartTrain/Components/StepRail.swift
  (mini 5-segment preview)
- (Android equivalents)

ACCEPTANCE
- Wizard chrome is warm-amber throughout (CTA, progress rail,
  selected reason tile, identity chip).
- TrainChip: warm-amber pill.
- ReasonPicker: 6 tiles, selected state = warmAmberBg fill + warm
  border.
- RecipientCard: avatar + name + verified-neighbor shield + mutuals
  strip (2 micro-avatars + "2 mutuals: Marisa, Devon").
- InviteRecipientCard (Frame 2): search row → no-match amber section
  → invite-by-phone (recommended green chip) + invite-by-email →
  privacy hint. CTA flips to "Send invite & continue".
- StepRail preview at bottom of body (5-segment rail showing current
  step).
- Snapshot tests for verified-neighbor + invite-branch states.
- iOS + Android parity.
- No off-scale tokens.

OUT OF SCOPE
- Real contact-picker integration (stub the typeahead).
```

## P7.5 — A14.5 Notifications (reshape — extends GroupedListView)

```
Reshape NotificationSettingsViewModel + GroupedListView to support
the 3-channel P/E/S matrix per row. This requires extending
GroupedListView's RowTrailing variant set with a `channelTriad`
case. Uses ChannelChip (P1.2).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A14.5
- docs/designs/A14/A14.5*.{html,jsx}
- Current iOS: Features/Settings/SettingsViewModels.swift:245
  (NotificationSettingsViewModel) + Features/Shared/GroupedList/
- Current Android: ui/screens/settings/SettingsViewModels.kt +
  ui/screens/shared/grouped_list/
- Primitive: ChannelChip (P1.2)

FILES TO MODIFY
- Features/Shared/GroupedList/GroupedListView.swift — add
  `RowTrailing.channelTriad(p: Bool, e: Bool, s: Bool, locked:
  Set<Channel>)` case. The view renders a ChannelTriad inline.
- Features/Settings/SettingsViewModels.swift — rewrite
  NotificationSettingsViewModel to emit channelTriad rows per
  category.
- (Android equivalents — RowTrailing sealed class addition)

FILES TO CREATE
- Features/Settings/Notifications/NotificationsView.swift (thin
  wrapper if needed for headers / paused banner)
- Features/Settings/Notifications/NotificationsViewModel.swift (move
  out of SettingsViewModels.swift)
- Features/Settings/Notifications/Components/ChannelHeader.swift
  (P/E/S column headers row in appSurfaceMuted)
- Features/Settings/Notifications/Components/PauseBanner.swift
- (Android equivalents)

ACCEPTANCE
- 5 category groups (Tasks · Pulse · Marketplace · Home & Mailbox ·
  Account & security).
- Each group card starts with ChannelHeader (P/E/S column titles in
  appSurfaceMuted strip above first row).
- Each row is RowTrailing.channelTriad — 3 ChannelChips per row.
- Helper lines per card that contextualize the active pattern
  (per-pattern copy per audit).
- Emergency alerts row in Home & Mailbox: P chip is sky-bg + lock
  icon overlay (can't be turned off); helper line: "Emergency alerts
  can't be muted on push."
- Master "Pause notifications" control at top — iOS toggle +
  chevron-right for duration sheet.
- Paused state: master card swapped to PauseBanner (warm amber bg +
  bell-off icon + "Paused for 1h 24m left" + Resume neutral pill);
  category cards stay rendered at 0.5 opacity.
- Snapshot tests for active + paused states.
- iOS + Android parity (helper copy word-for-word).
- No off-scale tokens.

OUT OF SCOPE
- Real notification backend wiring (toggle persistence stubbed).
```

## P7.6 — A14.7 Privacy (reshape — extends GroupedListView)

```
Reshape PrivacySettingsViewModel + GroupedListView with RadioCard
+ FuzzMap slider + Stealth banner.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A14.7
- docs/designs/A14/A14.7*.{html,jsx}
- Current: Features/Settings/SettingsViewModels.swift:397
  (PrivacySettingsViewModel)
- Primitive: FuzzMap (P1.3)

FILES TO MODIFY
- Features/Shared/GroupedList/GroupedListView.swift — add
  `RowLeading.radio(selected: Bool)` + a section variant for the
  RadioCard pattern (3 stacked options with one selected at a time).
- SettingsViewModels.swift — rewrite PrivacySettingsViewModel.

FILES TO CREATE
- Features/Settings/Privacy/PrivacyView.swift (thin wrapper for
  stealth banner + FuzzMap section)
- Features/Settings/Privacy/PrivacyViewModel.swift
- Features/Settings/Privacy/Components/StealthBanner.swift
- Features/Settings/Privacy/Components/LocationFuzzSlider.swift
  (wraps FuzzMap + slider control + 5 stop labels)
- (Android equivalents)

ACCEPTANCE
- Profile visibility group: RadioCard with 3 options (Anyone /
  Verified neighbors only / Hidden) + helper line below.
- Address group: RadioCard with 3 options (Street + apt / Street
  only / Hide entirely).
- Location fuzz group: LocationFuzzSlider (5 stops: Exact /
  Building / Block / Block default / Neighborhood) with FuzzMap
  preview animating live as slider drags.
- Activity group: 5 toggles per audit (Hide from search · Show
  online status · Show last active · Show read receipts · Share
  home check-ins).
- Data group: chevron rows (Download my data + Delete my account
  destructive).
- Stealth mode: dark `#0b1220` banner at top with sky-tinted
  eye-off icon disc + copy.
- Snapshot tests for defaults + stealth states.
- iOS + Android parity.
- No off-scale tokens.

OUT OF SCOPE
- Real GDPR data-export backend (chevron opens placeholder).
```

---

# Phase 8 — POLISH batch

## P8.1 — A03 Pulse + Beacons polish

```
Polish the Pulse feed + Beacons feed to match the new designs:
verify chip row order, Event RSVP variant, footer scope chip on
empty state, and confirm Beacons tab location.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A03.1, § A03.2
- docs/designs/A03/A03.1*.{html,jsx} + A03.2*.{html,jsx}
- Current iOS: Features/Feed/FeedView.swift + Pulse/PulsePostCard.swift
- Current Android: ui/screens/feed/FeedScreen.kt + feed/pulse/PulsePostCard.kt
- Resolve open question: locate the Beacons tab — likely a sub-tab
  inside FeedView or surfaced through AudienceProfile.

FILES TO MODIFY
- FeedView.swift / FeedScreen.kt
- PulsePostCard.swift / PulsePostCard.kt
- Possibly Feed/Pulse/PulseIntent.swift to ensure the 6 intent set
  matches: All / Ask / Recommend / Event / Lost & Found / Announce
  in that order.

FILES TO CREATE (if Beacons is a new tab)
- Features/Feed/Beacons/BeaconsFeedView.swift +
  BeaconsFeedViewModel.swift + sample data
- (Android equivalents)

ACCEPTANCE — A03.1
- Chip row in canonical order with tinted bgs per IntentChip palette
  (amber / success / violet / rose / slate).
- PostCard recipe: avatar → name+meta+IntentChip → 3-line clamped
  body → ReactionBar (helpful·going·seen·shared + Reply).
- Event variant: posts with intent=.event get a "+N going" stacked-
  avatar row + RSVP pill capped above the reaction bar.
- Pull-to-refresh mid-gesture spinner.
- FAB at right 18 / bottom 84 (clears tab bar).
- Empty state: radio-tower glyph in primary50 circle + "No posts
  yet" h2 + Create post primary CTA + footer chip showing active
  neighborhood scope ("Showing posts within Elm Park · change in
  filter").

ACCEPTANCE — A03.2
- Same archetype with rss-icon empty state + "Discover beacons" CTA
  + "0 beacons followed" footer chip.
- All authors carry verified check disc.
- Snapshot tests for populated + empty on both A03.1 and A03.2.
- iOS + Android parity.
- No off-scale tokens.
```

## P8.2 — A09 Transactional details polish (all 4)

```
Polish the four A09 transactional detail screens against the new
designs. Shell is solid (TransactionalDetailShell) — gaps are
per-state coverage and per-screen slot extensions.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A09.1 through § A09.4
- docs/designs/A09/A09.{1,2,3,4}*.{html,jsx}
- Current iOS: Features/ContentDetail/{GigDetailView, ListingDetailView,
  InvoiceDetailView}.swift + TransactionalDetailShell.swift
- Current Android: ui/screens/contentdetail/

FILES TO MODIFY
- Features/ContentDetail/GigDetailView.swift +
  GigDetailViewModel.swift — verify V2/V1 split (V2 has Magic Task
  modules and bid tags; V1 is sparser and supports awarded state with
  dimmed losing bids + strike-through prices).
- Features/ContentDetail/ListingDetailView.swift — confirm hero
  carousel with glass nav, sold state (desaturated hero +
  tilted SOLD stamp + Sold pill + green "Sold for $385" tag +
  similar-still-available row + Find similar single CTA).
- Features/ContentDetail/InvoiceDetailView.swift — confirm mono
  reference line, total hero, payer/payee row with identity dots,
  line-items table with tabular-nums, paid state (total recolors
  success green + check disc + Pantopus Pay receipt capsule + dock
  pivots to Share + Download receipt).
- TransactionalDetailShell.swift — confirm shell supports all the
  variant slots (no shell rewrite expected, just slot wiring).
- (Android equivalents)

ACCEPTANCE
- Verify all 4 screens × all designed states (12+ frames total)
  per the audit's per-frame deltas.
- Snapshot tests cover every state on both platforms.
- iOS + Android parity.
- No off-scale tokens.

OUT OF SCOPE
- Live counter-party messaging integration.
- Magic Task ingest backend (sample-data JSONB only).
```

## P8.3 — A12.4 Claim Evidence polish

```
Polish the existing ClaimUploadStep to match the new design's
upload-slot state vocabulary + address-match confirmations.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A12.4
- docs/designs/A12/A12.4*.{html,jsx}
- Current iOS: Features/Homes/ClaimOwnership/Steps/ClaimUploadStep.swift
- Current Android: ui/screens/homes/claim_ownership/ClaimOwnershipSteps.kt

FILES TO MODIFY
- ClaimUploadStep.swift — refine UploadSlot states (empty / uploading
  / done / warn) with the exact slot vocabulary from the audit.
- ClaimOwnershipWizardViewModel.swift — add address-match check on
  upload completion (sample-data heuristic for now).

FILES TO CREATE
- Features/Homes/ClaimOwnership/Components/UploadSlot.swift (extract
  to a reusable component if not already)
- Features/Homes/ClaimOwnership/Components/ClaimStatement.swift
- (Android equivalents)

ACCEPTANCE
- UploadSlot states: empty (dashed border + plus icon + label),
  uploading (filename + size + progress bar), done (filename + size
  + green check + "Address matches your account"), warn (filename +
  amber chip + "Address differs from your profile" block).
- ClaimStatement: 500-char textarea with live counter, placeholder
  copy from design.
- Encryption footer ("🔒 Encrypted in transit. Visible only to the
  reviewer…") in appTextSecondary 11.5pt.
- Snapshot tests for ready-to-submit + mid-upload variants on both
  platforms.
- iOS + Android parity (placeholder copy + footer copy word-for-word).
- No off-scale tokens.
```

## P8.4 — A14.3 Settings index + A14.4 Blocked users polish

```
Polish the Settings index (verification group + payments group +
MeCard + mono footer) and BlockedUsers (source-context line +
empty state).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A14.3, § A14.4
- docs/designs/A14/A14.3*.{html,jsx} + A14.4*.{html,jsx}
- Current iOS: Features/Settings/SettingsView.swift +
  Features/Settings/Blocks/BlockedUsersView.swift

FILES TO MODIFY
- SettingsView.swift / SettingsScreens.kt — add MeCard at top,
  bring up Verification group inline rows, mono footer.
- SettingsViewModels.swift — extend SettingsIndexViewModel with
  verification states + payments-status chip.
- BlockedUsersView.swift / BlockedUsersScreen.kt — add source-
  context line per row + helper line below card + empty-state
  EmptyState card.

ACCEPTANCE — A14.3
- MeCard at top (avatar + name + handle + identity-chip row + mono
  "Member since" caption).
- Verification group: 4 rows each carrying status chip in trailing
  position.
- Payments group: in settled mode "Stripe Connected" + "Chase
  ····7421"; in onboarding mode Connect primary chip.
- Account & security: Password / Verification center / Sign-in
  history (new row).
- Help & legal group + destructive Sign out in own card.
- Mono footer "Pantopus 3.4.1 (build 2241) · iOS 18.2".

ACCEPTANCE — A14.4
- Row recipe: 36pt avatar + Blocked-date + source-context (e.g.
  "From Pulse") + Unblock pill in neutral tone.
- Helper line below card per audit.
- Empty state: user-x icon + "No one blocked" + reassurance about
  silence.
- Snapshot tests for both states on both platforms.
- iOS + Android parity.
- No off-scale tokens.
```

## P8.5 — A18 status screens polish (all 3)

```
Polish all three A18 status screens. Two reuse StatusWaitingView
factories; the third (A18.3 Verification submitted) requires a new
factory.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A18.1, § A18.2, § A18.3
- docs/designs/A18/*.{html,jsx}
- Current iOS: Features/Status/StatusWaitingView.swift +
  StatusWaitingContent.swift
- Primitive: HaloCircle (P1.4)

FILES TO MODIFY
- StatusWaitingView.swift / StatusWaitingScreen.kt — swap inline
  illustration helper with HaloCircle. Verify timeline gracefully
  omits when empty (for A18.1).
- StatusWaitingContent.swift — refine existing factories
  (checkYourEmail, claimSubmitted) to match the new spec; add new
  factory `verificationSubmitted(homeName:, landlordEmail:)` with
  two states (waiting-on-landlord / landlord-confirmed).

ACCEPTANCE
- A18.1 Check your email: mail-check HaloCircle + neutral
  "Waiting for link click…" spinning-hourglass pill + 3-button
  stack (Open Mail primary + Resend outline + Use different email
  underline) + spam-hint footer. Resent state: success green pill
  + disabled Resend with countdown.
- A18.2 Claim submitted: check HaloCircle (or badge-check in
  approved) + headline + body + address chip + 3-step Timeline +
  ETA pill (amber/green based on state) + dock-label swap on
  approval.
- A18.3 Verification submitted: NEW factory; check HaloCircle (or
  user-check in landlord-confirmed) + landlord email body + address
  chip + Timeline with landlord-confirms middle step + ETA tone
  shifts (amber "Most landlords confirm in 1–2 days" → primary "Just
  one more step · Pantopus reviewing now") + primary "Back to home"
  + secondary "View status".
- Snapshot tests for all states on both platforms.
- iOS + Android parity.
- No off-scale tokens.
```

## P8.6 — A21 Persona + Local profile polish (empty states + chrome)

```
Polish AudienceProfileView (A21.1) and PublicProfileView (A21.2) to
correctly render the empty states with full EmptyState card +
primary CTA (currently render only a single line per the team's
own parity audit).

CONTEXT TO READ FIRST
- docs/new-design-parity.md — § A21.1, § A21.2
- docs/screen-parity-inventory.md — confirms the empty-state gap
- docs/designs/A21/A21.1*.{html,jsx} + A21.2*.{html,jsx}
- Current iOS: Features/AudienceProfile/AudienceProfileView.swift +
  Features/Profile/PublicProfileChrome.swift:396-402
- Current Android: ui/screens/audience_profile/ + ui/screens/profile/
- Primitive: BeaconBanner (P1.4)

FILES TO MODIFY
- AudienceProfileView.swift — replace single-line "No broadcasts
  yet…" with full EmptyState card (72pt primary50 circle +
  radio-tower icon + "Quiet for now" h2 + body + Notify when live
  primary CTA with bell-plus icon).
- PublicProfileChrome.swift — same shape, home-tinted icon disc,
  "Send a message" primary CTA with message-square icon.
- Banner usage: confirm sky-personal for A21.1 and home-green for
  A21.2 (use BeaconBanner primitive).

ACCEPTANCE — A21.1
- Banner uses BeaconBanner identity=.personal.
- IdentityBlock: 72pt avatar at -36pt overlapping banner +
  VerifDot corner badge + name + handle + tier chip (Persona ·
  Verified gold crown) + bio + StatCell row (Beacons / Broadcasts /
  Member-since).
- Action area for visitor: share kebab ghost + Follow primary + plus
  icon.
- CategoryChips + TabStrip + BroadcastCard feed.
- Empty state: full EmptyState card.

ACCEPTANCE — A21.2
- Banner uses BeaconBanner identity=.home (green).
- IdentityBlock action area: Connect ghost + Message primary. NO
  Tiers tab.
- Verified-neighbor shield chip + locality pin chip.
- LocalPostCard feed with Pulse-style intent chips (Offer / Alert
  / Event).
- Empty state: full EmptyState card with home-tinted disc + Send a
  message primary CTA.
- Snapshot tests on both screens, both states (populated + empty)
  on both platforms.
- iOS + Android parity.
- No off-scale tokens.

OUT OF SCOPE
- Owner-mode chrome (analytics + edit) — deferred per audit open
  question #1.
```

---

# Phase 9 — Lockfile

## P9.1 — New-design snapshot lockfile

```
Create a single snapshot test rig that locks the new design pack as
the durable reference for every screen in this build-out. This is
the tripwire that catches future drift.

CONTEXT TO READ FIRST
- docs/new-design-parity.md — full audit
- Existing snapshot infrastructure:
  - frontend/apps/ios/PantopusTests/Features/Shared/T6ScreensSnapshotTests.swift
    (existing T6 lockfile)
  - frontend/apps/android/app/src/test/java/.../shared/*SnapshotTest.kt
- The 38 screens this prompt set covered.

FILES TO CREATE — iOS
- PantopusTests/Features/Shared/NewDesignScreensSnapshotTests.swift
  — one test per screen variant, exhaustive coverage.
- PantopusTests/Features/Shared/__snapshots__/new-designs/*.png
  (committed reference PNGs)

FILES TO CREATE — Android
- app/src/test/java/app/pantopus/android/ui/screens/shared/NewDesignScreensSnapshotTest.kt
- app/src/test/snapshots/images/new-designs/*.png

ACCEPTANCE
- Every screen × every designed variant from the audit has at least
  one snapshot row.
- The iOS test class is structured as documented in the existing
  T6ScreensSnapshotTests.swift file (mirrored convention).
- The Android test class is structured per existing paparazzi
  conventions.
- All snapshots pass on first run (assumes Phases 1–8 are complete).
- Reference PNGs committed alongside the test file.
- A short README at PantopusTests/Features/Shared/NEW_DESIGNS.md
  explains how to regenerate the lockfile (when, by whom, with what
  approval).

OUT OF SCOPE
- Locking pre-existing screens (T6 already covered those).
- Pixel-perfect alignment with the design HTML (we lock the
  current implementation as ground truth; design diffs are caught
  in code review, not pixel diff).
```

---

# Appendix — Cross-cutting concerns to monitor

These aren't standalone prompts — they're recurring acceptance
criteria Claude Code should re-verify during every prompt.

### Token compliance
- Run `frontend/apps/ios/Pantopus/scripts/verify-tokens.sh` and the
  Android detekt baseline equivalent after each prompt. Zero new
  hex literals outside palettes; zero new off-scale spacing / radii
  / fonts. Update the token-drift audit doc if any exceptions are
  intentional.

### Copy parity
- Every error / empty / button label must be word-for-word identical
  iOS ↔ Android. If a prompt introduces new copy, surface it in the
  PR description so localization can mirror.

### State coverage
- Every fetchable screen must have loading / empty / populated /
  error states. Forms have ready / dirty / submitting / error /
  success. Snapshot tests must cover all.

### Accessibility
- VoiceOver / TalkBack labels on every interactive element. Use
  existing `.accessibilityIdentifier` / `.semantics(testTag = …)`
  pattern. Add to `docs/a11y-audit-current.md` if introducing new
  surfaces.

### Performance
- New screens must respect the perf budgets in
  `frontend/apps/{ios,android}/docs/perf_budgets.md`. If a screen
  introduces a heavy primitive (BalanceHero arcs, PaperStack
  rotations, FuzzMap animations), the prompt's acceptance criteria
  call out the budget explicitly.

### Routing
- Every new screen wires through both `Core/Routing/DeepLinkRouter.swift`
  (iOS) and the Android NavGraph equivalent. New `HubRoute` cases
  go in `Features/Root/HubTabRoot.swift`.

---

*End of prompt set. 34 prompts total. See `docs/new-design-parity.md`
for the underlying audit.*
