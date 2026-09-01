@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.membership

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.components.PersonaPillar
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A10.8 — Fan membership manage. Render models for the fan-side view of a
 * paid membership to a persona (creator / business). Mirrors the iOS
 * `MembershipDetailContent.swift` shape so cross-platform parity tests can
 * compare the projection one-to-one.
 */

/**
 * Membership tier with its paper-card colour treatment. The tier palette
 * (Bronze / Silver / Gold) is membership-local — identity pillars + semantic
 * colours live in `PantopusColors`. Mirrors the `GigsCategory.color`
 * precedent: feature-local swatches carry the hex on the enum rather than
 * crowding the shared theme.
 */
enum class MembershipTier(
    val displayName: String,
    val ladderRank: Int,
    val bgColor: Color,
    val fgColor: Color,
) {
    Bronze("Bronze", 1, Color(0xFFFEF3C7), Color(0xFF92400E)),
    Silver("Silver", 2, Color(0xFFF1F3F5), Color(0xFF374151)),
    Gold("Gold", 3, Color(0xFFFEF9C3), Color(0xFF854D0E)),
    ;

    companion object {
        /** Total rungs on the ladder (Bronze · Silver · Gold). */
        val ladderTotal: Int get() = entries.size
    }
}

/** The persona the fan supports — drives the PersonaCard at the top. */
@Immutable
data class MembershipPersona(
    val id: String,
    val name: String,
    val initials: String,
    val subtitle: String,
    val pillar: PersonaPillar,
    val pillarLabel: String,
    val verified: Boolean,
)

/**
 * One verified-benefit row. [slaBadge] is non-null for the benefit that
 * carries the service-level promise so it renders as a visible chip rather
 * than hiding inside the meta line.
 */
@Immutable
data class MembershipBenefit(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val meta: String,
    val slaBadge: String? = null,
)

/**
 * SLA-missed banner payload. Owns the broken promise up front and offers
 * the refund as the primary action; "give it a week" is the gentle
 * alternative — never a guilt-trip.
 */
@Immutable
data class MembershipSLAAlert(
    val title: String,
    val message: String,
    val refundCtaLabel: String,
    val dismissCtaLabel: String,
)

/**
 * The "Inbox" card on the membership screen — the fan's entry point into
 * persona DMs, with the remaining message-thread credits as its footnote.
 */
@Immutable
data class MembershipInboxCard(
    /**
     * Null credits and a zero/absent allowance are different states: the
     * first is unlimited, the second is "no messaging on this tier".
     */
    val remainingThreads: Int?,
    val threadsPerPeriod: Int?,
) {
    /** Mirrors RN's footnote under the "Open inbox" CTA. */
    val footnote: String
        get() {
            val perPeriod = threadsPerPeriod
            if (perPeriod == null || perPeriod == 0) {
                return "No messaging on this tier — upgrade to send a DM."
            }
            if (perPeriod < 0 || remainingThreads == null) {
                return "Unlimited message threads on this tier."
            }
            val noun = if (remainingThreads == 1) "message thread" else "message threads"
            return "$remainingThreads $noun left this period."
        }
}

/**
 * Direction of a tier change. The label is the honest one — an upgrade lands
 * immediately, a downgrade is scheduled at period end.
 */
enum class MembershipTierDirection(
    val label: String,
    val timingNote: String,
) {
    Upgrade("Upgrade", "Takes effect immediately"),
    Downgrade("Downgrade", "Scheduled for the end of this period"),
}

/** One row in the change-tier picker. */
@Immutable
data class MembershipTierOption(
    val id: String,
    val rank: Int,
    val name: String,
    val priceLabel: String,
    val direction: MembershipTierDirection,
)

/**
 * Composed content for the membership detail surface. [slaAlert] is non-null
 * only in the `SlaMissed` state (the amber banner + warn-tone renewal row
 * read from it).
 */
@Immutable
data class MembershipDetailContent(
    val persona: MembershipPersona,
    val tier: MembershipTier,
    val priceLabel: String,
    val periodLabel: String,
    val renewalLabel: String,
    val paymentLabel: String,
    val benefits: List<MembershipBenefit>,
    val policyFootnote: String,
    val slaAlert: MembershipSLAAlert? = null,
    /** Persona UUID — the `:id` path segment for the inbox push. */
    val personaId: String = "",
    val inbox: MembershipInboxCard = MembershipInboxCard(remainingThreads = null, threadsPerPeriod = null),
    /** True once a tier change is queued for the end of the current period. */
    val hasScheduledTierChange: Boolean = false,
    /** Terminal memberships (`canceled` / `expired`) hide every mutation. */
    val isTerminal: Boolean = false,
    val cancelAtPeriodEnd: Boolean = false,
) {
    /** Same content with the SLA banner dropped — used by "give it a week". */
    fun clearingSlaAlert(): MembershipDetailContent = copy(slaAlert = null)
}

/**
 * Lightweight descriptor for the "You're a member" footer rendered on the
 * Audience Profile — the Wave A direct-link entry point into membership
 * detail until the standalone Memberships index list ships.
 */
@Immutable
data class AudienceMemberFooter(
    val personaId: String,
    val personaName: String,
    val tierName: String,
)

/**
 * Top-level state for the membership detail VM. No `Empty` case — a fan only
 * reaches this screen for an active membership; `SlaMissed` is the happy-path
 * content plus the refund banner.
 */
sealed interface MembershipDetailUiState {
    data object Loading : MembershipDetailUiState

    data class Populated(val content: MembershipDetailContent) : MembershipDetailUiState

    data class SlaMissed(val content: MembershipDetailContent) : MembershipDetailUiState

    data class Error(val message: String) : MembershipDetailUiState
}
