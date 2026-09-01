@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.owners

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * P15 / T6.3g — Per-feature palette for the Owners row proof chip.
 * Mirrors iOS `OwnerProofPalette.swift`. The proof tone matrix at
 * `owners-frames.jsx:59-64` maps cleanly onto existing semantic
 * tokens — no hex literals appear in this file.
 *
 * Why a per-feature palette? The mapping from
 * `(HomeOwner.owner_status, verification_tier)` → visual tone is a
 * non-trivial join. Keeping it out of the ViewModel keeps the
 * projection table colocated with the design source.
 */
enum class OwnerProof {
    Deed,
    Title,
    Document,
    Pending,
    ;

    /** Chip label rendered in the inline proof pill. */
    val label: String
        get() =
            when (this) {
                Deed -> "Deed"
                Title -> "Title"
                Document -> "Document"
                Pending -> "Pending"
            }

    /**
     * Verbose body line rendered under the subtitle (e.g.
     * "Deed on file"). Mirrors the user-facing wording specified in
     * the P15 brief.
     */
    val bodyLabel: String
        get() =
            when (this) {
                Deed -> "Deed on file"
                Title -> "Title on file"
                Document -> "Document on file"
                Pending -> "Pending review"
            }

    /** Glyph rendered in the chip and the body row. */
    val icon: PantopusIcon
        get() =
            when (this) {
                Deed -> PantopusIcon.ShieldCheck
                Title -> PantopusIcon.File
                Document -> PantopusIcon.FileText
                Pending -> PantopusIcon.Clock
            }

    /** Chip background tint. */
    val chipBackground: Color
        get() =
            when (this) {
                Deed -> PantopusColors.homeBg
                Title -> PantopusColors.primary50
                Document -> PantopusColors.warningBg
                Pending -> PantopusColors.appSurfaceSunken
            }

    /** Chip foreground / icon tint. */
    val chipForeground: Color
        get() =
            when (this) {
                Deed -> PantopusColors.home
                Title -> PantopusColors.primary700
                Document -> PantopusColors.warning
                Pending -> PantopusColors.appTextStrong
            }

    companion object {
        /**
         * Map a `(owner_status, verification_tier)` pair to a proof
         * tone. Status precedence wins — `pending` always reads as
         * Pending regardless of the verification tier its claim carries.
         *
         * Tier values mirror the `owner_verification_tier` enum at
         * `backend/database/schema.sql:491` (`weak / standard / strong /
         * legal`).
         */
        fun resolve(
            ownerStatus: String,
            verificationTier: String,
        ): OwnerProof {
            when (ownerStatus.lowercase()) {
                "pending" -> return Pending
                "disputed", "revoked" -> return Document
                else -> Unit
            }
            return when (verificationTier.lowercase()) {
                "legal", "strong" -> Deed
                "standard" -> Title
                else -> Document
            }
        }
    }
}

/**
 * Identity-tone avatar background palette for an Owner row. Indexed by
 * row position so co-owners get distinguishable hues. Lifted from
 * `owners-frames.jsx:72-77` but mapped onto existing tokens — home-green
 * for owner 1 (matches the screen's home identity), sky for owner 2,
 * amber for owner 3, business-violet for owner 4. Beyond index 3 we
 * wrap.
 */
enum class OwnerTone {
    Home,
    Sky,
    Amber,
    Violet,
    ;

    val gradient: GradientPair
        get() =
            when (this) {
                Home ->
                    GradientPair(
                        start = PantopusColors.home,
                        end = PantopusColors.successBg,
                    )
                Sky ->
                    GradientPair(
                        start = PantopusColors.primary500,
                        end = PantopusColors.primary700,
                    )
                Amber ->
                    GradientPair(
                        start = PantopusColors.warning,
                        end = PantopusColors.warningLight,
                    )
                Violet ->
                    GradientPair(
                        start = PantopusColors.business,
                        end = PantopusColors.businessBg,
                    )
            }

    companion object {
        fun at(index: Int): OwnerTone {
            val all = entries
            val mod = ((index % all.size) + all.size) % all.size
            return all[mod]
        }
    }
}
