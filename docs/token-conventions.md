# Token conventions — single source of truth

> **What this is.** The exact, verified symbol names for every Pantopus design
> token on both platforms. Every Phase 7 prompt **must cite these patterns
> verbatim** instead of inferring or generalizing — early prompt drafts
> hallucinated names like `PantopusSpacing` (does not exist) that wasted
> bandwidth in review.
>
> **Method.** Each section opens the actual source file at the path stated,
> records the accessor pattern from the file's public API, and enumerates
> every defined symbol. No inference. If a symbol doesn't exist, the section
> says **NOT DEFINED**.
>
> **Generated:** 2026-05-26.
>
> **Dominance (real usage counts in feature code).** Scope:
> `frontend/apps/ios/Pantopus/**/*.swift` minus `Core/Design/`, and
> `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/**/*.kt`
> minus `ui/theme/`. Counts are line-occurrences (`grep -rE … | wc -l`), so
> a line with two references contributes 1.
>
> | Pattern | iOS usage | Android usage |
> |---|---:|---:|
> | `Theme.Color.*` (iOS) / `PantopusColors.*` (Android) | 5554 | 5758 |
> | `Spacing.s*` | 2523 | 2217 |
> | `Radii.*` | 1222 | 1346 |
> | `.pantopusTextStyle(.X)` (iOS) / `PantopusTextStyle.*` (Android) | 757 | 1098 |
> | `Icon(.X)` (iOS) / `PantopusIconImage(icon = …)` (Android) | 650 | 874 |
> | `PantopusElevations.*` (Android) | n/a | 30 |
> | **`PantopusTheme.tokens.*` (Android themed bag)** | n/a | **0** |
> | **`LocalPantopusTokens.current.*` (Android CompositionLocal)** | n/a | **0** |
>
> **Recompute** (any future P7 prompt that wants fresh dominance numbers):
>
> ```bash
> # iOS — Theme.Color.* in feature code
> grep -rE "Theme\.Color\." frontend/apps/ios/Pantopus/ --include="*.swift" \
>   | grep -v "/Core/Design/" | wc -l
> # Android — PantopusColors.* in feature code
> grep -rE "PantopusColors\." \
>   frontend/apps/android/app/src/main/java/app/pantopus/android/ui/ \
>   --include="*.kt" | grep -v "/ui/theme/" | wc -l
> ```

---

## 1. iOS color tokens

**File:** `frontend/apps/ios/Pantopus/Core/Design/Colors.swift`
**Accessor pattern:** `Theme.Color.<token>` — the file `public extension`s a
nested `Theme.Color` enum (declared empty in `Core/Design/Theme.swift`). Each
token is a `SwiftUI.Color` loaded from the asset catalog (`bundle: Theme.bundle`).

### Primary (sky) scale

| Symbol | Hex |
|---|---|
| `Theme.Color.primary25` | `#F8FBFF` |
| `Theme.Color.primary50` | `#F0F9FF` |
| `Theme.Color.primary100` | `#E0F2FE` |
| `Theme.Color.primary200` | `#BAE6FD` |
| `Theme.Color.primary300` | `#7DD3FC` |
| `Theme.Color.primary400` | `#38BDF8` |
| `Theme.Color.primary500` | `#0EA5E9` |
| `Theme.Color.primary600` | `#0284C7` — brand primary |
| `Theme.Color.primary700` | `#0369A1` |
| `Theme.Color.primary800` | `#075985` |
| `Theme.Color.primary900` | `#0C4A6E` |

### Semantic

| Symbol | Hex |
|---|---|
| `Theme.Color.success` | `#059669` |
| `Theme.Color.successLight` | `#D1FAE5` |
| `Theme.Color.successBg` | `#F0FDF4` |
| `Theme.Color.warning` | `#D97706` |
| `Theme.Color.warningLight` | `#FDE68A` |
| `Theme.Color.warningBg` | `#FFFBEB` |
| `Theme.Color.error` | `#DC2626` |
| `Theme.Color.errorLight` | `#FECACA` |
| `Theme.Color.errorBg` | `#FEF2F2` |
| `Theme.Color.info` | `#0284C7` |
| `Theme.Color.infoLight` | `#BAE6FD` |
| `Theme.Color.infoBg` | `#F0F9FF` |

### Identity pillars

| Symbol | Hex |
|---|---|
| `Theme.Color.personal` | `#0284C7` |
| `Theme.Color.personalBg` | `#DBEAFE` |
| `Theme.Color.home` | `#16A34A` |
| `Theme.Color.homeBg` | `#DCFCE7` |
| `Theme.Color.business` | `#7C3AED` |
| `Theme.Color.businessBg` | `#F3E8FF` |
| `Theme.Color.magic` | `#6D28D9` — Magic Task accent (T6.0b) |
| `Theme.Color.magicBg` | `#EDE9FE` |
| `Theme.Color.magicBgSoft` | `#F5F3FF` |
| `Theme.Color.magicBorder` | `#DDD6FE` |

### App shell / neutrals

| Symbol | Hex |
|---|---|
| `Theme.Color.appBg` | `#F6F7F9` |
| `Theme.Color.appSurface` | `#FFFFFF` |
| `Theme.Color.appSurfaceRaised` | `#F9FAFB` |
| `Theme.Color.appSurfaceSunken` | `#F3F4F6` |
| `Theme.Color.appSurfaceMuted` | `#F8FAFC` |
| `Theme.Color.appBorder` | `#E5E7EB` |
| `Theme.Color.appBorderStrong` | `#D1D5DB` |
| `Theme.Color.appBorderSubtle` | `#F3F4F6` |
| `Theme.Color.appText` | `#111827` |
| `Theme.Color.appTextStrong` | `#374151` |
| `Theme.Color.appTextSecondary` | `#6B7280` |
| `Theme.Color.appTextMuted` | `#9CA3AF` |
| `Theme.Color.appTextInverse` | `#FFFFFF` |
| `Theme.Color.appHover` | `#F3F4F6` |

### Category accents

| Symbol | Hex |
|---|---|
| `Theme.Color.handyman` | `#F97316` |
| `Theme.Color.cleaning` | `#27AE60` |
| `Theme.Color.moving` | `#8E44AD` |
| `Theme.Color.petCare` | `#E74C3C` |
| `Theme.Color.childCare` | `#F39C12` |
| `Theme.Color.tutoring` | `#2980B9` |
| `Theme.Color.delivery` | `#374151` |
| `Theme.Color.tech` | `#3498DB` |
| `Theme.Color.goods` | `#7C3AED` |
| `Theme.Color.gigs` | `#F97316` |
| `Theme.Color.rentals` | `#16A34A` |
| `Theme.Color.vehicles` | `#DC2626` |

---

## 2. iOS spacing tokens

**File:** `frontend/apps/ios/Pantopus/Core/Design/Spacing.swift`
**Accessor pattern:** `Spacing.s<n>` — top-level `public enum Spacing` with
`public static let` fields. **Not** under `Theme.*`.

