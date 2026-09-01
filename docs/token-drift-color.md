# P7.1 — Color literal drift audit

> **Generated:** 2026-05-26. **Tokens cited from:** `docs/token-conventions.md`.
>
> Two-pass color audit per P7.1. Every literal that appears in feature
> code (outside the design system) is listed below with its visual role
> at the call site and a remediation:
>
> - **MAP-CLEANLY → token** — bit-exact hex match for a documented token.
>   Replaced in Pass 2.
> - **DESIGN REVIEW** — bespoke palette value with no canonical token
>   counterpart, or a near-miss requiring a design call. Left untouched in
>   code; design owns the decision (new token? collapse to existing? keep
>   bespoke?).
>
> Counts are line-occurrences; a single line can carry multiple literals
> (e.g. a gradient stop pair) — those are listed together.

## Methodology

Searches scoped per the P7.1 prompt:

- **iOS:** `frontend/apps/ios/Pantopus/Features/`,
  `frontend/apps/ios/Pantopus/Core/Design/Components/`,
  `frontend/apps/ios/Pantopus/App/`. Excluded: `Core/Design/Colors.swift`,
  `Resources/Assets.xcassets/`.
- **Android:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`,
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/`.
  Excluded: `ui/theme/Color.kt`.

**Patterns searched:**

- iOS: `Color(red:`, `Color(hex:`, `Color(0x`, `UIColor(red:`,
  `#colorLiteral`, bare `#RRGGBB`.
- Android: `Color(0xRRGGBBAA)`, `Color.parse(`, bare `#RRGGBB`.

**Post-Wave-D coverage check.** The audit walked every Wave A–D feature
folder. Files appearing below include `Membership/`,
`IdentityCenter/`, `Mailbox/MailboxMap/`, `Mailbox/MailDetail/`,
`Homes/Bills/`, `Homes/Calendar/`, `Homes/Polls/`, `Homes/Maintenance/`,
`Homes/Packages/`, `Homes/Tasks/`, `Homes/AccessCodes/`,
`Homes/Emergency/`, `Homes/Documents/`, `Compose/ListingCompose/`,
`Marketplace/`, `Shared/MapListHybrid/`, `Shared/MailItemDetail/`,
`Nearby/`, `CeremonialMailOpen/`, `Gigs/`, plus Android parallels — well
above the 8-folder threshold the prompt calls out.

## Summary

| Disposition | iOS hits | Android hits |
|---|---:|---:|
| MAP-CLEANLY → token (applied Pass 2) | **2 lines / 2 literals** | **2 lines / 2 literals** |
| DESIGN REVIEW (palette / bespoke surface / drift) | 310 lines | 287 lines |

iOS "DESIGN REVIEW" line count includes 2 bare-hex matches inside doc
comments in `Core/Design/Components/Shimmer.swift` (`// #eef0f3` and
`// #f6f7f9` — describing the actual `Color(red:)` value on the same
line). These are documentation, not separate literals; the unique
literal count is 308.

The clean replacements are both the `#D1D5DB` neutral that appears in
`Nearby` as the inactive bottom-sheet drag handle and inactive pagination
dot — a generic neutral, **not** a category swatch, so it maps directly
to `appBorderStrong`.

Everything else falls into one of four buckets that are out of scope for
mechanical token replacement:

1. **Category-accent palettes** (`*CategoryPalette.{swift,kt}`,
   `*Category.{swift,kt}`, `*Palette.{swift,kt}`) — files whose entire
   purpose is to centralise a per-row swatch the design pack ships as
   bespoke. Per `CLAUDE.md`: *"Listing/category accents that need a per-row
   swatch live on the category enum itself."*
2. **Bespoke "physical-object" surfaces** — `CeremonialMailOpen/*`
   (envelope stationery / wax seal / gold ribbon),
   `Mailbox/MailDetail/Components/CertifiedStamp*` (stamp ink),
   `Compose/ListingCompose/ListingComposePhoto*` (dark camera UI), etc.
   These render skeuomorphic chrome with palettes that don't belong in the
   product-wide token namespace.
3. **Drift from canonical tokens** — `Gigs/GigsCategory` and its
   Android twin use a *different* category palette than the canonical
   `Theme.Color.{handyman,cleaning,…}` tokens. Surfacing as design call:
   reconcile to one palette, or keep both with clear naming.
