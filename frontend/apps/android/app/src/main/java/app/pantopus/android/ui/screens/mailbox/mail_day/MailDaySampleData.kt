@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_day

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A13.16 — deterministic sample fixtures for the My Mail Day editor.
 * The view-model projects these into render states; previews / tests
 * stay stable.
 *
 * `populated` mirrors the JSX `FrameMailDayPopulated` (mid-afternoon,
 * 8-piece stack with the latest reviewed row pulsing a 5-second undo).
 * `empty` mirrors `FrameMailDayEmpty` (no scan yet today + yesterday
 * recap + setup nudges).
 */
object MailDaySampleData {
    val populated =
        MailDayContent(
            dateLabel = "Thu · Oct 9",
            streakDays = 12,
            lastScanLabel = "22 min ago",
            unreviewed =
                listOf(
                    UnreviewedMailDayItem(
                        id = "mail-day-un-1",
                        kind = MailDayKind.Bill,
                        label = "Con Edison bill",
                        sender = "Con Edison · NY",
                        suggestedName = "Maria Kovács",
                        suggestedAvatar = MailDaySuggestedAvatar.PersonalSky,
                        confidencePercent = 94,
                        secondaryLabel = "Other",
                    ),
                    UnreviewedMailDayItem(
                        id = "mail-day-un-2",
                        kind = MailDayKind.Postcard,
                        label = "Postcard from Lisbon",
                        sender = "P. Almeida · Lisbon, PT",
                        suggestedName = "Marcus Khan",
                        suggestedAvatar = MailDaySuggestedAvatar.HouseholdGreen,
                        confidencePercent = 71,
                        secondaryLabel = "Route to…",
                    ),
                ),
            reviewed =
                listOf(
                    ReviewedMailDayItem(
                        id = "mail-day-rv-1",
                        kind = MailDayKind.Magazine,
                        label = "The New Yorker · Oct 9",
                        action = ReviewedMailAction.Routed,
                        routedTo = "Marcus",
                        routedTint = MailDayRoutedTint.HouseholdHome,
                        whenLabel = "2 min ago",
                        undoCountdown = 5,
                    ),
                    ReviewedMailDayItem(
                        id = "mail-day-rv-2",
                        kind = MailDayKind.Flyer,
                        label = "Whole Foods circular",
                        action = ReviewedMailAction.Junked,
                        routedTo = null,
                        routedTint = null,
                        whenLabel = "14 min ago",
                        undoCountdown = null,
                    ),
                    ReviewedMailDayItem(
                        id = "mail-day-rv-3",
                        kind = MailDayKind.Package,
                        label = "USPS package slip",
                        action = ReviewedMailAction.Routed,
                        routedTo = "Maria",
                        routedTint = MailDayRoutedTint.PersonPrimary,
                        whenLabel = "38 min ago",
                        undoCountdown = null,
                    ),
                    ReviewedMailDayItem(
                        id = "mail-day-rv-4",
                        kind = MailDayKind.Envelope,
                        label = "Wedding invite · Costa Mesa",
                        action = ReviewedMailAction.Routed,
                        routedTo = "Maria",
                        routedTint = MailDayRoutedTint.PersonPrimary,
                        whenLabel = "1 hr ago",
                        undoCountdown = null,
                    ),
                    ReviewedMailDayItem(
                        id = "mail-day-rv-5",
                        kind = MailDayKind.Bill,
                        label = "Spectrum statement",
                        action = ReviewedMailAction.Routed,
                        routedTo = "House · Bills",
                        routedTint = MailDayRoutedTint.HouseholdHome,
                        whenLabel = "2 hr ago",
                        undoCountdown = null,
                    ),
                    ReviewedMailDayItem(
                        id = "mail-day-rv-6",
                        kind = MailDayKind.Envelope,
                        label = "Unknown · no return address",
                        action = ReviewedMailAction.Returned,
                        routedTo = null,
                        routedTint = null,
                        whenLabel = "3 hr ago",
                        undoCountdown = null,
                    ),
                ),
            yesterdayRecap = null,
            setupNudges = emptyList(),
        )

    val empty =
        MailDayContent(
            dateLabel = "Fri · Oct 10",
            streakDays = 12,
            lastScanLabel = "9h ago",
            unreviewed = emptyList(),
            reviewed = emptyList(),
            yesterdayRecap =
                YesterdayRecap(
                    dateLabel = "Wed · Oct 8",
                    pieces = 7,
                    closedAtLabel = "closed 6:42 PM",
                    segments =
                        listOf(
                            YesterdayRecap.Segment("maria", 0.57f, "4 to Maria", YesterdayRecap.SegmentTint.PersonPrimary),
                            YesterdayRecap.Segment("marcus", 0.14f, "1 to Marcus", YesterdayRecap.SegmentTint.Household),
                            YesterdayRecap.Segment("junked", 0.14f, "1 junked", YesterdayRecap.SegmentTint.Junked),
                            YesterdayRecap.Segment("returned", 0.15f, "1 returned", YesterdayRecap.SegmentTint.Returned),
                        ),
                ),
            setupNudges =
                listOf(
                    MailDaySetupNudge(
                        id = "daily-reminder",
                        icon = PantopusIcon.Bell,
                        tint = MailDaySetupNudge.NudgeTint.Primary,
                        title = "Daily reminder · 5:00 PM",
                        subtitle = "Ping me to scan before the day closes.",
                    ),
                    MailDaySetupNudge(
                        id = "auto-route",
                        icon = PantopusIcon.Users,
                        tint = MailDaySetupNudge.NudgeTint.Home,
                        title = "Auto-route rules",
                        subtitle = "3 active · Con Ed always goes to Maria",
                    ),
                ),
        )
}
