//
//  Colors.swift
//  Pantopus
//
//  Every design-system color token as a SwiftUI `Color` loaded from the asset
//  catalog. Asset-catalog names mirror the design_system/colors_and_type.css
//  token identifiers so renaming stays traceable.
//

import SwiftUI

public extension Theme.Color {
    // MARK: - Primary (sky) scale

    /// Primary 25 — `#f8fbff`. Off-white tinted background; sits between
    /// `appSurface` and `primary50`. Used for the unread-row tint in
    /// notifications and any "barely there" primary surface.
    static let primary25 = SwiftUI.Color("Primary/Primary25", bundle: Theme.bundle)
    /// Primary 50 — `#f0f9ff`.
    static let primary50 = SwiftUI.Color("Primary/Primary50", bundle: Theme.bundle)
    /// Primary 100 — `#e0f2fe`.
    static let primary100 = SwiftUI.Color("Primary/Primary100", bundle: Theme.bundle)
    /// Primary 200 — `#bae6fd`.
    static let primary200 = SwiftUI.Color("Primary/Primary200", bundle: Theme.bundle)
    /// Primary 300 — `#7dd3fc`.
    static let primary300 = SwiftUI.Color("Primary/Primary300", bundle: Theme.bundle)
    /// Primary 400 — `#38bdf8`.
    static let primary400 = SwiftUI.Color("Primary/Primary400", bundle: Theme.bundle)
    /// Primary 500 — `#0ea5e9`.
    static let primary500 = SwiftUI.Color("Primary/Primary500", bundle: Theme.bundle)
    /// Primary 600 — `#0284c7`. The brand primary.
    static let primary600 = SwiftUI.Color("Primary/Primary600", bundle: Theme.bundle)
    /// Primary 700 — `#0369a1`.
    static let primary700 = SwiftUI.Color("Primary/Primary700", bundle: Theme.bundle)
    /// Primary 800 — `#075985`.
    static let primary800 = SwiftUI.Color("Primary/Primary800", bundle: Theme.bundle)
    /// Primary 900 — `#0c4a6e`.
    static let primary900 = SwiftUI.Color("Primary/Primary900", bundle: Theme.bundle)

    // MARK: - Semantic

    /// Success base — `#059669`.
    static let success = SwiftUI.Color("Semantic/Success", bundle: Theme.bundle)
    /// Success dark — `#047857`. Emerald-700; the darker confirmed-stat value
    /// shade specified in roster-frames.jsx (SUCCESS_DK). Use for high-emphasis
    /// success numerals (e.g. Confirmed seat count) where the lighter #059669
    /// reads too lightly against a sunken-surface stat cell.
    static let successDk = SwiftUI.Color("Semantic/SuccessDk", bundle: Theme.bundle)
    /// Success light tint — `#D1FAE5`.
    static let successLight = SwiftUI.Color("Semantic/SuccessLight", bundle: Theme.bundle)
    /// Success background — `#F0FDF4`.
    static let successBg = SwiftUI.Color("Semantic/SuccessBg", bundle: Theme.bundle)

    /// Warning base — `#D97706`.
    static let warning = SwiftUI.Color("Semantic/Warning", bundle: Theme.bundle)
    /// Warning light tint — `#FDE68A`.
    static let warningLight = SwiftUI.Color("Semantic/WarningLight", bundle: Theme.bundle)
    /// Warning background — `#FFFBEB`.
    static let warningBg = SwiftUI.Color("Semantic/WarningBg", bundle: Theme.bundle)
    /// Warning-card title text — `#92400E` (Tailwind amber-800). The design's
    /// amber cards set their heading in this deeper amber; `warning` stays on
    /// the icon accent. Mirrors Android's `warningStrong`.
    static let warningStrong = SwiftUI.Color("Semantic/WarningStrong", bundle: Theme.bundle)
    /// Warning-card body text — `#78350F` (Tailwind amber-900). Pairs with
    /// `warningStrong` on `warningBg` surfaces. Mirrors Android's `warningDeep`.
    static let warningDeep = SwiftUI.Color("Semantic/WarningDeep", bundle: Theme.bundle)