4. **Shimmer base/highlight pair** — `Shimmer.{swift,kt}` paints a
   2-stop animation gradient (`#EEF0F3` ↔ `#F6F7F9`). The highlight
   stop matches `appBg`, but the base does not, and replacing one half of
   a paired animation gradient with a token while the other stays bespoke
   would create a confusing mixed reference.

---

## MAP-CLEANLY (applied in Pass 2)

### iOS

| File | Line | Literal | Visual role | Replacement |
|---|---:|---|---|---|
| `Features/Nearby/NearbyMapView.swift` | 262 | `Color(red: 209/255, green: 213/255, blue: 219/255)` (= `#D1D5DB`) | `.fill(...)` on the **bottom-sheet drag-handle Capsule** (40 × 4 pt) at the top of the discover bottom sheet. Generic neutral handle, no category meaning. | `Theme.Color.appBorderStrong` |
| `Features/Nearby/NearbyMapView.swift` | 698 | `Color(red: 209/255, green: 213/255, blue: 219/255)` (= `#D1D5DB`) | `.fill(...)` for the **inactive pagination dot** inside `PaginationDots` (active dot is `Theme.Color.primary600` on the same line). | `Theme.Color.appBorderStrong` |

### Android

| File | Line | Literal | Visual role | Replacement |
|---|---:|---|---|---|
| `ui/screens/nearby/map/NearbyMapScreen.kt` | 728 | `Color(0xFFD1D5DB)` | `.background(...)` on the **bottom-sheet drag-handle Box** (40 × 4 dp). Same handle as iOS line 262. | `PantopusColors.appBorderStrong` |
| `ui/screens/nearby/map/NearbyMapScreen.kt` | 1149 | `Color(0xFFD1D5DB)` | `.background(...)` for the **inactive pagination dot** inside the `PaginationDots` composable (active dot is `PantopusColors.primary600` on the same line). | `PantopusColors.appBorderStrong` |

---

## DESIGN REVIEW

The remaining hits group by file. Each entry below has the file path,
literal-count, visual role at call site, and a proposed remediation
direction. Code is **not** edited for any of these — design decides.

### iOS — palette modules (intentional bespoke, file exists to centralise)

These files are isolated palette tables. The literals are intentional and
match the design pack's per-category swatches. Each row of the enum maps
its case to a `background` + `foreground` (and sometimes `border`) Color.
None of the hex values are bit-exact for a `Theme.Color.*` token, so
auto-replacement would change rendered output.

