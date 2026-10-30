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
    val primary600 = Color(0xFF0369A1)
    val primary700 = Color(0xFF075985)
    val primary800 = Color(0xFF075985)
    val primary900 = Color(0xFF0C4A6E)

    // Semantic
    //
    // Label/fill inks, darkened from the 600-weight hues
    // (#059669 / #D97706 / #DC2626 / #0284C7), which failed AA in BOTH of
    // the roles they carry: as a label on their own *Light chip they read
    // 2.56:1 to 3.34:1, and as a solid fill under white text 3.19:1 to
    // 4.83:1. The app renders light-only, so unlike the web — where one
    // value cannot serve both roles across two themes — darkening fixes
    // both at once. Chip ratios are now 4.84 / 5.02 / 5.13 / 5.70 and
    // white-on-fill 5.48 / 6.26 / 7.43 / 7.56, across ~1,760 call sites.
    val success = Color(0xFF047857)
    val successLight = Color(0xFFD1FAE5)
    val successBg = Color(0xFFF0FDF4)
    val warning = Color(0xFF9A4A08)
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
    val error = Color(0xFFA81A1A)
    val errorLight = Color(0xFFFECACA)
    val errorBg = Color(0xFFFEF2F2)
    val info = Color(0xFF075985)
    val infoLight = Color(0xFFBAE6FD)
    val infoBg = Color(0xFFF0F9FF)

    // Identity pillars
    // The verification check inside the brand mark's window. Pinned to the
    // brand green and deliberately NOT `home`: that token darkened to
    // #15803D so labels clear AA on the homeBg chip (3.00:1 before), and
    // the mark must stay on-brand. As a meaningful graphic the bar is 3:1,
    // and #16A34A on the white window reads 3.35:1.
    val brandCheck = Color(0xFF16A34A)

    // Identity labels darkened from #0284C7 / #16A34A, which read 3.36:1
    // and 3.00:1 on their own personalBg / homeBg chips. Now 4.86 and 4.57,
    // and white-on-fill improves from 4.10/3.30 to 5.93/5.02.
    val personal = Color(0xFF0369A1)
    val personalBg = Color(0xFFDBEAFE)
    val home = Color(0xFF15803D)
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

    // Was #6B7280 / #9CA3AF, which measured 4.39:1 and 2.31:1 against the
    // worst light surface in use (#F3F4F6) — below AA across ~3,450 call
    // sites. There is no room for four WIDELY separated tiers between
    // #111827 and the 4.5:1 floor, so the steps tighten while all four stay
    // distinguishable: strong 9.37, secondary 6.81, muted 5.18. Values are
    // kept identical to the web tokens (--app-text-secondary / -muted) so
    // the two platforms stay in parity.
    val appTextSecondary = Color(0xFF4E5563)
    val appTextMuted = Color(0xFF5F6775)
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

    // Mail tab paper and ink — the pieces in the Mailbox drawn as the things they are (Mail tab drawings, 2026-10-27:
    // `Parts`, `MailPiece`). Paper stays light in dark mode, as paper does.

    /** A letter's cream envelope — `#FBF6EA` — and its edge, `#EBE1CB`. */
    val mailLetterPaper = Color(0xFFFBF6EA)
    val mailLetterEdge = Color(0xFFEBE1CB)

    /** A postcard's card stock — `#FFFDF7` — its edge and the line between message and address, `#E2DCCD`. */
    val mailPostcardPaper = Color(0xFFFFFDF7)
    val mailPostcardRule = Color(0xFFE2DCCD)

    /** A special delivery's inside stock — `#FFFDF8`. */
    val mailSpecialPaper = Color(0xFFFFFDF8)

    /** A bill's window — `#EEF5FA` — and its edge, `#CFE0EB`. */
    val mailWindow = Color(0xFFEEF5FA)
    val mailWindowEdge = Color(0xFFCFE0EB)

    /** Kraft paper for parcels — `#C9A676` — its packing tape, `#F6E8BA`, and the label's ink, `#3B2A16`. */
    val mailKraft = Color(0xFFC9A676)
    val mailKraftTape = Color(0xFFF6E8BA)
    val mailKraftInk = Color(0xFF3B2A16)

    /** Postal ink: postmarks, printed postage and typed addresses — `#1F2937`; handwriting — `#334155`. */
    val mailInk = Color(0xFF1F2937)
    val mailInkHand = Color(0xFF334155)

    /** A booklet's cover lettering — `#E0F2FE` — and its byline, `#BAE6FD`. */
    val mailBookletInk = Color(0xFFE0F2FE)
    val mailBookletByline = Color(0xFFBAE6FD)

    /** Stamp inks: Fir (blue), Peak (amber) and River (green) — `#0369A1`, `#9A4A08`, `#15803D` — and their light art. */
    val mailStampFir = Color(0xFF0369A1)
    val mailStampPeak = Color(0xFF9A4A08)
    val mailStampRiver = Color(0xFF15803D)
    val mailStampFirArt = Color(0xFFE0F2FE)
    val mailStampPeakArt = Color(0xFFFEF3C7)
    val mailStampRiverArt = Color(0xFFBBF7D0)
    val mailStampSun = Color(0xFFFDE68A)

    /** The letter itself, unfolded on its page, its rules, an enclosure's slip, and the clip holding Pantopus's note. */
    val mailSheet = Color(0xFFFFFEFA)
    val mailSheetEdge = Color(0xFFECE7DA)
    val mailSheetRule = Color(0xFFE7E1D2)
    val mailSlip = Color(0xFFF8F6F0)
    val mailClip = Color(0xFF64748B)

    /** The mailbox: its blue body `#0284C7`, the post `#8A6A4A`, the flag `#C2410C`, the dark inside `#0B2537`. */
    val mailboxBody = Color(0xFF0284C7)
    val mailboxPost = Color(0xFF8A6A4A)
    val mailboxFlag = Color(0xFFC2410C)
    val mailboxInside = Color(0xFF0B2537)

    /**
     * The Counter's top — `#EEEAE3` — and the manila of its due tags and the Vault's folders: the paper `#F3E3B5`, a
     * folder's tab `#E6CF92`, the edge `#D9C48C` and the ink `#5C4410` (Mail tab drawings `R9-Counter`, `R10-Vault`).
     */
    val mailCounter = Color(0xFFEEEAE3)
    val mailManila = Color(0xFFF3E3B5)
    val mailManilaTab = Color(0xFFE6CF92)
    val mailManilaEdge = Color(0xFFD9C48C)
    val mailManilaInk = Color(0xFF5C4410)

    /**
     * The Home mailbox closed until the address is proven (`R14-HomeLocked`): grey `#94A3B8`, its door `#64748B`, and
     * its padlock `#F1F5F9`.
     */
    val mailboxLocked = Color(0xFF94A3B8)
    val mailboxLockedDoor = Color(0xFF64748B)
    val mailboxLockedPlate = Color(0xFFF1F5F9)

    // Christmas cards (launch key `holiday_cards`, 2026-10-30), the web's numbers: the cream desk the send screens sit
    // on, wax red for their buttons and seals, the red card envelope, and the card's own printing and ink.

    /** The send screens' cream desk — `#F5F0E8`; a row or note on it — `#FBF6EC`, edged `#E7DCC6`. */
    val cardDesk = Color(0xFFF5F0E8)
    val cardNotePaper = Color(0xFFFBF6EC)
    val cardNoteEdge = Color(0xFFE7DCC6)

    /** A field or list on the desk — `#FFFDF8` — edged `#D6CBB6` (also a step dot still ahead); a list's edge `#E3D8C3`. */
    val cardField = Color(0xFFFFFDF8)
    val cardFieldEdge = Color(0xFFD6CBB6)
    val cardListEdge = Color(0xFFE3D8C3)

    /** A pressed row or button on the desk — `#F5EFE3`. */
    val cardPressed = Color(0xFFF5EFE3)

    /** Wax red — `#8B1D1D`: the send screens' buttons, the current step, the "Do not open until Christmas" words. */
    val cardWax = Color(0xFF8B1D1D)

    /** Lettering on wax red — `#FFF7ED`. */
    val cardWaxText = Color(0xFFFFF7ED)

    /** The desk's words: strong `#111827`, body `#374151`, quiet `#4E5563`, a problem `#A81A1A`. */
    val cardTextStrong = Color(0xFF111827)
    val cardTextBody = Color(0xFF374151)
    val cardTextQuiet = Color(0xFF4E5563)
    val cardTextProblem = Color(0xFFA81A1A)

    /** A person's initial in the search — `#5B4A36` on `#EBE3D4`; the row's chevron — `#8A7A62`. */
    val cardInitialInk = Color(0xFF5B4A36)
    val cardInitialPaper = Color(0xFFEBE3D4)
    val cardChevron = Color(0xFF8A7A62)

    /** The red card envelope — `#9F2F28` — its addresses in cream ink `#FDF2E3` / `#FFFAF0`, "CHRISTMAS CARD" `#FDE7C8`. */
    val cardEnvelope = Color(0xFF9F2F28)
    val cardEnvelopeInk = Color(0xFFFDF2E3)
    val cardEnvelopeAddress = Color(0xFFFFFAF0)
    val cardEnvelopeLabel = Color(0xFFFDE7C8)

    /** The "Do not open until Christmas" seal: cream `#FDF2E3` ringed and lettered in dark red `#7A1414`. */
    val cardSealPaper = Color(0xFFFDF2E3)
    val cardSealInk = Color(0xFF7A1414)

    /** The card's printing: the caption by hand `#1D2B63`, CHRISTMAS, 2026 `#2B2622`, the postmark `#B2413A`. */
    val cardCaptionInk = Color(0xFF1D2B63)
    val cardYearInk = Color(0xFF2B2622)
    val cardPostmark = Color(0xFFB2413A)

    /** The back: the note in fountain-pen blue `#2C4A8A`, FROM `#4A3F33`, PANTOPUS POST `#8A7A62`. */
    val cardNoteInk = Color(0xFF2C4A8A)
    val cardFromInk = Color(0xFF4A3F33)
    val cardFooterInk = Color(0xFF8A7A62)

    /** The card's paper when a design names none — `#F7F0E2`. */
    val cardPaper = Color(0xFFF7F0E2)

    /** The card's aged edges `rgb(110 80 30 / 13%)`, its paper grain `rgb(120 95 60 / 7%)`, its ruled lines `rgb(120 100 70 / 22%)`. */
    val cardEdgeShade = Color(0x216E501E)
    val cardGrain = Color(0x12785F3C)
    val cardRule = Color(0x38786446)

    /** The red envelope's grain — white at 5%. */
    val cardEnvelopeGrain = Color(0x0DFFFFFF)

    // Ballot illustration — mirrors iOS `Ballot/*` in the asset catalog.

    /**
     * Ballot stack base — `#EEF1F5`. An illustration grey from the Pantopus
     * Ballot canvas (the government stack's base layer), not a UI surface.
     */
    val ballotStackBase = Color(0xFFEEF1F5)

    /** The Ballot timeline's "waiting for ballots" segment — `#9CA3AF`. */
    val ballotWait = Color(0xFF9CA3AF)

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

    // Nearby Plans (board P1): one color per plan type for its pin, swatch and tile, with a soft tint for tiles
    // and tags, in light and dark. Mirrored on iOS as `Theme.Color.catPlan*` and on the web as `--cat-plan-*`.

    /** `cat-plan-watch` — `#EA580C` (orange-600); watch parties. */
    val catPlanWatch = Color(0xFFEA580C)
    val catPlanWatchTint = Color(0xFFFFEDD5)
    val catPlanWatchDark = Color(0xFFFB923C)
    val catPlanWatchTintDark = Color(0xFF3B2312)

    /** `cat-plan-playdate` — `#7C3AED` (violet-600); playdates. */
    val catPlanPlaydate = Color(0xFF7C3AED)
    val catPlanPlaydateTint = Color(0xFFEDE9FE)
    val catPlanPlaydateDark = Color(0xFFA78BFA)
    val catPlanPlaydateTintDark = Color(0xFF2A2148)

    /** `cat-plan-pickup` — `#16A34A` (green-600); pickup games. */
    val catPlanPickup = Color(0xFF16A34A)
    val catPlanPickupTint = Color(0xFFDCFCE7)
    val catPlanPickupDark = Color(0xFF4ADE80)
    val catPlanPickupTintDark = Color(0xFF13301F)

    /** `cat-plan-walk` — `#A16207` (yellow-700); walks and coffee. */
    val catPlanWalk = Color(0xFFA16207)
    val catPlanWalkTint = Color(0xFFFEF3C7)
    val catPlanWalkDark = Color(0xFFFBBF24)
    val catPlanWalkTintDark = Color(0xFF33290F)

    /** `cat-plan-study` — `#DB2777` (pink-600); study groups. */
    val catPlanStudy = Color(0xFFDB2777)
    val catPlanStudyTint = Color(0xFFFCE7F3)
    val catPlanStudyDark = Color(0xFFF472B6)
    val catPlanStudyTintDark = Color(0xFF3A1A2C)

    /** A plan pin's glyph on its colored head in dark mode — `#0B1220` (light mode uses white). */
    val planPinInkDark = Color(0xFF0B1220)

    /** The map's "you are here" dot — `#0A84FF` — and its 18% halo. */
    val mapYou = Color(0xFF0A84FF)
    val mapYouHalo = Color(0x2E0A84FF)

    /** Glass over a map (the area pill, the type chips, round map buttons): white at 84%, dark `#1C222C` at 84%. */
    val mapGlass = Color(0xD6FFFFFF)
    val mapGlassDark = Color(0xD61C222C)

    /** The stronger glass of a privacy chip over a map — `#FAFAFC` at 94% (dark `#242A34` at 95%). */
    val mapGlassStrong = Color(0xF0FAFAFC)
    val mapGlassStrongDark = Color(0xF2242A34)

    /** The dimming behind a sheet over a map — `#111827` at 38% (dark: black at 56%). */
    val sheetScrim = Color(0x61111827)
    val sheetScrimDark = Color(0x8F000000)
}
