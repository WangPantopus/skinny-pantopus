@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Every Pantopus design-system color token, as a Compose [Color].
 *
 * Mirrors `design_system/colors_and_type.css`. Feature code MUST reference
 * these names (or [PantopusTheme] / [LocalPantopusTokens]) rather than
 * building [Color] instances from raw hex — PRs with `Color(0xFF...)` outside
 * this file will be rejected.
 */
@Suppress("TooManyFunctions", "MagicNumber")
object PantopusColors {
    // Primary (sky)
    /**
     * Primary 25 — `#F8FBFF`. Off-white tinted background; sits between
     * [appSurface] and [primary50]. Used for the unread-row tint in
     * notifications and any "barely there" primary surface that needs to
     * read as inert against a clean white tab strip.
     */
    val primary25 = Color(0xFFF8FBFF)
    val primary50 = Color(0xFFF0F9FF)
    val primary100 = Color(0xFFE0F2FE)
    val primary200 = Color(0xFFBAE6FD)
    val primary300 = Color(0xFF7DD3FC)
    val primary400 = Color(0xFF38BDF8)
    val primary500 = Color(0xFF0EA5E9)
    val primary600 = Color(0xFF0284C7)
    val primary700 = Color(0xFF0369A1)
    val primary800 = Color(0xFF075985)
    val primary900 = Color(0xFF0C4A6E)

    // Semantic
    val success = Color(0xFF059669)
    val successLight = Color(0xFFD1FAE5)
    val successBg = Color(0xFFF0FDF4)
    val warning = Color(0xFFD97706)
    val warningLight = Color(0xFFFDE68A)
    val warningBg = Color(0xFFFFFBEB)

    /**
     * Warning-card title text — `#92400E` (Tailwind amber-800). The design's
     * amber cards (weekly-hours `WarningCard`, block-time `ConflictCard` link)
     * set their heading in this deeper amber, not the [warning] icon accent.
     */
    val warningStrong = Color(0xFF92400E)

    /**
     * Warning-card body text — `#78350F` (Tailwind amber-900). Pairs with
     * [warningStrong] on [warningBg] surfaces.
     */
    val warningDeep = Color(0xFF78350F)
    val error = Color(0xFFDC2626)
    val errorLight = Color(0xFFFECACA)
    val errorBg = Color(0xFFFEF2F2)
    val info = Color(0xFF0284C7)
    val infoLight = Color(0xFFBAE6FD)
    val infoBg = Color(0xFFF0F9FF)

    // Identity pillars
    val personal = Color(0xFF0284C7)
    val personalBg = Color(0xFFDBEAFE)
    val home = Color(0xFF16A34A)
    val homeBg = Color(0xFFDCFCE7)

    /**
     * Home identity dark — `#15803D`. Tailwind green-700; dark stop for
     * home-tinted ceremonial banners (A21.2 local profile, P2 ceremonial
     * unboxing).
     */
    val homeDark = Color(0xFF15803D)
    val business = Color(0xFF7C3AED)
    val businessBg = Color(0xFFF3E8FF)

    /**
     * Business identity dark — `#5B21B6`. Tailwind violet-700; dark stop
     * for business-tinted ceremonial banners.
     */
    val businessDark = Color(0xFF5B21B6)

    /**
     * Warm-amber identity pillar — `#B45309`. The "porch tone" accent for
     * support-train and other warm-tinted wizards (A12.11). Tailwind
     * amber-700; pairs with [warmAmberBg] for chips, selected-state
     * backgrounds, and the wizard progress rail / CTA when
     * `WizardIdentity == Warm`.
     */
    val warmAmber = Color(0xFFB45309)

    /**
     * Warm-amber identity background — `#FEF3C7`. Tailwind amber-100; the
     * soft fill paired with [warmAmber] (identity chips, active rows,
     * dashed callouts in the support-train wizard).
     */
    val warmAmberBg = Color(0xFFFEF3C7)

    /**
     * Warm-amber card fill — `#FFFBEB`. Tailwind amber-50; the Calendarly hub
     * frames' `warningSoft` (paused banner surface). Softer than [warmAmberBg],
     * which those frames reserve for icon tiles.
     */
    val warmAmberSoft = Color(0xFFFFFBEB)

    /**
     * Warm-amber border — `#FDE68A`. Tailwind amber-200; the Calendarly hub
     * frames' `warningBorder` (paused pill + banner outlines around [warmAmber]).
     */
    val warmAmberBorder = Color(0xFFFDE68A)

    // T6.0b — Magic Task lavender quartet. Signals AI-resolved metadata
    // on My tasks V2 rows and the Magic ingest FAB on Mailbox-A17 root.
    // Distinct from the primary sky so users can tell automated chrome
    // from interactive primary surfaces.
    /** Magic violet — `#6D28D9`. Archetype overline, sparkles glyph, magic FAB overlay foreground. */
    val magic = Color(0xFF6D28D9)