| File | Hits | Role at call site | Proposal |
|---|---:|---|---|
| `Features/Homes/Documents/DocumentFileTypePalette.swift` | 12 | Per-file-type leading-tile background + foreground (pdf / image / doc / sheet / archive / scan). | Keep bespoke. Optional follow-up: register the 12 palette pairs as a `DocumentTypePalette` design token group if design wants them in the core file. |
| `Features/Homes/Documents/DocumentCategoryPalette.swift` | 16 | Per-document-category tile palette (lease / insurance / warranty / tax / permit / hoa / id / generic). | Same — bespoke palette, register if design wants formal tokens. |
| `Features/Homes/Calendar/CalendarEventCategory.swift` | 26 | Per-event-type palette (chore / maintenance / delivery / family / birthday / social / school / pet / bill / medical / trash / generic). | Same. |
| `Features/Homes/Emergency/EmergencyCategoryPalette.swift` | 8 | Per-emergency-type palette (shutoff / contact / evac / medical). | Same. |
| `Features/Homes/AccessCodes/AccessCategoryPalette.swift` | 12 | Per-access-type palette (wifi / alarm / gate / lockbox / garage / smartLock). | Same. |
| `Features/Homes/Bills/UtilityCategoryPalette.swift` | 18 | Per-utility palette (electric / gas / water / internet / hoa / insurance / trash / phone / generic). | Same. |
| `Features/Homes/Polls/PollKindPalette.swift` | 10 | Per-poll-kind palette + default neutral fallback. | Same. |
| `Features/Homes/Maintenance/MaintenanceCategoryPalette.swift` | 26 | Per-maintenance-category palette (hvac / plumbing / electrical / roof / gutter / appliance / pest / landscape / cleaning / painting / safety / chimney / generic). | Same. |
| `Features/Homes/Packages/CourierPalette.swift` | 16 | Per-courier-brand palette (Amazon / UPS / USPS / FedEx / DHL / OnTrac / Local / Generic). | Same — courier brand colors are not tokens. |
| `Features/Homes/Tasks/HouseholdTaskCategoryPalette.swift` | 18 | Per-household-task-category palette (cleaning / trash / kitchen / laundry / yard / pet / errand / kids / other). | Same. |
| `Features/Shared/MailItemDetail/MailItemDetailShell.swift` | 18 | Status-pill palette (variants: red / blue / pink / lavender / neutral). Renders 5 chips with background + foreground + border per variant. | Bespoke status-pill palette — register as token group if design wants. |
| `Features/Mailbox/MailboxMap/MailboxSpotKind.swift` | 5 | Per-mailbox-spot pin palette (post / drop / locker / carrier / civic). | Same. |
| `Features/Gigs/GigsCategory.swift` | 8 | Per-gig-category accent color (handyman / cleaning / moving / petcare / childcare / tutoring / tech / delivery). **Drift:** these don't match the canonical `Theme.Color.{handyman,cleaning,…}` tokens. | **Reconcile.** Option A: switch this file to the canonical tokens. Option B: rename the canonical tokens to match. Option C: name the second palette explicitly (`GigsPalette`). Design call. |
| `Features/Shared/MapListHybrid/MapListHybridPreview.swift` | 17 | Preview-only fixture data; mirrors the `GigsCategory` palette drift (same hex values). | Auto-fix when `GigsCategory` is reconciled. |
| `Features/Marketplace/MarketplaceContent.swift` | 6 (gradient pairs) | `ListingGradient` fixture data — six 2-stop gradients used for empty/placeholder listing cards. | Bespoke gradient palette. Register if design wants. |
| `Features/Membership/MembershipDetailContent.swift` | 6 | Bronze / Silver / Gold tier background + foreground pair. | Bespoke tier palette. Register `MembershipTierPalette` token group if design wants. |
| `Features/IdentityCenter/IdentityCenterContent.swift` | 2 | `publicProfile` accent + background — uses pink `#DB2777` / `#FCE7F3`. No pink token exists in `Theme.Color`. | Either add `pink` / `pinkBg` tokens, or pick an existing identity-pillar accent. |

### iOS — bespoke "physical object" surfaces

These render skeuomorphic chrome (paper envelopes, wax seals, dark camera
UI, certified-mail stamps). The palette is intentional and not part of the
product-wide token palette.

| File | Hits | Role at call site | Proposal |
|---|---:|---|---|
| `Features/CeremonialMailOpen/CeremonialMailOpenContent.swift` | 47 | Envelope / paper / wax / accent colors per stationery theme (classicCream / midnightBlue / linen / botanical / fall / winter / spring / summer / evergreen) and per wax color (waxRed / waxBlue / waxBlack / fall / winter / spring / summer / evergreen). | Keep bespoke. Optionally register `StationeryPalette` and `WaxPalette` token groups; design call. |
| `Features/CeremonialMailOpen/CeremonialMailOpenView.swift` | 16 | Gold gradient (envelope ribbon), parchment paper, dark text on parchment — used in the ceremonial open animation. | Keep bespoke. |
| `Features/Mailbox/MailDetail/Components/CertifiedStampBadge.swift` | 2 | `#7B2D0E` — certified-mail stamp ink. | Keep bespoke (single "stamp ink" hue). |
| `Features/Mailbox/MailDetail/Components/CombinedSenderCarrierCard.swift` | 1 | Same `#7B2D0E` stamp-ink hue. | Keep bespoke; same swatch as `CertifiedStampBadge`. |
| `Features/Compose/ListingCompose/ListingComposePhotoStep.swift` | 12 | Dark "snap-and-sell" camera UI: black background `(0.04, 0.04, 0.05)`, AI sage-green capture-shutter ring, lavender FAB. | Keep bespoke. Possible token additions: `cameraBg`, `magicShutter`. Design call. |
| `Features/Compose/ListingCompose/SuggestionsBanner.swift` | 12 | "AI suggestion" banner — magic lavender accent. Several literals are near-matches of `magic` / `magicBg` / `magicBorder` tokens but offset by float-rounding (e.g. `Color(red: 0.49, green: 0.23, blue: 0.93)` ≈ `#7D3BED` vs `magic = #6D28D9`). | Reconcile: snap to existing `magic` / `magicBg` / `magicBorder` / `magicBgSoft` tokens, OR add a second `magicAccent` token for the off-by-1 value. |
| `Core/Design/Components/Shimmer.swift` | 2 | `base` (`#EEF0F3`) + `highlight` (`#F6F7F9`) of the shimmer animation gradient. The highlight matches `appBg`, but the base does not. | Reconcile as a pair: either both stay bespoke or both become tokens (e.g. add `shimmerBase` / `shimmerHighlight`). Replacing only one breaks the paired gradient. |