    /// Error base — `#DC2626`.
    static let error = SwiftUI.Color("Semantic/Error", bundle: Theme.bundle)
    /// Error light tint — `#FECACA`.
    static let errorLight = SwiftUI.Color("Semantic/ErrorLight", bundle: Theme.bundle)
    /// Error background — `#FEF2F2`.
    static let errorBg = SwiftUI.Color("Semantic/ErrorBg", bundle: Theme.bundle)

    /// Info base — `#0284c7`.
    static let info = SwiftUI.Color("Semantic/Info", bundle: Theme.bundle)
    /// Info light tint — `#BAE6FD`.
    static let infoLight = SwiftUI.Color("Semantic/InfoLight", bundle: Theme.bundle)
    /// Info background — `#F0F9FF`.
    static let infoBg = SwiftUI.Color("Semantic/InfoBg", bundle: Theme.bundle)

    // MARK: - Identity pillars

    /// Personal identity pillar — `#0284C7`.
    static let personal = SwiftUI.Color("Identity/Personal", bundle: Theme.bundle)
    /// Personal identity background — `#DBEAFE`.
    static let personalBg = SwiftUI.Color("Identity/PersonalBg", bundle: Theme.bundle)
    /// Home identity pillar — `#16A34A`.
    static let home = SwiftUI.Color("Identity/Home", bundle: Theme.bundle)
    /// Home identity background — `#DCFCE7`.
    static let homeBg = SwiftUI.Color("Identity/HomeBg", bundle: Theme.bundle)
    /// Home identity dark — `#15803D`. Tailwind green-700; the dark stop for
    /// home-tinted ceremonial banners (A21.2 local profile,
    /// P2 ceremonial unboxing).
    static let homeDark = SwiftUI.Color("Identity/HomeDark", bundle: Theme.bundle)
    /// Business identity pillar — `#7C3AED`.
    static let business = SwiftUI.Color("Identity/Business", bundle: Theme.bundle)
    /// Business identity background — `#F3E8FF`.
    static let businessBg = SwiftUI.Color("Identity/BusinessBg", bundle: Theme.bundle)
    /// Business identity dark — `#5B21B6`. Tailwind violet-700; the dark stop
    /// for business-tinted ceremonial banners.
    static let businessDark = SwiftUI.Color("Identity/BusinessDark", bundle: Theme.bundle)

    /// Warm-amber identity pillar — `#B45309`. The "porch tone" accent
    /// for support-train and other warm-tinted wizards (A12.11). Tailwind
    /// amber-700; pairs with `warmAmberBg` for chips, selected-state
    /// backgrounds, and the wizard progress rail / CTA when
    /// `WizardIdentity == .warm`.
    static let warmAmber = SwiftUI.Color("Identity/WarmAmber", bundle: Theme.bundle)
    /// Warm-amber identity background — `#FEF3C7`. Tailwind amber-100; the
    /// soft fill paired with `warmAmber` (identity chips, active rows,
    /// dashed callouts in the support-train wizard).
    static let warmAmberBg = SwiftUI.Color("Identity/WarmAmberBg", bundle: Theme.bundle)

    /// T6.0b — Magic Task lavender quartet. Signals AI-resolved metadata
    /// on My tasks V2 rows and the Magic ingest FAB on Mailbox-A17 root.
    /// Distinct from the primary sky so users can tell automated chrome
    /// from interactive primary surfaces.
    ///
    /// Magic violet — `#6D28D9`. The accent — used for the archetype
    /// overline, the sparkles disc glyph, and the magic FAB's overlay
    /// dot foreground.
    static let magic = SwiftUI.Color("Identity/Magic", bundle: Theme.bundle)
    /// Magic background — `#EDE9FE`. The lavender fill for empty-state
    /// illustration discs and the Magic-Task gradient tile's soft tint.
    static let magicBg = SwiftUI.Color("Identity/MagicBg", bundle: Theme.bundle)
    /// Magic soft background — `#F5F3FF`. Off-white lavender; pairs with
    /// `magicBg` for radial gradient fills on illustration backdrops.
    static let magicBgSoft = SwiftUI.Color("Identity/MagicBgSoft", bundle: Theme.bundle)
    /// Magic border — `#DDD6FE`. Hairline border for sparkles discs and
    /// magic-tinted callouts.
    static let magicBorder = SwiftUI.Color("Identity/MagicBorder", bundle: Theme.bundle)