    /** Magic background — `#EDE9FE`. Lavender fill for empty-state illustration discs + Magic gradient tile. */
    val magicBg = Color(0xFFEDE9FE)

    /** Magic soft background — `#F5F3FF`. Off-white lavender; pairs with [magicBg] for radial gradients. */
    val magicBgSoft = Color(0xFFF5F3FF)

    /** Magic border — `#DDD6FE`. Hairline border for sparkles discs and magic-tinted callouts. */
    val magicBorder = Color(0xFFDDD6FE)

    // Pulse intent accents
    /**
     * Rose accent — `#BE123C`. Tailwind rose-700. Foreground for the
     * `Lost & Found` Pulse intent chip; pairs with [roseBg]. Distinct from
     * [error] (#DC2626) — a lost-item post is not an error state.
     */
    val rose = Color(0xFFBE123C)

    /** Rose accent background — `#FFE4E6`. Tailwind rose-100; soft fill behind the `Lost & Found` chip. */
    val roseBg = Color(0xFFFFE4E6)

    /**
     * Slate accent — `#475569`. Tailwind slate-600. Foreground for the
     * `Announce` Pulse intent chip; pairs with [slateBg]. A calmer neutral
     * than [appTextStrong] so civic announcements read as informational.
     */
    val slate = Color(0xFF475569)

    /** Slate accent background — `#E2E8F0`. Tailwind slate-200; soft fill behind the `Announce` chip. */
    val slateBg = Color(0xFFE2E8F0)

    // App shell / neutrals
    val appBg = Color(0xFFF6F7F9)
    val appSurface = Color(0xFFFFFFFF)
    val appSurfaceRaised = Color(0xFFF9FAFB)
    val appSurfaceSunken = Color(0xFFF3F4F6)
    val appSurfaceMuted = Color(0xFFF8FAFC)
    val appBorder = Color(0xFFE5E7EB)
    val appBorderStrong = Color(0xFFD1D5DB)
    val appBorderSubtle = Color(0xFFF3F4F6)
    val appText = Color(0xFF111827)
    val appTextStrong = Color(0xFF374151)
    val appTextSecondary = Color(0xFF6B7280)
    val appTextMuted = Color(0xFF9CA3AF)
    val appTextInverse = Color(0xFFFFFFFF)
    val appHover = Color(0xFFF3F4F6)

    // Dark-mode shell neutrals — mirror iOS asset-catalog `luminosity: dark`
    // appearances for `Neutral/*` colors.
    val appBgDark = Color(0xFF0D1117)
    val appSurfaceDark = Color(0xFF161B22)
    val appSurfaceRaisedDark = Color(0xFF1C2230)
    val appSurfaceSunkenDark = Color(0xFF0B0E13)
    val appBorderDark = Color(0xFF2B313B)
    val appBorderStrongDark = Color(0xFF3B424E)
    val appTextDark = Color(0xFFE6EDF3)
    val appTextStrongDark = Color(0xFFC9D1D9)
    val appTextSecondaryDark = Color(0xFF9AA4B2)

    /**
     * Paper cream — `#FDF8EE`. Off-white warm stock used for postcard
     * and other physical-paper artefacts (verification cards, postcard
     * hero, archival document previews).
     */
    val paperCream = Color(0xFFFDF8EE)

    // Category accents
    val handyman = Color(0xFFF97316)
    val cleaning = Color(0xFF27AE60)
    val moving = Color(0xFF8E44AD)
    val petCare = Color(0xFFE74C3C)
    val childCare = Color(0xFFF39C12)
    val tutoring = Color(0xFF2980B9)
    val delivery = Color(0xFF374151)
    val tech = Color(0xFF3498DB)
    val goods = Color(0xFF7C3AED)
    val gigs = Color(0xFFF97316)
    val rentals = Color(0xFF16A34A)
    val vehicles = Color(0xFFDC2626)

    /**
     * Category: party — `#DB2777` (rose-600). Drives the A17.9 party-invite
     * accent strip, eyebrow dot, date tile, confetti seed, and RSVP CTA.
     * Replaces the raw rose hex called out in the parity audit's open
     * question #4 ("prefer named token over raw hex"). The same value is
     * mirrored on iOS as `Theme.Color.categoryParty`.
     */
    val categoryParty = Color(0xFFDB2777)

    /**
     * Category: records — `#475569` slate-600. The institutional /
     * archival accent for A17.10 Records mail (financial statements,
     * medical records, contracts, EOBs). Per audit open question #4.
     */
    val categoryRecords = Color(0xFF475569)

    /**
     * Category: records soft background — `#F8FAFC` slate-50. Pairs
     * with [categoryRecords] for KeyFacts emphasis rows, IssuerCard
     * trust note, and VaultDestination breadcrumb chips.
     */
    val categoryRecordsBg = Color(0xFFF8FAFC)

