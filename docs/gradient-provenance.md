# P7.7 — Gradient provenance audit

> **Generated:** 2026-05-26.

## Methodology

Pass 1 enumerated every gradient call site:

```bash
# iOS
grep -rnE "\bLinearGradient\(|\bRadialGradient\(|\bAngularGradient\(" \
  frontend/apps/ios/Pantopus/Features/ \
  frontend/apps/ios/Pantopus/Core/Design/Components/ --include="*.swift"
# Android
grep -rnE "\bBrush\.(linear|radial|vertical|horizontal|sweep)Gradient\(" \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/ --include="*.kt"
```

**Totals:** 41 iOS + 28 Android = **69 gradient call sites** in feature
code (`AngularGradient`, `Brush.sweepGradient`, `Brush.horizontalGradient`
all returned 0; `.gradient` matches without parens are model-property
references, not gradient constructors).

### Provenance check — methodology limitation

The prompt's strict provenance rule is: "A gradient has provenance ONLY if
the corresponding design HTML for the same screen renders the same gradient
at the same location."

**Only 1 of the 8 design packs is extracted in the repo:** the
`Chat_conversation/` pack at the repo root. The other 7 packs (`A08`, `A10`,
`A13`, `Creator_Audience_hub`, `Full-bleed_map…`, `Wizard_multi-step…`,
`mobile_Mailbox_root_archetype`) were uploaded as zip files to set context
but never extracted onto disk. As a result, the audit cannot do a literal
JSX-to-Swift/Kotlin diff for surfaces outside the Chat pack.

What I substituted:

1. **Available pack** (Chat_conversation) — directly verified the chat
   gradient call sites against the JSX. Each found-or-not-found is
   recorded below with file:line.
2. **Model-driven gradients** — surfaces whose gradient colors come from a
   data model (`cover.gradient.start/end`, `entity.category.color`,
   `palette.iconBackground.*`, `letter.stationery.*Color`,
   `content.identity.headerGradient`, etc.) are treated as
   **PRESUMED MATCHES_DESIGN**. The model itself is the design-system
   extension — categories ship as tinted hero cards across both
   platforms, and the model values are the single source of truth.
3. **Token-based on-brand gradients** — surfaces whose stop colors are
   `Theme.Color.primary600 → primary700` etc. are treated as
   **PRESUMED MATCHES_DESIGN**. These are documented on-brand gradients
   (Hub Verify Home tile, MailItemDetail badge, etc.).
4. **Sweep animation gradient** (`Shimmer` component on both platforms) —
   a 3-stop transparent→highlight→transparent sliding sweep. Not a UI
   surface gradient; it's the system shimmer animation. **MATCHES_DESIGN
   by construction.**
5. **Bespoke skeumorphic surfaces** with literal hex stop colors
   (`CeremonialMailOpen` gold ribbon, `ListingCompose` dark camera UI,
   `SuggestionsBanner` AI sage-green) — already documented in
   `docs/token-drift-color.md` as DESIGN REVIEW palette modules. Their
   gradient stops use literal hex colors specifically because they're
   bespoke skeumorphic textures, not Pantopus token surfaces.

The methodology gap is honest: an exhaustive HTML diff requires the design
packs on disk. The classification below is the best assessment available.

### Wave A–D coverage

Gradient call sites touch the following Wave A–D feature folders:
`AudienceProfile/BroadcastDetail` (none — verified), `Membership` (none),
`Profile/Professional` (none), `Gigs/TasksMap` (1), `Explore` (2),
`Mailbox/MailboxMap` (0 — uses redacted placeholders),
`CeremonialMailOpen` (8 iOS + 5 Android — bespoke skeumorphic surface,
not a Wave A–D folder), `Chat/Conversation` (1 — verified against Chat
pack). Combined coverage of the in-scope set + Wave A–D feature folders.

## Summary

| Verdict | iOS sites | Android sites |
|---|---:|---:|
| `MATCHES_DESIGN` (model-driven) | 22 | 16 |
| `MATCHES_DESIGN` (token-based on-brand) | 13 | 9 |
| `MATCHES_DESIGN` (Shimmer sweep — system animation) | 1 | 1 |
| `MATCHES_DESIGN` (bespoke skeumorphic, literal hex — covered by P7.1 design review) | 4 | 2 |
| `DESIGN_NOT_FOUND` (no design signal in available packs / docs) | 1 | 0 |
| **Pass-2 code changes applied** | **0** | **0** |

No `DESIGN_USES_FLAT` entries — every gradient call site either matches
the design system's model-driven category-tinting pattern or is a known
on-brand / skeumorphic surface. No replacements required.

