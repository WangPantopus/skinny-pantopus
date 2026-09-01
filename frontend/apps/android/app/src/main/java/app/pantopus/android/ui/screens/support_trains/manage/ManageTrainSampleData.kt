@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains.manage

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A13.13 — Manage train. Deterministic fixtures the [ManageTrainViewModel]
 * loads on `load()` and Paparazzi snapshot baselines render directly.
 * Mirrors the iOS `ManageTrainSampleData` byte-for-byte so the two
 * platforms project the same content.
 *
 *  - [active] — day 12/21 of a Murphy-family meal train, 18/21 slots
 *    covered, 1 dropout, draft update typed and ready to send to the
 *    12 active helpers.
 *  - The CLOSING frame just flips the sheet state on the active fixture.
 */
object ManageTrainSampleData {
    const val TRAIN_ID: String = "train_murphy_meal"

    val active: ManageTrainContent =
        ManageTrainContent(
            trainId = TRAIN_ID,
            title = "Meals for the Murphy family",
            dateRangeLabel = "May 18 → Jun 7 · 21 days",
            isActive = true,
            slotFillValue = "18/21",
            helpersValue = "12",
            daysLeftValue = "9d",
            dropoutValue = "1",
            slotsFilled = 18,
            slotsOpen = 2,
            slotsDropout = 1,
            slotsTotal = 21,
            slotFillCaption = "18 / 21 · 86%",
            draftMessage =
                "Quick note from Daniel — Theo had a rough night so we'll push Tuesday's drop to 6:30pm. " +
                    "Anything cold-friendly is perfect. Thank you all, truly.",
            audienceChips =
                listOf(
                    AudienceChipContent("all", "All helpers", "12"),
                    AudienceChipContent("upcoming", "Upcoming only", "6"),
                    AudienceChipContent("family", "Family", "3"),
                ),
            selectedAudienceId = "all",
            pushToPhones = true,
            organizeRows =
                listOf(
                    OrganizeRowContent(
                        id = "edit-dates",
                        icon = PantopusIcon.CalendarCog,
                        tone = OrganizeRowTone.AMBER,
                        label = "Edit dates & slots",
                        meta = "21",
                        sub = "Add, swap, or remove cooking days. Helpers see live changes.",
                        isDestructive = false,
                    ),
                    OrganizeRowContent(
                        id = "invite",
                        icon = PantopusIcon.UserPlus,
                        tone = OrganizeRowTone.SKY,
                        label = "Invite more helpers",
                        meta = null,
                        sub = "Share a link or pick from neighbors who follow this train.",
                        isDestructive = false,
                    ),
                    OrganizeRowContent(
                        id = "analytics",
                        icon = PantopusIcon.BarChart3,
                        tone = OrganizeRowTone.GREEN,
                        label = "Analytics",
                        meta = null,
                        sub = "Fill rate, response time, top contributors — last 21 days.",
                        isDestructive = false,
                    ),
                ),
            closeRow =
                OrganizeRowContent(
                    id = "close",
                    icon = PantopusIcon.Archive,
                    tone = OrganizeRowTone.RED,
                    label = "Close train",
                    meta = null,
                    sub = "Lock new signups and send a thank-you to everyone.",
                    isDestructive = true,
                ),
            close =
                CloseTrainSheetContent(
                    daysEarlyLabel = "Locks new signups · 9 days early",
                    mealsDelivered = "18",
                    neighborsHelped = "12",
                    coverageDays = "12d",
                    recipientQuote =
                        "\"Theo's eating, sleeping, and chubbing up. We can take it from here. " +
                            "From the bottom of our spoon drawer — thank you.\" — Daniel",
                ),
        )
}