    // MARK: - Pulse intent accents

    /// Rose accent — `#BE123C`. Tailwind rose-700. The foreground for the
    /// `Lost & Found` Pulse intent chip; pairs with `roseBg`. Distinct from
    /// `error` (#DC2626) — a lost-item post is not an error state.
    static let rose = SwiftUI.Color("Accent/Rose", bundle: Theme.bundle)
    /// Rose accent background — `#FFE4E6`. Tailwind rose-100; the soft fill
    /// behind the `Lost & Found` intent chip.
    static let roseBg = SwiftUI.Color("Accent/RoseBg", bundle: Theme.bundle)
    /// Slate accent — `#475569`. Tailwind slate-600. The foreground for the
    /// `Announce` Pulse intent chip; pairs with `slateBg`. A calmer neutral
    /// than `appTextStrong` so civic announcements read as informational.
    static let slate = SwiftUI.Color("Accent/Slate", bundle: Theme.bundle)
    /// Slate accent background — `#E2E8F0`. Tailwind slate-200; the soft fill
    /// behind the `Announce` intent chip.
    static let slateBg = SwiftUI.Color("Accent/SlateBg", bundle: Theme.bundle)

    /// Live Photo badge — `#FFD60A` (iOS system yellow). The indicator dot
    /// drawn on Live Photo media tiles in Pulse feed cards, post detail
    /// grids, and the full-screen media viewer. Mirrors the RN app's
    /// `LivePhotoMedia` dot so the affordance reads identically across
    /// platforms. Same value in dark mode — it sits on photo content, not
    /// on a themed surface.
    static let liveBadge = SwiftUI.Color("Accent/LiveBadge", bundle: Theme.bundle)

    // MARK: - Rating

    /// Star / rating amber — `#F59E0B` (Tailwind amber-500). Fills the
    /// review-histogram bars and the star-rating glyphs on
    /// `RatingDistribution` and the business / listing review summaries
    /// (A10.6, A10.7). Distinct from `warning` (#D97706) — a rating is not
    /// a warning state, and the lighter amber reads better against white
    /// review cards.
    static let star = SwiftUI.Color("Accent/Star", bundle: Theme.bundle)

    // MARK: - Brand marks (third-party)

    /// Stripe brand purple — `#635bff`. The canonical Stripe wordmark / badge
    /// color. Used on the payments-setup Stripe connect disc + "Powered by
    /// Stripe" badges (G5/G6). NOT the business pillar violet (`#7C3AED`) — a
    /// brand mark keeps its own color even on a pillar-accented surface.
    static let stripeBrand = SwiftUI.Color("Brand/Stripe", bundle: Theme.bundle)

    // MARK: - App shell / neutrals

    /// App background — `#f6f7f9`.
    static let appBg = SwiftUI.Color("Neutral/AppBg", bundle: Theme.bundle)
    /// App surface — `#ffffff`.
    static let appSurface = SwiftUI.Color("Neutral/AppSurface", bundle: Theme.bundle)
    /// Raised surface — `#f9fafb`.
    static let appSurfaceRaised = SwiftUI.Color("Neutral/AppSurfaceRaised", bundle: Theme.bundle)
    /// Sunken surface — `#f3f4f6`.
    static let appSurfaceSunken = SwiftUI.Color("Neutral/AppSurfaceSunken", bundle: Theme.bundle)
    /// Muted surface — `#f8fafc`.
    static let appSurfaceMuted = SwiftUI.Color("Neutral/AppSurfaceMuted", bundle: Theme.bundle)
    /// Border — `#e5e7eb`.
    static let appBorder = SwiftUI.Color("Neutral/AppBorder", bundle: Theme.bundle)
    /// Strong border — `#d1d5db`.
    static let appBorderStrong = SwiftUI.Color("Neutral/AppBorderStrong", bundle: Theme.bundle)
    /// Subtle border — `#f3f4f6`.
    static let appBorderSubtle = SwiftUI.Color("Neutral/AppBorderSubtle", bundle: Theme.bundle)
    /// Primary text / fg1 — `#111827`.
    static let appText = SwiftUI.Color("Neutral/AppText", bundle: Theme.bundle)
    /// Strong text / fg2 — `#374151`.
    static let appTextStrong = SwiftUI.Color("Neutral/AppTextStrong", bundle: Theme.bundle)
    /// Secondary text / fg3 — `#6b7280`.
    static let appTextSecondary = SwiftUI.Color("Neutral/AppTextSecondary", bundle: Theme.bundle)
    /// Muted text / fg4 — `#9ca3af`.
    static let appTextMuted = SwiftUI.Color("Neutral/AppTextMuted", bundle: Theme.bundle)
    /// Inverse text on dark surfaces — `#ffffff`.
    static let appTextInverse = SwiftUI.Color("Neutral/AppTextInverse", bundle: Theme.bundle)
    /// Hover state — `#f3f4f6`.
    static let appHover = SwiftUI.Color("Neutral/AppHover", bundle: Theme.bundle)
    /// Paper cream — `#FDF8EE`. Off-white warm stock used for postcard
    /// and other physical-paper artefacts (verification cards, postcard
    /// hero, archival document previews).
    static let paperCream = SwiftUI.Color("Neutral/PaperCream", bundle: Theme.bundle)