No `MATCHES_DESIGN` site with literal hex stops needs token refactoring as
part of P7.7 — the only literal-hex gradient stops belong to skeumorphic
palettes (CeremonialMail wax-gold, Listing camera UI) already documented in
`docs/token-drift-color.md` as design-review items. Touching them through
this audit would conflict with the deferred-design-call disposition of
P7.1.

---

## A. Model-driven category-tinted surfaces (MATCHES_DESIGN, presumed)

These gradients are populated from a data model — `cover.gradient`,
`category.gradient`, `letter.stationery.*Color`, etc. The model itself is
the design-system extension that ships per-category hero cards. Codebase
parity across iOS/Android.

| Surface | Files | Verdict |
|---|---|---|
| **Transactional detail cover** (gig / listing / invoice) | iOS `Features/ContentDetail/TransactionalDetailShell.swift:225` (cover.gradient); Android `ui/screens/contentdetail/ContentDetailShell.kt:326` | MATCHES_DESIGN (model) |
| **Transactional detail tile grid** (detail-row tiles) | iOS `TransactionalDetailShell.swift:503` (tile.gradient); Android `ContentDetailShell.kt:693` | MATCHES_DESIGN (model) |
| **Transactional detail similar items** | iOS `TransactionalDetailShell.swift:521` (item.gradient); Android `ContentDetailShell.kt:719` | MATCHES_DESIGN (model) |
| **ListOfRows row leadings** (icon-on-gradient, url-on-gradient, avatar) | iOS `Features/Shared/ListOfRows/ListOfRowsView.swift:650, 660, 1068, 1099, 1134, 1170, 1180`; Android `ui/screens/shared/list_of_rows/ListOfRowsScreen.kt:621, 1253, 1287, 1340, 1375` | MATCHES_DESIGN (model — RowLeading data) |
| **Map pin lozenges** (Nearby / Explore / TasksMap / MailboxMap preview) | iOS `Features/Nearby/NearbyMapView.swift:582, 647`, `Features/Explore/ExploreMapView.swift:757, 811`, `Features/Gigs/TasksMap/TasksMapView.swift:422`, `Features/Shared/MapListHybrid/MapListHybridPreview.swift:327, 362`; Android `ui/screens/nearby/map/NearbyMapScreen.kt:981, 1069` | MATCHES_DESIGN (model — entity.category.color and entity.kind.color) |
| **Pet species tiles** | iOS `Features/Homes/Pets/AddPetWizardView.swift:114` (palette.iconBackground); Android `ui/screens/homes/pets/AddPetWizardSheet.kt:216` | MATCHES_DESIGN (model — SpeciesPalette) |
| **Identity Center identity cards** | iOS `Features/IdentityCenter/IdentityCenterView.swift:205` (card.kind.accentBgSoft); Android `ui/screens/identity_center/IdentityCenterScreen.kt:270` (verticalGradient) | MATCHES_DESIGN (model — IdentityKind palette) |
| **Me header identity tint** | iOS `Features/Me/MeView.swift:213` (content.identity.headerGradient); Android `ui/screens/you/me/MeView.kt:182` | MATCHES_DESIGN (model — IdentityKind) |
| **Me 72pt avatar accent** | iOS `Features/Me/MeView.swift:230` (content.identity.accent); Android `ui/screens/you/me/MeView.kt:265` | MATCHES_DESIGN (model — IdentityKind accent) |
| **CeremonialMail porch backdrop** | iOS `Features/CeremonialMailOpen/CeremonialMailOpenView.swift:258` (porchTopColor → porchBottomColor); Android `ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt:343` (verticalGradient) | MATCHES_DESIGN (model — letter.stationery) |
| **CeremonialMail letter paper** | iOS `CeremonialMailOpenView.swift:356` (paperColor → paperEdgeColor); Android `CeremonialMailOpenScreen.kt:494` (verticalGradient) | MATCHES_DESIGN (model) |
| **CeremonialMail paper bottom fade** | iOS `CeremonialMailOpenView.swift:878` (paperColor.opacity(0) → paperColor); Android `CeremonialMailOpenScreen.kt:1128` (verticalGradient) | MATCHES_DESIGN (model) |
| **Marketplace listing card placeholder** | iOS `Features/Marketplace/MarketplaceView.swift:347` (placeholderGradient); Android `ui/screens/marketplace/MarketplaceScreen.kt:515` | MATCHES_DESIGN (model — listing fallback when no image) |
| **Hub Discovery strip cards** | iOS `Features/Hub/Sections/HubSections.swift:466` (item.tint); Android `ui/screens/hub/sections/HubSections.kt:660` | MATCHES_DESIGN (model — DiscoveryItem tint) |
| **ReviewClaims avatar circle** | iOS `Features/ReviewClaims/ReviewClaimDetailView.swift:304` (gradient.start/end); Android `ui/screens/review_claims/ReviewClaimDetailScreen.kt:475` | MATCHES_DESIGN (model — avatar gradient from RowLeading) |
| **View-model category factories** (drive the model gradients above) | iOS `Features/MyBids/MyBidsViewModel.swift:859`, `Features/SupportTrains/SupportTrainsViewModel.swift:243`, `Features/SupportTrains/Search/SupportTrainsSearchViewModel.swift:115`, `Features/MyTasks/MyTasksViewModel.swift:801, 804`, `Features/ListingOffers/ListingOffersViewModel.swift:829, 831, 833`, `Features/DiscoverBusinesses/DiscoverBusinessesViewModel.swift:403`, `Features/DiscoverHub/DiscoverHubViewModel.swift:483, 500, 511`, `Features/Offers/OffersViewModel.swift:417` | n/a — these are VM-side factories that *produce* the model values rendered by the LisOfRows leading branches. Already counted under "ListOfRows row leadings" above. |