| Symbol | Value |
|---|---|
| `Spacing.s0` | 0 pt |
| `Spacing.s1` | 4 pt |
| `Spacing.s2` | 8 pt |
| `Spacing.s3` | 12 pt |
| `Spacing.s4` | 16 pt |
| `Spacing.s5` | 20 pt |
| `Spacing.s6` | 24 pt |
| `Spacing.s8` | 32 pt |
| `Spacing.s10` | 40 pt |
| `Spacing.s12` | 48 pt |
| `Spacing.s16` | 64 pt |

Note: there is no `s7`, `s9`, `s11`, `s13`, `s14`, `s15` — the ramp jumps to
match the design-system px scale.

---

## 3. iOS radii tokens

**File:** `frontend/apps/ios/Pantopus/Core/Design/Radii.swift`
**Accessor pattern:** `Radii.<name>` — top-level `public enum Radii`. **Not**
under `Theme.*`.

| Symbol | Value |
|---|---|
| `Radii.xs` | 4 pt |
| `Radii.sm` | 6 pt |
| `Radii.md` | 8 pt |
| `Radii.lg` | 12 pt |
| `Radii.xl` | 16 pt |
| `Radii.xl2` | 20 pt |
| `Radii.xl3` | 24 pt |
| `Radii.pill` | 9999 pt — effectively-round pill corners |

---

## 4. iOS typography

**File:** `frontend/apps/ios/Pantopus/Core/Design/Typography.swift`
**Public API — three pieces:**

1. **`PantopusTextStyle`** — `public enum` of semantic roles, carries
   `size` / `lineHeight` / `weight` / `tracking` / `uppercased`.
2. **`Theme.Font.<role>`** — pre-built `Font` values (`Theme.Font.h1`, etc.)
   plus a `Theme.Font.role(_ role: PantopusTextStyle) -> Font` resolver.
