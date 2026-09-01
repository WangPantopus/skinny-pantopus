@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.earn

/**
 * A10.11 — deterministic stub fixtures for the Earn dashboard. Mirrors
 * the two designed frames (populated active-earner + empty new-earner)
 * from `docs/designs/A10/earn-frames.jsx`. Snapshot tests + previews read
 * from here so both states render identically across runs and match the
 * iOS `EarnSampleData` enum line-for-line.
 *
 * There is no payout / Stripe Connect backend wired yet (this batch ships
 * the visual surface; the live swap lands with Connect), so the
 * view-model is seeded with this data and a null `content` selects the
 * empty new-earner frame.
 */
object EarnSampleData {
    /**
     * Shared across both frames — the `Ways to earn` engine is identical
     * for active and new earners. The featured first row lands on the
     * tinted `primary50` surface.
     */
    val waysToEarn: List<EarnWayToEarn> =
        listOf(
            EarnWayToEarn(
                kind = EarnWayKind.Browse,
                title = "Browse open tasks",
                meta = "28 near you · up to \$140 today",
                accent = EarnAccent.Primary,
                featured = true,
            ),
            EarnWayToEarn(
                kind = EarnWayKind.Refer,
                title = "Refer a neighbor",
                meta = "+\$10 when they finish a task",
                accent = EarnAccent.Home,
            ),
            EarnWayToEarn(
                kind = EarnWayKind.Offer,
                title = "Offer a service",
                meta = "Get matched to repeat clients",
                accent = EarnAccent.Business,
            ),
        )

    /**
     * Active-earner frame — $312.40 available, 74% to the weekly goal,
     * four recent earnings (one still pending), linked Chase payout with
     * auto-cash-out on, and the YTD / 1099 tax line.
     */
    val populated: EarnContent =
        EarnContent(
            available = "312.40",
            thisWeek = "\$148.00",
            thisWeekMeta = "6 tasks this week",
            pending = "\$60.00",
            pendingMeta = "1 task · clears Dec 3",
            weeklyGoal =
                EarnWeeklyGoal(
                    progress = 0.74f,
                    ringLabel = "74%",
                    ringSublabel = "to goal",
                    headline = "\$52 to go",
                    subcopy = "\$148 of your \$200 goal this week",
                ),
            waysToEarn = waysToEarn,
            earnings = earningsSample(),
            payoutMethod =
                EarnPayoutMethod(
                    bankLabel = "Chase checking",
                    last4 = "7421",
                    bodyText = "Instant payout · 1–3 minutes",
                ),
            autoCashOut =
                EarnAutoCashOut(
                    title = "Auto cash out",
                    detail = "Every Friday · cleared balance",
                    isOn = true,
                ),
            taxDocs =
                EarnTaxDocs(
                    bodyText = "YTD earnings \$4,920 · 1099 available mid-Jan",
                ),
        )

    private fun earningsSample(): List<EarnEarning> =
        listOf(
            EarnEarning(
                id = "earn-1",
                day = "Today",
                dateLabel = "2:14 pm",
                description = "Patio cleanup · 3 hr",
                counterparty = "Marcus P.",
                category = EarnCategory.Cleaning,
                status = EarnStatus.Paid,
                amount = "140.00",
            ),
            EarnEarning(
                id = "earn-2",
                day = "Yesterday",
                dateLabel = "6:40 pm",
                description = "Dog walk · 4 visits",
                counterparty = "Tom B.",
                category = EarnCategory.PetCare,
                status = EarnStatus.Paid,
                amount = "41.00",
            ),
            EarnEarning(
                id = "earn-3",
                day = "Dec 1",
                dateLabel = "11:14 am",
                description = "IKEA assembly",
                counterparty = "Reyes household",
                category = EarnCategory.Handyman,
                status = EarnStatus.Paid,
                amount = "120.00",
            ),
            EarnEarning(
                id = "earn-4",
                day = "Nov 29",
                dateLabel = "8:31 pm",
                description = "Babysitting · 3 hr",
                counterparty = "The Hahns",
                category = EarnCategory.ChildCare,
                status = EarnStatus.Pending(clearsLabel = "Dec 3"),
                amount = "60.00",
            ),
        )
}
