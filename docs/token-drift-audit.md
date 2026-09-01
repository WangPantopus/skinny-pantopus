# Token & style drift audit

> **Read-only audit.** Every finding lists the offending value, the file
> path + line number, and the canonical token to use instead (or `NEEDS
> DESIGN REVIEW` when no token maps). Generated 2026-05-18; do NOT take
> remediation action from this doc alone — it surfaces the data for
> downstream P1+ fix passes.

## Methodology

Searches scoped to feature code only; design-system source files, tests,
and DEBUG-only gallery views are excluded.

**iOS scope:** `frontend/apps/ios/Pantopus/Features/**` excluding
`_Internal/` (debug galleries) and `PantopusTests/`. Token sources at
`Core/Design/{Spacing,Radii,Typography,Colors}.swift`.

**Android scope:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/**`
excluding `ui/theme/**` (token sources) and `app/src/{test,androidTest}/`.

### Canonical token scale (the only allowed values)

| Category | Allowed values | iOS namespace | Android namespace |
|---|---|---|---|
| Spacing (pt/dp) | `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64` | `Spacing.s0 … s16` | `Spacing.s0 … s16` |
| Radii (pt/dp) | `4, 6, 8, 12, 16, 20, 24, 9999` | `Radii.xs / sm / md / lg / xl / xl2 / xl3 / pill` | `Radii.xs / sm / md / lg / xl / xl2 / xl3 / pill` |
| Font sizes (pt/sp) | `30, 24, 20, 16, 14, 12, 11` | `PantopusTextStyle.h1 / h2 / h3 / body / small / caption / overline` | `PantopusTextStyle.h1 / h2 / h3 / body / small / caption / overline` |

**Allowed exceptions per `frontend/apps/{ios,android}/CLAUDE.md`:**

- *Category-accent palettes* (`*CategoryPalette.{swift,kt}`, `GigsCategory.{swift,kt}` etc.) — per-row swatches live on the enum.
- *Width/height literals for fixed-geometry shapes* (a 22 dp pin dot, a 36 pt badge, etc.) — listed below in Section E for review, not flagged as hard drift.
- *Shimmer gradient stops* (`Shimmer.kt`) — opacity gradient values.

## Summary

| Category | iOS | Android |
|---|---:|---:|
| **A. Hex colors** — NEEDS DESIGN REVIEW | 117 in 9 files | 111 in 8 files |
| A. Hex colors — ALLOWED EXCEPTIONS (palettes/shimmer) | 158 in 11 files | 163 in 12 files |
| **B. Off-scale spacing** | 20 in 11 files | 327 in 49 files |
| **C. Off-scale radii** | 95 in 21 files | 117 in 22 files |
| **D. Off-scale fonts** | 354 in 46 files | 362 in 44 files |
| E. Frame width/height literals (informational) | 487 in 80+ files | 202 in 60+ files |

**Hot spots** (one file owns >10% of a platform's drift in any category):

- iOS — `CeremonialMailOpen/CeremonialMailOpenView.swift`: 16 hex literals + ~50 frame literals + dense font drift (heavy bespoke animation surface; will likely need a design-token extension).
- iOS — `AudienceProfile/AudienceProfileView.swift` + `ContentDetail/TransactionalDetailShell.swift` + `Shared/ListOfRows/ListOfRowsView.swift`: heavy radii + font drift inside shared shells.
- Android — `screens/audience_profile/AudienceProfileScreen.kt` + `screens/contentdetail/ContentDetailShell.kt` + `screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt`: highest combined drift counts.

---

# iOS

## A. iOS — Hex color literals

**Summary:** 117 hex literals across 9 files NEED DESIGN REVIEW. An additional 158 hex literals across 11 files are ALLOWED EXCEPTIONS (category-accent palettes per the platform CLAUDE.md).

#### NEEDS DESIGN REVIEW


**`frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenContent.swift`** (47 matches):
- L56: `case .classicCream: Color(red: 248 / 255, green: 240 / 255, blue: 222 / 255)` → NEEDS DESIGN REVIEW
- L57: `case .midnightBlue: Color(red: 224 / 255, green: 228 / 255, blue: 240 / 255)` → NEEDS DESIGN REVIEW
- L58: `case .linen: Color(red: 250 / 255, green: 247 / 255, blue: 240 / 255)` → NEEDS DESIGN REVIEW
- L59: `case .botanical: Color(red: 235 / 255, green: 244 / 255, blue: 232 / 255)` → NEEDS DESIGN REVIEW
- L60: `case .fall: Color(red: 240 / 255, green: 226 / 255, blue: 196 / 255)` → NEEDS DESIGN REVIEW
- L61: `case .winter: Color(red: 236 / 255, green: 233 / 255, blue: 226 / 255)` → NEEDS DESIGN REVIEW
- L62: `case .spring: Color(red: 244 / 255, green: 239 / 255, blue: 220 / 255)` → NEEDS DESIGN REVIEW
- L63: `case .summer: Color(red: 246 / 255, green: 230 / 255, blue: 211 / 255)` → NEEDS DESIGN REVIEW
- L64: `case .evergreen: Color(red: 31 / 255, green: 46 / 255, blue: 38 / 255)` → NEEDS DESIGN REVIEW
- L71: `case .classicCream: Color(red: 220 / 255, green: 210 / 255, blue: 188 / 255)` → NEEDS DESIGN REVIEW
- L72: `case .midnightBlue: Color(red: 200 / 255, green: 206 / 255, blue: 224 / 255)` → NEEDS DESIGN REVIEW
- L73: `case .linen: Color(red: 226 / 255, green: 220 / 255, blue: 206 / 255)` → NEEDS DESIGN REVIEW
- L74: `case .botanical: Color(red: 208 / 255, green: 222 / 255, blue: 204 / 255)` → NEEDS DESIGN REVIEW
- L75: `case .fall: Color(red: 217 / 255, green: 196 / 255, blue: 154 / 255)` → NEEDS DESIGN REVIEW
- L76: `case .winter: Color(red: 211 / 255, green: 207 / 255, blue: 198 / 255)` → NEEDS DESIGN REVIEW
- L77: `case .spring: Color(red: 218 / 255, green: 211 / 255, blue: 184 / 255)` → NEEDS DESIGN REVIEW
- L78: `case .summer: Color(red: 222 / 255, green: 203 / 255, blue: 180 / 255)` → NEEDS DESIGN REVIEW
- L79: `case .evergreen: Color(red: 15 / 255, green: 25 / 255, blue: 20 / 255)` → NEEDS DESIGN REVIEW
- L91: `case .fall: Color(red: 244 / 255, green: 201 / 255, blue: 127 / 255)` → NEEDS DESIGN REVIEW
- L92: `case .winter: Color(red: 195 / 255, green: 212 / 255, blue: 226 / 255)` → NEEDS DESIGN REVIEW
- L93: `case .spring: Color(red: 196 / 255, green: 226 / 255, blue: 178 / 255)` → NEEDS DESIGN REVIEW
- L94: `case .summer: Color(red: 244 / 255, green: 196 / 255, blue: 134 / 255)` → NEEDS DESIGN REVIEW
- L95: `case .evergreen: Color(red: 60 / 255, green: 82 / 255, blue: 68 / 255)` → NEEDS DESIGN REVIEW
- L96: `case .midnightBlue: Color(red: 80 / 255, green: 100 / 255, blue: 150 / 255)` → NEEDS DESIGN REVIEW
- L97: `case .linen, .botanical, .classicCream: Color(red: 230 / 255, green: 210 / 255, blue: 180 / 255)` → NEEDS DESIGN REVIEW
- L103: `case .fall: Color(red: 111 / 255, green: 52 / 255, blue: 57 / 255)` → NEEDS DESIGN REVIEW
- L104: `case .winter: Color(red: 56 / 255, green: 70 / 255, blue: 90 / 255)` → NEEDS DESIGN REVIEW
- L105: `case .spring: Color(red: 86 / 255, green: 124 / 255, blue: 78 / 255)` → NEEDS DESIGN REVIEW
- L106: `case .summer: Color(red: 138 / 255, green: 70 / 255, blue: 55 / 255)` → NEEDS DESIGN REVIEW
- L107: `case .evergreen: Color(red: 18 / 255, green: 30 / 255, blue: 24 / 255)` → NEEDS DESIGN REVIEW
- _…17 more in this file_

**`frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenView.swift`** (16 matches):
- L327: `Color(red: 1, green: 0.89, blue: 0.63).opacity(0.55 * glowOpacity),` → NEEDS DESIGN REVIEW
- L328: `Color(red: 1, green: 0.69, blue: 0.42).opacity(0.18 * glowOpacity),` → NEEDS DESIGN REVIEW
- L383: `.fill(Color(red: 250 / 255, green: 239 / 255, blue: 215 / 255))` → NEEDS DESIGN REVIEW
- L390: `.fill(Color(red: 60 / 255, green: 40 / 255, blue: 20 / 255).opacity(0.25))` → NEEDS DESIGN REVIEW
- L426: `Color(red: 194 / 255, green: 146 / 255, blue: 48 / 255),` → NEEDS DESIGN REVIEW
- L427: `Color(red: 122 / 255, green: 79 / 255, blue: 27 / 255)` → NEEDS DESIGN REVIEW
- L442: `.overlay(Circle().stroke(Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255), lineWidth: 2))` → NEEDS DESIGN REVIEW
- L448: `.foregroundColor(Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255))` → NEEDS DESIGN REVIEW
- L452: `.foregroundStyle(Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255).opacity(0.85))` → NEEDS DESIGN REVIEW
- L472: `.foregroundColor(Color(red: 42 / 255, green: 31 / 255, blue: 10 / 255))` → NEEDS DESIGN REVIEW
- L473: `Icon(.chevronRight, size: 14, color: Color(red: 42 / 255, green: 31 / 255, blue: 10 / 255))` → NEEDS DESIGN REVIEW
- L477: `.background(Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255).opacity(0.96))` → NEEDS DESIGN REVIEW
- L656: `Color(red: 194 / 255, green: 146 / 255, blue: 48 / 255),` → NEEDS DESIGN REVIEW
- L657: `Color(red: 122 / 255, green: 79 / 255, blue: 27 / 255)` → NEEDS DESIGN REVIEW
- L976: `Color(red: 194 / 255, green: 146 / 255, blue: 48 / 255),` → NEEDS DESIGN REVIEW
- L977: `Color(red: 122 / 255, green: 79 / 255, blue: 27 / 255)` → NEEDS DESIGN REVIEW

**`frontend/apps/ios/Pantopus/Features/Homes/Documents/DocumentFileTypePalette.swift`** (12 matches):
- L55: `Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0)` → NEEDS DESIGN REVIEW
- L58: `Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)` → NEEDS DESIGN REVIEW
- L61: `Color(red: 0xE0 / 255.0, green: 0xE7 / 255.0, blue: 0xFF / 255.0)` → NEEDS DESIGN REVIEW
- L64: `Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)` → NEEDS DESIGN REVIEW
- L67: `Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)` → NEEDS DESIGN REVIEW
- L70: `Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)` → NEEDS DESIGN REVIEW
- L79: `Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0)` → NEEDS DESIGN REVIEW
- L82: `Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)` → NEEDS DESIGN REVIEW
- L85: `Color(red: 0x43 / 255.0, green: 0x38 / 255.0, blue: 0xCA / 255.0)` → NEEDS DESIGN REVIEW
- L88: `Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)` → NEEDS DESIGN REVIEW
- L91: `Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)` → NEEDS DESIGN REVIEW
- L94: `Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0)` → NEEDS DESIGN REVIEW

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CertifiedStampBadge.swift`** (2 matches):
- L93: `Color(red: 0x7B / 255.0, green: 0x2D / 255.0, blue: 0x0E / 255.0)` → NEEDS DESIGN REVIEW
- L98: `Color(red: 180.0 / 255.0, green: 86.0 / 255.0, blue: 35.0 / 255.0, opacity: 0.04)` → NEEDS DESIGN REVIEW

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CombinedSenderCarrierCard.swift`** (1 match):
- L236: `Color(red: 0x7B / 255.0, green: 0x2D / 255.0, blue: 0x0E / 255.0)` → NEEDS DESIGN REVIEW

**`frontend/apps/ios/Pantopus/Features/Marketplace/MarketplaceContent.swift`** (6 matches):
- L115: `(Color(red: 186 / 255, green: 230 / 255, blue: 253 / 255), Color(red: 2 / 255, green: 132 / 255, ...` → NEEDS DESIGN REVIEW
- L116: `(Color(red: 254 / 255, green: 243 / 255, blue: 199 / 255), Color(red: 245 / 255, green: 158 / 255...` → NEEDS DESIGN REVIEW
- L117: `(Color(red: 221 / 255, green: 214 / 255, blue: 254 / 255), Color(red: 124 / 255, green: 58 / 255,...` → NEEDS DESIGN REVIEW
- L118: `(Color(red: 209 / 255, green: 250 / 255, blue: 229 / 255), Color(red: 5 / 255, green: 150 / 255, ...` → NEEDS DESIGN REVIEW
- L119: `(Color(red: 254 / 255, green: 202 / 255, blue: 202 / 255), Color(red: 220 / 255, green: 38 / 255,...` → NEEDS DESIGN REVIEW
- L120: `(Color(red: 224 / 255, green: 242 / 255, blue: 254 / 255), Color(red: 14 / 255, green: 165 / 255,...` → NEEDS DESIGN REVIEW

**`frontend/apps/ios/Pantopus/Features/Nearby/NearbyMapView.swift`** (2 matches):
- L246: `.fill(Color(red: 209 / 255, green: 213 / 255, blue: 219 / 255))` → NEEDS DESIGN REVIEW
- L682: `.fill(i == index ? Theme.Color.primary600 : Color(red: 209 / 255, green: 213 / 255, blue: 219 / 2...` → NEEDS DESIGN REVIEW

**`frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/MailItemDetailShell.swift`** (18 matches):
- L515: `background: Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0),` → NEEDS DESIGN REVIEW
- L516: `foreground: Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0),` → NEEDS DESIGN REVIEW
- L517: `border: Color(red: 0xFE / 255.0, green: 0xCA / 255.0, blue: 0xCA / 255.0)` → NEEDS DESIGN REVIEW
- L523: `background: Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0),` → NEEDS DESIGN REVIEW
- L524: `foreground: Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0),` → NEEDS DESIGN REVIEW
- L525: `border: Color(red: 0xBF / 255.0, green: 0xDB / 255.0, blue: 0xFE / 255.0)` → NEEDS DESIGN REVIEW
- L531: `background: Color(red: 0xFC / 255.0, green: 0xE7 / 255.0, blue: 0xF3 / 255.0),` → NEEDS DESIGN REVIEW
- L532: `foreground: Color(red: 0xBE / 255.0, green: 0x18 / 255.0, blue: 0x5D / 255.0),` → NEEDS DESIGN REVIEW
- L533: `border: Color(red: 0xFB / 255.0, green: 0xCF / 255.0, blue: 0xE8 / 255.0)` → NEEDS DESIGN REVIEW
- L539: `background: Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0),` → NEEDS DESIGN REVIEW
- L540: `foreground: Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0),` → NEEDS DESIGN REVIEW
- L541: `border: Color(red: 0xDD / 255.0, green: 0xD6 / 255.0, blue: 0xFE / 255.0)` → NEEDS DESIGN REVIEW
- L547: `background: Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0),` → NEEDS DESIGN REVIEW
- L548: `foreground: Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0),` → NEEDS DESIGN REVIEW
- L549: `border: Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0)` → NEEDS DESIGN REVIEW
- L554: `background: Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0),` → NEEDS DESIGN REVIEW
- L555: `foreground: Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0),` → NEEDS DESIGN REVIEW
- L556: `border: Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0)` → NEEDS DESIGN REVIEW

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridPreview.swift`** (13 matches):
- L28: `MapPin(id: "handyman-1", latitude: 40.7494, longitude: -73.9867, color: Color(red: 234 / 255, gre...` → NEEDS DESIGN REVIEW
- L29: `MapPin(id: "cleaning-1", latitude: 40.7502, longitude: -73.9840, color: Color(red: 14 / 255, gree...` → NEEDS DESIGN REVIEW
- L34: `color: Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255),` → NEEDS DESIGN REVIEW
- L37: `MapPin(id: "petcare-1", latitude: 40.7459, longitude: -73.9882, color: Color(red: 22 / 255, green...` → NEEDS DESIGN REVIEW
- L38: `MapPin(id: "childcare-1", latitude: 40.7515, longitude: -73.9905, color: Color(red: 219 / 255, gr...` → NEEDS DESIGN REVIEW
- L43: `color: Color(red: 202 / 255, green: 138 / 255, blue: 4 / 255),` → NEEDS DESIGN REVIEW
- L46: `MapPin(id: "handyman-2", latitude: 40.7460, longitude: -73.9990, color: Color(red: 234 / 255, gre...` → NEEDS DESIGN REVIEW
- L176: `CategoryEntry(key: "handyman", label: "Handyman", color: Color(red: 234 / 255, green: 88 / 255, b...` → NEEDS DESIGN REVIEW
- L177: `CategoryEntry(key: "cleaning", label: "Cleaning", color: Color(red: 14 / 255, green: 165 / 255, b...` → NEEDS DESIGN REVIEW
- L178: `CategoryEntry(key: "moving", label: "Moving", color: Color(red: 124 / 255, green: 58 / 255, blue:...` → NEEDS DESIGN REVIEW
- L179: `CategoryEntry(key: "petcare", label: "Pet care", color: Color(red: 22 / 255, green: 163 / 255, bl...` → NEEDS DESIGN REVIEW
- L180: `CategoryEntry(key: "childcare", label: "Child care", color: Color(red: 219 / 255, green: 39 / 255...` → NEEDS DESIGN REVIEW
- L181: `CategoryEntry(key: "tutoring", label: "Tutoring", color: Color(red: 202 / 255, green: 138 / 255, ...` → NEEDS DESIGN REVIEW

#### ALLOWED EXCEPTIONS (category-accent palettes)

These files implement the `CategoryPalette` / per-category enum pattern explicitly permitted by `CLAUDE.md`:

- `frontend/apps/ios/Pantopus/Features/Homes/Maintenance/MaintenanceCategoryPalette.swift` — 26 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Homes/Calendar/CalendarEventCategory.swift` — 24 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Homes/Bills/UtilityCategoryPalette.swift` — 18 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Homes/Tasks/HouseholdTaskCategoryPalette.swift` — 18 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Homes/Documents/DocumentCategoryPalette.swift` — 16 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Homes/Packages/CourierPalette.swift` — 16 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Homes/AccessCodes/AccessCategoryPalette.swift` — 12 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Homes/Polls/PollKindPalette.swift` — 10 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Homes/Emergency/EmergencyCategoryPalette.swift` — 8 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/Gigs/GigsCategory.swift` — 8 hex literals (category palette)
- `frontend/apps/ios/Pantopus/Features/IdentityCenter/IdentityCenterContent.swift` — 2 hex literals (category palette)

## B. iOS — Off-scale spacing

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/AudienceProfileView.swift`** (3 matches):
- L334: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`
- L417: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`
- L469: `10` (drift ↑2) → `Spacing.s2` — `.padding(10)`

**`frontend/apps/ios/Pantopus/Features/CeremonialMail/CeremonialMailWizardView.swift`** (3 matches):
- L274: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`
- L295: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`
- L537: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`

**`frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenView.swift`** (3 matches):
- L708: `6` (drift ↑2) → `Spacing.s1` — `.padding(6)`
- L1006: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`
- L1061: `18` (drift ↑2) → `Spacing.s4` — `.padding(18)`

**`frontend/apps/ios/Pantopus/Features/ContentDetail/TransactionalDetailShell.swift`** (1 match):
- L328: `10` (drift ↑2) → `Spacing.s2` — `.padding(10)`

**`frontend/apps/ios/Pantopus/Features/IdentityCenter/IdentityCenterView.swift`** (1 match):
- L203: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`

**`frontend/apps/ios/Pantopus/Features/Me/MeView.swift`** (1 match):
- L346: `6` (drift ↑2) → `Spacing.s1` — `.padding(6)`

**`frontend/apps/ios/Pantopus/Features/PrivacyHandshake/PrivacyHandshakeWizardView.swift`** (3 matches):
- L94: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`
- L265: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`
- L293: `10` (drift ↑2) → `Spacing.s2` — `.padding(10)`

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherPillRow.swift`** (1 match):
- L78: `3` (drift ↓1) → `Spacing.s1` — `.padding(3)`

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherSheet.swift`** (1 match):
- L143: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`

**`frontend/apps/ios/Pantopus/Features/Status/StatusWaitingView.swift`** (1 match):
- L171: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`

**`frontend/apps/ios/Pantopus/Features/TokenAccept/TokenAcceptView.swift`** (2 matches):
- L161: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`
- L188: `14` (drift ↑2) → `Spacing.s3` — `.padding(14)`

## C. iOS — Off-scale radii

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/AudienceProfileView.swift`** (6 matches):
- L95: `22` (drift ↑2) → `Radii.xl2` — `Shimmer(height: 44, cornerRadius: 22)`
- L97: `14` (drift ↑2) → `Radii.lg` — `Shimmer(height: 88, cornerRadius: 14)`
- L337: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L340: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`
- L472: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L475: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`

**`frontend/apps/ios/Pantopus/Features/CeremonialMail/CeremonialMailWizardView.swift`** (14 matches):
- L122: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L125: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L163: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L166: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L190: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L193: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L225: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L228: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L329: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L332: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L437: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L440: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L588: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L591: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`

**`frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenView.swift`** (10 matches):
- L82: `18` (drift ↑2) → `Radii.xl` — `Shimmer(height: 220, cornerRadius: 18)`
- L83: `18` (drift ↑2) → `Radii.xl` — `Shimmer(height: 180, cornerRadius: 18)`
- L84: `14` (drift ↑2) → `Radii.lg` — `Shimmer(height: 56, cornerRadius: 14)`
- L382: `3` (drift ↓1) → `Radii.xs` — `RoundedRectangle(cornerRadius: 3, style: .continuous)`
- L1009: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14)`
- L1012: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14))`
- L1064: `18` (drift ↑2) → `Radii.xl` — `RoundedRectangle(cornerRadius: 18)`
- L1067: `18` (drift ↑2) → `Radii.xl` — `.clipShape(RoundedRectangle(cornerRadius: 18))`
- L1119: `9` (drift ↑1) → `Radii.md` — `RoundedRectangle(cornerRadius: 9)`
- L1122: `9` (drift ↑1) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 9))`

**`frontend/apps/ios/Pantopus/Features/Chat/ChatListView.swift`** (2 matches):
- L284: `2` (drift ↓2) → `Radii.xs` — `.clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))`
- L300: `22` (drift ↑2) → `Radii.xl2` — `Shimmer(width: 44, height: 44, cornerRadius: 22)`

**`frontend/apps/ios/Pantopus/Features/Chat/NewMessage/NewMessageView.swift`** (1 match):
- L147: `19` (drift ↓1) → `Radii.xl2` — `Shimmer(width: 38, height: 38, cornerRadius: 19)`

**`frontend/apps/ios/Pantopus/Features/ContentDetail/TransactionalDetailShell.swift`** (6 matches):
- L379: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L382: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`
- L433: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L436: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L458: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L474: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/MailDetailView.swift`** (2 matches):
- L441: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14)`
- L447: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/BookletDetailLayout.swift`** (1 match):
- L143: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CertifiedDetailLayout.swift`** (4 matches):
- L279: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14)`
- L285: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14))`
- L463: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10)`
- L466: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CommunityDetailLayout.swift`** (15 matches):
- L281: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10)`
- L284: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10))`
- L510: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10)`
- L513: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10))`
- L533: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10)`
- L536: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10))`
- L571: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10)`
- L574: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10))`
- L603: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10)`
- L606: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10))`
- L857: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10))`
- L870: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10)`
- L873: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10))`
- L986: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14)`
- L989: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14))`

**`frontend/apps/ios/Pantopus/Features/Marketplace/MarketplaceView.swift`** (4 matches):
- L335: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L338: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`
- L403: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L406: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`

**`frontend/apps/ios/Pantopus/Features/Nearby/NearbyMapView.swift`** (5 matches):
- L258: `22` (drift ↑2) → `Radii.xl2` — `.clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))`
- L544: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L589: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L592: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`
- L609: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`

**`frontend/apps/ios/Pantopus/Features/PrivacyHandshake/PrivacyHandshakeWizardView.swift`** (7 matches):
- L97: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L100: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`
- L144: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L150: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L214: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L360: `14` (drift ↑2) → `Radii.lg` — `Shimmer(height: 72, cornerRadius: 14)`
- L361: `10` (drift ↑2) → `Radii.md` — `Shimmer(height: 44, cornerRadius: 10)`

**`frontend/apps/ios/Pantopus/Features/Profile/PublicProfileView.swift`** (1 match):
- L114: `36` (drift ↑12) → `Radii.xl3` — `Shimmer(width: 72, height: 72, cornerRadius: 36)`

**`frontend/apps/ios/Pantopus/Features/Settings/About/AboutView.swift`** (1 match):
- L33: `22` (drift ↑2) → `Radii.xl2` — `RoundedRectangle(cornerRadius: 22, style: .continuous)`

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherSheet.swift`** (2 matches):
- L146: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L149: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`

**`frontend/apps/ios/Pantopus/Features/Shared/ListOfRows/ListOfRowsView.swift`** (1 match):
- L1016: `11` (drift ↓1) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))`

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridPreview.swift`** (4 matches):
- L326: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`
- L346: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L349: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`
- L361: `10` (drift ↑2) → `Radii.md` — `RoundedRectangle(cornerRadius: 10, style: .continuous)`

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridShell.swift`** (1 match):
- L185: `22` (drift ↑2) → `Radii.xl2` — `.clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))`

**`frontend/apps/ios/Pantopus/Features/Status/StatusWaitingView.swift`** (2 matches):
- L196: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L211: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`

**`frontend/apps/ios/Pantopus/Features/TokenAccept/TokenAcceptView.swift`** (6 matches):
- L125: `14` (drift ↑2) → `Radii.lg` — `RoundedRectangle(cornerRadius: 14, style: .continuous)`
- L128: `14` (drift ↑2) → `Radii.lg` — `.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))`
- L210: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L241: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L260: `10` (drift ↑2) → `Radii.md` — `.clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))`
- L276: `14` (drift ↑2) → `Radii.lg` — `Shimmer(height: 130, cornerRadius: 14)`

## D. iOS — Off-scale fonts

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/AudienceProfileView.swift`** (21 matches):
- L110: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L113: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L141: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L144: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L179: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L183: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L189: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .medium))`
- L201: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .medium))`
- L230: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: isActive ? .bold : .medium))`
- L317: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L362: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .semibold))`
- L393: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L456: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L460: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L464: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10))`
- L530: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5))`
- L591: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L595: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5))`
- L658: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L674: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L689: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5))`

**`frontend/apps/ios/Pantopus/Features/CeremonialMail/CeremonialMailWizardView.swift`** (15 matches):
- L88: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L103: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L177: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .semibold))`
- L262: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L266: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 14.5, weight: .semibold))`
- L288: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L292: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 14.5, weight: .semibold))`
- L380: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L415: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L447: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L498: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L515: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L555: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L607: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L610: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`

**`frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenView.swift`** (27 matches):
- L313: `28` (drift ↓2) → `PantopusTextStyle.h1 (30)` — `.font(.system(size: 28, weight: .medium, design: .serif))`
- L413: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .medium, design: .serif))`
- L447: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold, design: .serif))`
- L450: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L491: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L519: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .semibold))`
- L612: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .medium, design: .serif))`
- L666: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .medium, design: .serif))`
- L678: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L690: `6` (drift ↓5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 6, weight: .bold))`
- L693: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .semibold, design: .serif))`
- L695: `6` (drift ↓5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 6, weight: .bold))`
- L733: `19` (drift ↓1) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 19, weight: .medium, design: .serif))`
- L742: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, design: .serif))`
- L753: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, design: .serif))`
- L765: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L852: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L920: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .semibold, design: .monospaced))`
- L944: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L986: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold, design: .serif))`
- L993: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L1001: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, design: .serif))`
- L1025: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L1030: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L1040: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .medium, design: .serif))`
- L1044: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, design: .serif))`
- L1053: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .semibold, design: .monospaced))`

**`frontend/apps/ios/Pantopus/Features/Chat/ChatListView.swift`** (8 matches):
- L82: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L103: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L140: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L143: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L179: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L211: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .medium))`
- L266: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: filter == active ? .bold : .medium))`
- L270: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Chat/Conversation/ChatConversationView.swift`** (15 matches):
- L118: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L124: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5))`
- L147: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L193: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L226: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L235: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L303: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L306: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L368: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .medium))`
- L422: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L599: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L621: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L624: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .bold))`
- L644: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .medium))`
- L670: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Chat/ConversationRow.swift`** (5 matches):
- L85: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 14.5, weight: content.unread > 0 ? .bold : .semibold))`
- L98: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: content.unread > 0 ? .medium : .regular))`
- L107: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: content.unread > 0 ? .bold : .medium))`
- L111: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .bold))`
- L217: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Chat/NewMessage/NewMessageView.swift`** (11 matches):
- L41: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .medium))`
- L82: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L185: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L195: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L212: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .semibold))`
- L264: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5))`
- L314: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L317: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L351: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .semibold))`
- L358: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L395: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/ContentDetail/GigDetailView.swift`** (2 matches):
- L48: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L50: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`

**`frontend/apps/ios/Pantopus/Features/ContentDetail/InvoiceDetailView.swift`** (2 matches):
- L45: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L48: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`

**`frontend/apps/ios/Pantopus/Features/ContentDetail/ListingDetailView.swift`** (2 matches):
- L65: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L67: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`

**`frontend/apps/ios/Pantopus/Features/ContentDetail/TransactionalDetailShell.swift`** (27 matches):
- L76: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L79: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L225: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L239: `32` (drift ↑2) → `PantopusTextStyle.h1 (30)` — `.font(.system(size: 32, weight: .heavy))`
- L257: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L314: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .bold))`
- L317: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .medium))`
- L342: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .bold))`
- L352: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L357: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L393: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L410: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L420: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L441: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .medium))`
- L476: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .semibold))`
- L518: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L523: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10))`
- L539: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L544: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .medium))`
- L576: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L580: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L585: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .semibold))`
- L610: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L656: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .medium))`
- L660: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .medium).monospacedDigit())`
- L667: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L727: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 14.5, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Feed/FeedView.swift`** (6 matches):
- L68: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L118: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L143: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L146: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .bold))`
- L199: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L202: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`

**`frontend/apps/ios/Pantopus/Features/Feed/Pulse/PulsePostCard.swift`** (8 matches):
- L92: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .semibold))`
- L98: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5))`
- L132: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L136: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5))`
- L205: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L233: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L237: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L264: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Gigs/GigsFeedView.swift`** (16 matches):
- L77: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L103: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .medium))`
- L129: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L171: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .medium))`
- L174: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L187: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .bold))`
- L242: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L276: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L279: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .bold))`
- L282: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L329: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L332: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L368: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10))`
- L421: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L437: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L452: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Homes/Calendar/MonthStripHeader.swift`** (2 matches):
- L116: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L162: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Hub/Sections/HubSections.swift`** (14 matches):
- L34: `17` (drift ↑1) → `PantopusTextStyle.body (16)` — `.font(.system(size: 17, weight: .bold))`
- L114: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L191: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L201: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L207: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L214: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L373: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L405: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L493: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L502: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L562: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L566: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L588: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10))`
- L704: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/IdentityCenter/IdentityCenterView.swift`** (9 matches):
- L152: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L157: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L166: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L176: `15.5` (drift ↓0.5) → `PantopusTextStyle.body (16)` — `.font(.system(size: 15.5, weight: .semibold))`
- L188: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L194: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L264: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .medium))`
- L315: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L318: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`

**`frontend/apps/ios/Pantopus/Features/ListingOffers/ListingOffersView.swift`** (2 matches):
- L65: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L86: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/Disambiguate/DisambiguateMailFormView.swift`** (1 match):
- L89: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, design: .monospaced))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/CertifiedBody.swift`** (1 match):
- L34: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CouponHero.swift`** (2 matches):
- L35: `28` (drift ↓2) → `PantopusTextStyle.h1 (30)` — `.font(.system(size: 28, weight: .bold))`
- L41: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/BookletPager.swift`** (3 matches):
- L92: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L95: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L318: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold, design: .serif))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CertifiedStampBadge.swift`** (3 matches):
- L27: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L31: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L38: `8` (drift ↓3) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 8, weight: .semibold, design: .monospaced))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CombinedSenderCarrierCard.swift`** (7 matches):
- L103: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L118: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .bold))`
- L122: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L172: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .bold))`
- L176: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, design: .monospaced))`
- L208: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L224: `9.5` (drift ↓1.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9.5, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/MailDetailView.swift`** (9 matches):
- L216: `19` (drift ↓1) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 19, weight: .bold))`
- L221: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L249: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L291: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L324: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L379: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L430: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .bold))`
- L468: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .semibold))`
- L542: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/BookletDetailLayout.swift`** (6 matches):
- L137: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .bold))`
- L160: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .semibold))`
- L199: `19` (drift ↓1) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 19, weight: .bold))`
- L204: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L230: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L268: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CertifiedDetailLayout.swift`** (7 matches):
- L272: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .bold))`
- L310: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L331: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5))`
- L419: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L478: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L581: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L616: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CommunityDetailLayout.swift`** (21 matches):
- L242: `19` (drift ↓1) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 19, weight: .bold))`
- L297: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L319: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 14.5, weight: .bold))`
- L323: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L498: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5))`
- L521: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L548: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L556: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L560: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L697: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .semibold))`
- L739: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L762: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .semibold))`
- L780: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L787: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L790: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5))`
- L841: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L862: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L928: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L979: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .bold))`
- L1019: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .bold))`
- L1051: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Marketplace/MarketplaceView.swift`** (13 matches):
- L63: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L79: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .medium))`
- L115: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L189: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L221: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L224: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .bold))`
- L227: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L276: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L279: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L315: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .semibold))`
- L321: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .bold))`
- L324: `9.5` (drift ↓1.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9.5))`
- L370: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Me/MeView.swift`** (10 matches):
- L135: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L138: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L203: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L237: `26` (drift ↑2) → `PantopusTextStyle.h2 (24)` — `.font(.system(size: 26, weight: .bold))`
- L289: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L292: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .semibold))`
- L340: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L374: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L384: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .semibold))`
- L430: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Nearby/NearbyMapView.swift`** (13 matches):
- L187: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .semibold))`
- L356: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L362: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L385: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L557: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L564: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L569: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .medium))`
- L575: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L623: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L631: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10))`
- L636: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L643: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`
- L648: `9.5` (drift ↓1.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9.5, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/PrivacyHandshake/PrivacyHandshakeWizardView.swift`** (14 matches):
- L71: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L110: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L153: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L184: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L187: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L205: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`
- L208: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L223: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L251: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .semibold))`
- L327: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5))`
- L347: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5))`
- L371: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .semibold))`
- L374: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5))`
- L381: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Settings/About/AboutView.swift`** (1 match):
- L37: `44` (drift ↑14) → `PantopusTextStyle.h1 (30)` — `.font(.system(size: 44, weight: .heavy))`

**`frontend/apps/ios/Pantopus/Features/Settings/Help/HelpCenterView.swift`** (1 match):
- L58: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Settings/SettingsTopBar.swift`** (1 match):
- L43: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/BodyReactionsBody.swift`** (1 match):
- L113: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .regular))`

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/StatsTabsBody.swift`** (1 match):
- L143: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Shared/Feed/FeedComponents.swift`** (1 match):
- L51: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Shared/GroupedList/GroupedListView.swift`** (5 matches):
- L189: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`
- L204: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .medium))`
- L281: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .bold))`
- L344: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L347: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherSheet.swift`** (5 matches):
- L70: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5))`
- L116: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L121: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L130: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 14.5, weight: .semibold))`
- L135: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5))`

**`frontend/apps/ios/Pantopus/Features/Shared/ListOfRows/ListOfRowsView.swift`** (5 matches):
- L96: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L574: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L908: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .semibold))`
- L1290: `7` (drift ↓4) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 7, weight: .bold))`
- L1325: `7` (drift ↓4) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 7, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/ChainOfCustodyTimeline.swift`** (4 matches):
- L160: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L197: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 12.5, weight: event.isComplete ? .bold : .semibold))`
- L202: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`
- L219: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, design: .monospaced))`

**`frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/MailItemDetailShell.swift`** (5 matches):
- L225: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `.font(.system(size: 15, weight: .regular))`
- L320: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L346: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L457: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L483: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 9, weight: .bold))`

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridPreview.swift`** (4 matches):
- L196: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .semibold))`
- L275: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .medium))`
- L333: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`
- L368: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .semibold))`

**`frontend/apps/ios/Pantopus/Features/Status/StatusWaitingView.swift`** (3 matches):
- L78: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L157: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L165: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`

**`frontend/apps/ios/Pantopus/Features/TokenAccept/TokenAcceptView.swift`** (15 matches):
- L101: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `.font(.system(size: 22, weight: .bold))`
- L106: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L112: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 11.5, weight: .semibold))`
- L134: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L152: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10.5, weight: .bold))`
- L174: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `.font(.system(size: 10, weight: .bold))`
- L182: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L296: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `.font(.system(size: 13.5))`
- L311: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L314: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L328: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L331: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L345: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `.font(.system(size: 18, weight: .bold))`
- L348: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13))`
- L355: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `.font(.system(size: 13, weight: .bold))`

## E. iOS — Frame width/height literals (informational)

`.frame(width:height:)` literals are often legitimate for fixed-geometry shapes (avatars, pin dots, icon containers) per the DoD. Listed here by file so they can be spot-checked during P1+ refactors. **Not flagged as hard drift.**

- `frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenView.swift` — 50 frame literals
- `frontend/apps/ios/Pantopus/Features/Chat/Conversation/ChatConversationView.swift` — 25 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ListOfRows/ListOfRowsView.swift` — 22 frame literals
- `frontend/apps/ios/Pantopus/Features/Nearby/NearbyMapView.swift` — 21 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CommunityDetailLayout.swift` — 20 frame literals
- `frontend/apps/ios/Pantopus/Features/Hub/Sections/HubSections.swift` — 20 frame literals
- `frontend/apps/ios/Pantopus/Features/ContentDetail/TransactionalDetailShell.swift` — 20 frame literals
- `frontend/apps/ios/Pantopus/Features/AudienceProfile/AudienceProfileView.swift` — 16 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/MailItemDetailShell.swift` — 13 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/GroupedList/GroupedListView.swift` — 13 frame literals
- `frontend/apps/ios/Pantopus/Features/Chat/NewMessage/NewMessageView.swift` — 13 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridPreview.swift` — 12 frame literals
- `frontend/apps/ios/Pantopus/Features/CeremonialMail/CeremonialMailWizardView.swift` — 11 frame literals
- `frontend/apps/ios/Pantopus/Features/TokenAccept/TokenAcceptView.swift` — 10 frame literals
- `frontend/apps/ios/Pantopus/Features/PrivacyHandshake/PrivacyHandshakeWizardView.swift` — 9 frame literals
- `frontend/apps/ios/Pantopus/Features/IdentityCenter/IdentityCenterView.swift` — 9 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridShell.swift` — 8 frame literals
- `frontend/apps/ios/Pantopus/Features/Marketplace/MarketplaceView.swift` — 8 frame literals
- `frontend/apps/ios/Pantopus/Features/Chat/ChatListView.swift` — 8 frame literals
- `frontend/apps/ios/Pantopus/Features/Me/MeView.swift` — 7 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/BookletPager.swift` — 7 frame literals
- `frontend/apps/ios/Pantopus/Features/Gigs/GigsFeedView.swift` — 7 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Form/FormShell.swift` — 6 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/ContentDetailShell.swift` — 6 frame literals
- `frontend/apps/ios/Pantopus/Features/Chat/ConversationRow.swift` — 6 frame literals
- `frontend/apps/ios/Pantopus/Features/Auth/Screens/ResetPasswordView.swift` — 6 frame literals
- `frontend/apps/ios/Pantopus/Features/Status/StatusWaitingView.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Wizard/WizardShell.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/BodyReactionsBody.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/BookletDetailLayout.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/MailDetailView.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CombinedSenderCarrierCard.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/Calendar/MonthStripHeader.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Feed/FeedView.swift` — 5 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Wizard/Blocks/TimelineBlock.swift` — 4 frame literals
- `frontend/apps/ios/Pantopus/Features/Settings/SettingsTopBar.swift` — 4 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CertifiedDetailLayout.swift` — 4 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/Disambiguate/DisambiguateMailFormView.swift` — 4 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/Bills/BillDetailView.swift` — 4 frame literals
- `frontend/apps/ios/Pantopus/Features/Auth/Screens/ForgotPasswordView.swift` — 4 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/ChainOfCustodyTimeline.swift` — 3 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Feed/FeedComponents.swift` — 3 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/Polls/PollDetailView.swift` — 3 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/Packages/PackageDetailView.swift` — 3 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/Bills/AddBillWizardView.swift` — 3 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/AddHome/AddHomeWizardView.swift` — 3 frame literals
- `frontend/apps/ios/Pantopus/Features/Auth/Screens/SignUpView.swift` — 3 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Wizard/Blocks/UploadSlotsBlock.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Wizard/Blocks/ReviewSummaryBlock.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherSheet.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Headers.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/CTAs.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/StatsTabsBody.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/MailboxItemDetailView.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/MailboxItemDetailShell.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/BookletPageSwiper.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/Polls/PollResultBar.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Feed/Pulse/PulsePostCard.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Auth/Screens/VerifyEmailView.swift` — 2 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Wizard/Blocks/SuccessHeroBlock.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Wizard/Blocks/RequirementsCardBlock.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherPillRow.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Headers/ProfileHeader.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Headers/PostAuthorHeader.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Settings/About/AboutView.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Root/HubTabRoot.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CertifiedStampBadge.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CouponHero.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CertifiedTermsSheet.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CertifiedConfirmGate.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/BarcodeView.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/Pets/AddPetWizardView.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/Members/InviteMemberWizardView.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/HomeDashboardView.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Homes/ClaimOwnership/Steps/ClaimUploadStep.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/ContentDetail/ListingDetailView.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/ContentDetail/InvoiceDetailView.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/ContentDetail/GigDetailView.swift` — 1 frame literals
- `frontend/apps/ios/Pantopus/Features/Auth/LoginView.swift` — 1 frame literals

**Total iOS frame literals:** 487 across 80 files.

---

# Android

## A. Android — Hex color literals

**Summary:** 111 hex literals across 9 files NEED DESIGN REVIEW. An additional 163 hex literals across 12 files are ALLOWED EXCEPTIONS (category-accent palettes per the platform CLAUDE.md).

#### NEEDS DESIGN REVIEW


**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/Shimmer.kt`** (2 matches):
- L36: `private val ShimmerBase = Color(0xFFEEF0F3)` → NEEDS DESIGN REVIEW
- L37: `private val ShimmerHighlight = Color(0xFFF6F7F9)` → NEEDS DESIGN REVIEW

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenContent.kt`** (51 matches):
- L31: `Color(0xFFF8F0DE),` → NEEDS DESIGN REVIEW
- L32: `Color(0xFFDCD2BC),` → NEEDS DESIGN REVIEW
- L33: `Color(0xFFE6D2B4),` → NEEDS DESIGN REVIEW
- L34: `Color(0xFF825A46),` → NEEDS DESIGN REVIEW
- L38: `Color(0xFFE0E4F0),` → NEEDS DESIGN REVIEW
- L39: `Color(0xFFC8CEE0),` → NEEDS DESIGN REVIEW
- L40: `Color(0xFF506496),` → NEEDS DESIGN REVIEW
- L41: `Color(0xFF162046),` → NEEDS DESIGN REVIEW
- L45: `Color(0xFFFAF7F0),` → NEEDS DESIGN REVIEW
- L46: `Color(0xFFE2DCCE),` → NEEDS DESIGN REVIEW
- L47: `Color(0xFFE6D2B4),` → NEEDS DESIGN REVIEW
- L48: `Color(0xFF825A46),` → NEEDS DESIGN REVIEW
- L52: `Color(0xFFEBF4E8),` → NEEDS DESIGN REVIEW
- L53: `Color(0xFFD0DECC),` → NEEDS DESIGN REVIEW
- L54: `Color(0xFFE6D2B4),` → NEEDS DESIGN REVIEW
- L55: `Color(0xFF825A46),` → NEEDS DESIGN REVIEW
- L59: `Color(0xFFF0E2C4),` → NEEDS DESIGN REVIEW
- L60: `Color(0xFFD9C49A),` → NEEDS DESIGN REVIEW
- L61: `Color(0xFFF4C97F),` → NEEDS DESIGN REVIEW
- L62: `Color(0xFF6F3439),` → NEEDS DESIGN REVIEW
- L66: `Color(0xFFECE9E2),` → NEEDS DESIGN REVIEW
- L67: `Color(0xFFD3CFC6),` → NEEDS DESIGN REVIEW
- L68: `Color(0xFFC3D4E2),` → NEEDS DESIGN REVIEW
- L69: `Color(0xFF38465A),` → NEEDS DESIGN REVIEW
- L73: `Color(0xFFF4EFDC),` → NEEDS DESIGN REVIEW
- L74: `Color(0xFFDAD3B8),` → NEEDS DESIGN REVIEW
- L75: `Color(0xFFC4E2B2),` → NEEDS DESIGN REVIEW
- L76: `Color(0xFF567C4E),` → NEEDS DESIGN REVIEW
- L80: `Color(0xFFF6E6D3),` → NEEDS DESIGN REVIEW
- L81: `Color(0xFFDECBB4),` → NEEDS DESIGN REVIEW
- _…21 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt`** (12 matches):
- L455: `Color(0xFFFFE4A0).copy(alpha = 0.55f),` → NEEDS DESIGN REVIEW
- L456: `Color(0xFFFFB06C).copy(alpha = 0.18f),` → NEEDS DESIGN REVIEW
- L507: `.background(Color(0xFFFAEFD7)),` → NEEDS DESIGN REVIEW
- L519: `.background(Color(0xFF3C2814).copy(alpha = 0.25f)),` → NEEDS DESIGN REVIEW
- L567: `colors = listOf(Color(0xFFC29230), Color(0xFF7A4F1B)),` → NEEDS DESIGN REVIEW
- L585: `color = Color(0xFFF6ECD8),` → NEEDS DESIGN REVIEW
- L592: `color = Color(0xFFF6ECD8).copy(alpha = 0.85f),` → NEEDS DESIGN REVIEW
- L605: `.background(Color(0xFFF6ECD8).copy(alpha = 0.96f))` → NEEDS DESIGN REVIEW
- L619: `color = Color(0xFF2A1F0A),` → NEEDS DESIGN REVIEW
- L625: `tint = Color(0xFF2A1F0A),` → NEEDS DESIGN REVIEW
- L900: `colors = listOf(Color(0xFFC29230), Color(0xFF7A4F1B)),` → NEEDS DESIGN REVIEW
- L1294: `colors = listOf(Color(0xFFC29230), Color(0xFF7A4F1B)),` → NEEDS DESIGN REVIEW

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/documents/DocumentFileTypePalette.kt`** (12 matches):
- L28: `background = Color(0xFFFEE2E2),` → NEEDS DESIGN REVIEW
- L29: `foreground = Color(0xFFB91C1C),` → NEEDS DESIGN REVIEW
- L35: `background = Color(0xFFDBEAFE),` → NEEDS DESIGN REVIEW
- L36: `foreground = Color(0xFF1D4ED8),` → NEEDS DESIGN REVIEW
- L42: `background = Color(0xFFE0E7FF),` → NEEDS DESIGN REVIEW
- L43: `foreground = Color(0xFF4338CA),` → NEEDS DESIGN REVIEW
- L49: `background = Color(0xFFDCFCE7),` → NEEDS DESIGN REVIEW
- L50: `foreground = Color(0xFF15803D),` → NEEDS DESIGN REVIEW
- L56: `background = Color(0xFFE2E8F0),` → NEEDS DESIGN REVIEW
- L57: `foreground = Color(0xFF334155),` → NEEDS DESIGN REVIEW
- L63: `background = Color(0xFFEDE9FE),` → NEEDS DESIGN REVIEW
- L64: `foreground = Color(0xFF6D28D9),` → NEEDS DESIGN REVIEW

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt`** (1 match):
- L55: `private val StampInk = Color(0xFF7B2D0E)` → NEEDS DESIGN REVIEW

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/marketplace/MarketplaceContent.kt`** (6 matches):
- L69: `ListingGradient(Color(0xFFBAE6FD), Color(0xFF0284C7)),` → NEEDS DESIGN REVIEW
- L70: `ListingGradient(Color(0xFFFEF3C7), Color(0xFFF59E0B)),` → NEEDS DESIGN REVIEW
- L71: `ListingGradient(Color(0xFFDDD6FE), Color(0xFF7C3AED)),` → NEEDS DESIGN REVIEW
- L72: `ListingGradient(Color(0xFFD1FAE5), Color(0xFF059669)),` → NEEDS DESIGN REVIEW
- L73: `ListingGradient(Color(0xFFFECACA), Color(0xFFDC2626)),` → NEEDS DESIGN REVIEW
- L74: `ListingGradient(Color(0xFFE0F2FE), Color(0xFF0EA5E9)),` → NEEDS DESIGN REVIEW

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/nearby/map/NearbyMapScreen.kt`** (2 matches):
- L720: `.background(Color(0xFFD1D5DB)),` → NEEDS DESIGN REVIEW
- L1141: `.background(if (active) PantopusColors.primary600 else Color(0xFFD1D5DB)),` → NEEDS DESIGN REVIEW

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/MailItemDetailShell.kt`** (18 matches):
- L660: `background = Color(0xFFFEE2E2),` → NEEDS DESIGN REVIEW
- L661: `foreground = Color(0xFFB91C1C),` → NEEDS DESIGN REVIEW
- L662: `border = Color(0xFFFECACA),` → NEEDS DESIGN REVIEW
- L668: `background = Color(0xFFDBEAFE),` → NEEDS DESIGN REVIEW
- L669: `foreground = Color(0xFF1D4ED8),` → NEEDS DESIGN REVIEW
- L670: `border = Color(0xFFBFDBFE),` → NEEDS DESIGN REVIEW
- L676: `background = Color(0xFFFCE7F3),` → NEEDS DESIGN REVIEW
- L677: `foreground = Color(0xFFBE185D),` → NEEDS DESIGN REVIEW
- L678: `border = Color(0xFFFBCFE8),` → NEEDS DESIGN REVIEW
- L684: `background = Color(0xFFEDE9FE),` → NEEDS DESIGN REVIEW
- L685: `foreground = Color(0xFF6D28D9),` → NEEDS DESIGN REVIEW
- L686: `border = Color(0xFFDDD6FE),` → NEEDS DESIGN REVIEW
- L692: `background = Color(0xFFF3F4F6),` → NEEDS DESIGN REVIEW
- L693: `foreground = Color(0xFF374151),` → NEEDS DESIGN REVIEW
- L694: `border = Color(0xFFE5E7EB),` → NEEDS DESIGN REVIEW
- L699: `background = Color(0xFFF3F4F6),` → NEEDS DESIGN REVIEW
- L700: `foreground = Color(0xFF374151),` → NEEDS DESIGN REVIEW
- L701: `border = Color(0xFFE5E7EB),` → NEEDS DESIGN REVIEW

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt`** (7 matches):
- L75: `.background(Color(0xFFE8EDF2))` → NEEDS DESIGN REVIEW
- L153: `Triple("handyman", "Handyman", Color(0xFFEA580C)),` → NEEDS DESIGN REVIEW
- L154: `Triple("cleaning", "Cleaning", Color(0xFF0EA5E9)),` → NEEDS DESIGN REVIEW
- L155: `Triple("moving", "Moving", Color(0xFF7C3AED)),` → NEEDS DESIGN REVIEW
- L156: `Triple("petcare", "Pet care", Color(0xFF16A34A)),` → NEEDS DESIGN REVIEW
- L157: `Triple("childcare", "Child care", Color(0xFFDB2777)),` → NEEDS DESIGN REVIEW
- L158: `Triple("tutoring", "Tutoring", Color(0xFFCA8A04)),` → NEEDS DESIGN REVIEW

#### ALLOWED EXCEPTIONS (category-accent palettes)

These files implement the `CategoryPalette` / per-category enum pattern explicitly permitted by `CLAUDE.md`:

- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/maintenance/MaintenanceCategoryPalette.kt` — 27 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/CalendarEventCategory.kt` — 24 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/bills/UtilityCategoryPalette.kt` — 19 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/tasks/HouseholdTaskCategoryPalette.kt` — 19 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/packages/CourierPalette.kt` — 16 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/documents/DocumentCategoryPalette.kt` — 16 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/accesscodes/AccessCategoryPalette.kt` — 12 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/polls/PollKindPalette.kt` — 10 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/GigsContent.kt` — 9 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/emergency/EmergencyCategoryPalette.kt` — 8 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/identity_center/IdentityCenterContent.kt` — 2 hex literals (category palette)
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/offers/OffersViewModel.kt` — 1 hex literals (category palette)

## B. Android — Off-scale spacing

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/AudienceProfileScreen.kt`** (22 matches):
- L318: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement...`
- L342: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L384: `10` (drift ↑2) → `Spacing.s2` — `modifier = Modifier.padding(vertical = 10.dp),`
- L454: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L456: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L458: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L507: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L541: `10` (drift ↑2) → `Spacing.s2` — `.padding(horizontal = 10.dp, vertical = 5.dp)`
- L612: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L622: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L635: `14` (drift ↑2) → `Spacing.s3` — `Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {`
- L698: `10` (drift ↑2) → `Spacing.s2` — `.padding(10.dp)`
- L700: `2` (drift ↑2) → `Spacing.s0` — `verticalArrangement = Arrangement.spacedBy(2.dp),`
- L734: `6` (drift ↑2) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(6.dp),`
- L744: `2` (drift ↑2) → `Spacing.s0` — `Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.s...`
- L808: `10` (drift ↑2) → `Spacing.s2` — `.padding(horizontal = 10.dp)`
- L853: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L854: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L873: `2` (drift ↑2) → `Spacing.s0` — `Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement...`
- L991: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L992: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L1005: `5` (drift ↑1) → `Spacing.s1` — `.padding(horizontal = 5.dp, vertical = 1.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/reset_password/ResetPasswordScreen.kt`** (1 match):
- L288: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/sign_up/SignUpScreen.kt`** (2 matches):
- L378: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L661: `2` (drift ↑2) → `Spacing.s0` — `verticalArrangement = Arrangement.spacedBy(2.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail/CeremonialMailWizardScreen.kt`** (11 matches):
- L126: `10` (drift ↑2) → `Spacing.s2` — `.padding(horizontal = 10.dp, vertical = 6.dp)`
- L202: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L274: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {`
- L332: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L376: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L378: `6` (drift ↑2) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(6.dp),`
- L428: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L524: `6` (drift ↑2) → `Spacing.s1` — `Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {`
- L678: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L680: `6` (drift ↑2) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(6.dp),`
- L752: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt`** (26 matches):
- L511: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L556: `6` (drift ↑2) → `Spacing.s1` — `.padding(start = 6.dp, end = 14.dp, top = 6.dp, bottom = 6.dp),`
- L558: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L580: `1` (drift ↑1) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {`
- L607: `28` (drift ↑4) → `Spacing.s6` — `.padding(horizontal = 28.dp, vertical = 14.dp)`
- L634: `14` (drift ↑2) → `Spacing.s3` — `modifier = Modifier.padding(vertical = 14.dp).fillMaxWidth(),`
- L662: `6` (drift ↑2) → `Spacing.s1` — `.padding(top = 6.dp)`
- L691: `7` (drift ↓1) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(7.dp),`
- L890: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L931: `3` (drift ↓1) → `Spacing.s1` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L960: `2` (drift ↑2) → `Spacing.s0` — `Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangemen...`
- L990: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L1027: `14` (drift ↑2) → `Spacing.s3` — `.padding(top = 14.dp),`
- L1046: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp, vertical = 6.dp)`
- L1065: `2` (drift ↑2) → `Spacing.s0` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L1092: `14` (drift ↑2) → `Spacing.s3` — `modifier = Modifier.fillMaxWidth().padding(top = 14.dp),`
- L1131: `14` (drift ↑2) → `Spacing.s3` — `.padding(bottom = 14.dp),`
- L1161: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L1221: `18` (drift ↑2) → `Spacing.s4` — `.padding(bottom = 18.dp),`
- L1283: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp),`
- L1306: `1` (drift ↑1) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {`
- L1341: `18` (drift ↑2) → `Spacing.s4` — `.padding(18.dp),`
- L1363: `14` (drift ↑2) → `Spacing.s3` — `horizontalArrangement = Arrangement.spacedBy(14.dp),`
- L1384: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L1413: `6` (drift ↑2) → `Spacing.s1` — `Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {`
- L1434: `6` (drift ↑2) → `Spacing.s1` — `Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ContentDetailShell.kt`** (18 matches):
- L130: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`
- L261: `14` (drift ↑2) → `Spacing.s3` — `modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 14.dp),`
- L262: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp),`
- L402: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp),`
- L424: `18` (drift ↑2) → `Spacing.s4` — `.padding(top = 18.dp)`
- L428: `10` (drift ↑2) → `Spacing.s2` — `.padding(10.dp)`
- L476: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L537: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L539: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`
- L622: `10` (drift ↑2) → `Spacing.s2` — `LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {`
- L624: `6` (drift ↑2) → `Spacing.s1` — `Column(modifier = Modifier.width(120.dp), verticalArrangement = Arrangement.s...`
- L666: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L729: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L774: `3` (drift ↓1) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L911: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L935: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L945: `18` (drift ↑2) → `Spacing.s4` — `.padding(horizontal = 18.dp)`
- L949: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/InvoiceDetailScreen.kt`** (1 match):
- L74: `14` (drift ↑2) → `Spacing.s3` — `verticalArrangement = Arrangement.spacedBy(14.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/FeedScreen.kt`** (3 matches):
- L213: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`
- L244: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp, vertical = 10.dp),`
- L327: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/pulse/PulsePostCard.kt`** (3 matches):
- L125: `9` (drift ↑1) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(9.dp),`
- L133: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L239: `14` (drift ↑2) → `Spacing.s3` — `horizontalArrangement = Arrangement.spacedBy(14.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/GigsFeedScreen.kt`** (12 matches):
- L189: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L193: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L239: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L275: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp),`
- L321: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp),`
- L408: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`
- L447: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp, vertical = 10.dp)`
- L511: `6` (drift ↑2) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(6.dp),`
- L548: `6` (drift ↑2) → `Spacing.s1` — `modifier = Modifier.fillMaxWidth().padding(top = 6.dp),`
- L550: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L567: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`
- L692: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/handshake/PrivacyHandshakeScreen.kt`** (10 matches):
- L107: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L184: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L201: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier....`
- L292: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L318: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {`
- L343: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L353: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {`
- L417: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L438: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L469: `10` (drift ↑2) → `Spacing.s2` — `.padding(10.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/bills/BillDetailScreen.kt`** (1 match):
- L288: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/MonthStripHeader.kt`** (4 matches):
- L94: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L241: `6` (drift ↑2) → `Spacing.s1` — `.padding(vertical = 6.dp)`
- L248: `3` (drift ↓1) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(3.dp),`
- L275: `2` (drift ↑2) → `Spacing.s0` — `horizontalArrangement = Arrangement.spacedBy(2.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/invite_owner/InviteOwnerFormScreen.kt`** (1 match):
- L93: `100` (drift ↑36) → `Spacing.s16` — `.padding(bottom = 100.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/members/InviteMemberWizardSheet.kt`** (1 match):
- L223: `2` (drift ↑2) → `Spacing.s0` — `verticalArrangement = Arrangement.spacedBy(2.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/sections/HubSections.kt`** (8 matches):
- L120: `6` (drift ↑2) → `Spacing.s1` — `.padding(6.dp)`
- L422: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement...`
- L434: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L605: `2` (drift ↑2) → `Spacing.s0` — `horizontalArrangement = Arrangement.spacedBy(2.dp),`
- L789: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {`
- L809: `5` (drift ↑1) → `Spacing.s1` — `Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {`
- L860: `2` (drift ↑2) → `Spacing.s0` — `horizontalArrangement = Arrangement.spacedBy(2.dp),`
- L1131: `5` (drift ↑1) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(5.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/identity_center/IdentityCenterScreen.kt`** (10 matches):
- L250: `14` (drift ↑2) → `Spacing.s3` — `.padding(top = 14.dp),`
- L251: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L274: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L277: `14` (drift ↑2) → `Spacing.s3` — `horizontalArrangement = Arrangement.spacedBy(14.dp),`
- L301: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L318: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L351: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.padding(top = 2.dp),`
- L375: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L401: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L518: `2` (drift ↑2) → `Spacing.s0` — `verticalArrangement = Arrangement.spacedBy(2.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ChatListScreen.kt`** (8 matches):
- L146: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L150: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L226: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L240: `5` (drift ↑1) → `Spacing.s1` — `.padding(horizontal = 5.dp),`
- L287: `7` (drift ↓1) → `Spacing.s2` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L341: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`
- L368: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp, vertical = 10.dp)`
- L437: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ConversationRow.kt`** (6 matches):
- L200: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {`
- L201: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L225: `6` (drift ↑2) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(6.dp),`
- L240: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp)`
- L277: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L279: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ChatConversationScreen.kt`** (25 matches):
- L149: `10` (drift ↑2) → `Spacing.s2` — `.padding(horizontal = 10.dp, vertical = 6.dp)`
- L152: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L170: `1` (drift ↑1) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L171: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L183: `5` (drift ↑1) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L230: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L452: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L456: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L478: `7` (drift ↓1) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(7.dp),`
- L504: `18` (drift ↑2) → `Spacing.s4` — `.padding(top = 18.dp, start = 14.dp, end = 14.dp)`
- L507: `10` (drift ↑2) → `Spacing.s2` — `Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {`
- L525: `6` (drift ↑2) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(6.dp),`
- L527: `5` (drift ↑1) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L550: `42` (drift ↑2) → `Spacing.s10` — `modifier = Modifier.padding(start = 42.dp),`
- L551: `7` (drift ↓1) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(7.dp),`
- L610: `6` (drift ↑2) → `Spacing.s1` — `modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),`
- L612: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L701: `13` (drift ↑1) → `Spacing.s3` — `.padding(horizontal = 13.dp, vertical = 9.dp),`
- L752: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp),`
- L828: `6` (drift ↑2) → `Spacing.s1` — `.padding(start = 6.dp)`
- L832: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`
- L862: `7` (drift ↓1) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(7.dp),`
- L869: `9` (drift ↑1) → `Spacing.s2` — `.padding(horizontal = 9.dp, vertical = 5.dp),`
- L870: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`
- L1019: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/newmessage/NewMessageScreen.kt`** (14 matches):
- L265: `18` (drift ↑2) → `Spacing.s4` — `verticalArrangement = Arrangement.spacedBy(18.dp),`
- L275: `10` (drift ↑2) → `Spacing.s2` — `Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {`
- L298: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp, vertical = 10.dp),`
- L300: `11` (drift ↓1) → `Spacing.s3` — `horizontalArrangement = Arrangement.spacedBy(11.dp),`
- L309: `5` (drift ↑1) → `Spacing.s1` — `Column(verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier....`
- L330: `14` (drift ↑2) → `Spacing.s3` — `.padding(start = 14.dp)`
- L390: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontal...`
- L432: `10` (drift ↑2) → `Spacing.s2` — `.padding(horizontal = 10.dp, vertical = 6.dp),`
- L466: `18` (drift ↑2) → `Spacing.s4` — `verticalArrangement = Arrangement.spacedBy(18.dp),`
- L558: `14` (drift ↑2) → `Spacing.s3` — `.padding(start = 14.dp)`
- L589: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp, vertical = 10.dp)`
- L593: `11` (drift ↓1) → `Spacing.s3` — `horizontalArrangement = Arrangement.spacedBy(11.dp),`
- L596: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L744: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/disambiguate/DisambiguateMailFormScreen.kt`** (1 match):
- L131: `110` (drift ↑46) → `Spacing.s16` — `.padding(bottom = 110.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/MailboxItemDetailScreen.kt`** (1 match):
- L128: `100` (drift ↑36) → `Spacing.s16` — `.padding(bottom = 100.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/MailDetailScreen.kt`** (6 matches):
- L144: `110` (drift ↑46) → `Spacing.s16` — `.padding(bottom = 110.dp),`
- L418: `1` (drift ↑1) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L529: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L540: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.padding(top = 2.dp),`
- L618: `14` (drift ↑2) → `Spacing.s3` — `.padding(vertical = 14.dp)`
- L664: `10` (drift ↑2) → `Spacing.s2` — `.padding(vertical = 10.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/BookletPager.kt`** (1 match):
- L321: `1` (drift ↑1) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt`** (6 matches):
- L75: `9` (drift ↑1) → `Spacing.s2` — `.padding(horizontal = 9.dp, vertical = 6.dp)`
- L78: `2` (drift ↑2) → `Spacing.s0` — `verticalArrangement = Arrangement.spacedBy(2.dp),`
- L96: `1` (drift ↑1) → `Spacing.s0` — `horizontalArrangement = Arrangement.spacedBy(1.dp),`
- L212: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L321: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L387: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/BookletDetailLayout.kt`** (4 matches):
- L291: `1` (drift ↑1) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L362: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L395: `14` (drift ↑2) → `Spacing.s3` — `.padding(vertical = 14.dp)`
- L444: `10` (drift ↑2) → `Spacing.s2` — `.padding(vertical = 10.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CertifiedDetailLayout.kt`** (2 matches):
- L667: `18` (drift ↑2) → `Spacing.s4` — `.padding(horizontal = 18.dp),`
- L696: `14` (drift ↑2) → `Spacing.s3` — `.padding(vertical = 14.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CommunityDetailLayout.kt`** (19 matches):
- L443: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 2.dp),`
- L560: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier....`
- L591: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier....`
- L611: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`
- L612: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.padding(top = 2.dp),`
- L642: `6` (drift ↑2) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(6.dp),`
- L653: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L661: `3` (drift ↓1) → `Spacing.s1` — `modifier = Modifier.padding(top = 3.dp),`
- L731: `3` (drift ↓1) → `Spacing.s1` — `.padding(vertical = 3.dp),`
- L747: `6` (drift ↑2) → `Spacing.s1` — `.padding(vertical = 6.dp),`
- L749: `1` (drift ↑1) → `Spacing.s0` — `verticalArrangement = Arrangement.spacedBy(1.dp),`
- L818: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier....`
- L841: `2` (drift ↑2) → `Spacing.s0` — `horizontalArrangement = Arrangement.spacedBy(2.dp),`
- L1042: `1` (drift ↑1) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {`
- L1165: `9` (drift ↑1) → `Spacing.s2` — `.padding(vertical = 9.dp)`
- L1240: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L1251: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.padding(top = 2.dp),`
- L1312: `14` (drift ↑2) → `Spacing.s3` — `.padding(vertical = 14.dp)`
- L1447: `10` (drift ↑2) → `Spacing.s2` — `.padding(vertical = 10.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/marketplace/MarketplaceScreen.kt`** (14 matches):
- L172: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L176: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L260: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L310: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L311: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L371: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`
- L410: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp, vertical = 10.dp)`
- L449: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L450: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L476: `3` (drift ↓1) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(3.dp),`
- L542: `6` (drift ↑2) → `Spacing.s1` — `.padding(start = 6.dp, top = 6.dp)`
- L545: `7` (drift ↓1) → `Spacing.s2` — `.padding(horizontal = 7.dp, vertical = 2.dp),`
- L578: `5` (drift ↑1) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(5.dp),`
- L646: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/nearby/map/NearbyMapScreen.kt`** (15 matches):
- L181: `56` (drift ↑8) → `Spacing.s12` — `.padding(top = 56.dp)`
- L491: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L493: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L514: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp),`
- L550: `14` (drift ↑2) → `Spacing.s3` — `.padding(end = 14.dp, bottom = animatedBottom)`
- L812: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L894: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L941: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L976: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L1001: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L1054: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L1061: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`
- L1087: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.padding(top = 2.dp),`
- L1108: `7` (drift ↓1) → `Spacing.s2` — `.padding(horizontal = 7.dp, vertical = 1.dp),`
- L1130: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp, alignment = Alignment.Cent...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/posts/PulsePostDetailScreen.kt`** (1 match):
- L108: `100` (drift ↑36) → `Spacing.s16` — `.padding(bottom = 100.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileScreen.kt`** (1 match):
- L111: `100` (drift ↑36) → `Spacing.s16` — `.padding(bottom = 100.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/root/PantopusBottomBar.kt`** (1 match):
- L157: `3` (drift ↓1) → `Spacing.s1` — `.padding(horizontal = 3.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/Headers.kt`** (1 match):
- L91: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/BodyReactionsBody.kt`** (1 match):
- L405: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/StatsTabsBody.kt`** (1 match):
- L396: `2` (drift ↑2) → `Spacing.s0` — `Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/feed/FeedComponents.kt`** (4 matches):
- L89: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L160: `9` (drift ↑1) → `Spacing.s2` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L162: `5` (drift ↑1) → `Spacing.s1` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L173: `14` (drift ↑2) → `Spacing.s3` — `Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = ...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/grouped_list/GroupedListScreen.kt`** (4 matches):
- L358: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.padding(top = 2.dp),`
- L493: `6` (drift ↑2) → `Spacing.s1` — `.padding(top = 6.dp)`
- L554: `2` (drift ↑2) → `Spacing.s0` — `Row(modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {`
- L610: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherPillRow.kt`** (3 matches):
- L65: `3` (drift ↓1) → `Spacing.s1` — `.padding(3.dp)`
- L67: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L84: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherSheet.kt`** (5 matches):
- L105: `10` (drift ↑2) → `Spacing.s2` — `verticalArrangement = Arrangement.spacedBy(10.dp),`
- L132: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L155: `3` (drift ↓1) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(3.dp),`
- L159: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L205: `6` (drift ↑2) → `Spacing.s1` — `.padding(horizontal = 6.dp, vertical = 1.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/ListOfRowsScreen.kt`** (4 matches):
- L623: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`
- L1477: `2` (drift ↑2) → `Spacing.s0` — `Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement...`
- L1771: `52` (drift ↑4) → `Spacing.s12` — `.padding(start = 52.dp)`
- L1890: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/ChainOfCustodyTimeline.kt`** (3 matches):
- L127: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L167: `11` (drift ↓1) → `Spacing.s3` — `.padding(start = 11.dp, top = Spacing.s2, bottom = Spacing.s2)`
- L193: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/MailItemDetailShell.kt`** (6 matches):
- L236: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L262: `2` (drift ↑2) → `Spacing.s0` — `horizontalArrangement = Arrangement.spacedBy(2.dp),`
- L435: `3` (drift ↓1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(3.dp),`
- L475: `1` (drift ↑1) → `Spacing.s0` — `.padding(top = 1.dp)`
- L562: `60` (drift ↓4) → `Spacing.s16` — `modifier = Modifier.padding(start = 60.dp),`
- L582: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt`** (6 matches):
- L105: `14` (drift ↑2) → `Spacing.s3` — `.padding(end = 14.dp, bottom = detent.height + 14.dp)`
- L215: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp)`
- L217: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L237: `5` (drift ↑1) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(5.dp),`
- L386: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L427: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridShell.kt`** (2 matches):
- L169: `56` (drift ↑8) → `Spacing.s12` — `.padding(top = 56.dp)`
- L181: `14` (drift ↑2) → `Spacing.s3` — `.padding(end = 14.dp, bottom = targetHeightDp + 14.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/status/StatusWaitingScreen.kt`** (7 matches):
- L83: `10` (drift ↑2) → `Spacing.s2` — `Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {`
- L157: `10` (drift ↑2) → `Spacing.s2` — `.padding(horizontal = 10.dp, vertical = 6.dp)`
- L160: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L208: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L238: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L260: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.padding(top = 2.dp),`
- L360: `10` (drift ↑2) → `Spacing.s2` — `Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/token_accept/TokenAcceptScreen.kt`** (12 matches):
- L177: `6` (drift ↑2) → `Spacing.s1` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L227: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L254: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L275: `2` (drift ↑2) → `Spacing.s0` — `Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {`
- L302: `14` (drift ↑2) → `Spacing.s3` — `.padding(14.dp)`
- L324: `2` (drift ↑2) → `Spacing.s0` — `modifier = Modifier.padding(top = 2.dp),`
- L347: `10` (drift ↑2) → `Spacing.s2` — `horizontalArrangement = Arrangement.spacedBy(10.dp),`
- L355: `1` (drift ↑1) → `Spacing.s0` — `modifier = Modifier.padding(top = 1.dp),`
- L368: `10` (drift ↑2) → `Spacing.s2` — `.padding(horizontal = 10.dp, vertical = 6.dp)`
- L437: `6` (drift ↑2) → `Spacing.s1` — `horizontalArrangement = Arrangement.spacedBy(6.dp),`
- L589: `10` (drift ↑2) → `Spacing.s2` — `Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {`
- L632: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/you/me/MeView.kt`** (9 matches):
- L208: `14` (drift ↑2) → `Spacing.s3` — `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = A...`
- L210: `2` (drift ↑2) → `Spacing.s0` — `Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spac...`
- L326: `2` (drift ↑2) → `Spacing.s0` — `verticalArrangement = Arrangement.spacedBy(2.dp),`
- L412: `6` (drift ↑2) → `Spacing.s1` — `verticalArrangement = Arrangement.spacedBy(6.dp),`
- L433: `6` (drift ↑2) → `Spacing.s1` — `.padding(6.dp)`
- L437: `5` (drift ↑1) → `Spacing.s1` — `.padding(horizontal = 5.dp, vertical = 1.dp),`
- L519: `14` (drift ↑2) → `Spacing.s3` — `.padding(start = 14.dp + 17.dp + 12.dp)`
- L549: `14` (drift ↑2) → `Spacing.s3` — `.padding(horizontal = 14.dp, vertical = 14.dp)`
- L606: `22` (drift ↑2) → `Spacing.s5` — `.padding(horizontal = 22.dp)`

## C. Android — Off-scale radii

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/AudienceProfileScreen.kt`** (12 matches):
- L340: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L451: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L453: `14` (drift ↑2) → `Radii.lg` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))`
- L499: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L538: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L620: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L695: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L697: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))`
- L800: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L805: `999` (drift ↑975) → `Radii.xl3` — `RoundedCornerShape(999.dp),`
- L975: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L1003: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/reset_password/ResetPasswordScreen.kt`** (1 match):
- L296: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/sign_up/SignUpScreen.kt`** (1 match):
- L386: `3` (drift ↓1) → `Radii.xs` — `.clip(RoundedCornerShape(3.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail/CeremonialMailWizardScreen.kt`** (13 matches):
- L189: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L191: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp)),`
- L254: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L256: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.success, RoundedCornerShape(10.dp))`
- L298: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L303: `10` (drift ↑2) → `Radii.md` — `shape = RoundedCornerShape(10.dp),`
- L420: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L422: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))`
- L535: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L540: `999` (drift ↑975) → `Radii.xl3` — `RoundedCornerShape(999.dp),`
- L630: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L725: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L730: `10` (drift ↑2) → `Radii.md` — `RoundedCornerShape(10.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt`** (17 matches):
- L246: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L506: `3` (drift ↓1) → `Radii.xs` — `.clip(RoundedCornerShape(3.dp))`
- L553: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L555: `999` (drift ↑975) → `Radii.xl3` — `.border(1.dp, Color.White.copy(alpha = 0.22f), RoundedCornerShape(999.dp))`
- L604: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L1042: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L1044: `999` (drift ↑975) → `Radii.xl3` — `.border(1.dp, letter.ink.color.copy(alpha = 0.13f), RoundedCornerShape(999.dp))`
- L1139: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L1154: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L1156: `999` (drift ↑975) → `Radii.xl3` — `.border(1.dp, letter.ink.color.copy(alpha = 0.13f), RoundedCornerShape(999.dp))`
- L1260: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L1280: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L1282: `14` (drift ↑2) → `Radii.lg` — `.border(1.dp, letter.ink.color.copy(alpha = 0.12f), RoundedCornerShape(14.dp))`
- L1338: `18` (drift ↑2) → `Radii.xl` — `.clip(RoundedCornerShape(18.dp))`
- L1340: `18` (drift ↑2) → `Radii.xl` — `.border(1.dp, letter.ink.color.copy(alpha = 0.12f), RoundedCornerShape(18.dp))`
- L1461: `9` (drift ↑1) → `Radii.md` — `.clip(RoundedCornerShape(9.dp))`
- L1463: `9` (drift ↑1) → `Radii.md` — `.border(1.dp, letter.ink.color.copy(alpha = 0.13f), RoundedCornerShape(9.dp)),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ContentDetailShell.kt`** (7 matches):
- L270: `5` (drift ↑1) → `Radii.xs` — `.clip(RoundedCornerShape(5.dp))`
- L466: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L468: `14` (drift ↑2) → `Radii.lg` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))`
- L567: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L569: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))`
- L603: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L629: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/handshake/PrivacyHandshakeScreen.kt`** (4 matches):
- L126: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L181: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L183: `14` (drift ↑2) → `Radii.lg` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))`
- L340: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/identity_center/IdentityCenterScreen.kt`** (2 matches):
- L373: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L399: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/MailDetailScreen.kt`** (2 matches):
- L604: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L611: `14` (drift ↑2) → `Radii.lg` — `shape = RoundedCornerShape(14.dp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/BookletPager.kt`** (2 matches):
- L284: `2` (drift ↓2) → `Radii.xs` — `.clip(RoundedCornerShape(2.dp))`
- L293: `2` (drift ↓2) → `Radii.xs` — `.clip(RoundedCornerShape(2.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/BookletDetailLayout.kt`** (1 match):
- L392: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CertifiedDetailLayout.kt`** (4 matches):
- L449: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L451: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.successLight, RoundedCornerShape(10.dp))`
- L686: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L690: `14` (drift ↑2) → `Radii.lg` — `Modifier.border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CommunityDetailLayout.kt`** (15 matches):
- L310: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L312: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.successLight, RoundedCornerShape(10.dp))`
- L638: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L640: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(10.dp))`
- L682: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L684: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.infoLight, RoundedCornerShape(10.dp))`
- L723: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L724: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp)),`
- L776: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L778: `10` (drift ↑2) → `Radii.md` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp)),`
- L1129: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L1161: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L1163: `10` (drift ↑2) → `Radii.md` — `.border(1.5.dp, PantopusColors.primary200, RoundedCornerShape(10.dp))`
- L1308: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L1310: `14` (drift ↑2) → `Radii.lg` — `.border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/marketplace/MarketplaceScreen.kt`** (4 matches):
- L467: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L469: `14` (drift ↑2) → `Radii.lg` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))`
- L565: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L567: `14` (drift ↑2) → `Radii.lg` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp)),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/nearby/map/NearbyMapScreen.kt`** (6 matches):
- L930: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L935: `14` (drift ↑2) → `Radii.lg` — `shape = RoundedCornerShape(14.dp),`
- L937: `14` (drift ↑2) → `Radii.lg` — `.shadow(elevation = 2.dp, shape = RoundedCornerShape(14.dp))`
- L948: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L1036: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L1140: `5` (drift ↑1) → `Radii.xs` — `.clip(RoundedCornerShape(5.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/settings/about/AboutScreen.kt`** (1 match):
- L54: `22` (drift ↑2) → `Radii.xl2` — `.clip(RoundedCornerShape(22.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/grouped_list/GroupedListScreen.kt`** (2 matches):
- L519: `2` (drift ↓2) → `Radii.xs` — `.clip(RoundedCornerShape(2.dp))`
- L529: `2` (drift ↓2) → `Radii.xs` — `.clip(RoundedCornerShape(2.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherSheet.kt`** (3 matches):
- L124: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L129: `14` (drift ↑2) → `Radii.lg` — `shape = RoundedCornerShape(14.dp),`
- L203: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/ListOfRowsScreen.kt`** (1 match):
- L1201: `11` (drift ↓1) → `Radii.lg` — `.clip(RoundedCornerShape(11.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt`** (5 matches):
- L418: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L423: `14` (drift ↑2) → `Radii.lg` — `shape = RoundedCornerShape(14.dp),`
- L425: `14` (drift ↑2) → `Radii.lg` — `.shadow(elevation = 2.dp, shape = RoundedCornerShape(14.dp))`
- L434: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L480: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/status/StatusWaitingScreen.kt`** (3 matches):
- L155: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L297: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L317: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/token_accept/TokenAcceptScreen.kt`** (11 matches):
- L158: `14` (drift ↑2) → `Radii.lg` — `.clip(RoundedCornerShape(14.dp))`
- L160: `14` (drift ↑2) → `Radii.lg` — `.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))`
- L202: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L222: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L342: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L366: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L411: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L429: `10` (drift ↑2) → `Radii.md` — `.clip(RoundedCornerShape(10.dp))`
- L593: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L605: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`
- L629: `999` (drift ↑975) → `Radii.xl3` — `.clip(RoundedCornerShape(999.dp))`

## D. Android — Off-scale fonts

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/AudienceProfileScreen.kt`** (21 matches):
- L196: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L203: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L240: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L247: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L321: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L326: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = it, fontSize = 13.sp, color = PantopusColors.appTextSecondary)`
- L332: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L354: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L381: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L517: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L548: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L626: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L704: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L711: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L716: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `Text(text = it, fontSize = 10.sp, color = PantopusColors.success)`
- L776: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L876: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L881: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `Text(text = it, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary)`
- L984: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1009: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1023: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `Text(text = row.timeAgo, fontSize = 10.5.sp, color = PantopusColors.appTextSe...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/LoginScreen.kt`** (1 match):
- L231: `1` (drift ↓10) → `PantopusTextStyle.overline (11)` — `fontSize = 1.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail/CeremonialMailWizardScreen.kt`** (15 matches):
- L155: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `Text(text = "Who are you writing to?", fontSize = 18.sp, fontWeight = FontWei...`
- L161: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L277: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L343: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L361: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `Text(text = "Address it", fontSize = 18.sp, fontWeight = FontWeight.Bold, col...`
- L364: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L381: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `Text(text = display, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, co...`
- L460: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `Text(text = "Write it", fontSize = 18.sp, fontWeight = FontWeight.Bold, color...`
- L463: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L648: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L665: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `Text(text = "Seal and send", fontSize = 18.sp, fontWeight = FontWeight.Bold, ...`
- L668: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L711: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = value, fontSize = 13.sp, color = PantopusColors.appText)`
- L782: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L788: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt`** (31 matches):
- L236: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L241: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)`
- L256: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L393: `28` (drift ↓2) → `PantopusTextStyle.h1 (30)` — `fontSize = 28.sp,`
- L539: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L583: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L589: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L648: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L701: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L759: `19` (drift ↓1) → `PantopusTextStyle.h3 (20)` — `fontSize = 19.sp,`
- L766: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L837: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L908: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L940: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L963: `6` (drift ↓5) → `PantopusTextStyle.overline (11)` — `fontSize = 6.sp,`
- L970: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L976: `6` (drift ↓5) → `PantopusTextStyle.overline (11)` — `fontSize = 6.sp,`
- L1003: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L1009: `28` (drift ↓2) → `PantopusTextStyle.h1 (30)` — `fontSize = 28.sp,`
- L1033: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1164: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = "Save", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color...`
- L1214: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1251: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L1301: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L1315: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1324: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L1347: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1355: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1370: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L1377: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L1392: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ContentDetailShell.kt`** (30 matches):
- L117: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L122: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `Text(text = message, fontSize = 13.5.sp, color = PantopusColors.appTextSecond...`
- L303: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L330: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L355: `32` (drift ↑2) → `PantopusTextStyle.h1 (30)` — `fontSize = 32.sp,`
- L437: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `Text(text = stat.top, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color...`
- L439: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `Text(text = stat.bottom, fontSize = 10.sp, fontWeight = FontWeight.Medium, co...`
- L479: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L490: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L497: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `Text(text = "$prefix$it", fontSize = 11.5.sp, fontWeight = FontWeight.Medium,...`
- L542: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `Text(text = label, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = fg,...`
- L555: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L575: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `Text(text = module.label, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBol...`
- L586: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L636: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L672: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L685: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L733: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L738: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `sub?.let { Text(text = "· $it", fontSize = 10.sp, color = PantopusColors.appT...`
- L766: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L772: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = party.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color...`
- L776: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `Text(text = party.sub, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, co...`
- L800: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L807: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L815: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L823: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L889: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = row.label, fontSize = 13.sp, fontWeight = FontWeight.Medium, colo...`
- L890: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = row.value, fontSize = 13.sp, fontWeight = FontWeight.Medium, colo...`
- L895: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = summary.totalLabel, fontSize = 13.sp, fontWeight = FontWeight.Bol...`
- L986: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `Text(text = dock.primary.label, fontSize = 14.5.sp, fontWeight = FontWeight.B...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/GigDetailScreen.kt`** (2 matches):
- L87: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L93: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/InvoiceDetailScreen.kt`** (2 matches):
- L84: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L92: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ListingDetailScreen.kt`** (2 matches):
- L92: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `Text(text = "Make an offer", fontSize = 18.sp, fontWeight = FontWeight.Bold, ...`
- L95: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/FeedScreen.kt`** (5 matches):
- L134: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L203: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L256: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L310: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L317: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/pulse/PulsePostCard.kt`** (8 matches):
- L95: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L105: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L136: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L144: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L259: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L300: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L307: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L338: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/GigsFeedScreen.kt`** (16 matches):
- L154: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L203: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L246: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L279: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L285: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L332: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L398: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L460: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L465: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L471: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L521: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L599: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L627: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L645: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L675: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L682: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/handshake/PrivacyHandshakeScreen.kt`** (14 matches):
- L118: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L122: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `Text(text = message, fontSize = 12.5.sp, color = PantopusColors.appTextSecond...`
- L136: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L196: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L243: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L268: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `Text(text = it, fontSize = 11.5.sp, fontWeight = FontWeight.Medium, color = P...`
- L321: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L327: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L356: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L362: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L385: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L442: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L543: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L576: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/MonthStripHeader.kt`** (2 matches):
- L128: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L252: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/sections/HubSections.kt`** (14 matches):
- L95: `17` (drift ↑1) → `PantopusTextStyle.body (16)` — `style = PantopusTextStyle.body.copy(fontSize = 17.sp, fontWeight = FontWeight...`
- L214: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWei...`
- L327: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L338: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L346: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `style = PantopusTextStyle.caption.copy(fontSize = 13.sp),`
- L365: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWei...`
- L539: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWei...`
- L566: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L702: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWei...`
- L717: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L794: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L802: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWei...`
- L828: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `Text(it, style = PantopusTextStyle.caption.copy(fontSize = 10.sp), color = Pa...`
- L967: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWei...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/identity_center/IdentityCenterScreen.kt`** (9 matches):
- L305: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L322: `15.5` (drift ↓0.5) → `PantopusTextStyle.body (16)` — `fontSize = 15.5.sp,`
- L340: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L348: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L379: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L405: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L522: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L604: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L611: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ChatListScreen.kt`** (8 matches):
- L106: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L160: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L229: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L245: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L331: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L381: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L424: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L429: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `Text(text = message, fontSize = 13.5.sp, color = PantopusColors.appTextSecond...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ConversationRow.kt`** (5 matches):
- L204: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `fontSize = 14.5.sp,`
- L213: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L229: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L246: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L284: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ChatConversationScreen.kt`** (14 matches):
- L195: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L235: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L416: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L426: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L461: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L536: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L555: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L668: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L757: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L763: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L796: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L842: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L1006: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L1011: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `Text(text = message, fontSize = 13.5.sp, color = PantopusColors.appTextSecond...`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/newmessage/NewMessageScreen.kt`** (12 matches):
- L137: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L204: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L213: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L384: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L416: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L444: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L510: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L599: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L618: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L676: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L726: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L733: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/disambiguate/DisambiguateMailFormScreen.kt`** (1 match):
- L186: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CertifiedBody.kt`** (1 match):
- L53: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CouponHero.kt`** (2 matches):
- L59: `28` (drift ↓2) → `PantopusTextStyle.h1 (30)` — `fontSize = 28.sp,`
- L68: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/MailDetailScreen.kt`** (10 matches):
- L112: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L148: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L324: `19` (drift ↓1) → `PantopusTextStyle.h3 (20)` — `fontSize = 19.sp,`
- L332: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L360: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L428: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L469: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L552: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L644: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L677: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/BookletPager.kt`** (3 matches):
- L193: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L201: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L467: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt`** (10 matches):
- L82: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L89: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L111: `8` (drift ↓3) → `PantopusTextStyle.overline (11)` — `fontSize = 8.sp,`
- L216: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L221: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `Text(text = it, fontSize = 11.5.sp, color = PantopusColors.appTextSecondary)`
- L269: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L325: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L332: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L366: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L399: `9.5` (drift ↓1.5) → `PantopusTextStyle.overline (11)` — `fontSize = 9.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/BookletDetailLayout.kt`** (6 matches):
- L200: `19` (drift ↓1) → `PantopusTextStyle.h3 (20)` — `fontSize = 19.sp,`
- L208: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L236: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L301: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L410: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L457: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CertifiedDetailLayout.kt`** (7 matches):
- L367: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L422: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L499: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L530: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L668: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L711: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L744: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CommunityDetailLayout.kt`** (21 matches):
- L289: `19` (drift ↓1) → `PantopusTextStyle.h3 (20)` — `fontSize = 19.sp,`
- L361: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L433: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `fontSize = 14.5.sp,`
- L447: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L665: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L698: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L736: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L753: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L760: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L929: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L966: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L998: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1037: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L1045: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L1051: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L1145: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1175: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L1263: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L1328: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L1405: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `Text(text = label, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = ...`
- L1456: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/marketplace/MarketplaceScreen.kt`** (14 matches):
- L151: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L188: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L198: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L267: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L359: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L423: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L428: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L434: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L480: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L490: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L497: `9.5` (drift ↓1.5) → `PantopusTextStyle.overline (11)` — `fontSize = 9.5.sp,`
- L549: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L628: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L635: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/nearby/map/NearbyMapScreen.kt`** (13 matches):
- L527: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L817: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L832: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L865: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L966: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L981: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L989: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L1005: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1065: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L1074: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L1081: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L1097: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L1112: `9.5` (drift ↓1.5) → `PantopusTextStyle.overline (11)` — `fontSize = 9.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/root/PantopusBottomBar.kt`** (2 matches):
- L138: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `style = PantopusTextStyle.caption.copy(fontSize = 10.sp),`
- L162: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `style = PantopusTextStyle.caption.copy(fontSize = 9.sp),`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/settings/about/AboutScreen.kt`** (1 match):
- L61: `44` (drift ↑14) → `PantopusTextStyle.h1 (30)` — `fontSize = 44.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/BodyReactionsBody.kt`** (1 match):
- L95: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/StatsTabsBody.kt`** (1 match):
- L160: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/feed/FeedComponents.kt`** (1 match):
- L95: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/grouped_list/GroupedListScreen.kt`** (5 matches):
- L221: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L347: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L472: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L593: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L600: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherSheet.kt`** (5 matches):
- L100: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L163: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L174: `14.5` (drift ↑0.5) → `PantopusTextStyle.small (14)` — `fontSize = 14.5.sp,`
- L182: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L209: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/ListOfRowsScreen.kt`** (4 matches):
- L548: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L1048: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L1633: `7` (drift ↓4) → `PantopusTextStyle.overline (11)` — `fontSize = 7.sp,`
- L1655: `7` (drift ↓4) → `PantopusTextStyle.overline (11)` — `fontSize = 7.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/ChainOfCustodyTimeline.kt`** (4 matches):
- L152: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L200: `12.5` (drift ↑0.5) → `PantopusTextStyle.caption (12)` — `fontSize = 12.5.sp,`
- L212: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L225: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/MailItemDetailShell.kt`** (5 matches):
- L215: `15` (drift ↑1) → `PantopusTextStyle.small (14)` — `fontSize = 15.sp,`
- L422: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L454: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L585: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L633: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt`** (4 matches):
- L250: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L370: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L448: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L494: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/status/StatusWaitingScreen.kt`** (3 matches):
- L136: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L244: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L264: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/token_accept/TokenAcceptScreen.kt`** (17 matches):
- L173: `22` (drift ↑2) → `PantopusTextStyle.h3 (20)` — `fontSize = 22.sp,`
- L185: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = offer.venue, fontSize = 13.sp, color = PantopusColors.appTextSeco...`
- L209: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L238: `11.5` (drift ↑0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 11.5.sp,`
- L278: `10.5` (drift ↓0.5) → `PantopusTextStyle.overline (11)` — `fontSize = 10.5.sp,`
- L308: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L328: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L490: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L515: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L522: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L550: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L555: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)`
- L582: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L587: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)`
- L600: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `Text(text = "Close", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ...`
- L615: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`
- L639: `13` (drift ↑1) → `PantopusTextStyle.caption (12)` — `fontSize = 13.sp,`

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/you/me/MeView.kt`** (10 matches):
- L247: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L278: `26` (drift ↑2) → `PantopusTextStyle.h2 (24)` — `fontSize = 26.sp,`
- L330: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L336: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L442: `9` (drift ↓2) → `PantopusTextStyle.overline (11)` — `fontSize = 9.sp,`
- L460: `10` (drift ↓1) → `PantopusTextStyle.overline (11)` — `fontSize = 10.sp,`
- L493: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L562: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `fontSize = 13.5.sp,`
- L592: `18` (drift ↑2) → `PantopusTextStyle.body (16)` — `fontSize = 18.sp,`
- L598: `13.5` (drift ↓0.5) → `PantopusTextStyle.small (14)` — `Text(text = message, fontSize = 13.5.sp, color = PantopusColors.appTextSecond...`

## E. Android — Frame width/height literals (informational)

`Modifier.size / width / height` literals are often legitimate for fixed-geometry shapes per the DoD. Listed here by file so they can be spot-checked during P1+ refactors. **Not flagged as hard drift.**

- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt` — 27 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ContentDetailShell.kt` — 20 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/token_accept/TokenAcceptScreen.kt` — 17 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/AudienceProfileScreen.kt` — 14 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ChatConversationScreen.kt` — 9 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/ListOfRowsScreen.kt` — 7 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/grouped_list/GroupedListScreen.kt` — 7 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CommunityDetailLayout.kt` — 7 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/newmessage/NewMessageScreen.kt` — 7 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail/CeremonialMailWizardScreen.kt` — 7 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/identity_center/IdentityCenterScreen.kt` — 5 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/nearby/map/NearbyMapScreen.kt` — 4 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/handshake/PrivacyHandshakeScreen.kt` — 4 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/sections/HubSections.kt` — 3 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/verify_email/VerifyEmailScreen.kt` — 3 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/sign_up/SignUpScreen.kt` — 3 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/_internal/TokenGalleryScreen.kt` — 3 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/status/StatusWaitingScreen.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/blocks/UploadSlotsBlock.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/MailItemDetailShell.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/form/FormShell.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/headers/PostAuthorHeader.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/BodyReactionsBody.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/ContentDetailShell.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ConversationRow.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ChatListScreen.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/MonthStripHeader.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/FeedScreen.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ListingDetailScreen.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/InvoiceDetailScreen.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/GigDetailScreen.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/reset_password/ResetPasswordScreen.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/LoginScreen.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/TimelineStepper.kt` — 2 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/you/me/MeView.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/blocks/TimelineBlock.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/blocks/ReviewSummaryBlock.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridShell.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/headers/ProfileHeader.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/StatsTabsBody.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/my_bids/MyBidsScreen.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/marketplace/MarketplaceScreen.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/BookletPager.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/BookletPageSwiper.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/MailboxItemDetailShell.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/disambiguate/DisambiguateMailFormScreen.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/HubScreen.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/polls/PollResultBar.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/members/InviteMemberWizardSheet.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/forgot_password/ForgotPasswordScreen.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/_internal/ComponentGalleryScreen.kt` — 1 frame literals
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/Buttons.kt` — 1 frame literals

**Total Android frame literals:** 202 across 54 files.


---

# Token verification

Five suggestions in this audit are cross-checked against the canonical token sources:

| Suggested token | Verified against | Verified value |
|---|---|---|
| `Spacing.s3` | `frontend/apps/ios/Pantopus/Core/Design/Spacing.swift:20` | `public static let s3: CGFloat = 12` |
| `Spacing.s2` (Android) | `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Spacing.kt:21` | `val s2: Dp = 8.dp` |
| `Radii.lg` | `frontend/apps/ios/Pantopus/Core/Design/Radii.swift:19` | `public static let lg: CGFloat = 12` |
| `Radii.xl` (Android) | `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Radii.kt:23` | `val xl: Dp = 16.dp` |
| `PantopusTextStyle.body` | `frontend/apps/ios/Pantopus/Core/Design/Typography.swift:28` | `case .body: 16` (size) / `case .body: 24` (lineHeight) |
| `PantopusTextStyle.h2` (Android) | `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Typography.kt:36` | `fontSize = 24.sp, lineHeight = 32.sp` |

# Recommendations (for follow-up prompts, not this PR)

1. **Spacing/radii sweeps are mechanical** — most off-scale values are 1–2 pt/dp away from a token and can be auto-rewritten with sed-style replacements. iOS spacing has only 20 sites; Android has 327. Schedule per-feature passes.
2. **Off-scale fonts (354 iOS / 362 Android) are the largest single category.** Almost all are 1–2 sp/pt off the canonical scale (e.g. `13.5pt` → `14pt`, `22pt` → `24pt`, `9pt` → `11pt`/`12pt`). A few outliers — `6pt` font in `CeremonialMailOpenView.swift:690,695` — may violate accessibility minimums and should be raised in P1.
3. **Stationery palette in `CeremonialMail*Content.{swift,kt}`** (47 + 51 hex literals) is not currently in the token system but follows the category-palette pattern. Either (a) extend the design system with stationery tokens, or (b) formally annotate the stationery enum as an allowed-palette extension in CLAUDE.md.
4. **`MailItemDetailShell.{swift,kt}` status colors** (18 + 18 hex literals) are also unmapped to existing tokens — design review needed to decide whether to lift these to `Theme.Color` / `PantopusColors`.
5. **CI guard extension** — the existing hex-grep guard catches new hex literals in `Features/**` / `ui/screens/**`. Extending it to also block off-scale spacing/radii/font literals would prevent further drift while these sweeps run.

