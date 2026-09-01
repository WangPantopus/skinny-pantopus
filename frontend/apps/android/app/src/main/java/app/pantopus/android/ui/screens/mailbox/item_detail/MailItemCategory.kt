@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * 20-category enum for mailbox items. Maps 1:1 to the backend
 * `mail.mail_type` string — unknown values fall through to [General].
 *
 * T6.5b extends each case with the per-category icon, rowBackground,
 * user-facing label, and a detailTrust collapse used by the new A17
 * top-bar eyebrow dot.
 */
enum class MailItemCategory(
    val raw: String,
    val accent: Color,
    val icon: PantopusIcon,
    val rowBackground: Color,
    val label: String,
    val detailTrust: MailDetailTrust,
) {
    Package(
        raw = "package",
        accent = PantopusColors.delivery,
        icon = PantopusIcon.Package,
        rowBackground = PantopusColors.appSurfaceSunken,
        label = "Package",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Coupon(
        raw = "coupon",
        accent = PantopusColors.childCare,
        icon = PantopusIcon.Tag,
        rowBackground = PantopusColors.businessBg,
        label = "Coupon",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Booklet(
        raw = "booklet",
        accent = PantopusColors.moving,
        icon = PantopusIcon.FileText,
        rowBackground = PantopusColors.personalBg,
        label = "Booklet",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Certified(
        raw = "certified",
        accent = PantopusColors.primary600,
        icon = PantopusIcon.BadgeCheck,
        rowBackground = PantopusColors.primary50,
        label = "Certified",
        detailTrust = MailDetailTrust.Verified,
    ),
    Community(
        raw = "community",
        accent = PantopusColors.home,
        icon = PantopusIcon.Users,
        rowBackground = PantopusColors.successBg,
        label = "Community",
        detailTrust = MailDetailTrust.Verified,
    ),
    Notice(
        raw = "notice",
        accent = PantopusColors.warning,
        icon = PantopusIcon.AlertCircle,
        rowBackground = PantopusColors.warningBg,
        label = "Notice",
        detailTrust = MailDetailTrust.Warning,
    ),
    Bill(
        raw = "bill",
        accent = PantopusColors.error,
        icon = PantopusIcon.Receipt,
        rowBackground = PantopusColors.errorBg,
        label = "Bill",
        detailTrust = MailDetailTrust.Warning,
    ),
    Statement(
        raw = "statement",
        accent = PantopusColors.tutoring,
        icon = PantopusIcon.FileText,
        rowBackground = PantopusColors.personalBg,
        label = "Statement",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Insurance(
        raw = "insurance",
        accent = PantopusColors.info,
        icon = PantopusIcon.Shield,
        rowBackground = PantopusColors.infoBg,
        label = "Insurance",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Tax(
        raw = "tax",
        accent = PantopusColors.vehicles,
        icon = PantopusIcon.Receipt,
        rowBackground = PantopusColors.warningBg,
        label = "Tax",
        detailTrust = MailDetailTrust.Verified,
    ),
    Subscription(
        raw = "subscription",
        accent = PantopusColors.goods,
        icon = PantopusIcon.ArrowsRepeat,
        rowBackground = PantopusColors.businessBg,
        label = "Subscription",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Legal(
        raw = "legal",
        accent = PantopusColors.moving,
        icon = PantopusIcon.Gavel,
        rowBackground = PantopusColors.businessBg,
        label = "Legal",
        detailTrust = MailDetailTrust.Verified,
    ),
    Healthcare(
        raw = "healthcare",
        accent = PantopusColors.petCare,
        icon = PantopusIcon.HeartPulse,
        rowBackground = PantopusColors.errorBg,
        label = "Healthcare",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Membership(
        raw = "membership",
        accent = PantopusColors.personal,
        icon = PantopusIcon.BadgeCheck,
        rowBackground = PantopusColors.personalBg,
        label = "Membership",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Delivery(
        raw = "delivery",
        accent = PantopusColors.handyman,
        icon = PantopusIcon.Package,
        rowBackground = PantopusColors.appSurfaceSunken,
        label = "Delivery",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Social(
        raw = "social",
        accent = PantopusColors.cleaning,
        icon = PantopusIcon.Users,
        rowBackground = PantopusColors.homeBg,
        label = "Social",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Gig(
        raw = "gig",
        // "cat-gigs" orange per A17.6 gig accent.
        accent = PantopusColors.handyman,
        icon = PantopusIcon.HandCoins,
        rowBackground = PantopusColors.warningBg,
        label = "Gig",
        detailTrust = MailDetailTrust.Neutral,
    ),
    Memory(
        raw = "memory",
        // Sun-amber per A17.7 stationery-summer accent.
        accent = PantopusColors.warning,
        icon = PantopusIcon.Heart,
        rowBackground = PantopusColors.warningBg,
        label = "Memory",
        detailTrust = MailDetailTrust.Verified,
    ),
    Party(
        raw = "party",
        // Party accent per A17.9 invite treatment. Token lives on
        // `PantopusColors.categoryParty` so the swatch can be swapped
        // without touching feature code.
        accent = PantopusColors.categoryParty,
        icon = PantopusIcon.PartyPopper,
        rowBackground = PantopusColors.errorBg,
        label = "Party",
        detailTrust = MailDetailTrust.Celebration,
    ),
    Records(
        raw = "records",
        // Slate-600 per A17.10 archival accent — institutional, archival.
        accent = PantopusColors.categoryRecords,
        icon = PantopusIcon.Archive,
        rowBackground = PantopusColors.categoryRecordsBg,
        label = "Records",
        detailTrust = MailDetailTrust.Verified,
    ),
    General(
        raw = "general",
        accent = PantopusColors.appTextSecondary,
        icon = PantopusIcon.Mailbox,
        rowBackground = PantopusColors.appSurfaceSunken,
        label = "Mail",
        detailTrust = MailDetailTrust.Neutral,
    ),
    ;

    companion object {
        /** Matches a backend `mail_type`/`type` string onto a typed case. */
        fun fromRaw(value: String?): MailItemCategory {
            val normalized = value?.lowercase() ?: return General
            return entries.firstOrNull { it.raw == normalized } ?: General
        }
    }
}

/** Sender trust level for the detail pill. */
enum class MailTrust(
    val label: String,
    val icon: PantopusIcon,
    val background: Color,
    val foreground: Color,
) {
    Verified("Verified", PantopusIcon.ShieldCheck, PantopusColors.successBg, PantopusColors.success),
    Partial("Partial", PantopusIcon.Shield, PantopusColors.warningBg, PantopusColors.warning),
    Unverified("Unverified", PantopusIcon.Shield, PantopusColors.appSurfaceSunken, PantopusColors.appTextSecondary),
    Chain("Pantopus user", PantopusIcon.ShieldCheck, PantopusColors.infoBg, PantopusColors.primary600),

    /**
     * Certified mail / chain-of-custody. Set by the VM when category is
     * [MailItemCategory.Certified]; not derived from the wire
     * `sender_trust` field today.
     */
    CertifiedChain(
        "Certified · Chain of custody",
        PantopusIcon.ShieldCheck,
        PantopusColors.infoBg,
        PantopusColors.primary600,
    ),
    ;

    /**
     * Conversion to the [MailDetailTrust] enum the A17 shell expects.
     * `chain` / `certifiedChain` collapse to [MailDetailTrust.Verified];
     * `unverified` collapses to [MailDetailTrust.Neutral].
     */
    val detailTrust: MailDetailTrust
        get() =
            when (this) {
                Verified, Chain, CertifiedChain -> MailDetailTrust.Verified
                Partial -> MailDetailTrust.Warning
                Unverified -> MailDetailTrust.Neutral
            }

    companion object {
        /** Maps the backend `sender_trust` string onto a pill state. */
        fun fromRaw(value: String?): MailTrust =
            when (value) {
                "verified_gov", "verified_utility", "verified_business" -> Verified
                "pantopus_user" -> Chain
                "partial" -> Partial
                else -> Unverified
            }
    }
}