3. **`.pantopusTextStyle(_:)`** view modifier on `Text` — sets font +
   tracking + upper-cases the string (for `.overline`). Pair with
   **`.pantopusLineHeight(_:)`** on the surrounding `View` for line-height
   (SwiftUI's `Text` cannot set line spacing on its own).

**Canonical call site:**
```swift
Text("Welcome").pantopusTextStyle(.h1)
VStack { … }.pantopusLineHeight(.h1)
```

### Roles

| Role | Size | Line height | Weight | Tracking (pt) | Uppercase |
|---|---:|---:|---|---:|---|
| `.h1` | 30 | 36 | `.bold` | `-0.020 × 30 = -0.6` | no |
| `.h2` | 24 | 32 | `.semibold` | `-0.015 × 24 = -0.36` | no |
| `.h3` | 20 | 28 | `.semibold` | `0` | no |
| `.body` | 16 | 24 | `.regular` | `0` | no |
| `.small` | 14 | 20 | `.regular` | `0` | no |
| `.caption` | 12 | 16 | `.regular` | `0` | no |
| `.overline` | 11 | 16 | `.semibold` | `0.06 × 11 = 0.66` | yes |

---

## 5. iOS icons

**File:** `frontend/apps/ios/Pantopus/Core/Design/Icons.swift`
**Public API — two pieces:**

1. **`PantopusIcon`** — `public enum: String, CaseIterable, Sendable`. Cases
   are camelCase Swift identifiers; `rawValue` is the original Lucide
   kebab-case token (e.g. `case chevronRight = "chevron-right"`). Each case
   resolves to an `sfSymbolName: String` via a `switch` in the enum body.
2. **`Icon`** — `public struct Icon: View`. Renderer used at every call site;
   feature code MUST use this (direct `Image(systemName:)` is rejected by
   `make verify-icons`).

**Canonical call site:**
```swift
Icon(.chevronRight, size: 20)
Icon(.bell, size: 28, color: Theme.Color.primary600)
Icon(.trash2, size: 20, color: Theme.Color.error, accessibilityLabel: "Delete")
```

**`Icon(_:)` parameters:**

| Parameter | Type | Default |
|---|---|---|
| `_ icon` | `PantopusIcon` | (required) |
| `size` | `CGFloat` | `20` |
| `strokeWidth` | `CGFloat` | `2` (mapped to SF Symbol weight: `<1.5 → .light`, `1.5..<2.25 → .regular`, `2.25..<2.75 → .medium`, `≥2.75 → .bold`) |
| `color` | `Color` | `Theme.Color.appText` |
| `accessibilityLabel` | `String?` | `nil` (decorative — hidden from VoiceOver) |

### Enum cases (all)

Casing rule: kebab-case Lucide tokens become camelCase Swift identifiers;
single-word tokens keep all-lowercase. Where the Lucide token collides with
a Swift keyword (`repeat`), the case is renamed (`arrowsRepeat = "repeat"`).

| Case | rawValue (Lucide token) | SF Symbol |
|---|---|---|
| `.home` | `home` | `house` |
| `.map` | `map` | `map` |
| `.inbox` | `inbox` | `tray` |
| `.user` | `user` | `person` |
| `.bell` | `bell` | `bell` |
| `.menu` | `menu` | `line.3.horizontal` |
| `.shieldCheck` | `shield-check` | `checkmark.shield` |
| `.x` | `x` | `xmark` |
| `.plusCircle` | `plus-circle` | `plus.circle` |
| `.camera` | `camera` | `camera` |
| `.scanLine` | `scan-line` | `barcode.viewfinder` |
| `.plusSquare` | `plus-square` | `plus.square` |
| `.sun` | `sun` | `sun.max` |
| `.sunDim` | `sun-dim` | `sun.max` |
| `.chevronRight` | `chevron-right` | `chevron.right` |
| `.chevronLeft` | `chevron-left` | `chevron.left` |
| `.megaphone` | `megaphone` | `megaphone` |
| `.shoppingBag` | `shopping-bag` | `bag` |
| `.hammer` | `hammer` | `hammer` |
| `.mailbox` | `mailbox` | `mail.stack` |
| `.search` | `search` | `magnifyingglass` |
| `.userPlus` | `user-plus` | `person.badge.plus` |
| `.file` | `file` | `doc` |
| `.copy` | `copy` | `doc.on.doc` |
| `.check` | `check` | `checkmark` |
| `.moreHorizontal` | `more-horizontal` | `ellipsis` |
| `.arrowLeft` | `arrow-left` | `arrow.left` |
| `.arrowRight` | `arrow-right` | `arrow.right` |
| `.send` | `send` | `paperplane` |
| `.chevronDown` | `chevron-down` | `chevron.down` |
| `.chevronUp` | `chevron-up` | `chevron.up` |
| `.trash2` | `trash-2` | `trash` |
| `.edit2` | `edit-2` | `pencil` |
| `.upload` | `upload` | `square.and.arrow.up` |
| `.shield` | `shield` | `shield` |
| `.lock` | `lock` | `lock` |
| `.checkCircle` | `check-circle` | `checkmark.circle` |
| `.alertCircle` | `alert-circle` | `exclamationmark.circle` |
| `.circle` | `circle` | `circle` |
| `.info` | `info` | `info.circle` |
| `.wifiOff` | `wifi-off` | `wifi.slash` |
| `.heart` | `heart` | `heart` |
| `.thumbsUp` | `thumbs-up` | `hand.thumbsup` |
| `.star` | `star` | `star` |
| `.helpCircle` | `help-circle` | `questionmark.circle` |
| `.calendar` | `calendar` | `calendar` |
| `.lightbulb` | `lightbulb` | `lightbulb` |
| `.eye` | `eye` | `eye` |
| `.share` | `share` | `square.and.arrow.up` |
| `.radio` | `radio` | `antenna.radiowaves.left.and.right` |
| `.mapPin` | `map-pin` | `mappin` |
| `.pencil` | `pencil` | `pencil` |
| `.briefcase` | `briefcase` | `briefcase` |
| `.gavel` | `gavel` | `hammer.fill` |
| `.slidersHorizontal` | `sliders-horizontal` | `slider.horizontal.3` |
| `.messageCircle` | `message-circle` | `bubble.left` |
| `.atSign` | `at-sign` | `at` |
| `.badgeCheck` | `badge-check` | `checkmark.seal` |
| `.tag` | `tag` | `tag` |
| `.shieldAlert` | `shield-alert` | `exclamationmark.shield` |
| `.checkCheck` | `check-check` | `checkmark.circle` |
| `.history` | `history` | `clock.arrow.circlepath` |
| `.receipt` | `receipt` | `doc.text` |
| `.clock` | `clock` | `clock` |
| `.users` | `users` | `person.2` |
| `.dollarSign` | `dollar-sign` | `dollarsign` |
| `.dog` | `dog` | `dog` |
| `.cat` | `cat` | `cat` |
| `.bird` | `bird` | `bird` |
| `.fish` | `fish` | `fish` |
| `.turtle` | `turtle` | `tortoise` |
| `.pawPrint` | `paw-print` | `pawprint` |
| `.sparkles` | `sparkles` | `sparkles` |
| `.timer` | `timer` | `timer` |
| `.arrowsRepeat` | `repeat` | `arrow.triangle.2.circlepath` |
| `.hourglass` | `hourglass` | `hourglass` |
| `.handCoins` | `hand-coins` | `hand.raised` |
| `.package` | `package` | `shippingbox` |
| `.flower` | `flower` | `camera.macro` |
| `.compass` | `compass` | `safari` |
| `.filter` | `filter` | `line.3.horizontal.decrease` |
| `.crown` | `crown` | `crown` |
| `.trendingDown` | `trending-down` | `chart.line.downtrend.xyaxis` |
| `.ban` | `ban` | `nosign` |
| `.fileText` | `file-text` | `doc.text` |
| `.plus` | `plus` | `plus` |
| `.rocket` | `rocket` | `paperplane.fill` |
| `.clipboardList` | `clipboard-list` | `list.clipboard` |
| `.clockPlus` | `clock-plus` | `clock.arrow.circlepath` |
| `.circleSlash` | `circle-slash` | `circle.slash` |
| `.play` | `play` | `play.fill` |
| `.pause` | `pause` | `pause.fill` |
| `.archive` | `archive` | `archivebox` |
| `.messageSquarePlus` | `message-square-plus` | `bubble.left.and.text.bubble.right` |
| `.bookmark` | `bookmark` | `bookmark` |
| `.zap` | `zap` | `bolt` |
| `.flame` | `flame` | `flame` |
| `.droplet` | `droplet` | `drop` |
| `.wifi` | `wifi` | `wifi` |
| `.building2` | `building-2` | `building.2` |
| `.smartphone` | `smartphone` | `iphone` |
| `.wallet` | `wallet` | `wallet.pass` |
| `.hash` | `hash` | `number` |
| `.tv` | `tv` | `tv` |
| `.laptop` | `laptop` | `laptopcomputer` |
| `.monitor` | `monitor` | `display` |
| `.shuffle` | `shuffle` | `shuffle` |
| `.wandSparkles` | `wand-sparkles` | `wand.and.stars` |
| `.arrowUpRight` | `arrow-up-right` | `arrow.up.right` |
| `.wrench` | `wrench` | `wrench.adjustable` |
| `.usersRound` | `users-round` | `person.3` |
| `.gift` | `gift` | `gift` |
| `.partyPopper` | `party-popper` | `party.popper` |
| `.graduationCap` | `graduation-cap` | `graduationcap` |
| `.stethoscope` | `stethoscope` | `stethoscope` |
| `.calendarDays` | `calendar-days` | `calendar` |
| `.link` | `link` | `link` |
| `.pin` | `pin` | `pin` |
| `.power` | `power` | `power` |
| `.phoneCall` | `phone-call` | `phone.fill` |
| `.phone` | `phone` | `phone` |
| `.navigation` | `navigation` | `location.north.fill` |
| `.heartPulse` | `heart-pulse` | `waveform.path.ecg` |
| `.siren` | `siren` | `exclamationmark.octagon.fill` |
| `.cross` | `cross` | `cross.fill` |
| `.flag` | `flag` | `flag.fill` |
| `.userRound` | `user-round` | `person.crop.circle.fill` |
| `.flaskConical` | `flask-conical` | `testtube.2` |
| `.flameKindling` | `flame-kindling` | `flame.fill` |
| `.printer` | `printer` | `printer` |
| `.listChecks` | `list-checks` | `checklist` |
| `.alertTriangle` | `alert-triangle` | `exclamationmark.triangle` |
| `.image` | `image` | `photo` |
| `.imagePlus` | `image-plus` | `photo.badge.plus` |
| `.fileType` | `file-type` | `doc.fill` |
| `.fileSpreadsheet` | `file-spreadsheet` | `tablecells` |
| `.fileSignature` | `file-signature` | `doc.text.fill` |
| `.landmark` | `landmark` | `building.columns` |
| `.stamp` | `stamp` | `checkmark.seal.fill` |
| `.idCard` | `id-card` | `person.text.rectangle` |
| `.folderLock` | `folder-lock` | `lock.doc` |
| `.uploadCloud` | `upload-cloud` | `icloud.and.arrow.up` |
| `.calendarClock` | `calendar-clock` | `calendar.badge.clock` |
| `.download` | `download` | `arrow.down.circle` |
| `.eyeOff` | `eye-off` | `eye.slash` |
| `.keyRound` | `key-round` | `key` |
| `.leaf` | `leaf` | `leaf` |
| `.utensils` | `utensils` | `fork.knife` |
| `.baby` | `baby` | `figure.child` |
| `.fan` | `fan` | `fan` |
| `.cloudRain` | `cloud-rain` | `cloud.rain` |
| `.refrigerator` | `refrigerator` | `refrigerator` |
| `.bug` | `bug` | `ant` |
| `.trees` | `trees` | `tree` |
| `.paintRoller` | `paint-roller` | `paintbrush.pointed` |
| `.bellRing` | `bell-ring` | `bell.badge` |
| `.mail` | `mail` | `envelope` |
| `.mailOpen` | `mail-open` | `envelope.open` |
| `.folderPlus` | `folder-plus` | `folder.badge.plus` |
| `.piggyBank` | `piggy-bank` | `dollarsign.circle` |
| `.plane` | `plane` | `airplane` |
| `.receiptText` | `receipt-text` | `doc.plaintext` |
| `.paperclip` | `paperclip` | `paperclip` |
| `.arrowDownUp` | `arrow-down-up` | `arrow.up.arrow.down` |
| `.video` | `video` | `video` |
| `.moreVertical` | `more-vertical` | `ellipsis` |
| `.hand` | `hand` | `hand.wave` |
| `.smile` | `smile` | `face.smiling` |
| `.arrowUp` | `arrow-up` | `arrow.up` |
| `.reply` | `reply` | `arrowshape.turn.up.left` |
| `.radioTower` | `radio-tower` | `antenna.radiowaves.left.and.right` |
| `.messageSquare` | `message-square` | `message` |
| `.globe` | `globe` | `globe` |
| `.externalLink` | `external-link` | `arrow.up.right.square` |
| `.refreshCw` | `refresh-cw` | `arrow.triangle.2.circlepath` |
| `.snowflake` | `snowflake` | `snowflake` |
| `.wind` | `wind` | `wind` |
| `.bus` | `bus` | `bus.fill` |
| `.droplets` | `droplets` | `drop` |
| `.ribbon` | `ribbon` | `rosette` |
| `.palette` | `palette` | `paintpalette` |
| `.playCircle` | `play-circle` | `play.circle` |
| `.gripVertical` | `grip-vertical` | `line.3.horizontal` |
| `.grid3x3` | `grid-3x3` | `square.grid.3x3` |
| `.square` | `square` | `square` |
| `.doorOpen` | `door-open` | `door.left.hand.open` |
| `.car` | `car` | `car` |
| `.warehouse` | `warehouse` | `house.lodge` |
| `.bot` | `bot` | `sparkles` (no SF Symbol robot glyph) |

---

## 6. iOS components

**Folder:** `frontend/apps/ios/Pantopus/Core/Design/Components/`. Public
types per file (one row per file, primary type first):

| File | Public types | One-line usage |
|---|---|---|
| `ActionChip.swift` | `ActionChip` | Compact pill-shaped action tile with icon + label (Hub action grid, empty-state CTAs). |
| `AvatarWithIdentityRing.swift` | `IdentityPillar`, `AvatarWithIdentityRing` | Circular avatar wrapped in a colored ring keyed off the identity pillar (personal/home/business). |
| `BidderStack.swift` | `BidderStack` | Stacked / overlapping avatars row for "N people bid" affordances on Gig detail and similar. |
| `Buttons.swift` | `PantopusButtonKind`, `PantopusButton`, `PrimaryButton` (+ siblings) | Canonical button — `PantopusButton(kind: .primary, label: "Save") { … }`. `PrimaryButton` is the convenience shorthand. |
| `ChipPicker.swift` | `ChipPicker` | Single- or multi-select chip group used in form filters and category pickers. |
| `CompactButton.swift` | `CompactButtonSize`, `CompactButton` | Small inline button (e.g. row-trailing "Open" CTA). Two sizes: `.regular` and `.small`. |
| `DataRow.swift` | `DataRow` | Single-line key→value row with optional trailing edit icon (Property details, Bill detail). |
| `EmergencyCardPDF.swift` | `EmergencyCardContent`, `EmergencyCardPDF` | PDF renderer for the emergency-info Print action (T6.4b). |
| `EmptyState.swift` | `EmptyState` | Canonical empty-state composite — icon + headline + body + optional primary CTA. |
| `KeyFactsPanel.swift` | `KeyFactRow`, `KeyFactsPanel` | Highlighted facts grid (e.g. "3 beds · 2 bath · 1,400 sq ft" on Home dashboard). |
| `OfflineBanner.swift` | `OfflineBanner` | Top-of-screen banner shown while `NetworkMonitor` reports offline. Wired via `.offlineBanner(isOffline:)` view modifier. |
| `PantopusCheckbox.swift` | `PantopusCheckbox` | Themed checkbox used in form-style choice lists. |
| `PantopusTextField.swift` | `PantopusFieldState`, `PantopusTextField` | Single canonical text field with focus / error / disabled states (FormShell + everywhere). |
| `PersonaCard.swift` | `PersonaCard` | Audience-profile persona summary card (Audience tab, Membership detail). |
| `SectionHeader.swift` | `SectionHeader` | Repeating section heading row used across List-of-Rows surfaces. |
| `SegmentedProgressBar.swift` | `SegmentedProgressBar` | Multi-segment progress bar used by Wizard chrome and persona-tier read-share. |
| `Shimmer.swift` | `Shimmer` | Loading skeleton primitive — apply `.shimmer()` to a sized placeholder. |
| `SourcePill.swift` | `SourcePillTone`, `SourcePill` | Origin / source pill ("MLS", "neighbour", "Pantopus AI" etc.) used in Home dashboard cards. |
| `StatusChip.swift` | `StatusChipVariant`, `StatusChip` | Tinted status pill (`.success` / `.warning` / `.error` / `.info` / `.neutral`). |
| `SystemSheets.swift` | `InviteLinks`, `SystemShareSheet`, `MailDraft` | System share sheet + invite-link wrapper + `MailDraft.mailtoURL` / `MailDraft.canSendMail`. |
| `TimelineStepper.swift` | `TimelineStepState`, `TimelineStep`, `TimelineStepper` | Vertical timeline with `.pending` / `.current` / `.done` states (Status waiting, Wizard recap). |
| `Toast.swift` | `ToastKind`, `ToastMessage`, `ToastView` | Bottom-of-screen toast — `ToastView(message: ToastMessage(text:, kind:))`. |
| `VerifiedBadge.swift` | `VerifiedBadge` | Small "verified" check badge for public profile names and identity rows. |

---

## 7. Android color tokens

**File:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Color.kt`
**Accessor pattern:** `PantopusColors.<token>` — `object PantopusColors {}`
holding `val <token> = Color(0xFF…)` properties. Same set of token names as
iOS, dropped down one indirection (no asset-catalog lookup).

### Primary (sky) scale

| Symbol | Hex |
|---|---|
| `PantopusColors.primary25` | `#F8FBFF` |
| `PantopusColors.primary50` | `#F0F9FF` |
| `PantopusColors.primary100` | `#E0F2FE` |
| `PantopusColors.primary200` | `#BAE6FD` |
| `PantopusColors.primary300` | `#7DD3FC` |
| `PantopusColors.primary400` | `#38BDF8` |
| `PantopusColors.primary500` | `#0EA5E9` |
| `PantopusColors.primary600` | `#0284C7` |
| `PantopusColors.primary700` | `#0369A1` |
| `PantopusColors.primary800` | `#075985` |
| `PantopusColors.primary900` | `#0C4A6E` |

### Semantic

| Symbol | Hex |
|---|---|
| `PantopusColors.success` | `#059669` |
| `PantopusColors.successLight` | `#D1FAE5` |
| `PantopusColors.successBg` | `#F0FDF4` |
| `PantopusColors.warning` | `#D97706` |
| `PantopusColors.warningLight` | `#FDE68A` |
| `PantopusColors.warningBg` | `#FFFBEB` |
| `PantopusColors.error` | `#DC2626` |
| `PantopusColors.errorLight` | `#FECACA` |
| `PantopusColors.errorBg` | `#FEF2F2` |
| `PantopusColors.info` | `#0284C7` |
| `PantopusColors.infoLight` | `#BAE6FD` |
| `PantopusColors.infoBg` | `#F0F9FF` |

### Identity pillars

| Symbol | Hex |
|---|---|
| `PantopusColors.personal` | `#0284C7` |
| `PantopusColors.personalBg` | `#DBEAFE` |
| `PantopusColors.home` | `#16A34A` |
| `PantopusColors.homeBg` | `#DCFCE7` |
| `PantopusColors.business` | `#7C3AED` |
| `PantopusColors.businessBg` | `#F3E8FF` |
| `PantopusColors.magic` | `#6D28D9` |
| `PantopusColors.magicBg` | `#EDE9FE` |
| `PantopusColors.magicBgSoft` | `#F5F3FF` |
| `PantopusColors.magicBorder` | `#DDD6FE` |

### App shell / neutrals

| Symbol | Hex |
|---|---|
| `PantopusColors.appBg` | `#F6F7F9` |
| `PantopusColors.appSurface` | `#FFFFFF` |
| `PantopusColors.appSurfaceRaised` | `#F9FAFB` |
| `PantopusColors.appSurfaceSunken` | `#F3F4F6` |
| `PantopusColors.appSurfaceMuted` | `#F8FAFC` |
| `PantopusColors.appBorder` | `#E5E7EB` |
| `PantopusColors.appBorderStrong` | `#D1D5DB` |
| `PantopusColors.appBorderSubtle` | `#F3F4F6` |
| `PantopusColors.appText` | `#111827` |
| `PantopusColors.appTextStrong` | `#374151` |
| `PantopusColors.appTextSecondary` | `#6B7280` |
| `PantopusColors.appTextMuted` | `#9CA3AF` |
| `PantopusColors.appTextInverse` | `#FFFFFF` |
| `PantopusColors.appHover` | `#F3F4F6` |

### Category accents

| Symbol | Hex |
|---|---|
| `PantopusColors.handyman` | `#F97316` |
| `PantopusColors.cleaning` | `#27AE60` |
| `PantopusColors.moving` | `#8E44AD` |
| `PantopusColors.petCare` | `#E74C3C` |
| `PantopusColors.childCare` | `#F39C12` |
| `PantopusColors.tutoring` | `#2980B9` |
| `PantopusColors.delivery` | `#374151` |
| `PantopusColors.tech` | `#3498DB` |
| `PantopusColors.goods` | `#7C3AED` |
| `PantopusColors.gigs` | `#F97316` |
| `PantopusColors.rentals` | `#16A34A` |
| `PantopusColors.vehicles` | `#DC2626` |

---

## 8. Android spacing tokens

**File:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Spacing.kt`
**Accessor pattern:** `Spacing.s<n>` — `object Spacing {}` holding `val s<n>: Dp`.
**Not** `PantopusSpacing` (that name is a hallucination, see Appendix).

| Symbol | Value |
|---|---|
| `Spacing.s0` | 0 dp |
| `Spacing.s1` | 4 dp |
| `Spacing.s2` | 8 dp |
| `Spacing.s3` | 12 dp |
| `Spacing.s4` | 16 dp |
| `Spacing.s5` | 20 dp |
| `Spacing.s6` | 24 dp |
| `Spacing.s8` | 32 dp |
| `Spacing.s10` | 40 dp |
| `Spacing.s12` | 48 dp |
| `Spacing.s16` | 64 dp |

---

## 9. Android radii tokens

**File:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Radii.kt`
**Accessor pattern:** `Radii.<name>` — `object Radii {}` holding `val <name>: Dp`.

| Symbol | Value |
|---|---|
| `Radii.xs` | 4 dp |
| `Radii.sm` | 6 dp |
| `Radii.md` | 8 dp |
| `Radii.lg` | 12 dp |
| `Radii.xl` | 16 dp |
| `Radii.xl2` | 20 dp |
| `Radii.xl3` | 24 dp |
| `Radii.pill` | 9999 dp |

---

## 10. Android typography

**File:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Typography.kt`
**Public API — two pieces:**

1. **`PantopusTextStyle`** — `object PantopusTextStyle {}` holding pre-built
   `TextStyle` properties. **This is the canonical call site.**
2. **`PantopusTypography`** — Material 3 `Typography` mapping (`Typography(displaySmall =
   PantopusTextStyle.h1, headlineLarge = PantopusTextStyle.h2, …)`) so
   Material widgets (`TextField`, `Button`, `TopAppBar`) inherit Pantopus
   metrics. Wired in `PantopusTheme { }`; not for direct call-site use.

**Canonical call site:**
```kotlin
Text("Welcome", style = PantopusTextStyle.h1)
```

### Roles

| Role | Size | Line height | Weight | letterSpacing | Notes |
|---|---:|---:|---|---|---|
| `PantopusTextStyle.h1` | 30.sp | 36.sp | `Bold` | `(-0.020).em` | |
| `PantopusTextStyle.h2` | 24.sp | 32.sp | `SemiBold` | `(-0.015).em` | |
| `PantopusTextStyle.h3` | 20.sp | 28.sp | `SemiBold` | `0.em` | |
| `PantopusTextStyle.body` | 16.sp | 24.sp | `Normal` | `0.em` | |
| `PantopusTextStyle.small` | 14.sp | 20.sp | `Normal` | `0.em` | |
| `PantopusTextStyle.caption` | 12.sp | 16.sp | `Normal` | `0.em` | |
| `PantopusTextStyle.overline` | 11.sp | 16.sp | `SemiBold` | `0.06.em` | **Caller must pre-upper-case the string** — `TextStyle` cannot force upper-casing at render time. |

`fontFamily` is `FontFamily.Default` for every role.

---

## 11. Android icons

**File:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Icons.kt`
**Public API — two pieces:**

1. **`PantopusIcon`** — `enum class PantopusIcon(val lucideName: String) {}`.
   Cases are **PascalCase** Swift-style identifiers; `lucideName` is the
   original kebab-case Lucide token. Reverse lookup via
   `PantopusIcon.valueOfRaw("chevron-right")`.
2. **`PantopusIconImage`** — `@Composable fun PantopusIconImage(icon, contentDescription, modifier, size, strokeWidth, tint)`.
   The renderer. Feature code MUST call this; direct
   `androidx.compose.material3.Icon { … }` or
   `painterResource(R.drawable.ic_lucide_*)` is rejected by
   `./gradlew verifyPantopusIcons`.

**Canonical call site:**
```kotlin
PantopusIconImage(
    icon = PantopusIcon.ChevronRight,
    contentDescription = null,
    size = 20.dp,
)
```

**`PantopusIconImage` parameters:**

| Parameter | Type | Default |
|---|---|---|
| `icon` | `PantopusIcon` | (required) |
| `contentDescription` | `String?` | (required — pass `null` for decorative) |
| `modifier` | `Modifier` | `Modifier` |
| `size` | `Dp` | `20.dp` |
| `strokeWidth` | `Float` | `2f` (currently a no-op — wired through when we swap to true Lucide SVGs) |
| `tint` | `Color` | `PantopusColors.appText` |

### Enum cases (all)

Casing rule: kebab-case Lucide tokens become **PascalCase** identifiers
(iOS is camelCase). `repeat` collides with Kotlin's `repeat` builtin so it's
renamed `ArrowsRepeat("repeat")` — mirrors the iOS rename. Each case
resolves to a Material `ImageVector` or `ic_lucide_*` drawable via
`internal fun PantopusIcon.source(): IconSource`.

| Case | lucideName | Source (Material vector / drawable) |
|---|---|---|
| `Home` | `home` | `Icons.Filled.Home` |
| `Map` | `map` | `Icons.Filled.Map` |
| `Inbox` | `inbox` | `Icons.Outlined.Inbox` |
| `User` | `user` | `Icons.Filled.Person` |
| `Bell` | `bell` | `Icons.Filled.Notifications` |
| `Menu` | `menu` | `Icons.Filled.Menu` |
| `ShieldCheck` | `shield-check` | `Icons.Filled.GppGood` |
| `X` | `x` | `Icons.Filled.Close` |
| `PlusCircle` | `plus-circle` | `Icons.Filled.AddCircle` |
| `Camera` | `camera` | `Icons.Filled.PhotoCamera` |
| `ScanLine` | `scan-line` | `Icons.Filled.DocumentScanner` |
| `PlusSquare` | `plus-square` | `Icons.Filled.AddBox` |
| `Sun` | `sun` | `Icons.Filled.WbSunny` |
| `SunDim` | `sun-dim` | `Icons.Filled.WbSunny` |
| `ChevronRight` | `chevron-right` | `Icons.Filled.ChevronRight` |
| `ChevronLeft` | `chevron-left` | `Icons.Filled.ChevronLeft` |
| `Megaphone` | `megaphone` | `Icons.Filled.Campaign` |
| `ShoppingBag` | `shopping-bag` | `Icons.Filled.ShoppingBag` |
| `Hammer` | `hammer` | drawable `R.drawable.ic_lucide_hammer` |
| `Mailbox` | `mailbox` | `Icons.Filled.MarkunreadMailbox` |
| `Search` | `search` | `Icons.Filled.Search` |
| `UserPlus` | `user-plus` | `Icons.Filled.PersonAdd` |
| `File` | `file` | `Icons.Filled.InsertDriveFile` |
| `Copy` | `copy` | `Icons.Filled.ContentCopy` |
| `Check` | `check` | `Icons.Filled.Check` |
| `MoreHorizontal` | `more-horizontal` | `Icons.Filled.MoreHoriz` |
| `ArrowLeft` | `arrow-left` | `Icons.AutoMirrored.Filled.ArrowBack` |
| `ArrowRight` | `arrow-right` | `Icons.AutoMirrored.Filled.ArrowForward` |
| `Send` | `send` | `Icons.AutoMirrored.Filled.Send` |
| `ChevronDown` | `chevron-down` | `Icons.Filled.ExpandMore` |
| `ChevronUp` | `chevron-up` | `Icons.Filled.ExpandLess` |
| `Trash2` | `trash-2` | `Icons.Filled.Delete` |
| `Edit2` | `edit-2` | `Icons.Filled.Edit` |
| `Upload` | `upload` | `Icons.Filled.Upload` |
| `Shield` | `shield` | `Icons.Filled.Shield` |
| `Lock` | `lock` | `Icons.Filled.Lock` |
| `CheckCircle` | `check-circle` | `Icons.Filled.CheckCircle` |
| `AlertCircle` | `alert-circle` | `Icons.Filled.Error` |
| `Circle` | `circle` | `Icons.Filled.Circle` |
| `Info` | `info` | `Icons.Filled.Info` |
| `WifiOff` | `wifi-off` | `Icons.Filled.WifiOff` |
| `Heart` | `heart` | `Icons.Filled.Favorite` |
| `ThumbsUp` | `thumbs-up` | `Icons.Filled.ThumbUp` |
| `Star` | `star` | `Icons.Filled.Star` |
| `HelpCircle` | `help-circle` | `Icons.AutoMirrored.Filled.Help` |
| `Calendar` | `calendar` | `Icons.Filled.DateRange` |
| `Lightbulb` | `lightbulb` | `Icons.Filled.Lightbulb` |
| `Eye` | `eye` | `Icons.Filled.Visibility` |
| `Share` | `share` | `Icons.Filled.Share` |
| `Radio` | `radio` | `Icons.Filled.Public` |
| `MapPin` | `map-pin` | `Icons.Filled.LocationOn` |
| `Pencil` | `pencil` | `Icons.Filled.Edit` |
| `Briefcase` | `briefcase` | `Icons.Filled.Work` |
| `Gavel` | `gavel` | `Icons.Filled.Gavel` |
| `SlidersHorizontal` | `sliders-horizontal` | `Icons.Filled.Tune` |
| `MessageCircle` | `message-circle` | `Icons.AutoMirrored.Filled.Chat` |
| `AtSign` | `at-sign` | `Icons.Filled.AlternateEmail` |
| `BadgeCheck` | `badge-check` | `Icons.Filled.VerifiedUser` |
| `Tag` | `tag` | `Icons.Filled.Sell` |
| `ShieldAlert` | `shield-alert` | `Icons.Filled.Warning` |
| `CheckCheck` | `check-check` | `Icons.Filled.DoneAll` |
| `Bookmark` | `bookmark` | `Icons.Filled.Bookmark` |
| `History` | `history` | `Icons.Filled.History` |
| `Receipt` | `receipt` | `Icons.Filled.Receipt` |
| `Clock` | `clock` | `Icons.Filled.Schedule` |
| `Users` | `users` | `Icons.Filled.Group` |
| `DollarSign` | `dollar-sign` | `Icons.Filled.AttachMoney` |
| `Ribbon` | `ribbon` | `Icons.Filled.WorkspacePremium` |
| `Palette` | `palette` | `Icons.Filled.Palette` |
| `PlayCircle` | `play-circle` | `Icons.Filled.PlayCircle` |
| `GripVertical` | `grip-vertical` | `Icons.Filled.DragIndicator` |
| `Grid3x3` | `grid-3x3` | `Icons.Filled.Dashboard` |
| `Square` | `square` | `Icons.Filled.CropSquare` |
| `Dog` | `dog` | `Icons.Filled.Pets` |
| `Cat` | `cat` | `Icons.Filled.Pets` |
| `Bird` | `bird` | `Icons.Filled.Pets` |
| `Fish` | `fish` | `Icons.Filled.Pets` |
| `Turtle` | `turtle` | `Icons.Filled.Pets` |
| `PawPrint` | `paw-print` | `Icons.Filled.Pets` |
| `Sparkles` | `sparkles` | `Icons.Filled.AutoAwesome` |
| `Timer` | `timer` | `Icons.Filled.Timer` |
| `ArrowsRepeat` | `repeat` | `Icons.Filled.Autorenew` |
| `Hourglass` | `hourglass` | `Icons.Filled.HourglassEmpty` |
| `HandCoins` | `hand-coins` | `Icons.Filled.Payments` |
| `Package` | `package` | `Icons.Filled.Inventory2` |
| `Flower` | `flower` | `Icons.Filled.LocalFlorist` |
| `Compass` | `compass` | `Icons.Filled.Explore` |
| `Filter` | `filter` | `Icons.Filled.FilterAlt` |
| `Crown` | `crown` | `Icons.Filled.WorkspacePremium` |
| `TrendingDown` | `trending-down` | `Icons.AutoMirrored.Filled.TrendingDown` |
| `Ban` | `ban` | `Icons.Filled.Block` |
| `FileText` | `file-text` | `Icons.AutoMirrored.Filled.Article` |
| `Plus` | `plus` | `Icons.Filled.Add` |
| `Rocket` | `rocket` | `Icons.Filled.RocketLaunch` |
| `ClipboardList` | `clipboard-list` | `Icons.AutoMirrored.Filled.Assignment` |
| `ClockPlus` | `clock-plus` | `Icons.Filled.MoreTime` |
| `CircleSlash` | `circle-slash` | `Icons.Filled.Block` |
| `Play` | `play` | `Icons.Filled.PlayArrow` |
| `Pause` | `pause` | `Icons.Filled.Pause` |
| `Archive` | `archive` | `Icons.Filled.Archive` |
| `MessageSquarePlus` | `message-square-plus` | `Icons.Filled.BorderColor` |
| `Zap` | `zap` | `Icons.Filled.Bolt` |
| `Flame` | `flame` | `Icons.Filled.LocalFireDepartment` |
| `Droplet` | `droplet` | `Icons.Filled.WaterDrop` |
| `Wifi` | `wifi` | `Icons.Filled.Wifi` |
| `Building2` | `building-2` | `Icons.Filled.Apartment` |
| `Smartphone` | `smartphone` | `Icons.Filled.Smartphone` |
| `Wallet` | `wallet` | `Icons.Filled.AccountBalanceWallet` |
| `Hash` | `hash` | `Icons.Filled.Tag` |
| `Tv` | `tv` | `Icons.Filled.Tv` |
| `Laptop` | `laptop` | `Icons.Filled.Laptop` |
| `Monitor` | `monitor` | `Icons.Filled.DesktopWindows` |
| `Shuffle` | `shuffle` | `Icons.Filled.Shuffle` |
| `WandSparkles` | `wand-sparkles` | `Icons.Filled.AutoFixHigh` |
| `ArrowUpRight` | `arrow-up-right` | `Icons.Filled.NorthEast` |
| `Wrench` | `wrench` | `Icons.Filled.Build` |
| `UsersRound` | `users-round` | `Icons.Filled.Groups` |
| `Gift` | `gift` | `Icons.Filled.CardGiftcard` |
| `PartyPopper` | `party-popper` | `Icons.Filled.Celebration` |
| `GraduationCap` | `graduation-cap` | `Icons.Filled.School` |
| `Stethoscope` | `stethoscope` | `Icons.Filled.MedicalServices` |
| `CalendarDays` | `calendar-days` | `Icons.Filled.CalendarMonth` |
| `Link` | `link` | `Icons.Filled.Link` |
| `Pin` | `pin` | `Icons.Filled.PushPin` |
| `Power` | `power` | `Icons.Filled.PowerSettingsNew` |
| `PhoneCall` | `phone-call` | `Icons.Filled.Call` |
| `Phone` | `phone` | `Icons.Filled.Phone` |
| `Navigation` | `navigation` | `Icons.Filled.Navigation` |
| `HeartPulse` | `heart-pulse` | `Icons.Filled.MonitorHeart` |
| `Siren` | `siren` | `Icons.Filled.EmergencyShare` |
| `Cross` | `cross` | `Icons.Filled.Healing` |
| `Flag` | `flag` | `Icons.Filled.Flag` |
| `UserRound` | `user-round` | `Icons.Filled.PersonPin` |
| `FlaskConical` | `flask-conical` | `Icons.Filled.Science` |
| `FlameKindling` | `flame-kindling` | `Icons.Filled.Whatshot` |
| `Printer` | `printer` | `Icons.Filled.Print` |
| `ListChecks` | `list-checks` | `Icons.Filled.Checklist` |
| `AlertTriangle` | `alert-triangle` | `Icons.Filled.Warning` |
| `Image` | `image` | `Icons.Filled.Image` |
| `FileType` | `file-type` | `Icons.Filled.InsertDriveFile` |
| `FileSpreadsheet` | `file-spreadsheet` | `Icons.Filled.TableChart` |
| `FileSignature` | `file-signature` | `Icons.Filled.PictureAsPdf` |
| `Landmark` | `landmark` | `Icons.Filled.AccountBalance` |
| `Stamp` | `stamp` | `Icons.Filled.Approval` |
| `IdCard` | `id-card` | `Icons.Filled.Badge` |
| `FolderLock` | `folder-lock` | `Icons.Filled.FolderShared` |
| `UploadCloud` | `upload-cloud` | `Icons.Filled.CloudUpload` |
| `CalendarClock` | `calendar-clock` | `Icons.Filled.EditCalendar` |
| `Download` | `download` | `Icons.Filled.Download` |
| `EyeOff` | `eye-off` | `Icons.Filled.VisibilityOff` |
| `KeyRound` | `key-round` | `Icons.Filled.VpnKey` |
| `Leaf` | `leaf` | `Icons.Filled.EnergySavingsLeaf` |
| `Utensils` | `utensils` | `Icons.Filled.Restaurant` |
| `Baby` | `baby` | `Icons.Filled.ChildCare` |
| `Fan` | `fan` | `Icons.Filled.Air` |
| `CloudRain` | `cloud-rain` | `Icons.Filled.Grain` |
| `Snowflake` | `snowflake` | `Icons.Filled.AcUnit` |
| `Wind` | `wind` | `Icons.Filled.Air` |
| `Bus` | `bus` | `Icons.Filled.DirectionsBus` |
| `Droplets` | `droplets` | `Icons.Filled.WaterDrop` |
| `Refrigerator` | `refrigerator` | `Icons.Filled.Kitchen` |
| `Bug` | `bug` | `Icons.Filled.PestControl` |
| `Trees` | `trees` | `Icons.Filled.Park` |
| `PaintRoller` | `paint-roller` | `Icons.Filled.FormatPaint` |
| `BellRing` | `bell-ring` | `Icons.Filled.NotificationsActive` |
| `Mail` | `mail` | `Icons.Filled.Email` |
| `MailOpen` | `mail-open` | `Icons.Filled.MarkAsUnread` |
| `FolderPlus` | `folder-plus` | `Icons.Filled.CreateNewFolder` |
| `PiggyBank` | `piggy-bank` | `Icons.Filled.Savings` |
| `Plane` | `plane` | `Icons.Filled.Flight` |
| `ReceiptText` | `receipt-text` | `Icons.Filled.Description` |
| `Paperclip` | `paperclip` | `Icons.Filled.AttachFile` |
| `ArrowDownUp` | `arrow-down-up` | `Icons.Filled.Sort` |
| `Video` | `video` | `Icons.Filled.Videocam` |
| `MoreVertical` | `more-vertical` | `Icons.Filled.MoreVert` |
| `Hand` | `hand` | `Icons.Filled.PanTool` |
| `Smile` | `smile` | `Icons.Filled.InsertEmoticon` |
| `ArrowUp` | `arrow-up` | `Icons.Filled.ArrowUpward` |
| `Reply` | `reply` | `Icons.AutoMirrored.Filled.Reply` |
| `RadioTower` | `radio-tower` | `Icons.Filled.Podcasts` |
| `MessageSquare` | `message-square` | `Icons.AutoMirrored.Filled.Message` |
| `Globe` | `globe` | `Icons.Filled.Public` |
| `ExternalLink` | `external-link` | `Icons.Filled.OpenInNew` |
| `RefreshCw` | `refresh-cw` | `Icons.Filled.Refresh` |
| `DoorOpen` | `door-open` | `Icons.Filled.MeetingRoom` |
| `Car` | `car` | `Icons.Filled.DirectionsCar` |
| `Warehouse` | `warehouse` | `Icons.Filled.Warehouse` |
| `Bot` | `bot` | `Icons.Filled.SmartToy` |

---

## 12. Android `LocalPantopus` composition

**File:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/LocalPantopus.kt`

**What's actually bound via `CompositionLocal`:**

```kotlin
val LocalPantopusTokens = staticCompositionLocalOf<PantopusTokens> { error(…) }
```

`PantopusTokens` is a `data class` holding **only the subset of design
tokens that don't fit cleanly elsewhere** — identity pillars, category
accents, elevation, and a `TextStyle` ramp echo:

```kotlin
data class PantopusTokens(
    val identity: IdentityColors,       // personal/personalBg/home/homeBg/business/businessBg
    val category: CategoryColors,       // handyman/cleaning/moving/petCare/childCare/tutoring/delivery/tech/goods/gigs/rentals/vehicles
    val elevation: ElevationTokens,     // sm/md/lg/xl/primary  (PantopusElevation refs)
    val textStyle: TextStyleTokens,     // h1/h2/h3/body/small/caption/overline  (TextStyle refs)
)
```

The CompositionLocal is provided by the `PantopusTheme { … }` composable
(in `Theme.kt`) and accessed through:

```kotlin
object PantopusTheme {
    val tokens: PantopusTokens
        @Composable @ReadOnlyComposable
        get() = LocalPantopusTokens.current
}
// usage (themed path):
PantopusTheme.tokens.identity.personal
PantopusTheme.tokens.category.handyman
```

**Is the themed path canonical?** **No — the flat `object` accessors are the
sole pattern feature code uses.** Counted across
`ui/screens/**`:

| Pattern | Usage count |
|---|---:|
| `PantopusColors.<token>` | **6201** |
| `Spacing.s<n>` | **2423** |
| `Radii.<name>` | **1340** |
| `PantopusTextStyle.<role>` | **1072** |
| `PantopusElevations.<name>` | 27 |
| `PantopusTheme.tokens.<…>` | **0** |
| `LocalPantopusTokens.current.<…>` | **0** |

> **Canonical accessor decision.** Use the flat `object` form
> (`PantopusColors.primary600`, `Spacing.s4`, `Radii.md`,
> `PantopusTextStyle.h1`, `PantopusElevations.md`). Reach for the
> CompositionLocal path *only* if you genuinely need to read tokens
> reactively (you don't — they're static for the app's lifetime), or if a
> future dark-mode swap moves real palette entries onto `LocalPantopusTokens`.
> Today, treat `PantopusTheme.tokens.*` as **vestigial**.

The `PantopusTheme { … }` composable itself **is** required as the root of
any composable subtree (it provides the Material 3 `ColorScheme` + the
`PantopusTypography` mapping + the `LocalPantopusTokens` CompositionLocal).
Don't strip the wrapper just because feature code doesn't read from
`tokens`.

---

## Appendix — Common drift mistakes

Patterns that have appeared in prompt drafts or early reviews but are
**wrong**. Verified zero occurrences in current code via `grep`.

| Wrong | Right | Notes |
|---|---|---|
| `PantopusSpacing.s4` (Android) | `Spacing.s4` | The object is named `Spacing`. `PantopusSpacing` is a hallucination — never existed. |
| `PantopusRadii.md` (Android) | `Radii.md` | Same — the object is `Radii`, not `PantopusRadii`. |
| `Color.pantopus.primary600` (iOS) | `Theme.Color.primary600` | There is no `Color.pantopus` static; the namespace is `Theme.Color`. |
| `Font.pantopus.h1` (iOS) | `Theme.Font.h1` *or* `.pantopusTextStyle(.h1)` on `Text` | The Font extension lives on `Theme.Font`; the canonical call-site form is the view modifier. |
| `Theme.Spacing.s4` (iOS) | `Spacing.s4` | `Spacing` is a top-level enum, not nested under `Theme`. |
| `Theme.Radii.xl` (iOS) | `Radii.xl` | `Radii` is a top-level enum, not nested under `Theme`. |
| `Spacing.large` / `Spacing.medium` (both) | `Spacing.s4` / `Spacing.s6` / etc. | The ramp uses numeric `s<n>` names — no semantic `small/medium/large` aliases exist. |
| `Radii.large` (both) | `Radii.lg` | T-shirt names are short: `xs/sm/md/lg/xl/xl2/xl3/pill`. |
| `LocalPantopus.current.color.primary600` (Android) | `PantopusColors.primary600` | `LocalPantopusTokens` (the actual CompositionLocal name) holds only `identity` / `category` / `elevation` / `textStyle` — not the primary palette. Flat object access is canonical. |
| `PantopusTheme.tokens.color.primary600` (Android) | `PantopusColors.primary600` | Same — `tokens.color` doesn't exist; the palette lives on `PantopusColors`. |
| `MaterialTheme.colorScheme.primary` for brand color (Android) | `PantopusColors.primary600` | Material's color scheme is wired but **not** the source of truth for brand color. Always reach for `PantopusColors`. |
| `Image(systemName: "chevron.right")` (iOS) | `Icon(.chevronRight)` | Direct SF Symbol calls in feature code are rejected by `make verify-icons`. |
| `Icons.Filled.ChevronRight` directly (Android) | `PantopusIconImage(icon = PantopusIcon.ChevronRight, …)` | Direct Material icon use is rejected by `./gradlew verifyPantopusIcons`. |
| `painterResource(R.drawable.ic_lucide_hammer)` directly (Android) | `PantopusIconImage(icon = PantopusIcon.Hammer, …)` | Same — go through the renderer. |
| `PantopusIcon.chevronRight` (Android, lowercase) | `PantopusIcon.ChevronRight` | Android cases are **PascalCase**; iOS cases are **camelCase**. They look the same most of the time except for the leading character. |
| `Color(0xFF0284C7)` literal in feature code (both) | `PantopusColors.primary600` (Android) / `Theme.Color.primary600` (iOS) | Hex literals outside the Colors token file trip the CI hex-grep guard. |
| `.dp` on a raw literal inside a screen composable (Android) | `Spacing.s4` | The CI hex/dp guard rejects `Modifier.padding(16.dp)` — use `Modifier.padding(Spacing.s4)`. |