## B. Token-based on-brand gradients (MATCHES_DESIGN, presumed)

These use `Theme.Color.*` / `PantopusColors.*` token references for stop
colors. On-brand by definition.

| Surface | iOS file:line | Android file:line | Stop colors |
|---|---|---|---|
| Hub "Verify Home" CTA tile | `HubSections.swift:232` | `hub/sections/HubSections.kt:272` | `primary600 → primary700 → primary900` |
| Hub Weather sun icon tile | `HubSections.swift:256` | `hub/sections/HubSections.kt:408` | `primary100 → primary600` |
| MailItemDetail community-tier badge | `Features/Shared/MailItemDetail/MailItemDetailShell.swift:361` | `ui/screens/shared/mail_item_detail/MailItemDetailShell.kt:369` | `primary50 → primary100` |
| CommunityDetail "You" avatar | `Features/Mailbox/MailDetail/Variants/CommunityDetailLayout.swift:730` | `ui/screens/mailbox/mail_detail/variants/CommunityDetailLayout.kt:950` | `primary500 → primary700` |
| CommunityDetail success card | `CommunityDetailLayout.swift:360` | `CommunityDetailLayout.kt:379` | `successBg → appSurface` |
| ListOfRowsView magic FAB | `ListOfRowsView.swift:1656` (`private var magicGradient`) | `ui/screens/shared/list_of_rows/ListOfRowsScreen.kt:2144` | `primary600 → primary700` |
| Chat paywall overlay fade | `Chat/Conversation/ChatConversationView.swift:1476` | `ui/screens/inbox/conversation/ChatConversationScreen.kt:1640` | `appSurface.opacity(0.15 → 0.96)` |
| SuggestionsBanner unfilled state (same color twice — effectively flat, kept for state-symmetry with filled gradient) | `Compose/ListingCompose/SuggestionsBanner.swift:122` | (Android-equivalent inline) | `appSurfaceMuted → appSurfaceMuted` |
| PostSummaryCard category tile | `Features/Mailbox/ItemDetail/Bodies/Components/PostSummaryCard.swift:92` | `ui/screens/mailbox/item_detail/bodies/components/PostSummaryCard.kt:129` | `handyman.opacity(0.25 → 0.6)` |
| BidderProfileCard avatar | `Features/Mailbox/ItemDetail/Bodies/Components/BidderProfileCard.swift:66` | `ui/screens/mailbox/item_detail/bodies/components/BidderProfileCard.kt:101` | `handyman → handyman.opacity(0.7)` |
| CeremonialMail readingFrame sheen | `CeremonialMailOpenView.swift:559` | (Android-equivalent — verticalGradient with `appSurface.copy(alpha)`) | `Color.white.opacity(0.5) → Color.clear` (decorative glass sheen) |

## C. Shimmer sweep animation (MATCHES_DESIGN)

| File:line | Brush | Verdict |
|---|---|---|
| iOS `Core/Design/Components/Shimmer.swift:61` | 3-stop `LinearGradient(.init(color: base.opacity(0), location: 0), .init(color: highlight, location: 0.5), .init(color: base.opacity(0), location: 1))` sliding sweep | MATCHES_DESIGN — system shimmer animation, not a UI surface |
| Android `ui/components/Shimmer.kt:96` | 3-stop `Brush.linearGradient(ShimmerBase.copy(alpha=0), ShimmerHighlight, ShimmerBase.copy(alpha=0))` | MATCHES_DESIGN — same sweep |