    /**
     * Category: records soft border — `#E2E8F0` slate-200. Hairline
     * border on chips and trust note rows tinted with [categoryRecordsBg].
     */
    val categoryRecordsBorder = Color(0xFFE2E8F0)

    /**
     * Category: records deep — `#1E293B` slate-800. The institutional
     * dark stop for letterhead bars, breadcrumb-current chip, and the
     * "File in Vault" primary CTA.
     */
    val categoryRecordsDeep = Color(0xFF1E293B)

    /**
     * Category: stamps — `#0E7490` cyan-700 ("philatelic teal"). The
     * postage accent for A17.11 Stamps: the eyebrow / CategoryChip dot,
     * the [app.pantopus.android.ui.components.PerforatedStamp] Forever-series
     * ink, and the book balance ring. Mirrored on iOS as
     * `Theme.Color.categoryStamps`.
     */
    val categoryStamps = Color(0xFF0E7490)

    /**
     * Category: translation — `#BE185D` pink-700. The language / translation
     * accent for A17.13 Translation: the eyebrow / CategoryChip dot, the
     * [app.pantopus.android.ui.screens.mailbox.translation.components.LanguageBadge]
     * target pill, the side-by-side English column header, and the reading-view
     * accent. Distinct from the Pulse [rose] (#BE123C) so the mailbox
     * translation surface reads as its own category. Mirrored on iOS as
     * `Theme.Color.categoryTranslation`.
     */
    val categoryTranslation = Color(0xFFBE185D)

    /**
     * Category: translation soft background — `#FCE7F3` pink-100. Pairs with
     * [categoryTranslation] behind the glossary highlight and the
     * translator-note "kind" pills.
     */
    val categoryTranslationBg = Color(0xFFFCE7F3)

    /**
     * Category: translation ink — `#9D174D` pink-800. Foreground for the
     * glossary highlight term and the translator-note "kind" pill text.
     */
    val categoryTranslationInk = Color(0xFF9D174D)

    /**
     * Category: translation paper — `#FDF9F4`. The warm reading stock the
     * confirmed-state reading view letter sits on.
     */
    val categoryTranslationPaper = Color(0xFFFDF9F4)

    /**
     * Category: translation paper ink — `#3A2F2A`. The warm sepia body ink
     * for the letter rendered on [categoryTranslationPaper].
     */
    val categoryTranslationPaperInk = Color(0xFF3A2F2A)

    /**
     * Category: task — `#4F46E5` indigo-600. The action / productivity
     * accent for A17.12 Mail task: the eyebrow / CategoryChip dot, the
     * task-hero accent strip + checkbox border, the due-calendar block,
     * and the snooze-row glyphs. Mirrored on iOS as
     * `Theme.Color.categoryTask`.
     */
    val categoryTask = Color(0xFF4F46E5)

    /**
     * Category: unboxing — `#0D9488` teal-600 ("scan teal"). The scan /
     * capture accent for A17.14 Unboxing: the nav eyebrow / CategoryChip dot,
     * the [app.pantopus.android.ui.components.CameraScanner] scan-line +
     * "Item detected" pill, the suggested-drawer selection ring, and the
     * "Confirm — file to Home" CTA. Mirrored on iOS as
     * `Theme.Color.categoryUnboxing`.
     */
    val categoryUnboxing = Color(0xFF0D9488)

    /**
     * Category: unboxing deep — `#0F766E` teal-700. The darker stop for
     * scan-accent text on a light surface (confidence line, re-route label,
     * "View" / "Scan the next item" link text).
     */
    val categoryUnboxingDark = Color(0xFF0F766E)

    /**
     * Category: unboxing soft background — `#F0FDFA` teal-50. Fills the
     * "New capture" state chip, the selected suggested-drawer card, the
     * "Add" filmstrip tile, and the "Scan the next item" launcher.
     */
    val categoryUnboxingBg = Color(0xFFF0FDFA)

    /**
     * Category: unboxing soft border — `#99F6E4` teal-200. Hairline border
     * on chips and dashed tiles tinted with [categoryUnboxingBg].
     */
    val categoryUnboxingBorder = Color(0xFF99F6E4)

    // Rating
    /**
     * Star / rating amber — `#F59E0B` (Tailwind amber-500). Fills the
     * review-histogram bars and the star-rating glyphs on
     * [app.pantopus.android.ui.components.RatingDistribution] and the
     * business / listing review summaries (A10.6, A10.7). Distinct from
     * [warning] (#D97706) — a rating is not a warning state. Mirrored on
     * iOS as `Theme.Color.star`.
     */
    val star = Color(0xFFF59E0B)

    /**
     * Live Photo badge yellow — `#FFD60A` (iOS systemYellow). Marks the
     * 7dp dot on Live Photo tiles and the LIVE replay pill in the media
     * viewer. Mirrored on iOS as `Theme.Color.liveBadge`.
     */
    val liveBadge = Color(0xFFFFD60A)
}
