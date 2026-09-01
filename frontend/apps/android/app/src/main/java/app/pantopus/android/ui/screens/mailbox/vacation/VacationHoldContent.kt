@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.vacation

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * A14.8 — render-only models for the Vacation Hold screen. Mirrors
 * `Features/Mailbox/Vacation/VacationHoldContent.swift`.
 */

/** One row in the "Hold during this period" toggle card. */
data class VacationHoldScope(
    val kind: Kind,
    val label: String,
    val sub: String,
    val isOn: Boolean,
    val isLocked: Boolean = false,
) {
    val id: String get() = kind.id

    enum class Kind(val id: String) {
        Mail("mail"),
        Packages("packages"),
        MarketplacePickups("marketplacePickups"),
        Civic("civic"),
    }
}

/**
 * Forwarding address row payload. Null collapses the chevron row into
 * "Set a forward-to address" placeholder copy.
 */
data class VacationForwardingTarget(
    val title: String,
    val sub: String,
)

/**
 * Emergency-contact row payload — scheduling form + read-only on the
 * active variant.
 */
data class VacationEmergencyContact(
    val name: String,
    val initials: String,
    val relation: String,
    val phone: String,
)

/** Single row in the active-variant "Currently held" ledger. */
data class VacationHeldItem(
    val icon: Icon,
    val label: String,
    val sub: String,
    val count: Int,
) {
    val id: String get() = icon.id

    enum class Icon(val id: String) {
        Packages("packages"),
        Mail("mail"),
        Forwarded("forwarded"),
        Civic("civic"),
    }
}

/** 3-cell stat grid inside the active hero. */
data class VacationHoldStat(
    val id: String,
    val count: Int,
    val label: String,
)

/** Snapshot of an in-flight hold. */
data class VacationActiveHold(
    val daysLeft: Int,
    val untilLabel: String,
    val resumeBlurb: String,
    val stats: List<VacationHoldStat>,
    val heldItems: List<VacationHeldItem>,
    val forwarding: VacationForwardingTarget?,
    val emergency: VacationEmergencyContact?,
    val activeSinceLabel: String,
)

/** Mutable scheduling state. */
data class VacationScheduleDraft(
    val fromDate: LocalDate,
    val toDate: LocalDate,
    val scopes: List<VacationHoldScope>,
    val forwardingEnabled: Boolean,
    val forwarding: VacationForwardingTarget?,
    val emergency: VacationEmergencyContact?,
    val footerBlurb: String,
) {
    /**
     * Inclusive span in days — May 28 → Jun 9 reads as 13 days, both
     * endpoints counted. The hold spans every day in the range.
     */
    val spanDays: Int
        get() {
            val between = ChronoUnit.DAYS.between(fromDate, toDate).toInt()
            return (between + 1).coerceAtLeast(0)
        }

    /**
     * Form is valid when there is at least 1 day of hold and at least
     * one un-locked scope is on.
     */
    val isValid: Boolean
        get() = spanDays >= 1 && scopes.any { it.isOn && !it.isLocked }

    companion object {
        /**
         * Blank composer the live screen opens with when
         * `GET /vacation/status` reports no hold. Only the scope copy is
         * canned (UI labelling, not user data) — the dates default to today
         * → +7 days the way RN's `vacation.tsx:37-41` does, and the
         * forwarding address / emergency contact stay empty rather than
         * showing a fixture as if it were the user's own. Mirrors iOS
         * `VacationScheduleDraft.liveDefault`.
         */
        fun liveDefault(today: LocalDate = LocalDate.now()): VacationScheduleDraft =
            VacationScheduleDraft(
                fromDate = today,
                toDate = today.plusDays(DEFAULT_HOLD_DAYS),
                scopes =
                    listOf(
                        VacationHoldScope(
                            kind = VacationHoldScope.Kind.Mail,
                            label = "Mail & flyers",
                            sub = "Postal hold via USPS API",
                            isOn = true,
                        ),
                        VacationHoldScope(
                            kind = VacationHoldScope.Kind.Packages,
                            label = "Packages",
                            sub = "Carriers hold at neighborhood hub",
                            isOn = true,
                        ),
                        VacationHoldScope(
                            kind = VacationHoldScope.Kind.MarketplacePickups,
                            label = "Marketplace pickups",
                            sub = "Buyers see away status",
                            isOn = true,
                        ),
                        VacationHoldScope(
                            kind = VacationHoldScope.Kind.Civic,
                            label = "Civic notices",
                            sub = "Permits, voting, service alerts",
                            isOn = false,
                            isLocked = true,
                        ),
                    ),
                forwardingEnabled = false,
                forwarding = null,
                emergency = null,
                footerBlurb = "Applies to your primary home address.",
            )

        private const val DEFAULT_HOLD_DAYS = 7L
    }
}

/** What the screen is doing right now. */
sealed interface VacationHoldMode {
    data class Scheduling(val draft: VacationScheduleDraft) : VacationHoldMode

    data class Active(val hold: VacationActiveHold) : VacationHoldMode
}

/** Initial seed for the screen — `scheduling` or `active`. */
enum class VacationHoldSeed {
    Scheduling,
    Active,
}