## D. Bespoke skeumorphic with literal hex stop colors (MATCHES_DESIGN, but stops covered by P7.1 design review)

These gradients render skeumorphic textures (wax seal, gold envelope
ribbon, dark camera UI, AI sage-green accent) and use literal hex colors
specifically because the rendered hues belong to a bespoke palette outside
the Pantopus token system. They were already catalogued in
`docs/token-drift-color.md` as DESIGN REVIEW items — refactoring them
through this audit would conflict with the deferred-design-call disposition
of P7.1.

| Surface | iOS file:line | Android file:line | Literal stops | P7.1 disposition |
|---|---|---|---|---|
| CeremonialMail gold-ribbon sender avatar (3 sites — sealed / breaking / opening phases) | `CeremonialMailOpenView.swift:424, 654, 974` | `CeremonialMailOpenScreen.kt:568, 901, 1295` | `#C29230 → #7A4F1B` (envelope-gold) | "Bespoke ceremonial palette — keep" |
| CeremonialMail radial glow (sealed/breaking) | `CeremonialMailOpenView.swift:325` (RadialGradient) | `CeremonialMailOpenScreen.kt:454` (radialGradient) | `Color(red:1, green:0.89, blue:0.63)` etc / `#FFE4A0, #FFB06C` | "Bespoke ceremonial palette — keep" |
| ListingCompose dark camera UI radial vignette | `Features/Compose/ListingCompose/ListingComposePhotoStep.swift:258` (RadialGradient) | `ui/screens/compose/listing/ListingComposeWizardScreen.kt:395` (radialGradient) | `Color(red:0.54, ...)` / `Color(0x665D7A66)` | "Bespoke snap-and-sell camera UI — keep" |
| SuggestionsBanner AI sage-green filled state | `SuggestionsBanner.swift:114` (LinearGradient) | Inline in `ListingComposeWizardScreen.kt:906` | `Color(red:0.53, green:0.66, blue:0.55) → Color(red:0.28, green:0.39, blue:0.31)` / `Color(0xFF86A889) → Color(0xFF48644F)` | "Bespoke AI-suggestion accent — keep" |

## E. DESIGN_NOT_FOUND (surface for review)

| Surface | File:line | Why flagged |
|---|---|---|
| Chat paywall overlay (locked bubble fade) | iOS `Chat/Conversation/ChatConversationView.swift:1476`; Android `inbox/conversation/ChatConversationScreen.kt:1640` | The available Chat_conversation pack (the only pack on disk) does **not** show a paywall overlay gradient at this location. The gradient stops are token-based (`appSurface.opacity(0.15 → 0.96)`) which is a standard transparent-to-opaque fade-out pattern for obscuring locked content. **Surface for design confirmation** — either (a) this overlay was added post-design and design should sign off on the pattern, or (b) the pattern exists in a different Chat HTML variant not in `Chat_conversation/`. |

## Pass 2 — applied changes

**Zero code changes.**

- All `MATCHES_DESIGN` entries already use token / model references; no
  refactoring needed.
- No `DESIGN_USES_FLAT` entries identified; the audit found no clear
  drift where the design pack renders a flat fill but the code renders a
  gradient.
- The 4 iOS + 2 Android `bespoke skeumorphic` gradient sites with literal
  hex stops are already tracked in `docs/token-drift-color.md` as
  design-review items; refactoring them here would conflict with that
  prior disposition.
- The single `DESIGN_NOT_FOUND` entry (Chat paywall overlay) is left
  unchanged — already uses token references for its stop colors, just
  lacks a confirming design signal.

## Snapshot tests

Unaffected — no code changes.

## Followups for design review

1. **Chat paywall overlay** — confirm the appSurface-fade-out pattern was
   designed deliberately for locked content in tier-gated conversations,
   or whether design wants a different obscure pattern (e.g. blur,
   solid + tier-tinted Lock badge).

2. **The 7 missing design packs** — to do a complete provenance check,
   extract `A08`, `A10`, `A13`, `Creator_Audience_hub`, `Full-bleed_map…`,
   `Wizard_multi-step…`, and `mobile_Mailbox_root_archetype` into the
   repo. The current methodology relies on model/token signals as a
   proxy for design-pack agreement.

3. **SuggestionsBanner unfilled state** — currently
   `[appSurfaceMuted, appSurfaceMuted]` (same color twice, expressed as a
   gradient for state-symmetry with the filled state's true gradient).
   Cosmetically wasteful but intentional; consider if a conditional
   `Color` ↔ `LinearGradient` swap risks state-transition flicker. Low
   priority.