### Android — palette modules

Same files, same roles, same bespoke status as iOS:

| File | Hits |
|---|---:|
| `ui/screens/homes/documents/DocumentFileTypePalette.kt` | 12 |
| `ui/screens/homes/documents/DocumentCategoryPalette.kt` | 14 |
| `ui/screens/homes/calendar/CalendarEventCategory.kt` | 24 |
| `ui/screens/homes/emergency/EmergencyCategoryPalette.kt` | 8 |
| `ui/screens/homes/accesscodes/AccessCategoryPalette.kt` | 12 |
| `ui/screens/homes/bills/UtilityCategoryPalette.kt` | 18 |
| `ui/screens/homes/polls/PollKindPalette.kt` | 10 |
| `ui/screens/homes/maintenance/MaintenanceCategoryPalette.kt` | 26 |
| `ui/screens/homes/packages/CourierPalette.kt` | 16 |
| `ui/screens/homes/tasks/HouseholdTaskCategoryPalette.kt` | 18 |
| `ui/screens/shared/mail_item_detail/MailItemDetailShell.kt` | 18 |
| `ui/screens/mailbox/mailbox_map/MailboxSpotKind.kt` | 5 |
| `ui/screens/gigs/GigsContent.kt` | 9 (drift from canonical category tokens — same as iOS `GigsCategory`) |
| `ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt` | 7 (preview palette + 1 bespoke bg `#E8EDF2`) |
| `ui/screens/marketplace/MarketplaceContent.kt` | 6 (gradient pairs) |
| `ui/screens/membership/MembershipDetailContent.kt` | 6 (tier palette) |
| `ui/screens/identity_center/IdentityCenterContent.kt` | 2 (publicProfile pink) |

### Android — bespoke surfaces

| File | Hits | Role |
|---|---:|---|
| `ui/screens/ceremonial_mail_open/CeremonialMailOpenContent.kt` | 57 | Per-stationery-theme palette + per-wax-color palette + ivory accent. Mirror of iOS. |
| `ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt` | 14 | Gold ribbon, parchment paper, dark text. Mirror of iOS. |
| `ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt` | 1 | `#7B2D0E` certified-mail stamp ink (= `private val StampInk`). |
| `ui/screens/compose/listing/ListingComposeWizardScreen.kt` | 15 | Dark "snap-and-sell" camera UI (black bg `#0A0B0D`, sage-green capture, lavender FAB, off-axis greens). |
| `ui/components/Shimmer.kt` | 2 | `ShimmerBase` (`#EEF0F3`) + `ShimmerHighlight` (`#F6F7F9`). Same paired-gradient case as iOS. |

---

## Pass 2 verification

After Pass 2, re-run the same greps with the same scope:

```bash
grep -rnE "Color\(red:|Color\(hex:|Color\(0x|UIColor\(red:|#colorLiteral" \
  frontend/apps/ios/Pantopus/Features/ \
  frontend/apps/ios/Pantopus/Core/Design/Components/ \
  frontend/apps/ios/Pantopus/App/ --include="*.swift" | wc -l
grep -rnE "Color\(0x[0-9A-Fa-f]+\)|Color\.parse" \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/ \
  --include="*.kt" | wc -l
```

Expected remaining counts after Pass 2 (matching exact pre-counts minus
the four `#D1D5DB` lines that were replaced):

- iOS: **310 lines** = pre-count 312 − 2 replaced. Includes 2 bare-hex
  comment matches in `Shimmer.swift` that re-describe the literal on the
  same line; unique color literals = 308.
- Android: **287 lines** = pre-count 289 − 2 replaced.

Snapshot tests must continue to pass; the only code-affecting change is
the four `#D1D5DB` → `appBorderStrong` swaps, which render identically.