    // MARK: - Category accents

    /// Category: handyman — `#f97316`.
    static let handyman = SwiftUI.Color("Category/Handyman", bundle: Theme.bundle)
    /// Category: cleaning — `#27ae60`.
    static let cleaning = SwiftUI.Color("Category/Cleaning", bundle: Theme.bundle)
    /// Category: moving — `#8e44ad`.
    static let moving = SwiftUI.Color("Category/Moving", bundle: Theme.bundle)
    /// Category: pet-care — `#e74c3c`.
    static let petCare = SwiftUI.Color("Category/PetCare", bundle: Theme.bundle)
    /// Category: child-care — `#f39c12`.
    static let childCare = SwiftUI.Color("Category/ChildCare", bundle: Theme.bundle)
    /// Category: tutoring — `#2980b9`.
    static let tutoring = SwiftUI.Color("Category/Tutoring", bundle: Theme.bundle)
    /// Category: delivery — `#374151`.
    static let delivery = SwiftUI.Color("Category/Delivery", bundle: Theme.bundle)
    /// Category: tech — `#3498db`.
    static let tech = SwiftUI.Color("Category/Tech", bundle: Theme.bundle)
    /// Category: goods — `#7c3aed`.
    static let goods = SwiftUI.Color("Category/Goods", bundle: Theme.bundle)
    /// Category: gigs — `#f97316`.
    static let gigs = SwiftUI.Color("Category/Gigs", bundle: Theme.bundle)
    /// Category: rentals — `#16a34a`.
    static let rentals = SwiftUI.Color("Category/Rentals", bundle: Theme.bundle)
    /// Category: vehicles — `#dc2626`.
    static let vehicles = SwiftUI.Color("Category/Vehicles", bundle: Theme.bundle)
    /// Category: party — `#db2777` (rose-600). Drives the A17.9 party-invite
    /// accent strip, eyebrow dot, date tile, confetti seed, and RSVP CTA.
    /// Replaces the raw rose hex called out in the parity audit's open
    /// question #4 ("prefer named token over raw hex").
    static let categoryParty = SwiftUI.Color("Category/Party", bundle: Theme.bundle)
    /// Category: records — `#475569` slate-600. The institutional /
    /// archival accent for A17.10 Records mail (financial statements,
    /// medical records, contracts, EOBs). Per audit open question #4.
    static let categoryRecords = SwiftUI.Color("Category/Records", bundle: Theme.bundle)
    /// Category: records soft background — `#f8fafc` slate-50. Pairs
    /// with `categoryRecords` for KeyFacts emphasis rows, IssuerCard
    /// trust note, and VaultDestination breadcrumb chips.
    static let categoryRecordsBg = SwiftUI.Color("Category/RecordsBg", bundle: Theme.bundle)
    /// Category: records soft border — `#e2e8f0` slate-200. Hairline
    /// border on chips and trust note rows tinted with `categoryRecordsBg`.
    static let categoryRecordsBorder = SwiftUI.Color("Category/RecordsBorder", bundle: Theme.bundle)
    /// Category: records deep — `#1e293b` slate-800. The institutional
    /// dark stop for letterhead bars, breadcrumb-current chip, and the
    /// "File in Vault" primary CTA.
    static let categoryRecordsDeep = SwiftUI.Color("Category/RecordsDeep", bundle: Theme.bundle)
    /// Category: stamps — `#0e7490` cyan-700 ("philatelic teal"). The
    /// postage accent for A17.11 Stamps: the eyebrow / `CategoryChip` dot,
    /// the `PerforatedStamp` Forever-series ink, and the book balance ring.
    /// Mirrored on Android as `PantopusColors.categoryStamps`.
    static let categoryStamps = SwiftUI.Color("Category/Stamps", bundle: Theme.bundle)
    /// Category: translation — `#be185d` pink-700. The language / translation
    /// accent for A17.13 Translation: the eyebrow / `CategoryChip` dot, the
    /// `LanguageBadge` target pill, the side-by-side English column header,
    /// and the `ReadingView` accent. Distinct from the Pulse `rose` (#be123c)
    /// so the mailbox translation surface reads as its own category. Mirrored
    /// on Android as `PantopusColors.categoryTranslation`.
    static let categoryTranslation = SwiftUI.Color("Category/Translation", bundle: Theme.bundle)
    /// Category: translation soft background — `#fce7f3` pink-100. Pairs with
    /// `categoryTranslation` behind the glossary `<mark>` highlight and the
    /// translator-note "kind" pills.
    static let categoryTranslationBg = SwiftUI.Color("Category/TranslationBg", bundle: Theme.bundle)
    /// Category: translation ink — `#9d174d` pink-800. The foreground for the
    /// glossary highlight term and the translator-note "kind" pill text.
    static let categoryTranslationInk = SwiftUI.Color("Category/TranslationInk", bundle: Theme.bundle)
    /// Category: translation paper — `#fdf9f4`. The warm reading stock the
    /// confirmed-state `ReadingView` letter sits on.
    static let categoryTranslationPaper = SwiftUI.Color("Category/TranslationPaper", bundle: Theme.bundle)
    /// Category: translation paper ink — `#3a2f2a`. The warm sepia body ink
    /// for the letter rendered on `categoryTranslationPaper`.
    static let categoryTranslationPaperInk = SwiftUI.Color("Category/TranslationPaperInk", bundle: Theme.bundle)
    /// Category: task — `#4f46e5` indigo-600. The action / productivity
    /// accent for A17.12 Mail task: the eyebrow / `CategoryChip` dot, the
    /// task-hero accent strip + checkbox border, the due-calendar block,
    /// and the snooze-row glyphs. Mirrored on Android as
    /// `PantopusColors.categoryTask`.
    static let categoryTask = SwiftUI.Color("Category/Task", bundle: Theme.bundle)
    /// Category: unboxing — `#0d9488` teal-600 ("scan teal"). The scan /
    /// capture accent for A17.14 Unboxing: the nav eyebrow + `CategoryChip`
    /// dot, the `CameraScanner` scan-line + "Item detected" pill, the
    /// suggested-drawer selection ring, and the "Confirm — file to Home" CTA.
    /// Mirrored on Android as `PantopusColors.categoryUnboxing`.
    static let categoryUnboxing = SwiftUI.Color("Category/Unboxing", bundle: Theme.bundle)
    /// Category: unboxing deep — `#0f766e` teal-700. The darker stop for
    /// scan-accent text on a light surface (confidence line, re-route label,
    /// "View" / "Scan the next item" link text).
    static let categoryUnboxingDark = SwiftUI.Color("Category/UnboxingDark", bundle: Theme.bundle)
    /// Category: unboxing soft background — `#f0fdfa` teal-50. Fills the
    /// "New capture" state chip, the selected suggested-drawer card, the
    /// "Add" filmstrip tile, and the "Scan the next item" launcher.
    static let categoryUnboxingBg = SwiftUI.Color("Category/UnboxingBg", bundle: Theme.bundle)
    /// Category: unboxing soft border — `#99f6e4` teal-200. Hairline border
    /// on chips and dashed tiles tinted with `categoryUnboxingBg`.
    static let categoryUnboxingBorder = SwiftUI.Color("Category/UnboxingBorder", bundle: Theme.bundle)
}
