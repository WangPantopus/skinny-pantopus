@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.vacation

import java.time.LocalDate

/**
 * A14.8 — deterministic fixtures backing the Vacation Hold sample mode.
 * Mirrors `Features/Mailbox/Vacation/VacationHoldSampleData.swift`.
 */
object VacationHoldSampleData {
    val schedulingDraft: VacationScheduleDraft by lazy {
        VacationScheduleDraft(
            fromDate = LocalDate.of(2026, 5, 28),
            toDate = LocalDate.of(2026, 6, 9),
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
            forwardingEnabled = true,
            forwarding =
                VacationForwardingTarget(
                    title = "142 Mulberry St, Apt 3B",
                    sub = "New York, NY 10013 · Mom's place",
                ),
            emergency =
                VacationEmergencyContact(
                    name = "Sam Park",
                    initials = "SP",
                    relation = "Spouse",
                    phone = "(•••) 555-0247",
                ),
            footerBlurb = "14 Elm Park Lane · Last hold Jul 2023",
        )
    }

    val activeHold: VacationActiveHold by lazy {
        VacationActiveHold(
            daysLeft = 5,
            untilLabel = "Jun 9",
            resumeBlurb = "Everything held resumes delivery the morning of Jun 9.",
            stats =
                listOf(
                    VacationHoldStat(id = "packages", count = 4, label = "Packages"),
                    VacationHoldStat(id = "mailItems", count = 12, label = "Mail items"),
                    VacationHoldStat(id = "forwarded", count = 1, label = "Forwarded"),
                ),
            heldItems =
                listOf(
                    VacationHeldItem(
                        icon = VacationHeldItem.Icon.Packages,
                        label = "Packages",
                        sub = "Held at Park Slope hub",
                        count = 4,
                    ),
                    VacationHeldItem(
                        icon = VacationHeldItem.Icon.Mail,
                        label = "Mail & flyers",
                        sub = "USPS holding",
                        count = 12,
                    ),
                    VacationHeldItem(
                        icon = VacationHeldItem.Icon.Forwarded,
                        label = "Forwarded urgent",
                        sub = "→ 142 Mulberry St",
                        count = 1,
                    ),
                    VacationHeldItem(
                        icon = VacationHeldItem.Icon.Civic,
                        label = "Civic notices",
                        sub = "Delivered as normal",
                        count = 2,
                    ),
                ),
            forwarding =
                VacationForwardingTarget(
                    title = "142 Mulberry St, Apt 3B",
                    sub = "Mom's place · 1 item sent",
                ),
            emergency =
                VacationEmergencyContact(
                    name = "Sam Park",
                    initials = "SP",
                    relation = "Spouse",
                    phone = "(•••) 555-0247",
                ),
            activeSinceLabel = "14 Elm Park Lane · Active since May 28",
        )
    }
}
